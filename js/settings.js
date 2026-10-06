/* KORbuild Settings — configuração da empresa, lida por todos os módulos.
 *
 * Princípios (docs/settings.md):
 *  - Nada de regra de negócio fixa no código: regras de jornada e encargos vêm daqui.
 *  - O que mexe com dinheiro tem vigência ("a partir de") e nunca reescreve o passado.
 *  - Toda mudança fica na auditoria: quem, quando, antes, depois e motivo.
 *  - Não amarra a um estado: os "modelos" só preenchem o formulário; a empresa ajusta. */

import { hoje, somarDias, novoId } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar } from './armazem.js';

/* ---------- Utilidades de data ---------- */

export function segundaDe(iso) {
  const [a, m, d] = iso.split('-').map(Number);
  const dia = new Date(a, m - 1, d).getDay(); // 0 = domingo
  return somarDias(iso, -((dia + 6) % 7));
}

function cfg() { return estado().settings; }

/* ---------- Modelos (só para preencher o formulário) ---------- */

export const MODELOS_REGRA = {
  federal: {
    nome: tr('New Hampshire (FLSA federal)'),
    semanal: { limite: 40, fator: 1.5 },
    diaria: { ativo: false, limite: 8, fator: 1.5, dobra: 12, fatorDobra: 2 },
    intervalo: { minimo: 30, apos: 5 },
    nota: tr('Hora extra só semanal (FLSA). New Hampshire: 30 min de intervalo depois de 5 h seguidas (RSA 275:30-a).'),
  },
  diaria: {
    nome: tr('Com hora extra diária (ex.: Califórnia)'),
    semanal: { limite: 40, fator: 1.5 },
    diaria: { ativo: true, limite: 8, fator: 1.5, dobra: 12, fatorDobra: 2 },
    intervalo: { minimo: 30, apos: 5 },
    nota: tr('Acima de 8 h no dia: 1,5×; acima de 12 h: 2×. A hora extra diária não conta de novo na semanal.'),
  },
};

export const ENCARGOS_INICIAIS = [
  { nome: tr('FICA (Social Security + Medicare)'), pct: 7.65 },
  { nome: tr('FUTA (desemprego federal)'), pct: 0.6 },
  { nome: tr('SUTA (desemprego estadual)'), pct: 2.8 },
  { nome: "Workers' comp", pct: 14 },
  { nome: tr('Benefícios (saúde, férias, feriados)'), pct: 7 },
];

export const CLASSIFICACOES = { w2: tr('Empregado (W-2)'), '1099': tr('Autônomo (1099)') };
export const FLSA = { 'nao-isento': tr('Não isento (recebe hora extra)'), isento: tr('Isento (exempt)') };
export const SITUACOES_FUNC = { ativo: tr('Ativo'), afastado: tr('Afastado'), desligado: tr('Desligado') };

/* ---------- Versões com vigência ---------- */

function vigente(lista, iso) {
  const ord = (lista || []).slice().sort((a, b) => (a.desde < b.desde ? -1 : a.desde > b.desde ? 1 : a.em - b.em));
  let v = ord[0] || null;
  for (const x of ord) if (x.desde <= iso) v = x;
  return v;
}
export function historicoRegras() { return (cfg().regras || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : -1)); }
export function historicoEncargos() { return (cfg().encargos || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : -1)); }

/* Regra de jornada vigente numa data (a semana usa a regra da segunda-feira). */
export function regraEm(iso) { return vigente(cfg().regras, iso) || { ...MODELOS_REGRA.federal, desde: '1970-01-01' }; }

/* Encargos vigentes numa data: { itens, total (fração) }. */
export function encargosVersao(iso) { return vigente(cfg().encargos, iso) || { itens: ENCARGOS_INICIAIS, desde: '1970-01-01' }; }
export function encargosEm(iso) { return encargosVersao(iso).itens.reduce((t, i) => t + Number(i.pct || 0), 0) / 100; }

/* Mudanças que afetam dinheiro valem a partir da semana atual: semanas fechadas não mudam. */
function validarDesde(desde) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde || '')) return tr('Informe a data a partir da qual vale.');
  if (desde < segundaDe(hoje())) return (tr('Não vale para o passado: escolha uma data a partir de') + ' ') + segundaDe(hoje()).split('-').reverse().join('/') + (' ' + tr('(semana atual). Semanas fechadas não mudam.'));
  return null;
}

export function novaRegra(dados, motivo, por) {
  const desde = segundaDe(dados.desde || '');
  const erro = validarDesde(dados.desde) || (!motivo || !motivo.trim() ? tr('O motivo é obrigatório: fica na auditoria.') : null);
  if (erro) return { erro };
  const n = (v) => Number(String(v).replace(',', '.'));
  const r = {
    id: novoId('rg'), desde, nome: (dados.nome || '').trim() || tr('Regra da empresa'),
    semanal: { limite: n(dados.semanal.limite), fator: n(dados.semanal.fator) },
    diaria: { ativo: !!dados.diaria.ativo, limite: n(dados.diaria.limite), fator: n(dados.diaria.fator), dobra: n(dados.diaria.dobra), fatorDobra: n(dados.diaria.fatorDobra) },
    intervalo: { minimo: n(dados.intervalo.minimo), apos: n(dados.intervalo.apos) },
    motivo: motivo.trim(), por, em: Date.now(),
  };
  const valores = [r.semanal.limite, r.semanal.fator, r.intervalo.minimo, r.intervalo.apos].concat(r.diaria.ativo ? [r.diaria.limite, r.diaria.fator, r.diaria.dobra, r.diaria.fatorDobra] : []);
  if (valores.some((v) => !(v >= 0)) || r.semanal.fator < 1 || r.semanal.limite <= 0) return { erro: tr('Confira os números: limites maiores que zero e fatores a partir de 1.') };
  if (r.diaria.ativo && !(r.diaria.dobra > r.diaria.limite)) return { erro: tr('O limite da hora dobrada precisa ser maior que o da hora extra diária.') };
  const antes = regraEm(desde);
  cfg().regras.push(r);
  auditar(tr('Regras de jornada'), (tr('Nova regra a partir de') + ' ') + desde.split('-').reverse().join('/') + ': ' + r.nome, resumoRegra(antes), resumoRegra(r), r.motivo, por);
  salvar();
  return { ok: true, desde };
}

export function novosEncargos(itens, desde, motivo, por) {
  const erro = validarDesde(desde) || (!motivo || !motivo.trim() ? tr('O motivo é obrigatório: fica na auditoria.') : null);
  if (erro) return { erro };
  const limpos = itens.filter((i) => i.nome && i.nome.trim()).map((i) => ({ nome: i.nome.trim(), pct: Number(String(i.pct).replace(',', '.')) }));
  if (!limpos.length || limpos.some((i) => !(i.pct >= 0 && i.pct <= 100))) return { erro: tr('Cada encargo precisa de um nome e de um % entre 0 e 100.') };
  const antes = encargosVersao(desde);
  cfg().encargos.push({ id: novoId('en'), desde, itens: limpos, motivo: motivo.trim(), por, em: Date.now() });
  const fmt = (v) => v.itens.map((i) => i.nome + ' ' + String(i.pct).replace('.', ',') + '%').join(' · ') + ' = ' + (v.itens.reduce((t, i) => t + i.pct, 0)).toFixed(2).replace('.', ',') + '%';
  auditar(tr('Encargos'), (tr('Nova versão a partir de') + ' ') + desde.split('-').reverse().join('/'), fmt(antes), fmt({ itens: limpos }), motivo.trim(), por);
  salvar();
  return { ok: true };
}

export function resumoRegra(r) {
  const f = (v) => String(v).replace('.', ',');
  return (tr('Semanal: acima de') + ' ') + f(r.semanal.limite) + (' ' + tr('h →') + ' ') + f(r.semanal.fator) + tr('×') +
    (r.diaria.ativo ? (' ' + tr('· Diária: acima de') + ' ') + f(r.diaria.limite) + (' ' + tr('h →') + ' ') + f(r.diaria.fator) + (tr('×, acima de') + ' ') + f(r.diaria.dobra) + (' ' + tr('h →') + ' ') + f(r.diaria.fatorDobra) + tr('×') : (' ' + tr('· Sem hora extra diária'))) +
    (' ' + tr('· Intervalo:') + ' ') + f(r.intervalo.minimo) + (' ' + tr('min depois de') + ' ') + f(r.intervalo.apos) + ' h';
}

/* ---------- Horas extras de uma semana, pela regra vigente ----------
 * minutosPorDia: { iso: minutos pagos }. Devolve minutos regulares, extra (fator semanal/diário) e dobra. */
export function extrasDaSemana(f, segunda, minutosPorDia) {
  const regra = regraEm(segunda);
  const total = Object.values(minutosPorDia).reduce((t, v) => t + v, 0);
  if (f && (f.classificacao === '1099' || f.flsa === 'isento')) return { total, regular: total, extra: 0, dobra: 0, regra };
  let extraDia = 0, dobra = 0, regularDias = 0;
  for (const min of Object.values(minutosPorDia)) {
    if (regra.diaria.ativo) {
      const d2 = Math.max(0, min - regra.diaria.dobra * 60);
      const d15 = Math.max(0, Math.min(min, regra.diaria.dobra * 60) - regra.diaria.limite * 60);
      dobra += d2; extraDia += d15; regularDias += min - d2 - d15;
    } else regularDias += min;
  }
  const extraSemana = Math.max(0, regularDias - regra.semanal.limite * 60);
  return { total, regular: regularDias - extraSemana, extra: extraDia + extraSemana, dobra, regra };
}

/* ---------- Funcionários (cadastro da empresa, usado por todos os módulos) ---------- */

export function funcionarios() { return estado().funcionarios || []; }
export function ativos() { return funcionarios().filter((f) => f.situacao !== 'desligado'); }

const CAMPOS_FUNC = {
  nome: tr('Nome'), codigo: tr('Código'), telefone: tr('Telefone'), emergencia: tr('Contato de emergência'), funcao: tr('Função'), equipeId: tr('Equipe'),
  classificacao: tr('Classificação'), flsa: 'FLSA', admissao: tr('Admissão'), desligamento: tr('Desligamento'), situacao: tr('Situação'), avisoGps: tr('Aviso de localização aceito em'),
};

export function salvarFuncionario(id, dados, por) {
  if (!dados.nome || !dados.nome.trim()) return { erro: tr('Informe o nome.') };
  if (!dados.funcao) return { erro: tr('Informe a função.') };
  if (!dados.admissao) return { erro: tr('Informe a data de admissão.') };
  if (dados.situacao === 'desligado' && !dados.desligamento) return { erro: tr('Informe a data do desligamento.') };
  const certificacoes = (dados.certificacoes || []).filter((c) => c.nome && c.nome.trim()).map((c) => ({ nome: c.nome.trim(), validade: c.validade || '' }));
  const lista = estado().funcionarios;
  if (!id) {
    const valor = Number(String(dados.valorHora || '').replace(',', '.'));
    if (!(valor > 0)) return { erro: tr('Informe o valor hora inicial.') };
    const f = {
      id: novoId('f'), ...pick(dados), certificacoes,
      valores: [{ desde: dados.admissao, valor: Math.round(valor * 100) / 100, motivo: tr('Admissão'), por, em: Date.now() }],
    };
    lista.push(f);
    auditar(tr('Funcionários'), (tr('Cadastro de') + ' ') + f.nome, '', CLASSIFICACOES[f.classificacao] + ' · ' + f.funcao + (' ' + tr('· US$') + ' ') + valor.toFixed(2).replace('.', ',') + '/h', '', por);
    salvar();
    return { ok: true, id: f.id };
  }
  const f = lista.find((x) => x.id === id);
  const novo = pick(dados);
  const mudou = Object.keys(CAMPOS_FUNC).filter((k) => (f[k] || '') !== (novo[k] || ''));
  const certAntes = JSON.stringify(f.certificacoes || []), certDepois = JSON.stringify(certificacoes);
  if (!mudou.length && certAntes === certDepois) return { ok: true, id, semMudanca: true };
  const legivel = (k, v) => {
    if (!v) return '—';
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v.split('-').reverse().join('/');
    if (k === 'equipeId') return ((estado().crew.equipes || []).find((e) => e.id === v) || {}).nome || v;
    return ({ classificacao: CLASSIFICACOES, flsa: FLSA, situacao: SITUACOES_FUNC }[k] || {})[v] || v;
  };
  const antes = mudou.map((k) => CAMPOS_FUNC[k] + ': ' + legivel(k, f[k])).join(' · ') + (certAntes !== certDepois ? (' ' + tr('· Certificações:') + ' ') + ((f.certificacoes || []).map((c) => c.nome).join(', ') || '—') : '');
  const depois = mudou.map((k) => CAMPOS_FUNC[k] + ': ' + legivel(k, novo[k])).join(' · ') + (certAntes !== certDepois ? (' ' + tr('· Certificações:') + ' ') + (certificacoes.map((c) => c.nome).join(', ') || '—') : '');
  Object.assign(f, novo, { certificacoes });
  auditar(tr('Funcionários'), (tr('Cadastro de') + ' ') + f.nome + ' alterado', antes, depois, '', por);
  salvar();
  return { ok: true, id };
}

function pick(d) {
  const out = {};
  for (const k of Object.keys(CAMPOS_FUNC)) out[k] = typeof d[k] === 'string' ? d[k].trim() : (d[k] || '');
  out.classificacao = out.classificacao || 'w2';
  out.flsa = out.classificacao === '1099' ? 'isento' : (out.flsa || 'nao-isento');
  out.situacao = out.situacao || 'ativo';
  if (out.situacao !== 'desligado') out.desligamento = '';
  return out;
}

/* Certificações que vencem em até 30 dias (ou já venceram). */
export function certificacoesAVencer(f, dias) {
  const limite = somarDias(hoje(), dias == null ? 30 : dias);
  return (f.certificacoes || []).filter((c) => c.validade && c.validade <= limite);
}

/* ---------- Permissões e perfis de acesso ----------
 * O catálogo de permissões é o vocabulário do produto (o que existe para liberar). Quais perfis têm
 * quais permissões, e quem tem qual perfil, é configuração da empresa (Settings › Perfis de acesso). */

export const PERMISSOES = [
  { grupo: tr('Crew · ponto'), modulo: 'crew', itens: [
    { id: 'crew.ponto.proprio', nome: tr('Bater o próprio ponto'), descricao: tr('Entrada, intervalo e saída no próprio celular, com GPS') },
    { id: 'crew.ponto.equipe', nome: tr('Bater o ponto da equipe'), descricao: tr('Encarregado: marca a equipe e vê as horas dela') },
  ] },
  { grupo: tr('Crew · escritório'), modulo: 'crew', itens: [
    { id: 'crew.acompanhar', nome: tr('Acompanhar ponto e timesheets'), descricao: tr('Agora, timesheets e mapa do dia') },
    { id: 'crew.aprovar', nome: tr('Aprovar e ajustar timesheets'), descricao: tr('Aprovar, devolver, ajustar e exportar para a folha'), requer: ['crew.acompanhar'] },
    { id: 'crew.custos', nome: tr('Ver custos e valores em dinheiro'), descricao: tr('Custo das obras, orçamento, salários nos timesheets'), requer: ['crew.acompanhar'] },
  ] },
  { grupo: 'Daily', modulo: 'daily', itens: [
    { id: 'daily.preencher', nome: tr('Preencher o diário de obra'), descricao: tr('Criar e enviar o RDO das suas obras') },
    { id: 'daily.acompanhar', nome: tr('Acompanhar todas as obras'), descricao: tr('Painel, obras e relatórios enviados') },
    { id: 'daily.aprovar', nome: tr('Aprovar RDO e enviar ao contratante'), descricao: tr('Aprovar, pedir ajuste, PDF e link do contratante'), requer: ['daily.acompanhar'] },
  ] },
  { grupo: 'Measure', modulo: 'measure', itens: [
    { id: 'measure.medir', nome: tr('Medir plantas (takeoff)'), descricao: tr('Abrir plantas, definir a escala, medir e aplicar assemblies') },
    { id: 'measure.catalogo', nome: tr('Itens e assemblies'), descricao: tr('Cadastrar itens e montar assemblies com fórmulas'), requer: ['measure.medir'] },
  ] },
  { grupo: 'Settings', modulo: 'settings', itens: [
    { id: 'settings.funcionarios', nome: tr('Cadastro de funcionários'), descricao: tr('Dados, certificações e valor hora') },
    { id: 'settings.regras', nome: tr('Encargos e regras de jornada'), descricao: tr('Mudanças com vigência, sem mexer no passado') },
    { id: 'settings.acesso', nome: tr('Usuários e perfis de acesso'), descricao: tr('Quem entra e o que cada perfil pode fazer') },
    { id: 'settings.conta', nome: tr('Empresa, conta e plano'), descricao: tr('Dados e logo da empresa, termos da proposta, plano e módulos') },
    { id: 'settings.contatos', nome: tr('Contatos'), descricao: tr('Construtoras, clientes e fornecedores') },
  ] },
];
export const TODAS_PERMISSOES = PERMISSOES.flatMap((g) => g.itens.map((i) => i.id));
export function permissao(id) { return PERMISSOES.flatMap((g) => g.itens).find((i) => i.id === id); }

export const PERFIS_INICIAIS = [
  { id: 'administrador', nome: tr('Administrador'), descricao: tr('Escritório: tudo, inclusive o Settings'), sistema: true, permissoes: TODAS_PERMISSOES.filter((p) => p !== 'crew.ponto.proprio' && p !== 'crew.ponto.equipe' && p !== 'daily.preencher') },
  { id: 'gestor', nome: tr('Gestor de obras'), descricao: tr('Vê tudo dos módulos e aprova, sem mexer nas configurações'), permissoes: ['crew.acompanhar', 'crew.aprovar', 'crew.custos', 'daily.acompanhar', 'daily.aprovar', 'measure.medir'] },
  { id: 'encarregado', nome: tr('Encarregado'), descricao: tr('Campo: ponto da equipe e diário de obra'), permissoes: ['crew.ponto.proprio', 'crew.ponto.equipe', 'daily.preencher'] },
  { id: 'trabalhador', nome: tr('Trabalhador'), descricao: tr('Só bate o próprio ponto: entra direto no ponto, sem a tela de módulos'), permissoes: ['crew.ponto.proprio'] },
];

export function perfis() { return cfg().perfis || []; }
export function perfilDe(u) { return u ? perfis().find((p) => p.id === u.perfilId) || null : null; }
export function pode(u, perm) { const p = perfilDe(u); return !!p && p.permissoes.includes(perm); }
export function podeAlgum(u, prefixo) { const p = perfilDe(u); return !!p && p.permissoes.some((x) => x.startsWith(prefixo)); }

/* Módulos que a pessoa pode abrir, na ordem da tela de módulos. */
export function modulosDe(u) {
  const out = [];
  if (podeAlgum(u, 'daily.')) out.push('daily');
  if (podeAlgum(u, 'crew.')) out.push('crew');
  if (podeAlgum(u, 'measure.')) out.push('measure');
  if (podeAlgum(u, 'settings.')) out.push('settings');
  return out;
}

/* Inclui as permissões que outra exige (ex.: aprovar exige acompanhar). */
function completar(lista) {
  const set = new Set(lista.filter((p) => TODAS_PERMISSOES.includes(p)));
  for (const id of Array.from(set)) for (const r of (permissao(id).requer || [])) set.add(r);
  return TODAS_PERMISSOES.filter((p) => set.has(p));
}

export function salvarPermissoes(mapa, por) {
  // mapa: { perfilId: [permissões] }
  const mudancas = [];
  for (const p of perfis()) {
    if (p.sistema || !mapa[p.id]) continue;
    const nova = completar(mapa[p.id]);
    const antes = p.permissoes;
    const add = nova.filter((x) => !antes.includes(x)), rem = antes.filter((x) => !nova.includes(x));
    if (!add.length && !rem.length) continue;
    p.permissoes = nova;
    mudancas.push(p.nome);
    auditar(tr('Perfis de acesso'), (tr('Permissões do perfil') + ' ') + p.nome, rem.map((x) => permissao(x).nome).join(' · '), add.map((x) => permissao(x).nome).join(' · '), '', por);
  }
  salvar();
  return { ok: true, mudancas };
}

export function criarPerfil(nome, copiarDe, por) {
  if (!nome || !nome.trim()) return { erro: tr('Informe o nome do perfil.') };
  if (perfis().some((p) => p.nome.toLowerCase() === nome.trim().toLowerCase())) return { erro: tr('Já existe um perfil com esse nome.') };
  const base = perfis().find((p) => p.id === copiarDe);
  const p = { id: novoId('pf'), nome: nome.trim(), descricao: base ? (tr('Criado a partir de') + ' ') + base.nome : '', permissoes: base ? base.permissoes.slice() : [] };
  cfg().perfis.push(p);
  auditar(tr('Perfis de acesso'), (tr('Novo perfil:') + ' ') + p.nome, '', p.permissoes.map((x) => permissao(x).nome).join(' · ') || tr('sem permissões'), '', por);
  salvar();
  return { ok: true, id: p.id };
}

export function excluirPerfil(id, por) {
  const p = perfis().find((x) => x.id === id);
  if (!p || p.sistema) return { erro: tr('Este perfil não pode ser excluído.') };
  const usando = estado().usuarios.filter((u) => u.perfilId === id).length;
  if (usando) return { erro: (tr('Há') + ' ') + usando + (usando === 1 ? (' ' + tr('usuário')) : (' ' + tr('usuários'))) + (' ' + tr('com este perfil. Troque o perfil deles antes.')) };
  cfg().perfis = perfis().filter((x) => x.id !== id);
  auditar(tr('Perfis de acesso'), (tr('Perfil excluído:') + ' ') + p.nome, '', '', '', por);
  salvar();
  return { ok: true };
}

/* Usuários (quem tem login). O trabalhador que só bate ponto também é usuário, ligado ao seu cadastro de funcionário. */
export function salvarUsuario(id, dados, por, quemSalva) {
  const lista = estado().usuarios;
  const nome = (dados.nome || '').trim(), email = (dados.email || '').trim().toLowerCase();
  if (!nome || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { erro: tr('Informe nome e e-mail válidos.') };
  if (!perfis().some((p) => p.id === dados.perfilId)) return { erro: tr('Escolha um perfil de acesso.') };
  if (lista.some((u) => u.email.toLowerCase() === email && u.id !== id)) return { erro: tr('Já existe um usuário com esse e-mail.') };
  const perfilNovo = perfis().find((p) => p.id === dados.perfilId);
  if (perfilNovo.permissoes.includes('crew.ponto.proprio') && !dados.funcionarioId) return { erro: tr('Este perfil bate o próprio ponto: ligue o usuário ao cadastro de funcionário dele.') };
  const ativo = dados.ativo !== false;
  if (id) {
    const u = lista.find((x) => x.id === id);
    // sempre precisa sobrar alguém que consiga gerenciar os acessos
    const gerentes = lista.filter((x) => x.ativo && (x.id === id ? (ativo && (perfis().find((p) => p.id === dados.perfilId) || { permissoes: [] }).permissoes.includes('settings.acesso')) : pode(x, 'settings.acesso')));
    if (!gerentes.length) return { erro: tr('Precisa ficar pelo menos um usuário ativo que gerencie os acessos.') };
    if (quemSalva && quemSalva.id === id && !ativo) return { erro: tr('Você não pode desativar o seu próprio acesso.') };
    const antes = (perfilDe(u) || {}).nome + (u.ativo ? '' : (' ' + tr('(inativo)')));
    Object.assign(u, { nome, email, perfilId: dados.perfilId, funcionarioId: dados.funcionarioId || null, cargo: (dados.cargo || '').trim(), ativo });
    const depois = (perfilDe(u) || {}).nome + (u.ativo ? '' : (' ' + tr('(inativo)')));
    auditar(tr('Usuários'), (tr('Acesso de') + ' ') + u.nome, antes !== depois ? antes : '', antes !== depois ? depois : tr('dados atualizados'), '', por);
    salvar();
    return { ok: true, id };
  }
  const u = { id: novoId('u'), nome, email, perfilId: dados.perfilId, funcionarioId: dados.funcionarioId || null, cargo: (dados.cargo || '').trim(), telefone: '', ativo: true, ultimoAcesso: null };
  lista.push(u);
  auditar(tr('Usuários'), (tr('Novo usuário:') + ' ') + u.nome, '', (perfilDe(u) || {}).nome + ' · ' + email, '', por);
  salvar();
  return { ok: true, id: u.id };
}

/* ---------- Auditoria ---------- */

export function auditar(area, descricao, antes, depois, motivo, por) {
  const c = cfg();
  c.auditoria = c.auditoria || [];
  c.auditoria.unshift({ id: novoId('au'), em: Date.now(), por: por || '—', area, descricao, antes: antes || '', depois: depois || '', motivo: motivo || '' });
}
export function auditoria() { return cfg().auditoria || []; }

/* ---------- Dados iniciais ---------- */

export function criarSettings(desde, dataRegistro, por = tr('Ana Ribeiro')) {
  return {
    regras: [{ id: 'rg-inicial', desde, ...structuredClone(MODELOS_REGRA.federal), motivo: tr('Configuração inicial da empresa'), por, em: dataRegistro }],
    encargos: [{ id: 'en-inicial', desde, itens: structuredClone(ENCARGOS_INICIAIS), motivo: tr('Configuração inicial da empresa'), por, em: dataRegistro }],
    perfis: structuredClone(PERFIS_INICIAIS),
    funcoes: [tr('Pedreiro'), tr('Servente'), tr('Carpinteiro'), tr('Armador'), tr('Eletricista'), tr('Encanador'), tr('Pintor'), tr('Mestre de obras'), tr('Encarregado'), tr('Operador de máquinas')],
    auditoria: [{ id: 'au-inicial', em: dataRegistro, por, area: tr('Empresa'), descricao: tr('Configuração inicial: regra New Hampshire (FLSA federal) e encargos padrão'), antes: '', depois: '', motivo: '' }],
  };
}
