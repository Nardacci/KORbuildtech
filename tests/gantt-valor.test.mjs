/* KORbuild — Gantt físico-financeiro, fatia 1: valor por tarefa (material + horas × custo da hora) e curva S (docs/gantt-financeiro.md).
 * Uso: python3 -m http.server 8123 &  →  node tests/gantt-valor.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/') + '?demo';
let falhas = 0;
function verificar(cond, texto, detalhe) {
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
await p.goto('about:blank');
await p.goto(BASE + '#/measure/gantt/pj-cozinha');
await p.waitForSelector('#gantt-projeto', { timeout: 20000 });

console.log('Sem medições: nenhum valor ainda');
verificar(await p.locator('.valor-gantt').count() === 1 && (await p.locator('.valor-gantt .vazio').innerText()).includes('Nenhum valor ainda'), 'a página explica que falta medir e aplicar assemblies');

console.log('Com medições: o valor vem do Takeoff');
const esperado = await p.evaluate(async () => {
  const m = await import('/js/measure.js'); const a = await import('/js/armazem.js'); const pr = await import('/js/precos.js'); const d = a.estado();
  const pj = m.projeto('pj-cozinha');
  d.measure.folhas.push({ id: 'fl-v', projetoId: pj.id, nome: 'A-101', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina: 1, escala: { nome: 'x', polPorPonto: 1 } });
  d.measure.assemblies.push({ id: 'as-v', nome: 'Drywall e piso (teste)', tipo: 'area', linhas: [
    { id: 'l1', itemId: 'it-dw', formula: 'MeasuredArea / 32', perda: 0, passo: 0 }, { id: 'l2', itemId: 'it-mo-drywall', formula: 'MeasuredArea / 50', perda: 0, passo: 0 },
    { id: 'l3', itemId: 'it-lvp', formula: 'MeasuredArea / 20', perda: 0, passo: 0 }, { id: 'l4', itemId: 'it-conc', formula: 'MeasuredArea / 100', perda: 0, passo: 0 }] });
  d.measure.condicoes.push({ id: 'cd-v', projetoId: pj.id, nome: 'Cômodos', tipo: 'area', cor: '#2563EB', props: {}, assemblies: ['as-v'], folhas: ['fl-v'], medicoes: [{ id: 'md-v', folhaId: 'fl-v', pontos: [[0, 0], [1200, 0], [1200, 1200]], valor: 1 }] });
  const t = pj.cronograma.tarefas;
  t.find((x) => x.id === 'tf-cz-3').etapa = '09 29 00 · Gypsum board';
  t.find((x) => x.id === 'tf-cz-4').etapa = '09 65 00 · Resilient flooring';
  a.salvar();
  // o cálculo à parte: soma de quantidade × preço por etapa, com overhead e lucro (markup) das margens de exemplo
  const q = m.quantidadesDoProjeto(pj.id), mg = pr.margensEm();
  const custo = (etapa) => q.porItem.filter((g) => g.item.etapa === etapa).reduce((s, g) => s + g.total * pr.precoEm(g.item).valor, 0);
  const venda = (c) => c * (1 + mg.overheadPct / 100) * (1 + mg.lucroPct / 100);
  return { dw: custo('09 29 00 · Gypsum board'), piso: custo('09 65 00 · Resilient flooring'), conc: custo('03 30 00 · Cast-in-place concrete'), fDw: venda(custo('09 29 00 · Gypsum board')), fPiso: venda(custo('09 65 00 · Resilient flooring')), fConc: venda(custo('03 30 00 · Cast-in-place concrete')),
    horasDw: q.porItem.filter((g) => g.item.id === 'it-mo-drywall').reduce((s, g) => s + g.total, 0), margens: mg };
});
verificar(esperado.dw > 0 && esperado.piso > 0 && esperado.conc > 0, 'o exemplo tem custo em drywall, piso e concreto', esperado);
const lerValores = () => p.evaluate(async () => {
  const m = await import('/js/measure.js'); const v = await import('/js/valor-cronograma.js'); const pj = m.projeto('pj-cozinha');
  const r = v.valorDasTarefas(pj); const o = {};
  for (const t of pj.cronograma.tarefas) o[t.id] = r.porTarefa.get(t.id);
  return { tarefas: o, soltos: r.soltos, total: r.total };
});
const v = await lerValores();
const perto = (a, b) => Math.abs(a - b) < 0.05;
verificar(perto(v.tarefas['tf-cz-3'].custo, esperado.dw) && perto(v.tarefas['tf-cz-3'].venda, esperado.fDw), 'a tarefa de drywall vale material + horas × custo da hora da função (custo e venda conferem com a conta à parte)', [v.tarefas['tf-cz-3'].custo, esperado.dw]);
verificar(perto(v.tarefas['tf-cz-3'].horas, esperado.horasDw) && v.tarefas['tf-cz-3'].maoDeObra > 0 && v.tarefas['tf-cz-3'].material > 0, 'a tarefa traz as horas, a mão de obra e o material separados');
verificar(perto(v.tarefas['tf-cz-4'].custo, esperado.piso), 'a tarefa do piso vale o custo da etapa dela');
verificar(v.tarefas['tf-cz-1'].temValor === false && v.tarefas['tf-cz-1'].custo === 0, 'tarefa sem etapa medida fica sem valor');
verificar(perto(v.soltos.custo, esperado.conc), 'a etapa medida que nenhuma tarefa recebeu (concreto) fica "fora do cronograma"');
verificar(perto(v.total.custo, esperado.dw + esperado.piso + esperado.conc), 'o total é a soma de tudo o que o Takeoff calculou');

await p.goto('about:blank');
await p.goto(BASE + '#/measure/gantt/pj-cozinha');
await p.waitForSelector('#gantt-base-valor', { timeout: 20000 });
const num = (t) => Number(t.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const texto = (sel) => p.locator(sel).first().innerText();
console.log('Tela: tabela, resumo e curva S');
verificar(await p.locator('#gantt-base-valor').inputValue() === 'venda' && await p.locator('.tabela-valor-gantt tbody tr').count() === 6, 'a base padrão é o preço de venda e a tabela tem uma linha por tarefa');
verificar(Math.abs(num(await texto('#vg-total')) - (esperado.fDw + esperado.fPiso)) < 0.05, 'o valor total (venda) é só o das tarefas, sem o que ficou fora', await texto('#vg-total'));
verificar(await p.locator('#vg-soltos').count() === 1 && (await texto('#vg-soltos')).includes('Fora do cronograma'), 'o aviso diz quanto ficou fora do cronograma');
verificar(await p.locator('svg.curva-s polyline.cs-plan').count() === 1 && await p.locator('svg.curva-s circle.cs-feito').count() === 1, 'a curva S desenha a linha do previsto e o ponto do feito de hoje');
const pontos = (await p.locator('svg.curva-s polyline.cs-plan').getAttribute('points')).trim().split(' ').map((s) => Number(s.split(',')[1]));
verificar(pontos.length > 5 && pontos.every((y, i) => i === 0 || y <= pontos[i - 1] + 0.01), 'a curva só sobe (o acumulado nunca cai)');
const prev = num(await texto('#vg-previsto')), feito = num(await texto('#vg-feito')), tot = num(await texto('#vg-total'));
verificar(Math.abs(prev - tot) < 0.05 && feito > 0 && feito < prev, 'as duas tarefas com valor já deviam estar prontas: o previsto de hoje é o total e o feito (60% e 25%) fica abaixo', { prev, feito, tot });
verificar((await texto('#vg-desvio')).startsWith('−') && (await p.locator('#vg-desvio.neg').count()) === 1, 'feito − previsto aparece negativo, em vermelho');
const calculoFeito = esperado.fDw * 0.6 + esperado.fPiso * 0.25;
verificar(Math.abs(feito - calculoFeito) < 0.05, 'o feito é o valor × % feito (drywall 60%, piso 25%)', { feito, calculoFeito });
console.log('Trocar a base');
await p.selectOption('#gantt-base-valor', 'custo');
await p.waitForFunction(() => document.querySelector('#gantt-base-valor').value === 'custo');
verificar(Math.abs(num(await texto('#vg-total')) - (esperado.dw + esperado.piso)) < 0.05, 'em "Custo" o total cai para o custo puro', await texto('#vg-total'));
await p.selectOption('#gantt-base-valor', 'overhead');
const oh = esperado.margens.overheadPct / 100;
await p.waitForFunction(() => document.querySelector('#gantt-base-valor').value === 'overhead');
verificar(Math.abs(num(await texto('#vg-total')) - (esperado.dw + esperado.piso) * (1 + oh)) < 0.05, 'em "Custo + overhead" o total soma só o overhead', await texto('#vg-total'));
await p.reload();
await p.waitForSelector('#gantt-base-valor');
verificar(await p.locator('#gantt-base-valor').inputValue() === 'overhead', 'a base escolhida fica guardada neste aparelho');
verificar(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
