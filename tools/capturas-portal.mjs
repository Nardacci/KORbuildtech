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

async function contexto(largura, quando = '2026-10-07T16:30:00') {
  const celular = largura < 600;
  const ctx = await browser.newContext({
    viewport: { width: largura, height: celular ? 844 : 860 }, deviceScaleFactor: celular ? 2 : 1.25,
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
  await como(page, 'u-ana', '#/inicio');
  await foto(page, 'modules-home');
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

/* ---------- Daily: escritório (computador, Ana, administradora) ---------- */
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
  await como(page, 'u-ana', '#/crew/agora');
  await foto(page, 'crew-now');
  await como(page, 'u-ana', '#/crew/timesheets/2026-09-28');
  await foto(page, 'crew-timesheets');
  // a semana de quem ainda espera aprovação (Roberto): ajustar e devolver ficam ali
  const semana = await page.$$eval('#conteudo tr', (linhas) => {
    const l = linhas.find((tr) => /Awaiting approval/.test(tr.textContent) && tr.querySelector('a[href^="#/crew/semana/"]'));
    return l ? l.querySelector('a[href^="#/crew/semana/"]').getAttribute('href') : null;
  });
  if (semana) {
    await como(page, 'u-ana', semana);
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
  await como(page, 'u-ana', '#/crew/agora');
  const dia = await page.$eval('#conteudo a[href^="#/crew/dia/"]', (a) => a.getAttribute('href')).catch(() => null);
  if (dia) {
    await como(page, 'u-ana', dia);
    await page.waitForTimeout(1500);
    await foto(page, 'crew-day-map');
  }
  await como(page, 'u-ana', '#/crew/custos');
  await foto(page, 'crew-costs-jobs');
  await page.click('[data-acao="crew-orcamento"]').catch(() => {});
  await page.waitForTimeout(500);
  if (await page.locator('dialog[open]').count()) { await foto(page, 'crew-budget-dialog', 'dialog[open]'); await page.keyboard.press('Escape'); }
  await como(page, 'u-ana', '#/crew/custos/mes/2026-10');
  await foto(page, 'crew-costs-month');
  await ctx.close();
}

await browser.close();
console.log(feitas + ' capturas em portal/img/');
