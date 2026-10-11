/* KORbuild — o portal de especificações e manual (portal/, gerado por tools/gerar_portal.py).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/portal.test.mjs [http://localhost:8123/]
 * Os links quebrados são conferidos pelo próprio gerador (python3 tools/gerar_portal.py). */

import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8123/') + 'portal/';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
await page.route(/fonts\./, (r) => r.abort());
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/portal/')) erros.push(r.status() + ' ' + r.url()); });

await page.goto(BASE);
verificar((await page.textContent('h1')).includes('Everything KORbuild does'), 'início do portal');
verificar(await page.locator('.cartao-mod').count() === 4, 'os quatro módulos');
verificar(await page.locator('a[href="../?demo#/entrar"]').count() >= 1, 'caminho para o protótipo');

for (const p of ['organization.html', 'presenting.html', 'daily/index.html', 'daily/overview.html', 'daily/user-manual.html', 'daily/business-rules.html', 'daily/roles-and-permissions.html', 'daily/prototype-status.html', 'crew/index.html', 'crew/overview.html', 'crew/user-manual.html', 'crew/business-rules.html', 'crew/roles-and-permissions.html', 'crew/prototype-status.html']) {
  await page.goto(BASE + p);
  await page.waitForLoadState('networkidle');
  // as imagens carregam conforme a rolagem (lazy): confere cada arquivo direto
  const imgs = await page.$$eval('.texto img', (l) => Promise.all(l.map((i) => fetch(i.src).then((r) => r.ok && r.headers.get('content-type').startsWith('image')))));
  verificar(imgs.every(Boolean), p + ': abre, com ' + imgs.length + ' imagens');
}
await page.goto(BASE + 'daily/user-manual.html');
verificar(await page.locator('.toc a').count() > 10 && await page.locator('a.botao[download]').count() === 1, 'manual com sumário e "Download Word"');
const word = await page.request.get(BASE + 'files/' + encodeURIComponent('KORbuild Daily - User manual.docx'));
verificar(word.ok() && (await word.body()).length > 50000, 'o Word do manual existe e tem as imagens');

await page.fill('#busca', 'approve seal');
await page.waitForSelector('#busca-resultados a');
verificar(await page.locator('#busca-resultados a').count() > 0, 'busca encontra "approve seal"');
await page.locator('#busca-resultados a').first().click();
await page.waitForLoadState();
verificar(page.url().includes('#'), 'resultado da busca leva à seção');

const cel = await browser.newPage({ viewport: { width: 390, height: 844 } });
await cel.route(/fonts\./, (r) => r.abort());
await cel.goto(BASE + 'daily/user-manual.html');
const larguraPagina = await cel.evaluate(() => document.documentElement.scrollWidth);
verificar(larguraPagina <= 392, 'no celular, sem rolagem para o lado (' + larguraPagina + ' px)');

verificar(erros.length === 0, 'sem erros' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
