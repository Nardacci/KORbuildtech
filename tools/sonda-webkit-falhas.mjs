/* KORbuild — sonda das falhas que sobraram no WebKit (clima simulado, sininho, posição do GPS). Só lê; não usa banco.
 * Uso: node tools/sonda-webkit-falhas.mjs [http://localhost:8123/]     (servidor: python -m http.server 8123)
 * Cole a saída inteira de volta na conversa. */
import { webkit, devices } from 'playwright';
const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const browser = await webkit.launch();
const PERTO = { latitude: 43.00411, longitude: -71.46353, accuracy: 8 };

console.log('== 1. clima simulado (route.fulfill) vs fetch da página');
for (const [rotulo, comCors] of [['sem cabeçalho CORS', false], ['com access-control-allow-origin', true]]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: ['2026-01-01T13:00'], weather_code: [63], precipitation: [1.2], temperature_2m: [10] } }, headers: comCors ? { 'access-control-allow-origin': '*' } : {} }));
  const p = await ctx.newPage();
  await p.goto(BASE + '?demo');
  const r = await p.evaluate(async () => { try { const x = await fetch('https://api.open-meteo.com/v1/forecast?x=1'); return 'ok ' + x.status + ' ' + (await x.text()).slice(0, 60); } catch (e) { return 'ERRO ' + e.name + ': ' + e.message; } });
  console.log('  ' + rotulo + ': ' + r);
  await ctx.close();
}

console.log('\n== 2. sininho: o botão "Marcar todas como lidas" fica estável?');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: PERTO, permissions: ['geolocation'] });
  await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } });
  await ctx.route(/fonts\.|api\.open-meteo|tile\.openstreetmap|osrm|nominatim/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE + '?demo');
  await p.waitForSelector('#form-login', { timeout: 30000 });
  // entra como o primeiro usuário da lista de acesso rápido do protótipo
  const entrar = p.locator('[data-acao="entrar-como"], .usuario-demo button, #form-login button[type=submit]').first();
  console.log('  botão de entrada: ' + (await entrar.count()) + ' (se 0, ajuste o seletor)');
  await entrar.click().catch((e) => console.log('  clique de entrada falhou: ' + e.message.slice(0, 100)));
  await p.waitForSelector('.sino summary', { timeout: 20000 }).catch(() => console.log('  sem sininho nesta tela'));
  if (await p.locator('.sino summary').count()) {
    await p.click('.sino summary');
    const caixa = async () => p.evaluate(() => {
      const b = document.querySelector('[data-acao="ler-todas"]'); if (!b) return 'sem botão';
      const r = b.getBoundingClientRect(); const d = document.querySelector('details.sino');
      return JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), detailsOpen: d && d.open, visib: getComputedStyle(b).visibility, disp: getComputedStyle(b).display, anim: b.getAnimations ? document.getAnimations().length : null, vh: innerHeight });
    });
    for (let i = 0; i < 6; i++) { console.log('  t' + i + ' ' + await caixa()); await p.waitForTimeout(250); }
  }
  await ctx.close();
}

console.log('\n== 3. GPS: posição inicial, setGeolocation e leitura repetida');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 10, longitude: 10, accuracy: 8 }, permissions: ['geolocation'] });
  const p = await ctx.newPage();
  await p.goto(BASE + 'diagnostico.html');
  const ler = () => p.evaluate(() => new Promise((ok) => navigator.geolocation.getCurrentPosition((x) => ok(x.coords.latitude.toFixed(4) + ',' + x.coords.longitude.toFixed(4)), (e) => ok('ERRO ' + e.code + ' ' + e.message), { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 })));
  console.log('  inicial (10,10): ' + await ler());
  await ctx.setGeolocation(PERTO);
  for (let i = 0; i < 4; i++) { await p.waitForTimeout(700); console.log('  após setGeolocation +' + (i + 1) + ': ' + await ler()); }
  await p.reload();
  console.log('  após reload: ' + await ler());
  await ctx.close();
}
await browser.close();
