/* KORbuild Takeoff — Itens: o catálogo e os preços numa tela só.
 * Lista com busca e filtros (categoria, cost code, situação), a página do item (Details, Prices, Used in),
 * o histórico de preços e os markups. Item nunca é apagado: fica ativo ou inativo. */

import { esc, toast, hoje, dataCurta } from './util.js';
import { tr, tn } from './i18n.js';
import { estado } from './armazem.js';
import { usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { dinheiro } from './crew.js';
import { numero } from './imperial.js';
import { CATEGORIAS, itens, item, assemblies, salvarItem, definirAtivoItem } from './measure.js';
import { contato } from './contatos.js';
import { precoEm, registrarPreco, historicoComVariacao, situacaoDoItem, margensEm, historicoDeMargens, textoMargens, PRAZO_DESATUALIZADO_DIAS } from './precos.js';
import { dialogoPreco, dialogoMargens } from './precos-telas.js';
import { PERSISTE_ATIVO_ITEM } from './measure-oficial.js';
import { lerValor } from './measure-relatorios.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarItens(funcoes) { app = { ...app, ...funcoes }; }
const podeEditar = () => pode(usuarioAtual(), 'measure.catalogo');
const quem = () => (usuarioAtual() || {}).nome || '';
/* Na conta com banco, "inativo" só vale depois da atualização do banco (migração 0018). */
const ativoDisponivel = () => !estado().oficial || PERSISTE_ATIVO_ITEM;

const SITUACOES = () => ({
  ok: [tr('Em dia'), 'etiqueta-verde'], desatualizado: [tr('Desatualizado'), 'etiqueta-ambar'], 'sem-preco': [tr('Sem preço'), 'etiqueta-alerta'], inativo: [tr('Inativo'), 'etiqueta-neutro'],
});
const etiqueta = (st) => '<span class="etiqueta ' + SITUACOES()[st][1] + '">' + SITUACOES()[st][0] + '</span>';

/* ---------- A lista ---------- */

export function telaItens(moldura) {
  const ed = podeEditar();
  const todos = itens().slice().sort((a, b) => (a.categoria + a.etapa + a.nome).localeCompare(b.categoria + b.etapa + b.nome));
  const m = margensEm();
  const etapas = [...new Set(todos.map((i) => i.etapa).filter(Boolean))].sort();
  const conta = (st) => todos.filter((i) => situacaoDoItem(i) === st).length;
  const linha = (it) => {
    const p = precoEm(it), st = situacaoDoItem(it);
    return '<tr data-cat="' + esc(it.categoria) + '" data-etapa="' + esc(it.etapa || '') + '" data-st="' + st + '" data-q="' + esc((it.codigo + ' ' + it.nome + ' ' + (it.nota || '')).toLowerCase()) + '"' + (st === 'inativo' ? ' hidden' : '') + '>' +
      '<td class="mudo">' + esc(it.codigo) + '</td><td><a href="#/measure/item/' + it.id + '"><b>' + esc(it.nome) + '</b></a>' + (it.nota ? '<span class="mudo pequeno bloco">' + esc(it.nota) + '</span>' : '') + '</td>' +
      '<td>' + esc(CATEGORIAS[it.categoria] || '') + '</td><td>' + esc(it.etapa || '') + '</td><td>' + esc(it.unidade) + '</td>' +
      '<td class="num">' + (p ? '<b>' + dinheiro(p.valor) + '</b>' : '<span class="mudo">—</span>') + '</td>' +
      '<td class="pequeno">' + (p ? dataCurta(p.desde) : '') + '</td><td>' + etiqueta(st) + '</td>' +
      '<td class="num">' + (ed && st !== 'inativo' ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="preco-novo" data-id="' + it.id + '">' + tr('Novo preço') + '</button>' : '') + '</td></tr>';
  };
  const opcoes = (lista, rot) => '<option value="">' + rot + '</option>' + lista.map(([v, n]) => '<option value="' + esc(v) + '">' + esc(n) + '</option>').join('');
  return moldura({
    ativo: 'itens', largura: 'larga', titulo: tr('Itens'), subtitulo: tr('Catálogo de materiais, mão de obra, equipamentos e subempreiteiros, com o preço de cada um'),
    acoes: ed ? '<div class="btn-linha"><a class="btn btn-primario btn-pequeno" href="#/measure/item/novo">' + icone('mais', 16) + tr('Novo item') + '</a></div>' : '',
    conteudo:
      '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Markups') + '</h2>' +
        '<p class="margens-atual"><b>' + esc(textoMargens(m)) + '</b> <span class="mudo pequeno">' + tr('desde {data}', { data: dataCurta(m.desde) }) + '</span></p></div>' +
        (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="margens-nova">' + tr('Nova versão') + '</button>' : '') + '</div>' +
        (historicoDeMargens().length > 1 ? '<details class="preco-historico"><summary>' + tr('Histórico') + '</summary><ul>' + historicoDeMargens().map((x) => '<li>' + dataCurta(x.desde) + ' · ' + esc(textoMargens(x)) + (x.motivo ? ' · ' + esc(x.motivo) : '') + '</li>').join('') + '</ul></details>' : '') + '</section>' +
      '<div class="mz-filtros itens-filtros" id="itens-filtros">' +
        '<div class="mz-busca-campo">' + icone('lupa', 16) + '<input type="search" id="itens-busca" class="mz-busca" placeholder="' + esc(tr('Buscar por nome ou código…')) + '" aria-label="' + esc(tr('Buscar')) + '"></div>' +
        '<select id="itens-cat" aria-label="' + esc(tr('Categoria')) + '">' + opcoes(Object.entries(CATEGORIAS), tr('Todas as categorias')) + '</select>' +
        '<select id="itens-etapa" aria-label="' + esc(tr('Etapa (cost code)')) + '">' + opcoes(etapas.map((e) => [e, e]), tr('Todos os cost codes')) + '</select>' +
        '<select id="itens-st" aria-label="' + esc(tr('Situação')) + '"><option value="ativos">' + tr('Ativos') + ' (' + (todos.length - conta('inativo')) + ')</option>' +
          '<option value="sem-preco">' + tr('Sem preço') + ' (' + conta('sem-preco') + ')</option><option value="desatualizado">' + tr('Desatualizado') + ' (' + conta('desatualizado') + ')</option>' +
          '<option value="inativo">' + tr('Inativos') + ' (' + conta('inativo') + ')</option><option value="todos">' + tr('Todos') + ' (' + todos.length + ')</option></select>' +
        '<span class="mudo pequeno" id="itens-contagem"></span></div>' +
      '<section class="cartao">' + (todos.length
        ? '<div class="tabela-rolagem"><table class="tabela tabela-itens tabela-precos" id="itens-tabela"><thead><tr><th>' + tr('Código') + '</th><th>' + tr('Item') + '</th><th>' + tr('Categoria') + '</th><th>' + tr('Etapa (cost code)') + '</th><th>' + tr('Unidade de compra') + '</th><th class="num">' + tr('Preço atual') + '</th><th>' + tr('Desde') + '</th><th>' + tr('Situação') + '</th><th></th></tr></thead><tbody>' + todos.map(linha).join('') + '</tbody></table></div><p class="vazio" id="itens-nenhum" hidden>' + tr('Nenhum item com esses filtros.') + '</p>'
        : '<p class="vazio">' + tr('Ainda não há itens. Crie o primeiro.') + '</p>') + '</section>' +
      '<p class="dica">' + tr('Os preços nunca são apagados: um preço novo vale a partir de uma data, e a proposta usa o que vale no dia em que é emitida. Preço com mais de 12 meses aparece como desatualizado. Item não se exclui: fica inativo.') + '</p>',
  });
}

/* Os filtros escondem as linhas (sem redesenhar a tela). */
function filtrarItens() {
  const tabela = document.getElementById('itens-tabela');
  if (!tabela) return;
  const q = (document.getElementById('itens-busca').value || '').trim().toLowerCase();
  const cat = document.getElementById('itens-cat').value, etapa = document.getElementById('itens-etapa').value, st = document.getElementById('itens-st').value;
  let n = 0;
  for (const tr_ of tabela.tBodies[0].rows) {
    const ok = (!q || tr_.dataset.q.includes(q)) && (!cat || tr_.dataset.cat === cat) && (!etapa || tr_.dataset.etapa === etapa)
      && (st === 'todos' || (st === 'ativos' ? tr_.dataset.st !== 'inativo' : tr_.dataset.st === st));
    tr_.hidden = !ok;
    if (ok) n++;
  }
  document.getElementById('itens-contagem').textContent = tn(n, '{n} item', '{n} itens');
  document.getElementById('itens-nenhum').hidden = n > 0;
}
if (typeof document !== 'undefined') {
  const alvo = (ev) => ev.target && ev.target.closest && ev.target.closest('#itens-filtros');
  document.addEventListener('input', (ev) => { if (alvo(ev)) filtrarItens(); });
  document.addEventListener('change', (ev) => { if (alvo(ev)) filtrarItens(); });
}
export function aposDesenharItens() { filtrarItens(); }

/* ---------- A página do item ---------- */

const ABAS_ITEM = () => [['details', tr('Detalhes')], ['prices', tr('Preços')], ['used', tr('Usado em')]];

function graficoDePrecos(h, unidade) {
  const pontos = h.slice().reverse();
  if (pontos.length < 2) return '';
  const W = 640, H = 120, pad = 14;
  const vs = pontos.map((p) => p.valor), min = Math.min(...vs), max = Math.max(...vs), faixa = max - min || 1;
  const x = (i) => pad + (i * (W - 2 * pad)) / (pontos.length - 1), y = (v) => H - pad - ((v - min) * (H - 2 * pad)) / faixa;
  const linha = pontos.map((p, i) => x(i).toFixed(1) + ',' + y(p.valor).toFixed(1)).join(' ');
  return '<svg class="itens-grafico" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(tr('Histórico de preços')) + '"><polyline fill="none" stroke="var(--primario)" stroke-width="2.5" points="' + linha + '"/>' +
    pontos.map((p, i) => '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.valor).toFixed(1) + '" r="4" fill="var(--primario)"><title>' + esc(dataCurta(p.desde) + ' · ' + dinheiro(p.valor) + '/' + unidade) + '</title></circle>').join('') + '</svg>';
}

export function telaItem(moldura, id, abaPedida) {
  const novo = id === 'novo';
  const it = novo ? null : item(id);
  if (!novo && !it) return null;
  const ed = podeEditar();
  const aba = novo ? 'details' : (ABAS_ITEM().some(([k]) => k === abaPedida) ? abaPedida : 'details');
  const v = it || { categoria: 'material' };
  const abas = novo ? '' : '<nav class="abas-sublinhadas" aria-label="' + esc(tr('Seções')) + '">' + ABAS_ITEM().map(([k, r]) => '<a href="#/measure/item/' + it.id + (k === 'details' ? '' : '/' + k) + '"' + (k === aba ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>';
  const campo = (nome, rotulo, html) => '<div class="campo"><label class="rotulo-pequeno" for="it-' + nome + '">' + rotulo + '</label>' + html + '</div>';
  const dis = ed ? '' : ' disabled';
  let corpo = '';
  if (aba === 'details') {
    corpo = '<form id="form-item" class="form-settings" data-id="' + (it ? it.id : '') + '" data-sem-envio><section class="cartao"><h2 class="cartao-titulo">' + tr('Item') + '</h2><div class="grade-campos">' +
      campo('nome', tr('Nome *'), '<input type="text" id="it-nome" name="nome" value="' + esc(v.nome || '') + '" placeholder="' + esc(tr('Ex.: Drywall 5/8" tipo X 4\'×8\'')) + '"' + dis + '>') +
      campo('codigo', tr('Código'), '<input type="text" id="it-codigo" name="codigo" value="' + esc(v.codigo || '') + '"' + dis + '>') +
      campo('cat', tr('Categoria *'), '<select id="it-cat" name="categoria"' + dis + '>' + Object.entries(CATEGORIAS).map(([c, n]) => '<option value="' + c + '"' + (c === v.categoria ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') +
      campo('un', tr('Unidade de compra *'), '<input type="text" id="it-un" name="unidade" value="' + esc(v.unidade || '') + '" placeholder="' + esc(tr('chapa, caixa, rolo, peça, cu yd, hora…')) + '"' + dis + '>') +
      campo('etapa', tr('Etapa (cost code)'), '<input type="text" id="it-etapa" name="etapa" value="' + esc(v.etapa || '') + '" placeholder="' + esc(tr('Ex.: 09 29 00 · Gypsum board')) + '"' + dis + '>') +
      campo('nota', tr('Nota'), '<input type="text" id="it-nota" name="nota" value="' + esc(v.nota || '') + '" placeholder="' + esc(tr('Ex.: cobre 32 sq ft')) + '"' + dis + '>') + '</div></section>' +
      (novo && ed ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Preço inicial (opcional)') + '</h2><div class="grade-campos">' +
        campo('preco', tr('Preço por unidade de compra (US$)'), '<input type="text" inputmode="decimal" id="it-preco" name="preco">') +
        campo('desde', tr('Vale a partir de'), '<input type="date" id="it-desde" name="desde" value="' + hoje() + '">') + '</div></section>' : '') +
      (ed ? '<div class="rodape-form"><a class="btn btn-contorno" href="#/measure/itens">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="item-salvar">' + (novo ? tr('Criar item') : tr('Salvar')) + '</button></div>' : '') + '</form>' +
      (!novo && ed ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Situação do item') + '</h2><p class="mudo pequeno">' + (it.ativo === false ? tr('Este item está inativo: não aparece nas listas nem nos assemblies novos. O histórico de preços fica guardado.') : tr('Item ativo. Para tirar de uso sem perder o histórico, deixe-o inativo. Itens nunca são excluídos.')) + '</p>' +
        '<button type="button" class="btn btn-contorno" data-acao="item-ativo" data-id="' + it.id + '"' + (ativoDisponivel() ? '' : ' disabled title="' + esc(tr('Disponível depois da próxima atualização do banco.')) + '"') + '>' + (it.ativo === false ? tr('Reativar o item') : tr('Deixar inativo')) + '</button>' +
        (ativoDisponivel() ? '' : '<p class="mudo pequeno">' + tr('Disponível depois da próxima atualização do banco.') + '</p>') + '</section>' : '');
  } else if (aba === 'prices') {
    const p = precoEm(it), h = historicoComVariacao(it);
    const fornecedor = (x) => (x.fornecedorId && contato(x.fornecedorId) ? contato(x.fornecedorId).nome : '');
    corpo = '<section class="cartao"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + tr('Preço atual') + '</h2>' +
      (p ? '<p class="itens-preco-grande"><b>' + dinheiro(p.valor) + '</b> <span class="mudo">/ ' + esc(it.unidade) + '</span></p><p class="mudo pequeno">' + tr('desde {data}', { data: dataCurta(p.desde) }) + ' · ' + esc(p.fonte) + (fornecedor(p) ? ' · ' + esc(fornecedor(p)) : '') + ' · ' + etiqueta(situacaoDoItem(it)) + '</p>'
        : '<p class="vazio">' + tr('Este item ainda não tem preço.') + '</p>') + '</div>' +
      (ed && it.ativo !== false ? '<button type="button" class="btn btn-primario btn-pequeno" data-acao="preco-novo" data-id="' + it.id + '">' + icone('mais', 16) + tr('Novo preço') + '</button>' : '') + '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Histórico de preços') + '</h2>' + graficoDePrecos(h, it.unidade) + (h.length
        ? '<div class="tabela-rolagem"><table class="tabela tabela-historico"><thead><tr><th>' + tr('Vale desde') + '</th><th class="num">' + tr('Preço') + '</th><th class="num">' + tr('Variação') + '</th><th>' + tr('Origem') + '</th><th>' + tr('Fornecedor') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>' +
          h.map((x, i) => '<tr' + (i === 0 ? ' class="atual"' : '') + '><td>' + dataCurta(x.desde) + (i === 0 ? ' <span class="etiqueta etiqueta-verde">' + tr('atual') + '</span>' : '') + '</td><td class="num"><b>' + dinheiro(x.valor) + '</b> / ' + esc(it.unidade) + '</td>' +
            '<td class="num">' + (x.variacao == null ? '<span class="mudo">—</span>' : '<span class="' + (x.variacao > 0 ? 'texto-alerta' : 'itens-queda') + '">' + (x.variacao > 0 ? '+' : '') + numero(x.variacao, 1) + '%</span>') + '</td>' +
            '<td>' + esc(x.fonte || '') + '</td><td>' + esc(fornecedor(x)) + '</td><td class="mudo pequeno">' + esc(x.por || '') + '</td></tr>').join('') + '</tbody></table></div>'
        : '<p class="vazio">' + tr('Nenhum preço registrado.') + '</p>') +
      '<p class="mudo pequeno">' + tr('Os preços nunca são apagados: um preço novo vale a partir de uma data, e a proposta usa o que vale no dia em que é emitida.') + '</p></section>';
  } else {
    const usos = assemblies().filter((a) => a.linhas.some((l) => l.itemId === it.id));
    corpo = '<section class="cartao"><h2 class="cartao-titulo">' + tr('Assemblies que usam este item') + '</h2>' + (usos.length
      ? '<ul class="lista-simples">' + usos.map((a) => '<li><a href="#/measure/assembly/' + a.id + '"><b>' + esc(a.nome) + '</b></a></li>').join('') + '</ul>'
      : '<p class="vazio">' + tr('Nenhum assembly usa este item ainda.') + '</p>') + '</section>';
  }
  return moldura({
    ativo: 'itens', largura: 'larga', titulo: novo ? tr('Novo item') : it.nome, subtitulo: novo ? tr('Cadastre o item e, se já souber, o preço inicial') : (esc(it.codigo) + (it.codigo ? ' · ' : '') + (CATEGORIAS[it.categoria] || '') + (it.etapa ? ' · ' + it.etapa : '') + (it.ativo === false ? ' · ' + tr('Inativo') : '')),
    voltar: { href: '#/measure/itens', rotulo: tr('Itens') }, conteudo: abas + corpo,
  });
}

export const acoesItens = {
  'item-salvar'() {
    const form = document.getElementById('form-item');
    const dados = Object.fromEntries(new FormData(form).entries());
    const id = form.dataset.id || null;
    const r = salvarItem(id, dados);
    if (r.erro) { toast(r.erro); return; }
    if (!id && String(dados.preco || '').trim()) {
      const pr = registrarPreco(r.id, { valor: lerValor(dados.preco), desde: dados.desde, fonte: tr('Digitado') }, quem());
      if (pr.erro) { toast(tr('Item criado, mas o preço não foi salvo: {erro}', { erro: pr.erro })); app.ir('#/measure/item/' + r.id + '/prices'); return; }
    }
    toast(id ? tr('Item atualizado.') : tr('Item criado.'));
    app.ir(id ? '#/measure/item/' + id : '#/measure/item/' + r.id + '/prices');
  },
  'item-ativo'(el) {
    const it = item(el.dataset.id);
    definirAtivoItem(it.id, it.ativo === false);
    toast(it.ativo === false ? tr('Item inativo.') : tr('Item reativado.'));
    app.desenhar();
  },
};
