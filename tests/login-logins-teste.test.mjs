/* TEMPORÁRIO: apagar este teste junto com a lista, depois dos testes de homologação (MOSTRAR_LOGINS_DE_TESTE em js/plataforma.js).
 * KORbuild — logins de teste no login oficial (só na homologação; js/plataforma.js). No localhost só aparecem com kbt.loginsDeTeste = 1.
 * Uso: python3 -m http.server 8123 &  →  node tests/login-logins-teste.test.mjs [http://localhost:8123/] */
import { chromium } from 'playwright';
const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/');
let falhas = 0;
const verificar = (c, t, d) => { if (c) console.log('  ok  ' + t); else { falhas++; console.log('FALHA ' + t + (d !== undefined ? '\n      encontrado: ' + JSON.stringify(d) : '')); } };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
async function abrir(flag) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript((f) => { try { localStorage.setItem('kbt.idioma', 'pt'); if (f) localStorage.setItem('kbt.loginsDeTeste', '1'); } catch { /* */ } }, flag);
  await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo|supabase\.co/, (r) => r.abort());
  const p = await ctx.newPage(); const erros = []; p.on('pageerror', (e) => erros.push(e.message));
  await p.goto(BASE + '#/entrar'); await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
  return { p, erros, ctx };
}
console.log('Sem a marca de teste (como no domínio de produção)');
let a = await abrir(false);
verificar(await a.p.locator('#logins-teste').count() === 0, 'o login oficial não mostra contas de teste');
await a.ctx.close();
console.log('Na homologação (simulada com a marca)');
a = await abrir(true);
const lista = await a.p.locator('#logins-teste .email-demo').allInnerTexts();
verificar(lista.length === 5 && lista.includes('hom.hp.admin@example.com') && lista.includes('hom.hq.admin@example.com'), 'o login mostra os 5 e-mails da massa de homologação', lista);
const txt = await a.p.locator('#logins-teste').innerText();
verificar(!/senha\s*[:=]/i.test(txt) && /combinada por fora/.test(txt), 'a tela não mostra senha: diz que ela é combinada por fora', txt);
await a.p.click('#logins-teste .email-demo:has-text("hom.hp.encarregado")');
verificar(await a.p.inputValue('#oficial-email') === 'hom.hp.encarregado@example.com', 'tocar no e-mail preenche o campo');
verificar(await a.p.evaluate(() => document.activeElement && document.activeElement.id) === 'oficial-senha', 'o foco vai para a senha');
verificar(a.erros.length === 0, 'nenhum erro de JavaScript', a.erros);
await a.ctx.close(); await browser.close();
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
