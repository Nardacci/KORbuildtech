/* KORbuild — o Measure na conta de verdade (docs/banco.md §13).
 *
 * O Measure é trabalho de escritório, no computador e com internet: não há fila sem sinal. As telas do protótipo
 * continuam gravando no espelho (js/measure.js chama salvar()); este módulo escuta cada gravação, compara o Measure do
 * espelho com o que o banco já tem e leva só o que mudou (projetos, folhas, condições, typicals, itens, assemblies),
 * agrupado a cada 800 ms — uma sessão de medição são centenas de cliques. Preços e margens só entram (nunca mudam);
 * a proposta emitida vai pela função emitir_proposta (numerada e congelada pelo banco); as plantas vão ao Storage. */

import { tr } from './i18n.js';
import { toast } from './util.js';
import { estado, salvar, aoSalvar, guardarFoto, lerFoto } from './armazem.js';
import { cliente, traduzir, conta } from './conta.js';
import { montar, antesDeMontar, aoTrocarEspelho } from './espelho.js';
import { ligarServidorMeasure } from './measure-relatorios.js';

const ESPERA_MS = 800;
/* Os campos novos do projeto (entrega por etapa e cronograma preliminar) só sobem para o banco depois da migração 0016 (supabase/pendentes/). Antes dela, ficam só no aparelho: virar true junto com a migração. */
export const PERSISTE_ESPACO = true;
/** Observação de cada folha (migração 0017): só vai ao banco depois que ela for aplicada. */
export const PERSISTE_OBS_FOLHA = true;
/** Item ativo/inativo (migração 0018, em supabase/pendentes): só vai ao banco depois que ela for aplicada. */
export const PERSISTE_ATIVO_ITEM = true;
/** Execução do projeto (local no mapa, dias de trabalho): coluna projetos.execucao da migração 0020 (supabase/pendentes). Virar true junto com ela. */
export const PERSISTE_EXECUCAO = true;
/* liberado_em / liberado_por (migração 0022): virar true junto com a migração. */
export const PERSISTE_LIBERADO = true;
/* itens.funcao_id (migração 0023): virar true junto com a migração. */
export const PERSISTE_FUNCAO = false;
let conhecido = null;          // { tabela: Map(id → JSON da linha como o banco tem) }
let agendado = null;
let subindo = null;
let dentroDeMim = false;       // salvar() chamado por aqui (ids e marcas): não dispara outra rodada

/* ---------- Do espelho para as linhas do banco ---------- */

const linha = {
  projetos: (p) => ({ id: p.id, nome: p.nome, contratante_id: p.contratanteId, dono_id: p.donoId || null, endereco: p.endereco || '', cidade: p.cidade, estado: p.estado, zip: p.zip || '',
    tipo: p.tipo, situacao: p.situacao, descricao: p.descricao || '', obra_id: p.obraId || null, estimador_id: p.estimadorId || null, prazo_proposta: p.prazoProposta || null,
    proposta_rascunho: p.proposta || {}, cotacao: p.cotacao || {}, ...(PERSISTE_ESPACO ? { entrega: p.entrega || {}, cronograma: p.cronograma || {} } : {}), ...(PERSISTE_EXECUCAO ? { execucao: p.execucao || {} } : {}), ...(PERSISTE_LIBERADO ? { liberado_em: p.liberado && p.liberado.em ? new Date(p.liberado.em).toISOString() : null, liberado_por: (p.liberado && p.liberado.por) || null } : {}) }),
  folhas: (f) => ({ id: f.id, projeto_id: f.projetoId, nome: f.nome, arquivo_path: f.arquivo.path, arquivo_nome: f.arquivo.nome || '', pagina: f.pagina, escala: f.escala || null, ...(PERSISTE_OBS_FOLHA ? { observacao: f.observacao || '' } : {}) }),
  condicoes: (c) => ({ id: c.id, projeto_id: c.projetoId, nome: c.nome, tipo: c.tipo, cor: c.cor || '', props: c.props || {}, assemblies: c.assemblies || [], folhas: c.folhas || [], oculta: !!c.oculta, medicoes: c.medicoes || [] }),
  typicais: (t) => ({ id: t.id, projeto_id: t.projetoId, folha_id: t.folhaId, nome: t.nome, regiao: t.regiao || null, ocorrencias: t.ocorrencias }),
  itens: (i) => ({ id: i.id, codigo: i.codigo || '', nome: i.nome, categoria: i.categoria, unidade: i.unidade, etapa: i.etapa || '', nota: i.nota || '', ...(PERSISTE_ATIVO_ITEM ? { ativo: i.ativo !== false } : {}), ...(PERSISTE_FUNCAO ? { funcao_id: i.funcaoId || null } : {}) }),
  assemblies: (a) => ({ id: a.id, nome: a.nome, tipo: a.tipo, descricao: a.descricao || '', linhas: a.linhas }),
};
const ORDEM = ['projetos', 'folhas', 'condicoes', 'typicais', 'itens', 'assemblies'];   // pais antes dos filhos
const lista = (mz, t) => (mz[t] || []).filter((x) => t !== 'folhas' || (x.arquivo && x.arquivo.tipo === 'storage'));

function fotografar(mz) {
  const foto = {};
  for (const t of ORDEM) foto[t] = new Map(lista(mz, t).map((x) => [x.id, JSON.stringify(linha[t](x))]));
  return foto;
}

/* ---------- Subir o que mudou ---------- */

function agendar() {
  if (dentroDeMim || !conhecido || !estado() || !estado().oficial) return;
  clearTimeout(agendado);
  agendado = setTimeout(() => { subir().catch(() => {}); }, ESPERA_MS);
}

export function descarregar() {
  clearTimeout(agendado);
  return subir();
}

function erro(e) {
  if (e && (e.code === 'P0409' || /KB_CONFLITO/.test(e.message || ''))) {
    toast(tr('Esta condição mudou em outro computador. A tela foi atualizada com a versão do banco.'));
    conhecido = null;
    montar().catch(() => {});
    return;
  }
  toast(tr('Não foi possível gravar no banco: {erro}', { erro: traduzir(e) }));
}

async function subir() {
  if (subindo) { await subindo; }
  const d = estado();
  if (!d || !d.oficial || !conhecido || !navigator.onLine) return;
  subindo = (async () => {
    const mz = d.measure;
    const sb = cliente();
    try {
      // preços e margens: só o que ainda não tem marca de banco
      const precos = [];
      for (const it of mz.itens || []) for (const p of it.precos || []) if (!p._banco) {
        if (!p.id) p.id = crypto.randomUUID();
        precos.push({ id: p.id, item_id: it.id, desde: p.desde, valor: p.valor, fonte: p.fonte || 'digitado', fornecedor_id: p.fornecedorId || null });
      }
      const margens = (mz.margens || []).filter((m) => !m._banco).map((m) => { if (!m.id) m.id = crypto.randomUUID(); return { id: m.id, desde: m.desde, overhead_pct: m.overheadPct, lucro_pct: m.lucroPct, modo: m.modo, imposto_material_pct: m.impostoMaterialPct || 0, motivo: m.motivo }; });
      // tabelas: o que mudou, o que é novo e o que sumiu
      const atual = fotografar(mz);
      let relerDepois = false;   // projeto liberado sem obra: o gatilho do banco cria a obra (0020) e o espelho precisa trazê-la
      for (const t of ORDEM) {
        const novos = [];
        for (const x of lista(mz, t)) {
          const json = atual[t].get(x.id);
          if (conhecido[t].get(x.id) !== json) {
            const row = JSON.parse(json);
            if (t === 'condicoes') row.versao = (x._banco && x._banco.versao) || 1;   // a versão que este computador conhecia
            novos.push(row);
          }
        }
        if (novos.length) {
          const { data, error } = await sb.from(t).upsert(novos, { onConflict: 'id' }).select('id, ' + (t === 'condicoes' ? 'versao' : 'id'));
          if (error) throw error;
          if (t === 'condicoes') for (const r of data || []) { const c = (mz.condicoes || []).find((x) => x.id === r.id); if (c) c._banco = { versao: r.versao }; }
          for (const r of novos) conhecido[t].set(r.id, atual[t].get(r.id));
          if (t === 'projetos' && novos.some((r) => (r.liberado_em || r.situacao === 'ganha') && !r.obra_id)) relerDepois = true;
        }
      }
      if (precos.length) { const { error } = await sb.from('item_precos').upsert(precos, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; }
      if (margens.length) { const { error } = await sb.from('margens_versoes').upsert(margens, { onConflict: 'id', ignoreDuplicates: true }); if (error) throw error; }
      for (const t of ORDEM.slice().reverse()) {
        const sumiram = [...conhecido[t].keys()].filter((id) => !atual[t].has(id));
        if (sumiram.length) {
          const { error } = await sb.from(t).delete().in('id', sumiram);
          if (error) throw error;
          for (const id of sumiram) conhecido[t].delete(id);
        }
      }
      if (precos.length || margens.length) {
        for (const it of mz.itens || []) for (const p of it.precos || []) p._banco = true;
        for (const m of mz.margens || []) m._banco = true;
        dentroDeMim = true; try { salvar(); } finally { dentroDeMim = false; }
      }
      if (relerDepois) montar(true).catch(() => {});
    } catch (e) { erro(e); }
  })().finally(() => { subindo = null; });
  return subindo;
}

/* ---------- Plantas no Storage ---------- */

const caminhoDaPlanta = (projetoId, arquivoId) => conta.empresa.id + '/' + projetoId + '/' + arquivoId + '.pdf';

/* Envia o PDF e devolve o `arquivo` da folha; o PDF fica também no aparelho (IndexedDB) para não baixar de novo. */
export async function enviarPlanta(projetoId, arquivoId, blob, nomeArquivo) {
  const path = caminhoDaPlanta(projetoId, arquivoId);
  const { error } = await cliente().storage.from('plantas').upload(path, blob, { contentType: 'application/pdf', upsert: false });
  if (error) throw error;
  await guardarFoto(arquivoId, blob).catch(() => {});
  return { tipo: 'storage', path, id: arquivoId, nome: nomeArquivo };
}

/* O PDF de uma folha: do aparelho, se já estiver lá; senão, baixa por um link temporário e guarda. */
export async function bytesDaPlanta(arquivo) {
  const local = await lerFoto(arquivo.id).catch(() => null);
  if (local) return new Uint8Array(await local.arrayBuffer());
  const { data, error } = await cliente().storage.from('plantas').createSignedUrl(arquivo.path, 3600);
  if (error) throw error;
  const resp = await fetch(data.signedUrl);
  if (!resp.ok) throw new Error('planta ' + resp.status);
  const blob = await resp.blob();
  await guardarFoto(arquivo.id, blob).catch(() => {});
  return new Uint8Array(await blob.arrayBuffer());
}

/* Ao excluir o projeto, as plantas dele saem do Storage (as linhas saem em cascata no banco). */
export async function apagarPlantasDoProjeto(projetoId) {
  const pasta = conta.empresa.id + '/' + projetoId;
  const { data } = await cliente().storage.from('plantas').list(pasta, { limit: 1000 });
  const nomes = (data || []).map((x) => pasta + '/' + x.name);
  if (nomes.length) await cliente().storage.from('plantas').remove(nomes);
}

/* ---------- Ligar ---------- */

export function ligarMeasureOficial() {
  aoSalvar(agendar);
  antesDeMontar(async () => { if (conhecido) await descarregar(); });
  aoTrocarEspelho(trocarEspelho);
  ligarServidorMeasure({
    async emitir(p, retrato) {
      if (!navigator.onLine) return { erro: tr('Para emitir, o escritório precisa estar com internet.') };
      await descarregar();   // o rascunho e o projeto como estão agora
      const { data, error } = await cliente().rpc('emitir_proposta', { p_projeto: p.id, p_retrato: retrato });
      if (error) return { erro: traduzir(error) };
      conhecido = null;
      await montar(true).catch(() => {});
      return { ok: true, numero: data.numero };
    },
  });
}

/* O espelho novo (lido do banco) vai entrar no lugar do antigo. O que mudou no aparelho depois da última leitura e
 * ainda não subiu (a leitura pode ter começado antes da mudança) é carregado para o novo e sobe em seguida;
 * "conhecido" fica com o que o banco entregou, para a diferença aparecer. */
function trocarEspelho(novo, antigo) {
  if (!novo.measure) { conhecido = null; return; }
  const doBanco = fotografar(novo.measure);
  const mz = antigo && antigo.measure;
  let pendente = false;
  if (conhecido && mz) {
    const atual = fotografar(mz);
    for (const t of ORDEM) {
      for (const x of lista(mz, t)) {
        if (conhecido[t].get(x.id) === atual[t].get(x.id)) continue;   // já estava no banco como está
        const i = (novo.measure[t] || []).findIndex((y) => y.id === x.id);
        if (i >= 0) novo.measure[t][i] = x; else (novo.measure[t] = novo.measure[t] || []).push(x);
        pendente = true;
      }
      for (const id of conhecido[t].keys()) if (!atual[t].has(id)) { novo.measure[t] = (novo.measure[t] || []).filter((y) => y.id !== id); pendente = true; }
    }
    // preços e margens que ainda não subiram
    for (const it of mz.itens || []) for (const p of it.precos || []) if (!p._banco) { const n = (novo.measure.itens || []).find((y) => y.id === it.id); if (n && !(n.precos || []).some((q) => q.id && q.id === p.id)) { (n.precos = n.precos || []).push(p); pendente = true; } }
    for (const m of mz.margens || []) if (!m._banco) { (novo.measure.margens = novo.measure.margens || []).push(m); pendente = true; }
  }
  conhecido = doBanco;
  if (pendente) setTimeout(agendar, 0);
}
