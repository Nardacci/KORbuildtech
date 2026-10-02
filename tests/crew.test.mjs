/* KORbuild Crew — teste de ponta a ponta do ponto da equipe.
 * Uso: python3 -m http.server 8123 & node tests/crew.test.mjs [http://localhost:8123/]
 * Horário fixo: quarta-feira, 07/10/2026, 16h30. GPS do celular: dentro da cerca do Residencial Jardim das Flores. */

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
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true,
  geolocation: { latitude: -22.84571, longitude: -47.05612, accuracy: 8 }, permissions: ['geolocation'],
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
await context.route('https://api.open-meteo.com/**', (r) => r.abort());
await context.route('https://fonts.**', (r) => r.abort());
const print = async (nome) => { if (SAIDA) await page.screenshot({ path: SAIDA + '/crew-' + nome + '.png', fullPage: true }); };
const como = async (id, hash) => { await page.evaluate((x) => localStorage.setItem('kbt.sessao', x), id); await page.goto(BASE + hash); };
const estadoDe = (nome) => page.locator('.lista-equipe li', { hasText: nome }).locator('.estado-ponto').textContent();

await page.goto(BASE);
await page.waitForSelector('#form-login', { timeout: 30000 });

console.log('Encarregado: ponto da equipe');
await como('u-carlos', '#/crew');
await page.waitForSelector('.lista-equipe');
verificar(page.url().endsWith('#/crew/equipe'), 'encarregado entra no Crew pelo ponto da equipe');
verificar(await page.locator('.lista-equipe li').count() === 6, 'equipe do Carlos com 6 pessoas');
verificar(await page.locator('.abas .abas-item').count() === 2, 'abas do encarregado: Ponto e Horas');
verificar((await estadoDe('João Pereira')).includes('Ainda não bateu entrada'), 'ninguém da equipe bateu entrada hoje');
verificar(await page.isDisabled('[data-acao="crew-entrada"]'), 'sem seleção, os botões ficam desligados');
await print('1-equipe');

await page.click('[data-acao="crew-todos"]');
verificar((await page.textContent('[data-acao="crew-entrada"]')).includes('(6)'), 'selecionar todos: Entrada (6)');
await page.click('[data-acao="crew-entrada"]');
await page.waitForSelector('dialog #crew-local');
verificar((await page.textContent('dialog #crew-local')).includes('dentro da cerca'), 'GPS do celular dentro da cerca da obra');
await print('2-entrada');
await page.click('dialog button:has-text("Bater entrada")');
await page.waitForFunction(() => /Trabalhando desde 16:30/.test(document.querySelector('.lista-equipe').textContent));
verificar((await estadoDe('João Pereira')).includes('Trabalhando desde 16:30 · Residencial Jardim · Alvenaria'), 'entrada registrada com obra e etapa');

// Lucas troca de obra: sai para o Galpão e chega (GPS longe do Galpão → fora da cerca, usa a simulação)
await page.click('.lista-equipe li:has-text("Lucas Oliveira") input');
await page.click('[data-acao="crew-troca"]');
await page.selectOption('dialog select[name="destino"]', 'galpao');
await page.click('dialog button:has-text("Sair para a obra")');
await page.waitForFunction(() => /Indo para Galpão/.test(document.querySelector('.lista-equipe').textContent));
verificar((await estadoDe('Lucas Oliveira')).includes('Indo para Galpão Logístico'), 'troca de obra: em deslocamento');
await page.click('.lista-equipe li:has-text("Lucas Oliveira") input');
await page.click('[data-acao="crew-chegada"]');
await page.waitForSelector('dialog #crew-local');
verificar((await page.textContent('dialog #crew-local')).includes('fora da cerca'), 'chegada longe da obra: avisa fora da cerca');
await page.check('dialog input[name="simular"]');
await page.click('dialog button:has-text("Registrar chegada")');
await page.waitForFunction(() => /Galpão Logístico · Fundação/.test(document.querySelector('.lista-equipe').textContent));
verificar(true, 'chegada registrada na outra obra');

// Marcos vai para o intervalo
await page.click('.lista-equipe li:has-text("Marcos Lima") input');
await page.click('[data-acao="crew-intervalo"]');
await page.waitForFunction(() => /Em intervalo/.test(document.querySelector('.lista-equipe').textContent));
verificar((await estadoDe('Marcos Lima')).includes('Em intervalo desde 16:30'), 'intervalo registrado');
verificar((await page.textContent('.resumo-ponto')).includes('5 trabalhando'), 'resumo: 5 trabalhando');
await print('3-equipe-trabalhando');

// Rafael ficou sem saída ontem: aparece na tabela de horas
await page.click('.abas-item[href="#/crew/horas"]');
await page.waitForSelector('.tabela-horas');
verificar((await page.locator('.tabela-horas tr', { hasText: 'Rafael Costa' }).textContent()).includes('!'), 'horas: alerta no dia sem saída do Rafael');
await page.goto(BASE + '#/crew/agora');
await page.waitForSelector('.lista-equipe');
verificar(page.url().endsWith('#/crew/equipe'), 'encarregado não abre as telas do escritório');

console.log('Daily: equipe do RDO vem do ponto');
await page.goto(BASE + '#/daily/campo/obra/jardim');
await page.click('[data-acao="novo-rdo"]');
await page.waitForSelector('#s-equipe');
verificar(await page.isVisible('#s-equipe .fonte-crew'), 'RDO avisa que a equipe veio do Crew');
verificar((await page.textContent('#s-equipe .secao-total')).includes('6 presentes'), 'RDO com as 6 pessoas que bateram entrada na obra');

console.log('Escritório');
await como('u-ana', '#/crew');
await page.waitForSelector('.grade-obras-agora');
verificar(page.url().endsWith('#/crew/agora'), 'administradora entra no Crew pelo "Agora"');
verificar((await page.locator('.kpi', { hasText: 'Trabalhando agora' }).textContent()).includes('11'), 'Agora: 11 pessoas trabalhando');
verificar((await page.locator('.obra-agora', { hasText: 'Galpão' }).textContent()).includes('Lucas Oliveira'), 'Agora: Lucas aparece no Galpão');
const conferir = page.locator('.fila li', { hasText: 'Marcos Lima' });
verificar(await conferir.count() === 1, 'batida fora da obra do Marcos para conferir');
await conferir.locator('[data-acao="crew-conferir"]').click();
await page.waitForFunction(() => !/Marcos Lima · Entrada/.test(document.querySelector('.pagina').textContent));
verificar(true, 'batida conferida sai da lista');
await print('4-agora');

// Sininho
const contador = await page.locator('.sino-contador').textContent();
verificar(Number(contador) > 0, 'sininho com notificações não lidas (' + contador + ')');
await page.click('.sino summary');
verificar((await page.textContent('.painel-notificacoes')).includes('timesheets da semana passada aguardando aprovação'), 'sininho: timesheets aguardando aprovação');
await print('5-sininho');
await page.click('[data-acao="ler-todas"]');
await page.waitForFunction(() => !document.querySelector('.sino-contador'));
verificar(true, 'marcar todas como lidas zera o contador');

// Timesheets da semana anterior
await page.goto(BASE + '#/crew/timesheets');
await page.waitForSelector('.tabela-horas');
verificar((await page.locator('.kpi', { hasText: 'Aguardando aprovação' }).textContent()).includes('6'), 'timesheets: 6 aguardando aprovação (equipe do Roberto)');
const linhaAntonio = page.locator('.tabela-horas tr', { hasText: 'Antônio Souza' });
verificar(!(await linhaAntonio.locator('td.extra').textContent()).includes('–'), 'Antônio fez hora extra (acima de 40 h)');
await print('6-timesheets');
await linhaAntonio.locator('input[type="checkbox"]').check();
await page.click('[data-acao="crew-aprovar"]');
await page.click('dialog button:has-text("Aprovar")');
await page.waitForFunction(() => /Aprovado/.test([...document.querySelectorAll('.tabela-horas tr')].find((tr) => /Antônio/.test(tr.textContent)).textContent));
verificar(true, 'timesheet do Antônio aprovado');

const [download] = await Promise.all([page.waitForEvent('download'), page.click('[data-acao="crew-csv"]')]);
const csv = await (await import('node:fs/promises')).readFile(await download.path(), 'utf8');
verificar(csv.includes('Antônio Souza') && csv.includes('Carlos Mendes') && !csv.includes('Bruno Alves'), 'CSV só com os aprovados (Antônio e a equipe do Carlos)');

// Ajustar a saída esquecida do Rafael (semana atual)
await page.goto(BASE + '#/crew/semana/f-rafael/2026-10-05');
await page.waitForSelector('.dia-semana');
verificar((await page.textContent('.pagina')).includes('Sem saída'), 'semana do Rafael: dia sem saída');
await page.click('.dia-semana:has-text("06/10/2026") [data-acao="crew-ajustar"]');
await page.fill('dialog input[name="hora"]', '17:05');
await page.fill('dialog textarea[name="motivo"]', 'Esqueceu de bater a saída; confirmado com o Carlos.');
await page.click('dialog button:has-text("Registrar ajuste")');
await page.waitForFunction(() => !/Sem saída/.test(document.querySelector('.pagina').textContent));
verificar(true, 'ajuste registrado: o alerta de sem saída some');
await page.goto(BASE + '#/crew/dia/f-rafael/2026-10-06');
await page.waitForSelector('.linha-tempo');
verificar((await page.textContent('.linha-tempo')).includes('Ajuste de Ana Ribeiro'), 'linha do tempo mostra o ajuste e quem fez');

// Custos e mapa do dia
await page.goto(BASE + '#/crew/custos/2026-09-28');
await page.waitForSelector('.custo-obra');
verificar((await page.textContent('.pagina')).includes('Deslocamento entre obras'), 'custos: deslocamento entre obras aparece como custo');
verificar((await page.locator('.kpi', { hasText: 'Adicional de hora extra' }).textContent()).includes('US$'), 'custos: adicional de hora extra em US$');
await print('7-custos');
await page.goto(BASE + '#/crew/dia/f-diego/2026-09-29');
await page.waitForSelector('svg.mapa-dia');
verificar(await page.locator('svg.mapa-dia .mapa-fora').count() > 0, 'mapa do dia: trilha fora da cerca');
verificar((await page.textContent('.linha-tempo')).includes('Saiu da cerca com o ponto aberto'), 'linha do tempo: saída da cerca com o ponto aberto');
await print('8-mapa');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
await browser.close();
process.exit(falhas ? 1 : 0);
