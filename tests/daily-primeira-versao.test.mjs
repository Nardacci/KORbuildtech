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
await p.selectOption('#pj-situacao', 'ganha');
await p.click('[data-acao="mz-salvar-projeto"]');
await p.waitForTimeout(600);
await ir('#/daily/obras', 'main');
t = await texto();
verificar(t.includes('Garagem Pereira'), 'marcado como Ganha, o projeto aparece no Daily sem ninguém cadastrar obra', t.slice(0, 200));
await p.locator('.cartao-obra:has-text("Garagem Pereira")').click();
await p.waitForSelector('.obra-resumo');
t = await texto();
verificar(t.includes('Bow') && await p.locator('a[href="#/measure/projeto/' + id + '"]').count() >= 1 && !/Editar a obra|Nova obra/.test(t), 'a página do projeto no Daily mostra o resumo e o atalho "Abrir o projeto"', t.slice(0, 300));

console.log('RDO do projeto (quem preenche)');
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-jose'));
await ir('#/daily/campo', 'main');
t = await texto();
verificar(/Seus projetos/i.test(t) && t.includes('Garagem Pereira'), 'o campo lista "Seus projetos" com o projeto ganho', t.slice(0, 900));
await p.locator('.cartao-obra:has-text("Garagem Pereira")').click();
await p.waitForSelector('[data-acao="novo-rdo"]');
await p.click('[data-acao="novo-rdo"]');
await p.waitForTimeout(800);
verificar(/#\/daily\/campo\/rdo\//.test(p.url()) && await p.locator('#s-clima').count() === 1, 'o RDO do projeto abre com as seções de sempre', p.url());
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));

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
