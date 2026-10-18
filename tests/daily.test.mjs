/* KORbuild — o Daily da página oficial (fatia 3; docs/banco.md §10), de ponta a ponta.
 * As telas do protótipo, com o espelho do banco no aparelho (js/espelho.js) e a sincronização (js/sincronizacao.js):
 *   José (Encarregado da prestadora A) preenche e envia, com foto; sem internet o diário fica no aparelho e sobe
 *   quando o sinal volta; Ana (Administradora da A) aprova a obra própria (HS-13) e não a da construtora;
 *   Tom (Administrador da construtora B) recebe e aprova o diário da obra ligada (HS-11); o cliente abre o link.
 * Duas formas de rodar, com os mesmos passos:
 *   --local  (padrão) contra o "Supabase local" (tools/supabase-local.sh: banco + PostgREST), sem rede;
 *   --real   contra o Supabase do projeto (precisa de SUPABASE_ACCESS_TOKEN): login, Storage e a função
 *            diario-publico de verdade; cria usuários kb-e2e-daily-…@example.com e apaga tudo no fim.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/daily.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, arquivosDaPasta, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Daily contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 15000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };

// ---------- A cena: duas empresas, três pessoas, duas obras (uma ligada à construtora) ----------
const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', jose: 'kb-e2e-daily-jose-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), jose: await criarUsuario(EMAIL.jose, 'José Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
const perfis = await rest(ID.ana, '/perfis_acesso?select=id,chave');
const token = await rest(ID.ana, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: EMAIL.jose, p_nome: 'José Local', p_perfil: perfis.find((p) => p.chave === 'encarregado').id } });
await rest(ID.jose, '/rpc/aceitar_convite', { metodo: 'POST', corpo: { p_token: token } });
const jose = (await rest(ID.jose, '/membros?select=id&user_id=eq.' + ID.jose))[0];
const [cliente, construtora] = await rest(ID.ana, '/contatos', { metodo: 'POST', corpo: [{ nome: 'Cliente Direto', papeis: ['cliente'] }, { nome: 'Construtora B', papeis: ['construtora'] }] });
const obra = (nome, ct) => ({ nome, contratante_id: ct, municipio: 'Manchester', estado: 'NH', lat: 43.004, lon: -71.4635, inicio: '2026-01-01', prazo: '2027-12-31', responsavel_id: jose.id, dias_trabalho: [0, 1, 2, 3, 4, 5, 6] });
const [obraPropria, obraLigada, obraAjustes, obraConflito] = await rest(ID.ana, '/obras', { metodo: 'POST', corpo: [obra('Residência Própria', cliente.id), obra('Obra da Construtora', construtora.id), obra('Casa dos Ajustes', cliente.id), obra('Casa do Conflito', cliente.id)] });
const B = await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
const [dono] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Dono', papeis: ['cliente'] } });
const [obraB] = await rest(ID.tom, '/obras', { metodo: 'POST', corpo: { nome: 'Obra B', contratante_id: dono.id, municipio: 'Nashua', estado: 'NH', lat: 42.76, lon: -71.46, inicio: '2026-01-01', prazo: '2027-12-31' } });
await sqlExec(`update public.obras set vinculo_empresa_id = '${B}', vinculo_obra_id = '${obraB.id}' where id = '${obraLigada.id}'`);   // a ligação nasce das concorrências (fatia 7)

// ---------- O navegador ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];   // o que o navegador viu de estranho: erros, pedidos que falharam, respostas 4xx/5xx
const paginas = new Map();
async function aparelho(quem, largura) {
  const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 }, geolocation: { latitude: 43.0041, longitude: -71.4635, accuracy: 8 }, permissions: ['geolocation'] });
  if (quem) await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem)]);
  else await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } });
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://api.open-meteo.com/**', (route) => {
    const time = [], weather_code = [], precipitation = [], temperature_2m = [];
    for (let h = 0; h < 24; h++) { time.push('2026-01-01T' + String(h).padStart(2, '0') + ':00'); weather_code.push(0); precipitation.push(0); temperature_2m.push(20); }
    route.fulfill({ json: { hourly: { time, weather_code, precipitation, temperature_2m } } });
  });
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push(quem + ' [' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('requestfailed', (r) => { if (!/fonts|tile\.openstreetmap|open-meteo|osrm|nominatim|unpkg|jsdelivr/.test(r.url())) diag.push(quem + ' [falhou] ' + r.method() + ' ' + r.url().slice(0, 160) + ' ' + (r.failure() || {}).errorText); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push(quem + ' [' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  paginas.set(quem, p);
  return { ctx, p };
}
const rdos = async (obraId) => sql(`select id, status, numero, codigo, aprovado_por_empresa, (select count(*) from public.rdo_fotos f where f.rdo_id = r.id)::int fotos from public.rdos r where obra_id = '${obraId}' order by data`);

async function preencherEEnviar(p, obraId, comFoto, semRede) {
  await p.goto(BASE + '#/daily/campo/obra/' + obraId);
  await p.waitForSelector('[data-acao="novo-rdo"], [data-acao="copiar-rdo"]', { timeout: 20000 });
  await p.click('[data-acao="novo-rdo"]');
  await p.waitForSelector('#s-clima');
  if (semRede) {   // sem internet não há clima automático: marca à mão, como no canteiro
    await p.click('[data-acao="clima-tempo"][data-turno="manha"][data-valor="sol"]');
    await p.click('[data-acao="clima-tempo"][data-turno="tarde"][data-valor="sol"]');
  }
  try {
    await p.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2, null, { timeout: 15000 });
  } catch (e) {   // para quem lê a saída sem ver a tela: o que o bloco do clima mostrava e o que o navegador avisou
    const clima = await p.evaluate(() => { const c = document.getElementById('s-clima'); return c ? c.innerText.replace(/\s+/g, ' ').slice(0, 300) + ' · onLine=' + navigator.onLine + ' · marcados=' + document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length : 'sem #s-clima'; }).catch(() => '?');
    console.log('      [clima] ' + clima);
    throw e;
  }
  await p.locator('[data-acao="equipe-add"]').first().click();
  await p.locator('#s-atividades textarea').first().fill('Framing das paredes do 1º pavimento');
  await p.locator('#s-atividades textarea').first().blur();
  if (comFoto) {
    const jpeg = await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 800; c.height = 600; const x = c.getContext('2d'); x.fillStyle = '#c84'; x.fillRect(0, 0, 800, 600); return c.toDataURL('image/jpeg', 0.9).split(',')[1]; });
    await p.setInputFiles('input[data-fotos="camera"]', { name: 'IMG_1.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
    await p.waitForSelector('#s-fotos .foto img[src^="blob:"]', { timeout: 20000 });
  }
  await p.click('[data-acao="enviar"]');
  if (!comFoto) { await p.waitForSelector('dialog button:has-text("Enviar sem fotos")'); await p.click('dialog button:has-text("Enviar sem fotos")'); }
}

try {
  console.log('José preenche e envia (com internet, com foto)');
  const j = await aparelho('jose');
  await j.p.goto(BASE + '#/daily');
  await j.p.waitForURL((u) => String(u).includes('#/daily/campo'), { timeout: 20000 }).catch(() => null);
  verificar(j.p.url().includes('#/daily/campo'), 'o Encarregado entra direto no "Hoje" do Daily', j.p.url());
  verificar(await j.p.locator('.cartao-obra').count() === 4, 'as obras da empresa aparecem no campo', await j.p.locator('.cartao-obra').count());
  await preencherEEnviar(j.p, obraPropria.id, true);
  const subiu = await esperarAte(async () => { const x = (await rdos(obraPropria.id)); return x.length === 1 && x[0].status === 'enviado' && x[0].fotos === 1; });
  verificar(subiu, 'o diário chegou ao banco, enviado e com a foto', (await rdos(obraPropria.id)));
  const noStorage = await arquivosDaPasta(A + '/' + obraPropria.id + '/');
  verificar(noStorage.length === 2, 'a foto e a miniatura foram para o Storage, na pasta da empresa', noStorage);

  console.log('Sem internet: fica no aparelho e sobe quando o sinal volta');
  await j.ctx.setOffline(true);
  await preencherEEnviar(j.p, obraLigada.id, false, true);
  await j.p.waitForTimeout(1500);
  verificar((await rdos(obraLigada.id)).length === 0, 'sem internet, nada chega ao banco');
  const guardado = await j.p.evaluate((id) => { const b = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.startsWith('kbt.oficial.v1.')))); return Object.values(b.empresas).flatMap((d) => d.rdos).some((r) => r.obraId === id && r.status === 'enviado'); }, obraLigada.id);
  verificar(guardado, 'o diário enviado ficou guardado no aparelho');
  await j.ctx.setOffline(false);
  await j.p.evaluate(() => window.dispatchEvent(new Event('online')));
  verificar(await esperarAte(async () => { const x = (await rdos(obraLigada.id)); return x.length === 1 && x[0].status === 'enviado'; }), 'com o sinal de volta, o diário subiu sozinho', (await rdos(obraLigada.id)));

  console.log('Ana aprova a obra própria (HS-13), não a da construtora (HS-11)');
  const a = await aparelho('ana', 1280);
  const r1 = (await rdos(obraPropria.id))[0], r2 = (await rdos(obraLigada.id))[0];
  await a.p.goto(BASE + '#/daily/painel/rdo/' + r2.id);
  await a.p.waitForSelector('.relatorio, .relatorio-tela, #conteudo', { timeout: 20000 });
  await a.p.waitForTimeout(800);
  verificar(await a.p.locator('[data-acao="aprovar"]').count() === 0, 'na obra da construtora, a prestadora não tem o botão de aprovar');
  await a.p.goto(BASE + '#/daily/painel/rdo/' + r1.id);
  await a.p.waitForSelector('[data-acao="aprovar"]', { timeout: 20000 });
  await a.p.waitForSelector('img[data-foto][src]', { timeout: 15000 }).catch(() => null);
  await a.p.click('[data-acao="aprovar"]');
  await a.p.click('dialog button:has-text("Aprovar e lacrar")');
  verificar(await esperarAte(async () => (await rdos(obraPropria.id))[0].status === 'aprovado'), 'aprovado e lacrado no banco', (await rdos(obraPropria.id)));
  const codigo = (await rdos(obraPropria.id))[0].codigo;
  verificar(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(codigo || ''), 'o código do lacre veio do banco', codigo);
  await a.p.waitForFunction((c) => document.body.innerText.includes(c), codigo, { timeout: 10000 }).catch(() => null);
  verificar((await a.p.locator('body').innerText()).includes(codigo), 'a tela mostra o código do banco', codigo);

  console.log('Tom (construtora) recebe e aprova o diário da obra ligada');
  const t = await aparelho('tom', 1280);
  await t.p.goto(BASE + '#/daily/aprovacoes');
  await t.p.waitForSelector('#conteudo', { timeout: 20000 });
  await t.p.waitForFunction(() => document.body.innerText.includes('Obra da Construtora'), null, { timeout: 15000 }).catch(() => null);
  verificar((await t.p.locator('body').innerText()).includes('Obra da Construtora'), 'o diário da prestadora aparece nas aprovações da construtora');
  await t.p.goto(BASE + '#/daily/painel/rdo/' + r2.id);
  await t.p.waitForSelector('[data-acao="aprovar"]', { timeout: 20000 }).catch(async () => console.log('      (erros: ' + erros.join(' | ') + ')\n      (tela da construtora: ' + t.p.url() + ' · ' + (await t.p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400) + ')'));
  await t.p.click('[data-acao="aprovar"]');
  await t.p.click('dialog button:has-text("Aprovar e lacrar")');
  verificar(await esperarAte(async () => (await rdos(obraLigada.id))[0].status === 'aprovado'), 'a construtora aprovou no banco', (await rdos(obraLigada.id)));
  verificar(((await rdos(obraLigada.id))[0].aprovado_por_empresa || '').startsWith('Construtora Local'), 'quem aprovou: a construtora', (await rdos(obraLigada.id))[0]);

  console.log('Pedir ajustes e reenviar');
  await preencherEEnviar(j.p, obraAjustes.id, false);
  verificar(await esperarAte(async () => ((await rdos(obraAjustes.id))[0] || {}).status === 'enviado'), 'diário enviado para a Ana revisar');
  const r3 = (await rdos(obraAjustes.id))[0];
  await a.p.goto(BASE + '#/daily/painel/rdo/' + r3.id);
  await a.p.waitForSelector('[data-acao="pedir-ajustes"]', { timeout: 20000 });
  await a.p.click('[data-acao="pedir-ajustes"]');
  await a.p.fill('dialog textarea[name="motivo"]', 'Falta a foto da parede norte');
  await a.p.click('dialog button:has-text("Enviar pedido")');
  verificar(await esperarAte(async () => (await rdos(obraAjustes.id))[0].status === 'ajustes'), 'ajustes pedidos no banco', (await rdos(obraAjustes.id)));
  await j.p.goto(BASE + '#/daily/campo/obra/' + obraAjustes.id);
  await j.p.click('#conexao');   // relê o banco (o pedido de ajustes chega ao canteiro)
  await j.p.goto(BASE + '#/daily/campo/rdo/' + r3.id);
  await j.p.waitForSelector('[data-acao="enviar"]', { timeout: 20000 });
  verificar((await j.p.textContent('[data-acao="enviar"]')).includes('Reenviar') && (await j.p.locator('body').innerText()).includes('Falta a foto da parede norte'), 'no canteiro, o diário volta editável com o pedido e "Reenviar"');
  await j.p.locator('#s-atividades textarea').first().fill('Framing das paredes, com a foto da parede norte');
  await j.p.locator('#s-atividades textarea').first().blur();
  await j.p.click('[data-acao="enviar"]');
  await j.p.waitForSelector('dialog button:has-text("Enviar sem fotos")').then(() => j.p.click('dialog button:has-text("Enviar sem fotos")')).catch(() => null);
  verificar(await esperarAte(async () => (await rdos(obraAjustes.id))[0].status === 'enviado'), 'reenviado com os ajustes', (await rdos(obraAjustes.id)));
  verificar((await sql(`select 1 from public.rdo_historico where rdo_id = '${r3.id}' and acao = 'Reenviou com os ajustes'`)).length === 1, 'o histórico registra o reenvio (uma vez)');

  console.log('Dois aparelhos mexem no mesmo diário');
  await j.p.goto(BASE + '#/daily/campo/obra/' + obraConflito.id);
  await j.p.waitForSelector('[data-acao="novo-rdo"]', { timeout: 20000 });
  await j.p.click('[data-acao="novo-rdo"]');
  await j.p.waitForSelector('#s-atividades textarea');
  await j.p.locator('#s-atividades textarea').first().fill('Versão do primeiro aparelho');
  await j.p.locator('#s-atividades textarea').first().blur();
  await j.p.click('#conexao');
  verificar(await esperarAte(async () => (await rdos(obraConflito.id)).length === 1), 'o rascunho também sobe (cópia de segurança no banco)');
  const r4 = (await rdos(obraConflito.id))[0];
  const j2 = await aparelho('jose');
  await j2.p.goto(BASE + '#/daily/campo/rdo/' + r4.id);
  await j2.p.waitForSelector('#s-atividades textarea', { timeout: 20000 });
  verificar((await j2.p.locator('#s-atividades textarea').first().inputValue()) === 'Versão do primeiro aparelho', 'o outro aparelho abre o mesmo rascunho');
  await j2.p.locator('#s-atividades textarea').first().fill('Versão do segundo aparelho');
  await j2.p.locator('#s-atividades textarea').first().blur();
  await j2.p.click('#conexao');
  verificar(await esperarAte(async () => (await sql(`select conteudo #>> '{atividades,0,descricao}' d from public.rdos where id = '${r4.id}'`))[0].d === 'Versão do segundo aparelho'), 'o segundo aparelho gravou primeiro');
  await j.p.locator('#s-atividades textarea').first().fill('Versão do primeiro aparelho, corrigida');
  await j.p.locator('#s-atividades textarea').first().blur();
  await j.p.click('#conexao');
  const dialogo = await j.p.waitForSelector('dialog:has-text("Este diário mudou em outro aparelho")', { timeout: 15000 }).catch(() => null);
  verificar(!!dialogo, 'o primeiro aparelho é avisado do conflito e escolhe');
  if (dialogo) await j.p.click('dialog button:has-text("Ficar com a deste aparelho")');
  verificar(await esperarAte(async () => (await sql(`select conteudo #>> '{atividades,0,descricao}' d from public.rdos where id = '${r4.id}'`))[0].d === 'Versão do primeiro aparelho, corrigida'), 'ficou a versão escolhida');

  console.log('Servidor fora do ar: o app abre com o que está no aparelho');
  await j.ctx.unrouteAll({ behavior: 'ignoreErrors' });
  await j.ctx.route(URL_PROJETO.replace(/\/$/, '') + '/**', (r) => r.abort('internetdisconnected'));
  await j.ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  await j.p.goto(BASE + '#/daily/campo');
  await j.p.reload();
  await j.p.waitForSelector('.cartao-obra', { timeout: 20000 }).catch(() => null);
  verificar(await j.p.locator('.cartao-obra').count() === 4 && j.p.url().includes('#/daily/campo'), 'sem servidor, o Daily abre com as obras do aparelho', j.p.url() + ' · ' + (await j.p.locator('body').innerText()).slice(0, 200));

  console.log('O cliente abre o link, sem login');
  const c = await aparelho(null, 1024);
  await c.p.goto(BASE + '#/cliente/' + codigo);
  await c.p.waitForFunction(() => /Documento autêntico|Relatório não encontrado/.test(document.body.innerText), null, { timeout: 20000 }).catch(() => null);
  const txt = await c.p.locator('body').innerText();
  verificar(txt.includes('Documento autêntico') && txt.includes('Residência Própria'), 'o link mostra o relatório e o lacre conferido pelo banco', txt.slice(0, 300));
  verificar(await esperarAte(async () => (await c.p.locator('img[data-foto][src]').count()) > 0, 8000), 'a foto aparece pelo link temporário');
  await c.p.goto(BASE + '#/cliente/0000-0000-0000');
  await c.p.waitForFunction(() => document.body.innerText.includes('Relatório não encontrado'), null, { timeout: 15000 }).catch(() => null);
  verificar((await c.p.locator('body').innerText()).includes('Relatório não encontrado'), 'código errado: "Relatório não encontrado"');

  verificar(erros.length === 0, 'sem erros nas páginas' + (erros.length ? ': ' + erros.slice(0, 4).join(' | ') : ''));
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  if (falhas) {   // para quem lê a saída sem ver a tela: o que cada aparelho mostrava
    for (const [quem, p] of paginas) console.log('      [' + quem + '] ' + p.url() + ' · aviso: ' + ((await p.locator('#toast').textContent().catch(() => '')) || '').slice(0, 120) + ' · obras na tela: ' + (await p.locator('.cartao-obra').count().catch(() => '?')));
    for (const e of erros.slice(0, 5)) console.log('      [erro de JavaScript] ' + e);
    for (const l of diag.slice(0, 25)) console.log('      ' + l);
  }
  await browser.close();
  await limpar();
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
