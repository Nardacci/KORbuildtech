/* KORbuild — as fotos de exemplo da massa de demonstração: as mesmas cenas desenhadas do protótipo (js/fotos.js › fotoDeExemplo),
 * feitas no Chromium do Playwright (o Node puro não desenha imagens). Sobe um servidorzinho local só para servir os arquivos do projeto. */

import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { servirProjeto } from './servidor.mjs';

export async function iniciarFotos() {
  const servidor = await servirProjeto();
  const base = servidor.base;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'en'); } catch { /* */ } });
  const pagina = await ctx.newPage();
  await pagina.goto(base + 'js/config.js');   // uma página qualquer da mesma origem, para importar os módulos
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
    async fechar() { await browser.close(); servidor.fechar(); },
  };
}
