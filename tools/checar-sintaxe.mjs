/* Confere a sintaxe de todos os módulos de js/ (node --check não acusa erro em módulos aqui). */
import { readdirSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
let erros = 0;
for (const f of readdirSync('js').filter((x) => x.endsWith('.js'))) {
  try { new vm.SourceTextModule(readFileSync('js/' + f, 'utf8'), { identifier: f }); } catch (e) { erros++; console.log('ERRO js/' + f + ': ' + e.message); }
}
console.log(erros ? erros + ' arquivo(s) com erro' : 'sintaxe ok');
process.exit(erros ? 1 : 0);
