/* KORbuild — cronograma da obra (docs/cronograma.md).
 *
 *  - A prestadora monta as etapas do serviço dela (nome, início, fim, responsável, % concluído).
 *  - Linha de base: retrato das datas, salvo com data, quem e motivo; o desvio é medido contra a última.
 *  - O % concluído vem do RDO aprovado (atividade → etapa + %) ou de um ajuste do escritório, sempre com histórico.
 *  - Publicar: retrato do cronograma entregue à construtora (contratante), que só lê. */

import { novoId, hoje, diasEntre, somarDias } from './util.js';
import { estado, salvar, compartilhados, empresaPorId } from './armazem.js';
import { tr } from './i18n.js';
import { auditar } from './settings.js';

export const SITUACOES_ETAPA = {
  concluida: { nome: tr('Concluída'), classe: 'etiqueta-verde' },
  atrasada: { nome: tr('Atrasada'), classe: 'etiqueta-alerta' },
  risco: { nome: tr('Em risco'), classe: 'etiqueta-ambar' },
  andamento: { nome: tr('Em andamento'), classe: 'etiqueta-azul' },
  futura: { nome: tr('Não iniciada'), classe: 'etiqueta-neutro' },
};
export const LIMITE_RISCO = 15; // pontos de % abaixo do planejado para hoje
export const DIAS_LOOKAHEAD = 21;

const DATA = /^\d{4}-\d{2}-\d{2}$/;

/* ---------- Leitura ---------- */

export function cronogramaDe(obraId, dados) {
  const d = dados || estado();
  return (d.cronogramas || {})[obraId] || null;
}
export function etapasDe(obraId, dados) { const c = cronogramaDe(obraId, dados); return c ? c.etapas : []; }
export function etapaDoCronograma(obraId, etapaId) { return etapasDe(obraId).find((e) => e.id === etapaId) || null; }

/* Duração em dias corridos (início e fim contam). */
export function duracao(e) { return diasEntre(e.inicio, e.fim) + 1; }

/* % planejado para uma data, pelas datas dadas (linear entre início e fim). */
export function planejadoEm(inicio, fim, iso) {
  if (iso < inicio) return 0;
  if (iso >= fim) return 100;
  return Math.round((diasEntre(inicio, iso) + 1) / (diasEntre(inicio, fim) + 1) * 100);
}

export function ultimaBase(c) { return c && c.bases && c.bases.length ? c.bases[c.bases.length - 1] : null; }
export function datasDeBase(c, e) { const b = ultimaBase(c); return (b && b.etapas[e.id]) || null; }

/* Desvio do fim em dias contra a linha de base (positivo = atrasou). */
export function desvio(c, e) { const b = datasDeBase(c, e); return b ? diasEntre(b.fim, e.fim) : null; }

export function situacaoDaEtapa(e, iso = hoje()) {
  if (e.pct >= 100) return 'concluida';
  if (iso > e.fim) return 'atrasada';
  if (iso < e.inicio && !e.pct) return 'futura';
  if (planejadoEm(e.inicio, e.fim, iso) - (e.pct || 0) >= LIMITE_RISCO) return 'risco';
  return 'andamento';
}

/* Avanço real e planejado da obra, ponderados pela duração das etapas. */
export function avancoDaObra(c, iso = hoje()) {
  if (!c || !c.etapas.length) return null;
  let peso = 0, real = 0, plano = 0;
  for (const e of c.etapas) {
    const d = duracao(e);
    const b = datasDeBase(c, e) || e;
    peso += d;
    real += d * (e.pct || 0);
    plano += d * planejadoEm(b.inicio, b.fim, iso);
  }
  return { real: Math.round(real / peso), planejado: Math.round(plano / peso) };
}

export function periodo(c) {
  if (!c || !c.etapas.length) return null;
  return { inicio: c.etapas.map((e) => e.inicio).sort()[0], fim: c.etapas.map((e) => e.fim).sort().slice(-1)[0] };
}

/* Próximas 3 semanas: em andamento, ou começando/terminando nos próximos 21 dias (CR-07). */
export function proximasSemanas(obraId, iso = hoje()) {
  const ate = somarDias(iso, DIAS_LOOKAHEAD);
  return etapasDe(obraId).filter((e) => (e.pct || 0) < 100 && e.inicio <= ate && (e.fim >= iso || e.inicio <= iso))
    .sort((a, b) => (a.inicio < b.inicio ? -1 : 1));
}

/* Etapas em andamento hoje (a "etapa atual" da obra). */
export function etapasAtuais(obraId, iso = hoje()) {
  return etapasDe(obraId).filter((e) => (e.pct || 0) < 100 && e.inicio <= iso);
}

/* ---------- Escrita ---------- */

function garantir(obraId) {
  const d = estado();
  d.cronogramas = d.cronogramas || {};
  d.cronogramas[obraId] = d.cronogramas[obraId] || { etapas: [], bases: [], publicacoes: [] };
  return d.cronogramas[obraId];
}

function validar(dados) {
  const v = { nome: String(dados.nome || '').trim(), inicio: dados.inicio, fim: dados.fim, responsavelId: dados.responsavelId || null };
  if (!v.nome) return { erro: tr('Dê um nome à etapa (ex.: Framing do 2º pavimento).') };
  if (!DATA.test(v.inicio || '') || !DATA.test(v.fim || '')) return { erro: tr('Informe o início e o fim da etapa.') };
  if (v.fim < v.inicio) return { erro: tr('O fim não pode ser antes do início.') };
  return { ok: v };
}

export function salvarEtapa(obraId, id, dados, por) {
  const r = validar(dados);
  if (r.erro) return r;
  const c = garantir(obraId);
  if (id) {
    const e = c.etapas.find((x) => x.id === id);
    if (!e) return { erro: tr('Etapa não encontrada.') };
    const antes = e.inicio + ' → ' + e.fim;
    Object.assign(e, r.ok);
    auditar(tr('Cronograma'), tr('Etapa alterada: {nome}', { nome: e.nome }), antes, e.inicio + ' → ' + e.fim, '', por);
  } else {
    c.etapas.push({ id: novoId('et'), ...r.ok, pct: 0, historico: [] });
    auditar(tr('Cronograma'), tr('Etapa criada: {nome}', { nome: r.ok.nome }), '', r.ok.inicio + ' → ' + r.ok.fim, '', por);
  }
  // a primeira linha de base é salva sozinha, quando a primeira etapa entra (CR-03)
  if (!c.bases.length) novaBase(obraId, tr('Primeira versão do cronograma'), por, true);
  salvar();
  return { ok: true };
}

export function excluirEtapa(obraId, id, por) {
  const c = garantir(obraId);
  const e = c.etapas.find((x) => x.id === id);
  if (!e) return { erro: tr('Etapa não encontrada.') };
  c.etapas = c.etapas.filter((x) => x.id !== id);
  auditar(tr('Cronograma'), tr('Etapa excluída: {nome}', { nome: e.nome }), '', '', '', por);
  salvar();
  return { ok: true };
}

export function moverEtapa(obraId, id, passo) {
  const c = garantir(obraId);
  const i = c.etapas.findIndex((x) => x.id === id);
  const j = i + passo;
  if (i < 0 || j < 0 || j >= c.etapas.length) return;
  [c.etapas[i], c.etapas[j]] = [c.etapas[j], c.etapas[i]];
  salvar();
}

/* % concluído, com histórico. fonte: 'rdo' (aprovado) ou 'manual' (escritório). */
export function registrarAvanco(obraId, etapaId, pct, { fonte, rdoId, rdoNumero, por, data }) {
  const c = garantir(obraId);
  const e = c.etapas.find((x) => x.id === etapaId);
  const v = Math.round(Number(pct));
  if (!e) return { erro: tr('Etapa não encontrada.') };
  if (!Number.isFinite(v) || v < 0 || v > 100) return { erro: tr('O % concluído vai de 0 a 100.') };
  e.historico = e.historico || [];
  e.historico.push({ em: Date.now(), data: data || hoje(), antes: e.pct || 0, pct: v, fonte, rdoId: rdoId || null, rdoNumero: rdoNumero || null, por });
  e.pct = v;
  if (fonte === 'manual') auditar(tr('Cronograma'), tr('% concluído de {nome}', { nome: e.nome }), e.historico.slice(-1)[0].antes + '%', v + '%', '', por);
  salvar();
  return { ok: true };
}

/* RDO aprovado: cada atividade que aponta uma etapa leva o % para o cronograma (CR-04). */
export function aplicarRdoAprovado(r, por) {
  let n = 0;
  for (const a of r.atividades || []) {
    if (!a.cronoEtapaId || a.cronoPct === '' || a.cronoPct == null) continue;
    const res = registrarAvanco(r.obraId, a.cronoEtapaId, a.cronoPct, { fonte: 'rdo', rdoId: r.id, rdoNumero: r.numero, por, data: r.data });
    if (res.ok) n++;
  }
  return n;
}

export function novaBase(obraId, motivo, por, automatica) {
  const c = garantir(obraId);
  const m = String(motivo || '').trim();
  if (!m) return { erro: tr('O motivo é obrigatório: fica no histórico.') };
  if (!c.etapas.length) return { erro: tr('O cronograma ainda não tem etapas.') };
  c.bases.push({ id: novoId('lb'), em: Date.now(), por, motivo: m, etapas: Object.fromEntries(c.etapas.map((e) => [e.id, { inicio: e.inicio, fim: e.fim }])) });
  if (!automatica) { auditar(tr('Cronograma'), tr('Nova linha de base'), '', '', m, por); salvar(); }
  return { ok: true };
}

/* ---------- Publicar para o contratante (CR-09, CR-10) ---------- */

export function podePublicar(obra) { return !!(obra && obra.vinculo && obra.vinculo.empresaId && obra.vinculo.obraId); }

/* Retrato do cronograma para a construtora (também usado nos dados de exemplo, por isso recebe os dados). */
export function retrato(dados, obra, por, em, versao) {
  const c = cronogramaDe(obra.id, dados);
  const e = dados.empresa;
  const nome = (id) => ((dados.usuarios.find((x) => x.id === id) || (dados.funcionarios || []).find((x) => x.id === id) || {}).nome || '');
  return {
    tipo: 'cronograma', id: novoId('pub'), versao, em, por,
    de: { empresaId: e.id, nome: e.nome, sigla: e.sigla, logo: e.logo || null, telefone: e.telefone || '', email: e.email || '' },
    para: { empresaId: obra.vinculo.empresaId, obraId: obra.vinculo.obraId },
    obraNome: obra.nome,
    cronograma: JSON.parse(JSON.stringify({ etapas: c.etapas.map(({ historico, ...x }) => x), bases: c.bases.slice(-1) })),
    responsaveis: Object.fromEntries(c.etapas.filter((x) => x.responsavelId).map((x) => [x.responsavelId, nome(x.responsavelId)])),
  };
}

export function publicar(obra, por) {
  const c = cronogramaDe(obra.id);
  if (!c || !c.etapas.length) return { erro: tr('O cronograma ainda não tem etapas.') };
  if (!podePublicar(obra)) return { erro: tr('Esta obra não está ligada a uma obra do contratante.') };
  const versao = (c.publicacoes || []).length + 1;
  const pub = retrato(estado(), obra, por, Date.now(), versao);
  compartilhados().push(pub);
  c.publicacoes = (c.publicacoes || []).concat([{ id: pub.id, versao, em: pub.em, por }]);
  auditar(tr('Cronograma'), tr('Cronograma publicado para o contratante (versão {n})', { n: versao }), '', '', '', por);
  salvar();
  return { ok: true, versao };
}

/* O que a construtora recebeu para uma obra dela: a última versão de cada prestadora. */
export function cronogramasRecebidos(obraId) {
  const eu = estado().empresa.id;
  const lista = compartilhados().filter((x) => x.tipo === 'cronograma' && x.para.empresaId === eu && x.para.obraId === obraId);
  const ultimas = {};
  for (const x of lista) if (!ultimas[x.de.empresaId] || ultimas[x.de.empresaId].versao < x.versao) ultimas[x.de.empresaId] = x;
  return Object.values(ultimas);
}
export function publicacao(id) { return compartilhados().find((x) => x.id === id) || null; }

export function nomeResponsavel(id) {
  if (!id) return '';
  const u = estado().usuarios.find((x) => x.id === id);
  if (u) return u.nome;
  const f = (estado().funcionarios || []).find((x) => x.id === id);
  return f ? f.nome : '';
}

/* Nome da empresa do contratante ligado (para a tela da prestadora). */
export function nomeDaEmpresaVinculada(obra) {
  const d = obra && obra.vinculo ? empresaPorId(obra.vinculo.empresaId) : null;
  return d ? d.empresa.nome : '';
}
