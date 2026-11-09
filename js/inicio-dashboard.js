/* KORbuild — o Início da 1ª versão como painel (docs/prompt-dashboard-inicio.md). Só desenha o que js/inicio-calculo.js devolve:
 * blocos pequenos, números grandes, barras e rosca em SVG/CSS (sem biblioteca). Cada item leva à lista correspondente. */

import { esc, dataCurta } from './util.js';
import { tr, tn, idioma } from './i18n.js';
import { icone } from './icones.js';
import { SITUACOES_DO_PROJETO } from './inicio-calculo.js';
import { etiquetaAndamento } from './projeto-espaco.js';

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
    diarios: (c) => ({ n: c.n, titulo: tn(c.n, 'Diário para aprovar', 'Diários para aprovar'), nota: tr('Esperando a sua revisão'), cor: 'a' }),
    diarioatrasado: (c) => ({ n: c.n, titulo: tn(c.n, 'Projeto com diário atrasado', 'Projetos com diário atrasado'), nota: tr('O campo ainda não enviou'), cor: 'c' }),
    ganhos: (c) => ({ n: c.n, titulo: tn(c.n, 'Projeto ganho sem obra', 'Projetos ganhos sem obra'), nota: tr('Crie a obra para acompanhar'), cor: 'e' }),
  };
  const pendentes = cards.filter((c) => c.n);
  if (!pendentes.length) return '<section class="ini-acao-fina ini-acao-ok"><b>' + icone('sino', 18) + ' ' + tr('Tudo em dia por aqui') + '</b><span>' + tr('Nada precisa da sua atenção agora.') + '</span></section>';
  const itens = pendentes.map((c) => {
    const t = textos[c.id](c);
    return '<a class="ini-acao-item ini-acao-' + t.cor + '" href="' + c.href + '" title="' + esc(t.nota) + '"><b class="ini-acao-n">' + t.n + '</b><span>' + t.titulo + '</span>' + icone('seta', 14) + '</a>';
  }).join('');
  return '<section class="ini-acao-fina"><b>' + icone('sino', 18) + ' ' + tr('Precisa de você agora') + '</b>' + itens + '</section>';
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
  const obras = p.obrasEmAndamento === undefined ? '' : '<div class="ini-minikpis">' + kpi(p.obrasEmAndamento, tr('Obras em andamento')) + kpi(p.obrasConcluidas, tr('Obras concluídas')) + '</div>';
  return bloco('ini-projetos', tr('Projetos por status'), '#/measure', '<div class="ini-linha">' + rosca(p.porSituacao, p.total) + '<ul class="ini-legenda">' + legenda + '</ul>' + obras + '</div>', tn(p.total, '{n} projeto no total', '{n} projetos no total'));
}

function htmlDinheiro(p) {
  if (!p || !p.dinheiro) return '';
  const x = p.dinheiro;
  const kpis = '<div class="ini-kpis">' + kpi(usd(x.abertas), tr('Propostas abertas'), tn(x.nAbertas, '{n} proposta', '{n} propostas')) + kpi(usd(x.ganhoNoAno), tr('Ganho no ano'), tn(x.nGanhosNoAno, '{n} projeto', '{n} projetos')) +
    (x.decididos ? kpi(x.taxaDeAcerto + '%', tr('Taxa de acerto'), tr('{g} de {d} decididos', { g: x.nGanhos, d: x.decididos })) : '') +   // sem projeto decidido, nada de número vazio
    (x.ticketMedio != null ? kpi(usd(x.ticketMedio), tr('Ticket médio'), tr('Projetos ganhos')) : '') + '</div>';
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
/* Valor e horas do projeto: os mesmos números do Gantt (Valor por tarefa e Horas orçadas × apontadas). O % da barra é do cronograma (peso = dias da tarefa); o do valor é do que a medição diz que cada tarefa vale. */
const linhaDeValor = (v) => !v ? '' : '<span class="ini-and-valor">' + tr('Valor: {feito} de {total} ({pct}%)', { feito: usd(v.feito), total: usd(v.total), pct: v.total ? Math.round(v.feito * 100 / v.total) : 0 }) +
  (v.horasOrcadas ? ' · ' + tr('Horas: {a} de {o} orçadas', { a: dec(v.horasApontadas), o: dec(v.horasOrcadas) }) : '') + '</span>';

/* Diário de obra (Daily): números do mesmo resumo do painel do Daily. */
function htmlDiario(x) {
  if (!x) return '';
  if (!x.total && !x.nAguardando) return bloco('ini-diario', tr('Diário de obra'), '#/daily', '<p class="ini-vazio">' + tr('Nenhum projeto liberado para a obra ainda. Quando você liberar um projeto, o diário do campo aparece aqui.') + '</p>');
  const kpis = '<div class="ini-kpis ini-kpis3">' + kpi(x.deHoje + '/' + x.total, tr('Diários de hoje'), tr('já enviados')) + kpi(x.nAguardando, tr('Aguardando aprovação'), x.nAguardando ? tr('Esperando a sua revisão') : tr('Nada pendente')) +
    kpi(x.atrasadas, tr('Com diário atrasado'), x.atrasadas ? tr('O campo ainda não enviou') : tr('Tudo em dia')) + '</div>';
  return bloco('ini-diario', tr('Diário de obra'), '#/daily/painel', kpis, x.atrasadas ? tn(x.atrasadas, '{n} projeto com diário atrasado', '{n} projetos com diário atrasado') : null);
}

/* A faixa de números: o que o dono quer saber ao abrir o sistema. Cada cartão leva à lista correspondente. */
const cartao = (cor, icon, rotulo, valor, nota, href, classeValor) => '<a class="ini-cartao ini-cartao-' + cor + '" href="' + href + '"><span class="ini-cartao-ico">' + icone(icon, 22) + '</span><span class="ini-cartao-txt"><span class="ini-cartao-rotulo">' + rotulo + '</span><b class="ini-cartao-valor ' + (classeValor || '') + '">' + valor + '</b><span class="ini-cartao-nota">' + nota + '</span></span></a>';
function htmlFaixa(calc) {
  const p = calc.projetos, d = calc.diario, a = calc.andamento;
  const itens = [];
  if (p && p.dinheiro) {
    const x = p.dinheiro, s = p.porSituacao;
    itens.push(cartao('o', 'tabela', tr('Propostas abertas'), usd(x.abertas), tn(x.nAbertas, '{n} proposta', '{n} propostas'), '#/measure'));
    itens.push(cartao('g', 'dinheiro', tr('Ganho no ano'), usd(x.ganhoNoAno), tn(x.nGanhosNoAno, '{n} projeto', '{n} projetos'), '#/measure'));
    itens.push(cartao('b', 'obras', tr('Projetos em aberto'), String(s.rascunho + s.medicao + s.proposta), tr('{m} em medição · {p} com proposta', { m: s.medicao, p: s.proposta }), '#/measure'));
  }
  if (a) {
    const pior = a.lista.find((x) => x.situacao === 'atrasado');
    itens.push(cartao(a.atrasados ? 'r' : 'g', 'relogio', tr('Atrasados'), String(a.atrasados),
      a.atrasados && pior ? esc(pior.nome) + (pior.maisAtrasada ? ' · ' + tn(pior.maisAtrasada.diasAtraso, '{n} dia', '{n} dias') : '') : (a.total ? tr('Tudo em dia') : tr('Nenhum cronograma')), '#/measure/gantt', a.atrasados ? 'ini-vermelho' : ''));
  }
  if (d && !p) {   // quem só acompanha o diário vê os números do diário
    itens.push(cartao('b', 'hoje', tr('Diários de hoje'), d.deHoje + '/' + d.total, tr('já enviados'), '#/daily/painel'));
    itens.push(cartao('o', 'sino', tr('Aguardando aprovação'), String(d.nAguardando), d.nAguardando ? tr('Esperando a sua revisão') : tr('Nada pendente'), '#/daily/painel'));
    itens.push(cartao(d.atrasadas ? 'r' : 'g', 'relogio', tr('Com diário atrasado'), String(d.atrasadas), d.atrasadas ? tr('O campo ainda não enviou') : tr('Tudo em dia'), '#/daily/painel', d.atrasadas ? 'ini-vermelho' : ''));
  }
  return itens.length ? '<div class="ini-faixa">' + itens.join('') + '</div>' : '';
}

/* O gráfico de linha: o previsto (tracejado) e o feito de hoje, do projeto em destaque. Um gráfico por projeto da lista; o clique na linha troca o que aparece. */
const dia = (iso) => Math.round(new Date(iso + 'T12:00:00Z').getTime() / 864e5);
function svgLinha(x, hojeIso) {
  const L = 700, A = 236, mx = 46, mb = 28, mt = 14, w = L - mx - 14, h = A - mb - mt;
  const d0 = dia(x.inicio), d1 = Math.max(d0 + 1, dia(x.fim));
  const px = (iso) => mx + Math.max(0, Math.min(1, (dia(iso) - d0) / (d1 - d0))) * w;
  const py = (p) => mt + h - (Math.max(0, Math.min(100, p)) / 100) * h;
  const grade = [0, 50, 100].map((p) => '<line class="ini-g-grade" x1="' + mx + '" x2="' + (L - 14) + '" y1="' + py(p).toFixed(1) + '" y2="' + py(p).toFixed(1) + '"/><text class="ini-g-eixo" x="' + (mx - 8) + '" y="' + (py(p) + 4).toFixed(1) + '" text-anchor="end">' + p + '%</text>').join('');
  const linha = x.curva.map((q) => px(q.d).toFixed(1) + ',' + py(q.p).toFixed(1)).join(' ');
  const depois = hojeIso > x.fim;   // fora do período, "hoje" fica preso na borda: o feito de hoje sempre aparece
  const hx = px(hojeIso).toFixed(1);
  const hoje = '<line class="ini-g-hoje" x1="' + hx + '" x2="' + hx + '" y1="' + mt + '" y2="' + (mt + h) + '"/><text class="ini-g-hoje-t" x="' + (Number(hx) + (depois ? -6 : 6)) + '" y="' + (mt + 11) + '" text-anchor="' + (depois ? 'end' : 'start') + '">' + tr('hoje') + '</text>' +
    '<circle class="ini-g-prev" cx="' + hx + '" cy="' + py(x.previsto).toFixed(1) + '" r="4"/><circle class="ini-g-feito" cx="' + hx + '" cy="' + py(x.feito).toFixed(1) + '" r="6"><title>' + esc(tr('{n}% feito', { n: x.feito })) + '</title></circle>';
  return '<svg class="ini-g-svg" viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="' + esc(tr('Previsto × feito: {a}% feito, {b}% previsto', { a: x.feito, b: x.previsto })) + '">' + grade +
    '<polyline class="ini-g-linha" points="' + linha + '"/>' + hoje +
    '<text class="ini-g-eixo" x="' + mx + '" y="' + (A - 8) + '">' + esc(dataCurta(x.inicio)) + '</text><text class="ini-g-eixo" x="' + (L - 14) + '" y="' + (A - 8) + '" text-anchor="end">' + esc(dataCurta(x.fim)) + '</text></svg>';
}
function htmlGrafico(a, hojeIso) {
  if (!a || !a.total) return '<section class="ini-bloco ini-grafico"><header class="ini-cab"><div><h2 class="ini-titulo">' + tr('Previsto × feito') + '</h2><p class="ini-sub">' + tr('Nenhum cronograma') + '</p></div></header><p class="ini-vazio">' + tr('Monte o cronograma na aba Schedule do projeto e o previsto × feito aparece aqui.') + '</p></section>';
  return a.lista.map((x) => '<section class="ini-bloco ini-grafico" data-ini-grafico="' + x.id + '"' + (x.id === a.destaque ? '' : ' hidden') + '><header class="ini-cab"><div><h2 class="ini-titulo">' + esc(x.nome) + ' · ' + tr('previsto × feito') + '</h2><p class="ini-sub">' +
    (x.maisAtrasada ? '<span class="ini-vermelho">' + tn(x.maisAtrasada.diasAtraso, '{n} dia de atraso', '{n} dias de atraso') + '</span> · ' + esc(x.maisAtrasada.nome) : x.situacao === 'nao-iniciado' ? tr('Começa em {data}', { data: dataCurta(x.inicio) }) : tr('Término previsto: {data}', { data: dataCurta(x.fim) })) + '</p></div>' + etiquetaAndamento(x.situacao) + '</header>' +
    svgLinha(x, hojeIso) +
    '<div class="ini-g-resumo"><span><i class="ini-g-leg-prev"></i>' + tr('previsto') + ' <b>' + x.previsto + '%</b></span><span><i class="ini-g-leg-feito"></i>' + tr('feito') + ' <b>' + x.feito + '%</b></span>' + (x.valor ? '<span>' + tr('Valor do projeto') + ' <b>' + usd(x.valor.total) + '</b></span>' : '') + '<a class="ini-vertodos" href="#/measure/gantt/' + x.id + '">' + tr('Abrir o Gantt') + ' ' + icone('seta', 14) + '</a></div></section>').join('');
}
/* A lista ao lado: clicar numa linha (fora do nome, que abre o Gantt) troca o projeto do gráfico. */
function htmlListaAndamento(a) {
  if (!a || !a.total) return '';
  const linhas = a.lista.map((x) => '<div class="ini-and-linha' + (x.id === a.destaque ? ' ativa' : '') + '" data-ini-proj="' + x.id + '"><div class="ini-and-nome"><a href="#/measure/gantt/' + x.id + '">' + esc(x.nome) + '</a><small>' +
      (x.maisAtrasada ? tn(x.maisAtrasada.diasAtraso, '{n} dia de atraso', '{n} dias de atraso') : x.situacao === 'nao-iniciado' ? tr('Começa em {data}', { data: dataCurta(x.inicio) }) : tr('Término previsto: {data}', { data: dataCurta(x.fim) })) + '</small></div>' +
    etiquetaAndamento(x.situacao) +
    '<div class="ini-and-barra">' + barra(x.feito, x.situacao === 'atrasado' ? 'ini-barra-atraso' : x.situacao === 'concluido' ? 'ini-barra-verde' : '') + '<i class="ini-and-prev" style="left:' + x.previsto + '%" title="' + esc(tr('{n}% previsto para hoje', { n: x.previsto })) + '"></i></div>' +
    '<span class="ini-and-pct">' + tr('{a}% feito · {b}% previsto', { a: x.feito, b: x.previsto }) + '</span>' + linhaDeValor(x.valor) + '</div>').join('');
  return bloco('ini-andamento-bloco', tr('Andamento dos projetos'), '#/measure/gantt', '<div class="ini-andamento">' + linhas + '</div>' + (a.total > a.lista.length ? '<p class="mudo pequeno">' + tr('… e mais {n}.', { n: a.total - a.lista.length }) + '</p>' : ''),
    tr('Clique num projeto para ver o gráfico'));
}
if (typeof document !== 'undefined' && !window.__iniGraficoLigado) {
  window.__iniGraficoLigado = true;
  document.addEventListener('click', (e) => {
    const linha = e.target.closest && e.target.closest('[data-ini-proj]');
    if (!linha || e.target.closest('a')) return;
    const id = linha.getAttribute('data-ini-proj');
    document.querySelectorAll('[data-ini-grafico]').forEach((g) => { g.hidden = g.getAttribute('data-ini-grafico') !== id; });
    document.querySelectorAll('[data-ini-proj]').forEach((l) => l.classList.toggle('ativa', l === linha));
  });
}

/* O Início: em cima a faixa de números e, só quando há pendência, uma linha fina "Precisa de você"; depois o gráfico previsto × feito e a lista dos projetos; o resto fica recolhido em "Mais indicadores". */
export function htmlPainelInicio(calc, o) {
  const principais = [htmlDiario(calc.diario), htmlDinheiro(calc.projetos), calc.projetos ? htmlProjetos(calc.projetos) : ''].filter(Boolean);
  const mais = [...principais, htmlCotacoes(calc.cotacoes), htmlConcorrencias(calc.concorrencias, o.ver), htmlPrazos(calc.prazos), htmlParceiras(calc.parceiras), htmlPrecos(calc.precos, o.ver.dinheiro)]
    .filter((h) => h && !/<\/header><p class="ini-vazio">[^<]*<\/p><\/section>$/.test(h));   // fora o bloco que só diria "ainda não há nada"; bloco com números fica, mesmo com um aviso dentro
  const meio = calc.andamento ? '<div class="ini-meio">' + htmlGrafico(calc.andamento, calc.hoje) + htmlListaAndamento(calc.andamento) + '</div>' : '';
  return '<div class="ini-painel">' + (o.cabeca || '') + htmlFaixa(calc) + htmlAcao(calc.acao) + meio +
    (mais.length ? '<details class="ini-mais"><summary>' + tr('Mais indicadores') + ' <span>' + mais.length + '</span></summary><div class="ini-grade ini-g2">' + mais.join('') + '</div></details>' : '') + (o.rodape || '') + '</div>';
}
