/* KORbuild — o sininho e as preferências de e-mail da página oficial (fatia 8b; docs/banco.md §15), de ponta a ponta.
 *   Ana (Administradora da prestadora A): um aviso gravado pelo servidor aparece no sininho, traduzido no idioma da tela; ao abrir,
 *   vira lido no banco; um aviso novo chega com o app aberto (ao voltar para a janela); em Meu perfil, ligar e desligar os avisos
 *   por e-mail grava em notificacao_prefs sem mexer no resto.
 * Duas formas de rodar: --local (padrão; tools/supabase-local.sh) ou --real (Supabase do projeto; usuários kb-e2e-daily-…).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/avisos-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Avisos contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };

const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = 'kb-e2e-daily-ana-' + sufixo + '@example.com';
const ID = await criarUsuario(EMAIL, 'Ana Local');
const A = await rest(ID, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
const aviso = (chave, dados, link, cat = 'daily') => sqlExec(`select public.notificar('${ID}', '${A}', '${cat}', '${chave.replace(/'/g, "''")}', '${JSON.stringify(dados)}'::jsonb, '${link}', null, false, true)`);
await aviso('RDO nº {numero} de {obra} aguardando aprovação', { numero: 3, obra: 'Obra X' }, '#/daily/painel/rdo/abc');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];
let pagina = null;
try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); if (!localStorage.getItem('kbt.idioma')) localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID, EMAIL, 'ana')]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  const p = pagina = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push('[' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push('[' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  const esperaEspelho = () => p.waitForFunction(async () => { const m = await import('./js/espelho.js'); return m.espelho.pronto && !m.espelho.lendo; }, null, { timeout: 30000 }).then(() => p.waitForTimeout(500));
  const contador = async () => ((await p.locator('details.sino .sino-contador').textContent().catch(() => '')) || '').trim();

  console.log('O sininho');
  await p.goto(BASE + '#/daily/painel');
  verificar(await esperarAte(async () => (await contador()) === '1'), 'o aviso do servidor aparece no sininho (1 não lida)');
  await esperaEspelho();
  await p.click('details.sino summary');
  const lista = await p.locator('.notif-lista').textContent();
  verificar(lista.includes('RDO nº 3 de Obra X aguardando aprovação'), 'o texto vem da chave e dos dados, no idioma da tela (pt)', lista.slice(0, 200));
  await p.click('.notif-lista a[data-acao="ler-notificacao"]');
  verificar(await esperarAte(async () => (await sql(`select lida_em is not null as lida from public.notificacoes where user_id = '${ID}'`))[0].lida), 'abrir o aviso grava lida_em no banco');
  // um aviso novo, com o app aberto: aparece ao voltar para a janela
  await p.goto(BASE + '#/daily/painel');
  await esperarAte(async () => (await contador()) === '');
  await aviso('Prazo prorrogado: {servico}', { servico: 'Framing' }, '#/measure/convite/c1', 'concorrencia');
  await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  verificar(await esperarAte(async () => (await contador()) === '1'), 'um aviso novo chega com o app aberto (sem recarregar)');
  await p.click('details.sino summary');
  await p.click('button[data-acao="ler-todas"]');
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.notificacoes where user_id = '${ID}' and lida_em is null`))[0].n === 0), '"Marcar todas como lidas" grava no banco');
  // em inglês
  await p.evaluate(() => localStorage.setItem('kbt.idioma', 'en'));
  await aviso('Sua semana de {semana} foi devolvida: {motivo}', { semana: '10/12', motivo: 'Falta a saída' }, '#/crew');
  await p.goto(BASE + '#/daily/painel');
  await p.reload();
  verificar(await esperarAte(async () => (await contador()) === '1'), 'o aviso novo está no sininho depois de recarregar');
  await p.click('details.sino summary');
  const lista2 = await p.locator('.notif-lista').textContent();
  verificar(lista2.includes('Your week of 10/12 was returned: Falta a saída'), 'em inglês o aviso sai traduzido', lista2.slice(0, 240));

  console.log('Meu perfil › Avisos por e-mail');
  await p.evaluate(() => localStorage.setItem('kbt.idioma', 'pt'));
  await p.goto(BASE + '#/conta/perfil');
  await p.reload();
  await p.waitForSelector('input[data-acao="of-pref-email"][data-categoria="daily"]', { timeout: 30000 });
  const marcados = await p.locator('input[data-acao="of-pref-email"]:checked').count();
  verificar(marcados === 4, 'sem escolha anterior, os 4 avisos estão ligados', marcados);
  await p.waitForTimeout(500);
  await p.uncheck('input[data-acao="of-pref-email"][data-categoria="daily"]');
  verificar(await esperarAte(async () => { const r = await sql(`select push, email from public.notificacao_prefs where user_id = '${ID}' and categoria = 'daily'`); return r.length === 1 && r[0].email === false && r[0].push === true; }), 'desligar grava email = falso e mantém o sininho ligado');
  await p.reload();
  await p.waitForSelector('input[data-acao="of-pref-email"][data-categoria="daily"]', { timeout: 30000 });
  await esperarAte(async () => (await p.locator('input[data-acao="of-pref-email"]:checked').count()) === 3);
  verificar((await p.locator('input[data-acao="of-pref-email"][data-categoria="daily"]').isChecked()) === false && (await p.locator('input[data-acao="of-pref-email"]:checked').count()) === 3, 'a escolha volta ao recarregar (3 ligados)');
  await p.check('input[data-acao="of-pref-email"][data-categoria="daily"]');
  verificar(await esperarAte(async () => (await sql(`select email from public.notificacao_prefs where user_id = '${ID}' and categoria = 'daily'`))[0].email === true), 'ligar de novo grava email = verdadeiro');
  // o banco respeita: com o e-mail desligado a pessoa não entra nos pendentes
  await p.uncheck('input[data-acao="of-pref-email"][data-categoria="concorrencia"]');
  await esperarAte(async () => (await sql(`select email from public.notificacao_prefs where user_id = '${ID}' and categoria = 'concorrencia'`)).length === 1);
  await aviso('Prazo prorrogado: {servico}', { servico: 'Siding' }, '#/measure/convite/c2', 'concorrencia');
  const pendentes = await sql(`select count(*)::int n from public.avisos_pendentes_email(50, 0) p, jsonb_array_elements(p.avisos) a where p.user_id = '${ID}' and a ->> 'categoria' = 'concorrencia'`);
  verificar(pendentes[0].n === 0, 'com os avisos de concorrência desligados por e-mail, o banco não os entrega à função de envio', pendentes);
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (falhas) {
    if (pagina) console.log('      [ana] ' + pagina.url() + ' · aviso: ' + (((await pagina.locator('#toast').textContent().catch(() => '')) || '').slice(0, 120)));
    for (const e of erros.slice(0, 5)) console.log('      [erro de JavaScript] ' + e);
    for (const l of diag.slice(0, 20)) console.log('      ' + l);
  }
  verificar(erros.length === 0, 'sem erros de JavaScript nas telas', erros.slice(0, 3));
  await browser.close();
  await limpar();
  if (REAL) {
    const resto = await sql(`select (select count(*) from public.empresas where nome like '%Local ${sufixo}')::int e`);
    verificar(resto[0].e === 0, 'a cena de teste foi apagada');
  }
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
