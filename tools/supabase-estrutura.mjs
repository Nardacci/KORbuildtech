/* KORbuild — backup da ESTRUTURA do banco no Supabase (sem dados) e inventário do que existe.
 * Usa a API de gerenciamento do Supabase (HTTPS), que roda SQL de leitura nos catálogos do Postgres.
 * Nada é alterado no banco: só consultas (SELECT) em pg_catalog e information_schema.
 *
 * Precisa de:
 *   SUPABASE_ACCESS_TOKEN  token pessoal do Supabase (Account › Access Tokens), nunca no código nem no chat
 *   SUPABASE_PROJECT_REF   opcional; padrão gbdmtgephszxhaprpiss
 * Uso: node tools/supabase-estrutura.mjs
 * Saída: supabase/backup/estrutura-AAAA-MM-DD.sql (para recriar a estrutura) e inventario-AAAA-MM-DD.json
 *        (a lista por schema: tabelas com contagem de linhas, views, funções, triggers, políticas, buckets). */

import { mkdirSync, writeFileSync } from 'node:fs';

const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const REF = process.env.SUPABASE_PROJECT_REF || 'gbdmtgephszxhaprpiss';
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN (variável de ambiente).'); process.exit(1); }

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }),
  });
  const texto = await r.text();
  if (!r.ok) throw new Error('Supabase ' + r.status + ': ' + texto.slice(0, 400));
  return JSON.parse(texto);
}

// Schemas do próprio Supabase ficam fora: só o que foi criado para os sistemas (public e outros do usuário).
const SISTEMA = "('pg_catalog','information_schema','pg_toast','auth','storage','realtime','supabase_functions','extensions','graphql','graphql_public','pgbouncer','pgsodium','pgsodium_masks','vault','net','cron','supabase_migrations','_realtime','_analytics','pgmq','supabase_realtime')";

const consultas = {
  schemas: `select nspname as schema from pg_namespace where nspname not in ${SISTEMA} and nspname not like 'pg_%' order by 1`,
  extensoes: `select extname as nome, extversion as versao from pg_extension order by 1`,
  tipos: `select n.nspname as schema, t.typname as nome, string_agg(quote_literal(e.enumlabel), ', ' order by e.enumsortorder) as valores
          from pg_type t join pg_enum e on e.enumtypid = t.oid join pg_namespace n on n.oid = t.typnamespace
          where n.nspname not in ${SISTEMA} group by 1, 2 order by 1, 2`,
  sequencias: `select sequence_schema as schema, sequence_name as nome, data_type, start_value, increment from information_schema.sequences where sequence_schema not in ${SISTEMA} order by 1, 2`,
  tabelas: `select n.nspname as schema, c.relname as nome, c.relrowsecurity as rls, c.reltuples::bigint as linhas_estimadas,
            obj_description(c.oid) as comentario
            from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where c.relkind in ('r','p') and n.nspname not in ${SISTEMA} order by 1, 2`,
  colunas: `select table_schema as schema, table_name as tabela, column_name as coluna, ordinal_position as ordem,
            case when data_type = 'USER-DEFINED' then udt_schema || '.' || udt_name when data_type = 'ARRAY' then udt_name else data_type end as tipo,
            character_maximum_length as tamanho, numeric_precision, numeric_scale, is_nullable, column_default, is_identity, identity_generation
            from information_schema.columns where table_schema not in ${SISTEMA} order by 1, 2, 4`,
  restricoes: `select n.nspname as schema, c.relname as tabela, con.conname as nome, con.contype as tipo, pg_get_constraintdef(con.oid) as definicao
               from pg_constraint con join pg_class c on c.oid = con.conrelid join pg_namespace n on n.oid = c.relnamespace
               where n.nspname not in ${SISTEMA} order by 1, 2, case con.contype when 'p' then 0 when 'u' then 1 when 'c' then 2 else 3 end, 3`,
  indices: `select schemaname as schema, tablename as tabela, indexname as nome, indexdef as definicao from pg_indexes
            where schemaname not in ${SISTEMA} and indexname not in (select conname from pg_constraint) order by 1, 2, 3`,
  views: `select schemaname as schema, viewname as nome, definition as definicao from pg_views where schemaname not in ${SISTEMA} order by 1, 2`,
  funcoes: `select n.nspname as schema, p.proname as nome, pg_get_function_identity_arguments(p.oid) as argumentos, pg_get_functiondef(p.oid) as definicao
            from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname not in ${SISTEMA} and p.prokind in ('f','p') and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e') order by 1, 2`,
  triggers: `select n.nspname as schema, c.relname as tabela, t.tgname as nome, pg_get_triggerdef(t.oid) as definicao
             from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
             where not t.tgisinternal and n.nspname not in ('pg_catalog','information_schema') order by 1, 2, 3`,
  politicas: `select schemaname as schema, tablename as tabela, policyname as nome, permissive, roles, cmd, qual, with_check from pg_policies order by 1, 2, 3`,
  buckets: `select id, name as nome, public as publico, file_size_limit, allowed_mime_types, created_at from storage.buckets order by 1`,
};

const hoje = new Date().toISOString().slice(0, 10);
const r = {};
for (const [k, q] of Object.entries(consultas)) {
  try { r[k] = await sql(q); } catch (e) { r[k] = []; r.erros = (r.erros || []).concat(k + ': ' + e.message); }
  console.log('  ' + k + ': ' + r[k].length);
}
// contagem exata de linhas por tabela (só o número, nunca os dados)
for (const t of r.tabelas) {
  try { t.linhas = Number((await sql(`select count(*)::bigint as n from ${'"' + t.schema + '"."' + t.nome + '"'}`))[0].n); } catch (e) { t.linhas = null; }
}

/* ---------- O SQL que recria a estrutura ---------- */
const q = (s) => '"' + String(s).replace(/"/g, '""') + '"';
const L = [];
L.push('-- KORbuild · estrutura do banco Supabase ' + REF + ' em ' + hoje + ' (sem dados)');
L.push('-- Gerado por tools/supabase-estrutura.mjs a partir dos catálogos do Postgres. Schemas do Supabase (auth, storage…) ficam de fora.', '');
for (const s of r.schemas) if (s.schema !== 'public') L.push('create schema if not exists ' + q(s.schema) + ';');
L.push('', '-- Extensões');
for (const e of r.extensoes) L.push('create extension if not exists ' + q(e.nome) + ';');
L.push('', '-- Tipos (enum)');
for (const t of r.tipos) L.push('create type ' + q(t.schema) + '.' + q(t.nome) + ' as enum (' + t.valores + ');');
L.push('', '-- Sequências');
for (const s of r.sequencias) L.push('create sequence if not exists ' + q(s.schema) + '.' + q(s.nome) + ' start ' + s.start_value + ' increment ' + s.increment + ';');
L.push('', '-- Tabelas');
for (const t of r.tabelas) {
  const cols = r.colunas.filter((c) => c.schema === t.schema && c.tabela === t.nome).map((c) => {
    let tipo = c.tipo;
    if (c.tamanho) tipo += '(' + c.tamanho + ')';
    else if (c.tipo === 'numeric' && c.numeric_precision) tipo += '(' + c.numeric_precision + ',' + (c.numeric_scale || 0) + ')';
    if (c.tipo.startsWith('_')) tipo = c.tipo.slice(1) + '[]';
    return '  ' + q(c.coluna) + ' ' + tipo + (c.is_identity === 'YES' ? ' generated ' + c.identity_generation + ' as identity' : '') +
      (c.column_default != null && c.is_identity !== 'YES' ? ' default ' + c.column_default : '') + (c.is_nullable === 'NO' ? ' not null' : '');
  });
  L.push('create table ' + q(t.schema) + '.' + q(t.nome) + ' (\n' + cols.join(',\n') + '\n);' + (t.comentario ? ' -- ' + t.comentario : ''));
}
L.push('', '-- Chaves e restrições (primárias e únicas antes das estrangeiras)');
for (const c of r.restricoes) L.push('alter table ' + q(c.schema) + '.' + q(c.tabela) + ' add constraint ' + q(c.nome) + ' ' + c.definicao + ';');
L.push('', '-- Índices');
for (const i of r.indices) L.push(i.definicao + ';');
L.push('', '-- Views');
for (const v of r.views) L.push('create or replace view ' + q(v.schema) + '.' + q(v.nome) + ' as\n' + v.definicao.trim().replace(/;$/, '') + ';');
L.push('', '-- Funções');
for (const f of r.funcoes) L.push(f.definicao.trim() + ';', '');
L.push('-- Triggers');
for (const t of r.triggers) L.push(t.definicao + ';');
L.push('', '-- Segurança por linha (RLS) e políticas');
for (const t of r.tabelas.filter((x) => x.rls)) L.push('alter table ' + q(t.schema) + '.' + q(t.nome) + ' enable row level security;');
for (const p of r.politicas.filter((x) => x.schema !== 'realtime')) {
  const roles = Array.isArray(p.roles) ? p.roles : String(p.roles || '').replace(/[{}]/g, '').split(',').filter(Boolean);
  L.push('create policy ' + q(p.nome) + ' on ' + q(p.schema) + '.' + q(p.tabela) + ' as ' + (p.permissive === 'PERMISSIVE' ? 'permissive' : 'restrictive') +
    ' for ' + String(p.cmd).toLowerCase() + ' to ' + (roles.length ? roles.join(', ') : 'public') + (p.qual ? ' using (' + p.qual + ')' : '') + (p.with_check ? ' with check (' + p.with_check + ')' : '') + ';');
}
L.push('', '-- Buckets do Storage (só a configuração; os arquivos não entram)');
for (const b of r.buckets) L.push("insert into storage.buckets (id, name, public) values ('" + b.id + "', '" + b.nome + "', " + b.publico + ') on conflict (id) do nothing;');

mkdirSync('supabase/backup', { recursive: true });
writeFileSync('supabase/backup/estrutura-' + hoje + '.sql', L.join('\n') + '\n');
const inventario = {
  projeto: REF, em: hoje, schemas: r.schemas.map((s) => s.schema), extensoes: r.extensoes,
  tabelas: r.tabelas.map((t) => ({ schema: t.schema, nome: t.nome, linhas: t.linhas, rls: t.rls, colunas: r.colunas.filter((c) => c.schema === t.schema && c.tabela === t.nome).map((c) => c.coluna) })),
  views: r.views.map((v) => v.schema + '.' + v.nome), funcoes: r.funcoes.map((f) => f.schema + '.' + f.nome + '(' + f.argumentos + ')'),
  triggers: r.triggers.map((t) => t.schema + '.' + t.tabela + ' · ' + t.nome), politicas: r.politicas.map((p) => p.schema + '.' + p.tabela + ' · ' + p.nome),
  tipos: r.tipos.map((t) => t.schema + '.' + t.nome), buckets: r.buckets.map((b) => b.nome), erros: r.erros || [],
};
writeFileSync('supabase/backup/inventario-' + hoje + '.json', JSON.stringify(inventario, null, 2) + '\n');
console.log('\nEstrutura: supabase/backup/estrutura-' + hoje + '.sql · inventário: supabase/backup/inventario-' + hoje + '.json');
if (r.erros) console.log('Avisos:\n  ' + r.erros.join('\n  '));
