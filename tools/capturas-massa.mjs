/* KORbuild — capturas do portal sobre a MASSA DE DEMONSTRAÇÃO (tools/massa-demo.mjs + tools/massa-measure.mjs): telas da conta de verdade
 * com movimento (diários com fotos, cronograma atrasado, concorrência com propostas, ponto, Measure com proposta emitida, administração com etiquetas Demo).
 * Nada toca o Supabase do projeto: roda no banco LOCAL, depois de a massa ser carregada nele.
 * Uso: tools/supabase-local.sh ; python3 -m http.server 8123 &
 *      KOR_DEMO_SENHA='qualquer-12-caracteres' node --experimental-strip-types tools/massa-demo.mjs --fase=estrutura,ponto,diarios,cronograma,concorrencias,retroagir,planos
 *      KOR_DEMO_SENHA='…' node --experimental-strip-types tools/massa-measure.mjs
 *      node --experimental-strip-types tools/capturas-massa.mjs [http://localhost:8123/] [--idioma=pt]
 * Depois: python3 tools/gerar_portal.py */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sql, sqlExec, sessao, rotear } from '../tests/_supabase-local.mjs';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const IDIOMA = ((process.argv.find((a) => a.startsWith('--idioma=')) || '').slice(9)) || 'en';
const PASTA = fileURLToPath(new URL(IDIOMA === 'pt' ? '../portal/pt/img/' : '../portal/img/', import.meta.url));
mkdirSync(PASTA, { recursive: true });
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const email = (c, p) => `demo.${c}.${p}@example.com`;

const [dana] = await sql(`select id from auth.users where email = '${email('gc1', 'admin')}'`);
if (!dana) { console.error('A massa de demonstração não está no banco local (rode tools/massa-demo.mjs antes).'); process.exit(2); }
// a administração da plataforma precisa de um administrador: só no banco local
await sqlExec(`insert into public.admins_plataforma (user_id) values ('${dana.id}') on conflict do nothing`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let feitas = 0;
async function como(chave, papel, largura = 1280, altura = 800) {
  const [u] = await sql(`select id, email from auth.users where email = '${email(chave, papel)}'`);
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1.25, timezoneId: 'America/New_York' });
  await ctx.addInitScript(([s, idioma]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', idioma); } catch { /* */ } }, [await sessao(u.id, u.email, 'demo'), IDIOMA]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
  return { ctx, p: await ctx.newPage() };
}
async function abrir(p, hash, espera, pagina = 'index.html') {
  await p.goto(BASE + (pagina === 'index.html' ? '' : pagina) + hash);
  for (let t = 0; t < 2; t++) {
    try { await p.waitForSelector(espera, { timeout: 25000 }); break; } catch (e) { if (t) throw e; await p.reload(); }
  }
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(900);
}
const foto = async (p, nome, opcoes = {}) => { await p.screenshot({ path: PASTA + nome + '.png', ...opcoes }); feitas++; console.log('  ' + nome); };
const hrefs = (p, padrao) => p.$$eval(`a[href*="${padrao}"]`, (as) => [...new Set(as.map((a) => a.getAttribute('href')))]);

console.log('Construtora (Northfield Builders · Daily) em ' + IDIOMA);
{
  const { ctx, p } = await como('gc1', 'admin');
  await abrir(p, '#/daily/painel', '#app h1');
  await foto(p, 'live-gc-dashboard', { clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await abrir(p, '#/daily/aprovacoes', '#app h1');
  await foto(p, 'live-gc-approvals', { clip: { x: 0, y: 0, width: 1280, height: 620 } });
  const rdos = await hrefs(p, '/painel/rdo/');
  if (rdos.length) {
    await abrir(p, rdos[0], '#app h1');
    await foto(p, 'live-gc-review', { fullPage: true });
  }
  const obras = (await hrefs(p, '/daily/obras/')).filter((h) => !h.endsWith('/cronograma'));
  await abrir(p, '#/daily/obras', '#app h1');
  await foto(p, 'live-gc-jobs', { clip: { x: 0, y: 0, width: 1280, height: 700 } });
  await abrir(p, '#/daily/concorrencias', '#app h1');
  const comparar = await hrefs(p, '/comparar');
  if (comparar.length) { await abrir(p, comparar[0], '#app h1'); await foto(p, 'live-gc-bid-leveling', { fullPage: true }); }
  await ctx.close();
}

console.log('Prestadora (Summit Framing · cronograma, ponto)');
{
  const { ctx, p } = await como('s2', 'admin');
  await abrir(p, '#/daily/obras', '#app h1');
  await abrir(p, '#/daily/obras', '#app h1');
  const obrasDela = (await hrefs(p, '/daily/obras/')).filter((h) => !h.endsWith('/cronograma'));
  for (const h of obrasDela) {   // a primeira obra que já tem etapas
    await abrir(p, h, '#app h1');
    const cron = await hrefs(p, '/cronograma');
    if (!cron.length) continue;
    await abrir(p, cron[0], '#app h1');
    if (await p.$('.gantt, [class*="gantt"]')) { await foto(p, 'live-schedule', { fullPage: true }); break; }
  }
  await abrir(p, '#/crew', '#app h1');
  await foto(p, 'live-crew-now', { fullPage: true });
  await abrir(p, '#/crew/timesheets', '#app h1');
  await foto(p, 'live-crew-timesheets', { clip: { x: 0, y: 0, width: 1280, height: 800 } });
  await ctx.close();
}

console.log('Prestadora (Ridgeline Siding · Measure)');
{
  const { ctx, p } = await como('s1', 'admin');
  await abrir(p, '#/measure', 'table');
  await foto(p, 'live-measure-projects', { clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await ctx.close();
}

console.log('Prestadora independente (Lakeside Painting) · Measure e proposta');
{
  const { ctx, p } = await como('i1', 'admin');
  await abrir(p, '#/measure', 'table');
  await foto(p, 'live-measure-independent', { clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await ctx.close();
}

console.log('Administração da plataforma (etiqueta Demo, suspensa, teste vencido)');
{
  const { ctx, p } = await como('gc1', 'admin');
  await abrir(p, '#empresas', 'table.tabela tbody tr', 'admin.html');
  await foto(p, 'live-platform-admin-companies', { fullPage: true });
  await ctx.close();
}
await browser.close();
console.log(feitas + ' capturas em ' + PASTA);
