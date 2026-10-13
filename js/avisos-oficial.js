/* KORbuild — os avisos do servidor na conta de verdade (docs/banco.md §15): o sininho e as preferências de e-mail.
 *
 * O banco grava os avisos que vêm de outra pessoa ou empresa (diário enviado ou aprovado, cronograma publicado, semana do
 * ponto, concorrências e canal, fim do teste) na tabela notificacoes, por gatilhos. Aqui o app os lê (cada um só lê os seus,
 * pelo RLS), junta com os lembretes que o aparelho calcula sozinho (16h, RDO atrasado, etapa atrasada) e marca como lido no
 * banco quando a pessoa abre. O texto vem como "chave" em português + dados e é traduzido aqui (tr), no idioma da tela. */

import { tr } from './i18n.js';
import { cliente, conta } from './conta.js';
import { depoisDeMontar } from './espelho.js';
import { aoMarcarLidas, atualizarSino } from './plataforma.js';

const MINUTO = 60000;
const MODULO = { daily: 'daily', cronograma: 'daily', crew: 'crew', conta: 'settings' };
let avisos = [];          // as linhas do banco, mais novas primeiro
let prefs = null;         // { categoria: { push, email } } (null = ainda não lido)

const moduloDe = (a) => (a.categoria === 'concorrencia' ? ((a.link || '').startsWith('#/measure') ? 'measure' : 'daily') : MODULO[a.categoria] || 'daily');

/* No formato do sininho: { id, em, modulo, titulo, href, lida }. */
export function avisosDoServidor() {
  return avisos.map((a) => ({
    id: 'sv-' + a.id, em: new Date(a.criado_em).getTime(), modulo: moduloDe(a),
    titulo: a.chave ? tr(a.chave, a.dados || {}) : a.titulo, href: a.link || '#/inicio', lida: !!a.lida_em,
  }));
}

export async function lerAvisos() {
  if (!conta.sessao || !navigator.onLine) return;
  const { data, error } = await cliente().from('notificacoes').select('id, categoria, titulo, texto, link, chave, dados, lida_em, criado_em').order('criado_em', { ascending: false }).limit(40);
  if (!error) avisos = data || [];
}

/* ---------- Preferências de e-mail (Meu perfil) ---------- */

export const CATEGORIAS_DE_EMAIL = ['daily', 'cronograma', 'concorrencia', 'conta'];   // o ponto da equipe é só sininho
export async function lerPrefs() {
  if (!conta.sessao || !navigator.onLine) return;
  const { data, error } = await cliente().from('notificacao_prefs').select('categoria, push, email');
  if (error) return;
  prefs = {};
  for (const p of data || []) prefs[p.categoria] = { push: p.push, email: p.email };
}
export const prefsLidas = () => prefs !== null;
/* Sem linha = ligado (o padrão do banco). */
export const recebePorEmail = (categoria) => !prefs || !prefs[categoria] || prefs[categoria].email !== false;
export async function salvarPrefEmail(categoria, ligado) {
  const antes = (prefs && prefs[categoria]) || { push: true, email: true };
  const { error } = await cliente().from('notificacao_prefs').upsert({ user_id: conta.sessao.user.id, categoria, push: antes.push, email: !!ligado }, { onConflict: 'user_id,categoria' });
  if (error) return { erro: error.message };
  prefs = prefs || {};
  prefs[categoria] = { push: antes.push, email: !!ligado };
  return { ok: true };
}

/* ---------- Ligar ---------- */

export function ligarAvisosOficial() {
  // ao abrir o app e depois de cada leitura do espelho; e de minuto em minuto enquanto a janela está à vista
  depoisDeMontar(() => { lerAvisos().then(atualizarSino).catch(() => {}); if (prefs === null) lerPrefs().catch(() => {}); });
  const atualizar = () => { if (document.visibilityState === 'visible' && conta.sessao) lerAvisos().then(atualizarSino).catch(() => {}); };
  setInterval(atualizar, MINUTO);
  document.addEventListener('visibilitychange', atualizar);
  // marcar como lido no sininho grava no banco (os lembretes calculados no aparelho continuam só no aparelho)
  aoMarcarLidas((ids) => {
    const sv = ids.filter((i) => String(i).startsWith('sv-')).map((i) => Number(String(i).slice(3)));
    if (!sv.length) return;
    const agora = new Date().toISOString();
    for (const a of avisos) if (sv.includes(a.id) && !a.lida_em) a.lida_em = agora;
    cliente().from('notificacoes').update({ lida_em: agora }).in('id', sv).is('lida_em', null).then(() => {}, () => {});
  });
}

export const textoDaCategoria = {
  daily: () => tr('Diário de obra: enviado para aprovar, aprovado, ajustes pedidos'),
  cronograma: () => tr('Cronograma publicado pela prestadora'),
  concorrencia: () => tr('Concorrências e o canal: convites, propostas, perguntas, prazos e resultado'),
  conta: () => tr('Conta: fim do período de teste'),
};
