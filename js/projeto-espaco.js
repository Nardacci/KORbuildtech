/* KORbuild Takeoff — o projeto como espaço de trabalho: abas, Overview (com o checklist), Scope & delivery (quem faz cada etapa)
 * e Schedule (cronograma preliminar com marcos). Os dados novos ficam no próprio projeto:
 *   p.entrega    = { padrao: 'tudo' | 'misto' | 'terceirizar', etapas: [{ id, etapa, quem: 'proprio' | 'terceiro' | 'decidir', takeoff: 'detalhado' | 'nenhum' | 'quantidades' }] }
 *   p.cronograma = { tarefas: [{ id, nome, quem, inicio, dias, pct }], marcos: [{ id, nome, data, nota }] }   (pct = % feito, informado pela equipe)
 * No app com conta, estes dois campos só vão para o banco depois da migração 0016 (supabase/migrations): ver PERSISTE_ESPACO em measure-oficial.js. */

import { esc, toast, hoje, diasEntre, somarDias, dataCurta, novoId } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar } from './armazem.js';
import { projeto, projetos, folhasDo, condicoesDo, assembly, item, itens } from './measure.js';
import { dinheiro } from './crew.js';
import { icone } from './icones.js';
import { andamentoDoCronograma, pctFeito, pctPrevisto, tarefaAtrasada, ORDEM_SITUACAO } from './andamento.js';

let app = { desenhar() {}, ir() {} };
export function ligarEspaco(funcoes) { app = { ...app, ...funcoes }; }

export const ABAS = ['overview', 'plans', 'takeoff', 'materials', 'schedule', 'summary'];
/* Endereços antigos (Scope & delivery e Bids) agora são parte do Takeoff. */
export const ABA_ANTIGA = { scope: 'takeoff', bids: 'takeoff' };
const fimDe = (t) => (t.inicio ? somarDias(t.inicio, Math.max(0, (Number(t.dias) || 1) - 1)) : '');
const href = (p, aba) => '#/measure/projeto/' + p.id + (aba === 'overview' ? '' : '/' + aba);

/* ---------- Dados ---------- */

/* As etapas (cost codes) que aparecem nos assemblies das condições do projeto. */
function etapasDasCondicoes(p) {
  const vistas = new Set();
  for (const c of condicoesDo(p.id)) for (const aid of c.assemblies || []) {
    const a = assembly(aid);
    for (const l of (a && a.linhas) || []) { const it = item(l.itemId); if (it && it.etapa) vistas.add(it.etapa); }
  }
  return [...vistas].sort();
}

const cronogramaDe = (p) => { if (!p.cronograma) { p.cronograma = { tarefas: [], marcos: [] }; salvar(); } return p.cronograma; };

/* Os seis passos do projeto: o que já está feito e o que vem a seguir. */
export function passosDoProjeto(p) {
  const fs = folhasDo(p.id), cs = condicoesDo(p.id), c = p.cronograma;
  return [
    { id: 'plans', feito: fs.length > 0, aba: 'plans' },
    { id: 'scale', feito: fs.length > 0 && fs.every((f) => f.escala), aba: 'takeoff' },
    { id: 'delivery', feito: !!c && c.tarefas.length > 0 && c.tarefas.every((x) => x.quem !== 'decidir'), aba: 'schedule' },
    { id: 'measure', feito: cs.some((x) => (x.medicoes || []).length > 0), aba: 'takeoff' },
    { id: 'schedule', feito: !!c && c.tarefas.length > 0, aba: 'schedule' },
    { id: 'proposal', feito: (p.propostas || []).length > 0, aba: 'proposta' },
  ];
}
export function andamentoDoProjeto(p) {
  const passos = passosDoProjeto(p);
  return { passos, feitos: passos.filter((x) => x.feito).length, total: passos.length, folhas: folhasDo(p.id).length, condicoes: condicoesDo(p.id).length };
}

/* ---------- As abas ---------- */

export function htmlAbas(p, ativa) {
  const itensAba = [
    ['overview', tr('Visão geral')], ['plans', tr('Plantas'), folhasDo(p.id).length || ''], ['takeoff', tr('Takeoff')],
    ['materials', tr('Materiais')], ['schedule', tr('Cronograma')], ['summary', tr('Resumo do projeto')],
  ];
  return '<nav class="abas-sublinhadas" aria-label="' + esc(tr('Seções do projeto')) + '">' + itensAba.map(([k, r, n]) =>
    '<a href="' + href(p, k) + '"' + (k === ativa ? ' class="ativa" aria-current="page"' : '') + '>' + esc(r) + (n ? ' <span class="mz-contagem">' + n + '</span>' : '') + '</a>').join('') + '</nav>';
}

/* ---------- Overview ---------- */

const NOMES_PASSO = () => ({
  plans: [tr('Enviar as plantas'), (p) => tn(folhasDo(p.id).length, '{n} folha', '{n} folhas')],
  scale: [tr('Definir a escala de cada folha'), (p) => { const n = folhasDo(p.id).filter((f) => !f.escala).length; return n ? tn(n, '{n} folha sem escala', '{n} folhas sem escala') : tr('Todas as folhas têm escala'); }],
  delivery: [tr('Decidir quem faz cada tarefa'), (p) => { const t = (p.cronograma || {}).tarefas || []; if (!t.length) return tr('Nenhuma tarefa ainda'); const n = (q) => t.filter((x) => x.quem === q).length; return tr('{a} próprias · {b} subcontratadas · {c} a decidir', { a: n('proprio'), b: n('terceiro'), c: n('decidir') }); }],
  measure: [tr('Medir as partes que são suas'), (p) => tn(condicoesDo(p.id).filter((c) => (c.medicoes || []).length).length, '{n} condição medida', '{n} condições medidas')],
  schedule: [tr('Montar o cronograma'), () => tr('Datas e marcos (opcional, pode ficar para depois)')],
  proposal: [tr('Emitir a proposta'), (p) => ((p.propostas || []).length ? p.propostas[p.propostas.length - 1].numero : tr('Precisa de preço para cada parte'))],
});
const ROTULO_ACAO = () => ({ plans: tr('Ver plantas'), scale: tr('Definir escalas'), delivery: tr('Revisar'), measure: tr('Abrir quantidades'), schedule: tr('Abrir cronograma'), proposal: tr('Abrir proposta') });

export function htmlOverview(p, ajudas) {
  const a = andamentoDoProjeto(p);
  const nomes = NOMES_PASSO(), acoes = ROTULO_ACAO();
  const atual = a.passos.findIndex((x) => !x.feito);
  const ultima = (p.propostas || [])[(p.propostas || []).length - 1];
  const kpis = '<div class="co-kpis co-kpis-4">' +
    '<div class="co-kpi"><span>' + tr('Prazo da proposta') + '</span><b>' + (p.prazoProposta ? dataCurta(p.prazoProposta) : '—') + '</b>' + (p.prazoProposta && p.situacao === 'orcamento' ? '<small>' + ajudas.textoDias(p.prazoProposta) + '</small>' : '') + '</div>' +
    '<div class="co-kpi"><span>' + tr('Andamento') + '</span><b>' + tr('{n} de {total} passos', { n: a.feitos, total: a.total }) + '</b><small>' + (atual >= 0 ? tr('Próximo: {passo}', { passo: nomes[a.passos[atual].id][0].toLowerCase() }) : tr('Tudo pronto')) + '</small></div>' +
    '<div class="co-kpi"><span>' + tr('Plantas e medições') + '</span><b>' + tn(a.folhas, '{n} folha', '{n} folhas') + '</b><small>' + tn(a.condicoes, '{n} condição', '{n} condições') + '</small></div>' +
    '<div class="co-kpi"><span>' + tr('Proposta') + '</span><b>' + (ultima ? dinheiro(ultima.total) : '—') + '</b><small>' + (ultima ? ultima.numero : tr('Ainda não emitida')) + '</small></div></div>';
  const lista = '<section class="cartao"><h2 class="cartao-titulo">' + tr('Montar este projeto') + '</h2><p class="mudo pequeno">' + tr('Faça em qualquer ordem. O projeto está pronto para enviar quando tudo estiver feito.') + '</p><ul class="mz-checklist">' +
    a.passos.map((x, i) => {
      const [titulo, detalhe] = nomes[x.id];
      const alvo = x.aba === 'proposta' ? '#/measure/projeto/' + p.id + '/proposta' : href(p, x.aba);
      return '<li><span class="mz-passo ' + (x.feito ? 'feito' : i === atual ? 'atual' : '') + '">' + (x.feito ? '✓' : i + 1) + '</span><span class="mz-passo-texto"><b>' + esc(titulo) + '</b><small>' + esc(detalhe(p)) + '</small></span>' +
        '<a class="btn btn-pequeno ' + (i === atual ? 'btn-primario' : 'btn-contorno') + '" href="' + alvo + '">' + esc(acoes[x.id]) + '</a></li>';
    }).join('') + '</ul></section>';
  return kpis + '<div class="mz-duas-colunas">' + lista + '<div>' + ajudas.detalhes + htmlMarcos(p) + '</div></div>';
}

function htmlMarcos(p) {
  const c = p.cronograma || { tarefas: [], marcos: [] };
  const linhas = [];
  if (p.prazoProposta) linhas.push([p.prazoProposta, tr('Prazo da proposta')]);
  const inicios = c.tarefas.map((t) => t.inicio).filter(Boolean).sort(), fins = c.tarefas.map(fimDe).filter(Boolean).sort();
  if (inicios.length) linhas.push([inicios[0], tr('Início previsto')]);
  if (fins.length) linhas.push([fins[fins.length - 1], tr('Término previsto')]);
  for (const m of c.marcos) if (m.data) linhas.push([m.data, m.nome]);
  linhas.sort((a, b) => a[0].localeCompare(b[0]));
  return '<section class="cartao"><h2 class="cartao-titulo">' + tr('Próximos marcos') + '</h2>' + (linhas.length
    ? '<dl class="mz-marcos">' + linhas.map(([d, n]) => '<dt>' + dataCurta(d) + '</dt><dd>' + esc(n) + '</dd>').join('') + '</dl>'
    : '<p class="mudo pequeno">' + tr('Os marcos aparecem aqui quando você monta o cronograma.') + '</p>') + '</section>';
}

const QUEM = () => [['proprio', tr('Nós')], ['terceiro', tr('Prestadora')], ['decidir', tr('A decidir')]];

/* ---------- Schedule ---------- */

export function htmlCronograma(p, ajudas) {
  const c = cronogramaDe(p);
  const tarefas = c.tarefas;
  const quemTxt = (t) => (t.quem === 'terceiro' ? tr('Prestadora') : t.quem === 'proprio' ? tr('Nós') : tr('A decidir'));
  const linhas = tarefas.map((t) => '<tr><td><input type="text" class="mz-t-nome" data-pj-tarefa="nome" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.nome) + '" aria-label="' + esc(tr('Tarefa')) + '"></td>' +
    '<td><select class="mz-quem ' + t.quem + '" data-pj-tarefa="quem" data-id="' + p.id + '" data-t="' + t.id + '" aria-label="' + esc(tr('Quem faz')) + '">' + QUEM().map(([k, n]) => '<option value="' + k + '"' + (k === t.quem ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></td>' +
    '<td><input type="date" data-pj-tarefa="inicio" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.inicio || '') + '" aria-label="' + esc(tr('Início')) + '"></td>' +
    '<td><input type="number" min="1" class="mz-t-dias" data-pj-tarefa="dias" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.dias || '') + '" aria-label="' + esc(tr('Duração em dias')) + '"></td>' +
    '<td>' + (fimDe(t) ? dataCurta(fimDe(t)) : '—') + '</td>' +
    '<td><span class="mz-t-pct' + (tarefaAtrasada(t, hoje()) ? ' atrasada' : '') + '"><input type="number" min="0" max="100" step="5" data-pj-tarefa="pct" data-id="' + p.id + '" data-t="' + t.id + '" value="' + pctFeito(t) + '" aria-label="' + esc(tr('% feito')) + '"><span>%</span></span></td>' +
    '<td class="num"><button type="button" class="link-botao pequeno" data-acao="pj-tirar-tarefa" data-id="' + p.id + '" data-t="' + t.id + '">' + tr('Remover') + '</button></td></tr>').join('');
  const marcos = c.marcos.map((m) => '<tr><td><input type="text" data-pj-marco="nome" data-id="' + p.id + '" data-m="' + m.id + '" value="' + esc(m.nome) + '" aria-label="' + esc(tr('Marco')) + '"></td>' +
    '<td><input type="date" data-pj-marco="data" data-id="' + p.id + '" data-m="' + m.id + '" value="' + esc(m.data || '') + '" aria-label="' + esc(tr('Data')) + '"></td>' +
    '<td><input type="text" data-pj-marco="nota" data-id="' + p.id + '" data-m="' + m.id + '" value="' + esc(m.nota || '') + '" aria-label="' + esc(tr('Observação')) + '"></td>' +
    '<td class="num"><button type="button" class="link-botao pequeno" data-acao="pj-tirar-marco" data-id="' + p.id + '" data-m="' + m.id + '">' + tr('Remover') + '</button></td></tr>').join('');
  const ganha = p.situacao === 'ganha';
  const faixaGanho = !ganha ? '' : '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + (c.confirmado ? tr('Cronograma confirmado') : tr('Confirme o cronograma')) + '</h2><p class="mudo pequeno">' +
    (c.confirmado ? tn(c.confirmado.tarefas.length, 'Base da obra desde {data}: {n} tarefa.', 'Base da obra desde {data}: {n} tarefas.', { data: dataCurta(c.confirmado.em) }) + ' ' + tr('Se mudar algo, confirme de novo para atualizar a base.')
      : tr('O projeto foi ganho. Ajuste as datas abaixo e confirme: o cronograma vira a base da obra.')) + '</p></div>' +
    '<button type="button" class="btn btn-primario btn-pequeno" data-acao="pj-confirmar-cronograma" data-id="' + p.id + '"' + (tarefas.length ? '' : ' disabled') + '>' + (c.confirmado ? tr('Atualizar a base') : tr('Confirmar cronograma')) + '</button></div></section>';
  return faixaGanho + htmlLinhaDoTempo(p) + '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Cronograma preliminar') + '</h2><p class="mudo pequeno">' + tr('Faz parte da proposta. Quando você ganha, confirma ou ajusta, e ele vira a base da obra.') + '</p></div>' +
    '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-gerar-cronograma" data-id="' + p.id + '"' + (etapasDasCondicoes(p).length ? '' : ' disabled') + '>' + tr('Gerar a partir das etapas') + '</button>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-add-tarefa" data-id="' + p.id + '">' + icone('mais', 16) + tr('Adicionar tarefa') + '</button></div></div>' +
    (tarefas.length ? '<div class="tabela-rolagem"><table class="tabela tabela-cronograma"><thead><tr><th>' + tr('Tarefa') + '</th><th>' + tr('Quem') + '</th><th>' + tr('Data de início') + '</th><th>' + tr('Dias') + '</th><th>' + tr('Término') + '</th><th>' + tr('% feito') + '</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<p class="vazio">' + tr('Nenhuma tarefa ainda. Gere a partir das medições, ou adicione à mão.') + '</p>') + '</section>' +
    '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Marcos') + '</h2><p class="mudo pequeno">' + tr('Datas-chave que vão na proposta e na obra (ex.: licença aprovada).') + '</p></div>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-add-marco" data-id="' + p.id + '">' + icone('mais', 16) + tr('Adicionar marco') + '</button></div>' +
    (c.marcos.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Marco') + '</th><th>' + tr('Data') + '</th><th>' + tr('Observação') + '</th><th></th></tr></thead><tbody>' + marcos + '</tbody></table></div>' : '<p class="vazio">' + tr('Nenhum marco ainda.') + '</p>') + '</section>' +
    (ajudas.aviso ? '<p class="mudo pequeno">' + ajudas.aviso + '</p>' : '');
}

/* Linha do tempo: uma linha por tarefa e por marco, eixo de meses e dias, linha de hoje e detalhe ao passar o mouse. */
function htmlLinhaDoTempo(p) {
  const g = htmlGantt(p);
  if (!g) return '';
  return '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Linha do tempo') + '</h2><p class="mudo pequeno">' + tr('Uma linha por tarefa. A linha vertical marca hoje. Passe o mouse sobre uma barra para ver o detalhe.') + '</p></div>' +
    '<div class="btn-linha">' + legendaGantt() + '<a class="btn btn-contorno btn-pequeno" href="#/measure/gantt/' + p.id + '">' + icone('expandir', 16) + tr('Tela inteira') + '</a></div></div>' + g + '</section>';
}
const legendaGantt = () => '<div class="mz-g-legenda"><span><i class="mz-g-barra proprio"></i>' + tr('Nós') + '</span><span><i class="mz-g-barra sub"></i>' + tr('Prestadora') + '</span><span><i class="mz-g-barra decidir"></i>' + tr('A decidir') + '</span><span><i class="mz-g-barra proprio"><i class="mz-g-feito" style="width:50%"></i></i>' + tr('% feito') + '</span><span><i class="mz-g-barra atrasada"></i>' + tr('Atrasada') + '</span><span><i class="mz-g-losango"></i>' + tr('Marco') + '</span></div>';

/* O gráfico de Gantt em si: uma linha por tarefa (com o % feito preenchido e a atrasada em vermelho) e por marco, eixo de meses e dias, linha de hoje. */
export function htmlGantt(p) {
  const c = p.cronograma || { tarefas: [], marcos: [] };
  const tarefas = c.tarefas.filter((t) => t.inicio), marcos = (c.marcos || []).filter((m) => m.data);
  if (!tarefas.length && !marcos.length) return '';
  const datas = tarefas.flatMap((t) => [t.inicio, fimDe(t)]).concat(marcos.map((m) => m.data));
  const ordem = datas.slice().sort();
  const ini = somarDias(ordem[0], -2), fim = somarDias(ordem[ordem.length - 1], 3);
  const total = diasEntre(ini, fim) + 1;
  const pct = (d) => (diasEntre(ini, d) * 100 / total).toFixed(2);
  const lang = (document.documentElement.lang || 'en');
  const mesFmt = new Intl.DateTimeFormat(lang, { month: 'short', year: 'numeric', timeZone: 'UTC' });
  // meses: um bloco por mês, com a largura proporcional aos dias dele
  const meses = [];
  for (let i = 0; i < total; i++) {
    const d = somarDias(ini, i), chave = d.slice(0, 7);
    if (!meses.length || meses[meses.length - 1].chave !== chave) meses.push({ chave, dias: 0, rotulo: mesFmt.format(new Date(d + 'T00:00:00Z')) });
    meses[meses.length - 1].dias++;
  }
  const passo = total <= 31 ? 1 : total <= 70 ? 7 : 14;
  const dias = [];
  for (let i = 0; i < total; i += passo) dias.push('<span style="left:' + (i * 100 / total).toFixed(2) + '%">' + Number(somarDias(ini, i).slice(8)) + '</span>');
  const hojeIso = hoje();
  const linhaHoje = hojeIso >= ini && hojeIso <= fim ? '<i class="mz-g-hoje" style="left:' + pct(hojeIso) + '%" title="' + esc(tr('Hoje')) + '"></i>' : '';
  const classe = (q) => (q === 'terceiro' ? 'sub' : q === 'proprio' ? 'proprio' : 'decidir');
  const quemTxt = (q) => (q === 'terceiro' ? tr('Prestadora') : q === 'proprio' ? tr('Nós') : tr('A decidir'));
  const linhasT = tarefas.map((t) => {
    const f = fimDe(t), dur = Math.max(1, Number(t.dias) || 1), feito = pctFeito(t), prev = pctPrevisto(t, hojeIso), atrasada = tarefaAtrasada(t, hojeIso);
    const dica = t.nome + ' · ' + dataCurta(t.inicio) + ' → ' + dataCurta(f) + ' · ' + tn(dur, '{n} dia', '{n} dias') + ' · ' + quemTxt(t.quem) + ' · ' + tr('{a}% feito, {b}% previsto', { a: feito, b: prev }) + (atrasada ? ' · ' + tr('Atrasada') : '');
    return '<div class="mz-g-linha' + (atrasada ? ' atrasada' : '') + '"><div class="mz-g-nome" title="' + esc(t.nome) + '"><span>' + esc(t.nome) + '</span><small class="mz-g-pct">' + feito + '%</small></div><div class="mz-g-pista">' + linhaHoje +
      '<span class="mz-g-barra ' + classe(t.quem) + (atrasada ? ' atrasada' : '') + '" style="left:' + pct(t.inicio) + '%;width:' + Math.max(0.8, dur * 100 / total).toFixed(2) + '%" title="' + esc(dica) + '" tabindex="0"><i class="mz-g-feito" style="width:' + feito + '%"></i><em>' + esc(t.nome) + '</em></span></div></div>';
  }).join('');
  const linhasM = marcos.map((m) => '<div class="mz-g-linha"><div class="mz-g-nome" title="' + esc(m.nome) + '"><i class="mz-g-losango"></i>' + esc(m.nome) + '</div><div class="mz-g-pista">' + linhaHoje +
    '<span class="mz-g-marco" style="left:' + pct(m.data) + '%" title="' + esc(m.nome + ' · ' + dataCurta(m.data)) + '" tabindex="0"></span></div></div>').join('');
  return '<div class="mz-gantt"><div class="mz-g-cab"><div class="mz-g-nome"></div><div class="mz-g-escala"><div class="mz-g-meses">' + meses.map((m) => '<span style="width:' + (m.dias * 100 / total).toFixed(2) + '%">' + esc(m.rotulo) + '</span>').join('') + '</div><div class="mz-g-dias">' + dias.join('') + '</div></div></div>' + linhasT + linhasM + '</div>';
}

/* ---------- A página do Gantt: um projeto por vez, o gráfico no tamanho da página ---------- */

export const SITUACAO_ANDAMENTO = () => ({
  atrasado: [tr('Atrasado'), 'etiqueta-alerta'], 'em-dia': [tr('Em dia'), 'etiqueta-verde'], 'nao-iniciado': [tr('Não iniciado'), 'etiqueta-azul'],
  concluido: [tr('Concluído'), 'etiqueta-neutro'], 'sem-cronograma': [tr('Sem cronograma'), 'etiqueta-neutro'],
});
export const etiquetaAndamento = (sit) => { const [n, cl] = SITUACAO_ANDAMENTO()[sit]; return '<span class="etiqueta ' + cl + '">' + n + '</span>'; };

/* Os projetos que têm cronograma (perdidos de fora), os atrasados primeiro. */
export function projetosComCronograma() {
  const h = hoje();
  return projetos().filter((p) => p.situacao !== 'perdida').map((p) => ({ p, a: andamentoDoCronograma(p.cronograma, h) }))
    .filter((x) => x.a.tarefas > 0 || ((x.p.cronograma || {}).marcos || []).some((m) => m.data))
    .sort((x, y) => ORDEM_SITUACAO[x.a.situacao] - ORDEM_SITUACAO[y.a.situacao] || x.p.nome.localeCompare(y.p.nome));
}

export function telaGantt(moldura, id) {
  const lista = projetosComCronograma();
  const atual = lista.find((x) => x.p.id === id) || lista[0];
  const combo = '<label class="gantt-escolha"><span class="rotulo-pequeno">' + tr('Projeto') + '</span><select id="gantt-projeto" aria-label="' + esc(tr('Projeto')) + '">' +
    lista.map((x) => '<option value="' + x.p.id + '"' + (atual && x.p.id === atual.p.id ? ' selected' : '') + '>' + esc(x.p.nome) + (x.a.situacao === 'atrasado' ? ' · ' + tr('Atrasado') : '') + '</option>').join('') + '</select></label>';
  if (!atual) {
    return moldura({ ativo: 'gantt', largura: 'larga', titulo: tr('Gantt'), subtitulo: tr('O andamento de cada projeto, no tamanho da página'),
      conteudo: '<p class="vazio">' + tr('Nenhum projeto com cronograma ainda. Monte o cronograma na aba Schedule do projeto.') + ' <a href="#/measure">' + tr('Abrir os projetos') + '</a></p>' });
  }
  const { p, a } = atual;
  const kpi = (rot, val, sub) => '<div class="co-kpi"><span>' + rot + '</span><b>' + val + '</b>' + (sub ? '<small>' + sub + '</small>' : '') + '</div>';
  const kpis = '<div class="co-kpis co-kpis-4 gantt-kpis">' +
    kpi(tr('Situação'), etiquetaAndamento(a.situacao), a.atrasadas.length ? tn(a.atrasadas.length, '{n} tarefa atrasada', '{n} tarefas atrasadas') : tn(a.concluidas, '{n} de {total} tarefa concluída', '{n} de {total} tarefas concluídas', { total: a.tarefas })) +
    kpi(tr('Feito'), a.feito + '%', tr('{n}% previsto para hoje', { n: a.previsto })) +
    kpi(tr('Início → término'), (a.inicio ? dataCurta(a.inicio) : '—') + ' → ' + (a.fim ? dataCurta(a.fim) : '—'), a.fim ? (a.fim >= hoje() ? tn(diasEntre(hoje(), a.fim), 'falta {n} dia', 'faltam {n} dias') : tn(diasEntre(a.fim, hoje()), 'terminava há {n} dia', 'terminava há {n} dias')) : '') +
    kpi(tr('Tarefas'), String(a.tarefas), tn(a.emAndamento, '{n} em andamento', '{n} em andamento')) + '</div>';
  return moldura({
    ativo: 'gantt', largura: 'larga', titulo: tr('Gantt'), subtitulo: tr('O andamento de cada projeto, no tamanho da página'),
    acoes: '<a class="btn btn-contorno btn-pequeno" href="' + href(p, 'schedule') + '">' + tr('Editar o cronograma') + '</a>',
    conteudo: '<div class="gantt-topo">' + combo + legendaGantt() + '</div>' + kpis + '<div class="gantt-grande">' + htmlGantt(p) + '</div>',
  });
}
if (typeof document !== 'undefined') {
  document.addEventListener('change', (ev) => { if (ev.target && ev.target.id === 'gantt-projeto') app.ir('#/measure/gantt/' + ev.target.value); });
}

/* ---------- Ações ---------- */

function terminou(msg) { salvar(); if (msg) toast(msg); app.desenhar(); }

export const acoesEspaco = {
  'pj-add-tarefa'(el) {
    const c = cronogramaDe(projeto(el.dataset.id));
    const ultima = c.tarefas.map(fimDe).filter(Boolean).sort().pop();
    c.tarefas.push({ id: novoId('tf'), nome: '', quem: 'proprio', inicio: ultima ? somarDias(ultima, 1) : hoje(), dias: 5 });
    terminou();
  },
  'pj-tirar-tarefa'(el) {
    const c = cronogramaDe(projeto(el.dataset.id));
    c.tarefas = c.tarefas.filter((t) => t.id !== el.dataset.t);
    terminou();
  },
  'pj-gerar-cronograma'(el) {
    const p = projeto(el.dataset.id), c = cronogramaDe(p);
    let inicio = p.prazoProposta ? somarDias(p.prazoProposta, 7) : hoje();
    const ja = new Set(c.tarefas.map((t) => t.nome));
    let n = 0;
    for (const nome of etapasDasCondicoes(p)) {
      if (ja.has(nome)) continue;
      c.tarefas.push({ id: novoId('tf'), nome, quem: 'proprio', inicio, dias: 5 });
      inicio = somarDias(inicio, 5); n++;
    }
    terminou(n ? tn(n, '{n} tarefa criada. Ajuste as datas e as durações.', '{n} tarefas criadas. Ajuste as datas e as durações.') : tr('As etapas já estão no cronograma.'));
  },
  'pj-add-marco'(el) {
    cronogramaDe(projeto(el.dataset.id)).marcos.push({ id: novoId('mc'), nome: '', data: '', nota: '' });
    terminou();
  },
  'pj-confirmar-cronograma'(el) {
    const c = cronogramaDe(projeto(el.dataset.id));
    c.confirmado = { em: hoje(), tarefas: JSON.parse(JSON.stringify(c.tarefas)), marcos: JSON.parse(JSON.stringify(c.marcos)) };
    terminou(tr('Cronograma confirmado como base da obra.'));
  },
  'pj-tirar-marco'(el) {
    const c = cronogramaDe(projeto(el.dataset.id));
    c.marcos = c.marcos.filter((m) => m.id !== el.dataset.m);
    terminou();
  },
};

/* Campos que mudam ao digitar ou escolher (sem redesenhar a tela inteira a cada tecla). */
if (typeof document !== 'undefined') {
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (!el || !el.matches) return;
    if (el.matches('[data-pj-tarefa]')) {
      const c = cronogramaDe(projeto(el.dataset.id)), t = c.tarefas.find((y) => y.id === el.dataset.t);
      if (!t) return;
      t[el.dataset.pjTarefa] = el.dataset.pjTarefa === 'dias' ? Math.max(1, Number(el.value) || 1) : el.dataset.pjTarefa === 'pct' ? Math.max(0, Math.min(100, Math.round(Number(el.value) || 0))) : el.value;
      terminou();
      return;
    }
    if (el.matches('[data-pj-marco]')) {
      const c = cronogramaDe(projeto(el.dataset.id)), m = c.marcos.find((y) => y.id === el.dataset.m);
      if (!m) return;
      m[el.dataset.pjMarco] = el.value;
      salvar();
      if (el.dataset.pjMarco === 'data') app.desenhar();
    }
  });
}
