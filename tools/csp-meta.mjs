/* KORbuild — liga ou desliga a política de conteúdo (CSP) nas páginas do app (index.html e admin.html), com a política de tests/_csp.mjs.
 * O GitHub Pages não deixa mandar cabeçalho (nem Report-Only), então a política vai numa <meta http-equiv="Content-Security-Policy">.
 * Antes de ligar: a medição KOR_CSP=relatorio (tests/_csp.mjs) precisa estar com zero violações; depois de ligar, rode os testes de navegador de novo.
 * Também sobe a versão do cache do service worker, para os aparelhos pegarem a página nova.
 * Uso: node tools/csp-meta.mjs --ligar | --desligar | --status */

import { readFileSync, writeFileSync } from 'node:fs';
import { POLITICA } from '../tests/_csp.mjs';

const PAGINAS = ['index.html', 'admin.html'];
const INICIO = '<!-- csp:inicio -->', FIM = '<!-- csp:fim -->';
const acao = process.argv[2];
if (!['--ligar', '--desligar', '--status'].includes(acao)) { console.error('Uso: node tools/csp-meta.mjs --ligar | --desligar | --status'); process.exit(2); }
const bloco = INICIO + '\n<meta http-equiv="Content-Security-Policy" content="' + POLITICA.replace(/"/g, '&quot;') + '">\n' + FIM + '\n';
const re = new RegExp('\\n?' + INICIO + '[\\s\\S]*?' + FIM + '\\n?');
let mudou = false;
for (const f of PAGINAS) {
  const caminho = new URL('../' + f, import.meta.url);
  let h = readFileSync(caminho, 'utf8');
  const ligada = h.includes(INICIO);
  if (acao === '--status') { console.log(f + ': ' + (ligada ? 'CSP ligada' : 'CSP desligada')); continue; }
  if (acao === '--desligar') { if (ligada) { h = h.replace(re, '\n'); mudou = true; } }
  else {
    h = ligada ? h.replace(re, '\n' + bloco) : h.replace(/(<meta charset[^>]*>\s*\n?)/i, '$1' + bloco);
    if (!h.includes(INICIO)) { console.error(f + ': não achei <meta charset> para ancorar a política.'); process.exit(1); }
    mudou = true;
  }
  writeFileSync(caminho, h);
  console.log(f + ': ' + (acao === '--ligar' ? 'CSP ligada' : 'CSP desligada'));
}
if (mudou) {
  const sw = new URL('../sw.js', import.meta.url);
  const s = readFileSync(sw, 'utf8');
  const novo = s.replace(/(korbuild-v)(\d+)/, (_, p, n) => p + (Number(n) + 1));
  writeFileSync(sw, novo);
  console.log('sw.js: ' + (s.match(/korbuild-v\d+/) || [''])[0] + ' → ' + (novo.match(/korbuild-v\d+/) || [''])[0]);
}
