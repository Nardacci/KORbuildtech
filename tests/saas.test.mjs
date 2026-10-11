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
verificar(!(await page.content()).includes('Carlos Mendes'), 'nenhum funcionário de outra empresa aparece para a prestadora');
await comoUsuario('u-tom', '#/settings/funcionario/f-kevin');
verificar((await texto('.dados-func')).includes('Northfield Framing & Siding'), 'o cadastro mostra a empresa (empregador)');
await comoUsuario('u-tom', '#/settings/funcionario/novo');
verificar((await texto('.valor-fixo')).includes('Northfield Framing & Siding'), 'o novo funcionário fica na conta da própria empresa (campo fixo)');
await comoUsuario('u-ana', '#/settings/funcionarios');
aviso = await texto('.aviso-empresa');
verificar(aviso.includes('Construtora Exemplo'), 'a construtora vê os funcionários dela');
await comoUsuario('u-sandra', '#/settings/funcionarios');
verificar((await texto('.aviso-empresa')).includes('Ridgeline') && (await page.content()).includes('Carlos Mendes'), 'a Ridgeline vê os funcionários dela (Carlos e a equipe)');
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

console.log('A construtora gerencia e não executa (HS-09)');
await comoUsuario('u-ana', '#/inicio');
verificar(await page.locator('.modulos .modulo-crew').count() === 0 && await page.locator('.modulos .modulo-measure').count() === 0, 'a construtora não tem Crew nem Measure');
await comoUsuario('u-ana', '#/daily/campo');
verificar(page.url().endsWith('#/daily/painel'), 'a construtora não preenche diário: o Daily abre no painel');
verificar((await texto('main')).includes('Os diários são feitos pelas prestadoras'), 'o painel explica de onde vêm os diários');
await comoUsuario('u-ana', '#/settings/funcionarios');
verificar(await page.locator('nav a[href="#/settings/encargos"]').count() === 0 && await page.locator('nav a[href="#/settings/regras"]').count() === 0, 'sem encargos nem jornada no Settings da construtora (são do ponto)');
await comoUsuario('u-ana', '#/settings/obra/nova');
verificar(await page.locator('#ob-responsavelId').count() === 0 && await page.locator('#ob-modeloId').count() === 0, 'obra nova da construtora: sem responsável pelo diário e sem modelo de cronograma (HS-12)');
await comoUsuario('u-ana', '#/settings/obras');
verificar((await texto('.tabela-obras')).includes('Ridgeline Concrete & Masonry, Northfield Framing & Siding'), 'a lista de obras mostra as prestadoras de cada obra');
await comoUsuario('u-ana', '#/settings/funcionarios');
verificar(await page.locator('.tabela-funcionarios tbody tr').count() === 2 && !(await texto('.tabela-funcionarios')).includes('Carlos Mendes'), 'funcionários da construtora: só a gestão (Ana e Laura)');

console.log('Visão gerencial: tudo das prestadoras, menos valores (HS-10)');
await comoUsuario('u-ana', '#/daily/obras/jardim');
const quadro = await texto('.prestadoras-obra');
verificar(quadro.includes('Northfield Framing & Siding') && quadro.includes('Ridgeline Concrete & Masonry'), 'a obra mostra as duas prestadoras');
verificar(/Na obra agora\s*4/.test(quadro), '4 pessoas da Northfield na obra agora');
verificar(quadro.includes('Kevin Dunn') && quadro.includes('Carpinteiro') && quadro.includes('na obra'), 'nomes, função e situação de cada pessoa');
verificar(!/\$/.test(quadro), 'sem valores (salário, encargos e custo ficam com a prestadora)');
await comoUsuario('u-ana', '#/daily/obras/atlantico');
const quadro2 = await texto('.prestadoras-obra');
verificar(quadro2.includes('Ridgeline Concrete & Masonry') && !quadro2.includes('Northfield') && quadro2.includes('Roberto Lima'), 'no Atlântico, só a Ridgeline, com a equipe do Roberto');

console.log('Diários: a construtora aprova (HS-11); obra direta, a prestadora aprova (HS-13)');
await comoUsuario('u-ana', '#/daily/aprovacoes');
let fila = await texto('.fila');
verificar(fila.includes('Ridgeline Concrete & Masonry') && fila.includes('Northfield Framing & Siding'), 'a fila da construtora tem os diários das duas prestadoras');
verificar(!fila.includes('Thompson'), 'o diário da obra direta da Northfield não vai para a construtora');
await comoUsuario('u-ana', '#/daily/painel/rdo/rdo-nf-jardim-m1');
await page.click('[data-acao="aprovar"]');
await page.click('dialog button:has-text("Aprovar e lacrar")');
await page.waitForSelector('.codigo.grande');
const codigo = (await texto('.codigo.grande')).trim();
let nf = (await banco()).empresas['prestadora-exemplo'].rdos.find((x) => x.id === 'rdo-nf-jardim-m1');
verificar(nf.status === 'aprovado' && nf.aprovadoPorEmpresa === 'Construtora Exemplo' && nf.codigo === codigo, 'aprovado pela construtora, lacrado na conta da prestadora');
await comoUsuario('u-jose', '#/daily/campo/rdo/rdo-nf-jardim-m1');
verificar((await texto('main')).includes('Ana Ribeiro (Construtora Exemplo)'), 'o encarregado da prestadora vê quem aprovou e de qual empresa');
await comoUsuario('u-tom', '#/daily/painel/rdo/rdo-nf-thompson-m1');
verificar(await page.locator('[data-acao="aprovar"]').count() === 1, 'na obra direta com o dono, a própria prestadora aprova (HS-13)');
await page.evaluate(() => localStorage.removeItem('kbt.sessao'));
await page.goto('about:blank');
await page.goto(BASE + '#/cliente/' + codigo);
await page.waitForFunction(() => /Documento autêntico/.test((document.getElementById('verificacao') || {}).textContent || ''));
verificar((await texto('.cliente-topo')).includes('Northfield Framing & Siding'), 'o link do cliente abre o diário da prestadora aprovado pela construtora');

console.log('Cada prestadora registra a própria equipe no diário');
await comoUsuario('u-carlos', '#/daily/campo/obra/jardim');
await page.locator('[data-acao="novo-rdo"][data-obra="jardim"]').first().click();
await page.waitForTimeout(400);
let r = (await banco()).empresas['prestadora-estrutura'].rdos.find((x) => x.obraId === 'jardim' && x.status === 'rascunho');
verificar(r && !r.equipe.some((e) => e.empresa), 'o diário da Ridgeline não traz a equipe da Northfield (cada uma faz o seu)');
await page.locator('#s-equipe details.equipe-prestadora summary').click();
await page.fill('#equipe-prest-outra', 'Bayside Drywall');
await page.fill('#equipe-prest-funcao', 'Drywall');
await page.fill('#equipe-prest-qtd', '3');
await page.click('[data-acao="equipe-prestadora"]');
await page.waitForTimeout(300);
r = (await banco()).empresas['prestadora-estrutura'].rdos.find((x) => x.id === r.id);
verificar(r.equipe.some((e) => e.empresa === 'Bayside Drywall' && e.presentes === 3 && !e.empresaId), 'subcontratada sem KORbuild lançada à mão');
verificar((await page.locator('#s-equipe .tabela-grupo').allInnerTexts()).some((t) => t.includes('Bayside Drywall')), 'a equipe aparece agrupada por empresa');
const rel = await page.evaluate(async (id) => {
  const { htmlRelatorio } = await import('./js/relatorio.js');
  const { estado } = await import('./js/armazem.js');
  const x = estado().rdos.find((y) => y.id === id);
  const div = document.createElement('div');
  div.innerHTML = htmlRelatorio(x, estado().obras.find((o) => o.id === x.obraId));
  return div.innerText || div.textContent;
}, r.id);
verificar(rel.includes('Bayside Drywall · prestadora') && rel.includes('Ridgeline Concrete & Masonry'), 'o relatório (tela, PDF e link) separa a mão de obra por empresa');

verificar(!erros.length, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
