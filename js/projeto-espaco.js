/* KORbuild Takeoff — o projeto como espaço de trabalho: abas, Overview (com o checklist), Scope & delivery (quem faz cada etapa)
 * e Schedule (cronograma preliminar com marcos). Os dados novos ficam no próprio projeto:
 *   p.entrega    = { padrao: 'tudo' | 'misto' | 'terceirizar', etapas: [{ id, etapa, quem: 'proprio' | 'terceiro' | 'decidir', takeoff: 'detalhado' | 'nenhum' | 'quantidades' }] }
 *   p.cronograma = { tarefas: [{ id, nome, quem, inicio, dias }], marcos: [{ id, nome, data, nota }] }
 * No app com conta, estes dois campos só vão para o banco depois da migração 0016 (supabase/migrations): ver PERSISTE_ESPACO em measure-oficial.js. */

import { esc, toast, hoje, diasEntre, somarDias, dataCurta, novoId } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar } from './armazem.js';
import { projeto, folhasDo, condicoesDo, assembly, item, itens } from './measure.js';
import { dinheiro } from './crew.js';
import { icone } from './icones.js';

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

export function entregaDe(p) {
  if (!p.entrega) {
    p.entrega = { padrao: 'misto', etapas: etapasDasCondicoes(p).map((e) => ({ id: novoId('et'), etapa: e, quem: 'proprio', takeoff: 'detalhado' })) };
    salvar();
  }
  return p.entrega;
}
const cronogramaDe = (p) => { if (!p.cronograma) { p.cronograma = { tarefas: [], marcos: [] }; salvar(); } return p.cronograma; };

/* Os seis passos do projeto: o que já está feito e o que vem a seguir. */
export function passosDoProjeto(p) {
  const fs = folhasDo(p.id), cs = condicoesDo(p.id), e = p.entrega, c = p.cronograma;
  return [
    { id: 'plans', feito: fs.length > 0, aba: 'plans' },
    { id: 'scale', feito: fs.length > 0 && fs.every((f) => f.escala), aba: 'takeoff' },
    { id: 'delivery', feito: !!e && e.etapas.length > 0 && e.etapas.every((x) => x.quem !== 'decidir'), aba: 'takeoff' },
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
  delivery: [tr('Decidir quem faz cada parte'), (p) => { const e = p.entrega; if (!e || !e.etapas.length) return tr('Nenhuma etapa ainda'); const n = (q) => e.etapas.filter((x) => x.quem === q).length; return tr('{a} próprias · {b} subcontratadas · {c} a decidir', { a: n('proprio'), b: n('terceiro'), c: n('decidir') }); }],
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

/* ---------- Scope & delivery ---------- */

const QUEM = () => [['proprio', tr('Executo eu')], ['terceiro', tr('Subcontrato')], ['decidir', tr('Decidir depois')]];
const PADROES = () => [['tudo', tr('Fazemos tudo'), tr('Todas as etapas são nossas')], ['misto', tr('Misto'), tr('Fazemos algumas, subcontratamos outras')], ['terceirizar', tr('Subcontratamos tudo'), tr('Pedimos preço, sem takeoff de materiais')]];
const TAKEOFF = () => ({ detalhado: tr('Detalhado'), nenhum: tr('Nenhum'), quantidades: tr('Só quantidades') });

export function htmlEscopo(p, ajudas) {
  const e = entregaDe(p);
  const conhecidas = [...new Set(itens().map((i) => i.etapa).filter(Boolean))].sort();
  const padroes = '<section class="cartao"><h2 class="cartao-titulo">' + tr('Como este projeto será executado?') + '</h2><p class="mudo pequeno">' + tr('Define o padrão de cada etapa. Você pode mudar cada uma abaixo.') + '</p><div class="mz-padroes">' +
    PADROES().map(([k, n, d]) => '<button type="button" class="mz-padrao' + (e.padrao === k ? ' ativo' : '') + '" data-acao="pj-padrao" data-id="' + p.id + '" data-padrao="' + k + '" aria-pressed="' + (e.padrao === k) + '"><b>' + esc(n) + '</b><small>' + esc(d) + '</small></button>').join('') + '</div></section>';
  const linhas = e.etapas.map((x) => {
    const bids = ajudas.licitacoesDa(p, x.etapa);
    return '<tr><td><b>' + esc(x.etapa) + '</b></td>' +
      '<td><select class="mz-quem ' + x.quem + '" data-pj-quem data-id="' + p.id + '" data-et="' + x.id + '" aria-label="' + esc(tr('Quem faz')) + '">' + QUEM().map(([k, n]) => '<option value="' + k + '"' + (x.quem === k ? ' selected' : '') + '>' + esc(n) + '</option>').join('') + '</select></td>' +
      '<td>' + (x.quem === 'proprio' ? esc(TAKEOFF().detalhado) : x.quem === 'terceiro' ? esc(TAKEOFF()[x.takeoff === 'quantidades' ? 'quantidades' : 'nenhum']) + ' <button type="button" class="link-botao pequeno" data-acao="pj-takeoff" data-id="' + p.id + '" data-et="' + x.id + '">' + (x.takeoff === 'quantidades' ? tr('não medir') : tr('medir quantidades')) + '</button>' : '<span class="mudo">—</span>') + '</td>' +
      '<td>' + (x.quem === 'proprio' ? tr('Nossa estimativa') : x.quem === 'terceiro' ? tr('Proposta da prestadora') : '<span class="mudo">—</span>') + '</td>' +
      '<td>' + (x.quem === 'terceiro' ? (bids ? '<a href="' + bids.href + '">' + esc(bids.texto) + '</a>' : '<a class="btn btn-contorno btn-pequeno" href="#/daily/concorrencias/nova/projeto/' + p.id + '">' + tr('Pedir propostas') + '</a>') : '') + '</td>' +
      '<td class="num"><button type="button" class="link-botao pequeno" data-acao="pj-tirar-etapa" data-id="' + p.id + '" data-et="' + x.id + '" aria-label="' + esc(tr('Remover')) + '">' + tr('Remover') + '</button></td></tr>';
  }).join('');
  const tabela = '<section class="cartao"><h2 class="cartao-titulo">' + tr('Quem faz cada etapa?') + '</h2><p class="mudo pequeno">' + tr('Etapa própria tem medição, materiais e cotação de fornecedores. Etapa subcontratada tem pedido de propostas, e o preço da prestadora entra na sua proposta.') + '</p>' +
    (e.etapas.length ? '<div class="tabela-rolagem"><table class="tabela tabela-escopo"><thead><tr><th>' + tr('Etapa') + '</th><th>' + tr('Quem faz') + '</th><th>' + tr('Takeoff') + '</th><th>' + tr('Origem do preço') + '</th><th>' + tr('Propostas') + '</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<p class="vazio">' + tr('Nenhuma etapa ainda. Adicione abaixo, ou inclua assemblies nas condições para que elas apareçam sozinhas.') + '</p>') +
    '<div class="mz-add-etapa"><input type="text" id="pj-nova-etapa" list="pj-etapas-conhecidas" placeholder="' + esc(tr('Ex.: 07 46 33 · Siding')) + '" aria-label="' + esc(tr('Nova etapa')) + '"><datalist id="pj-etapas-conhecidas">' + conhecidas.map((c) => '<option value="' + esc(c) + '">').join('') + '</datalist>' +
    '<button type="button" class="btn btn-contorno" data-acao="pj-add-etapa" data-id="' + p.id + '">' + icone('mais', 16) + tr('Adicionar etapa') + '</button>' +
    '<button type="button" class="btn btn-contorno" data-acao="pj-sugerir-etapas" data-id="' + p.id + '">' + tr('Trazer das medições') + '</button></div>' +
    (ajudas.aviso ? '<p class="mudo pequeno">' + ajudas.aviso + '</p>' : '') + '</section>';
  return padroes + tabela;
}

/* ---------- Schedule ---------- */

export function htmlCronograma(p, ajudas) {
  const c = cronogramaDe(p), e = entregaDe(p);
  const tarefas = c.tarefas;
  const min = tarefas.map((t) => t.inicio).filter(Boolean).sort()[0], max = tarefas.map(fimDe).filter(Boolean).sort().pop();
  const total = min && max ? Math.max(1, diasEntre(min, max) + 1) : 1;
  const barra = (t) => { if (!t.inicio) return ''; const ini = diasEntre(min, t.inicio), dur = Math.max(1, Number(t.dias) || 1); return '<div class="mz-linha-tempo" aria-hidden="true"><span style="left:' + (ini * 100 / total).toFixed(1) + '%;width:' + Math.max(2, dur * 100 / total).toFixed(1) + '%"></span></div>'; };
  const quemTxt = (t) => (t.quem === 'terceiro' ? tr('Prestadora') : t.quem === 'proprio' ? tr('Nós') : tr('A decidir'));
  const linhas = tarefas.map((t) => '<tr><td><input type="text" class="mz-t-nome" data-pj-tarefa="nome" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.nome) + '" aria-label="' + esc(tr('Tarefa')) + '"></td>' +
    '<td><span class="etiqueta ' + (t.quem === 'terceiro' ? 'etiqueta-ambar' : t.quem === 'proprio' ? 'etiqueta-verde' : 'etiqueta-neutro') + '">' + quemTxt(t) + '</span></td>' +
    '<td><input type="date" data-pj-tarefa="inicio" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.inicio || '') + '" aria-label="' + esc(tr('Início')) + '"></td>' +
    '<td><input type="number" min="1" class="mz-t-dias" data-pj-tarefa="dias" data-id="' + p.id + '" data-t="' + t.id + '" value="' + esc(t.dias || '') + '" aria-label="' + esc(tr('Duração em dias')) + '"></td>' +
    '<td>' + (fimDe(t) ? dataCurta(fimDe(t)) : '—') + '</td><td>' + barra(t) + '</td>' +
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
  return faixaGanho + '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Cronograma preliminar') + '</h2><p class="mudo pequeno">' + tr('Faz parte da proposta. Quando você ganha, confirma ou ajusta, e ele vira a base da obra.') + '</p></div>' +
    '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-gerar-cronograma" data-id="' + p.id + '"' + (e.etapas.length ? '' : ' disabled') + '>' + tr('Gerar a partir das etapas') + '</button>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-add-tarefa" data-id="' + p.id + '">' + icone('mais', 16) + tr('Adicionar tarefa') + '</button></div></div>' +
    (tarefas.length ? '<div class="tabela-rolagem"><table class="tabela tabela-cronograma"><thead><tr><th>' + tr('Tarefa') + '</th><th>' + tr('Quem') + '</th><th>' + tr('Início') + '</th><th>' + tr('Dias') + '</th><th>' + tr('Término') + '</th><th>' + tr('Linha do tempo') + '</th><th></th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
      : '<p class="vazio">' + tr('Nenhuma tarefa ainda. Gere a partir das etapas de Escopo e execução, ou adicione à mão.') + '</p>') + '</section>' +
    '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Marcos') + '</h2><p class="mudo pequeno">' + tr('Datas-chave que vão na proposta e na obra (ex.: licença aprovada).') + '</p></div>' +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="pj-add-marco" data-id="' + p.id + '">' + icone('mais', 16) + tr('Adicionar marco') + '</button></div>' +
    (c.marcos.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Marco') + '</th><th>' + tr('Data') + '</th><th>' + tr('Observação') + '</th><th></th></tr></thead><tbody>' + marcos + '</tbody></table></div>' : '<p class="vazio">' + tr('Nenhum marco ainda.') + '</p>') + '</section>' +
    (ajudas.aviso ? '<p class="mudo pequeno">' + ajudas.aviso + '</p>' : '');
}

/* ---------- Ações ---------- */

function etapaDe(p, id) { return entregaDe(p).etapas.find((x) => x.id === id); }
function terminou(msg) { salvar(); if (msg) toast(msg); app.desenhar(); }

export const acoesEspaco = {
  'pj-padrao'(el) {
    const p = projeto(el.dataset.id), e = entregaDe(p);
    e.padrao = el.dataset.padrao;
    if (e.padrao === 'tudo') for (const x of e.etapas) { x.quem = 'proprio'; x.takeoff = 'detalhado'; }
    if (e.padrao === 'terceirizar') for (const x of e.etapas) { x.quem = 'terceiro'; x.takeoff = 'nenhum'; }
    terminou();
  },
  'pj-takeoff'(el) {
    const x = etapaDe(projeto(el.dataset.id), el.dataset.et);
    if (x) x.takeoff = x.takeoff === 'quantidades' ? 'nenhum' : 'quantidades';
    terminou();
  },
  'pj-add-etapa'(el) {
    const p = projeto(el.dataset.id), campo = document.getElementById('pj-nova-etapa'), nome = (campo.value || '').trim();
    if (!nome) { toast(tr('Escreva o nome da etapa.')); return; }
    const e = entregaDe(p);
    if (e.etapas.some((x) => x.etapa.toLowerCase() === nome.toLowerCase())) { toast(tr('Essa etapa já está na lista.')); return; }
    e.etapas.push({ id: novoId('et'), etapa: nome, quem: e.padrao === 'terceirizar' ? 'terceiro' : e.padrao === 'tudo' ? 'proprio' : 'decidir', takeoff: e.padrao === 'terceirizar' ? 'nenhum' : 'detalhado' });
    terminou();
  },
  'pj-sugerir-etapas'(el) {
    const p = projeto(el.dataset.id), e = entregaDe(p);
    const novas = etapasDasCondicoes(p).filter((n) => !e.etapas.some((x) => x.etapa === n));
    for (const n of novas) e.etapas.push({ id: novoId('et'), etapa: n, quem: e.padrao === 'terceirizar' ? 'terceiro' : 'proprio', takeoff: e.padrao === 'terceirizar' ? 'nenhum' : 'detalhado' });
    terminou(novas.length ? tn(novas.length, '{n} etapa trazida das medições.', '{n} etapas trazidas das medições.') : tr('Não há etapas novas nas medições.'));
  },
  'pj-tirar-etapa'(el) {
    const p = projeto(el.dataset.id), e = entregaDe(p);
    e.etapas = e.etapas.filter((x) => x.id !== el.dataset.et);
    terminou();
  },
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
    const p = projeto(el.dataset.id), c = cronogramaDe(p), e = entregaDe(p);
    let inicio = p.prazoProposta ? somarDias(p.prazoProposta, 7) : hoje();
    const ja = new Set(c.tarefas.map((t) => t.nome));
    let n = 0;
    for (const x of e.etapas) {
      if (ja.has(x.etapa)) continue;
      c.tarefas.push({ id: novoId('tf'), nome: x.etapa, quem: x.quem, inicio, dias: 5 });
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
    if (el.matches('[data-pj-quem]')) {
      const p = projeto(el.dataset.id), x = p && etapaDe(p, el.dataset.et);
      if (!x) return;
      x.quem = el.value;
      x.takeoff = x.quem === 'proprio' ? 'detalhado' : x.quem === 'terceiro' ? (x.takeoff === 'quantidades' ? 'quantidades' : 'nenhum') : 'detalhado';
      const e = p.entrega; e.padrao = e.etapas.every((y) => y.quem === 'proprio') ? 'tudo' : e.etapas.every((y) => y.quem === 'terceiro') ? 'terceirizar' : 'misto';
      terminou();
      return;
    }
    if (el.matches('[data-pj-tarefa]')) {
      const c = cronogramaDe(projeto(el.dataset.id)), t = c.tarefas.find((y) => y.id === el.dataset.t);
      if (!t) return;
      t[el.dataset.pjTarefa] = el.dataset.pjTarefa === 'dias' ? Math.max(1, Number(el.value) || 1) : el.value;
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
