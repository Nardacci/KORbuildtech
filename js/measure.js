/* KORbuild Measure — modelo do takeoff (docs/measure-revisao.md).
 *
 *  - Os pontos das medições ficam em coordenadas da página do PDF (points, 1/72" do papel), nunca em pixels.
 *  - Cada folha tem a sua escala (polegadas reais por point); a medida real é calculada, nunca digitada.
 *  - Condição (ex.: "Paredes externas") ≠ medições (os desenhos, em uma ou mais folhas).
 *  - Guardado: polegadas, polegadas², polegadas³. Na tela: ft-in, lin ft, sq ft, cu yd (js/imperial.js). */

import { novoId } from './util.js';
import { estado, salvar } from './armazem.js';
import { comprimento, areaPoligono, fatorInclinacao, distancia } from './imperial.js';

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

export function criarDadosMeasure() {
  const projetoId = 'pj-casa';
  return {
    projetos: [{ id: projetoId, nome: 'Casa modelo', endereco: '1450 Elm St, Manchester, NH', descricao: 'Residência térrea de 40\'-0" × 28\'-0", wood framing' }],
    folhas: [{ id: 'fl-a101', projetoId, nome: 'A-101 · First Floor Plan', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo-a101.pdf', nome: 'casa-modelo-a101.pdf' }, pagina: 1, escala: null }],
    condicoes: [
      { id: 'cd-paredes', projetoId, nome: 'Paredes externas', tipo: 'linear', cor: CORES[0], props: { alturaPol: 108 }, medicoes: [] },
      { id: 'cd-piso', projetoId, nome: 'Piso (LVP)', tipo: 'area', cor: CORES[1], props: {}, medicoes: [] },
      { id: 'cd-portas', projetoId, nome: 'Portas internas', tipo: 'contagem', cor: CORES[2], props: {}, medicoes: [] },
    ],
  };
}
