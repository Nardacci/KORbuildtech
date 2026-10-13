/* KORbuild — as concorrências na conta de verdade (docs/banco.md §14).
 *
 * As telas do protótipo continuam chamando o motor (js/concorrencias.js); aqui o motor ganha o "servidor": depois das
 * regras locais, cada ação vai à função do banco, que confere de que lado está quem chama e grava, e o espelho é lido
 * de novo. É trabalho de escritório, com internet. O rascunho é gravação direta (a contratante, nas próprias tabelas);
 * de enviada em diante só as funções mudam. O link sem conta (CO-07) passa pela função de borda convite-publico, que
 * é quem fala com o banco com a chave de serviço: a página pública monta um banco só em memória com o que ela devolve. */

import { tr } from './i18n.js';
import { estado, mostrarSemGuardar } from './armazem.js';
import { cliente, traduzir, conta } from './conta.js';
import { montar } from './espelho.js';
import { ligarServidorConcorrencias } from './concorrencias.js';
import { aplicarConcorrencias, guardarLinks } from './espelho-concorrencias.js';
import { descarregar } from './measure-oficial.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const BORDA = SUPABASE_URL + '/functions/v1/convite-publico';
const iso = (dh) => (dh ? new Date(dh).toISOString() : null);
const semInternet = () => ({ erro: tr('Para isto, o escritório precisa estar com internet.') });

async function pedir(fn, resultado) {
  if (!navigator.onLine) return semInternet();
  try {
    const { data, error } = await fn();
    if (error) return { erro: traduzir(error) };
    const extra = resultado ? resultado(data) : {};   // antes de reler: os links guardados entram no espelho novo
    await montar(true).catch(() => {});
    return { ok: true, data, ...extra };
  } catch (e) { return { erro: traduzir(e) }; }
}
const rpc = (nome, args, resultado) => pedir(() => cliente().rpc(nome, args), resultado);
const minha = (id) => (estado().concorrencias || []).find((c) => c.id === id && c.contratanteId === conta.empresa.id);
const conviteMeu = (conviteId) => { for (const c of estado().concorrencias || []) { const v = c.convites.find((x) => x.id === conviteId); if (v) return { c, v }; } return {}; };

/* ---------- Rascunho: gravação direta ---------- */

async function salvarRascunho(id, d, contatoIds, arquivos) {
  if (!navigator.onLine) return semInternet();
  const sb = cliente();
  const linha = {
    origem_tipo: d.origem && d.origem.tipo === 'projeto' ? 'projeto' : 'obra', obra_id: d.obraId || null, projeto_id: d.origem && d.origem.tipo === 'projeto' ? d.origem.id : null,
    servico: d.servico, etapas: d.etapas, incluso: d.incluso, excluso: d.excluso, observacoes: d.observacoes,
    prazo: iso(d.prazo), inicio: d.inicio || null, termino: d.termino || null,
    orcamento: { valor: d.orcamento.valor, porEtapa: d.orcamento.porEtapa || {}, mostrar: d.orcamento.mostrar }, exigencias: d.exigencias || {}, quarteirizacao: d.quarteirizacao,
  };
  try {
    let novoId = id;
    if (id) { const { error } = await sb.from('concorrencias').update(linha).eq('id', id); if (error) throw error; }
    else { const { data, error } = await sb.from('concorrencias').insert(linha).select('id').single(); if (error) throw error; novoId = data.id; }
    // convidados: o que saiu e o que entrou
    const antes = id ? (minha(id) || { convites: [] }).convites : [];
    const sairam = antes.filter((v) => !contatoIds.includes(v.contatoId)).map((v) => v.id);
    const entraram = contatoIds.filter((cid) => !antes.some((v) => v.contatoId === cid));
    if (sairam.length) { const { error } = await sb.from('concorrencia_convites').delete().in('id', sairam); if (error) throw error; }
    if (entraram.length) { const { error } = await sb.from('concorrencia_convites').insert(entraram.map((cid) => ({ concorrencia_id: novoId, contato_id: cid }))); if (error) throw error; }
    // desenhos novos: o PDF vai ao Storage da contratante, a linha aponta para ele
    for (const a of arquivos || []) {
      const path = conta.empresa.id + '/' + novoId + '/desenhos/' + crypto.randomUUID() + '.pdf';
      const bytes = new Blob([await a.arquivo.arrayBuffer()], { type: 'application/pdf' });   // em memória, como as plantas do Measure
      const up = await sb.storage.from('concorrencias').upload(path, bytes, { contentType: 'application/pdf', upsert: false });
      if (up.error) throw up.error;
      const { error } = await sb.from('concorrencia_desenhos').insert({ concorrencia_id: novoId, nome: a.nome, arquivo_path: path, tamanho: a.arquivo.size || 0 });
      if (error) throw error;
    }
    await montar(true).catch(() => {});
    return { ok: true, id: novoId };
  } catch (e) { return { erro: traduzir(e) }; }
}

/* ---------- Pelo link (a função de borda) ---------- */

async function porLink(token, acao, dados, arquivo) {
  if (!navigator.onLine) return { erro: tr('Sem internet. Tente de novo quando a conexão voltar.') };
  try {
    let resp;
    if (arquivo) {
      const fd = new FormData();
      fd.append('token', token); fd.append('acao', acao); fd.append('dados', JSON.stringify(dados || {}));
      fd.append('pdf', new Blob([await arquivo.arrayBuffer()], { type: 'application/pdf' }), arquivo.name || 'proposta.pdf');
      resp = await fetch(BORDA, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY }, body: fd });
    } else {
      resp = await fetch(BORDA, { method: 'POST', headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ token, acao, dados: dados || {} }) });
    }
    const x = await resp.json().catch(() => ({}));
    if (!resp.ok) return { erro: traduzir({ message: x.erro || ('HTTP ' + resp.status) }) };
    return { ok: true, ...x };
  } catch (e) { return { erro: traduzir(e) }; }
}

/* A visão do convite pelo link; null quando o link não vale. */
export async function lerConvitePublico(token) {
  const resp = await fetch(BORDA + '?token=' + encodeURIComponent(token || ''), { headers: { apikey: SUPABASE_ANON_KEY } });
  if (!resp.ok) return null;
  const x = await resp.json();
  return x && x.id ? x : null;
}

/* Um banco só em memória com essa concorrência, para a tela pública do protótipo desenhar (porToken acha pelo token). */
export function mostrarConvitePublico(x, token) {
  const vizinhas = {};
  const base = (emp) => ({ empresa: emp, obras: [], contatos: [], usuarios: [], rdos: [], settings: { perfis: [], auditoria: [] }, measure: { projetos: [] }, oficial: true });
  const lista = aplicarConcorrencias({}, { concorrencias: [], desenhos: [], convites: [], propostas: [], mensagens: [], historico: [], recebidas: [x], pedidos: [] }, vizinhas, base, 'link');
  lista[0].convites[0].token = token;
  mostrarSemGuardar({ versao: 'publico', oficial: true, padrao: x.contratanteId, empresas: vizinhas, compartilhados: [], concorrencias: lista });
}

/* ---------- Ligar ---------- */

export function ligarConcorrenciasOficial() {
  ligarServidorConcorrencias({
    salvarRascunho,
    enviar: (id) => rpc('enviar_concorrencia', { p_id: id }, (r) => { guardarLinks(r && r.links); return { links: (r && r.links) || [] }; }),
    prorrogar: (id, prazo, motivo) => rpc('prorrogar_concorrencia', { p_id: id, p_prazo: iso(prazo), p_motivo: motivo || '' }),
    convidarMais: (id, contatos) => rpc('convidar_mais', { p_id: id, p_contatos: contatos }, (r) => { guardarLinks(r && r.links); return { links: (r && r.links) || [] }; }),
    fechar: (id, convite, observacao) => rpc('fechar_concorrencia', { p_id: id, p_convite: convite, p_observacao: observacao || '' }, (r) => ({ pendente: !!(r && r.pendente) })),
    decidirQuarteirizacao: (id, aprovar, motivo) => rpc('decidir_quarteirizacao', { p_id: id, p_aprovar: !!aprovar, p_motivo: motivo || '' }),
    cancelar: (id, motivo, rascunho) => rpc('cancelar_concorrencia', { p_id: id, p_motivo: motivo }, () => ({ excluida: !!rascunho })),
    cancelarDoProjeto: (projetoId) => rpc('cancelar_concorrencias_do_projeto', { p_projeto: projetoId }),
    vincularProjeto: async (conviteId, projetoId) => { await descarregar().catch(() => {}); return rpc('vincular_projeto_ao_convite', { p_convite: conviteId, p_projeto: projetoId }); },
    marcarVisto: (conviteId, quem) => (quem && quem.token ? Promise.resolve({ ok: true }) : rpc('marcar_visto', { p_convite: conviteId })),
    responder: (conviteId, vai, motivo, quem) => (quem && quem.token ? porLink(quem.token, 'responder', { vai, motivo }) : rpc('responder_convite', { p_convite: conviteId, p_vai: vai, p_motivo: motivo })),
    async enviarProposta(conviteId, d, quem) {
      const p = { total: d.total, porEtapa: d.porEtapa, outros: d.outros, prazoExecucaoDias: d.prazoExecucaoDias, exclusoes: d.exclusoes, numero: d.numero || '', propostaEmitidaId: d.propostaEmitidaId || null };
      if (quem && quem.token) return porLink(quem.token, 'proposta', p, d.pdf && d.pdf.arquivo).then((r) => (r.ok ? { ok: true, rev: r.rev } : r));
      // com conta e PDF solto (sem o Measure): o arquivo vai à pasta do convite, no bucket da contratante
      if (d.pdf && d.pdf.arquivo) {
        const { c, v } = conviteMeu(conviteId);
        if (!c) return { erro: tr('Convite não encontrado.') };
        const path = c.contratanteId + '/' + c.id + '/propostas/' + v.id + '/rev-' + (v.propostas.length + 1) + '.pdf';
        const up = await cliente().storage.from('concorrencias').upload(path, new Blob([await d.pdf.arquivo.arrayBuffer()], { type: 'application/pdf' }), { contentType: 'application/pdf', upsert: true });
        if (up.error) return { erro: traduzir(up.error) };
        p.pdfPath = path;
      }
      return rpc('enviar_proposta_concorrencia', { p_convite: conviteId, p: p }, (rev) => ({ rev }));
    },
    escreverComoConvidada: (conviteId, texto, quem) => (quem && quem.token ? porLink(quem.token, 'escrever', { texto, por: '' }) : rpc('escrever_como_convidada', { p_convite: conviteId, p_texto: texto })),
    escreverComoContratante: (id, { conviteId, respostaDe, paraTodos, texto }) => (!conviteId && !respostaDe
      ? rpc('adendo', { p_id: id, p_texto: texto, p_desenho: null })
      : rpc('escrever_como_contratante', { p_id: id, p_convite: conviteId || null, p_resposta_de: respostaDe || null, p_para_todos: !!paraTodos, p_texto: texto })),
  });
}
