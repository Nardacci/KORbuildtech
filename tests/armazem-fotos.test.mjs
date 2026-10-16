/* KORbuild — teste do cofre de fotos do aparelho (js/armazem.js), com os jeitos de o iPhone falhar:
 *  · normal: a foto vai para o IndexedDB como bytes, volta como Blob, sobrevive a recarregar a página e as fotos antigas (guardadas como Blob) ainda leem;
 *  · "Safari em aba privada": o navegador aborta, sem dizer o motivo, a gravação de um Blob (o WebKit dos testes se comporta assim) → o app abre e a foto grava como bytes;
 *  · banco que recusa tudo (sem espaço): o cofre cai para a memória, o app abre e as fotos aparecem até fechar;
 *  · a partida que falha por qualquer motivo mostra uma mensagem com o diagnóstico, em vez de "carregando" para sempre.
 * Os dois casos de falha são simulados no Chromium (e acontecem de verdade no WebKit efêmero). Sem banco: usa o protótipo (?demo).
 * Uso: node tests/armazem-fotos.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 500)) : '')); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
/* modo: 'normal' · 'blob' (aborta a gravação de Blob, como o Safari em aba privada) · 'tudo' (aborta toda gravação) · 'partida' (a criação da demonstração falha) */
async function abrirDemo(modo, ctx = null) {
  const c = ctx || await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await c.addInitScript((m) => {
    try { localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ }
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (valor, chave) {
      if (m === 'tudo' || (m === 'blob' && valor instanceof Blob)) { this.transaction.abort(); return {}; }   // sem mensagem de erro, como o Safari
      return put.call(this, valor, chave);
    };
    if (m === 'partida') crypto.subtle.digest = () => Promise.reject(new Error('falha de teste na partida'));
  }, modo);
  await c.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
  const p = await c.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(String(e).slice(0, 160)));
  await p.goto(BASE + '?demo');
  return { c, p, erros };
}
const arm = (p, fn, arg) => p.evaluate(async ([codigo, x]) => {
  const a = await import('./js/armazem.js');
  return (0, eval)('(' + codigo + ')')(a, x);
}, [fn.toString(), arg]);
// as funções acima rodam no navegador por eval: este teste roda sem CSP de propósito (a CSP é medida nos testes de tela)

console.log('Normal');
{
  const { c, p, erros } = await abrirDemo('normal');
  const c2 = c;
  await p.waitForSelector('#form-login', { timeout: 40000 });
  verificar(true, 'a demonstração abre e mostra o login');
  const r = await arm(p, async (a) => {
    const jpeg = new Blob([new Uint8Array([255, 216, 255, 224, 1, 2, 3, 4])], { type: 'image/jpeg' });
    const mini = new Blob([new Uint8Array([255, 216, 9])], { type: 'image/jpeg' });
    await a.guardarFoto('t-normal', jpeg, mini);
    const l = await a.lerFoto('t-normal'), lm = await a.lerFoto(a.idMiniatura('t-normal'));
    // o que está de fato no banco: bytes, não Blob
    const cru = await new Promise((ok) => { const q = indexedDB.open('kbt-rdo-fotos', 1); q.onsuccess = () => { const g = q.result.transaction('fotos').objectStore('fotos').get('t-normal'); g.onsuccess = () => { ok({ ehBlob: g.result instanceof Blob, temBytes: g.result && g.result.bytes instanceof ArrayBuffer, tipo: g.result && g.result.tipo }); q.result.close(); }; }; });
    // uma foto antiga, guardada como Blob (formato anterior)
    await new Promise((ok) => { const q = indexedDB.open('kbt-rdo-fotos', 1); q.onsuccess = () => { const t = q.result.transaction('fotos', 'readwrite'); t.objectStore('fotos').put(new Blob(['antiga'], { type: 'image/png' }), 't-antiga'); t.oncomplete = () => { q.result.close(); ok(); }; }; });
    const antiga = await a.lerFoto('t-antiga');
    return { cofre: a.cofreDasFotos(), eBlob: l instanceof Blob, tipo: l.type, tam: l.size, miniTam: lm.size, cru, antigaTipo: antiga && antiga.type, antigaTam: antiga && antiga.size };
  });
  verificar(r.cofre === 'banco' && r.eBlob && r.tipo === 'image/jpeg' && r.tam === 8 && r.miniTam === 3, 'a foto e a miniatura gravam e voltam como Blob do mesmo tipo e tamanho', r);
  verificar(!r.cru.ehBlob && r.cru.temBytes && r.cru.tipo === 'image/jpeg', 'no banco a foto fica como bytes (e não como Blob)', r.cru);
  verificar(r.antigaTipo === 'image/png' && r.antigaTam === 6, 'uma foto antiga, guardada como Blob, continua lendo', r);
  await p.reload();
  await p.waitForSelector('#form-login', { timeout: 40000 });
  const depois = await arm(p, async (a) => { const l = await a.lerFoto('t-normal'); return l ? { tipo: l.type, tam: l.size } : null; });
  verificar(depois && depois.tam === 8 && depois.tipo === 'image/jpeg', 'a foto sobrevive a recarregar a página', depois);
  await arm(p, async (a) => { await a.apagarFoto('t-normal'); });
  verificar((await arm(p, async (a) => (await a.lerFoto('t-normal')) === undefined)) === true, 'apagar a foto tira do banco');
  verificar(!erros.length, 'nenhum erro de página na partida', erros);
  await c2.close();
}

console.log('\nSafari em aba privada (a gravação de Blob é cancelada sem mensagem)');
{
  const { c, p, erros } = await abrirDemo('blob');
  await p.waitForSelector('#form-login', { timeout: 40000 });
  verificar(true, 'a demonstração abre (antes ficava em "Preparando a demonstração…" para sempre)');
  const r = await arm(p, async (a) => {
    await a.guardarFoto('t-priv', new Blob([new Uint8Array([1, 2, 3, 4, 5])], { type: 'image/jpeg' }));
    const l = await a.lerFoto('t-priv');
    return { cofre: a.cofreDasFotos(), tam: l && l.size };
  });
  verificar(r.cofre === 'banco' && r.tam === 5, 'a foto grava no banco do aparelho do mesmo jeito (como bytes)', r);
  verificar(!erros.length, 'nenhum erro de página', erros);
  await c.close();
}

console.log('\nO aparelho recusa toda gravação no banco (sem espaço)');
{
  const { c, p, erros } = await abrirDemo('tudo');
  await p.waitForSelector('#form-login', { timeout: 40000 });
  verificar(true, 'a demonstração abre mesmo sem conseguir gravar no banco do aparelho');
  const r = await arm(p, async (a) => {
    await a.guardarFoto('t-mem', new Blob([new Uint8Array([7, 7, 7])], { type: 'image/jpeg' }), new Blob([new Uint8Array([7])], { type: 'image/jpeg' }));
    const l = await a.lerFoto('t-mem');
    const url = await a.urlDaFoto('t-mem');
    const resp = url ? await fetch(url) : null;
    return { cofre: a.cofreDasFotos(), tam: l && l.size, urlOk: !!url && resp && (await resp.blob()).size === 3 };
  });
  verificar(r.cofre === 'memoria' && r.tam === 3 && r.urlOk, 'o cofre cai para a memória e a foto continua aparecendo', r);
  await arm(p, async (a) => { await a.apagarFoto('t-mem'); });
  verificar((await arm(p, async (a) => (await a.lerFoto('t-mem')) === undefined)) === true, 'apagar tira da memória');
  verificar(!erros.some((e) => !/Unhandled Promise Rejection: null/.test(e)) || !erros.length, 'sem erro de página inesperado', erros);
  await c.close();
}

console.log('\nA partida falha por outro motivo');
{
  const { c, p } = await abrirDemo('partida');
  await p.waitForSelector('.carregando [data-recarregar]', { timeout: 40000 });
  const texto = await p.locator('.carregando').innerText();
  verificar(/Não foi possível abrir o KORbuild neste aparelho/.test(texto), 'em vez de "carregando" para sempre, a pessoa vê que não abriu', texto.slice(0, 120));
  verificar(await p.locator('.carregando a[href="diagnostico.html"]').count() === 1, 'e tem o caminho para o diagnóstico do aparelho');
  const nav = p.waitForNavigation({ timeout: 15000 }).then(() => true, () => false);
  await p.click('[data-recarregar]');
  verificar(await nav, 'o botão "Tentar de novo" recarrega a página (sem manipulador inline: a CSP não o bloqueia)');
  await c.close();
}

await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
