/* KORbuild — as fotos de exemplo da massa de demonstração: as mesmas cenas desenhadas do protótipo (js/fotos.js › fotoDeExemplo),
 * feitas no Chromium do Playwright (o Node puro não desenha imagens). Sobe um servidorzinho local só para servir os arquivos do projeto. */

import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const RAIZ = new URL('../../', import.meta.url).pathname;
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };

export async function iniciarFotos() {
  const servidor = createServer((req, res) => {
    const caminho = normalize(join(RAIZ, decodeURIComponent(new URL(req.url, 'http://x').pathname)));
    if (!caminho.startsWith(RAIZ) || !existsSync(caminho) || !statSync(caminho).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': TIPOS[extname(caminho)] || 'application/octet-stream' });
    res.end(readFileSync(caminho));
  });
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = 'http://127.0.0.1:' + servidor.address().port + '/';
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'en'); } catch { /* */ } });
  const pagina = await ctx.newPage();
  await pagina.goto(base + 'manifest.json').catch(() => {});
  return {
    /** { cena, obraNome, lat, lon, quando (ms), semente } → { foto: Buffer, mini: Buffer, largura, altura, hash } */
    async gerar({ cena, obraNome, lat, lon, quando, semente }) {
      const r = await pagina.evaluate(async ([endereco, args]) => {
        const m = await import(endereco + 'js/fotos.js');
        const x = await m.fotoDeExemplo({ cena: args.cena, obra: { nome: args.obraNome, lat: args.lat, lon: args.lon }, quando: args.quando, semente: args.semente });
        const b64 = (blob) => new Promise((ok) => { const f = new FileReader(); f.onload = () => ok(String(f.result).split(',')[1]); f.readAsDataURL(blob); });
        return { foto: await b64(x.blob), mini: await b64(x.mini), largura: x.largura, altura: x.altura };
      }, [base, { cena, obraNome, lat, lon, quando, semente }]);
      const foto = Buffer.from(r.foto, 'base64');
      return { foto, mini: Buffer.from(r.mini, 'base64'), largura: r.largura, altura: r.altura, hash: createHash('sha256').update(foto).digest('hex') };
    },
    async fechar() { await browser.close(); servidor.close(); },
  };
}
