/* KORbuild Measure — modelo do takeoff (docs/measure-revisao.md).
 *
 *  - Os pontos das medições ficam em coordenadas da página do PDF (points, 1/72" do papel), nunca em pixels.
 *  - Cada folha tem a sua escala (polegadas reais por point); a medida real é calculada, nunca digitada.
 *  - Condição (ex.: "Paredes externas") ≠ medições (os desenhos, em uma ou mais folhas).
 *  - Guardado: polegadas, polegadas², polegadas³. Na tela: ft-in, lin ft, sq ft, cu yd (js/imperial.js). */

import { novoId } from './util.js';
import { estado, salvar } from './armazem.js';
import { comprimento, areaPoligono, fatorInclinacao, distancia, POL_POR_PE, POL2_POR_PE2 } from './imperial.js';
import { calcularLinha, validar } from './formulas.js';

function mz() { return estado().measure; }
export function projetos() { return mz().projetos; }
export function projeto(id) { return mz().projetos.find((p) => p.id === id); }
export function folha(id) { return mz().folhas.find((f) => f.id === id); }
export function folhasDo(projetoId) { return mz().folhas.filter((f) => f.projetoId === projetoId); }
export function condicao(id) { return mz().condicoes.find((c) => c.id === id); }
export function condicoesDo(projetoId) { return mz().condicoes.filter((c) => c.projetoId === projetoId); }

export const TIPOS = {
  linear: { nome: 'Linear', unidade: 'lin ft', icone: 'measure' },
  area: { nome: 'Área', unidade: 'sq ft', icone: 'obras' },
  contagem: { nome: 'Contagem', unidade: 'each', icone: 'mais' },
};
// Cores das condições, na ordem (bem distintas entre si e da planta em preto e branco)
export const CORES = ['#2563EB', '#C2410C', '#0F766E', '#7C3AED', '#B45309', '#DB2777', '#0891B2', '#4D7C0F'];

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
  if (id) {
    const c = condicao(id);
    Object.assign(c, { nome: dados.nome.trim(), props: dados.props || {} });
    salvar();
    return { ok: true, id };
  }
  const usadas = condicoesDo(dados.projetoId).map((c) => c.cor);
  const c = {
    id: novoId('cd'), projetoId: dados.projetoId, nome: dados.nome.trim(), tipo: dados.tipo,
    cor: CORES.find((x) => !usadas.includes(x)) || CORES[usadas.length % CORES.length], props: dados.props || {}, medicoes: [],
  };
  mz().condicoes.push(c);
  salvar();
  return { ok: true, id: c.id };
}

export function excluirCondicao(id) {
  mz().condicoes = mz().condicoes.filter((c) => c.id !== id);
  salvar();
}

export function adicionarMedicao(condicaoId, folhaId, pontos, desconto) {
  const c = condicao(condicaoId);
  const m = { id: novoId('md'), folhaId, pontos: pontos.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]), desconto: !!desconto, em: Date.now() };
  c.medicoes.push(m);
  salvar();
  return m;
}

export function excluirMedicao(condicaoId, medicaoId) {
  const c = condicao(condicaoId);
  c.medicoes = c.medicoes.filter((m) => m.id !== medicaoId);
  salvar();
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
    if (v == null) semEscala++; else base += v;
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
export function verticeProximo(folhaId, ponto, raioPts) {
  let melhor = null, d0 = raioPts;
  for (const c of mz().condicoes) for (const m of c.medicoes) if (m.folhaId === folhaId) for (const p of m.pontos) {
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
    v.MeasuredArea = t.base / POL2_POR_PE2;
    if (p.profundidadePol) { v.Thickness = p.profundidadePol; v.VolumeCF = v.MeasuredArea * p.profundidadePol / POL_POR_PE; v.VolumeCY = v.VolumeCF / 27; }
    if (fator) v.PitchedArea = v.MeasuredArea * fator;
  } else v.MeasuredCount = t.base;
  return v;
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
];
const ln = (id, itemId, formula, perda, passo) => ({ id, itemId, formula, perda, passo });
const ASSEMBLIES_EXEMPLO = [
  { id: 'as-parede', nome: 'Parede externa 2x6 @ 16" (com altura)', tipo: 'linear', descricao: 'Estrutura, OSB, house wrap, isolamento e drywall do lado interno. Precisa da altura na condição.', linhas: [
    ln('l1', 'it-stud', 'MeasuredLinear * 12 / 16', 15, 1),
    ln('l2', 'it-plate', 'MeasuredLinear * 3 / 16', 10, 1),
    ln('l3', 'it-osb', 'SurfaceArea / 32', 10, 1),
    ln('l4', 'it-wrap', 'SurfaceArea / 1350', 10, 1),
    ln('l5', 'it-r21', 'SurfaceArea / 40', 5, 1),
    ln('l6', 'it-dw', 'SurfaceArea / 32', 12, 1),
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
    ln('l3', 'it-guarnicao', 'MeasuredCount * 5', 10, 1),
    ln('l4', 'it-mo-porta', 'MeasuredCount * 1.5', 0, 0),
  ] },
];

export function criarDadosMeasure() {
  const projetoId = 'pj-casa';
  return {
    projetos: [{ id: projetoId, nome: 'Casa modelo', endereco: '1450 Elm St, Manchester, NH', descricao: 'Residência térrea de 40\'-0" × 28\'-0", wood framing' }],
    folhas: [{ id: 'fl-a101', projetoId, nome: 'A-101 · First Floor Plan', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo-a101.pdf', nome: 'casa-modelo-a101.pdf' }, pagina: 1, escala: null }],
    condicoes: [
      { id: 'cd-paredes', projetoId, nome: 'Paredes externas', tipo: 'linear', cor: CORES[0], props: { alturaPol: 108 }, medicoes: [], assemblies: ['as-parede'] },
      { id: 'cd-piso', projetoId, nome: 'Piso (LVP)', tipo: 'area', cor: CORES[1], props: {}, medicoes: [], assemblies: ['as-lvp'] },
      { id: 'cd-portas', projetoId, nome: 'Portas internas', tipo: 'contagem', cor: CORES[2], props: {}, medicoes: [], assemblies: ['as-porta'] },
    ],
    itens: ITENS_EXEMPLO.map(([id, codigo, nome, categoria, unidade, etapa, nota]) => ({ id, codigo, nome, categoria, unidade, etapa, nota: nota || '' })),
    assemblies: ASSEMBLIES_EXEMPLO,
  };
}
