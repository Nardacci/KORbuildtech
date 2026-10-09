/* Varredura profunda em inglês: cada tela de um usuário + cada botão (diálogos, menus, abas, avisos),
 * partindo sempre do estado original. Mais lenta que tests/ingles.test.mjs; use depois de mudanças grandes.
 * Uso (servidor na pasta do projeto, porta 8123):
 *   node tools/varredura-ingles.mjs saida.txt u-tom 1366 80     (usuário, largura da tela, limite de telas)
 * Grava saida.txt (linhas suspeitas e onde aparecem) e saida.txt.todas (todo o texto visto, para revisar o inglês). */
import { chromium } from 'playwright';
import fs from 'fs';
const RAIZ = new URL('..', import.meta.url).pathname;
const BASE = 'http://localhost:8123/';
const [OUT, U, W, LIM] = process.argv.slice(2);
const acoesVistas = new Set();

// Vocabulário: palavras das chaves (pt) que não aparecem nas traduções (en) nem num inglês básico.
const src = fs.readFileSync(RAIZ + 'js/i18n-en.js', 'utf8');
const pares = [...src.matchAll(/^\s*'((?:[^'\\]|\\.)*)':\s*'((?:[^'\\]|\\.)*)',?\s*$/gm)];
const palavras = (s) => (s.toLowerCase().match(/[a-zà-ü]+/g) || []);
const en = new Set(pares.flatMap((p) => palavras(p[2])));
'a an the of to in on at by for and or is are was be it this that with as from not no yes all any per job jobs'.split(' ').forEach((w) => en.add(w));
const pt = new Set(pares.flatMap((p) => palavras(p[1])).filter((w) => w.length >= 2 && !en.has(w)));
const NOMES = /\S+@\S+|Márcia|Antônio|João|José|André|Sebastião|Conceição|Gonçalves|Simões|Araújo|Assunção|Português|KORbuild|Northfield|São Paulo/g;
const ehPt = (l) => { const s = l.replace(NOMES, ''); return /[ãõçâêôáéíóúà]/i.test(s) || palavras(s).some((w) => pt.has(w)); };

const browser = await chromium.launch();
const achados = new Map();
const erros = [];
const todas = new Set();
function anotar(linha, onde) { todas.add(linha); if (!ehPt(linha)) return; const a = achados.get(linha) || new Set(); a.add(onde); achados.set(linha, a); }

async function textos(page) {
  return page.evaluate(() => {
    const l = document.body.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
    const a = [...document.querySelectorAll('[title],[aria-label],[placeholder],option,[data-dica]')]
      .flatMap((el) => [el.getAttribute('title'), el.getAttribute('aria-label'), el.getAttribute('placeholder'), el.tagName === 'OPTION' ? el.textContent.trim() : null, el.getAttribute('data-dica')].filter(Boolean));
    return l.concat(a, [document.title], [...(window.kbtSemTraducao || [])].map((x) => 'SEM TRADUÇÃO: ' + x));
  });
}

async function sessao(usuario, largura, limite) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'], acceptDownloads: true });
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
  await ctx.route(/fonts\.|tile\.openstreetmap|router\.project-osrm|nominatim/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
  page.on('pageerror', (e) => erros.push(usuario + ': ' + e.message));
  page.on('dialog', (d) => { anotar(d.message(), usuario + ' alert'); d.dismiss().catch(() => {}); });
  await page.goto(BASE); await page.waitForSelector('#form-login');
  await page.evaluate((id) => localStorage.setItem('kbt.sessao', id), usuario);
  await page.goto(BASE + '#/inicio'); await page.waitForTimeout(400);
  const inicial = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage))));
  const restaurar = () => page.evaluate((s) => { localStorage.clear(); for (const [k, v] of Object.entries(JSON.parse(s))) localStorage.setItem(k, v); }, inicial);
  const fila = ['#/inicio'], vistas = new Set();
  let cliques = 0;
  while (fila.length && vistas.size < limite) {
    const rota = fila.shift(); if (vistas.has(rota)) continue; vistas.add(rota);
    const onde = usuario + '@' + largura + ' ' + rota;
    await restaurar(); await page.goto('about:blank'); await page.goto(BASE + rota); await page.waitForTimeout(300);
    (await textos(page)).forEach((l) => anotar(l, onde));
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute('href')));
    for (const l of links) {
      if (/\/(\d{4}-\d{2}(-\d{2})?)\/?$/.test(l) && [...vistas, ...fila].some((v) => v.replace(/\d{4}-\d{2}(-\d{2})?/g, '') === l.replace(/\d{4}-\d{2}(-\d{2})?/g, ''))) continue;
      if (/imprimir/.test(l) && [...vistas, ...fila].some((v) => /imprimir/.test(v))) continue;
      if (!vistas.has(l) && !fila.includes(l)) fila.push(l);
    }
    // botões: um por vez, partindo do estado original
    const acoes = await page.evaluate(() => {
      const vist = new Set();
      return [...document.querySelectorAll('button, summary, [role=tab]')].map((b, i) => {
        const chave = (b.dataset.acao || '') + '|' + (b.textContent || '').trim().slice(0, 30);
        if (vist.has(chave) || /sair|recomecar|idioma|imprimir|alternar-internet/.test(b.dataset.acao || '') || b.closest('dialog') || !(b.offsetWidth || b.offsetHeight)) return null;
        vist.add(chave); return i;
      }).filter((i) => i !== null);
    });
    const novas = [];
    for (const i of acoes) {
      const ch = await page.locator('button, summary, [role=tab]').nth(i).evaluate((b) => (b.dataset.acao || '') + '|' + b.textContent.trim().replace(/\d+/g, '#').slice(0, 30)).catch(() => null);
      if (!ch || acoesVistas.has(ch)) continue; acoesVistas.add(ch); novas.push(i);
    }
    for (const i of novas.slice(0, 30)) {
      await restaurar(); await page.goto(BASE + rota); await page.waitForTimeout(200);
      const b = page.locator('button, summary, [role=tab]').nth(i);
      try {
        const nome = await b.getAttribute('data-acao');
        if (!(await b.isVisible())) continue;
        await b.click({ timeout: 1500 }); cliques++;
        await page.waitForTimeout(250);
        (await textos(page)).forEach((l) => anotar(l, onde + ' ⟶ ' + nome));
        // dentro de um diálogo, tenta o botão principal sem preencher nada (mensagens de validação)
        const dlg = page.locator('dialog[open]');
        if (await dlg.count()) {
          const ok = dlg.locator('button[value="true"], button[type="submit"]').last();
          if (await ok.count() && await ok.isVisible()) { await ok.click({ timeout: 1000 }).catch(() => {}); await page.waitForTimeout(200); (await textos(page)).forEach((l) => anotar(l, onde + ' ⟶ ' + nome + ' ⟶ ok')); }
        }
      } catch (e) { /* botão que some ou navega */ }
      if (!page.url().includes(rota)) { const r = '#' + page.url().split('#')[1]; if (r && !vistas.has(r) && !fila.includes(r) && !/\d{4}-\d{2}/.test(r)) fila.push(r); }
    }
  }
  await ctx.close();
  console.log(usuario + '@' + largura + ': ' + vistas.size + ' telas, ' + cliques + ' cliques');
}

await sessao(U, Number(W), Number(LIM));
await browser.close();
const linhas = [...achados].map(([l, o]) => l.slice(0, 200) + '\n      ← ' + [...o].slice(0, 2).join(' | ') + (o.size > 2 ? ' (+' + (o.size - 2) + ')' : ''));
fs.writeFileSync(OUT + '.todas', [...todas].join('\n'));
fs.writeFileSync(OUT, 'ERROS JS:\n' + [...new Set(erros)].join('\n') + '\n\nACHADOS (' + achados.size + '):\n' + linhas.join('\n') + '\n');
console.log(achados.size + ' linhas em português; ' + erros.length + ' erros JS');
