/* KORbuild — Fluxo F03: obra, diário do campo, aprovação e o % feito no Gantt (docs/testes/fluxos/F03-obra-diario-gantt.md).
 * Conta real contra o banco local, em português, só pelas telas: o encarregado no celular e o administrador no computador.
 * Uso: python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/fluxo-03-obra-diario-gantt.test.mjs [--relatorio] [--manter]  * No Supabase de verdade (js/config.js):  $env:SUPABASE_ACCESS_TOKEN = "sbp_…"  →  node tests/fluxo-03-obra-diario-gantt.test.mjs --real [--relatorio]
 */

import { chromium } from 'playwright';
import { criarFluxo } from './_fluxo.mjs';
import { AMBIENTE, REAL, BASE, sql, hoje, somar, esperarAte, texto, irPara, abrirComo, garantirEmpresaFluxo, criarProjetoLiberado, apagarEmpresaFluxo } from './_fluxo-dados.mjs';

const MANTER = process.argv.includes('--manter');
const fluxo = criarFluxo({ id: 'F03', modo: AMBIENTE, roteiro: 'docs/testes/fluxos/F03-obra-diario-gantt.md', ambiente: BASE });
const { verificar } = fluxo;
const NOME = 'Reforma Mitchell';

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
await apagarEmpresaFluxo();
const dados = await garantirEmpresaFluxo();
const { projetoId, obraId } = await criarProjetoLiberado(dados, { nome: NOME, tarefas: [
  { id: 'tf-1', nome: 'Demolição e remoção', quem: 'proprio', inicio: somar(hoje(), -10), dias: 3, pct: 0 },
  { id: 'tf-2', nome: 'Instalação de drywall', quem: 'proprio', inicio: hoje(), dias: 5, pct: 20 },
  { id: 'tf-3', nome: 'Pintura', quem: 'terceiro', inicio: somar(hoje(), 6), dias: 4, pct: 0 }] });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const edu = await abrirComo(browser, 'encarregado', { campo: true, ir: '#/daily' });
const fab = await abrirComo(browser, 'admin', { ir: '#/daily' });
const erros = [...edu.erros, ...fab.erros];
const rdo = async () => (await sql(`select id, status, numero, codigo, aprovado_por, conteudo from public.rdos where obra_id = '${obraId}' order by data desc limit 1`))[0];
const tarefa = async (id) => ((await sql(`select cronograma from public.projetos where id = '${projetoId}'`))[0].cronograma.tarefas || []).find((t) => t.id === id);
const noDialogo = async (p, rotulo) => { await p.click('dialog button:has-text("' + rotulo + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
let rdoId = null;

try {
  await fluxo.passo(1, async () => {
    fluxo.pagina(edu.p);
    await irPara(edu.p, '#/daily', 'main .cartao-obra, main .vazio');
    await edu.p.waitForURL((u) => String(u).includes('#/daily/campo'), { timeout: 20000 }).catch(() => null);
    if (!(await texto(edu.p, 'main')).includes(NOME)) { await edu.p.reload(); await edu.p.waitForSelector('main .cartao-obra, main .vazio', { timeout: 40000 }); await edu.p.waitForTimeout(1500); }
    const t = await texto(edu.p, 'main');
    verificar(edu.p.url().includes('#/daily/campo'), 'o encarregado entra direto no "Hoje" do Daily', edu.p.url());
    verificar(/Seus projetos/i.test(t) && t.includes(NOME), '"Reforma Mitchell" aparece em "Seus projetos"', t.slice(0, 300));
    verificar(await edu.p.locator('a[href*="obra/nova"]').count() === 0, 'sem botão de nova obra');
  });

  await fluxo.passo(2, async () => {
    await edu.p.locator('.cartao-obra', { hasText: NOME }).first().click();
    await edu.p.waitForSelector('[data-acao="novo-rdo"], [data-acao="copiar-rdo"]', { timeout: 20000 });
    const t = await texto(edu.p, 'main');
    verificar(/Etapa atual\s*Instalação de drywall/.test(t) && !/Etapa atual[^A-Z]*Demolição/.test(t), '"Etapa atual: Instalação de drywall" (só ela está em andamento)', t.slice(0, 300));
    verificar(await edu.p.locator('[data-acao="novo-rdo"]').count() === 1, 'só o RDO de hoje está pendente: nada atrasado de antes da liberação, mesmo com tarefa no passado');
  });

  await fluxo.passo(3, async () => {
    await edu.p.click('[data-acao="novo-rdo"]');
    await edu.p.waitForSelector('#s-clima', { timeout: 20000 });
    const auto = await edu.p.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2, null, { timeout: 8000 }).then(() => true, () => false);
    if (!auto) { await edu.p.click('[data-acao="clima-tempo"][data-turno="manha"][data-valor="sol"]'); await edu.p.click('[data-acao="clima-tempo"][data-turno="tarde"][data-valor="sol"]'); }
    verificar(await edu.p.locator('[data-acao="clima-tempo"][aria-pressed="true"]').count() === 2, 'clima da manhã e da tarde marcados (' + (auto ? 'automático' : 'à mão') + ')');
    await edu.p.locator('[data-acao="equipe-add"]').first().click();
    await edu.p.locator('#s-atividades textarea').first().fill('Instalação de drywall na garagem');
    await edu.p.locator('#s-atividades textarea').first().blur();
    rdoId = edu.p.url().split('/rdo/')[1].split(/[/?]/)[0];
    verificar(/^[0-9a-f-]{30,}$|^rdo-/.test(rdoId), 'o diário abriu', edu.p.url());
    verificar(/Pronto para enviar/.test(await texto(edu.p, 'body')) || await edu.p.locator('.secao-feita, [aria-label*="pront" i]').count() > 0, 'as seções ficam prontas', (await texto(edu.p, 'body')).slice(-200));
  });

  await fluxo.passo(4, async () => {
    const opcoes = await edu.p.locator('#att-0 option').allInnerTexts();
    verificar(opcoes.length === 4, 'a lista oferece "Nenhuma" e as 3 tarefas', opcoes);
    verificar(opcoes.some((o) => /Instalação de drywall \(20%\)/.test(o)) && opcoes.some((o) => /Demolição e remoção \(0%\)/.test(o)) && opcoes.some((o) => /Pintura \(0%\)/.test(o)), 'cada tarefa vem com o % de hoje', opcoes);
    await edu.p.selectOption('#att-0', 'tf-2');
    await edu.p.waitForSelector('#atq-0');
    verificar(/% feito da tarefa \(hoje: 20%\)/.test(await texto(edu.p, '.atividade-crono')), 'aparece "% feito da tarefa (hoje: 20%)"', await texto(edu.p, '.atividade-crono'));
    await edu.p.fill('#atq-0', '60'); await edu.p.locator('#atq-0').blur();
    await edu.p.waitForTimeout(400);
    verificar(await edu.p.inputValue('#atq-0') === '60', 'o 60% ficou no campo');
    await edu.p.waitForSelector('#ath-0');
    await edu.p.fill('#ath-0', '24'); await edu.p.locator('#ath-0').blur();
    await edu.p.waitForTimeout(400);
    verificar(await edu.p.inputValue('#ath-0') === '24', 'as 24 horas gastas na tarefa ficaram no campo');
  });

  await fluxo.passo(5, async () => {
    await edu.p.click('[data-acao="enviar"]');
    await edu.p.waitForSelector('dialog button:has-text("Enviar sem fotos")', { timeout: 15000 });
    await noDialogo(edu.p, 'Enviar sem fotos');
    verificar(await esperarAte(async () => { const r = await rdo(); return r && r.status === 'enviado'; }, 40000), 'o diário chegou ao banco como enviado', await rdo());
    const r = await rdo();
    const a = ((r && r.conteudo && r.conteudo.atividades) || [])[0] || {};
    verificar(r && r.numero === 1, 'é o RDO nº 1', r && r.numero);
    verificar(a.tarefaId === 'tf-2' && Number(a.tarefaPct) === 60, 'a atividade guardou a tarefa tf-2 e o 60%', a);
    verificar(Number(a.horas) === 24, 'a atividade guardou as 24 horas gastas', a);
  });

  await fluxo.passo(6, async () => {
    fluxo.pagina(fab.p);
    await irPara(fab.p, '#/daily/painel', 'main .kpis');
    await fab.p.waitForTimeout(1500);
    const t = await texto(fab.p, 'main');
    verificar(/Aguardando aprovação\s*1/.test(t), '"Aguardando aprovação" mostra 1', t.slice(0, 300));
    verificar(/RDO nº 1 · Reforma Mitchell/.test(t), 'a fila traz "RDO nº 1 · Reforma Mitchell"');
    // na conta real o sininho traz só avisos do servidor (avisos-oficial.js); o lembrete de tarefa atrasada é do relógio e só existe no protótipo.
    // O atraso aparece no Início. Pendência de decisão registrada no relatório da rodada.
    verificar(/Demolição e remoção/.test(t) || /Atrasado/i.test(t), 'o Início aponta a tarefa atrasada', t.slice(0, 300));
    // conciliação Daily × Início: o Início mostra o mesmo que o painel do Daily acabou de mostrar (1 diário esperando)
    await irPara(fab.p, '#/conta', '.ini-painel', 60000);
    await fab.p.waitForSelector('.ini-diario', { state: 'attached', timeout: 30000 });
    await fab.p.evaluate(() => document.querySelectorAll('details.ini-mais').forEach((d) => { d.open = true; }));   // o Diário de obra fica em "Mais indicadores"
    const ini = await texto(fab.p, '.ini-painel');
    verificar(/1\s*Diário para aprovar/.test(ini) || /1\s*Report to approve/.test(ini), 'o Início tem o cartão "Diário para aprovar" com 1, como o painel do Daily', ini.slice(0, 300));
    verificar(/1\s*Aguardando aprovação/.test(await texto(fab.p, ".ini-diario")), 'o bloco "Diário de obra" do Início mostra 1 aguardando aprovação', await texto(fab.p, '.ini-diario'));
    verificar(await fab.p.locator('.ini-acao-item[href*="/daily/painel/rdo/"]').count() === 1, 'o cartão leva direto ao diário a revisar');
    await irPara(fab.p, '#/daily/painel', 'main .kpis');   // o passo seguinte revisa o diário a partir do painel do Daily
    await fab.p.waitForTimeout(1200);
  });

  await fluxo.passo(7, async () => {
    await fab.p.locator('.fila a:has-text("Revisar")').first().click();
    await fab.p.waitForSelector('[data-acao="aprovar"]', { timeout: 20000 });
    const t = await texto(fab.p, 'main');
    verificar(/Cronograma: Instalação de drywall → 60%/.test(t), 'o relatório mostra "Cronograma: Instalação de drywall → 60%"', t.slice(0, 500));
    verificar(/→ 60% · 24 h/.test(t), 'o relatório mostra as horas gastas na atividade ("· 24 h")', t.slice(0, 500));
    verificar(await fab.p.locator('[data-acao="aprovar"]').count() === 1 && await fab.p.locator('[data-acao="pedir-ajustes"]').count() === 1, 'há "Aprovar e lacrar" e "Pedir ajustes"');
  });

  await fluxo.passo(8, async () => {
    await fab.p.click('[data-acao="aprovar"]');
    await noDialogo(fab.p, 'Aprovar e lacrar');
    verificar(await esperarAte(async () => (await rdo()).status === 'aprovado', 30000), 'o diário está aprovado no banco', await rdo());
    const r = await rdo();
    verificar(/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/.test(r.codigo || ''), 'o código do lacre veio do banco', r.codigo);
    verificar(await esperarAte(async () => { const x = await tarefa('tf-2'); return x && Number(x.pct) === 60; }, 20000), 'a tarefa passou a 60% no cronograma do projeto', await tarefa('tf-2'));
    const t = await tarefa('tf-2');
    const av = (t.avancos || [])[0] || {};
    verificar(Number(av.antes) === 20 && Number(av.pct) === 60 && Number(av.rdoNumero) === 1 && av.por === 'Fábio Fluxo', 'o avanço guarda antes 20, depois 60, RDO 1 e quem aprovou', av);
    const toast = await fab.p.locator('#toast').textContent().catch(() => '');
    verificar(/cronograma recebeu o andamento de 1 etapa/i.test(toast || ''), 'o aviso diz que o cronograma recebeu o andamento', toast);
  });

  await fluxo.passo(9, async () => {
    await irPara(fab.p, '#/measure/gantt/' + projetoId, '.mz-gantt');
    await fab.p.waitForTimeout(800);
    const linhas = await fab.p.locator('.mz-gantt .mz-g-linha').evaluateAll((els) => els.map((e) => ({ nome: (e.querySelector('.mz-g-nome span') || {}).textContent, pct: (e.querySelector('.mz-g-pct') || {}).textContent, atrasada: e.classList.contains('atrasada') })));
    const por = (n) => linhas.find((x) => x.nome === n) || {};
    verificar(por('Instalação de drywall').pct === '60%', '"Instalação de drywall" está em 60%', linhas);
    verificar(por('Demolição e remoção').pct === '0%' && por('Demolição e remoção').atrasada === true, '"Demolição e remoção" está em 0% e atrasada', por('Demolição e remoção'));
    verificar(await fab.p.locator('.gantt-rodape .mz-g-legenda, .gantt-rodape').count() >= 1, 'a legenda fica no rodapé do gráfico');
    // fatias 2 e 3 do Gantt financeiro (docs/gantt-financeiro.md): horas do diário aprovado; sem medição não há valor nem horas orçadas; sem Crew não há custo real
    await fab.p.waitForSelector('#horas-gantt', { timeout: 20000 });
    verificar((await texto(fab.p, '#hg-apontadas')).includes('24'), 'o Gantt soma as 24 horas apontadas no diário aprovado', await texto(fab.p, '#hg-apontadas'));
    verificar(await fab.p.locator('#horas-gantt tr[data-tarefa="tf-2"]').count() === 1 && (await texto(fab.p, '#horas-gantt tr[data-tarefa="tf-2"]')).includes('24'), 'a linha de "Instalação de drywall" mostra as 24 horas e o diário', await texto(fab.p, '#horas-gantt tr[data-tarefa="tf-2"]'));
    verificar((await texto(fab.p, '.valor-gantt .vazio')).includes('Nenhum valor ainda'), 'sem medição no Takeoff o projeto ainda não tem valor por tarefa (o aviso explica o que falta)');
    verificar(await fab.p.locator('#real-gantt').count() === 0, 'sem ponto do Crew não aparece o custo real');
  });

  await fluxo.passo(10, async () => {
    await irPara(fab.p, '#/measure/projeto/' + projetoId + '/schedule', '[data-pj-tarefa="pct"]');
    const valores = await fab.p.locator('tr:has([data-pj-tarefa="pct"])').evaluateAll((els) => els.map((e) => ({ nome: e.querySelector('[data-pj-tarefa="nome"]').value, pct: e.querySelector('[data-pj-tarefa="pct"]').value })));
    verificar((valores.find((x) => x.nome === 'Instalação de drywall') || {}).pct === '60', 'a tabela mostra 60 de % feito na tarefa', valores);
    await irPara(fab.p, '#/measure/projeto/' + projetoId, '.mz-liberar');
    verificar(await fab.p.locator('[data-acao="pj-voltar-analise"]').count() === 0, '"Voltar para análise" não aparece mais: o projeto já tem diário', await texto(fab.p, '.mz-liberar'));
  });

  await fluxo.passo(11, async () => {
    await irPara(fab.p, '#/conta', '.ini-painel', 60000);
    await fab.p.waitForTimeout(800);
    await fab.p.evaluate(() => document.querySelectorAll('details.ini-mais').forEach((d) => { d.open = true; }));   // o Diário de obra fica em "Mais indicadores"
    const t = await texto(fab.p, '.ini-painel');
    verificar(/Andamento dos projetos/.test(t) && t.includes(NOME) && /Atrasado/i.test(t), '"Andamento dos projetos" mostra "Reforma Mitchell" atrasada', t.slice(0, 400));
    // conciliação Daily × Gantt × Início depois de aprovar: nada esperando; o % feito do projeto é o peso dos dias das tarefas (3 d a 0%, 5 d a 60%, 4 d a 0% = 25%)
    verificar(/0\s*Aguardando aprovação/.test(await texto(fab.p, ".ini-diario")) && !(await fab.p.locator('.ini-acao-item[href*="/daily/painel/rdo/"]').count()), 'depois de aprovar, o Início não tem diário esperando (igual ao painel do Daily)', await texto(fab.p, '.ini-diario'));
    verificar(/25% feito/.test(t), 'o Início mostra 25% feito (a mesma conta do cronograma: 60% da tarefa de 5 dias entre 12 dias de tarefas)', t.slice(0, 400));
    // Na conta real o sininho traz só avisos do servidor; o lembrete "Tarefa atrasada" é do relógio e só existe no protótipo (pendência de decisão no relatório).
  });

  await fluxo.passo(12, async () => {
    fluxo.pagina(edu.p);
    await irPara(edu.p, '#/daily/campo/obra/' + obraId, 'main .obra-resumo, main .vazio');
    await edu.p.waitForTimeout(1500);
    const r = await rdo();
    await edu.p.click('main a:has-text("Ver o RDO de hoje")');
    await edu.p.waitForTimeout(1500);
    const t = await texto(edu.p, 'main');
    verificar(/Aprovado/i.test(t) && t.includes(r.codigo), 'o diário aprovado aparece com o código do lacre', t.slice(0, 400));
    verificar(await edu.p.locator('[data-acao="aprovar"]').count() === 0, 'o encarregado não tem botão de aprovar');
    verificar(erros.length === 0, 'nenhum erro de JavaScript em todo o fluxo' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
  });
} finally {
  await browser.close();
  if (!MANTER) await apagarEmpresaFluxo();
}
process.exit(await fluxo.fim());
