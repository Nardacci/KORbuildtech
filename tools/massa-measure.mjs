/* KORbuild — o Measure da massa de demonstração, montado PELAS TELAS (Playwright), como nos testes measure-oficial: catálogo (itens e assembly), preços,
 * margens, projeto com a planta de exemplo, escala conferida, medição no desenho e proposta emitida. O Measure grava desenhos que só o app sabe montar.
 * Roda depois de tools/massa-demo.mjs (as empresas e os logins já existem). Nunca apaga; pula o que já existe (pelo nome).
 * Uso: node tools/massa-measure.mjs                              (banco local)
 *      KOR_DEMO_SENHA='…' node tools/massa-measure.mjs --real    (Supabase do projeto; SUPABASE_ACCESS_TOKEN no ambiente) */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { emailDe as emailDemo, SENHA_VARIAVEL } from './massa-demo/dados.mjs';
import { emailDe as emailPv, MEASURE as MEASURE_PV } from './massa-pv/dados.mjs';
import { servirProjeto } from './massa-demo/servidor.mjs';

const REAL = process.argv.includes('--real');
const PV = process.argv.includes('--conjunto=pv');   // a massa da 1ª versão (tools/massa-primeira-versao.mjs), em vez da de demonstração
const emailDe = PV ? emailPv : emailDemo;
const { sql, garantirUsuario, sessao, rotear } = await import(REAL ? '../tests/_supabase-real.mjs' : '../tests/_supabase-local.mjs');
const SENHA = process.env[SENHA_VARIAVEL] || '';
if (REAL && SENHA.length < 12) { console.error('Defina ' + SENHA_VARIAVEL + ' (12+ caracteres) no ambiente.'); process.exit(2); }
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
console.log('Measure da massa contra: ' + (REAL ? 'Supabase do projeto' : 'Supabase local'));

const PLANTA = { x0: 110, y0: 190, k: 18 };   // tools/gerar-planta.py: 1/4" = 1'-0", 18 pontos por pé, origem em (110, 190)
const CONFIG_DEMO = [
  { chave: 's1', pessoa: 'Carol Brennan', itens: [['Fiber-cement lap siding 8-1/4"', 'FC-825', 'piece', 'Siding', 14.2], ['Housewrap 9\'x150\' roll', 'HW-9150', 'roll', 'Siding', 148]],
    assembly: ['Lap siding with housewrap', [['FC-825', 'MeasuredArea / 5.5'], ['HW-9150', 'MeasuredArea / 1350']]], margens: [12, 10],
    projetos: [{ nome: 'Whitaker Garage — Siding', cliente: 'Northfield Builders', cidade: 'Manchester', estado: 'nh', condicao: 'Front elevation', emitir: true }, { nome: 'Cedar Court Townhomes — Siding', cliente: 'Pine Ridge Homes', cidade: 'Concord', estado: 'nh' }] },
  { chave: 's2', pessoa: 'Gary Lindqvist', itens: [['OSB 7/16" 4\'x8\' sheet', 'OSB-716', 'sheet', 'Sheathing', 16.9], ['2x6x92-5/8" precut stud', 'ST-2692', 'piece', 'Framing', 5.45]],
    assembly: ['Wall sheathing and studs', [['OSB-716', 'MeasuredArea / 32'], ['ST-2692', 'MeasuredArea / 1.33']]], margens: [14, 9],
    projetos: [{ nome: 'Riverside Annex — Framing', cliente: 'Northfield Builders', cidade: 'Nashua', estado: 'nh', condicao: 'Level 1 walls', emitir: true }] },
  { chave: 's3', pessoa: 'Frank DiNardo', itens: [['Ready-mix concrete 4000 psi', 'RM-4000', 'cubic yard', 'Foundation walls', 178], ['#4 rebar 20\' stick', 'RB-4-20', 'piece', 'Footings', 11.6]],
    assembly: ['Slab on grade', [['RM-4000', 'MeasuredArea * 0.0123'], ['RB-4-20', 'MeasuredArea / 40']]], margens: [11, 8],
    projetos: [{ nome: 'Oak Hollow Lot 7 — Slab', cliente: 'Pine Ridge Homes', cidade: 'Bow', estado: 'nh', condicao: 'Garage slab', emitir: false }] },
  { chave: 'i1', pessoa: 'Dorothy Weller', itens: [['Exterior acrylic paint, 5 gal', 'PT-EXT5', 'bucket', 'Finish coats', 189], ['Primer, 5 gal', 'PR-5', 'bucket', 'Prime', 124]],
    assembly: ['Exterior paint, two coats', [['PT-EXT5', 'MeasuredArea / 700'], ['PR-5', 'MeasuredArea / 900']]], margens: [10, 12],
    projetos: [{ nome: 'Whitaker Residence — Repaint', cliente: 'The Whitaker Family', cidade: 'Meredith', estado: 'nh', condicao: 'Exterior walls', emitir: true }, { nome: 'Lakeview Inn — Porch', cliente: 'Lakeview Inn', cidade: 'Laconia', estado: 'nh' }] },
  { chave: 'i3', pessoa: 'Nora Castellano', itens: [['Kitchen base cabinet, 36"', 'KC-B36', 'each', 'Finish carpentry', 285], ['Casing 3-1/2" primed', 'CS-312', 'linear ft', 'Finish carpentry', 2.35]],
    assembly: ['Kitchen finish package', [['KC-B36', 'MeasuredArea / 30'], ['CS-312', 'MeasuredArea / 8']]], margens: [13, 10],
    projetos: [{ nome: 'Donnelly Kitchen — Estimate', cliente: 'The Donnelly Family', cidade: 'Hooksett', estado: 'nh', condicao: 'Kitchen floor', emitir: true }] },
];

const CONFIG = PV ? MEASURE_PV : CONFIG_DEMO;
const servidor = await servirProjeto();
const BASE = servidor.base;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
// a tela é dirigida em inglês (os nomes que o app grava, como as folhas, ficam em inglês)
const B = { 'Criar item': 'Create item', 'Salvar preço': 'Save price', 'Salvar': 'Save', 'Usar esta escala': 'Use this scale', 'Conferir': 'Check', 'Continuar': 'Continue', 'Incluir no desenho': 'Add to drawing', 'Emitir': 'Issue' };
const noDialogo = async (p, texto) => { await p.click('dialog button:has-text("' + (B[texto] || texto) + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
const esperarAte = async (fn, ms = 25000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 300)); } return false; };
async function clicar(p, pes) {
  const box = await p.locator('#mz-desenho').boundingBox();
  const zoom = box.width / 1224;
  await p.mouse.click(box.x + (PLANTA.x0 + pes[0] * PLANTA.k) * zoom, box.y + (792 - (PLANTA.y0 + pes[1] * PLANTA.k)) * zoom);
}
/* Abre uma rota e espera um elemento. A rota só muda o "#" e, com a rede lenta, a tela às vezes não redesenha: recarrega e, por fim, passa pela lista. */
async function abrir(p, hash, seletor) {
  await p.goto(BASE + hash);
  if (await p.waitForSelector(seletor, { timeout: 20000 }).catch(() => null)) return;
  await p.reload();
  if (await p.waitForSelector(seletor, { timeout: 40000 }).catch(() => null)) return;
  await p.goto(BASE + '#/measure'); await p.waitForTimeout(2000);
  await p.goto(BASE + hash); await p.reload();
  await p.waitForSelector(seletor, { timeout: 60000 });
}
const esperaDesenho = (p) => p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 40000 });

for (const c of CONFIG) {
  const email = emailDe(c.chave, c.login || 'admin');
  const [emp] = await sql(`select e.id, e.nome from public.empresas e join public.membros m on m.empresa_id = e.id join auth.users u on u.id = m.user_id where u.email = '${email}'`);
  if (!emp) { console.log('  ' + c.chave + ': empresa não encontrada (rode ' + (PV ? 'tools/massa-primeira-versao.mjs' : 'tools/massa-demo.mjs') + ' antes)'); continue; }
  const jaP = await sql(`select nome from public.projetos where empresa_id = '${emp.id}'`);
  const faltam = c.projetos.filter((p) => !jaP.some((x) => x.nome === p.nome));
  const catalogoCompleto = (await sql(`select (select count(*) from public.itens where empresa_id = '${emp.id}')::int as i, (select count(*) from public.assemblies where empresa_id = '${emp.id}')::int as a, (select count(*) from public.margens_versoes where empresa_id = '${emp.id}')::int as m`))[0];
  if (!faltam.length && catalogoCompleto.i >= c.itens.length && catalogoCompleto.a > 0 && catalogoCompleto.m > 0) { console.log('  ' + emp.nome + ': Measure já montado, pulei'); continue; }
  const uid = await garantirUsuario(email, c.pessoa, SENHA);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s, pv]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'en'); if (pv) localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } }, [await sessao(uid, email, c.chave), PV]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
  const p = await ctx.newPage();
  const erros = [];
  p.on('pageerror', (e) => erros.push(e.message));
  try {
    // ---- catálogo (cada peça só se ainda não existe, para poder repetir depois de uma falha no meio) ----
    for (const [nome, codigo, unidade, etapa, preco] of c.itens) {
      let item = (await sql(`select id from public.itens where empresa_id = '${emp.id}' and codigo = '${codigo}'`))[0];
      if (!item) {
        // a tela do item (Items › New item): nome, código, unidade e etapa; o preço vai depois, pela lista.
        // Se a tela abriu antes do espelho do banco, o item gravado some ao recarregar: tenta de novo.
        const noBanco = async () => (await sql(`select 1 from public.itens where empresa_id = '${emp.id}' and codigo = '${codigo}'`)).length === 1;
        for (let tentativa = 0; tentativa < 3 && !(await noBanco()); tentativa++) {
          await abrir(p, '#/measure/item/novo', '#form-item');
          await p.waitForTimeout(1500);
          await p.fill('#it-nome', nome); await p.fill('#it-codigo', codigo);
          await p.fill('#it-un', unidade); await p.fill('#it-etapa', etapa);
          if ((await p.inputValue('#it-nome').catch(() => '')) !== nome) continue;   // a tela foi redesenhada no meio: de novo
          await p.click('[data-acao="item-salvar"]');
          await esperarAte(noBanco, 20000);
        }
        if (!(await noBanco())) throw new Error('o item ' + codigo + ' não chegou ao banco');
        item = (await sql(`select id from public.itens where empresa_id = '${emp.id}' and codigo = '${codigo}'`))[0];
      }
      if (!(await sql(`select 1 from public.item_precos where empresa_id = '${emp.id}' and item_id = '${item.id}'`)).length) {
        await abrir(p, '#/measure/itens', '[data-acao="preco-novo"][data-id="' + item.id + '"]');
        await p.click('[data-acao="preco-novo"][data-id="' + item.id + '"]');
        await p.fill('dialog input[name="valor"]', String(preco));
        await noDialogo(p, 'Salvar preço');
        await esperarAte(async () => (await sql(`select 1 from public.item_precos where empresa_id = '${emp.id}' and item_id = '${item.id}'`)).length > 0);
      }
    }
    if (!(await sql(`select 1 from public.assemblies where empresa_id = '${emp.id}'`)).length) {
      const [nomeAs, linhas] = c.assembly;
      await abrir(p, '#/measure/assembly/novo', '#form-assembly');
      await p.fill('#as-nome', nomeAs);
      await p.selectOption('#as-tipo', 'area');
      for (const [i, [codigo, formula]] of linhas.entries()) {
        const itemId = (await sql(`select id from public.itens where empresa_id = '${emp.id}' and codigo = '${codigo}'`))[0].id;
        if (i > 0) await p.click('[data-acao="mz-nova-linha"]');
        await p.waitForSelector('.mz-linha select[name="item"] option[value="' + itemId + '"]', { state: 'attached', timeout: 60000 });
        await p.locator('.mz-linha select[name="item"]').nth(i).selectOption(itemId);
        await p.locator('.mz-linha input[name="formula"]').nth(i).fill(formula);
      }
      await p.click('[data-acao="mz-salvar-assembly"]');
      if (!(await esperarAte(async () => (await sql(`select 1 from public.assemblies where empresa_id = '${emp.id}'`)).length > 0))) throw new Error('o assembly não chegou ao banco');
    }
    if (!(await sql(`select 1 from public.margens_versoes where empresa_id = '${emp.id}'`)).length) {
      await abrir(p, '#/measure/itens', '[data-acao="margens-nova"]');
      await p.click('[data-acao="margens-nova"]');
      await p.fill('dialog input[name="overheadPct"]', String(c.margens[0]));
      await p.fill('dialog input[name="lucroPct"]', String(c.margens[1]));
      await p.fill('dialog input[name="motivo"]', 'Initial margins');
      await noDialogo(p, 'Salvar');
      await esperarAte(async () => (await sql(`select 1 from public.margens_versoes where empresa_id = '${emp.id}'`)).length > 0);
    }
    // ---- projetos (retomáveis: cada passo só se ainda não foi feito) ----
    const assemblyId = (await sql(`select id from public.assemblies where empresa_id = '${emp.id}' order by criado_em limit 1`))[0].id;
    for (const pr of c.projetos) {
      const q = pr.nome.replace(/'/g, "''");
      const estado = async () => (await sql(`select p.id, (select count(*) from public.folhas f where f.projeto_id = p.id)::int as folhas, (select count(*) from public.condicoes c where c.projeto_id = p.id)::int as condicoes, (select count(*) from public.propostas_emitidas e where e.projeto_id = p.id)::int as propostas from public.projetos p where p.empresa_id = '${emp.id}' and p.nome = '${q}'`))[0];
      let st = await estado();
      if (st && st.folhas === 3 && (!pr.condicao || st.condicoes > 0) && (!pr.emitir || st.propostas > 0)) continue;
      if (!st) {
        // com a rede lenta, uma releitura em andamento (da proposta anterior) pode redesenhar a tela e apagar o formulário: confere antes de salvar e refaz
        for (let tentativa = 1; tentativa <= 4 && !st; tentativa++) {
          await p.waitForTimeout(3000);
          await abrir(p, '#/measure/projeto/novo', '#form-projeto');
          await p.fill('#pj-nome', pr.nome);
          const contato = (await sql(`select id from public.contatos where empresa_id = '${emp.id}' and nome = '${pr.cliente.replace(/'/g, "''")}'`))[0];
          if (contato) await p.selectOption('#pj-contratanteId', contato.id);
          await p.fill('#pj-cidade', pr.cidade); await p.fill('#pj-estado', pr.estado);
          if ((await p.inputValue('#pj-nome').catch(() => '')) !== pr.nome) continue;   // a tela foi redesenhada no meio: de novo
          await p.click('[data-acao="mz-salvar-projeto"]');
          await esperarAte(async () => !!(await estado()), 20000);
          st = await estado();
        }
        if (!st) throw new Error('o projeto ' + pr.nome + ' não chegou ao banco · aviso: ' + (((await p.locator('#toast').textContent().catch(() => '')) || '').slice(0, 120)));
      }
      const pjId = st.id;
      if (st.folhas < 3) {
        await abrir(p, '#/measure/projeto/' + pjId + '/plans', '#mz-enviar');
        await p.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
        await p.waitForFunction(() => /3 sheets added/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 90000 });
        await esperarAte(async () => (await estado()).folhas === 3);
      }
      if (pr.condicao && st.condicoes === 0) {
        const folha = (await sql(`select id, escala from public.folhas where projeto_id = '${pjId}' and pagina = 1`))[0];
        await abrir(p, '#/measure/folha/' + folha.id, '#mz-desenho');
        await esperaDesenho(p);
        if (!(folha.escala && folha.escala.conferencia && folha.escala.conferencia.ok)) {
          await p.click('[data-acao="mz-escala"]');
          await p.selectOption('dialog select[name="razao"]', '48');
          await noDialogo(p, 'Usar esta escala');
          await clicar(p, [0, 31]); await clicar(p, [40, 31]);
          await p.fill('dialog input[name="real"]', '40\'-0"');
          await noDialogo(p, 'Conferir');
          await esperarAte(async () => { const f = (await sql(`select escala from public.folhas where id = '${folha.id}'`))[0]; return f.escala && f.escala.conferencia && f.escala.conferencia.ok; });
        }
        await p.click('[data-acao="mz-incluir-assembly"]');
        await p.check('dialog input[name="assembly"][value="' + assemblyId + '"]');
        await p.click('dialog button:has-text("Continue")');
        await p.waitForSelector('dialog input[name="nome"]');
        await p.fill('dialog input[name="nome"]', pr.condicao);
        await noDialogo(p, 'Incluir no desenho');
        for (const pt of [[0, 0], [40, 0], [40, 28], [0, 28]]) await clicar(p, pt);
        await clicar(p, [0, 0]);
        if (!(await esperarAte(async () => { const x = (await sql(`select medicoes from public.condicoes where projeto_id = '${pjId}'`))[0]; return x && x.medicoes.length === 1; }))) throw new Error('a medição de ' + pr.nome + ' não chegou ao banco');
      }
      if (pr.emitir && (await estado()).propostas === 0) {
        await abrir(p, '#/measure/projeto/' + pjId + '/proposta', '#form-proposta');
        await p.waitForFunction(() => document.querySelectorAll('.prop-linhas tbody tr').length >= 1, null, { timeout: 60000 });
        await p.click('[data-acao="prop-emitir"]');
        await noDialogo(p, 'Emitir');
        if (!(await esperarAte(async () => (await estado()).propostas > 0))) throw new Error('a proposta de ' + pr.nome + ' não foi emitida');
      }
      console.log('  ' + emp.nome + ': ' + pr.nome + (pr.emitir ? ' (proposta emitida)' : pr.condicao ? ' (medido, sem proposta)' : ' (só a planta enviada)'));
    }
  } catch (e) {
    console.log('  FALHA em ' + emp.nome + ': ' + String(e.message).split('\n')[0].slice(0, 220) + ' · ' + p.url());
    console.log('  [tela] ' + (((await p.locator('body').innerText().catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 220)));
  }
  for (const e of erros.slice(0, 3)) console.log('  [erro de JavaScript] ' + e);
  await ctx.close();
}
await browser.close();
servidor.fechar();
console.log('Pronto.');
