/* KORbuild — Fluxo F02: projeto do zero até "Liberar para obra" (docs/testes/fluxos/F02-projeto-ate-liberar.md).
 * Conta real contra o banco local, em português, só pelas telas (o banco só é lido para conferir o que a tela mostra).
 * Uso: python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/fluxo-02-projeto-ate-liberar.test.mjs [--relatorio] [--manter] */

import { chromium } from 'playwright';
import { criarFluxo } from './_fluxo.mjs';
import { BASE, sql, aspas, hoje, somar, esperarAte, texto, irPara, abrirComo, garantirEmpresaFluxo, apagarEmpresaFluxo } from './_fluxo-dados.mjs';

const MANTER = process.argv.includes('--manter');
const fluxo = criarFluxo({ id: 'F02', modo: 'conta real, banco local, português', roteiro: 'docs/testes/fluxos/F02-projeto-ate-liberar.md', ambiente: BASE });
const { verificar } = fluxo;
const NOME = 'Garagem Pereira';

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
await apagarEmpresaFluxo();   // começa sempre do zero
const dados = await garantirEmpresaFluxo();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { ctx, p, erros } = await abrirComo(browser, 'admin');
fluxo.pagina(p);

// Coordenadas dos desenhos (em pés) → ponto na tela (tools/gerar-planta.py: cada desenho tem a sua origem na página e a sua escala)
const PLANTA = { x0: 110, y0: 190, k: 18 }, SUL = { x0: 110, y0: 470, k: 18 }, CORTE = { x0: 150, y0: 240, k: 27 };
async function clicar(pes, o = PLANTA) {
  const box = await p.locator('#mz-desenho').boundingBox();
  const zoom = box.width / 1224;
  await p.mouse.click(box.x + (o.x0 + pes[0] * o.k) * zoom, box.y + (792 - (o.y0 + pes[1] * o.k)) * zoom);
}
const noDialogo = async (rotulo) => { await p.click('dialog button:has-text("' + rotulo + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
const esperaDesenho = () => p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 40000 });
const projeto = async () => (await sql(`select p.id, p.situacao, p.obra_id, p.liberado_em, p.liberado_por, p.cronograma, (select count(*) from public.folhas f where f.projeto_id = p.id)::int as folhas, (select count(*) from public.propostas_emitidas x where x.projeto_id = p.id)::int as propostas from public.projetos p where p.empresa_id = '${dados.empresaId}' and p.nome = '${aspas(NOME)}'`))[0];
const dinheiroDe = (t) => { const m = String(t).match(/\d[\d.,]*/); if (!m) return NaN; let s = m[0]; const ponto = s.lastIndexOf('.'), virgula = s.lastIndexOf(','); if (virgula > ponto) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, ''); return Number(s); };
const numeroDe = (txt, unidade) => { const m = new RegExp('([\\d.]+(?:,\\d+)?) ' + unidade).exec(txt); return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : NaN; };
const quase = (v, alvo, tol) => Math.abs(v - alvo) <= tol;
const r2 = (v) => Math.round(v * 100) / 100;
let pj, area = 0, horas = 0;

try {
  await fluxo.passo(1, async () => {
    await irPara(p, '#/measure/projeto/novo', '#form-projeto');
    await p.waitForTimeout(1500);   // o espelho do banco ainda pode redesenhar a tela
    await p.fill('#pj-nome', NOME);
    await p.selectOption('#pj-contratanteId', dados.clienteId);
    await p.fill('#pj-cidade', 'Concord'); await p.fill('#pj-estado', 'NH');
    verificar(await p.inputValue('#pj-nome') === NOME, 'o formulário guardou o nome antes de salvar');
    await p.click('[data-acao="mz-salvar-projeto"]');
    verificar(await esperarAte(async () => !!(await projeto())), 'o projeto chegou ao banco');
    pj = await projeto();
    verificar(/\/projeto\/[^/]+\/plans$/.test(p.url()) || /\/plans/.test(p.url()), 'a tela abre na aba Plantas do projeto', p.url());
    verificar(pj.situacao === 'orcamento' && !pj.liberado_em && !pj.obra_id, 'no banco: em orçamento, sem liberação e sem obra', pj);
  });

  await fluxo.passo(2, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    const t = await texto(p, 'main');
    verificar(/0 de 6 passos/.test(t), '"0 de 6 passos"', t.slice(0, 300));
    const cartao = await texto(p, '.mz-liberar');
    verificar(/Obra/.test(cartao) && /Em análise/.test(cartao), 'o cartão Obra mostra "Em análise"', cartao);
    verificar(await p.locator('[data-acao="pj-liberar"]').isDisabled(), '"Liberar para obra" está desabilitado');
    verificar(/Falta terminar:.*plantas.*escala.*quem faz.*medir.*cronograma/i.test(cartao), 'o cartão diz o que falta: plantas, escala, quem faz, medição e cronograma', cartao);
  });

  await fluxo.passo(3, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id + '/plans', '#mz-enviar');
    await p.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
    verificar(await esperarAte(async () => (await projeto()).folhas === 3, 90000), 'as 3 folhas da planta chegaram ao banco', (await projeto()).folhas);
    await p.waitForTimeout(1500);
    verificar((await p.locator('.mz-folha, .tabela-plantas tbody tr, [data-folha]').count()) >= 3 || /3 folhas/i.test(await texto(p, 'main')), 'a aba Plantas lista as 3 folhas', (await texto(p, 'main')).slice(0, 200));
  });

  await fluxo.passo(4, async () => {
    const folhas = await sql(`select id, pagina from public.folhas where projeto_id = '${pj.id}' order by pagina`);
    verificar(folhas.length === 3, 'o projeto tem 3 folhas', folhas.length);
    const CONFIG = [{ razao: '48', pts: [[0, 31], [40, 31]], real: '40\'-0"', o: PLANTA }, { razao: '48', pts: [[0, -2.5], [40, -2.5]], real: '40\'', o: SUL }, { razao: '32', pts: [[0, -6], [28, -6]], real: '28\'', o: CORTE }];
    for (const [i, f] of folhas.entries()) {
      const c = CONFIG[i];
      await irPara(p, '#/measure/folha/' + f.id, '#mz-desenho');
      await esperaDesenho();
      await p.click('[data-acao="mz-escala"]');
      await p.selectOption('dialog select[name="razao"]', c.razao);
      await noDialogo('Usar esta escala');
      await clicar(c.pts[0], c.o); await clicar(c.pts[1], c.o);
      await p.fill('dialog input[name="real"]', c.real);
      await noDialogo('Conferir');
      const ok = await esperarAte(async () => { const [x] = await sql(`select escala from public.folhas where id = '${f.id}'`); return x.escala && x.escala.conferencia && x.escala.conferencia.ok; });
      verificar(ok, 'a folha ' + (i + 1) + ' ficou com a escala conferida no banco', (await sql(`select escala from public.folhas where id = '${f.id}'`))[0]);
    }
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    verificar(/1 de 6 passos|2 de 6 passos/.test(await texto(p, 'main')), 'a Visão geral conta os passos de plantas e escala', (await texto(p, 'main')).slice(0, 200));
  });

  await fluxo.passo(5, async () => {
    const [folha] = await sql(`select id from public.folhas where projeto_id = '${pj.id}' and pagina = 1`);
    await irPara(p, '#/measure/folha/' + folha.id, '#mz-desenho');
    await esperaDesenho();
    await p.click('[data-acao="mz-incluir-assembly"]');
    await p.check('dialog input[name="assembly"][value="' + dados.assemblies['Fluxo drywall'] + '"]');
    await p.click('dialog button:has-text("Continuar")');
    await p.waitForSelector('dialog input[name="nome"]');
    await p.fill('dialog input[name="nome"]', 'Piso da garagem');
    await noDialogo('Incluir no desenho');
    for (const pt of [[0, 0], [40, 0], [40, 28], [0, 28]]) await clicar(pt);
    await clicar([0, 0]);
    verificar(await esperarAte(async () => { const [x] = await sql(`select medicoes, assemblies from public.condicoes where projeto_id = '${pj.id}' and nome = 'Piso da garagem'`); return x && x.medicoes.length === 1; }), 'a condição com 1 medição chegou ao banco');
    const [c] = await sql(`select assemblies from public.condicoes where projeto_id = '${pj.id}' and nome = 'Piso da garagem'`);
    verificar(c && c.assemblies.includes(dados.assemblies['Fluxo drywall']), 'a condição aponta o assembly "Fluxo drywall"', c);
    const painel = await p.locator('.mz-cond').filter({ hasText: 'Piso da garagem' }).first().textContent();
    area = numeroDe(painel, 'sq ft');
    verificar(quase(area, 1120, 1120 * 0.005), 'a área medida é de cerca de 1.120 sq ft (' + area + ')', painel.replace(/\s+/g, ' ').slice(0, 200));
  });

  await fluxo.passo(6, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id + '/materials', '#mz-materiais');
    const mat = await texto(p, '#mz-materiais');
    verificar(/FLX-DW/.test(mat) && /Drywall sheet/.test(mat), 'o material FLX-DW aparece na lista', mat.slice(0, 300));
    const h = numeroDe(await texto(p, '.mz-horas'), 'h');
    horas = h;
    verificar(h === Math.ceil(area / 50), 'a mão de obra estimada é a área ÷ 50 = ' + r2(area / 50) + ' h arredondada para cima: ' + Math.ceil(area / 50) + ' h (' + h + ')', await texto(p, '.mz-horas'));
    const preco = await p.evaluate(async () => { const m = await import('/js/measure.js'); const pr = await import('/js/precos.js'); const it = m.itens().find((i) => i.codigo === 'FLX-MO-DW'); const x = it && pr.precoEm(it); return it ? { valor: x && x.valor, fonte: x && x.fonte, daFuncao: x && x.daFuncao } : null; });
    verificar(preco && preco.valor === 46.36, 'a hora do item FLX-MO-DW vale US$ 46,36 (38 × 1,22)', preco);
    verificar(preco && preco.daFuncao === true && /Função: Carpenter/.test(preco.fonte || ''), 'a origem do preço é "Função: Carpenter"', preco);
  });

  await fluxo.passo(7, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id + '/schedule', '[data-acao="pj-add-tarefa"]');
    const preencher = async (nome, inicio, dias, quem) => {
      await p.click('[data-acao="pj-add-tarefa"]'); await p.waitForTimeout(300);
      for (const [campo, valor] of [['nome', nome], ['inicio', inicio], ['dias', String(dias)]]) {
        const el = p.locator('[data-pj-tarefa="' + campo + '"]').last();
        await el.fill(valor); await el.blur(); await p.waitForTimeout(300);
      }
      if (quem) { await p.locator('[data-pj-tarefa="quem"]').last().selectOption(quem); await p.waitForTimeout(300); }
    };
    await preencher('Instalação de drywall', hoje(), 3, 'proprio');
    await preencher('Pintura', somar(hoje(), 7), 4, 'terceiro');
    verificar(await esperarAte(async () => { const x = await projeto(); return x && x.cronograma && (x.cronograma.tarefas || []).length === 2; }, 20000), 'as 2 tarefas chegaram ao banco', (await projeto()).cronograma);
    const t = await texto(p, '.tabela-cronograma');
    const dm = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    verificar(t.includes(dm(somar(hoje(), 2))) && t.includes(dm(somar(hoje(), 10))), 'os términos calculados são ' + dm(somar(hoje(), 2)) + ' e ' + dm(somar(hoje(), 10)), t.slice(0, 300));
    const tarefas = (await projeto()).cronograma.tarefas;
    verificar(tarefas[0].quem === 'proprio' && tarefas[1].quem === 'terceiro', 'quem faz cada tarefa ficou registrado (nós e prestadora)', tarefas.map((x) => x.quem));
  });

  await fluxo.passo(8, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    const t = await texto(p, 'main');
    verificar(/5 de 6 passos/.test(t) && /Próximo: emitir a proposta/i.test(t), '"5 de 6 passos" e o próximo é emitir a proposta', t.slice(0, 300));
    verificar(/Tudo pronto/.test(await texto(p, '.mz-liberar')), 'o cartão Obra diz "Tudo pronto"');
    verificar(await p.locator('[data-acao="pj-liberar"]').isEnabled(), '"Liberar para obra" está habilitado, sem a proposta');
  });

  await fluxo.passo(9, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id + '/proposta', '#form-proposta');
    await p.waitForFunction(() => document.querySelectorAll('.prop-linhas tbody tr').length >= 1, null, { timeout: 60000 });
    const linha = await texto(p, '.prop-linhas tbody tr');
    const titulo = await p.inputValue('.prop-linhas tbody tr input[name="titulo"]');
    verificar(/09 29 00/.test(linha) && /Gypsum board/i.test(titulo), 'a linha é a etapa "09 29 00 · Gypsum board"', titulo + ' · ' + linha.slice(0, 120));
    const custoTxt = await texto(p, '.prop-custo');
    const mm = custoTxt.match(/Custo\s*(\S+\s?[\d.,]+)\s*=\s*material\s*(\S+\s?[\d.,]+)\s*\+\s*mão de obra\s*(\S+\s?[\d.,]+)/);
    verificar(!!mm, 'a base do cálculo mostra custo = material + mão de obra', custoTxt);
    if (mm) {
      const [custo, material, mo] = [dinheiroDe(mm[1]), dinheiroDe(mm[2]), dinheiroDe(mm[3])];
      verificar(quase(material + mo, custo, 0.02), 'custo = material + mão de obra (' + custo + ' = ' + material + ' + ' + mo + ')');
      verificar(horas > 0 && quase(mo, r2(horas * 46.36), horas * 46.36 * 0.01 + 0.5), 'a mão de obra é as horas × US$ 46,36 (' + mo + ' ≈ ' + r2(horas * 46.36) + ')');
      const total = dinheiroDe(await texto(p, '#prop-total'));
      verificar(quase(total, custo * 1.09 * 1.07, 0.03), 'o total é custo × 1,09 × 1,07 = ' + r2(custo * 1.09 * 1.07) + ' (' + total + ')');
    }
    await p.click('[data-acao="prop-emitir"]');
    await noDialogo('Emitir');
    verificar(await esperarAte(async () => (await projeto()).propostas === 1, 30000), 'a proposta foi emitida (1 no banco)');
    const [n] = await sql(`select numero from public.propostas_emitidas where projeto_id = '${pj.id}'`);
    verificar(n && /^P-\d{4}-\d+/.test(n.numero), 'o número da proposta é P-AAAA-NNN (' + (n && n.numero) + ')');
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    verificar(/6 de 6 passos/.test(await texto(p, 'main')), 'a Visão geral mostra "6 de 6 passos"');
  });

  await fluxo.passo(10, async () => {
    await p.click('[data-acao="pj-liberar"]');
    await p.waitForSelector('[data-acao="pj-voltar-analise"]', { timeout: 15000 });
    const cartao = await texto(p, '.mz-liberar');
    verificar(/Liberado para obra/.test(cartao) && /Fábio Fluxo/.test(cartao), 'a etiqueta "Liberado para obra" traz quem liberou', cartao);
    verificar(await p.locator('a:has-text("Abrir no Daily")').count() === 1 && await p.locator('[data-acao="pj-voltar-analise"]').count() === 1, '"Abrir no Daily" e "Voltar para análise" aparecem');
    verificar(await esperarAte(async () => { const x = await projeto(); return !!(x && x.liberado_em && x.obra_id); }, 20000), 'no banco: liberado_em preenchido e obra criada', await projeto());
    const x = await projeto();
    const [o] = await sql(`select projeto_id, nome from public.obras where id = '${x.obra_id}'`);
    verificar(o && o.projeto_id === x.id && o.nome === NOME, 'a obra nasceu do projeto (mesmo nome, projeto_id)', o);
    verificar(x.liberado_por === 'Fábio Fluxo', 'liberado_por guarda o nome de quem liberou', x.liberado_por);
  });

  await fluxo.passo(11, async () => {
    await irPara(p, '#/daily/obras', 'main .cartao-obra, main .vazio');
    if (!(await texto(p, 'main')).includes(NOME)) { await p.reload(); await p.waitForSelector('main .cartao-obra, main .vazio', { timeout: 40000 }); await p.waitForTimeout(1500); }
    const lista = await texto(p, 'main');
    verificar(/Projetos em execução/.test(lista) && lista.includes(NOME), 'o Daily lista "Garagem Pereira" em "Projetos em execução"', lista.slice(0, 300));
    await p.locator('.cartao-obra', { hasText: NOME }).first().click();
    await p.waitForSelector('.obra-resumo', { timeout: 20000 });
    const resumo = (await p.locator('.obra-resumo').first().innerText()).replace(/\s+/g, ' ');
    verificar(/Etapa atual\s*Instalação de drywall/.test(resumo), '"Etapa atual: Instalação de drywall"', resumo);
    verificar(await p.locator('a[href*="/measure/projeto/' + pj.id + '"]').count() >= 1, 'a página tem o atalho para abrir o projeto no Takeoff');
  });

  await fluxo.passo(12, async () => {
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    await p.click('[data-acao="pj-voltar-analise"]');
    verificar(await esperarAte(async () => !(await projeto()).liberado_em, 20000), 'no banco a liberação foi zerada', await projeto());
    await irPara(p, '#/daily/obras', 'main .cartao-obra, main .vazio');
    verificar(!(await texto(p, 'main')).includes(NOME), 'o projeto some do Daily');
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    await p.click('[data-acao="pj-liberar"]');
    await p.waitForSelector('[data-acao="pj-voltar-analise"]', { timeout: 15000 });
    verificar(await esperarAte(async () => !!(await projeto()).liberado_em, 20000), 'liberar de novo grava a liberação');
    const obras = await sql(`select id from public.obras where projeto_id = '${pj.id}'`);
    verificar(obras.length === 1 && obras[0].id === (await projeto()).obra_id, 'continua uma obra só, a mesma de antes', obras);
    await irPara(p, '#/daily/obras', 'main .cartao-obra, main .vazio');
    if (!(await texto(p, 'main')).includes(NOME)) { await p.reload(); await p.waitForSelector('main .cartao-obra, main .vazio', { timeout: 40000 }); await p.waitForTimeout(1500); }
    verificar((await texto(p, 'main')).includes(NOME), 'o projeto volta ao Daily');
  });

  await fluxo.passo(13, async () => {
    await irPara(p, '#/conta', '.ini-painel, .oficial-titulo', 60000);
    await p.waitForSelector('.ini-painel', { timeout: 60000 });
    await p.waitForTimeout(1000);
    const t = await texto(p, '.ini-painel');
    verificar(/Andamento dos projetos/.test(t) && t.includes(NOME), '"Andamento dos projetos" lista "Garagem Pereira"', t.slice(0, 300));
    verificar(erros.length === 0, 'nenhum erro de JavaScript em todo o fluxo' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  });
} finally {
  await browser.close();
  if (!MANTER) await apagarEmpresaFluxo();
}
process.exit(await fluxo.fim());
