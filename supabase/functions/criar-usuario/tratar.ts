// KORbuild — a lógica da função criar-usuario, sem Deno nem rede (testada em tests/criar-usuario.test.mjs com clientes de mentira).
// Quem cadastra: o login dele confere a permissão (as funções preparar_* do banco rodam COM o login dele); só depois a chave de serviço cria o login.
import { novaSenha } from './senha.ts';

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

// o que a função usa de cada cliente do Supabase (permite testar com clientes de mentira)
// deno-lint-ignore no-explicit-any
export type Cliente = any;
export type Dependencias = { clienteDoChamador: (autorizacao: string) => Cliente; servico: Cliente };

// as mensagens do banco chegam em português e são para a pessoa; tira só o prefixo "ERROR:" se vier
const mensagem = (e: { message?: string } | null) => String((e && e.message) || '').replace(/^ERROR:\s*/i, '') || 'Não foi possível concluir. Tente de novo.';

export async function tratar(req: Request, d: Dependencias): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return resposta({ erro: 'Método inválido.' }, 405);
  const autorizacao = req.headers.get('Authorization') || '';
  if (!autorizacao.startsWith('Bearer ')) return resposta({ erro: 'Entre para continuar.' }, 401);
  const quem = d.clienteDoChamador(autorizacao);
  const { data: u, error: eu } = await quem.auth.getUser();
  if (eu || !u || !u.user) return resposta({ erro: 'Entre para continuar.' }, 401);
  const admin: string = u.user.id;
  const sb = d.servico;

  // 20 cadastros por minuto por administrador (contador no banco: migração 0014)
  const { data: livre } = await sb.rpc('contar_tentativa', { p_chave: 'cu:' + admin, p_max: 20, p_registrar: true });
  if (livre === false) return resposta({ erro: 'Muitas tentativas. Espere um minuto.' }, 429);

  let corpo: Record<string, unknown> = {};
  try { corpo = await req.json(); } catch { return resposta({ erro: 'Pedido inválido.' }, 400); }
  const texto = (k: string) => String(corpo[k] ?? '').trim();

  if (corpo.acao === 'criar') {
    const email = texto('email').toLowerCase(), perfil = texto('perfil');
    const { error: ep } = await quem.rpc('preparar_usuario_direto', { p_email: email, p_perfil: perfil });
    if (ep) return resposta({ erro: mensagem(ep) }, 400);
    const senha = novaSenha();
    const { data: criado, error: ec } = await sb.auth.admin.createUser({ email, password: senha, email_confirm: true, user_metadata: { nome: texto('nome'), idioma: 'pt', trocar_senha: true } });
    if (ec || !criado || !criado.user) {
      console.error('criar-usuario: createUser', ec && ec.status);   // só o código: nada de e-mail nem senha no log
      return resposta({ erro: ec && /already|registered|exists/i.test(ec.message || '') ? 'Este e-mail já tem conta no KORbuild. Use "Convidar por link".' : 'Não foi possível criar o login. Tente de novo.' }, 400);
    }
    const { data: membro, error: ef } = await sb.rpc('finalizar_usuario_direto', { p_admin: admin, p_user: criado.user.id, p_perfil: perfil, p_nome: texto('nome'), p_cargo: texto('cargo'), p_telefone: texto('telefone') });
    if (ef) {
      await sb.auth.admin.deleteUser(criado.user.id);   // não deixa login sem empresa para trás
      return resposta({ erro: mensagem(ef) }, 400);
    }
    return resposta({ ok: true, senha, membro });
  }

  if (corpo.acao === 'nova-senha') {
    const { data: alvo, error: ep } = await quem.rpc('preparar_nova_senha', { p_membro: texto('membro') });
    if (ep || !alvo) return resposta({ erro: mensagem(ep) }, 400);
    const senha = novaSenha();
    const { error: ea } = await sb.auth.admin.updateUserById(alvo as string, { password: senha, user_metadata: { trocar_senha: true } });
    if (ea) { console.error('criar-usuario: updateUserById', ea.status); return resposta({ erro: 'Não foi possível gerar a senha. Tente de novo.' }, 400); }
    return resposta({ ok: true, senha });
  }

  return resposta({ erro: 'Ação inválida.' }, 400);
}
