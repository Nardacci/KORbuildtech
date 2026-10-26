/* KORbuild — Itens e preços numa tela só (protótipo): lista com filtros, página do item (Detalhes, Preços, Usado em), histórico,
 * item inativo (nunca apagado) e preço desatualizado (mais de 12 meses).
 * Uso: python3 -m http.server 8123 &  →  node tests/itens.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/') + '?demo';
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 400)) : '')); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } });
await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo/, (r) => r.abort());
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => erros.push(e.message));
await p.goto(BASE);
await p.waitForSelector('#form-login', { timeout: 30000 });
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
const ir = async (rota, espera) => { await p.goto('about:blank'); await p.goto(BASE + rota); await p.waitForSelector(espera, { timeout: 10000 }); };
const visiveis = () => p.locator('#itens-tabela tbody tr:not([hidden])').count();

console.log('Lista');
await ir('#/measure/itens', '#itens-tabela');
verificar(await p.locator('.lateral-item:has-text("Preços")').count() === 0, 'o menu não tem mais a tela Preços: itens e preços ficam juntos');
const total = await visiveis();
verificar(total >= 20 && (await p.locator('#itens-tabela thead').innerText()).includes('Preço atual'), 'a lista mostra os itens ativos com o preço atual', total);
await p.fill('#itens-busca', 'osb');
verificar(await visiveis() === 1, 'a busca por nome ou código filtra na hora');
await p.fill('#itens-busca', '');
await p.selectOption('#itens-cat', 'mao-de-obra');
const mo = await visiveis();
verificar(mo > 0 && mo < total, 'o filtro por categoria', mo);
await p.selectOption('#itens-cat', '');
await p.selectOption('#itens-etapa', '07 46 33 · Plastic siding');
verificar(await visiveis() >= 2, 'o filtro por cost code');
await p.selectOption('#itens-etapa', '');

console.log('Novo item, preço e histórico');
await p.click('a[href="#/measure/item/novo"]');
await p.waitForSelector('#form-item');
await p.fill('#it-nome', 'Selante exterior');
await p.fill('#it-codigo', 'SL-EXT');
await p.fill('#it-un', 'tubo');
await p.fill('#it-etapa', '07 92 00 · Joint sealants');
await p.click('[data-acao="item-salvar"]');
await p.waitForSelector('.abas-sublinhadas');
verificar(p.url().endsWith('/prices') && (await p.locator('main').innerText()).includes('ainda não tem preço'), 'item criado sem preço abre na aba Preços, avisando que falta o preço');
await ir('#/measure/itens', '#itens-tabela');
await p.selectOption('#itens-st', 'sem-preco');
verificar(await visiveis() === 1 && (await p.locator('#itens-tabela tbody tr:not([hidden])').innerText()).includes('Selante exterior'), 'o filtro "Sem preço" mostra o item novo');
await p.locator('#itens-tabela tbody tr:not([hidden]) a').first().click();
await p.waitForSelector('.abas-sublinhadas');
await p.click('.abas-sublinhadas a:has-text("Preços")');
for (const [valor, desde] of [['8,40', '2026-08-01'], ['9,10', '2026-10-01']]) {
  await p.click('[data-acao="preco-novo"]');
  await p.fill('dialog input[name="valor"]', valor);
  await p.fill('dialog input[name="desde"]', desde);
  await p.click('dialog button:has-text("Salvar preço")');
  await p.waitForSelector('dialog', { state: 'detached' });
}
const hist = await p.locator('.tabela-historico tbody tr').count();
const txt = await p.locator('.tabela-historico').innerText();
verificar(hist === 2 && txt.includes('9,10') && txt.includes('8,40') && /\+8,3%/.test(txt) && txt.includes('atual'), 'o histórico lista cada preço, com a variação sobre o anterior (+8,3%) e o atual marcado', txt);
verificar((await p.locator('main').innerText()).includes('Em dia'), 'preço de hoje: situação Em dia');

console.log('Desatualizado (mais de 12 meses)');
await p.evaluate(async () => { const m = await import('/js/measure.js'); const pr = await import('/js/precos.js'); const a = await import('/js/armazem.js'); const it = m.itens().find((x) => x.codigo === 'SL-EXT'); it.precos = []; pr.registrarPreco(it.id, { valor: 9, desde: '2025-01-15', fonte: 'Digitado' }, 'teste'); a.salvar(); });
await ir('#/measure/itens', '#itens-tabela');
await p.selectOption('#itens-st', 'desatualizado');
verificar(await visiveis() === 1 && (await p.locator('#itens-tabela tbody tr:not([hidden])').innerText()).includes('Selante'), 'preço com mais de 12 meses aparece como Desatualizado');

console.log('Inativo (nunca apagar)');
await p.selectOption('#itens-st', 'todos');
await p.locator('#itens-tabela tr:has-text("Selante exterior") a').first().click();
await p.waitForSelector('.abas-sublinhadas');
verificar(await p.locator('[data-acao="mz-excluir-item"]').count() === 0 && (await p.locator('main').innerText()).includes('nunca são excluídos'), 'não existe botão de excluir: o item fica ativo ou inativo');
await p.click('[data-acao="item-ativo"]');
await p.waitForTimeout(300);
verificar((await p.locator('main').innerText()).includes('Inativo') && await p.locator('.abas-sublinhadas').count() === 1, 'item inativo');
await ir('#/measure/itens', '#itens-tabela');
verificar(await p.locator('#itens-tabela tr:has-text("Selante exterior"):not([hidden])').count() === 0, 'o item inativo some da lista padrão (Ativos)');
await p.selectOption('#itens-st', 'inativo');
verificar(await visiveis() === 1, 'e aparece no filtro Inativos');
await ir('#/measure/assembly/novo', '#form-assembly');
verificar(await p.locator('.mz-linha select[name="item"] option', { hasText: 'Selante exterior' }).count() === 0, 'o item inativo não aparece para escolher num assembly novo');
await ir('#/measure/itens', '#itens-tabela');
await p.selectOption('#itens-st', 'inativo');
await p.locator('#itens-tabela tbody tr:not([hidden]) a').first().click();
await p.waitForSelector('[data-acao="item-ativo"]');
await p.click('[data-acao="item-ativo"]');
await p.waitForTimeout(300);
await ir('#/measure/itens', '#itens-tabela');
verificar(await p.locator('#itens-tabela tr:has-text("Selante exterior"):not([hidden])').count() === 1, 'reativado, o item volta para a lista');

console.log('Usado em');
await ir('#/measure/itens', '#itens-tabela');
await p.fill('#itens-busca', 'osb');
await p.locator('#itens-tabela tbody tr:not([hidden]) a').first().click();
await p.waitForSelector('.abas-sublinhadas');
await p.click('.abas-sublinhadas a:has-text("Usado em")');
await p.waitForTimeout(400);
verificar((await p.locator('main').innerText()).includes('Assemblies que usam este item'), 'a aba Usado em lista os assemblies do item');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
