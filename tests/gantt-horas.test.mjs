/* KORbuild — Gantt físico-financeiro, fatia 2: horas orçadas (Takeoff) × apontadas nos diários aprovados (docs/gantt-financeiro.md).
 * Uso: python3 -m http.server 8123 &  →  node tests/gantt-horas.test.mjs [http://localhost:8123/] */

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

console.log('Sem horas orçadas nem apontadas: o bloco não aparece');
verificar(await p.locator('#horas-gantt').count() === 0, 'o projeto sem medição e sem diário não mostra o bloco de horas');

console.log('Horas orçadas vêm do Takeoff; apontadas, dos diários aprovados');
const base = await p.evaluate(async () => {
  const m = await import('/js/measure.js'); const a = await import('/js/armazem.js'); const v = await import('/js/valor-cronograma.js'); const d = a.estado();
  const pj = m.projeto('pj-cozinha');
  d.measure.folhas.push({ id: 'fl-h', projetoId: pj.id, nome: 'A-101', arquivo: { tipo: 'url', src: 'assets/plantas/casa-modelo.pdf', nome: 'casa-modelo.pdf' }, pagina: 1, escala: { nome: 'x', polPorPonto: 1 } });
  d.measure.assemblies.push({ id: 'as-h', nome: 'Drywall (teste)', tipo: 'area', linhas: [{ id: 'h1', itemId: 'it-dw', formula: 'MeasuredArea / 32', perda: 0, passo: 0 }, { id: 'h2', itemId: 'it-mo-drywall', formula: 'MeasuredArea / 50', perda: 0, passo: 0 }] });
  d.measure.condicoes.push({ id: 'cd-h', projetoId: pj.id, nome: 'Cômodos', tipo: 'area', cor: '#2563EB', props: {}, assemblies: ['as-h'], folhas: ['fl-h'], medicoes: [{ id: 'md-h', folhaId: 'fl-h', pontos: [[0, 0], [1200, 0], [1200, 1200]], valor: 1 }] });
  pj.cronograma.tarefas.find((x) => x.id === 'tf-cz-3').etapa = '09 29 00 · Gypsum board';
  a.salvar();
  const r = v.valorDasTarefas(pj);
  return { obraId: pj.obraId, orcadas: r.porTarefa.get('tf-cz-3').horas, maoDeObra: r.porTarefa.get('tf-cz-3').maoDeObra };
});
verificar(base.obraId && base.orcadas > 20, 'o projeto liberado tem obra e o drywall tem horas orçadas', base);
const rdo = (id, data, status, atividades) => ({ id, obraId: base.obraId, data, status, numero: id, atividades, equipe: [], ocorrencias: [], observacoes: '' });
const lancar = (lista) => p.evaluate(async (l) => { const a = await import('/js/armazem.js'); const d = a.estado(); d.rdos = (d.rdos || []).filter((r) => !String(r.id).startsWith('rh-')).concat(l); a.salvar(); }, lista);
const h1 = Math.round(base.orcadas * 0.4 * 10) / 10, h2 = Math.round(base.orcadas * 0.3 * 10) / 10;
await lancar([
  rdo('rh-1', '2026-01-05', 'aprovado', [{ id: 'a1', descricao: 'Drywall', tarefaId: 'tf-cz-3', horas: h1 }, { id: 'a2', descricao: 'Sem tarefa', horas: 99 }]),
  rdo('rh-2', '2026-01-06', 'aprovado', [{ id: 'a3', descricao: 'Drywall', tarefaId: 'tf-cz-3', horas: String(h2).replace('.', ',') }]),
  rdo('rh-3', '2026-01-07', 'enviado', [{ id: 'a4', descricao: 'Ainda não aprovado', tarefaId: 'tf-cz-3', horas: 500 }]),
]);
await p.goto('about:blank');
await p.goto(BASE + '#/measure/gantt/pj-cozinha');
await p.waitForSelector('#horas-gantt', { timeout: 20000 });
const num = (t) => Number(t.replace(/[^\d,.-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const lin = p.locator('#horas-gantt tr[data-tarefa="tf-cz-3"]');
verificar(Math.abs(num(await p.locator('#hg-apontadas').innerText()) - (h1 + h2)) < 0.05, 'só os diários aprovados contam, e só as atividades ligadas a uma tarefa (aceita vírgula)', await p.locator('#hg-apontadas').innerText());
verificar(Math.abs(num(await lin.locator('td').nth(1).innerText()) - base.orcadas) < 0.05, 'a coluna Orçadas é a do Takeoff', await lin.locator('td').nth(1).innerText());
const consumo = Math.round((h1 + h2) * 1000 / base.orcadas) / 10;
verificar((await lin.locator('td').nth(3).innerText()).includes(String(consumo).replace('.', ',') ) || (await lin.locator('td').nth(3).innerText()).includes(String(consumo)), 'o consumo é apontadas ÷ orçadas (70%) ao lado do % feito (60%)', await lin.locator('td').nth(3).innerText());
verificar((await lin.locator('.etiqueta').innerText()).includes('Dentro do orçado'), '70% das horas com 60% feito: dentro do orçado (folga de 10 pontos)', await lin.locator('.etiqueta').innerText());
const proj = (h1 + h2) * 100 / 60;
verificar(Math.abs(num(await lin.locator('td').nth(4).innerText()) - Math.round(proj * 100) / 100) < 0.06, 'a projeção divide as horas apontadas pelo % feito', await lin.locator('td').nth(4).innerText());
verificar(Math.abs(num(await p.locator('#hg-custo').innerText()) - (h1 + h2) * base.maoDeObra / base.orcadas) < 0.06, 'o custo das horas usa o custo médio da hora da tarefa', await p.locator('#hg-custo').innerText());

console.log('Alertas');
await lancar([rdo('rh-4', '2026-01-05', 'aprovado', [{ id: 'a5', descricao: 'Drywall', tarefaId: 'tf-cz-3', horas: Math.round(base.orcadas * 0.9) }])]);
await p.reload(); await p.waitForSelector('#horas-gantt');
verificar((await p.locator('#horas-gantt tr[data-tarefa="tf-cz-3"] .etiqueta').innerText()).includes('Horas acima do avanço'), '90% das horas com 60% feito: "Horas acima do avanço"');
await lancar([rdo('rh-5', '2026-01-05', 'aprovado', [{ id: 'a6', descricao: 'Drywall', tarefaId: 'tf-cz-3', horas: Math.ceil(base.orcadas + 5) }])]);
await p.reload(); await p.waitForSelector('#horas-gantt');
verificar((await p.locator('#horas-gantt tr[data-tarefa="tf-cz-3"] .etiqueta').innerText()).includes('Passou do orçado'), 'horas acima das orçadas: "Passou do orçado"');
verificar(erros.length === 0, 'nenhum erro de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(falhas ? '\n' + falhas + ' falha(s).' : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
