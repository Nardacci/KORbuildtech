/* KORbuild — a página oficial (sem "?demo") e o caminho para o protótipo e o portal.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/entrada.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8123/';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 } });
await context.route(/fonts\./, (r) => r.abort());
const page = await context.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

await page.goto(BASE);
await page.waitForSelector('#form-login-oficial', { timeout: 30000 });
const tela = await page.textContent('#form-login-oficial');
verificar(page.url().endsWith('#/entrar'), 'a página oficial abre na entrada');
verificar(!/@(construtoraexemplo|prestadoraexemplo|examplebuilders|northfieldframing)/.test(tela) && await page.inputValue('#oficial-email') === '', 'sem usuários de demonstração e sem e-mail preenchido');
verificar(await page.locator('a[href="portal/"]').count() === 1, 'link para as especificações e o manual (portal)');
verificar(await page.locator('a[href="?demo#/entrar"]').count() === 1, 'link para o protótipo');
await page.fill('#oficial-email', 'someone@company.com');
await page.fill('#oficial-senha', 'x');
await page.click('#form-login-oficial button[type="submit"]');
verificar(await page.isVisible('#login-erro') && await page.locator('#login-erro a[href="?demo#/entrar"]').count() === 1, 'contas reais ainda não entram: avisa e aponta o protótipo');
await page.goto(BASE + '#/daily/painel');
await page.waitForTimeout(300);
verificar(page.url().endsWith('#/entrar') && await page.locator('#form-login-oficial').count() === 1, 'sem "?demo", nenhuma tela do protótipo abre');

await page.click('a[href="?demo#/entrar"]');
await page.waitForSelector('#form-login', { timeout: 30000 });
verificar(page.url().includes('?demo') && (await page.textContent('#form-login')).includes('@'), 'o protótipo abre com os usuários de demonstração');
verificar(await page.locator('.login-prototipo a[href="./"]').count() === 1, 'o protótipo tem o caminho de volta para a entrada oficial');
verificar(await page.locator('.login-manual').count() === 1, 'o Manual de teste continua na entrada do protótipo');
await page.click('#form-login button[type="submit"]');
await page.waitForTimeout(500);
verificar(page.url().includes('?demo#/'), 'entrar no protótipo mantém o "?demo" no endereço');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
