/* KORbuild — o app em inglês (o padrão): percorre as telas de cada perfil e acusa texto em português.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/ingles.test.mjs [http://localhost:8123/] [--relatorio]
 * Com --relatorio, lista tudo o que achou em português (sem falhar). */

import { chromium } from 'playwright';
import fs from 'fs';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const RELATORIO = process.argv.includes('--relatorio');
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

// Português na tela: acento ou palavra que só aparece nas chaves do dicionário (frases em português)
// e nunca nas traduções. Nomes próprios de exemplo ficam de fora (PERMITIDO).
const dic = fs.readFileSync(new URL('../js/i18n-en.js', import.meta.url), 'utf8');
const pares = [...dic.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)];
const palavras = (s) => s.toLowerCase().match(/[a-zà-ü]+/g) || [];
const EN = new Set(pares.flatMap((p) => palavras(p[2])).concat('a an the of to in on at by for and or is are be it no yes all per'.split(' ')));
const SO_PT = new Set(pares.flatMap((p) => palavras(p[1])).filter((w) => w.length >= 2 && !EN.has(w)));
const PERMITIDO = /\S+@\S+|Márcia|Antônio|João|José|André|Sebastião|Conceição|Gonçalves|Simões|Araújo|Português|KORbuild|Northfield|casa-modelo\.pdf/g;
// códigos de verificação, hashes e siglas (LO, DA…) não são palavras
const CODIGOS = /\b[0-9A-F]{4}(-[0-9A-F]{4})+\b|SHA-256 [0-9a-f]+|\b[A-Z]{1,4}\b/g;
const emPortugues = (l) => { const s = l.replace(PERMITIDO, '').replace(CODIGOS, ''); return /[ãõçâêôáéíóúà]/i.test(s) || palavras(s).some((w) => SO_PT.has(w)); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({
  viewport: { width: 1366, height: 900 },
  geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'],
});
await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
await context.route('https://fonts.**', (r) => r.abort());
await context.route(/tile\.openstreetmap|router\.project-osrm|nominatim/, (r) => r.abort());
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
verificar(await page.evaluate(() => document.documentElement.lang === 'en'), 'sem escolha, o app abre em inglês');
verificar((await page.textContent('#form-login h2')).trim() === 'Sign in', 'tela de entrada em inglês');

const telaEntrada = await page.textContent('#form-login');
verificar(telaEntrada.includes('ana@examplebuilders.com') && !telaEntrada.includes('exemplo.com'), 'e-mails de exemplo com domínio em inglês');
await page.fill('#login-email', 'carlos@construtoraexemplo.com');
await page.click('#form-login button[type="submit"]');
await page.waitForFunction(() => localStorage.getItem('kbt.sessao') === 'u-carlos', null, { timeout: 5000 }).catch(() => {});
verificar(await page.evaluate(() => localStorage.getItem('kbt.sessao') === 'u-carlos'), 'o e-mail em português (manual de teste) também entra');

const achados = new Map(); // linha → { telas }
const semTraducao = new Set();

async function coletar(rota) {
  const r = await page.evaluate(() => {
    const linhas = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const attrs = [...document.querySelectorAll('[title],[aria-label],[placeholder],option')]
      .flatMap((el) => ['title', 'aria-label', 'placeholder'].map((a) => el.getAttribute(a)).concat(el.tagName === 'OPTION' ? el.textContent.trim() : null).filter(Boolean));
    return { linhas: linhas.concat(attrs), falta: [...(window.kbtSemTraducao || [])] };
  });
  for (const l of r.linhas) {
    if (!emPortugues(l)) continue;
    const a = achados.get(l) || new Set();
    a.add(rota);
    achados.set(l, a);
  }
  r.falta.forEach((f) => semTraducao.add(f));
}

/* Percorre os links internos a partir do início, até um limite por usuário. */
async function percorrer(usuario, limite) {
  await page.evaluate((id) => localStorage.setItem('kbt.sessao', id), usuario);
  const fila = ['#/inicio'];
  const vistas = new Set();
  while (fila.length && vistas.size < limite) {
    const rota = fila.shift();
    if (vistas.has(rota)) continue;
    vistas.add(rota);
    await page.goto(BASE + rota);
    await page.waitForTimeout(250);
    await coletar(rota);
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')));
    for (const l of links) {
      // pula variações sem fim (semanas e meses anteriores, imprimir)
      if (/\/(\d{4}-\d{2}(-\d{2})?)\/?$/.test(l) && vistas.size > 5 && [...vistas].some((v) => v.replace(/\d{4}-\d{2}(-\d{2})?/, '') === l.replace(/\d{4}-\d{2}(-\d{2})?/, ''))) continue;
      if (!vistas.has(l) && !fila.includes(l)) fila.push(l);
    }
  }
  return vistas.size;
}

for (const [u, limite] of [['u-ana', 90], ['u-carlos', 40], ['u-diego', 10], ['u-tom', 90], ['u-rita', 20]]) {
  const n = await percorrer(u, limite);
  console.log('  ' + u + ': ' + n + ' telas');
}

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
verificar(semTraducao.size === 0, 'toda frase marcada tem inglês (' + semTraducao.size + ' sem tradução)');
verificar(achados.size === 0, 'nenhum texto em português nas telas (' + achados.size + ' linhas)');
if (RELATORIO || falhas) {
  if (semTraducao.size) console.log('\nSem tradução:\n' + [...semTraducao].map((s) => '  ' + JSON.stringify(s)).join('\n'));
  if (achados.size) console.log('\nEm português na tela:\n' + [...achados].map(([l, telas]) => '  ' + l.slice(0, 160) + '   ← ' + [...telas].slice(0, 2).join(', ')).join('\n'));
}

await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
