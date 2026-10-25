/* KORbuild — capturas das telas do Takeoff e das Licitações (concorrências) para a documentação funcional.
 * Usa o protótipo (?demo), que já traz projetos, assemblies, preços e concorrências de exemplo. Só leitura: nada é gravado fora do navegador.
 * Uso: python3 -m http.server 8123 &  →  node tools/capturas-modulos.mjs <pasta de saída> [http://localhost:8123/] */

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const IDIOMA = process.env.IDIOMA === 'en' ? 'en' : 'pt';
const saida = process.argv[2];
if (!saida) { console.error('Uso: node tools/capturas-modulos.mjs <pasta de saída> [url]'); process.exit(1); }
const BASE = (process.argv[3] || 'http://localhost:8123/').replace(/\/?$/, '/') + '?demo';
mkdirSync(saida, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
async function sessao(usuario) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((idioma) => { try { localStorage.setItem('kbt.idioma', idioma); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* sem armazenamento */ } }, IDIOMA);
  await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo/, (r) => r.abort());
  const p = await ctx.newPage();
  await p.goto(BASE);
  await p.waitForSelector('#form-login', { timeout: 30000 });
  await p.evaluate((u) => localStorage.setItem('kbt.sessao', u), usuario);
  await p.goto('about:blank');
  await p.goto(BASE + '#/inicio');
  await p.waitForTimeout(800);
  return p;
}
const ir = async (p, rota, espera = 700) => { await p.goto(BASE + rota); await p.waitForTimeout(espera); };
const foto = async (p, nome, opcoes = {}) => { await p.screenshot({ path: saida + '/' + nome + '.png', fullPage: !!opcoes.pagina }); console.log('  ' + nome); };
const primeiro = async (p, seletor) => (await p.locator(seletor).first().getAttribute('href').catch(() => null));

console.log('Takeoff (estimador)');
{
  const p = await sessao('u-tom');
  await ir(p, '#/measure');
  await foto(p, 'tk-01-projetos', { pagina: true });
  await ir(p, '#/measure/projeto/novo');
  await foto(p, 'tk-02-novo-projeto', { pagina: true });
  await ir(p, '#/measure');
  const hp = await primeiro(p, 'a[href*="#/measure/projeto/"]:not([href$="novo"])');
  if (hp) {
    const id = hp.split('/projeto/')[1].split('/')[0];
    await ir(p, '#/measure/projeto/' + id);
    await foto(p, 'tk-03-projeto', { pagina: true });
    const hf = await primeiro(p, 'a[href*="#/measure/folha/"]');
    if (hf) { await ir(p, hf.replace(/^.*#/, '#'), 2500); await foto(p, 'tk-04-visor'); }
    await ir(p, '#/measure/projeto/' + id + '/cotacao', 1200);
    await foto(p, 'tk-08-lista-cotacao', { pagina: true });
    await ir(p, '#/measure/projeto/' + id + '/proposta', 1200);
    await foto(p, 'tk-09-proposta', { pagina: true });
  }
  await ir(p, '#/measure/assemblies');
  await foto(p, 'tk-05-assemblies', { pagina: true });
  const ha = await primeiro(p, 'a[href*="#/measure/assembly/"]:not([href$="novo"])');
  if (ha) { await ir(p, ha.replace(/^.*#/, '#')); await foto(p, 'tk-06-assembly', { pagina: true }); }
  await ir(p, '#/measure/itens');
  await foto(p, 'tk-07-itens', { pagina: true });
  await ir(p, '#/measure/precos');
  await foto(p, 'tk-10-precos', { pagina: true });
  await p.context().close();
}

console.log('Licitações (quem contrata)');
{
  const p = await sessao('u-ana');
  await ir(p, '#/daily/concorrencias');
  await foto(p, 'li-01-lista', { pagina: true });
  await ir(p, '#/daily/concorrencias/nova');
  await foto(p, 'li-02-nova', { pagina: true });
  const hc = await primeiro(p, 'a[href*="#/daily/concorrencias/co-"]');
  await ir(p, '#/daily/concorrencias');
  const h2 = (await p.locator('a[href*="#/daily/concorrencias/co-"]').first().getAttribute('href').catch(() => null)) || hc;
  if (h2) {
    const base = h2.replace(/^.*#/, '#');
    await ir(p, base, 1200);
    await foto(p, 'li-03-detalhe-convidados', { pagina: true });
    for (const [aba, nome] of [[2, 'li-04-comparar'], [1, 'li-05-perguntas'], [3, 'li-06-detalhes']]) {
      await p.locator('.abas-sublinhadas a').nth(aba).click();
      await p.waitForTimeout(900);
      await foto(p, nome, { pagina: true });
    }
  }
  await p.context().close();
}

console.log('Licitações (quem recebe)');
{
  const p = await sessao('u-tom');
  await ir(p, '#/measure/convites');
  await foto(p, 'li-07-convites-recebidos', { pagina: true });
  const hv = await primeiro(p, 'a[href*="#/measure/convite/"]');
  if (hv) { await ir(p, hv.replace(/^.*#/, '#')); await foto(p, 'li-08-convite', { pagina: true }); }
  await p.context().close();
}
await browser.close();
