/* KORbuild — o Início da 1ª versão como painel (docs/prompt-dashboard-inicio.md). Só desenha o que js/inicio-calculo.js devolve:
 * blocos pequenos, números grandes, barras e rosca em SVG/CSS (sem biblioteca). Cada item leva à lista correspondente. */

import { esc, dataCurta } from './util.js';
import { tr, tn, idioma } from './i18n.js';
import { icone } from './icones.js';
import { SITUACOES_DO_PROJETO } from './inicio-calculo.js';

const num = (n) => new Intl.NumberFormat(idioma() === 'en' ? 'en-US' : 'pt-BR').format(Math.round(n));
const usd = (n) => 'US$ ' + num(n);
const dec = (n) => String(n).replace('.', idioma() === 'en' ? '.' : ',');
/* O tempo de resposta vem em dias: abaixo de um dia, em horas. */
const duracao = (dias) => (dias < 1 / 24 ? tr('menos de 1 hora') : dias < 1 ? tn(Math.round(dias * 24), '{n} hora', '{n} horas') : tn(dias, '{n} dia', '{n} dias', { n: dec(dias) }));

const COR_SITUACAO = { rascunho: '#8b93a0', medicao: '#4f86e8', proposta: '#f3813a', ganho: '#3aa6a0', perdido: '#e5b53a' };
const NOME_SITUACAO = () => ({ rascunho: tr('Rascunho'), medicao: tr('Em medição'), proposta: tr('Proposta emitida'), ganho: tr('Ganho'), perdido: tr('Perdido') });

const verTodos = (href) => '<a class="ini-vertodos" href="' + href + '">' + tr('Ver todos') + ' ' + icone('seta', 14) + '</a>';
const bloco = (classe, titulo, href, corpo, sub) =>
  '<section class="ini-bloco ' + classe + '"><header class="ini-cab"><div><h2 class="ini-titulo">' + titulo + '</h2>' + (sub ? '<p class="ini-sub">' + sub + '</p>' : '') + '</div>' + (href ? verTodos(href) : '') + '</header>' + corpo + '</section>';
const kpi = (valor, rotulo, nota) => '<div class="ini-kpi"><b class="ini-kpi-valor">' + valor + '</b><span class="ini-kpi-rotulo">' + rotulo + '</span>' + (nota ? '<span class="ini-kpi-nota">' + nota + '</span>' : '') + '</div>';
const barra = (pct, classe) => '<span class="ini-barra" role="img" aria-label="' + pct + '%"><span class="ini-barra-preenche ' + (classe || '') + '" style="width:' + Math.max(0, Math.min(100, pct)) + '%"></span></span>';

function htmlAcao(cards) {
  if (!cards.length) return '';
  const textos = {
    propostas: (c) => ({ n: c.n, titulo: tn(c.n, 'Proposta recebida', 'Propostas recebidas'), nota: tr('Prontas para comparar'), cor: 'a' }),
    convites: (c) => ({ n: c.n, titulo: tn(c.n, 'Convite para responder', 'Convites para responder'), nota: c.vencem ? tn(c.vencem, '{n} vence em 3 dias', '{n} vencem em 3 dias') : tr('Nenhum vence em 3 dias'), cor: 'b' }),
    rascunhos: (c) => ({ n: c.n, titulo: tn(c.n, 'Rascunho de concorrência', 'Rascunhos de concorrência'), nota: tr('Parados há mais de 7 dias'), cor: 'c' }),
    cotacoes: (c) => ({ n: c.n, titulo: tn(c.n, 'Cotação de material', 'Cotações de material'), nota: tr('Sem retorno do fornecedor'), cor: 'd' }),
    ganhos: (c) => ({ n: c.n, titulo: tn(c.n, 'Projeto ganho sem obra', 'Projetos ganhos sem obra'), nota: tr('Crie a obra para acompanhar'), cor: 'e' }),
  };
  const itens = cards.map((c) => {
    const t = textos[c.id](c);
    return '<a class="ini-acao ini-acao-' + t.cor + (c.n ? '' : ' ini-acao-vazio') + '" href="' + c.href + '"><b class="ini-acao-n">' + t.n + '</b><span class="ini-acao-txt"><b>' + t.titulo + '</b><span>' + (c.n ? t.nota : tr('Nada pendente')) + '</span></span>' + icone('seta', 16) + '</a>';
  }).join('');
  const pend = cards.reduce((s, c) => s + (c.n ? 1 : 0), 0);
  return '<section class="ini-bloco ini-acao-bloco"><header class="ini-cab"><div><h2 class="ini-titulo">' + icone('sino', 22) + ' ' + tr('Precisa de você agora') + '</h2><p class="ini-sub">' + (pend ? tr('Itens que precisam de atenção imediata') : tr('Tudo em dia por aqui')) + '</p></div></header><div class="ini-acoes">' + itens + '</div></section>';
}

function rosca(porSituacao, total) {
  const R = 40, C = 2 * Math.PI * R;
  let acumulado = 0;
  const fatias = SITUACOES_DO_PROJETO.filter((s) => porSituacao[s]).map((s) => {
    const len = (porSituacao[s] / total) * C;
    const x = '<circle cx="50" cy="50" r="' + R + '" fill="none" stroke="' + COR_SITUACAO[s] + '" stroke-width="16" stroke-dasharray="' + len.toFixed(2) + ' ' + C.toFixed(2) + '" stroke-dashoffset="' + (-acumulado).toFixed(2) + '" transform="rotate(-90 50 50)"/>';
    acumulado += len;
    return x;
  }).join('');
  return '<svg class="ini-rosca" viewBox="0 0 100 100" role="img" aria-label="' + esc(tr('Projetos por status')) + '"><circle cx="50" cy="50" r="' + R + '" fill="none" stroke="#2b2f36" stroke-width="16"/>' + fatias +
    '<text x="50" y="49" text-anchor="middle" class="ini-rosca-n">' + total + '</text><text x="50" y="60" text-anchor="middle" class="ini-rosca-t">' + tr('Projetos') + '</text></svg>';
}

function htmlProjetos(p) {
  if (!p.total) return bloco('ini-projetos', tr('Projetos por status'), '#/measure', '<p class="ini-vazio">' + tr('Nenhum projeto ainda. Crie o primeiro.') + '</p>', tr('Nenhum projeto'));
  const nomes = NOME_SITUACAO();
  const legenda = SITUACOES_DO_PROJETO.map((s) => '<li><i class="ini-ponto" style="background:' + COR_SITUACAO[s] + '"></i><span>' + nomes[s] + '</span><b>' + p.porSituacao[s] + ' <small>(' + Math.round((p.porSituacao[s] / p.total) * 100) + '%)</small></b></li>').join('');
  const obras = '<div class="ini-minikpis">' + kpi(p.obrasEmAndamento, tr('Obras em andamento')) + kpi(p.obrasConcluidas, tr('Obras concluídas')) + '</div>';
  return bloco('ini-projetos', tr('Projetos por status'), '#/measure', '<div class="ini-linha">' + rosca(p.porSituacao, p.total) + '<ul class="ini-legenda">' + legenda + '</ul>' + obras + '</div>', tn(p.total, '{n} projeto no total', '{n} projetos no total'));
}

function htmlDinheiro(p) {
  if (!p || !p.dinheiro) return '';
  const x = p.dinheiro;
  const kpis = '<div class="ini-kpis">' + kpi(usd(x.abertas), tr('Propostas abertas'), tn(x.nAbertas, '{n} proposta', '{n} propostas')) + kpi(usd(x.ganhoNoAno), tr('Ganho no ano'), tn(x.nGanhosNoAno, '{n} projeto', '{n} projetos')) +
    kpi(x.taxaDeAcerto == null ? '—' : x.taxaDeAcerto + '%', tr('Taxa de acerto'), x.decididos ? tr('{g} de {d} decididos', { g: x.nGanhos, d: x.decididos }) : tr('Sem projeto decidido')) +
    kpi(x.ticketMedio == null ? '—' : usd(x.ticketMedio), tr('Ticket médio'), tr('Projetos ganhos')) + '</div>';
  const contratantes = x.porContratante.length
    ? '<h3 class="ini-sub-titulo">' + tr('Valor das propostas por contratante') + '</h3><ul class="ini-ranking">' + x.porContratante.map((c) => '<li><span class="ini-rk-nome">' + esc(c.nome === 'Outros' ? tr('Outros') : c.nome) + '</span>' + barra(c.pct) + '<span class="ini-rk-pct">' + c.pct + '%</span><b>' + usd(c.valor) + '</b></li>').join('') + '</ul>'
    : '<p class="ini-vazio">' + tr('As propostas emitidas aparecem aqui.') + '</p>';
  return bloco('ini-dinheiro', tr('Dinheiro em jogo'), '#/measure', kpis + contratantes);
}

function htmlCotacoes(c) {
  if (!c) return '';
  const kpis = '<div class="ini-kpis ini-kpis3">' + kpi(c.listas, tr('Listas enviadas'), tn(c.projetosComLista, 'em {n} projeto', 'em {n} projetos')) + kpi(c.fornecedores, tr('Fornecedores'), tr('com lista')) + kpi(c.projetosSemLista, tr('Projetos sem lista'), tr('para cotação')) + '</div>';
  const maior = Math.max(1, ...c.porProjeto.map((x) => x.itens));
  const lista = c.porProjeto.length
    ? '<h3 class="ini-sub-titulo">' + tr('Listas por projeto') + '</h3><ul class="ini-ranking">' + c.porProjeto.map((x) => '<li><a class="ini-rk-nome" href="#/measure/projeto/' + x.id + '/cotacao">' + esc(x.nome) + '</a>' + barra(Math.round((x.itens / maior) * 100)) + '<b>' + tn(x.itens, '{n} item', '{n} itens') + '</b></li>').join('') + '</ul>'
    : '<p class="ini-vazio">' + tr('Quando você enviar a lista de materiais a um fornecedor, ela aparece aqui.') + '</p>';
  const resp = c.listas ? '<p class="ini-nota">' + tn(c.respondidas, '{n} fornecedor respondeu', '{n} fornecedores responderam') + ' · ' + tr('{n} sem retorno', { n: c.semRetorno }) + '</p>' : '';
  return bloco('ini-cotacoes', tr('Cotações de material'), '#/measure', kpis + lista + resp);
}

const SITUACAO_ENV = () => [['aberta', tr('Abertas'), '#4f86e8'], ['fechada', tr('Fechadas'), '#3aa6a0'], ['rascunho', tr('Rascunhos'), '#e5b53a'], ['cancelada', tr('Canceladas'), '#d65c4a']];
const SITUACAO_REC = () => [['semResposta', tr('Sem resposta'), '#4f86e8'], ['vaiCotar', tr('Vai cotar'), '#8b93a0'], ['proposta', tr('Proposta enviada'), '#f3813a'], ['ganho', tr('Ganho'), '#3aa6a0'], ['perdido', tr('Perdido'), '#d65c4a'], ['recusado', tr('Recusado'), '#e5b53a']];
function empilhada(valores, total) {
  if (!total) return '<span class="ini-empilhada ini-empilhada-vazia"></span>';
  return '<span class="ini-empilhada" role="img" aria-label="' + esc(tr('Distribuição por situação')) + '">' + valores.filter((v) => v[3]).map((v) => '<i style="width:' + (v[3] / total) * 100 + '%;background:' + v[2] + '"></i>').join('') + '</span>';
}
function htmlConcorrencias(c, ver) {
  if (!c) return '';
  const env = c.enviadas, rec = c.recebidas;
  const lEnv = SITUACAO_ENV().map(([k, n, cor]) => [k, n, cor, env[k]]);
  const lRec = SITUACAO_REC().map(([k, n, cor]) => [k, n, cor, rec[k]]);
  const leg = (l) => '<ul class="ini-legenda ini-legenda-peq">' + l.filter((x) => x[3]).map((x) => '<li><i class="ini-ponto" style="background:' + x[2] + '"></i><span>' + x[1] + '</span><b>' + x[3] + '</b></li>').join('') + '</ul>';
  const colEnv = ver.concorrenciasEnviadas
    ? '<div class="ini-col"><h3 class="ini-sub-titulo">' + tr('Enviadas por nós') + '</h3><b class="ini-grande">' + env.total + '</b><span class="ini-kpi-rotulo">' + tn(env.total, 'concorrência', 'concorrências') + '</span>' + empilhada(lEnv, env.total) + leg(lEnv) +
      '<div class="ini-minikpis">' + kpi(c.economiaMedia == null ? '—' : c.economiaMedia + '%', tr('Economia média')) + kpi(c.tempoDeResposta == null ? '—' : duracao(c.tempoDeResposta), tr('Tempo médio de resposta')) + '</div></div>' : '';
  const colRec = ver.concorrenciasRecebidas
    ? '<div class="ini-col"><h3 class="ini-sub-titulo">' + tr('Recebidas por nós') + '</h3><b class="ini-grande">' + rec.total + '</b><span class="ini-kpi-rotulo">' + tn(rec.total, 'convite recebido', 'convites recebidos') + '</span>' + empilhada(lRec, lRec.reduce((s, x) => s + x[3], 0)) + leg(lRec) + '</div>' : '';
  if (!env.total && !rec.total) return bloco('ini-conc', tr('Concorrências'), '#/daily/concorrencias', '<p class="ini-vazio">' + tr('Nenhuma concorrência ainda. Convide prestadoras para cotar um serviço.') + '</p>');
  return bloco('ini-conc', tr('Concorrências'), ver.concorrenciasEnviadas ? '#/daily/concorrencias' : '#/measure/convites', '<div class="ini-duas">' + colEnv + colRec + '</div>');
}

function htmlPrazos(lista) {
  if (!lista) return '';
  if (!lista.length) return bloco('ini-prazos', tr('Prazo das obras'), '#/conta/obras', '<p class="ini-vazio">' + tr('Cadastre uma obra com início e prazo para acompanhar aqui.') + '</p>');
  const linhas = lista.map((o) => {
    const dias = o.atrasada ? '<b class="ini-dias ini-dias-atraso">' + tn(-o.restantes, 'atrasada {n} dia', 'atrasada {n} dias') + '</b>' : '<b class="ini-dias' + (o.restantes <= 30 ? ' ini-dias-perto' : '') + '">' + tn(o.restantes, '{n} dia', '{n} dias') + '</b>';
    return '<tr><td><a href="#/conta/obras/' + o.id + '">' + esc(o.nome) + '</a>' + (o.paralisada ? ' <small class="ini-etq">' + tr('paralisada') + '</small>' : '') + '</td><td>' + dataCurta(o.inicio) + '</td><td>' + tn(o.total, '{n} dia', '{n} dias') + '</td>' +
      '<td class="ini-td-barra">' + barra(o.pct, o.atrasada ? 'ini-barra-atraso' : '') + '<span class="ini-pct">' + o.pct + '%</span></td><td>' + dias + '</td></tr>';
  }).join('');
  return bloco('ini-prazos', tr('Prazo das obras'), '#/conta/obras',
    '<div class="tabela-rolagem"><table class="ini-tabela"><thead><tr><th>' + tr('Obra') + '</th><th>' + tr('Início') + '</th><th>' + tr('Prazo') + '</th><th>' + tr('Tempo decorrido') + '</th><th>' + tr('Dias restantes') + '</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<p class="ini-nota ini-nota-cron">' + icone('hoje', 16) + ' ' + tr('Andamento do cronograma: —') + ' <span>' + tr('(será exibido quando o cronograma estiver ativo)') + '</span></p>');
}

function htmlParceiras(lista) {
  if (!lista) return '';
  if (!lista.length) return bloco('ini-parceiras', tr('Minhas parceiras'), '#/daily/concorrencias', '<p class="ini-vazio">' + tr('As empresas que você convidar para cotar aparecem aqui.') + '</p>');
  const linhas = lista.map((x) => '<tr><td><b>' + esc(x.nome) + '</b></td><td>' + (x.obras.length ? esc(x.obras.join(', ')) : '—') + '</td><td>' + (x.semConta ? '<span class="ini-etq">' + tr('só pelo link') + '</span>' : x.propostas) + '</td>' +
    '<td>' + (x.tempoDeResposta == null ? '—' : duracao(x.tempoDeResposta)) + '</td><td>' + (x.restantes == null ? '—' : '<b class="ini-dias' + (x.restantes < 0 ? ' ini-dias-atraso' : x.restantes <= 30 ? ' ini-dias-perto' : '') + '">' + x.restantes + '</b>') + '</td></tr>').join('');
  return bloco('ini-parceiras', tr('Minhas parceiras'), '#/daily/concorrencias',
    '<div class="tabela-rolagem"><table class="ini-tabela"><thead><tr><th>' + tr('Empresa') + '</th><th>' + tr('Obra em comum') + '</th><th>' + tr('Propostas') + '</th><th>' + tr('Tempo de resposta') + '</th><th>' + tr('Dias restantes') + '</th></tr></thead><tbody>' + linhas + '</tbody></table></div>');
}

function htmlPrecos(p, dinheiro) {
  if (!p) return '';
  if (!p.itensTotal) return bloco('ini-precos', tr('Catálogo e preços'), '#/measure/itens', '<p class="ini-vazio">' + tr('Cadastre os itens e os preços para montar as propostas.') + '</p>');
  const kpis = '<div class="ini-kpis ini-kpis2">' + kpi(p.semPrecoNovo, tn(p.semPrecoNovo, 'item sem preço novo', 'itens sem preço novo'), tr('há mais de 90 dias')) +
    (dinheiro ? kpi(p.margem ? dec(p.margem.total) + '%' : '—', tr('Margem vigente'), p.margem ? tr('overhead {o}% + lucro {l}%', { o: dec(p.margem.overhead), l: dec(p.margem.lucro) }) : tr('Sem margem definida')) : '') + '</div>';
  const tabela = p.lista.length
    ? '<h3 class="ini-sub-titulo">' + tr('Itens sem preço novo (há mais de 90 dias)') + '</h3><div class="tabela-rolagem"><table class="ini-tabela"><thead><tr><th>' + tr('Item') + '</th><th>' + tr('Última atualização') + '</th><th>' + tr('Unidade') + '</th></tr></thead><tbody>' +
      p.lista.map((x) => '<tr><td>' + esc(x.nome) + '</td><td>' + dataCurta(x.desde) + '</td><td>' + esc(x.unidade) + '</td></tr>').join('') + '</tbody></table></div>'
    : '<p class="ini-vazio">' + tr('Todos os preços estão atualizados.') + '</p>';
  return bloco('ini-precos', tr('Catálogo e preços'), '#/measure/itens', kpis + tabela);
}

/* calc: o que calcularInicio() devolveu; o: { ver } */
export function htmlPainelInicio(calc, o) {
  return '<div class="ini-painel">' + (o.cabeca || '') + htmlAcao(calc.acao) +
    '<div class="ini-grade ini-g3">' + (calc.projetos ? htmlProjetos(calc.projetos) : '') + htmlDinheiro(calc.projetos) + htmlCotacoes(calc.cotacoes) + '</div>' +
    '<div class="ini-grade ini-g2">' + htmlConcorrencias(calc.concorrencias, o.ver) + htmlPrazos(calc.prazos) + '</div>' +
    '<div class="ini-grade ini-g2b">' + htmlParceiras(calc.parceiras) + htmlPrecos(calc.precos, o.ver.dinheiro) + '</div>' + (o.rodape || '') + '</div>';
}
