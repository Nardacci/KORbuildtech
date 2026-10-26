/* KORbuild — telas da contratante nas concorrências (docs/concorrencias.md §3.1, fatia 2):
 * lista, nova concorrência (rascunho e envio), a página com Convidados, Comparar e Detalhes,
 * prorrogar, convidar mais, fechar e cancelar. O motor e as regras estão em concorrencias.js. */

import { PRIMEIRA_VERSAO } from './versao.js';
import { esc, toast, abrirDialogo, confirmar, dataCurta, dataHora, isoDoDia, diasEntre, somarDias, hoje } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar, obra as acharObra } from './armazem.js';
import { usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { contatosCom, contatos, salvarContato } from './contatos.js';
import { salvarProjeto, projeto as acharProjeto, folhasDo, projetos as todosProjetos } from './measure.js';
import { htmlEditorRico, valorDoEditor, escopoHtml, escopoTexto, escopoDeListas } from './texto-rico.js';
import { importarPdfNoProjeto } from './measure-telas.js';
import { bytesDaPlanta } from './measure-oficial.js';
import { lerFoto } from './armazem.js';
import { cliente } from './conta.js';
import { dinheiro } from './crew.js';
import {
  SITUACOES, SITUACOES_CONVITE, MOSTRAR_ORCAMENTO, QUARTEIRIZACAO, enviadas, concorrenciaEnviada, situacaoDe, ultimaProposta,
  comparar, salvarRascunho, enviar, pendenciasDeEnvio, prorrogar, convidarMais, fechar, cancelar, contaDoContato,
  recebidas, recebida, marcarVisto, responder, enviarProposta, vincularProjeto,
  canalDaContratante, canalRecebido, escreverComoConvidada, escreverComoContratante, perguntasSemResposta,
  concorrenciaPai, pedidosDeQuarteirizacao, decidirQuarteirizacao, porToken, canalPorToken,
} from './concorrencias.js';
import { margensEm, precoDeVenda } from './precos.js';
import { lerValor } from './measure-relatorios.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarConcorrencias(funcoes) { app = { ...app, ...funcoes }; }

const quem = () => (usuarioAtual() || {}).nome || '';
/* 1ª versão: o menu tem um item só, Bids; dentro dele, as abas Sent (eu convido) e Received (me convidaram). */
const ativoBids = (antigo) => (PRIMEIRA_VERSAO ? 'bids' : antigo);
function abasBids(ativa) {
  if (!PRIMEIRA_VERSAO || !podeGerir() || !podeResponder()) return '';
  return '<nav class="abas-sublinhadas" aria-label="' + tr('Licitações') + '"><a href="#/daily/concorrencias"' + (ativa === 'enviadas' ? ' class="ativa" aria-current="page"' : '') + '>' + tr('Enviadas') + '</a>' +
    '<a href="#/measure/convites"' + (ativa === 'recebidas' ? ' class="ativa" aria-current="page"' : '') + '>' + tr('Recebidas') + (convitesPendentes() ? ' <span class="mz-contagem">' + convitesPendentes() + '</span>' : '') + '</a></nav>';
}
export const podeGerir = () => pode(usuarioAtual(), 'concorrencias.gerir');
export const podeResponder = () => pode(usuarioAtual(), 'concorrencias.responder') && (estado().empresa.modulos || []).includes('measure');
const campo = (id, rotulo, html, classe) => '<div class="campo' + (classe ? ' ' + classe : '') + '"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + '</div>';
const nomeObra = (id) => (acharObra(id) || {}).nome || '—';
/* De onde saiu: a obra, ou o projeto do Measure (cotando antes da própria proposta). */
const doProjeto = (c) => c.origem && c.origem.tipo === 'projeto';
const nomeOrigem = (c) => (doProjeto(c) && !c.obraId ? tr('Projeto {nome}', { nome: (acharProjeto(c.origem.id) || {}).nome || '—' }) : nomeObra(c.obraId));
const etiqueta = (s) => '<span class="etiqueta ' + SITUACOES[s].classe + '">' + SITUACOES[s].nome + '</span>';
const instante = (dh) => new Date(dh).getTime();

/* "24/10 às 18:00 · em 5 dias" */
function textoPrazo(c) {
  if (!c.prazo) return '—';
  const ts = instante(c.prazo);
  const dias = diasEntre(hoje(), isoDoDia(new Date(ts)));
  const falta = ts <= Date.now() ? tr('vencido') : dias === 0 ? tr('hoje') : tn(dias, 'em {n} dia', 'em {n} dias');
  return dataHora(ts) + ' · ' + falta;
}
function etiquetaConvite(v) {
  const classe = { vencedora: 'etiqueta-verde', proposta: 'etiqueta-azul', 'vai-cotar': 'etiqueta-azul', 'nao-vai': 'etiqueta-neutro', 'nao-escolhida': 'etiqueta-neutro', cancelado: 'etiqueta-neutro' }[v.situacao] || 'etiqueta-ambar';
  return '<span class="etiqueta ' + classe + '">' + SITUACOES_CONVITE[v.situacao] + '</span>';
}
const comoRecebe = (v) => (v.empresaId ? '<span class="etiqueta etiqueta-verde">KORbuild</span>' : '<span class="etiqueta etiqueta-neutro">' + tr('link') + '</span>');

/* ---------- Lista ---------- */

const ABAS = [['', tr('Abertas'), (s) => s === 'aberta'], ['para-fechar', tr('Para fechar'), (s) => s === 'para-fechar'], ['rascunhos', tr('Rascunhos'), (s) => s === 'rascunho'], ['fechadas', tr('Fechadas'), (s) => s === 'fechada'], ['todas', tr('Todas'), () => true]];

export function telaConcorrencias(moldura, filtro) {
  const todas = enviadas().slice().sort((a, b) => (b.criadaEm || 0) - (a.criadaEm || 0));
  const aba = ABAS.find((x) => x[0] === (filtro || '')) || ABAS[0];
  const lista = todas.filter((c) => aba[2](situacaoDe(c)));
  const abas = ABAS.filter((x) => x[0] !== 'rascunhos' || todas.some((c) => c.situacao === 'rascunho'));
  return moldura({
    ativo: ativoBids('concorrencias'), largo: true, titulo: tr('Concorrências'), subtitulo: tr('Convide prestadoras, compare as propostas e feche com a melhor'),
    acoes: '<div class="acoes-cabeca">' + (podeResponder() && !PRIMEIRA_VERSAO ? '<a class="btn btn-contorno" href="#/measure/convites">' + tr('Convites recebidos') + (convitesPendentes() ? ' <span class="mz-contagem">' + convitesPendentes() + '</span>' : '') + '</a>' : '') +
      '<a class="btn btn-primario" href="#/daily/concorrencias/nova">' + icone('mais', 18) + tr('Nova concorrência') + '</a></div>',
    conteudo: abasBids('enviadas') + '<nav class="abas-segmento" aria-label="' + tr('Filtro') + '">' + abas.map(([id, r, f]) => '<a href="#/daily/concorrencias' + (id ? '/' + id : '') + '"' + (aba[0] === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + ' <span class="mz-contagem">' + todas.filter((c) => f(situacaoDe(c))).length + '</span></a>').join('') + '</nav>' +
      (lista.length ? '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-concorrencias"><thead><tr><th>' + tr('Serviço') + '</th><th>' + tr('Obra') + '</th><th>' + tr('Prazo da proposta') + '</th><th>' + tr('Convidados') + '</th><th>' + tr('Propostas') + '</th><th>' + tr('Situação') + '</th><th>' + tr('Ações') + '</th></tr></thead><tbody>' +
        lista.map((c) => {
          const s = situacaoDe(c);
          const ativos = c.convites.filter((v) => v.situacao !== 'nao-vai');
          const vencedora = c.fechamento ? c.convites.find((v) => v.id === c.fechamento.conviteId) : null;
          return '<tr><td><a href="#/daily/concorrencias/' + c.id + '"><b>' + esc(c.servico || tr('(sem nome)')) + '</b></a></td><td>' + esc(nomeObra(c.obraId)) + '</td>' +
            '<td>' + (s === 'aberta' || s === 'para-fechar' ? textoPrazo(c) : c.prazo ? dataCurta(c.prazo.slice(0, 10)) : '—') + '</td>' +
            '<td>' + c.convites.length + '</td><td>' + tr('{n} de {total}', { n: c.convites.filter((v) => v.propostas.length).length, total: ativos.length }) + '</td>' +
            '<td>' + etiqueta(s) + (vencedora ? ' <span class="mudo pequeno">' + esc(vencedora.nome) + '</span>' : '') + '</td>' +
            '<td>' + (c.situacao === 'rascunho' ? '<a class="btn btn-contorno btn-pequeno" href="#/daily/concorrencias/' + c.id + '/editar">' + tr('Editar') + '</a>' : '<a class="btn btn-contorno btn-pequeno" href="#/daily/concorrencias/' + c.id + '">' + tr('Abrir') + '</a>') + '</td></tr>';
        }).join('') + '</tbody></table></div></section>'
        : '<section class="cartao vazio-grande"><h2>' + (todas.length ? tr('Nenhuma concorrência aqui') : tr('Nenhuma concorrência ainda')) + '</h2><p class="mudo">' +
          tr('Monte o pacote de um serviço (escopo, etapas, desenhos e prazo), convide as prestadoras dos seus Contatos e compare as propostas lado a lado.') + '</p></section>'),
  });
}

/* Seção na página da obra: as concorrências dela. */
export function htmlConcorrenciasDaObra(o) {
  if (!podeGerir()) return '';
  const lista = enviadas().filter((c) => c.obraId === o.id);
  return '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Concorrências') + '</h2>' +
    '<a class="btn btn-contorno btn-pequeno" href="#/daily/concorrencias/nova/' + o.id + '">' + icone('mais', 16) + tr('Nova concorrência') + '</a></div>' +
    (lista.length ? '<ul class="lista-simples">' + lista.map((c) => '<li><a href="#/daily/concorrencias/' + c.id + '"><b>' + esc(c.servico) + '</b></a> ' + etiqueta(situacaoDe(c)) +
      '<span class="mudo pequeno bloco">' + tn(c.convites.length, '{n} convidado', '{n} convidados') + ' · ' + tn(c.convites.filter((v) => v.propostas.length).length, '{n} proposta', '{n} propostas') + '</span></li>').join('') + '</ul>'
      : '<p class="mudo">' + tr('Nenhuma concorrência nesta obra. Convide prestadoras para cotar um serviço.') + '</p>') + '</section>';
}

/* ---------- Nova concorrência / editar rascunho ---------- */

/* As etapas (cost codes) que a empresa já usa: do catálogo do Measure e dos fornecedores nos Contatos. */
function etapasConhecidas() {
  const s = new Set();
  for (const i of ((estado().measure || {}).itens || [])) if (i.etapa) s.add(i.etapa);
  for (const c of (estado().contatos || [])) for (const e of (c.etapas || [])) s.add(e);
  return [...s].sort();
}

export function telaFormConcorrencia(moldura, id, obraId, projetoId) {
  const c = id ? concorrenciaEnviada(id) : null;
  if (id && (!c || c.situacao !== 'rascunho')) return null;
  const pj = acharProjeto(projetoId || (c && doProjeto(c) ? c.origem.id : null));
  if (projetoId && !pj) return null;
  if (!c && !pj && !obraId && todosProjetos().length) {
    // passo 1: quem trabalha com projetos (Takeoff) cota a partir de um projeto; quem só tem obras segue o formulário da obra
    const lista = todosProjetos().filter((x) => x.situacao !== 'perdida').sort((a, b) => a.nome.localeCompare(b.nome));
    return moldura({
      ativo: ativoBids('concorrencias'), largo: true, titulo: tr('Nova concorrência'), subtitulo: tr('Escolha o projeto: as tarefas das prestadoras, as plantas e o escopo vêm dele.'),
      voltar: { href: '#/daily/concorrencias', rotulo: tr('Concorrências') },
      conteudo: '<section class="cartao"><h2 class="cartao-titulo">' + tr('Projeto') + '</h2>' + (lista.length
        ? campo('co-escolher-projeto', tr('Projeto *'), '<select id="co-escolher-projeto" data-co-projeto><option value="">' + tr('Escolha…') + '</option>' + lista.map((x) => '<option value="' + x.id + '">' + esc(x.nome) + '</option>').join('') + '</select>') + '<p class="mudo pequeno">' + tr('Ao escolher, o formulário abre com as tarefas subcontratadas do cronograma, as plantas e o escopo do projeto.') + '</p>'
        : '<p class="vazio">' + tr('Ainda não há projetos. Crie um projeto no Takeoff primeiro.') + '</p>') + '</section>',
    });
  }
  const d = c || { origem: pj ? { tipo: 'projeto', id: pj.id } : null, obraId: obraId || '', servico: '', etapas: [], incluso: [], excluso: [], observacoes: '', desenhos: [], prazo: '', inicio: '', termino: '', orcamento: { valor: null, mostrar: 'nao' }, exigencias: {}, quarteirizacao: 'permitida', convites: [] };
  const obras = estado().obras.filter((o) => o.situacao !== 'concluida' || o.id === d.obraId);
  anexosNovos = [];
  const pdfsDoProjeto = pj ? pdfsDe(pj.id).filter((a) => !d.desenhos.some((x) => x.nome === a.nome.replace(/\.pdf$/i, ''))) : [];
  const conhecidas = etapasConhecidas();
  const outras = d.etapas.filter((e) => !conhecidas.includes(e));
  const prestadoras = contatosCom('prestadora');
  const convidados = d.convites.map((v) => v.contatoId);
  const ex = d.exigencias || {};
  const [prazoData, prazoHora] = d.prazo ? d.prazo.split('T') : ['', '17:00'];
  const voltar = c ? { href: '#/daily/concorrencias/' + c.id, rotulo: c.servico || tr('Concorrência') } : pj ? { href: '#/measure/projeto/' + pj.id, rotulo: pj.nome } : { href: obraId ? '#/daily/obras/' + obraId : '#/daily/concorrencias', rotulo: obraId ? nomeObra(obraId) : tr('Concorrências') };
  // a concorrência de cima (quarteirização): a do projeto, ou a da obra ganha
  const obraEsc = !pj && d.obraId ? acharObra(d.obraId) : null;
  const paiId = (pj && pj.concorrencia && pj.concorrencia.id) || (obraEsc && obraEsc.concorrenciaId) || null;
  const politica = paiId ? (recebida(paiId) || {}).quarteirizacao : null;
  const avisoPolitica = politica === 'nao-permitida' ? '<div class="aviso aviso-vermelho"><b>' + tr('A contratante desta obra não permite quarteirizar.') + '</b></div>'
    : politica === 'com-aprovacao' ? '<div class="aviso aviso-ambar"><b>' + tr('Quarteirização com aprovação') + '</b><span>' + tr('Quem contratou a sua empresa aprova a prestadora que você escolher, antes do fechamento. Ela vê só o nome, nunca o valor.') + '</span></div>' : '';
  return moldura({
    ativo: ativoBids('concorrencias'), largo: true, titulo: c ? tr('Rascunho: {nome}', { nome: c.servico || tr('(sem nome)') }) : tr('Nova concorrência'),
    subtitulo: tr('O pacote que as prestadoras recebem para cotar'), voltar,
    conteudo: avisoPolitica + '<form id="form-concorrencia" class="form-settings" data-id="' + (c ? c.id : '') + '" data-sem-envio>' +
      '<input type="hidden" name="origemProjeto" value="' + (pj ? pj.id : '') + '">' +
      '<nav class="abas-sublinhadas" aria-label="' + tr('Seções') + '">' + [['servico', tr('Serviço e escopo')], ['docs', tr('Documentos')], ['prazos', tr('Prazos e exigências')], ['convidados', tr('Convidados')]].map(([k, r], i) => '<button type="button" data-acao="co-aba" data-aba="' + k + '"' + (i === 0 ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</button>').join('') + '</nav>' +
      '<section class="cartao" data-aba="servico"><h2 class="cartao-titulo">' + tr('Serviço') + '</h2><div class="grade-campos">' +
        (pj ? campo('co-projeto', tr('Projeto'), '<input type="text" id="co-projeto" value="' + esc(pj.nome) + '" readonly>') : campo('co-obraId', tr('Obra *'), '<select id="co-obraId" name="obraId"><option value="">' + tr('Escolha…') + '</option>' + obras.map((o) => '<option value="' + o.id + '"' + (o.id === d.obraId ? ' selected' : '') + '>' + esc(o.nome) + '</option>').join('') + '</select>')) +
        campo('co-servico', tr('Título da concorrência *'), '<input type="text" id="co-servico" name="servico" value="' + esc(d.servico) + '" placeholder="' + esc(tr('Ex.: Framing e drywall')) + '"><span class="mudo pequeno">' + tr('É o nome que a prestadora vê no convite e que aparece na sua lista. Sugerimos o das tarefas escolhidas.') + '</span>') + '</div>' +
        (pj ? htmlTarefasDoProjeto(pj, d.etapas) : '<fieldset class="co-etapas"><legend class="rotulo-pequeno">' + tr('Etapas a cotar * (cost codes)') + '</legend>' +
          conhecidas.map((e) => '<label class="check pequeno"><input type="checkbox" name="etapas" value="' + esc(e) + '"' + (d.etapas.includes(e) ? ' checked' : '') + '> ' + esc(e) + '</label>').join('') + '</fieldset>' +
          campo('co-outrasEtapas', tr('Outras etapas (uma por linha)'), '<textarea id="co-outrasEtapas" name="outrasEtapas" rows="2" placeholder="' + esc(tr('Ex.: 09 91 00 · Painting')) + '">' + esc(outras.join('\n')) + '</textarea>') +
          '<p class="mudo pequeno">' + tr('Cada etapa vira uma linha na comparação. A prestadora pode cotar todas ou só algumas.') + '</p>') +
        (pj ? '<p class="pequeno">' + tr('Cotando antes da sua proposta: o prazo precisa vencer antes do seu ({data}). Você usa os preços no orçamento e só fecha depois de ganhar o projeto.', { data: pj.prazoProposta ? dataCurta(pj.prazoProposta) : '—' }) + '</p>' : '') +
      '</section>' +
      '<section class="cartao" data-aba="servico"><h2 class="cartao-titulo">' + tr('Escopo do serviço *') + '</h2><p class="mudo pequeno">' + tr('O que está incluso (e o que não está) neste serviço. Vem do escopo do projeto; edite à vontade para esta concorrência.') + '</p>' +
        htmlEditorRico({ id: 'co-escopo-ed', valor: d.escopo || escopoDeListas(d.incluso, d.excluso) || (pj ? pj.descricao : ''), placeholder: tr('Descreva o escopo do serviço…') }) +
        campo('co-observacoes', tr('Observações'), '<textarea id="co-observacoes" name="observacoes" rows="2" placeholder="' + esc(tr('Horário de trabalho, acesso ao canteiro, visita…')) + '">' + esc(d.observacoes) + '</textarea>') +
      '</section>' +
      '<section class="cartao" data-aba="docs" hidden><h2 class="cartao-titulo">' + tr('Documentos anexos') + '</h2>' +
        '<input type="hidden" name="desenhosAtuais" value="' + esc(JSON.stringify(d.desenhos)) + '">' +
        '<div class="grade-campos">' +
          campo('co-arquivo', tr('Arquivos (um ou vários PDFs)'), '<input type="file" id="co-arquivo" accept="application/pdf" multiple>') +
          campo('co-descricao', tr('Descrição'), '<input type="text" id="co-descricao" placeholder="' + esc(tr('Vazio: usa o nome do arquivo')) + '">') + '</div>' +
        campo('co-obs-anexo', tr('Observação'), '<textarea id="co-obs-anexo" rows="2"></textarea>') +
        '<p><button type="button" class="btn btn-contorno" data-acao="co-anexar">' + icone('mais', 18) + tr('Anexar') + '</button></p>' +
        (pdfsDoProjeto.length ? '<p class="pequeno"><b>' + tr('Plantas do projeto') + '</b></p><div class="tabela-rolagem"><table class="tabela co-plantas"><thead><tr><th></th><th>' + tr('Arquivo') + '</th><th>' + tr('Observação') + '</th></tr></thead><tbody>' + pdfsDoProjeto.map((a) => '<tr><td><input type="checkbox" name="plantasProjeto" value="' + esc(a.id) + '"' + (c ? '' : ' checked') + ' aria-label="' + esc(a.nome) + '"></td><td><b>' + esc(a.nome) + '</b><span class="mudo pequeno bloco">' + esc(folhasDo(pj.id).filter((f) => f.arquivo && f.arquivo.id === a.id).map((f) => f.nome).join(' · ')) + '</span></td><td><input type="text" name="obsPlanta:' + esc(a.id) + '" maxlength="500" value="' + esc(observacaoDaPlanta(pj.id, a.id)) + '" placeholder="' + esc(tr('Observação para quem vai cotar')) + '" aria-label="' + esc(tr('Observação')) + '"></td></tr>').join('') + '</tbody></table></div><p class="mudo pequeno">' + tr('A observação vem da aba Plans do projeto e pode ser ajustada aqui, só para esta concorrência.') + '</p>' : '') +
        '<div class="tabela-rolagem"><table class="tabela" id="co-anexos"><thead><tr><th>' + tr('Código') + '</th><th>' + tr('Descrição') + '</th><th>' + tr('Arquivo') + '</th><th>' + tr('Tamanho') + '</th><th>' + tr('Observação') + '</th><th></th></tr></thead><tbody>' + linhasDeAnexos(d.desenhos) + '</tbody></table></div>' +
        '<p class="mudo pequeno">' + (estado().oficial ? tr('Os PDFs vão para a pasta da concorrência; quem cotar abre os arquivos pelo convite e recebe uma cópia no projeto do Takeoff.') : tr('No protótipo, só o nome de cada arquivo é guardado.')) + '</p>' +
      '</section>' +
      '<section class="cartao" data-aba="prazos" hidden><h2 class="cartao-titulo">' + tr('Prazos') + '</h2><div class="grade-campos">' +
        campo('co-prazoData', tr('Prazo da proposta *'), '<input type="date" id="co-prazoData" name="prazoData" value="' + esc(prazoData) + '">') +
        campo('co-prazoHora', tr('Hora'), '<input type="time" id="co-prazoHora" name="prazoHora" value="' + esc(prazoHora || '17:00') + '">') +
        campo('co-inicio', tr('Início previsto do serviço'), '<input type="date" id="co-inicio" name="inicio" value="' + esc(d.inicio) + '"><span class="mudo pequeno">' + tr('Vem das tarefas escolhidas; dá para mudar.') + '</span>') +
        campo('co-termino', tr('Término previsto'), '<input type="date" id="co-termino" name="termino" value="' + esc(d.termino) + '">') + '</div>' +
      '</section>' +
      '<section class="cartao" data-aba="prazos" hidden><h2 class="cartao-titulo">' + tr('Orçamento e exigências') + '</h2><div class="grade-campos">' +
        campo('co-orcamento', tr('Orçamento (US$, opcional)'), '<input type="number" id="co-orcamento" name="orcamento" min="0" step="100" value="' + (d.orcamento.valor == null ? '' : d.orcamento.valor) + '">') +
        campo('co-mostrar', tr('Mostrar o orçamento às prestadoras'), '<select id="co-mostrar" name="mostrar">' + ['nao', 'total'].map((k) => '<option value="' + k + '"' + (d.orcamento.mostrar === k ? ' selected' : '') + '>' + MOSTRAR_ORCAMENTO[k] + '</option>').join('') + '</select>') +
        campo('co-gl', tr('Seguro de responsabilidade civil (GL) mínimo, US$'), '<input type="number" id="co-gl" name="glMinimo" min="0" step="100000" value="' + (ex.glMinimo || '') + '">') +
        campo('co-licenca', tr('Licença exigida'), '<input type="text" id="co-licenca" name="licenca" value="' + esc(ex.licenca || '') + '">') +
        campo('co-quarteirizacao', tr('A contratada pode quarteirizar?'), '<select id="co-quarteirizacao" name="quarteirizacao">' + Object.entries(QUARTEIRIZACAO).map(([k, n]) => '<option value="' + k + '"' + (d.quarteirizacao === k ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>') + '</div>' +
        '<label class="check pequeno"><input type="checkbox" name="wcObrigatorio" value="1"' + (ex.wcObrigatorio ? ' checked' : '') + '> ' + tr("Workers' comp obrigatório") + '</label>' +
        '<label class="check pequeno"><input type="checkbox" name="visita" value="1"' + (ex.visita && ex.visita.obrigatoria ? ' checked' : '') + '> ' + tr('Visita à obra obrigatória') + '</label>' +
        '<p class="mudo pequeno">' + tr('O orçamento nunca aparece para as prestadoras, a não ser que você escolha mostrar o total.') + '</p>' +
      '</section>' +
      '<section class="cartao" data-aba="convidados" hidden><h2 class="cartao-titulo">' + tr('Convidados *') + '</h2>' +
        (prestadoras.length ? '<div class="co-convidados">' + prestadoras.map((p) => '<label class="check"><input type="checkbox" name="convidados" value="' + p.id + '"' + (convidados.includes(p.id) ? ' checked' : '') + '> <b>' + esc(p.nome) + '</b> ' +
          (contaDoContato(p) ? '<span class="etiqueta etiqueta-verde">' + tr('Tem KORbuild') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + tr('Recebe por link') + '</span>') +
          (p.pessoa ? ' <span class="mudo pequeno">' + esc(p.pessoa) + '</span>' : '') + '</label>').join('') + '</div>'
          : '<p class="mudo">' + tr('Nenhuma prestadora nos seus Contatos.') + '</p>') +
        '<p class="mudo pequeno">' + tr('A lista vem dos Contatos com o marcador prestadora.') + ' <a href="#/settings/contatos">' + tr('Abrir os Contatos') + '</a></p>' +
      '</section>' +
      '<div class="rodape-form"><a class="btn btn-contorno" href="' + voltar.href + '">' + tr('Cancelar') + '</a>' +
        '<button type="button" class="btn btn-primario" data-acao="co-salvar">' + tr('Salvar') + '</button></div>' +
      '<p class="mudo pequeno">' + tr('Depois de salvar, a próxima tela tem o botão Enviar convites.') + '</p>' +
    '</form>',
  });
}

/* A observação de um arquivo de plantas: as observações (diferentes) das folhas dele, da aba Plans. */
function observacaoDaPlanta(projetoId, arquivoId) {
  return [...new Set(folhasDo(projetoId).filter((f) => f.arquivo && f.arquivo.id === arquivoId).map((f) => (f.observacao || '').trim()).filter(Boolean))].join(' · ');
}

/* As tarefas do cronograma que a empresa não faz (prestadoras): é isto que se cota. Uma lista para escolher e uma grade com as escolhidas;
 * a tarefa escolhida sai da lista e volta quando é retirada da grade. */
function htmlTarefasDoProjeto(pj, escolhidas) {
  const todas = ((pj.cronograma || {}).tarefas || []).filter((t) => t.quem === 'terceiro' && String(t.nome || '').trim());
  const unicas = [];
  for (const t of todas) if (!unicas.some((u) => u.nome === t.nome.trim())) unicas.push({ nome: t.nome.trim(), inicio: t.inicio || '', dias: Number(t.dias) || '' });
  const jaEscolhidas = (escolhidas || []).map((e) => ({ nome: e, ...(unicas.find((u) => u.nome === e) || { fora: true, inicio: '', dias: '' }) }));
  const livres = unicas.filter((u) => !(escolhidas || []).includes(u.nome));
  const opcao = (u) => '<option value="' + esc(u.nome) + '" data-inicio="' + esc(u.inicio) + '" data-dias="' + esc(u.dias) + '">' + esc(u.nome) + '</option>';
  return '<div class="co-tarefas" id="co-tarefas"><span class="rotulo-pequeno">' + tr('Tarefas a cotar * (das prestadoras)') + '</span>' +
    (unicas.length || jaEscolhidas.length
      ? '<div class="co-tarefa-add"><select id="co-tarefa-sel" aria-label="' + esc(tr('Tarefa')) + '"><option value="">' + tr('Escolha uma tarefa…') + '</option>' + livres.map(opcao).join('') + '</select>' +
        '<button type="button" class="btn btn-contorno" data-acao="co-tarefa-add">' + icone('mais', 16) + tr('Adicionar') + '</button></div>'
      : '<p class="vazio">' + tr('Nenhuma tarefa de prestadora no cronograma. Em Schedule, marque a tarefa como Subcontractor.') + ' <a href="#/measure/projeto/' + pj.id + '/schedule">' + tr('Abrir o cronograma') + '</a></p>') +
    '<div class="tabela-rolagem"><table class="tabela" id="co-tarefas-grade"' + (jaEscolhidas.length ? '' : ' hidden') + '><thead><tr><th>' + tr('Tarefa') + '</th><th>' + tr('Data de início') + '</th><th>' + tr('Dias') + '</th><th></th></tr></thead><tbody>' +
      jaEscolhidas.map((u) => linhaDeTarefa(u)).join('') + '</tbody></table></div>' +
    '<p class="mudo pequeno" id="co-tarefas-vazio"' + (jaEscolhidas.length ? ' hidden' : '') + '>' + tr('Nenhuma tarefa adicionada ainda.') + '</p>' +
    '<p class="mudo pequeno">' + tr('Cada tarefa vira uma linha na comparação. A prestadora pode cotar todas ou só algumas. Dá para adicionar mais de uma.') + '</p></div>';
}
function linhaDeTarefa(u) {
  return '<tr data-tarefa="' + esc(u.nome) + '" data-inicio="' + esc(u.inicio) + '" data-dias="' + esc(u.dias) + '"><td><b>' + esc(u.nome) + '</b>' + (u.fora ? ' <span class="mudo pequeno">' + tr('(não está mais no cronograma)') + '</span>' : '') + '<input type="hidden" name="etapas" value="' + esc(u.nome) + '"></td>' +
    '<td>' + (u.inicio ? dataCurta(u.inicio) : '—') + '</td><td>' + (u.dias || '—') + '</td>' +
    '<td class="num"><button type="button" class="link-botao pequeno" data-acao="co-tarefa-tirar">' + tr('Remover') + '</button></td></tr>';
}
/* Início e término previstos vêm do cronograma: do começo da primeira tarefa escolhida ao fim da última (some só enquanto a pessoa não digitar outra data). */
function sugerirDatas() {
  const ini = document.getElementById('co-inicio'), fim = document.getElementById('co-termino');
  if (!ini || !fim) return;
  const linhas = Array.from(document.querySelectorAll('#co-tarefas-grade tbody tr')).filter((l) => l.dataset.inicio);
  const comeco = linhas.map((l) => l.dataset.inicio).sort()[0] || '';
  const fimes = linhas.map((l) => somarDias(l.dataset.inicio, Math.max(0, (Number(l.dataset.dias) || 1) - 1))).sort();
  const termino = fimes[fimes.length - 1] || '';
  if (!ini.value || ini.value === ini.dataset.auto) { ini.value = comeco; ini.dataset.auto = comeco; }
  if (!fim.value || fim.value === fim.dataset.auto) { fim.value = termino; fim.dataset.auto = termino; }
}
/* O título da concorrência acompanha as tarefas escolhidas, enquanto a pessoa não escrever o dela. */
function sugerirTitulo() {
  const campo = document.getElementById('co-servico');
  if (!campo) return;
  const nomes = Array.from(document.querySelectorAll('#co-tarefas-grade tbody tr')).map((tr_) => tr_.dataset.tarefa.split('·').pop().trim());
  const sugestao = nomes.join(' + ');
  if (!campo.value || campo.value === campo.dataset.auto) { campo.value = sugestao; campo.dataset.auto = sugestao; }
}

/* Os PDFs distintos das folhas de um projeto (uma folha por página, vários por PDF). */
function pdfsDe(projetoId) {
  const vistos = new Map();
  for (const f of folhasDo(projetoId)) if (f.arquivo && !vistos.has(f.arquivo.id)) vistos.set(f.arquivo.id, f.arquivo);
  return Array.from(vistos.values()).map((a) => ({ id: a.id, nome: a.nome || a.id, arquivo: a }));
}

async function arquivosDasPlantas(projetoId, ids, observacoes) {
  const out = [];
  for (const a of pdfsDe(projetoId).filter((x) => ids.includes(x.id))) {
    try {
      const bytes = a.arquivo.tipo === 'storage' ? await bytesDaPlanta(a.arquivo) : new Uint8Array(await (await lerFoto(a.arquivo.id)).arrayBuffer());
      out.push({ nome: a.nome.replace(/\.pdf$/i, ''), arquivo: new File([bytes], a.nome, { type: 'application/pdf' }), observacao: String((observacoes || {})[a.id] || '').trim() });
    } catch (e) { console.error('planta ' + a.nome + ': ' + (e && e.message ? e.message : e)); }
  }
  return out;
}

/* Anexos do formulário: os já gravados (no campo oculto) e os novos, ainda na memória até salvar. */
let anexosNovos = [];
const tamanhoLegivel = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round((n || 0) / 1024)) + ' KB');
function atuaisDoForm() {
  const el = document.querySelector('#form-concorrencia [name="desenhosAtuais"]');
  try { return JSON.parse((el && el.value) || '[]'); } catch (e) { return []; }
}
function linhasDeAnexos(atuais) {
  const linhas = atuais.map((x, i) => ({ k: 'a' + i, nome: x.nome, arquivo: x.nome + '.pdf', tamanho: x.tamanho, obs: x.observacao }))
    .concat(anexosNovos.map((x, i) => ({ k: 'n' + i, nome: x.nome, arquivo: x.arquivo.name, tamanho: x.arquivo.size, obs: x.observacao })));
  return linhas.length ? linhas.map((l, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(l.nome) + '</td><td>' + esc(l.arquivo) + '</td><td>' + (l.tamanho ? tamanhoLegivel(l.tamanho) : '—') + '</td><td>' + esc(l.obs || '') + '</td>' +
    '<td><button type="button" class="link-botao pequeno" data-acao="co-tirar-anexo" data-k="' + l.k + '">' + tr('Remover') + '</button></td></tr>').join('')
    : '<tr><td colspan="6" class="mudo">' + tr('Nenhum arquivo anexado.') + '</td></tr>';
}
function desenharAnexos() {
  const corpo = document.querySelector('#co-anexos tbody');
  if (corpo) corpo.innerHTML = linhasDeAnexos(atuaisDoForm());
}

function dadosDoForm() {
  const form = document.getElementById('form-concorrencia');
  const fd = new FormData(form);
  const anexos = anexosNovos.slice();
  const plantas = fd.getAll('plantasProjeto');
  const obsPlantas = Object.fromEntries(plantas.map((pid) => [pid, fd.get('obsPlanta:' + pid)]));
  const escopoRico = valorDoEditor('co-escopo-ed');
  let atuais = [];
  try { atuais = JSON.parse(fd.get('desenhosAtuais') || '[]'); } catch (e) { atuais = []; }
  const visitaAntes = (concorrenciaEnviada(form.dataset.id) || { exigencias: {} }).exigencias.visita || {};
  return {
    id: form.dataset.id || null,
    dados: {
      obraId: fd.get('obraId'), origem: fd.get('origemProjeto') ? { tipo: 'projeto', id: fd.get('origemProjeto') } : null, servico: fd.get('servico'),
      etapas: fd.getAll('etapas').concat(String(fd.get('outrasEtapas') || '').split('\n')),
      escopo: escopoRico, incluso: escopoRico != null ? [] : fd.get('incluso'), excluso: escopoRico != null ? [] : fd.get('excluso'), observacoes: fd.get('observacoes'), observacoesPlantas: obsPlantas,
      desenhos: atuais.concat(anexos.map((a) => ({ nome: a.nome, observacao: a.observacao }))), desenhosNovos: anexos, plantasProjeto: plantas, desenhosMantidos: atuais.map((x) => x.id).filter(Boolean),
      prazo: fd.get('prazoData') ? fd.get('prazoData') + 'T' + (fd.get('prazoHora') || '17:00') : '',
      inicio: fd.get('inicio'), termino: fd.get('termino'),
      orcamento: { valor: fd.get('orcamento'), mostrar: fd.get('mostrar') },
      exigencias: { glMinimo: Number(fd.get('glMinimo')) || null, wcObrigatorio: !!fd.get('wcObrigatorio'), licenca: String(fd.get('licenca') || '').trim(), visita: { ...visitaAntes, obrigatoria: !!fd.get('visita') } },
      quarteirizacao: fd.get('quarteirizacao'), convidados: fd.getAll('convidados'),
    },
  };
}

/* ---------- Página da concorrência ---------- */

/* Os três números do alto da página: menor valor, menor prazo e quantas convidadas já mandaram proposta. */
function kpisDasPropostas(c) {
  const cmp = comparar(c);
  const ativos = c.convites.filter((v) => v.situacao !== 'nao-vai');
  if (!cmp.colunas.length) return '';
  const menor = cmp.colunas.reduce((a, b) => (b.total < a.total ? b : a));
  const comPrazo = cmp.colunas.filter((k) => k.prazoExecucaoDias);
  const rapida = comPrazo.length ? comPrazo.reduce((a, b) => (b.prazoExecucaoDias < a.prazoExecucaoDias ? b : a)) : null;
  const pct = ativos.length ? Math.round(cmp.colunas.length * 100 / ativos.length) : 0;
  return '<div class="co-kpis">' +
    '<div class="co-kpi co-kpi-verde"><span>' + tr('Menor valor') + '</span><b>' + dinheiro(menor.total) + '</b><small>' + esc(menor.nome) + '</small></div>' +
    '<div class="co-kpi co-kpi-azul"><span>' + tr('Menor prazo') + '</span><b>' + (rapida ? tn(rapida.prazoExecucaoDias, '{n} dia', '{n} dias') : '—') + '</b><small>' + (rapida ? esc(rapida.nome) : '') + '</small></div>' +
    '<div class="co-kpi co-kpi-roxo"><span>' + tr('Propostas recebidas') + '</span><b>' + tr('{n} de {total}', { n: cmp.colunas.length, total: ativos.length }) + '</b><small>' + tr('{pct}% das convidadas', { pct }) + '</small></div></div>';
}

const ABAS_PAGINA = [['convidados', tr('Convidados')], ['perguntas', tr('Perguntas')], ['comparar', tr('Comparar')], ['detalhes', tr('Detalhes')]];

export function telaConcorrencia(moldura, id, abaPedida) {
  const c = concorrenciaEnviada(id);
  if (!c) return null;
  const s = situacaoDe(c);
  const aba = ABAS_PAGINA.find((x) => x[0] === abaPedida) ? abaPedida : 'convidados';
  const ativa = s === 'aberta' || s === 'para-fechar';
  const acoes = '<div class="acoes-cabeca">' +
    (c.situacao === 'rascunho' ? '<a class="btn btn-contorno" href="#/daily/concorrencias/' + c.id + '/editar">' + tr('Editar') + '</a>' +
      '<button type="button" class="btn btn-contorno" data-acao="co-cancelar" data-id="' + c.id + '">' + tr('Excluir rascunho') + '</button>' +
      '<button type="button" class="btn btn-primario" data-acao="co-enviar" data-id="' + c.id + '"' + (pendenciasDeEnvio(c).length ? ' disabled title="' + esc(tr('Complete o que falta para enviar.')) + '"' : '') + '>' + tr('Enviar convites') + '</button>' : '') +
    (ativa ? '<button type="button" class="btn btn-contorno" data-acao="co-prorrogar" data-id="' + c.id + '">' + icone('relogio', 18) + tr('Prorrogar') + '</button>' +
      '<button type="button" class="btn btn-contorno" data-acao="co-convidar" data-id="' + c.id + '">' + icone('mais', 18) + tr('Convidar mais') + '</button>' +
      '<button type="button" class="btn btn-contorno" data-acao="co-cancelar" data-id="' + c.id + '">' + tr('Cancelar') + '</button>' : '') + '</div>';
  let aviso = '';
  if (c.situacao === 'rascunho') {
    const falta = pendenciasDeEnvio(c);
    aviso = '<div class="aviso aviso-ambar"><b>' + tr('Rascunho: as prestadoras ainda não receberam nada.') + '</b>' + (falta.length ? '<span>' + tr('Falta: {itens}', { itens: falta.map((x) => x.replace(/\.$/, '')).join(' · ') }) + '</span>' : '<span>' + tr('Tudo pronto para enviar.') + '</span>') + '<span class="mudo pequeno">' + tr('Nenhum e-mail ou aviso sai antes de você clicar em Enviar convites.') + '</span></div>';
  } else if (s === 'para-fechar') aviso = '<div class="aviso aviso-ambar"><b>' + tr('O prazo venceu.') + '</b><span>' + tr('Compare as propostas e feche, ou prorrogue para receber mais.') + '</span></div>';
  else if (c.situacao === 'fechada') {
    const v = c.convites.find((x) => x.id === c.fechamento.conviteId);
    aviso = '<div class="aviso aviso-verde"><b>' + tr('Fechada com {nome}', { nome: esc(v.nome) }) + '</b><span>' + tr('Rev. {rev} · {valor} · {quando} por {quem}', { rev: c.fechamento.rev, valor: dinheiro(c.fechamento.valor), quando: dataHora(c.fechamento.em), quem: esc(c.fechamento.por) }) + (c.fechamento.observacao ? ' · ' + esc(c.fechamento.observacao) : '') + '</span></div>';
  } else if (c.situacao === 'cancelada') aviso = '<div class="aviso"><b>' + tr('Cancelada') + '</b><span>' + esc(c.cancelamento.motivo) + ' · ' + dataHora(c.cancelamento.em) + '</span></div>';
  const pai = concorrenciaPai(c);
  const contratanteDeCima = pai ? ((recebida(pai.id) || {}).contratante || {}).nome || '' : '';
  if (c.aprovacao && c.situacao !== 'fechada') aviso += c.aprovacao.situacao === 'pendente'
    ? '<div class="aviso aviso-ambar"><b>' + tr('Aguardando a aprovação de {nome}', { nome: esc(contratanteDeCima) }) + '</b><span>' + tr('Você escolheu {empresa}. O fechamento acontece quando a contratante de cima aprovar.', { empresa: esc(c.aprovacao.nome) }) + '</span></div>'
    : c.aprovacao.situacao === 'recusada' ? '<div class="aviso aviso-vermelho"><b>' + tr('{nome} não aprovou {empresa}', { nome: esc(contratanteDeCima), empresa: esc(c.aprovacao.nome) }) + '</b><span>' + esc(c.aprovacao.motivo || '') + ' ' + tr('Escolha outra prestadora.') + '</span></div>' : '';
  if (pai) aviso += '<p class="mudo pequeno">' + tr('Quarteirização de "{servico}" para {nome}.', { servico: esc(pai.servico), nome: esc(contratanteDeCima) }) + '</p>';
  for (const pd of pedidosDeQuarteirizacao().filter((x) => x.paiId === c.id)) aviso += '<div class="aviso aviso-ambar"><b>' + tr('{contratante} quer quarteirizar "{servico}" para {escolhida}', { contratante: esc(pd.contratante), servico: esc(pd.servico), escolhida: esc(pd.escolhida) }) + '</b>' +
    '<span>' + tr('Você aprova a empresa; o valor entre elas não é informado.') + '</span><span class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="co-aprovar-q" data-id="' + pd.id + '">' + tr('Aprovar') + '</button><button type="button" class="btn btn-contorno btn-pequeno" data-acao="co-recusar-q" data-id="' + pd.id + '">' + tr('Recusar') + '</button></span></div>';
  const conteudo = aba === 'comparar' ? htmlComparar(c, ativa) : aba === 'detalhes' ? htmlDetalhes(c) : aba === 'perguntas' ? htmlPerguntas(c) : htmlConvidados(c);
  return moldura({
    ativo: ativoBids('concorrencias'), largo: true, titulo: c.servico || tr('(sem nome)'),
    subtitulo: nomeOrigem(c) + ' · ' + SITUACOES[s].nome + (ativa ? ' · ' + tr('prazo {quando}', { quando: textoPrazo(c) }) : ''),
    voltar: { href: '#/daily/concorrencias', rotulo: tr('Concorrências') }, acoes,
    conteudo: aviso + '<div id="concorrencia" data-id="' + c.id + '"></div>' +
      (c.situacao === 'rascunho' ? '' : kpisDasPropostas(c) + '<nav class="abas-sublinhadas" aria-label="' + tr('Seções') + '">' + ABAS_PAGINA.map(([k, r]) => '<a href="#/daily/concorrencias/' + c.id + (k === 'convidados' ? '' : '/' + k) + '"' + (k === aba ? ' class="ativa" aria-current="page"' : '') + '>' + r + (k === 'comparar' ? ' <span class="mz-contagem">' + c.convites.filter((v) => v.propostas.length).length + '</span>' : '') + (k === 'perguntas' && perguntasSemResposta(c).length ? ' <span class="mz-contagem co-pendente">' + perguntasSemResposta(c).length + '</span>' : '') + '</a>').join('') + '</nav>') +
      conteudo,
  });
}

/* Domínios reservados (RFC 2606): o SMTP recusa com erro 554, então o convite por e-mail nunca chega; o aviso evita a dúvida "cadê o e-mail?". */
const enderecoDeTeste = (e) => /@([a-z0-9-]+\.)*example\.(com|net|org)$|\.(test|invalid|localhost|example)$/i.test(String(e || '').trim());

function htmlConvidados(c) {
  return '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-convidados"><thead><tr><th>' + tr('Prestadora') + '</th><th>' + tr('Recebe') + '</th><th>' + tr('Situação') + '</th><th>' + tr('Última proposta') + '</th><th>' + tr('Visto') + '</th></tr></thead><tbody>' +
    c.convites.map((v) => {
      const p = ultimaProposta(v);
      return '<tr><td><b>' + esc(v.nome) + '</b>' + (v.email ? '<span class="mudo pequeno bloco">' + esc(v.email) + (enderecoDeTeste(v.email) ? ' <span class="etiqueta etiqueta-ambar" title="' + esc(tr('Domínio reservado para testes: o provedor recusa o e-mail.')) + '">' + tr('endereço de teste: não recebe e-mail') + '</span>' : '') + '</span>' : '') + '</td><td>' + comoRecebe(v) +
          (!v.empresaId && c.situacao !== 'rascunho' ? (v.token ? '<button type="button" class="link-botao pequeno bloco" data-acao="co-link" data-token="' + esc(v.token) + '">' + tr('Copiar o link') + '</button>' : '<span class="mudo pequeno bloco">' + tr('link no aparelho que enviou') + '</span>') : '') + '</td>' +
        '<td>' + (c.situacao === 'rascunho' ? '<span class="etiqueta etiqueta-neutro">' + tr('Ainda não enviado') + '</span>' : etiquetaConvite(v)) + (v.motivo ? '<span class="mudo pequeno bloco">“' + esc(v.motivo) + '”</span>' : '') + '</td>' +
        '<td>' + (p ? '<b>' + dinheiro(p.total) + '</b><span class="mudo pequeno bloco">' + tr('rev. {rev} · {quando}', { rev: p.rev, quando: dataHora(p.enviadaEm) }) + '</span>' : '<span class="mudo">—</span>') + '</td>' +
        '<td>' + (v.vistoEm ? dataHora(v.vistoEm) : '<span class="mudo">' + (c.situacao === 'rascunho' ? '—' : tr('ainda não')) + '</span>') + '</td></tr>';
    }).join('') + '</tbody></table></div>' +
    (c.situacao === 'rascunho' ? '' : '<p class="mudo pequeno">' + tr('Cada prestadora vê só o próprio convite e a própria proposta: nunca quem mais foi convidado nem os valores dos outros.') + '</p>') + '</section>';
}

/* ---------- Canal ---------- */

function htmlMensagens(lista, { responder, concorrenciaId } = {}) {
  if (!lista.length) return '<p class="mudo">' + tr('Nenhuma mensagem ainda.') + '</p>';
  const semResposta = responder ? new Set(responder.map((m) => m.id)) : new Set();
  return '<ol class="co-mensagens">' + lista.slice().sort((a, b) => a.em - b.em).map((m) => '<li class="co-msg co-msg-' + m.de + (m.aviso ? ' co-msg-aviso' : '') + '">' +
    '<span class="co-msg-cabeca"><b>' + esc(m.autor) + '</b> · ' + dataHora(m.em) +
      (m.aviso ? ' <span class="etiqueta etiqueta-ambar">' + tr('Aviso a todos') + '</span>' : m.publica ? ' <span class="etiqueta etiqueta-azul">' + tr('Para todos') + '</span>' : '') + '</span>' +
    '<span class="co-msg-texto">' + esc(m.texto) + '</span>' +
    (semResposta.has(m.id) ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="co-responder" data-id="' + concorrenciaId + '" data-msg="' + m.id + '">' + tr('Responder') + '</button>' : '') +
    '</li>').join('') + '</ol>';
}
function formMensagem(acao, dados, rotulo, dica) {
  return '<div class="co-escrever"><textarea rows="2" name="mensagem" aria-label="' + esc(rotulo) + '" placeholder="' + esc(dica || '') + '"></textarea>' +
    '<button type="button" class="btn btn-primario btn-pequeno" data-acao="' + acao + '"' + Object.entries(dados).map(([k, v]) => ' data-' + k + '="' + esc(v) + '"').join('') + '>' + esc(rotulo) + '</button></div>';
}

function htmlPerguntas(c) {
  const aberta = c.situacao === 'aberta';
  const pend = perguntasSemResposta(c);
  const conversas = c.convites.filter((v) => c.situacao !== 'fechada' || v.id === c.fechamento.conviteId || canalDaContratante(c, v.id).some((m) => m.conviteId === v.id));
  return (aberta ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Aviso a todos os convidados') + '</h2>' +
      '<p class="mudo pequeno">' + tr('Um adendo, uma mudança de data, uma folha nova: todas as convidadas recebem.') + '</p>' +
      formMensagem('co-aviso', { id: c.id }, tr('Avisar a todos'), tr('Ex.: Adendo nº 1: a folha A-102 foi revisada.')) + '</section>' : '') +
    conversas.map((v) => {
      const lista = canalDaContratante(c, v.id);
      const vencedora = c.fechamento && c.fechamento.conviteId === v.id;
      const escreve = aberta || vencedora;
      return '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(v.nome) + '</h2>' + etiquetaConvite(v) + '</div>' +
        htmlMensagens(lista, { responder: pend.filter((m) => m.conviteId === v.id), concorrenciaId: c.id }) +
        (escreve ? formMensagem('co-escrever', { id: c.id, convite: v.id }, vencedora ? tr('Enviar') : tr('Escrever só para esta prestadora'), vencedora ? tr('A conversa da obra continua aqui.') : '') : '') + '</section>';
    }).join('') +
    '<p class="mudo pequeno">' + tr('Ao responder uma pergunta, escolha: para todas as convidadas (a pergunta vai junto, sem dizer quem perguntou) ou só para quem perguntou. Nada se apaga: o canal é o registro do que foi combinado.') + '</p>';
}

/* Canal na página da obra, depois do fechamento: na contratante, com cada contratada pela concorrência; na
 * contratada, com quem a contratou. */
export function htmlCanalDaObra(o) {
  const cartoes = [];
  for (const c of enviadas().filter((x) => x.obraId === o.id && x.situacao === 'fechada')) {
    const v = c.convites.find((x) => x.id === c.fechamento.conviteId);
    cartoes.push('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Canal com {nome}', { nome: esc(v.nome) }) + '</h2><span class="mudo pequeno">' + esc(c.servico) + '</span></div>' +
      htmlMensagens(canalDaContratante(c, v.id).filter((m) => m.conviteId === v.id)) + formMensagem('co-escrever', { id: c.id, convite: v.id }, tr('Enviar'), tr('Dúvidas de projeto, mudanças, avisos…')) + '</section>');
  }
  if (o.concorrenciaId) {
    const x = recebida(o.concorrenciaId);
    if (x && x.convite.situacao === 'vencedora') cartoes.push('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Canal com {nome}', { nome: esc(nomeContratante(x)) }) + '</h2><span class="mudo pequeno">' + esc(x.servico) + '</span></div>' +
      htmlMensagens(canalRecebido(x.id)) + formMensagem('cv-escrever', { id: x.id }, tr('Enviar'), tr('Dúvidas de projeto, mudanças, avisos…')) + '</section>');
  }
  return cartoes.join('');
}

function htmlComparar(c, ativa) {
  const cmp = comparar(c);
  if (!cmp.colunas.length) return '<section class="cartao vazio-grande"><h2>' + tr('Nenhuma proposta ainda') + '</h2><p class="mudo">' + tr('As propostas aparecem aqui assim que chegam, lado a lado, por etapa.') + '</p></section>';
  const orc = c.orcamento && c.orcamento.valor ? c.orcamento : null;
  const venc = c.fechamento ? c.fechamento.conviteId : null;
  const cel = (x, menor) => (x == null ? '<td class="co-nao-cotada">' + tr('não cotada') + '</td>' : '<td class="num' + (x === menor ? ' co-menor' : '') + '">' + dinheiro(x) + '</td>');
  return '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-comparar"><thead><tr><th>' + tr('Etapa') + '</th>' +
      (orc ? '<th class="num mudo">' + tr('Seu orçamento') + '</th>' : '') +
      cmp.colunas.map((k) => '<th class="num' + (k.conviteId === venc ? ' co-vencedora' : '') + '">' + esc(k.nome) + '<span class="mudo pequeno bloco">' + tr('rev. {rev}', { rev: k.rev }) + (k.comConta ? '' : ' · ' + tr('link')) + '</span></th>').join('') + '</tr></thead><tbody>' +
      cmp.linhas.map((l) => '<tr><td>' + esc(l.etapa) + '</td>' + (orc ? '<td class="num mudo">' + (orc.porEtapa && orc.porEtapa[l.etapa] != null ? dinheiro(orc.porEtapa[l.etapa]) : '—') + '</td>' : '') + cmp.colunas.map((k) => cel(l.valores[k.conviteId], l.menor)).join('') + '</tr>').join('') +
      '<tr class="co-total"><td><b>' + tr('Total') + '</b></td>' + (orc ? '<td class="num mudo">' + dinheiro(orc.valor) + '</td>' : '') + cmp.colunas.map((k) => '<td class="num"><b>' + dinheiro(k.total) + '</b>' + (k.naoCotadas.length ? '<span class="texto-alerta pequeno bloco">' + tn(k.naoCotadas.length, '{n} etapa não cotada', '{n} etapas não cotadas') + '</span>' : '') + '</td>').join('') + '</tr>' +
      (cmp.colunas.some((k) => k.outros) ? '<tr><td>' + tr('Outros itens (fora das etapas)') + '</td>' + (orc ? '<td></td>' : '') + cmp.colunas.map((k) => '<td class="num">' + (k.outros ? dinheiro(k.outros) : '—') + '</td>').join('') + '</tr>' : '') +
      '<tr><td>' + tr('Prazo de execução') + '</td>' + (orc ? '<td></td>' : '') + cmp.colunas.map((k) => '<td class="num">' + (k.prazoExecucaoDias ? tn(k.prazoExecucaoDias, '{n} dia', '{n} dias') : '—') + '</td>').join('') + '</tr>' +
      '<tr><td>' + tr('Exclusões') + '</td>' + (orc ? '<td></td>' : '') + cmp.colunas.map((k) => '<td class="co-exclusoes">' + (k.exclusoes.length ? k.exclusoes.map((x) => k.exclusoesNoEscopo.includes(x) ? '<span class="texto-alerta bloco" title="' + esc(tr('Está no escopo incluso: pergunte antes de fechar')) + '">⚠ ' + esc(x) + '</span>' : '<span class="bloco">' + esc(x) + '</span>').join('') : '<span class="mudo">—</span>') + '</td>').join('') + '</tr>' +
      '<tr><td>' + tr('Enviada em') + '</td>' + (orc ? '<td></td>' : '') + cmp.colunas.map((k) => '<td class="num pequeno">' + dataHora(k.enviadaEm) + (k.numero ? '<span class="mudo bloco">' + esc(k.numero) + '</span>' : '') + '</td>').join('') + '</tr>' +
      (ativa ? '<tr><td></td>' + (orc ? '<td></td>' : '') + cmp.colunas.map((k) => '<td class="num"><span class="btn-linha co-botoes">' +
        (doProjeto(c) && acharProjeto(c.origem.id) ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="co-usar" data-id="' + c.id + '" data-convite="' + k.conviteId + '">' + tr('Usar no meu orçamento') + '</button>' : '') +
        '<button type="button" class="btn btn-primario btn-pequeno" data-acao="co-fechar" data-id="' + c.id + '" data-convite="' + k.conviteId + '">' + tr('Fechar com esta') + '</button></span></td>').join('') + '</tr>' : '') +
    '</tbody></table></div>' +
    '<p class="mudo pequeno">' + tr('Em verde, o menor valor de cada etapa. Etapa não cotada nunca conta como zero: compare o total só entre propostas completas. ⚠ marca uma exclusão que está no seu escopo incluso.') + '</p></section>';
}

/* O escopo: o texto formatado e, nas concorrências antigas, as listas Incluso/Excluso. */
function blocoEscopo(c, lista) {
  const rico = c.escopo ? '<div class="doc-rico">' + escopoHtml(c.escopo) + '</div>' : '';
  const antigas = c.incluso.length || c.excluso.length || !rico
    ? '<h3 class="rotulo-pequeno">' + tr('Incluso') + '</h3>' + lista(c.incluso) + '<h3 class="rotulo-pequeno">' + tr('Excluso') + '</h3>' + lista(c.excluso) : '';
  return rico + antigas;
}

function htmlDetalhes(c) {
  const ex = c.exigencias || {};
  const lista = (itens) => (itens.length ? '<ul>' + itens.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>' : '<p class="mudo">—</p>');
  const exig = [ex.glMinimo ? tr('GL mínimo de {valor}', { valor: dinheiro(ex.glMinimo) }) : '', ex.wcObrigatorio ? tr("Workers' comp obrigatório") : '', ex.licenca ? tr('Licença: {l}', { l: ex.licenca }) : '', ex.visita && ex.visita.obrigatoria ? tr('Visita à obra obrigatória') : ''].filter(Boolean);
  return '<div class="grade-2">' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Escopo') + '</h2>' + blocoEscopo(c, lista) +
      (c.observacoes ? '<h3 class="rotulo-pequeno">' + tr('Observações') + '</h3><p>' + esc(c.observacoes) + '</p>' : '') + '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('O pacote') + '</h2><dl class="lista-dados">' +
      '<dt>' + tr('Etapas a cotar') + '</dt><dd>' + c.etapas.map(esc).join('<br>') + '</dd>' +
      '<dt>' + tr('Desenhos') + '</dt><dd>' + (c.desenhos.length ? c.desenhos.map((x) => esc(x.nome)).join(' · ') : '—') + '</dd>' +
      '<dt>' + tr('Prazo da proposta') + '</dt><dd>' + (c.prazo ? dataHora(instante(c.prazo)) : '—') + '</dd>' +
      '<dt>' + tr('Serviço previsto') + '</dt><dd>' + (c.inicio ? dataCurta(c.inicio) : '—') + ' → ' + (c.termino ? dataCurta(c.termino) : '—') + '</dd>' +
      '<dt>' + tr('Orçamento') + '</dt><dd>' + (c.orcamento && c.orcamento.valor ? dinheiro(c.orcamento.valor) + ' · ' + MOSTRAR_ORCAMENTO[c.orcamento.mostrar] : '—') + '</dd>' +
      '<dt>' + tr('Exigências') + '</dt><dd>' + (exig.length ? exig.map(esc).join('<br>') : '—') + '</dd>' +
      '<dt>' + tr('Quarteirização') + '</dt><dd>' + QUARTEIRIZACAO[c.quarteirizacao || 'permitida'] + '</dd>' +
    '</dl></section></div>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Histórico') + '</h2>' +
      (c.historico.length ? '<ul class="lista-simples">' + c.historico.slice().reverse().map((h) => '<li><b>' + esc(h.acao) + '</b> · ' + dataHora(h.em) + ' · ' + esc(h.por) + (h.detalhe ? '<span class="mudo pequeno bloco">' + esc(h.detalhe) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="mudo">—</p>') +
    '</section>';
}

/* ---------- Convidada (docs/concorrencias.md §3.2) ---------- */

const PENDENTES = ['enviado', 'visto'];
export function convitesPendentes() { return recebidas().filter((x) => x.situacao === 'aberta' && PENDENTES.includes(x.convite.situacao)).length; }
const nomeContratante = (x) => (x.contratante || {}).nome || '—';
const textoLocal = (o) => (o ? [o.cidade, o.estado].filter(Boolean).join(', ') : '');

export function telaConvites(moldura) {
  const lista = recebidas().sort((a, b) => (a.situacao === 'aberta' ? 0 : 1) - (b.situacao === 'aberta' ? 0 : 1) || String(a.prazo).localeCompare(String(b.prazo)));
  return moldura({
    ativo: ativoBids('convites'), largura: 'larga', titulo: tr('Convites para cotar'), subtitulo: tr('Concorrências em que a sua empresa foi convidada'),
    conteudo: abasBids('recebidas') + (lista.length ? '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-convites"><thead><tr><th>' + tr('Serviço') + '</th><th>' + tr('Contratante') + '</th><th>' + tr('Obra') + '</th><th>' + tr('Prazo da proposta') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>' +
      lista.map((x) => '<tr><td><a href="#/measure/convite/' + x.id + '"><b>' + esc(x.servico) + '</b></a></td><td>' + esc(nomeContratante(x)) + '</td><td>' + esc(x.obra ? x.obra.nome : '—') + '<span class="mudo pequeno bloco">' + esc(textoLocal(x.obra)) + '</span></td>' +
        '<td>' + (x.situacao === 'aberta' ? textoPrazo(x) : x.prazo ? dataCurta(x.prazo.slice(0, 10)) : '—') + '</td>' +
        '<td>' + (x.situacao === 'cancelada' ? etiqueta('cancelada') : etiquetaConvite(x.convite)) + '</td></tr>').join('') + '</tbody></table></div></section>'
      : '<section class="cartao vazio-grande"><h2>' + tr('Nenhum convite ainda') + '</h2><p class="mudo">' + tr('Quando uma construtora (ou outra prestadora) convidar a sua empresa para cotar pelo KORbuild, o convite aparece aqui e no sininho.') + '</p></section>'),
  });
}

export function telaConvite(moldura, id) {
  let x = recebida(id);
  if (!x) return null;
  if (!x.convite.vistoEm) { marcarVisto(id); x = recebida(id); }
  const v = x.convite;
  const aberta = x.situacao === 'aberta';
  const pj = v.projetoId ? acharProjeto(v.projetoId) : null;
  const obraLigada = estado().obras.find((o) => o.concorrenciaId === x.id);
  const ex = x.exigencias || {};
  const lista = (itens) => (itens.length ? '<ul>' + itens.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p class="mudo">—</p>');
  const exig = [ex.glMinimo ? tr('GL mínimo de {valor}', { valor: dinheiro(ex.glMinimo) }) : '', ex.wcObrigatorio ? tr("Workers' comp obrigatório") : '', ex.licenca ? tr('Licença: {l}', { l: ex.licenca }) : '', ex.visita && ex.visita.obrigatoria ? tr('Visita à obra obrigatória') : ''].filter(Boolean);
  let situacao;
  if (x.situacao === 'cancelada') situacao = '<div class="aviso"><b>' + tr('Concorrência cancelada pela contratante.') + '</b></div>';
  else if (v.situacao === 'vencedora') situacao = '<div class="aviso aviso-verde"><b>' + tr('Você venceu esta concorrência.') + '</b><span>' + tr('Rev. {rev} aceita.', { rev: (v.propostas[v.propostas.length - 1] || {}).rev }) + ' ' +
    (obraLigada ? tr('A obra já está criada e ligada à da contratante.') : pj ? tr('Crie a obra a partir do projeto: ela já nasce ligada à obra da contratante.') : '') + '</span>' +
    (obraLigada ? '<a class="btn btn-primario btn-pequeno" href="' + (PRIMEIRA_VERSAO ? '#/conta/obras/' : '#/daily/obras/') + obraLigada.id + '">' + tr('Abrir a obra') + '</a>' : pj ? '<a class="btn btn-primario btn-pequeno" href="' + (estado().oficial ? '#/conta/obras/nova/' : '#/settings/obra/nova/') + pj.id + '">' + icone('obras', 16) + tr('Criar obra a partir deste projeto') + '</a>' : '') + '</div>';
  else if (v.situacao === 'nao-escolhida') situacao = '<div class="aviso"><b>' + tr('A contratante fechou com outra empresa.') + '</b><span>' + tr('Obrigado por cotar. O valor da vencedora não é informado.') + '</span></div>';
  else if (x.situacao === 'fechada') situacao = '<div class="aviso"><b>' + tr('Esta concorrência já foi fechada.') + '</b></div>';
  else if (!aberta) situacao = '<div class="aviso aviso-ambar"><b>' + tr('O prazo da proposta venceu.') + '</b><span>' + tr('Só dá para mandar proposta se a contratante prorrogar.') + '</span></div>';
  else if (v.situacao === 'nao-vai') situacao = '<div class="aviso"><b>' + tr('Você respondeu que não vai participar.') + '</b>' + (v.motivo ? '<span>“' + esc(v.motivo) + '”</span>' : '') + '</div>';
  else if (PENDENTES.includes(v.situacao)) situacao = '<div class="aviso aviso-ambar"><b>' + tr('Vai cotar?') + '</b><span>' + tr('Responda para a contratante saber com quem contar.') + '</span>' +
    '<span class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="cv-vou" data-id="' + x.id + '">' + tr('Vou cotar') + '</button><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cv-nao" data-id="' + x.id + '">' + tr('Não vou participar') + '</button></span></div>';
  else situacao = '<div class="aviso aviso-verde"><b>' + (v.propostas.length ? tr('Proposta enviada (rev. {rev}).', { rev: v.propostas.length }) : tr('Você vai cotar.')) + '</b><span>' +
    tr('Meça e monte a proposta no projeto. Emita a proposta e use "Enviar pela plataforma"; dá para mandar revisões até o prazo.') + '</span>' +
    (pj ? '<a class="btn btn-primario btn-pequeno" href="#/measure/projeto/' + pj.id + '">' + tr('Abrir o projeto') + '</a>' : '<button type="button" class="btn btn-primario btn-pequeno" data-acao="cv-projeto" data-id="' + x.id + '">' + tr('Criar o projeto no Measure') + '</button>') + '</div>';
  return moldura({
    ativo: ativoBids('convites'), largura: 'larga', titulo: x.servico, subtitulo: tr('Convite de {nome}', { nome: nomeContratante(x) }) + (x.obra ? ' · ' + x.obra.nome : ''),
    voltar: { href: '#/measure/convites', rotulo: tr('Convites') },
    conteudo: situacao +
      '<div class="grade-2">' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Escopo') + '</h2>' + blocoEscopo(x, lista) +
        (x.observacoes ? '<h3 class="rotulo-pequeno">' + tr('Observações') + '</h3><p>' + esc(x.observacoes) + '</p>' : '') + '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('O pacote') + '</h2><dl class="lista-dados">' +
        '<dt>' + tr('Prazo da proposta') + '</dt><dd><b>' + (x.prazo ? textoPrazo(x) : '—') + '</b></dd>' +
        '<dt>' + tr('Obra') + '</dt><dd>' + (x.obra ? esc(x.obra.nome) + '<span class="mudo bloco">' + esc([x.obra.endereco, textoLocal(x.obra)].filter(Boolean).join(' · ')) + '</span>' : '—') + '</dd>' +
        '<dt>' + tr('Etapas a cotar') + '</dt><dd>' + x.etapas.map(esc).join('<br>') + '</dd>' +
        '<dt>' + tr('Serviço previsto') + '</dt><dd>' + (x.inicio ? dataCurta(x.inicio) : '—') + ' → ' + (x.termino ? dataCurta(x.termino) : '—') + '</dd>' +
        '<dt>' + tr('Orçamento') + '</dt><dd>' + (x.orcamento.mostrar === 'nao' ? '<span class="mudo">' + tr('não informado') + '</span>' : dinheiro(x.orcamento.valor)) + '</dd>' +
        '<dt>' + tr('Exigências') + '</dt><dd>' + (exig.length ? exig.map(esc).join('<br>') : '—') + '</dd>' +
        '<dt>' + tr('Quarteirização') + '</dt><dd>' + QUARTEIRIZACAO[x.quarteirizacao || 'permitida'] + '</dd>' +
      '</dl></section></div>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Perguntas e mensagens') + '</h2>' + htmlMensagens(canalRecebido(x.id)) +
        ((aberta && v.situacao !== 'nao-vai') || v.situacao === 'vencedora' ? formMensagem('cv-escrever', { id: x.id }, v.situacao === 'vencedora' ? tr('Enviar') : tr('Perguntar'), v.situacao === 'vencedora' ? '' : tr('A contratante pode responder só para você ou para todas as convidadas (sem dizer quem perguntou).')) : '') + '</section>' +
      (v.propostas.length ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Suas propostas') + '</h2><ul class="lista-simples">' + v.propostas.slice().reverse().map((p) => '<li><b>' + tr('rev. {rev}', { rev: p.rev }) + ' · ' + dinheiro(p.total) + '</b> · ' + dataHora(p.enviadaEm) + (p.numero ? ' · ' + esc(p.numero) : '') + ' · ' + esc(p.por) + '</li>').join('') + '</ul>' +
        '<p class="mudo pequeno">' + tr('A contratante compara a revisão mais recente. Você nunca vê quem mais foi convidado nem os valores dos outros.') + '</p></section>' : ''),
  });
}

/* Na página do projeto do Measure: as concorrências que saíram dele (cotar com as suas prestadoras). */
/* As licitações (enviadas) que nasceram deste projeto. */
export function licitacoesDoProjeto(p) { return enviadas().filter((c) => doProjeto(c) && c.origem.id === p.id); }

export function htmlConcorrenciasDoProjeto(p, somenteLeitura) {
  if (!podeGerir()) return '';
  const lista = enviadas().filter((c) => doProjeto(c) && c.origem.id === p.id);
  const itens = lista.map((c) => '<li><a href="#/daily/concorrencias/' + c.id + '"><b>' + esc(c.servico) + '</b></a> ' + etiqueta(situacaoDe(c)) +
    '<span class="mudo pequeno bloco">' + tn(c.convites.filter((v) => v.propostas.length).length, '{n} proposta', '{n} propostas') + '</span></li>').join('');
  // no resumo do projeto: só leitura (a nova concorrência é criada no menu Bids)
  if (somenteLeitura) return '<section class="cartao"><h2 class="cartao-titulo">' + tr('Concorrências do projeto') + '</h2>' + (lista.length ? '<ul class="lista-simples">' + itens + '</ul>' : '<p class="vazio">' + tr('Nenhuma concorrência deste projeto ainda.') + '</p>') + '</section>';
  return '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Cotar com prestadoras') + '</h2>' +
    '<a class="btn btn-contorno btn-pequeno" href="#/daily/concorrencias/nova/projeto/' + p.id + '">' + icone('mais', 16) + tr('Nova concorrência') + '</a></div>' +
    (lista.length ? '<ul class="lista-simples">' + itens + '</ul>'
      : '<p class="mudo">' + tr('Parte do serviço vai para outra prestadora? Convide as suas prestadoras para cotar e use o preço delas neste orçamento.') + '</p>') + '</section>';
}

/* "Usar no meu orçamento": o preço da prestadora entra na proposta do projeto como outros itens, um por etapa,
 * com as suas margens por cima. Usar de novo (outra prestadora ou revisão) troca as linhas dessa concorrência. */
export function usarNoOrcamento(c, conviteId) {
  const pj = acharProjeto(c.origem.id);
  const v = c.convites.find((x) => x.id === conviteId);
  const p = ultimaProposta(v);
  if (!pj || !p) return { erro: tr('Proposta não encontrada.') };
  const m = margensEm();
  pj.proposta = pj.proposta || {};
  pj.proposta.extras = (pj.proposta.extras || []).filter((x) => !(x.origem && x.origem.concorrenciaId === c.id));
  const partes = Object.entries(p.porEtapa).concat(p.outros ? [[tr('Outros itens'), p.outros]] : []);
  if (!partes.length) partes.push([c.servico, p.total]);
  for (const [etapa, custo] of partes) {
    pj.proposta.extras.push({ descricao: tr('{etapa} (subempreiteiro: {nome}, rev. {rev})', { etapa, nome: v.nome, rev: p.rev }), valor: precoDeVenda(custo, m).venda, origem: { concorrenciaId: c.id, conviteId: v.id, rev: p.rev, etapa, custo } });
  }
  salvar();
  return { ok: true, linhas: partes.length };
}

/* Faixa na página do projeto que veio de um convite. */
export function htmlFaixaConcorrencia(p) {
  if (!p.concorrencia) return '';
  const x = recebida(p.concorrencia.id);
  if (!x) return '';
  return '<div class="aviso aviso-azul"><b>' + tr('Concorrência de {nome}', { nome: esc(nomeContratante(x)) }) + '</b><span>' +
    (x.situacao === 'aberta' ? tr('Prazo da proposta: {quando}', { quando: textoPrazo(x) }) : SITUACOES[x.situacao].nome) + ' · ' + SITUACOES_CONVITE[x.convite.situacao] + '</span>' +
    '<a class="btn btn-contorno btn-pequeno" href="#/measure/convite/' + x.id + '">' + tr('Ver o convite') + '</a></div>';
}

/* Botão "Enviar pela plataforma" de uma proposta emitida (só para projeto de concorrência aberta). */
export function botaoEnviarPelaPlataforma(p, numeroDoc) {
  if (!p.concorrencia || !podeResponder()) return '';
  const x = recebida(p.concorrencia.id);
  if (!x || x.situacao !== 'aberta' || x.convite.situacao === 'nao-vai') return '';
  const ja = x.convite.propostas.some((q) => q.numero === numeroDoc);
  return ja ? '<span class="etiqueta etiqueta-verde">' + tr('Enviada pela plataforma') + '</span>'
    : '<button type="button" class="btn btn-primario btn-pequeno" data-acao="cv-plataforma" data-projeto="' + p.id + '" data-numero="' + esc(numeroDoc) + '">' + tr('Enviar pela plataforma') + '</button>';
}

/* O contato da contratante nos Contatos da convidada: o que tem a mesma conta; se não houver, é criado. */
async function contatoDaContratante(x) {
  const achado = contatos().find((c) => c.contaId === x.contratanteId);
  if (achado) return achado.id;
  const e = x.contratante || {};
  if (estado().oficial) {
    // conta de verdade: o contato nasce no banco (o projeto aponta para ele) e entra no espelho na hora
    const mesmoNome = contatos().find((c) => c.nome.toLowerCase() === String(e.nome || '').toLowerCase());
    const sb = cliente();
    try {
      if (mesmoNome) {
        const { error } = await sb.from('contatos').update({ conta_empresa_id: x.contratanteId }).eq('id', mesmoNome.id);
        if (error) throw error;
        mesmoNome.contaId = x.contratanteId; salvar();
        return mesmoNome.id;
      }
      const { data, error } = await sb.from('contatos').insert({ nome: e.nome, email: e.email || '', telefone: e.telefone || '', papeis: ['construtora'], conta_empresa_id: x.contratanteId }).select('id').single();
      if (error) throw error;
      estado().contatos.push({ id: data.id, nome: e.nome, pessoa: '', papeis: ['construtora'], email: e.email || '', telefone: e.telefone || '', endereco: '', cidade: '', estado: '', zip: '', etapas: [], notas: '', contaId: x.contratanteId });
      salvar();
      return data.id;
    } catch (err) { console.error(err); return null; }
  }
  const r = salvarContato(null, { nome: e.nome, email: e.email || '', telefone: e.telefone || '', papeis: ['construtora'] }, quem());
  if (r.erro) return null;
  const novo = contatos().find((c) => c.nome === e.nome);
  if (novo) { novo.contaId = x.contratanteId; salvar(); }
  return novo ? novo.id : null;
}

async function criarProjetoDoConvite(x) {
  const ct = await contatoDaContratante(x);
  if (!ct) return { erro: tr('Não foi possível cadastrar a contratante nos seus Contatos.') };
  const o = x.obra || {};
  const r = salvarProjeto(null, {
    nome: x.servico + (o.nome ? ' · ' + o.nome : ''), contratanteId: ct, endereco: o.endereco, cidade: o.cidade, estado: o.estado, zip: o.zip,
    tipo: 'outro', situacao: 'orcamento', descricao: x.escopo || x.incluso.join('; '), estimadorId: (usuarioAtual() || {}).id, prazoProposta: x.prazo ? x.prazo.slice(0, 10) : '',
  });
  if (r.erro) return r;
  acharProjeto(r.id).concorrencia = { id: x.id, conviteId: x.convite.id, contratanteId: x.contratanteId };
  const v = await vincularProjeto(x.id, r.id);
  if (v && v.erro) return v;
  // conta de verdade: os desenhos da contratante viram cópias no projeto (bucket da convidada), folha a folha
  if (estado().oficial) {
    let falhou = 0;
    for (const d of x.desenhos || []) {
      if (!d.path) continue;
      try {
        const { data, error } = await cliente().storage.from('concorrencias').createSignedUrl(d.path, 600);
        if (error) throw error;
        const resp = await fetch(data.signedUrl);
        if (!resp.ok) throw new Error('desenho ' + resp.status);
        await importarPdfNoProjeto(r.id, new File([await resp.blob()], d.nome + '.pdf', { type: 'application/pdf' }));
      } catch (e) { console.error('cópia do desenho ' + d.path + ': ' + (e && e.message ? e.message : e)); falhou++; }
    }
    if (falhou) toast(tn(falhou, 'Um desenho não pôde ser copiado: envie o PDF no projeto.', '{n} desenhos não puderam ser copiados: envie os PDFs no projeto.'));
  }
  return r;
}

/* De uma proposta emitida no Measure para a proposta da concorrência: as linhas cujo código bate com uma etapa
 * da concorrência vão por etapa; as outras linhas e os outros itens vão em "outros". */
export function propostaParaConcorrencia(x, emitida) {
  const porEtapa = {};
  let outros = 0;
  const codigo = (e) => (e.includes(' · ') ? e.split(' · ')[0] : e);
  for (const l of emitida.dados.linhas) {
    const e = x.etapas.find((et) => (l.codigo && codigo(et) === l.codigo) || et === l.titulo);
    if (e) porEtapa[e] = Math.round(((porEtapa[e] || 0) + l.valor) * 100) / 100;
    else outros += l.valor;
  }
  for (const ex of emitida.dados.extras) outros += ex.valor;
  return { porEtapa, outros: Math.round(outros * 100) / 100, total: emitida.total };
}

/* ---------- Pelo link, sem conta (CO-07, §3.3) ---------- */

export const linkDoConvite = (token) => location.origin + location.pathname + (estado().oficial ? '' : '?demo') + '#/convite/' + token;

/* Os links dos convidados sem conta, para copiar (o banco entrega o token uma vez, ao enviar). */
async function mostrarLinks() { /* sem popup: o link de cada convidado sem conta fica na tabela, em "Copiar o link" */ }

/* A tabela de documentos de uma concorrência (a mesma forma do formulário, só leitura). */
function tabelaDeDocumentos(docs) {
  if (!docs || !docs.length) return '<p class="mudo">' + tr('Nenhum documento anexado.') + '</p>';
  return '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Código') + '</th><th>' + tr('Descrição') + '</th><th>' + tr('Arquivo') + '</th><th>' + tr('Tamanho') + '</th><th>' + tr('Observação') + '</th><th></th></tr></thead><tbody>' +
    docs.map((d, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(d.nome) + '</td><td>' + esc(d.nome) + '.pdf</td><td>' + (d.tamanho ? tamanhoLegivel(d.tamanho) : '—') + '</td><td>' + esc(d.observacao || '') + '</td><td>' +
      (d.url ? '<a class="btn btn-contorno btn-pequeno" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + tr('Abrir') + '</a>' : '<span class="mudo pequeno">' + tr('indisponível') + '</span>') + '</td></tr>').join('') + '</tbody></table></div>';
}

/* Para quem abre o convite sem conta: o que o KORbuild faz por ela. */
function cartaoConta() {
  return '<section class="cartao cartao-conta"><div><h2 class="cartao-titulo">' + tr('Cote mais rápido com o KORbuild Takeoff') + '</h2>' +
    '<p>' + tr('Meça as plantas na tela, gere a lista de materiais e acompanhe convites e propostas num só lugar.') + '</p>' +
    '<p class="mudo pequeno">' + tr('Use o mesmo e-mail deste convite: o convite, as mensagens e as propostas vêm junto.') + '</p></div>' +
    '<a class="btn btn-primario" href="' + esc(location.pathname) + '">' + tr('Entrar ou criar conta') + '</a></section>';
}

export function telaConvitePublico(token, marca) {
  let x = porToken(token);
  if (!x) return '<main class="pagina pagina-estreita"><div class="aviso aviso-ambar"><b>' + tr('Convite não encontrado') + '</b><span>' + (estado() && estado().oficial ? tr('Confira o link: ele pode estar incompleto, ou a concorrência foi encerrada.') : tr('Confira o link. No protótipo não há servidor, então o link só abre no mesmo navegador em que a concorrência foi enviada.')) + '</span></div></main>';
  if (!x.convite.vistoEm && !estado().oficial) { marcarVisto(x.id, { token }); x = porToken(token); }
  const v = x.convite;
  const aberta = x.situacao === 'aberta';
  const ex = x.exigencias || {};
  const lista = (itens) => (itens.length ? '<ul>' + itens.map((i) => '<li>' + esc(i) + '</li>').join('') + '</ul>' : '<p class="mudo">—</p>');
  const exig = [ex.glMinimo ? tr('GL mínimo de {valor}', { valor: dinheiro(ex.glMinimo) }) : '', ex.wcObrigatorio ? tr("Workers' comp obrigatório") : '', ex.licenca ? tr('Licença: {l}', { l: ex.licenca }) : '', ex.visita && ex.visita.obrigatoria ? tr('Visita à obra obrigatória') : ''].filter(Boolean);
  let situacao;
  if (x.situacao === 'cancelada') situacao = '<div class="aviso"><b>' + tr('Concorrência cancelada pela contratante.') + '</b></div>';
  else if (v.situacao === 'vencedora') situacao = '<div class="aviso aviso-verde"><b>' + tr('Você venceu esta concorrência.') + '</b><span>' + tr('A contratante vai entrar em contato. Crie a sua conta no KORbuild com este e-mail para receber a obra, o diário e o cronograma.') + '</span></div>';
  else if (v.situacao === 'nao-escolhida') situacao = '<div class="aviso"><b>' + tr('A contratante fechou com outra empresa.') + '</b><span>' + tr('Obrigado por cotar. O valor da vencedora não é informado.') + '</span></div>';
  else if (x.situacao === 'fechada') situacao = '<div class="aviso"><b>' + tr('Esta concorrência já foi fechada.') + '</b></div>';
  else if (!aberta) situacao = '<div class="aviso aviso-ambar"><b>' + tr('O prazo da proposta venceu.') + '</b><span>' + tr('Só dá para mandar proposta se a contratante prorrogar.') + '</span></div>';
  else if (v.situacao === 'nao-vai') situacao = '<div class="aviso"><b>' + tr('Você respondeu que não vai participar.') + '</b>' + (v.motivo ? '<span>“' + esc(v.motivo) + '”</span>' : '') + '</div>';
  else if (PENDENTES.includes(v.situacao)) situacao = '<div class="aviso aviso-ambar"><b>' + tr('Vai cotar?') + '</b><span>' + tr('Responda para a contratante saber com quem contar.') + '</span>' +
    '<span class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="lk-vou" data-token="' + esc(token) + '">' + tr('Vou cotar') + '</button><button type="button" class="btn btn-contorno btn-pequeno" data-acao="lk-nao" data-token="' + esc(token) + '">' + tr('Não vou participar') + '</button></span></div>';
  else situacao = '<div class="aviso aviso-verde"><b>' + (v.propostas.length ? tr('Proposta enviada (rev. {rev}).', { rev: v.propostas.length }) : tr('Você vai cotar.')) + '</b><span>' + tr('Mande a proposta abaixo, com o PDF. Dá para mandar revisões até o prazo.') + '</span></div>';
  const podeMandar = aberta && v.situacao !== 'nao-vai';
  const formProposta = podeMandar && !PENDENTES.includes(v.situacao) ? '<section class="cartao"><h2 class="cartao-titulo">' + (v.propostas.length ? tr('Mandar uma revisão') : tr('Mandar a proposta')) + '</h2>' +
    '<form id="form-link" class="form-settings" data-sem-envio><div class="grade-campos">' +
      campo('lk-total', tr('Total (US$) *'), '<input type="text" inputmode="decimal" id="lk-total" name="total">') +
      campo('lk-prazo', tr('Prazo de execução (dias)'), '<input type="number" id="lk-prazo" name="prazo" min="1">') + '</div>' +
      campo('lk-pdf', tr('Proposta em PDF'), '<input type="file" id="lk-pdf" name="pdf" accept="application/pdf">') +
      '<details class="co-por-etapa"><summary class="pequeno">' + tr('Valor por etapa (opcional)') + '</summary><div class="grade-campos">' +
        x.etapas.map((e, i) => campo('lk-et-' + i, esc(e), '<input type="text" inputmode="decimal" id="lk-et-' + i + '" name="etapa" data-etapa="' + esc(e) + '">')).join('') + '</div>' +
        '<p class="mudo pequeno">' + tr('Se informar, o total precisa ser a soma das etapas. Etapa em branco fica "não cotada".') + '</p></details>' +
      campo('lk-exclusoes', tr('Exclusões (uma por linha)'), '<textarea id="lk-exclusoes" name="exclusoes" rows="3"></textarea>') +
      '<div class="rodape-form"><button type="button" class="btn btn-primario" data-acao="lk-enviar" data-token="' + esc(token) + '">' + tr('Enviar a proposta') + '</button></div>' +
    '</form></section>' : '';
  return '<header class="cliente-topo"><div class="cliente-empresa"><div><span class="mudo">' + tr('Convite para cotar de') + '</span><b>' + esc(nomeContratante(x)) + '</b></div></div>' +
      '<span class="cliente-via">' + marca(18) + 'KORbuild</span></header>' +
    '<main class="pagina pagina-larga convite-publico">' +
      '<h1>' + esc(x.servico) + '</h1><p class="mudo">' + esc(x.obra ? x.obra.nome + ' · ' + textoLocal(x.obra) : '') + ' · ' + tr('para {nome}', { nome: esc(v.nome) }) + '</p>' +
      '<div class="co-kpis co-kpis-4"><div class="co-kpi"><span>' + tr('Prazo da proposta') + '</span><b>' + (x.prazo ? dataCurta(x.prazo.slice(0, 10)) + ' · ' + x.prazo.slice(11, 16) : '—') + '</b></div>' +
        '<div class="co-kpi"><span>' + tr('Faltam') + '</span><b>' + (x.prazo && aberta ? textoPrazo(x).replace(/^.*·\s*/, '') : '—') + '</b></div>' +
        '<div class="co-kpi"><span>' + tr('Etapas a cotar') + '</span><b>' + x.etapas.map(esc).join(' · ') + '</b></div>' +
        '<div class="co-kpi"><span>' + tr('Serviço previsto') + '</span><b>' + (x.inicio ? dataCurta(x.inicio) : '—') + ' → ' + (x.termino ? dataCurta(x.termino) : '—') + '</b></div></div>' +
      situacao +
      '<div class="grade-2">' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Escopo') + '</h2>' + blocoEscopo(x, lista) +
        (x.observacoes ? '<h3 class="rotulo-pequeno">' + tr('Observações') + '</h3><p>' + esc(x.observacoes) + '</p>' : '') + '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('O pacote') + '</h2><dl class="lista-dados">' +
        '<dt>' + tr('Prazo da proposta') + '</dt><dd><b>' + (x.prazo ? textoPrazo(x) : '—') + '</b></dd>' +
        '<dt>' + tr('Etapas a cotar') + '</dt><dd>' + x.etapas.map(esc).join('<br>') + '</dd>' +
        '<dt>' + tr('Desenhos') + '</dt><dd>' + (x.desenhos.length ? x.desenhos.map((d) => d.url ? '<a href="' + esc(d.url) + '" target="_blank" rel="noopener">' + esc(d.nome) + '.pdf</a>' : esc(d.nome)).join(' · ') : '—') + '</dd>' +
        '<dt>' + tr('Serviço previsto') + '</dt><dd>' + (x.inicio ? dataCurta(x.inicio) : '—') + ' → ' + (x.termino ? dataCurta(x.termino) : '—') + '</dd>' +
        '<dt>' + tr('Orçamento') + '</dt><dd>' + (x.orcamento.mostrar === 'nao' ? '<span class="mudo">' + tr('não informado') + '</span>' : dinheiro(x.orcamento.valor)) + '</dd>' +
        '<dt>' + tr('Exigências') + '</dt><dd>' + (exig.length ? exig.map(esc).join('<br>') : '—') + '</dd>' +
      '</dl></section></div>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Documentos do projeto') + '</h2>' + tabelaDeDocumentos(x.desenhos) + '</section>' +
      cartaoConta() +
      formProposta +
      (v.propostas.length ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Suas propostas') + '</h2><ul class="lista-simples">' + v.propostas.slice().reverse().map((q) => '<li><b>' + tr('rev. {rev}', { rev: q.rev }) + ' · ' + dinheiro(q.total) + '</b> · ' + dataHora(q.enviadaEm) + (q.pdf && q.pdf.nome ? ' · ' + esc(q.pdf.nome) : '') + '</li>').join('') + '</ul></section>' : '') +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Perguntas e mensagens') + '</h2>' + htmlMensagens(canalPorToken(token)) +
        (podeMandar ? formMensagem('lk-perguntar', { token }, tr('Perguntar'), tr('A contratante pode responder só para você ou para todas as convidadas (sem dizer quem perguntou).')) : '') + '</section>' +
      '<p class="mudo pequeno convite-rodape">' + tr('Este link é só seu e só abre este convite.') + ' <a href="' + esc(location.pathname) + '">' + tr('Entrar ou criar conta') + '</a></p>' +
    '</main>';
}

/* ---------- Ações ---------- */

const textoDe = (el) => { const t = el.closest('.co-escrever').querySelector('textarea'); return t ? t.value : ''; };

export const acoesConcorrencias = {
  async 'co-link'(el) {
    const link = linkDoConvite(el.dataset.token);
    try { await navigator.clipboard.writeText(link); toast(tr('Link copiado. No produto, ele vai por e-mail para a prestadora.')); }
    catch (e) { await abrirDialogo({ titulo: tr('Link do convite'), corpo: '<input type="text" readonly value="' + esc(link) + '">', acoes: [{ rotulo: tr('Fechar'), valor: true }] }); }
  },
  async 'lk-vou'(el) {
    const r = await responder(porToken(el.dataset.token).id, true, '', '', { token: el.dataset.token });
    toast(r.erro || tr('Resposta enviada à contratante.'));
    app.desenhar();
  },
  async 'lk-nao'(el) {
    const res = await abrirDialogo({
      titulo: tr('Não vai participar?'),
      corpo: campo('lk-motivo', tr('Motivo (opcional, a contratante vê)'), '<input type="text" id="lk-motivo" name="motivo" placeholder="' + esc(tr('Ex.: agenda cheia')) + '">'),
      acoes: [{ rotulo: tr('Voltar'), valor: false }, { rotulo: tr('Não vou participar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await responder(porToken(el.dataset.token).id, false, res.campos.motivo, '', { token: el.dataset.token });
    toast(r.erro || tr('Resposta enviada à contratante.'));
    app.desenhar();
  },
  async 'lk-enviar'(el) {
    const token = el.dataset.token;
    const x = porToken(token);
    const form = document.getElementById('form-link');
    const fd = new FormData(form);
    const num = (t) => { const n = lerValor(t); return n == null || Number.isNaN(n) ? '' : n; };
    const porEtapa = {};
    form.querySelectorAll('[name="etapa"]').forEach((i) => { if (i.value.trim()) porEtapa[i.dataset.etapa] = num(i.value); });
    const arquivo = (document.getElementById('lk-pdf').files || [])[0];
    if (!arquivo) { toast(tr('Anexe a proposta em PDF.')); return; }
    const r = await enviarProposta(x.id, { total: num(fd.get('total')), porEtapa, prazoExecucaoDias: fd.get('prazo'), exclusoes: fd.get('exclusoes'), pdf: { nome: arquivo.name, arquivo } }, x.convite.nome, { token });
    toast(r.erro || tr('Proposta enviada (rev. {rev}).', { rev: r.rev }));
    if (r.ok) app.desenhar();
  },
  async 'lk-perguntar'(el) {
    const x = porToken(el.dataset.token);
    const r = await escreverComoConvidada(x.id, textoDe(el), '', { token: el.dataset.token });
    toast(r.erro || tr('Mensagem enviada.'));
    if (r.ok) app.desenhar();
  },
  async 'co-usar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const r = usarNoOrcamento(c, el.dataset.convite);
    toast(r.erro || tn(r.linhas, 'Preço levado à proposta do projeto (1 linha, com as suas margens).', 'Preço levado à proposta do projeto ({n} linhas, com as suas margens).'));
  },
  async 'co-aprovar-q'(el) {
    const r = await decidirQuarteirizacao(el.dataset.id, true, '', quem());
    toast(r.erro || tr('Quarteirização aprovada.'));
    if (r.ok) app.desenhar();
  },
  async 'co-recusar-q'(el) {
    const res = await abrirDialogo({
      titulo: tr('Recusar a quarteirização?'),
      corpo: campo('rq-motivo', tr('Motivo (a contratada vê)'), '<input type="text" id="rq-motivo" name="motivo">'),
      acoes: [{ rotulo: tr('Voltar'), valor: false }, { rotulo: tr('Recusar'), valor: true, classe: 'btn-perigo' }],
    });
    if (!res || !res.valor) return;
    const r = await decidirQuarteirizacao(el.dataset.id, false, res.campos.motivo, quem());
    toast(r.erro || tr('Quarteirização recusada.'));
    if (r.ok) app.desenhar();
  },
  async 'co-escrever'(el) {
    const r = await escreverComoContratante(el.dataset.id, { conviteId: el.dataset.convite, texto: textoDe(el) }, quem());
    toast(r.erro || tr('Mensagem enviada.'));
    if (r.ok) app.desenhar();
  },
  async 'co-aviso'(el) {
    const texto = textoDe(el);
    if (!texto.trim()) { toast(tr('Escreva a mensagem.')); return; }
    if (!(await confirmar(tr('Avisar todas as convidadas?'), texto, tr('Avisar a todos')))) return;
    const r = await escreverComoContratante(el.dataset.id, { conviteId: null, texto }, quem());
    toast(r.erro || tr('Aviso enviado a todas as convidadas.'));
    if (r.ok) app.desenhar();
  },
  async 'co-responder'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const q = canalDaContratante(c).find((m) => m.id === el.dataset.msg);
    const res = await abrirDialogo({
      titulo: tr('Responder'),
      corpo: '<p class="co-citacao">' + esc(q.texto) + '</p>' + campo('rs-texto', tr('Resposta'), '<textarea id="rs-texto" name="texto" rows="3" required></textarea>') +
        '<fieldset class="co-para"><legend class="rotulo-pequeno">' + tr('Para quem') + '</legend>' +
          '<label class="check"><input type="radio" name="para" value="todos" checked> ' + tr('Todas as convidadas (a pergunta vai junto, sem dizer quem perguntou)') + '</label>' +
          '<label class="check"><input type="radio" name="para" value="um"> ' + tr('Só para quem perguntou') + '</label></fieldset>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Responder'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await escreverComoContratante(c.id, { respostaDe: q.id, paraTodos: res.campos.para === 'todos', texto: res.campos.texto }, quem());
    toast(r.erro || (res.campos.para === 'todos' ? tr('Resposta enviada a todas as convidadas.') : tr('Resposta enviada.')));
    if (r.ok) app.desenhar();
  },
  async 'cv-escrever'(el) {
    const r = await escreverComoConvidada(el.dataset.id, textoDe(el), quem());
    toast(r.erro || tr('Mensagem enviada.'));
    if (r.ok) app.desenhar();
  },
  async 'cv-vou'(el) {
    const r = await responder(el.dataset.id, true, '', quem());
    if (r.erro) { toast(r.erro); return; }
    const pj = await criarProjetoDoConvite(recebida(el.dataset.id));
    if (pj.erro) { toast(pj.erro); app.desenhar(); return; }
    toast(tr('Projeto criado no Measure. Meça, monte a proposta e envie pela plataforma.'));
    app.ir('#/measure/projeto/' + pj.id);
  },
  async 'cv-projeto'(el) {
    const pj = await criarProjetoDoConvite(recebida(el.dataset.id));
    if (pj.erro) { toast(pj.erro); return; }
    toast(tr('Projeto criado no Measure.'));
    app.ir('#/measure/projeto/' + pj.id);
  },
  async 'cv-nao'(el) {
    const res = await abrirDialogo({
      titulo: tr('Não vai participar?'),
      corpo: campo('cv-motivo', tr('Motivo (opcional, a contratante vê)'), '<input type="text" id="cv-motivo" name="motivo" placeholder="' + esc(tr('Ex.: agenda cheia')) + '">'),
      acoes: [{ rotulo: tr('Voltar'), valor: false }, { rotulo: tr('Não vou participar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await responder(el.dataset.id, false, res.campos.motivo, quem());
    toast(r.erro || tr('Resposta enviada à contratante.'));
    app.desenhar();
  },
  async 'cv-plataforma'(el) {
    const p = acharProjeto(el.dataset.projeto);
    const x = recebida(p.concorrencia.id);
    const emitida = (p.propostas || []).find((q) => q.numero === el.dataset.numero);
    const m = propostaParaConcorrencia(x, emitida);
    const naoCotadas = x.etapas.filter((e) => m.porEtapa[e] == null);
    const res = await abrirDialogo({
      titulo: tr('Enviar a proposta {numero} para {nome}?', { numero: emitida.numero, nome: nomeContratante(x) }),
      corpo: '<table class="tabela"><tbody>' + x.etapas.map((e) => '<tr><td>' + esc(e) + '</td><td class="num">' + (m.porEtapa[e] != null ? dinheiro(m.porEtapa[e]) : '<span class="mudo">' + tr('não cotada') + '</span>') + '</td></tr>').join('') +
          (m.outros ? '<tr><td>' + tr('Outros itens (fora das etapas)') + '</td><td class="num">' + dinheiro(m.outros) + '</td></tr>' : '') + '<tr><td><b>' + tr('Total') + '</b></td><td class="num"><b>' + dinheiro(m.total) + '</b></td></tr></tbody></table>' +
        (naoCotadas.length ? '<p class="texto-alerta pequeno">' + tn(naoCotadas.length, '{n} etapa da concorrência fica sem preço (não cotada).', '{n} etapas da concorrência ficam sem preço (não cotadas).') + '</p>' : '') +
        '<div class="grade-campos">' + campo('cv-prazo', tr('Prazo de execução (dias)'), '<input type="number" id="cv-prazo" name="prazo" min="1" step="1">') + '</div>' +
        campo('cv-exclusoes', tr('Exclusões (uma por linha)'), '<textarea id="cv-exclusoes" name="exclusoes" rows="3">' + esc(x.excluso.join('\n')) + '</textarea>') +
        '<p class="mudo pequeno">' + tr('O PDF da proposta vai junto. Depois de enviada, não se edita: uma nova emissão vira a revisão seguinte.') + '</p>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Enviar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await enviarProposta(x.id, { ...m, numero: emitida.numero, propostaEmitidaId: emitida._banco ? emitida.id : null, prazoExecucaoDias: res.campos.prazo, exclusoes: res.campos.exclusoes, pdf: { numero: emitida.numero } }, quem());
    toast(r.erro || tr('Proposta enviada para {nome} (rev. {rev}).', { nome: nomeContratante(x), rev: r.rev }));
    if (r.ok) app.desenhar();
  },
  async 'co-aba'(el) {
    for (const b of document.querySelectorAll('#form-concorrencia [data-acao="co-aba"]')) { const on = b === el; b.classList.toggle('ativa', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    for (const sec of document.querySelectorAll('#form-concorrencia section[data-aba]')) sec.hidden = sec.dataset.aba !== el.dataset.aba;
  },
  async 'co-anexar'() {
    const campoArq = document.getElementById('co-arquivo');
    const arqs = Array.from(campoArq.files || []);
    if (!arqs.length) { toast(tr('Escolha pelo menos um arquivo.')); return; }
    const desc = document.getElementById('co-descricao').value.trim(), obs = document.getElementById('co-obs-anexo').value.trim();
    for (const f of arqs) anexosNovos.push({ nome: arqs.length === 1 && desc ? desc : (desc ? desc + ' · ' : '') + f.name.replace(/\.pdf$/i, ''), observacao: obs, arquivo: f });
    campoArq.value = ''; document.getElementById('co-descricao').value = ''; document.getElementById('co-obs-anexo').value = '';
    desenharAnexos();
  },
  async 'co-tirar-anexo'(el) {
    const k = el.dataset.k;
    if (k[0] === 'n') anexosNovos.splice(Number(k.slice(1)), 1);
    else { const a = atuaisDoForm(); a.splice(Number(k.slice(1)), 1); document.querySelector('#form-concorrencia [name="desenhosAtuais"]').value = JSON.stringify(a); }
    desenharAnexos();
  },
  'co-tarefa-add'() {
    const sel = document.getElementById('co-tarefa-sel');
    const op = sel && sel.selectedOptions[0];
    if (!op || !op.value) { toast(tr('Escolha uma tarefa na lista.')); return; }
    const corpo = document.querySelector('#co-tarefas-grade tbody');
    corpo.insertAdjacentHTML('beforeend', linhaDeTarefa({ nome: op.value, inicio: op.dataset.inicio || '', dias: op.dataset.dias || '' }));
    op.remove();
    sel.value = '';
    document.getElementById('co-tarefas-grade').hidden = false;
    document.getElementById('co-tarefas-vazio').hidden = true;
    sugerirTitulo();
    sugerirDatas();
  },
  'co-tarefa-tirar'(el) {
    const linha = el.closest('tr'), sel = document.getElementById('co-tarefa-sel');
    if (sel && !linha.querySelector('.mudo')) {
      const o = document.createElement('option');
      o.value = linha.dataset.tarefa; o.textContent = linha.dataset.tarefa; o.dataset.inicio = linha.dataset.inicio; o.dataset.dias = linha.dataset.dias;
      sel.appendChild(o);
    }
    linha.remove();
    const vazio = !document.querySelector('#co-tarefas-grade tbody tr');
    document.getElementById('co-tarefas-grade').hidden = vazio;
    document.getElementById('co-tarefas-vazio').hidden = !vazio;
    sugerirTitulo();
    sugerirDatas();
  },
  async 'co-salvar'(el) {
    if (el.disabled) return;
    el.disabled = true;
    try {
      // arquivo escolhido mas ainda sem clicar em Anexar: entra junto, para não se perder
      if ((document.getElementById('co-arquivo') || { files: [] }).files.length) await acoesConcorrencias['co-anexar']();
      const { id, dados } = dadosDoForm();
      if (dados.plantasProjeto.length && dados.origem) dados.desenhosNovos = dados.desenhosNovos.concat(await arquivosDasPlantas(dados.origem.id, dados.plantasProjeto, dados.observacoesPlantas));
      dados.desenhos = dados.desenhos.concat(dados.desenhosNovos.filter((n) => !dados.desenhos.some((x) => x.nome === n.nome)).map((n) => ({ nome: n.nome, observacao: n.observacao })));
      const r = await salvarRascunho(id, dados, quem());
      if (r.id) document.getElementById('form-concorrencia').dataset.id = r.id;   // se falhou depois de criar, a próxima tentativa atualiza o mesmo rascunho
      if (r.erro) { toast(r.erro); return; }
      toast(tr('Rascunho salvo.'));
      app.ir('#/daily/concorrencias/' + r.id);
    } catch (e) {
      console.error(e);
      toast(tr('Não foi possível salvar: {erro}', { erro: (e && e.message) || String(e) }));
    } finally { el.disabled = false; }
  },
  async 'co-enviar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    if (!c.desenhos.length && !(await confirmar(tr('Sem desenhos anexados'), tr('Quem for cotar não vai ver nenhum desenho da obra. Enviar assim mesmo?'), tr('Enviar sem desenhos')))) return;
    if (!(await confirmar(tr('Enviar os convites?'), tn(c.convites.length, 'A prestadora recebe o pacote para cotar. Depois de enviado, só dá para prorrogar o prazo, convidar mais ou cancelar.', 'As {n} prestadoras recebem o pacote para cotar. Depois de enviado, só dá para prorrogar o prazo, convidar mais ou cancelar.'), tr('Enviar')))) return;
    const r = await enviar(c.id, quem());
    toast(r.erro || tr('Convites enviados.'));
    if (r.ok) await mostrarLinks(r.links);
    app.desenhar();
  },
  async 'co-prorrogar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const [d, h] = c.prazo.split('T');
    const res = await abrirDialogo({
      titulo: tr('Prorrogar o prazo'),
      corpo: '<div class="grade-campos">' + campo('pr-data', tr('Novo prazo'), '<input type="date" id="pr-data" name="data" value="' + d + '" required>') + campo('pr-hora', tr('Hora'), '<input type="time" id="pr-hora" name="hora" value="' + h + '" required>') + '</div>' +
        campo('pr-motivo', tr('Motivo (vai para o histórico)'), '<input type="text" id="pr-motivo" name="motivo">') +
        '<p class="mudo pequeno">' + tr('As convidadas são avisadas e podem mandar propostas até o novo prazo.') + '</p>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Prorrogar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await prorrogar(c.id, res.campos.data + 'T' + res.campos.hora, res.campos.motivo, quem());
    toast(r.erro || tr('Prazo prorrogado.'));
    if (r.ok) app.desenhar();
  },
  async 'co-convidar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const ja = c.convites.map((v) => v.contatoId);
    const livres = contatosCom('prestadora').filter((p) => !ja.includes(p.id));
    if (!livres.length) { toast(tr('Todas as prestadoras dos seus Contatos já foram convidadas.')); return; }
    const res = await abrirDialogo({
      titulo: tr('Convidar mais prestadoras'),
      corpo: livres.map((p) => '<label class="check"><input type="checkbox" name="cv-' + p.id + '" value="' + p.id + '"> ' + esc(p.nome) + ' ' + (contaDoContato(p) ? '<span class="etiqueta etiqueta-verde">' + tr('Tem KORbuild') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + tr('Recebe por link') + '</span>') + '</label>').join(''),
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Convidar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const ids = Object.values(res.campos);
    if (!ids.length) { toast(tr('Marque pelo menos uma prestadora.')); return; }
    const r = await convidarMais(c.id, ids, quem());
    toast(r.erro || tn(ids.length, 'Convite enviado.', '{n} convites enviados.'));
    if (r.ok) { await mostrarLinks(r.links); app.desenhar(); }
  },
  async 'co-fechar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const v = c.convites.find((x) => x.id === el.dataset.convite);
    const p = ultimaProposta(v);
    const cmp = comparar(c).colunas.find((k) => k.conviteId === v.id);
    const alertas = [cmp.naoCotadas.length ? tn(cmp.naoCotadas.length, '{n} etapa não cotada', '{n} etapas não cotadas') : '', cmp.exclusoesNoEscopo.length ? tr('exclui o que está no escopo: {itens}', { itens: cmp.exclusoesNoEscopo.join(', ') }) : ''].filter(Boolean);
    const res = await abrirDialogo({
      titulo: tr('Fechar com {nome}?', { nome: v.nome }),
      corpo: '<p><b>' + dinheiro(p.total) + '</b> · ' + tr('rev. {rev}', { rev: p.rev }) + (p.prazoExecucaoDias ? ' · ' + tn(p.prazoExecucaoDias, '{n} dia', '{n} dias') : '') + '</p>' +
        (alertas.length ? '<div class="aviso aviso-ambar"><b>' + tr('Atenção') + '</b><span>' + esc(alertas.join(' · ')) + '</span></div>' : '') +
        campo('fe-obs', tr('Observação (opcional)'), '<input type="text" id="fe-obs" name="observacao">') +
        '<p class="mudo pequeno">' + tr('A concorrência fica fechada e não muda mais. As outras prestadoras são avisadas de que não foram escolhidas, sem ver o valor.') + '</p>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Fechar negócio'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = await fechar(c.id, v.id, res.campos.observacao, quem());
    toast(r.erro || (r.pendente ? tr('Pedido de aprovação enviado a quem contratou a sua empresa.') : tr('Fechada com {nome}.', { nome: v.nome })));
    if (r.ok) app.ir('#/daily/concorrencias/' + c.id);
  },
  async 'co-cancelar'(el) {
    const c = concorrenciaEnviada(el.dataset.id);
    const rascunho = c.situacao === 'rascunho';
    const res = await abrirDialogo({
      titulo: rascunho ? tr('Excluir o rascunho?') : tr('Cancelar a concorrência?'),
      corpo: rascunho ? '<p>' + tr('Ninguém recebeu este rascunho. Ele é apagado.') + '</p><input type="hidden" name="motivo" value="rascunho">'
        : campo('ca-motivo', tr('Motivo *'), '<input type="text" id="ca-motivo" name="motivo" required>') + '<p class="mudo pequeno">' + tr('As convidadas são avisadas. A concorrência fica no histórico, cancelada.') + '</p>',
      acoes: [{ rotulo: tr('Voltar'), valor: false }, { rotulo: rascunho ? tr('Excluir') : tr('Cancelar a concorrência'), valor: true, classe: 'btn-perigo' }],
    });
    if (!res || !res.valor) return;
    const r = await cancelar(c.id, res.campos.motivo, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(r.excluida ? tr('Rascunho excluído.') : tr('Concorrência cancelada.'));
    app.ir(r.excluida ? '#/daily/concorrencias' : '#/daily/concorrencias/' + c.id);
  },
};


if (typeof document !== 'undefined') {
  document.addEventListener('change', (ev) => {
    const el = ev.target;
    if (el && el.matches && el.matches('[data-co-projeto]') && el.value) location.hash = '#/daily/concorrencias/nova/projeto/' + el.value;
  });
}
