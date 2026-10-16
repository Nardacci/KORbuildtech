/* KORbuild — sonda do WebKit (Safari): o que acontece na abertura do app e o que o navegador deixa guardar.
 * Mostra, para cada tipo de contexto (efêmero, como o dos testes, e com perfil persistente, como o de um Safari normal):
 *  · se #form-login (protótipo) e #oficial-email (conta de verdade) aparecem, e os erros de console/página da abertura;
 *  · localStorage e IndexedDB: gravar texto, ArrayBuffer e Blob (o app guarda fotos como Blob).
 * Uso: node tools/sonda-webkit.mjs [http://localhost:8123/]      (o servidor local precisa estar no ar: python -m http.server 8123)
 * Só lê; nada vai para o banco. Instalar uma vez: npx playwright install webkit */

import { webkit, devices } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const aparelho = devices['iPhone 15'];

async function armazenamento(page) {
  return page.evaluate(async () => {
    const r = {};
    try { localStorage.setItem('kbt.sonda', 'x'); r.localStorage = localStorage.getItem('kbt.sonda') === 'x' ? 'ok' : 'não leu'; localStorage.removeItem('kbt.sonda'); } catch (e) { r.localStorage = 'ERRO ' + e.name + ': ' + e.message; }
    const idb = (valor, nome) => new Promise((ok) => {
      let req; try { req = indexedDB.open('kbt-sonda-' + nome, 1); } catch (e) { ok('ERRO ao abrir: ' + e.name + ': ' + e.message); return; }
      req.onupgradeneeded = () => req.result.createObjectStore('t');
      req.onerror = () => ok('ERRO ao abrir: ' + (req.error && (req.error.name + ': ' + req.error.message)));
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction('t', 'readwrite'); tx.objectStore('t').put(valor, 'a');
          tx.oncomplete = () => { db.close(); indexedDB.deleteDatabase('kbt-sonda-' + nome); ok('ok'); };
          tx.onerror = () => { db.close(); ok('ERRO ao gravar: ' + (tx.error && (tx.error.name + ': ' + tx.error.message))); };
          tx.onabort = () => { db.close(); ok('ABORTOU: ' + (tx.error && (tx.error.name + ': ' + tx.error.message))); };
        } catch (e) { db.close(); ok('ERRO: ' + e.name + ': ' + e.message); }
      };
    });
    r.indexedDB_texto = await idb('texto', 'texto');
    r.indexedDB_arraybuffer = await idb(new Uint8Array([1, 2, 3]).buffer, 'ab');
    r.indexedDB_blob = await idb(new Blob(['teste'], { type: 'image/jpeg' }), 'blob');
    r.storage_persisted = navigator.storage && navigator.storage.persisted ? String(await navigator.storage.persisted()) : 'indisponível';
    r.userAgent = navigator.userAgent;
    return r;
  });
}

async function abrir(page, caminho, seletor) {
  const eventos = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) eventos.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => eventos.push('PAGEERROR: ' + String(e).slice(0, 300)));
  page.on('requestfailed', (r) => eventos.push('REQUEST FALHOU: ' + r.url().slice(0, 120) + ' ' + (r.failure() && r.failure().errorText)));
  const t0 = Date.now();
  await page.goto(BASE + caminho, { waitUntil: 'load' });
  let apareceu = true;
  try { await page.waitForSelector(seletor, { timeout: 12000 }); } catch { apareceu = false; }
  return { caminho, seletor, apareceu, ms: Date.now() - t0, corpo: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 120), eventos: eventos.slice(0, 12) };
}

async function sondar(nome, criar) {
  console.log('\n===== ' + nome + ' =====');
  const { page, fechar } = await criar();
  try {
    console.log(JSON.stringify(await armazenamento(page), null, 2));
    for (const [caminho, seletor] of [['?demo', '#form-login'], ['', '#form-login-oficial, #oficial-email']]) {
      const p = await (page.context().newPage());
      console.log(JSON.stringify(await abrir(p, caminho, seletor), null, 2));
      await p.close();
    }
  } finally { await fechar(); }
}

const sem = { serviceWorkers: 'block' };
await sondar('Contexto efêmero (como os testes automáticos), iPhone 15', async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...aparelho, ...sem });
  const page = await ctx.newPage(); await page.goto(BASE + 'diagnostico.html');
  return { page, fechar: () => browser.close() };
});
await sondar('Contexto efêmero, com service worker liberado', async () => {
  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...aparelho });
  const page = await ctx.newPage(); await page.goto(BASE + 'diagnostico.html');
  return { page, fechar: () => browser.close() };
});
await sondar('Perfil persistente (como um Safari normal, fora de aba privada)', async () => {
  const pasta = mkdtempSync(join(tmpdir(), 'kb-webkit-'));
  const ctx = await webkit.launchPersistentContext(pasta, { ...aparelho, ...sem });
  const page = await ctx.newPage(); await page.goto(BASE + 'diagnostico.html');
  return { page, fechar: async () => { await ctx.close(); rmSync(pasta, { recursive: true, force: true }); } };
});
console.log('\nPronto. Mande esta saída inteira.');
