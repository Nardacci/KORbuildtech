/* KORbuild — o Crew na conta de verdade (docs/banco.md §11): o que o escritório decide e o que o aparelho precisa do banco.
 *
 * Bater o ponto é do aparelho (grava no espelho e sobe depois, js/sincronizacao.js). Já conferir, ajustar, aprovar ou
 * devolver a semana, o orçamento e o valor hora são do escritório e pedem internet: vão direto ao banco, que confere
 * as regras (semana aprovada é fechada, dia sem saída, motivo), e o espelho é lido de novo. Ligado por ligarCrewOficial(). */

import { tr } from './i18n.js';
import { estado } from './armazem.js';
import { cliente, traduzir, conta } from './conta.js';
import { ligarServidorCrew } from './crew.js';
import { montar } from './espelho.js';

const SEM_INTERNET = () => ({ erro: tr('Para isto, o escritório precisa estar com internet.') });

async function pedir(promessa) {
  if (!navigator.onLine) return SEM_INTERNET();
  try {
    const { data, error } = await promessa();
    if (error) return { erro: traduzir(error) };
    await montar().catch(() => {});
    return { ok: true, data };
  } catch (e) { return { erro: traduzir(e) }; }
}

export function ligarCrewOficial() {
  ligarServidorCrew({
    conferir: (id) => pedir(() => cliente().rpc('conferir_batida', { p_id: id })),
    semana: (ids, segunda, status, motivo) => pedir(() => cliente().rpc('decidir_semana', { p_funcionarios: ids, p_semana: segunda, p_status: status, p_motivo: motivo })),
    ajustar: (funcId, b) => pedir(() => cliente().rpc('ajustar_batida', { p: {
      id: crypto.randomUUID(), funcionario_id: funcId, tipo: b.tipo, obra_id: b.obraId || null, etapa: b.etapa || null, em: new Date(b.em).toISOString(), motivo: b.ajuste.motivo,
    } })),
    orcamento: (obraId, dados) => {
      const antes = ((estado().crew || {}).orcamentos || {})[obraId] || { porEtapa: {} };
      return pedir(() => cliente().from('orcamentos_obra').insert({ obra_id: obraId, valor: dados.valor, avanco: dados.avanco == null ? null : dados.avanco, por_etapa: antes.porEtapa || {} }));
    },
    valorHora: (funcId, valor, desde, motivo) => pedir(() => cliente().from('funcionario_valores').insert({ funcionario_id: funcId, desde, valor: Math.round(valor * 100) / 100, motivo })),
  });
}

/* O aviso de localização: a própria pessoa aceita no Meu ponto (RN-17); a data fica no cadastro dela. */
export async function aceitarAvisoDeLocalizacao() {
  if (!navigator.onLine) return SEM_INTERNET();
  const { error } = await cliente().rpc('aceitar_aviso_gps');
  if (error) return { erro: traduzir(error) };
  await montar().catch(() => {});
  return { ok: true };
}

/* A pessoa que está com o app (para o Meu ponto e o registro de localização). */
export const meuFuncionarioId = () => (conta.membro && conta.membro.funcionario_id) || null;
