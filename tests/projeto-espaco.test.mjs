/* KORbuild — o projeto como espaço de trabalho (protótipo): criar em dois passos, abas, escopo e execução, cronograma.
 * Uso: python3 -m http.server 8123 &  →  node tests/projeto-espaco.test.mjs [http://localhost:8123/] */

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
p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE);
await p.waitForSelector('#form-login', { timeout: 30000 });
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/novo');
await p.waitForSelector('#form-projeto', { timeout: 20000 });

console.log('Novo projeto em dois passos');
verificar(await p.locator('#pj-nome').count() === 1 && await p.locator('#pj-descricao').count() === 0 && await p.locator('#pj-estimadorId').count() === 0, 'o formulário novo pede só o essencial (sem escopo, estimador nem obra vinculada)');
await p.fill('#pj-nome', 'Barn residing');
await p.selectOption('#pj-contratanteId', { index: 1 });
await p.fill('#pj-cidade', 'Hooksett');
await p.click('[data-acao="mz-salvar-projeto"]');
await p.waitForURL('**/plans', { timeout: 10000 });
verificar(/#\/measure\/projeto\/[^/]+\/plans$/.test(p.url()), 'depois de criar, vai para a aba Plantas');
verificar(await p.locator('#mz-enviar').count() === 1, 'a aba Plantas tem o envio de PDF');
const id = p.url().split('/projeto/')[1].split('/')[0];

console.log('Abas');
const abas = await p.locator('.abas-sublinhadas a').allInnerTexts();
verificar(abas.length === 8, 'oito abas no projeto', abas);
await p.goto(BASE + '#/measure/projeto/' + id);
await p.waitForSelector('.mz-checklist', { timeout: 10000 });
verificar(await p.locator('.mz-checklist li').count() === 6, 'a visão geral tem o checklist de 6 passos');
verificar(await p.locator('.co-kpi').count() === 4, 'e os quatro cartões de resumo');

console.log('Escopo e execução');
await p.goto(BASE + '#/measure/projeto/' + id + '/scope');
await p.waitForSelector('.mz-padroes', { timeout: 10000 });
await p.fill('#pj-nova-etapa', '07 46 33 · Siding');
await p.click('[data-acao="pj-add-etapa"]');
await p.fill('#pj-nova-etapa', '07 31 13 · Roofing');
await p.click('[data-acao="pj-add-etapa"]');
verificar(await p.locator('.tabela-escopo tbody tr').count() === 2, 'duas etapas na tabela');
await p.locator('select[data-pj-quem]').nth(1).selectOption('terceiro');
await p.waitForTimeout(300);
verificar(await p.locator('select[data-pj-quem]').nth(1).inputValue() === 'terceiro', 'a segunda etapa passa a ser subcontratada');
verificar(await p.locator('.tabela-escopo a[href*="concorrencias/nova/projeto"]').count() === 1, 'a etapa subcontratada oferece "pedir propostas"');
await p.locator('select[data-pj-quem]').nth(0).selectOption('proprio');
await p.waitForTimeout(300);
await p.click('[data-acao="pj-padrao"][data-padrao="tudo"]');
await p.waitForTimeout(300);
verificar((await p.locator('select[data-pj-quem]').evaluateAll((els) => els.map((e) => e.value))).every((v) => v === 'proprio'), '"Fazemos tudo" marca todas como próprias');

console.log('Cronograma');
await p.goto(BASE + '#/measure/projeto/' + id + '/schedule');
await p.waitForSelector('[data-acao="pj-gerar-cronograma"]', { timeout: 10000 });
await p.click('[data-acao="pj-gerar-cronograma"]');
await p.waitForTimeout(300);
verificar(await p.locator('.tabela-cronograma tbody tr').count() === 2, 'gerar a partir das etapas cria uma tarefa por etapa');
const inicio = await p.locator('input[data-pj-tarefa="inicio"]').first().inputValue();
verificar(/^\d{4}-\d{2}-\d{2}$/.test(inicio), 'cada tarefa tem data de início', inicio);
await p.locator('input[data-pj-tarefa="dias"]').first().fill('9');
await p.locator('input[data-pj-tarefa="dias"]').first().dispatchEvent('change');
await p.waitForTimeout(300);
verificar((await p.locator('.tabela-cronograma tbody tr').first().innerText()).length > 0 && await p.locator('input[data-pj-tarefa="dias"]').first().inputValue() === '9', 'dá para mudar a duração');
await p.click('[data-acao="pj-add-marco"]');
await p.waitForTimeout(200);
verificar(await p.locator('input[data-pj-marco="nome"]').count() === 1, 'dá para adicionar um marco');

console.log('Visão geral depois do trabalho');
await p.goto(BASE + '#/measure/projeto/' + id);
await p.waitForSelector('.mz-checklist', { timeout: 10000 });
const feitos = await p.locator('.mz-passo.feito').count();
verificar(feitos >= 2, 'o checklist marca o que já foi feito (escopo e cronograma)', feitos);

console.log('Lista de projetos');
await p.goto(BASE + '#/measure');
await p.waitForSelector('.tabela-projetos', { timeout: 10000 });
await p.fill('.mz-busca', 'barn');
await p.waitForTimeout(200);
verificar(await p.locator('.tabela-projetos tbody tr:not([hidden])').count() === 1, 'a busca deixa só o projeto que combina');
verificar(erros.length === 0, 'sem erros de JavaScript', erros.join(' | '));

await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
