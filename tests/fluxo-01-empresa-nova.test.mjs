/* KORbuild — Fluxo F01: empresa nova, da primeira entrada ao catálogo pronto (docs/testes/fluxos/F01-empresa-nova.md).
 * Conta real, em português, só pelas telas (o banco só é lido para conferir o que a tela mostra).
 * Uso (banco local): python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/fluxo-01-empresa-nova.test.mjs [--relatorio] [--manter]
 * No Supabase de verdade (js/config.js):  $env:SUPABASE_ACCESS_TOKEN = "sbp_…"  →  node tests/fluxo-01-empresa-nova.test.mjs --real [--relatorio]
 * Só no --real o passo 1 entra pela tela de login (o banco local não tem o serviço de login: lá a sessão já vem gravada). */

import { chromium } from 'playwright';
import { criarFluxo } from './_fluxo.mjs';
import { AMBIENTE, REAL, BASE, SENHA_FLUXO, NOVA, sql, sqlExec, aspas, hoje, somar, esperarAte, texto, irPara, abrirComo, preencher, garantirUsuario, apagarEmpresaFluxo } from './_fluxo-dados.mjs';

const MANTER = process.argv.includes('--manter');
const fluxo = criarFluxo({ id: 'F01', modo: AMBIENTE, roteiro: 'docs/testes/fluxos/F01-empresa-nova.md', ambiente: BASE });
const { verificar } = fluxo;
const EMPRESA = 'Fluxo Nova Construtora', CLIENTE = 'Cliente Nova LLC';
const MAT = { codigo: 'NV-DW', nome: 'Drywall sheet NOVA', un: 'sheet', etapa: '09 29 00 · Gypsum board', preco: '14.5' };
const MO = { codigo: 'NV-MO', nome: 'Hora de montador NOVA', un: 'hour', etapa: '09 29 00 · Gypsum board' };

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
await apagarEmpresaFluxo();   // começa sempre do zero (e apaga o login fluxo.* da rodada anterior)
await garantirUsuario(NOVA.email, NOVA.nome);   // a pessoa existe e está confirmada, mas não tem empresa
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { ctx, p, erros, ruins, consoleErros } = await abrirComo(browser, NOVA, REAL ? { semSessao: true, ir: '#/entrar' } : { ir: '#/nova-empresa' });
fluxo.pagina(p);

const empresaId = async () => ((await sql(`select id from public.empresas where nome = '${aspas(EMPRESA)}'`))[0] || {}).id;
const diag = async () => ({ aviso: await p.evaluate(() => (document.getElementById('toast') || {}).textContent || '').catch(() => ''), rede: ruins.slice(-4), console: consoleErros.slice(-3) });
const item = async (codigo) => (await sql(`select i.id, i.nome, i.funcao_id from public.itens i join public.empresas e on e.id = i.empresa_id where e.nome = '${aspas(EMPRESA)}' and i.codigo = '${codigo}'`))[0];

try {
  await fluxo.passo(1, async () => {
    if (REAL) {
      await p.waitForSelector('#form-login-oficial', { timeout: 40000 });
      await p.fill('#oficial-email', NOVA.email); await p.fill('#oficial-senha', SENHA_FLUXO);
      await p.click('#form-login-oficial button[type="submit"]');
    }
    await p.waitForSelector('#ne-pessoa', { timeout: 40000 });
    verificar(p.url().includes('#/nova-empresa'), 'sem empresa, a pessoa cai em "Sua empresa"', p.url());
    verificar(await p.inputValue('#ne-pessoa') === NOVA.nome, 'o nome dela já vem preenchido', await p.inputValue('#ne-pessoa'));
  });

  await fluxo.passo(2, async () => {
    await p.fill('#ne-empresa', EMPRESA);
    await p.selectOption('#ne-atuacao', 'construtora');
    await p.click('#form-nova-empresa button[type="submit"]');
    await p.waitForSelector('.oficial-topo', { timeout: 40000 });
    const t = await texto(p, 'body');
    verificar(p.url().includes('#/conta') && t.includes(EMPRESA) && t.includes('Administrador'), 'a área da conta mostra a empresa e "Administrador"', t.slice(0, 300));
    verificar(await esperarAte(async () => !!(await empresaId()), 20000), 'no banco: a empresa existe');
    const [m] = await sql(`select pa.chave, m.nome from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id join public.empresas e on e.id = m.empresa_id where e.nome = '${aspas(EMPRESA)}'`);
    verificar(m && m.chave === 'administrador', 'no banco: um membro, com o perfil Administrador', m);
    await sqlExec(`update public.empresas set plano = plano || '{"demo": true, "massa": "fluxo"}'::jsonb where nome = '${aspas(EMPRESA)}'`);   // marca para a limpeza
  });

  await fluxo.passo(3, async () => {
    await irPara(p, '#/conta/perfis', '.perfil-cartao');
    verificar(await p.locator('.perfil-cartao').count() === 4, 'os quatro perfis padrão', await p.locator('.perfil-cartao').count());
    await p.locator('.perfil-cartao').first().locator('[data-acao="of-editar-perfil"]').click();
    await p.waitForSelector('dialog.painel input[name="perm"]');
    verificar(await p.locator('dialog.painel input[name="perm"]:disabled').count() > 0, 'o Administrador é travado (caixas desabilitadas)');
    await p.click('dialog.painel [data-painel-fechar]');
  });

  await fluxo.passo(4, async () => {
    await irPara(p, '#/conta/funcoes', '.tabela-funcoes');
    await p.waitForTimeout(800);
    const linhas = await p.locator('.tabela-funcoes tbody tr').count();
    verificar(linhas === 10, 'as dez funções padrão', linhas);
    const semValor = await p.locator('.tabela-funcoes tbody tr:has-text("sem valor")').count();
    verificar(semValor === 10, 'todas aparecem "sem valor"', semValor);
  });

  await fluxo.passo(5, async () => {
    await p.locator('.tabela-funcoes tr', { hasText: 'Carpenter' }).locator('[data-acao="cad-editar-funcao"]').click();
    await p.waitForSelector('dialog.painel [data-painel-extra]', { timeout: 20000 });
    await p.click('dialog.painel [data-painel-extra]');
    await p.waitForSelector('dialog #nv-valor');
    await p.fill('dialog #nv-valor', '38'); await p.fill('dialog #nv-desde', somar(hoje(), -30)); await p.fill('dialog #nv-motivo', 'Valor inicial');
    await p.click('dialog button:has-text("Registrar")');
    await p.waitForSelector('dialog #nv-valor', { state: 'detached' });
    await p.waitForSelector('dialog.painel .tabela-valores', { timeout: 20000 });   // o painel reabre com o histórico novo
    await p.waitForTimeout(800);
    const t = await texto(p, 'dialog.painel');
    verificar(/vigente/.test(t) && /38,00|38\.00/.test(t) && /Valor inicial/.test(t), 'o histórico mostra US$ 38,00 vigente com o motivo', t.slice(0, 300));
    const [n] = await sql(`select count(*)::int as n from public.funcao_valores fv join public.funcoes f on f.id = fv.funcao_id join public.empresas e on e.id = f.empresa_id where e.nome = '${aspas(EMPRESA)}' and f.nome = 'Carpenter' and fv.valor = 38`);
    verificar(n.n === 1, 'no banco: 1 valor de US$ 38,00 para a função Carpenter', n);
  });

  await fluxo.passo(6, async () => {
    await irPara(p, '#/conta/contatos/novo', '#form-contato');
    verificar(await preencher(p, [['#ct-nome', CLIENTE]]), 'o formulário guardou o nome do cliente antes de salvar');
    await p.check('input[name="papeis"][value="cliente"]');
    await p.click('dialog.painel [data-painel-salvar]');
    verificar(await esperarAte(async () => (await sql(`select count(*)::int as n from public.contatos c join public.empresas e on e.id = c.empresa_id where e.nome = '${aspas(EMPRESA)}' and c.nome = '${CLIENTE}'`))[0].n === 1, 20000), 'no banco: o contato existe');
    await irPara(p, '#/conta/contatos', 'main');
    // no Supabase de verdade a lista chega depois da tela: espera o nome aparecer e, se não vier, recarrega uma vez
    let naLista = await esperarAte(async () => (await texto(p, 'main')).includes(CLIENTE), 15000);
    if (!naLista) { await p.reload(); await p.waitForSelector('main', { timeout: 40000 }); naLista = await esperarAte(async () => (await texto(p, 'main')).includes(CLIENTE), 20000); }
    verificar(naLista, 'o contato aparece na lista', (await texto(p, 'main')).slice(0, 300));
  });

  await fluxo.passo(7, async () => {
    // material, com preço digitado
    await irPara(p, '#/measure/item/novo', '#it-nome');
    verificar(await preencher(p, [['#it-nome', MAT.nome], ['#it-codigo', MAT.codigo], ['#it-cat', 'material', 'lista'], ['#it-un', MAT.un], ['#it-etapa', MAT.etapa], ['#it-preco', MAT.preco]]), 'o formulário do material guardou os campos antes de salvar');
    await p.click('[data-acao="item-salvar"]');
    verificar(await esperarAte(async () => !!(await item(MAT.codigo)), 20000), 'no banco: o material NV-DW existe', await diag());
    const [pr] = await sql(`select ip.valor::float as valor from public.item_precos ip join public.itens i on i.id = ip.item_id where i.codigo = '${MAT.codigo}' and i.empresa_id = '${await empresaId()}'`);
    verificar(pr && pr.valor === 14.5, 'no banco: o preço digitado é US$ 14,50', pr);
    // mão de obra, ligada à função
    await irPara(p, '#/measure/item/novo', '#it-nome');
    await p.waitForSelector('#it-funcao option:has-text("Carpenter")', { state: 'attached', timeout: 40000 });
    const idCarpenter = await p.locator('#it-funcao option', { hasText: 'Carpenter' }).first().getAttribute('value');
    verificar(await preencher(p, [['#it-nome', MO.nome], ['#it-codigo', MO.codigo], ['#it-cat', 'mao-de-obra', 'lista'], ['#it-un', MO.un], ['#it-etapa', MO.etapa], ['#it-funcao', idCarpenter, 'lista']]), 'o formulário da mão de obra guardou os campos e a função antes de salvar');
    verificar(!(await p.locator('#it-preco').isVisible()), 'com função escolhida, o campo de preço inicial some (o preço vem da função)');
    await p.click('[data-acao="item-salvar"]');
    verificar(await esperarAte(async () => { const x = await item(MO.codigo); return !!(x && x.funcao_id); }, 20000), 'no banco: a mão de obra NV-MO aponta a função', await diag());
    const [sem] = await sql(`select count(*)::int as n from public.item_precos ip join public.itens i on i.id = ip.item_id where i.codigo = '${MO.codigo}' and i.empresa_id = '${await empresaId()}'`);
    verificar(sem.n === 0, 'no banco: a mão de obra não tem preço digitado', sem);
    // o preço da função aparece na tela do item
    const it = await item(MO.codigo);
    await irPara(p, '#/measure/item/' + it.id, '.abas-sublinhadas');
    await p.click('.abas-sublinhadas a:has-text("Preços")');
    await p.waitForTimeout(800);
    const t = await texto(p, 'main');
    verificar(/Carpenter/.test(t) && /38,00|38\.00/.test(t), 'a aba Preços mostra o valor da função Carpenter (US$ 38,00)', t.slice(0, 300));
  });

  await fluxo.passo(8, async () => {
    await irPara(p, '#/measure/assemblies', 'main .mz-assemblies, main .vazio, main a:has-text("Novo assembly")');
    await p.click('a:has-text("Novo assembly")');
    await p.waitForSelector('#form-assembly');
    verificar(await preencher(p, [['#as-nome', 'Parede Nova'], ['#as-tipo', 'area', 'lista']]), 'o formulário do assembly guardou o nome e o tipo');
    const valorDoItem = async (linha, nome) => p.locator('.mz-linha >> nth=' + linha + ' >> [name="item"] option', { hasText: nome }).first().getAttribute('value');
    await p.waitForSelector('.mz-linha >> nth=0 >> [name="item"] option:has-text("' + MAT.nome + '")', { state: 'attached', timeout: 40000 });
    verificar(await preencher(p, [['.mz-linha >> nth=0 >> [name="item"]', await valorDoItem(0, MAT.nome), 'lista'], ['.mz-linha >> nth=0 >> [name="formula"]', 'MeasuredArea / 32'], ['.mz-linha >> nth=0 >> [name="perda"]', '5']]), 'a linha do material guardou item, fórmula e perda');
    await p.click('[data-acao="mz-nova-linha"]');
    await p.waitForSelector('.mz-linha >> nth=1', { timeout: 10000 });
    verificar(await preencher(p, [['.mz-linha >> nth=1 >> [name="item"]', await valorDoItem(1, MO.nome), 'lista'], ['.mz-linha >> nth=1 >> [name="formula"]', 'MeasuredArea / 50']]), 'a linha da mão de obra guardou item e fórmula');
    await p.click('[data-acao="mz-salvar-assembly"]');
    await p.waitForSelector('.mz-assemblies', { timeout: 20000 });
    const t = await texto(p, '.mz-assemblies');
    verificar(/Parede Nova/.test(t) && /2 linhas/.test(t), 'o assembly aparece na lista com "2 linhas"', t.slice(0, 300));
    const assemblyNoBanco = async () => (await sql(`select jsonb_array_length(a.linhas) as n, a.linhas from public.assemblies a join public.empresas e on e.id = a.empresa_id where e.nome = '${aspas(EMPRESA)}' and a.nome = 'Parede Nova'`))[0];
    await esperarAte(async () => !!(await assemblyNoBanco()), 20000);
    const a = (await assemblyNoBanco()) || { n: 0, linhas: [] };
    verificar(a && a.n === 2, 'no banco: o assembly tem 2 linhas', a && a.n);
    const ids = new Set((a.linhas || []).map((x) => x.itemId));
    verificar(ids.has((await item(MAT.codigo)).id) && ids.has((await item(MO.codigo)).id), 'no banco: as linhas apontam para os dois itens');
    verificar(Number(((a.linhas || [])[0] || {}).perda) === 5, 'no banco: a perda de 5% ficou na linha do material', (a.linhas || [])[0]);
  });

  await fluxo.passo(9, async () => {
    await irPara(p, '#/measure/projeto/novo', '#form-projeto');
    await p.waitForTimeout(1200);
    verificar(await p.locator('#pj-contratanteId option', { hasText: CLIENTE }).count() === 1, '"Cliente Nova LLC" está na lista de clientes do projeto novo');
    verificar(erros.length === 0, 'nenhum erro de JavaScript em todo o fluxo' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  });
} finally {
  await browser.close();
  if (!MANTER) await apagarEmpresaFluxo();
}
process.exit(await fluxo.fim());
