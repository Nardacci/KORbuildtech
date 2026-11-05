/* KORbuild — Sair funciona mesmo quando o pedido de saída ao servidor falha ou não responde (o que acontecia no iPhone: a sessão ficava no aparelho e o app voltava logado).
 * Sem banco: o Supabase é de mentira (conta sem empresa; /auth/v1/logout derrubado ou preso). Uso: python3 -m http.server 8123 &  →  node tests/sair-sem-rede.test.mjs [http://localhost:8123/] */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { sessao } from './_supabase-local.mjs';

const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/');
const URL_SB = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0;
const verificar = (c, t, d) => { if (c) console.log('  ok  ' + t); else { falhas++; console.log('FALHA ' + t + (d !== undefined ? '\n      encontrado: ' + JSON.stringify(d) : '')); } };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const UID = '00000000-0000-4000-8000-0000000000aa';

async function tentar(rotulo, logout) {
  console.log(rotulo);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(([s]) => { try { if (!localStorage.getItem('kbt.conta') && !sessionStorage.getItem('ja')) { localStorage.setItem('kbt.conta', s); sessionStorage.setItem('ja', '1'); } localStorage.setItem('kbt.idioma', 'pt'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } }, [await sessao(UID, 'fabio@example.com', 'Fábio')]);
  await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo/, (r) => r.abort());
  await ctx.route(URL_SB + '/**', async (route) => {
    const u = new URL(route.request().url()).pathname;
    if (u.startsWith('/auth/v1/logout')) return logout(route);
    if (u.startsWith('/rest/v1/rpc/')) return route.fulfill({ json: false });
    if (u.startsWith('/rest/v1/')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '*/0' }, body: route.request().headers().accept?.includes('vnd.pgrst.object') ? 'null' : '[]' });
    return route.fulfill({ json: {} });
  });
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(BASE + '#/conta');
  await p.waitForSelector('[data-acao="of-sair"]', { state: 'attached', timeout: 30000 });
  verificar(await p.evaluate(() => !!localStorage.getItem('kbt.conta')), 'a sessão está guardada no aparelho antes de sair');
  if (!(await p.locator('[data-acao="of-sair"]').first().isVisible())) await p.click('.menu-usuario:not(.sino) summary');
  await p.click('[data-acao="of-sair"]');
  await p.waitForSelector('#form-login-oficial', { timeout: 20000 }).catch(() => null);
  verificar(await p.locator('#form-login-oficial').count() === 1, 'volta para a tela de entrar', p.url());
  verificar(await p.evaluate(() => !localStorage.getItem('kbt.conta')), 'a sessão saiu do aparelho');
  await p.reload(); await p.waitForTimeout(1500);
  verificar(await p.locator('#form-login-oficial').count() === 1, 'depois de recarregar continua na entrada (não volta logado)', p.url());
  verificar(erros.length === 0, 'sem erros de JavaScript', erros);
  await ctx.close();
}
await tentar('Servidor derruba o pedido de saída', (r) => r.abort());
await tentar('Servidor não responde ao pedido de saída', () => { /* fica preso */ });
await browser.close();
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
