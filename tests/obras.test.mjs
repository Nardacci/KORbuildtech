/* KORbuild — teste do cadastro de obras e dos modelos de etapas (docs/obras.md), em português.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/obras.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8123/';
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
await page.clock.setFixedTime(new Date('2026-10-07T10:00:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));

const comoUsuario = async (id, hash) => {
  await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id);
  await page.goto(BASE + hash);
  await page.waitForTimeout(350);
};
const toast = async () => { await page.waitForSelector('#toast.on'); const t = await page.textContent('#toast'); await page.evaluate(() => document.getElementById('toast').classList.remove('on')); return t; };
const banco = () => page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')));
const prestadora = async () => (await banco()).empresas['prestadora-exemplo'];

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });

console.log('Onde fica');
await comoUsuario('u-tom', '#/daily/obras');
verificar(await page.locator('a[href="#/settings/obra/nova"]').count() === 1, 'a lista de obras do Daily tem "Nova obra" (OB-01)');
await comoUsuario('u-tom', '#/settings/obras');
verificar((await page.textContent('main')).includes('Residencial Jardim das Flores · framing e siding'), 'Settings › Obras lista as obras da empresa');
verificar(await page.locator('nav a[href="#/settings/obras"]').count() >= 1, 'Obras no menu do Settings');
await comoUsuario('u-jose', '#/daily');
verificar(await page.locator('a[href="#/settings/obra/nova"]').count() === 0, 'o encarregado não cadastra obra');

console.log('Modelos de etapas');
await comoUsuario('u-tom', '#/settings/modelos');
verificar((await page.textContent('main')).includes('Framing + siding (casa)'), 'a prestadora já tem modelos de exemplo');
await page.click('a[href="#/settings/modelo/novo"]');
await page.waitForSelector('#form-modelo');
await page.fill('#md-nome', 'Drywall (apartamento)');
await page.fill('#md-linhas [name="etapaNome"]', 'Hang');
await page.fill('#md-linhas [name="etapaPct"]', '50');
await page.click('[data-acao="modelo-nova-linha"]');
await page.locator('#md-linhas [name="etapaNome"]').nth(1).fill('Tape and finish');
await page.locator('#md-linhas [name="etapaPct"]').nth(1).fill('30');
verificar((await page.textContent('#md-soma')).includes('80'), 'a soma das partes aparece enquanto digita');
await page.click('[data-acao="modelo-salvar"]');
verificar((await toast()).includes('100%'), 'não salva modelo que não soma 100%');
await page.locator('#md-linhas [name="etapaPct"]').nth(1).fill('50');
await page.click('[data-acao="modelo-salvar"]');
await page.waitForTimeout(300);
verificar((await prestadora()).modelosCronograma.some((m) => m.nome === 'Drywall (apartamento)' && m.etapas.length === 2), 'modelo novo salvo');

console.log('Nova obra');
await comoUsuario('u-tom', '#/settings/obra/nova');
await page.waitForSelector('#form-obra');
verificar(await page.locator('#ob-modeloId option').count() === 4, 'o cadastro oferece os modelos (ou nenhum)');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('nome'), 'pede o nome');
await page.fill('#ob-nome', 'Casa Thompson · framing');
await page.selectOption('#ob-contratanteId', { index: 1 });
await page.fill('#ob-municipio', 'Concord');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('mapa'), 'pede o local no mapa (OB-03)');
await page.click('[data-acao="obra-aqui"]');
await page.waitForFunction(() => document.getElementById('ob-lat').value !== '');
verificar(Math.abs(Number(await page.inputValue('#ob-lat')) - 43.2081) < 0.001, '"Usar a localização atual" preenche latitude e longitude');
await page.fill('#ob-raio', '5000');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('Raio'), 'raio da cerca fora do limite é recusado');
await page.fill('#ob-raio', '120');
await page.fill('#ob-inicio', '2026-10-12');
await page.fill('#ob-prazo', '2026-12-18');
await page.selectOption('#ob-modeloId', await page.$eval('#ob-modeloId', (s) => [...s.options].find((o) => o.text.startsWith('Framing + siding')).value));
await page.waitForTimeout(200);
verificar(await page.locator('#ob-previa li').count() === 7, 'prévia das etapas do modelo com as datas');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('diário'), 'pede quem preenche o diário');
await page.selectOption('#ob-responsavelId', 'u-jose');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('Obra criada'), 'obra criada');
await page.waitForTimeout(300);
let p = await prestadora();
const nova = p.obras.find((o) => o.nome === 'Casa Thompson · framing');
verificar(nova && nova.cidade === 'Concord, NH' && nova.cerca.raio === 120 && nova.situacao === 'andamento', 'gravada com cidade, cerca e situação');
verificar(page.url().endsWith('#/daily/obras/' + nova.id), 'depois de criar, abre a obra no Daily');
const cr = p.cronogramas[nova.id];
verificar(cr && cr.etapas.length === 7 && cr.etapas[0].inicio === '2026-10-12' && cr.etapas[6].fim === '2026-12-18', 'o modelo virou 7 etapas entre o início e o prazo (OB-06)');
verificar(cr.etapas.every((e, i) => i === 0 || e.inicio > cr.etapas[i - 1].fim), 'etapas em sequência, sem sobrepor');
verificar(cr.bases.length === 1, 'primeira linha de base salva');
verificar((await page.textContent('main')).includes('Editar a obra'), 'a tela da obra tem "Editar a obra"');
verificar(p.settings.auditoria.some((a) => a.descricao.includes('Obra criada: Casa Thompson')), 'criação na auditoria (OB-05)');

console.log('Campo e situação');
await comoUsuario('u-jose', '#/daily/campo');
verificar((await page.textContent('main')).includes('Casa Thompson · framing'), 'o encarregado vê a obra nova no celular');
verificar(!(await page.textContent('main')).includes('Casa Thompson · framing · RDO atrasado'), 'a obra que ainda não começou não cobra diário');
await comoUsuario('u-tom', '#/settings/obra/' + nova.id);
await page.waitForSelector('#form-obra');
await page.selectOption('#ob-situacao', 'paralisada');
await page.click('[data-acao="obra-salvar"]');
await toast();
await comoUsuario('u-jose', '#/daily/campo');
verificar(!(await page.textContent('main')).includes('Casa Thompson'), 'obra paralisada sai do campo (OB-04)');
await comoUsuario('u-tom', '#/daily/obras');
verificar(!(await page.textContent('.grade-obras')).includes('Casa Thompson'), 'e sai da lista de obras em andamento');
await page.click('a[href="#/daily/obras/encerradas"]');
await page.waitForTimeout(250);
verificar((await page.textContent('main')).includes('Casa Thompson') && (await page.textContent('main')).includes('Paralisada'), 'aparece em "Paralisadas e concluídas"');
p = await prestadora();
verificar(p.settings.auditoria.some((a) => a.descricao.includes('Situação da obra Casa Thompson') && a.depois === 'Paralisada'), 'mudança de situação na auditoria');

console.log('Cronograma de obra sem etapas');
await comoUsuario('u-ana', '#/daily/obras/galpao/cronograma');
verificar(await page.locator('[data-acao="cr-modelo"]').count() === 1, 'obra sem etapas oferece "Começar com um modelo"');
await page.click('[data-acao="cr-modelo"]');
await page.waitForSelector('#cr-modelo-previa li');
await page.selectOption('#cr-modelo-id', await page.$eval('#cr-modelo-id', (s) => [...s.options].find((o) => o.text === 'Galpão').value));
await page.waitForTimeout(150);
verificar(await page.locator('#cr-modelo-previa li').count() === 6, 'prévia muda com o modelo escolhido');
await page.click('dialog button:has-text("Aplicar")');
await page.waitForSelector('.gantt');
verificar(await page.locator('.gantt-linha').count() === 6, 'modelo aplicado: Gantt com 6 etapas');

console.log('Measure: projeto ganho vira obra');
await comoUsuario('u-tom', '#/measure');
const ganho = (await prestadora()).measure.projetos.find((x) => x.situacao === 'ganha' && !x.obraId);
await comoUsuario('u-tom', '#/measure/projeto/' + ganho.id);
verificar(await page.locator('a[href="#/settings/obra/nova/' + ganho.id + '"]').count() === 1, 'projeto ganho mostra "Criar obra a partir deste projeto" (OB-07)');
await page.click('a[href="#/settings/obra/nova/' + ganho.id + '"]');
await page.waitForSelector('#form-obra');
verificar(await page.inputValue('#ob-nome') === ganho.nome && await page.inputValue('#ob-contratanteId') === ganho.contratanteId && await page.inputValue('#ob-municipio') === ganho.cidade, 'o cadastro vem preenchido com o projeto');
await page.fill('#ob-lat', '43.2');
await page.fill('#ob-lon', '-71.53');
await page.selectOption('#ob-responsavelId', 'u-jose');
await page.selectOption('#ob-modeloId', '');
await page.click('[data-acao="obra-salvar"]');
verificar((await toast()).includes('Obra criada'), 'obra criada a partir do projeto');
await page.waitForTimeout(300);
p = await prestadora();
const daObra = p.obras.find((o) => o.projetoId === ganho.id);
verificar(daObra && p.measure.projetos.find((x) => x.id === ganho.id).obraId === daObra.id, 'projeto e obra ficam ligados');
verificar(!p.cronogramas || !p.cronogramas[daObra.id], 'sem modelo, a obra nasce sem etapas');
await comoUsuario('u-tom', '#/measure/projeto/' + ganho.id);
verificar(await page.locator('a[href="#/settings/obra/nova/' + ganho.id + '"]').count() === 0 && await page.locator('a[href="#/daily/obras/' + daObra.id + '"]').count() === 1, 'o projeto passa a mostrar a obra, sem o botão');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
