/* KORbuild — gera os ícones do app (icons/*.png) a partir do símbolo K aprovado (docs/guia-da-marca.md): quadrado laranja, K branco com a diagonal em grafite.
 * Uso: node tools/gerar-icones.mjs   (usa o Chromium do Playwright; sobrescreve icons/icon-192.png, icon-512.png, apple-touch-icon.png e maskable-512.png) */
import { chromium } from 'playwright';

const K = (cor) => `<path d="M8 4h24v92H8z" fill="${cor.haste}"/><path d="M32 50L66 4h30L52 62l-20 6z" fill="${cor.haste}"/><path d="M32 68l20-6 44 34H66L32 72z" fill="${cor.baixo}"/><path d="M52 62l20 16-32-2z" fill="${cor.dobra}"/>`;
const ICONE = { haste: '#FFFFFF', baixo: '#FFFFFF', dobra: '#FBD2B8' };   // sobre o laranja, o K inteiro é branco
/* o K ocupa uma fração do quadrado e fica centralizado (o desenho vai de x 8 a 96 e de y 4 a 96) */
function svg(tamanho, { raio, fracao }) {
  const lado = 100 * fracao, off = (100 - lado) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${tamanho}" height="${tamanho}" viewBox="0 0 100 100"><rect width="100" height="100" rx="${raio}" fill="#F26A1B"/><g transform="translate(${off + (lado * 0.0)} ${off}) scale(${fracao})"><g transform="translate(${(100 - 88) / 2 - 8 + 0} 0)">${K(ICONE)}</g></g></svg>`;
}
const SAIDAS = [
  ['icons/icon-192.png', 192, { raio: 22, fracao: 0.62 }],
  ['icons/icon-512.png', 512, { raio: 22, fracao: 0.62 }],
  ['icons/apple-touch-icon.png', 180, { raio: 0, fracao: 0.62 }],     // o iOS arredonda sozinho
  ['icons/maskable-512.png', 512, { raio: 0, fracao: 0.5 }],          // zona segura das máscaras do Android
];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
for (const [arquivo, tamanho, o] of SAIDAS) {
  const p = await browser.newPage({ viewport: { width: tamanho, height: tamanho }, deviceScaleFactor: 1 });
  await p.setContent('<body style="margin:0;background:transparent">' + svg(tamanho, o) + '</body>');
  await p.screenshot({ path: arquivo, omitBackground: true, clip: { x: 0, y: 0, width: tamanho, height: tamanho } });
  await p.close();
  console.log('gerado ' + arquivo);
}
await browser.close();
