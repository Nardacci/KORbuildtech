/* KORbuild — aviso de atualização do app. O service worker baixa a versão nova sozinho; aqui a pessoa vê o que está acontecendo
 * (no iPhone o app instalado fica aberto por dias e a versão nova só aparece depois de fechar e abrir). Faixa fixa no topo, sem mexer na tela. */
import { tr } from './i18n.js';

function faixa() {
  let f = document.getElementById('aviso-atualizacao');
  if (!f) {
    f = document.createElement('div');
    f.id = 'aviso-atualizacao'; f.className = 'aviso-atualizacao'; f.setAttribute('role', 'status'); f.setAttribute('aria-live', 'polite');
    document.body.appendChild(f);
  }
  return f;
}
/* Baixando a versão nova (ainda não trocou). */
export function avisarBaixando() {
  const f = faixa();
  f.innerHTML = '<span class="aviso-atualizacao-giro" aria-hidden="true"></span><span>' + tr('Baixando a versão nova do KORbuild…') + '</span>';
}
/* A versão nova assumiu: o app vai recarregar. */
export function avisarAtualizando() {
  const f = faixa();
  f.innerHTML = '<span class="aviso-atualizacao-giro" aria-hidden="true"></span><span>' + tr('Atualizando o app… um instante.') + '</span>';
}
/* A pessoa está preenchendo algo: não recarrega sozinho, oferece o botão. */
export function avisarPronta(recarregar) {
  const f = faixa();
  f.innerHTML = '<span>' + tr('Versão nova do KORbuild pronta.') + '</span><button type="button" class="btn btn-pequeno btn-primario" id="atualizar-agora">' + tr('Atualizar agora') + '</button>';
  const b = f.querySelector('#atualizar-agora'); if (b) b.addEventListener('click', recarregar);
}
export function esconderAviso() { const f = document.getElementById('aviso-atualizacao'); if (f) f.remove(); }
