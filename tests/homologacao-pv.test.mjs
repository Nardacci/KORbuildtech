/* KORbuild — a homologação automática da 1ª versão em cima da massa pv: para cada empresa com Measure, o painel, o catálogo (itens e assemblies), as condições com a
 * lista de materiais, a lista para cotação por fornecedor (tela e impressão), o envio/retorno das cotações e a proposta. Só lê (não grava nada).
 * Dois modos:
 *   local:  python3 -m http.server 8123 & bash tools/supabase-local.sh && node tools/massa-primeira-versao.mjs && node tools/massa-measure.mjs --conjunto=pv && node tools/massa-catalogo-pv.mjs && node tests/homologacao-pv.test.mjs
 *   real:   KOR_DEMO_SENHA='…' node tests/homologacao-pv.test.mjs https://nardacci.github.io/KORbuildtech/ --real [--relatorio=docs/homologacao-AAAA-MM-DD.md]
 *           (entra pela tela de login, como uma pessoa; a senha só vive na variável de ambiente e nunca é impressa) */

import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { emailDe, FAMILIAS, FAMILIA_DA_EMPRESA, EMPRESAS } from '../tools/massa-pv/dados.mjs';

const REAL = process.argv.includes('--real');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const RELATORIO = (process.argv.find((a) => a.startsWith('--relatorio=')) || '').slice(12);
const SENHA = process.env.KOR_DEMO_SENHA || '';
if (REAL && SENHA.length < 12) { console.error('Defina KOR_DEMO_SENHA (12+ caracteres) no ambiente; ela nunca é impressa.'); process.exit(2); }
const L = REAL ? null : await import('./_supabase-local.mjs');
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];

const linhas = [];   // para o relatório
let ok = 0, falhas = 0;
function verificar(empresa, nome, cond, detalhe = '') {
  if (cond) ok++; else { falhas++; console.log('  FALHOU [' + empresa + '] ' + nome + (detalhe ? ' · ' + String(detalhe).slice(0, 220) : '')); }
  linhas.push({ empresa, nome, ok: !!cond, detalhe: cond ? '' : String(detalhe).slice(0, 220) });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
async function entrar(chave, papel = 'admin') {
  const email = emailDe(chave, papel);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route(/open-meteo|tile\.openstreetmap/, (r) => r.abort());
  if (!REAL) {
    const [u] = await L.sql(`select id from auth.users where email = '${email}'`);
    await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'en'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } }, [await L.sessao(u.id, email, 'Massa')]);
    await L.rotear(ctx, URL_PROJETO);
  } else {
    await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'en'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } });
  }
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(chave + ': ' + e.message));
  await p.goto(BASE + (REAL ? '?versao=primeira' : '') + '#/conta');
  if (REAL) {
    await p.waitForSelector('#form-login-oficial', { timeout: 40000 });
    await p.fill('#oficial-email', email); await p.fill('#oficial-senha', SENHA);
    await p.click('#form-login-oficial button[type=submit]');
  }
  await p.waitForSelector('.ini-ola, .oficial-titulo', { timeout: 60000 });
  return { ctx, p };
}
const texto = async (p) => (await p.locator('body').innerText()).replace(/\s+/g, ' ');
/* Abre uma rota e espera a tela ficar pronta: "pronto" roda dentro da página e devolve verdadeiro quando o conteúdo que importa apareceu (e o "Loading…" saiu).
 * Com a rede de verdade a tela demora mais que no banco local: espera até 90 s e, se não vier, recarrega uma vez. */
async function abrir(p, hash, pronto, arg) {
  const espera = () => p.waitForFunction(([fn, a]) => { const t = document.body.innerText; return !/Loading…|Carregando…/.test(t) && new Function('a', 'return (' + fn + ')(a)')(a); }, [String(pronto), arg], { timeout: 90000 });
  await p.goto(BASE + hash);
  if (await espera().then(() => true, () => false)) { await p.waitForTimeout(400); return true; }
  await p.reload();
  const ok = await espera().then(() => true, () => false);
  await p.waitForTimeout(400);
  return ok;
}

try {
  for (const chave of Object.keys(FAMILIA_DA_EMPRESA)) {
    const fam = FAMILIAS[FAMILIA_DA_EMPRESA[chave]];
    const nome = (EMPRESAS.find((e) => e.chave === chave) || {}).nome || chave;
    console.log(nome);
    const { ctx, p } = await entrar(chave);
    const E = (n, c, d) => verificar(nome, n, c, d);

    E('o painel do Início aparece, com Takeoff e Settings', await p.locator('.ini-painel .ini-botao').count() === 2);
    const painel = await texto(p);
    E('o painel mostra projetos, cotações e preços da empresa', /Projects by status/.test(painel) && /Material quotes/.test(painel) && /Catalog and prices/.test(painel), painel.slice(0, 200));

    // catálogo
    await abrir(p, '#/measure/itens', (c) => document.body.innerText.includes(c), fam.itens[0].codigo);
    const itens = await texto(p);
    const faltam = fam.itens.filter((i) => !itens.includes(i.codigo));
    E('o catálogo tem os itens da família (' + fam.itens.length + ' novos além dos básicos)', faltam.length === 0, faltam.map((i) => i.codigo).join(','));
    await abrir(p, '#/measure/assemblies', (n) => document.body.innerText.includes(n), fam.assemblies[0][0]);
    const nAsm = await p.locator('a[href*="#/measure/assembly/"]').count();
    const textoAsm = await texto(p);
    const asmFalta = fam.assemblies.filter(([n]) => !textoAsm.includes(n));
    E('os assemblies da família aparecem (' + fam.assemblies.length + ')', asmFalta.length === 0, asmFalta.map((a) => a[0]).join(' | '));
    E('há pelo menos 3 assemblies no total', nAsm >= 3, nAsm);
    await abrir(p, '#/measure/precos', () => /Overhead|overhead|Margin|margin/.test(document.body.innerText));
    const precos = await texto(p);
    E('a tela de Preços abre com os itens e as margens', /Overhead|overhead|Margin|margin/.test(precos) && fam.itens.some((i) => precos.includes(i.codigo) || precos.includes(i.nome)), precos.slice(0, 160));

    // projetos: o primeiro com condições medidas
    await abrir(p, '#/measure', () => !!document.querySelector('a[href*="#/measure/projeto/"]'));
    const hrefs = await p.locator('a[href*="#/measure/projeto/"]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')).filter((h) => /^#\/measure\/projeto\/[0-9a-f-]{36}$/.test(h)))]);
    E('a lista de projetos tem projetos', hrefs.length >= 1, hrefs.length);
    let projetoComLista = null;
    const candidatos = [];
    for (const h of hrefs) {
      await abrir(p, h, () => !!document.querySelector('#mz-enviar, .mz-condicao, .cartao'));
      const t = await texto(p);
      const asmNoProjeto = fam.assemblies.filter(([n]) => t.includes(n)).length;
      if (asmNoProjeto >= 2) candidatos.push(h);
    }
    E('existe um projeto com as condições dos assemblies (≥ 2 da família)', candidatos.length >= 1, hrefs.join(' '));
    // dos projetos medidos, o que tem cotação enviada (tem os avisos de e-mail preparado) é o que a lista para cotação mostra por inteiro
    for (const h of candidatos) {
      const id = h.split('/').pop();
      await abrir(p, '#/measure/projeto/' + id + '/cotacao', () => !!document.querySelector('.cot-fornecedor, .aviso-info'));
      if (await p.locator('.cot-fornecedor .etiqueta-verde, .cot-fornecedor .etiqueta-azul').count()) { projetoComLista = h; break; }
    }
    projetoComLista = projetoComLista || candidatos[0] || null;
    if (projetoComLista) {
      const id = projetoComLista.split('/').pop();
      // lista para cotação
      await abrir(p, '#/measure/projeto/' + id + '/cotacao', () => !!document.querySelector('.cot-fornecedor, .aviso-info'));
      const secoes = await p.locator('.cot-fornecedor').count();
      const tcot = await texto(p);
      E('a lista para cotação separa os materiais por fornecedor (≥ 2 fornecedores)', secoes >= 2, secoes);
      const linhasTabela = await p.locator('.cot-fornecedor tbody tr').count();
      E('a lista tem as linhas de material (item, quantidade, unidade)', linhasTabela >= 6, linhasTabela);
      E('as quantidades vêm com unidade de compra', /(piece|box|roll|sheet|bundle|each|gallon|bucket|bag|cubic yard)/.test(tcot));
      E('mostra o e-mail preparado e/ou os preços recebidos de um fornecedor', /e-mail prepared on|prices received on|E-mail preparado|preços recebidos/i.test(tcot), tcot.slice(0, 200));
      // impressão por fornecedor
      const forn = await p.locator('.cot-fornecedor a[href*="/imprimir"]').first().getAttribute('href').catch(() => null);
      E('há o PDF do pedido de cotação por fornecedor', !!forn, forn);
      if (forn) {
        await abrir(p, forn, () => !!document.querySelector('.doc'));
        const doc = await texto(p);
        E('o pedido de cotação traz a obra, o prazo para responder e a tabela com colunas para o preço', /Request for quote|Pedido de cotação/.test(doc) && /Reply by|Responder até/.test(doc) && /Subtotal/.test(doc) && await p.locator('.doc-tabela tbody tr').count() >= 1, doc.slice(0, 220));
      }
      // proposta
      await abrir(p, '#/measure/projeto/' + id + '/proposta', () => !!document.querySelector('#form-proposta, .aviso-info'));
      E('a tela da proposta abre com as linhas por etapa', await p.locator('.prop-linhas tbody tr').count() >= 1);
    }
    await ctx.close();
  }
  // o painel depois das cotações: a Maple (p1) e a Northgate (c1) enviaram listas
  {
    const { ctx, p } = await entrar('c1');
    const t = await texto(p);
    verificar('Northgate Builders', 'o painel conta as listas de cotação enviadas', /Lists sent/.test(t) && !/\b0 Lists sent/.test(t), t.match(/Material quotes.{0,120}/));
    await ctx.close();
  }
} finally {
  await browser.close();
}
verificar('geral', 'nenhum erro de JavaScript', erros.length === 0, erros.join(' | '));
console.log('homologacao-pv: ' + ok + '/' + (ok + falhas) + ' verificações passaram');
if (RELATORIO) {
  const md = '# Homologação automática da 1ª versão (massa pv)\n\n' + (REAL ? 'Contra: ' + BASE + ' (Supabase do projeto)\n\n' : 'Contra o banco local.\n\n') + '**Resultado: ' + ok + '/' + (ok + falhas) + ' verificações passaram.**\n\n| Empresa | Verificação | Resultado |\n| --- | --- | --- |\n' +
    linhas.map((l) => '| ' + l.empresa + ' | ' + l.nome.replace(/\|/g, '/') + ' | ' + (l.ok ? 'passou' : 'FALHOU ' + l.detalhe.replace(/\|/g, '/')) + ' |').join('\n') + '\n';
  writeFileSync(RELATORIO, md);
  console.log('Relatório: ' + RELATORIO);
}
process.exit(falhas ? 1 : 0);
