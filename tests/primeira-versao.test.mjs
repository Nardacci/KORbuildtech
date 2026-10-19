/* KORbuild — a 1ª versão (lançamento): só o Measure Takeoff e o Settings (js/versao.js), contra o Supabase local.
 * Daily, Crew, concorrências, cronograma, obras, funcionários e o protótipo ficam ocultos: nem nos menus, nem na tela de módulos, nem por endereço.
 * Uso: python3 -m http.server 8123 & bash tools/supabase-local.sh  →  node tests/primeira-versao.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const { sql, rest, criarUsuario, sessao, rotear, limpar, nome } = await import('./_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('1ª versão contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 400)) : '')); }
}

const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
async function aparelho(quem, versao) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(([s, v]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'en'); if (v) localStorage.setItem('kbt.versao', v); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem), versao]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  return { ctx, p };
}
const texto = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');

try {
  console.log('A tela de entrada');
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await ctx.route('https://fonts.**', (r) => r.abort());
    const p = await ctx.newPage();
    await p.goto(BASE + '?versao=primeira');
    await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
    const t = await texto(p);
    verificar(/Takeoff/.test(t) && !/Daily|Crew/.test(t), 'a entrada fala do Takeoff e não do Daily nem do Crew', t.slice(0, 300));
    verificar(await p.locator('a[href*="demo"]').count() === 0 && await p.locator('a[href*="teste-"]').count() === 0, 'sem link do protótipo nem dos roteiros de teste no celular');
    verificar(await p.evaluate(() => localStorage.getItem('kbt.versao')) === 'primeira', 'o ?versao=primeira fica guardado neste navegador');
    await p.goto(BASE + '?versao=completa');
    await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
    verificar(/Daily/.test(await texto(p)) && await p.locator('a[href*="demo"]').count() >= 1, '?versao=completa volta ao app inteiro (com o protótipo)');
    await ctx.close();
  }

  for (const quem of ['ana', 'tom']) {
    console.log('\nConta ' + (quem === 'ana' ? 'prestadora' : 'construtora') + ' na 1ª versão');
    const a = await aparelho(quem, 'primeira');
    await a.p.goto(BASE + '#/conta');
    await a.p.waitForSelector('.oficial-titulo, .ini-ola', { timeout: 30000 });
    const t = await texto(a.p);
    verificar(/Measure Takeoff|Takeoff/.test(t) && !/Daily|Crew/.test(t.replace(/Dados/g, '')), 'a área da conta oferece o Measure Takeoff e as concorrências, sem Daily nem Crew', t.slice(0, 400));
    await a.p.goto(BASE + '#/conta/obras');
    await a.p.waitForSelector('.lateral-item', { timeout: 30000 });
    const abas = (await a.p.locator('.lateral-item').allInnerTexts()).map((x) => x.trim());
    verificar(!abas.some((x) => /Employees|Rules|Funcion/.test(x)) && abas.some((x) => /Contacts|Contatos/.test(x)) && abas.some((x) => /Jobs|Obras/.test(x)), 'o menu do Settings tem contatos e obras (as concorrências precisam da obra), mas não funcionários nem regras', abas);
    await a.p.goto(BASE + '#/inicio');
    await a.p.waitForSelector('.modulos, .oficial-titulo, .pagina, .ini-ola', { timeout: 30000 });
    await a.p.waitForTimeout(1500);
    const ti = await texto(a.p);
    verificar(!/Daily|Crew|Em breve|Coming soon/.test(ti.replace(/Dados/g, '')), 'o início não mostra nenhum outro módulo', (await a.p.evaluate(() => location.hash)) + ' · ' + ti.slice(0, 200));
    for (const rota of ['#/daily', '#/crew', '#/daily/painel', '#/daily/campo', '#/daily/obras', '#/settings/funcionarios', '#/conta/funcionarios', '#/conta/regras', '#/conta/obras/modelos']) {
      await a.p.goto(BASE + rota);
      await a.p.waitForTimeout(1200);
      const tr = await texto(a.p);
      verificar(!/Daily|Crew|Time clock|Employees|Em breve|Coming soon/.test(tr.replace(/Dados/g, '')) && !/^#\/(daily|crew)/.test(await a.p.evaluate(() => location.hash)), rota + ' não abre: volta para o que existe', (await a.p.evaluate(() => location.hash)) + ' · ' + tr.slice(0, 160));
    }
    // as concorrências (quem convida) ficam, dentro do Measure Takeoff, sem o resto do Daily
    await a.p.goto(BASE + '#/daily/concorrencias');
    await a.p.waitForTimeout(1500);
    const tc = await texto(a.p);
    verificar(/Bids/.test(tc) && /Takeoff/.test(tc) && !/Daily|Crew/.test(tc.replace(/Dados/g, '')) && /measure|concorrencias/.test(await a.p.evaluate(() => location.hash)), 'as concorrências abrem dentro do Measure Takeoff', (await a.p.evaluate(() => location.hash)) + ' · ' + tc.slice(0, 200));
    await a.p.goto(BASE + '#/conta/obras/nova');
    await a.p.waitForSelector('#form-obra', { timeout: 20000 });
    const to = await texto(a.p);
    verificar(!/Daily|Crew|time clock|geofence|fence|schedule|crew|Employees|diary|timesheet/i.test(to) && await a.p.locator('[name="responsavelId"], [name="diasTrabalho"]').count() >= 1, 'a obra (necessária para fechar a concorrência) abre sem diário, ponto nem cronograma', to.slice(0, 300));
    await a.p.goto(BASE + '#/measure');
    await a.p.waitForSelector('h1', { timeout: 30000 });
    const m = await texto(a.p);
    verificar(/Takeoff/.test(m), 'o Measure abre e se chama Takeoff', m.slice(0, 200));
    const menuMeasure = (await a.p.locator('.lateral a, nav a, aside a').allInnerTexts().catch(() => [])).join(' | ');
    verificar(/Invitations/.test(menuMeasure) && /Bids/.test(menuMeasure), 'o menu do Measure Takeoff tem os convites recebidos e as concorrências', menuMeasure.slice(0, 200));
    verificar(await a.p.locator('.sino summary').count() === 1, 'o sininho segue funcionando (sem avisos de outros módulos)');
    await a.ctx.close();
  }

  console.log('\nVersão completa intacta (homologação)');
  {
    const a = await aparelho('ana', null);
    await a.p.goto(BASE + '#/conta');
    await a.p.waitForSelector('.oficial-titulo', { timeout: 30000 });
    const t = await texto(a.p);
    verificar(/Daily/.test(t) && /Crew/.test(t) && !/Takeoff/.test(t), 'sem a 1ª versão, a conta continua com Daily, Crew e Measure', t.slice(0, 300));
    await a.ctx.close();
  }
  verificar(!erros.length, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.message ? e.message.split('\n')[0] : e));
} finally {
  await browser.close();
  await limpar();
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
