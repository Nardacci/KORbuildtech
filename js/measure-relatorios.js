/* KORbuild Measure — relatórios que saem do projeto (docs/measure.md §Relatórios):
 *  - LISTA PARA COTAÇÃO: os materiais, na unidade de compra, separados por fornecedor (pelas etapas que
 *    cada um fornece), sem preço e com as colunas em branco para o fornecedor preencher.
 *  - PROPOSTA: logo e dados da empresa, contratante, escopo por etapa com o preço de cada linha (valor
 *    fechado, como a prestadora orça), linhas extras, subtotais, total e termos. Emitida, vira uma
 *    versão congelada e numerada: mudar o projeto depois não muda o que foi enviado. */

import { esc, toast, hoje, somarDias, dataCurta, confirmar } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar } from './armazem.js';
import { usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { numero } from './imperial.js';
import { dinheiro } from './crew.js';
import { projeto, quantidadesDoProjeto, enderecoDoProjeto } from './measure.js';
import { custoDe, margensEm, textoMargens } from './precos.js';
import { empresa, enderecoDaEmpresa, contato, contatosCom, contratanteDe, donoDe } from './contatos.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarRelatorios(funcoes) { app = { ...app, ...funcoes }; }

const qtd = (v) => { const r = Math.round(v * 100) / 100; return numero(r, Number.isInteger(r) ? 0 : 2); };
const quem = () => (usuarioAtual() || {}).nome || '';
const nomeEtapa = (etapa) => etapa.split(' · ')[1] || etapa;
const codigoEtapa = (etapa) => (etapa.includes(' · ') ? etapa.split(' · ')[0] : '');

/* Valor digitado: aceita 12500, 12.500,00, US$ 12,500.00. Devolve número ou null. */
export function lerValor(texto) {
  let t = String(texto || '').replace(/US\$|\$|\s/g, '');
  if (!t) return null;
  if (/,\d{1,2}$/.test(t)) t = t.replace(/\./g, '').replace(',', '.'); // 12.500,00
  else t = t.replace(/,/g, ''); // 12,500.00
  const v = Number(t);
  return Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null;
}

/* ---------- Cabeçalho da empresa (comum aos dois documentos) ---------- */

function htmlCabecalho(titulo, linhas) {
  const e = empresa();
  return '<header class="doc-topo"><div class="doc-empresa">' +
      (e.logo ? '<img class="doc-logo" src="' + e.logo + '" alt="' + esc(e.nome) + '">' : '<span class="rel-logo">' + esc(e.sigla || '') + '</span>') +
      '<div><b>' + esc(e.nome) + '</b><span>' + esc(enderecoDaEmpresa(e)) + '</span><span>' + esc([e.telefone, e.email, e.site].filter(Boolean).join(' · ')) + '</span></div></div>' +
    '<div class="doc-titulo"><h1>' + esc(titulo) + '</h1>' + linhas.map((l) => '<span>' + l + '</span>').join('') + '</div></header>';
}
function htmlPara(rotulo, c) {
  if (!c) return '';
  return '<div class="doc-bloco"><span class="doc-rotulo">' + rotulo + '</span><b>' + esc(c.nome) + '</b>' +
    (c.pessoa ? '<span>A/C ' + esc(c.pessoa) + '</span>' : '') + '<span>' + esc([c.email, c.telefone].filter(Boolean).join(' · ')) + '</span></div>';
}
function htmlObra(p) {
  return ('<div class="doc-bloco"><span class="doc-rotulo">' + tr('Obra') + '</span><b>') + esc(p.nome) + '</b><span>' + esc(enderecoDoProjeto(p)) + '</span>' +
    (donoDe(p) && donoDe(p) !== contratanteDe(p) ? ('<span>' + tr('Dono da obra:') + ' ') + esc(donoDe(p).nome) + '</span>' : '') + '</div>';
}

/* ---------- Lista para cotação ---------- */

/* Os materiais do projeto, separados por fornecedor. Um item que dois fornecedores vendem vai para os dois;
 * o que ninguém fornece fica em "Sem fornecedor" (e a tela avisa). */
export function listaDeCotacao(projetoId) {
  const materiais = quantidadesDoProjeto(projetoId).porItem.filter((g) => g.item.categoria === 'material')
    .sort((a, b) => a.item.etapa.localeCompare(b.item.etapa) || a.item.nome.localeCompare(b.item.nome));
  const fornecedores = contatosCom('fornecedor');
  const grupos = fornecedores.map((f) => ({ fornecedor: f, itens: materiais.filter((g) => f.etapas.includes(g.item.etapa)) })).filter((g) => g.itens.length);
  const sem = materiais.filter((g) => !fornecedores.some((f) => f.etapas.includes(g.item.etapa)));
  return { grupos, sem, total: materiais.length };
}

function htmlTabelaCotacao(itens) {
  return ('<table class="doc-tabela"><thead><tr><th>#</th><th>' + tr('Código') + '</th><th>' + tr('Descrição') + '</th><th class="num">' + tr('Quantidade') + '</th><th>' + tr('Unidade') + '</th><th class="num doc-branco">' + tr('Preço unitário') + '</th><th class="num doc-branco">' + tr('Total') + '</th></tr></thead><tbody>') +
    itens.map((g, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(g.item.codigo) + '</td><td><b>' + esc(g.item.nome) + '</b>' + (g.item.nota ? '<span class="doc-nota">' + esc(g.item.nota) + '</span>' : '') + '</td>' +
      '<td class="num"><b>' + qtd(g.total) + '</b></td><td>' + esc(g.item.unidade) + '</td><td class="doc-branco"></td><td class="doc-branco"></td></tr>').join('') + '</tbody></table>';
}

function prazoResposta(p) { return (p.cotacao && p.cotacao.responderAte) || somarDias(hoje(), 3); }
function obsCotacao(p) { return (p.cotacao && p.cotacao.observacoes) != null ? p.cotacao.observacoes : tr('Entrega na obra. Informe o prazo de entrega e se o preço inclui o frete.'); }
const respostas = (p, fornecedorId) => ((p.cotacao && p.cotacao.respostas) || []).filter((x) => x.fornecedorId === fornecedorId);
const envios = (p, fornecedorId) => ((p.cotacao && p.cotacao.envios) || []).filter((x) => x.fornecedorId === fornecedorId);

export function telaCotacao(id, moldura) {
  const p = projeto(id);
  const l = listaDeCotacao(id);
  const grupo = (g) => {
    const f = g.fornecedor;
    const ultimos = envios(p, f.id);
    return '<section class="cartao cot-fornecedor"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + esc(f.nome) + '</h2>' +
        '<span class="mudo pequeno">' + esc([f.pessoa, f.email].filter(Boolean).join(' · ') || tr('sem e-mail cadastrado')) + ' · ' + tn(g.itens.length, '{n} item', '{n} itens') + '</span>' +
        (ultimos.length ? '<span class="etiqueta etiqueta-verde">' + tr('e-mail preparado em') + ' ' + dataCurta(ultimos[ultimos.length - 1].em.slice(0, 10)) + '</span>' : '') +
        (respostas(p, f.id).length ? ('<span class="etiqueta etiqueta-azul">' + tr('preços recebidos em') + ' ') + dataCurta(respostas(p, f.id).slice(-1)[0].em.slice(0, 10)) + '</span>' : '') + '</div>' +
        '<div class="btn-linha">' + (pode(usuarioAtual(), 'measure.catalogo') ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="cot-resposta" data-projeto="' + id + '" data-fornecedor="' + f.id + ('">' + tr('Registrar preços recebidos') + '</button>') : '') +
        '<a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/cotacao/' + f.id + '/imprimir">' + icone('baixar', 16) + 'PDF</a>' +
        '<button type="button" class="btn btn-primario btn-pequeno" data-acao="cot-email" data-projeto="' + id + '" data-fornecedor="' + f.id + '"' + (f.email ? '' : (' disabled title="' + tr('Cadastre o e-mail do fornecedor') + '"')) + '>' + icone('link', 16) + (tr('Enviar por e-mail') + '</button></div></div>') +
      '<div class="tabela-rolagem">' + htmlTabelaCotacao(g.itens) + '</div></section>';
  };
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: tr('Lista para cotação'), subtitulo: p.nome + (' ' + tr('· materiais na unidade de compra, sem preço, separados por fornecedor')),
    voltar: { href: '#/measure/projeto/' + id, rotulo: p.nome },
    conteudo: (l.total ? '' : '<p class="aviso-info">' + icone('measure', 16) + (tr('Ainda não há materiais: meça as condições que têm assemblies.') + '</p>')) +
      '<section class="cartao"><form id="form-cotacao" class="form-settings" data-projeto="' + id + '" onsubmit="return false"><div class="grade-campos">' +
        ('<div class="campo"><label class="rotulo-pequeno" for="cot-ate">' + tr('Responder até') + '</label><input type="date" id="cot-ate" name="responderAte" value="') + prazoResposta(p) + '"></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="cot-entrega">' + tr('Entregar em') + '</label><input type="text" id="cot-entrega" value="') + esc(enderecoDoProjeto(p)) + '" disabled></div></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="cot-obs">' + tr('Observações para o fornecedor') + '</label><textarea id="cot-obs" name="observacoes" rows="2">') + esc(obsCotacao(p)) + '</textarea></div></form>' +
        ('<p class="mudo pequeno">' + tr('Cada fornecedor recebe só os itens das etapas que ele fornece (Settings › Contatos). Quantidades já com perda e arredondadas para a compra.') + '</p></section>') +
      l.grupos.map(grupo).join('') +
      (l.sem.length ? ('<section class="cartao cot-sem"><h2 class="cartao-titulo">' + tr('Sem fornecedor') + '</h2><p class="mudo pequeno">' + tr('Nenhum fornecedor cadastrado fornece estas etapas:') + ' ') +
        esc(Array.from(new Set(l.sem.map((g) => g.item.etapa))).join(', ')) + (tr('. Marque as etapas no fornecedor, em') + ' <a href="#/settings/contatos/fornecedor">' + tr('Settings › Contatos') + '</a>.</p>') +
        '<div class="tabela-rolagem">' + htmlTabelaCotacao(l.sem) + '</div></section>' : ''),
  });
}

/* O documento em A4 para o fornecedor. */
export function telaImpressaoCotacao(id, fornecedorId) {
  const p = projeto(id);
  const f = contato(fornecedorId);
  const g = listaDeCotacao(id).grupos.find((x) => x.fornecedor.id === fornecedorId);
  return barraImpressao('#/measure/projeto/' + id + '/cotacao', (tr('Pedido de cotação ·') + ' ') + f.nome) +
    '<div class="pdf-folha"><article class="doc">' +
      htmlCabecalho(tr('Pedido de cotação'), [(tr('Data:') + ' ') + dataCurta(hoje()), (tr('Responder até:') + ' <b>') + dataCurta(prazoResposta(p)) + '</b>']) +
      '<section class="doc-partes">' + htmlPara(tr('Para'), f) + htmlObra(p) + '</section>' +
      ('<p class="doc-texto">' + tr('Pedimos o seu preço para os materiais abaixo, na unidade indicada. Por favor, preencha o preço unitário e o total de cada item.') + '</p>') +
      htmlTabelaCotacao(g ? g.itens : []) +
      ('<div class="doc-rodape-tabela"><span>' + tr('Subtotal') + '</span><span class="doc-branco"></span><span>' + tr('Frete') + '</span><span class="doc-branco"></span><span>' + tr('Total') + '</span><span class="doc-branco"></span></div>') +
      (obsCotacao(p) ? ('<section class="doc-secao"><h2>' + tr('Observações') + '</h2><p class="doc-pre">') + esc(obsCotacao(p)) + '</p></section>' : '') +
      ('<footer class="doc-fim"><span>' + tr('Contato:') + ' ') + esc(quem()) + ' · ' + esc(empresa().email || '') + ('</span><span>' + tr('Gerado no KORbuild Measure') + '</span></footer>') +
    '</article></div>';
}

/* Texto do e-mail (no protótipo não há servidor: o e-mail abre pronto no programa de e-mail da pessoa). */
function emailCotacao(p, f, g) {
  const e = empresa();
  const linhas = g.itens.map((x) => '- ' + qtd(x.total) + ' ' + x.item.unidade + ' · ' + x.item.nome + (x.item.codigo ? ' (' + x.item.codigo + ')' : ''));
  const corpo = [tr('Olá') + (f.pessoa ? ', ' + f.pessoa : '') + ',', '',
    (tr('Pedimos o seu preço para os materiais abaixo, da obra') + ' ') + p.nome + ' (' + enderecoDoProjeto(p) + '):', '', ...linhas, '',
    (tr('Por favor, responda até') + ' ') + dataCurta(prazoResposta(p)) + (' ' + tr('com o preço unitário, o prazo de entrega e se inclui o frete.')),
    obsCotacao(p) ? '' : null, obsCotacao(p) || null, '', tr('Obrigado,'), quem(), e.nome, e.telefone || ''].filter((x) => x !== null);
  return 'mailto:' + encodeURIComponent(f.email) + '?subject=' + encodeURIComponent((tr('Pedido de cotação ·') + ' ') + p.nome + ' · ' + e.nome) + '&body=' + encodeURIComponent(corpo.join('\n'));
}

/* ---------- Proposta ---------- */

/* Uma linha de escopo por etapa (cost code) do projeto, com os materiais como detalhe. O preço de cada linha
 * é digitado (valor fechado); as linhas guardadas mantêm o preço quando as quantidades mudam. */
export function linhasDaProposta(p) {
  const q = quantidadesDoProjeto(p.id);
  const salvas = (p.proposta && p.proposta.linhas) || {};
  const etapas = new Map();
  for (const g of q.porItem) {
    const e = g.item.etapa || tr('Outros');
    if (!etapas.has(e)) etapas.set(e, { etapa: e, materiais: [], horas: 0, grupos: [] });
    etapas.get(e).grupos.push(g);
    if (g.item.categoria === 'material') etapas.get(e).materiais.push(g);
    else if (g.item.categoria === 'mao-de-obra') etapas.get(e).horas += g.total;
  }
  return Array.from(etapas.values()).sort((a, b) => a.etapa.localeCompare(b.etapa)).map((x) => {
    const s = salvas[x.etapa] || {};
    // preço calculado: custo (preços com vigência de hoje) + overhead + lucro; o digitado, se houver, vale mais
    const custo = custoDe(x.grupos);
    const calculado = custo.venda > 0 ? custo.venda : null;
    const digitado = s.valor != null ? s.valor : null;
    return { ...x, custo, calculado, digitado, valor: digitado != null ? digitado : calculado, titulo: s.titulo || nomeEtapa(x.etapa), incluir: s.incluir !== false };
  });
}
function rascunho(p) {
  p.proposta = p.proposta || {};
  const r = p.proposta;
  if (r.termos == null) r.termos = empresa().termosProposta || '';
  if (r.escopo == null) r.escopo = p.descricao || '';
  if (r.validadeDias == null) r.validadeDias = 30;
  if (r.mostrarQuantidades == null) r.mostrarQuantidades = true;
  r.extras = r.extras || [];
  r.linhas = r.linhas || {};
  return r;
}
function totais(p) {
  const linhas = linhasDaProposta(p).filter((l) => l.incluir);
  const extras = rascunho(p).extras.filter((x) => x.descricao);
  const soma = linhas.reduce((t, l) => t + (l.valor || 0), 0) + extras.reduce((t, x) => t + (x.valor || 0), 0);
  const custo = linhas.reduce((t, l) => t + l.custo.custo, 0);
  return { linhas, extras, total: Math.round(soma * 100) / 100, custo: Math.round(custo * 100) / 100, semPreco: linhas.filter((l) => !l.valor), itensSemPreco: Array.from(new Set(linhas.flatMap((l) => l.custo.semPreco.map((i) => i.nome)))) };
}

export function telaProposta(id, moldura) {
  const p = projeto(id);
  const r = rascunho(p);
  const linhas = linhasDaProposta(p);
  const t = totais(p);
  const ct = contratanteDe(p);
  const versoes = p.propostas || [];
  const campoValor = (nome, valor, sugerido) => ('<span class="campo-dinheiro">' + tr('US$') + '<input type="text" inputmode="decimal" name="') + nome + '" value="' + (valor != null ? esc(numero(valor, 2)) : '') + '" placeholder="' + (sugerido != null ? esc(numero(sugerido, 2)) : '0,00') + '"></span>';
  const m = margensEm();
  const base = (l) => {
    const c = l.custo;
    const partes = [c.material ? tr('material') + ' ' + dinheiro(c.material) : '', c.imposto ? tr('imposto') + ' ' + dinheiro(c.imposto) : '', c.maoDeObra ? (tr('mão de obra') + ' ') + dinheiro(c.maoDeObra) : '', c.outros ? tr('outros') + ' ' + dinheiro(c.outros) : ''].filter(Boolean);
    return '<span class="prop-custo">' + (partes.length ? (tr('Custo') + ' ') + dinheiro(c.custo) + ' = ' + partes.join(' + ') : tr('Sem custo calculado')) + '</span>' +
      (c.semPreco.length ? ('<span class="prop-sem-preco">' + tr('Sem preço:') + ' ') + esc(c.semPreco.map((i) => i.nome).join(', ')) + '</span>' : '');
  };
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: tr('Proposta'), subtitulo: p.nome + (ct ? (' ' + tr('· para') + ' ') + ct.nome : ''),
    voltar: { href: '#/measure/projeto/' + id, rotulo: p.nome },
    acoes: '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/proposta/imprimir">' + icone('olho', 16) + (tr('Ver o documento') + '</a>') +
      '<button type="button" class="btn btn-primario btn-pequeno" data-acao="prop-emitir" data-projeto="' + id + '">' + icone('aprovacoes', 16) + (tr('Emitir proposta') + '</button></div>'),
    conteudo: '<form id="form-proposta" class="form-settings" data-projeto="' + id + '" onsubmit="return false">' +
      (ct ? '' : '<p class="aviso-info">' + icone('conta', 16) + (tr('O projeto ainda não tem contratante: escolha em Editar projeto.') + '</p>')) +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Escopo') + '</h2><textarea name="escopo" rows="2" aria-label="' + tr('Escopo') + '">') + esc(r.escopo) + '</textarea></section>' +
      ('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Itens da proposta') + '</h2>') +
        '<label class="check pequeno"><input type="checkbox" name="mostrarQuantidades"' + (r.mostrarQuantidades ? ' checked' : '') + ('> ' + tr('Mostrar as quantidades de material no documento') + '</label></div>') +
        ('<p class="mudo pequeno">' + tr('Uma linha por etapa (material e mão de obra juntos). O preço é') + ' <b>' + tr('calculado') + '</b>' + tr(': quantidades × preços do catálogo (com vigência) +') + ' ') + esc(textoMargens(m)) +
          (' (<a href="#/measure/precos">' + tr('Preços') + '</a>' + tr('). Digite outro valor quando quiser; apagar o que foi digitado volta ao calculado.') + '</p>') +
        (linhas.some((l) => l.digitado != null) ? ('<button type="button" class="link-botao pequeno" data-acao="prop-recalcular">' + tr('Usar os preços calculados em todas as linhas') + '</button>') : '') +
        (linhas.length ? ('<div class="tabela-rolagem"><table class="tabela prop-linhas"><thead><tr><th></th><th>' + tr('Etapa') + '</th><th>' + tr('Base do cálculo') + '</th><th class="num">' + tr('Preço') + '</th></tr></thead><tbody>') +
          linhas.map((l) => '<tr class="' + (l.incluir ? '' : 'prop-fora') + '"><td><input type="checkbox" name="incluir" data-etapa="' + esc(l.etapa) + '"' + (l.incluir ? ' checked' : '') + (' aria-label="' + tr('Incluir') + ' ') + esc(l.titulo) + '"></td>' +
            '<td><input type="text" name="titulo" data-etapa="' + esc(l.etapa) + '" value="' + esc(l.titulo) + ('" aria-label="' + tr('Título da linha') + '"><span class="mudo pequeno bloco">') + esc(codigoEtapa(l.etapa)) + '</span></td>' +
            '<td class="pequeno">' + (l.materiais.map((g) => qtd(g.total) + ' ' + esc(g.item.unidade) + ' ' + esc(g.item.nome)).join('<br>') || ('<span class="mudo">' + tr('sem material') + '</span>')) +
              (l.horas ? ('<span class="bloco mudo">' + tr('Mão de obra estimada:') + ' ') + qtd(l.horas) + ' h</span>' : '') + base(l) + '</td>' +
            '<td class="num">' + campoValor('valor', l.digitado, l.calculado).replace('name="valor"', 'name="valor" data-etapa="' + esc(l.etapa) + '"') +
              '<span class="prop-origem" data-etapa="' + esc(l.etapa) + '">' + (l.digitado != null ? 'digitado' + (l.calculado ? (' ' + tr('· calculado') + ' ') + dinheiro(l.calculado) : '') : l.calculado ? 'calculado' : tr('sem preço')) + '</span></td></tr>').join('') + '</tbody></table></div>'
          : ('<p class="vazio">' + tr('Meça as condições com assemblies para gerar as linhas.') + '</p>')) + '</section>' +
      ('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Outros itens') + '</h2><button type="button" class="btn btn-contorno btn-pequeno" data-acao="prop-extra">') + icone('mais', 14) + (tr('Linha') + '</button></div>') +
        ('<p class="mudo pequeno">' + tr('O que não vem da planta: mobilização, caçamba, andaime, licença…') + '</p>') +
        '<div id="prop-extras">' + r.extras.map((x, i) => '<div class="prop-extra"><input type="text" name="extra-descricao" data-i="' + i + '" value="' + esc(x.descricao) + ('" placeholder="' + tr('Descrição') + '" aria-label="' + tr('Descrição') + '">') +
          campoValor('extra-valor', x.valor).replace('name="extra-valor"', 'name="extra-valor" data-i="' + i + '"') + '<button type="button" class="link-botao" data-acao="prop-tirar-extra" data-i="' + i + ('" aria-label="' + tr('Tirar a linha') + '">✕</button></div>')).join('') + '</div></section>' +
      ('<section class="cartao prop-total"><span>' + tr('Total da proposta') + '</span><b id="prop-total">') + dinheiro(t.total) + '</b>' +
        (t.semPreco.length ? '<span class="etiqueta etiqueta-ambar">' + t.semPreco.length + (t.semPreco.length === 1 ? (' ' + tr('linha sem preço')) : (' ' + tr('linhas sem preço'))) + '</span>' : '') +
        '<span class="prop-resumo" id="prop-resumo">' + htmlResumo(t) + '</span></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Condições da proposta') + '</h2><div class="grade-campos">') +
        ('<div class="campo"><label class="rotulo-pequeno" for="prop-validade">' + tr('Validade (dias)') + '</label><input type="number" id="prop-validade" name="validadeDias" min="1" max="365" value="') + r.validadeDias + '"></div></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="prop-termos">' + tr('Termos (vêm do perfil da empresa; ajuste para esta proposta)') + '</label><textarea id="prop-termos" name="termos" rows="5">') + esc(r.termos) + '</textarea></div></section>' +
      (versoes.length ? ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Propostas emitidas') + '</h2><ul class="prop-versoes">') + versoes.slice().reverse().map((v) =>
        '<li><span><b>' + esc(v.numero) + '</b> · ' + dataCurta(v.emitidaEm.slice(0, 10)) + ' · ' + esc(v.por) + ' · <b>' + dinheiro(v.total) + '</b></span>' +
        '<span class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/proposta/imprimir/' + encodeURIComponent(v.numero) + '">PDF</a>' +
        '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="prop-email" data-projeto="' + id + '" data-numero="' + esc(v.numero) + '"' + (ct && ct.email ? '' : ' disabled') + ('>' + tr('Enviar por e-mail') + '</button></span></li>')).join('') + '</ul></section>' : '') +
    '</form>',
  });
}

/* Resumo interno (não vai para o documento): custo dos itens medidos e a margem que sobra no total. */
function htmlResumo(t) {
  const extras = t.extras.reduce((s, x) => s + (x.valor || 0), 0);
  const venda = t.total - extras;
  const margem = venda > 0 ? (venda - t.custo) / venda * 100 : 0;
  return (tr('Custo dos itens medidos') + ' <b>') + dinheiro(t.custo) + ('</b> ' + tr('· resultado sobre a venda') + ' <b class="') + (margem < 0 ? 'negativo' : '') + '">' + numero(margem, 1) + '%</b>' +
    (t.itensSemPreco.length ? ' · <span class="prop-sem-preco">' + t.itensSemPreco.length + (t.itensSemPreco.length === 1 ? (' ' + tr('item sem preço')) : (' ' + tr('itens sem preço'))) + (' ' + tr('no catálogo') + '</span>') : '');
}

/* O conteúdo congelado (ou o rascunho, para pré-visualizar). */
function dadosDaProposta(p) {
  const r = rascunho(p);
  const t = totais(p);
  const e = empresa();
  const ct = contratanteDe(p), dono = donoDe(p);
  return {
    empresa: { nome: e.nome, sigla: e.sigla, logo: e.logo, endereco: enderecoDaEmpresa(e), telefone: e.telefone, email: e.email, site: e.site, licencas: e.licencas, seguros: e.seguros },
    contratante: ct ? { nome: ct.nome, pessoa: ct.pessoa, email: ct.email, telefone: ct.telefone } : null,
    dono: dono && dono !== ct ? { nome: dono.nome } : null,
    obra: { nome: p.nome, endereco: enderecoDoProjeto(p) }, escopo: r.escopo, mostrarQuantidades: r.mostrarQuantidades,
    linhas: t.linhas.map((l) => ({ titulo: l.titulo, codigo: codigoEtapa(l.etapa), valor: l.valor || 0, materiais: l.materiais.map((g) => qtd(g.total) + ' ' + g.item.unidade + ' · ' + g.item.nome) })),
    extras: t.extras.map((x) => ({ descricao: x.descricao, valor: x.valor || 0 })),
    total: t.total, custo: t.custo, margens: textoMargens(margensEm()), validadeDias: r.validadeDias, termos: r.termos, por: quem(),
  };
}

function htmlProposta(d, numeroDoc, data) {
  const cab = (titulo, linhas) => {
    const e = d.empresa;
    return '<header class="doc-topo"><div class="doc-empresa">' + (e.logo ? '<img class="doc-logo" src="' + e.logo + '" alt="' + esc(e.nome) + '">' : '<span class="rel-logo">' + esc(e.sigla || '') + '</span>') +
      '<div><b>' + esc(e.nome) + '</b><span>' + esc(e.endereco) + '</span><span>' + esc([e.telefone, e.email, e.site].filter(Boolean).join(' · ')) + '</span></div></div>' +
      '<div class="doc-titulo"><h1>' + titulo + '</h1>' + linhas.map((l) => '<span>' + l + '</span>').join('') + '</div></header>';
  };
  const subtotalLinhas = d.linhas.reduce((t, l) => t + l.valor, 0), subtotalExtras = d.extras.reduce((t, x) => t + x.valor, 0);
  return '<article class="doc doc-proposta">' +
    cab(tr('Proposta'), [numeroDoc ? (tr('Nº') + ' <b>') + esc(numeroDoc) + '</b>' : ('<b class="doc-rascunho">' + tr('Rascunho') + '</b>'), (tr('Data:') + ' ') + dataCurta(data), (tr('Válida até:') + ' ') + dataCurta(somarDias(data, d.validadeDias))]) +
    '<section class="doc-partes">' + (d.contratante ? ('<div class="doc-bloco"><span class="doc-rotulo">' + tr('Para') + '</span><b>') + esc(d.contratante.nome) + '</b>' + (d.contratante.pessoa ? '<span>A/C ' + esc(d.contratante.pessoa) + '</span>' : '') +
      '<span>' + esc([d.contratante.email, d.contratante.telefone].filter(Boolean).join(' · ')) + '</span></div>' : '') +
      ('<div class="doc-bloco"><span class="doc-rotulo">' + tr('Obra') + '</span><b>') + esc(d.obra.nome) + '</b><span>' + esc(d.obra.endereco) + '</span>' + (d.dono ? ('<span>' + tr('Dono da obra:') + ' ') + esc(d.dono.nome) + '</span>' : '') + '</div></section>' +
    (d.escopo ? ('<section class="doc-secao"><h2>' + tr('Escopo') + '</h2><p class="doc-pre">') + esc(d.escopo) + '</p></section>' : '') +
    ('<table class="doc-tabela doc-tabela-proposta"><thead><tr><th>#</th><th>' + tr('Item') + '</th><th class="num">' + tr('Valor') + '</th></tr></thead><tbody>') +
      d.linhas.map((l, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(l.titulo) + '</b>' + (l.codigo ? ' <span class="doc-nota-inline">' + esc(l.codigo) + '</span>' : '') +
        (d.mostrarQuantidades && l.materiais.length ? '<span class="doc-nota">' + l.materiais.map(esc).join(' · ') + '</span>' : '') + ('<span class="doc-nota">' + tr('Material e mão de obra') + '</span></td><td class="num">') + dinheiro(l.valor) + '</td></tr>').join('') +
      (d.linhas.length ? ('<tr class="doc-subtotal"><td></td><td>' + tr('Subtotal dos itens medidos') + '</td><td class="num">') + dinheiro(subtotalLinhas) + '</td></tr>' : '') +
      d.extras.map((x, i) => '<tr><td>' + (d.linhas.length + i + 1) + '</td><td><b>' + esc(x.descricao) + '</b></td><td class="num">' + dinheiro(x.valor) + '</td></tr>').join('') +
      (d.extras.length ? ('<tr class="doc-subtotal"><td></td><td>' + tr('Subtotal de outros itens') + '</td><td class="num">') + dinheiro(subtotalExtras) + '</td></tr>' : '') +
      ('<tr class="doc-total"><td></td><td>' + tr('Total') + '</td><td class="num">') + dinheiro(d.total) + '</td></tr></tbody></table>' +
    (d.termos ? ('<section class="doc-secao"><h2>' + tr('Termos e condições') + '</h2><p class="doc-pre">') + esc(d.termos) + '</p></section>' : '') +
    ((d.empresa.licencas || d.empresa.seguros) ? ('<section class="doc-secao doc-duas"><div><h2>' + tr('Licenças e registros') + '</h2><p class="doc-pre">') + esc(d.empresa.licencas || '—') + ('</p></div><div><h2>' + tr('Seguros') + '</h2><p class="doc-pre">') + esc(d.empresa.seguros || '—') + '</p></div></section>' : '') +
    '<section class="doc-assinaturas"><div><span></span>' + esc(d.empresa.nome) + '<small>' + esc(d.por) + ('</small></div><div><span></span>' + tr('Aceite')) + (d.contratante ? ': ' + esc(d.contratante.nome) : '') + ('<small>' + tr('Nome, assinatura e data') + '</small></div></section>') +
    '<footer class="doc-fim"><span>' + esc(d.empresa.nome) + ('</span><span>' + tr('Gerado no KORbuild Measure') + '</span></footer></article>');
}

export function telaImpressaoProposta(id, numeroDoc) {
  const p = projeto(id);
  const v = numeroDoc ? (p.propostas || []).find((x) => x.numero === numeroDoc) : null;
  const html = v ? htmlProposta(v.dados, v.numero, v.emitidaEm.slice(0, 10)) : htmlProposta(dadosDaProposta(p), null, hoje());
  return barraImpressao('#/measure/projeto/' + id + '/proposta', v ? (tr('Proposta') + ' ') + v.numero : tr('Proposta (rascunho)')) + '<div class="pdf-folha">' + html + '</div>';
}

function barraImpressao(voltar, titulo) {
  return '<div class="pdf-barra nao-imprimir"><a class="btn btn-escuro btn-pequeno" href="' + voltar + '">' + icone('voltar', 16) + (tr('Voltar') + '</a><span>') + esc(titulo) + (' ' + tr('· A4') + '</span>') +
    '<button type="button" class="btn btn-primario btn-pequeno" data-acao="doc-imprimir" data-titulo="' + esc(titulo) + '">' + icone('baixar', 16) + (tr('Baixar PDF') + '</button></div>');
}

/* Guarda o rascunho a cada mudança no formulário. */
function lerFormProposta() {
  const form = document.getElementById('form-proposta');
  if (!form) return null;
  const p = projeto(form.dataset.projeto);
  const r = rascunho(p);
  r.escopo = form.querySelector('[name="escopo"]').value;
  r.termos = form.querySelector('[name="termos"]').value;
  r.validadeDias = Math.max(1, Math.min(365, Number(form.querySelector('[name="validadeDias"]').value) || 30));
  r.mostrarQuantidades = form.querySelector('[name="mostrarQuantidades"]').checked;
  form.querySelectorAll('[name="valor"]').forEach((el) => { (r.linhas[el.dataset.etapa] = r.linhas[el.dataset.etapa] || {}).valor = lerValor(el.value); });
  form.querySelectorAll('[name="titulo"]').forEach((el) => { (r.linhas[el.dataset.etapa] = r.linhas[el.dataset.etapa] || {}).titulo = el.value.trim() || null; });
  form.querySelectorAll('[name="incluir"]').forEach((el) => { (r.linhas[el.dataset.etapa] = r.linhas[el.dataset.etapa] || {}).incluir = el.checked; });
  form.querySelectorAll('[name="extra-descricao"]').forEach((el) => { const x = r.extras[Number(el.dataset.i)]; if (x) x.descricao = el.value.trim(); });
  form.querySelectorAll('[name="extra-valor"]').forEach((el) => { const x = r.extras[Number(el.dataset.i)]; if (x) x.valor = lerValor(el.value); });
  salvar();
  return p;
}
document.addEventListener('change', (ev) => {
  const form = ev.target.closest('#form-proposta, #form-cotacao');
  if (!form) return;
  if (form.id === 'form-cotacao') {
    const p = projeto(form.dataset.projeto);
    p.cotacao = { ...(p.cotacao || {}), responderAte: form.querySelector('[name="responderAte"]').value, observacoes: form.querySelector('[name="observacoes"]').value };
    salvar();
    return;
  }
  const p = lerFormProposta();
  const t = totais(p);
  const alvo = document.getElementById('prop-total');
  if (alvo) alvo.textContent = dinheiro(t.total);
  const resumo = document.getElementById('prop-resumo');
  if (resumo) resumo.innerHTML = htmlResumo(t);
  for (const l of linhasDaProposta(p)) {
    const el = document.querySelector('.prop-origem[data-etapa="' + CSS.escape(l.etapa) + '"]');
    if (el) el.textContent = l.digitado != null ? 'digitado' + (l.calculado ? (' ' + tr('· calculado') + ' ') + dinheiro(l.calculado) : '') : l.calculado ? 'calculado' : tr('sem preço');
  }
  if (ev.target.name === 'incluir') ev.target.closest('tr').classList.toggle('prop-fora', !ev.target.checked);
  // o valor digitado volta formatado
  if (ev.target.name === 'valor' || ev.target.name === 'extra-valor') { const v = lerValor(ev.target.value); ev.target.value = v != null ? numero(v, 2) : ''; }
});

/* Abre o e-mail pronto no programa de e-mail (no protótipo não há envio pelo servidor). */
function abrirEmail(url) {
  window.kbtUltimoEmail = url; // para conferir nos testes
  const a = document.createElement('a');
  a.href = url;
  document.body.appendChild(a); a.click(); a.remove();
}

export const acoesRelatorios = {
  'cot-email'(el) {
    const p = projeto(el.dataset.projeto);
    const g = listaDeCotacao(p.id).grupos.find((x) => x.fornecedor.id === el.dataset.fornecedor);
    if (!g) return;
    abrirEmail(emailCotacao(p, g.fornecedor, g));
    p.cotacao = p.cotacao || {};
    p.cotacao.envios = (p.cotacao.envios || []).concat([{ fornecedorId: g.fornecedor.id, em: new Date().toISOString(), por: quem(), itens: g.itens.map((x) => ({ itemId: x.item.id, quantidade: x.total })) }]);
    salvar();
    toast((tr('E-mail para') + ' ') + g.fornecedor.nome + (' ' + tr('aberto no seu programa de e-mail. Se quiser, anexe o PDF.')));
    app.desenhar();
  },
  'prop-recalcular'() {
    const p = lerFormProposta();
    for (const v of Object.values(rascunho(p).linhas)) v.valor = null;
    salvar();
    toast(tr('Preços calculados em todas as linhas.'));
    app.desenhar();
  },
  'prop-extra'() {
    const p = lerFormProposta();
    rascunho(p).extras.push({ descricao: '', valor: null });
    salvar();
    app.desenhar();
  },
  'prop-tirar-extra'(el) {
    const p = lerFormProposta();
    rascunho(p).extras.splice(Number(el.dataset.i), 1);
    salvar();
    app.desenhar();
  },
  async 'prop-emitir'(el) {
    const p = lerFormProposta() || projeto(el.dataset.projeto);
    const t = totais(p);
    if (!contratanteDe(p)) { toast(tr('Escolha o contratante do projeto antes de emitir.')); return; }
    if (!t.linhas.length && !t.extras.length) { toast(tr('A proposta não tem itens.')); return; }
    if (t.semPreco.length) { toast((tr('Falta o preço de:') + ' ') + t.semPreco.map((l) => l.titulo).join(', ') + tr('. Ou tire a linha da proposta.')); return; }
    if (t.extras.some((x) => !x.valor)) { toast(tr('Falta o valor de um dos outros itens.')); return; }
    if (!(await confirmar((tr('Emitir a proposta de') + ' ') + dinheiro(t.total) + '?', tr('Ela recebe um número e fica congelada: mudanças no projeto depois não alteram o que foi enviado.'), tr('Emitir')))) return;
    const m = estado().measure;
    m.seqPropostas = (m.seqPropostas || 0) + 1;
    const numeroDoc = 'P-' + hoje().slice(0, 4) + '-' + String(m.seqPropostas).padStart(3, '0');
    p.propostas = (p.propostas || []).concat([{ numero: numeroDoc, emitidaEm: new Date().toISOString(), por: quem(), total: t.total, dados: dadosDaProposta(p) }]);
    if (p.situacao === 'orcamento') p.situacao = 'enviada';
    salvar();
    toast((tr('Proposta') + ' ') + numeroDoc + (' ' + tr('emitida. Baixe o PDF ou envie por e-mail.')));
    app.desenhar();
  },
  'prop-email'(el) {
    const p = projeto(el.dataset.projeto);
    const v = (p.propostas || []).find((x) => x.numero === el.dataset.numero);
    const ct = contratanteDe(p);
    if (!v || !ct || !ct.email) return;
    const e = empresa();
    const corpo = [tr('Olá') + (ct.pessoa ? ', ' + ct.pessoa : '') + ',', '', (tr('Segue a nossa proposta') + ' ') + v.numero + ' ' + tr('para') + ' ' + p.nome + ' (' + enderecoDoProjeto(p) + '):',
      (tr('Total:') + ' ') + dinheiro(v.total) + (tr(', válida por') + ' ') + tn(v.dados.validadeDias, '{n} dia.', '{n} dias.'), '', tr('O PDF vai em anexo. Ficamos à disposição.'), '', quem(), e.nome, e.telefone || ''];
    abrirEmail('mailto:' + encodeURIComponent(ct.email) + '?subject=' + encodeURIComponent((tr('Proposta') + ' ') + v.numero + ' · ' + p.nome + ' · ' + e.nome) + '&body=' + encodeURIComponent(corpo.join('\n')));
    toast((tr('E-mail para') + ' ') + ct.nome + (' ' + tr('aberto. Anexe o PDF da proposta.')));
  },
  'doc-imprimir'(el) {
    const antes = document.title;
    document.title = el.dataset.titulo + ' - ' + empresa().nome;
    window.print();
    setTimeout(() => { document.title = antes; }, 1000);
  },
};
