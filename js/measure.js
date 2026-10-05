/* KORbuild Measure — modelo do takeoff (docs/measure-revisao.md).
 *
 *  - Os pontos das medições ficam em coordenadas da página do PDF (points, 1/72" do papel), nunca em pixels.
 *  - Cada folha tem a sua escala (polegadas reais por point); a medida real é calculada, nunca digitada.
 *  - Condição (ex.: "Paredes externas") ≠ medições (os desenhos, em uma ou mais folhas).
 *  - Guardado: polegadas, polegadas², polegadas³. Na tela: ft-in, lin ft, sq ft, cu yd (js/imperial.js). */

import { novoId, hoje, somarDias } from './util.js';
import { estado, salvar } from './armazem.js';
import { comprimento, areaPoligono, fatorInclinacao, distancia, POL_POR_PE, POL2_POR_PE2 } from './imperial.js';
import { calcularLinha, validar } from './formulas.js';
import { contato } from './contatos.js';

function mz() { return estado().measure; }
export function projetos() { return mz().projetos; }
export function projeto(id) { return mz().projetos.find((p) => p.id === id); }
export function folha(id) { return mz().folhas.find((f) => f.id === id); }
export function folhasDo(projetoId) { return mz().folhas.filter((f) => f.projetoId === projetoId); }
export function condicao(id) { return mz().condicoes.find((c) => c.id === id); }
export function condicoesDo(projetoId) { return mz().condicoes.filter((c) => c.projetoId === projetoId); }
/* As condições de uma folha: as incluídas nela (e, por segurança, as que já têm medição nela). */
export function condicoesDaFolha(folhaId) {
  const f = folha(folhaId);
  return condicoesDo(f.projetoId).filter((c) => (c.folhas || []).includes(folhaId) || c.medicoes.some((m) => m.folhaId === folhaId));
}
/* Reaproveitar uma condição em outra folha (ex.: paredes do 1º e do 2º pavimento somando juntas). */
export function incluirNaFolha(condicaoId, folhaId) {
  const c = condicao(condicaoId);
  c.folhas = c.folhas || [];
  if (!c.folhas.includes(folhaId)) c.folhas.push(folhaId);
  salvar();
}
/* Tirar a condição de uma folha: as medições dela nesta folha saem (as das outras folhas ficam). */
export function tirarDaFolha(condicaoId, folhaId) {
  const c = condicao(condicaoId);
  for (const m of c.medicoes.filter((x) => x.folhaId === folhaId)) if (condicao(condicaoId).medicoes.some((x) => x.id === m.id)) excluirMedicao(condicaoId, m.id);
  c.folhas = (c.folhas || []).filter((x) => x !== folhaId);
  salvar();
}
/* Folhas em que a condição está (incluída ou medida). */
export function folhasDaCondicao(c) {
  const ids = new Set((c.folhas || []).concat(c.medicoes.map((m) => m.folhaId)));
  return folhasDo(c.projetoId).filter((f) => ids.has(f.id));
}

export const TIPOS = {
  linear: { nome: 'Linear', unidade: 'lin ft', icone: 'measure' },
  area: { nome: 'Área', unidade: 'sq ft', icone: 'obras' },
  contagem: { nome: 'Contagem', unidade: 'each', icone: 'mais' },
};
// Cores das condições, na ordem (bem distintas entre si e da planta em preto e branco)
export const CORES = ['#2563EB', '#C2410C', '#0F766E', '#7C3AED', '#B45309', '#DB2777', '#0891B2', '#4D7C0F'];
// Paleta sugerida para as condições (a pessoa também pode escolher qualquer outra cor)
export const PALETA = CORES.concat(['#DC2626', '#16A34A', '#9333EA', '#EA580C', '#1E3A8A', '#525252']);
const COR_VALIDA = /^#[0-9a-f]{6}$/i;

/* ---------- Projetos ---------- */

export const TIPOS_PROJETO = {
  'residencial-uni': 'Residencial unifamiliar', 'residencial-multi': 'Residencial multifamiliar',
  comercial: 'Comercial', industrial: 'Industrial', reforma: 'Reforma / ampliação', outro: 'Outro',
};
export const SITUACOES = {
  orcamento: { nome: 'Em orçamento', classe: 'etiqueta-azul' },
  enviada: { nome: 'Proposta enviada', classe: 'etiqueta-ambar' },
  ganha: { nome: 'Ganha', classe: 'etiqueta-verde' },
  perdida: { nome: 'Perdida', classe: 'etiqueta-neutro' },
};
export function enderecoDoProjeto(p) {
  return [p.endereco, p.cidade, [p.estado, p.zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

export function salvarProjeto(id, dados) {
  const t = (k) => String(dados[k] || '').trim();
  const d = {
    nome: t('nome'), contratanteId: t('contratanteId') || null, donoId: t('donoId') || null, endereco: t('endereco'), cidade: t('cidade'), estado: t('estado').toUpperCase(), zip: t('zip'),
    tipo: dados.tipo, situacao: dados.situacao, descricao: t('descricao'), obraId: t('obraId') || null, estimadorId: t('estimadorId') || null, prazoProposta: t('prazoProposta') || null,
  };
  if (!d.nome) return { erro: 'Dê um nome ao projeto.' };
  if (!d.contratanteId || !contato(d.contratanteId)) return { erro: 'Escolha o contratante: a construtora que pediu a proposta, ou o próprio cliente quando contrata direto.' };
  if (d.donoId === d.contratanteId) d.donoId = null;
  if (!d.cidade || !d.estado) return { erro: 'Informe a cidade e o estado da obra.' };
  if (!/^[A-Z]{2}$/.test(d.estado)) return { erro: 'Estado com 2 letras (ex.: NH).' };
  if (d.zip && !/^\d{5}(-\d{4})?$/.test(d.zip)) return { erro: 'ZIP code com 5 dígitos (ex.: 03104).' };
  if (!TIPOS_PROJETO[d.tipo]) return { erro: 'Escolha o tipo de obra.' };
  if (!SITUACOES[d.situacao]) return { erro: 'Escolha a situação.' };
  if (d.prazoProposta && !/^\d{4}-\d{2}-\d{2}$/.test(d.prazoProposta)) return { erro: 'Prazo da proposta inválido.' };
  if (id) { Object.assign(projeto(id), d, { alteradoEm: Date.now() }); salvar(); return { ok: true, id }; }
  const novo = { id: novoId('pj'), ...d, criadoEm: Date.now() };
  mz().projetos.push(novo);
  salvar();
  return { ok: true, id: novo.id };
}

/* Excluir o projeto apaga as folhas e as condições (com as medições) dele. */
export function excluirProjeto(id) {
  mz().projetos = projetos().filter((p) => p.id !== id);
  mz().folhas = mz().folhas.filter((f) => f.projetoId !== id);
  mz().condicoes = mz().condicoes.filter((c) => c.projetoId !== id);
  mz().typicais = (mz().typicais || []).filter((t) => t.projetoId !== id);
  salvar();
}

/* ---------- Escala ---------- */

export function definirEscala(folhaId, escala) {
  const f = folha(folhaId);
  f.escala = { ...escala, em: Date.now() };
  salvar();
}
/* Conferência: mede-se uma segunda cota conhecida. Diferença acima de 1% é suspeita. */
export function registrarConferencia(folhaId, esperadoPol, medidoPol) {
  const f = folha(folhaId);
  const diferenca = Math.abs(medidoPol - esperadoPol) / esperadoPol;
  f.escala.conferencia = { esperadoPol, medidoPol, diferenca, ok: diferenca <= 0.01, em: Date.now() };
  salvar();
  return f.escala.conferencia;
}

/* ---------- Condições e medições ---------- */

export function salvarCondicao(id, dados) {
  if (!dados.nome || !dados.nome.trim()) return { erro: 'Dê um nome à condição (ex.: Paredes externas).' };
  if (!TIPOS[dados.tipo]) return { erro: 'Escolha o tipo.' };
  const cor = String(dados.cor || '').trim().toUpperCase();
  if (cor && !COR_VALIDA.test(cor)) return { erro: 'Cor inválida.' };
  if (id) {
    const c = condicao(id);
    Object.assign(c, { nome: dados.nome.trim(), props: dados.props || {} }, cor ? { cor } : {});
    salvar();
    return { ok: true, id };
  }
  const usadas = condicoesDo(dados.projetoId).map((c) => c.cor);
  const c = {
    id: novoId('cd'), projetoId: dados.projetoId, folhas: dados.folhaId ? [dados.folhaId] : [], nome: dados.nome.trim(), tipo: dados.tipo,
    cor: cor || PALETA.find((x) => !usadas.includes(x)) || PALETA[usadas.length % PALETA.length], props: dados.props || {}, medicoes: [],
  };
  mz().condicoes.push(c);
  salvar();
  return { ok: true, id: c.id };
}

/* Mostrar ou ocultar as marcações da condição no desenho (só visual: as quantidades não mudam). */
export function mostrarCondicao(id, visivel) {
  condicao(id).oculta = !visivel;
  salvar();
}

/* ---------- Typicals: o que se repete ----------
 * Um typical é um grupo de medições que se repete (apartamento tipo, pavimento tipo, casa repetida).
 * Ele tem uma REGIÃO na folha (retângulo, em points do PDF) ou a FOLHA INTEIRA (regiao = null), e as
 * OCORRÊNCIAS: onde se repete e quantas vezes, contando a que está desenhada (ex.: 2º pav. 4, 3º pav. 4).
 * Toda medição cujo centro cai na região vale × o total de ocorrências, em todos os cálculos. */

export function typicaisDo(projetoId) { return (mz().typicais || []).filter((t) => t.projetoId === projetoId); }
export function typicaisDaFolha(folhaId) { return (mz().typicais || []).filter((t) => t.folhaId === folhaId); }
export function typical(id) { return (mz().typicais || []).find((t) => t.id === id); }
export function repeticoes(t) { return t.ocorrencias.reduce((s, o) => s + o.quantidade, 0); }

const centro = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
const dentroDaRegiao = (p, r) => p[0] >= r[0] && p[0] <= r[2] && p[1] >= r[1] && p[1] <= r[3];

/* O typical a que a medição pertence (pelo centro dela), ou null. */
export function typicalDaMedicao(m) {
  const ts = typicaisDaFolha(m.folhaId);
  if (!ts.length) return null;
  const c = centro(m.pontos);
  return ts.find((t) => !t.regiao || dentroDaRegiao(c, t.regiao)) || null;
}
export function fatorDaMedicao(m) { const t = typicalDaMedicao(m); return t ? repeticoes(t) : 1; }

export function salvarTypical(id, dados, por) {
  const nome = String(dados.nome || '').trim();
  if (!nome) return { erro: 'Dê um nome ao typical (ex.: Apartamento tipo A).' };
  const ocorrencias = (dados.ocorrencias || []).map((o) => ({ rotulo: String(o.rotulo || '').trim(), quantidade: Number(o.quantidade) }))
    .filter((o) => o.rotulo || o.quantidade);
  if (!ocorrencias.length) return { erro: 'Informe onde ele se repete e quantas vezes.' };
  if (ocorrencias.some((o) => !o.rotulo || !(Number.isInteger(o.quantidade) && o.quantidade >= 1))) return { erro: 'Cada ocorrência precisa de um nome (ex.: 2º pavimento) e de uma quantidade inteira a partir de 1.' };
  const atual = id ? typical(id) : null;
  const folhaId = atual ? atual.folhaId : dados.folhaId;
  const regiao = atual ? atual.regiao : (dados.regiao ? [Math.min(dados.regiao[0][0], dados.regiao[1][0]), Math.min(dados.regiao[0][1], dados.regiao[1][1]), Math.max(dados.regiao[0][0], dados.regiao[1][0]), Math.max(dados.regiao[0][1], dados.regiao[1][1])] : null);
  // folha inteira não convive com outros typicals na mesma folha (seria multiplicar duas vezes)
  const outros = typicaisDaFolha(folhaId).filter((t) => t.id !== id);
  if (!regiao && outros.length) return { erro: 'Esta folha já tem typical por região. Para a folha inteira, tire os outros antes.' };
  if (outros.some((t) => !t.regiao)) return { erro: 'Esta folha inteira já é um typical. Edite as ocorrências dele.' };
  if (regiao && outros.some((t) => !(regiao[2] < t.regiao[0] || regiao[0] > t.regiao[2] || regiao[3] < t.regiao[1] || regiao[1] > t.regiao[3]))) return { erro: 'A região encosta em outro typical. Typicals não podem se sobrepor.' };
  mz().typicais = mz().typicais || [];
  if (atual) { Object.assign(atual, { nome, ocorrencias, alteradoPor: por, alteradoEm: Date.now() }); salvar(); return { ok: true, id }; }
  const novo = { id: novoId('ty'), projetoId: folha(folhaId).projetoId, folhaId, nome, regiao, ocorrencias, por, em: Date.now() };
  mz().typicais.push(novo);
  salvar();
  return { ok: true, id: novo.id };
}
export function excluirTypical(id) {
  mz().typicais = (mz().typicais || []).filter((t) => t.id !== id);
  salvar();
}

/* Quanto cada condição mede dentro de um typical (uma unidade) — para o resumo por ocorrência. */
export function medidoNoTypical(t) {
  const r = [];
  for (const c of condicoesDo(t.projetoId)) {
    let base = 0, n = 0;
    for (const m of c.medicoes) {
      if (m.folhaId !== t.folhaId || typicalDaMedicao(m) !== t) continue;
      const v = valorDaMedicao(c, m);
      if (v != null) { base += v; n++; }
    }
    if (n) r.push({ condicao: c, base, medicoes: n });
  }
  return r;
}

export function excluirCondicao(id) {
  // vão desenhado: a contagem excluída leva os recortes que fez; a área excluída sai dos vãos que a recortavam
  for (const c of mz().condicoes) {
    c.medicoes = c.medicoes.filter((m) => !(m.vaoDe && m.vaoDe.condicaoId === id));
    for (const m of c.medicoes) if (m.vao) m.vao.recortes = m.vao.recortes.filter((r) => r.condicaoId !== id);
  }
  mz().condicoes = mz().condicoes.filter((c) => c.id !== id);
  // a contagem excluída deixa de ser vão descontado nas paredes e no siding
  for (const c of mz().condicoes) if (c.props && c.props.vaos) c.props.vaos = c.props.vaos.filter((x) => x !== id);
  salvar();
}

export function adicionarMedicao(condicaoId, folhaId, pontos, desconto) {
  const c = condicao(condicaoId);
  const m = { id: novoId('md'), folhaId, pontos: pontos.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]), desconto: !!desconto, em: Date.now() };
  c.medicoes.push(m);
  salvar();
  return m;
}

/* Apagar uma medição. Um vão desenhado é uma coisa só: apagar a contagem ou o recorte apaga os dois. */
export function excluirMedicao(condicaoId, medicaoId) {
  const c = condicao(condicaoId);
  const m = c.medicoes.find((x) => x.id === medicaoId);
  const raiz = m && m.vaoDe ? { c: condicao(m.vaoDe.condicaoId), id: m.vaoDe.medicaoId } : { c, id: medicaoId };
  const mr = raiz.c && raiz.c.medicoes.find((x) => x.id === raiz.id);
  if (mr && mr.vao) for (const r of mr.vao.recortes) { const o = condicao(r.condicaoId); if (o) o.medicoes = o.medicoes.filter((x) => x.id !== r.medicaoId); }
  if (raiz.c) raiz.c.medicoes = raiz.c.medicoes.filter((x) => x.id !== raiz.id);
  c.medicoes = c.medicoes.filter((x) => x.id !== medicaoId);
  salvar();
  return { vao: !!(mr && mr.vao) };
}

/* Vão desenhado (janela, porta): o retângulo conta +1 na contagem e recorta a mesma área das condições
 * de área escolhidas (siding, pintura). O recorte usa a medida desenhada; a contagem dá os materiais do vão. */
export function adicionarVao(contagemId, folhaId, retangulo, recortarIds) {
  const [a, b] = retangulo;
  const pts = [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]]];
  incluirNaFolha(contagemId, folhaId); // a janela passa a aparecer na folha em que foi desenhada
  const m = adicionarMedicao(contagemId, folhaId, [[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]]);
  m.vao = { pontos: pts, recortes: [] };
  for (const id of recortarIds) {
    const d = adicionarMedicao(id, folhaId, pts, true);
    d.vaoDe = { condicaoId: contagemId, medicaoId: m.id };
    m.vao.recortes.push({ condicaoId: id, medicaoId: d.id });
  }
  salvar();
  return m;
}

/* Valor de uma medição na unidade base: polegadas (linear), polegadas² (área), unidades (contagem).
 * Sem escala na folha, não há valor (só a contagem não depende da escala). */
export function valorDaMedicao(c, m) {
  const f = folha(m.folhaId);
  if (c.tipo === 'contagem') return m.pontos.length;
  if (!f || !f.escala) return null;
  const k = f.escala.polPorPonto;
  if (c.tipo === 'linear') return comprimento(m.pontos) * k;
  return areaPoligono(m.pontos) * k * k * (m.desconto ? -1 : 1);
}

/* Totais da condição: o valor medido e as medidas derivadas das propriedades (revisão §1.5). */
export function totaisDaCondicao(c) {
  let base = 0, semEscala = 0;
  for (const m of c.medicoes) {
    const v = valorDaMedicao(c, m);
    if (v == null) semEscala++; else base += v * fatorDaMedicao(m); // typical: a medição vale × repetições
  }
  const p = c.props || {};
  const derivados = [];
  if (c.tipo === 'linear') {
    if (p.alturaPol) derivados.push({ id: 'superficie', nome: 'Superfície (× altura)', pol2: base * p.alturaPol });
    if (p.inclinacao) derivados.push({ id: 'linearInclinado', nome: 'Linear inclinado', pol: base * fatorInclinacao(p.inclinacao) });
  }
  if (c.tipo === 'area') {
    if (p.inclinacao) derivados.push({ id: 'areaInclinada', nome: 'Área inclinada (telhado)', pol2: base * fatorInclinacao(p.inclinacao) });
    if (p.profundidadePol) derivados.push({ id: 'volume', nome: 'Volume (× espessura)', pol3: base * p.profundidadePol });
  }
  return { base, semEscala, derivados, medicoes: c.medicoes.length };
}

/* Ponto mais próximo entre os vértices já desenhados na folha (para "grudar" o clique). */
export function verticeProximo(folhaId, ponto, raioPts, filtro) {
  let melhor = null, d0 = raioPts;
  for (const c of mz().condicoes) if (!filtro || filtro(c)) for (const m of c.medicoes) if (m.folhaId === folhaId) for (const p of m.pontos) {
    const d = distancia(p, ponto);
    if (d < d0) { d0 = d; melhor = p; }
  }
  return melhor;
}

/* ---------- Variáveis da condição (unidades do ofício) ---------- */

export function variaveisDaCondicao(c) {
  const t = totaisDaCondicao(c);
  const p = c.props || {};
  const v = {};
  const fator = p.inclinacao ? fatorInclinacao(p.inclinacao) : null;
  if (p.inclinacao) { v.RoofPitch = p.inclinacao * 12; v.PitchFactor = fator; }
  if (c.tipo === 'linear') {
    v.MeasuredLinear = t.base / POL_POR_PE;
    if (p.alturaPol) { v.WallHeight = p.alturaPol / POL_POR_PE; v.SurfaceArea = v.MeasuredLinear * v.WallHeight; }
    if (fator) v.PitchedLinear = v.MeasuredLinear * fator;
  } else if (c.tipo === 'area') {
    v.MeasuredArea = t.base / POL2_POR_PE2; // os recortes desenhados já saíram daqui
    if (p.profundidadePol) { v.Thickness = p.profundidadePol; v.VolumeCF = v.MeasuredArea * p.profundidadePol / POL_POR_PE; v.VolumeCY = v.VolumeCF / 27; }
    if (fator) v.PitchedArea = v.MeasuredArea * fator;
  } else {
    v.MeasuredCount = t.base;
    // vão (janela/porta): largura × altura de cada unidade contada
    if (p.larguraPol) v.OpeningWidth = p.larguraPol / POL_POR_PE;
    if (p.alturaPol) v.OpeningHeight = p.alturaPol / POL_POR_PE;
    if (p.larguraPol && p.alturaPol) {
      v.OpeningArea = t.base * v.OpeningWidth * v.OpeningHeight;
      v.OpeningPerimeter = t.base * 2 * (v.OpeningWidth + v.OpeningHeight);
    }
  }
  // parede e siding: descontar os vãos das condições de contagem ligadas (props.vaos)
  if (c.tipo !== 'contagem') {
    const vaos = vaosLigados(c);
    const des = vaosDesenhados(c);
    v.OpeningCount = vaos.count + des.count; v.OpeningArea = vaos.area + des.area; v.OpeningPerimeter = vaos.perimetro + des.perimetro;
    if (v.SurfaceArea != null) v.NetSurfaceArea = Math.max(0, v.SurfaceArea - vaos.area);
    if (v.MeasuredArea != null) v.NetArea = Math.max(0, v.MeasuredArea - vaos.area);
  }
  return v;
}

/* Soma dos vãos (janelas, portas) das condições de contagem ligadas a uma parede ou ao siding. */
export function vaosLigados(c) {
  const r = { count: 0, area: 0, perimetro: 0, semTamanho: [] };
  for (const id of (c.props && c.props.vaos) || []) {
    const o = condicao(id);
    if (!o || o.tipo !== 'contagem') continue;
    // o vão desenhado que já recortou esta condição não é descontado de novo pelo tamanho cadastrado
    const n = o.medicoes.filter((m) => !(m.vao && m.vao.recortes.some((x) => x.condicaoId === c.id))).reduce((t, m) => t + m.pontos.length * fatorDaMedicao(m), 0);
    const w = (o.props || {}).larguraPol / POL_POR_PE, h = (o.props || {}).alturaPol / POL_POR_PE;
    r.count += n;
    if (w && h) { r.area += n * w * h; r.perimetro += n * 2 * (w + h); } else if (n) r.semTamanho.push(o.nome);
  }
  return r;
}

/* Vãos desenhados que recortaram esta condição de área: a área já saiu da medição; contam no
 * OpeningCount e no OpeningPerimeter (J-channel, flashing) com a medida desenhada. */
export function vaosDesenhados(c) {
  const r = { count: 0, area: 0, perimetro: 0 };
  for (const m of c.medicoes) {
    if (!m.vaoDe) continue;
    const f = folha(m.folhaId);
    if (!f || !f.escala) continue;
    const k = f.escala.polPorPonto;
    const n = fatorDaMedicao(m);
    r.count += n;
    r.area += n * areaPoligono(m.pontos) * k * k / POL2_POR_PE2;
    r.perimetro += n * comprimento(m.pontos.concat([m.pontos[0]])) * k / POL_POR_PE;
  }
  return r;
}

/* ---------- Catálogo de itens ---------- */

export const CATEGORIAS = { material: 'Material', 'mao-de-obra': 'Mão de obra', equipamento: 'Equipamento', subempreiteiro: 'Subempreiteiro' };
export function itens() { return mz().itens || []; }
export function item(id) { return itens().find((i) => i.id === id); }

export function salvarItem(id, dados) {
  const d = { codigo: (dados.codigo || '').trim(), nome: (dados.nome || '').trim(), categoria: dados.categoria, unidade: (dados.unidade || '').trim(), etapa: (dados.etapa || '').trim(), nota: (dados.nota || '').trim() };
  if (!d.nome || !d.unidade) return { erro: 'Informe o nome e a unidade de compra (ex.: chapa, caixa, cu yd, hora).' };
  if (!CATEGORIAS[d.categoria]) return { erro: 'Escolha a categoria.' };
  if (d.codigo && itens().some((i) => i.codigo.toLowerCase() === d.codigo.toLowerCase() && i.id !== id)) return { erro: 'Já existe um item com esse código.' };
  if (id) { Object.assign(item(id), d); salvar(); return { ok: true, id }; }
  const novo = { id: novoId('it'), ...d };
  mz().itens.push(novo);
  salvar();
  return { ok: true, id: novo.id };
}

export function excluirItem(id) {
  const usado = assemblies().filter((a) => a.linhas.some((l) => l.itemId === id));
  if (usado.length) return { erro: 'Item usado em: ' + usado.map((a) => a.nome).join(', ') + '. Tire do assembly antes.' };
  mz().itens = itens().filter((i) => i.id !== id);
  salvar();
  return { ok: true };
}

/* ---------- Assemblies ---------- */

export function assemblies() { return mz().assemblies || []; }
export function assembly(id) { return assemblies().find((a) => a.id === id); }

/* Cada linha: item + fórmula + perda (%) + arredondamento (passo: 0 = não arredonda, 1 = inteiro para cima…). */
export function salvarAssembly(id, dados) {
  const nome = (dados.nome || '').trim();
  if (!nome) return { erro: 'Dê um nome ao assembly.' };
  const tipo = id ? assembly(id).tipo : dados.tipo;
  if (!TIPOS[tipo]) return { erro: 'Escolha o tipo de condição.' };
  const linhas = [];
  for (const [i, l] of (dados.linhas || []).entries()) {
    if (!l.itemId && !String(l.formula || '').trim()) continue; // linha vazia
    if (!item(l.itemId)) return { erro: 'Linha ' + (i + 1) + ': escolha o item.' };
    const v = validar(l.formula, tipo);
    if (v.erro) return { erro: 'Linha ' + (i + 1) + ' (' + item(l.itemId).nome + '): ' + v.erro };
    const perda = Number(String(l.perda || 0).replace(',', '.'));
    if (!(perda >= 0 && perda <= 100)) return { erro: 'Linha ' + (i + 1) + ': a perda deve ficar entre 0 e 100%.' };
    linhas.push({ id: l.id || novoId('ln'), itemId: l.itemId, formula: String(l.formula).trim(), perda, passo: Number(l.passo) || 0 });
  }
  if (!linhas.length) return { erro: 'O assembly precisa de pelo menos uma linha.' };
  const dadosOk = { nome, tipo, descricao: (dados.descricao || '').trim(), linhas };
  if (id) { Object.assign(assembly(id), dadosOk); salvar(); return { ok: true, id }; }
  const novo = { id: novoId('as'), ...dadosOk };
  mz().assemblies.push(novo);
  salvar();
  return { ok: true, id: novo.id };
}

export function excluirAssembly(id) {
  for (const c of mz().condicoes) c.assemblies = (c.assemblies || []).filter((x) => x !== id);
  mz().assemblies = assemblies().filter((a) => a.id !== id);
  salvar();
}

export function aplicarAssembly(condicaoId, assemblyId) {
  const c = condicao(condicaoId);
  const a = assembly(assemblyId);
  if (!a || a.tipo !== c.tipo) return { erro: 'Esse assembly é para outro tipo de condição.' };
  c.assemblies = c.assemblies || [];
  if (!c.assemblies.includes(assemblyId)) c.assemblies.push(assemblyId);
  salvar();
  return { ok: true };
}
export function removerAssembly(condicaoId, assemblyId) {
  const c = condicao(condicaoId);
  c.assemblies = (c.assemblies || []).filter((x) => x !== assemblyId);
  salvar();
}

/* ---------- Quantidades: condição × assembly × linha ---------- */

/* Cada linha calculada guarda o caminho todo (RB-003): condição → variáveis → fórmula → bruta → perda → final. */
export function quantidadesDoProjeto(projetoId) {
  const linhas = [];
  for (const c of condicoesDo(projetoId)) {
    const vars = variaveisDaCondicao(c);
    const t = totaisDaCondicao(c);
    for (const aid of c.assemblies || []) {
      const a = assembly(aid);
      if (!a) continue;
      for (const l of a.linhas) {
        const r = t.medicoes ? calcularLinha(l, c.tipo, vars) : { erro: 'nada medido ainda' };
        linhas.push({ condicao: c, assembly: a, linha: l, item: item(l.itemId), vars, ...r });
      }
    }
  }
  // por item: soma das linhas (o arredondamento é por linha, como na compra de cada serviço)
  const porItem = new Map();
  for (const x of linhas) {
    if (x.erro || !x.item) continue;
    const g = porItem.get(x.item.id) || { item: x.item, total: 0, linhas: [] };
    g.total += x.final;
    g.linhas.push(x);
    porItem.set(x.item.id, g);
  }
  return { linhas, porItem: Array.from(porItem.values()) };
}

/* ---------- Envio de PDF ---------- */

export function criarFolhas(projetoId, arquivoId, nomeArquivo, paginas) {
  const novas = [];
  for (let i = 1; i <= paginas; i++) {
    const f = { id: novoId('fl'), projetoId, nome: nomeArquivo.replace(/\.pdf$/i, '') + (paginas > 1 ? ' · página ' + i : ''), arquivo: { tipo: 'idb', id: arquivoId, nome: nomeArquivo }, pagina: i, escala: null, criadaEm: Date.now() };
    mz().folhas.push(f);
    novas.push(f);
  }
  salvar();
  return novas;
}

/* ---------- Dados de exemplo ---------- */

/* Catálogo e assemblies de exemplo (wood framing residencial). Coberturas, produtividades e perdas são
 * EXEMPLOS para a demonstração, não referência de mercado: cada empresa cadastra os seus. */
const ITENS_EXEMPLO = [
  ['it-stud', 'FR-2x6-9', 'Montante 2x6 × 9\' (stud)', 'material', 'peça', '06 11 00 · Wood framing'],
  ['it-plate', 'FR-2x6-16', 'Guia 2x6 × 16\' (plate)', 'material', 'peça', '06 11 00 · Wood framing'],
  ['it-osb', 'SH-OSB-716', 'OSB 7/16" 4\'×8\'', 'material', 'chapa', '06 16 00 · Sheathing', 'cobre 32 sq ft'],
  ['it-wrap', 'WR-HOUSE', 'House wrap 9\'×150\'', 'material', 'rolo', '07 25 00 · Weather barriers', 'cobre 1.350 sq ft'],
  ['it-r21', 'IN-R21', 'Isolamento R-21 (2x6)', 'material', 'pacote', '07 21 00 · Thermal insulation', 'cobre 40 sq ft (exemplo)'],
  ['it-dw', 'DW-12-48', 'Drywall 1/2" 4\'×8\'', 'material', 'chapa', '09 29 00 · Gypsum board', 'cobre 32 sq ft'],
  ['it-lvp', 'FL-LVP', 'Piso vinílico LVP', 'material', 'caixa', '09 65 00 · Resilient flooring', 'cobre 20 sq ft (exemplo)'],
  ['it-manta', 'FL-UL', 'Manta para piso', 'material', 'rolo', '09 65 00 · Resilient flooring', 'cobre 100 sq ft'],
  ['it-conc', 'CN-3000', 'Concreto usinado 3.000 psi', 'material', 'cu yd', '03 30 00 · Cast-in-place concrete'],
  ['it-tela', 'CN-MESH', 'Tela soldada 5\'×150\'', 'material', 'rolo', '03 21 00 · Reinforcement', 'cobre 750 sq ft'],
  ['it-porta', 'DR-30-PH', 'Porta interna 30" pré-montada', 'material', 'each', '08 14 00 · Wood doors'],
  ['it-fechadura', 'DR-HW', 'Fechadura de passagem', 'material', 'each', '08 71 00 · Door hardware'],
  ['it-guarnicao', 'TR-CASE', 'Guarnição 7\'', 'material', 'peça', '06 22 00 · Millwork'],
  ['it-mo-estrutura', 'MO-FRAME', 'Carpinteiro de estrutura', 'mao-de-obra', 'hora', '06 11 00 · Wood framing'],
  ['it-mo-drywall', 'MO-DW', 'Drywall: fixar e acabar', 'mao-de-obra', 'hora', '09 29 00 · Gypsum board'],
  ['it-mo-piso', 'MO-FLOOR', 'Instalação de piso', 'mao-de-obra', 'hora', '09 65 00 · Resilient flooring'],
  ['it-mo-concreto', 'MO-CONC', 'Concretagem', 'mao-de-obra', 'hora', '03 30 00 · Cast-in-place concrete'],
  ['it-mo-porta', 'MO-DOOR', 'Instalação de porta', 'mao-de-obra', 'hora', '08 14 00 · Wood doors'],
  ['it-jan-w1', 'WN-5040', 'Janela vinil 5\'-0" × 4\'-0" (W1)', 'material', 'each', '08 53 00 · Plastic windows'],
  ['it-jan-w2', 'WN-4040', 'Janela vinil 4\'-0" × 4\'-0" (W2)', 'material', 'each', '08 53 00 · Plastic windows'],
  ['it-flash', 'WN-FLASH', 'Fita de flashing 4" × 75\'', 'material', 'rolo', '07 65 00 · Flexible flashing', 'cobre 75 lin ft'],
  ['it-trim-ext', 'TR-PVC-1X4', 'Guarnição externa PVC 1x4 × 12\'', 'material', 'peça', '06 22 00 · Millwork'],
  ['it-porta-ext', 'DR-36-EXT', 'Porta de entrada 36" × 80" pré-montada', 'material', 'each', '08 14 00 · Wood doors'],
  ['it-fech-ext', 'DR-HW-KEY', 'Fechadura com chave (entrada)', 'material', 'each', '08 71 00 · Door hardware'],
  ['it-siding', 'SD-VINYL', 'Siding vinil (square)', 'material', 'square', '07 46 33 · Plastic siding', '1 square = 100 sq ft'],
  ['it-jchannel', 'SD-JCH', 'J-channel 12\'6"', 'material', 'peça', '07 46 33 · Plastic siding', 'contorna janelas e portas'],
  ['it-mo-janela', 'MO-WIN', 'Instalação de janela', 'mao-de-obra', 'hora', '08 53 00 · Plastic windows'],
  ['it-mo-siding', 'MO-SID', 'Instalação de siding', 'mao-de-obra', 'hora', '07 46 33 · Plastic siding'],
];
/* Preços de exemplo (US$, na unidade de compra; mão de obra em US$/hora de custo). EXEMPLOS para a
 * demonstração, não referência de mercado: cada empresa registra os seus (cotação ou digitado). */
const PRECOS_EXEMPLO = {
  'it-stud': 9.8, 'it-plate': 14.5, 'it-osb': 16.9, 'it-wrap': 165, 'it-r21': 68, 'it-dw': 14.2, 'it-lvp': 62, 'it-manta': 45, 'it-conc': 185, 'it-tela': 95,
  'it-porta': 189, 'it-fechadura': 28, 'it-guarnicao': 11.5, 'it-jan-w1': 420, 'it-jan-w2': 360, 'it-flash': 32, 'it-trim-ext': 24, 'it-porta-ext': 780,
  'it-fech-ext': 95, 'it-siding': 135, 'it-jchannel': 9.8,
  'it-mo-estrutura': 38, 'it-mo-drywall': 38, 'it-mo-piso': 38, 'it-mo-concreto': 38, 'it-mo-porta': 38, 'it-mo-janela': 38, 'it-mo-siding': 38,
};
const ln = (id, itemId, formula, perda, passo) => ({ id, itemId, formula, perda, passo });
const linhasJanela = (unidade) => [
  ln('l1', unidade, 'MeasuredCount', 0, 1),
  ln('l2', 'it-flash', 'OpeningPerimeter / 75', 10, 1),
  ln('l3', 'it-trim-ext', 'OpeningPerimeter / 12', 15, 1),
  ln('l4', 'it-guarnicao', 'OpeningPerimeter / 7', 10, 1),
  ln('l5', 'it-mo-janela', 'MeasuredCount * 2.5', 0, 0),
];
const ASSEMBLIES_EXEMPLO = [
  { id: 'as-parede', nome: 'Parede externa 2x6 @ 16" (com altura)', tipo: 'linear', descricao: 'Estrutura, OSB, house wrap, isolamento e drywall do lado interno, descontando os vãos ligados. Precisa da altura na condição.', linhas: [
    ln('l1', 'it-stud', 'MeasuredLinear * 12 / 16', 15, 1),
    ln('l2', 'it-plate', 'MeasuredLinear * 3 / 16', 10, 1),
    ln('l3', 'it-osb', 'NetSurfaceArea / 32', 10, 1),
    ln('l4', 'it-wrap', 'NetSurfaceArea / 1350', 10, 1),
    ln('l5', 'it-r21', 'NetSurfaceArea / 40', 5, 1),
    ln('l6', 'it-dw', 'NetSurfaceArea / 32', 12, 1),
    ln('l7', 'it-mo-estrutura', 'MeasuredLinear * 0.35', 0, 0),
    ln('l8', 'it-mo-drywall', 'SurfaceArea * 0.02', 0, 0),
  ] },
  { id: 'as-lvp', nome: 'Piso LVP com manta', tipo: 'area', descricao: 'Piso vinílico flutuante sobre manta.', linhas: [
    ln('l1', 'it-lvp', 'MeasuredArea / 20', 8, 1),
    ln('l2', 'it-manta', 'MeasuredArea / 100', 5, 1),
    ln('l3', 'it-mo-piso', 'MeasuredArea * 0.03', 0, 0),
  ] },
  { id: 'as-laje', nome: 'Laje de concreto com tela (com espessura)', tipo: 'area', descricao: 'Concreto usinado pedido de meia em meia jarda. Precisa da espessura na condição.', linhas: [
    ln('l1', 'it-conc', 'VolumeCY', 5, 0.5),
    ln('l2', 'it-tela', 'MeasuredArea / 750', 10, 1),
    ln('l3', 'it-mo-concreto', 'MeasuredArea * 0.02', 0, 0),
  ] },
  { id: 'as-porta', nome: 'Porta interna 30" pré-montada', tipo: 'contagem', descricao: 'Porta, fechadura e guarnição dos dois lados.', linhas: [
    ln('l1', 'it-porta', 'MeasuredCount', 0, 1),
    ln('l2', 'it-fechadura', 'MeasuredCount', 0, 1),
    ln('l3', 'it-guarnicao', 'MeasuredCount * 2 * (2 * OpeningHeight + OpeningWidth) / 7', 10, 1),
    ln('l4', 'it-mo-porta', 'MeasuredCount * 1.5', 0, 0),
  ] },
  { id: 'as-jan-w1', nome: 'Janela W1 5\'×4\' instalada', tipo: 'contagem', descricao: 'Janela, flashing e guarnições pelo perímetro do vão: 2 × (largura + altura) × quantidade. Precisa de largura e altura na condição.', linhas: linhasJanela('it-jan-w1') },
  { id: 'as-jan-w2', nome: 'Janela W2 4\'×4\' instalada', tipo: 'contagem', descricao: 'Igual à W1, com a janela 4\'×4\'.', linhas: linhasJanela('it-jan-w2') },
  { id: 'as-porta-ext', nome: 'Porta de entrada instalada', tipo: 'contagem', descricao: 'Porta, fechadura e guarnição externa em 3 lados (2 × altura + largura).', linhas: [
    ln('l1', 'it-porta-ext', 'MeasuredCount', 0, 1),
    ln('l2', 'it-fech-ext', 'MeasuredCount', 0, 1),
    ln('l3', 'it-trim-ext', 'MeasuredCount * (2 * OpeningHeight + OpeningWidth) / 12', 15, 1),
    ln('l4', 'it-mo-porta', 'MeasuredCount * 3', 0, 0),
  ] },
  { id: 'as-siding', nome: 'Siding vinil com J-channel', tipo: 'area', descricao: 'Medido na fachada (inclusive a empena), descontando os vãos ligados. J-channel pelo perímetro dos vãos.', linhas: [
    ln('l1', 'it-siding', 'NetArea / 100', 10, 1),
    ln('l2', 'it-jchannel', 'OpeningPerimeter / 12.5', 10, 1),
    ln('l3', 'it-mo-siding', 'NetArea * 0.025', 0, 0),
  ] },
];

/* Projetos e plantas de exemplo (da prestadora: o Measure é de quem executa o serviço). Sem projetos, só o catálogo. */
export function criarDadosMeasure({ projetos: comProjetos = true, estimadores = ['u-tom', 'u-rita'], galpao = { contratanteId: 'ct-granite', donoId: 'ct-logsul', obraId: null } } = {}) {
  const projetoId = 'pj-casa';
  const dados = {
    projetos: [
      { id: projetoId, nome: 'Casa modelo', contratanteId: 'ct-thompson', donoId: null, endereco: '88 Bridge St', cidade: 'Manchester', estado: 'NH', zip: '03104', tipo: 'residencial-uni', situacao: 'orcamento',
        descricao: 'Residência térrea de 40\'-0" × 28\'-0", wood framing, siding vinil', obraId: null, estimadorId: estimadores[1], prazoProposta: somarDias(hoje(), 6), criadoEm: Date.now() },
      { id: 'pj-galpao', nome: 'Galpão Logístico · ampliação do mezanino', contratanteId: galpao.contratanteId, donoId: galpao.donoId, endereco: '45 Northeastern Blvd', cidade: 'Nashua', estado: 'NH', zip: '03062', tipo: 'industrial', situacao: 'enviada',
        descricao: 'Mezanino metálico de 2.400 sq ft com piso de concreto', obraId: galpao.obraId, estimadorId: estimadores[0], prazoProposta: somarDias(hoje(), -4), criadoEm: Date.now() },
      { id: 'pj-cozinha', nome: 'Reforma de cozinha · Mitchell', contratanteId: 'ct-mitchell', donoId: null, endereco: '22 Pleasant St', cidade: 'Concord', estado: 'NH', zip: '03301', tipo: 'reforma', situacao: 'ganha',
        descricao: 'Troca de armários, piso LVP e drywall', obraId: null, estimadorId: estimadores[1], prazoProposta: somarDias(hoje(), -21), criadoEm: Date.now() },
      // repetição: a mesma casa seis vezes (dois blocos de três) — a planta é medida uma vez e vale × 6
      { id: 'pj-townhouses', nome: 'Townhouses Elm Row · 6 unidades', contratanteId: 'ct-merrimack', donoId: 'ct-horizonte', endereco: '300 Elm Row', cidade: 'Manchester', estado: 'NH', zip: '03104', tipo: 'residencial-multi', situacao: 'orcamento',
        descricao: 'Seis casas iguais em dois blocos: framing e siding', obraId: null, estimadorId: estimadores[0], prazoProposta: somarDias(hoje(), 12), criadoEm: Date.now() },
    ],
    folhas: [
      ['fl-a101', 'A-101 · First Floor Plan', 1], ['fl-a201', 'A-201 · Elevations', 2], ['fl-a301', 'A-301 · Section A', 3],
    ].map(([id, nome, pagina]) => ({ id, projetoId, nome, arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina, escala: null }))
      .concat([['fl-th-a101', 'A-101 · Unit Plan (typical)', 1], ['fl-th-a201', 'A-201 · Elevations', 2]].map(([id, nome, pagina]) =>
        ({ id, projetoId: 'pj-townhouses', nome, arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina, escala: null }))),
    typicais: [{ id: 'ty-unidade', projetoId: 'pj-townhouses', folhaId: 'fl-th-a101', nome: 'Unidade tipo (a planta inteira)', regiao: null,
      ocorrencias: [{ rotulo: 'Bloco A', quantidade: 3 }, { rotulo: 'Bloco B', quantidade: 3 }], por: 'Configuração inicial', em: Date.now() }],
    condicoes: [], // o desenho abre vazio: cada assembly é incluído pelo visor
    itens: ITENS_EXEMPLO.map(([id, codigo, nome, categoria, unidade, etapa, nota]) => ({
      id, codigo, nome, categoria, unidade, etapa, nota: nota || '',
      precos: PRECOS_EXEMPLO[id] ? [{ valor: PRECOS_EXEMPLO[id], desde: somarDias(hoje(), -60), fonte: 'Tabela de exemplo', fornecedorId: null, por: 'Configuração inicial', em: Date.now() }] : [],
    })),
    margens: [{ overheadPct: 12, lucroPct: 10, modo: 'markup', impostoMaterialPct: 0, desde: somarDias(hoje(), -60), motivo: 'Configuração inicial (exemplo)', por: 'Configuração inicial', em: Date.now() }],
    assemblies: ASSEMBLIES_EXEMPLO,
  };
  if (!comProjetos) { dados.projetos = []; dados.folhas = []; dados.typicais = []; }
  return dados;
}
