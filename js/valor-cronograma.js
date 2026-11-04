/* KORbuild Takeoff — valor físico-financeiro do cronograma (docs/gantt-financeiro.md, fatia 1).
 * Cada tarefa do cronograma recebe um valor: o custo do que o Takeoff calculou para a etapa dela
 *   material (+ imposto) + horas × custo da hora da função (+ equipamento e subempreiteiro),
 * visto em três bases: custo · custo + overhead · preço de venda (com as margens que valem na data).
 * A ligação é pela etapa (cost code): a tarefa gerada pelo Schedule guarda `etapa`; tarefa criada à mão usa o próprio nome.
 * Curva S: o valor de cada tarefa espalhado por igual nos dias dela, somado dia a dia (previsto), contra o valor feito (% feito × valor). */

import { esc, hoje, dataCurta, somarDias, diasEntre } from './util.js';
import { tr, tn } from './i18n.js';
import { dinheiro } from './crew.js';
import { quantidadesDoProjeto } from './measure.js';
import { estado } from './armazem.js';
import { custoDe } from './precos.js';
import { duracaoDe, fimDaTarefa, pctFeito, pctPrevisto } from './andamento.js';

export const BASES = ['custo', 'overhead', 'venda'];
export const NOME_BASE = () => ({ custo: tr('Custo'), overhead: tr('Custo + overhead'), venda: tr('Preço de venda') });
const CAMPO = { custo: 'custo', overhead: 'comOverhead', venda: 'venda' };
const chave = (s) => String(s || '').trim().toLowerCase();
const r2 = (v) => Math.round(v * 100) / 100;

export const etapaDaTarefa = (t) => t.etapa || t.nome;
export const valorNaBase = (info, base) => (info ? info[CAMPO[base] || 'venda'] : 0);

/* Base escolhida (só uma conveniência de cada pessoa): custo, overhead ou venda. */
export function baseEscolhida() { try { const b = localStorage.getItem('kbt.ganttBase'); return BASES.includes(b) ? b : 'venda'; } catch { return 'venda'; } }
export function guardarBase(b) { try { localStorage.setItem('kbt.ganttBase', b); } catch { /* sem armazenamento: segue com o padrão */ } }

/* O valor de cada tarefa do projeto na data. Devolve { porTarefa: Map(id → info), soltos, total }:
 *   info = { material, imposto, maoDeObra, outros, horas, custo, comOverhead, venda, semPreco[], temValor }
 *   soltos = o que o Takeoff calculou e nenhuma tarefa recebeu (etapa sem tarefa); total = tudo. */
export function valorDasTarefas(p, iso = hoje()) {
  const tarefas = ((p && p.cronograma) || {}).tarefas || [];
  const { porItem } = quantidadesDoProjeto(p.id);
  const donas = new Map();
  for (const t of tarefas) { const k = chave(etapaDaTarefa(t)); if (!donas.has(k)) donas.set(k, []); donas.get(k).push(t); }
  const grupos = new Map(tarefas.map((t) => [t.id, []]));
  const soltos = [];
  for (const g of porItem) {
    const ts = donas.get(chave(g.item.etapa));
    if (!ts) { soltos.push(g); continue; }
    for (const t of ts) grupos.get(t.id).push({ item: g.item, total: g.total / ts.length });   // etapa em mais de uma tarefa: divide por igual
  }
  const calcular = (gs) => ({ ...custoDe(gs, iso), horas: r2(gs.filter((g) => g.item.categoria === 'mao-de-obra').reduce((s, g) => s + g.total, 0)), temValor: gs.length > 0 });
  const porTarefa = new Map(tarefas.map((t) => [t.id, calcular(grupos.get(t.id))]));
  return { porTarefa, soltos: calcular(soltos), total: calcular(porItem.map((g) => ({ item: g.item, total: g.total }))) };
}

/* Horas apontadas nos diários (RDO) aprovados da obra do projeto: cada atividade que aponta uma tarefa e informa as horas.
 * Fica tudo derivado dos diários (nada é copiado para a tarefa): Map(tarefaId → { horas, diarios }). */
export function horasApontadas(p) {
  const r = new Map();
  if (!p || !p.obraId) return r;
  for (const d of (estado().rdos || [])) {
    if (d.obraId !== p.obraId || d.status !== 'aprovado') continue;
    const vistos = new Set();
    for (const a of d.atividades || []) {
      const h = Number(String(a.horas == null ? '' : a.horas).replace(',', '.'));
      if (!a.tarefaId || !(h > 0)) continue;
      const g = r.get(a.tarefaId) || { horas: 0, diarios: 0 };
      g.horas = r2(g.horas + h);
      if (!vistos.has(a.tarefaId)) { g.diarios++; vistos.add(a.tarefaId); }
      r.set(a.tarefaId, g);
    }
  }
  return r;
}

/* Conciliação das horas de uma tarefa: orçadas (Takeoff) × apontadas (diários aprovados).
 *   consumo = apontadas ÷ orçadas (%) · projecao = apontadas ÷ % feito (só com 10% ou mais feito) · custoHoras = apontadas × custo médio da hora da tarefa
 *   situacao: 'sem-horas' (nada orçado ou nada apontado) · 'ok' · 'acima' (consumiu mais do que avançou, com folga de 10 pontos) · 'estourou' (apontou mais que o orçado) */
export function conciliarHoras(t, info, ap) {
  const orcadas = info && info.temValor ? info.horas : 0, horas = ap ? ap.horas : 0, feito = pctFeito(t);
  const custoHora = orcadas > 0 ? info.maoDeObra / orcadas : 0;
  const r = { orcadas, apontadas: horas, diarios: ap ? ap.diarios : 0, consumo: orcadas > 0 ? Math.round(horas * 1000 / orcadas) / 10 : null,
    projecao: horas > 0 && feito >= 10 ? r2(horas * 100 / feito) : null, custoHoras: r2(horas * custoHora), situacao: 'sem-horas' };
  if (orcadas > 0 && horas > 0) r.situacao = horas > orcadas ? 'estourou' : r.consumo > feito + 10 ? 'acima' : 'ok';
  return r;
}

/* Curva S na base escolhida. pontos: [{ d, plan }] (acumulado previsto por dia). feitoHoje = Σ valor × % feito. */
export function curvaS(tarefas, valores, base, hojeIso = hoje()) {
  const ts = tarefas.filter((t) => t.inicio);
  const itens = ts.map((t) => ({ t, v: valorNaBase(valores.porTarefa.get(t.id), base) }));
  const total = r2(itens.reduce((s, x) => s + x.v, 0));
  if (!ts.length) return { total, pontos: [], previstoHoje: 0, feitoHoje: 0, inicio: '', fim: '' };
  const inicio = ts.map((t) => t.inicio).sort()[0], fim = ts.map(fimDaTarefa).sort().pop();
  const n = Math.min(diasEntre(inicio, fim) + 1, 1200);
  const dia = new Array(n).fill(0);
  for (const { t, v } of itens) {
    const d0 = diasEntre(inicio, t.inicio), dur = duracaoDe(t);
    for (let i = 0; i < dur; i++) if (d0 + i >= 0 && d0 + i < n) dia[d0 + i] += v / dur;
  }
  let acc = 0;
  const pontos = dia.map((x, i) => { acc += x; return { d: somarDias(inicio, i), plan: r2(acc) }; });
  return {
    total, pontos, inicio, fim,
    previstoHoje: r2(itens.reduce((s, x) => s + x.v * pctPrevisto(x.t, hojeIso) / 100, 0)),
    feitoHoje: r2(itens.reduce((s, x) => s + x.v * pctFeito(x.t) / 100, 0)),
  };
}

/* O gráfico da curva S (SVG): linha do previsto, ponto do feito hoje e linha de hoje. */
function svgCurva(c, hojeIso) {
  if (!c.pontos.length || !(c.total > 0)) return '';
  const L = 760, A = 220, mx = 56, mb = 26, mt = 12, w = L - mx - 12, h = A - mb - mt;
  const n = c.pontos.length;
  const x = (i) => (mx + (n <= 1 ? 0 : i * w / (n - 1))).toFixed(1);
  const y = (v) => (mt + h - (v / c.total) * h).toFixed(1);
  const linha = c.pontos.map((q, i) => x(i) + ',' + y(q.plan)).join(' ');
  const iHoje = hojeIso < c.inicio ? -1 : hojeIso > c.fim ? n : diasEntre(c.inicio, hojeIso);
  const grade = [0, 0.25, 0.5, 0.75, 1].map((f) => '<line x1="' + mx + '" x2="' + (L - 12) + '" y1="' + y(c.total * f) + '" y2="' + y(c.total * f) + '" class="cs-grade"/><text x="' + (mx - 6) + '" y="' + (Number(y(c.total * f)) + 4) + '" text-anchor="end" class="cs-eixo">' + esc(dinheiro(Math.round(c.total * f)).replace(/[.,]00$/, '')) + '</text>').join('');
  const hojeSvg = iHoje >= 0 && iHoje < n ? '<line x1="' + x(iHoje) + '" x2="' + x(iHoje) + '" y1="' + mt + '" y2="' + (mt + h) + '" class="cs-hoje"/><circle cx="' + x(iHoje) + '" cy="' + y(c.feitoHoje) + '" r="5" class="cs-feito"><title>' + esc(tr('Feito até hoje: {v}', { v: dinheiro(c.feitoHoje) })) + '</title></circle>' : '';
  return '<svg class="curva-s" viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="' + esc(tr('Curva S: valor acumulado previsto e feito')) + '">' + grade +
    '<polyline points="' + linha + '" class="cs-plan"/>' + hojeSvg +
    '<text x="' + mx + '" y="' + (A - 6) + '" class="cs-eixo">' + esc(dataCurta(c.inicio)) + '</text><text x="' + (L - 12) + '" y="' + (A - 6) + '" text-anchor="end" class="cs-eixo">' + esc(dataCurta(c.fim)) + '</text></svg>';
}

/* O bloco da página do Gantt: seletor da base, resumo, curva S e a tabela de valor por tarefa. */
export function htmlValorDoGantt(p, base = baseEscolhida()) {
  const tarefas = ((p.cronograma || {}).tarefas || []).filter((t) => t.inicio);
  if (!tarefas.length) return '';
  const hojeIso = hoje();
  const v = valorDasTarefas(p, hojeIso), c = curvaS(tarefas, v, base, hojeIso);
  const sel = '<label class="gantt-escolha"><span class="rotulo-pequeno">' + tr('Valores em') + '</span><select id="gantt-base-valor" aria-label="' + esc(tr('Base dos valores')) + '">' +
    BASES.map((b) => '<option value="' + b + '"' + (b === base ? ' selected' : '') + '>' + esc(NOME_BASE()[b]) + '</option>').join('') + '</select></label>';
  if (!(v.total.custo > 0)) {
    return '<section class="cartao valor-gantt"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Valor por tarefa e curva S') + '</h2></div></div>' +
      '<p class="vazio">' + tr('Nenhum valor ainda: meça no Takeoff e aplique assemblies com itens de cada etapa. A tarefa pega o valor da etapa dela (use "Gerar a partir das etapas" no Schedule).') + '</p></section>';
  }
  const pctTot = (x) => (c.total > 0 ? Math.round(x * 1000 / c.total) / 10 : 0);
  const linhas = tarefas.map((t) => {
    const i = v.porTarefa.get(t.id), val = valorNaBase(i, base);
    return '<tr><td>' + esc(t.nome) + '</td><td class="num">' + (i && i.temValor ? (i.horas ? i.horas.toLocaleString(document.documentElement.lang || 'en') + ' h' : '—') : '—') + '</td>' +
      '<td class="num">' + (i && i.temValor ? dinheiro(i.material + i.imposto) : '—') + '</td><td class="num">' + (i && i.temValor ? dinheiro(i.maoDeObra) : '—') + '</td>' +
      '<td class="num"><b>' + (i && i.temValor ? dinheiro(val) : '—') + '</b></td><td class="num">' + (i && i.temValor ? pctTot(val) + '%' : '—') + '</td>' +
      '<td class="num">' + (i && i.temValor ? dinheiro(val * pctFeito(t) / 100) : '—') + '</td></tr>';
  }).join('');
  const solto = valorNaBase(v.soltos, base);
  const semPreco = [...new Set([...v.porTarefa.values()].flatMap((i) => i.semPreco.map((x) => x.nome)).concat(v.soltos.semPreco.map((x) => x.nome)))];
  const desvio = c.feitoHoje - c.previstoHoje;
  return '<section class="cartao valor-gantt"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Valor por tarefa e curva S') + '</h2>' +
    '<p class="mudo pequeno">' + tr('Valor da tarefa = material + horas × custo da hora da função, vindos do Takeoff. O previsto espalha o valor pelos dias da tarefa; o feito usa o % feito.') + '</p></div>' + sel + '</div>' +
    '<div class="valor-resumo"><div><span>' + tr('Valor total') + '</span><b id="vg-total">' + dinheiro(c.total) + '</b></div>' +
    '<div><span>' + tr('Previsto até hoje') + '</span><b id="vg-previsto">' + dinheiro(c.previstoHoje) + '</b></div>' +
    '<div><span>' + tr('Feito até hoje') + '</span><b id="vg-feito">' + dinheiro(c.feitoHoje) + '</b></div>' +
    '<div><span>' + tr('Feito − previsto') + '</span><b id="vg-desvio" class="' + (desvio < -0.5 ? 'neg' : '') + '">' + (desvio >= 0 ? '+' : '−') + dinheiro(Math.abs(desvio)) + '</b></div></div>' +
    svgCurva(c, hojeIso) +
    '<div class="tabela-rolagem"><table class="tabela tabela-valor-gantt"><thead><tr><th>' + tr('Tarefa') + '</th><th class="num">' + tr('Horas') + '</th><th class="num">' + tr('Material') + '</th><th class="num">' + tr('Mão de obra') + '</th><th class="num">' + NOME_BASE()[base] + '</th><th class="num">' + tr('% do total') + '</th><th class="num">' + tr('Feito') + '</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    (solto > 0 ? '<p class="mudo pequeno" id="vg-soltos">' + tr('Fora do cronograma: {v} de etapas medidas que nenhuma tarefa recebeu. Gere as tarefas a partir das etapas para incluí-las.', { v: dinheiro(solto) }) + '</p>' : '') +
    (semPreco.length ? '<p class="mudo pequeno" id="vg-sem-preco">' + tn(semPreco.length, 'Item sem preço (fica fora dos valores): {itens}.', 'Itens sem preço (ficam fora dos valores): {itens}.', { itens: semPreco.join(', ') }) + '</p>' : '') + '</section>';
}

/* Horas orçadas × apontadas nos diários, por tarefa (fatia 2). Só aparece quando o projeto tem horas orçadas ou apontadas. */
export function htmlHorasDoGantt(p) {
  const tarefas = ((p.cronograma || {}).tarefas || []).filter((t) => t.inicio);
  if (!tarefas.length) return '';
  const v = valorDasTarefas(p, hoje()), ap = horasApontadas(p);
  const linhas = tarefas.map((t) => ({ t, c: conciliarHoras(t, v.porTarefa.get(t.id), ap.get(t.id)) }));
  if (!linhas.some((x) => x.c.orcadas > 0 || x.c.apontadas > 0)) return '';
  const h = (n) => (n == null ? '—' : n.toLocaleString(document.documentElement.lang || 'en') + ' h');
  const ROT = { 'sem-horas': ['', ''], ok: [tr('Dentro do orçado'), 'etiqueta-verde'], acima: [tr('Horas acima do avanço'), 'etiqueta-ambar'], estourou: [tr('Passou do orçado'), 'etiqueta-alerta'] };
  const corpo = linhas.map(({ t, c }) => '<tr data-tarefa="' + esc(t.id) + '"><td>' + esc(t.nome) + '</td><td class="num">' + (c.orcadas > 0 ? h(c.orcadas) : '—') + '</td>' +
    '<td class="num">' + (c.apontadas > 0 ? '<b>' + h(c.apontadas) + '</b><span class="mudo pequeno bloco">' + tn(c.diarios, '{n} diário', '{n} diários') + '</span>' : '—') + '</td>' +
    '<td class="num">' + (c.consumo == null || !c.apontadas ? '—' : c.consumo + '%') + ' <span class="mudo pequeno">/ ' + pctFeito(t) + '% ' + tr('feito') + '</span></td>' +
    '<td class="num">' + h(c.projecao) + '</td><td class="num">' + (c.apontadas > 0 && c.custoHoras > 0 ? dinheiro(c.custoHoras) : '—') + '</td>' +
    '<td>' + (ROT[c.situacao][0] ? '<span class="etiqueta ' + ROT[c.situacao][1] + '">' + ROT[c.situacao][0] + '</span>' : '') + '</td></tr>').join('');
  const orc = linhas.reduce((s, x) => s + x.c.orcadas, 0), apo = linhas.reduce((s, x) => s + x.c.apontadas, 0), custo = linhas.reduce((s, x) => s + x.c.custoHoras, 0);
  const orcDasComHoras = linhas.filter((x) => x.c.apontadas > 0).reduce((s, x) => s + x.c.orcadas, 0);
  return '<section class="cartao valor-gantt" id="horas-gantt"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Horas: orçado e apontado') + '</h2>' +
    '<p class="mudo pequeno">' + tr('Orçadas = horas de mão de obra medidas no Takeoff. Apontadas = horas informadas nas atividades dos diários (RDO) aprovados. A projeção divide as horas apontadas pelo % feito (a partir de 10%).') + '</p></div></div>' +
    '<div class="valor-resumo"><div><span>' + tr('Horas orçadas') + '</span><b id="hg-orcadas">' + h(orc) + '</b></div><div><span>' + tr('Horas apontadas') + '</span><b id="hg-apontadas">' + h(apo) + '</b></div>' +
    '<div><span>' + tr('Orçadas das tarefas com apontamento') + '</span><b id="hg-orc-ap">' + h(orcDasComHoras) + '</b></div><div><span>' + tr('Custo das horas apontadas') + '</span><b id="hg-custo">' + dinheiro(custo) + '</b></div></div>' +
    '<div class="tabela-rolagem"><table class="tabela tabela-horas-gantt"><thead><tr><th>' + tr('Tarefa') + '</th><th class="num">' + tr('Orçadas') + '</th><th class="num">' + tr('Apontadas') + '</th><th class="num">' + tr('Consumo / avanço') + '</th><th class="num">' + tr('Projeção') + '</th><th class="num">' + tr('Custo das horas') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>' + corpo + '</tbody></table></div>' +
    (apo === 0 ? '<p class="mudo pequeno" id="hg-vazio">' + tr('Nenhuma hora apontada ainda: no diário, em cada atividade ligada a uma tarefa, informe as horas gastas.') + '</p>' : '') + '</section>';
}
