/* KORbuild — um "Supabase local" para testar o app oficial sem rede (tools/supabase-local.sh):
 *   - REST (/rest/v1): o PostgREST de verdade, na porta 3001, sobre o Postgres local com as migrações e as regras;
 *   - login: um JWT assinado com o segredo local, gravado como a sessão do supabase-js (não passa pelo Auth);
 *   - Storage (/storage/v1): em memória, só o que o app usa (enviar, link assinado, baixar);
 *   - função diario-publico: imita a de supabase/functions (diario_por_codigo + links assinados).
 * O Playwright intercepta o endereço do projeto (js/config.js) e manda para cá. */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const SEGREDO = 'segredo-local-de-teste-com-mais-de-32-caracteres';
/* LATENCIA_MS: espera antes de cada pedido ao REST, para reproduzir no banco local o que só aparece com a rede de verdade. */
const ATRASO = Number(process.env.LATENCIA_MS || 0);
export const REST = process.env.POSTGREST_URL || 'http://localhost:3001';
const PG = ['-h', process.env.PGHOST || '/home/pgl/kb', '-p', process.env.PGPORT || '5499', '-U', 'postgres', '-d', 'kb'];

/* SQL como administrador do banco local (para preparar dados e conferir). Devolve as linhas em JSON. */
export async function sql(consulta) {
  const saida = execFileSync('psql', [...PG, '-At', '-v', 'ON_ERROR_STOP=1', '-c', 'select coalesce(json_agg(t), \'[]\') from (' + consulta + ') t'], { encoding: 'utf8' });
  return JSON.parse(saida.trim() || '[]');
}
export async function sqlExec(comando) { execFileSync('psql', [...PG, '-q', '-v', 'ON_ERROR_STOP=1', '-c', comando], { encoding: 'utf8' }); }

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
export function jwt(sub, role = 'authenticated') {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 6 * 3600 });
  return h + '.' + p + '.' + crypto.createHmac('sha256', SEGREDO).update(h + '.' + p).digest('base64url');
}

/* Chama o REST como um usuário (para preparar a cena). */
export async function rest(uid, caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(REST + caminho, {
    method: metodo, headers: { Authorization: 'Bearer ' + jwt(uid), 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(caminho + ' ' + r.status + ': ' + t);
  return t ? JSON.parse(t) : null;
}

export async function criarUsuario(email, nome) {
  const id = crypto.randomUUID();
  sqlExec(`insert into auth.users (id, email, raw_user_meta_data, aud, role) values ('${id}', '${email}', '${JSON.stringify({ nome })}', 'authenticated', 'authenticated') on conflict (id) do nothing`);
  return id;
}

/* A sessão do supabase-js no aparelho (storageKey de js/conta.js). */
export async function sessao(id, email, nome) {
  return JSON.stringify({
    access_token: jwt(id), token_type: 'bearer', expires_in: 6 * 3600, expires_at: Math.floor(Date.now() / 1000) + 6 * 3600, refresh_token: 'local',
    user: { id, aud: 'authenticated', role: 'authenticated', email, user_metadata: { nome, idioma: 'pt' }, app_metadata: {} },
  });
}

/* O Storage em memória (compartilhado entre os contextos do teste). */
const arquivos = new Map();
export async function arquivosDaPasta(prefixo) { return [...arquivos.keys()].filter((k) => k.startsWith('diarios/' + prefixo)); }
export async function limpar() { /* o banco local é recriado por tools/supabase-local.sh */ }
export const nome = 'Supabase local (PostgREST na porta 3001)';

/* Liga um contexto do Playwright ao Supabase local. */
export async function rotear(contexto, urlProjeto) {
  const base = urlProjeto.replace(/\/$/, '');
  await contexto.route(base + '/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const caminho = url.pathname;
    if (caminho.startsWith('/rest/v1/')) {
      if (ATRASO) await new Promise((ok) => setTimeout(ok, ATRASO));   // imita a rede de verdade (LATENCIA_MS=400)
      const h = req.headers();
      const headers = {};
      for (const k of ['authorization', 'content-type', 'prefer', 'accept', 'range', 'content-profile', 'accept-profile']) if (h[k]) headers[k] = h[k];
      if (!headers.authorization || /Bearer\s*$/.test(headers.authorization)) delete headers.authorization;
      const resp = await fetch(REST + caminho.slice('/rest/v1'.length) + url.search, { method: req.method(), headers, body: ['GET', 'HEAD'].includes(req.method()) ? undefined : req.postDataBuffer() });
      const corpo = Buffer.from(await resp.arrayBuffer());
      const volta = {};
      for (const [k, v] of resp.headers) if (!['content-encoding', 'transfer-encoding', 'connection'].includes(k)) volta[k] = v;
      volta['access-control-allow-origin'] = '*';
      return route.fulfill({ status: resp.status, headers: volta, body: corpo });
    }
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
    // Storage: enviar, assinar e baixar
    let m = caminho.match(/^\/storage\/v1\/object\/sign\/([^/]+)\/(.+)$/);
    if (m && req.method() === 'POST') {
      const chave = m[1] + '/' + decodeURIComponent(m[2]);
      if (!arquivos.has(chave)) return route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }) });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ signedURL: '/object/sign/' + m[1] + '/' + m[2] + '?token=local' }) });
    }
    if (m && req.method() === 'GET') {
      const a = arquivos.get(m[1] + '/' + decodeURIComponent(m[2]));
      return a ? route.fulfill({ status: 200, headers: { 'content-type': a.tipo, 'access-control-allow-origin': '*' }, body: a.dados }) : route.fulfill({ status: 404 });
    }
    m = caminho.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (m && (req.method() === 'POST' || req.method() === 'PUT')) {
      const chave = m[1] + '/' + decodeURIComponent(m[2]);
      if (arquivos.has(chave)) return route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }) });
      arquivos.set(chave, { dados: req.postDataBuffer(), tipo: req.headers()['content-type'] || 'image/jpeg' });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ Key: chave, Id: crypto.randomUUID() }) });
    }
    // Auth: só o que o app chama com a sessão aberta (gravar o idioma da conta)
    if (caminho === '/auth/v1/user') {
      const token = (req.headers().authorization || '').replace('Bearer ', '');
      const sub = JSON.parse(Buffer.from(token.split('.')[1] || 'e30', 'base64url').toString()).sub;
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: sub, aud: 'authenticated', role: 'authenticated', email: '', user_metadata: { idioma: 'pt' }, app_metadata: {} }) });
    }
    // a função de borda do link do cliente
    if (caminho === '/functions/v1/diario-publico') {
      const codigo = (url.searchParams.get('codigo') || '').toUpperCase();
      const r = await fetch(REST + '/rpc/diario_por_codigo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: codigo }) });
      const x = await r.json();
      if (!x) return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ erro: 'nao-encontrado' }) });
      x.fotos = (x.fotos || []).map(({ path, path_mini, ...resto }) => ({ ...resto, url: base + '/storage/v1/object/sign/diarios/' + path + '?token=local', url_mini: base + '/storage/v1/object/sign/diarios/' + (path_mini || path) + '?token=local' }));
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(x) });
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
}
