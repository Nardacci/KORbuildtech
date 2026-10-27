/* KORbuild — cadastro de obras (docs/obras.md).
 * A obra é da empresa: Daily (diário e cronograma), Crew (ponto e cerca) e Measure (projeto ganho) usam o mesmo cadastro.
 * Modelos de etapas: o cronograma inicial da obra, dividindo o prazo entre as etapas (OB-06). */

import { novoId, hoje, diasEntre, somarDias } from './util.js';
import { tr } from './i18n.js';
import { estado, salvar } from './armazem.js';
import { auditar } from './settings.js';
import { contato } from './contatos.js';
import { RAIO_CERCA } from './crew.js';
import { DIAS_TRABALHO } from './prazos.js';
import { cronogramaDe, novaBase, servidorCronograma } from './cronograma.js';
import { PRIMEIRA_VERSAO } from './versao.js';

export const SITUACOES_OBRA = {
  andamento: { nome: tr('Em andamento'), classe: 'etiqueta-verde' },
  paralisada: { nome: tr('Paralisada'), classe: 'etiqueta-ambar' },
  concluida: { nome: tr('Concluída'), classe: 'etiqueta-neutro' },
};
export const RAIO_MIN = 50;
export const RAIO_MAX = 2000;

const t = (v) => String(v == null ? '' : v).trim();
const DATA = /^\d{4}-\d{2}-\d{2}$/;

export function obras() { return estado().obras; }
/* Na 1ª versão o Daily só conhece as obras que nasceram de projetos (o projeto ganho é a obra); obras cadastradas à mão ficam para a versão completa. */
export function obrasDaVersao(dados) { const lista = (dados || estado()).obras || []; return PRIMEIRA_VERSAO ? lista.filter((o) => o.projetoId) : lista; }
/* Obra sem situação (dados antigos) está em andamento. */
export function situacaoDaObra(o) { return (o && o.situacao) || 'andamento'; }
/* Só obra em andamento cobra diário, aparece no campo e no ponto (OB-04). */
export function emAndamento(o) { return situacaoDaObra(o) === 'andamento'; }
export function obrasEmAndamento(dados) { return obrasDaVersao(dados).filter(emAndamento); }

/* "Manchester, NH 03104": o texto que as telas mostram. */
export function textoCidade(d) { return [d.municipio, [d.estado, d.zip].filter(Boolean).join(' ')].filter(Boolean).join(', '); }

/* A construtora gerencia a obra e não faz diário nem ponto (docs/saas.md HS-09): na obra dela não há
 * responsável pelo diário nem cronograma próprio (HS-12); isso fica na obra de cada prestadora. */
export function empresaExecuta(dados) { return (dados || estado()).empresa.atuacao !== 'construtora'; }

export function salvarObra(id, dados, por) {
  const num = (v) => (t(v) === '' ? NaN : Number(String(v).replace(',', '.')));
  const d = {
    nome: t(dados.nome), contratanteId: t(dados.contratanteId) || null, donoId: t(dados.donoId) || null,
    endereco: t(dados.endereco), municipio: t(dados.municipio), estado: t(dados.estado).toUpperCase(), zip: t(dados.zip),
    lat: num(dados.lat), lon: num(dados.lon), raio: num(dados.raio),
    inicio: t(dados.inicio), prazo: t(dados.prazo), responsavelId: t(dados.responsavelId) || null,
    diasTrabalho: (dados.diasTrabalho || []).map(Number).filter((n) => n >= 0 && n <= 6).sort(),
    situacao: dados.situacao || 'andamento', projetoId: t(dados.projetoId) || null,
  };
  if (!d.nome) return { erro: tr('Dê um nome à obra.') };
  if (obras().some((o) => o.id !== id && o.nome.toLowerCase() === d.nome.toLowerCase())) return { erro: tr('Já existe uma obra com esse nome.') };
  if (!d.contratanteId || !contato(d.contratanteId)) return { erro: tr('Escolha o contratante: a construtora que contratou, ou o próprio cliente quando contrata direto.') };
  if (d.donoId === d.contratanteId) d.donoId = null;
  if (!d.municipio || !d.estado) return { erro: tr('Informe a cidade e o estado da obra.') };
  if (!/^[A-Z]{2}$/.test(d.estado)) return { erro: tr('Estado com 2 letras (ex.: NH).') };
  if (d.zip && !/^\d{5}(-\d{4})?$/.test(d.zip)) return { erro: tr('ZIP code com 5 dígitos (ex.: 03104).') };
  if (!Number.isFinite(d.lat) || !Number.isFinite(d.lon) || Math.abs(d.lat) > 90 || Math.abs(d.lon) > 180) return { erro: tr('Marque o local da obra no mapa (ou use a localização atual): ele vale para a cerca do ponto e o clima do diário.') };
  if (!Number.isFinite(d.raio)) d.raio = RAIO_CERCA;
  if (d.raio < RAIO_MIN || d.raio > RAIO_MAX) return { erro: tr('Raio da cerca entre {min} e {max} m.', { min: RAIO_MIN, max: RAIO_MAX }) };
  if (!DATA.test(d.inicio) || !DATA.test(d.prazo)) return { erro: tr('Informe o início e o prazo da obra.') };
  if (diasEntre(d.inicio, d.prazo) < 0) return { erro: tr('O prazo não pode ser antes do início.') };
  if (empresaExecuta() && (!d.responsavelId || !estado().usuarios.some((u) => u.id === d.responsavelId))) return { erro: tr('Escolha quem preenche o diário desta obra.') };
  if (!d.diasTrabalho.length && !empresaExecuta()) d.diasTrabalho = [1, 2, 3, 4, 5];
  if (!d.diasTrabalho.length) return { erro: tr('Marque pelo menos um dia de trabalho.') };
  if (!SITUACOES_OBRA[d.situacao]) return { erro: tr('Escolha a situação.') };

  const campos = {
    nome: d.nome, contratanteId: d.contratanteId, donoId: d.donoId, endereco: d.endereco, municipio: d.municipio, estado: d.estado, zip: d.zip,
    cidade: textoCidade(d), lat: d.lat, lon: d.lon, cerca: { lat: d.lat, lon: d.lon, raio: Math.round(d.raio) },
    inicio: d.inicio, prazo: d.prazo, responsavelId: d.responsavelId, diasTrabalho: d.diasTrabalho, situacao: d.situacao,
  };
  if (id) {
    const o = obras().find((x) => x.id === id);
    if (!o) return { erro: tr('Obra não encontrada.') };
    const mudou = Object.keys(campos).filter((k) => JSON.stringify(o[k]) !== JSON.stringify(campos[k]));
    const antes = situacaoDaObra(o);
    Object.assign(o, campos, { alteradoEm: Date.now() });
    if (antes !== d.situacao) auditar(tr('Obras'), tr('Situação da obra {nome}', { nome: d.nome }), SITUACOES_OBRA[antes].nome, SITUACOES_OBRA[d.situacao].nome, '', por);
    else if (mudou.length) auditar(tr('Obras'), tr('Obra alterada: {nome}', { nome: d.nome }), '', mudou.join(', '), '', por);
    salvar();
    return { ok: true, id };
  }
  const nova = { id: novoId('ob'), ...campos, criadoEm: Date.now() };
  if (d.projetoId) nova.projetoId = d.projetoId;
  obras().push(nova);
  // projeto do Measure que virou obra: ficam ligados (OB-07)
  const pj = d.projetoId && ((estado().measure || {}).projetos || []).find((p) => p.id === d.projetoId);
  if (pj) {
    pj.obraId = nova.id;
    // ganho numa concorrência (docs/concorrencias.md CO-14): a obra já nasce ligada à obra de quem contratou
    if (pj.concorrencia && pj.concorrencia.vinculo) { nova.vinculo = { ...pj.concorrencia.vinculo }; nova.concorrenciaId = pj.concorrencia.id; }
  }
  auditar(tr('Obras'), tr('Obra criada: {nome}', { nome: d.nome }), '', nova.cidade + ' · ' + d.inicio + ' → ' + d.prazo, '', por);
  if (dados.modeloId === MODELO_DO_PROJETO) aplicarCronogramaDoProjeto(nova.id, pj, por);
  else if (dados.modeloId) aplicarModelo(nova.id, dados.modeloId, por);
  salvar();
  return { ok: true, id: nova.id };
}

/* ---------- O projeto ganho é a obra (docs/daily-primeira-versao.md) ----------
 * Quando o projeto fica "ganha", a obra nasce sozinha, 1 para 1, a partir dele: nome, partes, endereço, datas do cronograma,
 * local no mapa e dias de trabalho (p.execucao = { lat, lon, raio, diasTrabalho }). Depois, o cadastro do projeto manda na obra.
 * Na conta com banco, o gatilho projetos_obra (migração 0020) faz o mesmo. */
function camposDoProjeto(pj) {
  const ex = pj.execucao || {};
  const lat = Number(ex.lat), lon = Number(ex.lon);
  const temLocal = ex.lat !== '' && ex.lat != null && ex.lon !== '' && ex.lon != null && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  const raio = Math.min(RAIO_MAX, Math.max(RAIO_MIN, Math.round(Number(ex.raio)) || RAIO_CERCA));
  const dias = [...new Set((Array.isArray(ex.diasTrabalho) ? ex.diasTrabalho : []).map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6))].sort();
  const local = { municipio: t(pj.cidade), estado: t(pj.estado).toUpperCase(), zip: t(pj.zip) };
  return {
    contratanteId: pj.contratanteId || null, donoId: pj.donoId && pj.donoId !== pj.contratanteId ? pj.donoId : null,
    endereco: t(pj.endereco), ...local, cidade: textoCidade(local),
    lat: temLocal ? lat : null, lon: temLocal ? lon : null, cerca: temLocal ? { lat, lon, raio } : { raio },
    diasTrabalho: dias.length ? dias : DIAS_TRABALHO.slice(),
  };
}
const nomeLivreDeObra = (lista, nome, ignorarId) => {
  const base = t(nome); let nm = base, n = 0;
  while (lista.some((o) => o.id !== ignorarId && o.nome.toLowerCase() === nm.toLowerCase())) { n += 1; nm = base + ' (' + n + ')'; }
  return nm;
};
export function garantirObraDoProjeto(pj, dados = estado(), por = '') {
  if (!pj || pj.situacao !== 'ganha') return null;
  if (dados.oficial) return null;   // na conta com banco, o gatilho projetos_obra (migração 0020) cria a obra; o espelho a traz depois
  dados.obras = dados.obras || [];
  const lista = dados.obras;
  const campos = camposDoProjeto(pj);
  const existente = pj.obraId && lista.find((o) => o.id === pj.obraId);
  if (existente) {
    if (existente.projetoId === pj.id) Object.assign(existente, campos, { nome: nomeLivreDeObra(lista, pj.nome, existente.id) });
    return existente;
  }
  const tarefas = ((pj.cronograma || {}).tarefas || []).filter((x) => DATA.test(x.inicio || ''));
  const inicio = tarefas.map((x) => x.inicio).sort()[0] || hoje();
  const fins = tarefas.map((x) => somarDias(x.inicio, Math.max(0, (Number(x.dias) || 1) - 1))).sort();
  const prazo = fins.length && fins[fins.length - 1] >= inicio ? fins[fins.length - 1] : somarDias(inicio, 89);
  const nova = { id: novoId('ob'), ...campos, nome: nomeLivreDeObra(lista, pj.nome), inicio, prazo, responsavelId: null, situacao: 'andamento', projetoId: pj.id, criadoEm: Date.now() };
  // ganho numa concorrência (CO-14): a obra já nasce ligada à obra de quem contratou
  if (pj.concorrencia && pj.concorrencia.vinculo && pj.concorrencia.vinculo.obraId) { nova.vinculo = { ...pj.concorrencia.vinculo }; nova.concorrenciaId = pj.concorrencia.id; }
  lista.push(nova);
  pj.obraId = nova.id;
  if (dados === estado()) {
    auditar(tr('Obras'), tr('Obra criada a partir do projeto ganho: {nome}', { nome: nova.nome }), '', nova.cidade + ' · ' + inicio + ' → ' + prazo, '', por);
    cronogramaDoProjetoNaObra(pj, por);
  }
  return nova;
}
/* O cronograma confirmado no projeto vira as etapas da obra automática (só enquanto a obra não tem etapas; no app com banco, o cronograma da obra é do servidor). */
export function cronogramaDoProjetoNaObra(pj, por = '') {
  const o = pj && pj.obraId && obras().find((x) => x.id === pj.obraId && x.projetoId === pj.id);
  if (!o || servidorCronograma() || !baseDoProjeto(pj).length) return false;
  const atual = (estado().cronogramas || {})[o.id];
  if (atual && (atual.etapas || []).length) return false;
  return !aplicarCronogramaDoProjeto(o.id, pj, por).erro;
}

/* Todos os projetos ganhos da empresa com a obra em dia (chamado ao desenhar, na 1ª versão: barato e idempotente). */
export function garantirObrasDosProjetos(dados = estado()) {
  let mudou = false;
  for (const pj of ((dados.measure || {}).projetos || [])) {
    if (pj.situacao !== 'ganha') continue;
    const antes = JSON.stringify(dados.obras && dados.obras.find((o) => o.id === pj.obraId));
    const o = garantirObraDoProjeto(pj, dados);
    if (o && JSON.stringify(o) !== antes) mudou = true;
  }
  if (mudou && dados === estado()) salvar();
  return mudou;
}

/* Projeto do Measure ligado à obra (o que virou obra, ou o primeiro que aponta para ela). */
export function projetoDaObra(o) {
  const lista = (estado().measure || {}).projetos || [];
  return lista.find((p) => p.id === o.projetoId) || lista.find((p) => p.obraId === o.id) || null;
}

/* ---------- Cronograma confirmado no projeto ganho ---------- */

export const MODELO_DO_PROJETO = 'projeto';

/* Tarefas da base confirmada no projeto (só as que têm início), na ordem das datas. */
export function baseDoProjeto(pj) {
  const b = pj && pj.cronograma && pj.cronograma.confirmado;
  const tarefas = ((b && b.tarefas) || []).filter((t) => t.inicio).map((t) => ({ nome: t.nome, inicio: t.inicio, fim: somarDias(t.inicio, Math.max(0, (Number(t.dias) || 1) - 1)) }));
  tarefas.sort((a, c) => a.inicio.localeCompare(c.inicio));
  return tarefas;
}

export function aplicarCronogramaDoProjeto(obraId, pj, por) {
  const o = obras().find((x) => x.id === obraId);
  const base = baseDoProjeto(pj);
  if (!o || !base.length) return { erro: tr('O projeto não tem cronograma confirmado.') };
  if (servidorCronograma()) return { erro: tr('Neste modo, monte o cronograma da obra pelo modelo de etapas.') };
  estado().cronogramas = estado().cronogramas || {};
  estado().cronogramas[obraId] = { etapas: base.map((e) => ({ id: novoId('et'), ...e, responsavelId: null, pct: 0, historico: [] })), bases: [], publicacoes: [] };
  auditar(tr('Cronograma'), tr('Cronograma do projeto aplicado em {obra}', { obra: o.nome }), '', base.length + '', '', por);
  novaBase(obraId, tr('Primeira versão do cronograma (confirmado no projeto {nome})', { nome: pj.nome }), por, true);
  salvar();
  return { ok: true };
}

/* ---------- Modelos de etapas (OB-06) ---------- */

export function modelos() { return estado().modelosCronograma || []; }
export function modelo(id) { return modelos().find((m) => m.id === id) || null; }

export function salvarModelo(id, dados, por) {
  const nome = t(dados.nome);
  const etapas = (dados.etapas || []).map((e) => ({ nome: t(e.nome), pct: Number(String(e.pct).replace(',', '.')) })).filter((e) => e.nome);
  if (!nome) return { erro: tr('Dê um nome ao modelo.') };
  if (modelos().some((m) => m.id !== id && m.nome.toLowerCase() === nome.toLowerCase())) return { erro: tr('Já existe um modelo com esse nome.') };
  if (!etapas.length) return { erro: tr('Inclua pelo menos uma etapa.') };
  if (etapas.some((e) => !Number.isFinite(e.pct) || e.pct <= 0)) return { erro: tr('Cada etapa precisa de uma parte do prazo maior que zero.') };
  const soma = etapas.reduce((s, e) => s + e.pct, 0);
  if (Math.abs(soma - 100) > 0.5) return { erro: tr('As partes do prazo somam {soma}%: precisam somar 100%.', { soma: Math.round(soma * 10) / 10 }) };
  estado().modelosCronograma = modelos();
  if (id) {
    const m = modelo(id);
    if (!m) return { erro: tr('Modelo não encontrado.') };
    Object.assign(m, { nome, etapas });
    auditar(tr('Obras'), tr('Modelo de etapas alterado: {nome}', { nome }), '', etapas.length + '', '', por);
  } else {
    estado().modelosCronograma.push({ id: novoId('mc'), nome, etapas });
    auditar(tr('Obras'), tr('Modelo de etapas criado: {nome}', { nome }), '', etapas.length + '', '', por);
  }
  salvar();
  return { ok: true };
}

export function excluirModelo(id, por) {
  const m = modelo(id);
  if (!m) return { erro: tr('Modelo não encontrado.') };
  estado().modelosCronograma = modelos().filter((x) => x.id !== id);
  auditar(tr('Obras'), tr('Modelo de etapas excluído: {nome}', { nome: m.nome }), '', '', '', por);
  salvar();
  return { ok: true };
}

/* Divide o período da obra entre as etapas, em sequência, pela parte do prazo de cada uma.
 * Cada etapa tem pelo menos 1 dia; a última termina no prazo. */
export function distribuir(etapas, inicio, prazo) {
  const total = diasEntre(inicio, prazo) + 1;
  const soma = etapas.reduce((s, e) => s + e.pct, 0) || 1;
  let acumulado = 0, dia = 0;
  return etapas.map((e, i) => {
    acumulado += e.pct;
    const ultima = i === etapas.length - 1;
    let fimDia = ultima ? total - 1 : Math.round((acumulado / soma) * total) - 1;
    fimDia = Math.max(dia, Math.min(fimDia, total - 1));
    const r = { nome: e.nome, inicio: somarDias(inicio, Math.min(dia, total - 1)), fim: somarDias(inicio, fimDia) };
    dia = Math.min(fimDia + 1, total - 1);
    return r;
  });
}

/* Aplica um modelo a uma obra sem etapas: as etapas entram e a primeira linha de base é salva. */
export function aplicarModelo(obraId, modeloId, por) {
  const o = obras().find((x) => x.id === obraId);
  const m = modelo(modeloId);
  if (!o || !m) return { erro: tr('Modelo não encontrado.') };
  const c = cronogramaDe(obraId);
  if (c && c.etapas.length) return { erro: tr('O cronograma desta obra já tem etapas.') };
  if (servidorCronograma()) return servidorCronograma().aplicarModelo(obraId, modeloId);
  estado().cronogramas = estado().cronogramas || {};
  estado().cronogramas[obraId] = { etapas: [], bases: [], publicacoes: [] };
  estado().cronogramas[obraId].etapas = distribuir(m.etapas, o.inicio, o.prazo).map((e) => ({ id: novoId('et'), ...e, responsavelId: null, pct: 0, historico: [] }));
  auditar(tr('Cronograma'), tr('Modelo aplicado em {obra}: {modelo}', { obra: o.nome, modelo: m.nome }), '', m.etapas.length + '', '', por);
  novaBase(obraId, tr('Primeira versão do cronograma (modelo {nome})', { nome: m.nome }), por, true);
  salvar();
  return { ok: true };
}

/* Modelos que a demonstração já traz (a empresa ajusta e cria os seus). */
export function modelosIniciais(tipo) {
  const m = (nome, etapas) => ({ id: novoId('mc'), nome, etapas: etapas.map(([n, pct]) => ({ nome: n, pct })) });
  if (tipo === 'prestadora') return [
    m(tr('Framing + siding (casa)'), [[tr('Mobilização e marcação'), 5], [tr('Framing do 1º pavimento'), 20], [tr('Framing do 2º pavimento'), 20], [tr('Telhado (estrutura)'), 15], [tr('OSB e house wrap'), 10], [tr('Janelas e portas externas'), 10], [tr('Siding e acabamentos externos'), 20]]),
    m(tr('Só siding'), [[tr('Mobilização'), 10], [tr('House wrap e flashing'), 20], [tr('Siding'), 55], [tr('Acabamentos e limpeza'), 15]]),
  ];
  return [
    m(tr('Edifício residencial'), [[tr('Fundação'), 12], [tr('Estrutura'), 30], [tr('Alvenaria'), 18], [tr('Instalações'), 15], [tr('Acabamento'), 20], [tr('Limpeza e entrega'), 5]]),
    m(tr('Galpão'), [[tr('Terraplenagem'), 10], [tr('Fundação'), 15], [tr('Estrutura metálica'), 25], [tr('Cobertura e fechamento'), 20], [tr('Piso industrial'), 20], [tr('Instalações e entrega'), 10]]),
  ];
}

/* Valores do formulário de uma obra nova (vazia ou a partir de um projeto do Measure). */
export function obraEmBranco(projeto) {
  const inicio = somarDias(hoje(), 7);
  const base = { situacao: 'andamento', inicio, prazo: somarDias(inicio, 89), diasTrabalho: DIAS_TRABALHO.slice(), cerca: { raio: RAIO_CERCA }, estado: 'NH' };
  if (!projeto) return base;
  const bp = baseDoProjeto(projeto);
  if (bp.length) { base.inicio = bp[0].inicio; base.prazo = bp.map((e) => e.fim).sort().pop(); }
  return { ...base, nome: projeto.nome, contratanteId: projeto.contratanteId, donoId: projeto.donoId, endereco: projeto.endereco, municipio: projeto.cidade, estado: projeto.estado || 'NH', zip: projeto.zip, projetoId: projeto.id };
}
