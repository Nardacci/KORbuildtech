/* KORbuild — o aviso "instale no celular" (docs/iphone.md).
 * O app roda como PWA: no iPhone não há botão automático de instalar, e fora da Tela de Início o Safari pode apagar o que o app guardou depois de 7 dias sem uso
 * (ponto e fotos que ainda não subiram). Por isso, quem abre pelo celular sem instalar vê este aviso, com o passo a passo certo para o aparelho.
 * "Agora não" esconde por 14 dias. Quem já instalou nunca vê. */

import { esc } from './util.js';
import { tr } from './i18n.js';
import { plataformaDoAparelho, navegadorDoAparelho, instalado } from './diagnostico.js';

const CHAVE = 'kbt.instalar.dispensado';
const QUATORZE_DIAS = 14 * 86400000;

function dispensado() {
  try { const t = Number(localStorage.getItem(CHAVE)); return !!t && Date.now() - t < QUATORZE_DIAS; } catch { return false; }
}
export function dispensarAviso() { try { localStorage.setItem(CHAVE, String(Date.now())); } catch { /* sem armazenamento: o aviso volta na próxima abertura */ } }

/** O que mostrar a este aparelho: 'ios' (Safari/Chrome), 'embutido' (navegador de dentro de outro app), 'android' ou '' (nada: já instalado, computador ou dispensado). */
export function situacaoDeInstalacao() {
  if (instalado() || dispensado()) return '';
  const plat = plataformaDoAparelho();
  if (plat === 'outro') return '';
  if (navegadorDoAparelho() === 'embutido') return 'embutido';
  return plat;
}

export function htmlAvisoInstalar() {
  const s = situacaoDeInstalacao();
  if (!s) return '';
  const texto = {
    ios: '<b>' + tr('Instale o KORbuild no seu iPhone') + '</b><span>' + tr('Toque em Compartilhar (o quadrado com a seta para cima) e depois em "Adicionar à Tela de Início". Sem instalar, o iPhone pode apagar o que o app guardou (ponto e fotos ainda não enviados) depois de 7 dias sem uso.') + '</span>',
    android: '<b>' + tr('Instale o KORbuild no seu celular') + '</b><span>' + tr('No Chrome, toque nos três pontinhos (⋮) e em "Instalar app" ou "Adicionar à tela inicial". Instalado, abre em tela cheia e guarda melhor o que ainda não foi enviado.') + '</span>',
    embutido: '<b>' + tr('Abra o KORbuild no navegador do celular') + '</b><span>' + tr('Você abriu o link dentro de outro app (WhatsApp, Instagram…), que não deixa instalar. Toque nos três pontinhos ou no ícone de bússola e escolha "Abrir no Safari" (ou no Chrome).') + '</span>',
  }[s];
  return '<section class="aviso aviso-ambar aviso-instalar" role="note">' + texto +
    '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="instalar-dispensar">' + esc(tr('Agora não')) + '</button></div></section>';
}

export const acoesInstalar = {
  'instalar-dispensar'(el) { dispensarAviso(); const caixa = el.closest('.aviso-instalar'); if (caixa) caixa.remove(); },
};
