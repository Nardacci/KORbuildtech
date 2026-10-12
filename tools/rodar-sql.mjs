/* KORbuild — roda um teste SQL de supabase/testes/ no Supabase, pela API de gerenciamento.
 * Só aceita arquivos de supabase/testes/ (todos terminam em ROLLBACK: não deixam nada no banco).
 * Migrações NÃO passam por aqui: elas são executadas à parte, depois de revisadas (CLAUDE.md).
 * Uso: node tools/rodar-sql.mjs supabase/testes/0002_settings.sql
 *   SUPABASE_ACCESS_TOKEN  token pessoal do Supabase (variável de ambiente; nunca no código nem no chat)
 *   SUPABASE_PROJECT_REF   opcional (padrão: gbdmtgephszxhaprpiss) */

import { readFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REF = process.env.SUPABASE_PROJECT_REF || 'gbdmtgephszxhaprpiss';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const arquivo = process.argv[2];
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN (variável de ambiente).'); process.exit(2); }
if (!arquivo) { console.error('Uso: node tools/rodar-sql.mjs supabase/testes/<arquivo>.sql'); process.exit(2); }

const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
const caminho = resolve(arquivo);
const rel = relative(raiz, caminho).split(sep).join('/');
if (!rel.startsWith('supabase/testes/') || !rel.endsWith('.sql')) {
  console.error('Recusado: só roda testes de supabase/testes/. Migrações são executadas à parte, depois de revisadas.');
  process.exit(2);
}
const sql = readFileSync(caminho, 'utf8');
if (!/\brollback\s*;\s*$/i.test(sql.trim())) { console.error('Recusado: o teste precisa terminar em ROLLBACK.'); process.exit(2); }

let r;
try {
  r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', {
    method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: sql }),
  });
} catch (e) {
  console.log('FALHA ' + rel + '\n      sem conexão com a API do Supabase: ' + e.message);
  console.log('\n0/1 verificações passaram');
  process.exit(1);
}
const texto = await r.text();
if (!r.ok) {
  let msg = texto;
  try { msg = JSON.parse(texto).message || texto; } catch { /* texto puro */ }
  console.log('FALHA ' + rel + '\n      ' + msg.slice(0, 600));
  console.log('\n0/1 verificações passaram');
  process.exit(1);
}
// as verificações falham com exceção ("FALHOU: …"); chegar aqui sem erro = todas passaram
console.log('  ok  ' + rel + ' (terminou em ROLLBACK, nada ficou no banco)');
console.log('\n1/1 verificações passaram');
