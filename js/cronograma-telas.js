/* KORbuild — telas do cronograma da obra (docs/cronograma.md): etapas, Gantt, linha de base, publicação,
 * próximas 3 semanas e a versão publicada que a construtora vê. */

import { esc, toast, abrirDialogo, confirmar, hoje, somarDias, diasEntre, dataCurta, diaMes, dataHora, nomeDoMes } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, obra as acharObra } from './armazem.js';
import { usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { contratanteDe } from './contatos.js';
import {
  SITUACOES_ETAPA, cronogramaDe, duracao, desvio, situacaoDaEtapa, avancoDaObra, periodo, ultimaBase, datasDeBase,
  proximasSemanas, salvarEtapa, excluirEtapa, moverEtapa, registrarAvanco, novaBase, podePublicar, publicar,
  cronogramasRecebidos, publicacao, nomeResponsavel, nomeDaEmpresaVinculada, DIAS_LOOKAHEAD,
} from './cronograma.js';
import { exportarExcel } from './cronograma-excel.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarCronograma(funcoes) { app = { ...app, ...funcoes }; }
const quem = () => (usuarioAtual() || {}).nome || '';
const podeEditar = () => pode(usuarioAtual(), 'daily.cronograma');

/* ---------- Peças comuns (cronograma próprio ou publicado) ---------- */

function etiquetaSituacao(s) {
  const x = SITUACOES_ETAPA[s];
  return '<span class="etiqueta ' + x.classe + '">' + x.nome + '</span>';
}

function textoDesvio(d) {
  if (d == null || d === 0) return '<span class="mudo">—</span>';
  return d > 0 ? '<span class="desvio-atraso">' + tn(d, '+{n} dia', '+{n} dias') + '</span>' : '<span class="desvio-adianto">' + tn(-d, '−{n} dia', '−{n} dias') + '</span>';
}

function htmlResumo(c) {
  const av = avancoDaObra(c);
  const per = periodo(c);
  const base = ultimaBase(c);
  const fimBase = base ? Object.values(base.etapas).map((x) => x.fim).sort().slice(-1)[0] : null;
  const sit = c.etapas.map((e) => situacaoDaEtapa(e));
  const kpi = (rotulo, valor, extra, cor) => '<div class="kpi' + (cor ? ' kpi-' + cor : '') + '"><span>' + rotulo + '</span><b>' + valor + '</b>' + (extra ? '<small class="kpi-extra">' + extra + '</small>' : '') + '</div>';
  const atraso = fimBase ? diasEntre(fimBase, per.fim) : 0;
  return '<div class="kpis kpis-3 cr-kpis">' +
    kpi(tr('Avanço real'), av.real + '%', tr('planejado para hoje: {n}%', { n: av.planejado }), av.real + 10 <= av.planejado ? 'alerta' : av.real < av.planejado ? 'ambar' : 'verde') +
    kpi(tr('Etapas atrasadas'), String(sit.filter((s) => s === 'atrasada').length), tn(sit.filter((s) => s === 'risco').length, '{n} em risco', '{n} em risco'), sit.includes('atrasada') ? 'alerta' : '') +
    kpi(tr('Término previsto'), dataCurta(per.fim), fimBase ? (atraso > 0 ? tn(atraso, '{n} dia depois da linha de base', '{n} dias depois da linha de base') : atraso < 0 ? tn(-atraso, '{n} dia antes da linha de base', '{n} dias antes da linha de base') : tr('na data da linha de base')) : '', atraso > 0 ? 'ambar' : '') +
  '</div>';
}

/* Gantt: uma linha por etapa; barra atual (preenchida pelo %), a linha de base embaixo e a linha do hoje. */
function htmlGantt(c, opcoes) {
  const ed = opcoes.editavel;
  const datas = c.etapas.flatMap((e) => { const b = datasDeBase(c, e); return [e.inicio, e.fim].concat(b ? [b.inicio, b.fim] : []); }).concat([hoje()]).sort();
  // começa na segunda-feira e termina no domingo, para as semanas fecharem
  let ini = datas[0];
  const dSemana = new Date(ini + 'T12:00:00').getDay();
  ini = somarDias(ini, -((dSemana + 6) % 7));
  let fim = datas[datas.length - 1];
  fim = somarDias(fim, (7 - new Date(fim + 'T12:00:00').getDay()) % 7);
  const total = diasEntre(ini, fim) + 1;
  const pos = (iso) => (diasEntre(ini, iso) / total * 100).toFixed(3) + '%';
  const larg = (a, b) => ((diasEntre(a, b) + 1) / total * 100).toFixed(3) + '%';
  const semanas = [];
  for (let d = ini; d <= fim; d = somarDias(d, 7)) semanas.push(d);
  const meses = [];
  for (const s of semanas) { const m = s.slice(0, 7); if (!meses.length || meses[meses.length - 1].m !== m) meses.push({ m, de: s }); }
  const hojeIso = hoje();
  const cabecalho = '<div class="gantt-cab"><div class="gantt-col-nome">' + tr('Etapa da obra') + '</div><div class="gantt-trilho gantt-escala">' +
    meses.map((x) => '<span class="gantt-mes" style="left:' + pos(x.de < ini ? ini : x.de) + '">' + (() => { const n = nomeDoMes(Number(x.m.slice(5, 7)) - 1).slice(0, 3); return n.charAt(0).toUpperCase() + n.slice(1); })() + '</span>').join('') +
    semanas.map((s) => '<span class="gantt-semana" style="left:' + pos(s) + ';width:' + larg(s, somarDias(s, 6)) + '">' + diaMes(s) + '</span>').join('') +
    '</div></div>';
  const linhas = c.etapas.map((e, i) => {
    const s = situacaoDaEtapa(e);
    const b = datasDeBase(c, e);
    const nomeResp = opcoes.responsavel(e.responsavelId);
    return '<div class="gantt-linha sit-' + s + '">' +
      '<div class="gantt-col-nome"><b>' + esc(e.nome) + '</b><span class="mudo pequeno">' + dataCurta(e.inicio).slice(0, 5) + ' – ' + dataCurta(e.fim).slice(0, 5) +
        ' · ' + tn(duracao(e), '{n} dia', '{n} dias') + (nomeResp ? ' · ' + esc(nomeResp) : '') + '</span>' +
        '<span class="gantt-meta">' + etiquetaSituacao(s) + ' <b>' + (e.pct || 0) + '%</b>' + (b ? ' · ' + tr('desvio') + ' ' + textoDesvio(desvio(c, e)) : '') + '</span>' +
        (ed ? '<span class="gantt-acoes">' +
          '<button type="button" class="link" data-acao="cr-avanco" data-id="' + e.id + '">' + tr('Atualizar %') + '</button>' +
          '<button type="button" class="link" data-acao="cr-etapa" data-id="' + e.id + '">' + tr('Editar') + '</button>' +
          '<button type="button" class="icone-botao" data-acao="cr-mover" data-id="' + e.id + '" data-passo="-1" aria-label="' + tr('Subir {nome}', { nome: esc(e.nome) }) + '"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" class="icone-botao" data-acao="cr-mover" data-id="' + e.id + '" data-passo="1" aria-label="' + tr('Descer {nome}', { nome: esc(e.nome) }) + '"' + (i === c.etapas.length - 1 ? ' disabled' : '') + '>↓</button>' +
        '</span>' : '') +
      '</div>' +
      '<div class="gantt-trilho">' +
        semanas.map((sm) => '<span class="gantt-grade" style="left:' + pos(sm) + '"></span>').join('') +
        (b ? '<span class="gantt-base" style="left:' + pos(b.inicio) + ';width:' + larg(b.inicio, b.fim) + '" title="' + tr('Linha de base: {de} a {ate}', { de: dataCurta(b.inicio), ate: dataCurta(b.fim) }) + '"></span>' : '') +
        '<span class="gantt-barra" style="left:' + pos(e.inicio) + ';width:' + larg(e.inicio, e.fim) + '" title="' + esc(e.nome) + ': ' + (e.pct || 0) + '%">' +
          '<span class="gantt-feito" style="width:' + (e.pct || 0) + '%"></span><span class="gantt-pct' + ((e.pct || 0) < 20 ? ' escuro' : '') + '">' + (e.pct || 0) + '%</span></span>' +
        '<span class="gantt-hoje" style="left:' + pos(hojeIso) + '"></span>' +
      '</div></div>';
  }).join('');
  return '<div class="gantt-rolagem"><div class="gantt">' + cabecalho + linhas + '</div></div>' +
    '<p class="gantt-legenda mudo pequeno"><span><i class="lg-barra"></i>' + tr('Planejado atual (preenchido pelo % concluído)') + '</span>' +
      '<span><i class="lg-base"></i>' + tr('Linha de base') + '</span><span><i class="lg-hoje"></i>' + tr('Hoje') + '</span>' +
      '<span><i class="lg-atrasada"></i>' + SITUACOES_ETAPA.atrasada.nome + '</span><span><i class="lg-risco"></i>' + SITUACOES_ETAPA.risco.nome + '</span></p>';
}

/* ---------- Cronograma da obra (prestadora) ---------- */

export function telaCronograma(moldura, obraId) {
  const o = acharObra(obraId);
  if (!o) return null;
  const c = cronogramaDe(o.id);
  const ed = podeEditar();
  const ct = contratanteDe(o);
  const temEtapas = c && c.etapas.length;
  const base = ultimaBase(c);
  const ultimaPub = c && c.publicacoes && c.publicacoes.length ? c.publicacoes[c.publicacoes.length - 1] : null;
  const acoes = '<div class="acoes-cabeca">' +
    (temEtapas ? '<button type="button" class="btn btn-contorno" data-acao="cr-excel" data-obra="' + o.id + '">' + icone('baixar', 18) + tr('Exportar Excel') + '</button>' : '') +
    (ed ? '<button type="button" class="btn btn-primario" data-acao="cr-etapa" data-obra="' + o.id + '">' + icone('mais', 18) + tr('Nova etapa') + '</button>' : '') + '</div>';
  return moldura({
    ativo: 'obras', largo: true, titulo: tr('Cronograma'), subtitulo: o.nome + (ct ? ' · ' + tr('para {nome}', { nome: ct.nome }) : ''),
    voltar: { href: '#/daily/obras/' + o.id, rotulo: o.nome }, acoes,
    conteudo: '<div id="cronograma" data-obra="' + o.id + '">' +
      (temEtapas
        ? htmlResumo(c) +
          '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Etapas') + '</h2><span class="mudo pequeno">' + tn(c.etapas.length, '{n} etapa', '{n} etapas') + '</span></div>' +
            htmlGantt(c, { editavel: ed, responsavel: nomeResponsavel }) + '</section>'
        : '<section class="cartao vazio-grande"><h2>' + tr('O cronograma desta obra ainda não tem etapas') + '</h2><p class="mudo">' +
            tr('Monte as etapas do seu serviço com início e fim. O encarregado informa o andamento no diário, e a construtora vê a versão que você publicar.') + '</p>' +
            (ed ? '<button type="button" class="btn btn-primario" data-acao="cr-etapa" data-obra="' + o.id + '">' + icone('mais', 18) + tr('Criar a primeira etapa') + '</button>' : '') + '</section>') +
      (temEtapas ? '<div class="grade-2">' +
        '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Linha de base') + '</h2>' +
          (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="cr-base" data-obra="' + o.id + '">' + tr('Salvar nova linha de base') + '</button>' : '') + '</div>' +
          (base ? '<p>' + tr('Salva em {quando} por {nome}', { quando: dataHora(base.em), nome: esc(base.por) }) + '<span class="mudo bloco pequeno">' + esc(base.motivo) + '</span></p>' : '') +
          '<p class="mudo pequeno">' + tr('O desvio de cada etapa é medido contra a última linha de base. Salve uma nova só quando o plano mudar de verdade (ex.: aditivo de prazo): as anteriores ficam no histórico.') + '</p>' +
          (c.bases.length > 1 ? '<details class="preco-historico"><summary>' + tn(c.bases.length, '{n} versão', '{n} versões') + '</summary><ul>' +
            c.bases.slice().reverse().map((x) => '<li>' + dataHora(x.em) + ' · ' + esc(x.por) + ' · ' + esc(x.motivo) + '</li>').join('') + '</ul></details>' : '') +
        '</section>' +
        '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Contratante') + '</h2>' +
          (ed && podePublicar(o) ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="cr-publicar" data-obra="' + o.id + '">' + icone('link', 16) + tr('Publicar para o contratante') + '</button>' : '') + '</div>' +
          (podePublicar(o)
            ? '<p>' + (ultimaPub ? tr('{empresa} vê a versão {n}, publicada em {quando}.', { empresa: esc(nomeDaEmpresaVinculada(o)), n: ultimaPub.versao, quando: dataHora(ultimaPub.em) }) : tr('{empresa} ainda não recebeu nenhuma versão.', { empresa: esc(nomeDaEmpresaVinculada(o)) })) + '</p>' +
              '<p class="mudo pequeno">' + tr('A construtora só vê o que você publica, sem poder editar. Mudou o cronograma? Publique de novo.') + '</p>'
            : '<p class="mudo">' + tr('Esta obra não está ligada a uma obra do contratante no KORbuild. Exporte o Excel para enviar.') + '</p>') +
        '</section></div>' : '') +
      '</div>',
  });
}

/* ---------- Próximas 3 semanas (tela da obra no celular do encarregado) ---------- */

export function htmlProximasSemanas(obraId) {
  const lista = proximasSemanas(obraId);
  if (!cronogramaDe(obraId) || !cronogramaDe(obraId).etapas.length) return '';
  const h = hoje();
  return '<section class="cartao cr-lookahead"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + icone('hoje', 18) + ' ' + tr('Próximas 3 semanas') + '</h2></div>' +
    (lista.length ? '<ul class="fila">' + lista.map((e) => {
      const s = situacaoDaEtapa(e);
      const quando = e.inicio > h ? tr('começa {data}', { data: dataCurta(e.inicio).slice(0, 5) }) : e.fim < h ? tr('devia ter terminado {data}', { data: dataCurta(e.fim).slice(0, 5) }) : tr('termina {data}', { data: dataCurta(e.fim).slice(0, 5) });
      return '<li><div class="fila-texto"><b>' + esc(e.nome) + '</b><span class="mudo">' + quando + ' · ' + (e.pct || 0) + '%</span></div>' + etiquetaSituacao(s) + '</li>';
    }).join('') + '</ul>' : '<p class="vazio">' + tr('Nenhuma etapa nos próximos {n} dias.', { n: DIAS_LOOKAHEAD }) + '</p>') +
    '<p class="mudo pequeno">' + tr('Informe o andamento no diário: em cada atividade, escolha a etapa do cronograma e o % concluído.') + '</p></section>';
}

/* Cartão na tela da obra (escritório): resumo do cronograma próprio e os recebidos das prestadoras. */
export function htmlCartaoCronograma(o) {
  const c = cronogramaDe(o.id);
  const recebidos = cronogramasRecebidos(o.id);
  let html = '';
  if (c && c.etapas.length) {
    const av = avancoDaObra(c);
    const atrasadas = c.etapas.filter((e) => situacaoDaEtapa(e) === 'atrasada').length;
    html += '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Cronograma') + '</h2><a class="btn btn-contorno btn-pequeno" href="#/daily/obras/' + o.id + '/cronograma">' + tr('Abrir cronograma') + '</a></div>' +
      '<p>' + tr('Avanço {real}% · planejado {plan}%', { real: av.real, plan: av.planejado }) + (atrasadas ? ' · <span class="desvio-atraso">' + tn(atrasadas, '{n} etapa atrasada', '{n} etapas atrasadas') + '</span>' : '') + '</p>' +
      '<div class="barra-avanco" role="img" aria-label="' + tr('Avanço {real}% · planejado {plan}%', { real: av.real, plan: av.planejado }) + '"><span class="barra-real" style="width:' + av.real + '%"></span><span class="barra-plano" style="left:' + av.planejado + '%"></span></div></section>';
  } else if (estado().empresa.atuacao !== 'construtora' && pode(usuarioAtual(), 'daily.cronograma')) {
    html += '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Cronograma') + '</h2><a class="btn btn-contorno btn-pequeno" href="#/daily/obras/' + o.id + '/cronograma">' + tr('Montar cronograma') + '</a></div>' +
      '<p class="mudo">' + tr('Esta obra ainda não tem cronograma.') + '</p></section>';
  }
  if (recebidos.length) {
    html += '<section class="cartao"><h2 class="cartao-titulo">' + tr('Cronogramas das prestadoras') + '</h2><ul class="fila">' + recebidos.map((p) => {
      const av = avancoDaObra(p.cronograma);
      const atrasadas = p.cronograma.etapas.filter((e) => situacaoDaEtapa(e) === 'atrasada').length;
      return '<li><div class="fila-texto"><b>' + esc(p.de.nome) + '</b><span class="mudo">' + tr('Versão {n}, publicada em {quando}', { n: p.versao, quando: dataHora(p.em) }) + ' · ' + tr('avanço {n}%', { n: av.real }) +
        (atrasadas ? ' · ' + tn(atrasadas, '{n} etapa atrasada', '{n} etapas atrasadas') : '') + '</span></div>' +
        '<a class="btn btn-contorno btn-pequeno" href="#/daily/obras/' + o.id + '/cronograma/recebido/' + p.id + '">' + tr('Ver') + '</a></li>';
    }).join('') + '</ul></section>';
  }
  return html;
}

/* ---------- Versão publicada (construtora, só leitura) ---------- */

export function telaCronogramaRecebido(moldura, obraId, pubId) {
  const o = acharObra(obraId);
  const p = publicacao(pubId);
  if (!o || !p || p.para.empresaId !== estado().empresa.id || p.para.obraId !== o.id) return null;
  const c = p.cronograma;
  return moldura({
    ativo: 'obras', largo: true, titulo: tr('Cronograma de {empresa}', { empresa: p.de.nome }), subtitulo: o.nome + ' · ' + tr('Versão {n}, publicada em {quando}', { n: p.versao, quando: dataHora(p.em) }),
    voltar: { href: '#/daily/obras/' + o.id, rotulo: o.nome },
    acoes: '<button type="button" class="btn btn-contorno" data-acao="cr-excel-recebido" data-id="' + p.id + '">' + icone('baixar', 18) + tr('Exportar Excel') + '</button>',
    conteudo: '<p class="aviso-info">' + icone('olho', 16) + tr('Só leitura: este é o cronograma que {empresa} publicou para a sua obra. As datas e o andamento são de responsabilidade dela.', { empresa: esc(p.de.nome) }) + '</p>' +
      htmlResumo(c) +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Etapas') + '</h2>' + htmlGantt(c, { editavel: false, responsavel: (id) => p.responsaveis[id] || '' }) + '</section>',
  });
}

/* ---------- Diálogos ---------- */

function opcoesResponsavel(atual) {
  const d = estado();
  const ops = [];
  for (const u of d.usuarios.filter((x) => x.ativo && !x.funcionarioId)) ops.push([u.id, u.nome]);
  for (const f of (d.funcionarios || []).filter((x) => x.situacao !== 'desligado')) ops.push([f.usuarioId || f.id, f.nome]);
  return '<option value="">' + tr('Sem responsável') + '</option>' + ops.map(([v, n]) => '<option value="' + v + '"' + (v === atual ? ' selected' : '') + '>' + esc(n) + '</option>').join('');
}

async function dialogoEtapa(obraId, id) {
  const c = cronogramaDe(obraId);
  const e = id && c ? c.etapas.find((x) => x.id === id) : null;
  const ultimo = c && c.etapas.length ? c.etapas[c.etapas.length - 1] : null;
  const ini = e ? e.inicio : ultimo ? somarDias(ultimo.fim, 1) : hoje();
  const res = await abrirDialogo({
    titulo: e ? tr('Editar etapa') : tr('Nova etapa'),
    corpo: '<label class="rotulo-pequeno" for="cr-nome">' + tr('Nome da etapa') + '</label><input type="text" id="cr-nome" name="nome" value="' + esc(e ? e.nome : '') + '" placeholder="' + tr('Ex.: Framing do 2º pavimento') + '">' +
      '<div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="cr-ini">' + tr('Início') + '</label><input type="date" id="cr-ini" name="inicio" value="' + ini + '"></div>' +
      '<div class="campo"><label class="rotulo-pequeno" for="cr-fim">' + tr('Fim') + '</label><input type="date" id="cr-fim" name="fim" value="' + (e ? e.fim : somarDias(ini, 6)) + '"></div></div>' +
      '<label class="rotulo-pequeno" for="cr-resp">' + tr('Responsável') + '</label><select id="cr-resp" name="responsavelId">' + opcoesResponsavel(e ? e.responsavelId : '') + '</select>' +
      (e && datasDeBase(c, e) ? '<p class="mudo pequeno">' + tr('Na linha de base: {de} a {ate}. Mudar as datas aqui não muda a linha de base: o desvio aparece no cronograma.', { de: dataCurta(datasDeBase(c, e).inicio), ate: dataCurta(datasDeBase(c, e).fim) }) + '</p>' : ''),
    acoes: (e ? [{ rotulo: tr('Excluir'), valor: 'excluir', classe: 'btn-perigo' }] : []).concat([{ rotulo: tr('Cancelar'), valor: false }, { rotulo: e ? tr('Salvar') : tr('Criar etapa'), valor: true, classe: 'btn-primario' }]),
  });
  if (!res || !res.valor) return;
  if (res.valor === 'excluir') {
    if (!(await confirmar(tr('Excluir "{nome}"?', { nome: e.nome }), tr('A etapa sai do cronograma. O histórico fica na auditoria.'), tr('Excluir'), 'btn-perigo'))) return;
    const r = excluirEtapa(obraId, e.id, quem());
    toast(r.erro || tr('Etapa excluída.'));
    app.desenhar();
    return;
  }
  const r = salvarEtapa(obraId, e ? e.id : null, res.campos, quem());
  toast(r.erro || (e ? tr('Etapa atualizada.') : tr('Etapa criada.')));
  if (r.ok) app.desenhar();
}

async function dialogoAvanco(obraId, id) {
  const c = cronogramaDe(obraId);
  const e = c.etapas.find((x) => x.id === id);
  const hist = (e.historico || []).slice().reverse().slice(0, 6);
  const res = await abrirDialogo({
    titulo: tr('% concluído · {nome}', { nome: e.nome }),
    corpo: '<label class="rotulo-pequeno" for="cr-pct">' + tr('Quanto da etapa já foi executado (%)') + '</label><input type="number" min="0" max="100" step="5" id="cr-pct" name="pct" value="' + (e.pct || 0) + '">' +
      '<p class="mudo pequeno">' + tr('O normal é o encarregado informar no diário (vale quando o RDO é aprovado). Use aqui para corrigir.') + '</p>' +
      (hist.length ? '<ul class="lista-simples pequeno">' + hist.map((x) => '<li>' + dataCurta(x.data) + ' · ' + x.antes + '% → <b>' + x.pct + '%</b> · ' + (x.fonte === 'rdo' ? tr('RDO nº {n}', { n: x.rdoNumero }) : tr('ajuste do escritório')) + ' · ' + esc(x.por) + '</li>').join('') + '</ul>' : ''),
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Salvar'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = registrarAvanco(obraId, id, res.campos.pct, { fonte: 'manual', por: quem() });
  toast(r.erro || tr('% concluído atualizado.'));
  if (r.ok) app.desenhar();
}

async function dialogoBase(obraId) {
  const res = await abrirDialogo({
    titulo: tr('Salvar nova linha de base'),
    corpo: '<p class="mudo pequeno">' + tr('As datas de hoje viram a nova referência para medir o desvio. A linha de base anterior fica no histórico.') + '</p>' +
      '<label class="rotulo-pequeno" for="cr-motivo">' + tr('Motivo') + '</label><input type="text" id="cr-motivo" name="motivo" placeholder="' + tr('Ex.: aditivo de prazo aprovado pela construtora') + '">',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Salvar linha de base'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = novaBase(obraId, res.campos.motivo, quem());
  toast(r.erro || tr('Nova linha de base salva.'));
  if (r.ok) app.desenhar();
}

export const acoesCronograma = {
  async 'cr-etapa'(el) { await dialogoEtapa(el.dataset.obra || document.getElementById('cronograma').dataset.obra, el.dataset.id || null); },
  async 'cr-avanco'(el) { await dialogoAvanco(document.getElementById('cronograma').dataset.obra, el.dataset.id); },
  'cr-mover'(el) { moverEtapa(document.getElementById('cronograma').dataset.obra, el.dataset.id, Number(el.dataset.passo)); app.desenhar(); },
  async 'cr-base'(el) { await dialogoBase(el.dataset.obra); },
  async 'cr-publicar'(el) {
    const o = acharObra(el.dataset.obra);
    if (!(await confirmar(tr('Publicar o cronograma para {empresa}?', { empresa: nomeDaEmpresaVinculada(o) }), tr('A construtora passa a ver esta versão (datas, andamento e desvios), sem poder editar. O que você mudar depois só aparece quando publicar de novo.'), tr('Publicar')))) return;
    const r = publicar(o, quem());
    toast(r.erro || tr('Versão {n} publicada para o contratante.', { n: r.versao }));
    if (r.ok) app.desenhar();
  },
  async 'cr-excel'(el) {
    const o = acharObra(el.dataset.obra);
    const e = estado().empresa;
    const ct = contratanteDe(o);
    toast(tr('Gerando o Excel…'));
    try {
      await exportarExcel({ c: cronogramaDe(o.id), obraNome: o.nome, contratante: ct ? ct.nome : '', empresa: e, responsavel: nomeResponsavel, nomeArquivo: o.nome });
    } catch (err) { toast(tr('Não foi possível gerar o Excel.')); console.error(err); }
  },
  async 'cr-excel-recebido'(el) {
    const p = publicacao(el.dataset.id);
    toast(tr('Gerando o Excel…'));
    try {
      await exportarExcel({ c: p.cronograma, obraNome: p.obraNome, contratante: estado().empresa.nome, empresa: { ...p.de }, responsavel: (id) => p.responsaveis[id] || '', nomeArquivo: p.obraNome, versao: p.versao, publicadoEm: p.em });
    } catch (err) { toast(tr('Não foi possível gerar o Excel.')); console.error(err); }
  },
};
