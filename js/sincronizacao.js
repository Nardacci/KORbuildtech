/* KORbuild — a sincronização do Daily com o Supabase (docs/banco.md §10.3), na página oficial.
 * O aparelho grava tudo no espelho (js/espelho.js); aqui sobe o que mudou, em ordem: primeiro as fotos (Storage),
 * depois o diário (salvar_rdo, com a versão que o aparelho conhecia), depois o envio (enviar_rdo) ou o dia sem
 * atividade (dia_sem_atividade). Repetir não duplica: os ids nascem no aparelho. Se outro aparelho mudou o mesmo
 * diário, o banco recusa e quem chamou decide (aoConflito). */

import { estado, salvar, lerFoto, idMiniatura } from './armazem.js';
import { tr } from './i18n.js';
import { cliente } from './conta.js';
import { conteudoDe, assinatura, temPendencia, rdoDoBanco, lembrarCaminhos } from './espelho.js';

let rodando = null;
export const sincronizando = () => !!rodando;

/* Quantas batidas e registros de localização do aparelho ainda não subiram. */
export function pendentesDoPonto() {
  const d = estado();
  return d && d.oficial && d.crew ? d.crew.batidas.filter((b) => !b._banco).length : 0;
}

/* Quantos diários do aparelho ainda não subiram (para o aviso de conexão). */
export function pendentesNoAparelho() {
  const d = estado();
  return d && d.oficial ? d.rdos.filter(temPendencia).length : 0;
}

const ehConflito = (e) => !!e && (e.code === 'P0409' || /KB_CONFLITO|Já existe o diário deste dia/.test(e.message || ''));

async function subirFotos(r, empresaId) {
  for (const f of r.fotos) {
    if (f.path) continue;
    const base = empresaId + '/' + r.obraId + '/' + r.id + '/' + f.id;
    const [foto, mini] = await Promise.all([lerFoto(f.id), lerFoto(idMiniatura(f.id))]);
    if (!foto) continue;   // ainda não gravada no aparelho
    for (const [caminho, blob] of [[base + '.jpg', foto], [base + '-mini.jpg', mini]]) {
      if (!blob) continue;
      const { error } = await cliente().storage.from('diarios').upload(caminho, blob, { contentType: blob.type || 'image/jpeg', upsert: false });
      if (error && !/exist|duplicate/i.test(error.message || '')) throw error;
    }
    f.path = base + '.jpg';
    f.pathMini = mini ? base + '-mini.jpg' : null;
    lembrarCaminhos([f]);
    salvar();
  }
}

function fotosParaBanco(r) {
  return r.fotos.filter((f) => f.path).map((f) => ({
    id: f.id, path: f.path, path_mini: f.pathMini || null, legenda: f.legenda || '', tirada_em: f.tiradaEm ? new Date(f.tiradaEm).toISOString() : null,
    lat: f.lat, lon: f.lon, fonte_gps: f.fonteGps || null, precisao: f.precisao == null ? null : Math.round(f.precisao),
    largura: f.largura || null, altura: f.altura || null, tamanho: f.tamanho || null, hash_original: f.hashOriginal || null,
  }));
}
/* O envio, o reenvio e o dia sem atividade o próprio banco registra (enviar_rdo, dia_sem_atividade): essas linhas
 * do aparelho não sobem, senão o histórico teria a mesma ação duas vezes. */
const REGISTRADO_NO_BANCO = () => [tr('Enviou para aprovação'), tr('Reenviou com os ajustes')];
function historicoParaBanco(r) {
  for (const h of r.historico || []) if (!h.id) h.id = crypto.randomUUID();
  const doBanco = REGISTRADO_NO_BANCO();
  return (r.historico || [])
    .filter((h) => !doBanco.includes(h.acao) && !(h.acao || '').startsWith(tr('Registrou dia sem atividade:')))
    .map((h) => ({ id: h.id, em: new Date(h.em || Date.now()).toISOString(), quem: h.quem || '', acao: h.acao }));
}

async function rpc(nome, args) {
  const { data, error } = await cliente().rpc(nome, args);
  if (error) throw error;
  return data;
}

async function subirRdo(r, empresaId) {
  await subirFotos(r, empresaId);
  if (r.semAtividade && !r._banco) {
    const res = await rpc('dia_sem_atividade', { p: { id: r.id, obra_id: r.obraId, data: r.data, motivo: r.semAtividade.motivo, obs: r.semAtividade.obs || '', criado_no_aparelho_em: new Date(r.criadoEm || Date.now()).toISOString() } });
    r._banco = { versao: res.versao, status: res.status };
    r.numero = res.numero;
    r._sinc = assinatura(r);
    r.sync = 'enviado';
    return;
  }
  if (!r._banco || r._sinc !== assinatura(r)) {
    const sinc = assinatura(r);
    const res = await rpc('salvar_rdo', { p: {
      id: r.id, obra_id: r.obraId, data: r.data, versao: r._banco ? r._banco.versao : null, conteudo: conteudoDe(r),
      criado_no_aparelho_em: new Date(r.criadoEm || Date.now()).toISOString(), fotos: fotosParaBanco(r), historico: historicoParaBanco(r),
    } });
    r._banco = { versao: res.versao, status: res.status };
    r.numero = res.numero;
    r._sinc = sinc;
  }
  if (r.status === 'enviado' && ['rascunho', 'ajustes'].includes(r._banco.status)) {
    const res = await rpc('enviar_rdo', { p_id: r.id, p_versao: r._banco.versao });
    r._banco = { versao: res.versao, status: res.status };
    r.sync = 'enviado';
  }
}

/* O diário como está no banco agora (para resolver um conflito). */
export async function versaoDoBanco(r) {
  const { data } = await cliente().from('rdos').select('*').eq('obra_id', r.obraId).eq('data', r.data).maybeSingle();
  if (!data) return null;
  const [{ data: fotos }, { data: historico }] = await Promise.all([
    cliente().from('rdo_fotos').select('*').eq('rdo_id', data.id).order('ordem'),
    cliente().from('rdo_historico').select('*').eq('rdo_id', data.id).order('em'),
  ]);
  return rdoDoBanco({ ...data, fotos: fotos || [], historico: historico || [] });
}

/* Sobe o que o aparelho tem para subir. aoConflito(r, doBanco) devolve 'meu' (regravar por cima) ou 'banco'. */
export function sincronizarDaily({ aoConflito, aoErro } = {}) {
  if (rodando) return rodando;
  rodando = (async () => {
    const d = estado();
    if (!d || !d.oficial || !navigator.onLine) return 0;
    let subiram = 0;
    for (const r of d.rdos.filter(temPendencia)) {
      try {
        await subirRdo(r, d.empresa.id);
        subiram++;
      } catch (e) {
        if (ehConflito(e) && aoConflito) {
          const doBanco = await versaoDoBanco(r);
          const escolha = doBanco ? await aoConflito(r, doBanco) : 'meu';
          if (escolha === 'banco' && doBanco) {
            d.rdos.splice(d.rdos.indexOf(r), 1, doBanco);
          } else if (doBanco) {
            // a minha versão vai por cima da que está no banco; se o outro aparelho criou o dia com outro id,
            // o diário passa a usar o id do banco e as fotos sobem de novo na pasta dele
            if (doBanco.id !== r.id) { r.id = doBanco.id; r.numero = doBanco.numero; r.fotos.forEach((f) => { f.path = null; f.pathMini = null; }); }
            r._banco = { ...doBanco._banco };
            r._sinc = null;
            try { await subirRdo(r, d.empresa.id); subiram++; } catch (e2) { if (aoErro) aoErro(r, e2); }
          } else if (aoErro) aoErro(r, e);
        } else if (aoErro) aoErro(r, e);
        if (!navigator.onLine) break;
      } finally {
        salvar();
      }
    }
    return subiram;
  })().finally(() => { rodando = null; });
  return rodando;
}


/* ---------- O ponto (Crew, docs/banco.md §11.3) ---------- */

/* O banco recusa só o que não pode entrar (semana já aprovada, obra de fora…): volta o motivo e a batida sai da fila. */
export const MOTIVOS_DA_RECUSA = () => ({
  'semana-aprovada': tr('A semana dessa batida já foi aprovada e enviada para a folha.'),
  obra: tr('A obra dessa batida não foi encontrada.'),
  funcionario: tr('O funcionário dessa batida não foi encontrado.'),
  'funcionario-inativo': tr('O funcionário dessa batida não está ativo.'),
  permissao: tr('Você não tem permissão para bater o ponto dessa pessoa.'),
  hora: tr('A hora dessa batida não é válida.'),
});

const paraBanco = (b) => ({
  id: b.id, funcionario_id: b.funcionarioId, tipo: b.tipo, obra_id: b.obraId || null, etapa: b.etapa || null, em: new Date(b.em).toISOString(),
  lat: b.lat == null ? null : b.lat, lon: b.lon == null ? null : b.lon, precisao: b.precisao == null ? null : Math.round(b.precisao),
  fonte_gps: b.fonteGps || 'gps', modo: b.modo === 'equipe' ? 'equipe' : 'pessoal', nota: b.nota || null, criado_no_aparelho_em: new Date(b.em).toISOString(),
});

let rodandoPonto = null;
/* Sobe as batidas e os registros de localização do aparelho, na ordem em que aconteceram. aoRecusar(batida, motivo). */
export function sincronizarPonto({ aoRecusar } = {}) {
  if (rodandoPonto) return rodandoPonto;
  rodandoPonto = (async () => {
    const d = estado();
    if (!d || !d.oficial || !d.crew || !navigator.onLine) return 0;
    let subiram = 0;
    const pendentes = d.crew.batidas.filter((b) => !b._banco && b.modo !== 'ajuste').sort((a, b) => a.em - b.em);
    for (let i = 0; i < pendentes.length; i += 100) {
      const lote = pendentes.slice(i, i + 100);
      const res = await rpc('registrar_batidas', { p: lote.map(paraBanco) });
      const gravadas = new Set(res.gravadas);
      const recusadas = new Map(res.recusadas.map((x) => [x.id, x.motivo]));
      for (const b of lote) {
        if (gravadas.has(b.id)) { b._banco = true; subiram++; } else if (recusadas.has(b.id)) {
          d.crew.batidas.splice(d.crew.batidas.indexOf(b), 1);
          if (aoRecusar) aoRecusar(b, recusadas.get(b.id));
        }
      }
      salvar();
    }
    const locais = (d.crew.localizacoes || []).filter((l) => !l._banco).sort((a, b) => a.em - b.em);
    for (let i = 0; i < locais.length; i += 100) {
      const lote = locais.slice(i, i + 100);
      const res = await rpc('registrar_localizacoes', { p: lote.map((l) => ({ id: l.id, em: new Date(l.em).toISOString(), lat: l.lat, lon: l.lon, precisao: l.precisao == null ? null : Math.round(l.precisao), gatilho: l.gatilho, criado_no_aparelho_em: new Date(l.em).toISOString() })) });
      const gravadas = new Set(res.gravadas);
      for (const l of lote) {
        if (gravadas.has(l.id)) l._banco = true;
        else d.crew.localizacoes.splice(d.crew.localizacoes.indexOf(l), 1);   // recusada (ponto fechado, intervalo, sem o aviso): não volta
      }
      salvar();
    }
    return subiram;
  })().finally(() => { rodandoPonto = null; });
  return rodandoPonto;
}
export const subindoPonto = () => !!rodandoPonto;
