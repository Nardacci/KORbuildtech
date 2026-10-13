/* KORbuild — a administração da plataforma (fatia 8c; docs/banco.md §15.6), de ponta a ponta.
 *   Ana administra a plataforma (e tem a própria empresa); Beto é de outra empresa e não administra.
 *   Beto abre admin.html: "Sem acesso". Ana lista as empresas, abre a do Beto, exige motivo, muda o plano, suspende e reativa.
 *   Suspensa, a empresa do Beto lê mas não grava, e o app mostra o aviso; ele recebe o aviso no sininho. O link para a administração só aparece para a Ana.
 * Duas formas de rodar: --local (padrão; tools/supabase-local.sh) ou --real (Supabase do projeto; usuários kb-e2e-daily-…).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/admin-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Administração contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };

const sufixo = Date.now().toString(36);
await limpar();
const EMAIL_ANA = 'kb-e2e-daily-ana-' + sufixo + '@example.com';
const EMAIL_BETO = 'kb-e2e-daily-beto-' + sufixo + '@example.com';
const ANA = await criarUsuario(EMAIL_ANA, 'Ana Local');
const BETO = await criarUsuario(EMAIL_BETO, 'Beto Local');
const EMP_ANA = await rest(ANA, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
const EMP_BETO = await rest(BETO, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
await sqlExec(`insert into public.admins_plataforma (user_id) values ('${ANA}')`);
const plano = async () => (await sql(`select plano from public.empresas where id = '${EMP_BETO}'`))[0].plano;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];
let pagina = null;
async function abrir(id, email, apelido) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(id, email, apelido)]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push('[' + apelido + ' ' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push('[' + apelido + ' ' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  return p;
}
try {
  console.log('Quem não administra');
  const b = pagina = await abrir(BETO, EMAIL_BETO, 'beto');
  await b.goto(BASE + 'admin.html');
  verificar(await esperarAte(async () => ((await b.locator('body').textContent()) || '').includes('Sem acesso')), 'Beto abre a administração e vê "Sem acesso"');
  verificar((await b.locator('table.tabela').count()) === 0, 'nenhuma empresa aparece para quem não administra');
  await b.goto(BASE + '#/conta');
  await b.waitForSelector('.oficial-pagina', { timeout: 30000 });
  verificar(((await b.locator('body').textContent()) || '').includes('Administração da plataforma') === false, 'o link para a administração não aparece na conta do Beto');

  console.log('Quem administra');
  const a = pagina = await abrir(ANA, EMAIL_ANA, 'ana');
  await a.goto(BASE + '#/conta');
  await a.waitForSelector('.oficial-pagina', { timeout: 30000 });
  verificar(await esperarAte(async () => (await a.locator('a[href="admin.html"]').count()) === 1), 'o link para a administração aparece no Início da Ana');
  await a.goto(BASE + 'admin.html#empresas');
  await a.waitForSelector('#ad-busca', { timeout: 30000 });
  await a.fill('#ad-busca', 'Prestadora Local ' + sufixo);
  await a.waitForSelector('table.tabela a[href="#empresa/' + EMP_BETO + '"]', { timeout: 20000 });
  verificar(await esperarAte(async () => (await a.locator('table.tabela tbody tr').count()) === 1), 'a busca pelo nome acha só a empresa do Beto');
  await a.click('table.tabela a[href="#empresa/' + EMP_BETO + '"]');
  await a.waitForSelector('#ad-plano', { timeout: 20000 });

  console.log('Mudar o plano');
  await a.fill('#ap-nome', 'Profissional');
  await a.fill('#ap-obras', '10');
  await a.click('button[data-acao="ad-salvar-plano"]');
  verificar(await esperarAte(async () => (await plano()).nome === 'Teste'), 'sem motivo, nada muda');
  await a.fill('#ap-nome', 'Profissional');
  await a.fill('#ap-obras', '10');
  await a.fill('#ap-motivo', 'Assinou o plano Profissional');
  await a.click('button[data-acao="ad-salvar-plano"]');
  verificar(await esperarAte(async () => { const p = await plano(); return p.nome === 'Profissional' && Number(p.limite_obras) === 10; }), 'com motivo, o plano muda (nome e limite de obras)', await plano());
  const reg = await sql(`select count(*)::int n from public.admin_log where empresa_id = '${EMP_BETO}' and acao = 'plano'`);
  verificar(reg[0].n >= 1, 'a mudança fica no registro da plataforma', reg);
  const aviso = await sql(`select count(*)::int n from public.notificacoes where user_id = '${BETO}' and chave = 'O plano da sua empresa foi alterado pelo KORbuild'`);
  verificar(aviso[0].n === 1, 'quem administra a empresa recebe o aviso da mudança', aviso);

  console.log('Suspender e reativar');
  await a.waitForSelector('#ad-plano', { timeout: 20000 });
  a.once('dialog', (d) => d.accept());
  await a.fill('#ap-motivo', 'Pagamento em aberto');
  await a.click('button[data-acao="ad-situacao"][data-situacao="suspensa"]');
  verificar(await esperarAte(async () => (await plano()).status === 'suspensa'), 'suspender muda a situação para suspensa', await plano());
  let negou = '';
  try { await rest(BETO, '/contatos', { metodo: 'POST', corpo: { empresa_id: EMP_BETO, nome: 'Contato ' + sufixo, papeis: ['cliente'] } }); } catch (e) { negou = String(e.message); }
  verificar(negou.includes('suspensa'), 'suspensa, a empresa não grava (o banco recusa)', negou.slice(0, 200));
  const leu = await rest(BETO, '/empresas?select=id');
  verificar(Array.isArray(leu) && leu.length >= 1, 'suspensa, a empresa continua lendo os dados');
  await b.goto(BASE + '#/conta');
  await b.reload();
  verificar(await esperarAte(async () => ((await b.locator('.aviso-plano').textContent().catch(() => '')) || '').includes('suspensa')), 'o app mostra o aviso de conta suspensa para o Beto');
  await a.waitForSelector('#ad-plano', { timeout: 20000 });
  await a.fill('#ap-motivo', 'Pagamento regularizado');
  await a.click('button[data-acao="ad-situacao"][data-situacao="ativa"]');
  verificar(await esperarAte(async () => (await plano()).status === 'ativa'), 'reativar volta a empresa para ativa', await plano());
  let gravou = true;
  try { await rest(BETO, '/contatos', { metodo: 'POST', corpo: { empresa_id: EMP_BETO, nome: 'Contato B ' + sufixo, papeis: ['cliente'] } }); } catch { gravou = false; }
  verificar(gravou, 'reativada, a empresa volta a gravar');
  await b.reload();
  verificar(await esperarAte(async () => (await b.locator('.aviso-plano').count()) === 0), 'e o aviso some');

  console.log('Outras abas e o inglês');
  await a.click('a[href="#administradores"]');
  verificar(await esperarAte(async () => ((await a.locator('body').textContent()) || '').includes(EMAIL_ANA)), 'a aba Administradores lista a Ana');
  await a.click('a[href="#emails"]');
  verificar(await esperarAte(async () => (await a.locator('.cartao').count()) >= 4), 'a aba E-mails mostra o resumo e a fila');
  await a.click('a[href="#empresas"]');
  await a.waitForSelector('[data-acao="idioma"][data-idioma="en"]', { timeout: 20000 });
  await a.click('[data-acao="idioma"][data-idioma="en"]');
  verificar(await esperarAte(async () => ((await a.locator('body').textContent()) || '').includes('Platform administration')), 'em inglês a tela sai traduzida');
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (falhas) {
    if (pagina) console.log('      [página] ' + pagina.url() + ' · aviso: ' + (((await pagina.locator('#toast').textContent().catch(() => '')) || '').slice(0, 120)));
    if (pagina) console.log('      [texto da tela] ' + (((await pagina.locator('#app').textContent().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 300)));
    for (const e of erros.slice(0, 5)) console.log('      [erro de JavaScript] ' + e);
    for (const l of diag.slice(0, 20)) console.log('      ' + l);
  }
  verificar(erros.length === 0, 'sem erros de JavaScript nas telas', erros.slice(0, 3));
  await browser.close();
  await limpar();
  if (REAL) {
    const resto = await sql(`select (select count(*) from public.empresas where nome like '%Local ${sufixo}')::int e`);
    verificar(resto[0].e === 0, 'a cena de teste foi apagada');
  }
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
