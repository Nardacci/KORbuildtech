/* KORbuild — utilidades de texto, datas, ids, hash e interface (toast e diálogo).
 * Datas, horas e números saem no formato do idioma escolhido (js/i18n.js). */

import { tr, emIngles } from './i18n.js';

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function novoId(prefixo) {
  return prefixo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ---------- Datas (sempre no fuso do aparelho) ---------- */

export function isoDoDia(data) {
  const d = data || new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function hoje() { return isoDoDia(new Date()); }

export function somarDias(iso, dias) {
  const [a, m, d] = iso.split('-').map(Number);
  return isoDoDia(new Date(a, m - 1, d + dias));
}

export function diasEntre(isoA, isoB) {
  const [a1, m1, d1] = isoA.split('-').map(Number);
  const [a2, m2, d2] = isoB.split('-').map(Number);
  return Math.round((new Date(a2, m2 - 1, d2) - new Date(a1, m1 - 1, d1)) / 86400000);
}

const SEMANA = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEK = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dataDeIso(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d);
}

/* 07/10/2026 (pt) · 10/07/2026 (en) */
export function dataCurta(iso) {
  const [a, m, d] = iso.split('-');
  return emIngles() ? m + '/' + d + '/' + a : d + '/' + m + '/' + a;
}

/* Dia e mês sem o ano: 07/10 (pt) · 10/07 (en) */
export function diaMes(iso) {
  const [, m, d] = iso.split('-');
  return emIngles() ? m + '/' + d : d + '/' + m;
}

/* quarta-feira, 7 de outubro (pt) · Wednesday, October 7 (en) */
export function dataLonga(iso) {
  const d = dataDeIso(iso);
  return emIngles() ? WEEK[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate() : SEMANA[d.getDay()] + ', ' + d.getDate() + ' de ' + MESES[d.getMonth()];
}

export function diaDaSemana(iso) { return (emIngles() ? WEEK : SEMANA)[dataDeIso(iso).getDay()]; }
export function nomeDoMes(m) { return (emIngles() ? MONTHS : MESES)[m]; }

export function dataRelativa(iso) {
  const n = diasEntre(iso, hoje());
  if (n === 0) return tr('Hoje');
  if (n === 1) return tr('Ontem');
  return dataCurta(iso);
}

/* 16:30 (pt) · 4:30 PM (en) */
export function horaCurta(ts) {
  const d = new Date(ts);
  const mm = String(d.getMinutes()).padStart(2, '0');
  if (emIngles()) return ((d.getHours() + 11) % 12 + 1) + ':' + mm + ' ' + (d.getHours() < 12 ? 'AM' : 'PM');
  return String(d.getHours()).padStart(2, '0') + ':' + mm;
}

/* Hora cheia: 18h (pt) · 6 PM (en) */
export function horaCheia(h) { return emIngles() ? ((h + 11) % 12 + 1) + (h < 12 ? ' AM' : ' PM') : h + 'h'; }

/* Sempre 24 h (arquivos para outros sistemas, como o CSV da folha). */
export function hora24(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function dataHora(ts) {
  return tr('{data} às {hora}', { data: dataCurta(isoDoDia(new Date(ts))), hora: horaCurta(ts) });
}

/* Número decimal no formato do idioma: 1,5 (pt) · 1.5 (en) */
export function decimal(v, casas) {
  const s = Number(v).toFixed(casas);
  return emIngles() ? s : s.replace('.', ',');
}

/* Número como está (sem casas fixas), com a vírgula ou o ponto do idioma: 1,5 (pt) · 1.5 (en) */
export function numTexto(v) { return emIngles() ? String(v) : String(v).replace('.', ','); }

/* Distância: 850 m / 1,2 km (pt) · 2,790 ft / 0.7 mi (en) */
export function distancia(m) {
  if (emIngles()) return m < 300 ? Math.round(m * 3.28084).toLocaleString('en-US') + ' ft' : (m / 1609.34).toFixed(1) + ' mi';
  return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m';
}

/* Clima: guardado em °C e mm (Open-Meteo); nos EUA, mostrado em °F e polegadas. */
export function temperatura(c) { return emIngles() ? Math.round(c * 9 / 5 + 32) + ' °F' : c + ' °C'; }
export function chuva(mm) { return emIngles() ? (mm / 25.4).toFixed(2) + ' in' : String(mm).replace('.', ',') + ' mm'; }

export function tamanho(bytes) {
  if (bytes >= 1048576) return decimal(bytes / 1048576, 1) + ' MB';
  return Math.max(1, Math.round(bytes / 1024)) + ' KB';
}

export function coordenadas(lat, lon) {
  return lat.toFixed(5) + ', ' + lon.toFixed(5);
}

/* ---------- Hash SHA-256 (impressão digital de fotos e do documento aprovado) ---------- */

export async function sha256(dados) {
  const bytes = typeof dados === 'string' ? new TextEncoder().encode(dados) : new Uint8Array(dados);
  if (globalThis.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Sem HTTPS o navegador não libera o crypto.subtle; o protótipo usa um hash simples só para não quebrar.
  let h1 = 0x811c9dc5, h2 = 0x01000193;
  for (let i = 0; i < bytes.length; i++) {
    h1 = Math.imul(h1 ^ bytes[i], 16777619) >>> 0;
    h2 = Math.imul(h2 + bytes[i], 2246822519) >>> 0;
  }
  return (h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).repeat(4);
}

/* ---------- Toast ---------- */

let toastTimer;
export function toast(mensagem) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = mensagem;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3200);
}

/* ---------- Diálogo ----------
 * abrirDialogo({ titulo, corpo, acoes: [{ rotulo, valor, classe }] }) → Promise com
 * { valor, campos } (campos = valores dos inputs com name), ou null se fechar. */
export function abrirDialogo({ titulo, corpo, acoes }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'dialogo';
    dlg.innerHTML =
      '<form method="dialog">' +
      '<h2>' + esc(titulo) + '</h2>' +
      '<div class="dialogo-corpo">' + corpo + '</div>' +
      '<div class="dialogo-acoes">' +
      acoes.map((a, i) => '<button class="btn ' + (a.classe || 'btn-contorno') + '" value="' + i + '">' + esc(a.rotulo) + '</button>').join('') +
      '</div></form>';
    document.body.appendChild(dlg);
    let resultado = null;
    dlg.querySelector('form').addEventListener('submit', (ev) => {
      const i = Number(ev.submitter && ev.submitter.value);
      const campos = {};
      dlg.querySelectorAll('[name]').forEach((c) => {
        // Opções de escolha (radio/checkbox) só contam quando marcadas.
        if ((c.type === 'radio' || c.type === 'checkbox') && !c.checked) return;
        campos[c.name] = c.value;
      });
      resultado = { valor: acoes[i] ? acoes[i].valor : null, campos };
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(resultado); });
    dlg.showModal();
    const foco = dlg.querySelector('textarea, input');
    if (foco) foco.focus();
  });
}

export async function confirmar(titulo, texto, rotuloSim, classeSim) {
  const r = await abrirDialogo({
    titulo,
    corpo: '<p>' + esc(texto) + '</p>',
    acoes: [{ rotulo: tr('Voltar'), valor: false }, { rotulo: rotuloSim, valor: true, classe: classeSim || 'btn-primario' }],
  });
  return !!(r && r.valor);
}
