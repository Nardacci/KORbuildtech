/* KORbuild — um "Supabase local" para testar o app oficial sem rede (tools/supabase-local.sh):
 *   - REST (/rest/v1): o PostgREST de verdade, na porta 3001, sobre o Postgres local com as migrações e as regras;
 *   - login: um JWT assinado com o segredo local, gravado como a sessão do supabase-js (não passa pelo Auth);
 *   - Storage (/storage/v1): em memória, só o que o app usa (enviar, link assinado, baixar);
 *   - função diario-publico: imita a de supabase/functions (diario_por_codigo + links assinados).
 * O Playwright intercepta o endereço do projeto (js/config.js) e manda para cá. */

import { ativarCsp } from './_csp.mjs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
  const p = b64({ ...(sub ? { sub } : {}), role, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 6 * 3600 });
  return h + '.' + p + '.' + crypto.createHmac('sha256', SEGREDO).update(h + '.' + p).digest('base64url');
}
/* Uma função do banco chamada com a chave de serviço (como as funções de borda fazem): sem usuário. */
async function rpcServico(nome, args) {
  const r = await fetch(REST + '/rpc/' + nome, { method: 'POST', headers: { Authorization: 'Bearer ' + jwt(null, 'service_role'), 'Content-Type': 'application/json' }, body: JSON.stringify(args || {}) });
  const t = await r.text();
  let x = null; try { x = t ? JSON.parse(t) : null; } catch { x = t; }
  return { ok: r.ok, data: r.ok ? x : null, error: r.ok ? null : (x && x.message) || t };
}
/* O mínimo de multipart/form-data: campos de texto e um arquivo (o PDF da proposta pelo link). */
function lerMultipart(buf, contentType) {
  const limite = '--' + (contentType.match(/boundary=([^;]+)/) || [])[1];
  const campos = {}; let arquivo = null;
  let i = buf.indexOf(limite);
  while (i >= 0) {
    const fim = buf.indexOf(limite, i + limite.length);
    if (fim < 0) break;
    const parte = buf.subarray(i + limite.length + 2, fim - 2);   // sem o CRLF depois do limite e antes do próximo
    const sep = parte.indexOf('\r\n\r\n');
    const cab = parte.subarray(0, sep).toString();
    const corpo = parte.subarray(sep + 4);
    const nome = (cab.match(/name="([^"]+)"/) || [])[1];
    if (/filename="/.test(cab)) arquivo = { nome: (cab.match(/filename="([^"]*)"/) || [])[1], tipo: (cab.match(/Content-Type: (\S+)/i) || [])[1] || 'application/octet-stream', dados: Buffer.from(corpo) };
    else if (nome) campos[nome] = corpo.toString();
    i = fim;
  }
  return { campos, arquivo };
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

/* O REST como a chave de serviço (as funções de borda fazem assim): devolve o JSON; erro lança. */
export async function servicoRest(caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(REST + caminho, { method: metodo, headers: { Authorization: 'Bearer ' + jwt(null, 'service_role'), 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: corpo ? JSON.stringify(corpo) : undefined });
  const t = await r.text();
  if (!r.ok) throw new Error(caminho + ' ' + r.status + ': ' + t);
  return t ? JSON.parse(t) : null;
}

export async function criarUsuario(email, nome) {
  const id = crypto.randomUUID();
  const q = (t) => String(t).replace(/'/g, "''");   // o nome pode trazer aspas (o teste de XSS grava texto malicioso)
  sqlExec(`insert into auth.users (id, email, raw_user_meta_data, aud, role) values ('${id}', '${q(email)}', '${q(JSON.stringify({ nome }))}', 'authenticated', 'authenticated') on conflict (id) do nothing`);
  return id;
}

/* A massa de demonstração local guarda os arquivos (fotos) numa pasta, e o Storage de mentira dos testes e das capturas os lê de lá. */
const PASTA_ARQUIVOS = fileURLToPath(new URL('../tools/massa-demo/.cache/storage/', import.meta.url));
const doDisco = (chave) => { const f = PASTA_ARQUIVOS + chave; return existsSync(f) ? { dados: readFileSync(f), tipo: f.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg' } : null; };
export async function subirArquivo(id, bucket, caminho, dados) {
  const f = PASTA_ARQUIVOS + bucket + '/' + caminho;
  mkdirSync(f.slice(0, f.lastIndexOf('/')), { recursive: true });
  writeFileSync(f, dados);
}

/* Para a massa de demonstração: o usuário que já existe (pelo e-mail) ou um novo. A senha não vale no banco local. */
export async function garantirUsuario(email, nome) {
  const [u] = await sql(`select id from auth.users where email = '${email.replace(/'/g, "''")}'`);
  return u ? u.id : criarUsuario(email, nome);
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
export async function arquivosDaPasta(prefixo, bucket = 'diarios') { return [...arquivos.keys()].filter((k) => k.startsWith(bucket + '/' + prefixo)); }
export async function limpar() { /* o banco local é recriado por tools/supabase-local.sh */ }
export const nome = 'Supabase local (PostgREST na porta 3001)';

/* Liga um contexto do Playwright ao Supabase local. */
export async function rotear(contexto, urlProjeto) {
  await ativarCsp(contexto);   // só com KOR_CSP (tests/_csp.mjs)
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
      if (!arquivos.has(chave) && !doDisco(chave)) return route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ statusCode: '404', error: 'not_found', message: 'Object not found' }) });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ signedURL: '/object/sign/' + m[1] + '/' + m[2] + '?token=local' }) });
    }
    if (m && req.method() === 'GET') {
      const a = arquivos.get(m[1] + '/' + decodeURIComponent(m[2])) || doDisco(m[1] + '/' + decodeURIComponent(m[2]));
      return a ? route.fulfill({ status: 200, headers: { 'content-type': a.tipo, 'access-control-allow-origin': '*' }, body: a.dados }) : route.fulfill({ status: 404 });
    }
    m = caminho.match(/^\/storage\/v1\/object\/list\/([^/]+)$/);
    if (m && req.method() === 'POST') {
      const { prefix } = JSON.parse(req.postData() || '{}');
      const base = m[1] + '/' + (prefix || '').replace(/\/$/, '') + '/';
      const nomes = [...arquivos.keys()].filter((k) => k.startsWith(base)).map((k) => ({ name: k.slice(base.length), id: k }));
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(nomes) });
    }
    m = caminho.match(/^\/storage\/v1\/object\/([^/]+)$/);
    if (m && req.method() === 'DELETE') {
      const { prefixes } = JSON.parse(req.postData() || '{}');
      for (const p of prefixes || []) arquivos.delete(m[1] + '/' + p);
      return route.fulfill({ status: 200, headers: cors, body: '[]' });
    }
    m = caminho.match(/^\/storage\/v1\/object\/([^/]+)\/(.+)$/);
    if (m && (req.method() === 'POST' || req.method() === 'PUT')) {
      const chave = m[1] + '/' + decodeURIComponent(m[2]);
      if (arquivos.has(chave) && !/true/i.test(req.headers()['x-upsert'] || '')) return route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ statusCode: '409', error: 'Duplicate', message: 'The resource already exists' }) });
      // o supabase-js manda Blob/File em multipart: guarda só o arquivo, como o Storage de verdade
      const tipo = req.headers()['content-type'] || 'image/jpeg';
      const parte = tipo.startsWith('multipart/form-data') ? lerMultipart(req.postDataBuffer(), tipo).arquivo : null;
      arquivos.set(chave, parte ? { dados: parte.dados, tipo: parte.tipo } : { dados: req.postDataBuffer(), tipo });
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ Key: chave, Id: crypto.randomUUID() }) });
    }
    // Auth: só o que o app chama com a sessão aberta (gravar o idioma da conta)
    if (caminho === '/auth/v1/user') {
      const token = (req.headers().authorization || '').replace('Bearer ', '');
      const sub = JSON.parse(Buffer.from(token.split('.')[1] || 'e30', 'base64url').toString()).sub;
      const [quem] = await sql(`select email from auth.users where id = '${sub}'`);
      return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ id: sub, aud: 'authenticated', role: 'authenticated', email: (quem && quem.email) || '', user_metadata: { idioma: 'pt' }, app_metadata: {} }) });
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
    // a função de borda do link do convite (supabase/functions/convite-publico)
    if (caminho === '/functions/v1/convite-publico') {
      const assinar = (p) => (p ? base + '/storage/v1/object/sign/concorrencias/' + p + '?token=local' : null);
      if (req.method() === 'GET') {
        const token = url.searchParams.get('token') || '';
        await rpcServico('visto_por_token', { p_token: token });
        const r = await rpcServico('convite_por_token', { p_token: token });
        if (!r.data) return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ erro: 'nao-encontrado' }) });
        const x = r.data;
        x.desenhos = (x.desenhos || []).map(({ path, ...resto }) => ({ ...resto, url: assinar(path) }));
        x.convite.propostas = (x.convite.propostas || []).map(({ pdf, ...resto }) => ({ ...resto, pdf: null, pdfUrl: assinar(pdf) }));
        return route.fulfill({ status: 200, headers: cors, body: JSON.stringify(x) });
      }
      let token, acao, dados = {}, pdf = null;
      const tipo = req.headers()['content-type'] || '';
      if (tipo.startsWith('multipart/form-data')) {
        const { campos, arquivo } = lerMultipart(req.postDataBuffer(), tipo);
        token = campos.token; acao = campos.acao; try { dados = JSON.parse(campos.dados || '{}'); } catch { dados = {}; } pdf = arquivo;
      } else { const c = JSON.parse(req.postData() || '{}'); token = c.token; acao = c.acao; dados = c.dados || {}; }
      const responder = (r, extra) => (r.ok ? route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ ok: true, ...(extra ? extra(r.data) : {}) }) }) : route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ erro: r.error }) }));
      if (acao === 'responder') return responder(await rpcServico('responder_por_token', { p_token: token, p_vai: !!dados.vai, p_motivo: String(dados.motivo || '') }));
      if (acao === 'escrever') return responder(await rpcServico('escrever_por_token', { p_token: token, p_texto: String(dados.texto || ''), p_por: String(dados.por || '') }), (id) => ({ id }));
      if (acao === 'proposta') {
        const p = { total: dados.total, porEtapa: dados.porEtapa || {}, outros: dados.outros, prazoExecucaoDias: dados.prazoExecucaoDias, exclusoes: dados.exclusoes || [], por: dados.por || '' };
        if (pdf) {
          const v = await rpcServico('convite_por_token', { p_token: token });
          if (!v.data) return route.fulfill({ status: 404, headers: cors, body: JSON.stringify({ erro: 'nao-encontrado' }) });
          const path = v.data.contratanteId + '/' + v.data.id + '/propostas/' + v.data.convite.id + '/rev-' + ((v.data.convite.propostas || []).length + 1) + '.pdf';
          arquivos.set('concorrencias/' + path, { dados: pdf.dados, tipo: 'application/pdf' });
          p.pdfPath = path;
        }
        return responder(await rpcServico('proposta_por_token', { p_token: token, p }), (rev) => ({ rev }));
      }
      return route.fulfill({ status: 400, headers: cors, body: JSON.stringify({ erro: 'acao' }) });
    }
    return route.fulfill({ status: 404, headers: cors, body: '{}' });
  });
}
