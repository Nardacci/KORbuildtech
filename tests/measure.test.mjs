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

// Coordenadas dos desenhos (em pés) → ponto na tela. Cada desenho tem a sua origem na página (points) e a sua escala
// (tools/gerar-planta.py): planta e fachadas em 1/4" = 1'-0" (18 points por pé), corte em 3/8" = 1'-0" (27 points por pé).
const PLANTA = { x0: 110, y0: 190, k: 18 }, SUL = { x0: 110, y0: 470, k: 18 }, LESTE = { x0: 110, y0: 90, k: 18 }, CORTE = { x0: 150, y0: 240, k: 27 };
async function naTela(pes, o = PLANTA) {
  const box = await page.locator('#mz-desenho').boundingBox();
  const zoom = box.width / 1224;
  return { x: box.x + (o.x0 + pes[0] * o.k) * zoom, y: box.y + (792 - (o.y0 + pes[1] * o.k)) * zoom };
}
async function clicar(pes, opcoes, o) { const p = await naTela(pes, o); await page.mouse.click(p.x, p.y, opcoes); }
const textoDe = (sel) => page.locator(sel).first().textContent();
const toast = () => page.waitForFunction(() => (document.getElementById('toast') || {}).textContent, null).then(() => page.textContent('#toast'));
// botão de diálogo: espera o diálogo fechar antes de seguir (os cliques na planta não passam por cima dele)
const noDialogo = async (texto) => { await page.click('dialog button:has-text("' + texto + '")'); await page.waitForSelector('dialog', { state: 'detached' }); };
// O clique cai em pixel inteiro: na escala da tela, cada ponto pode errar alguns centésimos de pé.
// As medidas são conferidas com tolerância (como o estimador confere: zoom maior = mais precisão).
const numeroDe = (txt, unidade) => { const m = new RegExp('([\\d.]+(?:,\\d+)?) ' + unidade).exec(txt); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN; };
const perto = (v, alvo, tol) => Math.abs(v - alvo) <= alvo * tol;
const painel = (nome) => page.locator('.mz-cond').filter({ has: page.locator('.mz-cond-topo b', { hasText: nome }) });

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

console.log('Assembly aplicado na condição');
await page.click('[data-acao="mz-aplicar-assembly"]');
await page.selectOption('dialog select[name="assembly"]', 'as-laje');
await noDialogo('Aplicar');
verificar((await painel('Laje de concreto').textContent()).includes('Laje de concreto com tela'), 'assembly aplicado na condição pelo visor');
const areaLaje = numeroDe(laje, 'sq ft');

console.log('Quantidades do projeto');
await page.click('a.voltar');
await page.waitForSelector('.tabela-quantidades');
const qt = await textoDe('.tabela-quantidades');
verificar(qt.includes('lin ft') && qt.includes('3 each') && qt.includes('cu yd') && qt.includes('Superfície'), 'tabela de quantidades do projeto');
console.log('Materiais e mão de obra (assemblies + fórmulas)');
const mat = page.locator('#mz-materiais');
const itemDe = (nome) => mat.locator('.mz-item').filter({ has: page.locator('.mz-item-nome b', { hasText: nome }) });
const qtdDe = async (nome) => { const t = await itemDe(nome).locator('.mz-item-qtd').textContent(); return Number(t.replace(/[^\d,]/g, '').replace(',', '.')); };
const osb = await qtdDe('OSB 7/16');
const osbEsperado = Math.ceil(perimetro * 9 / 32 * 1.1 - 1e-9);
verificar(Math.abs(osb - osbEsperado) <= 1, 'OSB = superfície ÷ 32 + 10%, para cima: ' + osb + ' chapas (esperado ≈ ' + osbEsperado + ')');
verificar(Math.abs(await qtdDe('Montante 2x6') - Math.ceil(perimetro * 12 / 16 * 1.15)) <= 1, 'montantes 2x6 a cada 16" + 15%');
verificar(await qtdDe('Porta interna 30') === 3 && await qtdDe('Fechadura de passagem') === 3 && await qtdDe('Guarnição 7') === 15, 'portas: 3 portas, 3 fechaduras e 15 guarnições (3 × 2 lados × (2 × 6\'-8" + 2\'-6") ÷ 7\' + 10%, para cima)');
const conc = await qtdDe('Concreto usinado');
verificar(conc * 2 === Math.round(conc * 2) && conc >= areaLaje * 4 / 12 / 27 * 1.05 && conc < areaLaje * 4 / 12 / 27 * 1.05 + 0.5, 'concreto: volume + 5%, pedido de meia em meia jarda (' + conc + ' cu yd)');
verificar((await mat.textContent()).includes('Mão de obra estimada'), 'total de horas de mão de obra');
await itemDe('OSB 7/16').locator('summary').click();
const rastroOsb = await itemDe('OSB 7/16').locator('.mz-rastro').textContent();
verificar(rastroOsb.includes('SurfaceArea / 32') && rastroOsb.includes('+10%') && rastroOsb.includes('para cima') && rastroOsb.includes('Paredes externas'), 'rastro do cálculo: condição, fórmula, perda e arredondamento');
const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="mz-csv"]')]);
verificar(download.suggestedFilename() === 'korbuild-measure-quantidades.csv', 'exporta as quantidades com o cálculo em CSV');
await print('2-projeto');
await page.locator('#mz-materiais').screenshot({ path: (SAIDA || '/tmp') + '/measure-2b-materiais.png' }).catch(() => {});

console.log('Fachadas: siding e vãos (janelas e porta)');
await page.click('a:has-text("A-201 · Elevations")');
await page.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 20000 });
await page.click('[data-acao="mz-escala"]');
await page.selectOption('dialog select[name="razao"]', '48');
await noDialogo('Usar esta escala');
await clicar([0, -2.5], {}, SUL); await clicar([40, -2.5], {}, SUL); // cota de 40'-0" da fachada sul
await page.fill('dialog input[name="real"]', '40\'');
await noDialogo('Conferir');
verificar((await toast()).includes('Escala conferida'), 'fachada A-201: escala 1/4" conferida na cota de 40\'-0"');
await painel('Siding (fachadas)').locator('.mz-cond-topo').click();
for (const p of [[0, 0], [40, 0], [40, 9], [0, 9]]) await clicar(p, {}, SUL);
await clicar([0, 0], {}, SUL);
for (const p of [[0, 0], [28, 0], [28, 9], [14, 16], [0, 9]]) await clicar(p, {}, LESTE); // a empena entra no siding
await clicar([0, 0], {}, LESTE);
const sidingBruto = numeroDe(await painel('Siding (fachadas)').locator('.mz-total').textContent(), 'sq ft');
verificar(perto(sidingBruto, 710, 0.01), 'siding medido na fachada: sul 40\' × 9\' + leste 28\' × 9\' com empena (+98) ≈ 710 sq ft (' + sidingBruto + ')');
await painel('Janelas W1').locator('.mz-cond-topo').click();
await clicar([16.5, 5], {}, SUL); await clicar([32.5, 5], {}, SUL);
await painel('Janelas W2').locator('.mz-cond-topo').click();
await clicar([6, 5], {}, LESTE);
await painel('Porta de entrada D1').locator('.mz-cond-topo').click();
await clicar([9.5, 3], {}, SUL);
verificar((await painel('Janelas W1').textContent()).includes('2 each') && (await painel('Porta de entrada D1').textContent()).includes('vão 3\'-0" × 6\'-8"'), 'janelas e porta contadas na fachada, com o tamanho do vão');
await print('5-fachadas');
await page.click('a.voltar');
await page.waitForSelector('#mz-materiais');
// vãos: W1 2 × 5' × 4' = 40, W2 1 × 4' × 4' = 16, D1 1 × 3' × 6'-8" = 20 → 76 sq ft; perímetros 36 + 16 + 19,33 = 71,33 lin ft
const vaosArea = 76, vaosPerim = 36 + 16 + 2 * (3 + 80 / 12);
verificar(Math.abs(await qtdDe('Siding vinil') - Math.ceil((sidingBruto - vaosArea) / 100 * 1.1)) <= 1, 'siding: (área − vãos) ÷ 100 + 10% = ' + await qtdDe('Siding vinil') + ' squares');
verificar(await qtdDe('J-channel') === Math.ceil(vaosPerim / 12.5 * 1.1 - 1e-9), 'J-channel pelo perímetro dos vãos: ' + await qtdDe('J-channel') + ' peças');
verificar(await qtdDe('Guarnição externa PVC') === 4 + 2 + 2, 'guarnição externa: W1 4 + W2 2 + porta (3 lados) 2 = 8 peças');
verificar(await qtdDe('Fita de flashing') === 2 && await qtdDe('Janela vinil 5') === 2 && await qtdDe('Janela vinil 4') === 1, 'janelas: 2 W1, 1 W2 e 2 rolos de flashing');
verificar(Math.abs(await qtdDe('OSB 7/16') - Math.ceil((perimetro * 9 - vaosArea) / 32 * 1.1 - 1e-9)) <= 1, 'parede: o OSB já desconta os vãos (NetSurfaceArea)');
await itemDe('Siding vinil').locator('summary').click();
const rastroSiding = await itemDe('Siding vinil').locator('.mz-rastro').textContent();
verificar(rastroSiding.includes('NetArea / 100') && rastroSiding.includes('OpeningArea = 76'), 'rastro do siding mostra a área líquida e os vãos descontados');
await print('6-materiais-vaos');

console.log('Corte em outra escala');
await page.click('a:has-text("A-301 · Section A")');
await page.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 20000 });
await page.click('[data-acao="mz-escala"]');
await page.selectOption('dialog select[name="razao"]', '32');
await noDialogo('Usar esta escala');
await clicar([0, -6], {}, CORTE); await clicar([28, -6], {}, CORTE);
await page.fill('dialog input[name="real"]', '28\'');
await noDialogo('Conferir');
verificar((await toast()).includes('Escala conferida'), 'corte A-301 em 3/8" = 1\'-0" (escala diferente na mesma planta), conferido na cota de 28\'-0"');
await page.click('a.voltar');
await page.waitForSelector('.tabela-quantidades');
verificar((await textoDe('.pagina')).includes('3/8" = 1\'-0"'), 'cada folha guarda a sua escala');

console.log('Itens e assemblies');
await page.click('.lateral-item:has-text("Itens")');
await page.waitForSelector('.tabela-itens');
await page.click('[data-acao="mz-item"][data-id=""]');
await page.fill('dialog input[name="nome"]', 'Drywall 5/8" tipo X 4\'×8\'');
await page.fill('dialog input[name="codigo"]', 'DW-58X');
await page.fill('dialog input[name="unidade"]', 'chapa');
await page.fill('dialog input[name="etapa"]', '09 29 00 · Gypsum board');
await noDialogo('Criar item');
verificar((await textoDe('.pagina')).includes('Drywall 5/8" tipo X'), 'novo item no catálogo');
await page.click('.lateral-item:has-text("Assemblies")');
await page.waitForSelector('.mz-assemblies');
await page.click('a:has-text("Novo assembly")');
await page.waitForSelector('#form-assembly');
await page.fill('#as-nome', 'Forro de drywall');
await page.selectOption('#as-tipo', 'area');
const l1 = page.locator('.mz-linha').nth(0);
await l1.locator('[name="item"]').selectOption({ label: 'Drywall 5/8" tipo X 4\'×8\' (chapa)' });
await l1.locator('[name="formula"]').fill('MeasuredArea / 32');
await l1.locator('[name="perda"]').fill('10');
verificar((await l1.locator('.mz-teste').textContent()).includes('31,25 → 34,38 → 35 chapa'), 'teste ao vivo: 1.000 sq ft ÷ 32 = 31,25 → +10% = 34,38 → 35 chapas');
await page.click('[data-acao="mz-nova-linha"]');
const l2 = page.locator('.mz-linha').nth(1);
await l2.locator('[name="item"]').selectOption('it-mo-drywall');
await l2.locator('[name="formula"]').fill('import({}, {})');
verificar((await l2.locator('.mz-teste').textContent()).includes('não permitida'), 'fórmula insegura é recusada já na digitação');
await page.click('[data-acao="mz-salvar-assembly"]');
verificar((await toast()).includes('Linha 2'), 'não salva com fórmula recusada, e diz qual linha');
await l2.locator('[name="formula"]').fill('MeasuredArea * 0.025');
await l2.locator('[name="passo"]').selectOption('0');
await print('4-assembly');
await page.click('[data-acao="mz-salvar-assembly"]');
await page.waitForSelector('.mz-assemblies');
verificar((await textoDe('.mz-assemblies')).includes('Forro de drywall'), 'novo assembly salvo');

console.log('Permissão do catálogo');
await como('u-marcia', '#/measure/assemblies');
await page.waitForSelector('.mz-assemblies');
verificar(await page.locator('a:has-text("Novo assembly")').count() === 0, 'gestor (sem "Itens e assemblies") não cria assembly');
await page.click('.mz-assembly:has-text("Piso LVP")');
await page.waitForSelector('#form-assembly');
verificar(await page.isDisabled('.mz-linha [name="formula"]'), 'gestor vê as fórmulas, mas não edita');
await como('u-ana', '#/measure');
await page.waitForSelector('.tabela-quantidades');

console.log('Enviar PDF e calibrar por uma cota');
await page.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
await page.waitForFunction(() => /3 folhas adicionadas/.test((document.getElementById('toast') || {}).textContent || ''));
verificar(true, 'PDF de 3 páginas vira 3 folhas');
await page.click('a:has-text("casa-modelo · página 1")');
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
