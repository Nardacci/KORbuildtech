/* KORbuild Daily — fotos: GPS, carimbo de evidência e compressão no próprio aparelho. */

import { sha256, coordenadas, dataHora } from './util.js';

const LADO_MAXIMO = 1600;      // px no lado maior
const ALVO_BYTES = 320 * 1024; // ~300 KB por foto

/* ---------- GPS ---------- */

let ultimaPosicao = null;

/* Devolve { lat, lon, precisao, fonte: 'gps' | 'obra' }. Se o GPS não responder,
 * usa o centro da obra e deixa isso claro no carimbo. */
export function obterPosicao(obra) {
  if (ultimaPosicao && Date.now() - ultimaPosicao.em < 120000) return Promise.resolve(ultimaPosicao);
  return new Promise((resolve) => {
    const reserva = () => resolve({ lat: obra.lat, lon: obra.lon, precisao: null, fonte: 'obra' });
    if (!navigator.geolocation) return reserva();
    navigator.geolocation.getCurrentPosition(
      (p) => {
        ultimaPosicao = { lat: p.coords.latitude, lon: p.coords.longitude, precisao: Math.round(p.coords.accuracy), fonte: 'gps', em: Date.now() };
        resolve(ultimaPosicao);
      },
      reserva,
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 60000 }
    );
  });
}

/* ---------- Carimbo ---------- */

export function carimbar(ctx, largura, altura, { obraNome, quando, lat, lon, fonte }) {
  const base = Math.max(14, Math.round(largura / 52));
  const faixa = Math.round(base * 3.4);
  ctx.fillStyle = 'rgba(20, 27, 38, 0.74)';
  ctx.fillRect(0, altura - faixa, largura, faixa);
  ctx.fillStyle = '#F26A1B';
  ctx.fillRect(0, altura - faixa, Math.round(base * 0.35), faixa);
  const x = Math.round(base * 1.1);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 ' + base + 'px Inter, system-ui, sans-serif';
  ctx.fillText(obraNome + '  ·  ' + dataHora(quando), x, altura - faixa + Math.round(base * 1.45));
  ctx.font = '500 ' + Math.round(base * 0.82) + 'px Inter, system-ui, sans-serif';
  ctx.fillStyle = '#C9D1E0';
  const local = fonte === 'gps' ? 'GPS ' + coordenadas(lat, lon) : 'Local da obra ' + coordenadas(lat, lon) + ' (GPS indisponível)';
  ctx.fillText(local + '  ·  KORbuild Daily', x, altura - faixa + Math.round(base * 2.65));
}

function canvasParaBlob(canvas, qualidade) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', qualidade));
}

async function comprimir(canvas) {
  let qualidade = 0.8;
  let blob = await canvasParaBlob(canvas, qualidade);
  while (blob.size > ALVO_BYTES && qualidade > 0.45) {
    qualidade -= 0.08;
    blob = await canvasParaBlob(canvas, qualidade);
  }
  return blob;
}

/* Miniatura para listas: 320 px de largura, poucos KB. Feita da foto já carimbada. */
const LARGURA_MINIATURA = 320;
function miniatura(canvas) {
  const mini = document.createElement('canvas');
  mini.width = LARGURA_MINIATURA;
  mini.height = Math.round(canvas.height * LARGURA_MINIATURA / canvas.width);
  mini.getContext('2d').drawImage(canvas, 0, 0, mini.width, mini.height);
  return canvasParaBlob(mini, 0.7);
}

async function carregarImagem(arquivo) {
  if (window.createImageBitmap) {
    try { return await createImageBitmap(arquivo, { imageOrientation: 'from-image' }); } catch (e) { /* cai no <img> */ }
  }
  const url = URL.createObjectURL(arquivo);
  const img = new Image();
  img.src = url;
  await img.decode();
  URL.revokeObjectURL(url);
  return img;
}

/* Recebe o arquivo da câmera ou da galeria e devolve a foto pronta para o RDO. */
export async function processarFoto(arquivo, obra, daCamera) {
  const [imagem, posicao, hash] = await Promise.all([
    carregarImagem(arquivo),
    obterPosicao(obra),
    arquivo.arrayBuffer().then(sha256),
  ]);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
  const largura = Math.round(imagem.width * escala);
  const altura = Math.round(imagem.height * escala);
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imagem, 0, 0, largura, altura);
  // Foto da câmera: o momento é agora. Da galeria: a data do arquivo (quando foi tirada).
  const quando = daCamera ? Date.now() : (arquivo.lastModified || Date.now());
  carimbar(ctx, largura, altura, { obraNome: obra.nome, quando, lat: posicao.lat, lon: posicao.lon, fonte: posicao.fonte });
  const [blob, mini] = await Promise.all([comprimir(canvas), miniatura(canvas)]);
  return {
    blob,
    mini,
    meta: {
      tiradaEm: quando,
      origem: daCamera ? 'camera' : 'galeria',
      lat: posicao.lat,
      lon: posicao.lon,
      fonteGps: posicao.fonte,
      precisao: posicao.precisao,
      tamanhoOriginal: arquivo.size,
      tamanho: blob.size,
      largura,
      altura,
      hashOriginal: hash,
    },
  };
}

/* ---------- Fotos de exemplo (desenhadas, para a demonstração) ---------- */

const CENAS = {
  estrutura: { ceu: ['#7FB3E6', '#D8E9F7'], chao: '#9C8B74' },
  alvenaria: { ceu: ['#9DB8CF', '#E4ECF2'], chao: '#8E8170' },
  concreto: { ceu: ['#8AA6C1', '#DCE5EE'], chao: '#7D7A75' },
  galpao: { ceu: ['#A9C4DD', '#EEF3F7'], chao: '#A39276' },
};

export async function fotoDeExemplo({ cena, obra, quando, semente }) {
  const largura = 1200, altura = 900;
  const canvas = document.createElement('canvas');
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext('2d');
  const c = CENAS[cena] || CENAS.estrutura;
  let s = semente || 1;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };

  const ceu = ctx.createLinearGradient(0, 0, 0, altura * 0.65);
  ceu.addColorStop(0, c.ceu[0]);
  ceu.addColorStop(1, c.ceu[1]);
  ctx.fillStyle = ceu;
  ctx.fillRect(0, 0, largura, altura);
  ctx.fillStyle = c.chao;
  ctx.fillRect(0, altura * 0.68, largura, altura * 0.32);

  if (cena === 'galpao') {
    ctx.fillStyle = '#C9CDD2';
    ctx.fillRect(150, 330, 900, 300);
    ctx.fillStyle = '#5B6470';
    for (let x = 150; x <= 1050; x += 112) ctx.fillRect(x - 6, 300, 12, 330);
    ctx.fillStyle = '#7A838E';
    ctx.beginPath(); ctx.moveTo(130, 330); ctx.lineTo(600, 240); ctx.lineTo(1070, 330); ctx.closePath(); ctx.fill();
  } else {
    const andares = cena === 'alvenaria' ? 3 : 5;
    const x0 = 260 + rnd() * 80, w = 620, h = 82;
    for (let i = 0; i < andares; i++) {
      const y = altura * 0.68 - (i + 1) * h;
      ctx.fillStyle = '#A7A9AC';
      ctx.fillRect(x0, y + h - 14, w, 14); // laje
      ctx.fillStyle = '#8D9095';
      for (let p = 0; p <= 4; p++) ctx.fillRect(x0 + p * (w / 4) - 8, y, 16, h - 14); // pilares
      if (cena === 'alvenaria' || (cena === 'estrutura' && i < 2)) {
        ctx.fillStyle = '#B5652E';
        for (let b = 0; b < 4; b++) ctx.fillRect(x0 + b * (w / 4) + 10, y + 10, w / 4 - 20, h - 34);
        ctx.strokeStyle = 'rgba(255,255,255,0.25)';
        for (let l = y + 18; l < y + h - 24; l += 12) { ctx.beginPath(); ctx.moveTo(x0, l); ctx.lineTo(x0 + w, l); ctx.stroke(); }
      }
    }
    if (cena === 'concreto') {
      ctx.fillStyle = '#E08A1E';
      ctx.fillRect(80, altura * 0.68 - 130, 200, 110);
      ctx.fillStyle = '#D5D7DA';
      ctx.beginPath(); ctx.ellipse(230, altura * 0.68 - 120, 80, 55, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(130, altura * 0.68 - 15, 26, 0, Math.PI * 2); ctx.arc(250, altura * 0.68 - 15, 26, 0, Math.PI * 2); ctx.fill();
    }
    // grua
    ctx.strokeStyle = '#E8B21A';
    ctx.lineWidth = 12;
    ctx.beginPath(); ctx.moveTo(980, altura * 0.68); ctx.lineTo(980, 120); ctx.lineTo(560, 120); ctx.moveTo(980, 120); ctx.lineTo(1120, 120); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(700, 120); ctx.lineTo(700, 260); ctx.stroke();
  }
  // trabalhadores
  for (let i = 0; i < 3; i++) {
    const x = 160 + rnd() * 860, y = altura * 0.68 + 40 + rnd() * 120;
    ctx.fillStyle = '#F2C230';
    ctx.beginPath(); ctx.arc(x, y - 52, 14, Math.PI, 0); ctx.fill();
    ctx.fillStyle = '#E86A1C';
    ctx.fillRect(x - 14, y - 40, 28, 40);
    ctx.fillStyle = '#2B3A55';
    ctx.fillRect(x - 12, y, 10, 34); ctx.fillRect(x + 2, y, 10, 34);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '600 22px system-ui, sans-serif';
  ctx.fillText('Foto de exemplo', 24, 40);

  carimbar(ctx, largura, altura, { obraNome: obra.nome, quando, lat: obra.lat + (rnd() - 0.5) * 0.0004, lon: obra.lon + (rnd() - 0.5) * 0.0004, fonte: 'gps' });
  const [blob, mini] = await Promise.all([comprimir(canvas), miniatura(canvas)]);
  return { blob, mini, largura, altura };
}
