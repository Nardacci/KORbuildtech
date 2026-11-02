#!/usr/bin/env node
/* KORbuild — migrar o banco Supabase de uma conta para outra (guia: docs/migrar-supabase.md).
 *
 * Fases (rode na ordem):
 *   node tools/migrar-supabase.mjs backup      lê o banco ANTIGO e grava tudo numa pasta local (backups/AAAA-MM-DD_HHMM). Não altera nada.
 *   node tools/migrar-supabase.mjs restaurar   grava a pasta no banco NOVO (recusa se o novo já tem tabelas, a não ser com --forcar).
 *   node tools/migrar-supabase.mjs arquivos    copia os arquivos dos buckets do projeto antigo para o novo (pode rodar de novo: pula o que já existe).
 *   node tools/migrar-supabase.mjs cron        recria no banco NOVO o segredo do cron e os dois jobs (usa a URL do projeto novo).
 *   node tools/migrar-supabase.mjs conferir    compara contagens dos dois bancos e dos arquivos. Sai com erro se algo não bate.
 *
 * Segredos ficam só em variáveis de ambiente da sua janela do PowerShell (nada em arquivo, nada em argumento de comando):
 *   KOR_ORIGEM_URL   endereço de conexão do banco antigo  (painel > Connect > Session pooler, com a senha no lugar de [YOUR-PASSWORD])
 *   KOR_DESTINO_URL  o mesmo, do banco novo
 *   KOR_ORIGEM_SERVICE_KEY / KOR_DESTINO_SERVICE_KEY   chave service_role de cada projeto (só na fase "arquivos")
 *   KOR_CRON_SECRET  o mesmo valor que você pôs em CRON_SECRET nas funções do projeto novo (só na fase "cron")
 * Opções: --pasta=backups/…  (usar uma pasta de backup existente)   --forcar   (restaurar mesmo com tabelas no destino)
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const fase = process.argv[2];
const opc = Object.fromEntries(process.argv.slice(3).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v === undefined ? true : v]; }));
const pad = (n) => String(n).padStart(2, '0');
const sai = (msg) => { console.error('\nERRO: ' + msg); process.exit(1); };
const log = (msg) => console.log(msg);

/* ---------- conexão ---------- */

function conexao(qual) {
  const nome = qual === 'origem' ? 'KOR_ORIGEM_URL' : 'KOR_DESTINO_URL';
  const v = process.env[nome];
  if (!v) sai('Falta a variável ' + nome + '. Veja docs/migrar-supabase.md, passo "Variáveis".');
  if (/\[YOUR-PASSWORD\]|\[SENHA\]/i.test(v)) sai(nome + ' ainda tem [YOUR-PASSWORD]: troque pelo valor da senha do banco.');
  // lê o endereço "à mão": a senha pode ter @, #, / ou [ ] sem virar erro (o último @ separa a senha do servidor)
  const m = v.trim().match(/^postgres(?:ql)?:\/\/([^:\/@]+):(.*)@([^@\/?#]+)(?:\/([^?#]*))?(?:[?#].*)?$/s);
  if (!m) sai(nome + ' não é um endereço válido. Deve ser: postgresql://USUARIO:SENHA@SERVIDOR:5432/postgres (sem espaços e sem aspas dentro das aspas).');
  const [, usuario, senhaBruta, servidor, banco] = m;
  const [hostname, porta] = servidor.split(':');
  const dec = (x) => { try { return decodeURIComponent(x); } catch { return x; } };
  const u = { username: usuario, password: dec(senhaBruta), hostname, port: porta || '5432', pathname: '/' + (banco || 'postgres') };
  const ref = u.username.split('.')[1] || (u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/) || [])[1] || '';
  return {
    ref,
    env: { ...process.env, PGHOST: u.hostname, PGPORT: u.port || '5432', PGUSER: u.username, PGPASSWORD: u.password, PGDATABASE: (u.pathname || '/postgres').slice(1) || 'postgres', PGSSLMODE: process.env.KOR_SSLMODE || 'require', PGCONNECT_TIMEOUT: '20' },
  };
}

function rodar(cmd, args, { env, entrada, aceitaErro = false } = {}) {
  const r = spawnSync(cmd, args, { env, input: entrada, encoding: 'utf8', maxBuffer: 1 << 29 });
  if (r.error) sai('Não consegui rodar "' + cmd + '". Instale o cliente do PostgreSQL 17 (docs/migrar-supabase.md, "Pré-requisitos"). ' + r.error.message);
  if (r.status !== 0 && !aceitaErro) sai(cmd + ' falhou:\n' + (r.stderr || '').split('\n').slice(0, 12).join('\n'));
  return r;
}

const psql = (c, sql, extra = []) => rodar('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', ...extra, '-c', sql], { env: c.env }).stdout;
const consulta = (c, sql) => psql(c, sql).split('\n').filter(Boolean);

function versaoDoCliente() {
  const r = spawnSync('pg_dump', ['--version'], { encoding: 'utf8' });
  if (r.error) sai('pg_dump não encontrado. Instale o cliente do PostgreSQL 17 (docs/migrar-supabase.md, "Pré-requisitos").');
  const m = (r.stdout || '').match(/(\d+)(?:\.\d+)?/);
  return m ? Number(m[1]) : 0;
}

/* ---------- pasta do backup ---------- */

function pastaDoBackup(criar) {
  if (opc.pasta && opc.pasta !== true) { const p = path.resolve(RAIZ, opc.pasta); if (!existsSync(p)) sai('Pasta não existe: ' + p); return p; }
  if (criar) {
    const d = new Date();
    const p = path.join(RAIZ, 'backups', d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()));
    mkdirSync(p, { recursive: true });
    return p;
  }
  const base = path.join(RAIZ, 'backups');
  const todas = existsSync(base) ? readdirSync(base).filter((n) => /^\d{4}-\d\d-\d\d_\d{4}$/.test(n)).sort() : [];
  if (!todas.length) sai('Nenhum backup em backups/. Rode a fase "backup" primeiro.');
  return path.join(base, todas[todas.length - 1]);
}

/* ---------- o que o pg_dump não leva: buckets, políticas do Storage, publicação do tempo real ---------- */

const SQL_BUCKETS = `select format('insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values (%L, %L, %L, %L, %L) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;', id, name, public, file_size_limit, allowed_mime_types) from storage.buckets order by id`;
const SQL_POLITICAS = `select format('drop policy if exists %I on storage.objects; create policy %I on storage.objects for %s to %s%s%s;', policyname, policyname, cmd, array_to_string(roles, ', '), case when qual is not null then ' using (' || qual || ')' else '' end, case when with_check is not null then ' with check (' || with_check || ')' else '' end) from pg_policies where schemaname = 'storage' and tablename = 'objects' order by policyname`;
const SQL_PUBLICACAO = `select format('alter publication supabase_realtime add table %s;', string_agg(format('%I.%I', schemaname, tablename), ', ')) from pg_publication_tables where pubname = 'supabase_realtime' having count(*) > 0`;

const EXTENSOES = `create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pg_net;
create extension if not exists pg_cron;
create extension if not exists supabase_vault;
`;

/* ---------- fase: backup ---------- */

function backup() {
  const o = conexao('origem');
  const cliente = versaoDoCliente();
  const servidor = Number(psql(o, 'show server_version_num').trim().slice(0, 2));
  if (cliente < servidor) sai('O pg_dump é a versão ' + cliente + ' e o banco é a ' + servidor + '. Instale o cliente do PostgreSQL ' + servidor + ' ou mais novo.');
  const pasta = pastaDoBackup(true);
  log('Backup do projeto ' + (o.ref || '(origem)') + ' em ' + pasta);

  const dump = (arq, args) => { log('  ' + arq + ' …'); rodar('pg_dump', ['--no-owner', '--no-comments', '-f', path.join(pasta, arq), ...args], { env: o.env }); };
  dump('01-public-esquema.sql', ['--schema-only', '--schema=public']);
  dump('02-public-dados.sql', ['--data-only', '--schema=public']);
  dump('03-auth-dados.sql', ['--data-only', '--column-inserts', '-t', 'auth.users', '-t', 'auth.identities']);

  log('  04-storage.sql (buckets e políticas) …');
  const linhas = [...consulta(o, SQL_BUCKETS), ...consulta(o, SQL_POLITICAS), ...consulta(o, SQL_PUBLICACAO)];
  writeFileSync(path.join(pasta, '04-storage-e-tempo-real.sql'), linhas.join('\n') + '\n');

  log('  05-arquivos.tsv (lista dos arquivos dos buckets) …');
  const arqs = consulta(o, `select bucket_id || E'\\t' || name || E'\\t' || coalesce(metadata ->> 'mimetype', 'application/octet-stream') || E'\\t' || coalesce(metadata ->> 'size', '0') from storage.objects order by 1`);
  writeFileSync(path.join(pasta, '05-arquivos.tsv'), arqs.join('\n') + '\n');

  log('  06-contagens.json …');
  writeFileSync(path.join(pasta, '06-contagens.json'), JSON.stringify(contagens(o), null, 2));

  log('\nPronto: ' + arqs.length + ' arquivos listados. Guarde a pasta ' + pasta + ' (tem os logins dos usuários: não suba para o GitHub nem mande por e-mail).');
}

/* ---------- contagens (backup e conferência) ---------- */

function contagens(c) {
  const tabelas = consulta(c, `select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1`);
  const r = { tabelas: {}, objetos: {} };
  for (const t of tabelas) r.tabelas[t] = Number(psql(c, `select count(*) from public."${t}"`).trim());
  r.tabelas['auth.users'] = Number(psql(c, 'select count(*) from auth.users').trim());
  r.tabelas['auth.identities'] = Number(psql(c, 'select count(*) from auth.identities').trim());
  for (const l of consulta(c, `select bucket_id || '|' || count(*) from storage.objects group by bucket_id order by 1`)) { const [b, n] = l.split('|'); r.objetos['arquivos:' + b] = Number(n); }
  r.objetos['funcoes (public)'] = Number(psql(c, `select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`).trim());
  r.objetos['políticas (public)'] = Number(psql(c, `select count(*) from pg_policies where schemaname = 'public'`).trim());
  r.objetos['políticas (storage)'] = Number(psql(c, `select count(*) from pg_policies where schemaname = 'storage'`).trim());
  r.objetos['gatilhos (public)'] = Number(psql(c, `select count(*) from pg_trigger t join pg_class k on k.oid = t.tgrelid join pg_namespace n on n.oid = k.relnamespace where not t.tgisinternal and n.nspname = 'public'`).trim());
  r.objetos['índices (public)'] = Number(psql(c, `select count(*) from pg_indexes where schemaname = 'public'`).trim());
  r.objetos['buckets'] = Number(psql(c, 'select count(*) from storage.buckets').trim());
  return r;
}

/* ---------- fase: restaurar ---------- */

function restaurar() {
  const d = conexao('destino');
  const pasta = pastaDoBackup(false);
  for (const a of ['01-public-esquema.sql', '02-public-dados.sql', '03-auth-dados.sql', '04-storage-e-tempo-real.sql']) if (!existsSync(path.join(pasta, a))) sai('Falta ' + a + ' em ' + pasta);
  const origemRef = (process.env.KOR_ORIGEM_URL ? conexao('origem').ref : '');
  if (origemRef && origemRef === d.ref) sai('O destino é o MESMO projeto da origem (' + d.ref + '). Confira KOR_DESTINO_URL.');
  const existentes = Number(psql(d, `select count(*) from information_schema.tables where table_schema = 'public'`).trim());
  const usuarios = Number(psql(d, 'select count(*) from auth.users').trim());
  if ((existentes > 0 || usuarios > 0) && !opc.forcar) sai('O banco novo não está vazio (' + existentes + ' tabelas em public, ' + usuarios + ' usuários). Use um projeto novo e vazio, ou --forcar se tem certeza.');
  log('Restaurando ' + pasta + ' no projeto ' + (d.ref || '(destino)') + ' …');

  const erros = [];
  const aplica = (rotulo, sql) => {
    log('  ' + rotulo + ' …');
    const r = rodar('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=0'], { env: d.env, entrada: sql, aceitaErro: true });
    const e = (r.stderr || '').split('\n').filter((l) => /ERROR|FATAL/.test(l));
    for (const l of e) erros.push(rotulo + ': ' + l.trim());
  };
  const le = (a) => readFileSync(path.join(pasta, a), 'utf8');

  aplica('extensões', EXTENSOES);
  aplica('estrutura do public', le('01-public-esquema.sql').replace(/^CREATE SCHEMA public;\s*$/gm, ''));
  // dados: o gatilho de auditoria e as chaves estrangeiras não devem disparar durante a carga (ordem das tabelas)
  aplica('dados do public', 'set session_replication_role = replica;\n' + le('02-public-dados.sql'));
  aplica('logins (auth.users e identities)', 'set session_replication_role = replica;\n' + le('03-auth-dados.sql'));
  aplica('buckets, políticas e tempo real', le('04-storage-e-tempo-real.sql'));

  const arq = path.join(pasta, 'restaurar-erros.log');
  writeFileSync(arq, erros.join('\n') + '\n');
  if (erros.length) {
    log('\n' + erros.length + ' mensagens de erro (veja ' + arq + '). As mais comuns e inofensivas: "already exists" e "must be owner". Rode "conferir" para ver se algo ficou faltando.');
    for (const e of erros.slice(0, 8)) log('  ' + e.slice(0, 200));
  } else log('\nSem erros.');
  log('Próximo: node tools/migrar-supabase.mjs arquivos');
}

/* ---------- fase: arquivos ---------- */

async function arquivos() {
  const o = conexao('origem'), d = conexao('destino');
  const kO = process.env.KOR_ORIGEM_SERVICE_KEY, kD = process.env.KOR_DESTINO_SERVICE_KEY;
  if (!kO || !kD) sai('Faltam KOR_ORIGEM_SERVICE_KEY e/ou KOR_DESTINO_SERVICE_KEY (chave service_role de cada projeto, em Project Settings > API).');
  if (!o.ref || !d.ref) sai('Não consegui descobrir o código de cada projeto pelo endereço de conexão. Use o endereço do "Session pooler" (usuário postgres.CODIGO).');
  const pasta = pastaDoBackup(false);
  const lista = readFileSync(path.join(pasta, '05-arquivos.tsv'), 'utf8').split('\n').filter(Boolean).map((l) => { const [bucket, nome, tipo, tam] = l.split('\t'); return { bucket, nome, tipo, tam: Number(tam) }; });
  const baseO = 'https://' + o.ref + '.supabase.co/storage/v1/object', baseD = 'https://' + d.ref + '.supabase.co/storage/v1/object';
  const caminho = (b, n) => b + '/' + n.split('/').map(encodeURIComponent).join('/');
  const jaTem = new Set(consulta(d, `select bucket_id || '|' || name from storage.objects`));
  const falhas = [];
  let feitos = 0, pulados = 0, bytes = 0, i = 0;
  log('Copiando ' + lista.length + ' arquivos do projeto ' + o.ref + ' para ' + d.ref + ' …');

  async function um(a) {
    if (jaTem.has(a.bucket + '|' + a.nome)) { pulados++; return; }
    for (let tentativa = 1; tentativa <= 3; tentativa++) {
      try {
        const g = await fetch(baseO + '/' + caminho(a.bucket, a.nome), { headers: { Authorization: 'Bearer ' + kO, apikey: kO } });
        if (!g.ok) throw new Error('baixar ' + g.status);
        const corpo = Buffer.from(await g.arrayBuffer());
        const p = await fetch(baseD + '/' + caminho(a.bucket, a.nome), { method: 'POST', headers: { Authorization: 'Bearer ' + kD, apikey: kD, 'Content-Type': a.tipo, 'x-upsert': 'true' }, body: corpo });
        if (!p.ok) throw new Error('subir ' + p.status + ' ' + (await p.text()).slice(0, 120));
        feitos++; bytes += corpo.length; return;
      } catch (e) { if (tentativa === 3) falhas.push(a.bucket + '/' + a.nome + ' — ' + e.message); else await new Promise((r) => setTimeout(r, 800 * tentativa)); }
    }
  }
  await Promise.all(Array.from({ length: 4 }, async () => { while (i < lista.length) { const a = lista[i++]; await um(a); if ((feitos + pulados + falhas.length) % 25 === 0) log('  ' + (feitos + pulados + falhas.length) + ' / ' + lista.length); } }));
  writeFileSync(path.join(pasta, 'arquivos-falhas.log'), falhas.join('\n') + '\n');
  log('\nCopiados ' + feitos + ' (' + (bytes / 1048576).toFixed(1) + ' MB), já existiam ' + pulados + ', falharam ' + falhas.length + '.');
  if (falhas.length) { for (const f of falhas.slice(0, 10)) log('  ' + f); sai('Rode "arquivos" de novo (ele só repete o que falta). Lista em arquivos-falhas.log.'); }
  log('Próximo: node tools/migrar-supabase.mjs cron');
}

/* ---------- fase: cron ---------- */

function cron() {
  const d = conexao('destino');
  const segredo = process.env.KOR_CRON_SECRET;
  if (!segredo) sai('Falta KOR_CRON_SECRET (o mesmo valor do segredo CRON_SECRET das funções do projeto novo).');
  if (!d.ref) sai('Não consegui descobrir o código do projeto novo pelo endereço de conexão (use o "Session pooler").');
  const sql = `
select vault.create_secret(:'segredo', 'kor_cron_secret', 'Segredo do cron de avisos')
 where not exists (select 1 from vault.secrets where name = 'kor_cron_secret');
select vault.update_secret(id, :'segredo') from vault.secrets where name = 'kor_cron_secret';
select cron.schedule('kor-prazos', '0 12 * * *', 'select public.avisar_prazos()');
select cron.schedule('kor-enviar-avisos', '*/5 * * * *', $cmd$
  select net.http_post(
    url     := 'https://${d.ref}.supabase.co/functions/v1/enviar-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json',
                 'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'kor_cron_secret')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
$cmd$);
select jobname, schedule from cron.job order by 1;
`;
  const r = rodar('psql', ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-v', 'segredo=' + segredo], { env: d.env, entrada: sql });
  log('Jobs no banco novo:\n' + r.stdout);
  log('Aviso: o job só funciona depois de publicar a função enviar-avisos no projeto novo com o mesmo CRON_SECRET.');
}

/* ---------- fase: conferir ---------- */

function conferir() {
  const o = conexao('origem'), d = conexao('destino');
  const a = contagens(o), b = contagens(d);
  let dif = 0;
  const bloco = (titulo, x, y) => {
    log('\n' + titulo);
    for (const k of [...new Set([...Object.keys(x), ...Object.keys(y)])].sort()) {
      const ok = x[k] === y[k]; if (!ok) dif++;
      log('  ' + (ok ? 'ok   ' : 'DIFER') + ' ' + k.padEnd(34) + String(x[k] ?? '—').padStart(8) + ' → ' + String(y[k] ?? '—').padStart(8));
    }
  };
  bloco('Tabelas (linhas): antigo → novo', a.tabelas, b.tabelas);
  bloco('Objetos e arquivos: antigo → novo', a.objetos, b.objetos);
  log('\n' + (dif ? dif + ' diferenças. Não troque o app para o banco novo ainda.' : 'Tudo bate. Pode seguir para a troca do app (docs/migrar-supabase.md).'));
  process.exit(dif ? 1 : 0);
}

/* ---------- main ---------- */

const fases = { backup, restaurar, arquivos, cron, conferir };
if (!fases[fase]) { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^\/\*\s?/, '')); process.exit(fase ? 1 : 0); }
await fases[fase]();
