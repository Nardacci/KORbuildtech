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
  geolocation: { latitude: 43.00411, longitude: -71.46353, accuracy: 8 }, permissions: ['geolocation'],
});
// Os testes conferem os textos em português (o padrão do app é inglês).
await context.addInitScript(() => { try { if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* sem armazenamento */ } });
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-10-07T16:30:00'));
const erros = [];
page.on('pageerror', (e) => erros.push(e.message));
await context.route('https://api.open-meteo.com/**', (r) => r.abort());
await context.route('https://fonts.**', (r) => r.abort());
// Blocos do mapa de ruas (OpenStreetMap): no teste, uma imagem cinza no lugar
const BLOCO = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mN8+v9/PQAJBQPq1V7ZVgAAAABJRU5ErkJggg==', 'base64');
await context.route('https://tile.openstreetmap.org/**', (r) => r.fulfill({ contentType: 'image/png', body: BLOCO }));
// Rotas pelas ruas (OSRM) e endereço aproximado (Nominatim): simulados no teste
await context.route('https://router.project-osrm.org/**', (r) => {
  const pts = new URL(r.request().url()).pathname.split('/').pop().split(';').map((x) => x.split(',').map(Number));
  const coords = [];
  for (let i = 0; i < pts.length - 1; i++) coords.push(pts[i], [(pts[i][0] + pts[i + 1][0]) / 2 + 0.01, (pts[i][1] + pts[i + 1][1]) / 2]);
  coords.push(pts[pts.length - 1]);
  r.fulfill({ json: { code: 'Ok', routes: [{ distance: 41800, duration: 2460, geometry: { type: 'LineString', coordinates: coords } }] } });
});
await context.route('https://nominatim.openstreetmap.org/**', (r) => r.fulfill({ json: { address: { road: 'Test St', house_number: '100', suburb: 'North End', city: 'Manchester' } } }));
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
await page.goto(BASE + '#/crew/custos/2026-09-28'); // endereço antigo: abre a semana
await page.waitForSelector('.custo-obra');
verificar((await page.textContent('.pagina')).includes('Deslocamento entre obras'), 'custos: deslocamento entre obras aparece como custo');
verificar((await page.locator('.kpi', { hasText: 'Adicional de hora extra' }).textContent()).includes('US$'), 'custos: adicional de hora extra em US$');
await print('7-custos');
// Custos: obra inteira (orçado × realizado × projeção), mês, valor hora com histórico, orçamento e encargos
const kpiNum = async (rotulo) => Number((await page.locator('.kpi', { hasText: rotulo }).locator('b').textContent()).replace(/[^\d]/g, ''));
await page.goto(BASE + '#/crew/custos');
await page.waitForSelector('.grafico-area svg .g-realizado');
verificar(await page.locator('.custo-obra').count() === 3, 'custos: as três obras com orçamento e realizado');
verificar((await page.textContent('#obra-atlantico .cartao-titulo')).includes('Estouro previsto'), 'custos: Atlântico com estouro previsto');
verificar((await page.textContent('#obra-jardim .cartao-titulo')).includes('No rumo'), 'custos: Jardim no rumo');
verificar((await page.textContent('#obra-jardim .numeros-obra')).includes('Sobra projetada'), 'custos: sobra projetada');
const g = page.locator('#obra-jardim .grafico-area svg');
await g.scrollIntoViewIfNeeded();
const caixa = await g.boundingBox();
await page.mouse.move(caixa.x + caixa.width * 0.25, caixa.y + caixa.height / 2);
verificar((await page.textContent('#obra-jardim .g-dica')).includes('Realizado acumulado'), 'gráfico: dica ao passar o mouse');
await print('7b-custos-obras');
await page.click('#obra-jardim [data-acao="crew-orcamento"]');
await page.fill('dialog input[name="avanco"]', '25');
await page.click('dialog button:has-text("Salvar")');
await page.waitForFunction(() => /Estouro previsto/.test(document.querySelector('#obra-jardim .cartao-titulo').textContent));
verificar(true, 'orçamento: avanço físico menor muda a projeção para estouro');

await page.goto(BASE + '#/crew/custos/mes/2026-09');
await page.waitForSelector('.custo-obra');
verificar((await page.textContent('.seletor-semana')).includes('Setembro de 2026'), 'custos por mês');
verificar(await kpiNum('Encargos sobre a folha') > 0, 'custos do mês com encargos');
// Valor hora com vigência: mudar na semana aberta muda o custo dela; a semana aprovada não muda
await page.goto(BASE + '#/crew/custos/semana/2026-09-28');
await page.waitForSelector('.kpi');
const antesAnterior = await kpiNum('Total da semana');
await page.goto(BASE + '#/crew/custos/semana/2026-10-05');
await page.waitForSelector('.kpi');
const antesAtual = await kpiNum('Total da semana');
await page.goto(BASE + '#/crew/funcionarios'); // endereço antigo: vai para o Settings
await page.waitForSelector('.tabela-funcionarios');
verificar((await page.textContent('.tabela-funcionarios')).includes('US$ 38,00'), 'funcionários: valor hora atual');
await page.click('.tabela-funcionarios a:has-text("Lucas Oliveira")');
await page.waitForSelector('.tabela-valores');
verificar(await page.locator('.tabela-valores tbody tr').count() === 2, 'histórico do valor hora (admissão e reajuste)');
await page.click('[data-acao="crew-valor-hora"]');
await page.fill('dialog input[name="valor"]', '41');
await page.fill('dialog input[name="desde"]', '2026-09-28');
await page.fill('dialog input[name="motivo"]', 'Teste');
await page.click('dialog button:has-text("Salvar novo valor")');
await page.waitForFunction(() => /já foi aprovada/.test((document.getElementById('toast') || {}).textContent || ''));
verificar(await page.locator('.tabela-valores tbody tr').count() === 2, 'valor hora não pode começar em semana aprovada');
await page.click('[data-acao="crew-valor-hora"]');
await page.fill('dialog input[name="valor"]', '41');
await page.fill('dialog input[name="desde"]', '2026-10-05');
await page.fill('dialog input[name="motivo"]', 'Promoção a eletricista líder');
await page.click('dialog button:has-text("Salvar novo valor")');
await page.waitForFunction(() => document.querySelectorAll('.tabela-valores tbody tr').length === 3);
verificar((await page.textContent('.tabela-valores')).includes('Promoção a eletricista líder') && (await page.textContent('.kpi-azul')).includes('41,00'), 'novo valor hora entra no histórico e vira o vigente');
await print('9-funcionario');
await page.goto(BASE + '#/crew/custos/semana/2026-10-05');
await page.waitForSelector('.kpi');
verificar(await kpiNum('Total da semana') > antesAtual, 'novo valor hora aumenta o custo da semana aberta');
await page.goto(BASE + '#/crew/custos/semana/2026-09-28');
await page.waitForSelector('.kpi');
verificar(await kpiNum('Total da semana') === antesAnterior, 'semana anterior mantém o custo (valor vigente no dia)');

// Percurso: Lucas troca de obra (Jardim → Galpão) na terça da semana anterior
await page.goto(BASE + '#/crew/dia/f-lucas/2026-09-29');
await page.waitForSelector('.percurso');
verificar(await page.locator('.percurso .parada').count() === 2, 'percurso: duas obras na ordem da visita');
verificar((await page.textContent('.percurso')).includes('45 Northeastern Blvd'), 'percurso: endereço da obra');
await page.waitForFunction(() => /pelas ruas/.test(document.querySelector('.perna-deslocamento .perna-dist').textContent));
verificar((await page.textContent('.perna-deslocamento')).includes('41,8 km pelas ruas'), 'percurso: deslocamento pelas ruas com a distância');
verificar(await page.locator('#mapa-dia .pino-parada').count() === 2, 'mapa: pinos numerados das obras');
verificar((await page.textContent('#mapa-dia')).includes('Galpão Logístico Rodovia'), 'mapa: nome e endereço da obra no pino');
// Registros de localização: da entrada à saída, com setas, entrada/saída marcadas e reprodução
const nPassos = await page.locator('.passos-lista .passo').count();
verificar(nPassos >= 25, 'registros de localização da entrada à saída (' + nPassos + ')');
verificar((await page.locator('.passos-lista .passo').first().textContent()).includes('Entrada'), 'registros: o primeiro é a entrada');
verificar((await page.locator('.passos-lista .passo').last().textContent()).includes('Saída'), 'registros: o último é a saída');
verificar((await page.textContent('.passos-lista')).includes('Abriu o aplicativo'), 'registros: abertura do app');
verificar((await page.textContent('.passos-lista')).includes('Em deslocamento'), 'registros: pontos durante o deslocamento');
verificar(!(await page.textContent('.passos-lista')).match(/1[23]:[0-5]\d(?:Localização)/), 'registros: nada durante o intervalo');
verificar((await page.textContent('.mapa-resumo')).includes('Entrada 06:58') && (await page.textContent('.mapa-resumo')).includes('Saída 17:07'), 'mapa: resumo com entrada e saída');
verificar(await page.locator('#mapa-dia .pino-ponto.inicio').count() === 1 && await page.locator('#mapa-dia .pino-ponto.fim').count() === 1, 'mapa: pinos de entrada e de saída');
verificar(await page.locator('#mapa-dia .seta-rota').count() > 5, 'mapa: setas com o sentido do percurso');
await page.locator('.passos-lista .passo').nth(10).click();
verificar(await page.locator('.passos-lista .passo.ativo').count() === 1, 'registros: tocar mostra o ponto no mapa');
await page.click('[data-acao="crew-reproduzir"]');
await page.waitForFunction(() => { const r = document.querySelector('.mapa-relogio'); return r && !r.hidden && /\d\d:\d\d/.test(r.textContent); });
verificar((await page.textContent('[data-acao="crew-reproduzir"]')).includes('Pausar'), 'reprodução do percurso (playback) em andamento');
await page.waitForTimeout(1500);
await print('8d-reproducao');
await page.click('[data-acao="crew-reproduzir"]');
verificar((await page.textContent('[data-acao="crew-reproduzir"]')).includes('Reproduzir'), 'reprodução pausa');
await print('8c-percurso');
await page.goto(BASE + '#/crew/dia/f-marcos/2026-10-06');
await page.waitForFunction(() => /perto de 100 Test St/.test((document.querySelector('.parada-fora') || {}).textContent || ''));
verificar(true, 'percurso: endereço aproximado de onde a entrada fora da obra foi batida');
await page.goto(BASE + '#/crew/dia/f-diego/2026-09-29');
await page.waitForSelector('#mapa-dia.com-ruas .leaflet-interactive');
verificar(await page.locator('#mapa-dia path[fill="#F04438"]').count() > 0, 'mapa do dia (ruas): trilha fora da cerca');
verificar(await page.locator('#mapa-dia .mapa-rotulo-obra').count() === 1, 'mapa do dia: nome da obra na cerca');
const alturaMapa = await page.locator('#mapa-dia').evaluate((el) => el.getBoundingClientRect().height);
verificar(alturaMapa >= 380, 'mapa do dia maior (' + Math.round(alturaMapa) + ' px de altura)');
await page.click('[data-acao="crew-mapa-cheio"]');
const cheio = await page.locator('#mapa-cartao').evaluate((el) => el.getBoundingClientRect().height);
verificar(cheio >= 840, 'tela cheia ocupa a tela toda');
await print('8b-mapa-cheio');
await page.keyboard.press('Escape');
verificar((await page.textContent('.linha-tempo')).includes('Saiu da cerca com o ponto aberto'), 'linha do tempo: saída da cerca com o ponto aberto');
verificar(await page.locator('.percurso .perna-saida-cerca').count() === 1, 'percurso: saída da cerca como trecho de ida e volta');
await print('8-mapa');

// Settings: só o escritório; funcionários, encargos e regras com vigência, auditoria
console.log('Settings');
await page.goto(BASE + '#/inicio');
await page.waitForSelector('.modulos');
verificar(await page.locator('.modulos .modulo-settings').count() === 1, 'Settings aparece para o escritório');
const totalSemana = async (seg) => { await page.goto(BASE + '#/crew/custos/semana/' + seg); await page.waitForSelector('.kpi'); return kpiNum('Total da semana'); };
const extrasAtual = async () => { await page.goto(BASE + '#/crew/timesheets/2026-10-05'); await page.waitForSelector('.kpi'); return (await page.locator('.kpi', { hasText: 'Horas extras' }).locator('b').textContent()).trim(); };
const antesPassada = await totalSemana('2026-09-28'), antesCorrente = await totalSemana('2026-10-05');
await page.goto(BASE + '#/settings/encargos/nova');
await page.waitForSelector('#form-encargos');
await page.fill('#form-encargos [name="pct-3"]', '20');
await page.fill('#form-encargos [name="desde"]', '2026-09-28');
await page.fill('#form-encargos [name="motivo"]', 'Renovação da apólice');
await page.click('[data-acao="settings-salvar-encargos"]');
await page.waitForFunction(() => /Não vale para o passado/.test((document.getElementById('toast') || {}).textContent || ''));
verificar(true, 'encargos: não vale para semana já fechada');
await page.fill('#form-encargos [name="desde"]', '2026-10-05');
await page.click('[data-acao="settings-salvar-encargos"]');
await page.waitForSelector('.total-encargos');
verificar((await page.textContent('.total-encargos')).includes('38,05%'), 'encargos: nova versão vigente (38,05%)');
verificar(await totalSemana('2026-09-28') === antesPassada, 'encargos novos não mudam o custo da semana passada');
verificar(await totalSemana('2026-10-05') > antesCorrente, 'encargos novos valem a partir da semana atual');
const extrasAntes = await extrasAtual();
await page.goto(BASE + '#/settings/regras/nova');
await page.waitForSelector('#form-regra');
await page.click('[data-acao="settings-modelo"][data-modelo="diaria"]');
await page.fill('#form-regra [name="desde"]', '2026-10-07');
await page.fill('#form-regra [name="motivo"]', 'Teste de hora extra diária');
await page.click('[data-acao="settings-salvar-regra"]');
await page.waitForSelector('.lista-regras');
verificar((await page.textContent('.lista-regras')).includes('Acima de 8 h no dia'), 'regra de jornada com hora extra diária (vale da segunda da semana)');
const extrasDepois = await extrasAtual();
verificar(extrasAntes === '0h00' && extrasDepois !== '0h00', 'hora extra diária aparece no timesheet (' + extrasAntes + ' → ' + extrasDepois + ')');
await page.goto(BASE + '#/settings/funcionario/novo');
await page.waitForSelector('#form-func');
await page.fill('#form-func [name="nome"]', 'Pedro Alves');
await page.fill('#form-func [name="codigo"]', 'E-200');
await page.selectOption('#form-func [name="classificacao"]', '1099');
await page.fill('#form-func [name="funcao"]', 'Pintor');
await page.selectOption('#form-func [name="equipeId"]', 'eq-a');
await page.fill('#form-func [name="valorHora"]', '35');
await page.fill('#form-func [name="cert-nome-0"]', 'OSHA 10');
await page.fill('#form-func [name="cert-validade-0"]', '2027-03-01');
await page.click('[data-acao="settings-salvar-func"]');
await page.waitForSelector('.dados-func');
verificar((await page.textContent('.pagina')).includes('Autônomo (1099)') && (await page.textContent('.kpis')).includes('Não se aplica'), 'funcionário autônomo (1099): sem hora extra');
verificar((await page.locator('.kpi', { hasText: 'Custo carregado' }).textContent()).includes('35,00'), 'autônomo: custo carregado sem encargos');
await print('10-settings-funcionario');
await page.click('a:has-text("Editar cadastro")');
await page.waitForSelector('#form-func');
await page.selectOption('#form-func [name="situacao"]', 'desligado');
await page.fill('#form-func [name="desligamento"]', '2026-10-07');
await page.click('[data-acao="settings-salvar-func"]');
await page.waitForSelector('.dados-func');
await page.goto(BASE + '#/settings/funcionarios');
await page.waitForSelector('.tabela-funcionarios');
verificar(!(await page.textContent('.tabela-funcionarios')).includes('Pedro Alves'), 'desligado sai da lista de ativos');
verificar(await page.locator('.lateral-item', { hasText: 'Funcionários' }).locator('.contador').count() === 1, 'aviso de certificação a vencer no menu');
verificar((await page.textContent('.sino')).includes('OSHA 30'), 'sininho: certificação do Carlos vencendo');
await print('10b-settings-lista');
await page.goto(BASE + '#/settings/auditoria');
await page.waitForSelector('.lista-auditoria');
const aud = await page.textContent('.lista-auditoria');
verificar(['Encargos', 'Regras de jornada', 'Cadastro de Pedro Alves', 'Valor hora de Lucas Oliveira'].every((t) => aud.includes(t)), 'auditoria registra encargos, regra, cadastro e valor hora');
await print('10c-settings-auditoria');
await como('u-carlos', '#/settings/funcionarios');
await page.waitForSelector('.modulos');
verificar(await page.locator('.modulos .modulo-settings').count() === 0, 'campo não vê nem abre o Settings');

// Permissões: perfis de acesso configuráveis no Settings
console.log('Permissões');
await como('u-diego', '#/inicio');
await page.reload(); // mesmo endereço do usuário anterior: recarrega para entrar como Diego
await page.waitForSelector('.meu-ponto');
verificar(page.url().endsWith('#/crew/meu'), 'trabalhador entra direto no Meu ponto, sem a tela de módulos');
verificar(await page.locator('.topo-botao[aria-label="Módulos"]').count() === 0 && await page.locator('.lateral').count() === 0, 'trabalhador: sem botão de módulos e sem menu');
const notaDiego = 'Material atrasou, fiquei ajudando na descarga';
if (await page.locator('.meu-ponto [data-acao="crew-saida"]').count()) {
  await page.click('.meu-ponto [data-acao="crew-saida"]');
  await page.fill('dialog textarea[name="nota"]', notaDiego);
  await page.click('dialog button:has-text("Bater saída")');
} else {
  await page.click('.meu-ponto [data-acao="crew-entrada"]');
  await page.fill('dialog textarea[name="nota"]', notaDiego);
  await page.click('dialog button:has-text("Bater entrada")');
}
await page.waitForFunction(() => /Saiu às|Trabalhando desde/.test(document.querySelector('.meu-ponto').textContent) && /Saída|Entrada/.test(document.querySelector('.linha-tempo').textContent));
verificar(true, 'trabalhador bate o próprio ponto');
await page.waitForSelector('.linha-tempo .nota-batida');
verificar((await page.textContent('.linha-tempo')).includes(notaDiego), 'nota na batida: aparece junto da batida no Meu ponto');
verificar(await page.locator('.minha-semana .total').count() === 1 && !(await page.textContent('.pagina')).includes('US$'), 'trabalhador vê as próprias horas, sem valores em dinheiro');
await print('11-meu-ponto');
for (const h of ['#/crew/agora', '#/daily/painel', '#/settings/funcionarios']) {
  await page.goto(BASE + h);
  await page.waitForSelector('.meu-ponto');
  verificar(page.url().endsWith('#/crew/meu'), 'trabalhador não abre ' + h);
}
await como('u-marcia', '#/inicio');
await page.waitForSelector('.modulos');
verificar(await page.locator('.modulos .modulo-daily').count() === 1 && await page.locator('.modulos .modulo-crew').count() === 1 && await page.locator('.modulos .modulo-settings').count() === 0, 'gestor de obras vê os módulos, sem o Settings');
await page.goto(BASE + '#/crew/custos');
await page.waitForSelector('.custo-obra');
verificar(true, 'gestor vê os custos');
const hojeIso = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
await como('u-ana', '#/crew/dia/f-diego/' + hojeIso);
await page.waitForSelector('.nota-batida');
verificar((await page.textContent('.pagina')).includes(notaDiego), 'o escritório vê a nota no dia do funcionário');
await como('u-ana', '#/settings/perfis');
await page.waitForSelector('.matriz-perfis');
verificar(await page.locator('.matriz-perfis input[name^="administrador|"]:disabled').count() > 0, 'perfil Administrador é fixo');
verificar((await page.textContent('.linha-inicio')).includes('Direto no "Meu ponto"'), 'matriz mostra para onde cada perfil vai ao entrar');
await print('12-perfis');
await page.check('.matriz-perfis input[name="trabalhador|daily.preencher"]');
await page.click('[data-acao="settings-salvar-perfis"]');
await page.waitForFunction(() => /Permissões salvas/.test((document.getElementById('toast') || {}).textContent || ''));
await como('u-diego', '#/inicio');
await page.waitForSelector('.modulos');
verificar(await page.locator('.modulos .modulo-daily').count() === 1 && await page.locator('.modulos .modulo-crew').count() === 1, 'trabalhador que também preenche o RDO passa a ver a tela de módulos');
await como('u-ana', '#/settings/perfis');
await page.waitForSelector('.matriz-perfis');
await page.click('[data-acao="settings-novo-perfil"]');
await page.fill('dialog input[name="nome"]', 'Encarregado com aprovação');
await page.selectOption('dialog select[name="base"]', 'encarregado');
await page.click('dialog button:has-text("Criar perfil")');
await page.waitForFunction(() => /Encarregado com aprovação/.test(document.querySelector('.matriz-perfis thead').textContent));
verificar(true, 'novo perfil criado a partir de outro');
await page.goto(BASE + '#/settings/usuario/novo');
await page.waitForSelector('#form-usuario');
await page.fill('#form-usuario [name="nome"]', 'Bruno Alves');
await page.fill('#form-usuario [name="email"]', 'bruno@construtoraexemplo.com');
await page.check('#form-usuario input[value="trabalhador"]');
await page.click('[data-acao="settings-salvar-usuario"]');
await page.waitForFunction(() => /ligue o usuário ao cadastro/.test((document.getElementById('toast') || {}).textContent || ''));
verificar(true, 'quem bate o próprio ponto precisa estar ligado ao funcionário');
await page.selectOption('#form-usuario [name="funcionarioId"]', 'f-bruno');
await page.click('[data-acao="settings-salvar-usuario"]');
await page.waitForSelector('.tabela-usuarios-settings');
verificar((await page.textContent('.tabela-usuarios-settings')).includes('bruno@construtoraexemplo.com'), 'novo usuário ligado ao funcionário');
await page.goto(BASE + '#/settings/auditoria');
await page.waitForSelector('.lista-auditoria');
verificar((await page.textContent('.lista-auditoria')).includes('Permissões do perfil Trabalhador') && (await page.textContent('.lista-auditoria')).includes('Novo usuário: Bruno Alves'), 'auditoria registra permissões e usuários');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.join(' | ') : ''));
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
await browser.close();
process.exit(falhas ? 1 : 0);
