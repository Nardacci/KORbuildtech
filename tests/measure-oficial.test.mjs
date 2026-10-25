/* KORbuild — o Measure da página oficial (fatia 6; docs/banco.md §13), de ponta a ponta.
 * As telas do protótipo gravando no espelho e js/measure-oficial.js levando cada mudança ao banco:
 *   Ana (Administradora da prestadora A: mede e cuida do catálogo) cadastra um item e um assembly, cria o projeto, envia
 *   o PDF (vai ao Storage), define a escala, mede uma condição (as medições sobem agrupadas), registra preço e margens,
 *   emite a proposta (numerada pelo banco); ao recarregar, tudo volta do banco; Rita (Gestora: mede, sem catálogo nem
 *   custos) vê o projeto e não vê preços; excluir o projeto leva folhas, condições e as plantas do Storage.
 * Duas formas de rodar, com os mesmos passos:
 *   --local  (padrão) contra o "Supabase local" (tools/supabase-local.sh: banco + PostgREST), sem rede;
 *   --real   contra o Supabase do projeto (precisa de SUPABASE_ACCESS_TOKEN); cria usuários kb-e2e-daily-…@example.com
 *            (o mesmo padrão do teste do Daily, que a limpeza já apaga) e apaga tudo no fim.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/measure-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, arquivosDaPasta, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Measure contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };

// ---------- A cena ----------
const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', rita: 'kb-e2e-daily-rita-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), rita: await criarUsuario(EMAIL.rita, 'Rita Local') };
const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
const perfis = await rest(ID.ana, '/perfis_acesso?select=id,chave,permissoes');
const gestor = perfis.find((p) => p.chave === 'gestor');
await rest(ID.ana, '/perfis_acesso?id=eq.' + gestor.id, { metodo: 'PATCH', corpo: { permissoes: gestor.permissoes.filter((x) => x !== 'crew.custos') } });   // a gestora não vê dinheiro
const token = await rest(ID.ana, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: EMAIL.rita, p_nome: 'Rita Local', p_perfil: gestor.id } });
await rest(ID.rita, '/rpc/aceitar_convite', { metodo: 'POST', corpo: { p_token: token } });
await rest(ID.ana, '/contatos', { metodo: 'POST', corpo: [{ nome: 'Thompson Family', pessoa: 'John Thompson', papeis: ['cliente'], email: 'thompson@example.com', etapas: [] }, { nome: 'Madeireira Local', pessoa: '', papeis: ['fornecedor'], email: '', etapas: ['Sheathing'] }] });

// ---------- O navegador ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];
const paginas = new Map();
async function aparelho(quem) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem)]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push(quem + ' [' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push(quem + ' [' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  paginas.set(quem, p);
  return { ctx, p };
}
const noDialogo = async (p, texto) => { await p.click('dialog button:has-text("' + texto + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
const toastTexto = async (p) => (await p.locator('#toast').textContent().catch(() => '')) || '';
// planta e escala de tools/gerar-planta.py: planta em 1/4" = 1'-0" (18 points por pé), origem em (110, 190)
const PLANTA = { x0: 110, y0: 190, k: 18 };
async function clicar(p, pes) {
  const box = await p.locator('#mz-desenho').boundingBox();
  const zoom = box.width / 1224;
  await p.mouse.click(box.x + (PLANTA.x0 + pes[0] * PLANTA.k) * zoom, box.y + (792 - (PLANTA.y0 + pes[1] * PLANTA.k)) * zoom);
}
const esperaDesenho = (p) => p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 30000 });

try {
  console.log('Ana: catálogo (item e assembly)');
  const a = await aparelho('ana');
  await a.p.goto(BASE + '#/measure');
  await a.p.waitForSelector('.tabela-projetos, .vazio-grande, .pagina', { timeout: 30000 });
  await a.p.goto(BASE + '#/measure/itens');
  await a.p.waitForSelector('[data-acao="mz-item"][data-id=""]', { timeout: 30000 });
  await a.p.click('[data-acao="mz-item"][data-id=""]');
  await a.p.fill('dialog input[name="nome"]', 'OSB 7/16" 4\'×8\'');
  await a.p.fill('dialog input[name="codigo"]', 'OSB-716');
  await a.p.fill('dialog input[name="unidade"]', 'chapa');
  await a.p.fill('dialog input[name="etapa"]', 'Sheathing');
  await noDialogo(a.p, 'Criar item');
  verificar(await esperarAte(async () => (await sql(`select codigo from public.itens where empresa_id = '${A}'`)).some((x) => x.codigo === 'OSB-716')), 'o item chegou ao banco');
  const osb = (await sql(`select id from public.itens where empresa_id = '${A}' and codigo = 'OSB-716'`))[0];
  await a.p.goto(BASE + '#/measure/assembly/novo');
  await a.p.waitForSelector('#form-assembly', { timeout: 20000 });
  await a.p.fill('#as-nome', 'Sheathing OSB');
  await a.p.selectOption('#as-tipo', 'area');
  await a.p.locator('.mz-linha select[name="item"]').first().selectOption(osb.id);
  await a.p.locator('.mz-linha input[name="formula"]').first().fill('MeasuredArea / 32');
  await a.p.click('[data-acao="mz-salvar-assembly"]');
  verificar(await esperarAte(async () => (await sql(`select nome, linhas from public.assemblies where empresa_id = '${A}'`)).some((x) => x.nome === 'Sheathing OSB' && x.linhas[0].itemId === osb.id)), 'o assembly chegou ao banco com a linha apontando o item');
  const assemblyId = (await sql(`select id from public.assemblies where empresa_id = '${A}'`))[0].id;

  console.log('Projeto, planta no Storage, escala e medição');
  await a.p.goto(BASE + '#/measure/projeto/novo');
  await a.p.waitForSelector('#form-projeto', { timeout: 20000 });
  await a.p.fill('#pj-nome', 'Casa Thompson');
  await a.p.selectOption('#pj-contratanteId', (await sql(`select id from public.contatos where empresa_id = '${A}' and nome = 'Thompson Family'`))[0].id);
  await a.p.fill('#pj-cidade', 'Manchester');
  await a.p.fill('#pj-estado', 'nh');
  await a.p.click('[data-acao="mz-salvar-projeto"]');
  verificar(await esperarAte(async () => (await sql(`select nome, estado from public.projetos where empresa_id = '${A}'`)).some((x) => x.nome === 'Casa Thompson' && x.estado === 'NH')), 'o projeto chegou ao banco (estado em maiúsculas)');
  const pj = (await sql(`select id from public.projetos where empresa_id = '${A}'`))[0];
  await a.p.waitForSelector('#mz-enviar', { timeout: 20000 });
  await a.p.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
  await a.p.waitForFunction(() => /3 folhas adicionadas/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 30000 });
  verificar(await esperarAte(async () => (await sql(`select arquivo_path, pagina from public.folhas where projeto_id = '${pj.id}'`)).length === 3), '3 folhas no banco');
  const folhas = await sql(`select arquivo_path, pagina from public.folhas where projeto_id = '${pj.id}' order by pagina`);
  verificar(folhas.every((f) => f.arquivo_path.startsWith(A + '/' + pj.id + '/')), 'as folhas apontam a planta na pasta da empresa e do projeto', folhas);
  const noStorage = await arquivosDaPasta(A + '/' + pj.id + '/', 'plantas');
  verificar(noStorage.length === 1, 'o PDF foi para o Storage (um arquivo, três páginas)', noStorage);
  await a.p.evaluate(() => { location.hash = location.hash.replace(/\/(overview|plans|scope|takeoff|materials|schedule|bids)$/, '') + '/plans'; });
  await a.p.click('a:has-text("casa-modelo · página 1")');
  await esperaDesenho(a.p);
  await a.p.click('[data-acao="mz-escala"]');
  await a.p.selectOption('dialog select[name="razao"]', '48');
  await noDialogo(a.p, 'Usar esta escala');
  await clicar(a.p, [0, 31]); await clicar(a.p, [40, 31]);
  await a.p.fill('dialog input[name="real"]', '40\'-0"');
  await noDialogo(a.p, 'Conferir');
  verificar(await esperarAte(async () => { const f = (await sql(`select escala from public.folhas where projeto_id = '${pj.id}' and pagina = 1`))[0]; return f.escala && f.escala.origem === 'lista' && f.escala.conferencia && f.escala.conferencia.ok; }), 'a escala conferida chegou ao banco');
  // uma condição de área com o assembly, medindo a planta inteira (40 × 28 = 1.120 sq ft)
  await a.p.click('[data-acao="mz-incluir-assembly"]');
  await a.p.check('dialog input[name="assembly"][value="' + assemblyId + '"]');
  await a.p.click('dialog button:has-text("Continuar")');
  await a.p.waitForSelector('dialog input[name="nome"]');
  await a.p.fill('dialog input[name="nome"]', 'Piso térreo');
  await noDialogo(a.p, 'Incluir no desenho');
  for (const pt of [[0, 0], [40, 0], [40, 28], [0, 28]]) await clicar(a.p, pt);
  await clicar(a.p, [0, 0]);
  verificar(await esperarAte(async () => { const c = (await sql(`select nome, medicoes, assemblies, versao from public.condicoes where projeto_id = '${pj.id}'`))[0]; return c && c.medicoes.length === 1 && c.medicoes[0].pontos.length === 4 && c.assemblies[0] === assemblyId; }), 'a condição com a medição (4 pontos) e o assembly chegou ao banco');
  const versaoAntes = (await sql(`select versao from public.condicoes where projeto_id = '${pj.id}'`))[0].versao;
  await a.p.click('[data-acao="mz-ferramenta"][data-ferramenta="recortar"]');
  for (const pt of [[22, 12], [30, 12], [30, 18]]) await clicar(a.p, pt);
  await clicar(a.p, [22, 12]);
  verificar(await esperarAte(async () => { const c = (await sql(`select medicoes, versao from public.condicoes where projeto_id = '${pj.id}'`))[0]; return c.medicoes.length === 2 && c.medicoes[1].desconto === true && c.versao > versaoAntes; }), 'o recorte (desconto) chegou e a versão subiu');
  await a.p.goto(BASE + '#/measure/projeto/' + pj.id + '/materials');
  await a.p.waitForSelector('#mz-materiais', { timeout: 20000 });
  const materiais = await a.p.locator('.pagina').innerText();
  verificar(/OSB 7\/16/.test(materiais) && /chapa/.test(materiais), 'a página do projeto calcula os materiais pelo assembly (chapas de OSB)', materiais.slice(0, 160));

  console.log('Preço, margens e proposta');
  await a.p.goto(BASE + '#/measure/precos');
  await a.p.waitForSelector('.tabela-precos', { timeout: 20000 });
  await a.p.click('.tabela-precos tr:has-text("OSB 7/16") [data-acao="preco-novo"]');
  await a.p.fill('dialog input[name="valor"]', '16.90');
  await noDialogo(a.p, 'Salvar preço');
  verificar(await esperarAte(async () => (await sql(`select valor::float v, por_nome from public.item_precos where item_id = '${osb.id}'`)).some((x) => x.v === 16.9 && x.por_nome === 'Ana Local')), 'o preço chegou ao banco com o autor carimbado');
  await a.p.click('[data-acao="margens-nova"]');
  await a.p.fill('dialog input[name="overheadPct"]', '12');
  await a.p.fill('dialog input[name="lucroPct"]', '10');
  await a.p.fill('dialog input[name="motivo"]', 'Margens iniciais');
  await noDialogo(a.p, 'Salvar');
  verificar(await esperarAte(async () => (await sql(`select overhead_pct::float o, motivo from public.margens_versoes where empresa_id = '${A}'`)).some((x) => x.o === 12 && x.motivo === 'Margens iniciais')), 'as margens chegaram ao banco');
  await a.p.goto(BASE + '#/measure/projeto/' + pj.id + '/proposta');
  await a.p.waitForSelector('#form-proposta', { timeout: 20000 });
  await a.p.waitForFunction(() => document.querySelectorAll('.prop-linhas tbody tr').length >= 1, null, { timeout: 15000 });
  await a.p.click('[data-acao="prop-emitir"]');
  await noDialogo(a.p, 'Emitir');
  await a.p.waitForFunction(() => /emitida/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => null);
  const numero = ((await toastTexto(a.p)).match(/P-\d{4}-\d{3}/) || [])[0];
  verificar(!!numero && numero.endsWith('-001'), 'a proposta foi emitida com o número dado pelo banco', await toastTexto(a.p));
  const emitida = (await sql(`select numero, total::float as total, retrato -> 'linhas' as linhas from public.propostas_emitidas where projeto_id = '${pj.id}'`))[0];
  verificar(emitida && emitida.numero === numero && emitida.total > 0 && emitida.linhas.length >= 1, 'a proposta está congelada no banco com o retrato', emitida);
  verificar((await sql(`select situacao from public.projetos where id = '${pj.id}'`))[0].situacao === 'enviada', 'o projeto passou para "Proposta enviada"');

  console.log('Recarregar: tudo volta do banco');
  await a.p.goto(BASE + '#/measure/projeto/' + pj.id);
  await a.p.reload();
  await a.p.waitForSelector('.mz-dados', { timeout: 30000 });
  const dados = await a.p.locator('body').innerText();
  verificar(dados.includes('Casa Thompson') && dados.includes('Proposta enviada') && dados.includes(numero), 'projeto, situação e número da proposta voltam do banco', dados.slice(0, 200));
  await a.p.evaluate(() => { location.hash = location.hash.replace(/\/(overview|plans|scope|takeoff|materials|schedule|bids)$/, '') + '/plans'; });
  await a.p.click('a:has-text("casa-modelo · página 1")');
  await esperaDesenho(a.p);
  verificar((await a.p.locator('.mz-cond').count()) === 1 && (await a.p.locator('#mz-painel').innerText()).includes('Piso térreo'), 'a folha abre do Storage com a condição medida');

  console.log('Rita (Gestora): mede, não vê dinheiro');
  const r = await aparelho('rita');
  await r.p.goto(BASE + '#/measure/projeto/' + pj.id);
  await r.p.waitForSelector('.mz-dados', { timeout: 30000 });
  verificar((await r.p.locator('body').innerText()).includes('Casa Thompson'), 'a gestora vê o projeto');
  await r.p.goto(BASE + '#/measure/precos');
  await r.p.waitForTimeout(1500);
  const telaPrecos = await r.p.locator('body').innerText();
  verificar(!telaPrecos.includes('16,90') && !telaPrecos.includes('16.90'), 'a gestora não vê o preço do item', telaPrecos.slice(0, 160));
  const guardado = await r.p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kbt.oficial.v1.')).map((k) => localStorage.getItem(k)).join(''));
  verificar(!/"valor":16\.9/.test(guardado) && !/"overheadPct":12/.test(guardado), 'nem preços nem margens chegaram ao aparelho dela');

  console.log('Excluir o projeto leva folhas, condições e as plantas do Storage; a proposta fica');
  await a.p.goto(BASE + '#/measure/projeto/' + pj.id + '/editar');
  await a.p.waitForSelector('[data-acao="mz-excluir-projeto"]', { timeout: 20000 });
  await a.p.click('[data-acao="mz-excluir-projeto"]');
  await noDialogo(a.p, 'Excluir');
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.projetos where id = '${pj.id}'`))[0].n === 0), 'o projeto saiu do banco');
  verificar((await sql(`select count(*)::int n from public.condicoes where projeto_id = '${pj.id}'`))[0].n === 0 && (await sql(`select count(*)::int n from public.folhas where projeto_id = '${pj.id}'`))[0].n === 0, 'folhas e condições saíram junto');
  verificar(await esperarAte(async () => (await arquivosDaPasta(A + '/' + pj.id + '/', 'plantas')).length === 0), 'as plantas saíram do Storage');
  verificar((await sql(`select count(*)::int n from public.propostas_emitidas where projeto_id = '${pj.id}'`))[0].n === 1, 'a proposta emitida ficou guardada');
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (falhas) {
    for (const [quem, p] of paginas) console.log('      [' + quem + '] ' + p.url() + ' · aviso: ' + ((await p.locator('#toast').textContent().catch(() => '')) || '').slice(0, 120));
    for (const e of erros.slice(0, 5)) console.log('      [erro de JavaScript] ' + e);
    for (const l of diag.slice(0, 25)) console.log('      ' + l);
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
