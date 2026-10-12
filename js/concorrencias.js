/* KORbuild — Concorrências (bid) entre contratante e convidadas (docs/concorrencias.md).
 * Qualquer empresa pode contratar (CO-19): construtora → prestadora ou prestadora → prestadora.
 * No protótipo, as concorrências ficam no aparelho, fora das empresas (banco.concorrencias), como os
 * `compartilhados`; cada empresa só recebe o que pode ver (CO-04). No produto, é o servidor que guarda e filtra. */

import { novoId } from './util.js';
import { bancoDeDados, estado, salvar, empresaAtualId, empresaPorId } from './armazem.js';
import { tr } from './i18n.js';
import { auditar } from './settings.js';
import { contato } from './contatos.js';

export const SITUACOES = {
  rascunho: { nome: tr('Rascunho'), classe: 'etiqueta-neutro' },
  aberta: { nome: tr('Aberta'), classe: 'etiqueta-azul' },
  'para-fechar': { nome: tr('Para fechar'), classe: 'etiqueta-ambar' },
  fechada: { nome: tr('Fechada'), classe: 'etiqueta-verde' },
  cancelada: { nome: tr('Cancelada'), classe: 'etiqueta-neutro' },
};
export const SITUACOES_CONVITE = {
  enviado: tr('Convite enviado'),
  visto: tr('Visto'),
  'vai-cotar': tr('Vai cotar'),
  'nao-vai': tr('Não vai participar'),
  proposta: tr('Proposta enviada'),
  vencedora: tr('Vencedora'),
  'nao-escolhida': tr('Não escolhida'),
  cancelado: tr('Cancelado'),
};
export const MOSTRAR_ORCAMENTO = { nao: tr('Não mostrar'), total: tr('Mostrar o total'), etapa: tr('Mostrar por etapa') };
export const QUARTEIRIZACAO = { permitida: tr('Permitida'), 'com-aprovacao': tr('Com a minha aprovação'), 'nao-permitida': tr('Não permitida') };

const DATA_HORA = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const instante = (dataHora) => new Date(dataHora).getTime();

/* ---------- Acesso aos dados ---------- */

function lista() {
  const b = bancoDeDados();
  if (!b) return [];
  b.concorrencias = b.concorrencias || [];
  return b.concorrencias;
}
function achar(id) { return lista().find((c) => c.id === id) || null; }
function conviteDe(c, conviteId) { return (c.convites || []).find((v) => v.id === conviteId) || null; }

/* A conta KORbuild de um contato (prestadora com conta), ou null quando ela responde pelo link (CO-07). */
export function contaDoContato(ct) { return ct && ct.contaId && empresaPorId(ct.contaId) ? ct.contaId : null; }

export function ultimaProposta(v) { return v && v.propostas && v.propostas.length ? v.propostas[v.propostas.length - 1] : null; }

/* Situação de fato: uma concorrência aberta passa a "para fechar" quando o prazo vence. Antes disso as convidadas
 * ainda podem mandar revisões; a contratante pode fechar a qualquer momento, se não quiser esperar. */
export function situacaoDe(c, agora = Date.now()) {
  if (c.situacao !== 'aberta') return c.situacao;
  return instante(c.prazo) <= agora ? 'para-fechar' : 'aberta';
}

/* ---------- Visão de cada empresa (CO-04) ---------- */

/* As concorrências que a empresa aberta mandou (ela é a contratante): tudo. */
export function enviadas(empresaId = empresaAtualId()) { return lista().filter((c) => c.contratanteId === empresaId); }
export function concorrenciaEnviada(id, empresaId = empresaAtualId()) {
  const c = achar(id);
  return c && c.contratanteId === empresaId ? c : null;
}

/* O que a convidada vê: os dados da concorrência e só o próprio convite. Nunca os outros convidados, os
 * valores deles nem o fechamento com outra (CO-04, CO-13). O orçamento, só se a contratante quis (CO-03). */
function visaoDoConvidado(c, v) {
  const orcamento = c.orcamento && c.orcamento.mostrar === 'total' ? { mostrar: 'total', valor: c.orcamento.valor }
    : c.orcamento && c.orcamento.mostrar === 'etapa' ? { mostrar: 'etapa', valor: c.orcamento.valor, porEtapa: { ...c.orcamento.porEtapa } }
      : { mostrar: 'nao' };
  return {
    id: c.id, contratanteId: c.contratanteId, contratante: (empresaPorId(c.contratanteId) || {}).empresa || null,
    obraId: c.obraId, servico: c.servico, etapas: c.etapas.slice(), incluso: c.incluso.slice(), excluso: c.excluso.slice(),
    observacoes: c.observacoes, desenhos: c.desenhos.slice(), prazo: c.prazo, inicio: c.inicio, termino: c.termino,
    exigencias: JSON.parse(JSON.stringify(c.exigencias || {})), quarteirizacao: c.quarteirizacao, orcamento,
    situacao: c.situacao === 'fechada' ? 'fechada' : c.situacao === 'cancelada' ? 'cancelada' : situacaoDe(c),
    convite: JSON.parse(JSON.stringify(v)),
  };
}
/* Convites que a empresa aberta recebeu (ela é a convidada, com conta). Rascunhos não aparecem. */
export function recebidas(empresaId = empresaAtualId()) {
  const r = [];
  for (const c of lista()) {
    if (c.situacao === 'rascunho') continue;
    for (const v of c.convites) if (v.empresaId === empresaId) r.push(visaoDoConvidado(c, v));
  }
  return r;
}
export function recebida(id, empresaId = empresaAtualId()) { return recebidas(empresaId).find((x) => x.id === id) || null; }
/* Prestadora sem conta: o link pessoal do convite (CO-07) dá acesso só a esse convite. */
export function porToken(token) {
  for (const c of lista()) {
    if (c.situacao === 'rascunho') continue;
    const v = c.convites.find((x) => x.token === token);
    if (v) return visaoDoConvidado(c, v);
  }
  return null;
}

/* ---------- Contratante ---------- */

function textoItens(x) { return (Array.isArray(x) ? x : String(x || '').split('\n')).map((s) => String(s).trim()).filter(Boolean); }
function valor(x) { const n = Number(x); return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN; }

/* Cria ou altera um rascunho. Depois de enviada, só prorrogar, convidar mais ou cancelar (CO-09). */
export function salvarRascunho(id, dados, por) {
  const atual = id ? concorrenciaEnviada(id) : null;
  if (id && !atual) return { erro: tr('Concorrência não encontrada.') };
  if (atual && atual.situacao !== 'rascunho') return { erro: tr('Depois de enviada, a concorrência só muda por prorrogação, convidados a mais ou adendo.') };
  const orc = dados.orcamento || {};
  const d = {
    obraId: String(dados.obraId || '').trim() || null,
    origem: dados.origem && dados.origem.id ? { tipo: dados.origem.tipo === 'projeto' ? 'projeto' : 'obra', id: dados.origem.id } : null,
    servico: String(dados.servico || '').trim(),
    etapas: [...new Set(textoItens(dados.etapas))],
    incluso: textoItens(dados.incluso), excluso: textoItens(dados.excluso), observacoes: String(dados.observacoes || '').trim(),
    desenhos: (dados.desenhos || []).map((x) => ({ nome: String(x.nome || '').trim(), arquivoId: x.arquivoId || null })).filter((x) => x.nome),
    prazo: String(dados.prazo || '').trim(), inicio: String(dados.inicio || '').trim(), termino: String(dados.termino || '').trim(),
    orcamento: { valor: orc.valor === '' || orc.valor == null ? null : valor(orc.valor), porEtapa: {}, mostrar: MOSTRAR_ORCAMENTO[orc.mostrar] ? orc.mostrar : 'nao' },
    exigencias: dados.exigencias || {},
    quarteirizacao: QUARTEIRIZACAO[dados.quarteirizacao] ? dados.quarteirizacao : 'permitida',
  };
  for (const [k, x] of Object.entries(orc.porEtapa || {})) if (x !== '' && x != null) d.orcamento.porEtapa[k] = valor(x);
  if (d.prazo && !DATA_HORA.test(d.prazo)) return { erro: tr('Prazo da proposta inválido.') };
  if (d.orcamento.valor != null && !(d.orcamento.valor > 0)) return { erro: tr('O orçamento precisa ser um valor maior que zero.') };
  if (d.obraId && !estado().obras.some((o) => o.id === d.obraId)) return { erro: tr('Escolha uma obra da sua empresa.') };
  // convidados: contatos (marcador prestadora) desta empresa, sem repetir (CO-16)
  const ids = [...new Set(dados.convidados || (atual ? atual.convites.map((v) => v.contatoId) : []))];
  for (const cid of ids) if (!contato(cid)) return { erro: tr('Convidado não encontrado nos Contatos.') };
  const convites = ids.map((cid) => (atual && atual.convites.find((v) => v.contatoId === cid)) || novoConvite(cid));
  if (atual) {
    Object.assign(atual, d, { convites });
    salvar();
    return { ok: true, id };
  }
  const nova = {
    id: novoId('co'), contratanteId: empresaAtualId(), ...d, convites, situacao: 'rascunho',
    criadaPor: por || '—', criadaEm: Date.now(), historico: [], fechamento: null,
  };
  lista().push(nova);
  salvar();
  return { ok: true, id: nova.id };
}

function novoConvite(contatoId) {
  const ct = contato(contatoId);
  return {
    id: novoId('cv'), contatoId, nome: ct.nome, email: ct.email || '', empresaId: contaDoContato(ct),
    token: novoId('lk') + Math.random().toString(36).slice(2, 10),
    situacao: 'enviado', motivo: '', vistoEm: null, respondidoEm: null, projetoId: null, propostas: [],
  };
}

/* O que falta para enviar (CO-08). Lista vazia = pode enviar. */
export function pendenciasDeEnvio(c, agora = Date.now()) {
  const p = [];
  if (!c.obraId && !(c.origem && c.origem.tipo === 'projeto')) p.push(tr('Escolha a obra.'));
  if (!c.servico) p.push(tr('Dê um nome ao serviço.'));
  if (!c.etapas.length) p.push(tr('Escolha pelo menos uma etapa a cotar.'));
  if (!c.incluso.length) p.push(tr('Descreva o que está incluso no escopo.'));
  if (!c.prazo) p.push(tr('Informe o prazo da proposta.'));
  else if (instante(c.prazo) <= agora) p.push(tr('O prazo da proposta precisa ser no futuro.'));
  if (!c.convites.length) p.push(tr('Convide pelo menos uma prestadora.'));
  return p;
}

function registrar(c, por, acao, detalhe, em = Date.now()) {
  c.historico.push({ em, por: por || '—', acao, detalhe: detalhe || '' });
  auditar(tr('Concorrências'), acao + ': ' + c.servico, '', detalhe || '', '', por);
}

export function enviar(id, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (c.situacao !== 'rascunho') return { erro: tr('Esta concorrência já foi enviada.') };
  const falta = pendenciasDeEnvio(c, agora);
  if (falta.length) return { erro: falta[0], pendencias: falta };
  c.situacao = 'aberta';
  c.enviadaEm = agora;
  registrar(c, por, tr('Convites enviados'), c.convites.map((v) => v.nome).join(', '), agora);
  salvar();
  return { ok: true };
}

/* Prorrogar: novo prazo no futuro e depois do atual; volta a ficar aberta (CO-09). */
export function prorrogar(id, novoPrazo, motivo, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (!['aberta', 'para-fechar'].includes(situacaoDe(c, agora))) return { erro: tr('Só uma concorrência aberta pode ser prorrogada.') };
  if (!DATA_HORA.test(novoPrazo || '')) return { erro: tr('Prazo da proposta inválido.') };
  if (instante(novoPrazo) <= Math.max(agora, instante(c.prazo))) return { erro: tr('O novo prazo precisa ser depois do prazo atual e no futuro.') };
  const antes = c.prazo;
  c.prazo = novoPrazo;
  registrar(c, por, tr('Prazo prorrogado'), antes + ' → ' + novoPrazo + (motivo ? ' · ' + motivo : ''), agora);
  salvar();
  return { ok: true };
}

/* Convidar mais prestadoras com a concorrência aberta (CO-09, CO-16: ninguém é convidado duas vezes). */
export function convidarMais(id, contatoIds, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (!['aberta', 'para-fechar'].includes(situacaoDe(c, agora))) return { erro: tr('Só dá para convidar mais com a concorrência aberta.') };
  const novos = [...new Set(contatoIds)].filter((cid) => !c.convites.some((v) => v.contatoId === cid));
  if (!novos.length) return { erro: tr('Essas prestadoras já foram convidadas.') };
  for (const cid of novos) if (!contato(cid)) return { erro: tr('Convidado não encontrado nos Contatos.') };
  const convites = novos.map(novoConvite);
  c.convites.push(...convites);
  registrar(c, por, tr('Convidados a mais'), convites.map((v) => v.nome).join(', '), agora);
  salvar();
  return { ok: true };
}

/* Comparar (bid leveling, CO-12): uma linha por etapa da concorrência, uma coluna por proposta (a revisão mais
 * recente). Etapa sem preço é "não cotada" (null), nunca zero. Exclusão que bate com um item do escopo incluso
 * é marcada, para a contratante perguntar antes de fechar. */
export function comparar(c) {
  const colunas = c.convites.filter((v) => ultimaProposta(v)).map((v) => {
    const p = ultimaProposta(v);
    const naoCotadas = c.etapas.filter((e) => p.porEtapa[e] == null);
    const exclusoesNoEscopo = p.exclusoes.filter((x) => c.incluso.some((i) => contem(i, x) || contem(x, i)));
    return { conviteId: v.id, nome: v.nome, comConta: !!v.empresaId, rev: p.rev, numero: p.numero, enviadaEm: p.enviadaEm, total: p.total, prazoExecucaoDias: p.prazoExecucaoDias, exclusoes: p.exclusoes.slice(), naoCotadas, exclusoesNoEscopo };
  });
  const linhas = c.etapas.map((e) => {
    const valores = {};
    for (const col of colunas) { const p = ultimaProposta(conviteDe(c, col.conviteId)); valores[col.conviteId] = p.porEtapa[e] == null ? null : p.porEtapa[e]; }
    const cotados = Object.values(valores).filter((x) => x != null);
    return { etapa: e, valores, menor: cotados.length ? Math.min(...cotados) : null };
  });
  const totais = colunas.map((x) => x.total);
  return { colunas, linhas, menorTotal: totais.length ? Math.min(...totais) : null };
}
const normal = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
function contem(a, b) { const x = normal(a), y = normal(b); return y.length >= 4 && x.includes(y); }

/* Fechar com uma proposta (CO-06, CO-13). Registra quem, quando, valor e revisão; a concorrência não muda mais. */
export function fechar(id, conviteId, observacao, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (!['aberta', 'para-fechar'].includes(situacaoDe(c, agora))) return { erro: tr('Esta concorrência não está aberta.') };
  const v = conviteDe(c, conviteId);
  const p = ultimaProposta(v);
  if (!v || !p) return { erro: tr('Escolha uma prestadora que mandou proposta.') };
  if (c.origem && c.origem.tipo === 'projeto' && !c.origem.ganho) return { erro: tr('Esta concorrência saiu de um projeto em orçamento: só fecha depois que o projeto for ganho.') };
  c.situacao = 'fechada';
  c.fechamento = { conviteId: v.id, rev: p.rev, valor: p.total, por: por || '—', em: agora, observacao: String(observacao || '').trim() };
  for (const x of c.convites) {
    if (x.id === v.id) x.situacao = 'vencedora';
    else if (ultimaProposta(x)) x.situacao = 'nao-escolhida';
  }
  registrar(c, por, tr('Concorrência fechada'), v.nome + ' · rev. ' + p.rev, agora);
  salvar();
  return { ok: true };
}

/* Cancelar exige motivo e avisa os convidados (CO-15). */
export function cancelar(id, motivo, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (c.situacao === 'fechada' || c.situacao === 'cancelada') return { erro: tr('Esta concorrência já foi encerrada.') };
  if (!String(motivo || '').trim()) return { erro: tr('Diga o motivo do cancelamento.') };
  if (c.situacao === 'rascunho') {
    lista().splice(lista().indexOf(c), 1);
    salvar();
    return { ok: true, excluida: true };
  }
  c.situacao = 'cancelada';
  c.cancelamento = { motivo: String(motivo).trim(), por: por || '—', em: agora };
  for (const v of c.convites) v.situacao = 'cancelado';
  registrar(c, por, tr('Concorrência cancelada'), String(motivo).trim(), agora);
  salvar();
  return { ok: true };
}

/* ---------- Convidada (com conta, ou pelo link) ---------- */

/* Acha o convite pela conta da empresa aberta ou pelo token do link. */
function alvo(id, quem) {
  const c = achar(id);
  if (!c || c.situacao === 'rascunho') return {};
  const v = quem && quem.token ? c.convites.find((x) => x.token === quem.token) : c.convites.find((x) => x.empresaId && x.empresaId === empresaAtualId());
  return v ? { c, v } : {};
}
function aberta(c, agora) {
  if (c.situacao !== 'aberta') return tr('Esta concorrência não está mais aberta.');
  if (situacaoDe(c, agora) === 'para-fechar') return tr('O prazo da proposta já venceu.');
  return null;
}

export function marcarVisto(id, quem, agora = Date.now()) {
  const { c, v } = alvo(id, quem);
  if (!v) return { erro: tr('Convite não encontrado.') };
  if (!v.vistoEm) {
    v.vistoEm = agora;
    if (v.situacao === 'enviado') v.situacao = 'visto';
    salvar();
  }
  return { ok: true, concorrencia: c.id };
}

/* Vou cotar / Não vou participar (motivo opcional). Quem já mandou proposta não volta atrás por aqui. */
export function responder(id, vai, motivo, por, quem, agora = Date.now()) {
  const { c, v } = alvo(id, quem);
  if (!v) return { erro: tr('Convite não encontrado.') };
  const fechado = aberta(c, agora);
  if (fechado) return { erro: fechado };
  if (v.propostas.length) return { erro: tr('Você já mandou proposta para esta concorrência.') };
  v.situacao = vai ? 'vai-cotar' : 'nao-vai';
  v.motivo = vai ? '' : String(motivo || '').trim();
  v.respondidoEm = agora;
  if (!v.vistoEm) v.vistoEm = agora;
  if (!quem || !quem.token) auditar(tr('Concorrências'), (vai ? tr('Vai cotar') : tr('Não vai participar')) + ': ' + c.servico, '', v.motivo, '', por);
  salvar();
  return { ok: true };
}

/* Enviar a proposta (CO-05, CO-10): até o prazo; cada envio é uma nova revisão e nada se edita.
 * porEtapa só aceita as etapas da concorrência; o total precisa bater com a soma do que foi cotado por etapa. */
export function enviarProposta(id, dados, por, quem, agora = Date.now()) {
  const { c, v } = alvo(id, quem);
  if (!v) return { erro: tr('Convite não encontrado.') };
  const fechado = aberta(c, agora);
  if (fechado) return { erro: fechado };
  if (v.situacao === 'nao-vai') return { erro: tr('Você respondeu que não vai participar.') };
  const porEtapa = {};
  for (const [e, x] of Object.entries(dados.porEtapa || {})) {
    if (x === '' || x == null) continue;
    if (!c.etapas.includes(e)) return { erro: tr('Etapa fora da concorrência: {e}', { e }) };
    const n = valor(x);
    if (!(n > 0)) return { erro: tr('Valor inválido na etapa {e}.', { e }) };
    porEtapa[e] = n;
  }
  const soma = Math.round(Object.values(porEtapa).reduce((s, x) => s + x, 0) * 100) / 100;
  const total = dados.total === '' || dados.total == null ? soma : valor(dados.total);
  if (!(total > 0)) return { erro: tr('Informe o total da proposta.') };
  if (Object.keys(porEtapa).length && Math.abs(total - soma) > 0.01) return { erro: tr('O total precisa ser a soma dos valores por etapa.') };
  const prazoExecucaoDias = dados.prazoExecucaoDias === '' || dados.prazoExecucaoDias == null ? null : Math.round(Number(dados.prazoExecucaoDias));
  if (prazoExecucaoDias != null && !(prazoExecucaoDias > 0)) return { erro: tr('Prazo de execução inválido.') };
  const rev = v.propostas.length + 1;
  v.propostas.push({
    rev, numero: dados.numero || null, enviadaEm: agora, por: por || '—', total, porEtapa, prazoExecucaoDias,
    exclusoes: textoItens(dados.exclusoes), pdf: dados.pdf || null,
  });
  v.situacao = 'proposta';
  if (!v.respondidoEm) v.respondidoEm = agora;
  if (!v.vistoEm) v.vistoEm = agora;
  if (!quem || !quem.token) auditar(tr('Concorrências'), tr('Proposta enviada') + ': ' + c.servico, '', 'rev. ' + rev, '', por);
  salvar();
  return { ok: true, rev };
}
