/* KORbuild — o fluxo do Projeto (1ª versão) todo em inglês: abas, formulários, janelas, relatórios e avisos.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/ingles.test.mjs [http://localhost:8123/] [--relatorio]
 * Com --relatorio, lista tudo o que achou em português (sem falhar). */

import { chromium } from 'playwright';
import fs from 'fs';

const BASE = (process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/') + '?demo&versao=primeira';
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
const CODIGOS = /\b[0-9A-F]{4}(-[0-9A-F]{4})+\b|SHA-256 [0-9a-f]+|\b[0-9a-f]{10,}…?|\b[A-Z]{1,4}\b/g;
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

const vistas = [];
const achados = new Map(); // linha → { telas }
const semTraducao = new Set();

let nColetadas = 0;
async function coletar(rota) {
  const r = await page.evaluate(() => {
    const linhas = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const attrs = [...document.querySelectorAll('[title],[aria-label],[placeholder],option')]
      .flatMap((el) => ['title', 'aria-label', 'placeholder'].map((a) => el.getAttribute(a)).concat(el.tagName === 'OPTION' ? el.textContent.trim() : null).filter(Boolean));
    return { linhas: linhas.concat(attrs), falta: [...(window.kbtSemTraducao || [])] };
  });
  nColetadas += r.linhas.length; if (/projeto\/pj-casa\/(scope|schedule)$/.test(rota)) vistas.push(rota + ' ' + r.linhas.length);
  for (const l of r.linhas) {
    if (!emPortugues(l)) continue;
    const a = achados.get(l) || new Set();
    a.add(rota);
    achados.set(l, a);
  }
  r.falta.forEach((f) => semTraducao.add(f));
}


await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
await page.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
await page.goto('about:blank');
const toasts = [];
async function ir(rota) { await page.goto('about:blank'); await page.goto(BASE + rota); await page.waitForTimeout(300); await coletar(rota); }
async function sondar(rotulo) { await page.waitForTimeout(250); await coletar(rotulo); }

await ir('#/measure');
await ir('#/inicio');
await ir('#/measure/projeto/novo');
// validações do formulário (avisos)
await page.click('[data-acao="mz-salvar-projeto"]'); await sondar('novo projeto: aviso 1');
await page.fill('#pj-nome', 'Test house'); await page.click('[data-acao="mz-salvar-projeto"]'); await sondar('novo projeto: aviso 2');
await page.click('[data-acao="contato-rapido"]').catch(() => {}); await sondar('novo projeto: novo contato');
await page.keyboard.press('Escape');
await ir('#/measure/projeto/pj-casa/editar');
for (const aba of ['overview', 'plans', 'scope', 'takeoff', 'materials', 'schedule', 'bids']) await ir('#/measure/projeto/pj-casa/' + aba);
await ir('#/measure/projeto/pj-casa/cotacao');
await ir('#/measure/projeto/pj-casa/proposta');

// ações do escopo e do cronograma
await ir('#/measure/projeto/pj-casa/takeoff');
for (const sel of ['[data-acao="pj-padrao"][data-padrao="tudo"]', '[data-acao="pj-padrao"][data-padrao="terceirizar"]', '[data-acao="pj-padrao"][data-padrao="misto"]', '[data-acao="pj-sugerir-etapas"]', '[data-acao="pj-add-etapa"]']) {
  await page.locator(sel).first().click().catch(() => {}); await sondar('escopo: ' + sel);
}
await page.keyboard.press('Escape');
await ir('#/measure/projeto/pj-casa/schedule');
for (const sel of ['[data-acao="pj-gerar-cronograma"]', '[data-acao="pj-add-tarefa"]', '[data-acao="pj-add-marco"]']) {
  await page.locator(sel).first().click().catch(() => {}); await sondar('cronograma: ' + sel);
}
// plantas: janelas de escala e de envio
await ir('#/measure/projeto/pj-casa/plans');
const folha = await page.locator('a[href*="#/measure/folha/"]').first().getAttribute('href').catch(() => null);
if (folha) {
  await ir(folha);
  await page.click('[data-acao="mz-escala"]').catch(() => {}); await sondar('visor: escala');
  await page.keyboard.press('Escape');
  for (const f of ['medir', 'contar', 'recortar']) { await page.locator('[data-acao="mz-ferramenta"][data-ferramenta="' + f + '"]').click().catch(() => {}); await sondar('visor: ' + f); }
}
// takeoff: janelas
await ir('#/measure/projeto/pj-casa/takeoff');
await ir('#/measure/projeto/pj-casa/materials');
await page.locator('[data-acao="cot-email"]').first().click().catch(() => {}); await sondar('cotação: e-mail');
await page.keyboard.press('Escape');
await ir('#/measure/projeto/pj-casa/proposta');
await page.locator('[data-acao="prop-emitir"]').first().click().catch(() => {}); await sondar('proposta: emitir');
await page.keyboard.press('Escape');
// catálogo e preços
for (const r of ['#/measure/assemblies', '#/measure/assemblies/novo', '#/measure/itens', '#/measure/precos']) await ir(r);
// licitações
for (const r of ['#/daily/concorrencias', '#/daily/concorrencias/nova', '#/daily/concorrencias/nova/projeto/pj-casa', '#/daily/concorrencias/recebidas']) await ir(r);
// projeto com concorrência e na versão sem projeto aberto
for (const u of ['u-rita']) { await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), u); await ir('#/measure'); await ir('#/measure/projeto/pj-casa/takeoff'); }

console.log('  telas lidas: ' + nColetadas + ' linhas; ' + vistas.join(' · '));
verificar(nColetadas > 800, 'o teste leu o fluxo de verdade (' + nColetadas + ' linhas)');
verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
verificar(semTraducao.size === 0, 'toda frase marcada tem inglês (' + semTraducao.size + ' sem tradução)');
verificar(achados.size === 0, 'nenhum texto em português no fluxo do projeto (' + achados.size + ' linhas)');
if (RELATORIO || falhas) {
  if (semTraducao.size) console.log('\nSem tradução:\n' + [...semTraducao].map((s) => '  ' + JSON.stringify(s)).join('\n'));
  if (achados.size) console.log('\nEm português na tela:\n' + [...achados].map(([l, telas]) => '  ' + l.slice(0, 160) + '   ← ' + [...telas].slice(0, 2).join(', ')).join('\n'));
}
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
