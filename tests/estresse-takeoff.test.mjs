/* KORbuild — ESTRESSE do Takeoff: muitos desenhos (docs/testes/estresse.md).
 * Uma empresa de teste, um projeto, a planta de 3 folhas enviada pela tela e, em volume, dezenas de condições com centenas de medições
 * (retângulos de áreas conhecidas, linhas e contagens), pelas funções do app (measure.js), que levam cada mudança ao banco pelo mesmo caminho do uso real.
 * Confere: tudo chegou ao banco; o que o app calcula bate com a conta independente feita aqui (área medida, materiais, horas, custo e preço de venda);
 * nada muda ao recarregar; o desenho, a lista de materiais, a proposta e o Gantt abrem em tempo razoável; nenhum erro de JavaScript.
 * Uso:  python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/estresse-takeoff.test.mjs [--condicoes=40] [--medicoes=30] [--relatorio] [--manter]
 *       Supabase de verdade (js/config.js):  $env:SUPABASE_ACCESS_TOKEN = "sbp_…"  →  node tests/estresse-takeoff.test.mjs --real [...]  (apaga tudo no fim) */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { AMBIENTE, REAL, BASE, sql, hoje, esperarAte, texto, irPara, abrirComo, garantirEmpresaFluxo, criarProjetoLiberado, apagarEmpresaFluxo } from './_fluxo-dados.mjs';

const arg = (nome, padrao) => { const a = process.argv.find((x) => x.startsWith('--' + nome + '=')); return a ? Number(a.split('=')[1]) : padrao; };
const N_COND = arg('condicoes', 40), N_MED = arg('medicoes', 30);
const MANTER = process.argv.includes('--manter'), RELATORIO = process.argv.includes('--relatorio');
// limites generosos (em segundos): o objetivo é pegar travamento, não medir milissegundo. No Supabase de verdade a rede entra na conta.
const LIM = REAL ? { cliqueMs: 150, subir: 180, abrir: 40, desenho: 40, materiais: 30, proposta: 40, gantt: 40 } : { cliqueMs: 100, subir: 120, abrir: 30, desenho: 30, materiais: 20, proposta: 30, gantt: 30 };

let falhas = 0, total = 0;
const tempos = [], notas = [];
const verificar = (cond, texto_, detalhe) => { total++; if (cond) console.log('  ok  ' + texto_); else { falhas++; console.log('FALHA ' + texto_ + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 500)) : '')); } };
const cronometrar = async (nome, limite, fn) => { const t0 = Date.now(); const r = await fn(); const s = (Date.now() - t0) / 1000; tempos.push({ nome, s, limite }); verificar(s <= limite, nome + ': ' + s.toFixed(1) + ' s (limite ' + limite + ' s)', s); return r; };
const r2 = (v) => Math.round(v * 100) / 100;

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
console.log('Estresse do Takeoff · ' + AMBIENTE + ' · ' + N_COND + ' condições × ' + N_MED + ' medições');
await apagarEmpresaFluxo();
const dados = await garantirEmpresaFluxo();
const { projetoId } = await criarProjetoLiberado(dados, { nome: 'Estresse Takeoff', liberado: false });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const { p, erros } = await abrirComo(browser, 'admin');
const projeto = async () => (await sql(`select (select count(*) from public.folhas f where f.projeto_id = '${projetoId}')::int as folhas, (select count(*) from public.condicoes c where c.projeto_id = '${projetoId}')::int as condicoes, coalesce((select sum(jsonb_array_length(c.medicoes)) from public.condicoes c where c.projeto_id = '${projetoId}'), 0)::int as medicoes`))[0];

try {
  console.log('\nA planta e as escalas');
  await irPara(p, '#/measure/projeto/' + projetoId + '/plans', '#mz-enviar');
  await p.setInputFiles('#mz-enviar', 'assets/plantas/casa-modelo.pdf');
  verificar(await esperarAte(async () => (await projeto()).folhas === 3, 90000), 'as 3 folhas da planta chegaram ao banco');
  const folhas = await sql(`select id, pagina from public.folhas where projeto_id = '${projetoId}' order by pagina`);
  await irPara(p, '#/measure/projeto/' + projetoId, '.mz-liberar');
  const POL_PT = 48 / 72;   // escala 1/4" = 1'-0": 1 ponto do PDF = 48/72 polegadas reais
  await p.evaluate(async ([ids, k]) => {
    const m = await import('/js/measure.js');
    for (const id of ids) { m.definirEscala(id, { nome: '1/4" = 1\'-0"', polPorPonto: k, razao: 48 }); m.registrarConferencia(id, 100, 100); }
  }, [folhas.map((f) => f.id), POL_PT]);
  verificar(await esperarAte(async () => (await sql(`select count(*)::int as n from public.folhas where projeto_id = '${projetoId}' and escala is not null`))[0].n === 3, 40000), 'as escalas das 3 folhas chegaram ao banco');

  console.log('\nOs desenhos em volume');
  // N_COND condições de área (alternando os dois assemblies), mais linhas e contagens sem assembly; retângulos de tamanho variado e conhecido
  const gerar = await p.evaluate(async ([projetoId, folhaIds, assemblies, nCond, nMed, k]) => {
    const m = await import('/js/measure.js');
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
    const t0 = performance.now();
    const durs = [];
    const med = (...a) => { const t = performance.now(); const r = m.adicionarMedicao(...a); durs.push(performance.now() - t); return r; };
    const folga = () => new Promise((ok) => setTimeout(ok, 0));   // cede o controle ao navegador (gravar, sincronizar), como acontece entre um clique e outro
    const conds = [];
    for (let i = 0; i < nCond; i++) {
      const folhaId = folhaIds[i % folhaIds.length];
      const r = m.salvarCondicao(null, { projetoId, folhaId, nome: 'Área ' + String(i + 1).padStart(3, '0'), tipo: 'area' });
      m.aplicarAssembly(r.id, assemblies[i % assemblies.length]);
      const medidas = [];
      for (let j = 0; j < nMed; j++) {
        const x = Math.round(rnd() * 900), y = Math.round(rnd() * 600), w = 20 + Math.round(rnd() * 120), h = 15 + Math.round(rnd() * 90);
        med(r.id, folhaId, [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], false);
        medidas.push(w * h);
      }
      await folga();
      conds.push({ id: r.id, folhaId, areaPts2: medidas.reduce((s, v) => s + v, 0), assembly: assemblies[i % assemblies.length] });
    }
    // linhas e contagens: muitas medições sem assembly (só pesam no desenho e no banco)
    const extra = Math.max(2, Math.round(nCond / 5));
    let pontos = 0;
    for (let i = 0; i < extra; i++) {
      const folhaId = folhaIds[i % folhaIds.length];
      const l = m.salvarCondicao(null, { projetoId, folhaId, nome: 'Linha ' + String(i + 1).padStart(3, '0'), tipo: 'linear' });
      await folga();
      for (let j = 0; j < nMed; j++) { const x = Math.round(rnd() * 800), y = Math.round(rnd() * 600); med(l.id, folhaId, [[x, y], [x + 40 + Math.round(rnd() * 100), y + Math.round(rnd() * 30)]], false); pontos++; }
      const c = m.salvarCondicao(null, { projetoId, folhaId, nome: 'Contagem ' + String(i + 1).padStart(3, '0'), tipo: 'contagem' });
      for (let j = 0; j < nMed; j++) { med(c.id, folhaId, [[Math.round(rnd() * 900), Math.round(rnd() * 650)]], false); pontos++; }
    }
    const ord = durs.slice().sort((a, b) => a - b), fim = durs.slice(-200);
    return { conds, extra, pontos, ms: Math.round(performance.now() - t0), clique: { n: durs.length, media: durs.reduce((a, b) => a + b, 0) / durs.length, p95: ord[Math.floor(ord.length * 0.95)], max: ord[ord.length - 1], mediaFim: fim.reduce((a, b) => a + b, 0) / fim.length } };
  }, [projetoId, folhas.map((f) => f.id), [dados.assemblies['Fluxo drywall'], dados.assemblies['Fluxo pintura']], N_COND, N_MED, POL_PT]);
  const esperadas = N_COND * N_MED + gerar.pontos, condicoesEsperadas = N_COND + gerar.extra * 2;
  console.log('  (criar no app: ' + (gerar.ms / 1000).toFixed(1) + ' s para ' + esperadas + ' medições em ' + condicoesEsperadas + ' condições)');
  const q = gerar.clique;
  console.log('  (cada clique de medição: média ' + q.media.toFixed(1) + ' ms · p95 ' + q.p95.toFixed(1) + ' ms · máx ' + q.max.toFixed(0) + ' ms · últimos 200: ' + q.mediaFim.toFixed(1) + ' ms)');
  verificar(q.mediaFim <= LIM.cliqueMs, 'com o projeto cheio, cada nova medição custa ' + q.mediaFim.toFixed(1) + ' ms em média (limite ' + LIM.cliqueMs + ' ms)', q);
  notas.push('Cada clique de medição: média ' + q.media.toFixed(1) + ' ms, p95 ' + q.p95.toFixed(1) + ' ms, últimos 200 ' + q.mediaFim.toFixed(1) + ' ms');
  notas.push('Criar no app: ' + (gerar.ms / 1000).toFixed(1) + ' s para ' + esperadas + ' medições');
  await cronometrar('tudo chegou ao banco (condições e medições)', LIM.subir, async () => { const ok = await esperarAte(async () => { const x = await projeto(); return x.condicoes === condicoesEsperadas && x.medicoes === esperadas; }, LIM.subir * 1000, 500); if (!ok) console.log('      no banco:', await projeto()); return ok; });
  const noBanco = await projeto();
  verificar(noBanco.condicoes === condicoesEsperadas && noBanco.medicoes === esperadas, 'o banco tem ' + condicoesEsperadas + ' condições e ' + esperadas + ' medições', noBanco);

  console.log('\nA conta independente');
  // área real de cada condição (sq ft) = pt² × (48/72)² ÷ 144; materiais e horas por linha de assembly, arredondando por condição (passo 1)
  const sqft = (pts2) => pts2 * POL_PT * POL_PT / 144;
  const PRECO = { dw: 14.5, mo_dw: 38 * 1.22, pt: 160, mo_pt: 30 * 1.22 }, MARGEM = { overhead: 0.09, lucro: 0.07 };
  const esperado = { area: 0, dw: 0, moDw: 0, pt: 0, moPt: 0, horasDw: 0, horasPt: 0 };
  for (const c of gerar.conds) {
    const a = sqft(c.areaPts2); esperado.area += a;
    if (c.assembly === dados.assemblies['Fluxo drywall']) { const q = Math.ceil(a / 32 * 1.05 - 1e-9), h = Math.ceil(a / 50 - 1e-9); esperado.dw += q * PRECO.dw; esperado.moDw += h * PRECO.mo_dw; esperado.horasDw += h; }
    else { const q = Math.ceil(a / 400 - 1e-9), h = Math.ceil(a / 100 - 1e-9); esperado.pt += q * PRECO.pt; esperado.moPt += h * PRECO.mo_pt; esperado.horasPt += h; }
  }
  const custoEsp = esperado.dw + esperado.moDw + esperado.pt + esperado.moPt;
  const vendaEsp = (c) => r2(c * (1 + MARGEM.overhead) * (1 + MARGEM.lucro));
  console.log('  área ' + r2(esperado.area) + ' sq ft · custo ' + r2(custoEsp) + ' · venda ' + vendaEsp(custoEsp));

  // o que o app calcula, lido do estado (mesma função da tela de materiais e da proposta)
  const lerApp = () => p.evaluate(async (pid) => {
    const m = await import('/js/measure.js'); const pr = await import('/js/precos.js');
    const cs = m.condicoesDo(pid).filter((c) => c.tipo === 'area');
    const area = cs.reduce((s, c) => s + m.totaisDaCondicao(c).base, 0);
    const q = m.quantidadesDoProjeto(pid);
    const grupos = q.porItem.map((g) => ({ item: g.item, total: g.total }));
    const c = pr.custoDe(grupos);
    return { condicoes: m.condicoesDo(pid).length, medicoes: m.condicoesDo(pid).reduce((s, x) => s + x.medicoes.length, 0), areaPol2: area, custo: c.custo, venda: c.venda, material: c.material, maoDeObra: c.maoDeObra, semPreco: c.semPreco.length,
      horas: q.porItem.filter((g) => g.item.categoria === 'mao-de-obra').reduce((s, g) => s + g.total, 0), erros: q.linhas.filter((l) => l.erro).length };
  }, projetoId);
  const antes = await lerApp();
  const areaApp = antes.areaPol2 / 144;   // totaisDaCondicao devolve pol²
  verificar(Math.abs(areaApp - esperado.area) < Math.max(0.5, esperado.area * 0.0005), 'a área total medida pelo app bate com a conta independente (' + r2(areaApp) + ' × ' + r2(esperado.area) + ' sq ft)', { areaApp, esperada: esperado.area });
  verificar(Math.abs(antes.custo - custoEsp) < 0.5 && antes.semPreco === 0 && antes.erros === 0, 'o custo (material + mão de obra) bate com a conta independente: ' + r2(antes.custo) + ' × ' + r2(custoEsp), antes);
  verificar(Math.abs(antes.venda - vendaEsp(custoEsp)) < 0.5, 'o preço de venda (overhead 9% e lucro 7%) bate: ' + r2(antes.venda) + ' × ' + vendaEsp(custoEsp), antes);
  verificar(antes.horas === esperado.horasDw + esperado.horasPt, 'as horas de mão de obra batem: ' + antes.horas + ' × ' + (esperado.horasDw + esperado.horasPt), antes);

  console.log('\nRecarregar: tudo volta do banco igual');
  await p.goto('about:blank');
  await cronometrar('abrir o projeto com todos os desenhos', LIM.abrir, async () => { await p.goto(BASE + '#/measure/projeto/' + projetoId); await p.waitForSelector('.mz-liberar', { timeout: LIM.abrir * 1000 }); await esperarAte(async () => (await lerApp().catch(() => ({ medicoes: 0 }))).medicoes === esperadas, LIM.abrir * 1000, 400); });
  const depois = await lerApp();
  verificar(depois.condicoes === antes.condicoes && depois.medicoes === antes.medicoes, 'depois de recarregar o app tem as mesmas ' + depois.condicoes + ' condições e ' + depois.medicoes + ' medições', { antes, depois });
  verificar(Math.abs(depois.custo - antes.custo) < 0.01 && Math.abs(depois.venda - antes.venda) < 0.01 && Math.abs(depois.areaPol2 - antes.areaPol2) < 0.5, 'custo, venda e área idênticos antes e depois de recarregar', { antes, depois });

  console.log('\nAs telas com tudo desenhado');
  const folhaCheia = folhas[0].id;
  await cronometrar('abrir o desenho da folha 1 com todas as condições', LIM.desenho, async () => { await irPara(p, '#/measure/folha/' + folhaCheia, '#mz-desenho', LIM.desenho * 1000); await p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: LIM.desenho * 1000 }); });
  const tela = await p.evaluate(() => { const c = document.getElementById('mz-desenho'); return c ? { w: c.width, h: c.height } : null; });
  verificar(tela && tela.w > 0 && tela.h > 0, 'a área de desenho (canvas) foi montada (' + (tela ? tela.w + ' × ' + tela.h : 'sem canvas') + ')', tela);
  const lista = await p.locator('.mz-cond').count();
  verificar(lista >= Math.floor(condicoesEsperadas / 3), 'o painel lista as condições da folha (' + lista + ')', lista);
  await cronometrar('lista de materiais', LIM.materiais, async () => { await irPara(p, '#/measure/projeto/' + projetoId + '/materials', '#mz-materiais', LIM.materiais * 1000); });
  const mat = await texto(p, '#mz-materiais');
  verificar(/FLX-DW/.test(mat) && /FLX-PT/.test(mat), 'a lista de materiais traz drywall e tinta', mat.slice(0, 200));
  const horasTela = await p.evaluate(() => { const e = document.querySelector('.mz-horas'); return e ? e.textContent.replace(/\s+/g, ' ') : ''; });
  const hTotal = esperado.horasDw + esperado.horasPt;
  verificar([String(hTotal), String(hTotal).replace(/\B(?=(\d{3})+(?!\d))/g, ','), String(hTotal).replace(/\B(?=(\d{3})+(?!\d))/g, '.')].some((x) => horasTela.includes(x + ' h')), 'a tela de materiais mostra as ' + (esperado.horasDw + esperado.horasPt) + ' horas', horasTela.slice(0, 200));
  await cronometrar('abrir a proposta', LIM.proposta, async () => { await irPara(p, '#/measure/projeto/' + projetoId + '/summary', 'main', LIM.proposta * 1000); await p.waitForTimeout(500); });
  verificar(erros.length === 0, 'nenhum erro de JavaScript até aqui' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));

  console.log('\nO cronograma e o Gantt com o valor de tudo');
  await irPara(p, '#/measure/projeto/' + projetoId + '/schedule', '[data-acao="pj-gerar-cronograma"]');
  await p.click('[data-acao="pj-gerar-cronograma"]');
  await p.waitForSelector('[data-pj-tarefa="nome"]', { timeout: 20000 });
  verificar(await p.locator('[data-pj-tarefa="nome"]').count() === 2, 'o cronograma nasce com as duas etapas (drywall e pintura)', await p.locator('[data-pj-tarefa="nome"]').count());
  verificar(await esperarAte(async () => (((await sql(`select cronograma from public.projetos where id = '${projetoId}'`))[0].cronograma || {}).tarefas || []).length === 2, 30000), 'as duas tarefas chegaram ao banco (com a etapa de cada uma)');
  const tarefasBanco = ((await sql(`select cronograma from public.projetos where id = '${projetoId}'`))[0].cronograma || {}).tarefas || [];
  verificar(tarefasBanco.every((t) => /^\d\d \d\d \d\d · /.test(t.etapa || '')), 'cada tarefa guarda a etapa (cost code) no banco', tarefasBanco.map((t) => t.etapa));
  await cronometrar('página do Gantt com valor por tarefa e curva S', LIM.gantt, async () => { await irPara(p, '#/measure/gantt/' + projetoId, '.valor-gantt', LIM.gantt * 1000); await p.waitForTimeout(500); });
  if (!(await p.locator('#vg-total').count())) console.log('      Gantt:', p.url(), (await texto(p, 'main')).slice(0, 400));
  const num = (t) => Number(t.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
  const vendaTarefas = vendaEsp(esperado.dw + esperado.moDw) + vendaEsp(esperado.pt + esperado.moPt);
  verificar(Math.abs(num(await texto(p, '#vg-total')) - vendaTarefas) < 1, 'o valor total do Gantt (venda) bate com a conta independente: ' + r2(vendaTarefas), await texto(p, '#vg-total'));
  verificar(await p.locator('#vg-soltos').count() === 0, 'nenhuma etapa medida ficou fora do cronograma');
  verificar(await p.locator('svg.curva-s polyline.cs-plan').count() === 1, 'a curva S foi desenhada');
  verificar(erros.length === 0, 'nenhum erro de JavaScript em todo o teste' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close();
  if (!MANTER) await apagarEmpresaFluxo();
}

console.log('\nTempos');
for (const t of tempos) console.log('  ' + t.s.toFixed(1).padStart(6) + ' s  (limite ' + t.limite + ')  ' + t.nome);
console.log('\nEstresse: ' + (total - falhas) + '/' + total + ' verificações passaram' + (falhas ? ' · ' + falhas + ' falha(s)' : ''));
if (RELATORIO) {
  mkdirSync('docs/testes/rodadas', { recursive: true });
  const d = new Date(), pad = (n) => String(n).padStart(2, '0');
  const arq = 'docs/testes/rodadas/' + d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + '_' + pad(d.getHours()) + '-' + pad(d.getMinutes()) + '_estresse.md';
  writeFileSync(arq, '# Estresse do Takeoff · ' + AMBIENTE + '\n\n- ' + N_COND + ' condições de área × ' + N_MED + ' medições, mais linhas e contagens\n- Resultado: ' + (total - falhas) + '/' + total + ' verificações' + (falhas ? ' (' + falhas + ' falha(s))' : '') + '\n' + notas.map((n) => '- ' + n + '\n').join('') + '\n| Etapa | Tempo (s) | Limite (s) |\n|---|---|---|\n' + tempos.map((t) => '| ' + t.nome + ' | ' + t.s.toFixed(1) + ' | ' + t.limite + ' |').join('\n') + '\n');
  console.log('Relatório: ' + arq);
}
process.exit(falhas ? 1 : 0);
