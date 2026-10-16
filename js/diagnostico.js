/* KORbuild — diagnóstico do aparelho (docs/iphone.md).
 * Para o teste em aparelhos que eu não tenho na mão (iPhone, Android de clientes): a pessoa abre esta tela, toca em "Copiar relatório" (ou "Enviar")
 * e manda o texto. Mostra o que costuma falhar fora do computador: instalado ou não, armazenamento persistente, localização, câmera, internet, fila.
 * Nada sai do aparelho por conta própria: o relatório só vai para quem a pessoa mandar. Não leva e-mail, senha, token nem coordenadas.
 * Usado pela tela #/conta/diagnostico (dentro do app) e por diagnostico.html (avulsa: funciona mesmo quando a pessoa não consegue entrar). */

import { esc } from './util.js';
import { tr } from './i18n.js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const nav = typeof navigator !== 'undefined' ? navigator : {};

/* ---------- O aparelho ---------- */

export function plataformaDoAparelho() {
  const ua = nav.userAgent || '';
  if (/iPhone|iPad|iPod/.test(ua) || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'outro';
}

export function versaoDoIos() {
  const ua = nav.userAgent || '';
  const m = /OS (\d+)[_.](\d+)(?:[_.](\d+))?/.exec(ua);
  if (m) return m[1] + '.' + m[2] + (m[3] ? '.' + m[3] : '');
  const v = /Version\/(\d+)\.(\d+)/.exec(ua);   // iPad que se apresenta como Mac
  return v ? v[1] + '.' + v[2] : '';
}

/* Em qual navegador a pessoa abriu: só o Safari e o Chrome do iPhone instalam o app na Tela de Início; o navegador de dentro do WhatsApp, do Instagram etc. não. */
export function navegadorDoAparelho() {
  const ua = nav.userAgent || '';
  if (/CriOS/.test(ua)) return 'Chrome';
  if (/FxiOS/.test(ua)) return 'Firefox';
  if (/EdgiOS/.test(ua)) return 'Edge';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Android/.test(ua) && /; wv\)|Version\/\d.*Chrome/.test(ua)) return 'embutido';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (plataformaDoAparelho() === 'ios') return /Safari\//.test(ua) && !/FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|TikTok/.test(ua) ? 'Safari' : 'embutido';
  return /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'outro';
}

export function instalado() {
  try { return !!(typeof matchMedia === 'function' && matchMedia('(display-mode: standalone)').matches) || nav.standalone === true; } catch { return false; }
}

/* ---------- Pequenas sondas ---------- */

const comTempo = (promessa, ms, motivo = 'tempo esgotado') => Promise.race([promessa, new Promise((_, no) => setTimeout(() => no(new Error(motivo)), ms))]);
const mb = (n) => (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB';
/* bruto = valor técnico (medida, endereço, idioma do aparelho): aparece como está, sem tradução. */
const item = (grupo, nome, valor, estado = 'info', dica = '', bruto = false) => ({ grupo, nome, valor: String(valor), estado, dica, bruto });

function insetsSeguros() {
  try {
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;top:0;left:0;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(d);
    const cs = getComputedStyle(d);
    const v = [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' / ');
    d.remove();
    return v;
  } catch { return '?'; }
}

/* Grava e lê no IndexedDB do aparelho. `valor` é o que se guarda; o app guarda foto como bytes e, por isso, a falha só de Blob é um aviso, não um erro. */
async function gravarNoBanco(valor) {
  const nomeBanco = 'kbt-diagnostico-teste';
  return comTempo(new Promise((ok, no) => {
    const r = indexedDB.open(nomeBanco, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('t');
    r.onerror = () => no(r.error || new Error('erro ao abrir'));
    r.onsuccess = () => {
      const db = r.result;
      try {
        const tx = db.transaction('t', 'readwrite');
        tx.objectStore('t').put(valor, 'a');
        tx.oncomplete = () => { db.close(); indexedDB.deleteDatabase(nomeBanco); ok(); };
        tx.onerror = () => { db.close(); no((tx.error && tx.error.message) || new Error('erro ao gravar')); };
        tx.onabort = () => { db.close(); no(new Error('gravação cancelada pelo aparelho')); };
      } catch (e) { db.close(); no(e); }
    };
  }), 8000);
}

async function sondarBancoDoAparelho(cofre) {
  if (typeof indexedDB === 'undefined') return [item('Armazenamento', 'Banco do aparelho (IndexedDB)', 'indisponível', 'erro', 'O ponto e as fotos guardados para enviar depois precisam dele.')];
  const saida = [];
  let bytesOk = false;
  try { await gravarNoBanco(new Uint8Array([1, 2, 3]).buffer); bytesOk = true; saida.push(item('Armazenamento', 'Banco do aparelho (IndexedDB)', 'grava e lê', 'ok')); }
  catch (e) { saida.push(item('Armazenamento', 'Banco do aparelho (IndexedDB)', 'falhou: ' + (e && e.message || e), 'erro', 'O ponto e as fotos guardados para enviar depois precisam dele.')); }
  if (bytesOk && typeof Blob !== 'undefined') {
    try { await gravarNoBanco(new Blob(['teste'], { type: 'image/jpeg' })); }
    catch { saida.push(item('Armazenamento', 'Foto como arquivo no banco do aparelho', 'não grava', 'atencao', 'Costuma ser aba privada do Safari: o app já guarda as fotos de outro jeito, mas o que está em aba privada some ao fechar. Use fora da aba privada.')); }
  }
  if (cofre) saida.push(item('Armazenamento', 'Onde o app guarda as fotos agora', cofre === 'banco' ? 'no banco do aparelho' : 'só na memória (somem ao fechar)', cofre === 'banco' ? 'ok' : 'atencao',
    cofre === 'banco' ? '' : 'O aparelho não deixou gravar no banco. Use fora da aba privada e com espaço livre; envie o que está esperando antes de fechar o app.'));
  return saida;
}

function sondarArmazenamentoLocal() {
  try { localStorage.setItem('kbt.diag', '1'); const ok = localStorage.getItem('kbt.diag') === '1'; localStorage.removeItem('kbt.diag'); return item('Armazenamento', 'Guardar preferências (localStorage)', ok ? 'grava e lê' : 'não leu', ok ? 'ok' : 'erro'); }
  catch (e) { return item('Armazenamento', 'Guardar preferências (localStorage)', 'bloqueado', 'erro', 'Sem isso o app não lembra do login nem do idioma. Em aba privada o iPhone bloqueia.'); }
}

/* Só a data em que a sessão guardada vence: nunca o conteúdo da sessão. */
function sondarSessao() {
  try {
    const bruto = localStorage.getItem('kbt.conta');
    if (!bruto) return item('Conta', 'Sessão guardada neste aparelho', 'não', 'info');
    const s = JSON.parse(bruto);
    const ate = s && s.expires_at ? new Date(s.expires_at * 1000) : null;
    return item('Conta', 'Sessão guardada neste aparelho', ate ? 'sim, renova até ' + ate.toISOString().slice(0, 16).replace('T', ' ') + ' UTC' : 'sim', 'ok');
  } catch { return item('Conta', 'Sessão guardada neste aparelho', 'ilegível', 'atencao'); }
}

/* ---------- A coleta ---------- */

/** Junta tudo o que dá para saber sem pedir nenhuma permissão. `conta` (opcional) traz o que só o app conhece: { usuario, perfil, pendentesDiario, pendentesPonto, cofre }. */
export async function coletar(conta = null) {
  const itens = [];
  const add = (...a) => itens.push(item(...a));
  const plat = plataformaDoAparelho();
  const inst = instalado();
  const navegador = navegadorDoAparelho();
  const ios = plat === 'ios';

  // Aparelho
  add('Aparelho', 'Sistema', ios ? 'iOS ' + (versaoDoIos() || '?') : plat === 'android' ? 'Android' : 'Computador ou outro', ios && Number(versaoDoIos().split('.')[0]) < 16 ? 'atencao' : 'info',
    ios && Number(versaoDoIos().split('.')[0]) < 16 ? 'iOS anterior ao 16.4: o app instalado perde recursos. Atualize o iPhone se puder.' : '');
  add('Aparelho', 'Navegador', navegador, navegador === 'embutido' ? 'atencao' : 'info',
    navegador === 'embutido' ? 'Aberto dentro de outro app (WhatsApp, Instagram…): não dá para instalar daqui. Abra o link no Safari.' : '');
  add('Aparelho', 'Instalado na Tela de Início', inst ? 'sim' : 'não', inst ? 'ok' : plat === 'outro' ? 'info' : 'atencao',
    inst || plat === 'outro' ? '' : ios ? 'Sem instalar, o iPhone pode apagar os dados do app depois de 7 dias sem uso (ponto e fotos ainda não enviados). Toque em Compartilhar e em "Adicionar à Tela de Início".' : 'No Chrome: ⋮ e "Instalar app".');
  add('Aparelho', 'Tela', (screen.width || '?') + '×' + (screen.height || '?') + ' · janela ' + innerWidth + '×' + innerHeight + ' · ×' + (devicePixelRatio || 1) + (nav.maxTouchPoints ? ' · toque' : ''), 'info', '', true);
  add('Aparelho', 'Áreas seguras (entalhe)', insetsSeguros(), 'info', '', true);
  add('Aparelho', 'Idioma e fuso', (nav.language || '?') + ' · ' + (Intl.DateTimeFormat().resolvedOptions().timeZone || '?'), 'info', '', true);

  // App
  let versao = '?';
  try { const ks = await comTempo(caches.keys(), 4000); versao = (ks.find((k) => /^korbuild-v\d+$/.test(k)) || '(sem cópia guardada)'); } catch { versao = '(cache indisponível)'; }
  add('App', 'Versão do app', versao, /^korbuild-v/.test(versao) ? 'info' : 'atencao');
  add('App', 'Endereço', location.origin + location.pathname, 'info', '', true);
  try {
    const reg = 'serviceWorker' in nav ? await comTempo(nav.serviceWorker.getRegistration(), 4000) : null;
    add('App', 'Funciona sem internet (service worker)', reg ? (nav.serviceWorker.controller ? 'ativo e controlando esta página' : 'registrado, ainda não controla esta página (feche e abra o app)') : ('serviceWorker' in nav ? 'não registrado' : 'indisponível'),
      reg && nav.serviceWorker.controller ? 'ok' : 'atencao');
  } catch { add('App', 'Funciona sem internet (service worker)', 'não respondeu', 'atencao'); }

  // Armazenamento
  itens.push(sondarArmazenamentoLocal());
  itens.push(...(await sondarBancoDoAparelho(conta && conta.cofre)));
  try {
    const persistente = nav.storage && nav.storage.persisted ? await comTempo(nav.storage.persisted(), 4000) : null;
    add('Armazenamento', 'Armazenamento protegido contra limpeza', persistente === null ? 'o aparelho não informa' : persistente ? 'sim' : 'não',
      persistente || inst ? 'ok' : ios ? 'atencao' : 'info', persistente || inst || !ios ? '' : 'Normal no Safari fora da Tela de Início: o iOS pode limpar. Instalado, o app fica protegido.');
    if (nav.storage && nav.storage.estimate) { const e = await comTempo(nav.storage.estimate(), 4000); add('Armazenamento', 'Espaço usado pelo app', mb(e.usage || 0) + ' de ' + mb(e.quota || 0), 'info', '', true); }
  } catch { add('Armazenamento', 'Armazenamento protegido contra limpeza', 'não respondeu', 'info'); }

  // Conexão
  add('Conexão', 'Aparelho diz que está online', nav.onLine === false ? 'não' : 'sim', nav.onLine === false ? 'atencao' : 'ok');
  if (nav.connection) add('Conexão', 'Tipo de rede', [nav.connection.effectiveType, nav.connection.saveData ? 'economia de dados' : ''].filter(Boolean).join(' · ') || '?', 'info', '', true);
  try {
    const t0 = performance.now();
    const r = await comTempo(fetch(SUPABASE_URL + '/auth/v1/health', { headers: { apikey: SUPABASE_ANON_KEY }, cache: 'no-store' }), 8000);
    add('Conexão', 'Alcança o servidor do KORbuild', 'sim (' + r.status + ', ' + Math.round(performance.now() - t0) + ' ms)', r.status < 500 ? 'ok' : 'atencao');
  } catch (e) { add('Conexão', 'Alcança o servidor do KORbuild', 'não (' + (e && e.message || 'erro') + ')', nav.onLine === false ? 'info' : 'erro', 'Sem isso o ponto e o diário ficam na fila do aparelho até voltar.'); }

  // Permissões (só consulta; nada é pedido aqui)
  let geo = 'o aparelho não informa';
  try { if (nav.permissions && nav.permissions.query) geo = (await comTempo(nav.permissions.query({ name: 'geolocation' }), 3000)).state; } catch { /* Safari antigo */ }
  const nomeGeo = { granted: 'permitida', denied: 'negada', prompt: 'pergunta ao usar' }[geo] || geo;
  add('Permissões', 'Localização', nomeGeo, geo === 'denied' ? 'erro' : geo === 'granted' ? 'ok' : 'info',
    geo === 'denied' ? 'O ponto com a posição da obra precisa dela. Ajustes do iPhone → Privacidade → Serviços de Localização → Safari/KORbuild.' : '');
  add('Permissões', 'Foto (câmera)', 'pelo campo de arquivo do sistema', 'info', 'O app abre a câmera do próprio iPhone/Android; não precisa de permissão separada.');
  add('Permissões', 'Compartilhar relatório', nav.share ? 'sim' : 'só copiar');
  add('Permissões', 'Avisos no aparelho (push)', 'Notification' in globalThis ? Notification.permission : 'indisponível', 'info', 'O KORbuild avisa pelo sininho e por e-mail; não depende de push.');

  // Conta e fila
  itens.push(sondarSessao());
  if (conta) {
    if (conta.usuario) add('Conta', 'Usuário', conta.usuario + (conta.perfil ? ' · ' + conta.perfil : ''));
    add('Conta', 'Diários esperando para enviar', conta.pendentesDiario ?? '?', conta.pendentesDiario > 0 ? 'atencao' : 'ok', conta.pendentesDiario > 0 ? 'Ficam no aparelho até haver internet. Abra o app com sinal para enviar.' : '');
    add('Conta', 'Batidas de ponto esperando para enviar', conta.pendentesPonto ?? '?', conta.pendentesPonto > 0 ? 'atencao' : 'ok', conta.pendentesPonto > 0 ? 'Ficam no aparelho até haver internet. Abra o app com sinal para enviar.' : '');
  } else add('Conta', 'Fila de envio', 'abra pelo app (dentro da conta) para ver', 'info');

  return itens;
}

/* ---------- O que a pessoa testa na hora (resultado entra no relatório) ---------- */

const testes = [];   // { nome, valor, estado } feitos nesta abertura
export const testesFeitos = () => testes.slice();

export function testarLocalizacao() {
  return new Promise((ok) => {
    const t0 = performance.now();
    if (!nav.geolocation) { ok(item('Teste', 'Localização agora', 'o aparelho não tem', 'erro')); return; }
    nav.geolocation.getCurrentPosition(
      (p) => ok(item('Teste', 'Localização agora', 'ok · precisão ' + Math.round(p.coords.accuracy) + ' m · ' + Math.round((performance.now() - t0) / 100) / 10 + ' s', p.coords.accuracy > 200 ? 'atencao' : 'ok', p.coords.accuracy > 200 ? 'Precisão baixa: vá para o céu aberto e tente de novo.' : '')),
      (e) => ok(item('Teste', 'Localização agora', { 1: 'negada pela pessoa ou pelos Ajustes', 2: 'posição indisponível', 3: 'tempo esgotado (20 s)' }[e.code] || 'erro', 'erro')),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

export async function testarFoto(arquivo) {
  const t0 = performance.now();
  const tipo = arquivo.type || '(sem tipo)';
  let medidas = '';
  try {
    const bmp = await comTempo(createImageBitmap(arquivo), 15000, 'não decodificou');
    medidas = ' · ' + bmp.width + '×' + bmp.height; bmp.close && bmp.close();
  } catch (e) { return item('Teste', 'Foto da câmera', tipo + ' · ' + mb(arquivo.size) + ' · NÃO abriu (' + (e && e.message || 'erro') + ')', 'erro', 'O app não consegue usar esta foto.'); }
  const heic = /hei[cf]/i.test(tipo) || /\.hei[cf]$/i.test(arquivo.name || '');
  return item('Teste', 'Foto da câmera', tipo + ' · ' + mb(arquivo.size) + medidas + ' · abriu em ' + Math.round(performance.now() - t0) + ' ms', heic ? 'atencao' : 'ok', heic ? 'Veio em HEIC: o app só aceita JPEG, PNG e WebP.' : '');
}

/* ---------- O relatório em texto ---------- */

export function relatorioEmTexto(itens) {
  const todos = itens.concat(testes);
  const grupos = [];
  for (const i of todos) if (!grupos.includes(i.grupo)) grupos.push(i.grupo);
  const pontos = todos.filter((i) => i.estado === 'atencao' || i.estado === 'erro');
  const L = ['KORbuild · diagnóstico do aparelho', 'Gerado em ' + new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC', ''];
  L.push(pontos.length ? 'PONTOS DE ATENÇÃO (' + pontos.length + '):' : 'Nenhum ponto de atenção.');
  for (const p of pontos) L.push((p.estado === 'erro' ? '✖ ' : '▲ ') + p.nome + ': ' + p.valor + (p.dica ? ' — ' + p.dica : ''));
  for (const g of grupos) {
    L.push('', '[' + g + ']');
    for (const i of todos.filter((x) => x.grupo === g)) L.push((i.estado === 'ok' ? '✔ ' : i.estado === 'erro' ? '✖ ' : i.estado === 'atencao' ? '▲ ' : '· ') + i.nome + ': ' + i.valor);
  }
  L.push('', 'Agente: ' + (nav.userAgent || '?'));
  return L.join('\n');
}

/* ---------- A tela ---------- */

const MARCA = { ok: '✔', atencao: '▲', erro: '✖', info: '·' };

export function htmlDiagnostico(itens, aberto = true) {
  const todos = itens.concat(testes);
  const grupos = [];
  for (const i of todos) if (!grupos.includes(i.grupo)) grupos.push(i.grupo);
  const pontos = todos.filter((i) => i.estado === 'atencao' || i.estado === 'erro');
  return '<section class="cartao diag-resumo ' + (pontos.length ? 'diag-resumo-atencao' : 'diag-resumo-ok') + '" data-diag-resumo>' +
      '<h2 class="cartao-titulo">' + (pontos.length ? tr('{n} ponto(s) de atenção', { n: pontos.length }) : tr('Tudo certo neste aparelho')) + '</h2>' +
      (pontos.length ? '<ul class="diag-pontos">' + pontos.map((p) => '<li class="diag-' + p.estado + '"><b>' + esc(tr(p.nome)) + ':</b> ' + esc(tr(p.valor)) + (p.dica ? '<br><span class="mudo pequeno">' + esc(tr(p.dica)) + '</span>' : '') + '</li>').join('') + '</ul>' : '') +
      '<div class="btn-linha">' + (nav.share ? '<button type="button" class="btn btn-primario" data-diag="enviar">' + tr('Enviar relatório') + '</button>' : '') +
        '<button type="button" class="btn ' + (nav.share ? 'btn-contorno' : 'btn-primario') + '" data-diag="copiar">' + tr('Copiar relatório') + '</button>' +
        '<button type="button" class="btn btn-contorno" data-diag="atualizar">' + tr('Atualizar') + '</button></div>' +
      '<p class="mudo pequeno" data-diag-aviso aria-live="polite"></p>' +
    '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Teste na hora') + '</h2>' +
      '<p class="mudo pequeno">' + tr('O relatório não leva coordenadas, nome, e-mail nem senha. Os testes abaixo só aparecem no relatório depois de feitos.') + '</p>' +
      '<div class="btn-linha"><button type="button" class="btn btn-contorno" data-diag="geo">' + tr('Testar localização') + '</button>' +
        '<label class="btn btn-contorno diag-foto">' + tr('Testar foto da câmera') + '<input type="file" accept="image/*" capture="environment" data-diag-foto hidden></label></div></section>' +
    grupos.map((g) => '<section class="cartao"><h2 class="cartao-titulo">' + esc(tr(g)) + '</h2><dl class="lista-dados diag-lista">' +
      todos.filter((i) => i.grupo === g).map((i) => '<dt><span class="diag-ponto diag-' + i.estado + '" aria-hidden="true">' + MARCA[i.estado] + '</span> ' + esc(tr(i.nome)) + '</dt><dd>' + esc(i.bruto ? i.valor : tr(i.valor)) + '</dd>').join('') + '</dl></section>').join('') +
    '<details class="cartao diag-agente"><summary>' + tr('Texto completo do relatório') + '</summary><textarea class="diag-texto" readonly rows="14" aria-label="' + esc(tr('Texto completo do relatório')) + '">' + esc(relatorioEmTexto(itens)) + '</textarea></details>';
}

/** Monta a tela dentro de `raiz` e liga os botões. `obterConta` devolve o que só o app sabe (usuário, fila) ou null. */
export async function iniciarDiagnostico(raiz, obterConta = () => null) {
  if (!raiz) return;
  let itens = [];
  const desenhar = () => { raiz.innerHTML = htmlDiagnostico(itens); };
  const atualizar = async () => {
    raiz.innerHTML = '<p class="mudo" role="status">' + esc(tr('Coletando…')) + '</p>';
    itens = await coletar(await obterConta());
    desenhar();
  };
  const aviso = (texto) => { const el = raiz.querySelector('[data-diag-aviso]'); if (el) el.textContent = texto; };
  raiz.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-diag]');
    if (!b) return;
    const acao = b.dataset.diag;
    if (acao === 'atualizar') { testes.length = 0; await atualizar(); }
    else if (acao === 'copiar') {
      const texto = relatorioEmTexto(itens);
      try { await nav.clipboard.writeText(texto); aviso(tr('Relatório copiado. Cole na conversa e envie.')); }
      catch {
        const area = raiz.querySelector('.diag-texto');
        const det = raiz.querySelector('.diag-agente');
        if (det) det.open = true;
        if (area) { area.focus(); area.select(); }
        aviso(tr('Não consegui copiar sozinho: o texto está selecionado abaixo. Toque e segure para copiar.'));
      }
    } else if (acao === 'enviar') {
      try { await nav.share({ title: 'KORbuild · diagnóstico', text: relatorioEmTexto(itens) }); } catch { /* a pessoa fechou a folha de compartilhar */ }
    } else if (acao === 'geo') {
      b.disabled = true; b.textContent = tr('Procurando a posição…');
      testes.push(await testarLocalizacao());
      desenhar();
    }
  });
  raiz.addEventListener('change', async (ev) => {
    const campo = ev.target.closest('[data-diag-foto]');
    if (!campo || !campo.files || !campo.files[0]) return;
    testes.push(await testarFoto(campo.files[0]));
    desenhar();
  });
  await atualizar();
}
