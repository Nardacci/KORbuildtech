/* KORbuild — os projetos que o Daily enxerga (docs/daily-primeira-versao.md). Módulo neutro: obras.js, prazos.js e o app o usam sem ciclo de importação.
 * Na 1ª versão o projeto liberado para obra é a obra. Quem tem Measure lê o projeto inteiro (estado().measure.projetos); quem só tem Daily
 * (o Encarregado) recebe do banco só o essencial dos projetos liberados (projetos_do_daily, migração 0024): estado().projetosDoDaily
 * = [{ id, nome, obraId, cidade, estado, liberado: { em, por }, cronograma: { tarefas: [{ id, nome, quem, inicio, dias, pct }] } }]. */

import { estado } from './armazem.js';
import { PRIMEIRA_VERSAO } from './versao.js';

/* O projeto está liberado para obra: a análise terminou e o Daily pode começar. */
export const liberadoParaObra = (pj) => !!(pj && pj.liberado && pj.liberado.em);

/* Os projetos da empresa para o Daily: o Measure completo e, no que faltar, o essencial vindo do banco. */
export function projetosDaEmpresa(dados) {
  const d = dados || estado() || {};
  const medidos = (d.measure || {}).projetos || [];
  const doDaily = (d.projetosDoDaily || []).filter((x) => !medidos.some((p) => p.id === x.id));
  return doDaily.length ? medidos.concat(doDaily) : medidos;
}

/* 1ª versão: o Daily só vê obras que nasceram de projetos liberados para obra (o projeto que "voltou para análise" some do Daily, sem apagar nada). */
export function obrasDaVersao(dados) {
  const d = dados || estado() || {}, lista = d.obras || [];
  if (!PRIMEIRA_VERSAO) return lista;
  const projetos = projetosDaEmpresa(d);
  return lista.filter((o) => o.projetoId && liberadoParaObra(projetos.find((p) => p.id === o.projetoId)));
}
