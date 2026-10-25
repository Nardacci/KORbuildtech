/* KORbuild — as concorrências da página oficial (fatia 7; docs/banco.md §14), de ponta a ponta.
 * As telas do protótipo sobre o espelho e js/concorrencias-oficial.js levando cada ação ao banco:
 *   Tom (Administrador da construtora B) monta a concorrência (rascunho direto, PDF no Storage), envia e recebe os links
 *   dos convidados sem conta; Ana (Administradora da prestadora A, com conta) vê o convite, "Vou cotar" cria o projeto
 *   no Measure com os desenhos copiados, pergunta no canal e manda a proposta emitida pela plataforma; a Bayside, sem
 *   conta, responde e manda a proposta em PDF pelo link (função de borda convite-publico); Tom responde para todos, avisa a
 *   todos, compara e fecha com a Ana; o projeto da Ana vira Ganha e a obra que ela cria já nasce ligada à obra da B.
 * Duas formas de rodar, com os mesmos passos:
 *   --local  (padrão) contra o "Supabase local" (tools/supabase-local.sh), sem rede;
 *   --real   contra o Supabase do projeto (precisa de SUPABASE_ACCESS_TOKEN e da função de borda publicada).
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/concorrencias-oficial.test.mjs [http://localhost:8123/] [--real] */

import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const REAL = process.argv.includes('--real');
const { sql, sqlExec, rest, criarUsuario, sessao, rotear, arquivosDaPasta, limpar, nome } = await import(REAL ? './_supabase-real.mjs' : './_supabase-local.mjs');
const BASE = process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/';
console.log('Concorrências contra: ' + nome);
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}
const esperarAte = async (fn, ms = 20000) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (await fn()) return true; await new Promise((ok) => setTimeout(ok, 250)); } return false; };
const isoDaqui = (dias) => { const d = new Date(Date.now() + dias * 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

// ---------- A cena ----------
const sufixo = Date.now().toString(36);
await limpar();
const EMAIL = { ana: 'kb-e2e-daily-ana-' + sufixo + '@example.com', jose: 'kb-e2e-daily-jose-' + sufixo + '@example.com', tom: 'kb-e2e-daily-tom-' + sufixo + '@example.com', bay: 'kb-e2e-daily-bay-' + sufixo + '@example.com' };
const ID = { ana: await criarUsuario(EMAIL.ana, 'Ana Local'), jose: await criarUsuario(EMAIL.jose, 'José Local'), tom: await criarUsuario(EMAIL.tom, 'Tom Local') };
const A = await rest(ID.ana, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Prestadora Local ' + sufixo, atuacao: 'prestadora' } } });
// José, encarregado da A: quem preenche o diário da obra que a Ana vai criar
const perfisA = await rest(ID.ana, '/perfis_acesso?select=id,chave');
const tokenJose = await rest(ID.ana, '/rpc/convidar_usuario', { metodo: 'POST', corpo: { p_email: EMAIL.jose, p_nome: 'José Local', p_perfil: perfisA.find((p) => p.chave === 'encarregado').id } });
await rest(ID.jose, '/rpc/aceitar_convite', { metodo: 'POST', corpo: { p_token: tokenJose } });
const B = await rest(ID.tom, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Construtora Local ' + sufixo, atuacao: 'construtora' } } });
const [dono] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Dono', papeis: ['cliente'] } });
const [ctA] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Prestadora Local ' + sufixo, papeis: ['prestadora'], email: 'a@example.com', conta_empresa_id: A } });
const [ctBay] = await rest(ID.tom, '/contatos', { metodo: 'POST', corpo: { nome: 'Bayside Local', papeis: ['prestadora'], email: EMAIL.bay } });
const [obraB] = await rest(ID.tom, '/obras', { metodo: 'POST', corpo: { nome: 'Edifício Local', contratante_id: dono.id, municipio: 'Nashua', estado: 'NH', lat: 42.76, lon: -71.46, inicio: '2026-01-01', prazo: '2027-12-31' } });
const membroJose = (await sql(`select id from public.membros where user_id = '${ID.jose}'`))[0];

// ---------- O navegador ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
const diag = [];
const paginas = new Map();
async function aparelho(quem) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if (ID[quem]) await ctx.addInitScript(([s]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } }, [await sessao(ID[quem], EMAIL[quem], quem)]);
  else await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } });
  await rotear(ctx, URL_PROJETO);
  await ctx.route('https://fonts.**', (r) => r.abort());
  await ctx.route('https://api.open-meteo.com/**', (r) => r.abort());
  await ctx.route('https://tile.openstreetmap.org/**', (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(quem + ': ' + e.message));
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) diag.push(quem + ' [' + m.type() + '] ' + m.text().slice(0, 240)); });
  p.on('response', async (r) => { if (r.status() >= 400 && !/fonts|tile\.openstreetmap/.test(r.url())) diag.push(quem + ' [' + r.status() + '] ' + r.request().method() + ' ' + r.url().slice(0, 160) + ' ' + (await r.text().catch(() => '')).slice(0, 200)); });
  paginas.set(quem, p);
  return { ctx, p };
}
const noDialogo = async (p, texto) => { await p.click('dialog button:has-text("' + texto + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
const toastTexto = async (p) => (await p.locator('#toast').textContent().catch(() => '')) || '';
/* O espelho do banco pode terminar de ler depois de a tela aparecer (e a tela é redesenhada): espera assentar antes de preencher. */
const esperaEspelho = (p) => p.waitForFunction(async () => { const m = await import('./js/espelho.js'); return m.espelho.pronto && !m.espelho.lendo; }, null, { timeout: 30000 }).then(() => p.waitForTimeout(300));
const esperaToast = (p, re, ms = 30000) => p.waitForFunction((fonte) => new RegExp(fonte).test((document.getElementById('toast') || {}).textContent || ''), re.source, { timeout: ms });
const conc = () => sql(`select id, situacao, obra_id, etapas, prazo, fechamento, enviada_em from public.concorrencias where empresa_id = '${B}'`);

try {
  console.log('Tom: a concorrência (rascunho direto, PDF no Storage) e o envio');
  const t = await aparelho('tom');
  await t.p.goto(BASE + '#/daily/concorrencias');
  await t.p.waitForSelector('a[href="#/daily/concorrencias/nova"]', { timeout: 30000 });
  await t.p.goto(BASE + '#/daily/concorrencias/nova');
  await t.p.waitForSelector('#form-concorrencia', { timeout: 20000 });
  await esperaEspelho(t.p);
  await t.p.selectOption('#co-obraId', obraB.id);
  await t.p.fill('#co-servico', 'Framing e drywall');
  await t.p.fill('#co-outrasEtapas', '06 10 00\n09 21 16');
  await t.p.fill('#co-incluso', 'Paredes\nForro');
  await t.p.fill('#co-prazoData', isoDaqui(5));
  await t.p.fill('#co-prazoHora', '17:00');
  await t.p.setInputFiles('#co-arquivo', 'assets/plantas/casa-modelo.pdf');
  await t.p.fill('#co-descricao', 'Planta da casa');
  await t.p.click('[data-acao="co-anexar"]');
  await t.p.check('input[name="convidados"][value="' + ctA.id + '"]');
  await t.p.check('input[name="convidados"][value="' + ctBay.id + '"]');
  await t.p.click('button[data-acao="co-salvar"]:not([data-enviar])');
  await esperaToast(t.p, /Rascunho salvo/);
  verificar(await esperarAte(async () => (await conc()).length === 1), 'o rascunho chegou ao banco');
  const c = (await conc())[0];
  verificar(c.situacao === 'rascunho' && c.etapas.length === 2 && c.obra_id === obraB.id, 'rascunho com a obra e as 2 etapas', c);
  const convites = await sql(`select id, nome, convidada_id, situacao, token_hash from public.concorrencia_convites where concorrencia_id = '${c.id}' order by nome`);
  verificar(convites.length === 2 && convites.find((v) => v.nome === 'Bayside Local').convidada_id === null && convites.find((v) => v.nome !== 'Bayside Local').convidada_id === A, 'os 2 convites: a Ana com conta, a Bayside pelo link', convites);

  // regressão: salvar o rascunho de novo (sem mudar os convidados) não duplica nem dá erro de chave
  await t.p.goto(BASE + '#/daily/concorrencias/' + c.id + '/editar');
  await t.p.waitForSelector('#form-concorrencia', { timeout: 20000 });
  await t.p.click('button[data-acao="co-salvar"]');
  await t.p.waitForURL('**#/daily/concorrencias/' + c.id, { timeout: 30000 });
  await t.p.goto(BASE + '#/daily/concorrencias/' + c.id + '/editar');
  await t.p.waitForSelector('#form-concorrencia', { timeout: 20000 });
  await t.p.click('button[data-acao="co-salvar"]');
  await t.p.waitForURL('**#/daily/concorrencias/' + c.id, { timeout: 30000 });
  verificar((await conc()).length === 1 && (await sql(`select 1 from public.concorrencia_convites where concorrencia_id = '${c.id}'`)).length === 2, 'salvar de novo atualiza o mesmo rascunho, sem duplicar rascunho nem convite');
  await t.p.goto(BASE + '#/daily/concorrencias/' + c.id);
  const desenhos = await sql(`select nome, arquivo_path from public.concorrencia_desenhos where concorrencia_id = '${c.id}'`);
  verificar(desenhos.length === 1 && desenhos[0].arquivo_path.startsWith(B + '/' + c.id + '/desenhos/'), 'o desenho aponta a pasta da concorrência', desenhos);
  verificar((await arquivosDaPasta(B + '/' + c.id + '/desenhos/', 'concorrencias')).length === 1, 'o PDF do desenho foi para o Storage');
  await t.p.waitForURL('**#/daily/concorrencias/' + c.id, { timeout: 20000 });
  await t.p.waitForSelector('[data-acao="co-enviar"]', { timeout: 20000 });
  await t.p.click('[data-acao="co-enviar"]');
  await t.p.click('dialog button:has-text("Enviar")');
  await t.p.waitForSelector('[data-acao="co-link"]', { timeout: 30000 });
  verificar((await t.p.locator('dialog').count()) === 0, 'não abre popup com os links');
  const token = await t.p.getAttribute('[data-acao="co-link"]', 'data-token');
  const link = 'https://x/#/convite/' + token;
  verificar(/^[0-9a-f]{48}$/.test(token) && !/\?demo/.test(link), 'o link da Bayside veio uma vez, sem "?demo"', link);
  verificar(await esperarAte(async () => (await conc())[0].situacao === 'aberta'), 'a concorrência está aberta no banco');
  const hashes = await sql(`select nome, token_hash is not null as tem from public.concorrencia_convites where concorrencia_id = '${c.id}'`);
  verificar(hashes.find((v) => v.nome === 'Bayside Local').tem && !hashes.find((v) => v.nome !== 'Bayside Local').tem, 'só o convite pelo link tem token (e só o hash fica)', hashes);
  await t.p.waitForSelector('[data-acao="co-link"]', { timeout: 20000 });
  verificar((await t.p.locator('[data-acao="co-link"]').count()) === 1, '"Copiar o link" aparece para a Bayside, guardado no aparelho que enviou');
  const cvA = convites.find((v) => v.nome !== 'Bayside Local').id, cvBay = convites.find((v) => v.nome === 'Bayside Local').id;

  console.log('Ana: o convite, "Vou cotar" (projeto com os desenhos copiados) e a pergunta');
  const a = await aparelho('ana');
  await a.p.goto(BASE + '#/measure/convites');
  await a.p.waitForSelector('.tabela-convites a[href="#/measure/convite/' + c.id + '"]', { timeout: 30000 });
  // o aviso chega pela leitura do servidor depois de montar a tela: espera, em vez de contar de imediato
  verificar(await esperarAte(async () => (await a.p.locator('[data-acao="ler-notificacao"][href="#/measure/convite/' + c.id + '"]').count()) === 1), 'o convite também está no sininho da Ana', await a.p.locator('.notif-lista').allTextContents().catch(() => ''));
  await a.p.click('.tabela-convites a[href="#/measure/convite/' + c.id + '"]');
  await a.p.waitForSelector('[data-acao="cv-vou"]', { timeout: 20000 });
  verificar((await a.p.textContent('main')).includes('Construtora Local ' + sufixo) && (await a.p.textContent('main')).includes('Edifício Local'), 'o convite mostra a contratante e a obra');
  verificar(await esperarAte(async () => (await sql(`select visto_em from public.concorrencia_convites where id = '${cvA}'`))[0].visto_em !== null), 'abrir o convite marcou "visto" no banco');
  await a.p.click('[data-acao="cv-vou"]');
  await a.p.waitForURL('**#/measure/projeto/**', { timeout: 60000 });
  verificar(await esperarAte(async () => { const v = (await sql(`select situacao, projeto_id from public.concorrencia_convites where id = '${cvA}'`))[0]; return v.situacao === 'vai-cotar' && v.projeto_id; }), '"Vou cotar" e o projeto ligado ao convite no banco');
  const pjA = (await sql(`select p.id, p.nome, p.contratante_id, p.concorrencia, c.conta_empresa_id from public.projetos p join public.contatos c on c.id = p.contratante_id where p.empresa_id = '${A}'`))[0];
  verificar(pjA && pjA.concorrencia.conviteId === cvA && pjA.conta_empresa_id === B, 'o projeto da Ana guarda a concorrência e o contratante é o contato da B (com conta)', pjA);
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.folhas where projeto_id = '${pjA.id}'`))[0].n === 3, 60000), 'os desenhos viraram 3 folhas no projeto (cópia no bucket da Ana)');
  verificar((await arquivosDaPasta(A + '/' + pjA.id + '/', 'plantas')).length === 1, 'a cópia do PDF está no Storage da Ana');
  await a.p.goto(BASE + '#/measure/convite/' + c.id);
  await a.p.waitForSelector('[data-acao="cv-escrever"]', { timeout: 20000 });
  await esperaEspelho(a.p);
  await a.p.fill('.co-escrever textarea', 'O forro inclui isolamento?');
  await a.p.click('[data-acao="cv-escrever"]');
  await esperaToast(a.p, /Mensagem enviada/);
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.concorrencia_mensagens where convite_id = '${cvA}' and de = 'convidada'`))[0].n === 1), 'a pergunta da Ana chegou ao banco');

  console.log('Bayside, pelo link, sem conta: responde, pergunta e manda a proposta em PDF');
  const l = await aparelho('bay');
  await l.p.goto(BASE + '#/convite/' + token);
  await l.p.waitForSelector('[data-acao="lk-vou"]', { timeout: 30000 });
  verificar((await l.p.textContent('main')).includes('Framing e drywall') && !(await l.p.textContent('main')).includes('Prestadora Local'), 'a página do link mostra o convite e não cita a outra convidada');
  verificar(await l.p.locator('.convite-publico table a[href][target="_blank"]').count() >= 1 && !(await l.p.textContent('main')).includes('indisponível'), 'o link mostra os desenhos com botão Abrir (não "indisponível")');
  await l.p.click('[data-acao="lk-vou"]');
  await l.p.waitForSelector('#form-link', { timeout: 30000 });
  await l.p.fill('#form-link input[name="total"]', '61500');
  await l.p.setInputFiles('#lk-pdf', 'assets/plantas/casa-modelo.pdf');
  await l.p.click('[data-acao="lk-enviar"]');
  await esperaToast(l.p, /Proposta enviada \(rev\. 1\)/);
  const pBay = async () => (await sql(`select rev, total::float as tot, pdf_path from public.concorrencia_propostas where convite_id = '${cvBay}'`))[0];
  await esperarAte(async () => !!(await pBay()));
  verificar(await (async () => { const p = await pBay(); return p && p.rev === 1 && p.tot === 61500 && p.pdf_path === B + '/' + c.id + '/propostas/' + cvBay + '/rev-1.pdf'; })(), 'a proposta pelo link está no banco, com o PDF na pasta do convite', { esperado: B + '/' + c.id + '/propostas/' + cvBay + '/rev-1.pdf', ...(await pBay()) });
  verificar((await arquivosDaPasta(B + '/' + c.id + '/propostas/' + cvBay + '/', 'concorrencias')).length === 1, 'o PDF da proposta foi para o Storage');
  await l.p.waitForSelector('[data-acao="lk-perguntar"]', { timeout: 20000 });
  await l.p.fill('.co-escrever textarea', 'Tem visita à obra?');
  await l.p.click('[data-acao="lk-perguntar"]');
  await esperaToast(l.p, /Mensagem enviada/);
  await l.p.waitForSelector('.co-mensagens', { timeout: 20000 });
  verificar(!(await l.p.textContent('.co-mensagens')).includes('isolamento'), 'pelo link, a Bayside não vê a pergunta da Ana (ainda não é pública)');

  console.log('Tom: responde para todos, avisa a todos e compara');
  await t.p.goto(BASE + '#/daily/concorrencias/' + c.id + '/perguntas');
  await t.p.reload();
  await t.p.waitForSelector('[data-acao="co-responder"]', { timeout: 30000 });
  verificar((await t.p.locator('[data-acao="co-responder"]').count()) === 2, 'as duas perguntas aparecem para responder');
  const perguntaAna = (await sql(`select id from public.concorrencia_mensagens where convite_id = '${cvA}' and de = 'convidada'`))[0].id;
  await t.p.click('[data-acao="co-responder"][data-msg="' + perguntaAna + '"]');
  await t.p.fill('dialog textarea[name="texto"]', 'Sim, isolamento R-30.');
  await t.p.click('dialog button:has-text("Responder")');
  await esperaToast(t.p, /Resposta enviada a todas/);
  verificar(await esperarAte(async () => (await sql(`select publica from public.concorrencia_mensagens where id = '${perguntaAna}'`))[0].publica === true), 'a pergunta respondida para todos ficou pública');
  await t.p.waitForSelector('[data-acao="co-aviso"]', { timeout: 20000 });
  await esperaEspelho(t.p);
  await t.p.fill('[data-acao="co-aviso"] ~ textarea, .co-escrever:has([data-acao="co-aviso"]) textarea', 'Adendo nº 1: a folha A-102 foi revisada.');
  await t.p.click('[data-acao="co-aviso"]');
  await noDialogo(t.p, 'Avisar a todos');
  await esperaToast(t.p, /Aviso enviado/);
  verificar(await esperarAte(async () => (await sql(`select count(*)::int n from public.concorrencia_mensagens where concorrencia_id = '${c.id}' and aviso`))[0].n === 1 && (await sql(`select count(*)::int n from public.concorrencia_historico where concorrencia_id = '${c.id}' and acao = 'adendo'`))[0].n === 1), 'o aviso a todos é um adendo no histórico');
  await l.p.reload();
  await l.p.waitForSelector('.co-mensagens', { timeout: 30000 });
  const canalBay = await l.p.textContent('.co-mensagens');
  verificar(canalBay.includes('Pergunta de um convidado') && canalBay.includes('isolamento') && canalBay.includes('Adendo nº 1'), 'pelo link, a Bayside vê a pergunta pública sem o nome, a resposta e o adendo');

  console.log('Ana: a proposta emitida no Measure vai pela plataforma');
  const retrato = { contratante: { nome: 'Construtora Local ' + sufixo }, obra: { nome: pjA.nome }, linhas: [{ titulo: 'Framing', codigo: '06 10 00', valor: 100000 }, { titulo: 'Drywall', codigo: '09 21 16', valor: 80000 }], extras: [{ descricao: 'Mobilização', valor: 6400 }], total: 186400, validadeDias: 30, termos: '' };
  const emitida = await rest(ID.ana, '/rpc/emitir_proposta', { metodo: 'POST', corpo: { p_projeto: pjA.id, p_retrato: retrato } });
  await a.p.goto(BASE + '#/measure/projeto/' + pjA.id + '/proposta');
  await a.p.reload();
  await a.p.waitForSelector('[data-acao="cv-plataforma"]', { timeout: 30000 });
  await a.p.click('[data-acao="cv-plataforma"]');
  await a.p.waitForSelector('dialog:has-text("' + emitida.numero + '")', { timeout: 20000 });
  await a.p.fill('dialog input[name="prazo"]', '45');
  await a.p.click('dialog button:has-text("Enviar")');
  await esperaToast(a.p, /Proposta enviada para .* \(rev\. 1\)/);
  verificar(await esperarAte(async () => { const p = (await sql(`select rev, numero, total::float as tot, por_etapa, outros::float as outros, prazo_execucao_dias as dias, proposta_emitida_id as emitida from public.concorrencia_propostas where convite_id = '${cvA}'`))[0]; return p && p.rev === 1 && p.numero === emitida.numero && p.tot === 186400 && p.por_etapa['06 10 00'] === 100000 && p.outros === 6400 && p.dias === 45 && p.emitida === emitida.id; }), 'a proposta da Ana chegou por etapa, com os outros itens, o prazo e a referência à proposta emitida');

  console.log('Tom: fecha com a Ana');
  await t.p.goto(BASE + '#/daily/concorrencias/' + c.id + '/comparar');
  await t.p.reload();
  await t.p.waitForSelector('[data-acao="co-fechar"][data-convite="' + cvA + '"]', { timeout: 30000 });
  verificar((await t.p.locator('[data-acao="co-fechar"]').count()) === 2, 'a comparação tem as duas propostas');
  await t.p.click('[data-acao="co-fechar"][data-convite="' + cvA + '"]');
  await t.p.fill('dialog input[name="observacao"]', 'Melhor prazo');
  await t.p.click('dialog button:has-text("Fechar negócio")');
  await esperaToast(t.p, /Fechada com/);
  verificar(await esperarAte(async () => (await conc())[0].situacao === 'fechada'), 'a concorrência está fechada no banco');
  const depois = await sql(`select nome, situacao from public.concorrencia_convites where concorrencia_id = '${c.id}' order by nome`);
  verificar(depois.find((v) => v.nome === 'Bayside Local').situacao === 'nao-escolhida' && depois.find((v) => v.nome !== 'Bayside Local').situacao === 'vencedora', 'vencedora e não escolhida', depois);
  const pjDepois = (await sql(`select situacao, concorrencia from public.projetos where id = '${pjA.id}'`))[0];
  verificar(pjDepois.situacao === 'ganha' && pjDepois.concorrencia.vinculo && pjDepois.concorrencia.vinculo.obraId === obraB.id, 'o projeto da Ana virou Ganha com o vínculo para a obra da B', pjDepois);
  await l.p.reload();
  await l.p.waitForSelector('main', { timeout: 30000 });
  await l.p.waitForFunction(() => /fechou com outra empresa/.test(document.body.textContent), null, { timeout: 30000 });
  verificar(!(await l.p.textContent('main')).includes('186'), 'a Bayside vê que a contratante fechou com outra, sem o valor');

  console.log('Ana: a obra nasce ligada à obra da B (CO-14)');
  await a.p.goto(BASE + '#/measure/convite/' + c.id);
  await a.p.reload();
  await a.p.waitForSelector('a[href="#/conta/obras/nova/' + pjA.id + '"]', { timeout: 30000 });
  verificar((await a.p.textContent('main')).includes('Você venceu'), 'o convite mostra que a Ana venceu');
  await a.p.click('a[href="#/conta/obras/nova/' + pjA.id + '"]');
  await a.p.waitForSelector('#form-obra', { timeout: 30000 });
  await esperaEspelho(a.p);
  verificar((await a.p.inputValue('#ob-nome')) === pjA.nome && (await a.p.inputValue('#ob-contratanteId')) === pjA.contratante_id, 'o cadastro da obra vem preenchido pelo projeto');
  await a.p.fill('#ob-lat', '42.76'); await a.p.fill('#ob-lon', '-71.46');
  await a.p.fill('#ob-prazo', '2027-06-30');
  await a.p.selectOption('#ob-responsavelId', membroJose.id);
  await a.p.click('[data-acao="cad-salvar-obra"]');
  await esperaToast(a.p, /Obra criada/);
  const obraA = (await sql(`select id, nome, vinculo_empresa_id, vinculo_obra_id, concorrencia_id, projeto_id from public.obras where empresa_id = '${A}'`))[0];
  verificar(obraA && obraA.vinculo_empresa_id === B && obraA.vinculo_obra_id === obraB.id && obraA.concorrencia_id === c.id && obraA.projeto_id === pjA.id, 'a obra da Ana está ligada à obra da B pela concorrência', obraA);
  verificar((await sql(`select obra_id from public.projetos where id = '${pjA.id}'`))[0].obra_id === obraA.id, 'o projeto aponta a obra');
  verificar((await sql(`select count(*)::int n from public.auditoria where empresa_id = '${A}' and tabela = 'concorrencias'`))[0].n >= 3, 'a auditoria da Ana registra o que ela fez na concorrência');
} catch (e) {
  falhas++;
  console.log('FALHA inesperada: ' + (e && e.stack ? e.stack.split('\n').slice(0, 4).join(' | ') : e));
} finally {
  if (falhas) {
    for (const [quem, p] of paginas) console.log('      [' + quem + '] ' + p.url() + ' · aviso: ' + (await toastTexto(p)).slice(0, 120) + '\n      tela: ' + ((await p.textContent('main').catch(() => '')) || '').replace(/\s+/g, ' ').slice(0, 400));
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
