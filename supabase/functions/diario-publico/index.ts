// KORbuild — link do cliente (docs/banco.md §10): o diário aprovado pelo código, sem login.
// Chama diario_por_codigo() (que só devolve diário aprovado e confere o lacre) e assina as fotos do bucket privado
// "diarios" por 1 hora. A chave de serviço fica só aqui, no servidor (variável que o Supabase já injeta).
// Publicar: supabase functions deploy diario-publico --no-verify-jwt   (o link é aberto por quem não tem conta)
// Uso: GET /functions/v1/diario-publico?codigo=ABCD-1234-EF56

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const resposta = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return resposta({ erro: 'metodo' }, 405);
  const codigo = (new URL(req.url).searchParams.get('codigo') || '').trim().toUpperCase();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(codigo)) return resposta({ erro: 'codigo' }, 400);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: diario, error } = await sb.rpc('diario_por_codigo', { p_codigo: codigo });
  if (error) return resposta({ erro: 'servidor' }, 500);
  if (!diario) return resposta({ erro: 'nao-encontrado' }, 404);

  // fotos: troca o caminho no Storage por um link temporário (1 h); o caminho em si não sai
  const fotos = (diario.fotos || []) as Array<Record<string, unknown>>;
  const caminhos = fotos.flatMap((f) => [f.path, f.path_mini]).filter((p): p is string => typeof p === 'string' && p !== '');
  const links = new Map<string, string>();
  if (caminhos.length) {
    const { data: assinados } = await sb.storage.from('diarios').createSignedUrls(caminhos, 3600);
    for (const a of assinados || []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl);
  }
  diario.fotos = fotos.map(({ path, path_mini, empresa_id: _e, rdo_id: _r, ...resto }) => ({
    ...resto, url: links.get(path as string) || null, url_mini: links.get(path_mini as string) || links.get(path as string) || null,
  }));
  delete diario.empresa_id;
  return resposta(diario);
});
