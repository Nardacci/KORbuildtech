/* KORbuild Measure — testes do tradutor imperial (sem navegador).
 * Uso: node tests/imperial.test.mjs */
import {
  formatarPesPolegadas, interpretarComprimento, interpretarInclinacao, fatorInclinacao, formatarInclinacao,
  areaPoligono, comprimento, polPorPontoDaEscala, pesQuadrados, jardasCubicas,
} from '../js/imperial.js';

let passos = 0, falhas = 0;
function igual(obtido, esperado, texto) {
  passos++;
  const ok = typeof esperado === 'number' ? Math.abs(obtido - esperado) < 1e-9 : obtido === esperado;
  if (ok) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + ': esperado ' + JSON.stringify(esperado) + ', veio ' + JSON.stringify(obtido)); }
}

console.log('Saída (polegadas → texto)');
igual(formatarPesPolegadas(150.5), "12'-6 1/2\"", '150,5 pol → 12\'-6 1/2"');
igual(formatarPesPolegadas(126), "10'-6\"", '126 pol → 10\'-6"');
igual(formatarPesPolegadas(144), "12'-0\"", '144 pol → 12\'-0"');
igual(formatarPesPolegadas(144.5), "12'-0 1/2\"", '144,5 pol → 12\'-0 1/2"');
igual(formatarPesPolegadas(6.5), '6 1/2"', '6,5 pol → 6 1/2"');
igual(formatarPesPolegadas(0.5), '1/2"', '0,5 pol → 1/2"');
igual(formatarPesPolegadas(0), '0"', 'zero');
igual(formatarPesPolegadas(143.99), "12'-0\"", 'arredonda para 1/16: 143,99 → 12\'-0" (sem 11\'-12")');
igual(formatarPesPolegadas(10.0625), '10 1/16"', '1/16 exato');
igual(formatarPesPolegadas(10.05, 8), '10"', 'arredondamento para 1/8');
igual(formatarPesPolegadas(-30), "-2'-6\"", 'negativo');

console.log('Entrada (texto → polegadas)');
const casos = [
  ["12'-6 1/2\"", 150.5], ["12' 6.5\"", 150.5], ["12'6\"", 150], ["12'", 144], ['6"', 6], ['6 1/2"', 6.5], ['1/2"', 0.5],
  ['150"', 150], ["12.5'", 150], ['12ft 6in', 150], ['12 ft 6 1/2 in', 150.5], ['12-6', 150], ['12-6-1/2', 150.5],
  ['10\'-6"', 126], ['12', 144], ["12′-6″", 150], ["12' - 6 1/2\"", 150.5], ['12,5\'', 150],
];
for (const [t, v] of casos) igual(interpretarComprimento(t).pol, v, '"' + t + '" → ' + v + ' pol');
igual(interpretarComprimento('6', 'pol').pol, 6, 'número sem unidade como polegadas, quando pedido');
igual(!!interpretarComprimento("12'-14\"").erro, true, 'recusa 12\'-14" (polegadas ≥ 12 com pés)');
igual(!!interpretarComprimento('abc').erro, true, 'recusa texto sem medida');
igual(!!interpretarComprimento('1/0"').erro, true, 'recusa fração com zero no denominador');
igual(!!interpretarComprimento('').erro, true, 'recusa vazio');
for (const v of [150.5, 126, 7.0625, 1234.75]) igual(interpretarComprimento(formatarPesPolegadas(v)).pol, v, 'ida e volta: ' + v + ' → ' + formatarPesPolegadas(v));

console.log('Inclinação');
igual(interpretarInclinacao('6/12').razao, 0.5, '6/12 → 0,5');
igual(interpretarInclinacao('8:12').razao, 8 / 12, '8:12');
igual(interpretarInclinacao('4').razao, 4 / 12, '"4" = 4/12');
igual(Math.round(fatorInclinacao(0.5) * 1000) / 1000, 1.118, 'fator de 6/12 = 1,118');
igual(formatarInclinacao(0.5), '6/12', '0,5 → 6/12');

console.log('Geometria e escala');
igual(areaPoligono([[0, 0], [720, 0], [720, 504], [0, 504]]), 362880, 'Shoelace: retângulo');
igual(areaPoligono([[0, 0], [0, 504], [720, 504], [720, 0]]), 362880, 'Shoelace: sentido horário dá o mesmo');
igual(areaPoligono([[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]]), 12, 'Shoelace: polígono em L');
igual(comprimento([[0, 0], [3, 4], [3, 10]]), 11, 'comprimento de linha com vértices');
const k = polPorPontoDaEscala(48); // 1/4" = 1'-0"
igual(720 * k, 480, '1/4" = 1\'-0": 720 points de papel = 480 pol = 40\'');
igual(pesQuadrados(areaPoligono([[0, 0], [720, 0], [720, 504], [0, 504]]) * k * k), 1120, 'casa 40\' × 28\' = 1.120 sq ft');
igual(jardasCubicas(27 * 1728), 1, '27 cu ft = 1 cu yd');

console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
