/* KORbuild — teste do cronograma da obra (docs/cronograma.md), em português.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/cronograma.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://localhost:8123/';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, acceptDownloads: true, geolocation: { latitude: 43.004, longitude: -71.4635 }, permissions: ['geolocation'] });
await context.addInitScript(() => { try { if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* sem armazenamento */ } });
await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
await context.route('https://fonts.**', (r) => r.abort());
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T10:00:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

const comoUsuario = async (id, hash) => {
  await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id);
  await page.goto(BASE + hash);
  await page.waitForTimeout(300);
};
const toast = async () => { await page.waitForSelector('#toast.on'); return page.textContent('#toast'); };
const noDialogo = async (texto) => { await page.click('dialog button:has-text("' + texto + '")'); await page.waitForTimeout(200); };
const banco = () => page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')));
const crono = async () => (await banco()).empresas['prestadora-exemplo'].cronogramas['nf-jardim'];

/* Lê uma planilha .xlsx baixada: os textos (sharedStrings) e a planilha. */
function lerXlsx(caminho) {
  const pasta = mkdtempSync(join(tmpdir(), 'xlsx-'));
  execFileSync('unzip', ['-q', '-o', caminho, '-d', pasta]);
  const ler = (f) => { try { return readFileSync(join(pasta, f), 'utf8'); } catch { return ''; } };
  return { textos: ler('xl/sharedStrings.xml'), planilha: ler('xl/worksheets/sheet1.xml'), estilos: ler('xl/styles.xml'), arquivos: execFileSync('unzip', ['-Z1', caminho]).toString() };
}

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });

console.log('Prestadora: cronograma da obra');
await comoUsuario('u-tom', '#/daily/obras/nf-jardim');
verificar(await page.locator('#conteudo a[href="#/daily/obras/nf-jardim/cronograma"]').count() === 1, 'a obra mostra o cartão do cronograma, com o avanço');
verificar((await page.textContent('.obra-resumo')).includes('Framing do 2º pavimento'), 'a etapa atual sai do cronograma (etapas em andamento)');
await page.click('#conteudo a[href="#/daily/obras/nf-jardim/cronograma"]');
await page.waitForSelector('.gantt');
verificar(await page.locator('.gantt-linha').count() === 8, 'Gantt com as 8 etapas de exemplo');
verificar(await page.locator('.gantt-linha.sit-atrasada').count() === 1 && await page.locator('.gantt-linha.sit-risco').count() === 1, 'uma etapa atrasada e uma em risco (CR-05)');
verificar(await page.locator('.gantt-base').count() === 8 && await page.locator('.gantt-hoje').count() === 8, 'linha de base e linha do hoje em todas as etapas');
const kpis = await page.textContent('.cr-kpis');
verificar(/Avanço real\s*\d+%/.test(kpis) && kpis.includes('planejado para hoje'), 'avanço real × planejado (CR-06)');
verificar(kpis.includes('depois da linha de base'), 'término previsto comparado com a linha de base');
verificar((await page.textContent('.gantt-linha:nth-of-type(5)')).includes('+4 dias') || (await page.textContent('.gantt')).includes('desvio +4 dias'), 'desvio em dias contra a linha de base');

// nova etapa
await page.click('[data-acao="cr-etapa"]:has-text("Nova etapa")');
await page.fill('dialog input[name="nome"]', 'Limpeza final');
await noDialogo('Criar etapa');
verificar((await toast()).includes('Etapa criada'), 'nova etapa criada');
verificar((await crono()).etapas.length === 9, 'etapa gravada no cronograma');
await page.click('[data-acao="cr-etapa"]:has-text("Nova etapa")');
await page.fill('dialog input[name="nome"]', 'Errada');
await page.fill('dialog input[name="inicio"]', '2026-12-10');
await page.fill('dialog input[name="fim"]', '2026-12-01');
await noDialogo('Criar etapa');
verificar((await toast()).includes('O fim não pode ser antes do início'), 'fim antes do início é recusado');

// % manual com histórico
await page.click('.gantt-linha:has-text("Sheathing") [data-acao="cr-avanco"]');
await page.fill('dialog input[name="pct"]', '140');
await noDialogo('Salvar');
// o próprio campo (máximo 100) segura o envio; se passasse, a regra recusaria (registrarAvanco)
verificar(await page.locator('dialog[open]').count() === 1 && (await crono()).etapas.find((e) => e.id === 'et-osb').pct === 30, '% acima de 100 é recusado');
await noDialogo('Cancelar');
await page.click('.gantt-linha:has-text("Sheathing") [data-acao="cr-avanco"]');
await page.fill('dialog input[name="pct"]', '75');
await noDialogo('Salvar');
await toast();
const osb = (await crono()).etapas.find((e) => e.id === 'et-osb');
verificar(osb.pct === 75 && osb.historico.slice(-1)[0].fonte === 'manual' && osb.historico.slice(-1)[0].antes === 30, '% ajustado pelo escritório, com histórico (antes 30 → 75)');
verificar(await page.locator('.gantt-linha.sit-risco').count() === 0, 'com 75%, a etapa sai de "em risco"');

// editar datas e ver o desvio; mover
await page.click('.gantt-linha:has-text("Siding vinil") [data-acao="cr-etapa"]');
verificar((await page.textContent('dialog')).includes('Na linha de base'), 'editar mostra as datas da linha de base');
await page.fill('dialog input[name="fim"]', '2026-11-24');
await noDialogo('Salvar');
await toast();
verificar((await page.textContent('.gantt-linha:has-text("Siding vinil")')).includes('+10 dias'), 'mudar o fim aumenta o desvio (+10 dias), sem mexer na linha de base');
const ordemAntes = (await crono()).etapas.map((e) => e.id).indexOf('et-trim');
await page.click('.gantt-linha:has-text("Trim e acabamento") [data-acao="cr-mover"][data-passo="-1"]');
verificar((await crono()).etapas.map((e) => e.id).indexOf('et-trim') === ordemAntes - 1, 'etapa sobe na lista');

// nova linha de base
await page.click('[data-acao="cr-base"]');
await noDialogo('Salvar linha de base');
verificar((await toast()).includes('motivo é obrigatório'), 'linha de base sem motivo é recusada');
await page.click('[data-acao="cr-base"]');
await page.fill('dialog input[name="motivo"]', 'Aditivo de prazo do siding');
await noDialogo('Salvar linha de base');
await toast();
verificar((await crono()).bases.length === 2, 'nova linha de base salva; a anterior fica no histórico (CR-03)');
verificar(!(await page.textContent('.gantt-linha:has-text("Siding vinil")')).includes('+10 dias'), 'contra a nova linha de base, o desvio do siding zera');

console.log('Excel');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="cr-excel"]')]);
const arq = join(mkdtempSync(join(tmpdir(), 'cr-')), 'cronograma.xlsx');
await dl.saveAs(arq);
verificar(/^Cronograma - Residencial Jardim das Flores.*\.xlsx$/.test(dl.suggestedFilename()), 'arquivo .xlsx com o nome da obra: ' + dl.suggestedFilename());
const x = lerXlsx(arq);
verificar(x.arquivos.includes('xl/worksheets/sheet1.xml') && x.arquivos.includes('xl/styles.xml'), 'é uma planilha Excel de verdade (OOXML)');
verificar(x.textos.includes('CRONOGRAMA DA OBRA') && x.textos.includes('Northfield Framing &amp; Siding') && x.textos.includes('Construtora Exemplo'), 'cabeçalho com a empresa, o título e o contratante');
verificar(x.textos.includes('Limpeza final') && x.textos.includes('Siding vinil') && x.textos.includes('Legenda'), 'etapas e legenda na planilha');
verificar(x.estilos.includes('FFF04438') && x.estilos.includes('FF12B76A') && x.estilos.includes('FFF26A1B'), 'barras do Gantt coloridas por situação e faixa da marca');
verificar(x.planilha.includes('state="frozen"') && x.planilha.includes('orientation="landscape"') && x.planilha.includes('<mergeCell'), 'cabeçalho congelado, página na horizontal e células mescladas');

console.log('Publicar para a construtora');
await page.click('[data-acao="cr-publicar"]');
await noDialogo('Publicar');
verificar((await toast()).includes('Versão 2 publicada'), 'versão 2 publicada (CR-09)');
verificar((await page.textContent('#cronograma')).includes('vê a versão 2'), 'a tela diz qual versão a construtora vê');
const pubs = (await banco()).compartilhados.filter((p) => p.tipo === 'cronograma');
verificar(pubs.length === 2 && pubs[1].cronograma.etapas.length === 9 && pubs[1].para.obraId === 'jardim', 'retrato entregue para a obra da construtora');

await comoUsuario('u-ana', '#/daily/obras/jardim');
verificar((await page.textContent('#conteudo')).includes('Cronogramas das prestadoras') && (await page.textContent('#conteudo')).includes('Versão 2'), 'a construtora vê a versão mais nova na obra dela');
await page.click('#conteudo a[href*="/cronograma/recebido/"]');
await page.waitForSelector('.gantt');
verificar(await page.locator('.gantt-linha').count() === 9, 'Gantt da versão publicada (9 etapas)');
verificar(await page.locator('[data-acao="cr-etapa"], [data-acao="cr-avanco"], [data-acao="cr-mover"]').count() === 0, 'só leitura: a construtora não edita');
verificar((await page.textContent('.aviso-info')).includes('Só leitura'), 'aviso de que é o cronograma da prestadora');
const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="cr-excel-recebido"]')]);
const arq2 = join(mkdtempSync(join(tmpdir(), 'cr-')), 'recebido.xlsx');
await dl2.saveAs(arq2);
verificar(lerXlsx(arq2).textos.includes('Versão 2, publicada em'), 'a construtora também exporta o Excel (com a versão)');
await comoUsuario('u-ana', '#/daily/obras/jardim/cronograma/recebido/nao-existe');
verificar((await page.textContent('main')).includes('Não encontrado'), 'publicação inexistente: não encontrado');
await comoUsuario('u-ana', '#/daily/obras/galpao');
verificar(!(await page.textContent('#conteudo')).includes('Montar cronograma'), 'a construtora não monta cronograma (quem monta é a prestadora)');

console.log('Daily: encarregado informa o andamento; aprovar leva ao cronograma');
await comoUsuario('u-jose', '#/daily/campo/obra/nf-jardim');
const look = await page.textContent('.cr-lookahead');
verificar(look.includes('Próximas 3 semanas') && look.includes('Framing do 2º pavimento') && look.includes('Janelas e portas externas'), 'próximas 3 semanas na tela da obra do encarregado (CR-07)');
verificar(!look.includes('Mobilização'), 'etapas concluídas não entram nas próximas semanas');
await page.click('[data-acao="novo-rdo"]');
await page.waitForSelector('#s-atividades');
if (!(await page.locator('[data-bind="atividades.0.descricao"]').count())) await page.click('[data-acao="ativ-add"]');
await page.fill('[data-bind="atividades.0.descricao"]', 'Framing das paredes do 2º pavimento, eixos C e D.');
await page.selectOption('[data-bind="atividades.0.cronoEtapaId"]', 'et-fr2');
await page.waitForSelector('[data-bind="atividades.0.cronoPct"]');
await page.fill('[data-bind="atividades.0.cronoPct"]', '80');
await page.waitForTimeout(300);
const rdoId = (await page.evaluate(() => location.hash)).split('/').pop();
const rdo = (await banco()).empresas['prestadora-exemplo'].rdos.find((r) => r.id === rdoId);
verificar(rdo && rdo.atividades[0].cronoEtapaId === 'et-fr2' && String(rdo.atividades[0].cronoPct) === '80', 'atividade do RDO aponta a etapa e o % (CR-04)');
verificar((await crono()).etapas.find((e) => e.id === 'et-fr2').pct === 65, 'antes da aprovação, o cronograma não muda');
// o envio completo do RDO é testado em demo.test.mjs; aqui ele chega ao escritório direto
await page.evaluate((id) => {
  const b = JSON.parse(localStorage.getItem('kbt.rdo.v1'));
  const r = b.empresas['prestadora-exemplo'].rdos.find((x) => x.id === id);
  Object.assign(r, { status: 'enviado', sync: 'enviado', enviadoEm: Date.now(), primeiroEnvioEm: Date.now() });
  localStorage.setItem('kbt.rdo.v1', JSON.stringify(b));
}, rdoId);
await comoUsuario('u-tom', '#/daily/painel/rdo/' + rdoId);
await page.reload();
await page.waitForSelector('[data-acao="aprovar"]');
verificar((await page.textContent('#conteudo')).includes('Cronograma: Framing do 2º pavimento → 80%'), 'o relatório mostra a etapa e o % informados');
await page.click('[data-acao="aprovar"]');
await noDialogo('Aprovar e lacrar');
verificar((await toast()).includes('cronograma recebeu o andamento de 1 etapa'), 'aprovar avisa que o cronograma foi atualizado');
const fr2 = (await crono()).etapas.find((e) => e.id === 'et-fr2');
verificar(fr2.pct === 80 && fr2.historico.slice(-1)[0].fonte === 'rdo' && fr2.historico.slice(-1)[0].rdoId === rdoId, 'o % vai para a etapa, com o RDO de origem no histórico');

console.log('Sininho e permissões');
await comoUsuario('u-tom', '#/daily/painel');
const notifs = await page.evaluate(() => Array.from(document.querySelectorAll('.notif-texto b')).map((b) => b.textContent));
verificar(notifs.some((t) => t.includes('Etapa atrasada: Blocking e reforços')), 'sininho avisa a etapa atrasada (CR-08)');
await comoUsuario('u-rita', '#/daily/obras/nf-jardim/cronograma');
verificar(await page.locator('[data-acao="cr-etapa"]').count() > 0, 'a gestora de obras também monta o cronograma');
await comoUsuario('u-tom', '#/settings/perfis');
verificar((await page.textContent('#conteudo')).includes('Montar o cronograma da obra'), 'permissão nova no catálogo de perfis');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
