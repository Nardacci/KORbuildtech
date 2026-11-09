/* KORbuild — o gráfico de linha do Início: a curva do previsto e a escolha do projeto em destaque (funções puras, sem navegador).
 * Uso: node tests/inicio-destaque.test.mjs */
import { curvaPrevista } from '../js/andamento.js';
import { projetoEmDestaque } from '../js/inicio-calculo.js';
let ok = 0, falhas = 0;
const verificar = (n, c, d) => { if (c) ok++; else { falhas++; console.log('FALHOU: ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); } };

const crono = { tarefas: [{ id: 'a', nome: 'A', inicio: '2026-01-01', dias: 10, pct: 0 }, { id: 'b', nome: 'B', inicio: '2026-01-11', dias: 10, pct: 0 }] };
const c = curvaPrevista(crono);
verificar('a curva começa no início do cronograma e termina no fim', c[0].d === '2026-01-01' && c[c.length - 1].d === '2026-01-20', [c[0], c[c.length - 1]]);
verificar('a curva sobe de ~5% a 100% sem descer', c[0].p <= 10 && c[c.length - 1].p === 100 && c.every((q, i) => i === 0 || q.p >= c[i - 1].p), c.map((q) => q.p));
verificar('no meio do cronograma (duas tarefas iguais) o previsto é 50%', (c.find((q) => q.d >= '2026-01-10') || {}).p >= 45 && (c.find((q) => q.d >= '2026-01-10') || {}).p <= 55);
verificar('sem tarefas, sem curva', curvaPrevista({ tarefas: [] }).length === 0 && curvaPrevista(null).length === 0);
verificar('no máximo 40 pontos, mesmo num cronograma de anos', curvaPrevista({ tarefas: [{ inicio: '2024-01-01', dias: 900, pct: 0 }] }).length <= 40);

const L = [
  { id: 'p1', situacao: 'em-dia', valor: { total: 100 } }, { id: 'p2', situacao: 'em-dia', valor: { total: 900 } },
  { id: 'p3', situacao: 'atrasado', maisAtrasada: { diasAtraso: 3 } }, { id: 'p4', situacao: 'atrasado', maisAtrasada: { diasAtraso: 12 } },
];
verificar('o destaque é o projeto com mais dias de atraso', projetoEmDestaque(L) === 'p4');
verificar('sem atrasado, o de maior valor entre os em dia', projetoEmDestaque(L.filter((x) => x.situacao === 'em-dia')) === 'p2');
verificar('sem atrasado nem em dia, o primeiro da lista', projetoEmDestaque([{ id: 'x', situacao: 'concluido' }, { id: 'y', situacao: 'nao-iniciado' }]) === 'x');
verificar('lista vazia: nenhum destaque', projetoEmDestaque([]) === null);
console.log(ok + '/' + (ok + falhas) + ' verificações passaram');
process.exit(falhas ? 1 : 0);
