/* KORbuild — ícones de traço (24×24), usados em toda a plataforma. */

const P = {
  modulos: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  painel: '<path d="M3 13h8V3H3zM13 21h8V11h-8zM3 21h8v-6H3zM13 3v6h8V3z"/>',
  aprovacoes: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
  obras: '<path d="M3 21h18"/><path d="M5 21V7l7-4 7 4v14"/><path d="M9 21v-5h6v5"/><path d="M9 10h.01M15 10h.01"/>',
  hoje: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M9 15l2 2 4-4"/>',
  historico: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
  daily: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v4M16 3v4M8 11h8M8 15h5"/>',
  crew: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="15.5" r="4"/><path d="M17.5 13.5v2l1.4 1.2"/>',
  measure: '<path d="M3 17L17 3l4 4L7 21H3z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>',
  sair: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  conta: '<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M10 12h4M10 16h4"/>',
  recomecar: '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>',
  instalar: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>',
  voltar: '<path d="M15 18l-6-6 6-6"/>',
  seta: '<path d="M9 18l6-6-6-6"/>',
  mais: '<path d="M12 5v14M5 12h14"/>',
  baixar: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  olho: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  wifi: '<path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M2 9a15 15 0 0 1 20 0"/><path d="M12 20h.01"/>',
  semWifi: '<path d="M2 2l20 20"/><path d="M8.5 16a5 5 0 0 1 7 0M5 12.5a10 10 0 0 1 4.2-2.5M2 9a15 15 0 0 1 4.6-2.9M14.8 10.2A10 10 0 0 1 19 12.5M17.6 6.2A15 15 0 0 1 22 9"/><path d="M12 20h.01"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
};

export function icone(nome, tamanho) {
  const t = tamanho || 20;
  return '<svg class="ic" width="' + t + '" height="' + t + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[nome] || '') + '</svg>';
}

/* Marca KORbuild: monograma "K" num quadrado com canto cortado. */
export function marca(tamanho) {
  const t = tamanho || 28;
  return '<svg class="marca-k" width="' + t + '" height="' + t + '" viewBox="0 0 32 32" aria-hidden="true">' +
    '<path d="M4 4h18l6 6v18H4z" fill="currentColor"/>' +
    '<path d="M11 9v14M11 16.5L19 9M13.5 14.2L20 23" stroke="#fff" stroke-width="3" stroke-linecap="square" fill="none"/></svg>';
}

/* Logotipo: "KOR" em peso forte + "build" em peso leve. O símbolo K entra quando houver espaço
 * (barra superior, ícone do app); o logotipo completo leva o sobrescrito e a assinatura. */
export const ASSINATURA = ['Build better teams.', 'Run better operations.'];
export const SOBRESCRITO = 'Team operations platform';

export function logotipo(opcoes) {
  const o = opcoes || {};
  return '<span class="logo' + (o.classe ? ' ' + o.classe : '') + '">' +
    (o.simbolo ? marca(o.simbolo) : '') +
    '<span class="logo-texto" aria-label="KORbuild"><b>KOR</b><span>build</span></span></span>';
}
