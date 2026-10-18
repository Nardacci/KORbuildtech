/* KORbuild — o Crew da página oficial (fatia 4; docs/banco.md §11), de ponta a ponta.
 * As telas do protótipo, com o espelho do banco no aparelho (js/espelho.js, js/espelho-crew.js) e a sincronização:
 *   José (Encarregado da prestadora A) aceita o aviso e bate o ponto da equipe (Pedro fora da cerca, Luis dentro); sem
 *   internet a batida fica no aparelho e sobe com a hora de quando foi batida; Luis (Trabalhador) bate o próprio ponto
 *   e a localização do celular é gravada com o app aberto; Ana (Administradora) confere a batida fora da cerca, ajusta o
 *   dia sem saída, aprova e devolve semanas, cadastra o orçamento e vê o mapa do dia; Tom (construtora B) vê quem está
 *   na obra, sem dinheiro.
 * Duas formas de rodar, com os mesmos passos:
 *   --local  (padrão) contra o "Supabase local" (tools/supabase-local.sh: banco + PostgREST), sem rede;
 *   --real   contra o Supabase do projeto (precisa de SUPABASE_ACCESS_TOKEN); cria usuários kb-e2e-daily-…@example.com
 *            (o mesmo padrão do teste do Daily, que a limpeza já apaga) e apaga tudo no fim.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/crew-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Crew contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };

// ---------- Datas (no fuso do computador; o banco usa o da empresa, Nova York) ----------
const iso = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const somar = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const segundaDe = (d) => somar(d, -((d.getDay() + 6) % 7));
const hojeData = new Date();
const segundaAtual = segundaDe(hojeData);
const segundaPassada = somar(segundaAtual, -7);
const quando = (d, h) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x.toISOString(); };
const terca = somar(segundaPassada, 1), quarta = somar(segundaPassada, 2);

// ---------- A cena ----------
const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', jose: 'kb-e2e-daily-jose-' + sufixo + '@example.com', luis: 'kb-e2e-daily-luis-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), jose: await criarUsuario(EMAIL.jose, 'José Local'), luis: await criarUsuario(EMAIL.luis, 'Luis Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
const perfis = await rest(ID.ana, '/perfis_acesso?select=id,chave');
const convidar = async (quem, nomePessoa, chave) => {
  const token = await rest(ID.ana, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: EMAIL[quem], p_nome: nomePessoa, p_perfil: perfis.find((p) => p.chave === chave).id } });
  await rest(ID[quem], '/rpc/aceitar_convite', { metodo: 'POST', corpo: { p_token: token } });
  return (await rest(ID[quem], '/membros?select=id&user_id=eq.' + ID[quem]))[0].id;
};
const mJose = await convidar('jose', 'José Local', 'encarregado');
const mLuis = await convidar('luis', 'Luis Local', 'trabalhador');
const [construtora] = await rest(ID.ana, '/contatos', { metodo: 'POST', corpo: { nome: 'Construtora B', papeis: ['construtora'] } });
const dadosObra = (nomeObra) => ({ nome: nomeObra, contratante_id: construtora.id, municipio: 'Manchester', estado: 'NH', lat: 43.004, lon: -71.4635, raio: 150, inicio: '2026-01-01', prazo: '2027-12-31', responsavel_id: mJose, dias_trabalho: [0, 1, 2, 3, 4, 5, 6] });
const [obra1, obra2] = await rest(ID.ana, '/obras', { metodo: 'POST', corpo: [dadosObra('Residência Um'), dadosObra('Residência Dois')] });
const funcionario = async (nomePessoa, funcao, valor) => rest(ID.ana, '/rpc/criar_funcionario', { metodo: 'POST', corpo: { p: { nome: nomePessoa, funcao, admissao: '2026-01-05' }, p_valor: valor } });
const fLuis = await funcionario('Luis Local', 'Carpenter', 30), fPedro = await funcionario('Pedro Local', 'Laborer', 22), fJose = await funcionario('José Local', 'Foreman', 40);
const [equipe] = await rest(ID.ana, '/equipes', { metodo: 'POST', corpo: { nome: 'Equipe do José', encarregado_id: mJose, obra_base_id: obra1.id } });
await rest(ID.ana, '/funcionarios?id=in.(' + [fLuis, fPedro, fJose].join(',') + ')', { metodo: 'PATCH', corpo: { equipe_id: equipe.id } });
await sqlExec(`update public.membros set funcionario_id = '${fLuis}' where id = '${mLuis}'; update public.membros set funcionario_id = '${fJose}' where id = '${mJose}'`);
await rest(ID.ana, '/encargos_versoes', { metodo: 'POST', corpo: { desde: iso(segundaAtual), itens: [{ nome: 'FICA', pct: 7.65 }, { nome: "Workers' comp", pct: 14 }], motivo: 'Teste' } });
// a construtora B contrata a prestadora na Obra 1 (a ligação nasce das concorrências, fatia 7)
const B = await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
const [dono] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Dono', papeis: ['cliente'] } });
const [obraB] = await rest(ID.tom, '/obras', { metodo: 'POST', corpo: { nome: 'Obra B', contratante_id: dono.id, municipio: 'Nashua', estado: 'NH', lat: 42.76, lon: -71.46, inicio: '2026-01-01', prazo: '2027-12-31' } });
await sqlExec(`update public.obras set vinculo_empresa_id = '${B}', vinculo_obra_id = '${obraB.id}' where id = '${obra1.id}'`);
// a semana passada: Pedro terça completa e quarta SEM saída; Luis terça completa
const b = (_, func, tipo, dia, hora) => ({ id: crypto.randomUUID(), funcionario_id: func, tipo, obra_id: obra1.id, etapa: 'Framing', em: quando(dia, hora), lat: 43.004, lon: -71.4635, precisao: 8, fonte_gps: 'gps', modo: 'equipe' });
await rest(ID.jose, '/rpc/registrar_batidas', { metodo: 'POST', corpo: { p: [
  b('d4000000-0000-4000-8000-000000000001', fPedro, 'entrada', terca, 12), b('d4000000-0000-4000-8000-000000000002', fPedro, 'saida', terca, 18),
  b('d4000000-0000-4000-8000-000000000003', fPedro, 'entrada', quarta, 12),
  b('d4000000-0000-4000-8000-000000000004', fLuis, 'entrada', terca, 12), b('d4000000-0000-4000-8000-000000000005', fLuis, 'saida', terca, 18),
] } });

// ---------- O navegador ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];   // o que o navegador viu de estranho: erros, pedidos que falharam, respostas 4xx/5xx
const paginas = new Map();
const PERTO = { latitude: 43.0041, longitude: -71.4635, accuracy: 8 };
const LONGE = { latitude: 43.05, longitude: -71.4635, accuracy: 8 };
async function aparelho(quem, largura, geo) {
  const ctx = await browser.newContext({ viewport: { width: largura || 390, height: 844 }, geolocation: geo || PERTO, permissions: ['geolocation'] });
  await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem)]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  await ctx.route('https://router.project-osrm.org/**', (r) => r.abort());
  await ctx.route('https://nominatim.openstreetmap.org/**', (r) => r.abort());
  await ctx.route('https://unpkg.com/**', (r) => r.abort());
  await ctx.route('https://cdn.jsdelivr.net/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push(quem + ' [' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('requestfailed', (r) => { if (!/fonts|tile\.openstreetmap|open-meteo|osrm|nominatim|unpkg|jsdelivr/.test(r.url())) diag.push(quem + ' [falhou] ' + r.method() + ' ' + r.url().slice(0, 160) + ' ' + (r.failure() || {}).errorText); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push(quem + ' [' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  paginas.set(quem, p);
  return { ctx, p };
}
// tudo escopado à empresa A: o banco local guarda as cenas de execuções anteriores
const batidas = (filtro) => sql(`select id, funcionario_id, tipo, obra_id, etapa, em, dentro_cerca, modo, registrado_por, ajuste_motivo, extract(epoch from (recebida_em - em)) atraso from public.batidas where empresa_id = '${A}' ${filtro ? 'and ' + filtro : ''} order by em`);
const estadoDe = (p, nomePessoa) => p.locator('.lista-equipe li', { hasText: nomePessoa }).locator('.estado-ponto').textContent();
const toastTexto = async (p) => (await p.locator('#toast').textContent().catch(() => '')) || '';

try {
  console.log('José aceita o aviso e bate o ponto da equipe');
  const j = await aparelho('jose', 390, LONGE);
  await j.p.goto(BASE + '#/crew');
  await j.p.waitForSelector('.lista-equipe', { timeout: 30000 });
  verificar(j.p.url().endsWith('#/crew/equipe'), 'o Encarregado entra no Crew pelo ponto da equipe', j.p.url());
  verificar(await j.p.locator('.lista-equipe li').count() === 3, 'a equipe tem as 3 pessoas do cadastro', await j.p.locator('.lista-equipe li').count());
  verificar(await j.p.locator('.aviso-local').count() === 1, 'sem o aviso aceito, o app mostra o aviso de localização');
  await j.p.click('[data-acao="crew-aceitar-aviso"]');
  verificar(await esperarAte(async () => (await sql(`select aviso_gps_em from public.funcionarios where id = '${fJose}'`))[0].aviso_gps_em != null), 'o aviso aceito ficou no cadastro dele');
  await j.p.waitForFunction(() => !document.querySelector('.aviso-local'));

  // Pedro: celular longe da obra → fora da cerca (sem simulação)
  await j.p.click('.lista-equipe li:has-text("Pedro Local") input');
  await j.p.click('[data-acao="crew-entrada"]');
  await j.p.waitForSelector('dialog #crew-local');
  verificar((await j.p.textContent('dialog #crew-local')).includes('fora da cerca'), 'celular longe: o app avisa que está fora da cerca');
  await j.p.click('dialog button:has-text("Bater entrada")');
  verificar(await esperarAte(async () => (await batidas(`funcionario_id = '${fPedro}' and em > now() - interval '1 hour'`)).length === 1), 'a entrada do Pedro chegou ao banco sozinha');
  let [bp] = await batidas(`funcionario_id = '${fPedro}' and em > now() - interval '1 hour'`);
  verificar(bp.dentro_cerca === false && bp.modo === 'equipe' && bp.registrado_por === mJose && bp.obra_id === obra1.id, 'fora da cerca, pela equipe, com quem registrou e a obra', bp);

  // Luis: celular perto → dentro da cerca
  // o WebKit do Playwright às vezes demora a aplicar a nova posição: tenta de novo (cancelando o diálogo) em vez de bater fora da cerca
  for (let t = 0; t < 5; t++) {
    await j.ctx.setGeolocation(PERTO);
    if (t) await j.p.waitForTimeout(1500);
    await j.p.reload();
    await j.p.waitForSelector('.lista-equipe');
    await j.p.click('.lista-equipe li:has-text("Luis Local") input');
    await j.p.click('[data-acao="crew-entrada"]');
    await j.p.waitForSelector('dialog #crew-local');
    if ((await j.p.textContent('dialog #crew-local')).includes('dentro da cerca')) break;
    console.log('      tentativa ' + (t + 1) + ': diálogo mostra «' + ((await j.p.textContent('dialog #crew-local')) || '').replace(/\s+/g, ' ').slice(0, 140) + '» · GPS da página: ' + await j.p.evaluate(() => new Promise((ok) => navigator.geolocation.getCurrentPosition((x) => ok(x.coords.latitude.toFixed(4) + ',' + x.coords.longitude.toFixed(4)), (e) => ok('ERRO ' + e.code), { timeout: 5000, maximumAge: 0 }))));
    await j.p.click('dialog button:has-text("Cancelar")');
  }
  verificar((await j.p.textContent('dialog #crew-local')).includes('dentro da cerca'), 'celular perto: dentro da cerca');
  await j.p.fill('dialog textarea[name="nota"]', 'Material atrasou');
  await j.p.setInputFiles('dialog input[name="fotoArq"]', { name: 'equipe.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC', 'base64') });
  await j.p.click('dialog button:has-text("Bater entrada")');
  verificar(await esperarAte(async () => (await batidas(`funcionario_id = '${fLuis}' and em > now() - interval '1 hour'`)).length === 1), 'a entrada do Luis chegou ao banco');
  const [bl] = await batidas(`funcionario_id = '${fLuis}' and em > now() - interval '1 hour'`);
  verificar(bl.dentro_cerca === true && (await sql(`select nota from public.batidas where id = '${bl.id}'`))[0].nota === 'Material atrasou', 'dentro da cerca, com a nota', bl);
  verificar((await estadoDe(j.p, 'Luis Local')).includes('Trabalhando'), 'a tela mostra o Luis trabalhando');
  verificar(await esperarAte(async () => (await sql(`select foto_path from public.batidas where id = '${bl.id}'`))[0].foto_path === A + '/' + fLuis + '/' + bl.id + '.jpg'), 'a foto da equipe subiu e a batida guarda o caminho {empresa}/{funcionário}/{batida}.jpg');

  console.log('Sem internet: a batida fica no aparelho e sobe com a hora de quando foi batida');
  await j.ctx.setOffline(true);
  await j.p.click('.lista-equipe li:has-text("Luis Local") input');
  await j.p.click('[data-acao="crew-intervalo"]');
  await j.p.waitForFunction(() => /intervalo/i.test(document.querySelector('.lista-equipe').textContent));
  await j.p.waitForTimeout(2500);
  verificar((await batidas(`funcionario_id = '${fLuis}' and tipo = 'intervalo-inicio'`)).length === 0, 'sem internet, a batida não chega ao banco');
  verificar((await j.p.locator('#conexao').textContent()).includes('1 no aparelho'), 'o aviso de conexão conta a batida guardada no aparelho', await j.p.locator('#conexao').textContent());
  await new Promise((ok) => setTimeout(ok, 4000));   // a batida "envelhece" alguns segundos no aparelho
  await j.ctx.setOffline(false);
  await j.p.evaluate(() => window.dispatchEvent(new Event('online')));
  verificar(await esperarAte(async () => (await batidas(`funcionario_id = '${fLuis}' and tipo = 'intervalo-inicio'`)).length === 1), 'com o sinal de volta, a batida subiu sozinha');
  const [bi] = await batidas(`funcionario_id = '${fLuis}' and tipo = 'intervalo-inicio'`);
  verificar(bi.atraso >= 3, 'o banco guardou a hora da batida (não a hora do envio)', bi.atraso);

  console.log('Luis bate o próprio ponto; a localização é gravada com o app aberto');
  const l = await aparelho('luis', 390, PERTO);
  await l.p.goto(BASE + '#/crew');
  await l.p.waitForSelector('.meu-ponto', { timeout: 30000 });
  verificar(l.p.url().endsWith('#/crew/meu'), 'o Trabalhador entra direto no Meu ponto', l.p.url());
  verificar(await l.p.locator('.aviso-local').count() === 1, 'o aviso de localização aparece para ele também');
  await l.p.click('[data-acao="crew-volta"]');
  await l.p.waitForSelector('.meu-ponto .estado-ponto');
  verificar(await esperarAte(async () => (await batidas(`funcionario_id = '${fLuis}' and tipo = 'intervalo-fim'`)).length === 1), 'a volta do intervalo chegou ao banco');
  const [bv] = await batidas(`funcionario_id = '${fLuis}' and tipo = 'intervalo-fim'`);
  verificar(bv.modo === 'pessoal' && bv.registrado_por === mLuis, 'batida do próprio ponto: modo pessoal, registrada por ele', bv);
  verificar((await sql(`select count(*)::int n from public.localizacoes where empresa_id = '${A}'`))[0].n === 0, 'antes do aviso aceito, nenhuma localização foi gravada');
  await l.p.click('[data-acao="crew-aceitar-aviso"]');
  verificar(await esperarAte(async () => (await sql(`select gatilho from public.localizacoes where funcionario_id = '${fLuis}'`)).length === 1), 'aceito o aviso, a localização do celular foi gravada');
  const [loc] = await sql(`select gatilho, obra_id, lat from public.localizacoes where funcionario_id = '${fLuis}'`);
  verificar(loc.gatilho === 'app-aberto' && loc.obra_id === obra1.id, 'o registro é de "app aberto" e leva a obra da jornada', loc);
  verificar(await l.p.locator('.abas .abas-item').count() === 0, 'o Trabalhador não tem as abas do escritório');

  console.log('Ana (escritório): confere, ajusta, aprova e devolve');
  const a = await aparelho('ana', 1280);
  await a.p.goto(BASE + '#/crew/dia/' + fLuis + '/' + iso(new Date()));
  await a.p.waitForSelector('.linha-tempo', { timeout: 30000 });
  verificar(await esperarAte(async () => (await a.p.locator('.foto-batida img').count()) === 1 && await a.p.locator('.foto-batida img').evaluate((i) => i.complete && i.naturalWidth > 0)), 'o escritório vê a foto da batida do Luis na linha do dia (link temporário do Storage)');
  await a.p.click('.foto-batida');
  verificar(await esperarAte(async () => (await a.p.locator('dialog img.foto-batida-grande').count()) === 1), 'tocar na miniatura abre a foto grande');
  await a.p.click('dialog button:has-text("Fechar")');
  await a.p.goto(BASE + '#/crew/agora');
  await a.p.waitForSelector('.grade-obras-agora', { timeout: 30000 });
  await a.p.waitForFunction(() => document.body.innerText.includes('Pedro Local'), null, { timeout: 15000 }).catch(() => null);
  verificar((await a.p.locator('body').innerText()).includes('Pedro Local'), 'o painel Agora mostra quem está na obra');
  verificar(await a.p.locator('[data-acao="crew-conferir"]').count() >= 1, 'a batida fora da cerca espera a conferência');
  await a.p.locator('[data-acao="crew-conferir"]').first().click();
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.batidas_conferidas where empresa_id = '${A}'`))[0].n === 1), 'conferida no banco');
  verificar(await esperarAte(async () => (await a.p.locator('[data-acao="crew-conferir"]').count()) === 0), 'a conferida sai da lista');

  const ts = '#/crew/timesheets/' + iso(segundaPassada);
  await a.p.goto(BASE + ts);
  await a.p.waitForSelector('.tabela-horas', { timeout: 20000 });
  await a.p.click('[data-acao="crew-sel-ts"][data-id="' + fPedro + '"]');
  await a.p.click('[data-acao="crew-aprovar"]');
  await a.p.waitForFunction(() => /sem saída/i.test(document.querySelector('#toast') ? document.querySelector('#toast').textContent : ''), null, { timeout: 5000 }).catch(() => null);
  verificar(/sem saída/i.test(await toastTexto(a.p)), 'dia sem saída: o app não deixa aprovar', await toastTexto(a.p));
  verificar((await sql(`select count(*)::int n from public.aprovacoes_semana where empresa_id = '${A}'`))[0].n === 0, 'nada foi aprovado no banco');

  await a.p.goto(BASE + '#/crew/semana/' + fPedro + '/' + iso(segundaPassada));
  await a.p.waitForSelector('[data-acao="crew-ajustar"][data-dia="' + iso(quarta) + '"]', { timeout: 20000 });
  await a.p.click('[data-acao="crew-ajustar"][data-dia="' + iso(quarta) + '"]');
  await a.p.fill('dialog input[name="hora"]', '17:00');
  await a.p.fill('dialog textarea[name="motivo"]', 'Esqueceu de bater a saída; confirmado com o encarregado.');
  await a.p.click('dialog button:has-text("Registrar ajuste")');
  await a.p.waitForFunction(() => /Ajuste registrado/.test((document.querySelector('#toast') || {}).textContent || ''), null, { timeout: 30000 });   // o app já releu o banco
  verificar(await esperarAte(async () => (await batidas(`modo = 'ajuste'`)).length === 1), 'o ajuste entrou no banco como batida nova');
  const [aj] = await batidas(`modo = 'ajuste'`);
  verificar(aj.tipo === 'saida' && /Esqueceu/.test(aj.ajuste_motivo), 'ajuste: saída com o motivo', aj);
  verificar((await batidas(`funcionario_id = '${fPedro}'`)).length >= 4, 'as batidas originais continuam lá (nada foi apagado)');

  await a.p.goto(BASE + '#/crew/semana/' + fPedro + '/' + iso(segundaPassada));
  await a.p.waitForSelector('[data-acao="crew-aprovar"]', { timeout: 20000 });
  await a.p.click('[data-acao="crew-aprovar"]');
  await a.p.click('dialog button:has-text("Aprovar")');
  verificar(await esperarAte(async () => (await sql(`select status from public.aprovacoes_semana where funcionario_id = '${fPedro}'`)).some((x) => x.status === 'aprovado')), 'semana do Pedro aprovada no banco');

  await a.p.goto(BASE + '#/crew/semana/' + fLuis + '/' + iso(segundaPassada));
  await a.p.waitForSelector('[data-acao="crew-devolver"]', { timeout: 20000 });
  await a.p.click('[data-acao="crew-devolver"]');
  await a.p.fill('dialog textarea[name="motivo"]', 'Conferir a terça com o encarregado.');
  await a.p.click('dialog button:has-text("Devolver")');
  verificar(await esperarAte(async () => (await sql(`select motivo from public.aprovacoes_semana where funcionario_id = '${fLuis}' and status = 'devolvido'`)).length === 1), 'semana do Luis devolvida com o motivo');

  console.log('Semana aprovada é fechada: valor hora novo só depois');
  let recusa = '';
  try { await rest(ID.ana, '/funcionario_valores', { metodo: 'POST', corpo: { funcionario_id: fPedro, desde: iso(terca), valor: 25, motivo: 'Reajuste' } }); } catch (e) { recusa = String(e.message); }
  verificar(/já foi aprovada/.test(recusa), 'valor hora dentro de semana aprovada: o banco recusa', recusa.slice(0, 160));
  await rest(ID.ana, '/funcionario_valores', { metodo: 'POST', corpo: { funcionario_id: fPedro, desde: iso(segundaAtual), valor: 25, motivo: 'Reajuste' } });
  verificar((await sql(`select count(*)::int n from public.funcionario_valores where funcionario_id = '${fPedro}'`))[0].n === 2, 'a partir da semana aberta, o valor novo entra');

  console.log('Custos e orçamento');
  await a.p.goto(BASE + '#/crew/custos');
  await a.p.waitForSelector('[data-acao="crew-orcamento"]', { timeout: 20000 });
  await a.p.locator('[data-acao="crew-orcamento"]').first().click();
  await a.p.fill('dialog input[name="valor"]', '50000');
  await a.p.fill('dialog input[name="avanco"]', '20');
  await a.p.click('dialog button:has-text("Salvar")');
  verificar(await esperarAte(async () => (await sql(`select valor::float v, avanco::float a from public.orcamentos_obra where empresa_id = '${A}'`)).some((x) => x.v === 50000 && x.a === 20)), 'orçamento gravado no banco (nova versão)');

  console.log('Mapa do dia: registros reais, não simulados');
  await a.p.goto(BASE + '#/crew/dia/' + fLuis + '/' + iso(hojeData));
  await a.p.waitForSelector('#mapa-cartao', { timeout: 20000 });
  const corpo = await a.p.locator('body').innerText();
  verificar(!corpo.includes('Trilha simulada'), 'o mapa não diz mais "trilha simulada"');
  verificar(corpo.includes('Abriu o aplicativo'), 'o registro de localização do Luis aparece na lista do dia', corpo.slice(0, 200));

  console.log('Tom (construtora) vê quem está na obra, sem dinheiro');
  const t = await aparelho('tom', 1280);
  await t.p.goto(BASE + '#/daily/obras');
  await t.p.waitForSelector('#conteudo', { timeout: 30000 });
  await t.p.goto(BASE + '#/daily/obras/' + obraB.id);
  await t.p.waitForSelector('.prestadoras-obra', { timeout: 20000 }).catch(() => null);
  const txt = await t.p.locator('body').innerText();
  verificar(txt.includes('Pedro Local') && txt.includes('Luis Local'), 'a construtora vê os nomes de quem bateu o ponto na obra ligada', txt.slice(0, 300));
  verificar(!/US\$|\$\s?\d/.test(await t.p.locator('.prestadoras-obra').innerText().catch(() => '')), 'sem valores em dinheiro na visão da construtora');
  const ver = await t.p.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('kbt.oficial.v1.')).map((k) => localStorage.getItem(k)).join(''));
  verificar(!/"lat":43\.0041/.test(ver) && !/localizacoes":\[\{/.test(ver), 'a construtora não recebeu a localização de ninguém');
  const direto = await sql(`select 1 from public.batidas where empresa_id = '${A}' limit 1`);
  verificar(direto.length > 0, '(controle: o banco tem batidas)');
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (falhas) {   // para quem lê a saída sem ver a tela: o que cada aparelho mostrava
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
