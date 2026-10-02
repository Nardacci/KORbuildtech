/* KORbuild Crew — modelo do ponto e cálculo das horas.
 *
 * Regras de ouro (docs/crew-analise.md):
 *  - Batida nunca é editada nem apagada. Correção é uma batida nova marcada como ajuste (quem, quando, por quê).
 *  - Toda hora pertence a uma obra e a uma etapa (é o que dá o custo por obra).
 *  - Deslocamento entre obras durante o dia conta como hora trabalhada (FLSA, 29 CFR 785.38).
 *  - Hora extra: acima de 40 h na semana, 1,5× (FLSA). Sem arredondamento: paga-se o minuto.
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
  return {
    dias, total, regular, extra, alertas,
    custo: (regular / 60) * f.valorHora + (extra / 60) * f.valorHora * REGRAS.fatorExtra,
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

/* Custo de mão de obra da semana por obra e etapa (custo base; o adicional de hora extra vem à parte). */
export function custosDaSemana(segunda, agora) {
  const porObra = {};
  let adicionalExtra = 0;
  for (const f of crew().funcionarios) {
    const s = semana(f.id, segunda, agora);
    adicionalExtra += (s.extra / 60) * f.valorHora * (REGRAS.fatorExtra - 1);
    for (const d of s.dias) {
      for (const seg of d.segmentos) {
        if (seg.tipo === 'intervalo' || (!seg.fim && !seg.aberto)) continue;
        const min = Math.max(0, (seg.fim || agora || Date.now()) - seg.ini) / 60000;
        const o = (porObra[seg.obraId] = porObra[seg.obraId] || { horas: 0, custo: 0, etapas: {}, pessoasDia: new Set() });
        const chave = seg.tipo === 'deslocamento' ? 'Deslocamento entre obras' : seg.etapa;
        const e = (o.etapas[chave] = o.etapas[chave] || { horas: 0, custo: 0 });
        o.horas += min; o.custo += (min / 60) * f.valorHora;
        e.horas += min; e.custo += (min / 60) * f.valorHora;
        o.pessoasDia.add(f.id + d.iso);
      }
    }
  }
  return { porObra, adicionalExtra };
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

function semente(n) { let s = n; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }

function quando(iso, h, m) {
  const [a, mes, d] = iso.split('-').map(Number);
  return new Date(a, mes - 1, d, h, m, 0).getTime();
}

export function criarDadosCrew(obras) {
  const dia0 = hoje();
  const agora = Date.now();
  const obra = (id) => obras.find((o) => o.id === id);
  const funcionarios = PESSOAS.map(([id, nome, funcao, valorHora, equipeId]) => ({
    id, nome, funcao, valorHora, equipeId, usuarioId: id === 'f-carlos' ? 'u-carlos' : id === 'f-roberto' ? 'u-roberto' : null,
  }));
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

  // A semana anterior da equipe A já foi aprovada; a da equipe B espera aprovação.
  const aprovacoes = funcionarios.filter((f) => f.equipeId === 'eq-a').map((f) => ({ funcionarioId: f.id, semana: segundaAnterior, status: 'aprovado', por: 'Ana Ribeiro', motivo: '', em: quando(segundaAtual, 9, 10) }));

  return { funcionarios, equipes, batidas, excursoes, aprovacoes };
}
