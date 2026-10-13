/* KORbuild — as concorrências no espelho (docs/banco.md §14).
 *
 * O motor do protótipo (js/concorrencias.js) lê uma lista única, banco.concorrencias, e tira dela o que cada empresa
 * vê. Na conta de verdade a lista é montada aqui, de duas leituras:
 *   · as que a empresa ENVIOU (ela é a contratante): as tabelas inteiras, pelo RLS, com convites, propostas, mensagens,
 *     desenhos e histórico;
 *   · as que a empresa RECEBEU (ela é a convidada): concorrencias_recebidas(), que já chega filtrada pelo banco — só o
 *     próprio convite, as próprias propostas e as mensagens que ela pode ver (CO-04). Cada uma vira uma concorrência com
 *     um convite só, e a contratante vira uma "empresa vizinha" com a obra, que é onde as telas buscam o nome e o endereço.
 * Os pedidos de aprovação de quarteirização (CO-23) chegam por pedidos_de_quarteirizacao(), já no formato das telas.
 * Os links dos convidados sem conta: o banco entrega o token uma vez, ao enviar; o app guarda no aparelho para o
 * botão "Copiar o link" (js/concorrencias-oficial.js). */

import { tr } from './i18n.js';
import { cliente } from './conta.js';
import { lerTudo } from './espelho-crew.js';

const ms = (t) => (t ? new Date(t).getTime() : null);
/* O prazo no banco é um instante; as telas e o motor usam 'AAAA-MM-DDTHH:MM' no fuso do aparelho. */
export function prazoLocal(t) {
  if (!t) return '';
  const d = new Date(t);
  const z = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
}
export const ACOES_HISTORICO = {
  enviada: () => tr('Convites enviados'), prorrogada: () => tr('Prazo prorrogado'), convidados: () => tr('Convidados a mais'), adendo: () => tr('Aviso a todos'),
  fechada: () => tr('Concorrência fechada'), cancelada: () => tr('Concorrência cancelada'), 'aprovacao-pedida': () => tr('Aprovação da quarteirização pedida'), aprovacao: () => tr('Quarteirização decidida'),
};
const acaoDoHistorico = (a) => (ACOES_HISTORICO[a] ? ACOES_HISTORICO[a]() : a);

const CHAVE_LINKS = 'kbt.links-convites';
export function linksGuardados() { try { return JSON.parse(localStorage.getItem(CHAVE_LINKS) || '{}'); } catch { return {}; } }
export function guardarLinks(lista) {
  const l = linksGuardados();
  for (const x of lista || []) if (x.convite_id && x.token) l[x.convite_id] = x.token;
  try { localStorage.setItem(CHAVE_LINKS, JSON.stringify(l)); } catch { /* sem armazenamento */ }
}

export function lerConcorrencias() {
  const rpc = (nome) => cliente().rpc(nome).then(({ data, error }) => (error ? [] : data || []));
  return Promise.all([
    lerTudo('concorrencias', 'criada_em'), lerTudo('concorrencia_desenhos', 'em'), lerTudo('concorrencia_convites', 'convidado_em'),
    lerTudo('concorrencia_propostas', 'enviada_em'), lerTudo('concorrencia_mensagens', 'em'), lerTudo('concorrencia_historico', 'em'),
    rpc('concorrencias_recebidas'), rpc('pedidos_de_quarteirizacao'),
  ]).then(([concorrencias, desenhos, convites, propostas, mensagens, historico, recebidas, pedidos]) => ({ concorrencias, desenhos, convites, propostas, mensagens, historico, recebidas, pedidos }));
}

const proposta = (p) => ({ id: p.id, rev: p.rev, numero: p.numero || null, propostaEmitidaId: p.proposta_emitida_id || null, enviadaEm: ms(p.enviada_em), por: p.por_nome, total: Number(p.total), porEtapa: p.por_etapa || {}, outros: Number(p.outros || 0),
  prazoExecucaoDias: p.prazo_execucao_dias, exclusoes: p.exclusoes || [], pdf: p.pdf_path ? { path: p.pdf_path, nome: p.numero || (p.pdf_path.split('/').pop()) } : null });
const mensagem = (m) => ({ id: m.id, em: ms(m.em), conviteId: m.convite_id || null, de: m.de, autor: m.autor, texto: m.texto, publica: !!m.publica, respostaDe: m.resposta_de || null, aviso: !!m.aviso });
const orcamentoDe = (o) => ({ valor: o && o.valor != null ? Number(o.valor) : null, porEtapa: (o && o.porEtapa) || {}, mostrar: (o && o.mostrar) || 'nao' });

/* Monta d.concorrencias (enviadas + recebidas) e d.pedidosQuarteirizacao; a contratante de cada recebida entra em vizinhas. */
export function aplicarConcorrencias(d, lido, vizinhas, novaEmpresa, minhaEmpresaId) {
  const links = linksGuardados();
  const por = (lista, chave) => lista.reduce((m, x) => { (m[x[chave]] = m[x[chave]] || []).push(x); return m; }, {});
  const desenhosPor = por(lido.desenhos, 'concorrencia_id'), convitesPor = por(lido.convites, 'concorrencia_id'), propostasPor = por(lido.propostas, 'convite_id');
  const mensagensPor = por(lido.mensagens, 'concorrencia_id'), historicoPor = por(lido.historico, 'concorrencia_id');
  const enviadas = lido.concorrencias.map((c) => ({
    id: c.id, contratanteId: c.empresa_id,
    origem: { tipo: c.origem_tipo, id: c.origem_tipo === 'projeto' ? c.projeto_id : c.obra_id }, obraId: c.obra_id || null, paiId: c.pai_id || null,
    servico: c.servico, etapas: c.etapas || [], incluso: c.incluso || [], excluso: c.excluso || [], observacoes: c.observacoes || '',
    desenhos: (desenhosPor[c.id] || []).map((x) => ({ id: x.id, nome: x.nome, path: x.arquivo_path, tamanho: x.tamanho, em: ms(x.em) })),
    prazo: prazoLocal(c.prazo), inicio: c.inicio || '', termino: c.termino || '',
    orcamento: orcamentoDe(c.orcamento), exigencias: c.exigencias || {}, quarteirizacao: c.quarteirizacao,
    situacao: c.situacao, enviadaEm: ms(c.enviada_em), criadaPor: c.criada_por_nome || '—', criadaEm: ms(c.criada_em),
    historico: (historicoPor[c.id] || []).map((h) => ({ em: ms(h.em), por: h.por_nome || '—', acao: acaoDoHistorico(h.acao), detalhe: h.detalhe || '' })),
    convites: (convitesPor[c.id] || []).map((v) => ({
      id: v.id, contatoId: v.contato_id, nome: v.nome, email: v.email || '', empresaId: v.convidada_id || null, token: links[v.id] || null,
      situacao: v.situacao, motivo: v.motivo || '', vistoEm: ms(v.visto_em), respondidoEm: ms(v.respondido_em), projetoId: v.projeto_id || null, convidadoEm: ms(v.convidado_em),
      propostas: (propostasPor[v.id] || []).map(proposta),
    })),
    mensagens: (mensagensPor[c.id] || []).map(mensagem),
    fechamento: c.fechamento ? { conviteId: c.fechamento.conviteId, rev: c.fechamento.rev, valor: Number(c.fechamento.valor), por: c.fechamento.porNome || '—', em: ms(c.fechamento.em), observacao: c.fechamento.observacao || '' } : null,
    aprovacao: c.aprovacao ? { ...c.aprovacao, pedidaEm: ms(c.aprovacao.pedidaEm), decididaEm: ms(c.aprovacao.decididaEm) } : null,
    cancelamento: c.cancelamento ? { motivo: c.cancelamento.motivo, por: c.cancelamento.por || '—', em: ms(c.cancelamento.em) } : null,
  }));
  const recebidas = lido.recebidas.map((x) => {
    const v = x.convite;
    const emp = x.contratante || { id: x.contratanteId, nome: '' };
    // a contratante como empresa vizinha, com a obra (nome e endereço são lidos de lá pelas telas)
    const viz = vizinhas[x.contratanteId] = vizinhas[x.contratanteId] || novaEmpresa({ id: x.contratanteId, nome: emp.nome, atuacao: 'construtora', modulos: ['daily'], logo: null, plano: {}, sigla: emp.sigla, telefone: emp.telefone, email: emp.email });
    const obraId = x.obraId || 'co-obra-' + x.id;
    if (x.obra && !viz.obras.some((o) => o.id === obraId)) viz.obras.push({ id: obraId, nome: x.obra.nome, endereco: x.obra.endereco || '', municipio: x.obra.cidade || '', estado: x.obra.estado || '', zip: x.obra.zip || '', cidade: [x.obra.cidade, x.obra.estado].filter(Boolean).join(', '), situacao: 'andamento', diasTrabalho: [] });
    return {
      id: x.id, contratanteId: x.contratanteId, origem: { tipo: 'obra', id: obraId }, obraId, paiId: null,
      servico: x.servico, etapas: x.etapas || [], incluso: x.incluso || [], excluso: x.excluso || [], observacoes: x.observacoes || '',
      desenhos: (x.desenhos || []).map((y) => ({ id: y.id, nome: y.nome, path: y.path, tamanho: y.tamanho, em: ms(y.em) })),
      prazo: prazoLocal(x.prazo), inicio: x.inicio || '', termino: x.termino || '',
      orcamento: orcamentoDe(x.orcamento), exigencias: x.exigencias || {}, quarteirizacao: x.quarteirizacao,
      situacao: x.situacao === 'para-fechar' ? 'aberta' : x.situacao, enviadaEm: ms(x.enviadaEm), criadaPor: '—', criadaEm: ms(x.enviadaEm),
      historico: (x.historico || []).map((h) => ({ em: ms(h.em), por: '—', acao: acaoDoHistorico(h.acao), detalhe: h.detalhe || '' })),
      convites: [{
        id: v.id, contatoId: null, nome: v.nome, email: v.email || '', empresaId: v.empresaId || minhaEmpresaId, token: null,
        situacao: v.situacao, motivo: v.motivo || '', vistoEm: ms(v.vistoEm), respondidoEm: ms(v.respondidoEm), projetoId: v.projetoId || null, convidadoEm: ms(v.convidadoEm),
        propostas: (v.propostas || []).map((p) => ({ id: p.id, rev: p.rev, numero: p.numero || null, propostaEmitidaId: p.propostaEmitidaId || null, enviadaEm: ms(p.enviadaEm), por: p.por, total: Number(p.total), porEtapa: p.porEtapa || {}, outros: Number(p.outros || 0), prazoExecucaoDias: p.prazoExecucaoDias, exclusoes: p.exclusoes || [], pdf: p.pdf ? { path: p.pdf, nome: p.numero || p.pdf.split('/').pop() } : null })),
      }],
      mensagens: (x.mensagens || []).map((m) => ({ id: m.id, em: ms(m.em), conviteId: m.conviteId || null, de: m.de, autor: m.autor, texto: m.texto, publica: !!m.publica, respostaDe: m.respostaDe || null, aviso: !!m.aviso })),
      fechamento: x.fechamento ? { conviteId: x.fechamento.minha ? v.id : 'outra', rev: null, valor: null, por: '—', em: ms(x.fechamento.em), observacao: '' } : null,
      aprovacao: null,
      cancelamento: x.cancelamento ? { motivo: x.cancelamento.motivo || '', por: '—', em: ms(x.cancelamento.em) } : null,
    };
  });
  d.pedidosQuarteirizacao = (lido.pedidos || []).map((p) => ({ id: p.id, paiId: p.paiId, servico: p.servico, contratante: p.contratante, contratanteId: p.contratanteId, escolhida: p.escolhida, pedidaEm: ms(p.pedidaEm) }));
  return enviadas.concat(recebidas);
}
