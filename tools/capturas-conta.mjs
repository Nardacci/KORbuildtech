/* KORbuild — capturas das telas da conta de verdade para o portal (portal/img/ e portal/pt/img/): a administração da plataforma,
 * o sininho, as preferências de e-mail, o aviso de conta suspensa e o e-mail de avisos.
 * Diferente de tools/capturas-portal.mjs (que usa o protótipo), estas telas só existem na conta de verdade: o script sobe uma
 * cena de exemplo (empresas fictícias) no banco LOCAL e tira as fotos de lá. Nada toca o Supabase do projeto.
 * Uso (o banco local precisa estar zerado, para a lista só ter as empresas de exemplo):
 *   tools/supabase-local.sh ; python3 -m http.server 8123 &
 *   node --experimental-strip-types tools/capturas-conta.mjs [http://localhost:8123/] [--idioma=pt]
 * Depois: python3 tools/gerar_portal.py */

import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { sql, sqlExec, rest, criarUsuario, sessao, rotear } from '../tests/_supabase-local.mjs';

const BASE = process.argv.find((a) => a.startsWith('http')) || 'http://localhost:8123/';
const IDIOMA = ((process.argv.find((a) => a.startsWith('--idioma=')) || '').slice(9)) || 'en';
const PASTA = new URL(IDIOMA === 'pt' ? '../portal/pt/img/' : '../portal/img/', import.meta.url).pathname;
mkdirSync(PASTA, { recursive: true });
const URL_PROJETO = readFileSync(new URL('../js/config.js', import.meta.url), 'utf8').match(/SUPABASE_URL\s*=\s*'([^']+)'/)[1];
const T = (en, pt) => (IDIOMA === 'pt' ? pt : en);
const modelos = await import('../supabase/functions/enviar-avisos/modelos.ts');

// ---------- A cena de exemplo ----------
const pessoas = {};
async function empresa(chave, nomePessoa, email, nome, atuacao) {
  const id = await criarUsuario(email, nomePessoa);
  const emp = await rest(id, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome, atuacao } } });
  pessoas[chave] = { id, email, nome: nomePessoa, empresa: emp, nomeEmpresa: nome };
}
await empresa('dana', 'Dana Whitfield', 'dana@northfield.example.com', 'Northfield Builders', 'construtora');
await empresa('marcus', 'Marcus Reed', 'marcus@ridgeline.example.com', 'Ridgeline Siding', 'prestadora');
await empresa('elena', 'Elena Torres', 'elena@summit.example.com', 'Summit Framing', 'prestadora');
await empresa('paulo', 'Paul Okafor', 'paul@harbor.example.com', 'Harbor Concrete', 'prestadora');
await empresa('june', 'June Park', 'june@pine.example.com', 'Pine & Co Roofing', 'prestadora');
const ids = Object.fromEntries(Object.entries(pessoas).map(([k, v]) => [k, v.empresa]));
const plano = (k, j) => sqlExec(`update public.empresas set plano = '${JSON.stringify(j)}'::jsonb where id = '${ids[k]}'`);
const dia = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
plano('dana', { nome: 'Professional', status: 'ativa' });
plano('marcus', { nome: 'Trial', status: 'teste', teste_ate: dia(9) });
plano('elena', { nome: 'Trial', status: 'teste', teste_ate: dia(-3) });
plano('paulo', { nome: 'Professional', status: 'ativa', limite_obras: 10, limite_usuarios: 25 });
sqlExec(`update public.membros set ultimo_acesso = now() - interval '2 hours' where empresa_id = '${ids.paulo}'`);
await sqlExec(`insert into public.admins_plataforma (user_id) values ('${pessoas.dana.id}')`);
// o escritório da plataforma já mexeu em duas empresas (aparece em "O que a plataforma já fez")
await rest(pessoas.dana.id, '/rpc/admin_alterar_plano', { metodo: 'POST', corpo: { p_empresa: ids.paulo, p_plano: { nome: 'Professional', status: 'ativa', limite_obras: 10, limite_usuarios: 25 }, p_motivo: T('Signed the Professional plan', 'Assinou o plano Professional') } });
await rest(pessoas.dana.id, '/rpc/admin_alterar_plano', { metodo: 'POST', corpo: { p_empresa: ids.june, p_plano: { status: 'suspensa' }, p_motivo: T('Payment overdue', 'Pagamento em atraso') } });
const fila = (para, nome, modelo, dados, extra = '') => sqlExec(`insert into public.fila_email (empresa_id, para_email, para_nome, idioma, modelo, dados ${extra ? ', ' + extra.split('=')[0] : ''}) values ('${ids.dana}', '${para}', '${nome}', 'en', '${modelo}', '${JSON.stringify(dados)}'::jsonb ${extra ? ', ' + extra.split('=')[1] : ''})`);
await fila('bids@baystate.example.com', 'Bay State Siding', 'convite-concorrencia', { servico: 'Siding', contratante: 'Northfield Builders' }, 'enviado_em=now() - interval \'1 hour\'');
await fila('office@keystone.example.com', 'Keystone Drywall', 'convite-concorrencia', { servico: 'Drywall', contratante: 'Northfield Builders' });
await fila('crew@lakeside.example.com', 'Lakeside Roofing', 'aviso-link', { evento: 'prazo', servico: 'Roofing', contratante: 'Northfield Builders' }, "erro='Mailbox unavailable'");

const aviso = (chave, dados, link, categoria, texto) => sqlExec(`select public.notificar('${pessoas.marcus.id}', '${ids.marcus}', '${categoria}', '${chave.replace(/'/g, "''")}', '${JSON.stringify(dados)}'::jsonb, '${link}', ${texto ? `'${texto}'` : 'null'}, false, true)`);
await aviso('RDO nº {numero} de {obra} aguardando aprovação', { numero: 14, obra: 'Harbor Residence' }, '#/daily/painel', 'daily');
await aviso('Convite para cotar: {servico} · {nome}', { servico: 'Siding', nome: 'Northfield Builders' }, '#/daily/concorrencias', 'concorrencia');
await aviso('Cronograma publicado por {empresa}: {obra} (versão {versao})', { empresa: 'Northfield Builders', obra: 'Harbor Residence', versao: 2 }, '#/daily/cronograma', 'cronograma');
await aviso('Sua semana de {semana} foi aprovada', { semana: '10/05' }, '#/crew', 'crew');
await sqlExec(`update public.notificacoes set lida_em = now() where user_id = '${pessoas.marcus.id}' and categoria = 'crew'`);

// ---------- As fotos ----------
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let feitas = 0;
async function como(pessoa, largura = 1280, altura = 800) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 1.25 });
  await ctx.addInitScript(([s, idioma]) => { try { localStorage.setItem('kbt.conta', s); localStorage.setItem('kbt.idioma', idioma); } catch { /* */ } }, [await sessao(pessoa.id, pessoa.email, pessoa.nome.split(' ')[0].toLowerCase()), IDIOMA]);
  await rotear(ctx, URL_PROJETO);
  await ctx.route(/fonts\.|tile\.openstreetmap|api\.open-meteo/, (r) => r.abort());
  return { ctx, p: await ctx.newPage() };
}
const foto = async (p, nome, alvo, opcoes = {}) => {
  const arq = PASTA + nome + '.png';
  if (alvo) await p.locator(alvo).first().screenshot({ path: arq }); else await p.screenshot({ path: arq, ...opcoes });
  feitas++; console.log('  ' + nome);
};

console.log('Administração da plataforma (' + IDIOMA + ')');
{
  const { ctx, p } = await como(pessoas.dana);
  await p.goto(BASE + 'admin.html#empresas');
  await p.waitForSelector('table.tabela tbody tr', { timeout: 30000 });
  await p.waitForTimeout(500);
  await foto(p, 'platform-admin-companies', null, { clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await p.goto(BASE + 'admin.html#empresa/' + ids.paulo);
  await p.waitForSelector('#ad-plano', { timeout: 20000 });
  await p.waitForTimeout(500);
  await foto(p, 'platform-admin-company', null, { fullPage: true });
  await p.goto(BASE + 'admin.html#emails');
  await p.waitForSelector('table.tabela', { timeout: 20000 });
  await p.waitForTimeout(500);
  await foto(p, 'platform-admin-emails', null, { clip: { x: 0, y: 0, width: 1280, height: 520 } });
  await ctx.close();
}

console.log('Sininho e preferências de e-mail');
{
  const { ctx, p } = await como(pessoas.marcus);
  await p.goto(BASE + '#/daily/painel');
  await p.waitForSelector('details.sino .sino-contador', { timeout: 30000 });
  await p.waitForFunction(async () => { const m = await import('./js/espelho.js'); return m.espelho.pronto && !m.espelho.lendo; }, null, { timeout: 30000 });
  await p.waitForTimeout(800);
  await p.click('details.sino summary');
  await p.waitForSelector('.notif-lista a', { timeout: 10000 });
  await foto(p, 'notices-bell', null, { clip: { x: 640, y: 0, width: 640, height: 460 } });
  await p.goto(BASE + '#/conta/perfil');
  await p.reload();
  await p.waitForSelector('input[data-acao="of-pref-email"][data-categoria="daily"]', { timeout: 30000 });
  await p.waitForTimeout(600);
  await foto(p, 'notices-email-preferences', 'section.cartao:has(input[data-acao="of-pref-email"])');
  await ctx.close();
}

console.log('Conta suspensa');
{
  const { ctx, p } = await como(pessoas.june, 1280, 520);
  await p.goto(BASE + '#/conta');
  await p.waitForSelector('.aviso-plano', { timeout: 30000 });
  await p.waitForTimeout(400);
  await foto(p, 'platform-suspended-banner', null, { clip: { x: 0, y: 0, width: 1280, height: 330 } });
  await ctx.close();
}

console.log('O e-mail de avisos');
{
  const msg = modelos.montarAvisos({ user_id: 'x', email: 'marcus@ridgeline.example.com', nome: 'Marcus Reed', idioma: IDIOMA, avisos: [
    { id: 1, categoria: 'daily', titulo: '', chave: 'RDO nº {numero} de {obra} aguardando aprovação', dados: { numero: 14, obra: 'Harbor Residence' }, texto: null, link: '#/daily/painel', criado_em: new Date().toISOString() },
    { id: 2, categoria: 'concorrencia', titulo: '', chave: 'Convite para cotar: {servico} · {nome}', dados: { servico: 'Siding', nome: 'Northfield Builders' }, texto: null, link: '#/daily/concorrencias', criado_em: new Date().toISOString() },
  ] }, 'https://app.example.com/');
  const ctx = await browser.newContext({ viewport: { width: 700, height: 300 }, deviceScaleFactor: 1.25 });
  await ctx.route(/fonts\./, (r) => r.abort());
  const p = await ctx.newPage();
  await p.setContent(msg.html, { waitUntil: 'load' });
  await p.waitForTimeout(300);
  await p.screenshot({ path: PASTA + 'notices-email.png', fullPage: true }); feitas++; console.log('  notices-email');
  await ctx.close();
}
await browser.close();
console.log(feitas + ' capturas em ' + PASTA);
