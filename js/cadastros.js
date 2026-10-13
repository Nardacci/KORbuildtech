/* KORbuild — os cadastros do Settings no banco (docs/banco.md §3, fatia 2): funcionários e valor hora, encargos,
 * regras de jornada, contatos, obras, alocações e modelos de etapas. Página oficial (sem "?demo").
 * As regras ficam no banco (RLS, gatilhos, versões só com insert); aqui ficam as mesmas checagens do protótipo
 * (js/settings.js, js/crew.js, js/contatos.js, js/obras.js) para a mensagem sair clara antes de ir ao banco. */

import { tr } from './i18n.js';
import { hoje } from './util.js';
import { conta, cliente, iniciar, traduzir } from './conta.js';
import { estado } from './armazem.js';
import { espelho, montar } from './espelho.js';

/* O que já foi lido do banco; cada tela pede só o que usa. */
export const cad = { funcionarios: [], valores: [], encargos: [], regras: [], contatos: [], obras: [], alocacoes: [], modelos: [], membros: [] };
const TABELAS = {
  funcionarios: ['funcionarios', 'nome'], valores: ['funcionario_valores', 'desde'], encargos: ['encargos_versoes', 'desde'],
  regras: ['regras_jornada_versoes', 'desde'], contatos: ['contatos', 'nome'], obras: ['obras', 'nome'],
  alocacoes: ['alocacoes', 'criado_em'], modelos: ['modelos_cronograma', 'nome'], membros: ['membros', 'nome'],
};
const lidas = new Set();

export async function carregar(nomes, forcar) {
  await iniciar();
  const faltam = nomes.filter((n) => forcar || !lidas.has(n));
  await Promise.all(faltam.map(async (n) => {
    const [tabela, ordem] = TABELAS[n];
    const { data, error } = await cliente().from(tabela).select('*').order(ordem);
    cad[n] = error ? [] : data || [];
    lidas.add(n);
  }));
}
/* Depois de gravar: lê de novo o que mudou. Ao sair da conta, esquece tudo. */
const reler = (nomes) => carregar(nomes, true);
export function esquecer() { lidas.clear(); for (const k of Object.keys(cad)) cad[k] = []; }
export const jaLeu = (nomes) => nomes.every((n) => lidas.has(n));

const t = (v) => String(v == null ? '' : v).trim();
const n = (v) => (t(v) === '' ? NaN : Number(String(v).replace(',', '.')));
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* Erros do banco com a mensagem que a pessoa entende. */
function erroDoBanco(error, duplicado, emUso) {
  const m = (error && error.message) || '';
  if (/duplicate key|unique/i.test(m) && duplicado) return { erro: duplicado };
  if (/foreign key|violates/i.test(m) && emUso) return { erro: emUso };
  return { erro: traduzir(error) };
}
async function gravar(promessa, recarregar, duplicado, emUso) {
  const { data, error } = await promessa;
  if (error) return erroDoBanco(error, duplicado, emUso);
  await reler(recarregar);
  return { ok: true, data };
}

/* ---------- Datas e vigências ---------- */

export function segundaDe(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7));
  return dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
}
/* A versão vigente numa data: a última com "desde" até a data (ou a primeira, se todas forem futuras). */
export function vigente(lista, iso = hoje()) {
  const ord = lista.slice().sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : (a.em < b.em ? -1 : 1)));
  let v = ord[0] || null;
  for (const x of ord) if (x.desde <= iso) v = x;
  return v;
}
export const historico = (lista) => lista.slice().sort((a, b) => (a.desde < b.desde ? 1 : -1));

/* ---------- Funcionários e valor hora ---------- */

export const funcionario = (id) => cad.funcionarios.find((f) => f.id === id) || null;
export const valoresDe = (id) => cad.valores.filter((v) => v.funcionario_id === id);
export function valorAtual(id, iso = hoje()) { const v = vigente(valoresDe(id), iso); return v ? Number(v.valor) : 0; }
export function encargosVigentes(iso = hoje()) { return vigente(cad.encargos, iso); }
export function totalEncargos(v) { return v ? v.itens.reduce((s, i) => s + Number(i.pct || 0), 0) / 100 : 0; }
export function certificacoesAVencer(f, dias = 30) {
  const limite = new Date(Date.now() + dias * 864e5).toISOString().slice(0, 10);
  return (f.certificacoes || []).filter((c) => c.validade && c.validade <= limite);
}

export async function salvarFuncionario(id, d) {
  const dados = {
    nome: t(d.nome), codigo: t(d.codigo), funcao: t(d.funcao), admissao: t(d.admissao),
    classificacao: d.classificacao || 'w2', flsa: d.classificacao === '1099' ? 'isento' : (d.flsa || 'nao-isento'),
    situacao: d.situacao || 'ativo', desligamento: d.situacao === 'desligado' ? t(d.desligamento) || null : null,
    telefone: t(d.telefone), emergencia: t(d.emergencia), aviso_gps_em: t(d.aviso_gps_em) || null,
    certificacoes: (d.certificacoes || []).filter((c) => t(c.nome)).map((c) => ({ nome: t(c.nome), validade: t(c.validade) || null })),
  };
  if (!dados.nome) return { erro: tr('Informe o nome.') };
  if (!dados.funcao) return { erro: tr('Informe a função.') };
  if (!DATA.test(dados.admissao)) return { erro: tr('Informe a data de admissão.') };
  if (dados.situacao === 'desligado' && !dados.desligamento) return { erro: tr('Informe a data do desligamento.') };
  const codigoRepetido = tr('Já existe um funcionário com esse código.');
  if (!id) {
    const valor = n(d.valorHora);
    if (!(valor > 0)) return { erro: tr('Informe o valor hora inicial.') };
    return gravar(cliente().rpc('criar_funcionario', { p: dados, p_valor: Math.round(valor * 100) / 100 }), ['funcionarios', 'valores'], codigoRepetido);
  }
  const r = await gravar(cliente().from('funcionarios').update(dados).eq('id', id), ['funcionarios'], codigoRepetido);
  return r.erro ? r : { ok: true, data: id };
}

export async function novoValorHora(funcionarioId, d) {
  const valor = n(d.valor), desde = t(d.desde), motivo = t(d.motivo);
  if (!(valor > 0)) return { erro: tr('Informe um valor hora maior que zero.') };
  if (!DATA.test(desde)) return { erro: tr('Informe a data a partir da qual vale.') };
  if (!motivo) return { erro: tr('O motivo é obrigatório: fica no histórico.') };
  return gravar(cliente().from('funcionario_valores').insert({ funcionario_id: funcionarioId, desde, valor: Math.round(valor * 100) / 100, motivo }),
    ['valores'], tr('Já existe um valor a partir dessa data.'));
}

/* ---------- Encargos e regras de jornada (versões; o banco recusa o passado) ---------- */

export async function novosEncargos(d) {
  const itens = (d.itens || []).filter((i) => t(i.nome)).map((i) => ({ nome: t(i.nome), pct: n(i.pct) }));
  if (!DATA.test(t(d.desde))) return { erro: tr('Informe a data a partir da qual vale.') };
  if (!t(d.motivo)) return { erro: tr('O motivo é obrigatório: fica na auditoria.') };
  if (!itens.length || itens.some((i) => !(i.pct >= 0 && i.pct <= 100))) return { erro: tr('Cada encargo precisa de um nome e de um % entre 0 e 100.') };
  return gravar(cliente().from('encargos_versoes').insert({ desde: t(d.desde), itens, motivo: t(d.motivo) }), ['encargos']);
}

export async function novaRegra(d) {
  const r = {
    desde: t(d.desde), nome: t(d.nome) || tr('Regra da empresa'), nota: t(d.nota), motivo: t(d.motivo),
    semanal: { limite: n(d.semanalLimite), fator: n(d.semanalFator) },
    diaria: { ativo: !!d.diariaAtivo, limite: n(d.diariaLimite), fator: n(d.diariaFator), dobra: n(d.diariaDobra), fatorDobra: n(d.diariaFatorDobra) },
    intervalo: { minimo: n(d.intervaloMinimo), apos: n(d.intervaloApos) },
  };
  if (!DATA.test(r.desde)) return { erro: tr('Informe a data a partir da qual vale.') };
  if (!r.motivo) return { erro: tr('O motivo é obrigatório: fica na auditoria.') };
  const nums = [r.semanal.limite, r.semanal.fator, r.intervalo.minimo, r.intervalo.apos].concat(r.diaria.ativo ? [r.diaria.limite, r.diaria.fator, r.diaria.dobra, r.diaria.fatorDobra] : []);
  if (nums.some((v) => !(v >= 0)) || r.semanal.fator < 1 || r.semanal.limite <= 0) return { erro: tr('Confira os números: limites maiores que zero e fatores a partir de 1.') };
  if (r.diaria.ativo && !(r.diaria.dobra > r.diaria.limite)) return { erro: tr('O limite da hora dobrada precisa ser maior que o da hora extra diária.') };
  if (!r.diaria.ativo) for (const k of ['limite', 'fator', 'dobra', 'fatorDobra']) if (!Number.isFinite(r.diaria[k])) r.diaria[k] = { limite: 8, fator: 1.5, dobra: 12, fatorDobra: 2 }[k];
  return gravar(cliente().from('regras_jornada_versoes').insert(r), ['regras']);
}

/* ---------- Contatos ---------- */

export const PAPEIS_CONTATO = ['construtora', 'cliente', 'fornecedor', 'prestadora'];
export const contato = (id) => cad.contatos.find((c) => c.id === id) || null;

export async function salvarContato(id, d) {
  const c = {
    nome: t(d.nome), pessoa: t(d.pessoa), email: t(d.email), telefone: t(d.telefone),
    endereco: t(d.endereco), cidade: t(d.cidade), estado: t(d.estado).toUpperCase(), zip: t(d.zip),
    papeis: PAPEIS_CONTATO.filter((p) => (d.papeis || []).includes(p)),
    etapas: String(d.etapas || '').split(',').map(t).filter(Boolean), notas: t(d.notas),
  };
  if (!c.nome) return { erro: tr('Informe o nome (empresa ou pessoa).') };
  if (!c.papeis.length) return { erro: tr('Marque pelo menos um: construtora, cliente ou fornecedor.') };
  if (c.email && !EMAIL.test(c.email)) return { erro: tr('E-mail inválido.') };
  if (c.estado && !/^[A-Z]{2}$/.test(c.estado)) return { erro: tr('Estado com 2 letras (ex.: NH).') };
  if (c.zip && !/^\d{5}(-\d{4})?$/.test(c.zip)) return { erro: tr('ZIP code com 5 dígitos.') };
  const repetido = tr('Já existe um contato com esse nome.');
  return id
    ? gravar(cliente().from('contatos').update(c).eq('id', id), ['contatos'], repetido)
    : gravar(cliente().from('contatos').insert(c).select('id').single(), ['contatos'], repetido);
}
export function excluirContato(id) {
  return gravar(cliente().from('contatos').delete().eq('id', id), ['contatos'], null,
    tr('Este contato está numa obra: troque o contratante ou o dono da obra antes de excluir.'));
}

/* ---------- Obras e alocações ---------- */

export const RAIO_PADRAO = 150, RAIO_MIN = 50, RAIO_MAX = 2000;
export const obra = (id) => cad.obras.find((o) => o.id === id) || null;
export const empresaExecuta = () => !!conta.empresa && conta.empresa.atuacao !== 'construtora';

export async function salvarObra(id, d) {
  const o = {
    nome: t(d.nome), contratante_id: t(d.contratanteId) || null, dono_id: t(d.donoId) || null,
    endereco: t(d.endereco), municipio: t(d.municipio), estado: t(d.estado).toUpperCase(), zip: t(d.zip),
    lat: n(d.lat), lon: n(d.lon), raio: Number.isFinite(n(d.raio)) ? Math.round(n(d.raio)) : RAIO_PADRAO,
    inicio: t(d.inicio), prazo: t(d.prazo), responsavel_id: t(d.responsavelId) || null,
    dias_trabalho: (d.diasTrabalho || []).map(Number).filter((x) => x >= 0 && x <= 6).sort(), situacao: d.situacao || 'andamento',
  };
  if (!o.nome) return { erro: tr('Dê um nome à obra.') };
  if (!o.contratante_id) return { erro: tr('Escolha o contratante: a construtora que contratou, ou o próprio cliente quando contrata direto.') };
  if (o.dono_id === o.contratante_id) o.dono_id = null;
  if (!o.municipio || !o.estado) return { erro: tr('Informe a cidade e o estado da obra.') };
  if (!/^[A-Z]{2}$/.test(o.estado)) return { erro: tr('Estado com 2 letras (ex.: NH).') };
  if (o.zip && !/^\d{5}(-\d{4})?$/.test(o.zip)) return { erro: tr('ZIP code com 5 dígitos (ex.: 03104).') };
  if (!Number.isFinite(o.lat) || !Number.isFinite(o.lon) || Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180) return { erro: tr('Marque o local da obra no mapa (ou use a localização atual): ele vale para a cerca do ponto e o clima do diário.') };
  if (o.raio < RAIO_MIN || o.raio > RAIO_MAX) return { erro: tr('Raio da cerca entre {min} e {max} m.', { min: RAIO_MIN, max: RAIO_MAX }) };
  if (!DATA.test(o.inicio) || !DATA.test(o.prazo)) return { erro: tr('Informe o início e o prazo da obra.') };
  if (o.prazo < o.inicio) return { erro: tr('O prazo não pode ser antes do início.') };
  if (empresaExecuta() && !o.responsavel_id) return { erro: tr('Escolha quem preenche o diário desta obra.') };
  if (!o.dias_trabalho.length) { if (empresaExecuta()) return { erro: tr('Marque pelo menos um dia de trabalho.') }; o.dias_trabalho = [1, 2, 3, 4, 5]; }
  const repetida = tr('Já existe uma obra com esse nome.');
  if (id) {
    const r = await gravar(cliente().from('obras').update(o).eq('id', id), ['obras'], repetida);
    return r.erro ? r : { ok: true, data: id };
  }
  // a partir do projeto ganho (OB-07): ganho numa concorrência, é a função do banco que cria a obra já ligada (CO-14)
  const pj = d.projetoId ? (((estado() || {}).measure || {}).projetos || []).find((p) => p.id === d.projetoId) : null;
  if (pj && pj.concorrencia && pj.concorrencia.conviteId && pj.concorrencia.vinculo) {
    const r = await gravar(cliente().rpc('criar_obra_da_concorrencia', { p_convite: pj.concorrencia.conviteId, p: o }), ['obras'], repetida);
    if (!r.erro && espelho.pronto) montar(true).catch(() => {});
    return r.erro ? r : { ok: true, data: r.data };
  }
  if (d.projetoId) o.projeto_id = d.projetoId;
  const r = await gravar(cliente().from('obras').insert(o).select('id').single(), ['obras'], repetida);
  if (r.erro) return r;
  if (d.projetoId) { await cliente().from('projetos').update({ obra_id: r.data.id }).eq('id', d.projetoId); if (espelho.pronto) montar(true).catch(() => {}); }
  return { ok: true, data: r.data.id };
}

export const alocacoesDa = (obraId) => cad.alocacoes.filter((a) => a.obra_id === obraId);
export function alocar(obraId, quem, papel) {
  const [tipo, id] = String(quem || '').split(':');
  if (!id) return Promise.resolve({ erro: tr('Escolha quem vai trabalhar na obra.') });
  if (alocacoesDa(obraId).some((a) => (tipo === 'm' ? a.membro_id : a.funcionario_id) === id && !a.ate)) return Promise.resolve({ erro: tr('Essa pessoa já está na obra.') });
  return gravar(cliente().from('alocacoes').insert({ obra_id: obraId, [tipo === 'm' ? 'membro_id' : 'funcionario_id']: id, papel: t(papel) }), ['alocacoes']);
}
export const desalocar = (id) => gravar(cliente().from('alocacoes').delete().eq('id', id), ['alocacoes']);

/* ---------- Modelos de etapas ---------- */

export const modelo = (id) => cad.modelos.find((m) => m.id === id) || null;
export async function salvarModelo(id, d) {
  const nome = t(d.nome);
  const etapas = (d.etapas || []).map((e) => ({ nome: t(e.nome), pct: n(e.pct) })).filter((e) => e.nome);
  if (!nome) return { erro: tr('Dê um nome ao modelo.') };
  if (!etapas.length) return { erro: tr('Inclua pelo menos uma etapa.') };
  if (etapas.some((e) => !Number.isFinite(e.pct) || e.pct <= 0)) return { erro: tr('Cada etapa precisa de uma parte do prazo maior que zero.') };
  const soma = etapas.reduce((s, e) => s + e.pct, 0);
  if (Math.abs(soma - 100) > 0.5) return { erro: tr('As partes do prazo somam {soma}%: precisam somar 100%.', { soma: Math.round(soma * 10) / 10 }) };
  const repetido = tr('Já existe um modelo com esse nome.');
  return id
    ? gravar(cliente().from('modelos_cronograma').update({ nome, etapas }).eq('id', id), ['modelos'], repetido)
    : gravar(cliente().from('modelos_cronograma').insert({ nome, etapas }), ['modelos'], repetido);
}
export const excluirModelo = (id) => gravar(cliente().from('modelos_cronograma').delete().eq('id', id), ['modelos']);
