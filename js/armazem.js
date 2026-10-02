/* KORbuild Daily — armazenamento no aparelho.
 * Obras e RDOs ficam em localStorage (texto pequeno); as fotos ficam no IndexedDB (arquivos).
 * No protótipo não há servidor: "enviado ao escritório" é o campo rdo.sync === 'enviado',
 * e o painel do escritório só enxerga RDOs nesse estado. */

const CHAVE = 'kbt.rdo.v1';
const BANCO = 'kbt-rdo-fotos';

let dados = null;

export function estado() {
  if (!dados) {
    try { dados = JSON.parse(localStorage.getItem(CHAVE)); } catch (e) { dados = null; }
  }
  return dados;
}

export function definirEstado(novo) {
  dados = novo;
  salvar();
}

export function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
  } catch (e) {
    console.error('Não foi possível salvar no aparelho', e);
  }
}

export function obra(id) { return estado().obras.find((o) => o.id === id); }
export function rdo(id) { return estado().rdos.find((r) => r.id === id); }

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

/* ---------- Fotos no IndexedDB ---------- */

let conexao;
function abrir() {
  if (!conexao) {
    conexao = new Promise((resolve, reject) => {
      const req = indexedDB.open(BANCO, 1);
      req.onupgradeneeded = () => req.result.createObjectStore('fotos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return conexao;
}

async function operacao(modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('fotos', modo);
    const req = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}

/* Cada foto tem duas versões: a do relatório (id) e a miniatura das listas (id + '-mini'). */
export function idMiniatura(id) { return id + '-mini'; }

export function guardarFoto(id, blob, mini) {
  return operacao('readwrite', (s) => { if (mini) s.put(mini, idMiniatura(id)); return s.put(blob, id); });
}

export function apagarFoto(id) {
  urls.delete(id);
  urls.delete(idMiniatura(id));
  return operacao('readwrite', (s) => { s.delete(idMiniatura(id)); return s.delete(id); });
}

export function lerFoto(id) { return operacao('readonly', (s) => s.get(id)); }

const urls = new Map();
export async function urlDaFoto(id) {
  if (!urls.has(id)) {
    const blob = await lerFoto(id);
    if (!blob) return '';
    urls.set(id, URL.createObjectURL(blob));
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
  dados = null;
  urls.clear();
  await operacao('readwrite', (s) => s.clear());
}
