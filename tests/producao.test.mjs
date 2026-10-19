/* KORbuild — a pasta de produção (producao/, de tools/gerar-producao.mjs) como o domínio korbuildtech.com a serve:
 * 1ª versão sozinha (só Measure Takeoff e Settings), sem protótipo, sem roteiros de celular, com o guia só do Measure Takeoff.
 * O navegador acha que é o domínio de verdade por --host-resolver-rules (korbuildtech.com → este computador). Não usa banco.
 * Uso: python3 tools/gerar_portal.py --edicao=measure && node tools/gerar-producao.mjs && node tests/producao.test.mjs */

import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const PASTA = join(fileURLToPath(new URL('..', import.meta.url)), 'producao');
if (!existsSync(join(PASTA, 'index.html'))) { console.log('FALHA falta a pasta producao/: rode node tools/gerar-producao.mjs'); process.exit(1); }
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 300)) : '')); }
}
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const servidor = createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const arq = normalize(join(PASTA, rel));
  if (!arq.startsWith(PASTA) || !existsSync(arq) || statSync(arq).isDirectory()) { res.writeHead(404); res.end('não encontrado'); return; }
  res.writeHead(200, { 'content-type': TIPOS[extname(arq)] || 'application/octet-stream' });
  res.end(readFileSync(arq));
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const porta = servidor.address().port;
const URL_BASE = 'http://korbuildtech.com:' + porta + '/';

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--host-resolver-rules=MAP korbuildtech.com 127.0.0.1'] });
const erros = [];
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  await ctx.route('https://**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));

  console.log('A entrada no domínio');
  await p.goto(URL_BASE);
  await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
  const t = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  verificar(/Measure Takeoff/.test(t) && !/Daily|Crew|Bids|Concorr/.test(t), 'só fala do Measure Takeoff', t.slice(0, 250));
  verificar(await p.locator('a[href*="demo"]').count() === 0 && await p.locator('a[href*="teste-"]').count() === 0, 'sem link do protótipo nem dos roteiros');
  await p.goto(URL_BASE + '?demo#/entrar');
  await p.waitForSelector('#form-login-oficial, #form-login', { timeout: 30000 });
  verificar(await p.locator('#form-login-oficial').count() === 1 && await p.locator('#form-login').count() === 0, 'o ?demo não abre o protótipo no domínio');
  await p.goto(URL_BASE + '?versao=completa');
  await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
  verificar(!/Daily/.test(await p.locator('body').innerText()), 'o ?versao=completa não destrava os outros módulos no domínio');

  console.log('\nO que ficou de fora');
  for (const f of ['teste-iphone.html', 'teste-android.html', 'manual/manual-de-teste.html']) {
    const status = await p.evaluate(async (u) => (await fetch(u)).status, URL_BASE + f);
    verificar(status === 404, f + ' não existe em produção', status);
  }
  const sw = await p.evaluate(async (u) => (await fetch(u)).text(), URL_BASE + 'sw.js');
  verificar(!/teste-iphone|teste-android|manual-de-teste/.test(sw), 'o service worker não lista arquivos que não existem');
  const htaccess = readFileSync(join(PASTA, '.htaccess'), 'utf8');
  verificar(/RewriteCond %\{HTTPS\} off/.test(htaccess) && /Options -Indexes/.test(htaccess), '.htaccess: força https e não lista pastas');

  console.log('\nO guia do Measure Takeoff');
  await p.goto(URL_BASE + 'portal/');
  await p.waitForSelector('h1', { timeout: 30000 });
  const g = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  verificar(/Measure Takeoff/.test(g) && !/Daily|Crew|Presenter|prototype/i.test(g), 'a página inicial do guia só tem o Measure Takeoff e o Settings', g.slice(0, 250));
  await p.goto(URL_BASE + 'portal/measure/user-manual.html');
  await p.waitForSelector('h1', { timeout: 30000 });
  const m = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
  verificar(/Measure Takeoff/.test(m) && !/Daily|Crew/.test(m), 'o manual do Measure Takeoff não fala dos outros módulos');
  const imgs = await p.locator('img[src*="img/"]').evaluateAll((l) => l.map((i) => i.src));
  const quebradas = (await Promise.all(imgs.map((u) => p.evaluate(async (x) => (await fetch(x)).status, u)))).filter((c) => c !== 200).length;
  verificar(imgs.length > 3 && quebradas === 0, 'as imagens do manual existem na pasta de produção', { total: imgs.length, quebradas });
  await p.goto(URL_BASE + 'portal/pt/');
  await p.waitForSelector('h1', { timeout: 30000 });
  verificar(/Measure Takeoff/.test(await p.locator('body').innerText()) && await p.locator('html[lang="pt-BR"]').count() === 1, 'o guia em português também abre');
  verificar(!erros.length, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 2).join(' | ') : ''));
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  await browser.close();
  servidor.close();
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
