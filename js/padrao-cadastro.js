/* KORbuild — o padrão das telas de cadastro (docs/telas-de-cadastro.md): cabeçalho com a ação principal, busca e filtros, grade e painel lateral.
 * Todas as telas de cadastro (Usuários, Perfis, Contatos, Funções…) montam o HTML com estes ajudantes e abrem a edição com abrirPainel (js/util.js),
 * para terem o mesmo visual e o mesmo comportamento: o botão do alto cria, "Editar" na linha abre o painel, a busca e os chips só escondem linhas. */

import { esc, dataHora } from './util.js';
import { tr } from './i18n.js';

export const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).slice(0, 2).map((x) => x.charAt(0).toUpperCase()).join('') || '?';

/* "hoje", "ontem", "há 3 dias" ou a data. */
export function quando(iso) {
  if (!iso) return '';
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5);
  return dias <= 0 ? tr('hoje') : dias === 1 ? tr('ontem') : dias < 30 ? tr('há {n} dias', { n: dias }) : dataHora(new Date(iso).getTime()).split(' ')[0];
}

/* Título, uma linha de explicação e os botões da página (o primário é a ação de criar). */
export const cabecalhoDePagina = (titulo, sub, botoes) => '<header class="pg-cab"><div><h2 class="pg-titulo">' + titulo + '</h2>' + (sub ? '<p class="mudo">' + sub + '</p>' : '') + '</div><div class="btn-linha">' + (botoes || '') + '</div></header>';
export const botaoCriar = (acao, rotulo, icone_) => '<button type="button" class="btn btn-primario" data-acao="' + acao + '">' + icone_ + '<span>' + rotulo + '</span></button>';

/* Busca + filtros. chips: [[filtro, rótulo, quantidade]], o primeiro é "Todos" (filtro ''); extras: outros filtros (filtroSelect) no mesmo lugar dos chips.
 * Uma única regra para todas as grades: a busca e os filtros só escondem linhas, sem recarregar nada, e valem a cada vez que a tela é desenhada. */
export const barraDeBusca = (placeholder, chips, extras) => '<div class="pg-barra"><div class="busca"><input type="search" id="grade-busca" placeholder="' + esc(placeholder) + '" aria-label="' + esc(placeholder) + '"></div>' +
  '<div class="pg-filtros">' + (chips && chips.length > 1 ? '<div class="chips-filtro" role="group" aria-label="' + esc(tr('Filtrar')) + '">' + chips.map(([f, r, n], i) => '<button type="button" class="chip-filtro' + (i === 0 ? ' ativo' : '') + '" data-filtro="' + esc(f) + '">' + r + ' <b>' + n + '</b></button>').join('') + '</div>' : '') + (extras || '') +
  '<span class="mudo pequeno pg-contagem" id="grade-contagem"></span></div></div>';
/* Um filtro em lista (para muitas opções): opcoes [[filtro, rótulo]], o filtro '' mostra tudo; inicial = o filtro escolhido ao abrir. */
export const filtroSelect = (rotulo, opcoes, inicial) => '<select class="filtro-select" data-filtro-select aria-label="' + esc(rotulo) + '">' + opcoes.map(([f, r]) => '<option value="' + esc(f) + '"' + (f === (inicial || '') ? ' selected' : '') + '>' + r + '</option>').join('') + '</select>';

/* A grade: linhas <tr data-linha data-texto="…" data-grupos="a b"> (texto = o que a busca procura; grupos = o que os chips filtram). */
export const atributosDeLinha = (texto, grupos) => ' data-linha data-texto="' + esc(String(texto).toLowerCase()) + '" data-grupos="' + esc((grupos || []).join(' ')) + '"';
export const gradeEmCartao = (classeTabela, cabecalhos, linhas, vazio) => '<section class="cartao grade-cartao"><div class="tabela-rolagem"><table class="tabela grade ' + classeTabela + '"><thead><tr>' + cabecalhos.map((h) => (Array.isArray(h) ? '<th class="' + h[1] + '">' + h[0] + '</th>' : '<th>' + h + '</th>')).join('') + '</tr></thead><tbody>' + (linhas || '') + '</tbody></table></div>' +
  '<p class="grade-vazio mudo" id="grade-vazio"' + (linhas ? ' hidden' : '') + '>' + (vazio || tr('Nada encontrado.')) + '</p></section>';

export const avatar = (nome, inativo) => '<span class="avatar' + (inativo ? ' inativo' : '') + '" aria-hidden="true">' + esc(iniciais(nome)) + '</span>';
export const campoPainel = (id, rotulo, html, dica) => '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + (dica ? '<span class="mudo pequeno">' + dica + '</span>' : '') + '</div>';

/* Lê os campos de dentro de um painel: { nome: valor }; caixas de marcação com o mesmo nome viram uma lista. (O painel já é um <form>: não aninhe outro.) */
export function lerCampos(raiz) {
  const r = {};
  raiz.querySelectorAll('[name]').forEach((c) => {
    if (c.type === 'checkbox') { if (c.checked) (r[c.name] = r[c.name] || []).push(c.value); return; }
    r[c.name] = c.value;
  });
  return r;
}

export function filtrarGrade() {
  const campo = document.getElementById('grade-busca');
  if (!campo) return;
  const termo = (campo.value || '').trim().toLowerCase();
  const chip = document.querySelector('.chip-filtro.ativo');
  const exigidos = [chip ? chip.dataset.filtro : ''].concat([...document.querySelectorAll('select[data-filtro-select]')].map((x) => x.value)).filter(Boolean);
  let visiveis = 0, total = 0;
  document.querySelectorAll('tr[data-linha]').forEach((linha) => {
    total++;
    const grupos = linha.dataset.grupos.split(' ');
    const ok = (!termo || linha.dataset.texto.includes(termo)) && exigidos.every((f) => grupos.includes(f));
    linha.hidden = !ok; if (ok) visiveis++;
  });
  const vazio = document.getElementById('grade-vazio');
  if (vazio && total) vazio.hidden = visiveis > 0;
  const cont = document.getElementById('grade-contagem');
  if (cont && total) cont.textContent = visiveis === 1 ? tr('1 resultado') : tr('{n} resultados', { n: visiveis });
}
if (typeof document !== 'undefined') {
  document.addEventListener('input', (ev) => { if (ev.target && ev.target.id === 'grade-busca') filtrarGrade(); });
  document.addEventListener('change', (ev) => { if (ev.target && ev.target.matches && ev.target.matches('select[data-filtro-select]')) filtrarGrade(); });
  document.addEventListener('click', (ev) => {
    const c = ev.target.closest && ev.target.closest('.chip-filtro');
    if (!c) return;
    document.querySelectorAll('.chip-filtro').forEach((x) => x.classList.toggle('ativo', x === c));
    filtrarGrade();
  });
}
