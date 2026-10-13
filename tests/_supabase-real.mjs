/* KORbuild — o Supabase do projeto para os testes de ponta a ponta (tests/daily.test.mjs --real), com a mesma
 * interface de tests/_supabase-local.mjs. Precisa de SUPABASE_ACCESS_TOKEN (token pessoal, só na variável de ambiente).
 * A chave de serviço é lida pela API de gerenciamento e fica só em memória: nunca é gravada nem impressa.
 * Cria usuários kb-e2e-daily-…@example.com já confirmados (nenhum e-mail sai) e, em limpar(), apaga as fotos do
 * Storage, as empresas (em cascata) e os usuários desses e-mails. */

import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8');
const URL_SB = config.match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1].replace(/\/$/, '');
const ANON = config.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/)[1];
const REF = process.env.SUPABASE_PROJECT_REF || new URL(URL_SB).hostname.split('.')[0];
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN para rodar contra o Supabase de verdade.'); process.exit(2); }
const SENHA = 'Teste-e2e-daily-1234';
const PADRAO = 'kb-e2e-daily-%@example.com';
export const nome = 'Supabase do projeto ' + REF;

export async function sql(consulta) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: consulta }) });
  const t = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + t.slice(0, 300));
  return JSON.parse(t);
}
export const sqlExec = sql;

const chaves = await (await fetch('https://api.supabase.com/v1/projects/' + REF + '/api-keys?reveal=true', { headers: { Authorization: 'Bearer ' + TOKEN } })).json();
const SERVICO = (chaves.find((k) => k.name === 'service_role') || {}).api_key;
if (!SERVICO) { console.error('Não foi possível obter a chave de serviço pela API de gerenciamento.'); process.exit(2); }
const comServico = (caminho, metodo, corpo) => fetch(URL_SB + caminho, { method: metodo, headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });

const sessoes = new Map();   // id → resposta do login (a sessão do supabase-js)
export async function criarUsuario(email, nomePessoa) {
  const r = await comServico('/auth/v1/admin/users', 'POST', { email, password: SENHA, email_confirm: true, user_metadata: { nome: nomePessoa, idioma: 'pt' } });
  const u = await r.json();
  if (!r.ok) throw new Error('criar usuário ' + email + ': ' + r.status + ' ' + JSON.stringify(u));
  const login = await fetch(URL_SB + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: SENHA }) });
  const s = await login.json();
  if (!login.ok) throw new Error('entrar ' + email + ': ' + login.status + ' ' + JSON.stringify(s));
  sessoes.set(u.id, { ...s, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) });
  return u.id;
}
export async function sessao(id) { return JSON.stringify(sessoes.get(id)); }

export async function rest(id, caminho, { metodo = 'GET', corpo } = {}) {
  const r = await fetch(URL_SB + '/rest/v1' + caminho, {
    method: metodo, headers: { apikey: ANON, Authorization: 'Bearer ' + sessoes.get(id).access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  const t = await r.text();
  if (!r.ok) throw new Error(caminho + ' ' + r.status + ': ' + t);
  return t ? JSON.parse(t) : null;
}

export async function rotear() { /* de verdade: nada a interceptar */ }

export async function arquivosDaPasta(prefixo, bucket = 'diarios') {
  return (await sql(`select '${bucket}/' || name as n from storage.objects where bucket_id = '${bucket}' and name like '${prefixo.replace(/'/g, "''")}%'`)).map((x) => x.n);
}

export async function limpar() {
  const empresas = (await sql(`select distinct m.empresa_id as id from public.membros m join auth.users u on u.id = m.user_id where u.email like '${PADRAO}'`)).map((x) => x.id);
  if (empresas.length) {
    const lista = empresas.map((e) => "'" + e + "/%'").join(', ');
    for (const bucket of ['diarios', 'ponto', 'plantas']) {
      const nomes = (await sql(`select name from storage.objects where bucket_id = '${bucket}' and name like any (array[${lista}])`)).map((x) => x.name);
      for (let i = 0; i < nomes.length; i += 100) {
        const r = await comServico('/storage/v1/object/' + bucket, 'DELETE', { prefixes: nomes.slice(i, i + 100) });
        if (!r.ok) throw new Error('apagar arquivos de teste (' + bucket + '): ' + r.status + ' ' + (await r.text()));
      }
    }
    await sql(`delete from public.empresas where id in (${empresas.map((e) => "'" + e + "'").join(', ')})`);
  }
  for (const u of await sql(`select id from auth.users where email like '${PADRAO}'`)) await comServico('/auth/v1/admin/users/' + u.id, 'DELETE');
}
