/* KORbuild — idioma da interface (docs/i18n.md).
 *
 *  - O produto é em inglês (padrão); o português fica como opção (botão PT/EN no login e no menu do usuário).
 *  - O texto no código é o português; o dicionário em js/i18n-en.js dá o inglês de cada frase.
 *    tr('Aprovar e lacrar') → 'Approve and seal'. Variáveis entre chaves: tr('Olá, {nome}', { nome }).
 *  - Frase sem tradução aparece em português e entra em window.kbtSemTraducao (o teste em inglês acusa).
 *  - A escolha fica no aparelho (localStorage 'kbt.idioma'), como uma preferência de quem usa. */

import { EN } from './i18n-en.js';

const CHAVE = 'kbt.idioma';
export const IDIOMAS = { en: 'English', pt: 'Português' };

function lerPreferencia() {
  try { return localStorage.getItem(CHAVE) === 'pt' ? 'pt' : 'en'; } catch { return 'en'; }
}

let atual = lerPreferencia();
const semTraducao = new Set();
if (typeof window !== 'undefined') window.kbtSemTraducao = semTraducao;

export function idioma() { return atual; }
export function emIngles() { return atual === 'en'; }
export function locale() { return atual === 'pt' ? 'pt-BR' : 'en-US'; }

export function definirIdioma(i) {
  atual = i === 'pt' ? 'pt' : 'en';
  try { localStorage.setItem(CHAVE, atual); } catch { /* sem armazenamento: vale só nesta visita */ }
  if (typeof document !== 'undefined') document.documentElement.lang = atual === 'pt' ? 'pt-BR' : 'en';
}
if (typeof document !== 'undefined') document.documentElement.lang = atual === 'pt' ? 'pt-BR' : 'en';

export function tr(texto, vars) {
  let s = texto;
  if (atual === 'en') {
    if (Object.prototype.hasOwnProperty.call(EN, texto)) s = EN[texto];
    else if (texto) semTraducao.add(texto);
  }
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

/* Singular ou plural: tn(3, '{n} pessoa', '{n} pessoas') → '3 people'. */
export function tn(n, um, varios, vars) {
  return tr(n === 1 ? um : varios, { n, ...(vars || {}) });
}

/* Botões PT/EN (login e menu do usuário). */
export function htmlSeletorIdioma(extraClasse) {
  return '<div class="seletor-idioma' + (extraClasse ? ' ' + extraClasse : '') + '" role="group" aria-label="Language">' +
    ['en', 'pt'].map((i) => '<button type="button" data-acao="idioma" data-idioma="' + i + '" class="' + (i === atual ? 'ativo' : '') + '" aria-pressed="' + (i === atual) + '" title="' + IDIOMAS[i] + '">' + i.toUpperCase() + '</button>').join('') +
    '</div>';
}
