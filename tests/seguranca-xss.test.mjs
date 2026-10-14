/* KORbuild — teste de SEGURANÇA contra XSS armazenado (texto malicioso gravado por alguém e mostrado na tela, a própria ou de outra pessoa).
 * Grava um texto com HTML e JavaScript no nome da empresa, da obra, do cliente, do funcionário, da função e de uma pessoa do convite, abre as telas
 * do app oficial no navegador e confere que: nada executou (nenhum alert, nenhuma variável global criada), nenhuma tag extra apareceu na página e o texto
 * aparece literalmente, como texto. Cada tela passa pelo esc() do app; este teste pega a que esquecer.
 * Uso: node tests/seguranca-xss.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, rest, criarUsuario, sessao, rotear, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('XSS contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 500)) : '')); }
}

// O texto malicioso: quebra aspas de atributo, abre tags com evento, tenta <script> e deixa uma marca (data-xss) para eu ver se virou elemento
const sufixo = ' "><img src=x data-xss=1 onerror="window.__xss=1"><svg onload="window.__xss=2" data-xss=2></svg><script>window.__xss=3</script>\'><b data-xss=3>x</b>';
const curto = ' "><img src=x data-xss=1 onerror=window.__xss=1>';   // para campos com limite de tamanho (o nome da pessoa)
const medio = curto + '<svg onload=window.__xss=2 data-xss=2>';   // cabe nos campos de nome (60 a 160 caracteres)
const mal = (rotulo, c = false) => rotulo + (c ? curto : medio);
const longo = (rotulo) => rotulo + sufixo;   // para os textos livres (notas)

await limpar();
const EMAIL = 'kb-e2e-daily-xss-ana@example.com', EMAIL2 = 'kb-e2e-daily-xss-tom@example.com';
const idA = await criarUsuario(EMAIL, mal('Ana', true)), idB = await criarUsuario(EMAIL2, 'Tom XSS');
const empA = await rest(idA, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'XSS Empresa A', atuacao: 'prestadora', nome_pessoa: mal('Ana', true) } } });
const empB = await rest(idB, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'XSS Empresa B', atuacao: 'construtora' } } });
await rest(idA, '/empresas?id=eq.' + empA, { metodo: 'PATCH', corpo: { nome: mal('Empresa'), razao_social: mal('Razao'), endereco: mal('Rua'), cidade: mal('Cidade'), telefone: mal('Tel'), site: mal('Site') } });
const [cliente] = await rest(idA, '/contatos', { metodo: 'POST', corpo: { nome: mal('Cliente'), papeis: ['cliente'], notas: longo('Nota') } });
const [membroA] = await rest(idA, '/membros?select=id&user_id=eq.' + idA);
const [obra] = await rest(idA, '/obras', { metodo: 'POST', corpo: { nome: mal('Obra'), contratante_id: cliente.id, municipio: mal('Cidade'), estado: 'NH', lat: 43.004, lon: -71.4635, inicio: '2026-01-01', prazo: '2027-12-31', dias_trabalho: [0, 1, 2, 3, 4, 5, 6], responsavel_id: membroA.id } });
await rest(idA, '/rpc/criar_funcionario', { metodo: 'POST', corpo: { p: { nome: mal('Funcionario'), funcao: mal('Funcao'), admissao: '2026-01-05' }, p_valor: 30 } });
const perfilEnc = (await rest(idA, '/perfis_acesso?select=id&chave=eq.encarregado'))[0];
await rest(idA, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: 'kb-e2e-daily-xss-conv@example.com', p_nome: mal('Convidado', true), p_perfil: perfilEnc.id } });
// a obra também sai no diário (o texto do dia), no cronograma e na concorrência
await rest(idA, '/cronograma_etapas', { metodo: 'POST', corpo: { empresa_id: empA, obra_id: obra.id, nome: mal('Etapa'), inicio: '2026-01-05', fim: '2026-02-05', ordem: 1 } }).catch(() => {});

const ROTAS = ['#/inicio', '#/conta', '#/conta/perfil', '#/conta/usuarios', '#/settings/contatos', '#/settings/obras', '#/settings/funcionarios', '#/daily', '#/daily/obras', '#/daily/obras/' + obra.id,
               '#/daily/obras/' + obra.id + '/cronograma', '#/daily/concorrencias', '#/crew', '#/crew/timesheets', '#/measure', '#/measure/itens'];
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'en'); } catch { /* */ } }, [await sessao(idA, EMAIL, 'ana')]);
await rotear(ctx, URL_PROJETO);
await ctx.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
const p = await ctx.newPage();
const dialogos = [];
p.on('dialog', async (d) => { dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
const errosDePagina = [];
p.on('pageerror', (e) => errosDePagina.push(String(e).slice(0, 120)));

let telasComTexto = 0;
for (const rota of ROTAS) {
  await p.goto(BASE + rota);
  try { await p.waitForSelector('#app h1, #app h2, #app .cartao', { timeout: 25000 }); } catch { /* a tela pode ser outra (sem permissão): o teste segue */ }
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => ({
    xss: window.__xss,
    tagsExtras: [...document.querySelectorAll('[data-xss], img[src="x"], svg[onload], #app script, #app [onerror]')].length,
    literal: (document.body.innerText || '').includes('onerror=') || [...document.querySelectorAll('input, textarea')].some((i) => (i.value || '').includes('window.__xss=1')),
  }));
  verificar(r.xss === undefined && r.tagsExtras === 0 && !dialogos.length, rota + ': nada executou nem virou tag', { xss: r.xss, tagsExtras: r.tagsExtras, dialogos });
  if (r.literal) telasComTexto++;
}
verificar(telasComTexto >= 5, 'o texto malicioso aparece literalmente, como texto, em pelo menos 5 telas (conferi ' + telasComTexto + ' de ' + ROTAS.length + ')', telasComTexto);
verificar(!dialogos.length, 'nenhum alert/confirm/prompt apareceu durante a navegação', dialogos);

// o mesmo texto no cliente que recebe o diário: a construtora B vê a obra e a empresa da A
const [ca] = await rest(idB, '/contatos', { metodo: 'POST', corpo: { nome: mal('Prestadora da B'), papeis: ['cliente'] } });
await ctx.close();
const ctxB = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctxB.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'en'); } catch { /* */ } }, [await sessao(idB, EMAIL2, 'tom')]);
await rotear(ctxB, URL_PROJETO);
await ctxB.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
const pb = await ctxB.newPage();
pb.on('dialog', async (d) => { dialogos.push(d.message()); await d.dismiss().catch(() => {}); });
for (const rota of ['#/inicio', '#/settings/contatos', '#/daily', '#/daily/obras']) {
  await pb.goto(BASE + rota);
  await pb.waitForSelector('#app h1, #app h2, #app .cartao', { timeout: 25000 }).catch(() => {});
  await pb.waitForLoadState('networkidle').catch(() => {});
  await pb.waitForTimeout(1000);
  const r = await pb.evaluate(() => ({ xss: window.__xss, tags: [...document.querySelectorAll('[data-xss], img[src="x"], svg[onload], #app script')].length }));
  verificar(r.xss === undefined && r.tags === 0 && !dialogos.length, 'empresa B, ' + rota + ': nada executou nem virou tag', { r, dialogos });
}
await browser.close();
void ca; void errosDePagina;
await limpar();
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
