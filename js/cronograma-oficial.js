/* KORbuild — o cronograma na conta de verdade (docs/banco.md §12): o que o escritório monta vai ao banco.
 *
 * Etapas, % à mão, linha de base, modelo e publicação são ações do escritório, com internet: chamam as funções do banco
 * (que conferem quem pode, a etapa travada por diário aprovado, a obra ligada) e o espelho é lido de novo. O campo
 * (próximas 3 semanas, etapa apontada na atividade do RDO) usa o espelho e funciona sem internet. */

import { tr } from './i18n.js';
import { cliente, traduzir } from './conta.js';
import { ligarServidorCronograma } from './cronograma.js';
import { montar } from './espelho.js';

async function pedir(promessa, resultado) {
  if (!navigator.onLine) return { erro: tr('Para isto, o escritório precisa estar com internet.') };
  try {
    const { data, error } = await promessa();
    if (error) return { erro: traduzir(error) };
    await montar(true).catch(() => {});
    return { ok: true, data, ...(resultado ? resultado(data) : {}) };
  } catch (e) { return { erro: traduzir(e) }; }
}

export function ligarCronogramaOficial() {
  ligarServidorCronograma({
    salvarEtapa: (obraId, id, v) => pedir(() => cliente().rpc('salvar_etapa', { p: { id: id || null, obra_id: obraId, nome: v.nome, inicio: v.inicio, fim: v.fim, responsavel_id: v.responsavelId || null } })),
    excluirEtapa: (id) => pedir(() => cliente().rpc('excluir_etapa', { p_id: id })),
    ordenar: (obraId, ids) => pedir(() => cliente().rpc('ordenar_etapas', { p_obra: obraId, p_ids: ids })),
    aplicarModelo: (obraId, modeloId) => pedir(() => cliente().rpc('aplicar_modelo', { p_obra: obraId, p_modelo: modeloId })),
    avanco: (etapaId, pct) => pedir(() => cliente().rpc('registrar_avanco', { p_etapa: etapaId, p_pct: pct })),
    linhaBase: (obraId, motivo) => pedir(() => cliente().rpc('nova_linha_base', { p_obra: obraId, p_motivo: motivo })),
    publicar: (obraId) => pedir(() => cliente().rpc('publicar_cronograma', { p_obra: obraId }), (v) => ({ versao: v })),
  });
}
