/* KORbuild RDO — teste de ponta a ponta do roteiro da demonstração.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/demo.test.mjs [http://localhost:8123/]
 * Precisa do pacote "playwright" e de um Chromium. A API de clima é simulada no teste. */

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
const context = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
  geolocation: { latitude: -22.84571, longitude: -47.05612, accuracy: 8 }, permissions: ['geolocation'],
});
const page = await context.newPage();
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|ERR_TUNNEL|Failed to load resource/.test(m.text())) erros.push(m.text()); });

// Clima simulado: manhã de sol, tarde com chuva forte.
await context.route('https://api.open-meteo.com/**', (route) => {
  const time = [], weather_code = [], precipitation = [], temperature_2m = [];
  for (let h = 0; h < 24; h++) {
    time.push('2026-01-01T' + String(h).padStart(2, '0') + ':00');
    weather_code.push(h >= 13 && h <= 17 ? 63 : 0);
    precipitation.push(h >= 13 && h <= 17 ? 1.2 : 0);
    temperature_2m.push(18 + (h > 6 && h < 16 ? h - 6 : 0));
  }
  route.fulfill({ json: { hourly: { time, weather_code, precipitation, temperature_2m } } });
});
await context.route('https://fonts.**', (r) => r.abort());

const print = async (nome) => { if (SAIDA) await page.screenshot({ path: SAIDA + '/' + nome + '.png', fullPage: true }); };

console.log('Início');
await page.goto(BASE);
await page.waitForSelector('.perfis', { timeout: 30000 });
verificar(await page.locator('.perfil').count() === 2, 'duas jornadas na tela inicial');
await print('01-inicio');

console.log('Canteiro');
await page.click('a[href="#/campo"]');
await page.waitForSelector('.cartao-obra');
verificar(await page.locator('.cartao-obra').count() === 3, 'três obras');
verificar(await page.locator('.aviso-alerta').count() === 1, 'aviso de ajustes pedidos no Galpão');
verificar((await page.textContent('a[href="#/campo/obra/jardim"]')).includes('não iniciado'), 'Jardim das Flores sem RDO hoje');
await print('02-campo');

await page.click('a[href="#/campo/obra/jardim"]');
await page.waitForSelector('.item-rdo-fotos img[src^="blob:"]');
const item = page.locator('.item-rdo').first();
verificar(await item.locator('.item-rdo-fotos img').count() === 2, 'lista de RDOs: duas fotos por item');
verificar(await item.locator('.item-rdo-mais').textContent() === '+1', 'lista de RDOs: "+1" quando há mais fotos');
const mini = await item.locator('.item-rdo-fotos img').first().evaluate((img) => img.naturalWidth);
verificar(mini === 320, 'lista de RDOs: miniatura de 320 px, não a foto inteira (' + mini + ')');
verificar((await item.locator('.item-rdo-trecho').textContent()).startsWith('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D'), 'lista de RDOs: começo da primeira atividade');
await print('02b-lista-rdos');
await page.click('[data-acao="novo-rdo"][data-copiar="1"]');
await page.waitForSelector('#s-clima');
await page.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2);
verificar(await page.locator('[data-turno="manha"][data-valor="sol"][aria-pressed="true"]').count() === 1, 'clima automático: manhã de sol');
verificar(await page.locator('[data-turno="tarde"][data-valor="chuva"][aria-pressed="true"]').count() === 1, 'clima automático: tarde de chuva');
verificar(await page.locator('[data-turno="tarde"][data-acao="clima-prat"][data-valor="0"][aria-pressed="true"]').count() === 1, 'tarde impraticável (chuva > 2 mm)');
verificar(await page.locator('#s-equipe .tabela-linha').count() === 5, 'equipe copiada do dia anterior');
verificar(await page.locator('#s-equipamentos .equip').count() === 3, 'equipamentos copiados');
const atividadesCopiadas = await page.locator('#s-atividades .atividade').count();
verificar(atividadesCopiadas === 2, 'só as atividades em andamento foram copiadas (' + atividadesCopiadas + ')');

// Equipe: +1 pedreiro, +1 falta de servente
const totalAntes = await page.textContent('#s-equipe .secao-total');
await page.click('[data-acao="equipe-mudar"][data-i="1"][data-campo="presentes"][data-valor="1"]');
await page.click('[data-acao="equipe-mudar"][data-i="2"][data-campo="faltas"][data-valor="1"]');
const totalDepois = await page.textContent('#s-equipe .secao-total');
verificar(totalAntes !== totalDepois && /falta/.test(totalDepois), 'stepper muda o total: ' + totalDepois);
await page.click('[data-acao="equipe-add"][data-valor="Carpinteiro"]');
verificar(await page.locator('#s-equipe .tabela-linha').count() === 6, 'nova função pelo chip');
await page.click('[data-acao="equip-status"][data-i="0"][data-valor="manutencao"]');
verificar(await page.locator('[data-acao="equip-status"][data-i="0"][data-valor="manutencao"][aria-pressed="true"]').count() === 1, 'status de equipamento');

// Atividade nova com texto informal + melhorar
await page.click('[data-acao="ativ-add"]');
const n = await page.locator('#s-atividades textarea').count();
const campo = page.locator('#s-atividades textarea').nth(n - 1);
await campo.fill('hj a gente fecho a viga 2 mas faltou cimento pq a entrega atrasou');
await page.click('[data-acao="melhorar"][data-alvo="atividades.' + (n - 1) + '.descricao"]');
await page.waitForSelector('dialog textarea');
const sugestao = await page.inputValue('dialog textarea');
verificar(/^Hoje a equipe concluiu a viga 2\. Porém, houve falta de cimento, pois a entrega sofreu atraso\.$/.test(sugestao), 'texto melhorado: ' + sugestao);
await print('03-ia');
await page.click('dialog button:has-text("Usar este texto")');
await page.waitForSelector('dialog', { state: 'detached' });
await page.waitForFunction((t) => Array.from(document.querySelectorAll('#s-atividades textarea')).some((c) => c.value === t), sugestao);
verificar((await page.locator('#s-atividades textarea').nth(n - 1).inputValue()) === sugestao, 'texto melhorado aplicado');

// Ocorrência
await page.click('[data-acao="ocor-add"][data-valor="material"]');
await page.locator('#s-ocorrencias textarea').fill('Entrega de cimento atrasou 2 horas.');

// Foto: gera uma imagem grande de ~3 MB no próprio navegador
const jpeg = await page.evaluate(() => {
  const c = document.createElement('canvas'); c.width = 4000; c.height = 3000;
  const x = c.getContext('2d');
  for (let i = 0; i < 4000; i++) { x.fillStyle = 'hsl(' + (i * 37 % 360) + ',60%,' + (30 + i % 40) + '%)'; x.fillRect(Math.random() * 4000, Math.random() * 3000, 120, 120); }
  return c.toDataURL('image/jpeg', 0.95).split(',')[1];
});
const buffer = Buffer.from(jpeg, 'base64');
await page.setInputFiles('input[data-fotos="camera"]', { name: 'IMG_0001.jpg', mimeType: 'image/jpeg', buffer });
await page.waitForSelector('#s-fotos .foto img[src^="blob:"]', { timeout: 20000 });
const meta = await page.textContent('#s-fotos .foto .mudo');
verificar(/GPS ✓/.test(meta), 'foto com GPS do aparelho: ' + meta);
const dados = await page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')));
const novo = dados.rdos.find((r) => r.obraId === 'jardim' && r.status === 'rascunho');
const f = novo.fotos[0];
verificar(f.tamanho < 400 * 1024 && f.tamanhoOriginal > f.tamanho * 3, 'foto comprimida: ' + Math.round(f.tamanhoOriginal / 1024) + ' KB → ' + Math.round(f.tamanho / 1024) + ' KB');
verificar(f.largura === 1600 && f.altura === 1200, 'redimensionada para 1600 px');
verificar(/^[0-9a-f]{64}$/.test(f.hashOriginal), 'hash SHA-256 do original');
await page.locator('[data-bind="fotos.0.legenda"]').fill('Viga 2 concretada');
await print('04-editor');

// Envio sem internet (simulado)
await page.click('#conexao');
verificar((await page.textContent('#conexao')).includes('Sem internet'), 'modo sem internet ligado');
await page.click('[data-acao="enviar"]');
await page.waitForSelector('.aviso-ambar');
verificar((await page.textContent('.aviso-ambar')).includes('Guardado no aparelho'), 'RDO guardado no aparelho');
verificar((await page.textContent('#conexao')).includes('1 no aparelho'), 'contador de pendentes');
await print('05-offline');

// Escritório ainda não vê
await page.goto(BASE + '#/painel');
await page.waitForSelector('.faroes');
verificar(await page.locator('.farol-amarelo').count() === 1, 'escritório: Jardim ainda amarelo (RDO não chegou)');

// Internet volta → sobe sozinho
await page.click('#conexao');
await page.waitForFunction(() => document.querySelectorAll('.farol-verde').length === 2, null, { timeout: 15000 });
verificar(true, 'internet voltou: RDO subiu e o farol ficou verde');
verificar(await page.locator('.farol-vermelho').count() === 1, 'Galpão continua vermelho');
await print('06-painel');

// Aprovar o novo RDO
const id = novo.id;
await page.goto(BASE + '#/painel/rdo/' + id);
await page.waitForSelector('[data-acao="aprovar"]');
await page.click('[data-acao="aprovar"]');
await page.click('dialog button:has-text("Aprovar e lacrar")');
await page.waitForSelector('.codigo.grande');
const codigo = (await page.textContent('.codigo.grande')).trim();
verificar(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(codigo), 'código de verificação ' + codigo);
verificar((await page.textContent('.historico')).includes('Recebido no escritório'), 'histórico registra o recebimento');
await print('07-aprovado');

// Link do cliente e verificação do lacre
await page.goto(BASE + '#/cliente/' + codigo);
await page.waitForFunction(() => /Documento autêntico/.test(document.getElementById('verificacao').textContent));
verificar(true, 'link do cliente: documento autêntico');
await print('08-cliente');
// adulteração: muda um texto direto no armazenamento → a verificação acusa
await page.evaluate((id) => {
  const d = JSON.parse(localStorage.getItem('kbt.rdo.v1'));
  d.rdos.find((r) => r.id === id).atividades[0].descricao += ' (editado)';
  localStorage.setItem('kbt.rdo.v1', JSON.stringify(d));
}, id);
await page.reload();
await page.waitForFunction(() => /mudou depois da aprovação/.test(document.getElementById('verificacao').textContent));
verificar(true, 'adulteração detectada pelo lacre');

// PDF
await page.goto(BASE + '#/pdf/' + id);
await page.waitForSelector('.pdf-folha img[src^="blob:"]');
await page.emulateMedia({ media: 'print' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
verificar(pdf.length > 50000, 'PDF gerado (' + Math.round(pdf.length / 1024) + ' KB)');
if (SAIDA) (await import('node:fs')).writeFileSync(SAIDA + '/rdo.pdf', pdf);
await page.emulateMedia({ media: 'screen' });

// Ajustes: escritório pede, canteiro corrige e reenvia
console.log('Ajustes');
await page.goto(BASE + '#/campo');
await page.click('.aviso-alerta');
await page.waitForSelector('[data-acao="enviar"]');
verificar((await page.textContent('[data-acao="enviar"]')).includes('Reenviar'), 'RDO com ajustes abre editável com "Reenviar"');
await page.click('[data-acao="enviar"]');
await page.waitForSelector('.aviso-azul, .aviso-ambar', { timeout: 15000 });
await page.waitForFunction(() => !/Enviando/.test(document.getElementById('conexao').textContent), null, { timeout: 15000 });
const dados2 = await page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')));
const reenviado = dados2.rdos.find((r) => r.id === 'rdo-galpao-m2');
verificar(reenviado.status === 'enviado' && reenviado.sync === 'enviado', 'reenviado e recebido');

// Pedir ajustes pelo painel
await page.goto(BASE + '#/painel/rdo/rdo-atlantico-hoje');
await page.click('[data-acao="pedir-ajustes"]');
await page.fill('dialog textarea', 'Inclua a foto da armação dos pilares.');
await page.click('dialog button:has-text("Enviar pedido")');
await page.waitForSelector('.aviso-citacao');
verificar((await page.textContent('.revisao-lado')).includes('Inclua a foto'), 'pedido de ajustes registrado');

// Recarregar mantém tudo (offline-first: dados no aparelho)
await page.reload();
await page.waitForSelector('.revisao-lado');
verificar((await page.textContent('.revisao-lado')).includes('Com o canteiro'), 'estado persiste após recarregar');

// Service worker instalado
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
verificar(sw, 'service worker ativo (app abre sem internet)');

// Abre sem internet de verdade
await context.setOffline(true);
await page.goto(BASE + '#/campo');
await page.waitForSelector('.cartao-obra', { timeout: 15000 });
verificar((await page.textContent('#conexao')).includes('Sem internet'), 'sem internet de verdade: o app abre e avisa');
await context.setOffline(false);

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
await browser.close();
process.exit(falhas ? 1 : 0);
