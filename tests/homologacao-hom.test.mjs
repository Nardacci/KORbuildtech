/* KORbuild — homologação da massa hom (docs/massa-homologacao.md): entra pela tela como cada papel e confere o que aparece contra o que está no banco.
 * SÓ LÊ: não grava nada. Pré-requisito: node tools/massa-homologacao.mjs [--real].
 * Uso:  python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/homologacao-hom.test.mjs
 *       Supabase de verdade:  $env:KOR_DEMO_SENHA = '…'; $env:SUPABASE_ACCESS_TOKEN = 'sbp_…'  →  node tests/homologacao-hom.test.mjs --real [--relatorio] */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AMBIENTE, REAL, BASE, sql, rest, esperarAte, texto, irPara, abrirComo } from './_fluxo-dados.mjs';

const modulo = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const SENHA = process.env.KOR_DEMO_SENHA || (REAL ? '' : 'Kb1!local-massa-hom');
if (REAL && SENHA.length < 12) { console.error('Defina KOR_DEMO_SENHA (12+ caracteres) no ambiente; ela nunca é impressa.'); process.exit(2); }
const RELATORIO = process.argv.includes('--relatorio');
const PESSOA = { admin: ['hom.hp.admin@example.com', 'Hélio Prestador'], gestor: ['hom.hp.gestor@example.com', 'Gina Gestora'], encarregado: ['hom.hp.encarregado@example.com', 'Enzo Encarregado'], trabalhador: ['hom.hp.trabalhador@example.com', 'Tati Trabalhadora'], parceira: ['hom.hq.admin@example.com', 'Paulo Parceiro'] };

let ok = 0, falhas = 0;
const linhas = [];
const verificar = (cond, nome, detalhe = '') => { if (cond) ok++; else { falhas++; console.log('  FALHOU ' + nome + (detalhe ? ' · ' + String(typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)).slice(0, 260) : '')); } linhas.push({ nome, ok: !!cond }); if (cond) console.log('  ok  ' + nome); };
const PROJ = { vazio: 'HOM · Casa modelo (orçamento vazio)', pronta: 'HOM · Garagem Pereira (pronta para liberar)', obra: 'HOM · Reforma Mitchell (em obra)', grande: 'HOM · Torre Granite (volume)', perdida: 'HOM · Loja Birch (perdida)' };

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
console.log('Homologação da massa hom · ' + AMBIENTE);
const ids = {};
for (const [k, [email, nome]] of Object.entries(PESSOA)) { try { ids[k] = await modulo.garantirUsuario(email, nome, SENHA); } catch (e) { console.error('Não consegui entrar como ' + email + ' (rode antes a massa: node tools/massa-homologacao.mjs): ' + String(e.message).slice(0, 120)); process.exit(2); } }
const [hp] = await sql(`select id from public.empresas where nome = 'Homologação Prestadora'`);
if (!hp) { console.error('A massa hom não existe neste banco: rode node tools/massa-homologacao.mjs' + (REAL ? ' --real' : '') + '.'); process.exit(2); }
const pj = {};
for (const [k, nome] of Object.entries(PROJ)) pj[k] = (await sql(`select id, obra_id, situacao, cronograma, liberado_em from public.projetos where nome = '${nome.replace(/'/g, "''")}' and empresa_id = '${hp.id}'`))[0];
verificar(Object.values(pj).every(Boolean), 'os cinco projetos da massa existem no banco', Object.fromEntries(Object.entries(pj).map(([k, v]) => [k, !!v])));
const rdos = await sql(`select status, conteudo from public.rdos where empresa_id = '${hp.id}' and obra_id = '${pj.obra.obra_id}'`);
const horasAprovadas = rdos.filter((r) => r.status === 'aprovado').reduce((s, r) => s + (r.conteudo.atividades || []).reduce((t, a) => t + (Number(a.horas) || 0), 0), 0);
const num = (t) => Number(String(t).replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
try {
  console.log('\nAdministradora da prestadora (Hélio)');
  const adm = await abrirComo(browser, { email: PESSOA.admin[0], nome: PESSOA.admin[1] }, { ir: '#/conta' });
  erros.push(adm.erros);
  await adm.p.waitForSelector('.ini-painel', { timeout: 60000 });
  await esperarAte(async () => /Andamento dos projetos/.test(await texto(adm.p, '.ini-painel')), 30000);
  let t = await texto(adm.p, '.ini-painel');
  verificar(/Andamento dos projetos/.test(t) && t.includes('HOM · Reforma Mitchell') && t.includes('HOM · Torre Granite'), 'o Início mostra o andamento dos projetos em obra (Mitchell e Torre)', t.slice(0, 300));
  verificar(/Atrasado/i.test(t), 'o Início aponta o atraso (a primeira tarefa da Torre)');
  verificar(!t.includes('Loja Birch'), 'o projeto perdido não aparece no andamento');

  await irPara(adm.p, '#/measure', 'main', 60000);
  await esperarAte(async () => (await texto(adm.p, 'main')).includes('Torre Granite'), 30000);
  t = await texto(adm.p, 'main');
  verificar(Object.values(PROJ).every((n) => t.includes(n.replace('HOM · ', '').split(' (')[0])), 'a lista de projetos mostra os cinco projetos', t.slice(0, 300));
  verificar(!t.includes('Projeto da Parceira'), 'não aparece o projeto da outra empresa');

  await irPara(adm.p, '#/measure/projeto/' + pj.vazio.id, '.mz-liberar', 60000);
  verificar(await adm.p.locator('[data-acao="pj-liberar"]').isDisabled(), 'o projeto vazio não pode ser liberado para obra');
  await irPara(adm.p, '#/measure/projeto/' + pj.pronta.id, '.mz-liberar', 60000);
  await esperarAte(async () => !(await adm.p.locator('[data-acao="pj-liberar"]').isDisabled()), 20000);
  verificar(!(await adm.p.locator('[data-acao="pj-liberar"]').isDisabled()), 'o projeto pronto (planta, escala, medições, cronograma) pode ser liberado: "Liberar para obra" habilitado');

  console.log('\nGantt: Reforma Mitchell (em obra, com diários)');
  const tarefasBanco = ((pj.obra.cronograma || {}).tarefas || []);
  await irPara(adm.p, '#/measure/gantt/' + pj.obra.id, '.mz-gantt', 60000);
  await adm.p.waitForSelector('#vg-total', { timeout: 40000 });
  const linhasG = await adm.p.locator('.mz-gantt .mz-g-linha').evaluateAll((els) => els.map((e) => ({ nome: (e.querySelector('.mz-g-nome span') || {}).textContent, pct: (e.querySelector('.mz-g-pct') || {}).textContent })));
  // o % feito de cada tarefa veio da aprovação dos diários (servidor): confere com o banco
  const lido = (await sql(`select cronograma from public.projetos where id = '${pj.obra.id}'`))[0].cronograma.tarefas;
  verificar(lido.length === 4 && lido.every((x) => linhasG.some((l) => l.nome === x.nome && l.pct === (x.pct || 0) + '%')), 'o Gantt mostra o % feito de cada tarefa igual ao do banco', { tela: linhasG, banco: lido.map((x) => [x.nome, x.pct]) });
  verificar(lido.some((x) => x.pct > 0) && (lido[0].pct || 0) > 0, 'a aprovação dos diários levou % feito às tarefas (a primeira está em ' + lido[0].pct + '%)');
  verificar(Math.abs(num(await texto(adm.p, '#hg-apontadas')) - horasAprovadas) < 0.05, 'as horas apontadas no Gantt são as dos diários aprovados: ' + horasAprovadas + ' h', await texto(adm.p, '#hg-apontadas'));
  verificar(num(await texto(adm.p, '#vg-total')) > 0 && await adm.p.locator('svg.curva-s polyline.cs-plan').count() === 1, 'o Gantt mostra o valor total e a curva S');
  verificar(await adm.p.locator('#horas-gantt tr[data-tarefa]').count() === 4, 'a tabela de horas tem uma linha por tarefa');
  verificar(await adm.p.locator('#real-gantt').count() === 0, 'sem ponto do Crew não aparece o custo real');
  verificar(await adm.p.locator('#horas-gantt .etiqueta').count() >= 1, 'a conciliação de horas classifica ao menos uma tarefa (orçado × apontado)');

  console.log('\nGantt e desenhos: Torre Granite (volume)');
  await irPara(adm.p, '#/measure/gantt/' + pj.grande.id, '.mz-gantt', 60000);
  await adm.p.waitForSelector('#vg-total', { timeout: 40000 });
  verificar(await adm.p.locator('.mz-gantt .mz-g-linha.atrasada').count() >= 1, 'a Torre tem tarefa atrasada em vermelho');
  verificar(num(await texto(adm.p, '#vg-total')) > 0, 'a Torre tem valor por tarefa');
  const [vol] = await sql(`select count(*)::int c, coalesce(sum(jsonb_array_length(medicoes)), 0)::int m from public.condicoes where projeto_id = '${pj.grande.id}'`);
  const t0 = Date.now();
  const folha = (await sql(`select id from public.folhas where projeto_id = '${pj.grande.id}' order by pagina limit 1`))[0];
  await irPara(adm.p, '#/measure/folha/' + folha.id, '#mz-desenho', 60000);
  await adm.p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 60000 });
  verificar((Date.now() - t0) < 40000, 'o desenho da Torre (' + vol.c + ' condições, ' + vol.m + ' medições) abre em ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  await irPara(adm.p, '#/measure/projeto/' + pj.grande.id + '/materials', '#mz-materiais', 60000);
  verificar(/HOM-DW/.test(await texto(adm.p, '#mz-materiais')) && /HOM-PT/.test(await texto(adm.p, '#mz-materiais')), 'a lista de materiais da Torre traz drywall e tinta');
  await irPara(adm.p, '#/daily/painel', 'main .kpis', 60000);
  await esperarAte(async () => /Aguardando aprovação\s*1/.test(await texto(adm.p, 'main')), 30000);
  verificar(/Aguardando aprovação\s*1/.test(await texto(adm.p, 'main')), 'o Daily mostra 1 diário aguardando aprovação (o enviado)', (await texto(adm.p, 'main')).slice(0, 200));

  console.log('\nGestora (Gina)');
  const ges = await abrirComo(browser, { email: PESSOA.gestor[0], nome: PESSOA.gestor[1] }, { ir: '#/measure' });
  erros.push(ges.erros);
  await ges.p.waitForSelector('main', { timeout: 60000 });
  await esperarAte(async () => (await texto(ges.p, 'main')).includes('Torre Granite'), 40000);
  verificar((await texto(ges.p, 'main')).includes('Torre Granite'), 'a gestora vê os projetos');
  await irPara(ges.p, '#/conta', '.oficial-topo, .ini-painel', 60000);
  verificar(await ges.p.locator('nav a:has-text("Usuários"), nav a:has-text("Users")').count() === 0, 'a gestora não vê Usuários no Settings');

  console.log('\nEncarregado (Enzo, celular)');
  const enc = await abrirComo(browser, { email: PESSOA.encarregado[0], nome: PESSOA.encarregado[1] }, { campo: true, ir: '#/daily' });
  erros.push(enc.erros);
  await enc.p.waitForURL((u) => String(u).includes('#/daily/campo'), { timeout: 60000 }).catch(() => null);
  await esperarAte(async () => (await texto(enc.p, 'main')).includes('Reforma Mitchell'), 40000);
  t = await texto(enc.p, 'main');
  verificar(/Seus projetos/i.test(t) && t.includes('Reforma Mitchell'), 'o encarregado vê "Seus projetos" com a Reforma Mitchell', t.slice(0, 200));
  verificar(await enc.p.locator('a[href*="obra/nova"]').count() === 0, 'o encarregado não tem botão de nova obra');

  console.log('\nTrabalhadora (Tati)');
  const tra = await abrirComo(browser, { email: PESSOA.trabalhador[0], nome: PESSOA.trabalhador[1] }, { ir: '#/measure' });
  erros.push(tra.erros);
  await tra.p.waitForTimeout(4000);
  verificar(!tra.p.url().includes('#/measure'), 'a trabalhadora não abre o Takeoff pelo endereço', tra.p.url());

  console.log('\nOutra empresa (Paulo, Parceira): isolamento');
  const par = await abrirComo(browser, { email: PESSOA.parceira[0], nome: PESSOA.parceira[1] }, { ir: '#/measure' });
  erros.push(par.erros);
  await esperarAte(async () => (await texto(par.p, 'main')).includes('Projeto da Parceira'), 40000);
  t = await texto(par.p, 'main');
  verificar(t.includes('Projeto da Parceira') && !t.includes('Torre Granite') && !t.includes('Reforma Mitchell'), 'a outra empresa só vê o projeto dela', t.slice(0, 200));
  const deles = await rest(ids.parceira, '/projetos?select=id');
  verificar(deles.length === 1, 'pelo banco, a outra empresa lê só 1 projeto', deles.length);
  const rdosDeles = await rest(ids.parceira, '/rdos?select=id');
  verificar(rdosDeles.length === 0, 'a outra empresa não lê nenhum diário da Prestadora', rdosDeles.length);
  const todos = erros.flat();
  verificar(todos.length === 0, 'nenhum erro de JavaScript em toda a homologação' + (todos.length ? ': ' + todos.slice(0, 3).join(' | ') : ''));
} finally { await browser.close(); }

console.log('\nHomologação da massa: ' + ok + '/' + (ok + falhas) + ' verificações passaram' + (falhas ? ' · ' + falhas + ' falha(s)' : ''));
if (RELATORIO) {
  mkdirSync('docs/testes/rodadas', { recursive: true });
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const arq = 'docs/testes/rodadas/' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '_homologacao-hom.md';
  writeFileSync(arq, '# Homologação da massa hom · ' + AMBIENTE + '\n\nResultado: ' + ok + '/' + (ok + falhas) + ' verificações' + (falhas ? ' (' + falhas + ' falha(s))' : '') + '\n\n' + linhas.map((l) => '- ' + (l.ok ? 'ok' : 'FALHOU') + ' · ' + l.nome).join('\n') + '\n');
  console.log('Relatório: ' + arq);
}
process.exit(falhas ? 1 : 0);
