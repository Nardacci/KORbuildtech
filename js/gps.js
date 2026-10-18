/* KORbuild — aviso "ligue o GPS" (docs/iphone.md). O ponto e as fotos levam a localização: sem GPS a batida vai para conferência e a foto sai com o local da obra.
 * O aviso aparece quando o celular recusou a localização (permissão negada) ou não respondeu há pouco, com o passo a passo certo para o aparelho
 * e um botão para tentar de novo. Nunca bloqueia nada: é só um recado no topo da tela. */

import { esc } from './util.js';
import { tr } from './i18n.js';
import { plataformaDoAparelho } from './diagnostico.js';
import { motivoDaFalhaDoGps, esquecerFalhaDoGps } from './fotos.js';

let permissao = '';   // 'granted' | 'denied' | 'prompt' | '' (o navegador não diz)

/** Pergunta ao navegador como está a permissão de localização; devolve true se mudou desde a última vez (a tela pode redesenhar). */
export async function verificarGps(aoMudar) {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return false;
    const st = await navigator.permissions.query({ name: 'geolocation' });
    const antes = permissao;
    permissao = st.state;
    if (!st.onchange) st.onchange = () => { permissao = st.state; if (aoMudar) aoMudar(); };
    return antes !== permissao;
  } catch { return false; }
}

export function gpsComProblema() {
  return permissao === 'denied' || ['negado', 'tempo'].includes(motivoDaFalhaDoGps());
}

export function htmlAvisoGps() {
  if (!gpsComProblema()) return '';
  const plat = plataformaDoAparelho();
  const negado = permissao === 'denied' || motivoDaFalhaDoGps() === 'negado';
  const passos = plat === 'ios'
    ? [tr('Abra Ajustes → Privacidade e Segurança → Serviços de Localização e ligue.'), tr('Role até Safari (ou KORbuild), toque e escolha "Ao Usar o App"; ligue a Localização Precisa.')]
    : plat === 'android'
      ? [tr('Puxe a barra de cima do celular e ligue a Localização (GPS).'), tr('Toque e segure o ícone do KORbuild → Informações do app → Permissões → Localização → "Permitir somente com o app em uso"; ligue "Usar localização precisa".')]
      : [tr('Clique no cadeado ao lado do endereço e permita a Localização para este site.')];
  return '<section class="aviso aviso-ambar aviso-gps" role="note"><b>' + tr(negado ? 'A localização está bloqueada' : 'O GPS não respondeu') + '</b>' +
    '<span>' + tr('Sem o GPS, o ponto vai para conferência e as fotos saem com o local da obra.') + '</span>' +
    '<ol class="passos-gps">' + passos.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ol>' +
    '<div class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="gps-tentar">' + esc(tr('Tentar de novo')) + '</button></div></section>';
}

/** O botão "Tentar de novo": pede a posição de verdade (isso também faz o celular mostrar o aviso de permissão, se ainda não negou de vez). */
export function acoesGps(redesenhar, avisar) {
  return {
    'gps-tentar'(el) {
      el.disabled = true;
      const fim = (ok) => { esquecerFalhaDoGps(); verificarGps().then(() => { if (redesenhar) redesenhar(); if (avisar) avisar(ok); }); };
      if (!navigator.geolocation) return fim(false);
      navigator.geolocation.getCurrentPosition(() => fim(true), () => fim(false), { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 });
    },
  };
}
