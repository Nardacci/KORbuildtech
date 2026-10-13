/* KORbuild — o cronograma da página oficial (fatia 5; docs/banco.md §12), de ponta a ponta.
 * As telas do protótipo, com o espelho do banco no aparelho e as ações do escritório indo ao banco:
 *   Ana (Administradora da prestadora A) começa com um modelo, cria e edita etapas, ajusta o %, salva a linha de base e
 *   publica; José (Encarregado) vê as próximas 3 semanas e aponta a etapa na atividade do RDO; Tom (construtora B) aprova
 *   o diário e o andamento entra no cronograma da prestadora; depois disso a etapa fica travada para a Ana; Tom vê a
 *   versão publicada, só leitura.
 * Duas formas de rodar, com os mesmos passos:
 *   --local  (padrão) contra o "Supabase local" (tools/supabase-local.sh: banco + PostgREST), sem rede;
 *   --real   contra o Supabase do projeto (precisa de SUPABASE_ACCESS_TOKEN); cria usuários kb-e2e-daily-…@example.com
 *            (o mesmo padrão do teste do Daily, que a limpeza já apaga) e apaga tudo no fim.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/cronograma-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Cronograma contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const somar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const hojeData = new Date();

// ---------- A cena: a prestadora A com uma obra ligada à construtora B ----------
const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', jose: 'kb-e2e-daily-jose-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), jose: await criarUsuario(EMAIL.jose, 'José Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
const perfis = await rest(ID.ana, '/perfis_acesso?select=id,chave');
const token = await rest(ID.ana, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: EMAIL.jose, p_nome: 'José Local', p_perfil: perfis.find((p) => p.chave === 'encarregado').id } });
await rest(ID.jose, '/rpc/aceitar_convite', { metodo: 'POST', corpo: { p_token: token } });
const jose = (await rest(ID.jose, '/membros?select=id&user_id=eq.' + ID.jose))[0];
const [construtora] = await rest(ID.ana, '/contatos', { metodo: 'POST', corpo: { nome: 'Construtora B', papeis: ['construtora'] } });
const inicioObra = iso(somar(hojeData, -30)), prazoObra = iso(somar(hojeData, 59));   // 90 dias, um terço decorrido
const [obra] = await rest(ID.ana, '/obras', { metodo: 'POST', corpo: { nome: 'Residência Ligada', contratante_id: construtora.id, municipio: 'Manchester', estado: 'NH', lat: 43.004, lon: -71.4635, inicio: inicioObra, prazo: prazoObra, responsavel_id: jose.id, dias_trabalho: [0, 1, 2, 3, 4, 5, 6] } });
await rest(ID.ana, '/modelos_cronograma', { metodo: 'POST', corpo: { nome: 'Casa de madeira', etapas: [{ nome: 'Fundação', pct: 20 }, { nome: 'Framing', pct: 50 }, { nome: 'Acabamento', pct: 30 }] } });
const B = await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
const [dono] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Dono', papeis: ['cliente'] } });
const [obraB] = await rest(ID.tom, '/obras', { metodo: 'POST', corpo: { nome: 'Obra B', contratante_id: dono.id, municipio: 'Nashua', estado: 'NH', lat: 42.76, lon: -71.46, inicio: '2026-01-01', prazo: '2027-12-31' } });
await sqlExec(`update public.obras set vinculo_empresa_id = '${B}', vinculo_obra_id = '${obraB.id}' where id = '${obra.id}'`);   // a ligação nasce das concorrências (fatia 7)

// ---------- O navegador ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];
const paginas = new Map();
async function aparelho(quem, largura) {
  const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 }, geolocation: { latitude: 43.0041, longitude: -71.4635, accuracy: 8 }, permissions: ['geolocation'] });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem)]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://api.open-meteo.com/**', (route) => {
    const time = [], weather_code = [], precipitation = [], temperature_2m = [];
    for (let h = 0; h < 24; h++) { time.push('2026-01-01T' + String(h).padStart(2, '0') + ':00'); weather_code.push(0); precipitation.push(0); temperature_2m.push(20); }
    route.fulfill({ json: { hourly: { time, weather_code, precipitation, temperature_2m } } });
  });
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push(quem + ' [' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push(quem + ' [' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  paginas.set(quem, p);
  return { ctx, p };
}
const etapas = () => sql(`select id, nome, inicio, fim, pct, ordem from public.cronograma_etapas where obra_id = '${obra.id}' order by ordem`);
const toastTexto = async (p) => (await p.locator('#toast').textContent().catch(() => '')) || '';
const CRON = '#/daily/obras/' + obra.id + '/cronograma';

try {
  console.log('Ana monta o cronograma a partir do modelo');
  const a = await aparelho('ana', 1280);
  await a.p.goto(BASE + CRON);
  await a.p.waitForSelector('[data-acao="cr-modelo"]', { timeout: 30000 });
  await a.p.click('[data-acao="cr-modelo"]');
  await a.p.waitForSelector('dialog #cr-modelo-previa');
  verificar((await a.p.textContent('dialog #cr-modelo-previa')).includes('Framing'), 'a prévia do modelo mostra as etapas distribuídas no período da obra');
  await a.p.click('dialog button:has-text("Aplicar")');
  verificar(await esperarAte(async () => (await etapas()).length === 3), 'as 3 etapas do modelo foram criadas no banco', await etapas());
  const e0 = await etapas();
  verificar(e0[0].inicio === inicioObra && e0[2].fim === prazoObra && e0[1].nome === 'Framing', 'as etapas dividem o período da obra na proporção do modelo', e0);
  verificar((await sql(`select count(*)::int n from public.linhas_base where obra_id = '${obra.id}'`))[0].n === 1, 'a primeira linha de base foi salva junto');
  await a.p.waitForSelector('.gantt-linha', { timeout: 20000 });
  verificar(await a.p.locator('.gantt-linha').count() === 3, 'a tela mostra as 3 etapas no Gantt');

  console.log('Nova etapa, edição, % à mão, reordenar, linha de base');
  await a.p.click('[data-acao="cr-etapa"]:has-text("Nova etapa")');
  await a.p.fill('dialog input[name="nome"]', 'Limpeza final');
  await a.p.fill('dialog input[name="inicio"]', iso(somar(hojeData, 50)));
  await a.p.fill('dialog input[name="fim"]', iso(somar(hojeData, 45)));
  await a.p.click('dialog button:has-text("Criar etapa")');
  await a.p.waitForFunction(() => /fim não pode ser antes/i.test((document.querySelector('#toast') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => null);
  verificar(/fim não pode ser antes/i.test(await toastTexto(a.p)), 'fim antes do início: recusado', await toastTexto(a.p));
  await a.p.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 5000 }).catch(() => null);
  await a.p.click('[data-acao="cr-etapa"]:has-text("Nova etapa")');
  await a.p.fill('dialog input[name="nome"]', 'Limpeza final');
  await a.p.fill('dialog input[name="inicio"]', iso(somar(hojeData, 50)));
  await a.p.fill('dialog input[name="fim"]', iso(somar(hojeData, 58)));
  await a.p.click('dialog button:has-text("Criar etapa")');
  verificar(await esperarAte(async () => (await etapas()).length === 4), 'a quarta etapa foi criada no banco');
  await a.p.waitForFunction(() => document.querySelectorAll('.gantt-linha').length === 4, null, { timeout: 15000 });
  await a.p.click('.gantt-linha:has-text("Limpeza final") [data-acao="cr-mover"][data-passo="-1"]');
  verificar(await esperarAte(async () => (await etapas())[2].nome === 'Limpeza final'), 'reordenar: a etapa subiu uma posição no banco', await etapas());
  const framing = (await etapas()).find((e) => e.nome === 'Framing');
  await a.p.waitForFunction(() => !document.querySelector('#toast.on'), null, { timeout: 5000 }).catch(() => null);
  await a.p.click('.gantt-linha:has-text("Framing") [data-acao="cr-avanco"]');
  await a.p.fill('dialog input[name="pct"]', '25');
  await a.p.click('dialog button:has-text("Salvar")');
  verificar(await esperarAte(async () => (await etapas()).find((e) => e.id === framing.id).pct === 25), 'o % à mão foi para a etapa, pelo avanço');
  verificar((await sql(`select fonte, antes, pct from public.etapa_avancos where etapa_id = '${framing.id}'`)).some((x) => x.fonte === 'manual' && x.antes === 0 && x.pct === 25), 'o avanço manual ficou no histórico');
  await a.p.waitForFunction(() => !document.querySelector('#toast.on'), null, { timeout: 5000 }).catch(() => null);
  await a.p.click('.gantt-linha:has-text("Framing") [data-acao="cr-etapa"]');
  await a.p.waitForSelector('dialog input[name="fim"]');
  verificar((await a.p.textContent('dialog')).includes('Na linha de base'), 'editar mostra as datas da linha de base');
  const novoFim = iso(somar(new Date(framing.fim + 'T12:00:00'), 5));
  await a.p.fill('dialog input[name="fim"]', novoFim);
  await a.p.click('dialog button:has-text("Salvar")');
  verificar(await esperarAte(async () => (await etapas()).find((e) => e.id === framing.id).fim === novoFim), 'a data nova foi para o banco');
  await a.p.waitForFunction((n) => document.body.innerText.includes(n), '+5 dias', { timeout: 15000 }).catch(() => null);
  verificar((await a.p.locator('body').innerText()).includes('+5 dias'), 'o desvio contra a linha de base aparece');
  await a.p.click('[data-acao="cr-base"]');
  await a.p.fill('dialog input[name="motivo"]', 'Aditivo de prazo do framing');
  await a.p.click('dialog button:has-text("Salvar linha de base")');
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.linhas_base where obra_id = '${obra.id}'`))[0].n === 2), 'a nova linha de base foi gravada');

  console.log('Publicar para a construtora');
  await a.p.waitForSelector('[data-acao="cr-publicar"]', { timeout: 15000 });
  await a.p.click('[data-acao="cr-publicar"]');
  await a.p.click('dialog button:has-text("Publicar")');
  verificar(await esperarAte(async () => (await sql(`select versao from public.publicacoes_cronograma where obra_id = '${obra.id}'`)).length === 1), 'versão 1 publicada no banco');
  await a.p.waitForFunction(() => document.body.innerText.includes('versão 1'), null, { timeout: 15000 }).catch(() => null);
  verificar((await a.p.locator('body').innerText()).includes('versão 1'), 'a tela diz que a construtora vê a versão 1');

  console.log('José vê as próximas 3 semanas e aponta a etapa no RDO');
  const j = await aparelho('jose');
  await j.p.goto(BASE + '#/daily/campo/obra/' + obra.id);
  await j.p.waitForSelector('[data-acao="novo-rdo"]', { timeout: 30000 });
  verificar(await j.p.locator('.cr-lookahead').count() === 1 && (await j.p.locator('.cr-lookahead').innerText()).includes('Framing'), 'as próximas 3 semanas aparecem no celular do encarregado');
  await j.p.click('[data-acao="novo-rdo"]');
  await j.p.waitForSelector('#s-clima');
  await j.p.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2, null, { timeout: 15000 });
  await j.p.locator('[data-acao="equipe-add"]').first().click();
  await j.p.locator('#s-atividades textarea').first().fill('Framing do 2º pavimento');
  await j.p.locator('#s-atividades textarea').first().blur();
  await j.p.selectOption('#atc-0', framing.id);
  await j.p.waitForSelector('#atp-0');
  await j.p.fill('#atp-0', '60');
  await j.p.locator('#atp-0').blur();
  await j.p.click('[data-acao="enviar"]');
  await j.p.waitForSelector('dialog button:has-text("Enviar sem fotos")').then(() => j.p.click('dialog button:has-text("Enviar sem fotos")')).catch(() => null);
  verificar(await esperarAte(async () => (await sql(`select status from public.rdos where obra_id = '${obra.id}'`)).some((r) => r.status === 'enviado')), 'o diário com a etapa apontada chegou ao banco');
  const rdo = (await sql(`select id from public.rdos where obra_id = '${obra.id}'`))[0];

  console.log('Tom (construtora) aprova: o andamento entra no cronograma da prestadora');
  const t = await aparelho('tom', 1280);
  await t.p.goto(BASE + '#/daily/painel/rdo/' + rdo.id);
  await t.p.waitForSelector('[data-acao="aprovar"]', { timeout: 30000 });
  await t.p.click('[data-acao="aprovar"]');
  await t.p.click('dialog button:has-text("Aprovar e lacrar")');
  verificar(await esperarAte(async () => (await etapas()).find((e) => e.id === framing.id).pct === 60), 'o % do RDO aprovado foi para a etapa da prestadora', await etapas());
  await t.p.waitForFunction(() => /andamento de 1 etapa/.test((document.querySelector('#toast') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => null);
  verificar(/andamento de 1 etapa/.test(await toastTexto(t.p)), 'quem aprovou é avisado do andamento', await toastTexto(t.p));
  verificar((await sql(`select fonte, antes, pct, rdo_numero from public.etapa_avancos where etapa_id = '${framing.id}' order by em desc limit 1`))[0].fonte === 'rdo', 'o histórico guarda o RDO de origem');

  console.log('Etapa com andamento aprovado: travada para a Ana');
  await a.p.goto(BASE + CRON);
  await a.p.waitForSelector('.gantt-linha', { timeout: 20000 });
  await a.p.click('#conexao');
  await a.p.waitForFunction(() => /60%/.test(document.querySelector('.gantt-linha:nth-child(3), .gantt') ? document.body.innerText : ''), null, { timeout: 20000 }).catch(() => null);
  verificar((await a.p.locator('body').innerText()).includes('60%'), 'a tela da Ana mostra o 60% vindo do diário');
  await a.p.click('.gantt-linha:has-text("Framing") [data-acao="cr-etapa"]');
  await a.p.waitForSelector('dialog input[name="nome"]');
  await a.p.fill('dialog input[name="nome"]', 'Framing (mudado)');
  await a.p.click('dialog button:has-text("Salvar")');
  await a.p.waitForFunction(() => /só quem aprovou/i.test((document.querySelector('#toast') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => null);
  verificar(/só quem aprovou/i.test(await toastTexto(a.p)), 'editar a etapa travada: o banco recusa e a tela explica', await toastTexto(a.p));
  verificar((await etapas()).find((e) => e.id === framing.id).nome === 'Framing', 'o nome não mudou');
  await a.p.waitForFunction(() => !document.querySelector('#toast.on'), null, { timeout: 5000 }).catch(() => null);
  await a.p.click('.gantt-linha:has-text("Framing") [data-acao="cr-etapa"]');
  await a.p.waitForSelector('dialog button:has-text("Excluir")');
  await a.p.click('dialog button:has-text("Excluir")');
  await a.p.click('dialog button:has-text("Excluir")');   // a confirmação
  await a.p.waitForFunction(() => /não pode ser excluída/i.test((document.querySelector('#toast') || {}).textContent || ''), null, { timeout: 8000 }).catch(() => null);
  verificar(/não pode ser excluída/i.test(await toastTexto(a.p)), 'excluir a etapa travada: recusado', await toastTexto(a.p));
  verificar((await etapas()).length === 4, 'a etapa continua lá');

  console.log('Tom vê a versão publicada, só leitura');
  await t.p.goto(BASE + '#/daily/obras/' + obraB.id);
  await t.p.waitForFunction(() => document.body.innerText.includes('Cronogramas das prestadoras'), null, { timeout: 20000 }).catch(() => null);
  verificar((await t.p.locator('body').innerText()).includes('Versão 1'), 'a obra da construtora lista o cronograma recebido (versão 1)');
  await t.p.click('a[href*="/cronograma/recebido/"]');
  await t.p.waitForSelector('.gantt-linha', { timeout: 20000 });
  verificar(await t.p.locator('.gantt-linha').count() === 4 && await t.p.locator('[data-acao="cr-etapa"], [data-acao="cr-avanco"], [data-acao="cr-mover"]').count() === 0, 'a construtora vê as 4 etapas, sem botões de edição');
  verificar((await t.p.locator('body').innerText()).includes('25%'), 'a versão 1 é o retrato de quando foi publicada (25%), não o de agora');
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
