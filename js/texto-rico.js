/* KORbuild — texto formatado (estilo Word) para o escopo do projeto.
 * O texto é guardado como HTML simples e SEMPRE limpo: só ficam as marcações abaixo, nada de scripts, estilos ou classes.
 *   negrito, itálico, sublinhado, títulos, listas, recuo, alinhamento e link. */

import { esc } from './util.js';
import { tr } from './i18n.js';

const MAX = 20000;
const BLOCOS = new Set(['P', 'H2', 'H3', 'LI', 'BLOCKQUOTE']);
const SIMPLES = { B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u' };
const ALINHA = /^(left|center|right|justify)$/;
const LINK = /^(https?:|mailto:|tel:)/i;

function limparNo(no, doc) {
  let saida = '';
  for (const f of Array.from(no.childNodes)) {
    if (f.nodeType === 3) { saida += esc(f.textContent.replace(/\u00A0/g, ' ')); continue; }
    if (f.nodeType !== 1) continue;
    const t = f.nodeName;
    if (t === 'SCRIPT' || t === 'STYLE' || t === 'IFRAME' || t === 'OBJECT') continue;
    const dentro = limparNo(f, doc);
    if (t === 'BR') { saida += '<br>'; continue; }
    if (SIMPLES[t]) { saida += dentro ? '<' + SIMPLES[t] + '>' + dentro + '</' + SIMPLES[t] + '>' : ''; continue; }
    if (t === 'UL' || t === 'OL') { saida += '<' + t.toLowerCase() + '>' + dentro + '</' + t.toLowerCase() + '>'; continue; }
    if (t === 'A') {
      const h = (f.getAttribute('href') || '').trim();
      saida += LINK.test(h) ? '<a href="' + esc(h) + '" target="_blank" rel="noopener noreferrer">' + dentro + '</a>' : dentro;
      continue;
    }
    if (t === 'DIV' && !/<(p|h2|h3|ul|ol|blockquote)\b/.test(dentro)) { saida += dentro.trim() ? '<p>' + dentro + '</p>' : ''; continue; }
    if (BLOCOS.has(t)) {
      const tag = t.toLowerCase();
      const al = ALINHA.test(f.style && f.style.textAlign) ? ' style="text-align:' + f.style.textAlign + '"' : '';
      saida += '<' + tag + al + '>' + dentro + '</' + tag + '>';
      continue;
    }
    saida += dentro;   // span, font e o resto: fica só o texto e a formatação de dentro
  }
  return saida;
}

/* Limpa um HTML qualquer (colado do Word, digitado no editor, vindo do banco). */
export function limparHtml(entrada) {
  const bruto = String(entrada == null ? '' : entrada);
  if (typeof DOMParser === 'undefined') return esc(bruto.replace(/<[^>]*>/g, ''));
  const doc = new DOMParser().parseFromString('<body>' + bruto + '</body>', 'text/html');
  const html = limparNo(doc.body, doc).replace(/<(p|h2|h3|li)([^>]*)><\/\1>/g, '').trim();
  return html.length > MAX ? html.slice(0, MAX) : html;
}

const TEM_MARCA = /<(p|br|ul|ol|li|h2|h3|b|strong|i|em|u|a|blockquote|div|span)[\s>/]/i;

/* O escopo como HTML limpo, venha ele como texto simples (antigo) ou formatado. */
export function escopoHtml(valor) {
  const v = String(valor == null ? '' : valor);
  if (!v.trim()) return '';
  if (TEM_MARCA.test(v)) return limparHtml(v);
  return v.split(/\n{2,}/).map((par) => par.trim()).filter(Boolean).map((par) => '<p>' + esc(par).replace(/\n/g, '<br>') + '</p>').join('');
}

/* O escopo só como texto (para resumos), com um limite de caracteres. */
export function escopoTexto(valor, limite) {
  const h = escopoHtml(valor);
  if (!h) return '';
  let t;
  if (typeof DOMParser === 'undefined') t = h.replace(/<[^>]*>/g, ' ');
  else { const d = new DOMParser().parseFromString('<body>' + h.replace(/<\/(p|h2|h3|li|blockquote)>/g, ' </$1>').replace(/<br>/g, ' ') + '</body>', 'text/html'); t = d.body.textContent; }
  t = t.replace(/\s+/g, ' ').trim();
  return limite && t.length > limite ? t.slice(0, limite).trim() + '…' : t;
}

/* ---------- O editor ---------- */

const BOTOES = () => [
  [['negrito', 'B', tr('Negrito')], ['italico', 'I', tr('Itálico')], ['sublinhado', 'U', tr('Sublinhado')]],
  [['h2', 'H1', tr('Título')], ['h3', 'H2', tr('Subtítulo')], ['p', '¶', tr('Parágrafo normal')]],
  [['ul', '•', tr('Lista com marcadores')], ['ol', '1.', tr('Lista numerada')], ['recuar-menos', '⇤', tr('Diminuir recuo')], ['recuar-mais', '⇥', tr('Aumentar recuo')]],
  [['esquerda', '≡', tr('Alinhar à esquerda')], ['centro', '☰', tr('Centralizar')], ['direita', '≣', tr('Alinhar à direita')], ['justificar', '▤', tr('Justificar')]],
  [['link', '🔗', tr('Inserir link')], ['sem-link', '⛓', tr('Tirar o link')]],
  [['desfazer', '↶', tr('Desfazer')], ['refazer', '↷', tr('Refazer')], ['limpar', 'Tx', tr('Limpar formatação')]],
];

export function htmlEditorRico({ id, valor, placeholder }) {
  return '<div class="rt" data-rt-id="' + id + '"><div class="rt-barra" role="toolbar" aria-label="' + esc(tr('Formatação do texto')) + '">' +
    BOTOES().map((g) => '<span class="rt-grupo">' + g.map(([k, rot, dica]) => '<button type="button" class="rt-btn rt-' + k + '" data-rt="' + k + '" title="' + esc(dica) + '" aria-label="' + esc(dica) + '">' + esc(rot) + '</button>').join('') + '</span>').join('') +
    '</div><div id="' + id + '" class="rt-editor" contenteditable="true" role="textbox" aria-multiline="true" aria-label="' + esc(tr('Escopo')) + '" data-placeholder="' + esc(placeholder || '') + '">' + escopoHtml(valor) + '</div></div>';
}

/* O que está escrito no editor, já limpo. */
export function valorDoEditor(id) {
  const ed = document.getElementById(id);
  return ed ? limparHtml(ed.innerHTML) : null;
}

const COMANDOS = {
  negrito: ['bold'], italico: ['italic'], sublinhado: ['underline'], ul: ['insertUnorderedList'], ol: ['insertOrderedList'],
  'recuar-menos': ['outdent'], 'recuar-mais': ['indent'], esquerda: ['justifyLeft'], centro: ['justifyCenter'], direita: ['justifyRight'], justificar: ['justifyFull'],
  desfazer: ['undo'], refazer: ['redo'], 'sem-link': ['unlink'],
  h2: ['formatBlock', 'h2'], h3: ['formatBlock', 'h3'], p: ['formatBlock', 'p'],
};

if (typeof document !== 'undefined') {
  // o clique no botão não pode tirar a seleção do texto
  document.addEventListener('mousedown', (ev) => { if (ev.target.closest && ev.target.closest('.rt-btn')) ev.preventDefault(); });
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.rt-btn');
    if (!b) return;
    const ed = b.closest('.rt').querySelector('.rt-editor');
    ed.focus();
    const k = b.dataset.rt;
    if (k === 'link') {
      const url = window.prompt(tr('Endereço do link (começa com https://)'), 'https://');
      if (url && LINK.test(url.trim())) document.execCommand('createLink', false, url.trim());
      return;
    }
    if (k === 'limpar') { document.execCommand('removeFormat'); document.execCommand('formatBlock', false, 'p'); return; }
    const c = COMANDOS[k];
    if (c) document.execCommand(c[0], false, c[1] || null);
  });
  // colar (do Word, de uma página…): entra só a formatação permitida
  document.addEventListener('paste', (ev) => {
    const ed = ev.target.closest && ev.target.closest('.rt-editor');
    if (!ed) return;
    ev.preventDefault();
    const cd = ev.clipboardData;
    const html = cd.getData('text/html');
    const limpo = html ? limparHtml(html) : escopoHtml(cd.getData('text/plain'));
    document.execCommand('insertHTML', false, limpo);
  });
}
