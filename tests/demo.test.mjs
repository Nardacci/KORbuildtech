/* KORbuild — teste de ponta a ponta do roteiro da demonstração (login, módulos e Daily).
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
  geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'],
});
// Os testes conferem os textos em português (o padrão do app é inglês).
await context.addInitScript(() => { try { if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* sem armazenamento */ } });
const page = await context.newPage();
// Horário fixo (quarta-feira, 16h30): os alertas do prazo do RDO dependem do dia e da hora.
await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
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

// Troca de usuário sem passar pela tela de login (o login em si é testado no começo).
const comoUsuario = async (id, hash) => {
  await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id);
  await page.goto(BASE + hash);
};

const sairPeloMenu = async () => {
  await page.click('.menu-usuario:not(.sino) summary');
  await page.click('.menu [data-acao="sair"]');
};

const print = async (nome) => { if (SAIDA) await page.screenshot({ path: SAIDA + '/' + nome + '.png', fullPage: true }); };

console.log('Login e módulos');
await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });
verificar(page.url().endsWith('#/entrar'), 'sem login, abre a tela de entrar');
verificar((await page.inputValue('#login-email')).length > 0, 'login já vem preenchido (mockup)');
verificar(await page.locator('.usuarios-demo p').count() === 2 && await page.locator('.usuarios-demo p:has-text("Construtora Exemplo") .email-demo').count() === 3 && await page.locator('.usuarios-demo p:has-text("Northfield") .email-demo').count() === 4, 'usuários de demonstração das duas empresas: construtora (3) e prestadora (4)');
await page.fill('#login-email', 'ninguem@exemplo.com');
await page.click('#form-login button[type="submit"]');
verificar(await page.isVisible('#login-erro'), 'e-mail desconhecido mostra erro');
await print('01-login');
await page.click('.email-demo[data-email^="carlos"]');
await page.click('#form-login button[type="submit"]');
await page.waitForSelector('.modulos');
verificar(page.url().endsWith('#/inicio'), 'depois do login, todos vão para a página dos módulos');
verificar(await page.locator('.modulos .modulo').count() === 2, 'encarregado vê os módulos do perfil dele: Daily e Crew');
verificar((await page.textContent('.modulos .modulo-daily')).includes('Contratado'), 'Daily contratado');
verificar((await page.textContent('.modulos .modulo-crew')).includes('Contratado') && await page.locator('.modulos .modulo-measure').count() === 0, 'Crew contratado; o Measure não aparece para o encarregado (sem permissão)');
await page.click('.menu-usuario:not(.sino) summary');
verificar(await page.isVisible('.menu [data-acao="sair"]'), 'menu do usuário abre com "Sair"');
verificar(await page.locator('.menu a[href="#/conta"]').count() === 0, 'usuário de campo não vê a conta da empresa');
await page.mouse.click(160, 28);
verificar(!(await page.isVisible('.menu')), 'menu do usuário fecha ao clicar fora');
await print('01b-modulos');
await page.goto(BASE + '#/measure');
await page.waitForSelector('.modulos');
verificar(page.url().endsWith('#/inicio'), 'encarregado não abre o Measure pelo endereço');
await page.goto(BASE + '#/daily/painel');
await page.waitForSelector('.cartao-obra');
verificar(page.url().endsWith('#/daily/campo'), 'campo não abre o painel do escritório');
await page.goto(BASE + '#/conta');
await page.waitForSelector('.modulos');
verificar(page.url().endsWith('#/inicio'), 'campo não abre a conta da empresa');

console.log('Canteiro');
await page.click('.modulos .modulo-daily');
await page.waitForSelector('.cartao-obra');
verificar(page.url().endsWith('#/daily/campo'), 'campo entra no Daily pela tela Hoje');
verificar(await page.locator('.abas .abas-item').count() === 2, 'abas do campo: Hoje e Histórico');
verificar((await page.textContent('.topo-modulo')).includes('Daily'), 'barra superior mostra o módulo');
await page.click('.abas-item[href="#/daily/historico"]');
await page.waitForSelector('.item-rdo-obra');
verificar(await page.locator('.abas-item.ativo[href="#/daily/historico"]').count() === 1, 'aba Histórico ativa');
await page.click('.abas-item[href="#/daily/campo"]');
await page.waitForSelector('.cartao-obra');
verificar(await page.locator('.cartao-obra').count() === 3, 'três obras');
verificar(await page.locator('.aviso-ajustes').count() === 1, 'aviso de ajustes pedidos no Galpão');
verificar((await page.textContent('.aviso-atraso')).includes('Galpão Logístico Rodovia'), 'prazo: RDO de ontem do Galpão aparece como atrasado');
verificar((await page.textContent('.aviso-prazo')).includes('faltam 1h30'), 'prazo: às 16h30 avisa que faltam 1h30 para as 18h');
verificar((await page.textContent('.pagina a[href="#/daily/campo/obra/jardim"]')).includes('Falta o RDO de hoje · prazo 18h'), 'Jardim das Flores: falta o RDO de hoje');
verificar((await page.textContent('.abas-item[href="#/daily/campo"] .contador')).trim() === '4', 'contador de Hoje: 1 atrasado + 2 sem RDO hoje + 1 ajuste');
await print('02-campo');

await page.click('.pagina a[href="#/daily/campo/obra/jardim"]');
await page.waitForSelector('.item-rdo-fotos img[src^="blob:"]');
const item = page.locator('.item-rdo').first();
verificar(await item.locator('.item-rdo-fotos img').count() === 2, 'lista de RDOs: duas fotos por item');
verificar(await item.locator('.item-rdo-mais').textContent() === '+1', 'lista de RDOs: "+1" quando há mais fotos');
const mini = await item.locator('.item-rdo-fotos img').first().evaluate((img) => img.naturalWidth);
verificar(mini === 320, 'lista de RDOs: miniatura de 320 px, não a foto inteira (' + mini + ')');
verificar((await item.locator('.item-rdo-trecho').textContent()).startsWith('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D'), 'lista de RDOs: começo da primeira atividade');
await print('02b-lista-rdos');
verificar((await page.textContent('.acoes-obra .btn-primario')).includes('Adicionar nova RDO'), 'botão de destaque: Adicionar nova RDO');
await page.click('[data-acao="copiar-rdo"]');
await page.waitForSelector('dialog .opcao-rdo');
verificar(await page.locator('dialog .opcao-rdo').count() === 6, 'copiar: lista todos os RDOs anteriores da obra');
verificar(await page.isChecked('dialog .opcao-rdo input >> nth=0'), 'copiar: o mais recente vem marcado');
await page.click('dialog .opcao-rdo >> nth=0');
await page.click('dialog button:has-text("Copiar")');
await page.waitForSelector('#s-clima');
verificar(await page.locator('.abas').count() === 0, 'editor do RDO sem abas (tela de foco)');
verificar((await page.textContent('.voltar')).includes('Residencial Jardim das Flores'), 'editor volta para a obra');
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
const dados = await page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')).empresas['construtora-exemplo']);
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
await comoUsuario('u-ana', '#/daily');
await page.waitForSelector('.faroes');
verificar(page.url().endsWith('#/daily/painel'), 'administradora entra no Daily pelo painel');
verificar(await page.locator('.faroes .farol-amarelo').count() === 1, 'escritório: Jardim ainda amarelo (RDO não chegou)');
verificar(await page.locator('.abas .abas-item').count() === 3, 'abas do escritório: Painel, Aprovações e Obras');

// Internet volta → sobe sozinho
await page.click('#conexao');
await page.waitForFunction(() => document.querySelectorAll('.faroes .farol-verde').length === 2, null, { timeout: 15000 });
verificar(true, 'internet voltou: RDO subiu e o farol ficou verde');
verificar(await page.locator('.faroes .farol-vermelho').count() === 1, 'Galpão continua vermelho');
verificar((await page.textContent('.aviso-escalada')).includes('Galpão Logístico Rodovia'), 'escritório: na manhã seguinte vê a obra que ficou sem RDO');
verificar((await page.textContent('.aviso-escalada')).includes('Carlos Mendes'), 'escritório: aviso mostra o responsável');
await page.click('.abas-item[href="#/daily/aprovacoes"]');
await page.waitForSelector('.abas-item.ativo[href="#/daily/aprovacoes"]');
verificar(await page.locator('.cartao').first().locator('.fila li').count() === 3, 'Aprovações: três RDOs na fila');
await page.click('.abas-item[href="#/daily/obras"]');
await page.click('.pagina a[href="#/daily/obras/galpao"]');
await page.waitForSelector('.item-rdo');
verificar((await page.getAttribute('.item-rdo', 'href')).startsWith('#/daily/painel/rdo/'), 'obra no escritório abre a revisão dos RDOs');
await page.goto(BASE + '#/daily/campo');
await page.waitForSelector('.kpis');
verificar(page.url().endsWith('#/daily/painel'), 'administrador não entra na área do campo');
await print('06-painel');

// Aprovar o novo RDO
const id = novo.id;
await page.goto(BASE + '#/daily/painel/rdo/' + id);
await page.waitForSelector('[data-acao="aprovar"]');
await page.click('[data-acao="aprovar"]');
await page.click('dialog button:has-text("Aprovar e lacrar")');
await page.waitForSelector('.codigo.grande');
const codigo = (await page.textContent('.codigo.grande')).trim();
verificar(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(codigo), 'código de verificação ' + codigo);
verificar((await page.textContent('.historico')).includes('Recebido no escritório'), 'histórico registra o recebimento');
await print('07-aprovado');

// Link do cliente e verificação do lacre
verificar((await page.textContent('.historico')).includes('Ana Ribeiro'), 'aprovação registrada com o nome de quem está logado');
await sairPeloMenu();
await page.waitForSelector('#form-login');
await page.goto(BASE + '#/cliente/' + codigo);
await page.waitForFunction(() => /Documento autêntico/.test(document.getElementById('verificacao').textContent));
verificar(true, 'link do cliente abre sem login: documento autêntico');
await print('08-cliente');
// adulteração: muda um texto direto no armazenamento → a verificação acusa
await page.evaluate((id) => {
  const b = JSON.parse(localStorage.getItem('kbt.rdo.v1'));
  b.empresas['construtora-exemplo'].rdos.find((r) => r.id === id).atividades[0].descricao += ' (editado)';
  localStorage.setItem('kbt.rdo.v1', JSON.stringify(b));
}, id);
await page.reload();
await page.waitForFunction(() => /mudou depois da aprovação/.test(document.getElementById('verificacao').textContent));
verificar(true, 'adulteração detectada pelo lacre');

// PDF
await page.goto(BASE + '#/daily/pdf/' + id);
await page.waitForSelector('#form-login');
verificar(true, 'PDF pede login');
await page.fill('#login-email', 'ana@construtoraexemplo.com');
await page.click('#form-login button[type="submit"]');
await page.waitForSelector('.modulos');
await page.goto(BASE + '#/daily/pdf/' + id);
await page.waitForSelector('.pdf-folha img[src^="blob:"]');
await page.emulateMedia({ media: 'print' });
const pdf = await page.pdf({ format: 'A4', printBackground: true });
verificar(pdf.length > 50000, 'PDF gerado (' + Math.round(pdf.length / 1024) + ' KB)');
if (SAIDA) (await import('node:fs')).writeFileSync(SAIDA + '/rdo.pdf', pdf);
await page.emulateMedia({ media: 'screen' });

// Ajustes: escritório pede, canteiro corrige e reenvia
console.log('Ajustes');
await comoUsuario('u-carlos', '#/daily/campo');
await page.click('.aviso-ajustes');
await page.waitForSelector('[data-acao="enviar"]');
verificar((await page.textContent('[data-acao="enviar"]')).includes('Reenviar'), 'RDO com ajustes abre editável com "Reenviar"');
await page.click('[data-acao="enviar"]');
await page.waitForSelector('.aviso-azul, .aviso-ambar', { timeout: 15000 });
await page.waitForFunction(() => !/Enviando/.test(document.getElementById('conexao').textContent), null, { timeout: 15000 });
const dados2 = await page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')).empresas['construtora-exemplo']);
const reenviado = dados2.rdos.find((r) => r.id === 'rdo-galpao-m2');
verificar(reenviado.status === 'enviado' && reenviado.sync === 'enviado', 'reenviado e recebido');

// RDO atrasado de ontem no Galpão, copiando um RDO mais antigo (nº 115)
await page.goto(BASE + '#/daily/campo/obra/galpao');
await page.waitForSelector('.cartao.atrasado');
verificar((await page.textContent('.cartao.atrasado')).includes('terça-feira, 06/10/2026'), 'obra: seção do RDO atrasado de ontem');
await page.click('.cartao.atrasado [data-acao="copiar-rdo"]');
await page.waitForSelector('dialog .opcao-rdo');
await page.click('dialog .opcao-rdo >> nth=2');
await page.click('dialog button:has-text("Copiar")');
await page.waitForSelector('#s-clima');
const dados3 = await page.evaluate(() => JSON.parse(localStorage.getItem('kbt.rdo.v1')).empresas['construtora-exemplo']);
const copiaAntiga = dados3.rdos.find((r) => r.obraId === 'galpao' && r.status === 'rascunho');
verificar(copiaAntiga && copiaAntiga.historico[0].acao.includes('nº 115'), 'copiar: dá para escolher um RDO mais antigo (nº 115)');
verificar(copiaAntiga && copiaAntiga.equipe.length === 4 && copiaAntiga.fotos.length === 0, 'copiar: traz a equipe e começa sem fotos');
verificar(copiaAntiga && copiaAntiga.data === '2026-10-06', 'RDO atrasado fica com a data de ontem');
verificar((await page.textContent('.aviso-ambar')).includes('Preenchimento com atraso'), 'editor avisa do preenchimento com atraso');
await page.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2);
await page.click('[data-acao="enviar"]');
await page.click('dialog button:has-text("Enviar sem fotos")');
await page.waitForSelector('.rel-atraso', { timeout: 15000 });
verificar((await page.textContent('.rel-atraso')).includes('prazo era 06/10/2026 às 18:00'), 'relatório marcado como enviado com atraso');

// Sem atividade hoje no Galpão: registra o dia e os lembretes param
await page.goto(BASE + '#/daily/campo/obra/galpao');
await page.click('.acoes-hoje [data-acao="sem-atividade"]');
await page.waitForSelector('dialog .opcao-rdo');
await page.click('dialog button:has-text("Registrar")');
await page.waitForSelector('.acoes-hoje a:has-text("Ver o RDO de hoje")');
await page.goto(BASE + '#/daily/campo');
await page.waitForSelector('.cartao-obra');
verificar((await page.textContent('.pagina a[href="#/daily/campo/obra/galpao"]')).includes('Sem atividade hoje · Chuva'), 'sem atividade: o Galpão fica em dia hoje');
verificar(await page.locator('.aviso-atraso').count() === 0, 'sem pendências atrasadas depois de preencher e registrar');

// Pedir ajustes pelo painel
await comoUsuario('u-ana', '#/daily/painel/rdo/rdo-atlantico-hoje');
await page.click('[data-acao="pedir-ajustes"]');
await page.fill('dialog textarea', 'Inclua a foto da armação dos pilares.');
await page.click('dialog button:has-text("Enviar pedido")');
await page.waitForSelector('.aviso-citacao');
verificar((await page.textContent('.revisao-lado')).includes('Inclua a foto'), 'pedido de ajustes registrado');

// Recarregar mantém tudo (offline-first: dados no aparelho)
await page.reload();
await page.waitForSelector('.revisao-lado');
verificar((await page.textContent('.revisao-lado')).includes('Com o canteiro'), 'estado persiste após recarregar');

// Conta da empresa (SaaS)
await page.goto(BASE + '#/conta');
await page.waitForSelector('.tabela-usuarios');
verificar((await page.textContent('.plano')).includes('Profissional'), 'conta: plano da empresa');
verificar((await page.textContent('.uso')).includes('3 de 5'), 'conta: uso de obras ativas');
verificar(await page.locator('.tabela-usuarios tbody tr').count() === 5, 'conta: usuários da empresa');
verificar((await page.textContent('.fila')).includes('KORbuild Measure'), 'conta: módulos da empresa, com o Measure');
await print('09-conta');

// Service worker instalado
const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
verificar(sw, 'service worker ativo (app abre sem internet)');

// Abre sem internet de verdade
await page.evaluate(() => localStorage.setItem('kbt.sessao', 'u-carlos'));
await context.setOffline(true);
await page.goto(BASE + '#/daily/campo');
await page.waitForSelector('.cartao-obra', { timeout: 15000 });
const avisou = await page.waitForFunction(() => /Sem internet/.test(document.getElementById('conexao').textContent), null, { timeout: 10000 }).then(() => true, () => false);
verificar(avisou, 'sem internet de verdade: o app abre e avisa');
await context.setOffline(false);

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
await browser.close();
process.exit(falhas ? 1 : 0);
