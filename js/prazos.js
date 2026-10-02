/* KORbuild Daily — prazo do RDO e régua de alertas.
 * O responsável pela obra deve enviar o RDO de cada dia de trabalho até o prazo (18h).
 *   16h  lembrete no sininho e no celular ("falta o RDO de hoje")
 *   18h  prazo vencido: sininho e notificação no celular
 *   8h do dia seguinte: o escritório vê no sininho e no painel as obras sem RDO
 * Dia sem trabalho (calendário da obra) ou registrado como "sem atividade" não gera alerta. */

import { hoje, somarDias, diaDaSemana } from './util.js';
import { estado, rdoDoDia } from './armazem.js';

export const PRAZO_HORA = 18;          // prazo padrão do RDO
export const LEMBRETE_HORA = 16;       // lembrete 2h antes
export const ESCALADA_HORA = 8;        // resumo para o escritório na manhã seguinte
export const DIAS_TRABALHO = [1, 2, 3, 4, 5, 6]; // segunda a sábado (0 = domingo)
const DIAS_ATRAS = 3;                  // quantos dias de trabalho para trás são cobrados

export const NOMES_DIAS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

function dataDeIso(iso, hora) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, hora || 0, 0, 0, 0);
}

export function prazoDe(iso) { return dataDeIso(iso, PRAZO_HORA).getTime(); }

export function ehDiaDeTrabalho(obra, iso) {
  return (obra.diasTrabalho || DIAS_TRABALHO).includes(dataDeIso(iso).getDay());
}

export function descreverDias(obra) {
  const dias = obra.diasTrabalho || DIAS_TRABALHO;
  const seq = dias.join(',') === '1,2,3,4,5,6' ? 'segunda a sábado' : dias.join(',') === '1,2,3,4,5' ? 'segunda a sexta' : dias.map((d) => NOMES_DIAS[d]).join(', ');
  return seq;
}

/* Dia de trabalho anterior a uma data (para a escalada da manhã seguinte). */
export function diaDeTrabalhoAnterior(obra, iso) {
  let d = somarDias(iso, -1);
  for (let i = 0; i < 7 && !ehDiaDeTrabalho(obra, d); i++) d = somarDias(d, -1);
  return d;
}

/* O dia está cumprido quando o RDO foi enviado (mesmo guardado no aparelho) ou registrado como sem atividade. */
export function diaCumprido(obra, iso) {
  const r = rdoDoDia(obra.id, iso);
  return !!r && r.status !== 'rascunho';
}

/* Situação do RDO de hoje: folga | feito | aberto | lembrete | atrasado. */
export function situacaoDeHoje(obra, agora) {
  const iso = hoje();
  if (!ehDiaDeTrabalho(obra, iso)) return 'folga';
  if (diaCumprido(obra, iso)) return 'feito';
  const hora = new Date(agora || Date.now()).getHours();
  if (hora >= PRAZO_HORA) return 'atrasado';
  if (hora >= LEMBRETE_HORA) return 'lembrete';
  return 'aberto';
}

/* Dias de trabalho anteriores (até 3) sem RDO: estão atrasados. */
export function diasAtrasados(obra) {
  const lista = [];
  let d = hoje();
  let contados = 0;
  while (contados < DIAS_ATRAS) {
    d = somarDias(d, -1);
    if (obra.inicio && d < obra.inicio) break;
    if (!ehDiaDeTrabalho(obra, d)) continue;
    contados++;
    if (!diaCumprido(obra, d)) lista.push(d);
  }
  return lista;
}

/* O primeiro envio passou do prazo do dia do relatório? */
export function enviadoComAtraso(r) {
  const envio = r.primeiroEnvioEm || r.enviadoEm;
  return !!envio && envio > prazoDe(r.data);
}

export function textoPrazo(iso) {
  return (iso === hoje() ? 'hoje' : diaDaSemana(iso)) + ' às ' + PRAZO_HORA + 'h';
}

/* Pendências do responsável: dias atrasados de todas as obras + obras sem RDO hoje. */
export function pendenciasDoCampo(agora) {
  const { obras, rdos } = estado();
  const atrasados = [];
  const hojeSemRdo = [];
  for (const o of obras) {
    for (const d of diasAtrasados(o)) atrasados.push({ obra: o, data: d });
    const s = situacaoDeHoje(o, agora);
    if (s === 'atrasado') atrasados.unshift({ obra: o, data: hoje() });
    else if (s === 'aberto' || s === 'lembrete') hojeSemRdo.push({ obra: o, situacao: s });
  }
  const ajustes = rdos.filter((r) => r.status === 'ajustes');
  return { atrasados, hojeSemRdo, ajustes, total: atrasados.length + hojeSemRdo.length + ajustes.length };
}

/* Escalada para o escritório: obras sem RDO no último dia de trabalho (a partir das 8h). */
export function semRdoOntem(agora) {
  const hora = new Date(agora || Date.now()).getHours();
  if (hora < ESCALADA_HORA) return [];
  return estado().obras
    .map((o) => ({ obra: o, data: diaDeTrabalhoAnterior(o, hoje()) }))
    .filter(({ obra, data }) => (!obra.inicio || data >= obra.inicio) && !diaCumprido(obra, data));
}
