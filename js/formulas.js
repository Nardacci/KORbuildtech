/* KORbuild Measure — motor de fórmulas (docs/measure-revisao.md §1.6 e §3).
 *
 *  - Usa a mathjs (Apache 2.0, em vendor/mathjs), nunca eval().
 *  - Restrita: as funções perigosas da mathjs são desligadas (import, createUnit, evaluate, parse…),
 *    e toda fórmula passa por uma lista branca: números, + − × ÷ ^, parênteses, as variáveis da
 *    condição e as funções ceil, floor, round, min, max, sqrt, abs. Atribuição, função nova,
 *    unidade ("5 ft"), texto, matriz e qualquer outra coisa são recusados.
 *  - Perda e arredondamento NÃO ficam escondidos na fórmula: são campos da linha do assembly
 *    (a tela mostra o cálculo inteiro: bruta → +perda → arredondada).
 *  - Variáveis em unidades do ofício (lin ft, sq ft, cu yd), com nomes em inglês, o vocabulário do
 *    estimador americano (MeasuredArea, WallHeight…). */

let M = null;
let parseOriginal = null;

/* Prepara a mathjs restrita. No navegador, carregarMotor(); nos testes (Node), usarMath(require(...)). */
export function usarMath(math) {
  const m = math.create(math.all, { number: 'number' });
  parseOriginal = m.parse;
  const bloqueada = (nome) => function () { throw new Error('Função não permitida: ' + nome); };
  m.import({
    import: bloqueada('import'), createUnit: bloqueada('createUnit'), evaluate: bloqueada('evaluate'),
    parse: bloqueada('parse'), simplify: bloqueada('simplify'), derivative: bloqueada('derivative'),
    resolve: bloqueada('resolve'), reviver: bloqueada('reviver'),
  }, { override: true });
  M = m;
}
export function motorPronto() { return !!M; }

let carregando = null;
export function carregarMotor() {
  if (M) return Promise.resolve();
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'vendor/mathjs/math.min.js';
      s.onload = () => { usarMath(window.math); ok(); };
      s.onerror = () => { carregando = null; falha(new Error('Motor de fórmulas indisponível')); };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

/* ---------- Variáveis ---------- */

/* Catálogo das variáveis que o takeoff entrega ao motor, por tipo de condição. */
export const VARIAVEIS = [
  { nome: 'MeasuredLinear', unidade: 'lin ft', tipos: ['linear'], descricao: 'Comprimento medido' },
  { nome: 'WallHeight', unidade: 'ft', tipos: ['linear'], descricao: 'Altura da condição', requer: 'altura' },
  { nome: 'SurfaceArea', unidade: 'sq ft', tipos: ['linear'], descricao: 'Comprimento × altura (superfície da parede)', requer: 'altura' },
  { nome: 'MeasuredArea', unidade: 'sq ft', tipos: ['area'], descricao: 'Área medida (já sem os descontos)' },
  { nome: 'Thickness', unidade: 'in', tipos: ['area'], descricao: 'Espessura da condição', requer: 'espessura' },
  { nome: 'VolumeCF', unidade: 'cu ft', tipos: ['area'], descricao: 'Área × espessura', requer: 'espessura' },
  { nome: 'VolumeCY', unidade: 'cu yd', tipos: ['area'], descricao: 'Área × espessura, em jardas cúbicas', requer: 'espessura' },
  { nome: 'RoofPitch', unidade: 'in/12', tipos: ['linear', 'area'], descricao: 'Inclinação (6 = 6/12)', requer: 'inclinação' },
  { nome: 'PitchFactor', unidade: '×', tipos: ['linear', 'area'], descricao: '√(1 + (inclinação/12)²)', requer: 'inclinação' },
  { nome: 'PitchedArea', unidade: 'sq ft', tipos: ['area'], descricao: 'Área real na água do telhado', requer: 'inclinação' },
  { nome: 'PitchedLinear', unidade: 'lin ft', tipos: ['linear'], descricao: 'Comprimento real na inclinação', requer: 'inclinação' },
  { nome: 'MeasuredCount', unidade: 'each', tipos: ['contagem'], descricao: 'Quantidade contada' },
];
export const FUNCOES = ['ceil', 'floor', 'round', 'min', 'max', 'sqrt', 'abs'];
export function variaveisDoTipo(tipo) { return VARIAVEIS.filter((v) => v.tipos.includes(tipo)); }

/* Valores de exemplo para testar a fórmula na tela de assemblies. */
export const VALORES_DE_TESTE = {
  linear: { MeasuredLinear: 100, WallHeight: 9, SurfaceArea: 900, RoofPitch: 6, PitchFactor: Math.sqrt(1.25), PitchedLinear: 100 * Math.sqrt(1.25) },
  area: { MeasuredArea: 1000, Thickness: 4, VolumeCF: 1000 * 4 / 12, VolumeCY: 1000 * 4 / 12 / 27, RoofPitch: 6, PitchFactor: Math.sqrt(1.25), PitchedArea: 1000 * Math.sqrt(1.25) },
  contagem: { MeasuredCount: 10 },
};

/* ---------- Análise (lista branca) e cálculo ---------- */

const OPERADORES = ['add', 'subtract', 'multiply', 'divide', 'unaryMinus', 'unaryPlus', 'pow'];
const cache = new Map();

/* Confere a fórmula. Devolve { ok, compilada, variaveis } ou { erro }. */
export function analisar(formula, tipo) {
  if (!M) return { erro: 'Motor de fórmulas ainda não carregou.' };
  const texto = String(formula || '').trim();
  if (!texto) return { erro: 'Escreva a fórmula.' };
  if (texto.length > 300) return { erro: 'Fórmula longa demais (máximo 300 caracteres).' };
  const chave = tipo + '|' + texto;
  if (cache.has(chave)) return cache.get(chave);
  const permitidas = variaveisDoTipo(tipo).map((v) => v.nome);
  let no;
  try { no = parseOriginal(texto); } catch (e) { return { erro: 'Fórmula inválida: ' + e.message }; }
  const problemas = [];
  const usadas = new Set();
  no.traverse((n, caminho, pai) => {
    if (n.type === 'ConstantNode') { if (typeof n.value !== 'number') problemas.push('só números são aceitos (não texto)'); }
    else if (n.type === 'ParenthesisNode') { /* ok */ }
    else if (n.type === 'OperatorNode') { if (!OPERADORES.includes(n.fn)) problemas.push('operador não permitido: ' + n.op); }
    else if (n.type === 'FunctionNode') { if (!n.fn || n.fn.type !== 'SymbolNode' || !FUNCOES.includes(n.fn.name)) problemas.push('função não permitida: ' + (n.fn && n.fn.name || '?')); }
    else if (n.type === 'SymbolNode') {
      if (pai && pai.type === 'FunctionNode' && caminho === 'fn') return;
      if (permitidas.includes(n.name)) usadas.add(n.name);
      else if (VARIAVEIS.some((v) => v.nome === n.name)) problemas.push(n.name + ' não existe numa condição deste tipo');
      else problemas.push('variável desconhecida: ' + n.name);
    } else problemas.push('não permitido na fórmula: ' + n.type.replace('Node', ''));
  });
  const r = problemas.length ? { erro: Array.from(new Set(problemas)).join('; ') } : { ok: true, compilada: no.compile(), variaveis: Array.from(usadas) };
  cache.set(chave, r);
  return r;
}

/* Calcula a fórmula com as variáveis da condição. Devolve { valor } ou { erro, faltam }. */
export function calcular(formula, tipo, escopo) {
  const a = analisar(formula, tipo);
  if (a.erro) return { erro: a.erro };
  const faltam = a.variaveis.filter((v) => !Number.isFinite(escopo[v]));
  if (faltam.length) return { erro: 'Falta na condição: ' + faltam.map((n) => n + ' (' + VARIAVEIS.find((v) => v.nome === n).requer + ')').join(', '), faltam };
  let valor;
  try { valor = a.compilada.evaluate(Object.fromEntries(a.variaveis.map((v) => [v, escopo[v]]))); } catch (e) { return { erro: 'Erro no cálculo: ' + e.message }; }
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return { erro: 'O resultado não é um número (divisão por zero?)' };
  if (valor < 0) return { erro: 'O resultado deu negativo (' + valor + ')' };
  return { valor };
}

/* Arredondamento da linha: passo 0 = não arredonda; passo 1 = inteiro para cima; 0,5 = de meio em meio. */
export function arredondar(valor, passo) {
  if (!passo) return valor;
  return Math.ceil(valor / passo - 1e-9) * passo;
}

/* Uma linha do assembly: fórmula → bruta → + perda → arredondada. Tudo fica no rastro (RB-004). */
export function calcularLinha(linha, tipo, escopo) {
  const r = calcular(linha.formula, tipo, escopo);
  if (r.erro) return r;
  const comPerda = r.valor * (1 + (Number(linha.perda) || 0) / 100);
  return { bruta: r.valor, comPerda, final: arredondar(comPerda, Number(linha.passo) || 0) };
}

/* Confere uma fórmula ao salvar: lista branca + cálculo com valores de teste. */
export function validar(formula, tipo) {
  const a = analisar(formula, tipo);
  if (a.erro) return a;
  const r = calcular(formula, tipo, VALORES_DE_TESTE[tipo]);
  if (r.erro) return r;
  return { ok: true, teste: r.valor };
}
