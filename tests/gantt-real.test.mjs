/* KORbuild — Gantt físico-financeiro, fatia 3: custo real do ponto (Crew) × mão de obra orçada no Takeoff (docs/gantt-financeiro.md).
 * Uso: python3 -m http.server 8123 &  →  node tests/gantt-real.test.mjs [http://localhost:8123/] */

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

const dados = await p.evaluate(async () => {
  const m = await import('/js/measure.js'); const a = await import('/js/armazem.js'); const v = await import('/js/valor-cronograma.js'); const cw = await import('/js/crew.js'); const d = a.estado();
  const pj = m.projeto('pj-cozinha');
  d.measure.folhas.push({ id: 'fl-r', projetoId: pj.id, nome: 'A-101', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina: 1, escala: { nome: 'x', polPorPonto: 1 } });
  d.measure.assemblies.push({ id: 'as-r', nome: 'Drywall (teste)', tipo: 'area', linhas: [{ id: 'r1', itemId: 'it-dw', formula: 'MeasuredArea / 32', perda: 0, passo: 0 }, { id: 'r2', itemId: 'it-mo-drywall', formula: 'MeasuredArea / 50', perda: 0, passo: 0 }] });
  d.measure.condicoes.push({ id: 'cd-r', projetoId: pj.id, nome: 'Cômodos', tipo: 'area', cor: '#2563EB', props: {}, assemblies: ['as-r'], folhas: ['fl-r'], medicoes: [{ id: 'md-r', folhaId: 'fl-r', pontos: [[0, 0], [1200, 0], [1200, 1200]], valor: 1 }] });
  const t = pj.cronograma.tarefas.find((x) => x.id === 'tf-cz-3'); t.etapa = '09 29 00 · Gypsum board';
  // dois dias fechados da semana passada: 8 h de Drywall (tarefa) e 2 h de limpeza (sem tarefa), a US$ 40/h
  const seg = cw.inicioDaSemana(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  const dia = (n) => new Date(seg + 'T00:00:00').getTime() + n * 864e5;
  d.funcionarios.push({ id: 'f-real', nome: 'Teste Real', funcao: 'Carpinteiro', equipeId: 'eq-a', admissao: '2020-01-01', valores: [{ desde: '2020-01-01', valor: 40, motivo: 'x', por: 'x', em: 1 }], classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', codigo: 'E-999' });
  const b = (tipo, em, etapa) => d.crew.batidas.push({ id: 'bt-' + tipo + em, funcionarioId: 'f-real', tipo, obraId: pj.obraId, etapa, em, dentroCerca: true, conferida: false });
  b('entrada', dia(1) + 8 * 36e5, t.nome); b('saida', dia(1) + 16 * 36e5);
  b('entrada', dia(2) + 8 * 36e5, 'Limpeza geral'); b('saida', dia(2) + 10 * 36e5);
  a.salvar();
  const r = v.valorDasTarefas(pj), real = v.custoRealDoPonto(pj);
  return { obraId: pj.obraId, maoDeObra: r.porTarefa.get('tf-cz-3').maoDeObra, orcadas: r.porTarefa.get('tf-cz-3').horas, real: real.porTarefa.get('tf-cz-3'), fora: real.fora, enc: (await import('/js/settings.js')).encargosEm(seg) };
});
const perto = (a, b) => Math.abs(a - b) < 0.06;
const custo = (h) => h * 40 * (1 + dados.enc);
console.log('Custo real do ponto');
verificar(dados.obraId && dados.maoDeObra > 0, 'o projeto liberado tem obra e mão de obra orçada', dados);
verificar(perto(dados.real.horas, 8) && perto(dados.real.custo, custo(8)), 'as 8 h batidas na etapa Drywall viram 8 × US$ 40 + encargos na tarefa', dados.real);
verificar(perto(dados.fora.horas, 2) && perto(dados.fora.custo, custo(2)), 'as 2 h de uma etapa sem tarefa ficam em "ponto sem tarefa"', dados.fora);

await p.goto('about:blank');
await p.goto(BASE + '#/measure/gantt/pj-cozinha');
await p.waitForSelector('#real-gantt', { timeout: 20000 });
const num = (t) => Number(t.replace(/−/g, '-').replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const lin = p.locator('#real-gantt tr[data-tarefa="tf-cz-3"]');
console.log('Tela');
verificar(perto(num(await p.locator('#rg-orcado').innerText()), dados.maoDeObra), 'a mão de obra orçada é a do Takeoff, a custo', await p.locator('#rg-orcado').innerText());
verificar(perto(num(await p.locator('#rg-real').innerText()), custo(10)), 'o custo real até hoje inclui o ponto sem tarefa (10 h)', await p.locator('#rg-real').innerText());
verificar(perto(num(await lin.locator('td').nth(2).innerText().then((t) => t.split('\n')[0])), custo(8)), 'a linha do Drywall mostra o real da tarefa (8 h)', await lin.locator('td').nth(2).innerText());
verificar(perto(num(await lin.locator('td').nth(3).innerText()), custo(8) - dados.maoDeObra) && (await lin.locator('td').nth(3).innerText()).startsWith('−'), 'real − orçado é negativo: ainda abaixo do orçado', await lin.locator('td').nth(3).innerText());
verificar(perto(num(await lin.locator('td').nth(4).innerText()), dados.maoDeObra * 0.6), 'orçado × % feito usa os 60% do diário (mão de obra × 60%)', await lin.locator('td').nth(4).innerText());
verificar(perto(num(await lin.locator('td').nth(5).innerText()), custo(8) / 0.6), 'a projeção divide o real pelo % feito', await lin.locator('td').nth(5).innerText());
verificar(await p.locator('#rg-fora').count() === 1 && (await p.locator('#rg-fora').innerText()).includes('2'), 'o aviso mostra o ponto que não pertence a nenhuma tarefa');
const sit = await lin.locator('.etiqueta').innerText();
verificar(sit.includes('Dentro do orçado') || sit.includes('Custo acima do avanço'), 'a situação da tarefa aparece', sit);

console.log('Alertas');
const lancar = (h) => p.evaluate(async (horas) => {
  const a = await import('/js/armazem.js'); const cw = await import('/js/crew.js'); const d = a.estado();
  const seg = cw.inicioDaSemana(new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10));
  const pj = (await import('/js/measure.js')).projeto('pj-cozinha'); const nome = pj.cronograma.tarefas.find((x) => x.id === 'tf-cz-3').nome;
  d.crew.batidas = d.crew.batidas.filter((b) => !String(b.id).startsWith('bt-x'));
  // turnos de 10 h em dias fechados (dias úteis das duas semanas passadas, fora os dois já usados) até chegar às horas pedidas
  let falta = horas, k = 0;
  for (const off of [3, 4, 7, 8, 9, 10, 11, 14, 15, 16, 17, 18]) {
    if (falta <= 0) break;
    const t0 = new Date(seg + 'T00:00:00').getTime() + (off - 7) * 864e5 + 6 * 36e5, h = Math.min(10, falta);
    d.crew.batidas.push({ id: 'bt-x' + (k++) + 'e', funcionarioId: 'f-real', tipo: 'entrada', obraId: pj.obraId, etapa: nome, em: t0, dentroCerca: true, conferida: false });
    d.crew.batidas.push({ id: 'bt-x' + (k++) + 's', funcionarioId: 'f-real', tipo: 'saida', obraId: pj.obraId, em: t0 + h * 36e5, dentroCerca: true, conferida: false });
    falta -= h;
  }
  a.salvar();
}, h);
await lancar(Math.ceil(dados.orcadas * 1.2));
await p.reload(); await p.waitForSelector('#real-gantt');
verificar((await p.locator('#real-gantt tr[data-tarefa="tf-cz-3"] .etiqueta').innerText()).includes('Passou do orçado') && await p.locator('#rg-proj.neg').count() === 1, 'custo real acima da mão de obra orçada: "Passou do orçado" e a projeção fica em vermelho', await p.locator('#real-gantt tr[data-tarefa="tf-cz-3"]').innerText());
verificar(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
