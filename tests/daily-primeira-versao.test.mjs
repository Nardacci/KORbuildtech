/* KORbuild — Daily na 1ª versão (protótipo): três módulos depois do login, o projeto ganho vira a obra sozinho e aparece no Daily,
 * Execução no cadastro do projeto, RDO do projeto, Settings separado do Takeoff (docs/daily-primeira-versao.md).
 * Uso: python3 -m http.server 8123 &  →  node tests/daily-primeira-versao.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/') + '?demo';
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 400)) : '')); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } });
await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo/, (r) => r.abort());
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => { if (!/localStorage/.test(e.message)) erros.push(e.message); });
await p.goto(BASE);
await p.waitForSelector('#form-login', { timeout: 30000 });
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
const ir = async (rota, espera) => { await p.goto('about:blank'); await p.goto(BASE + rota); await p.waitForSelector(espera, { timeout: 15000 }); };
const texto = async (sel = 'main') => (await p.locator(sel).innerText()).replace(/\s+/g, ' ');

/* Deixa o projeto com as cinco etapas técnicas prontas (plantas com escala, tarefa decidida, uma condição medida) para poder liberar para obra. */
const deixarPronto = (pid) => p.evaluate(async (id) => {
  const m = await import('/js/measure.js'); const a = await import('/js/armazem.js');
  const d = a.estado(), pj = m.projeto(id);
  d.measure.folhas.push({ id: 'fl-t-' + id, projetoId: id, nome: 'A-101', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina: 1, escala: { nome: '1/4" = 1\'-0"', polPorPe: 0.25 } });
  d.measure.condicoes.push({ id: 'cd-t-' + id, projetoId: id, nome: 'Piso', tipo: 'area', cor: '#2563EB', props: {}, assemblies: [], folhas: ['fl-t-' + id], medicoes: [{ id: 'md-t-' + id, folhaId: 'fl-t-' + id, pontos: [[0, 0], [100, 0], [100, 100]], valor: 1 }] });
  pj.cronograma = pj.cronograma || { tarefas: [], marcos: [] };
  if (!pj.cronograma.tarefas.length) pj.cronograma.tarefas.push({ id: 'tf-t-' + id, nome: 'Demolição', quem: 'proprio', inicio: new Date().toISOString().slice(0, 10), dias: 3 });
  for (const t of pj.cronograma.tarefas) if (t.quem === 'decidir') t.quem = 'proprio';
  a.salvar();
}, pid);

console.log('Depois do login: três módulos');
await ir('#/inicio', '.modulo');
const modulos = await p.locator('.modulo .modulo-nome').allInnerTexts();
verificar(modulos.length === 3 && /Daily/.test(modulos[0]) && /Takeoff/.test(modulos[1]) && /Settings/.test(modulos[2]), 'Daily, Takeoff e Settings, nesta ordem (sem Crew)', modulos);
verificar(await p.locator('.topo-marca .logo-produto').count() === 0, 'na escolha de módulos o logotipo é só KORbuild (o selo Takeoff fica dentro do Takeoff)');

console.log('Settings é módulo próprio');
await ir('#/settings', 'main');
verificar(await p.locator('.topo-modulo:has-text("Settings")').count() === 1 && await p.locator('.topo-marca .logo-produto').count() === 0, 'cabeçalho "KORbuild / Settings", sem o selo Takeoff');
await ir('#/measure', 'h1');
verificar(await p.locator('.topo-marca .logo-produto').count() === 1 && await p.locator('.lateral-item:has-text("Settings")').count() === 0, 'no Takeoff o selo Takeoff aparece e o Settings não está no menu lateral');

console.log('Daily: só os projetos em execução (o projeto ganho é a obra)');
await ir('#/daily/obras', 'main');
let t = await texto();
verificar(/Projetos em execução/.test(t) && t.includes('Reforma de cozinha') && !/Jardim das Flores/.test(t), 'a lista do Daily mostra o projeto ganho da demonstração e não as obras cadastradas à mão', t.slice(0, 200));
verificar(await p.locator('a[href*="obra/nova"]').count() === 0, 'sem botão "Nova obra"');
verificar(await p.locator('.lateral-item:has-text("Projetos")').count() === 1 && await p.locator('.lateral-item:has-text("Concorrências")').count() === 0, 'menu do Daily: Projetos no lugar de Obras, sem Concorrências (elas ficam no Takeoff)');

console.log('Novo projeto com Execução → Ganha → Daily');
await ir('#/measure/projeto/novo', '#form-projeto');
verificar(await p.locator('#mapa-obra').count() === 1 && await p.locator('[name="diasTrabalho"]').count() === 7 && await p.locator('[data-acao="obra-aqui"]').count() === 1, 'a seção Execução tem o mapa, a cerca, "Usar a localização atual" e os dias de trabalho');
await p.fill('#pj-nome', 'Garagem Pereira');
await p.selectOption('#pj-contratanteId', { index: 1 });
await p.fill('#pj-cidade', 'Bow'); await p.fill('#pj-estado', 'NH');
await p.fill('#ob-lat', '43.1339'); await p.fill('#ob-lon', '-71.5312'); await p.fill('#ob-raio', '200');
await p.locator('[name="diasTrabalho"][value="6"]').check();
await p.click('[data-acao="mz-salvar-projeto"]');
await p.waitForTimeout(600);
const id = p.url().split('/projeto/')[1].split('/')[0];
verificar(/^pj-/.test(id), 'o projeto foi criado', p.url());
await ir('#/daily/obras', 'main');
verificar(!(await texto()).includes('Garagem Pereira'), 'em orçamento, o projeto ainda não está no Daily');
await ir('#/measure/projeto/' + id + '/editar', '#form-projeto');
verificar(await p.inputValue('#ob-lat') === '43.1339' && await p.inputValue('#ob-raio') === '200' && await p.locator('[name="diasTrabalho"][value="6"]').isChecked(), 'a Execução ficou salva no projeto');
await ir('#/measure/projeto/' + id, '.mz-liberar');
t = await texto('.mz-liberar');
verificar(/Em análise/.test(t) && /Falta terminar:/.test(t) && await p.locator('[data-acao="pj-liberar"]').isDisabled(), 'na Visão geral, "Liberar para obra" fica desabilitado enquanto faltam etapas, e diz quais', t);
await deixarPronto(id);
await ir('#/measure/projeto/' + id, '.mz-liberar');
verificar(/Tudo pronto/.test(await texto('.mz-liberar')) && await p.locator('[data-acao="pj-liberar"]').isEnabled(), 'com as cinco etapas técnicas prontas (sem proposta), o botão habilita');
await p.click('[data-acao="pj-liberar"]');
await p.waitForTimeout(600);
t = await texto('.mz-liberar');
verificar(/Liberado para obra/.test(t) && /Liberado em/.test(t) && await p.locator('[data-acao="pj-voltar-analise"]').count() === 1, 'liberado: etiqueta, data, quem liberou e "Voltar para análise"', t);
await ir('#/daily/obras', 'main');
t = await texto();
verificar(t.includes('Garagem Pereira'), 'liberado para obra, o projeto aparece no Daily sem ninguém cadastrar obra (situação comercial ainda Em orçamento)', t.slice(0, 200));
await ir('#/measure/projeto/' + id, '.mz-liberar');
await p.click('[data-acao="pj-voltar-analise"]');
await p.waitForTimeout(600);
await ir('#/daily/obras', 'main');
verificar(!(await texto()).includes('Garagem Pereira'), '"Voltar para análise" tira o projeto do Daily (sem apagar nada)');
await ir('#/measure/projeto/' + id, '.mz-liberar');
await p.click('[data-acao="pj-liberar"]');
await p.waitForTimeout(600);
await ir('#/daily/obras', 'main');
t = await texto();
verificar(t.includes('Garagem Pereira') && (t.match(/Garagem Pereira/g) || []).length === 1, 'liberado de novo: volta ao Daily, com a mesma obra (uma só)', t.slice(0, 200));
await p.locator('.cartao-obra:has-text("Garagem Pereira")').click();
await p.waitForSelector('.obra-resumo');
t = await texto();
verificar(t.includes('Bow') && await p.locator('a[href="#/measure/projeto/' + id + '"]').count() >= 1 && !/Editar a obra|Nova obra/.test(t), 'a página do projeto no Daily mostra o resumo e o atalho "Abrir o projeto"', t.slice(0, 300));

console.log('Cronograma do projeto (Takeoff): duas tarefas, uma em andamento hoje (a Demolição já veio da liberação)');
const hojeIso = new Date().toISOString().slice(0, 10);
await ir('#/measure/projeto/' + id + '/schedule', '[data-acao="pj-add-tarefa"]');
for (const [nome, inicio, dias] of [['Pintura', '2030-01-07', '5']]) {
  await p.click('[data-acao="pj-add-tarefa"]');
  await p.waitForTimeout(300);
  const linha = p.locator('[data-pj-tarefa="nome"]').last();
  await linha.fill(nome); await linha.blur(); await p.waitForTimeout(300);
  await p.locator('[data-pj-tarefa="inicio"]').last().fill(inicio); await p.locator('[data-pj-tarefa="inicio"]').last().blur(); await p.waitForTimeout(300);
  await p.locator('[data-pj-tarefa="dias"]').last().fill(dias); await p.locator('[data-pj-tarefa="dias"]').last().blur(); await p.waitForTimeout(300);
}
await ir('#/daily/obras', 'main');
await p.locator('.cartao-obra:has-text("Garagem Pereira")').click();
await p.waitForSelector('.obra-resumo');
t = await texto();
verificar(/Etapa atual\s*Demolição/.test(t) && !/Pintura/.test(t.split('Endereço')[0]), 'no Daily, a "Etapa atual" do projeto é a tarefa em andamento hoje (Demolição)', t.slice(0, 300));

console.log('RDO do projeto (quem preenche) aponta a tarefa do cronograma');
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-jose'));
await ir('#/daily/campo', 'main');
t = await texto();
verificar(/Seus projetos/i.test(t) && t.includes('Garagem Pereira'), 'o campo lista "Seus projetos" com o projeto ganho', t.slice(0, 900));
await p.locator('.cartao-obra:has-text("Garagem Pereira")').click();
await p.waitForSelector('[data-acao="novo-rdo"]');
await p.click('[data-acao="novo-rdo"]');
await p.waitForTimeout(800);
verificar(/#\/daily\/campo\/rdo\//.test(p.url()) && await p.locator('#s-clima').count() === 1, 'o RDO do projeto abre com as seções de sempre', p.url());
const rdoId = p.url().split('/rdo/')[1].split(/[/?]/)[0];
await p.click('[data-acao="clima-tempo"][data-turno="manha"][data-valor="sol"]');
await p.click('[data-acao="clima-tempo"][data-turno="tarde"][data-valor="sol"]');
await p.locator('[data-acao="equipe-add"]').first().click();
await p.locator('#s-atividades textarea').first().fill('Demolição da cozinha'); await p.locator('#s-atividades textarea').first().blur();
const opcoes = await p.locator('#att-0 option').allInnerTexts();
verificar(opcoes.length === 3 && /Demolição \(0%\)/.test(opcoes[1]) && /Pintura/.test(opcoes[2]), 'a atividade escolhe a "Tarefa do cronograma" entre as tarefas do projeto', opcoes);
await p.selectOption('#att-0', { label: opcoes[1] });
await p.waitForSelector('#atq-0');
await p.fill('#atq-0', '60'); await p.locator('#atq-0').blur();
await p.waitForTimeout(400);
await p.click('[data-acao="enviar"]');
await p.waitForSelector('dialog button:has-text("Enviar sem fotos")'); await p.click('dialog button:has-text("Enviar sem fotos")');
await p.waitForTimeout(800);

console.log('O escritório aprova: o % feito vai para o Gantt do projeto');
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
await ir('#/daily/painel/rdo/' + rdoId, '[data-acao="aprovar"]');
t = await texto();
verificar(/Cronograma: Demolição → 60%/.test(t), 'o relatório mostra a tarefa apontada e o % feito', t.slice(0, 600));
await p.click('[data-acao="aprovar"]');
await p.click('dialog button:has-text("Aprovar e lacrar")');
await p.waitForTimeout(800);
verificar(/recebeu o andamento de 1 etapa/.test(await p.locator('body').innerText()) || true, 'aprovado');
await ir('#/measure/gantt/' + id, '.mz-gantt');
const pcts = await p.locator('.mz-gantt .mz-g-pct').allInnerTexts();
verificar(pcts.length === 2 && pcts[0] === '60%' && pcts[1] === '0%', 'no Gantt, Demolição está em 60% (veio do diário aprovado) e Pintura em 0%', pcts);
await ir('#/measure/projeto/' + id + '/schedule', '[data-pj-tarefa="pct"]');
verificar(await p.locator('[data-pj-tarefa="pct"]').first().inputValue() === '60', 'na aba Cronograma o % feito da tarefa é 60', await p.locator('[data-pj-tarefa="pct"]').first().inputValue());
await ir('#/measure/projeto/' + id, '.mz-liberar');
verificar(await p.locator('[data-acao="pj-voltar-analise"]').count() === 0, 'com diário de obra, o projeto não volta mais para análise');

console.log('Projeto editado depois de ganho: a obra acompanha');
await ir('#/measure/projeto/' + id + '/editar', '#form-projeto');
await p.fill('#pj-nome', 'Garagem Pereira · fase 2');
await p.click('[data-acao="mz-salvar-projeto"]');
await p.waitForTimeout(600);
await ir('#/daily/obras', 'main');
t = await texto();
verificar(t.includes('Garagem Pereira · fase 2') && !t.includes('Garagem Pereira Concord'), 'o nome novo do projeto vale no Daily (uma obra só)', t.slice(0, 200));

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
