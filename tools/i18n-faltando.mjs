/* KORbuild — lista as frases marcadas com t()/tn() que ainda não têm inglês em js/i18n-en.js.
 * Uso: node tools/i18n-faltando.mjs [arquivo.js ...]   (sem arquivos: todos de js/) */
import { readFileSync, readdirSync } from 'node:fs';
import { EN } from '../js/i18n-en.js';

const arquivos = process.argv.slice(2).length ? process.argv.slice(2)
  : readdirSync('js').filter((f) => f.endsWith('.js') && !f.startsWith('i18n')).map((f) => 'js/' + f);
const LIT = "'((?:\\\\.|[^'\\\\])*)'";
const reT = new RegExp('\\btr\\(\\s*' + LIT, 'g');
const reTn = new RegExp('\\btn\\([^,]+,\\s*' + LIT + '\\s*,\\s*' + LIT, 'g');
const des = (s) => s.replace(/\\(.)/g, '$1');
const faltando = new Map();
for (const arq of arquivos) {
  const src = readFileSync(arq, 'utf8');
  const chaves = [];
  for (const m of src.matchAll(reT)) chaves.push(des(m[1]));
  for (const m of src.matchAll(reTn)) chaves.push(des(m[1]), des(m[2]));
  for (const c of chaves) if (!(c in EN) && !faltando.has(c)) faltando.set(c, arq);
}
for (const [c, arq] of faltando) console.log(JSON.stringify(c) + '  // ' + arq);
console.error(faltando.size + ' frases sem inglês');
