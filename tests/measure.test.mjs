/* KORbuild Measure — teste de ponta a ponta da medição de plantas (takeoff).
 * Uso: python3 -m http.server 8123 & node tests/measure.test.mjs [http://localhost:8123/]
 * Planta de exemplo: casa de 40'-0" × 28'-0" em 1/4" = 1'-0" (assets/plantas/casa-modelo-a101.pdf, tools/gerar-planta.py). */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8123/';
const SAIDA = process.env.PRINTS || '';
let falhas = 0, passos = 0;
function verificar(cond, texto) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T10:30:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
await context.route('https://api.open-meteo.com/**', (r) => r.abort());
await context.route('https://fonts.**', (r) => r.abort());
const print = async (nome) => { if (SAIDA) await page.screenshot({ path: SAIDA + '/measure-' + nome + '.png' }); };
const como = async (id, hash) => { await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id); await page.goto(BASE + hash); await page.reload(); };

// Coordenadas da planta (em pés, a partir do canto da casa) → ponto na tela.
// A casa começa em (110, 190) points na página; 1 pé = 18 points (1/4" = 1'-0"); o PDF tem 792 points de altura.
async function naTela(pes) {
  const box = await page.locator('#mz-desenho').boundingBox();
  const zoom = box.width / 1224;
  return { x: box.x + (110 + pes[0] * 18) * zoom, y: box.y + (792 - (190 + pes[1] * 18)) * zoom };
}
async function clicar(pes, opcoes) { const p = await naTela(pes); await page.mouse.click(p.x, p.y, opcoes); }
const textoDe = (sel) => page.locator(sel).first().textContent();
const toast = () => page.waitForFunction(() => (document.getElementById('toast') || {}).textContent, null).then(() => page.textContent('#toast'));
// botão de diálogo: espera o diálogo fechar antes de seguir (os cliques na planta não passam por cima dele)
const noDialogo = async (texto) => { await page.click('dialog button:has-text("' + texto + '")'); await page.waitForSelector('dialog', { state: 'detached' }); };
// O clique cai em pixel inteiro: na escala da tela, cada ponto pode errar alguns centésimos de pé.
// As medidas são conferidas com tolerância (como o estimador confere: zoom maior = mais precisão).
const numeroDe = (txt, unidade) => { const m = new RegExp('([\\d.]+(?:,\\d+)?) ' + unidade).exec(txt); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN; };
const perto = (v, alvo, tol) => Math.abs(v - alvo) <= alvo * tol;
const painel = (nome) => page.locator('.mz-cond', { hasText: nome });

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });

console.log('Módulo e permissões');
await como('u-ana', '#/inicio');
await page.waitForSelector('.modulos');
verificar((await textoDe('.modulos .modulo-measure')).includes('Protótipo'), 'Measure aparece na tela de módulos (protótipo)');
await page.click('.modulos .modulo-measure');
await page.waitForSelector('.tabela-quantidades');
verificar(page.url().includes('#/measure/projeto/pj-casa'), 'abre o projeto de exemplo');
verificar((await textoDe('.pagina')).includes('sem escala'), 'folha começa sem escala');

console.log('Escala da lista e conferência');
await page.click('a:has-text("A-101 · First Floor Plan")');
await page.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 20000 });
verificar((await page.isDisabled('[data-acao="mz-ferramenta"][data-ferramenta="medir"]')), 'sem escala, não dá para medir');
await page.click('[data-acao="mz-escala"]');
await page.selectOption('dialog select[name="razao"]', '48');
await noDialogo('Usar esta escala');
await clicar([0, 31]); await clicar([40, 31]); // cota de 40'-0" (em cima)
await page.fill('dialog input[name="real"]', '40\'-0"');
await noDialogo('Conferir');
verificar((await toast()).includes('Escala conferida'), 'conferência da escala 1/4" = 1\'-0" com a cota de 40\'-0"');
verificar((await textoDe('#mz-barra')).includes('conferida'), 'barra mostra a escala conferida');

console.log('Medição');
await painel('Paredes externas').locator('.mz-cond-topo').click();
for (const p of [[0, 0], [40, 0], [40, 28], [0, 28], [0, 0]]) await clicar(p);
await page.keyboard.press('Enter');
const paredes = await painel('Paredes externas').textContent();
const perimetro = numeroDe(paredes, 'lin ft');
verificar(perto(perimetro, 136, 0.005), 'perímetro externo ≈ 136 lin ft (' + perimetro + '; ' + paredes.match(/\d+'-[\d /]+"/)?.[0] + ')');
verificar(perto(numeroDe(paredes, 'sq ft'), 1224, 0.005), 'superfície das paredes ≈ 136 lin ft × 9\' = 1.224 sq ft');
await painel('Piso (LVP)').locator('.mz-cond-topo').click();
for (const p of [[0.5, 0.5], [39.5, 0.5], [39.5, 27.5], [0.5, 27.5]]) await clicar(p);
await clicar([0.5, 0.5]); // clicar no primeiro ponto fecha a área
const piso1 = numeroDe(await painel('Piso (LVP)').locator('.mz-total').textContent(), 'sq ft');
verificar(perto(piso1, 1053, 0.01), 'área interna ≈ 39\' × 27\' = 1.053 sq ft, fechando no primeiro ponto (' + piso1 + ')');
await painel('Piso (LVP)').locator('input[data-acao="mz-desconto"]').check();
for (const p of [[22, 12], [30, 12], [30, 18]]) await clicar(p);
const fim = await naTela([22, 18]);
await page.mouse.dblclick(fim.x, fim.y);
const piso2 = numeroDe(await painel('Piso (LVP)').locator('.mz-total').textContent(), 'sq ft');
verificar(perto(piso2, 1005, 0.01) && piso1 - piso2 >= 46 && piso1 - piso2 <= 50, 'desconto do banheiro (8\' × 6\' = 48 sq ft), concluído com duplo clique (' + piso2 + ')');
await painel('Portas internas').locator('.mz-cond-topo').click();
for (const p of [[22, 8.5], [27.5, 12], [32.5, 18]]) await clicar(p);
verificar((await painel('Portas internas').textContent()).includes('3 each'), 'contagem: 3 portas');
await print('1-medicao');

console.log('Zoom não muda a medida');
await page.click('[data-acao="mz-zoom"][data-passo="1"]');
await page.click('[data-acao="mz-zoom"][data-passo="1"]');
await painel('Paredes externas').locator('.mz-cond-topo').click();
verificar(numeroDe(await painel('Paredes externas').textContent(), 'lin ft') === perimetro, 'depois do zoom, o perímetro não muda (os pontos estão na página do PDF)');
await page.click('[data-acao="mz-zoom"][data-passo="0"]');

console.log('Nova condição com propriedades');
await page.click('[data-acao="mz-nova-condicao"]');
await page.fill('dialog input[name="nome"]', 'Laje de concreto');
await page.selectOption('dialog select[name="tipo"]', 'area');
await page.fill('dialog input[name="espessura"]', '4"');
await noDialogo('Criar condição');
for (const p of [[0, 0], [40, 0], [40, 28], [0, 28]]) await clicar(p);
await page.keyboard.press('Enter');
const laje = await painel('Laje de concreto').textContent();
verificar(perto(numeroDe(laje, 'sq ft'), 1120, 0.01) && perto(numeroDe(laje, 'cu yd'), 13.8, 0.015), 'laje ≈ 40\' × 28\' × 4" = 1.120 sq ft e 13,8 cu yd');

console.log('Quantidades do projeto');
await page.click('a.voltar');
await page.waitForSelector('.tabela-quantidades');
const qt = await textoDe('.tabela-quantidades');
verificar(qt.includes('lin ft') && qt.includes('3 each') && qt.includes('cu yd') && qt.includes('Superfície'), 'tabela de quantidades do projeto');
await print('2-projeto');

console.log('Enviar PDF e calibrar por uma cota');
await page.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo-a101.pdf');
await page.waitForFunction(() => /Folha adicionada/.test((document.getElementById('toast') || {}).textContent || ''));
await page.click('a:has-text("casa-modelo-a101")');
await page.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 20000 });
await page.click('[data-acao="mz-escala"]');
await noDialogo('Calibrar por uma cota');
await clicar([0, 31]); await clicar([40, 31], { modifiers: ['Shift'] });
await page.fill('dialog input[name="real"]', '40\'');
await noDialogo('Calibrar');
verificar((await toast()).includes('Escala calibrada'), 'calibração pela cota de 40\'');
await clicar([-3, 0]); await clicar([-3, 28]); // cota de 28'-0" (à esquerda)
await page.fill('dialog input[name="real"]', '28-0');
await noDialogo('Conferir');
verificar((await toast()).includes('Escala conferida'), 'conferência na outra direção (28\'-0")');
await print('3-calibrada');

console.log('Permissões');
await como('u-carlos', '#/measure');
await page.waitForSelector('.modulos');
verificar(page.url().endsWith('#/inicio') && await page.locator('.modulos .modulo-measure').count() === 0, 'encarregado não vê o Measure (sem a permissão)');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
await browser.close();
process.exit(falhas ? 1 : 0);
