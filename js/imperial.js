/* KORbuild Measure — unidades imperiais (docs/measure-revisao.md §1.3).
 *
 * Regra de ouro: nada de fração nem de texto para calcular. Guardamos números:
 *   comprimento em polegadas, área em polegadas², volume em polegadas³.
 * Este arquivo é a camada de tradução: texto do usuário → polegadas → texto amigável.
 * As frações comuns (1/2 … 1/64") são exatas em ponto flutuante: não há perda ao guardar. */

export const POL_POR_PE = 12;
export const POL2_POR_PE2 = 144;
export const POL3_POR_PE3 = 1728;
export const PE3_POR_JARDA3 = 27;
export const PONTOS_POR_POL = 72; // unidade da página do PDF: 1 point = 1/72" do papel

/* ---------- Saída ---------- */

function mdc(a, b) { return b ? mdc(b, a % b) : a; }

/* 150.5 → 12'-6 1/2"   ·   6.5 → 6 1/2"   ·   0.5 → 1/2"   ·   144 → 12'-0"
 * Arredonda só para mostrar (padrão: 1/16"); o valor guardado não muda. */
export function formatarPesPolegadas(pol, den) {
  den = den || 16;
  if (!Number.isFinite(pol)) return '—';
  const sinal = pol < 0 ? '-' : '';
  const total = Math.round(Math.abs(pol) * den); // em 1/den de polegada
  const pes = Math.floor(total / (POL_POR_PE * den));
  let resto = total - pes * POL_POR_PE * den;
  const inteiras = Math.floor(resto / den);
  resto -= inteiras * den;
  let frac = '';
  if (resto) { const d = mdc(resto, den); frac = (resto / d) + '/' + (den / d); }
  if (!pes) return sinal + (inteiras ? inteiras + (frac ? ' ' + frac : '') : (frac || '0')) + '"';
  return sinal + pes + "'-" + inteiras + (frac ? ' ' + frac : '') + '"';
}

/* Números no formato do idioma da conta (hoje pt-BR; na versão final, en-US). */
let LOCALE = 'pt-BR';
export function definirLocale(l) { LOCALE = l; }
export function numero(v, casas) {
  return Number(v).toLocaleString(LOCALE, { minimumFractionDigits: casas || 0, maximumFractionDigits: casas || 0 });
}

export function pesLineares(pol) { return pol / POL_POR_PE; }
export function pesQuadrados(pol2) { return pol2 / POL2_POR_PE2; }
export function pesCubicos(pol3) { return pol3 / POL3_POR_PE3; }
export function jardasCubicas(pol3) { return pol3 / POL3_POR_PE3 / PE3_POR_JARDA3; }

export function formatarLinear(pol) { return numero(pesLineares(pol), 1) + ' lin ft'; }
export function formatarArea(pol2) { return numero(pesQuadrados(pol2), 0) + ' sq ft'; }
export function formatarVolume(pol3) { return numero(jardasCubicas(pol3), 1) + ' cu yd'; }

/* ---------- Entrada ---------- */

const NUM = '(\\d+(?:\\.\\d+)?|\\.\\d+)';

/* Polegadas com fração: "6", "6.5", "6 1/2", "6-1/2", "1/2" → número, ou null. */
function lerPolegadas(t) {
  t = t.trim();
  if (!t) return 0;
  let m = new RegExp('^' + NUM + '$').exec(t);
  if (m) return Number(m[1]);
  m = /^(?:(\d+)[\s-]+)?(\d+)\/(\d+)$/.exec(t);
  if (m) {
    const den = Number(m[3]);
    if (!den || Number(m[2]) >= den) return null;
    return (m[1] ? Number(m[1]) : 0) + Number(m[2]) / den;
  }
  return null;
}

/* Interpreta um comprimento digitado e devolve { pol } ou { erro }.
 * Aceita: 12'-6 1/2"  12' 6.5"  12'6"  12'  6"  6 1/2"  1/2"  150"  12.54'  12ft 6in  12 ft 6 1/2 in  12-6  12-6-1/2
 * Número sem unidade: pés (padrão do estimador americano), a não ser que se peça polegadas. */
export function interpretarComprimento(texto, semUnidade) {
  let t = String(texto || '').trim().toLowerCase()
    .replace(/[″“”]/g, '"').replace(/[′’‘`]/g, "'")
    .replace(/\s*(feet|foot|ft)\b\.?/g, "'").replace(/\s*(inches|inch|in)\b\.?/g, '"')
    .replace(/,/g, '.').replace(/\s+/g, ' ');
  if (!t) return { erro: 'Digite uma medida, ex.: 12\'-6 1/2"' };
  const neg = t.startsWith('-');
  if (neg) t = t.slice(1).trim();
  let pes = 0, pol = 0;
  const dash = /^(\d+)-(\d+)(?:-(\d+)\/(\d+))?$/.exec(t); // 12-6 ou 12-6-1/2 (pés-polegadas-fração)
  if (dash) {
    pes = Number(dash[1]);
    pol = Number(dash[2]) + (dash[3] ? Number(dash[3]) / Number(dash[4]) : 0);
  } else if (t.includes("'")) {
    const [a, ...resto] = t.split("'");
    if (resto.length > 1 || !new RegExp('^' + NUM + '$').test(a.trim())) return { erro: 'Não entendi os pés em "' + texto + '"' };
    pes = Number(a.trim());
    let b = resto.join('').trim().replace(/^-\s*/, '');
    if (b.endsWith('"')) b = b.slice(0, -1);
    else if (b && /"/.test(b)) return { erro: 'Não entendi as polegadas em "' + texto + '"' };
    const v = lerPolegadas(b);
    if (v == null) return { erro: 'Não entendi as polegadas em "' + texto + '"' };
    pol = v;
  } else if (t.endsWith('"')) {
    const v = lerPolegadas(t.slice(0, -1));
    if (v == null) return { erro: 'Não entendi as polegadas em "' + texto + '"' };
    pol = v;
  } else {
    const v = lerPolegadas(t);
    if (v == null) return { erro: 'Não entendi "' + texto + '". Use, por exemplo, 12\'-6 1/2"' };
    if (semUnidade === 'pol') pol = v; else pes = v;
  }
  if (pes && pol >= POL_POR_PE) return { erro: 'Com pés, as polegadas precisam ser menores que 12 (ex.: 13\'-2" em vez de 12\'-14")' };
  const total = pes * POL_POR_PE + pol;
  return { pol: neg ? -total : total };
}

/* Inclinação de telhado como o americano fala: "6/12", "6:12", "6 in 12" ou "6" (sobre 12).
 * Devolve a razão subida/avanço (6/12 → 0,5). */
export function interpretarInclinacao(texto) {
  const t = String(texto || '').trim().toLowerCase().replace(',', '.');
  let m = /^(\d+(?:\.\d+)?)\s*(?:\/|:|in)\s*(\d+(?:\.\d+)?)$/.exec(t);
  if (m && Number(m[2]) > 0) return { razao: Number(m[1]) / Number(m[2]) };
  m = /^(\d+(?:\.\d+)?)$/.exec(t);
  if (m) return { razao: Number(m[1]) / 12 };
  return { erro: 'Use a inclinação como 6/12' };
}
export function formatarInclinacao(razao) { return numero(razao * 12, razao * 12 % 1 ? 1 : 0) + '/12'; }
/* Fator para converter medida em planta para a medida real na água do telhado: √(1 + razão²). */
export function fatorInclinacao(razao) { return Math.sqrt(1 + (razao || 0) * (razao || 0)); }

/* ---------- Escalas de planta ---------- */

/* razao = polegadas reais por polegada de papel (1/4" = 1'-0" → 48). */
export const ESCALAS = [
  { grupo: 'Arquitetônica', nome: '1/16" = 1\'-0"', razao: 192 },
  { grupo: 'Arquitetônica', nome: '3/32" = 1\'-0"', razao: 128 },
  { grupo: 'Arquitetônica', nome: '1/8" = 1\'-0"', razao: 96 },
  { grupo: 'Arquitetônica', nome: '3/16" = 1\'-0"', razao: 64 },
  { grupo: 'Arquitetônica', nome: '1/4" = 1\'-0"', razao: 48 },
  { grupo: 'Arquitetônica', nome: '3/8" = 1\'-0"', razao: 32 },
  { grupo: 'Arquitetônica', nome: '1/2" = 1\'-0"', razao: 24 },
  { grupo: 'Arquitetônica', nome: '3/4" = 1\'-0"', razao: 16 },
  { grupo: 'Arquitetônica', nome: '1" = 1\'-0"', razao: 12 },
  { grupo: 'Arquitetônica', nome: '1-1/2" = 1\'-0"', razao: 8 },
  { grupo: 'Arquitetônica', nome: '3" = 1\'-0"', razao: 4 },
  { grupo: 'Engenharia', nome: '1" = 10\'', razao: 120 },
  { grupo: 'Engenharia', nome: '1" = 20\'', razao: 240 },
  { grupo: 'Engenharia', nome: '1" = 30\'', razao: 360 },
  { grupo: 'Engenharia', nome: '1" = 40\'', razao: 480 },
  { grupo: 'Engenharia', nome: '1" = 50\'', razao: 600 },
  { grupo: 'Engenharia', nome: '1" = 60\'', razao: 720 },
  { grupo: 'Engenharia', nome: '1" = 100\'', razao: 1200 },
];
/* Polegadas reais por point do PDF. */
export function polPorPontoDaEscala(razao) { return razao / PONTOS_POR_POL; }

/* ---------- Geometria (pontos em coordenadas da página do PDF) ---------- */

export function distancia(a, b) { return Math.hypot(b[0] - a[0], b[1] - a[1]); }
export function comprimento(pontos) {
  let t = 0;
  for (let i = 1; i < pontos.length; i++) t += distancia(pontos[i - 1], pontos[i]);
  return t;
}
/* Área de polígono pela fórmula de Shoelace (Gauss). Sempre positiva. */
export function areaPoligono(pontos) {
  let s = 0;
  for (let i = 0; i < pontos.length; i++) {
    const [x1, y1] = pontos[i], [x2, y2] = pontos[(i + 1) % pontos.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}
