#!/usr/bin/env node
/* KORbuild — define uma senha nova para um usuário no Supabase (sem e-mail). Serve para contas de teste cuja senha se perdeu.
 * Uso (PowerShell, na pasta do projeto):
 *   $env:KOR_DESTINO_URL         = "postgresql://postgres:SENHA-DO-BANCO@db.CODIGO.supabase.co:5432/postgres"   (o mesmo da migração; só serve para achar o código do projeto)
 *   $env:KOR_DESTINO_SERVICE_KEY = "chave service_role do projeto"   (Project Settings > API Keys)
 *   $env:KOR_NOVA_SENHA          = "senha nova com 12+ caracteres"
 *   node tools/definir-senha.mjs pv.p1.admin@example.com [outro@email ...]
 * Nada é gravado em arquivo e a senha não vai na linha de comando. Só altera a senha (e marca o e-mail como confirmado). */

const ehEmail = (a) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a);
const emails = process.argv.slice(2).filter(ehEmail);
const url = process.env.KOR_DESTINO_URL || '', chave = process.env.KOR_DESTINO_SERVICE_KEY, senha = process.env.KOR_NOVA_SENHA;
const sai = (m) => { console.error('\nERRO: ' + m); process.exit(1); };

if (!emails.length) sai('Informe ao menos um e-mail. Ex.: node tools/definir-senha.mjs pv.p1.admin@example.com');
if (!chave) sai('Falta KOR_DESTINO_SERVICE_KEY (chave service_role do projeto).');
if (!senha || senha.length < 12) sai('Falta KOR_NOVA_SENHA (12 ou mais caracteres).');
const ref = (url.match(/postgres\.([a-z0-9]{20})[:@]/) || url.match(/@db\.([a-z0-9]{20})\.supabase\.co/) || [])[1] || process.env.SUPABASE_PROJECT_REF;
if (!ref) sai('Não achei o código do projeto em KOR_DESTINO_URL (ou defina SUPABASE_PROJECT_REF).');
const base = 'https://' + ref + '.supabase.co/auth/v1/admin/users';
const cab = { apikey: chave, Authorization: 'Bearer ' + chave, 'Content-Type': 'application/json' };

console.log('Projeto ' + ref);
let falhas = 0;
process.on('unhandledRejection', (e) => sai('Falha de rede ou resposta inesperada: ' + ((e && e.cause && e.cause.code) || (e && e.message) || e)));
for (const email of emails) {
  let achado = null;
  for (let pagina = 1; pagina <= 20 && !achado; pagina++) {
    const r = await fetch(base + '?per_page=200&page=' + pagina, { headers: cab });
    if (!r.ok) sai('Não consegui listar usuários (' + r.status + '). A chave service_role é a do projeto certo?');
    const j = await r.json();
    const lista = j.users || [];
    achado = lista.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (lista.length < 200) break;
  }
  if (!achado) { console.log('  não achei  ' + email); falhas++; continue; }
  const r = await fetch(base + '/' + achado.id, { method: 'PUT', headers: cab, body: JSON.stringify({ password: senha, email_confirm: true }) });
  if (r.ok) console.log('  senha nova ' + email);
  else { console.log('  falhou     ' + email + ' (' + r.status + ')'); falhas++; }
}
console.log(falhas ? '\n' + falhas + ' com problema.' : '\nPronto. Entre no app com o e-mail e a senha nova.');
process.exit(falhas ? 1 : 0);
