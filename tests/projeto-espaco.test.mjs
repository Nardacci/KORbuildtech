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

const textoDe = (sel) => p.locator(sel).first().innerText();

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
verificar(abas.length === 6, 'seis abas no projeto', abas);
await p.goto(BASE + '#/measure/projeto/' + id);
await p.waitForSelector('.mz-checklist', { timeout: 10000 });
verificar(await p.locator('.mz-checklist li').count() === 6, 'a visão geral tem o checklist de 6 passos');
verificar(await p.locator('.co-kpi').count() === 4, 'e os quatro cartões de resumo');

console.log('Observação das plantas');
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/pj-casa/plans');
await p.waitForSelector('#mz-enviar-obs', { timeout: 10000 });
verificar(await p.locator('[data-mz-folha-obs]').count() === 3, 'cada folha tem o seu campo de observação');
await p.locator('[data-mz-folha-obs]').first().fill('Rev. B: térreo');
await p.locator('[data-mz-folha-obs]').first().dispatchEvent('change');
await p.waitForTimeout(300);
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/pj-casa/plans');
await p.waitForSelector('[data-mz-folha-obs]');
verificar(await p.locator('[data-mz-folha-obs]').first().inputValue() === 'Rev. B: térreo', 'a observação da folha continua depois de recarregar');
await p.fill('#mz-enviar-obs', 'Rev. C: fachadas');
await p.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
await p.waitForFunction(() => document.querySelectorAll('[data-mz-folha-obs]').length > 3, null, { timeout: 30000 });
const obs = await p.locator('[data-mz-folha-obs]').evaluateAll((els) => els.map((e) => e.value));
verificar(obs.filter((v) => v === 'Rev. C: fachadas').length >= 1, 'a referência digitada no envio vai para as folhas do arquivo novo', obs);

console.log('Tarefas no cronograma (um único lugar)');
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/' + id + '/takeoff');
await p.waitForSelector('.tabela-quantidades', { timeout: 10000 });
verificar(await p.locator('#pj-nova-etapa').count() === 0 && await p.locator('.tabela-escopo').count() === 0 && await p.locator('[data-pj-quem]').count() === 0, 'o Takeoff não cadastra mais etapas nem pergunta quem faz: isso é do cronograma');

console.log('Cronograma');
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/' + id + '/schedule');
await p.waitForSelector('[data-acao="pj-add-tarefa"]', { timeout: 10000 });
verificar(await p.locator('[data-acao="pj-gerar-cronograma"]').isDisabled(), 'sem medições com etapas (assemblies), "Gerar a partir das etapas" fica desabilitado');
await p.click('[data-acao="pj-add-tarefa"]');
await p.click('[data-acao="pj-add-tarefa"]');
await p.locator('input[data-pj-tarefa="nome"]').nth(0).fill('07 46 33 · Siding');
await p.locator('input[data-pj-tarefa="nome"]').nth(0).dispatchEvent('change');
await p.locator('input[data-pj-tarefa="nome"]').nth(1).fill('07 31 13 · Roofing');
await p.locator('input[data-pj-tarefa="nome"]').nth(1).dispatchEvent('change');
await p.waitForTimeout(300);
verificar(await p.locator('.tabela-cronograma tbody tr').count() === 2, 'as tarefas são cadastradas na hora de montar o cronograma');
verificar(await p.locator('select[data-pj-tarefa="quem"]').count() === 2 && await p.locator('select[data-pj-tarefa="quem"]').nth(0).inputValue() === 'proprio', 'cada tarefa tem "quem faz" (nós, prestadora ou a decidir), editável a qualquer momento');
await p.locator('select[data-pj-tarefa="quem"]').nth(1).selectOption('terceiro');
await p.waitForTimeout(300);
verificar(await p.locator('select[data-pj-tarefa="quem"]').nth(1).inputValue() === 'terceiro', 'a segunda tarefa passa a ser da prestadora');
verificar(await p.locator('.tabela-cronograma a[href*="concorrencias/nova/projeto"]').count() === 1, 'a tarefa da prestadora oferece "pedir propostas"');
verificar(await p.locator('.mz-gantt .mz-g-barra.sub').count() === 1 && await p.locator('.mz-gantt .mz-g-barra.proprio').count() === 1, 'a linha do tempo pinta a barra da prestadora de outra cor');
const inicio = await p.locator('input[data-pj-tarefa="inicio"]').first().inputValue();
verificar(/^\d{4}-\d{2}-\d{2}$/.test(inicio), 'cada tarefa tem data de início', inicio);
await p.locator('input[data-pj-tarefa="dias"]').first().fill('9');
await p.locator('input[data-pj-tarefa="dias"]').first().dispatchEvent('change');
await p.waitForTimeout(300);
verificar((await p.locator('.tabela-cronograma tbody tr').first().innerText()).length > 0 && await p.locator('input[data-pj-tarefa="dias"]').first().inputValue() === '9', 'dá para mudar a duração');
await p.click('[data-acao="pj-add-marco"]');
await p.waitForTimeout(200);
verificar(await p.locator('input[data-pj-marco="nome"]').count() === 1, 'dá para adicionar um marco');
verificar(await p.locator('.mz-gantt .mz-g-barra').count() === 2 && await p.locator('.mz-g-meses span').count() >= 1, 'a linha do tempo desenha uma barra por tarefa, com eixo de meses');
verificar((await p.locator('.mz-gantt .mz-g-barra').first().getAttribute('title')).includes('9'), 'a barra mostra o detalhe (datas e duração) ao passar o mouse', await p.locator('.mz-gantt .mz-g-barra').first().getAttribute('title'));

verificar(await p.locator('[data-acao="pj-confirmar-cronograma"]').count() === 0, 'projeto ainda em orçamento: sem pedido de confirmação do cronograma');
await p.goto(BASE + '#/measure/projeto/' + id + '/editar');
await p.waitForSelector('#pj-situacao');
await p.selectOption('#pj-situacao', 'ganha');
await p.click('[data-acao="mz-salvar-projeto"]');
await p.goto('about:blank');
await p.goto(BASE + '#/measure/projeto/' + id + '/schedule');
await p.waitForSelector('[data-acao="pj-confirmar-cronograma"]', { timeout: 10000 });
verificar((await textoDe('.pagina')).includes('Confirme o cronograma'), 'projeto ganho: o cronograma pede confirmação');
await p.click('[data-acao="pj-confirmar-cronograma"]');
await p.waitForTimeout(300);
verificar((await textoDe('.pagina')).includes('Cronograma confirmado') && (await textoDe('.pagina')).includes('2 tarefas'), 'confirmado: vira a base da obra, com a data e o número de tarefas');

console.log('Criar a obra a partir do cronograma confirmado');
await p.goto('about:blank');
await p.goto(BASE + '&versao=completa#/settings/obra/nova/' + id); // na 1ª versão não há cronograma da obra: vale na versão completa
await p.waitForSelector('#form-obra', { timeout: 10000 });
const opcoes = await p.locator('#ob-modeloId option').evaluateAll((els) => els.map((e) => ({ v: e.value, t: e.textContent, s: e.selected })));
verificar(opcoes.some((o) => o.v === 'projeto' && o.s && o.t.includes('2 etapas')), 'o cadastro da obra oferece o cronograma confirmado no projeto, já escolhido', opcoes);
const iniObra = await p.inputValue('#ob-inicio');
verificar(iniObra === inicio, 'o início da obra vem da primeira tarefa da base', iniObra + ' ≠ ' + inicio);
await p.fill('#ob-lat', '43.2'); await p.fill('#ob-lon', '-71.5'); await p.selectOption('#ob-responsavelId', 'u-jose');
await p.click('[data-acao="obra-salvar"]');
await p.waitForTimeout(600);
const nEtapas = await p.evaluate(() => { const achar = (o) => { if (!o || typeof o !== 'object') return null; if (o.cronogramas && Object.values(o.cronogramas).length) return Object.values(o.cronogramas).map((c) => c.etapas.length); for (const v of Object.values(o)) { const r = achar(v); if (r) return r; } return null; }; const r = achar(JSON.parse(localStorage.getItem('kbt.rdo.v1') || '{}')); return r ? r[r.length - 1] : -1; });
verificar(nEtapas === 2, 'a obra nasce com as duas etapas do cronograma do projeto', nEtapas);

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
