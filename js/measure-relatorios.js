/* KORbuild Measure — relatórios que saem do projeto (docs/measure.md §Relatórios):
 *  - LISTA PARA COTAÇÃO: os materiais, na unidade de compra, separados por fornecedor (pelas etapas que
 *    cada um fornece), sem preço e com as colunas em branco para o fornecedor preencher.
 *  - PROPOSTA: logo e dados da empresa, contratante, escopo por etapa com o preço de cada linha (valor
 *    fechado, como a prestadora orça), linhas extras, subtotais, total e termos. Emitida, vira uma
 *    versão congelada e numerada: mudar o projeto depois não muda o que foi enviado. */

import { esc, toast, hoje, somarDias, dataCurta, confirmar } from './util.js';
import { estado, salvar } from './armazem.js';
import { usuarioAtual } from './plataforma.js';
import { icone } from './icones.js';
import { numero } from './imperial.js';
import { dinheiro } from './crew.js';
import { projeto, quantidadesDoProjeto, enderecoDoProjeto } from './measure.js';
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
  return '<div class="doc-bloco"><span class="doc-rotulo">Obra</span><b>' + esc(p.nome) + '</b><span>' + esc(enderecoDoProjeto(p)) + '</span>' +
    (donoDe(p) && donoDe(p) !== contratanteDe(p) ? '<span>Dono da obra: ' + esc(donoDe(p).nome) + '</span>' : '') + '</div>';
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
  return '<table class="doc-tabela"><thead><tr><th>#</th><th>Código</th><th>Descrição</th><th class="num">Quantidade</th><th>Unidade</th><th class="num doc-branco">Preço unitário</th><th class="num doc-branco">Total</th></tr></thead><tbody>' +
    itens.map((g, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(g.item.codigo) + '</td><td><b>' + esc(g.item.nome) + '</b>' + (g.item.nota ? '<span class="doc-nota">' + esc(g.item.nota) + '</span>' : '') + '</td>' +
      '<td class="num"><b>' + qtd(g.total) + '</b></td><td>' + esc(g.item.unidade) + '</td><td class="doc-branco"></td><td class="doc-branco"></td></tr>').join('') + '</tbody></table>';
}

function prazoResposta(p) { return (p.cotacao && p.cotacao.responderAte) || somarDias(hoje(), 3); }
function obsCotacao(p) { return (p.cotacao && p.cotacao.observacoes) != null ? p.cotacao.observacoes : 'Entrega na obra. Informe o prazo de entrega e se o preço inclui o frete.'; }
const envios = (p, fornecedorId) => ((p.cotacao && p.cotacao.envios) || []).filter((x) => x.fornecedorId === fornecedorId);

export function telaCotacao(id, moldura) {
  const p = projeto(id);
  const l = listaDeCotacao(id);
  const grupo = (g) => {
    const f = g.fornecedor;
    const ultimos = envios(p, f.id);
    return '<section class="cartao cot-fornecedor"><div class="cartao-cabeca"><div><h2 class="cartao-titulo">' + esc(f.nome) + '</h2>' +
        '<span class="mudo pequeno">' + esc([f.pessoa, f.email].filter(Boolean).join(' · ') || 'sem e-mail cadastrado') + ' · ' + g.itens.length + (g.itens.length === 1 ? ' item' : ' itens') + '</span>' +
        (ultimos.length ? '<span class="etiqueta etiqueta-verde">e-mail preparado em ' + dataCurta(ultimos[ultimos.length - 1].em.slice(0, 10)) + '</span>' : '') + '</div>' +
        '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/cotacao/' + f.id + '/imprimir">' + icone('baixar', 16) + 'PDF</a>' +
        '<button type="button" class="btn btn-primario btn-pequeno" data-acao="cot-email" data-projeto="' + id + '" data-fornecedor="' + f.id + '"' + (f.email ? '' : ' disabled title="Cadastre o e-mail do fornecedor"') + '>' + icone('link', 16) + 'Enviar por e-mail</button></div></div>' +
      '<div class="tabela-rolagem">' + htmlTabelaCotacao(g.itens) + '</div></section>';
  };
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: 'Lista para cotação', subtitulo: p.nome + ' · materiais na unidade de compra, sem preço, separados por fornecedor',
    voltar: { href: '#/measure/projeto/' + id, rotulo: p.nome },
    conteudo: (l.total ? '' : '<p class="aviso-info">' + icone('measure', 16) + 'Ainda não há materiais: meça as condições que têm assemblies.</p>') +
      '<section class="cartao"><form id="form-cotacao" class="form-settings" data-projeto="' + id + '" onsubmit="return false"><div class="grade-campos">' +
        '<div class="campo"><label class="rotulo-pequeno" for="cot-ate">Responder até</label><input type="date" id="cot-ate" name="responderAte" value="' + prazoResposta(p) + '"></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="cot-entrega">Entregar em</label><input type="text" id="cot-entrega" value="' + esc(enderecoDoProjeto(p)) + '" disabled></div></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="cot-obs">Observações para o fornecedor</label><textarea id="cot-obs" name="observacoes" rows="2">' + esc(obsCotacao(p)) + '</textarea></div></form>' +
        '<p class="mudo pequeno">Cada fornecedor recebe só os itens das etapas que ele fornece (Settings › Contatos). Quantidades já com perda e arredondadas para a compra.</p></section>' +
      l.grupos.map(grupo).join('') +
      (l.sem.length ? '<section class="cartao cot-sem"><h2 class="cartao-titulo">Sem fornecedor</h2><p class="mudo pequeno">Nenhum fornecedor cadastrado fornece estas etapas: ' +
        esc(Array.from(new Set(l.sem.map((g) => g.item.etapa))).join(', ')) + '. Marque as etapas no fornecedor, em <a href="#/settings/contatos/fornecedor">Settings › Contatos</a>.</p>' +
        '<div class="tabela-rolagem">' + htmlTabelaCotacao(l.sem) + '</div></section>' : ''),
  });
}

/* O documento em A4 para o fornecedor. */
export function telaImpressaoCotacao(id, fornecedorId) {
  const p = projeto(id);
  const f = contato(fornecedorId);
  const g = listaDeCotacao(id).grupos.find((x) => x.fornecedor.id === fornecedorId);
  return barraImpressao('#/measure/projeto/' + id + '/cotacao', 'Pedido de cotação · ' + f.nome) +
    '<div class="pdf-folha"><article class="doc">' +
      htmlCabecalho('Pedido de cotação', ['Data: ' + dataCurta(hoje()), 'Responder até: <b>' + dataCurta(prazoResposta(p)) + '</b>']) +
      '<section class="doc-partes">' + htmlPara('Para', f) + htmlObra(p) + '</section>' +
      '<p class="doc-texto">Pedimos o seu preço para os materiais abaixo, na unidade indicada. Por favor, preencha o preço unitário e o total de cada item.</p>' +
      htmlTabelaCotacao(g ? g.itens : []) +
      '<div class="doc-rodape-tabela"><span>Subtotal</span><span class="doc-branco"></span><span>Frete</span><span class="doc-branco"></span><span>Total</span><span class="doc-branco"></span></div>' +
      (obsCotacao(p) ? '<section class="doc-secao"><h2>Observações</h2><p class="doc-pre">' + esc(obsCotacao(p)) + '</p></section>' : '') +
      '<footer class="doc-fim"><span>Contato: ' + esc(quem()) + ' · ' + esc(empresa().email || '') + '</span><span>Gerado no KORbuild Measure</span></footer>' +
    '</article></div>';
}

/* Texto do e-mail (no protótipo não há servidor: o e-mail abre pronto no programa de e-mail da pessoa). */
function emailCotacao(p, f, g) {
  const e = empresa();
  const linhas = g.itens.map((x) => '- ' + qtd(x.total) + ' ' + x.item.unidade + ' · ' + x.item.nome + (x.item.codigo ? ' (' + x.item.codigo + ')' : ''));
  const corpo = ['Olá' + (f.pessoa ? ', ' + f.pessoa : '') + ',', '',
    'Pedimos o seu preço para os materiais abaixo, da obra ' + p.nome + ' (' + enderecoDoProjeto(p) + '):', '', ...linhas, '',
    'Por favor, responda até ' + dataCurta(prazoResposta(p)) + ' com o preço unitário, o prazo de entrega e se inclui o frete.',
    obsCotacao(p) ? '' : null, obsCotacao(p) || null, '', 'Obrigado,', quem(), e.nome, e.telefone || ''].filter((x) => x !== null);
  return 'mailto:' + encodeURIComponent(f.email) + '?subject=' + encodeURIComponent('Pedido de cotação · ' + p.nome + ' · ' + e.nome) + '&body=' + encodeURIComponent(corpo.join('\n'));
}

/* ---------- Proposta ---------- */

/* Uma linha de escopo por etapa (cost code) do projeto, com os materiais como detalhe. O preço de cada linha
 * é digitado (valor fechado); as linhas guardadas mantêm o preço quando as quantidades mudam. */
export function linhasDaProposta(p) {
  const q = quantidadesDoProjeto(p.id);
  const salvas = (p.proposta && p.proposta.linhas) || {};
  const etapas = new Map();
  for (const g of q.porItem) {
    const e = g.item.etapa || 'Outros';
    if (!etapas.has(e)) etapas.set(e, { etapa: e, materiais: [], horas: 0 });
    if (g.item.categoria === 'material') etapas.get(e).materiais.push(g);
    else if (g.item.categoria === 'mao-de-obra') etapas.get(e).horas += g.total;
  }
  return Array.from(etapas.values()).sort((a, b) => a.etapa.localeCompare(b.etapa)).map((x) => {
    const s = salvas[x.etapa] || {};
    return { ...x, titulo: s.titulo || nomeEtapa(x.etapa), valor: s.valor != null ? s.valor : null, incluir: s.incluir !== false };
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
  return { linhas, extras, total: Math.round(soma * 100) / 100, semPreco: linhas.filter((l) => !l.valor) };
}

export function telaProposta(id, moldura) {
  const p = projeto(id);
  const r = rascunho(p);
  const linhas = linhasDaProposta(p);
  const t = totais(p);
  const ct = contratanteDe(p);
  const versoes = p.propostas || [];
  const campoValor = (nome, valor) => '<span class="campo-dinheiro">US$<input type="text" inputmode="decimal" name="' + nome + '" value="' + (valor != null ? esc(numero(valor, 2)) : '') + '" placeholder="0,00"></span>';
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: 'Proposta', subtitulo: p.nome + (ct ? ' · para ' + ct.nome : ''),
    voltar: { href: '#/measure/projeto/' + id, rotulo: p.nome },
    acoes: '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/proposta/imprimir">' + icone('olho', 16) + 'Ver o documento</a>' +
      '<button type="button" class="btn btn-primario btn-pequeno" data-acao="prop-emitir" data-projeto="' + id + '">' + icone('aprovacoes', 16) + 'Emitir proposta</button></div>',
    conteudo: '<form id="form-proposta" class="form-settings" data-projeto="' + id + '" onsubmit="return false">' +
      (ct ? '' : '<p class="aviso-info">' + icone('conta', 16) + 'O projeto ainda não tem contratante: escolha em Editar projeto.</p>') +
      '<section class="cartao"><h2 class="cartao-titulo">Escopo</h2><textarea name="escopo" rows="2" aria-label="Escopo">' + esc(r.escopo) + '</textarea></section>' +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Itens da proposta</h2>' +
        '<label class="check pequeno"><input type="checkbox" name="mostrarQuantidades"' + (r.mostrarQuantidades ? ' checked' : '') + '> Mostrar as quantidades de material no documento</label></div>' +
        '<p class="mudo pequeno">Uma linha por etapa do projeto (material e mão de obra juntos). Digite o preço fechado de cada uma; as quantidades e as horas são a base para o seu preço.</p>' +
        (linhas.length ? '<div class="tabela-rolagem"><table class="tabela prop-linhas"><thead><tr><th></th><th>Etapa</th><th>Base do cálculo</th><th class="num">Preço</th></tr></thead><tbody>' +
          linhas.map((l) => '<tr class="' + (l.incluir ? '' : 'prop-fora') + '"><td><input type="checkbox" name="incluir" data-etapa="' + esc(l.etapa) + '"' + (l.incluir ? ' checked' : '') + ' aria-label="Incluir ' + esc(l.titulo) + '"></td>' +
            '<td><input type="text" name="titulo" data-etapa="' + esc(l.etapa) + '" value="' + esc(l.titulo) + '" aria-label="Título da linha"><span class="mudo pequeno bloco">' + esc(codigoEtapa(l.etapa)) + '</span></td>' +
            '<td class="pequeno">' + (l.materiais.map((g) => qtd(g.total) + ' ' + esc(g.item.unidade) + ' ' + esc(g.item.nome)).join('<br>') || '<span class="mudo">sem material</span>') +
              (l.horas ? '<span class="bloco mudo">Mão de obra estimada: ' + qtd(l.horas) + ' h</span>' : '') + '</td>' +
            '<td class="num">' + campoValor('valor', l.valor).replace('name="valor"', 'name="valor" data-etapa="' + esc(l.etapa) + '"') + '</td></tr>').join('') + '</tbody></table></div>'
          : '<p class="vazio">Meça as condições com assemblies para gerar as linhas.</p>') + '</section>' +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Outros itens</h2><button type="button" class="btn btn-contorno btn-pequeno" data-acao="prop-extra">' + icone('mais', 14) + 'Linha</button></div>' +
        '<p class="mudo pequeno">O que não vem da planta: mobilização, caçamba, andaime, licença…</p>' +
        '<div id="prop-extras">' + r.extras.map((x, i) => '<div class="prop-extra"><input type="text" name="extra-descricao" data-i="' + i + '" value="' + esc(x.descricao) + '" placeholder="Descrição" aria-label="Descrição">' +
          campoValor('extra-valor', x.valor).replace('name="extra-valor"', 'name="extra-valor" data-i="' + i + '"') + '<button type="button" class="link-botao" data-acao="prop-tirar-extra" data-i="' + i + '" aria-label="Tirar a linha">✕</button></div>').join('') + '</div></section>' +
      '<section class="cartao prop-total"><span>Total da proposta</span><b id="prop-total">' + dinheiro(t.total) + '</b>' +
        (t.semPreco.length ? '<span class="etiqueta etiqueta-ambar">' + t.semPreco.length + (t.semPreco.length === 1 ? ' linha sem preço' : ' linhas sem preço') + '</span>' : '') + '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Condições</h2><div class="grade-campos">' +
        '<div class="campo"><label class="rotulo-pequeno" for="prop-validade">Validade (dias)</label><input type="number" id="prop-validade" name="validadeDias" min="1" max="365" value="' + r.validadeDias + '"></div></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="prop-termos">Termos (vêm do perfil da empresa; ajuste para esta proposta)</label><textarea id="prop-termos" name="termos" rows="5">' + esc(r.termos) + '</textarea></div></section>' +
      (versoes.length ? '<section class="cartao"><h2 class="cartao-titulo">Propostas emitidas</h2><ul class="prop-versoes">' + versoes.slice().reverse().map((v) =>
        '<li><span><b>' + esc(v.numero) + '</b> · ' + dataCurta(v.emitidaEm.slice(0, 10)) + ' · ' + esc(v.por) + ' · <b>' + dinheiro(v.total) + '</b></span>' +
        '<span class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + id + '/proposta/imprimir/' + encodeURIComponent(v.numero) + '">PDF</a>' +
        '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="prop-email" data-projeto="' + id + '" data-numero="' + esc(v.numero) + '"' + (ct && ct.email ? '' : ' disabled') + '>Enviar por e-mail</button></span></li>').join('') + '</ul></section>' : '') +
    '</form>',
  });
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
    total: t.total, validadeDias: r.validadeDias, termos: r.termos, por: quem(),
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
    cab('Proposta', [numeroDoc ? 'Nº <b>' + esc(numeroDoc) + '</b>' : '<b class="doc-rascunho">Rascunho</b>', 'Data: ' + dataCurta(data), 'Válida até: ' + dataCurta(somarDias(data, d.validadeDias))]) +
    '<section class="doc-partes">' + (d.contratante ? '<div class="doc-bloco"><span class="doc-rotulo">Para</span><b>' + esc(d.contratante.nome) + '</b>' + (d.contratante.pessoa ? '<span>A/C ' + esc(d.contratante.pessoa) + '</span>' : '') +
      '<span>' + esc([d.contratante.email, d.contratante.telefone].filter(Boolean).join(' · ')) + '</span></div>' : '') +
      '<div class="doc-bloco"><span class="doc-rotulo">Obra</span><b>' + esc(d.obra.nome) + '</b><span>' + esc(d.obra.endereco) + '</span>' + (d.dono ? '<span>Dono da obra: ' + esc(d.dono.nome) + '</span>' : '') + '</div></section>' +
    (d.escopo ? '<section class="doc-secao"><h2>Escopo</h2><p class="doc-pre">' + esc(d.escopo) + '</p></section>' : '') +
    '<table class="doc-tabela doc-tabela-proposta"><thead><tr><th>#</th><th>Item</th><th class="num">Valor</th></tr></thead><tbody>' +
      d.linhas.map((l, i) => '<tr><td>' + (i + 1) + '</td><td><b>' + esc(l.titulo) + '</b>' + (l.codigo ? ' <span class="doc-nota-inline">' + esc(l.codigo) + '</span>' : '') +
        (d.mostrarQuantidades && l.materiais.length ? '<span class="doc-nota">' + l.materiais.map(esc).join(' · ') + '</span>' : '') + '<span class="doc-nota">Material e mão de obra</span></td><td class="num">' + dinheiro(l.valor) + '</td></tr>').join('') +
      (d.linhas.length ? '<tr class="doc-subtotal"><td></td><td>Subtotal dos itens medidos</td><td class="num">' + dinheiro(subtotalLinhas) + '</td></tr>' : '') +
      d.extras.map((x, i) => '<tr><td>' + (d.linhas.length + i + 1) + '</td><td><b>' + esc(x.descricao) + '</b></td><td class="num">' + dinheiro(x.valor) + '</td></tr>').join('') +
      (d.extras.length ? '<tr class="doc-subtotal"><td></td><td>Subtotal de outros itens</td><td class="num">' + dinheiro(subtotalExtras) + '</td></tr>' : '') +
      '<tr class="doc-total"><td></td><td>Total</td><td class="num">' + dinheiro(d.total) + '</td></tr></tbody></table>' +
    (d.termos ? '<section class="doc-secao"><h2>Termos e condições</h2><p class="doc-pre">' + esc(d.termos) + '</p></section>' : '') +
    ((d.empresa.licencas || d.empresa.seguros) ? '<section class="doc-secao doc-duas"><div><h2>Licenças e registros</h2><p class="doc-pre">' + esc(d.empresa.licencas || '—') + '</p></div><div><h2>Seguros</h2><p class="doc-pre">' + esc(d.empresa.seguros || '—') + '</p></div></section>' : '') +
    '<section class="doc-assinaturas"><div><span></span>' + esc(d.empresa.nome) + '<small>' + esc(d.por) + '</small></div><div><span></span>Aceite' + (d.contratante ? ': ' + esc(d.contratante.nome) : '') + '<small>Nome, assinatura e data</small></div></section>' +
    '<footer class="doc-fim"><span>' + esc(d.empresa.nome) + '</span><span>Gerado no KORbuild Measure</span></footer></article>';
}

export function telaImpressaoProposta(id, numeroDoc) {
  const p = projeto(id);
  const v = numeroDoc ? (p.propostas || []).find((x) => x.numero === numeroDoc) : null;
  const html = v ? htmlProposta(v.dados, v.numero, v.emitidaEm.slice(0, 10)) : htmlProposta(dadosDaProposta(p), null, hoje());
  return barraImpressao('#/measure/projeto/' + id + '/proposta', v ? 'Proposta ' + v.numero : 'Proposta (rascunho)') + '<div class="pdf-folha">' + html + '</div>';
}

function barraImpressao(voltar, titulo) {
  return '<div class="pdf-barra nao-imprimir"><a class="btn btn-escuro btn-pequeno" href="' + voltar + '">' + icone('voltar', 16) + 'Voltar</a><span>' + esc(titulo) + ' · A4</span>' +
    '<button type="button" class="btn btn-primario btn-pequeno" data-acao="doc-imprimir" data-titulo="' + esc(titulo) + '">' + icone('baixar', 16) + 'Baixar PDF</button></div>';
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
    toast('E-mail para ' + g.fornecedor.nome + ' aberto no seu programa de e-mail. Se quiser, anexe o PDF.');
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
    if (!contratanteDe(p)) { toast('Escolha o contratante do projeto antes de emitir.'); return; }
    if (!t.linhas.length && !t.extras.length) { toast('A proposta não tem itens.'); return; }
    if (t.semPreco.length) { toast('Falta o preço de: ' + t.semPreco.map((l) => l.titulo).join(', ') + '. Ou tire a linha da proposta.'); return; }
    if (t.extras.some((x) => !x.valor)) { toast('Falta o valor de um dos outros itens.'); return; }
    if (!(await confirmar('Emitir a proposta de ' + dinheiro(t.total) + '?', 'Ela recebe um número e fica congelada: mudanças no projeto depois não alteram o que foi enviado.', 'Emitir'))) return;
    const m = estado().measure;
    m.seqPropostas = (m.seqPropostas || 0) + 1;
    const numeroDoc = 'P-' + hoje().slice(0, 4) + '-' + String(m.seqPropostas).padStart(3, '0');
    p.propostas = (p.propostas || []).concat([{ numero: numeroDoc, emitidaEm: new Date().toISOString(), por: quem(), total: t.total, dados: dadosDaProposta(p) }]);
    if (p.situacao === 'orcamento') p.situacao = 'enviada';
    salvar();
    toast('Proposta ' + numeroDoc + ' emitida. Baixe o PDF ou envie por e-mail.');
    app.desenhar();
  },
  'prop-email'(el) {
    const p = projeto(el.dataset.projeto);
    const v = (p.propostas || []).find((x) => x.numero === el.dataset.numero);
    const ct = contratanteDe(p);
    if (!v || !ct || !ct.email) return;
    const e = empresa();
    const corpo = ['Olá' + (ct.pessoa ? ', ' + ct.pessoa : '') + ',', '', 'Segue a nossa proposta ' + v.numero + ' para ' + p.nome + ' (' + enderecoDoProjeto(p) + '):',
      'Total: ' + dinheiro(v.total) + ', válida por ' + v.dados.validadeDias + ' dias.', '', 'O PDF vai em anexo. Ficamos à disposição.', '', quem(), e.nome, e.telefone || ''];
    abrirEmail('mailto:' + encodeURIComponent(ct.email) + '?subject=' + encodeURIComponent('Proposta ' + v.numero + ' · ' + p.nome + ' · ' + e.nome) + '&body=' + encodeURIComponent(corpo.join('\n')));
    toast('E-mail para ' + ct.nome + ' aberto. Anexe o PDF da proposta.');
  },
  'doc-imprimir'(el) {
    const antes = document.title;
    document.title = el.dataset.titulo + ' - ' + empresa().nome;
    window.print();
    setTimeout(() => { document.title = antes; }, 1000);
  },
};
