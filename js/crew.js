/* KORbuild Crew — modelo do ponto e cálculo das horas.
 *
 * Regras de ouro (docs/crew-analise.md):
 *  - Batida nunca é editada nem apagada. Correção é uma batida nova marcada como ajuste (quem, quando, por quê).
 *  - Toda hora pertence a uma obra e a uma etapa (é o que dá o custo por obra).
 *  - Deslocamento entre obras durante o dia conta como hora trabalhada (FLSA, 29 CFR 785.38).
 *  - Hora extra: acima de 40 h na semana, 1,5× (FLSA). Sem arredondamento: paga-se o minuto.
 *  - Valor hora tem vigência: mudar o valor cria um registro novo "a partir de", nunca reescreve o passado.
 *  - Custo da obra = horas × valor hora vigente no dia + adicional de hora extra (rateado pelas horas da semana)
 *    + encargos sobre a folha (labor burden).
 *
 * Tipos de batida: entrada · intervalo-inicio · intervalo-fim · troca (sai rumo a outra obra) · chegada · etapa · saida */

import { hoje, somarDias, diasEntre, novoId, isoDoDia } from './util.js';
import { estado, salvar } from './armazem.js';

export const ETAPAS = ['Fundação', 'Estrutura', 'Alvenaria', 'Instalações elétricas', 'Instalações hidráulicas', 'Acabamento', 'Piso', 'Limpeza e apoio'];
export const REGRAS = { horasSemana: 40, fatorExtra: 1.5, intervaloMinimo: 30, jornadaExigeIntervalo: 5 * 60 };
export const RAIO_CERCA = 150; // metros

/* ---------- Utilidades ---------- */

export function distanciaM(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const rad = (g) => g * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(a)));
}

export function dentroDaCerca(obra, lat, lon) {
  const c = obra.cerca || { lat: obra.lat, lon: obra.lon, raio: RAIO_CERCA };
  return distanciaM(c.lat, c.lon, lat, lon) <= c.raio;
}

export function inicioDaSemana(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d).getDay(); // 0 = domingo
  return somarDias(iso, -((dia + 6) % 7)); // semana de segunda a domingo
}

export function diasDaSemana(segunda) {
  return Array.from({ length: 7 }, (_, i) => somarDias(segunda, i));
}

export function horas(min) {
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h + 'h' + String(m).padStart(2, '0');
}

export function dinheiro(valor) {
  return 'US$ ' + valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function crew() { return estado().crew; }
export function funcionario(id) { return crew().funcionarios.find((f) => f.id === id); }
export function equipe(id) { return crew().equipes.find((e) => e.id === id); }
export function equipeDoEncarregado(usuarioId) { return crew().equipes.find((e) => e.encarregadoUsuarioId === usuarioId); }
export function membros(equipeId) { return crew().funcionarios.filter((f) => f.equipeId === equipeId); }

export function batidasDoDia(funcId, iso) {
  return crew().batidas.filter((b) => b.funcionarioId === funcId && isoDoDia(new Date(b.em)) === iso).sort((a, b) => a.em - b.em);
}

/* ---------- Jornada do dia ---------- */

/* Transforma as batidas do dia em segmentos: trabalho (obra + etapa), intervalo e deslocamento.
 * Segmento sem fim: hoje = ainda aberto (conta até agora); dia passado = "sem saída" (não conta até ser ajustado). */
export function jornada(funcId, iso, agora) {
  const lista = batidasDoDia(funcId, iso);
  const segs = [];
  let atual = null;
  const fechar = (em) => { if (atual) { atual.fim = em; segs.push(atual); atual = null; } };
  let ultimaObra = null, ultimaEtapa = null;
  for (const b of lista) {
    if (b.tipo === 'entrada') { fechar(b.em); atual = { tipo: 'trabalho', obraId: b.obraId, etapa: b.etapa, ini: b.em }; }
    else if (b.tipo === 'intervalo-inicio') { if (atual) { ultimaObra = atual.obraId; ultimaEtapa = atual.etapa; } fechar(b.em); atual = { tipo: 'intervalo', obraId: ultimaObra, ini: b.em }; }
    else if (b.tipo === 'intervalo-fim') { fechar(b.em); atual = { tipo: 'trabalho', obraId: b.obraId || ultimaObra, etapa: b.etapa || ultimaEtapa, ini: b.em }; }
    else if (b.tipo === 'troca') { fechar(b.em); atual = { tipo: 'deslocamento', obraId: b.obraId, ini: b.em }; }
    else if (b.tipo === 'chegada' || b.tipo === 'etapa') { fechar(b.em); atual = { tipo: 'trabalho', obraId: b.obraId, etapa: b.etapa, ini: b.em }; }
    else if (b.tipo === 'saida') { fechar(b.em); }
  }
  const ehHoje = iso === hoje();
  let semSaida = false;
  if (atual) {
    if (ehHoje) { atual.fim = null; atual.aberto = true; segs.push(atual); }
    else { semSaida = true; atual.fim = null; segs.push(atual); }
  }
  const fimDe = (s) => s.fim || (s.aberto ? (agora || Date.now()) : s.ini);
  const minutos = (tipo) => segs.filter((s) => s.tipo === tipo).reduce((t, s) => t + Math.max(0, fimDe(s) - s.ini) / 60000, 0);
  const trabalho = minutos('trabalho'), deslocamento = minutos('deslocamento'), intervalo = minutos('intervalo');
  const pago = trabalho + deslocamento;
  const maiorIntervalo = Math.max(0, ...segs.filter((s) => s.tipo === 'intervalo' && s.fim).map((s) => (s.fim - s.ini) / 60000));
  const alertas = [];
  if (semSaida) alertas.push({ tipo: 'sem-saida', texto: 'Sem saída' });
  const fora = lista.filter((b) => b.dentroCerca === false && !b.conferida);
  if (fora.length) alertas.push({ tipo: 'fora', texto: fora.length === 1 ? '1 batida fora da obra' : fora.length + ' batidas fora da obra' });
  if (!ehHoje && pago > REGRAS.jornadaExigeIntervalo && maiorIntervalo < REGRAS.intervaloMinimo) alertas.push({ tipo: 'intervalo', texto: 'Sem intervalo de 30 min' });
  return {
    batidas: lista, segmentos: segs, trabalho, deslocamento, intervalo, pago, alertas,
    estado: !atual ? (lista.length ? 'saiu' : 'fora') : (atual.aberto ? atual.tipo : 'sem-saida'),
    atual: atual && atual.aberto ? atual : null,
  };
}

/* ---------- Semana ---------- */

export function semana(funcId, segunda, agora) {
  const dias = diasDaSemana(segunda).map((iso) => ({ iso, ...jornada(funcId, iso, agora) }));
  const total = dias.reduce((t, d) => t + d.pago, 0);
  const regular = Math.min(total, REGRAS.horasSemana * 60);
  const extra = Math.max(0, total - REGRAS.horasSemana * 60);
  const f = funcionario(funcId);
  const alertas = dias.flatMap((d) => d.alertas.map((a) => ({ ...a, iso: d.iso })));
  // Salário base: cada dia pelo valor hora vigente naquele dia. Hora extra: 0,5× a mais sobre a
  // "regular rate" da semana (média ponderada quando o valor mudou no meio da semana, como manda a FLSA).
  const base = dias.reduce((t, d) => t + (d.pago / 60) * valorHoraEm(f, d.iso), 0);
  const taxaRegular = total ? base / (total / 60) : valorHoraEm(f, segunda);
  const adicional = (extra / 60) * taxaRegular * (REGRAS.fatorExtra - 1);
  return {
    dias, total, regular, extra, alertas, base, taxaRegular, adicional,
    custo: base + adicional,
    status: statusSemana(funcId, segunda),
  };
}

export function statusSemana(funcId, segunda) {
  const a = (crew().aprovacoes || []).filter((x) => x.funcionarioId === funcId && x.semana === segunda).sort((x, y) => y.em - x.em)[0];
  if (a) return a.status;
  return somarDias(segunda, 6) >= hoje() ? 'aberta' : 'pendente';
}

export function aprovacaoDaSemana(funcId, segunda) {
  return (crew().aprovacoes || []).filter((x) => x.funcionarioId === funcId && x.semana === segunda).sort((x, y) => y.em - x.em)[0] || null;
}

/* ---------- Valor hora, encargos e orçamento ---------- */

/* Valor hora vigente numa data: o último registro com "desde" até essa data. */
export function valorHoraEm(f, iso) {
  const lista = (f.valores || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : 1));
  let v = lista.length ? lista[0].valor : 0;
  for (const x of lista) if (x.desde <= iso) v = x.valor;
  return v;
}
export function valorAtual(f) { return valorHoraEm(f, hoje()); }
export function historicoDeValores(f) { return (f.valores || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : -1)); }

/* Muda o valor hora a partir de uma data. Não vale dentro de semana já aprovada (já foi para a folha). */
export function alterarValorHora(funcId, valor, desde, motivo, por) {
  const f = funcionario(funcId);
  if (!(valor > 0)) return { erro: 'Informe um valor hora maior que zero.' };
  if (!motivo || !motivo.trim()) return { erro: 'O motivo é obrigatório: fica no histórico.' };
  const segunda = inicioDaSemana(desde);
  if (statusSemana(funcId, segunda) === 'aprovado') return { erro: 'A semana de ' + segunda.split('-').reverse().join('/') + ' já foi aprovada e enviada para a folha. Escolha uma data a partir da próxima semana aberta.' };
  if ((f.valores || []).some((x) => x.desde === desde)) return { erro: 'Já existe um valor a partir dessa data.' };
  f.valores = f.valores || [];
  f.valores.push({ desde, valor: Math.round(valor * 100) / 100, motivo: motivo.trim(), por, em: Date.now() });
  salvar();
  return { ok: true };
}

/* Encargos sobre a folha (labor burden): impostos do empregador, workers' comp, seguro e benefícios. */
export const ENCARGOS_PADRAO = { fica: 7.65, desemprego: 3.4, workersComp: 14, beneficios: 7 }; // % sobre o salário
export function encargos() {
  const e = (crew().config && crew().config.encargos) || ENCARGOS_PADRAO;
  return Object.values(e).reduce((t, v) => t + v, 0) / 100;
}
export function definirEncargos(partes) {
  const c = crew();
  c.config = c.config || {};
  c.config.encargos = partes;
  salvar();
}

export function orcamento(obraId) { return (crew().orcamentos || {})[obraId] || null; }
export function definirOrcamento(obraId, dados, por) {
  const c = crew();
  c.orcamentos = c.orcamentos || {};
  c.orcamentos[obraId] = { ...(c.orcamentos[obraId] || { porEtapa: {} }), ...dados, por, em: Date.now() };
  salvar();
}

/* ---------- Custo da mão de obra ---------- */

/* Horas de uma pessoa numa semana, em lançamentos dia · obra · etapa. Semanas antigas vêm do histórico
 * consolidado (crew.historico); as recentes, das batidas. */
let indiceHistorico = null;
function historicoDaSemana(funcId, segunda) {
  const h = crew().historico || [];
  if (!indiceHistorico || indiceHistorico.n !== h.length || indiceHistorico.ref !== h) {
    const mapa = new Map();
    for (const [iso, fid, obraId, etapa, min] of h) {
      const k = fid + '|' + inicioDaSemana(iso);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k).push({ iso, obraId, etapa, min });
    }
    indiceHistorico = { n: h.length, ref: h, mapa };
  }
  return indiceHistorico.mapa.get(funcId + '|' + segunda) || null;
}

function horasDaSemana(funcId, segunda, agora) {
  const hist = historicoDaSemana(funcId, segunda);
  if (hist) return hist;
  const out = [];
  for (const iso of diasDaSemana(segunda)) {
    for (const seg of jornada(funcId, iso, agora).segmentos) {
      if (seg.tipo === 'intervalo' || (!seg.fim && !seg.aberto)) continue;
      const min = Math.max(0, (seg.fim || agora || Date.now()) - seg.ini) / 60000;
      if (min) out.push({ iso, obraId: seg.obraId, etapa: seg.tipo === 'deslocamento' ? 'Deslocamento entre obras' : seg.etapa, min });
    }
  }
  return out;
}

/* Lançamentos de custo da semana: cada um com salário base (valor do dia), parte do adicional de hora extra
 * (rateado pelas horas da semana) e encargos. */
const cacheLancamentos = new Map();
export function lancamentosDaSemana(segunda, agora) {
  const fechada = somarDias(segunda, 6) < hoje();
  const chave = segunda + '|' + encargos() + '|' + JSON.stringify(crew().funcionarios.map((f) => f.valores));
  if (fechada && cacheLancamentos.has(chave)) return cacheLancamentos.get(chave);
  const enc = encargos();
  const out = [];
  for (const f of crew().funcionarios) {
    const linhas = horasDaSemana(f.id, segunda, agora);
    const total = linhas.reduce((t, l) => t + l.min, 0);
    if (!total) continue;
    const base = linhas.reduce((t, l) => t + (l.min / 60) * valorHoraEm(f, l.iso), 0);
    const extra = Math.max(0, total - REGRAS.horasSemana * 60);
    const adicional = (extra / 60) * (base / (total / 60)) * (REGRAS.fatorExtra - 1);
    for (const l of linhas) {
      const b = (l.min / 60) * valorHoraEm(f, l.iso);
      const ad = adicional * l.min / total;
      out.push({ ...l, funcionarioId: f.id, base: b, adicional: ad, encargos: (b + ad) * enc, custo: (b + ad) * (1 + enc) });
    }
  }
  if (fechada) cacheLancamentos.set(chave, out);
  return out;
}

function somar(lancs) {
  const r = { min: 0, base: 0, adicional: 0, encargos: 0, custo: 0 };
  for (const l of lancs) { r.min += l.min; r.base += l.base; r.adicional += l.adicional; r.encargos += l.encargos; r.custo += l.custo; }
  return r;
}

/* Custos de um período (datas inclusivas), por obra e por etapa. */
export function custosDoPeriodo(ini, fim, agora) {
  const lancs = [];
  for (let s = inicioDaSemana(ini); s <= fim; s = somarDias(s, 7)) {
    for (const l of lancamentosDaSemana(s, agora)) if (l.iso >= ini && l.iso <= fim) lancs.push(l);
  }
  const porObra = {};
  for (const l of lancs) (porObra[l.obraId] = porObra[l.obraId] || []).push(l);
  const obras = Object.entries(porObra).map(([obraId, ls]) => {
    const etapas = {};
    for (const l of ls) (etapas[l.etapa] = etapas[l.etapa] || []).push(l);
    return {
      obraId, ...somar(ls), pessoasDia: new Set(ls.map((l) => l.funcionarioId + l.iso)).size,
      etapas: Object.entries(etapas).map(([nome, x]) => ({ nome, ...somar(x) })).sort((a, b) => b.custo - a.custo),
    };
  }).sort((a, b) => b.custo - a.custo);
  return { ...somar(lancs), obras };
}

/* A obra inteira: semana a semana, acumulado, orçamento e projeção para o fim do prazo. */
export function resumoDaObra(obraId, agora) {
  const o = estado().obras.find((x) => x.id === obraId);
  const orc = orcamento(obraId);
  const dia0 = hoje();
  const semanas = [];
  let acumulado = 0;
  for (let s = inicioDaSemana(o.inicio); s <= dia0; s = somarDias(s, 7)) {
    const doPeriodo = somar(lancamentosDaSemana(s, agora).filter((l) => l.obraId === obraId));
    acumulado += doPeriodo.custo;
    semanas.push({ segunda: s, custo: doPeriodo.custo, min: doPeriodo.min, acumulado });
  }
  const realizado = acumulado;
  const diasTotais = Math.max(1, diasEntre(o.inicio, o.prazo));
  const pctPrazo = Math.min(1, Math.max(0, diasEntre(o.inicio, dia0) / diasTotais));
  // Ritmo: média das últimas 4 semanas completas
  const completas = semanas.filter((x) => somarDias(x.segunda, 6) < dia0).slice(-4);
  const ritmo = completas.length ? completas.reduce((t, x) => t + x.custo, 0) / completas.length : 0;
  const semanasRestantes = Math.max(0, diasEntre(dia0, o.prazo) / 7);
  const projecaoRitmo = realizado + ritmo * semanasRestantes;
  const avanco = orc && orc.avanco ? orc.avanco / 100 : null;
  const projecaoAvanco = avanco ? realizado / avanco : null;
  // Com avanço físico informado, a projeção usa o desempenho (custo ÷ avanço); sem ele, o ritmo recente.
  const projecao = projecaoAvanco != null ? projecaoAvanco : projecaoRitmo;
  const valor = orc ? orc.valor : null;
  const saldo = valor != null ? valor - projecao : null;
  const status = valor == null ? 'sem-orcamento' : projecao <= valor ? 'no-rumo' : projecao <= valor * 1.05 ? 'atencao' : 'estouro';
  const etapas = {};
  for (const sem of semanas) for (const l of lancamentosDaSemana(sem.segunda, agora)) if (l.obraId === obraId) {
    const e = (etapas[l.etapa] = etapas[l.etapa] || { nome: l.etapa, custo: 0, min: 0 });
    e.custo += l.custo; e.min += l.min;
  }
  const porEtapa = (orc && orc.porEtapa) || {};
  for (const nome of Object.keys(porEtapa)) etapas[nome] = etapas[nome] || { nome, custo: 0, min: 0 };
  return {
    obra: o, orcamento: valor, avanco, realizado, ritmo, pctPrazo, projecao, projecaoRitmo, projecaoAvanco, saldo, status,
    pctConsumido: valor ? realizado / valor : null, semanas, semanasRestantes,
    etapas: Object.values(etapas).map((e) => ({ ...e, orcado: porEtapa[e.nome] || 0 })).sort((a, b) => (b.orcado || b.custo) - (a.orcado || a.custo)),
  };
}

/* Quem está na obra num dia (para preencher a equipe do RDO do Daily). */
export function presencaNaObra(obraId, iso) {
  const presentes = crew().funcionarios.filter((f) => jornada(f.id, iso).segmentos.some((s) => s.tipo === 'trabalho' && s.obraId === obraId));
  const daEquipeBase = crew().funcionarios.filter((f) => (equipe(f.equipeId) || {}).obraBaseId === obraId);
  const faltaram = daEquipeBase.filter((f) => !batidasDoDia(f.id, iso).length);
  const porFuncao = {};
  for (const f of presentes) (porFuncao[f.funcao] = porFuncao[f.funcao] || { presentes: 0, faltas: 0 }).presentes++;
  for (const f of faltaram) (porFuncao[f.funcao] = porFuncao[f.funcao] || { presentes: 0, faltas: 0 }).faltas++;
  return { total: presentes.length, porFuncao };
}

/* ---------- Registrar ---------- */

export function registrarBatidas(funcIds, dados) {
  const em = dados.em || Date.now();
  for (const id of funcIds) {
    crew().batidas.push({
      id: novoId('bt'), funcionarioId: id, tipo: dados.tipo, obraId: dados.obraId, etapa: dados.etapa || null, em,
      lat: dados.lat, lon: dados.lon, precisao: dados.precisao, dentroCerca: dados.dentroCerca,
      fonteGps: dados.fonteGps || 'gps', registradoPor: dados.registradoPor, modo: dados.modo || 'equipe',
      foto: !!dados.foto, ajuste: dados.ajuste || null, conferida: false,
    });
  }
  salvar();
}

export function decidirSemana(funcIds, segunda, status, por, motivo) {
  const c = crew();
  c.aprovacoes = c.aprovacoes || [];
  for (const id of funcIds) c.aprovacoes.push({ funcionarioId: id, semana: segunda, status, por, motivo: motivo || '', em: Date.now() });
  salvar();
}

/* ---------- Dados de exemplo ---------- */

const PESSOAS = [
  // equipe A: base no Residencial Jardim das Flores, encarregado Carlos
  ['f-carlos', 'Carlos Mendes', 'Mestre de obras', 42, 'eq-a'],
  ['f-joao', 'João Pereira', 'Pedreiro', 30, 'eq-a'],
  ['f-diego', 'Diego Santos', 'Pedreiro', 30, 'eq-a'],
  ['f-marcos', 'Marcos Lima', 'Servente', 22, 'eq-a'],
  ['f-rafael', 'Rafael Costa', 'Servente', 22, 'eq-a'],
  ['f-lucas', 'Lucas Oliveira', 'Eletricista', 38, 'eq-a'],
  // equipe B: base no Edifício Atlântico, encarregado Roberto
  ['f-roberto', 'Roberto Lima', 'Encarregado', 40, 'eq-b'],
  ['f-antonio', 'Antônio Souza', 'Carpinteiro', 32, 'eq-b'],
  ['f-felipe', 'Felipe Rocha', 'Carpinteiro', 32, 'eq-b'],
  ['f-bruno', 'Bruno Alves', 'Armador', 31, 'eq-b'],
  ['f-thiago', 'Thiago Martins', 'Armador', 31, 'eq-b'],
  ['f-gustavo', 'Gustavo Ribeiro', 'Servente', 22, 'eq-b'],
];

const ETAPA_PADRAO = { jardim: 'Alvenaria', atlantico: 'Estrutura', galpao: 'Piso' };

// Reajustes de exemplo: [dias a partir da segunda desta semana, aumento em US$/h, motivo]
const REAJUSTES = {
  'f-carlos': [-91, 2, 'Reajuste anual'],
  'f-lucas': [-56, 3, 'Licença de eletricista (journeyman)'],
  'f-diego': [-28, 2, 'Aumento por desempenho'],
  'f-antonio': [-119, 2, 'Reajuste anual'],
};

// Etapas da obra ao longo do tempo (fração do prazo decorrida → etapa), para o histórico de horas
const FASES = {
  jardim: [[0, 'Fundação'], [0.12, 'Estrutura'], [0.24, 'Alvenaria']],
  atlantico: [[0, 'Fundação'], [0.1, 'Estrutura']],
};

// Orçamento de mão de obra (fatia de cada etapa) e como cada obra está, para a demonstração:
// Jardim no rumo, Atlântico estourando (hora extra da concretagem e avanço atrasado), Galpão em atenção.
const ORCAMENTO_ETAPAS = {
  jardim: { 'Fundação': 0.1, 'Estrutura': 0.2, 'Alvenaria': 0.3, 'Instalações elétricas': 0.14, 'Limpeza e apoio': 0.16, 'Acabamento': 0.1 },
  atlantico: { 'Fundação': 0.08, 'Estrutura': 0.62, 'Limpeza e apoio': 0.15, 'Acabamento': 0.15 },
  galpao: { 'Instalações elétricas': 0.7, 'Deslocamento entre obras': 0.1, 'Piso': 0.2 },
};
const CENARIO = { jardim: { folga: 1.05, ritmoAvanco: 1.0 }, atlantico: { folga: 1.15, ritmoAvanco: 0.94 }, galpao: { folga: 0.68, ritmoAvanco: 0.98 } };

function semente(n) { let s = n; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function quando(iso, h, m) {
  const [a, mes, d] = iso.split('-').map(Number);
  return new Date(a, mes - 1, d, h, m, 0).getTime();
}

export function criarDadosCrew(obras) {
  const dia0 = hoje();
  const agora = Date.now();
  const obra = (id) => obras.find((o) => o.id === id);
  const funcionarios = PESSOAS.map(([id, nome, funcao, valorHora, equipeId]) => {
    const equipeBase = obra(equipeId === 'eq-a' ? 'jardim' : 'atlantico');
    const admissao = somarDias(equipeBase.inicio, -(10 + (id.length * 7) % 40));
    const r = REAJUSTES[id];
    const valores = r
      ? [{ desde: admissao, valor: valorHora - r[1], motivo: 'Admissão', por: 'Ana Ribeiro', em: quando(admissao, 9, 0) },
        { desde: somarDias(inicioDaSemana(dia0), r[0]), valor: valorHora, motivo: r[2], por: 'Ana Ribeiro', em: quando(somarDias(inicioDaSemana(dia0), r[0] - 3), 10, 0) }]
      : [{ desde: admissao, valor: valorHora, motivo: 'Admissão', por: 'Ana Ribeiro', em: quando(admissao, 9, 0) }];
    return { id, nome, funcao, equipeId, admissao, valores, usuarioId: id === 'f-carlos' ? 'u-carlos' : id === 'f-roberto' ? 'u-roberto' : null };
  });
  const equipes = [
    { id: 'eq-a', nome: 'Equipe do Carlos', encarregadoUsuarioId: 'u-carlos', obraBaseId: 'jardim' },
    { id: 'eq-b', nome: 'Equipe do Roberto', encarregadoUsuarioId: 'u-roberto', obraBaseId: 'atlantico' },
  ];
  const batidas = [];
  const excursoes = [];
  const rnd = semente(11);
  const b = (f, tipo, obraId, etapa, em, extra) => {
    // a batida é feita onde a pessoa está: na troca, ainda na obra de origem (extra.em)
    const o = obra((extra && extra.em) || obraId);
    const fora = extra && extra.fora;
    const lat = o.lat + (fora ? 0.008 : (rnd() - 0.5) * 0.0016);
    const lon = o.lon + (fora ? 0.004 : (rnd() - 0.5) * 0.0016);
    batidas.push({
      id: novoId('bt'), funcionarioId: f.id, tipo, obraId, etapa, em, lat, lon, precisao: Math.round(6 + rnd() * 20),
      dentroCerca: dentroDaCerca(o, lat, lon), fonteGps: 'gps', registradoPor: f.equipeId === 'eq-a' ? 'u-carlos' : 'u-roberto',
      modo: 'equipe', foto: rnd() > 0.5, ajuste: null, conferida: false,
    });
  };
  const min = (n) => Math.round(rnd() * n);

  // Duas semanas: a anterior inteira e a atual até ontem (segunda a sábado). Hoje: só a equipe B, até agora.
  const segundaAtual = inicioDaSemana(dia0);
  const segundaAnterior = somarDias(segundaAtual, -7);
  const dias = [];
  for (let d = segundaAnterior; d <= dia0; d = somarDias(d, 1)) {
    const semana = new Date(quando(d, 12, 0)).getDay();
    if (semana !== 0) dias.push(d);
  }
  const ontem = dias.filter((d) => d < dia0).slice(-1)[0];

  for (const d of dias) {
    const sabado = new Date(quando(d, 12, 0)).getDay() === 6;
    const ehHoje = d === dia0;
    const indice = diasEntre(segundaAnterior, d);
    for (const f of funcionarios) {
      const base = f.equipeId === 'eq-a' ? 'jardim' : 'atlantico';
      if (ehHoje && f.equipeId === 'eq-a') continue; // a equipe do Carlos bate a entrada ao vivo na demonstração
      if (sabado && f.equipeId === 'eq-a') continue; // equipe do Carlos trabalha de segunda a sexta
      if (f.id === 'f-thiago' && indice === 3) continue; // faltou na quinta da semana anterior
      const etapa = f.funcao === 'Eletricista' ? 'Instalações elétricas' : f.funcao === 'Mestre de obras' || f.funcao === 'Encarregado' ? 'Limpeza e apoio' : ETAPA_PADRAO[base];
      const eventos = [];
      // Equipe do Carlos: 7h às 16h. Equipe do Roberto: 8h às 17h. Uma hora de almoço.
      const h0 = f.equipeId === 'eq-a' ? 6 : 7;
      eventos.push(['entrada', base, etapa, quando(d, h0, 55 + min(10)), { fora: f.id === 'f-marcos' && d === ontem }]);
      if (sabado) {
        eventos.push(['saida', base, etapa, quando(d, 11, 25 + min(5))]);
      } else {
        eventos.push(['intervalo-inicio', base, etapa, quando(d, 12, min(4))]);
        eventos.push(['intervalo-fim', base, etapa, quando(d, 13, min(4))]);
        // Lucas troca de obra depois do almoço em dias alternados: Jardim → Galpão (deslocamento conta como hora)
        if (f.id === 'f-lucas' && indice % 2 === 1) {
          eventos.push(['troca', 'galpao', null, quando(d, 13, 10 + min(5)), { em: base }]);
          eventos.push(['chegada', 'galpao', 'Instalações elétricas', quando(d, 13, 55 + min(5))]);
          eventos.push(['saida', 'galpao', 'Instalações elétricas', quando(d, 17, min(10))]);
        } else {
          // equipe B faz hora extra na semana anterior (concretagem): sai às 18h40 de terça a sexta
          const extra = f.equipeId === 'eq-b' && d < segundaAtual && indice >= 1 && indice <= 4;
          const saida = extra ? quando(d, 19, 25 + min(10)) : quando(d, h0 + 10, min(12));
          if (!(f.id === 'f-rafael' && d === ontem)) eventos.push(['saida', base, etapa, saida]); // Rafael esqueceu a saída ontem
        }
      }
      for (const [tipo, obraId, et, em, extra] of eventos) if (em <= agora) b(f, tipo, obraId, et, em, extra);
      // Diego saiu da obra com o ponto aberto na terça da semana anterior (aparece no mapa do dia)
      if (f.id === 'f-diego' && indice === 1) excursoes.push({ funcionarioId: f.id, data: d, ini: quando(d, 9, 40), fim: quando(d, 10, 5), lat: obra(base).lat + 0.0042, lon: obra(base).lon + 0.0031, local: 'Posto de combustível a 550 m' });
    }
  }

  // Histórico consolidado (semanas já fechadas antes das duas semanas detalhadas): [data, pessoa, obra, etapa, minutos]
  const historico = [];
  const rh = semente(23);
  for (const f of funcionarios) {
    const base = f.equipeId === 'eq-a' ? 'jardim' : 'atlantico';
    const o = obra(base);
    const desde = o.inicio > f.admissao ? o.inicio : f.admissao;
    for (let d = desde; d < segundaAnterior; d = somarDias(d, 1)) {
      const dia = new Date(quando(d, 12, 0)).getDay();
      if (dia === 0 || (dia === 6 && f.equipeId === 'eq-a')) continue;
      if (rh() < 0.03) continue; // faltas
      const fase = FASES[base].filter(([x]) => diasEntre(o.inicio, d) / diasEntre(o.inicio, o.prazo) >= x).pop()[1];
      const etapa = f.funcao === 'Eletricista' ? 'Instalações elétricas' : f.funcao === 'Mestre de obras' || f.funcao === 'Encarregado' ? 'Limpeza e apoio' : fase;
      const jornadaMin = dia === 6 ? 210 + Math.round(rh() * 30) : 480 + Math.round(rh() * 25);
      // concretagem do Atlântico: hora extra de terça a sexta em semanas alternadas
      const extra = f.equipeId === 'eq-b' && dia >= 2 && dia <= 5 && Math.floor(diasEntre(o.inicio, d) / 7) % 2 === 0 ? 120 + Math.round(rh() * 40) : 0;
      if (f.id === 'f-lucas' && dia % 2 === 0 && d >= obra('galpao').inicio) {
        historico.push([d, f.id, 'jardim', etapa, 300], [d, f.id, 'galpao', 'Deslocamento entre obras', 45], [d, f.id, 'galpao', 'Instalações elétricas', jornadaMin - 345]);
      } else historico.push([d, f.id, base, etapa, jornadaMin + extra]);
    }
  }

  // Orçamento de mão de obra: custo semanal esperado da equipe × semanas do prazo, ajustado pelo cenário
  const enc = Object.values(ENCARGOS_PADRAO).reduce((t, v) => t + v, 0) / 100;
  const orcamentos = {};
  for (const id of ['jardim', 'atlantico', 'galpao']) {
    const o = obra(id);
    const semanas = diasEntre(o.inicio, o.prazo) / 7;
    let semanal;
    if (id === 'galpao') semanal = 38 * 2.5 * 4 * (1 + enc); // Lucas, ~2,5 tardes por semana
    else {
      const time = PESSOAS.filter((p) => p[4] === (id === 'jardim' ? 'eq-a' : 'eq-b'));
      const horasSemana = id === 'jardim' ? 40.5 : 44.5;
      semanal = time.reduce((t, p) => t + p[3] * horasSemana, 0) * (1 + enc);
    }
    const valor = Math.round(semanal * semanas * CENARIO[id].folga / 100) * 100;
    const pct = diasEntre(o.inicio, dia0) / diasEntre(o.inicio, o.prazo);
    orcamentos[id] = {
      valor, avanco: Math.round(pct * CENARIO[id].ritmoAvanco * 100),
      porEtapa: Object.fromEntries(Object.entries(ORCAMENTO_ETAPAS[id]).map(([e, f]) => [e, Math.round(valor * f / 100) * 100])),
      por: 'Ana Ribeiro', em: quando(o.inicio, 9, 0),
    };
  }

  // A semana anterior da equipe A já foi aprovada; a da equipe B espera aprovação.
  const aprovacoes = funcionarios.filter((f) => f.equipeId === 'eq-a').map((f) => ({ funcionarioId: f.id, semana: segundaAnterior, status: 'aprovado', por: 'Ana Ribeiro', motivo: '', em: quando(segundaAtual, 9, 10) }));

  return { funcionarios, equipes, batidas, excursoes, aprovacoes, historico, orcamentos, config: { encargos: { ...ENCARGOS_PADRAO } } };
}
