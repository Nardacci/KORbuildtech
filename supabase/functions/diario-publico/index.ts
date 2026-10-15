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

// Limite de tentativas por endereço (IP): 60 chamadas e 12 códigos inexistentes por minuto; passou disso, responde 429.
// O contador fica no BANCO (contar_tentativa, migração 14): o contador em memória não vale, cada chamada pode cair numa instância diferente.
// O endereço nunca é guardado: só o hash. O cabeçalho x-kb-limite (8 caracteres do hash) deixa o teste conferir que o endereço é estável.
async function hash(prefixo: string, valor: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(valor));
  return prefixo + Array.from(new Uint8Array(h)).slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ipDe = (req: Request) =>
  (req.headers.get('cf-connecting-ip') || (req.headers.get('x-forwarded-for') || '').split(',')[0] || 'desconhecido').trim();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'GET') return resposta({ erro: 'metodo' }, 405);
  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const chave = await hash('d:', ipDe(req));
  const marca = { 'x-kb-limite': chave.slice(2, 10) };
  const resp = (corpo: unknown, status = 200) => {
    const r = resposta(corpo, status);
    for (const [k, v] of Object.entries(marca)) r.headers.set(k, v);
    return r;
  };
  // se o banco não responder, deixa passar (o link continua abrindo); o erro vai para o log
  const dentro = async (chaveX: string, max: number, registrar: boolean) => {
    const { data, error } = await sb.rpc('contar_tentativa', { p_chave: chaveX, p_max: max, p_registrar: registrar });
    if (error) { console.error('diario-publico: contador', error.code, error.message); return true; }
    return data === true;
  };
  const chaveErros = await hash('e:', ipDe(req));
  if (!(await dentro(chave, 60, true)) || !(await dentro(chaveErros, 12, false))) return resp({ erro: 'limite' }, 429);
  const codigo = (new URL(req.url).searchParams.get('codigo') || '').trim().toUpperCase();
  if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(codigo)) { await dentro(chaveErros, 12, true); return resp({ erro: 'codigo' }, 400); }

  const { data: diario, error } = await sb.rpc('diario_por_codigo', { p_codigo: codigo });
  if (error) return resp({ erro: 'servidor' }, 500);
  if (!diario) { await dentro(chaveErros, 12, true); return resp({ erro: 'nao-encontrado' }, 404); }

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
  return resp(diario);
});
