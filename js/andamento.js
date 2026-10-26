/* KORbuild Takeoff — andamento de um cronograma de projeto (funções puras, sem tela e sem estado).
 * Cada tarefa tem { inicio, dias, pct } (pct = % feito, 0 a 100, informado pela equipe no Schedule).
 *   previsto  = quanto já devia estar feito hoje, pelo calendário (dias corridos passados ÷ duração)
 *   feito     = o que a equipe informou
 *   atrasada  = a tarefa devia ter terminado (fim < hoje) e não chegou a 100%
 * Situação do projeto: sem-cronograma · nao-iniciado · em-dia · atrasado · concluido. */

const DIA = 864e5;
const dias = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / DIA);
const somar = (iso, n) => new Date(new Date(iso + 'T12:00:00Z').getTime() + n * DIA).toISOString().slice(0, 10);
const limitar = (n) => Math.max(0, Math.min(100, Math.round(Number(n) || 0)));

export const duracaoDe = (t) => Math.max(1, Number(t.dias) || 1);
export const fimDaTarefa = (t) => (t.inicio ? somar(t.inicio, duracaoDe(t) - 1) : '');
export const pctFeito = (t) => limitar(t.pct);

/* Quanto devia estar feito hoje, pelo calendário. */
export function pctPrevisto(t, hojeIso) {
  if (!t.inicio) return 0;
  if (hojeIso < t.inicio) return 0;
  return Math.min(100, Math.round((dias(t.inicio, hojeIso) + 1) * 100 / duracaoDe(t)));
}

export const tarefaAtrasada = (t, hojeIso) => !!t.inicio && pctFeito(t) < 100 && fimDaTarefa(t) < hojeIso;

export function andamentoDoCronograma(c, hojeIso) {
  const tarefas = ((c && c.tarefas) || []).filter((t) => t.inicio);
  const peso = tarefas.reduce((s, t) => s + duracaoDe(t), 0);
  const pond = (f) => (peso ? Math.round(tarefas.reduce((s, t) => s + f(t) * duracaoDe(t), 0) / peso) : 0);
  const atrasadas = tarefas.filter((t) => tarefaAtrasada(t, hojeIso)).map((t) => ({ ...t, fim: fimDaTarefa(t), diasAtraso: dias(fimDaTarefa(t), hojeIso) }));
  const inicios = tarefas.map((t) => t.inicio).sort(), fins = tarefas.map(fimDaTarefa).sort();
  const r = {
    tarefas: tarefas.length, concluidas: tarefas.filter((t) => pctFeito(t) >= 100).length,
    emAndamento: tarefas.filter((t) => t.inicio <= hojeIso && pctFeito(t) < 100 && fimDaTarefa(t) >= hojeIso).length,
    atrasadas, feito: pond(pctFeito), previsto: pond((t) => pctPrevisto(t, hojeIso)),
    inicio: inicios[0] || '', fim: fins[fins.length - 1] || '',
  };
  r.situacao = !tarefas.length ? 'sem-cronograma' : r.concluidas === tarefas.length ? 'concluido' : atrasadas.length ? 'atrasado' : hojeIso < r.inicio ? 'nao-iniciado' : 'em-dia';
  // o quanto o feito está atrás do previsto (pontos percentuais); negativo = adiantado
  r.desvio = r.previsto - r.feito;
  return r;
}

export const ORDEM_SITUACAO = { atrasado: 0, 'em-dia': 1, 'nao-iniciado': 2, concluido: 3, 'sem-cronograma': 4 };
