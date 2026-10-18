/* KORbuild — registro de localização durante a jornada (PONTO-GPS-01, RN-17), na conta de verdade.
 *
 * Com o app aberto e o ponto aberto (fora do intervalo), a posição do celular é gravada no aparelho e sobe junto com as
 * batidas: ao abrir o app, a cada 15 min na obra e a cada 5 min em deslocamento (empresas.configuracao.localizacao muda
 * isso, BD-07). Só de quem aceitou o aviso de localização, só do próprio celular e só GPS de verdade: sem GPS, nada.
 * Com o app fechado ou a tela bloqueada o navegador não grava; isso é do app nativo (docs/banco.md §11.6).
 * O banco confere tudo de novo (registrar_localizacoes): ponto fechado, intervalo e falta do aviso são recusados. */

import { estado, salvar } from './armazem.js';
import { hoje } from './util.js';
import { conta } from './conta.js';
import { jornada, REGISTRO_GPS_MIN, REGISTRO_MOVIMENTO_MIN } from './crew.js';

let abriuNestaSessao = false;
let gravando = false;
let timer = null;

const minutos = (chave, padrao) => {
  const c = (conta.empresa && conta.empresa.configuracao && conta.empresa.configuracao.localizacao) || {};
  const v = Number(c[chave]);
  return v > 0 ? v : padrao;
};

function posicaoDoGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    // sem resposta do celular (aviso de permissão que não aparece) o getCurrentPosition não termina: o limite evita travar o registro
    const limite = setTimeout(() => resolve(null), 12000);
    navigator.geolocation.getCurrentPosition(
      (p) => { clearTimeout(limite); resolve({ lat: p.coords.latitude, lon: p.coords.longitude, precisao: Math.round(p.coords.accuracy) }); },
      () => { clearTimeout(limite); resolve(null); },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  });
}

/* Grava um registro se for a hora. Devolve true quando gravou. */
export async function registrarLocalizacaoSePreciso() {
  const d = estado();
  if (gravando || !d || !d.oficial || !d.crew || !conta.membro || !conta.membro.funcionario_id) return false;
  const f = (d.funcionarios || []).find((x) => x.id === conta.membro.funcionario_id);
  if (!f || !f.avisoGps) return false;
  const j = jornada(f.id, hoje());
  if (!j.atual || j.atual.tipo === 'intervalo') return false;   // ponto fechado ou no intervalo: nada é gravado
  const meus = (d.crew.localizacoes || []).filter((l) => l.funcionarioId === f.id);
  const ultimaBatida = j.batidas.length ? j.batidas[j.batidas.length - 1].em : 0;
  const ultima = Math.max(ultimaBatida, ...meus.map((l) => l.em), 0);
  const espera = (j.atual.tipo === 'deslocamento' ? minutos('movimento_min', REGISTRO_MOVIMENTO_MIN) : minutos('obra_min', REGISTRO_GPS_MIN)) * 60000;
  const abrindo = !abriuNestaSessao;
  if (!abrindo && Date.now() - ultima < espera) return false;
  gravando = true;
  try {
    const p = await posicaoDoGps();
    if (!p) return false;
    // o ponto pode ter fechado enquanto o GPS respondia
    const j2 = jornada(f.id, hoje());
    if (!j2.atual || j2.atual.tipo === 'intervalo') return false;
    abriuNestaSessao = true;
    d.crew.localizacoes.push({ id: crypto.randomUUID(), funcionarioId: f.id, em: Date.now(), lat: p.lat, lon: p.lon, precisao: p.precisao, gatilho: abrindo ? 'app-aberto' : 'periodico', obraId: j2.atual.obraId });
    salvar();
    return true;
  } finally { gravando = false; }
}

/* Liga o relógio: confere a cada minuto e quando o app volta à tela. aoGravar() manda subir o que ficou no aparelho. */
export function ligarRegistroDeLocalizacao(aoGravar) {
  if (timer) return;
  const passo = async () => { if (await registrarLocalizacaoSePreciso() && aoGravar) aoGravar(); };
  timer = setInterval(() => { if (document.visibilityState === 'visible') passo(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') passo(); else abriuNestaSessao = false; });
  passo();
}
