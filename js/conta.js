/* KORbuild — a conta de verdade (página oficial, sem "?demo"): login, cadastro, empresa, usuários e perfis no
 * Supabase (docs/banco.md, fatia 1). O protótipo continua no navegador e não passa por aqui.
 * O app navega por "#/…", então o login usa o fluxo PKCE: o Supabase volta com "?code=" e não mexe no "#". */

import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
import { tr, idioma } from './i18n.js';

let sb = null;
let carregando = null;
const ouvintes = new Set();

/* O estado da conta, lido do banco. membro null com sessão = ainda sem empresa (cria no primeiro acesso). */
export const conta = { pronto: false, sessao: null, membro: null, empresa: null, perfil: null, perfis: [], membros: [], convites: [], recuperandoSenha: false };

export function aoMudar(fn) { ouvintes.add(fn); }
const avisar = () => ouvintes.forEach((fn) => fn());

/* A página de volta dos e-mails (confirmação, nova senha): a raiz do site, sem o "#". */
export const enderecoBase = () => location.origin + location.pathname;

function carregarBiblioteca() {
  if (window.supabase && window.supabase.createClient) return Promise.resolve();
  return new Promise((ok, falha) => {
    const s = document.createElement('script');
    s.src = 'vendor/supabase/supabase.js';
    s.onload = ok;
    s.onerror = () => falha(new Error(tr('Não foi possível carregar a conexão com o servidor.')));
    document.head.appendChild(s);
  });
}

export function iniciar() {
  if (carregando) return carregando;
  carregando = (async () => {
    await carregarBiblioteca();
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kbt.conta' },
    });
    sb.auth.onAuthStateChange((evento, sessao) => {
      conta.sessao = sessao;
      if (evento === 'PASSWORD_RECOVERY') conta.recuperandoSenha = true;
      if (evento === 'SIGNED_OUT') Object.assign(conta, { membro: null, empresa: null, perfil: null, perfis: [], membros: [], convites: [] });
      // não chama o banco dentro do próprio aviso do Auth (evita travar a sessão); recarrega logo depois
      setTimeout(() => carregarMinhaConta().then(avisar), 0);
    });
    const { data } = await sb.auth.getSession();
    conta.sessao = data.session;
    // tira o "?code=" do endereço depois que o Supabase o trocou pela sessão
    if (new URLSearchParams(location.search).has('code')) history.replaceState(null, '', location.pathname + location.hash);
    await carregarMinhaConta();
    lembrarIdioma();
    conta.pronto = true;
  })();
  return carregando;
}

/* Os e-mails do Auth (nova senha, troca de e-mail) saem no idioma gravado na conta: acompanha o PT|EN da tela.
 * Trocar o idioma recarrega a página, e iniciar() passa por aqui. Sem esperar: o e-mail é o único que usa. */
function lembrarIdioma() {
  const u = conta.sessao && conta.sessao.user;
  if (!u || (u.user_metadata || {}).idioma === idioma()) return;
  sb.auth.updateUser({ data: { idioma: idioma() } }).catch(() => { /* fica para a próxima vez */ });
}

/* O membro (uma pessoa, uma empresa), a empresa, os perfis e — para quem cuida dos acessos — os usuários e convites.
 * Lê tudo antes e troca o estado de uma vez só. Se alguma leitura falhar (rede, troca de token no meio), mantém o que
 * já havia: senão, por um instante, a pessoa "perderia" as permissões e a tela voltaria para o Início sem motivo. */
const SEM_EMPRESA = { ehAdmin: false, membro: null, empresa: null, perfil: null, perfis: [], membros: [], convites: [] };
/* A última leitura fica no aparelho: sem internet, o app abre com ela (o Daily funciona sem sinal). */
const chaveDaConta = (uid) => 'kbt.oficial.conta.' + uid;
function lembrarConta(uid) {
  try { localStorage.setItem(chaveDaConta(uid), JSON.stringify({ membro: conta.membro, empresa: conta.empresa, perfil: conta.perfil, perfis: conta.perfis })); } catch { /* sem espaço */ }
}
function contaGuardada(uid) {
  try { return JSON.parse(localStorage.getItem(chaveDaConta(uid))); } catch { return null; }
}
export async function carregarMinhaConta() {
  if (!sb || !conta.sessao) { Object.assign(conta, SEM_EMPRESA); return; }
  const uid = conta.sessao.user.id;
  const m = await sb.from('membros').select('*').eq('user_id', uid).maybeSingle();
  const semConexao = () => {
    conta.semConexao = true;
    const g = !conta.membro && contaGuardada(uid);
    if (g && g.membro) Object.assign(conta, g, { membros: [g.membro], convites: [] });
  };
  if (m.error) { semConexao(); return; }
  conta.semConexao = false;
  const membro = m.data;
  if (!membro) { Object.assign(conta, SEM_EMPRESA); return; }
  const [e, p, adm] = await Promise.all([
    sb.from('empresas').select('*').eq('id', membro.empresa_id).maybeSingle(),
    sb.from('perfis_acesso').select('*').order('criado_em'),
    sb.rpc('eh_admin_plataforma'),
  ]);
  if (e.error || p.error) { semConexao(); return; }
  const perfis = p.data || [];
  const perfil = perfis.find((x) => x.id === membro.perfil_id) || null;
  const novo = { ehAdmin: !adm.error && adm.data === true, membro, empresa: e.data || null, perfis, perfil, membros: [membro], convites: [] };
  if (perfil && perfil.permissoes.includes('settings.acesso')) {
    const [ms, cs] = await Promise.all([
      sb.from('membros').select('*').order('criado_em'),
      sb.from('convites_usuario').select('id, email, nome, perfil_id, criado_em, expira_em, aceito_em, cancelado_em').order('criado_em', { ascending: false }),
    ]);
    if (ms.error || cs.error) { semConexao(); return; }
    novo.membros = ms.data || [];
    novo.convites = cs.data || [];
  }
  Object.assign(conta, novo);
  lembrarConta(uid);
}

/* O cliente do Supabase, para os cadastros (js/cadastros.js). */
export const cliente = () => sb;

export function pode(permissao) { return !!(conta.perfil && conta.perfil.permissoes.includes(permissao)); }
export const emailAtual = () => (conta.sessao && conta.sessao.user.email) || '';

/* Mensagens do Supabase no idioma da tela. */
export function traduzir(erro) {
  const m = (erro && (erro.message || erro.msg || String(erro))) || '';
  if (/Invalid login credentials/i.test(m)) return tr('E-mail ou senha incorretos.');
  if (/Email not confirmed/i.test(m)) return tr('Confirme o seu e-mail antes de entrar: abra o link que enviamos.');
  if (/User already registered/i.test(m)) return tr('Já existe uma conta com este e-mail. Entre, ou use "Esqueci a senha".');
  if (/Password should be at least/i.test(m)) return tr('A senha precisa ter pelo menos 8 caracteres.');
  if (/rate limit|too many/i.test(m)) return tr('Muitas tentativas seguidas. Espere um pouco e tente de novo.');
  if (/Unable to validate email|invalid email/i.test(m)) return tr('E-mail inválido.');
  if (/Failed to fetch|NetworkError|network/i.test(m)) return tr('Sem conexão com o servidor. Confira a internet e tente de novo.');
  // mensagens do Crew com datas e nomes
  let x = /^A semana de (\S+) já foi aprovada e enviada para a folha\. Escolha uma data a partir de (\S+)\.$/.exec(m);
  if (x) return tr('A semana de {a} já foi aprovada e enviada para a folha. Escolha uma data a partir de {b}.', { a: x[1], b: x[2] });
  x = /^Antes de aprovar, ajuste as batidas sem saída de: (.+)\.$/.exec(m);
  if (x) return tr('Antes de aprovar, ajuste as batidas sem saída de: {nomes}.', { nomes: x[1] });
  // as regras do banco (gatilhos) respondem em português; tr() traduz as conhecidas
  return m ? tr(m) : tr('Algo deu errado. Tente de novo.');
}
const resultado = ({ error, data }) => (error ? { erro: traduzir(error) } : { ok: true, data });

/* ---------- Login ---------- */

export async function entrar(email, senha) {
  await iniciar();
  const r = resultado(await sb.auth.signInWithPassword({ email: String(email).trim().toLowerCase(), password: senha }));
  if (r.ok) { conta.sessao = r.data.session; await carregarMinhaConta(); await sb.rpc('registrar_acesso'); lembrarIdioma(); }
  return r;
}
/* O idioma da tela vai junto: os e-mails do Auth saem em português ou em inglês (supabase/email/). */
export async function cadastrar(nome, email, senha) {
  await iniciar();
  if (String(nome).trim().length < 2) return { erro: tr('Diga o seu nome.') };
  if (String(senha).length < 8) return { erro: tr('A senha precisa ter pelo menos 8 caracteres.') };
  return resultado(await sb.auth.signUp({ email: String(email).trim(), password: senha, options: { data: { nome: String(nome).trim(), idioma: idioma() }, emailRedirectTo: enderecoBase() } }));
}
export async function pedirNovaSenha(email) {
  await iniciar();
  return resultado(await sb.auth.resetPasswordForEmail(String(email).trim(), { redirectTo: enderecoBase() }));
}
export async function definirNovaSenha(senha) {
  await iniciar();
  if (String(senha).length < 8) return { erro: tr('A senha precisa ter pelo menos 8 caracteres.') };
  const r = resultado(await sb.auth.updateUser({ password: senha }));
  if (r.ok) conta.recuperandoSenha = false;
  return r;
}
export async function sair() { await iniciar(); await sb.auth.signOut(); }

/* ---------- Meu perfil ---------- */

/* Nome e telefone ficam no cadastro da empresa (membros); e-mail e senha, no login (Auth). */
export async function atualizarMeuPerfil(nome, telefone) {
  if (String(nome).trim().length < 2) return { erro: tr('Diga o seu nome.') };
  return rpc('atualizar_meu_perfil', { p_nome: String(nome).trim(), p_telefone: String(telefone || '').trim() });
}
/* O e-mail só muda depois que a pessoa abre o link enviado para o novo endereço (supabase/email/troca-de-email.html). */
export async function trocarEmail(email) {
  await iniciar();
  const novo = String(email).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) return { erro: tr('E-mail inválido.') };
  if (novo === emailAtual().toLowerCase()) return { erro: tr('Este já é o seu e-mail.') };
  const r = resultado(await sb.auth.updateUser({ email: novo }, { emailRedirectTo: enderecoBase() }));
  if (r.ok && r.data && r.data.user) conta.sessao = { ...conta.sessao, user: r.data.user };
  return r;
}
/* O e-mail novo que espera confirmação (o Supabase guarda em new_email). */
export const emailPendente = () => (conta.sessao && conta.sessao.user && conta.sessao.user.new_email) || '';

/* ---------- Empresa e convites (funções do banco: criar_empresa, convidar_usuario, aceitar_convite) ---------- */

async function rpc(nome, args) {
  await iniciar();
  const { data, error } = await sb.rpc(nome, args);
  if (error) return { erro: traduzir(error) };
  await carregarMinhaConta();
  return { ok: true, data };
}
export const criarEmpresa = (dados) => rpc('criar_empresa', { p: dados });
export const aceitarConvite = (token) => rpc('aceitar_convite', { p_token: token });
export async function convidar(email, nome, perfilId) {
  const r = await rpc('convidar_usuario', { p_email: email, p_nome: nome, p_perfil: perfilId });
  return r.erro ? r : { ok: true, link: enderecoBase() + '#/aceitar/' + r.data };
}

/* ---------- Edições (as regras ficam no banco: RLS e gatilhos) ---------- */

async function alterar(tabela, id, mudancas) {
  await iniciar();
  const { error } = await sb.from(tabela).update(mudancas).eq('id', id);
  if (error) return { erro: traduzir(error) };
  await carregarMinhaConta();
  return { ok: true };
}
export const salvarEmpresa = (mudancas) => alterar('empresas', conta.empresa.id, mudancas);
export const salvarPermissoes = (perfilId, permissoes) => alterar('perfis_acesso', perfilId, { permissoes });
export const mudarPerfilDoMembro = (membroId, perfilId) => alterar('membros', membroId, { perfil_id: perfilId });
export const ativarMembro = (membroId, ativo) => alterar('membros', membroId, { ativo });
export const cancelarConvite = (id) => alterar('convites_usuario', id, { cancelado_em: new Date().toISOString() });

export async function criarPerfil(nome, baseId) {
  await iniciar();
  const base = conta.perfis.find((p) => p.id === baseId);
  const { error } = await sb.from('perfis_acesso').insert({ empresa_id: conta.empresa.id, nome: String(nome).trim(), descricao: base ? tr('A partir de {nome}', { nome: base.nome }) : '', permissoes: base ? base.permissoes : [] });
  if (error) return { erro: /duplicate key/i.test(error.message) ? tr('Já existe um perfil com esse nome.') : traduzir(error) };
  await carregarMinhaConta();
  return { ok: true };
}
export async function excluirPerfil(id) {
  await iniciar();
  const { error } = await sb.from('perfis_acesso').delete().eq('id', id);
  if (error) return { erro: /foreign key|violates/i.test(error.message) ? tr('Um perfil em uso não pode ser excluído: troque antes o perfil dos usuários.') : traduzir(error) };
  await carregarMinhaConta();
  return { ok: true };
}
