/* KORbuild Measure — testes do motor de fórmulas (sem navegador).
 * Uso: node tests/formulas.test.mjs */
import { createRequire } from 'node:module';
import { usarMath, analisar, calcular, calcularLinha, validar, arredondar, VARIAVEIS } from '../js/formulas.js';

const require = createRequire(import.meta.url);
usarMath(require('../vendor/mathjs/math.min.js'));

let passos = 0, falhas = 0;
function verificar(cond, texto) { passos++; if (cond) console.log('  ok  ' + texto); else { falhas++; console.log('FALHA ' + texto); } }
const perto = (a, b) => Math.abs(a - b) < 1e-9;

console.log('Fórmulas aceitas');
verificar(perto(calcular('MeasuredArea / 32', 'area', { MeasuredArea: 1224 }).valor, 38.25), 'MeasuredArea / 32 com 1.224 sq ft = 38,25 chapas');
verificar(perto(calcular('MeasuredLinear * 12 / 16', 'linear', { MeasuredLinear: 136 }).valor, 102), 'montantes a cada 16": 136 lin ft → 102');
verificar(perto(calcular('ceil(MeasuredArea / 20)', 'area', { MeasuredArea: 1005 }).valor, 51), 'funções da lista (ceil)');
verificar(perto(calcular('2 MeasuredCount + 1', 'contagem', { MeasuredCount: 3 }).valor, 7), 'multiplicação implícita (2 MeasuredCount)');
verificar(perto(calcular('max(MeasuredLinear, 10) ^ 2', 'linear', { MeasuredLinear: 4 }).valor, 100), 'max e potência');
verificar(perto(calcular('SurfaceArea * PitchFactor', 'linear', { SurfaceArea: 100, PitchFactor: 1.25 }).valor, 125), 'várias variáveis');

console.log('Fórmulas recusadas (segurança e clareza)');
const recusar = [
  ['import({}, {override: true})', 'area', 'import'],
  ['evaluate("1+1")', 'area', 'evaluate'],
  ['MeasuredArea = 5', 'area', 'atribuição'],
  ['f(x) = x * 2', 'area', 'função nova'],
  ['5 ft', 'area', 'unidade da mathjs (5 ft)'],
  ['"texto"', 'area', 'texto'],
  ['[1, 2, 3]', 'area', 'matriz'],
  ['cos(MeasuredArea)', 'area', 'função fora da lista'],
  ['MeasuredArea % 3', 'area', 'operador fora da lista'],
  ['MeasuredLinear / 32', 'area', 'variável de outro tipo de condição'],
  ['Banana * 2', 'area', 'variável desconhecida'],
  ['MeasuredArea > 3 ? 1 : 2', 'area', 'condicional'],
  ['', 'area', 'vazia'],
  ['(', 'area', 'sintaxe inválida'],
];
for (const [f, tipo, nome] of recusar) verificar(!!analisar(f, tipo).erro, 'recusa ' + nome + ': ' + JSON.stringify(f));
verificar(/SurfaceArea \(altura\)/.test(calcular('SurfaceArea / 32', 'linear', { MeasuredLinear: 100 }).erro || ''), 'falta de variável diz o que preencher na condição (altura)');
verificar(!!calcular('MeasuredArea / 0', 'area', { MeasuredArea: 10 }).erro, 'divisão por zero vira erro, não Infinity');
verificar(!!calcular('0 - MeasuredArea', 'area', { MeasuredArea: 10 }).erro, 'resultado negativo vira erro');

console.log('Perda e arredondamento (campos da linha, fora da fórmula)');
let r = calcularLinha({ formula: 'SurfaceArea / 32', perda: 10, passo: 1 }, 'linear', { SurfaceArea: 1224 });
verificar(perto(r.bruta, 38.25) && perto(r.comPerda, 42.075) && r.final === 43, 'OSB: 1.224 ÷ 32 = 38,25 → +10% = 42,075 → 43 chapas');
r = calcularLinha({ formula: 'MeasuredArea / 32', perda: 10, passo: 1 }, 'area', { MeasuredArea: 10000 });
verificar(r.final === 344, 'exemplo da revisão: 10.000 ÷ 32 = 312,5 → +10% = 343,75 → 344 chapas');
r = calcularLinha({ formula: 'VolumeCY', perda: 5, passo: 0.5 }, 'area', { VolumeCY: 13.827 });
verificar(perto(r.final, 15), 'concreto arredondado de meia em meia jarda: 13,83 → +5% = 14,52 → 15 cu yd');
r = calcularLinha({ formula: 'MeasuredArea * 0.03', perda: 0, passo: 0 }, 'area', { MeasuredArea: 1005 });
verificar(perto(r.final, 30.15), 'mão de obra sem arredondar: 1.005 × 0,03 = 30,15 h');
verificar(arredondar(43.0000000001, 1) === 43 && arredondar(42.0001, 1) === 43, 'arredondar para cima sem erro de ponto flutuante');

console.log('Validação ao salvar');
verificar(validar('SurfaceArea / 32', 'linear').ok && perto(validar('SurfaceArea / 32', 'linear').teste, 900 / 32), 'valida com valores de teste');
verificar(!!validar('MeasuredLinear / (WallHeight - 9)', 'linear').erro, 'pega divisão por zero nos valores de teste');
verificar(VARIAVEIS.every((v) => v.unidade && v.descricao), 'toda variável tem unidade e descrição (ajuda na tela)');

console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
