/* KORbuild Daily — ditado e "melhorar texto".
 * No protótipo a reescrita é SIMULADA aqui no aparelho (troca de gírias e abreviações,
 * pontuação e maiúsculas). Na versão real, o texto vai para um modelo de IA no servidor. */

import { locale, emIngles } from './i18n.js';

/* [palavras ou expressões, troca]. A comparação ignora maiúsculas e respeita acentos. */
const TROCAS = [
  [['amanha começamo', 'amanhã começamo', 'amanha começamos', 'amanhã começamos', 'amanhã vamos começar', 'amanha vamo começar', 'amanhã vamo começar'], 'amanhã a equipe iniciará'],
  [['ó', 'ô', 'olha', 'tipo assim', 'né', 'aí', 'então'], ''],
  [['hj'], 'hoje'], [['pq'], 'porque'], [['q'], 'que'], [['tb', 'tbm'], 'também'], [['vc'], 'você'],
  [['mto'], 'muito'], [['pra', 'p/'], 'para'], [['pro'], 'para o'], [['c/'], 'com'], [['s/'], 'sem'],
  [['qdo'], 'quando'], [['dps'], 'depois'], [['amanha'], 'amanhã'], [['ta', 'tá'], 'está'],
  [['tava'], 'estava'], [['nao'], 'não'], [['ja'], 'já'], [['ate'], 'até'],
  [['a gente', 'os cara', 'os caras', 'o pessoal', 'a turma', 'a galera'], 'a equipe'],
  [['fecho', 'fechou', 'fechamo', 'fechamos', 'terminamo', 'terminamos', 'terminou', 'terminaram', 'fecharam', 'acabamo', 'acabamos', 'acabaram'], 'concluiu'],
  [['começamo', 'começamos', 'comecemo'], 'iniciou'],
  [['batemo', 'batemos', 'bateu', 'subimo', 'subimos', 'fizemo', 'fizemos', 'fez', 'fizeram', 'subiram', 'bateram'], 'executou'],
  [['faltou'], 'houve falta de'], [['não veio', 'nao veio', 'não chegou', 'nao chegou'], 'não foi entregue'],
  [['atrasou'], 'sofreu atraso'], [['quebrou', 'pifou'], 'apresentou defeito'],
  [['choveu', 'deu chuva'], 'houve chuva'], [['massa'], 'argamassa'], [['ferro', 'ferragem'], 'armação'],
  [['segundo andar'], '2º pavimento'], [['primeiro andar'], '1º pavimento'], [['terceiro andar'], '3º pavimento'],
];

/* Inglês: gírias e abreviações comuns de canteiro nos EUA. */
const TROCAS_EN = [
  [['we gonna', "we're gonna", 'we are gonna', "we're going to"], 'the crew will'], [['gonna'], 'going to'], [['wanna'], 'want to'], [['gotta'], 'have to'], [['kinda', 'sorta'], ''],
  [['like', 'you know', 'basically', 'so yeah', 'um', 'uh'], ''],
  [['tmrw', 'tmr', 'tomorow'], 'tomorrow'], [['w/'], 'with'], [['w/o'], 'without'], [['b/c', 'bc', 'cuz', 'cause'], 'because'],
  [['pls', 'plz'], 'please'], [['thru'], 'through'], [['approx'], 'approximately'], [['qty'], 'quantity'],
  [['didnt'], "did not"], [["didn't"], 'did not'], [['wasnt', "wasn't"], 'was not'], [['cant', "can't"], 'cannot'], [['wont', "won't"], 'will not'],
  [['the guys', 'the boys', 'my guys'], 'the crew'], [['we poured'], 'the crew poured'], [['we framed'], 'the crew framed'],
  [['didnt show', 'did not show', 'no show', 'no-show'], 'was not delivered'], [['broke down'], 'had a breakdown'],
  [['rained out'], 'work stopped due to rain'], [['2nd floor', 'second floor'], '2nd floor'],
];

const LETRA = '[\\p{L}\\p{N}]';
const regras = (trocas) => trocas.map(([termos, troca]) => [
  new RegExp('(?<!' + LETRA + ')(' + termos.map((t) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')).join('|') + ')(?!' + LETRA + ')' + (troca ? '\\s*' : ',?\\s*'), 'giu'),
  troca ? troca + ' ' : '',
]);
const REGRAS = regras(TROCAS);
const REGRAS_EN = regras(TROCAS_EN);

export function melhorarTexto(texto) {
  if (emIngles()) return melhorarTextoEn(texto);
  let t = ' ' + String(texto || '').trim() + ' ';
  for (const [de, para] of REGRAS) t = t.replace(de, para);
  t = t.replace(/(\d+)\s*m2\b/gi, '$1 m²').replace(/(\d+)\s*m3\b/gi, '$1 m³');
  t = t.replace(/\bhouve falta de (de )?/gi, 'houve falta de ').replace(/\s+/g, ' ').trim();
  // Frases: separa em "mas", "e aí", vírgulas soltas; maiúscula no início e ponto final.
  t = t.replace(/\s*,\s*/g, ', ').replace(/\s+mas\s+/gi, '. Porém, ').replace(/\s+porque\s+/gi, ', pois ');
  const frases = t.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean)
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
    .map((f) => (/[.!?]$/.test(f) ? f : f + '.'));
  let saida = frases.join(' ');
  saida = saida.replace(/^A equipe concluiu/, 'A equipe concluiu').replace(/\bpois houve falta de\b/g, 'em razão da falta de');
  return saida;
}

function melhorarTextoEn(texto) {
  let t = ' ' + String(texto || '').trim() + ' ';
  for (const [de, para] of REGRAS_EN) t = t.replace(de, para);
  t = t.replace(/(\d+)\s*(sq ?ft|sf)\b/gi, '$1 sq ft').replace(/(\d+)\s*(lf|lin ?ft)\b/gi, '$1 lin ft').replace(/(\d+)\s*(cy|cu ?yd|yards)\b/gi, '$1 cu yd');
  t = t.replace(/\s*,\s*/g, ', ').replace(/\s+but\s+/gi, '. However, ').replace(/\s+/g, ' ').trim();
  return t.split(/(?<=[.!?])\s+/).map((f) => f.trim()).filter(Boolean)
    .map((f) => f.charAt(0).toUpperCase() + f.slice(1))
    .map((f) => (/[.!?]$/.test(f) ? f : f + '.')).join(' ');
}

/* ---------- Ditado (reconhecimento de voz do navegador) ---------- */

export function ditadoDisponivel() {
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/* Começa a ouvir; chama aoTexto(parcial, final) e devolve uma função para parar. */
export function ditar(aoTexto, aoTerminar) {
  const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
  const rec = new Rec();
  rec.lang = locale();
  rec.interimResults = true;
  rec.continuous = true;
  let final = '';
  rec.onresult = (ev) => {
    let parcial = '';
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      if (ev.results[i].isFinal) final += ev.results[i][0].transcript + ' ';
      else parcial += ev.results[i][0].transcript;
    }
    aoTexto((final + parcial).trim());
  };
  rec.onerror = (ev) => aoTerminar(ev.error);
  rec.onend = () => aoTerminar(null);
  rec.start();
  return () => rec.stop();
}
