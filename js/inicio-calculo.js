/* KORbuild — os números do Início da 1ª versão (docs/prompt-dashboard-inicio.md). Funções puras: recebem o espelho da empresa (estado())
 * e devolvem o que cada bloco mostra. Nada é inventado: sem dado, o bloco volta vazio. Quem pode ver o quê vem em "ver" (permissões do Settings).
 *
 * Situação do projeto, para o gráfico: rascunho (ainda sem medição), em medição, proposta emitida, ganho, perdido.
 * "Aberto" = rascunho, em medição ou proposta emitida; "fechado" = ganho ou perdido. */

const DIA = 864e5;
const isoDe = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DIA);
const media = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
const ultima = (lista) => (lista && lista.length ? lista[lista.length - 1] : null);

export const SITUACOES_DO_PROJETO = ['rascunho', 'medicao', 'proposta', 'ganho', 'perdido'];

export function situacaoDoProjeto(p, d) {
  if (p.situacao === 'ganha') return 'ganho';
  if (p.situacao === 'perdida') return 'perdido';
  if (p.situacao === 'enviada' || (p.propostas || []).length) return 'proposta';
  const medido = ((d.measure && d.measure.condicoes) || []).some((c) => c.projetoId === p.id && (c.medicoes || []).length);
  return medido ? 'medicao' : 'rascunho';
}

const totalDaProposta = (p) => { const u = ultima(p.propostas); return u ? Number(u.total) || 0 : 0; };

/* O convite da concorrência que é da minha empresa (nas recebidas há um só). */
const meuConvite = (c, eu) => (c.convites || []).find((v) => v.empresaId === eu) || (c.convites || [])[0] || null;
const enviada = (c, eu) => c.contratanteId === eu;

function blocoProjetos(d, ctx) {
  const projetos = (d.measure && d.measure.projetos) || [];
  const porSituacao = Object.fromEntries(SITUACOES_DO_PROJETO.map((s) => [s, 0]));
  for (const p of projetos) porSituacao[situacaoDoProjeto(p, d)]++;
  const obras = d.obras || [];
  const abertas = projetos.filter((p) => ['rascunho', 'medicao', 'proposta'].includes(situacaoDoProjeto(p, d)));
  const ganhos = projetos.filter((p) => situacaoDoProjeto(p, d) === 'ganho');
  const perdidos = porSituacao.perdido;
  const ano = ctx.hoje.slice(0, 4);
  const ganhosNoAno = ganhos.filter((p) => !p.alteradoEm || new Date(p.alteradoEm).getFullYear() === Number(ano));
  const decididos = ganhos.length + perdidos;
  const r = {
    total: projetos.length, porSituacao,
    obrasEmAndamento: obras.filter((o) => (o.situacao || 'andamento') !== 'concluida').length,
    obrasConcluidas: obras.filter((o) => o.situacao === 'concluida').length,
    ganhosSemObra: ganhos.filter((p) => !p.obraId).length,
  };
  if (ctx.ver.dinheiro) {
    const contato = (id) => ((d.contatos || []).find((c) => c.id === id) || {}).nome || '';
    const abertasComProposta = abertas.filter((p) => situacaoDoProjeto(p, d) === 'proposta');
    const por = new Map();
    for (const p of projetos) {
      const v = totalDaProposta(p);
      if (!v) continue;
      const nome = contato(p.contratanteId) || '—';
      por.set(nome, (por.get(nome) || 0) + v);
    }
    const lista = [...por.entries()].sort((a, b) => b[1] - a[1]);
    const soma = lista.reduce((s, x) => s + x[1], 0);
    const topo = lista.slice(0, 3);
    const resto = lista.slice(3).reduce((s, x) => s + x[1], 0);
    r.dinheiro = {
      abertas: abertasComProposta.reduce((s, p) => s + totalDaProposta(p), 0), nAbertas: abertasComProposta.length,
      ganhoNoAno: ganhosNoAno.reduce((s, p) => s + totalDaProposta(p), 0), nGanhosNoAno: ganhosNoAno.length,
      taxaDeAcerto: decididos ? Math.round((ganhos.length / decididos) * 100) : null, decididos, nGanhos: ganhos.length,
      ticketMedio: ganhos.length ? ganhos.reduce((s, p) => s + totalDaProposta(p), 0) / ganhos.length : null,
      porContratante: topo.concat(resto ? [['Outros', resto]] : []).map(([nome, valor]) => ({ nome, valor, pct: soma ? Math.round((valor / soma) * 100) : 0 })),
    };
  }
  return r;
}

function blocoCotacoes(d, ctx) {
  const projetos = (d.measure && d.measure.projetos) || [];
  const aberto = (p) => !['ganho', 'perdido'].includes(situacaoDoProjeto(p, d));
  const pares = []; // um por (projeto, fornecedor) com e-mail preparado
  for (const p of projetos) {
    const c = p.cotacao || {};
    const fs = new Set((c.envios || []).map((x) => x.fornecedorId));
    for (const f of fs) {
      const ultEnvio = ultima((c.envios || []).filter((x) => x.fornecedorId === f));
      const resp = (c.respostas || []).filter((x) => x.fornecedorId === f && x.em >= ultEnvio.em);
      pares.push({ projetoId: p.id, projeto: p.nome, fornecedorId: f, enviadoEm: ultEnvio.em, respondido: resp.length > 0 });
    }
  }
  const comLista = new Set(pares.map((x) => x.projetoId));
  const fornecedores = new Set(pares.map((x) => x.fornecedorId));
  const itens = (p) => ctx.itensDaLista(p.id);
  const semLista = projetos.filter((p) => aberto(p) && !comLista.has(p.id) && itens(p) > 0);
  const porProjeto = projetos.filter((p) => comLista.has(p.id)).map((p) => ({ id: p.id, nome: p.nome, itens: itens(p) })).sort((a, b) => b.itens - a.itens).slice(0, 4);
  return {
    listas: pares.length, projetosComLista: comLista.size, fornecedores: fornecedores.size,
    projetosSemLista: semLista.length, semRetorno: pares.filter((x) => !x.respondido).length, respondidas: pares.filter((x) => x.respondido).length,
    porProjeto, primeiroSemRetorno: (pares.find((x) => !x.respondido) || {}).projetoId || null,
  };
}

function blocoConcorrencias(d, ctx) {
  const eu = ctx.eu;
  const todas = d.concorrencias || [];
  const env = todas.filter((c) => enviada(c, eu)), rec = todas.filter((c) => !enviada(c, eu));
  const enviadas = { total: env.length, aberta: 0, fechada: 0, rascunho: 0, cancelada: 0 };
  for (const c of env) if (enviadas[c.situacao] != null) enviadas[c.situacao]++;
  const recebidas = { total: rec.length, semResposta: 0, vaiCotar: 0, proposta: 0, ganho: 0, perdido: 0, recusado: 0 };
  for (const c of rec) {
    const s = (meuConvite(c, eu) || {}).situacao;
    if (c.situacao === 'cancelada' || s === 'cancelado') continue;
    if (s === 'enviado' || s === 'visto') recebidas.semResposta++;
    else if (s === 'vai-cotar') recebidas.vaiCotar++;
    else if (s === 'proposta') recebidas.proposta++;
    else if (s === 'vencedora') recebidas.ganho++;
    else if (s === 'nao-escolhida') recebidas.perdido++;
    else if (s === 'nao-vai') recebidas.recusado++;
  }
  // economia: a proposta vencedora contra a mais cara da mesma concorrência
  const economias = [];
  for (const c of env.filter((x) => x.situacao === 'fechada' && x.fechamento)) {
    const totais = (c.convites || []).map((v) => Number((ultima(v.propostas) || {}).total) || 0).filter((x) => x > 0);
    const maior = Math.max(0, ...totais);
    if (totais.length > 1 && maior > 0) economias.push(((maior - Number(c.fechamento.valor)) / maior) * 100);
  }
  const respostas = env.flatMap((c) => (c.convites || []).filter((v) => v.respondidoEm && v.convidadoEm).map((v) => (v.respondidoEm - v.convidadoEm) / DIA));
  return { enviadas, recebidas, economiaMedia: economias.length ? Math.round(media(economias)) : null, tempoDeResposta: respostas.length ? media(respostas) : null };
}

function blocoAcao(d, ctx, projetos, cotacoes) {
  const eu = ctx.eu, agoraMs = ctx.agora;
  const todas = d.concorrencias || [];
  const cards = [];
  if (ctx.ver.concorrenciasEnviadas) {
    const env = todas.filter((c) => enviada(c, eu) && c.situacao === 'aberta');
    const comProposta = env.reduce((n, c) => n + (c.convites || []).filter((v) => v.situacao === 'proposta').length, 0);
    cards.push({ id: 'propostas', n: comProposta, href: '#/daily/concorrencias' });
    const parados = todas.filter((c) => enviada(c, eu) && c.situacao === 'rascunho' && c.criadaEm && agoraMs - c.criadaEm > 7 * DIA).length;
    cards.push({ id: 'rascunhos', n: parados, href: '#/daily/concorrencias' });
  }
  if (ctx.ver.concorrenciasRecebidas) {
    const rec = todas.filter((c) => !enviada(c, eu) && c.situacao === 'aberta' && ['enviado', 'visto'].includes((meuConvite(c, eu) || {}).situacao));
    const prazoMs = (c) => (c.prazo ? new Date(c.prazo).getTime() : Infinity);
    cards.push({ id: 'convites', n: rec.length, vencem: rec.filter((c) => prazoMs(c) - agoraMs <= 3 * DIA).length, href: '#/measure/convites' });
  }
  if (cotacoes) cards.push({ id: 'cotacoes', n: cotacoes.semRetorno, href: cotacoes.primeiroSemRetorno ? '#/measure/projeto/' + cotacoes.primeiroSemRetorno + '/cotacao' : '#/measure' });
  if (projetos && projetos.ganhosSemObra) cards.push({ id: 'ganhos', n: projetos.ganhosSemObra, href: '#/measure' });
  return cards;
}

function blocoPrazos(d, ctx) {
  const obras = (d.obras || []).filter((o) => (o.situacao || 'andamento') !== 'concluida' && o.inicio && o.prazo);
  return obras.map((o) => {
    const total = Math.max(1, dias(o.inicio, o.prazo));
    const decorridos = dias(o.inicio, ctx.hoje);
    const restantes = dias(ctx.hoje, o.prazo);
    return { id: o.id, nome: o.nome, inicio: o.inicio, prazo: o.prazo, total, restantes, pct: Math.max(0, Math.min(100, Math.round((decorridos / total) * 100))), atrasada: restantes < 0, paralisada: o.situacao === 'paralisada' };
  }).sort((a, b) => a.restantes - b.restantes).slice(0, 6);
}

function blocoParceiras(d, ctx) {
  const eu = ctx.eu;
  const obras = new Map((d.obras || []).map((o) => [o.id, o]));
  const mapa = new Map();
  for (const c of (d.concorrencias || []).filter((x) => enviada(x, eu) && x.situacao !== 'rascunho')) {
    for (const v of c.convites || []) {
      const chave = v.empresaId || 'link:' + (v.email || v.nome);
      const x = mapa.get(chave) || { nome: v.nome, semConta: !v.empresaId, obras: new Set(), propostas: 0, respostas: [], restantes: null };
      const o = obras.get(c.obraId);
      if (o) { x.obras.add(o.nome); const r = o.prazo ? dias(ctx.hoje, o.prazo) : null; if (r != null && (x.restantes == null || r < x.restantes)) x.restantes = r; }
      if ((v.propostas || []).length) x.propostas++;
      if (v.respondidoEm && v.convidadoEm) x.respostas.push((v.respondidoEm - v.convidadoEm) / DIA);
      mapa.set(chave, x);
    }
  }
  return [...mapa.values()].map((x) => ({ nome: x.nome, semConta: x.semConta, obras: [...x.obras], propostas: x.propostas, tempoDeResposta: x.respostas.length ? media(x.respostas) : null, restantes: x.restantes }))
    .sort((a, b) => b.propostas - a.propostas || a.nome.localeCompare(b.nome)).slice(0, 5);
}

function blocoPrecos(d, ctx) {
  const itens = (d.measure && d.measure.itens) || [];
  const limite = new Date(ctx.agora - 90 * DIA); const corte = isoDe(limite);
  const velhos = itens.map((i) => ({ i, desde: (ultima((i.precos || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : 1))) || {}).desde || '' }))
    .filter((x) => x.desde && x.desde < corte).sort((a, b) => (a.desde < b.desde ? -1 : 1));
  const margem = ultima(((d.measure && d.measure.margens) || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : 1)));
  return {
    itensTotal: itens.length, semPrecoNovo: velhos.length, semPrecoNenhum: itens.filter((i) => !(i.precos || []).length).length,
    lista: velhos.slice(0, 4).map((x) => ({ nome: x.i.nome, desde: x.desde, unidade: x.i.unidade })),
    margem: margem ? { overhead: margem.overheadPct, lucro: margem.lucroPct, total: Math.round((margem.overheadPct + margem.lucroPct) * 10) / 10 } : null,
  };
}

/* ctx: { eu, agora (ms), hoje ('AAAA-MM-DD'), ver: { medir, dinheiro, concorrenciasEnviadas, concorrenciasRecebidas, obras }, itensDaLista(projetoId) } */
export function calcularInicio(d, ctx) {
  const c = { ...ctx, hoje: ctx.hoje || isoDe(new Date(ctx.agora)), agora: ctx.agora || Date.now() };
  const projetos = c.ver.medir ? blocoProjetos(d, c) : null;
  const cotacoes = c.ver.medir ? blocoCotacoes(d, c) : null;
  const concorrencias = (c.ver.concorrenciasEnviadas || c.ver.concorrenciasRecebidas) ? blocoConcorrencias(d, c) : null;
  return {
    acao: blocoAcao(d, c, projetos, cotacoes),
    projetos, cotacoes, concorrencias,
    prazos: c.ver.obras || c.ver.medir ? blocoPrazos(d, c) : null,
    parceiras: c.ver.concorrenciasEnviadas ? blocoParceiras(d, c) : null,
    precos: c.ver.medir ? blocoPrecos(d, c) : null,
  };
}
