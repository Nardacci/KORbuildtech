/* KORbuild Daily — armazenamento no aparelho.
 * Obras e RDOs ficam em localStorage (texto pequeno); as fotos ficam no IndexedDB (arquivos).
 * No protótipo não há servidor: "enviado ao escritório" é o campo rdo.sync === 'enviado',
 * e o painel do escritório só enxerga RDOs nesse estado. */

let CHAVE = 'kbt.rdo.v1';
let BANCO = 'kbt-rdo-fotos';
let CHAVE_SESSAO = 'kbt.sessao';

/* A página oficial (sem "?demo") guarda o espelho do Supabase em outras chaves: nunca mistura com a demonstração.
 * Chamar antes de qualquer leitura (js/espelho.js). */
export function usarArmazem(o) {
  if (o.chave) CHAVE = o.chave;
  if (o.fotos) BANCO = o.fotos;
  if (o.sessao) CHAVE_SESSAO = o.sessao;
  banco = null;
}
export const chaveDaSessao = () => CHAVE_SESSAO;

/* Várias empresas (tenants) no mesmo aparelho, cada uma com os seus dados, isoladas:
 * { versao, padrao, empresas: { [id]: dados da empresa } }. A empresa aberta é a do usuário da sessão. */
let banco = null;

function carregar() {
  if (!banco) {
    try { banco = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { banco = null; }
    if (banco && !banco.empresas) banco = null; // formato antigo (uma empresa só): recriado
  }
  return banco;
}
export function bancoDeDados() { return carregar(); }

/* A empresa aberta: a do usuário logado; sem ninguém logado, a padrão (tela de entrada). */
let emNomeDe = null;
export function empresaAtualId() {
  const b = carregar();
  if (!b) return null;
  if (emNomeDe) return emNomeDe;
  let sessao = null;
  try { sessao = localStorage.getItem(CHAVE_SESSAO); } catch (e) { sessao = null; }
  if (sessao) for (const [id, d] of Object.entries(b.empresas)) if (d.usuarios.some((u) => u.id === sessao)) return id;
  return b.padrao || Object.keys(b.empresas)[0];
}

/* Os dados da empresa aberta. Uma empresa nunca vê os dados de outra. */
export function estado() {
  const b = carregar();
  return b ? b.empresas[empresaAtualId()] : null;
}
/* O que uma empresa publica para outra (ex.: o cronograma que a prestadora publica para a construtora).
 * No protótipo fica no aparelho, fora das empresas; na versão real, é o servidor que entrega. */
export function compartilhados() {
  const b = carregar();
  if (!b) return [];
  b.compartilhados = b.compartilhados || [];
  return b.compartilhados;
}
/* Calcula algo com os dados de outra empresa e devolve só o resultado (ex.: as horas por função que a
 * prestadora entrega à construtora na obra ligada). Na versão real é o servidor que faz isso e entrega
 * apenas o que foi combinado: nunca nomes com valores, salários ou encargos. */
export function emNomeDaEmpresa(id, fn) {
  const antes = emNomeDe;
  emNomeDe = id;
  try { return fn(); } finally { emNomeDe = antes; }
}
export function empresaPorId(id) { const b = carregar(); return b ? b.empresas[id] || null : null; }
/* Todas as empresas: só para achar o usuário pelo e-mail na entrada. */
export function todasAsEmpresas() { const b = carregar(); return b ? Object.values(b.empresas) : []; }

export function definirEstado(novo) {
  banco = novo;
  salvar();
}

/* Só para desenhar (o link do cliente): troca o banco em memória sem gravar no aparelho. */
export function mostrarSemGuardar(novo) { banco = novo; }

/* Quem quer saber de cada gravação (na conta de verdade, o Measure leva as mudanças ao banco; js/measure-oficial.js). */
const ganchosAoSalvar = [];
export function aoSalvar(fn) { ganchosAoSalvar.push(fn); }
export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(banco));
  } catch (e) {
    console.error('Não foi possível salvar no aparelho', e);
  }
  for (const fn of ganchosAoSalvar) { try { fn(); } catch (e) { console.error(e); } }
}

export function obra(id) { return estado().obras.find((o) => o.id === id); }
export function rdo(id) { return estado().rdos.find((r) => r.id === id) || diariosDeFora().find((r) => r.id === id) || null; }

/* Diários que esta empresa recebe de outras: os das prestadoras nas obras ligadas às dela, já enviados
 * (docs/saas.md HS-11: a construtora aprova). No protótipo, são os próprios objetos da prestadora: aprovar
 * aqui grava lá. Na versão real, é o servidor que entrega e registra a aprovação. */
const ORIGEM = new WeakMap();
export function diariosDeFora() {
  const b = carregar();
  const eu = empresaAtualId();
  const lista = [];
  if (!b) return lista;
  for (const [id, d] of Object.entries(b.empresas)) {
    if (id === eu) continue;
    for (const o of d.obras) {
      if (!o.vinculo || o.vinculo.empresaId !== eu) continue;
      for (const r of d.rdos) {
        if (r.obraId !== o.id || !recebido(r)) continue;
        ORIGEM.set(r, { para: eu, empresaId: id, empresa: d.empresa, obra: o });
        lista.push(r);
      }
    }
  }
  return lista;
}
/* As obras de outras empresas ligadas a uma obra desta (as frentes das prestadoras): [{ empresaId, empresa, obra }]. */
export function obrasLigadas(obraId) {
  const b = carregar();
  const eu = empresaAtualId();
  const lista = [];
  if (!b) return lista;
  for (const [id, d] of Object.entries(b.empresas)) {
    if (id === eu) continue;
    for (const o of d.obras) if (o.vinculo && o.vinculo.empresaId === eu && (!obraId || o.vinculo.obraId === obraId)) lista.push({ empresaId: id, empresa: d.empresa, obra: o });
  }
  return lista;
}
/* De onde veio um diário de fora: { empresaId, empresa, obra (a obra na prestadora) }; null se é da própria empresa. */
export function origemDe(r) {
  const og = r && ORIGEM.get(r);
  return og && og.para === empresaAtualId() ? og : null;
}
/* A obra do próprio diário (na empresa que o fez) e a obra desta empresa a que ele pertence. */
export function obraDoRdo(r) { const og = origemDe(r); return og ? og.obra : obra(r.obraId); }
export function obraLocalDoRdo(r) { const og = origemDe(r); return og ? obra(og.obra.vinculo.obraId) : obra(r.obraId); }
/* Roda algo (desenhar o relatório, aplicar no cronograma) com os dados da empresa que fez o diário. */
export function naEmpresaDoRdo(r, fn) { const og = origemDe(r); return og ? emNomeDaEmpresa(og.empresaId, fn) : fn(); }

export function rdosDaObra(obraId) {
  return estado().rdos.filter((r) => r.obraId === obraId).sort((a, b) => (a.data < b.data ? 1 : -1));
}

export function rdoDoDia(obraId, iso) {
  return estado().rdos.find((r) => r.obraId === obraId && r.data === iso);
}

/* RDO que o escritório já recebeu (enviado e sincronizado). */
export function recebido(r) {
  return r.sync === 'enviado' && r.status !== 'rascunho';
}

export function registrar(r, quem, acao) {
  r.historico = r.historico || [];
  r.historico.push({ em: Date.now(), quem, acao });
}

/* ---------- Fotos no IndexedDB ----------
 * O Safari em aba privada (e o WebKit dos testes, que abre cada contexto assim) aborta, sem dizer o motivo, a gravação de um Blob no IndexedDB; um iPhone sem
 * espaço também pode recusar. Por isso a foto vai para o banco como bytes ({ tipo, bytes }) e volta como Blob na leitura (as fotos já guardadas como Blob
 * continuam lendo). Se o banco do aparelho não gravar de jeito nenhum, o cofre cai para a memória da página: o app continua funcionando e as fotos só duram
 * até fechar. cofreDasFotos() diz em qual dos dois está (o diagnóstico do aparelho mostra). */

let conexao;
function abrir() {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('fotos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('O banco do aparelho não abriu.'));
    });
    conexao.catch(() => { conexao = null; });   // tenta de novo na próxima vez
  }
  return conexao;
}

async function operacao(modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fotos', modo);
    const req = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error || new Error('O banco do aparelho recusou a gravação.'));
    tx.onabort = () => reject(tx.error || new Error('O banco do aparelho cancelou a gravação.'));
  });
}

const memoria = new Map();
let cofre = 'banco';
export const cofreDasFotos = () => cofre;
const viraBytes = async (b) => (typeof Blob !== 'undefined' && b instanceof Blob ? { tipo: b.type || '', bytes: await b.arrayBuffer() } : b);
const viraBlob = (v) => (v && v.bytes instanceof ArrayBuffer ? new Blob([v.bytes], { type: v.tipo || '' }) : v);

/* Cada foto tem duas versões: a do relatório (id) e a miniatura das listas (id + '-mini'). */
export function idMiniatura(id) { return id + '-mini'; }

/* A foto de uma batida do ponto fica no mesmo cofre de fotos, com este prefixo (a do RDO usa o id puro). */
export const idDaFotoDePonto = (id) => 'ponto:' + id;

export async function guardarFoto(id, blob, mini) {
  const pares = [[id, await viraBytes(blob)]];
  if (mini) pares.push([idMiniatura(id), await viraBytes(mini)]);
  if (cofre === 'banco') {
    try { await operacao('readwrite', (s) => { let r; for (const [k, v] of pares) r = s.put(v, k); return r; }); return; }
    catch (e) { console.warn('O banco do aparelho não gravou a foto; o app guarda na memória até fechar.', e); cofre = 'memoria'; }
  }
  for (const [k, v] of pares) memoria.set(k, v);
}

export async function apagarFoto(id) {
  urls.delete(id);
  urls.delete(idMiniatura(id));
  memoria.delete(id); memoria.delete(idMiniatura(id));
  try { await operacao('readwrite', (s) => { s.delete(idMiniatura(id)); return s.delete(id); }); } catch { /* sem banco: já saiu da memória */ }
}

export async function lerFoto(id) {
  if (memoria.has(id)) return viraBlob(memoria.get(id));
  try { return viraBlob(await operacao('readonly', (s) => s.get(id))); } catch { return undefined; }
}

const urls = new Map();
/* Foto que não está no aparelho (tirada em outro celular, ou de um diário recebido): a página oficial busca no
 * Storage por um link temporário (js/espelho.js). */
let buscaRemota = null;
export function definirBuscaRemota(fn) { buscaRemota = fn; }
export async function urlDaFoto(id) {
  if (!urls.has(id)) {
    const blob = await lerFoto(id).catch(() => null);
    const url = blob ? URL.createObjectURL(blob) : buscaRemota ? await buscaRemota(id).catch(() => '') : '';
    if (!url) return '';
    urls.set(id, url);
  }
  return urls.get(id);
}

/* Preenche todos os <img data-foto="id"> dentro de um elemento. */
export function hidratarFotos(raiz) {
  const imgs = Array.from(raiz.querySelectorAll('img[data-foto]'));
  return Promise.all(imgs.map(async (img) => {
    // Fotos antigas, sem miniatura, caem na versão do relatório.
    const url = (await urlDaFoto(img.dataset.foto)) || (img.dataset.fotoReserva ? await urlDaFoto(img.dataset.fotoReserva) : '');
    if (!url) return;
    img.src = url;
    if (!img.complete) await new Promise((ok) => { img.onload = ok; img.onerror = ok; });
  }));
}

export async function apagarTudo() {
  localStorage.removeItem(CHAVE);
  banco = null;
  urls.clear();
  memoria.clear();
  try { await operacao('readwrite', (s) => s.clear()); } catch { /* sem banco: só a memória, já limpa */ }
}
