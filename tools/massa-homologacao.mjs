/* KORbuild — a massa de HOMOLOGAÇÃO (docs/massa-homologacao.md): o que o parceiro e nós usamos para testar à mão, em volume, antes de liberar.
 * Complementa a massa pv (tools/massa-primeira-versao.mjs: empresas, logins, concorrências). Esta cobre o que veio depois: catálogo com funções e valor hora,
 * projetos em todos os estados, plantas com escala, MUITOS desenhos (condições e medições), projeto liberado para obra, diários (rascunho, enviado, ajustes, aprovados)
 * com horas por tarefa, % feito no Gantt, tarefa atrasada e valor por tarefa.
 * Usa as MESMAS funções do banco que o app (criar_empresa, salvar_rdo, enviar_rdo, aprovar_rdo, pedir_ajustes) como a pessoa dona de cada papel; só membros (perfis) e
 * a marca da massa saem por SQL de administrador. NÃO muda o esquema do banco. Nunca apaga sem --apagar. Pode rodar de novo: o que já existe é pulado.
 * Nenhum e-mail sai: logins example.com (reservado) e os avisos por e-mail desligados antes de qualquer evento.
 *
 * Uso:
 *   node tools/massa-homologacao.mjs                                (banco local; tools/supabase-local.sh)
 *   KOR_DEMO_SENHA='…' node tools/massa-homologacao.mjs --real      (Supabase do projeto; SUPABASE_ACCESS_TOKEN no ambiente)
 *   --volume=40x25     condições × medições do projeto grande (padrão 40x25 = 1.000 desenhos de área, mais linhas e contagens)
 *   --limpar           só MOSTRA o que a limpeza apagaria; para apagar: --limpar --apagar --confirmo=apagar-massa-hom */

import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const REAL = process.argv.includes('--real');
const arg = (n, p) => { const a = process.argv.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : p; };
const [VOL_COND, VOL_MED] = arg('volume', '40x25').split('x').map(Number);
const { sql, sqlExec, rest, garantirUsuario, subirArquivo, limparMassa } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
const SENHA = process.env.KOR_DEMO_SENHA || (REAL ? '' : 'Kb1!local-massa-hom');
if (REAL && SENHA.length < 12) { console.error('Defina KOR_DEMO_SENHA (pelo menos 12 caracteres) na variável de ambiente; ela nunca vai para o repositório.'); process.exit(2); }
console.log('Massa de homologação contra: ' + (REAL ? 'Supabase do projeto' : 'Supabase local'));

const aspas = (t) => String(t).replace(/'/g, "''");
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
const hoje = () => iso(new Date());
const somar = (dia, n) => { const d = new Date(dia + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
const segundaDaSemana = () => { const d = new Date(hoje() + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return iso(d); };
const diaUtil = (dia) => { const w = new Date(dia + 'T12:00:00Z').getUTCDay(); return w >= 1 && w <= 5; };
const rpc = (uid, nome, args) => rest(uid, '/rpc/' + nome, { metodo: 'POST', corpo: args || {} });
function semente(n) { let s = n >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

const EMPRESA = { chave: 'hp', nome: 'Homologação Prestadora', atuacao: 'prestadora' };
const OUTRA = { chave: 'hq', nome: 'Homologação Parceira', atuacao: 'prestadora' };
const PESSOAS = [
  ['hp', 'admin', 'Hélio Prestador', 'Administrador', 'admin'], ['hp', 'gestor', 'Gina Gestora', 'Gestor de obras', 'gestor'],
  ['hp', 'encarregado', 'Enzo Encarregado', 'Encarregado', 'encarregado'], ['hp', 'trabalhador', 'Tati Trabalhadora', 'Trabalhador', 'trabalhador'],
  ['hq', 'admin', 'Paulo Parceiro', 'Administrador', 'admin'],
];
const email = (emp, papel) => 'hom.' + emp + '.' + papel + '@example.com';

// ---------------------------------------------------------------- a limpeza (só mostra, a menos que peçam e confirmem)
if (process.argv.includes('--limpar')) {
  const alvo = await sql(`select nome from public.empresas where plano ->> 'massa' = 'hom' order by nome`);
  const us = await sql(`select count(*)::int n from auth.users where email like 'hom.%@example.com'`);
  console.log('\nEmpresas que a limpeza apagaria (' + alvo.length + '):\n  ' + alvo.map((x) => x.nome).join('\n  ') + '\nUsuários hom.*@example.com: ' + us[0].n);
  if (process.argv.includes('--apagar') && arg('confirmo', '') === 'apagar-massa-hom') { await limparMassa('hom.%@example.com', "plano ->> 'massa' = 'hom'"); console.log('\nApagado.'); }
  else console.log('\nNada foi apagado. Para apagar: --limpar --apagar --confirmo=apagar-massa-hom');
  process.exit(0);
}

// ---------------------------------------------------------------- 1. empresas, pessoas e perfis
console.log('\n1. Empresas, pessoas e perfis');
const ids = {};
for (const [emp, papel, nome] of PESSOAS) ids[emp + '.' + papel] = await garantirUsuario(email(emp, papel), nome, SENHA);
const empresaId = {};
for (const e of [EMPRESA, OUTRA]) {
  const adm = ids[e.chave + '.admin'];
  const [ja] = await sql(`select id from public.empresas where nome = '${aspas(e.nome)}'`);
  empresaId[e.chave] = ja ? ja.id : await rpc(adm, 'criar_empresa', { p: { nome: e.nome, atuacao: e.atuacao, nome_pessoa: PESSOAS.find((x) => x[0] === e.chave && x[1] === 'admin')[2] } });
  await sqlExec(`update public.empresas set plano = plano || '{"demo": true, "massa": "hom"}'::jsonb where id = '${empresaId[e.chave]}'`);
  console.log('  ' + e.nome + (ja ? ' (já existia)' : ' (criada)'));
}
for (const [emp, papel, nome, cargo, chave] of PESSOAS) {
  if (papel === 'admin') continue;   // o administrador já veio com a empresa
  await sqlExec(`insert into public.membros (empresa_id, user_id, perfil_id, nome, cargo) select '${empresaId[emp]}', '${ids[emp + '.' + papel]}', pa.id, '${aspas(nome)}', '${aspas(cargo)}' from public.perfis_acesso pa where pa.empresa_id = '${empresaId[emp]}' and pa.chave = '${chave}' on conflict do nothing`);
}
// nenhum e-mail sai: preferências de e-mail desligadas antes de qualquer evento
for (const uid of Object.values(ids)) await sqlExec(`insert into public.notificacao_prefs (user_id, categoria, push, email) select '${uid}', c, true, false from unnest(array['daily','cronograma','concorrencia','crew','conta']) c on conflict (user_id, categoria) do update set email = false`);
const ADM = ids['hp.admin'], ENC = ids['hp.encarregado'], GEST = ids['hp.gestor'];

// ---------------------------------------------------------------- 2. catálogo, funções, margens, contatos
console.log('\n2. Catálogo, funções, margens e contatos (Homologação Prestadora)');
const r = { funcoes: {}, itens: {}, assemblies: {} };
if (!(await sql(`select 1 from public.encargos_versoes where empresa_id = '${empresaId.hp}'`)).length) await rest(ADM, '/encargos_versoes', { metodo: 'POST', corpo: { desde: segundaDaSemana(), itens: [{ nome: 'Payroll taxes', pct: 10 }, { nome: 'Workers comp', pct: 12 }], motivo: 'Encargos da massa de homologação' } });
for (const f of await rest(ADM, '/funcoes?select=id,nome')) r.funcoes[f.nome] = f.id;
for (const [nome, valor] of [['Carpenter', 38], ['Painter', 30], ['Electrician', 45], ['Laborer', 24]]) {
  if (r.funcoes[nome] && !(await sql(`select 1 from public.funcao_valores where funcao_id = '${r.funcoes[nome]}'`)).length) await rest(ADM, '/funcao_valores', { metodo: 'POST', corpo: { funcao_id: r.funcoes[nome], desde: somar(hoje(), -120), valor, motivo: 'Valor inicial (massa de homologação)' } });
}
const ETAPA = { framing: '06 11 00 · Wood framing', drywall: '09 29 00 · Gypsum board', pintura: '09 91 00 · Painting', piso: '09 65 00 · Resilient flooring' };
const ITENS = [   // [código, nome, categoria, unidade, etapa, preço, função]
  ['HOM-ST', 'Stud 2x4 x 8 ft', 'material', 'each', ETAPA.framing, 4.8, null], ['HOM-MO-ST', 'Framing carpenter hour', 'mao-de-obra', 'hour', ETAPA.framing, null, 'Carpenter'],
  ['HOM-DW', 'Drywall sheet 1/2 in', 'material', 'sheet', ETAPA.drywall, 14.5, null], ['HOM-MO-DW', 'Drywall hanger hour', 'mao-de-obra', 'hour', ETAPA.drywall, null, 'Carpenter'],
  ['HOM-PT', 'Interior paint 5 gal', 'material', 'bucket', ETAPA.pintura, 160, null], ['HOM-MO-PT', 'Painter hour', 'mao-de-obra', 'hour', ETAPA.pintura, null, 'Painter'],
  ['HOM-LV', 'LVP flooring box', 'material', 'box', ETAPA.piso, 62, null], ['HOM-MO-LV', 'Flooring installer hour', 'mao-de-obra', 'hour', ETAPA.piso, null, 'Laborer'],
  ['HOM-EQ', 'Scaffold rental day', 'equipamento', 'day', ETAPA.pintura, 55, null], ['HOM-SUB', 'Electrical rough-in (sub)', 'subempreiteiro', 'lump', '26 05 00 · Electrical', 3200, null],
];
for (const [codigo, nome, categoria, unidade, etapa, preco, funcao] of ITENS) {
  let it = (await rest(ADM, '/itens?select=id&codigo=eq.' + encodeURIComponent(codigo)))[0];
  if (!it) {
    [it] = await rest(ADM, '/itens', { metodo: 'POST', corpo: { codigo, nome, categoria, unidade, etapa, ...(funcao ? { funcao_id: r.funcoes[funcao] } : {}) } });
    if (preco) await rest(ADM, '/item_precos', { metodo: 'POST', corpo: { item_id: it.id, desde: somar(hoje(), -60), valor: preco, fonte: 'digitado', por_nome: 'Massa de homologação' } });
  }
  r.itens[codigo] = it.id;
}
const ASSEMBLIES = [   // [nome, [[item, fórmula, perda]]]
  ['HOM Parede (estrutura)', [['HOM-ST', 'MeasuredArea / 16', 8], ['HOM-MO-ST', 'MeasuredArea / 40', 0]]],
  ['HOM Drywall completo', [['HOM-DW', 'MeasuredArea / 32', 5], ['HOM-MO-DW', 'MeasuredArea / 50', 0]]],
  ['HOM Pintura', [['HOM-PT', 'MeasuredArea / 400', 0], ['HOM-MO-PT', 'MeasuredArea / 100', 0]]],
  ['HOM Piso LVP', [['HOM-LV', 'MeasuredArea / 20', 5], ['HOM-MO-LV', 'MeasuredArea / 60', 0]]],
];
for (const [nome, linhas] of ASSEMBLIES) {
  let a = (await rest(ADM, '/assemblies?select=id&nome=eq.' + encodeURIComponent(nome)))[0];
  if (!a) [a] = await rest(ADM, '/assemblies', { metodo: 'POST', corpo: { nome, tipo: 'area', descricao: '', linhas: linhas.map(([c, formula, perda]) => ({ id: randomUUID(), passo: 1, perda, itemId: r.itens[c], formula })) } });
  r.assemblies[nome] = a.id;
}
if (!(await sql(`select 1 from public.margens_versoes where empresa_id = '${empresaId.hp}'`)).length) await rest(ADM, '/margens_versoes', { metodo: 'POST', corpo: { overhead_pct: 12, lucro_pct: 10, modo: 'markup', imposto_material_pct: 0, desde: segundaDaSemana(), motivo: 'Margens da massa de homologação' } });
const CONTATOS = [['Cliente Mitchell', ['cliente']], ['Cliente Pereira', ['cliente']], ['Granite Industrial Group', ['cliente']], ['Loja Birch LLC', ['cliente']], ['Depósito Lumber Yard', ['fornecedor']], ['Paint Supply Co', ['fornecedor']]];
const contato = {};
for (const [nome, papeis] of CONTATOS) {
  let c = (await rest(ADM, '/contatos?select=id&nome=eq.' + encodeURIComponent(nome)))[0];
  if (!c) [c] = await rest(ADM, '/contatos', { metodo: 'POST', corpo: { nome, papeis, email: nome.toLowerCase().replace(/[^a-z]+/g, '.') + '@example.com' } });
  contato[nome] = c.id;
}
console.log('  ' + ITENS.length + ' itens, ' + ASSEMBLIES.length + ' assemblies, 4 funções com valor hora, margens, ' + CONTATOS.length + ' contatos');

// ---------------------------------------------------------------- 3. projetos
console.log('\n3. Projetos (' + VOL_COND + ' × ' + VOL_MED + ' desenhos no projeto grande)');
const PDF = readFileSync(new URL('../assets/plantas/casa-modelo.pdf', import.meta.url));
const POL_PT = 48 / 72;
const ESCALA = { nome: '1/4" = 1\'-0"', polPorPonto: POL_PT, razao: 48, conferencia: { esperadoPol: 100, medidoPol: 100, diferenca: 0, ok: true, em: Date.now() }, em: Date.now() };
const COR = ['#2563EB', '#C2410C', '#0F766E', '#7C3AED', '#B45309', '#DB2777', '#0891B2', '#4D7C0F'];

async function projetoNovo(nome, campos) {
  const [ja] = await sql(`select id, obra_id from public.projetos where nome = '${aspas(nome)}' and empresa_id = '${empresaId.hp}'`);
  if (ja) { console.log('  ' + nome + ' (já existia: pulado)'); return null; }
  const [pj] = await rest(ADM, '/projetos', { metodo: 'POST', corpo: { nome, cidade: 'Concord', estado: 'NH', tipo: 'reforma', situacao: 'orcamento', ...campos } });
  return pj.id;
}
/* A planta de 3 folhas (PDF no Storage), todas com escala conferida. */
async function plantas(projetoId, nomes = ['A-101 · First Floor Plan', 'A-201 · Elevations', 'A-301 · Section A']) {
  const arquivo = randomUUID(), caminho = empresaId.hp + '/' + projetoId + '/' + arquivo + '.pdf';
  await subirArquivo(ADM, 'plantas', caminho, PDF, 'application/pdf');
  const folhas = await rest(ADM, '/folhas', { metodo: 'POST', corpo: nomes.map((nome, i) => ({ id: randomUUID(), projeto_id: projetoId, nome, arquivo_path: caminho, arquivo_nome: 'casa-modelo.pdf', pagina: i + 1, escala: ESCALA })) });
  return folhas.map((f) => f.id);
}
/* Os desenhos: nCond condições de área (cada uma com um assembly e nMed retângulos), mais linhas e contagens. Devolve as áreas (sq ft) por assembly. */
async function desenhos(projetoId, folhaIds, nCond, nMed, semente_, nomeBase) {
  const rnd = semente(semente_), assemblies = Object.values(r.assemblies);
  const linhas = [];
  let area = 0, n = 0;
  for (let i = 0; i < nCond; i++) {
    const folhaId = folhaIds[i % folhaIds.length];
    const medicoes = [];
    for (let j = 0; j < nMed; j++) {
      const x = Math.round(rnd() * 900), y = Math.round(rnd() * 600), w = 20 + Math.round(rnd() * 120), h = 15 + Math.round(rnd() * 90);
      medicoes.push({ id: randomUUID(), folhaId, pontos: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], desconto: false, em: Date.now() });
      area += w * h * POL_PT * POL_PT / 144;
    }
    n += nMed;
    linhas.push({ id: randomUUID(), projeto_id: projetoId, nome: nomeBase + ' · área ' + String(i + 1).padStart(2, '0'), tipo: 'area', cor: COR[i % COR.length], props: {}, assemblies: [assemblies[i % assemblies.length]], folhas: [folhaId], medicoes });
  }
  const extra = Math.max(2, Math.round(nCond / 5));
  for (let i = 0; i < extra; i++) {
    const folhaId = folhaIds[i % folhaIds.length];
    linhas.push({ id: randomUUID(), projeto_id: projetoId, nome: nomeBase + ' · linha ' + String(i + 1).padStart(2, '0'), tipo: 'linear', cor: COR[(i + 3) % COR.length], props: { alturaPol: 96 }, assemblies: [], folhas: [folhaId],
      medicoes: Array.from({ length: nMed }, () => { const x = Math.round(rnd() * 800), y = Math.round(rnd() * 600); return { id: randomUUID(), folhaId, pontos: [[x, y], [x + 40 + Math.round(rnd() * 100), y + Math.round(rnd() * 30)]], desconto: false, em: Date.now() }; }) });
    linhas.push({ id: randomUUID(), projeto_id: projetoId, nome: nomeBase + ' · contagem ' + String(i + 1).padStart(2, '0'), tipo: 'contagem', cor: COR[(i + 5) % COR.length], props: {}, assemblies: [], folhas: [folhaId],
      medicoes: Array.from({ length: nMed }, () => ({ id: randomUUID(), folhaId, pontos: [[Math.round(rnd() * 900), Math.round(rnd() * 650)]], desconto: false, em: Date.now() })) });
    n += nMed * 2;
  }
  for (let i = 0; i < linhas.length; i += 20) await rest(ADM, '/condicoes', { metodo: 'POST', corpo: linhas.slice(i, i + 20) });
  return { condicoes: linhas.length, medicoes: n, area: Math.round(area) };
}
const tarefa = (id, nome, etapa, quem, inicio, dias) => ({ id, nome, etapa, quem, inicio, dias, pct: 0 });
const entrega = (tarefas) => ({ padrao: 'tudo', etapas: tarefas.map((t) => ({ id: 'en-' + t.id, etapa: t.etapa, quem: t.quem, takeoff: 'detalhado' })) });
const resumo = [];

// P1: projeto vazio (orçamento recém-aberto)
if (await projetoNovo('HOM · Casa modelo (orçamento vazio)', { contratante_id: contato['Cliente Mitchell'], prazo_proposta: somar(hoje(), 6), descricao: 'Projeto recém-criado: sem planta, sem medição. Serve para testar o começo do fluxo.' })) resumo.push('P1 orçamento vazio');

// P2: pronto para liberar (planta, escala, medições, cronograma, quem faz cada tarefa)
{
  const tarefas = [tarefa('t2-1', 'Estrutura das paredes', ETAPA.framing, 'proprio', somar(hoje(), 7), 5), tarefa('t2-2', 'Drywall: fixar e acabar', ETAPA.drywall, 'proprio', somar(hoje(), 12), 6), tarefa('t2-3', 'Pintura interna', ETAPA.pintura, 'terceiro', somar(hoje(), 18), 4), tarefa('t2-4', 'Piso LVP', ETAPA.piso, 'proprio', somar(hoje(), 22), 3)];
  const id = await projetoNovo('HOM · Garagem Pereira (pronta para liberar)', { contratante_id: contato['Cliente Pereira'], prazo_proposta: somar(hoje(), 3), descricao: 'Planta com escala, 16 condições medidas e cronograma: falta só "Liberar para obra".', cronograma: { tarefas, marcos: [{ id: 'mc2-1', nome: 'Entrega ao cliente', data: somar(hoje(), 28), nota: '' }] }, entrega: entrega(tarefas) });
  if (id) { const f = await plantas(id); const d = await desenhos(id, f, 12, 8, 21, 'Garagem'); resumo.push('P2 pronta para liberar: ' + d.condicoes + ' condições, ' + d.medicoes + ' medições, ' + d.area + ' sq ft'); }
}

// P3: em obra (liberado), com diários e % feito vindos da aprovação
let obraMitchell = null;
{
  const ini = somar(hoje(), -14);
  const tarefas = [tarefa('t3-1', 'Estrutura das paredes', ETAPA.framing, 'proprio', ini, 6), tarefa('t3-2', 'Drywall: fixar e acabar', ETAPA.drywall, 'proprio', somar(ini, 7), 8), tarefa('t3-3', 'Pintura interna', ETAPA.pintura, 'terceiro', somar(ini, 15), 5), tarefa('t3-4', 'Piso LVP', ETAPA.piso, 'proprio', somar(ini, 20), 4)];
  const id = await projetoNovo('HOM · Reforma Mitchell (em obra)', { contratante_id: contato['Cliente Mitchell'], prazo_proposta: somar(hoje(), -20), situacao: 'ganha', descricao: 'Liberado para obra há 14 dias, com diários aprovados, um enviado e um com ajustes pedidos.', cronograma: { tarefas, marcos: [{ id: 'mc3-1', nome: 'Vistoria final', data: somar(ini, 26), nota: '' }] }, entrega: entrega(tarefas), liberado_em: new Date(Date.now() - 14 * 864e5).toISOString(), liberado_por: 'Hélio Prestador', inicio_obra: ini });
  if (id) {
    const f = await plantas(id); const d = await desenhos(id, f, 14, 10, 33, 'Mitchell');
    const [lido] = await sql(`select obra_id from public.projetos where id = '${id}'`); obraMitchell = lido.obra_id;
    resumo.push('P3 em obra: ' + d.condicoes + ' condições, ' + d.medicoes + ' medições, obra ' + (obraMitchell ? 'criada' : 'SEM OBRA'));
    // os diários: um por dia útil desde o início da obra até ontem; a atividade de cada dia aponta a tarefa em andamento, com % e horas
    const dias = []; for (let k = -13; k <= -1; k++) { const dia = somar(hoje(), k); if (diaUtil(dia) && dia >= ini) dias.push(dia); }
    const contagem = {};
    for (const [i, dia] of dias.entries()) {
      const t = tarefas.filter((x) => x.inicio <= dia).slice(-1)[0] || tarefas[0], passado = dias.slice(0, i + 1).filter((x) => x >= t.inicio).length;
      const pct = Math.min(100, Math.round(passado * 100 / Math.max(1, Math.min(t.dias, 5)) * 0.9));
      const rdoId = randomUUID();
      const conteudo = { clima: { manha: { tempo: 'sol', praticavel: true }, tarde: { tempo: i % 5 === 3 ? 'nublado' : 'sol', praticavel: true }, fonte: 'automatico' }, equipe: [{ funcao: 'Carpenter', presentes: 3, faltas: i % 6 === 4 ? 1 : 0 }, { funcao: 'Laborer', presentes: 1, faltas: 0 }], equipamentos: [{ nome: 'Scaffold', qtd: 2, status: 'ok' }],
        atividades: [{ id: randomUUID(), descricao: t.nome + ' (dia ' + passado + ')', local: 'Casa toda', situacao: pct >= 100 ? 'concluida' : 'andamento', tarefaId: t.id, tarefaPct: String(pct), horas: String(24 + (i % 3) * 4) }], ocorrencias: i === 5 ? [{ id: randomUUID(), tipo: 'material', descricao: 'Entrega de drywall chegou duas horas atrasada.' }] : [], observacoes: '' };
      const s = await rpc(ENC, 'salvar_rdo', { p: { id: rdoId, obra_id: obraMitchell, data: dia, versao: null, conteudo, fotos: [] } });
      const ultimo = i === dias.length - 1, penultimo = i === dias.length - 2;
      if (!ultimo) await rpc(ENC, 'enviar_rdo', { p_id: rdoId, p_versao: s.versao });
      else await rpc(ENC, 'enviar_rdo', { p_id: rdoId, p_versao: s.versao });
      if (!ultimo && !penultimo) { await rpc(ADM, 'aprovar_rdo', { p_id: rdoId }); contagem.aprovado = (contagem.aprovado || 0) + 1; }
      else if (penultimo) { await rpc(ADM, 'pedir_ajustes', { p_id: rdoId, p_motivo: 'Detalhe a área concluída e as horas de cada função.' }); contagem.ajustes = (contagem.ajustes || 0) + 1; }
      else contagem.enviado = (contagem.enviado || 0) + 1;
    }
    resumo.push('P3 diários: ' + JSON.stringify(contagem));
  }
}

// P4: o projeto grande (volume), liberado, com tarefa atrasada e sem diário
{
  const ini = somar(hoje(), -30);
  const tarefas = [tarefa('t4-1', 'Estrutura das paredes', ETAPA.framing, 'proprio', ini, 15), tarefa('t4-2', 'Drywall: fixar e acabar', ETAPA.drywall, 'proprio', somar(ini, 16), 20), tarefa('t4-3', 'Pintura interna', ETAPA.pintura, 'terceiro', somar(ini, 37), 12), tarefa('t4-4', 'Piso LVP', ETAPA.piso, 'proprio', somar(ini, 50), 10)];
  tarefas[0].pct = 60;   // devia estar pronta há dias: aparece como atrasada no Gantt e no Início
  const id = await projetoNovo('HOM · Torre Granite (volume)', { contratante_id: contato['Granite Industrial Group'], prazo_proposta: somar(hoje(), -40), situacao: 'ganha', tipo: 'comercial', descricao: 'Projeto grande: ' + VOL_COND + ' condições de área × ' + VOL_MED + ' medições, mais linhas e contagens. A primeira tarefa está atrasada.', cronograma: { tarefas, marcos: [] }, entrega: entrega(tarefas), liberado_em: new Date(Date.now() - 30 * 864e5).toISOString(), liberado_por: 'Hélio Prestador', inicio_obra: ini });
  if (id) { const f = await plantas(id); const d = await desenhos(id, f, VOL_COND, VOL_MED, 44, 'Torre'); resumo.push('P4 volume: ' + d.condicoes + ' condições, ' + d.medicoes + ' medições, ' + d.area + ' sq ft'); }
}

// P5: perdida
if (await projetoNovo('HOM · Loja Birch (perdida)', { contratante_id: contato['Loja Birch LLC'], situacao: 'perdida', prazo_proposta: somar(hoje(), -30), descricao: 'Proposta perdida: não aparece no Gantt nem no Início.' })) resumo.push('P5 perdida');

// outra empresa (isolamento): um projeto só dela
{
  const [ja] = await sql(`select 1 from public.projetos where nome = 'HOM · Projeto da Parceira' and empresa_id = '${empresaId.hq}'`);
  if (!ja) {
    const [c] = await rest(ids['hq.admin'], '/contatos', { metodo: 'POST', corpo: { nome: 'Cliente da Parceira', papeis: ['cliente'] } });
    await rest(ids['hq.admin'], '/projetos', { metodo: 'POST', corpo: { nome: 'HOM · Projeto da Parceira', contratante_id: c.id, cidade: 'Nashua', estado: 'NH', tipo: 'comercial', situacao: 'orcamento' } });
    resumo.push('Parceira: 1 projeto (só ela deve ver)');
  }
}

// ---------------------------------------------------------------- conferência final (só lê)
console.log('\nResumo do que foi criado agora:\n  ' + (resumo.join('\n  ') || '(nada: tudo já existia)'));
const [tot] = await sql(`select (select count(*) from public.projetos where empresa_id = '${empresaId.hp}')::int as projetos, (select count(*) from public.folhas where empresa_id = '${empresaId.hp}')::int as folhas, (select count(*) from public.condicoes where empresa_id = '${empresaId.hp}')::int as condicoes, coalesce((select sum(jsonb_array_length(medicoes)) from public.condicoes where empresa_id = '${empresaId.hp}'), 0)::int as medicoes, (select count(*) from public.rdos where empresa_id = '${empresaId.hp}')::int as rdos`);
const rd = await sql(`select status, count(*)::int n from public.rdos where empresa_id = '${empresaId.hp}' group by status order by status`);
console.log('\nHomologação Prestadora agora: ' + tot.projetos + ' projetos, ' + tot.folhas + ' folhas, ' + tot.condicoes + ' condições, ' + tot.medicoes + ' medições, ' + tot.rdos + ' diários (' + rd.map((x) => x.status + ' ' + x.n).join(', ') + ')');
console.log('\nLogins (senha: a de KOR_DEMO_SENHA' + (REAL ? '' : '; no banco local Kb1!local-massa-hom') + '):');
for (const [emp, papel, nome, cargo] of PESSOAS) console.log('  ' + email(emp, papel).padEnd(34) + nome + ' · ' + cargo);
