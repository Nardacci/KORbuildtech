/* KORbuild — teste de SEGURANÇA estático (sem banco e sem navegador): olha o que está no repositório e nos arquivos que vão para o ar.
 *   · nenhum segredo (chave de serviço, token pessoal, senha, chave privada) em arquivo nenhum;
 *   · o app só leva a chave PÚBLICA do Supabase (papel anon / publishable);
 *   · o service worker nunca guarda respostas da API (dados de empresa não ficam em cache do aparelho);
 *   · links que abrem outra aba levam rel="noopener"; sem eval(), new Function() nem document.write() no código do app;
 *   · as funções de borda recusam quem não deve chamar (segredo do cron, código e token no formato certo) e não vazam erro interno;
 *   · as migrações não deixam de pé um buraco que já foi achado (grant em anon, função SECURITY DEFINER sem search_path, tabela sem RLS).
 * Uso: node tests/seguranca-estatica.test.mjs */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 600)) : '')); }
}

// os arquivos que o git conhece (o que vai para o repositório), sem pastas de terceiros nem arquivos binários
const todos = execFileSync('git', ['ls-files', '-z'], { cwd: RAIZ, encoding: 'utf8' }).split('\0').filter(Boolean);
const TEXTO = /\.(m?js|json|html|css|md|ts|sql|toml|yml|yaml|ps1|sh|py|txt|webmanifest|svg|csv)$/i;
const arquivos = todos.filter((f) => TEXTO.test(f) && !f.startsWith('vendor/') && !f.startsWith('node_modules/') && !f.startsWith('portal/') && existsSync(RAIZ + f) && statSync(RAIZ + f).size < 3_000_000);
const lido = new Map(arquivos.map((f) => [f, readFileSync(RAIZ + f, 'utf8')]));
const ler = (f) => lido.get(f) || readFileSync(RAIZ + f, 'utf8');
console.log(arquivos.length + ' arquivos de texto do repositório examinados');

/* ---------- 1. Segredos ---------- */
console.log('\n1. Segredos no repositório');
function jwtDecode(t) { try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()); } catch { return null; } }
{
  const achados = [];
  const padroes = [
    ['token pessoal do Supabase (sbp_…)', /\bsbp_[0-9a-f]{30,}\b/],
    ['chave secreta do Supabase (sb_secret_…)', /\bsb_secret_[A-Za-z0-9_-]{20,}/],
    ['chave privada', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
    ['chave de acesso da AWS', /\bAKIA[0-9A-Z]{16}\b/],
    ['token do GitHub', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
    ['chave da API da Anthropic/OpenAI', /\bsk-(?:ant-)?[A-Za-z0-9_-]{32,}/],
    ['senha SMTP escrita no arquivo', /SMTP_PASS\s*[:=]\s*['"][^'"$]{4,}['"]/],
    ['segredo do cron escrito no arquivo', /CRON_SECRET\s*[:=]\s*['"][^'"$]{8,}['"]/],
    ['senha da massa de demonstração escrita no arquivo', /KOR_DEMO_SENHA\s*[:=]\s*['"](?![<{$]|qualquer|\.\.\.|…)[^'"]{4,}['"]/],
    ['string de conexão com senha', /postgres(?:ql)?:\/\/[^:\s@]+:[^@\s'"]{4,}@(?!localhost|127\.0\.0\.1)[a-z0-9.-]+/i],
    ['e-mail pessoal do dono do projeto (não vai para arquivo do repositório)', /nardaccicoach/i],
  ];
  for (const [f, t] of lido) {
    if (f === 'tests/seguranca-estatica.test.mjs') continue;
    for (const [nome, re] of padroes) if (re.test(t)) achados.push(f + ': ' + nome);
    for (const m of t.matchAll(/\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g)) {
      const c = jwtDecode(m[0]);
      if (c && c.role && c.role !== 'anon') achados.push(f + ': JWT com papel «' + c.role + '» (só a chave anon pode ficar no código)');
    }
  }
  verificar(!achados.length, 'nenhum segredo nem dado pessoal nos ' + arquivos.length + ' arquivos', achados);
  verificar(!todos.some((f) => /(^|\/)\.env(\.|$)|\.pem$|\.p12$|id_rsa/.test(f) && !f.endsWith('.env.example')), 'nenhum arquivo .env, .pem ou chave privada no repositório', todos.filter((f) => /(^|\/)\.env|\.pem$|\.p12$|id_rsa/.test(f)));
  const ignorado = ler('.gitignore');
  verificar(/node_modules/.test(ignorado) && /\.testes\//.test(ignorado), '.gitignore cobre node_modules e a pasta de resultados dos testes');
}

/* ---------- 2. A chave do navegador ---------- */
console.log('\n2. A chave que vai para o navegador');
{
  const cfg = ler('js/config.js');
  const chave = (cfg.match(/SUPABASE_ANON_KEY\s*=\s*'([^']+)'/) || [])[1] || '';
  const c = chave.includes('.') ? jwtDecode(chave) : null;
  verificar(chave.startsWith('sb_publishable_') || (c && c.role === 'anon'), 'SUPABASE_ANON_KEY é a chave pública (publishable ou JWT com papel anon)', chave.slice(0, 20) + '…');
  const url = (cfg.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1] || '';
  verificar(url.startsWith('https://'), 'o Supabase é chamado por HTTPS', url);
  const semComentario = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');
  const comService = [...lido].filter(([f, t]) => /service_role/.test(semComentario(t)) && /^(js|css|assets|index\.html|admin\.html|sw\.js)/.test(f)).map(([f]) => f);
  verificar(!comService.length, 'nenhum arquivo do app (js, html, sw) cita service_role', comService);
}

/* ---------- 3. Service worker ---------- */
console.log('\n3. Service worker');
{
  const sw = ler('sw.js');
  verificar(/supabase\.co|\/rest\/v1|\/auth\/v1|\/storage\/v1|\/functions\/v1/.test(sw) || /url\.origin\s*!==\s*self\.location\.origin|origin\s*!==\s*location\.origin/.test(sw),
    'o service worker deixa passar direto (sem guardar) tudo o que não é do próprio site, em particular a API do Supabase');
  verificar(!/cache\.put\([^)]*\)/.test(sw.replace(/\/\*[\s\S]*?\*\//g, '')) || /GET/.test(sw), 'o service worker só guarda respostas de GET');
}

/* ---------- 4. Código do app ---------- */
console.log('\n4. Código do app');
{
  const app = [...lido].filter(([f]) => /^(js\/.*\.m?js|sw\.js|index\.html|admin\.html)$/.test(f));
  const perigosos = [];
  for (const [f, t] of app) {
    const limpo = t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (/\beval\s*\(/.test(limpo)) perigosos.push(f + ': eval()');
    if (/new Function\s*\(/.test(limpo)) perigosos.push(f + ': new Function()');
    if (/document\.write\s*\(/.test(limpo)) perigosos.push(f + ': document.write()');
    if (/\.setAttribute\(\s*['"]on[a-z]+['"]/.test(limpo)) perigosos.push(f + ': setAttribute("on…")');
    if (/\binnerHTML\s*[+]?=\s*(?:location|document\.(?:URL|referrer|cookie))/.test(limpo)) perigosos.push(f + ': innerHTML vindo da URL');
  }
  verificar(!perigosos.length, 'sem eval(), new Function(), document.write() nem innerHTML vindo da URL no código do app', perigosos);
  const semNoopener = [];
  for (const [f, t] of app) for (const m of t.matchAll(/<a\b[^>]*target=["']?_blank[^>]*>/g)) if (!/rel=["'][^"']*noopener/.test(m[0])) semNoopener.push(f + ': ' + m[0].slice(0, 80));
  for (const [f, t] of app) for (const m of t.matchAll(/window\.open\(([^)]*)\)/g)) if (!/noopener/.test(m[1]) && /_blank|['"]https?:/.test(m[1])) semNoopener.push(f + ': window.open sem noopener');
  verificar(!semNoopener.length, 'links e janelas que abrem outra aba levam rel="noopener"', semNoopener.slice(0, 5));
  // sem manipulador inline (onsubmit=, onclick=…) nem <script> inline: é o que deixa a política de conteúdo (CSP) ligável sem quebrar nada
  const inline = [];
  for (const [f, t] of app) {
    if (f === 'sw.js') continue;
    for (const m of t.matchAll(/\son(?:submit|click|dblclick|change|input|focus|blur|error|load|keydown|keyup|keypress|mouse\w+|touch\w+|pointer\w+)\s*=\s*["'\\]/g)) inline.push(f + ': ' + m[0].trim());
    if (f.endsWith('.html')) for (const m of t.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>/g)) inline.push(f + ': <script> inline');
  }
  verificar(!inline.length, 'nenhum manipulador de evento inline (onsubmit=, onclick=…) nem <script> inline nas telas', inline.slice(0, 8));
  const htmls = ['index.html', 'admin.html'];
  const semMeta = htmls.filter((f) => !/<meta[^>]+name=["']viewport/.test(ler(f)));
  verificar(!semMeta.length, 'as páginas do app têm o meta viewport', semMeta);
  const http = [...lido].filter(([f, t]) => /^(js|index\.html|admin\.html|sw\.js|manifest)/.test(f) && /["'(]http:\/\/(?!localhost|127\.0\.0\.1|www\.w3\.org)/.test(t)).map(([f]) => f);
  verificar(!http.length, 'o app não chama nenhum endereço http:// (só https://)', http);
  // se a política de conteúdo estiver ligada nas páginas (tools/csp-meta.mjs --ligar), tem de ser exatamente a testada em tests/_csp.mjs
  const { POLITICA } = await import('./_csp.mjs');
  const ligadas = htmls.filter((f) => ler(f).includes('<!-- csp:inicio -->'));
  const diferentes = ligadas.filter((f) => !ler(f).includes('content="' + POLITICA.replace(/"/g, '&quot;') + '"'));
  verificar(!diferentes.length, 'a política de conteúdo ligada nas páginas é a mesma medida pelos testes (' + (ligadas.length ? ligadas.join(', ') : 'ainda desligada') + ')', diferentes);
  // aviso, não falha: a política de conteúdo (CSP) segura o estrago se algum texto de usuário escapar do esc()
  const csp = htmls.filter((f) => !/Content-Security-Policy/i.test(ler(f)));
  if (csp.length) console.log('  AVISO  sem Content-Security-Policy em: ' + csp.join(', ') + ' (pronta e medida com zero violações; liga com node tools/csp-meta.mjs --ligar, ver docs/seguranca.md)');
}

/* ---------- 5. Funções de borda ---------- */
console.log('\n5. Funções de borda');
{
  const avisos = ler('supabase/functions/enviar-avisos/index.ts');
  verificar(/if \(!igual\(chamada, segredo\)\) return resposta\(\{ erro: 'nao-autorizado' \}, 401\)/.test(avisos), 'enviar-avisos recusa quem não manda o segredo do cron (401)');
  verificar(/function igual[\s\S]{0,120}if \(!a \|\| !b/.test(avisos), 'a comparação do segredo recusa vazio (segredo não configurado não deixa a porta aberta)');
  verificar(/charCodeAt\(i\)\s*\^\s*b\.charCodeAt\(i\)/.test(avisos), 'a comparação do segredo é em tempo constante');
  const diario = ler('supabase/functions/diario-publico/index.ts');
  verificar(/\^\[0-9A-F\]\{4\}-\[0-9A-F\]\{4\}-\[0-9A-F\]\{4\}\$/.test(diario), 'diario-publico só aceita o formato exato do código antes de tocar no banco');
  verificar(/delete diario\.empresa_id/.test(diario) && /empresa_id: _e/.test(diario), 'diario-publico não devolve o código da empresa nem os caminhos das fotos');
  verificar(/dentro\(chamadas, ip, 60, true\)/.test(diario) && /dentro\(erros, ip, 12, true\)/.test(diario) && /return resposta\(\{ erro: 'limite' \}, 429\)/.test(diario), 'diario-publico limita as chamadas e os códigos errados por endereço (429)');
  const convite = ler('supabase/functions/convite-publico/index.ts');
  verificar(/\^\[0-9a-f\]\{48\}\$/.test(convite) && /dentroDoLimite/.test(convite), 'convite-publico valida o formato do token e limita as tentativas');
  // devolver ao chamador só as mensagens escritas de propósito no banco (código P0001); nada de erro interno do Postgres ou do Storage
  const erros = ['enviar-avisos', 'diario-publico', 'convite-publico'].filter((n) => {
    const t = ler('supabase/functions/' + n + '/index.ts').replace(/\/\/.*$/gm, '');
    return /resposta\(\{[^}]*(?:up\.error|error)\.message/.test(t) || /JSON\.stringify\(error\)/.test(t);
  });
  verificar(!erros.length, 'as funções de borda não devolvem a mensagem de erro interna ao chamador', erros);
  verificar(/e\.code === 'P0001'/.test(ler('supabase/functions/convite-publico/index.ts')), 'convite-publico só repassa as mensagens escritas de propósito no banco (P0001)');
  for (const n of ['diario-publico', 'convite-publico']) {
    verificar(/Access-Control-Allow-Origin/.test(ler('supabase/functions/' + n + '/index.ts')), n + ' declara o CORS de propósito (função pública)');
  }
  const cors = ler('supabase/functions/diario-publico/index.ts').match(/Access-Control-Allow-Origin'?:\s*'([^']+)'/);
  if (cors && cors[1] === '*') console.log('  AVISO  diario-publico e convite-publico aceitam qualquer origem (CORS *): serve para link público, mas dá para limitar ao endereço do app depois do lançamento');
}

/* ---------- 6. Migrações: o que já foi achado não volta ---------- */
console.log('\n6. Migrações');
{
  const migracoes = todos.filter((f) => /^supabase\/migrations\/.*\.sql$/.test(f)).sort();
  const sql = migracoes.map((f) => [f, ler(f)]);
  const semSearchPath = [];
  for (const [f, t] of sql) for (const m of t.matchAll(/create (?:or replace )?function\s+([\w.]+)\s*\([\s\S]*?\$(\w*)\$[\s\S]*?\$\2\$\s*;/gi)) {
    const cabeca = m[0].slice(0, m[0].search(/\$(\w*)\$/));
    if (/security definer/i.test(cabeca) && !/set search_path/i.test(cabeca)) semSearchPath.push(f.split('/').pop() + ': ' + m[1]);
  }
  verificar(!semSearchPath.length, 'toda função SECURITY DEFINER das migrações fixa o search_path', semSearchPath);
  const grantAnon = [];
  for (const [f, t] of sql) for (const m of t.matchAll(/grant\s+[^;]*\s+to\s+[^;]*\banon\b[^;]*;/gi)) if (!/diario_por_codigo|usage on schema/i.test(m[0])) grantAnon.push(f.split('/').pop() + ': ' + m[0].replace(/\s+/g, ' ').slice(0, 90));
  verificar(!grantAnon.length, 'nenhuma migração dá privilégio a anon (a não ser o link público do diário)', grantAnon);
  const tabelas = [];
  for (const [f, t] of sql) for (const m of t.matchAll(/create table (?:if not exists )?public\.(\w+)/gi)) tabelas.push([f, m[1]]);
  const todoSql = sql.map(([, t]) => t).join('\n');
  const semRls = tabelas.filter(([, n]) => !new RegExp('alter table (?:only )?public\\.' + n + '\\s+enable row level security', 'i').test(todoSql)).map(([, n]) => n);
  verificar(!semRls.length, 'toda tabela criada nas migrações liga a RLS (' + tabelas.length + ' tabelas)', semRls);
  verificar(existsSync(RAIZ + 'supabase/testes/0011_seguranca.sql') && existsSync(RAIZ + 'tests/seguranca.test.mjs'), 'os testes de segurança do banco e da API existem');
  const usaDelete = sql.filter(([, t]) => /session_replication_role/i.test(t)).map(([f]) => f);
  verificar(!usaDelete.length, 'nenhuma migração desliga gatilhos com session_replication_role', usaDelete);
}

console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
