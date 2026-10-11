/* KORbuild — teste da hierarquia SaaS (docs/saas.md): construtora → prestadoras → funcionários, em português.
 * Cada empresa cadastra os próprios funcionários; a prestadora registra o ponto dos dela e vê custos;
 * a construtora vê as prestadoras da obra só em horas e pessoas, e o diário traz a equipe por empresa.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/saas.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'http://localhost:8123/') + '?demo';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, geolocation: { latitude: 43.2081, longitude: -71.5376, accuracy: 9 }, permissions: ['geolocation'] });
await context.addInitScript(() => { try { if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* sem armazenamento */ } });
await context.route('https://api.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [], weather_code: [], precipitation: [], temperature_2m: [] } } }));
await context.route(/fonts\.|tile\.openstreetmap/, (r) => r.abort());
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T10:00:00')); // quarta-feira
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

const comoUsuario = async (id, hash) => {
  await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id);
  await page.goto('about:blank');
  await page.goto(BASE + hash);
  await page.waitForTimeout(350);
};
const texto = (sel) => page.locator(sel).first().innerText();
const banco = () => page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')));

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });

console.log('Cada empresa cadastra os próprios funcionários');
await comoUsuario('u-tom', '#/settings/funcionarios');
let aviso = await texto('.aviso-empresa');
verificar(aviso.includes('Northfield Framing & Siding'), 'a lista de funcionários da prestadora diz de quem são');
verificar(await page.locator('.tabela-funcionarios tbody tr').count() === 4, 'a prestadora vê só os 4 funcionários dela');
verificar(!(await page.content()).includes('Carlos Mendes'), 'nenhum funcionário da construtora aparece para a prestadora');
await comoUsuario('u-tom', '#/settings/funcionario/f-kevin');
verificar((await texto('.dados-func')).includes('Northfield Framing & Siding'), 'o cadastro mostra a empresa (empregador)');
await comoUsuario('u-tom', '#/settings/funcionario/novo');
verificar((await texto('.valor-fixo')).includes('Northfield Framing & Siding'), 'o novo funcionário fica na conta da própria empresa (campo fixo)');
await comoUsuario('u-ana', '#/settings/funcionarios');
aviso = await texto('.aviso-empresa');
verificar(aviso.includes('Construtora Exemplo'), 'a construtora vê os funcionários dela');
verificar(!(await page.content()).includes('Kevin Dunn'), 'nenhum funcionário da prestadora aparece para a construtora');

console.log('A prestadora registra o ponto dos dela e vê tudo, inclusive o custo');
const b = await banco();
const pr = b.empresas['prestadora-exemplo'].crew;
verificar(pr.batidas.length > 40 && pr.batidas.every((x) => x.obraId === 'nf-jardim' && x.registradoPor === 'u-jose'), 'a equipe do José tem batidas na obra da prestadora, feitas pelo José');
verificar(pr.aprovacoes.length === 4 && pr.historico.length > 0 && pr.orcamentos['nf-jardim'], 'semana anterior aprovada, histórico e orçamento de mão de obra');
await comoUsuario('u-tom', '#/crew/agora');
verificar((await page.locator('main').innerText()).includes('Kevin Dunn'), 'Tom vê em "Agora" quem da equipe dele está na obra');
await comoUsuario('u-tom', '#/crew/custos');
verificar(/\$|US\$/.test(await page.locator('main').innerText()), 'Tom vê o custo da mão de obra (valores)');
await comoUsuario('u-luis', '#/crew/meu');
verificar(!/\$/.test(await page.locator('main').innerText()), 'o funcionário (Luis) só registra e vê horas, nunca valores');

console.log('A construtora vê as prestadoras da obra, sem valores');
await comoUsuario('u-ana', '#/daily/obras/jardim');
const quadro = await texto('.prestadoras-obra');
verificar(quadro.includes('Northfield Framing & Siding'), 'a obra da construtora mostra a prestadora ligada');
verificar(/Na obra agora\s*4/.test(quadro), '4 pessoas da prestadora na obra agora');
verificar(quadro.includes('Carpinteiro') && quadro.includes('2 pessoas'), 'horas e pessoas por função');
verificar(!/\$/.test(quadro) && !quadro.includes('Kevin'), 'sem valores e sem nomes da prestadora');
await comoUsuario('u-ana', '#/daily/obras/atlantico');
verificar(await page.locator('.prestadoras-obra').count() === 0, 'obra sem prestadora ligada não mostra o quadro');

console.log('O diário traz a equipe por empresa');
await comoUsuario('u-carlos', '#/daily/campo/obra/jardim');
await page.locator('[data-acao="novo-rdo"][data-obra="jardim"]').first().click();
await page.waitForTimeout(400);
let r = (await banco()).empresas['construtora-exemplo'].rdos.find((x) => x.obraId === 'jardim' && x.status === 'rascunho');
verificar(r && r.equipe.some((e) => e.empresa === 'Northfield Framing & Siding' && e.funcao === 'Carpinteiro' && e.presentes === 2), 'o RDO novo já traz a equipe da prestadora pelo ponto dela');
verificar((await texto('#s-equipe .tabela-grupo')).includes('Northfield Framing & Siding'), 'a equipe aparece agrupada por empresa');
await page.locator('#s-equipe details.equipe-prestadora summary').click();
await page.selectOption('#equipe-prest-empresa', { label: 'Bayside Drywall' });
await page.fill('#equipe-prest-funcao', 'Drywall');
await page.fill('#equipe-prest-qtd', '3');
await page.click('[data-acao="equipe-prestadora"]');
await page.waitForTimeout(300);
r = (await banco()).empresas['construtora-exemplo'].rdos.find((x) => x.id === r.id);
verificar(r.equipe.some((e) => e.empresa === 'Bayside Drywall' && e.presentes === 3 && !e.empresaId), 'equipe de prestadora sem KORbuild lançada à mão');
await page.click('[data-acao="equipe-do-ponto"]');
await page.waitForTimeout(300);
r = (await banco()).empresas['construtora-exemplo'].rdos.find((x) => x.id === r.id);
verificar(r.equipe.some((e) => e.empresa === 'Bayside Drywall'), 'atualizar pelo ponto mantém a prestadora lançada à mão');
// a mesma peça serve para a tela, o PDF e o link do cliente
const rel = await page.evaluate(async (id) => {
  const { htmlRelatorio } = await import('./js/relatorio.js');
  const { estado } = await import('./js/armazem.js');
  const r = estado().rdos.find((x) => x.id === id);
  const div = document.createElement('div');
  div.innerHTML = htmlRelatorio(r, estado().obras.find((o) => o.id === r.obraId));
  return div.innerText || div.textContent;
}, r.id);
verificar(rel.includes('Northfield Framing & Siding · prestadora') && rel.includes('Bayside Drywall · prestadora') && rel.includes('Construtora Exemplo'), 'o relatório (tela, PDF e link) separa a mão de obra por empresa');

verificar(!erros.length, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
