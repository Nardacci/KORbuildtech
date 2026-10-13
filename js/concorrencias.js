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

/* Na conta de verdade (docs/banco.md §14), as ações vão às funções do banco: js/concorrencias-oficial.js liga aqui um
 * "servidor". As regras locais continuam valendo antes (a mensagem sai na hora); o banco confere de novo e devolve
 * { ok } ou { erro }; o espelho é relido em seguida. No protótipo não há servidor e tudo fica no aparelho. */
let servidor = null;
export function ligarServidorConcorrencias(s) { servidor = s; }
export const servidorConcorrencias = () => servidor;

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

/* Projeto do Measure da empresa aberta (ou de outra, pelos dados dela). */
function projetoDe(dados, id) { return (((dados || {}).measure || {}).projetos || []).find((p) => p.id === id) || null; }
/* A concorrência "de cima": a que a empresa ganhou (ou está cotando) e da qual esta é uma quarteirização. */
export function concorrenciaPai(c) { return c && c.paiId ? achar(c.paiId) : null; }

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
  const dados = empresaPorId(c.contratanteId) || {};
  const o = (dados.obras || []).find((x) => x.id === c.obraId) || (c.origem && c.origem.tipo === 'projeto' ? (({ nome, endereco, cidade, estado: uf, zip }) => ({ nome, endereco, municipio: cidade, estado: uf, zip }))(projetoDe(dados, c.origem.id) || {}) : null);
  return {
    id: c.id, contratanteId: c.contratanteId, contratante: dados.empresa || null,
    obraId: c.obraId, obra: o ? { nome: o.nome, endereco: o.endereco || '', cidade: o.municipio || o.cidade || '', estado: o.estado || '', zip: o.zip || '' } : null, servico: c.servico, etapas: c.etapas.slice(), incluso: c.incluso.slice(), excluso: c.excluso.slice(),
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
  if (d.origem && d.origem.tipo === 'projeto') {
    if (!projetoDe(estado(), d.origem.id)) return { erro: tr('Projeto não encontrado.') };
    d.obraId = null;
  } else if (d.obraId) d.origem = { tipo: 'obra', id: d.obraId };
  // quarteirização: a concorrência de cima é a do projeto (cotando) ou a da obra (ganha)
  const pj = d.origem && d.origem.tipo === 'projeto' ? projetoDe(estado(), d.origem.id) : null;
  const ob = d.obraId ? estado().obras.find((o) => o.id === d.obraId) : null;
  d.paiId = (pj && pj.concorrencia && pj.concorrencia.id) || (ob && ob.concorrenciaId) || null;
  // convidados: contatos (marcador prestadora) desta empresa, sem repetir (CO-16)
  const ids = [...new Set(dados.convidados || (atual ? atual.convites.map((v) => v.contatoId) : []))];
  for (const cid of ids) if (!contato(cid)) return { erro: tr('Convidado não encontrado nos Contatos.') };
  if (servidor) return servidor.salvarRascunho(id, d, ids, dados.desenhosNovos || []);
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
  // CO-25: cotando antes da própria proposta, o prazo vence antes do prazo do projeto
  const pj = c.origem && c.origem.tipo === 'projeto' ? projetoDe(empresaPorId(c.contratanteId), c.origem.id) : null;
  if (pj && pj.prazoProposta && c.prazo && c.prazo.slice(0, 10) >= pj.prazoProposta) p.push(tr('O prazo precisa vencer antes do prazo da sua proposta ({data}).', { data: pj.prazoProposta }));
  // CO-23: a contratante de cima pode não permitir quarteirizar
  const pai = concorrenciaPai(c);
  if (pai && pai.quarteirizacao === 'nao-permitida') p.push(tr('A contratante desta obra não permite quarteirizar.'));
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
  if (servidor) return servidor.enviar(c.id);
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
  if (servidor) return servidor.prorrogar(c.id, novoPrazo, motivo);
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
  if (servidor) return servidor.convidarMais(c.id, novos);
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
    return { conviteId: v.id, nome: v.nome, comConta: !!v.empresaId, rev: p.rev, numero: p.numero, enviadaEm: p.enviadaEm, total: p.total, outros: p.outros || 0, prazoExecucaoDias: p.prazoExecucaoDias, exclusoes: p.exclusoes.slice(), naoCotadas, exclusoesNoEscopo };
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
  if (servidor) return servidor.fechar(c.id, v.id, observacao);
  if (c.origem && c.origem.tipo === 'projeto') {
    const pj = projetoDe(estado(), c.origem.id);
    if (!pj || pj.situacao !== 'ganha') return { erro: tr('Esta concorrência saiu de um projeto em orçamento: só fecha depois que o projeto for ganho.') };
    if (!pj.obraId) return { erro: tr('Crie a obra a partir do projeto antes de fechar: a contratada fica ligada a ela.') };
    c.obraId = pj.obraId;
  }
  // CO-23: com a aprovação da contratante de cima, o fechamento espera a decisão dela
  const pai = concorrenciaPai(c);
  if (pai && pai.quarteirizacao === 'com-aprovacao' && !(c.aprovacao && c.aprovacao.situacao === 'aprovada' && c.aprovacao.conviteId === v.id)) {
    c.aprovacao = { conviteId: v.id, nome: v.nome, situacao: 'pendente', pedidaEm: agora, observacao: String(observacao || '').trim() };
    registrar(c, por, tr('Aprovação da quarteirização pedida'), v.nome, agora);
    salvar();
    return { ok: true, pendente: true };
  }
  return concluirFechamento(c, v, p, observacao, por, agora);
}

function concluirFechamento(c, v, p, observacao, por, agora) {
  c.situacao = 'fechada';
  c.fechamento = { conviteId: v.id, rev: p.rev, valor: p.total, por: por || '—', em: agora, observacao: String(observacao || '').trim() };
  for (const x of c.convites) {
    if (x.id === v.id) x.situacao = 'vencedora';
    else if (ultimaProposta(x)) x.situacao = 'nao-escolhida';
  }
  registrar(c, por, tr('Concorrência fechada'), v.nome + ' · rev. ' + p.rev, agora);
  // CO-14: na vencedora com conta, o projeto do Measure vira Ganha e guarda a ligação para a obra que ela criar
  const dadosDela = v.empresaId && empresaPorId(v.empresaId);
  const pj = dadosDela && v.projetoId && ((dadosDela.measure || {}).projetos || []).find((x) => x.id === v.projetoId);
  if (pj) {
    pj.situacao = 'ganha';
    pj.concorrencia = { ...(pj.concorrencia || {}), id: c.id, conviteId: v.id, contratanteId: c.contratanteId, vinculo: { empresaId: c.contratanteId, obraId: c.obraId } };
  }
  salvar();
  return { ok: true };
}

/* Pedidos de aprovação de quarteirização que chegam à contratante de cima (CO-23). Ela vê só o nome da
 * empresa escolhida, nunca o valor entre as duas (CO-22). */
export function pedidosDeQuarteirizacao(empresaId = empresaAtualId()) {
  if (servidor && estado() && estado().pedidosQuarteirizacao) return estado().pedidosQuarteirizacao;
  return lista().filter((c) => c.aprovacao && c.aprovacao.situacao === 'pendente' && (concorrenciaPai(c) || {}).contratanteId === empresaId)
    .map((c) => ({ id: c.id, paiId: c.paiId, servico: c.servico, contratante: ((empresaPorId(c.contratanteId) || {}).empresa || {}).nome || '', escolhida: c.aprovacao.nome, pedidaEm: c.aprovacao.pedidaEm }));
}
export function decidirQuarteirizacao(id, aprovar, motivo, por, agora = Date.now()) {
  if (servidor) return servidor.decidirQuarteirizacao(id, aprovar, motivo);
  const c = achar(id);
  const pai = concorrenciaPai(c);
  if (!c || !pai || pai.contratanteId !== empresaAtualId() || !c.aprovacao || c.aprovacao.situacao !== 'pendente') return { erro: tr('Pedido não encontrado.') };
  c.aprovacao.situacao = aprovar ? 'aprovada' : 'recusada';
  c.aprovacao.decididaEm = agora;
  c.aprovacao.por = por || '—';
  c.aprovacao.motivo = String(motivo || '').trim();
  auditar(tr('Concorrências'), (aprovar ? tr('Quarteirização aprovada') : tr('Quarteirização recusada')) + ': ' + c.servico, '', c.aprovacao.nome, c.aprovacao.motivo, por);
  if (aprovar) {
    const v = c.convites.find((x) => x.id === c.aprovacao.conviteId);
    // a decisão é da contratante de cima; o fechamento fica registrado em nome de quem pediu
    concluirFechamento(c, v, ultimaProposta(v), c.aprovacao.observacao, c.historico[c.historico.length - 1].por, agora);
  } else salvar();
  return { ok: true };
}

/* CO-24: projeto perdido cancela as concorrências que saíram dele. */
export function cancelarDoProjeto(projetoId, por, agora = Date.now()) {
  if (servidor) return servidor.cancelarDoProjeto(projetoId);
  for (const c of enviadas().filter((x) => x.origem && x.origem.tipo === 'projeto' && x.origem.id === projetoId && ['aberta', 'rascunho'].includes(x.situacao))) {
    cancelar(c.id, tr('O projeto foi perdido.'), por, agora);
  }
}

/* A convidada liga o convite ao projeto que criou no Measure para cotar ("Vou cotar"). */
export function vincularProjeto(id, projetoId, quem) {
  const { v } = alvo(id, quem);
  if (!v) return { erro: tr('Convite não encontrado.') };
  if (servidor) return servidor.vincularProjeto(v.id, projetoId);
  v.projetoId = projetoId;
  salvar();
  return { ok: true };
}

/* Cancelar exige motivo e avisa os convidados (CO-15). */
export function cancelar(id, motivo, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  if (c.situacao === 'fechada' || c.situacao === 'cancelada') return { erro: tr('Esta concorrência já foi encerrada.') };
  if (!String(motivo || '').trim()) return { erro: tr('Diga o motivo do cancelamento.') };
  if (servidor) return servidor.cancelar(c.id, motivo, c.situacao === 'rascunho');
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
  if (servidor && !v.vistoEm) return servidor.marcarVisto(v.id, quem);
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
  if (servidor) return servidor.responder(v.id, !!vai, String(motivo || '').trim(), quem);
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
  // outros: o que a proposta tem fora das etapas da concorrência (mobilização, caçamba…)
  const outros = dados.outros === '' || dados.outros == null ? 0 : valor(dados.outros);
  if (!(outros >= 0)) return { erro: tr('Valor inválido em outros itens.') };
  const soma = Math.round((Object.values(porEtapa).reduce((s, x) => s + x, 0) + outros) * 100) / 100;
  const total = dados.total === '' || dados.total == null ? soma : valor(dados.total);
  if (!(total > 0)) return { erro: tr('Informe o total da proposta.') };
  if (Object.keys(porEtapa).length && Math.abs(total - soma) > 0.01) return { erro: tr('O total precisa ser a soma dos valores por etapa.') };
  const prazoExecucaoDias = dados.prazoExecucaoDias === '' || dados.prazoExecucaoDias == null ? null : Math.round(Number(dados.prazoExecucaoDias));
  if (prazoExecucaoDias != null && !(prazoExecucaoDias > 0)) return { erro: tr('Prazo de execução inválido.') };
  if (servidor) return servidor.enviarProposta(v.id, { total, porEtapa, outros, prazoExecucaoDias, exclusoes: textoItens(dados.exclusoes), numero: dados.numero || '', propostaEmitidaId: dados.propostaEmitidaId || null, pdf: dados.pdf || null }, quem);
  const rev = v.propostas.length + 1;
  v.propostas.push({
    rev, numero: dados.numero || null, enviadaEm: agora, por: por || '—', total, porEtapa, outros, prazoExecucaoDias,
    exclusoes: textoItens(dados.exclusoes), pdf: dados.pdf || null,
  });
  v.situacao = 'proposta';
  if (!v.respondidoEm) v.respondidoEm = agora;
  if (!v.vistoEm) v.vistoEm = agora;
  if (!quem || !quem.token) auditar(tr('Concorrências'), tr('Proposta enviada') + ': ' + c.servico, '', 'rev. ' + rev, '', por);
  salvar();
  return { ok: true, rev };
}

/* ---------- Canal (docs/concorrencias.md §5) ----------
 * As mensagens ficam na concorrência. Cada uma pertence à conversa de um convite (conviteId), ou é um aviso a
 * todos (conviteId null). "publica" = todas as convidadas veem. Uma pergunta respondida para todos fica pública,
 * sem o nome de quem perguntou. Depois do fechamento, a conversa da vencedora continua como o canal da obra.
 * Nada se edita nem se apaga. */

function msgs(c) { c.mensagens = c.mensagens || []; return c.mensagens; }

/* O que a convidada vê: a própria conversa e o que é público; perguntas de outras, sem o nome. */
export function canalDaConvidada(c, conviteId) {
  return msgs(c).filter((m) => m.conviteId === conviteId || m.publica).map((m) => ({
    ...m, minha: m.de === 'convidada' && m.conviteId === conviteId,
    autor: m.de === 'convidada' && m.conviteId !== conviteId ? tr('Pergunta de um convidado') : m.autor,
  }));
}
/* O que a contratante vê: tudo; com conviteId, só a conversa daquele convite (e os avisos a todos). */
export function canalDaContratante(c, conviteId) {
  return msgs(c).filter((m) => !conviteId || m.conviteId === conviteId || m.conviteId === null);
}
/* Pelo link (CO-07): a conversa do convite desse token. */
export function canalPorToken(token) {
  for (const c of lista()) {
    const v = c.situacao !== 'rascunho' && c.convites.find((x) => x.token === token);
    if (v) return canalDaConvidada(c, v.id);
  }
  return [];
}
export function canalRecebido(id, empresaId = empresaAtualId()) {
  const c = achar(id);
  const v = c && c.convites.find((x) => x.empresaId === empresaId);
  return v ? canalDaConvidada(c, v.id) : [];
}

function podeConversar(c, v, agora) {
  if (c.situacao === 'cancelada') return tr('Esta concorrência foi cancelada.');
  if (c.situacao === 'fechada') return v && c.fechamento.conviteId === v.id ? null : tr('A conversa continua só com a empresa contratada.');
  if (c.situacao === 'aberta' && instante(c.prazo) <= agora && v && !ultimaProposta(v)) return tr('O prazo da proposta já venceu.');
  return null;
}

/* A convidada escreve na própria conversa (pergunta antes do fechamento; depois, se venceu, o canal da obra). */
export function escreverComoConvidada(id, texto, por, quem, agora = Date.now()) {
  const { c, v } = alvo(id, quem);
  if (!v) return { erro: tr('Convite não encontrado.') };
  const t = String(texto || '').trim();
  if (!t) return { erro: tr('Escreva a mensagem.') };
  const bloqueio = podeConversar(c, v, agora);
  if (bloqueio) return { erro: bloqueio };
  if (servidor) return servidor.escreverComoConvidada(v.id, t, quem);
  const m = { id: novoId('mg'), em: agora, conviteId: v.id, de: 'convidada', autor: (por ? por + ' · ' : '') + v.nome, texto: t, publica: false, respostaDe: null };
  msgs(c).push(m);
  salvar();
  return { ok: true, id: m.id };
}

/* A contratante escreve: para um convite (conviteId), respondendo a uma pergunta (respostaDe) para todos ou só
 * para quem perguntou, ou um aviso/adendo a todos (conviteId null, só com a concorrência aberta). */
export function escreverComoContratante(id, { conviteId = null, respostaDe = null, paraTodos = false, texto }, por, agora = Date.now()) {
  const c = concorrenciaEnviada(id);
  if (!c) return { erro: tr('Concorrência não encontrada.') };
  const t = String(texto || '').trim();
  if (!t) return { erro: tr('Escreva a mensagem.') };
  if (c.situacao === 'rascunho') return { erro: tr('Envie os convites antes de conversar.') };
  const pergunta = respostaDe ? msgs(c).find((m) => m.id === respostaDe && m.de === 'convidada') : null;
  if (respostaDe && !pergunta) return { erro: tr('Pergunta não encontrada.') };
  const alvoId = pergunta ? pergunta.conviteId : conviteId;
  const v = alvoId ? c.convites.find((x) => x.id === alvoId) : null;
  if (alvoId && !v) return { erro: tr('Convite não encontrado.') };
  if (!alvoId && c.situacao !== 'aberta') return { erro: tr('Aviso a todos só com a concorrência aberta.') };
  if (c.situacao === 'cancelada') return { erro: tr('Esta concorrência foi cancelada.') };
  if (c.situacao === 'fechada' && alvoId !== c.fechamento.conviteId) return { erro: tr('A conversa continua só com a empresa contratada.') };
  if (servidor) return servidor.escreverComoContratante(c.id, { conviteId: alvoId || null, respostaDe: pergunta ? pergunta.id : null, paraTodos: !!paraTodos, texto: t });
  const publica = !alvoId || (!!pergunta && !!paraTodos && c.situacao === 'aberta');
  if (pergunta && publica) pergunta.publica = true;
  const quemEmpresa = (empresaPorId(c.contratanteId) || {}).empresa || {};
  const m = { id: novoId('mg'), em: agora, conviteId: alvoId || null, de: 'contratante', autor: (por ? por + ' · ' : '') + (quemEmpresa.nome || ''), texto: t, publica, respostaDe: pergunta ? pergunta.id : null, aviso: !alvoId };
  msgs(c).push(m);
  if (!alvoId) registrar(c, por, tr('Aviso a todos'), t.slice(0, 80), agora);
  salvar();
  return { ok: true, id: m.id };
}

/* Perguntas da conversa de cada convite ainda sem resposta da contratante. */
export function perguntasSemResposta(c) {
  const respondidas = new Set(msgs(c).filter((m) => m.respostaDe).map((m) => m.respostaDe));
  return msgs(c).filter((m) => m.de === 'convidada' && !respondidas.has(m.id) && !msgs(c).some((x) => x.de === 'contratante' && x.conviteId === m.conviteId && x.em > m.em));
}

/* ---------- Avisos para o sininho (calculados, como os outros módulos) ---------- */

export function avisosDaContratante(empresaId = empresaAtualId()) {
  const lista = [];
  for (const c of enviadas(empresaId)) {
    if (c.situacao === 'rascunho') continue;
    const href = '#/daily/concorrencias/' + c.id;
    for (const v of c.convites) {
      for (const p of v.propostas) lista.push({ id: 'co-prop-' + v.id + '-' + p.rev, em: p.enviadaEm, titulo: tr('Proposta de {nome} (rev. {rev}) · {servico}', { nome: v.nome, rev: p.rev, servico: c.servico }), href: href + '/comparar' });
      if (v.situacao === 'nao-vai' && v.respondidoEm) lista.push({ id: 'co-recusa-' + v.id, em: v.respondidoEm, titulo: tr('{nome} não vai participar · {servico}', { nome: v.nome, servico: c.servico }), href });
    }
    for (const m of msgs(c).filter((x) => x.de === 'convidada')) lista.push({ id: 'co-msg-' + m.id, em: m.em, titulo: tr('Mensagem de {nome} · {servico}', { nome: m.autor, servico: c.servico }), href: href + '/perguntas' });
    if (c.aprovacao && c.aprovacao.decididaEm) lista.push({ id: 'co-aprov-' + c.id + '-' + c.aprovacao.decididaEm, em: c.aprovacao.decididaEm, titulo: (c.aprovacao.situacao === 'aprovada' ? tr('Quarteirização aprovada') : tr('Quarteirização recusada')) + ': ' + c.aprovacao.nome + ' · ' + c.servico, href });
    if (c.situacao === 'aberta' && instante(c.prazo) <= Date.now()) lista.push({ id: 'co-prazo-' + c.id + '-' + c.prazo, em: instante(c.prazo), titulo: tr('Prazo vencido: compare e feche · {servico}', { servico: c.servico }), href: href + '/comparar' });
  }
  for (const pd of pedidosDeQuarteirizacao(empresaId)) lista.push({ id: 'co-pedido-' + pd.id + '-' + pd.pedidaEm, em: pd.pedidaEm, titulo: tr('{contratante} quer quarteirizar para {escolhida}: aprove ou recuse', { contratante: pd.contratante, escolhida: pd.escolhida }), href: '#/daily/concorrencias/' + pd.paiId });
  return lista;
}

export function avisosDaConvidada(empresaId = empresaAtualId()) {
  const saida = [];
  for (const c of lista()) {
    if (c.situacao === 'rascunho') continue;
    const v = c.convites.find((x) => x.empresaId === empresaId);
    if (!v) continue;
    const nome = ((empresaPorId(c.contratanteId) || {}).empresa || {}).nome || '';
    const href = '#/measure/convite/' + c.id;
    const convidadaEm = (c.historico.find((h) => h.detalhe && h.detalhe.includes(v.nome)) || {}).em || c.enviadaEm || c.criadaEm;
    saida.push({ id: 'cv-novo-' + v.id, em: convidadaEm, titulo: tr('Convite para cotar: {servico} · {nome}', { servico: c.servico, nome }), href });
    for (const h of c.historico.filter((x) => x.acao === tr('Prazo prorrogado'))) saida.push({ id: 'cv-prazo-' + v.id + '-' + h.em, em: h.em, titulo: tr('Prazo prorrogado: {servico}', { servico: c.servico }), href });
    for (const m of canalDaConvidada(c, v.id).filter((x) => x.de === 'contratante')) saida.push({ id: 'cv-msg-' + m.id, em: m.em, titulo: (m.aviso ? tr('Aviso a todos') : m.respostaDe ? tr('Resposta') : tr('Mensagem de {nome}', { nome })) + ' · ' + c.servico, href });
    if (c.situacao === 'fechada') saida.push({ id: 'cv-fim-' + v.id, em: c.fechamento.em, titulo: v.situacao === 'vencedora' ? tr('Você venceu: {servico} · {nome}', { servico: c.servico, nome }) : tr('Concorrência fechada com outra empresa: {servico}', { servico: c.servico }), href });
    if (c.situacao === 'cancelada') saida.push({ id: 'cv-cancel-' + v.id, em: c.cancelamento.em, titulo: tr('Concorrência cancelada: {servico}', { servico: c.servico }), href });
  }
  return saida;
}
