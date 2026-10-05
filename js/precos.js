/* KORbuild Measure — preços e margens (docs/measure.md §Preços).
 *
 *  - Cada item do catálogo tem PREÇOS COM VIGÊNCIA (na unidade de compra; mão de obra em US$/hora).
 *    O preço vem da resposta do fornecedor à cotação ou é digitado. Nunca se apaga: um preço novo
 *    vale a partir de uma data, e a proposta usa o que vale no dia em que é emitida.
 *  - Mão de obra: o custo da hora pode ser sugerido pelo Crew (média do valor hora dos funcionários
 *    ativos + encargos do Settings).
 *  - MARGENS COM VIGÊNCIA: overhead (% sobre o custo), lucro em markup (% sobre o custo com overhead)
 *    ou em margem (% do preço de venda) e imposto sobre material (sales tax; 0 em New Hampshire, mas
 *    nada amarrado ao estado). Nada fixo no código: tudo vem destes registros. */

import { estado, salvar } from './armazem.js';
import { hoje } from './util.js';
import { auditar, encargosEm } from './settings.js';
import { item } from './measure.js';

const mz = () => estado().measure;
const r2 = (v) => Math.round(v * 100) / 100;

/* ---------- Preço de um item ---------- */

export function historicoDePrecos(it) { return (it.precos || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : b.em - a.em)); }
/* O preço que vale numa data (o mais recente com "desde" até a data). */
export function precoEm(it, iso = hoje()) {
  return historicoDePrecos(it).find((p) => p.desde <= iso) || null;
}

export function registrarPreco(itemId, dados, por) {
  const it = item(itemId);
  if (!it) return { erro: 'Item não encontrado.' };
  const valor = Number(dados.valor);
  if (!(valor > 0)) return { erro: 'Informe um preço maior que zero.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.desde || '')) return { erro: 'Informe a data a partir da qual o preço vale.' };
  const antes = precoEm(it, dados.desde);
  it.precos = (it.precos || []).concat([{ valor: r2(valor), desde: dados.desde, fonte: (dados.fonte || 'Digitado').trim(), fornecedorId: dados.fornecedorId || null, por, em: Date.now() }]);
  auditar('Preços', 'Preço de "' + it.nome + '" a partir de ' + dados.desde.split('-').reverse().join('/') + ' (' + (dados.fonte || 'digitado') + ')',
    antes ? 'US$ ' + antes.valor + '/' + it.unidade : '', 'US$ ' + r2(valor) + '/' + it.unidade, '', por);
  salvar();
  return { ok: true };
}

/* Custo da hora sugerido pelo Crew: média do valor hora de hoje dos funcionários ativos (W-2), com os encargos. */
export function custoHoraDoCrew() {
  const ativos = (estado().funcionarios || []).filter((f) => f.situacao !== 'desligado' && f.classificacao !== '1099');
  if (!ativos.length) return null;
  const valorHoje = (f) => { const v = (f.valores || []).filter((x) => x.desde <= hoje()).sort((a, b) => (a.desde < b.desde ? 1 : -1))[0]; return v ? v.valor : 0; };
  const media = ativos.reduce((t, f) => t + valorHoje(f), 0) / ativos.length;
  const encargos = encargosEm(hoje());
  return { media: r2(media), encargos, custo: r2(media * (1 + encargos)), funcionarios: ativos.length };
}

/* ---------- Margens ---------- */

export const MODOS_LUCRO = { markup: 'Markup (% sobre o custo + overhead)', margem: 'Margem (% do preço de venda)' };

export function historicoDeMargens() { return (mz().margens || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : b.em - a.em)); }
export function margensEm(iso = hoje()) {
  return historicoDeMargens().find((m) => m.desde <= iso) || { overheadPct: 0, lucroPct: 0, modo: 'markup', impostoMaterialPct: 0, desde: iso, padrao: true };
}

export function novasMargens(dados, por) {
  const d = { overheadPct: Number(dados.overheadPct), lucroPct: Number(dados.lucroPct), impostoMaterialPct: Number(dados.impostoMaterialPct || 0), modo: dados.modo, desde: dados.desde, motivo: String(dados.motivo || '').trim() };
  if (![d.overheadPct, d.lucroPct, d.impostoMaterialPct].every((v) => Number.isFinite(v) && v >= 0 && v < 100)) return { erro: 'Percentuais entre 0 e 99,9.' };
  if (!MODOS_LUCRO[d.modo]) return { erro: 'Escolha markup ou margem.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.desde || '')) return { erro: 'Informe a data a partir da qual vale.' };
  if (!d.motivo) return { erro: 'O motivo é obrigatório: fica no histórico.' };
  const antes = margensEm(d.desde);
  mz().margens = (mz().margens || []).concat([{ ...d, por, em: Date.now() }]);
  auditar('Preços', 'Margens a partir de ' + d.desde.split('-').reverse().join('/'), textoMargens(antes), textoMargens(d), d.motivo, por);
  salvar();
  return { ok: true };
}

export function textoMargens(m) {
  const pct = (v) => String(r2(v)).replace('.', ',') + '%';
  return 'overhead ' + pct(m.overheadPct) + ' · lucro ' + pct(m.lucroPct) + ' (' + (m.modo === 'margem' ? 'margem' : 'markup') + ')' + (m.impostoMaterialPct ? ' · imposto sobre material ' + pct(m.impostoMaterialPct) : '');
}

/* Preço de venda a partir do custo: custo × (1 + overhead), depois o lucro em markup ou em margem. */
export function precoDeVenda(custo, m) {
  const comOverhead = custo * (1 + m.overheadPct / 100);
  const venda = m.modo === 'margem' ? comOverhead / (1 - m.lucroPct / 100) : comOverhead * (1 + m.lucroPct / 100);
  return { comOverhead: r2(comOverhead), overhead: r2(comOverhead - custo), lucro: r2(venda - comOverhead), venda: r2(venda) };
}

/* Custo de um conjunto de linhas de quantidade ({ item, total }), na data: material (com imposto), mão de obra e outros. */
export function custoDe(grupos, iso = hoje()) {
  const m = margensEm(iso);
  const r = { material: 0, imposto: 0, maoDeObra: 0, outros: 0, semPreco: [] };
  for (const g of grupos) {
    const p = precoEm(g.item, iso);
    if (!p) { r.semPreco.push(g.item); continue; }
    const v = g.total * p.valor;
    if (g.item.categoria === 'material') { r.material += v; r.imposto += v * m.impostoMaterialPct / 100; }
    else if (g.item.categoria === 'mao-de-obra') r.maoDeObra += v;
    else r.outros += v;
  }
  r.custo = r2(r.material + r.imposto + r.maoDeObra + r.outros);
  ['material', 'imposto', 'maoDeObra', 'outros'].forEach((k) => { r[k] = r2(r[k]); });
  return { ...r, ...precoDeVenda(r.custo, m), margens: m };
}
