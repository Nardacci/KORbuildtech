/* KORbuild — capturas das telas para o portal (portal/img/), tiradas do protótipo com os dados de exemplo.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tools/capturas-portal.mjs [http://localhost:8123/]
 * Depois: python3 tools/gerar_portal.py. Horário fixo (quarta-feira, 7/out/2026, 16h30), como nos testes,
 * para as telas saírem sempre iguais. Idioma: inglês (o portal está em inglês). */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const RAIZ = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
// --so=daily,crew: refaz só essas partes (as outras capturas continuam como estão)
const SO = ((process.argv.find((a) => a.startsWith('--so=')) || '').slice(5)).split(',').filter(Boolean);
const parte = (nome) => !SO.length || SO.includes(nome);
const DEMO = RAIZ + '?demo';
const PASTA = new URL('../portal/img/', import.meta.url).pathname;
mkdirSync(PASTA, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let feitas = 0;

async function contexto(largura, quando = '2026-10-07T16:30:00', altura) {
  const celular = largura < 600;
  const ctx = await browser.newContext({
    viewport: { width: largura, height: altura || (celular ? 844 : 860) }, deviceScaleFactor: celular ? 2 : 1.25,
    geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'],
  });
  await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'en'); } catch { /* */ } });
  await ctx.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
  await ctx.route(/fonts\.|tile\.openstreetmap|router\.project-osrm|nominatim/, (r) => r.abort());
  const page = await ctx.newPage();
  await page.clock.setFixedTime(new Date(quando));
  await page.goto(DEMO + '#/entrar');
  await page.waitForSelector('#form-login', { timeout: 60000 });
  return { ctx, page };
}
const como = async (page, usuario, hash) => {
  await page.evaluate((u) => localStorage.setItem('kbt.sessao', u), usuario);
  await page.goto('about:blank');
  await page.goto(DEMO + hash);
  await page.waitForTimeout(700);
};
async function foto(page, nome, alvo) {
  const arq = PASTA + nome + '.png';
  if (alvo) await page.locator(alvo).first().screenshot({ path: arq });
  else await page.screenshot({ path: arq });
  feitas++;
  console.log('  ' + nome);
}

/* ---------- Entrada ---------- */
if (parte('entrada')) {
  const { ctx, page } = await contexto(1366);
  await page.goto(RAIZ); await page.waitForSelector('#form-login-oficial');
  await foto(page, 'entry-main');
  await page.goto(DEMO + '#/entrar'); await page.waitForSelector('#form-login');
  await foto(page, 'entry-prototype');
  // a tela de módulos de uma prestadora com tudo contratado (a construtora só tem o Daily de acompanhamento)
  await como(page, 'u-tom', '#/inicio');
  await foto(page, 'modules-home');
  await como(page, 'u-ana', '#/inicio');
  await foto(page, 'modules-home-gc');
  await ctx.close();
}

/* ---------- Daily: campo (celular, Carlos, encarregado) ---------- */
if (parte('daily')) {
  const { ctx, page } = await contexto(390);
  await como(page, 'u-carlos', '#/daily/campo');
  await foto(page, 'daily-field-today-mobile');
  await page.click('#conteudo a[href="#/daily/campo/obra/jardim"]');
  await page.waitForTimeout(800);
  await foto(page, 'daily-field-job-mobile');
  // copia o relatório anterior: as seções saem preenchidas, como no dia a dia
  await page.click('[data-acao="copiar-rdo"]');
  await page.waitForSelector('dialog .opcao-rdo');
  await foto(page, 'daily-copy-previous-mobile', 'dialog[open]');
  await page.click('dialog .opcao-rdo >> nth=0');
  await page.click('dialog[open] .btn-primario');
  await page.waitForSelector('#s-clima');
  await page.waitForTimeout(900);
  await foto(page, 'daily-report-top-mobile');
  const semBarra = await page.addStyleTag({ content: '.rodape-envio { display: none !important; }' });
  for (const s of ['clima', 'equipe', 'equipamentos', 'atividades', 'fotos', 'ocorrencias']) {
    if (await page.locator('#s-' + s).count()) await foto(page, 'daily-report-' + s + '-mobile', '#s-' + s);
  }
  await semBarra.evaluate((el) => el.remove());
  await foto(page, 'daily-report-submit-bar-mobile', '.rodape-envio');
  await page.click('[data-acao="enviar"]');
  await page.waitForTimeout(500);
  if (await page.locator('dialog[open]').count()) await foto(page, 'daily-report-send-check-mobile', 'dialog[open]');
  await como(page, 'u-carlos', '#/daily/campo/obra/galpao');
  await foto(page, 'daily-field-changes-requested-mobile');
  await como(page, 'u-carlos', '#/daily/historico');
  await foto(page, 'daily-field-history-mobile');
  await ctx.close();
}

/* ---------- Daily: escritório (computador, Ana, administradora da construtora: aprova os diários das prestadoras) ---------- */
if (parte('daily')) {
  const { ctx, page } = await contexto(1366);
  await como(page, 'u-ana', '#/daily/painel');
  await foto(page, 'daily-dashboard');
  await como(page, 'u-ana', '#/daily/aprovacoes');
  await foto(page, 'daily-approvals');
  await como(page, 'u-ana', '#/daily/obras');
  await foto(page, 'daily-jobs');
  await como(page, 'u-ana', '#/daily/obras/jardim');
  await foto(page, 'daily-job');
  await foto(page, 'daily-job-subcontractors', '.prestadoras-obra');
  // a prestadora não aprova o diário da obra da construtora: espera por ela
  await como(page, 'u-tom', '#/daily/painel/rdo/rdo-nf-jardim-m1');
  await foto(page, 'daily-sub-waiting-gc', '.revisao-lado');
  await como(page, 'u-ana', '#/daily/obras/jardim');
  await page.click('.menu-usuario.sino summary').catch(() => {});
  await page.waitForTimeout(300);
  await foto(page, 'daily-notifications', '.menu-usuario.sino .menu');
  await como(page, 'u-ana', '#/daily/painel/rdo/rdo-atlantico-hoje');
  await foto(page, 'daily-review');
  await page.click('[data-acao="pedir-ajustes"]');
  await page.waitForSelector('dialog[open]');
  await foto(page, 'daily-request-changes', 'dialog[open]');
  await page.keyboard.press('Escape');
  await como(page, 'u-ana', '#/daily/painel/rdo/rdo-jardim-m1');
  await page.click('[data-acao="aprovar"]');
  await page.waitForSelector('dialog[open]');
  await foto(page, 'daily-approve-confirm', 'dialog[open]');
  await page.click('dialog[open] .btn-primario');
  await page.waitForSelector('.codigo.grande');
  await page.waitForTimeout(400);
  await foto(page, 'daily-approved');
  const codigo = (await page.textContent('.codigo.grande')).trim();
  await como(page, 'u-ana', '#/daily/pdf/rdo-jardim-m1');
  await page.waitForTimeout(800);
  await foto(page, 'daily-pdf');
  await page.goto(DEMO + '#/cliente/' + codigo);
  await page.waitForTimeout(1500);
  await foto(page, 'daily-client-link');
  await ctx.close();
}

/* ---------- Crew: trabalhador (celular, Diego) ---------- */
if (parte('crew')) {
  // antes da entrada (6h50): o Meu ponto só oferece "bater entrada"
  let { ctx, page } = await contexto(390, '2026-10-07T06:50:00');
  await como(page, 'u-diego', '#/crew/meu');
  await foto(page, 'crew-my-clock-before-mobile');
  const entrada = page.locator('#conteudo button[data-acao]').first();
  await entrada.click().catch(() => {});
  await page.waitForTimeout(1200);
  if (await page.locator('dialog[open]').count()) await foto(page, 'crew-my-clock-in-dialog-mobile', 'dialog[open]');
  await ctx.close();
  ({ ctx, page } = await contexto(390));
  await como(page, 'u-diego', '#/crew/meu');
  await foto(page, 'crew-my-clock-working-mobile');
  await ctx.close();
}

/* ---------- Crew: encarregado (celular, Carlos) ---------- */
if (parte('crew')) {
  // 6h55: a equipe ainda não entrou; o Carlos bate a entrada de todos
  const { ctx, page } = await contexto(390, '2026-10-07T06:55:00');
  await como(page, 'u-carlos', '#/crew/equipe');
  await foto(page, 'crew-team-before-mobile');
  await page.click('[data-acao="crew-todos"]');
  await page.waitForTimeout(300);
  await foto(page, 'crew-team-selected-mobile');
  await page.click('[data-acao="crew-entrada"]');
  await page.waitForSelector('dialog[open]');
  await page.waitForTimeout(1000);
  await foto(page, 'crew-team-clock-in-dialog-mobile', 'dialog[open]');
  await page.click('dialog[open] .btn-primario');
  await page.waitForTimeout(1200);
  await foto(page, 'crew-team-working-mobile');
  await page.click('[data-acao="crew-todos"]');
  await page.waitForTimeout(300);
  await page.click('[data-acao="crew-troca"]');
  await page.waitForSelector('dialog[open]');
  await page.waitForTimeout(1000);
  await foto(page, 'crew-switch-job-dialog-mobile', 'dialog[open]');
  await page.keyboard.press('Escape');
  await como(page, 'u-carlos', '#/crew/horas');
  await foto(page, 'crew-team-hours-mobile');
  await ctx.close();
}

/* ---------- Crew: escritório (computador, Ana) ---------- */
if (parte('crew')) {
  const { ctx, page } = await contexto(1366);
  await como(page, 'u-sandra', '#/crew/agora');
  await foto(page, 'crew-now');
  await como(page, 'u-sandra', '#/crew/timesheets/2026-09-28');
  await foto(page, 'crew-timesheets');
  // a semana de quem ainda espera aprovação (Roberto): ajustar e devolver ficam ali
  const semana = await page.$$eval('#conteudo tr', (linhas) => {
    const l = linhas.find((tr) => /Awaiting approval/.test(tr.textContent) && tr.querySelector('a[href^="#/crew/semana/"]'));
    return l ? l.querySelector('a[href^="#/crew/semana/"]').getAttribute('href') : null;
  });
  if (semana) {
    await como(page, 'u-sandra', semana);
    await foto(page, 'crew-employee-week');
    for (const [acao, nome] of [['crew-ajustar', 'crew-adjust-dialog'], ['crew-devolver', 'crew-return-dialog']]) {
      if (!(await page.locator('[data-acao="' + acao + '"]').count())) continue;
      await page.locator('[data-acao="' + acao + '"]').first().click();
      await page.waitForSelector('dialog[open]');
      await page.waitForTimeout(300);
      await foto(page, nome, 'dialog[open]');
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
  }
  await como(page, 'u-sandra', '#/crew/agora');
  const dia = await page.$eval('#conteudo a[href^="#/crew/dia/"]', (a) => a.getAttribute('href')).catch(() => null);
  if (dia) {
    await como(page, 'u-sandra', dia);
    await page.waitForTimeout(1500);
    await foto(page, 'crew-day-map');
  }
  await como(page, 'u-sandra', '#/crew/custos');
  await foto(page, 'crew-costs-jobs');
  await page.click('[data-acao="crew-orcamento"]').catch(() => {});
  await page.waitForTimeout(500);
  if (await page.locator('dialog[open]').count()) { await foto(page, 'crew-budget-dialog', 'dialog[open]'); await page.keyboard.press('Escape'); }
  await como(page, 'u-sandra', '#/crew/custos/mes/2026-10');
  await foto(page, 'crew-costs-month');
  await ctx.close();
}

/* ---------- Measure (computador, Tom, prestadora) ---------- */
if (parte('measure')) {
  // tela alta: a planta inteira cabe no visor (as duas fachadas da A-201 ficam à vista)
  const { ctx, page } = await contexto(1440, undefined, 1150);
  // coordenadas dos desenhos de exemplo (tools/gerar-planta.py), em pés → ponto na tela
  const PLANTA = { x0: 110, y0: 190, k: 18 }, SUL = { x0: 110, y0: 470, k: 18 }, LESTE = { x0: 110, y0: 90, k: 18 };
  const naTela = async (pes, o = PLANTA) => {
    const box = await page.locator('#mz-desenho').boundingBox();
    const z = box.width / 1224;
    return { x: box.x + (o.x0 + pes[0] * o.k) * z, y: box.y + (792 - (o.y0 + pes[1] * o.k)) * z };
  };
  const clicar = async (pes, o) => { const p = await naTela(pes, o); await page.mouse.click(p.x, p.y); };
  const confirmar = async () => { await page.click('dialog[open] .btn-primario'); await page.waitForSelector('dialog', { state: 'detached' }); };
  const abrirFolha = async (id) => { await como(page, 'u-tom', '#/measure/folha/' + id); await page.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 20000 }); };
  const painel = (nome) => page.locator('.mz-cond').filter({ has: page.locator('.mz-cond-topo b', { hasText: nome }) });
  const incluir = async (aid, nome, campos = {}, vaos = [], fotoNome) => {
    await page.click('[data-acao="mz-incluir-assembly"]');
    await page.check('dialog input[name="assembly"][value="' + aid + '"]');
    if (fotoNome) await foto(page, fotoNome, 'dialog[open]');
    await page.click('dialog[open] .btn-primario');
    await page.waitForSelector('dialog input[name="nome"]');
    await page.fill('dialog input[name="nome"]', nome);
    for (const [k, v] of Object.entries(campos)) await page.fill('dialog input[name="' + k + '"]', v);
    for (const v of vaos) await page.check('dialog .mz-vaos label:has-text("' + v + '") input');
    if (fotoNome) await foto(page, fotoNome + '-details', 'dialog[open]');
    await confirmar();
  };
  const escala = async (a, b, o, real, fotos) => {
    await page.click('[data-acao="mz-escala"]');
    await page.selectOption('dialog select[name="razao"]', '48');
    if (fotos) await foto(page, 'measure-scale-dialog', 'dialog[open]');
    await confirmar();
    await clicar(a, o); await clicar(b, o);
    await page.fill('dialog input[name="real"]', real);
    if (fotos) await foto(page, 'measure-check-dialog', 'dialog[open]');
    await confirmar();
    await page.waitForTimeout(400);
  };

  await como(page, 'u-tom', '#/measure');
  await foto(page, 'measure-projects');
  await como(page, 'u-tom', '#/measure/projeto/novo');
  await foto(page, 'measure-project-form');
  await como(page, 'u-tom', '#/measure/projeto/pj-casa');
  await foto(page, 'measure-project-empty');

  // planta baixa: escala, assemblies e medição
  await abrirFolha('fl-a101');
  await foto(page, 'measure-viewer-empty');
  await escala([0, 31], [40, 31], PLANTA, '40\'-0"', true);
  await incluir('as-parede', 'Exterior walls', { altura: '9\'-0"' }, [], 'measure-add-assembly');
  await incluir('as-lvp', 'Floor (LVP)');
  await incluir('as-porta', 'Interior doors', { vaoLargura: '2\'-6"', vaoAltura: '6\'-8"' });
  await painel('Exterior walls').locator('.mz-cond-topo').click();
  for (const p of [[0, 0], [40, 0], [40, 28], [0, 28], [0, 0]]) await clicar(p);
  await page.keyboard.press('Enter');
  await painel('Floor (LVP)').locator('.mz-cond-topo').click();
  for (const p of [[0.5, 0.5], [39.5, 0.5], [39.5, 27.5], [0.5, 27.5]]) await clicar(p);
  await clicar([0.5, 0.5]);
  await page.click('[data-acao="mz-ferramenta"][data-ferramenta="recortar"]');
  for (const p of [[22, 12], [30, 12], [30, 18]]) await clicar(p);
  const fim = await naTela([22, 18]);
  await page.mouse.dblclick(fim.x, fim.y);
  await painel('Interior doors').locator('.mz-cond-topo').click();
  for (const p of [[22, 8.5], [27.5, 12], [32.5, 18]]) await clicar(p);
  await page.waitForTimeout(400);
  await foto(page, 'measure-viewer-plan');
  await foto(page, 'measure-toolbar', '#mz-barra');
  await foto(page, 'measure-panel', '#mz-painel');

  // fachadas: janelas contadas com o vão e siding descontando os vãos
  await abrirFolha('fl-a201');
  await escala([0, -2.5], [40, -2.5], SUL, '40\'');
  await incluir('as-jan-w1', 'Windows W1', { vaoLargura: '5\'-0"', vaoAltura: '4\'-0"' });
  await incluir('as-jan-w2', 'Windows W2', { vaoLargura: '4\'-0"', vaoAltura: '4\'-0"' });
  await incluir('as-porta-ext', 'Entry door D1', { vaoLargura: '3\'-0"', vaoAltura: '6\'-8"' });
  await incluir('as-siding', 'Siding (elevations)', {}, ['Windows W1', 'Windows W2', 'Entry door D1'], 'measure-add-siding');
  await painel('Siding (elevations)').locator('.mz-cond-topo').click();
  for (const p of [[0, 0], [40, 0], [40, 9], [0, 9]]) await clicar(p, SUL);
  await clicar([0, 0], SUL);
  for (const p of [[0, 0], [28, 0], [28, 9], [14, 16], [0, 9]]) await clicar(p, LESTE);
  await clicar([0, 0], LESTE);
  await painel('Windows W1').locator('.mz-cond-topo').click();
  await clicar([16.5, 5], SUL); await clicar([32.5, 5], SUL);
  await painel('Entry door D1').locator('.mz-cond-topo').click();
  await clicar([7.5, 3.3], SUL);
  // a janela W2 da fachada leste, desenhada com a ferramenta Vão: conta e recorta o siding
  await page.click('[data-acao="mz-ferramenta"][data-ferramenta="vao"]');
  await clicar([4, 3], LESTE); await clicar([8, 7], LESTE);
  await page.waitForSelector('dialog select[name="contagem"]');
  await page.selectOption('dialog select[name="contagem"]', { label: 'Windows W2 · 4\'-0" × 4\'-0"' });
  await foto(page, 'measure-opening-dialog', 'dialog[open]');
  await confirmar();
  await page.waitForTimeout(400);
  await foto(page, 'measure-viewer-elevations');

  // projeto: quantidades, materiais e mão de obra, rastro do cálculo
  await como(page, 'u-tom', '#/measure/projeto/pj-casa');
  await page.waitForSelector('.tabela-quantidades');
  await foto(page, 'measure-project');
  await page.addStyleTag({ content: '.topo { position: static !important; }' }); // o topo fixo não cobre os recortes
  await foto(page, 'measure-quantities', '.tabela-quantidades');
  const osb = page.locator('#mz-materiais .mz-item').filter({ has: page.locator('.mz-item-nome b', { hasText: 'OSB' }) }).first();
  await osb.locator('summary').click();
  await page.waitForTimeout(200);
  await foto(page, 'measure-materials', '#mz-materiais');
  await foto(page, 'measure-calc-trace', '#mz-materiais .mz-item[open]');

  // catálogo
  await como(page, 'u-tom', '#/measure/itens');
  await foto(page, 'measure-items');
  await como(page, 'u-tom', '#/measure/assemblies');
  await foto(page, 'measure-assemblies');
  await como(page, 'u-tom', '#/measure/assembly/as-parede');
  await foto(page, 'measure-assembly-editor');
  await como(page, 'u-tom', '#/measure/precos');
  await foto(page, 'measure-prices');

  // relatórios
  await como(page, 'u-tom', '#/measure/projeto/pj-casa/cotacao');
  await page.waitForSelector('.cot-fornecedor');
  await foto(page, 'measure-quote-list');
  const pdfCot = page.locator('.cot-fornecedor a:has-text("PDF")').first();
  if (await pdfCot.count()) { await pdfCot.click(); await page.waitForSelector('.doc'); await page.waitForTimeout(500); await foto(page, 'measure-quote-pdf'); }
  await como(page, 'u-tom', '#/measure/projeto/pj-casa/proposta');
  await page.waitForSelector('#form-proposta');
  await foto(page, 'measure-proposal');
  await como(page, 'u-tom', '#/measure/projeto/pj-casa/proposta/imprimir');
  await page.waitForTimeout(800);
  await foto(page, 'measure-proposal-pdf');

  // typicals
  await abrirFolha('fl-th-a101');
  await escala([0, 31], [40, 31], PLANTA, '40\'');
  await incluir('as-parede', 'Exterior walls', { altura: '9\'-0"' });
  for (const p of [[0, 0], [40, 0], [40, 28], [0, 28], [0, 0]]) await clicar(p);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  await foto(page, 'measure-typical-sheet');
  await como(page, 'u-tom', '#/measure/projeto/pj-townhouses');
  await foto(page, 'measure-typicals-project');
  await ctx.close();
}

await browser.close();
console.log(feitas + ' capturas em portal/img/');
