/* KORbuild — teste da conta de verdade (página oficial, sem "?demo") contra o Supabase (docs/banco.md, fatia 1).
 * Roda na máquina que alcança o Supabase (a sessão local), com SUPABASE_ACCESS_TOKEN definido.
 * Uso: suba um servidor na pasta do projeto (python3 -m http.server 8123) e rode
 *   node tests/conta.test.mjs [http://localhost:8123/]
 * Cria dois usuários de teste JÁ CONFIRMADOS pela API de administração do Auth (nenhum e-mail sai), percorre as telas
 * e no fim apaga as empresas e os usuários de teste. A chave de serviço é lida da API de gerenciamento só em memória:
 * nunca é gravada nem impressa. */

import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://localhost:8123/';
const REF = process.env.SUPABASE_PROJECT_REF || 'gbdmtgephszxhaprpiss';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
if (!TOKEN) { console.error('Defina SUPABASE_ACCESS_TOKEN.'); process.exit(1); }
const URL_SB = 'https://' + REF + '.supabase.co';
const SENHA = 'Teste-e2e-1234';
const ANA = 'kb-e2e-ana@example.com', BETO = 'kb-e2e-beto@example.com';

let falhas = 0, passos = 0;
function verificar(cond, texto) { passos++; if (cond) console.log('  ok  ' + texto); else { falhas++; console.log('FALHA ' + texto); } }

async function sql(query) {
  const r = await fetch('https://api.supabase.com/v1/projects/' + REF + '/database/query', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const t = await r.text();
  if (!r.ok) throw new Error('SQL ' + r.status + ': ' + t.slice(0, 300));
  return JSON.parse(t);
}
const chaves = await (await fetch('https://api.supabase.com/v1/projects/' + REF + '/api-keys?reveal=true', { headers: { Authorization: 'Bearer ' + TOKEN } })).json();
const SERVICO = (chaves.find((k) => k.name === 'service_role') || {}).api_key;
if (!SERVICO) { console.error('Não foi possível obter a chave de serviço pela API de gerenciamento.'); process.exit(1); }
const admin = (caminho, metodo, corpo) => fetch(URL_SB + '/auth/v1/admin/' + caminho, { method: metodo, headers: { apikey: SERVICO, Authorization: 'Bearer ' + SERVICO, 'Content-Type': 'application/json' }, body: corpo ? JSON.stringify(corpo) : undefined });

async function limpar() {
  await sql(`delete from public.empresas where id in (select m.empresa_id from public.membros m join auth.users u on u.id = m.user_id where u.email like 'kb-e2e-%@example.com')`);
  for (const u of await sql(`select id from auth.users where email like 'kb-e2e-%@example.com'`)) await admin('users/' + u.id, 'DELETE');
}
async function criarUsuario(email, nome) {
  const r = await admin('users', 'POST', { email, password: SENHA, email_confirm: true, user_metadata: { nome } });
  if (!r.ok) throw new Error('criar usuário ' + email + ': ' + r.status + ' ' + (await r.text()));
}

await limpar();
await criarUsuario(ANA, 'Ana E2E');
await criarUsuario(BETO, 'Beto E2E');

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const erros = [];
async function pagina() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
  await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); } catch { /* */ } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => erros.push(e.message));
  return p;
}
const esperar = (p, ms = 1200) => p.waitForTimeout(ms);
async function entrarComo(p, email) {
  await p.goto(BASE + '#/entrar'); await p.waitForSelector('#form-login-oficial', { timeout: 30000 });
  await p.fill('#oficial-email', email); await p.fill('#oficial-senha', SENHA);
  await p.click('#form-login-oficial button[type="submit"]'); await esperar(p, 2500);
}

try {
  console.log('Entrar e criar a empresa');
  const a = await pagina();
  await a.goto(BASE + '#/entrar'); await a.waitForSelector('#form-login-oficial', { timeout: 30000 });
  await a.fill('#oficial-email', ANA); await a.fill('#oficial-senha', 'senha-errada');
  await a.click('#form-login-oficial button[type="submit"]'); await esperar(a, 2000);
  verificar((await a.locator('#login-erro').innerText()).includes('E-mail ou senha incorretos'), 'senha errada: "E-mail ou senha incorretos."');
  await entrarComo(a, ANA);
  verificar(a.url().includes('#/nova-empresa') && (await a.locator('#ne-pessoa').inputValue()) === 'Ana E2E', 'primeiro acesso sem empresa: "Sua empresa", com o nome já preenchido');
  await a.fill('#ne-empresa', 'Construtora E2E'); await a.selectOption('#ne-atuacao', 'construtora');
  await a.click('#form-nova-empresa button[type="submit"]'); await esperar(a, 2500);
  let txt = await a.locator('body').innerText();
  verificar(a.url().includes('#/conta') && txt.includes('Construtora E2E') && txt.includes('Administrador'), 'empresa criada: a área da conta, como Administrador');
  verificar(await a.locator('.abas-segmento a', { hasText: 'Usuários' }).count() === 1 && await a.locator('.abas-segmento a', { hasText: 'Perfis de acesso' }).count() === 1, 'o Administrador vê Usuários e Perfis de acesso');

  console.log('Perfis e empresa');
  await a.goto(BASE + '#/conta/perfis'); await esperar(a);
  verificar(await a.locator('.perfil-cartao').count() === 4, 'os quatro perfis padrão');
  verificar(await a.locator('.perfil-cartao').first().locator('input[name="perm"]:disabled').count() > 0, 'o Administrador é travado (caixas desabilitadas)');
  await a.fill('#np-nome', 'Encarregado com diário'); await a.selectOption('#np-base', { label: 'Encarregado' });
  await a.click('[data-acao="of-novo-perfil"]'); await esperar(a, 2000);
  verificar(await a.locator('.perfil-cartao').count() === 5, 'perfil novo a partir do Encarregado');
  await a.goto(BASE + '#/conta/empresa'); await esperar(a);
  await a.fill('#em-telefone', '(603) 555-0199'); await a.click('[data-acao="of-salvar-empresa"]'); await esperar(a, 2000);
  verificar((await sql(`select telefone from public.empresas where nome = 'Construtora E2E'`))[0].telefone === '(603) 555-0199', 'dados da empresa salvos no banco');

  console.log('Convidar e aceitar');
  await a.goto(BASE + '#/conta/usuarios'); await esperar(a);
  await a.fill('#cv-email', BETO); await a.fill('#cv-nome', 'Beto E2E'); await a.selectOption('#cv-perfil', { label: 'Gestor de obras' });
  await a.click('[data-acao="of-convidar"]'); await esperar(a, 2500);
  const link = await a.locator('.oficial-link').inputValue();
  verificar(link.includes('#/aceitar/') && (await a.locator('body').innerText()).includes(BETO), 'convite gerado: o link e o convite pendente');
  const b = await pagina();
  await b.goto(link); await esperar(b, 2000);
  verificar((await b.locator('h2').first().innerText()).includes('Você foi convidado'), 'o link, sem login: "Você foi convidado"');
  await entrarComo(b, BETO);
  verificar((await b.locator('body').innerText()).includes('Aceitar o convite'), 'depois de entrar, o convite guardado aparece para aceitar');
  await b.click('[data-acao="of-aceitar"]'); await esperar(b, 2500);
  txt = await b.locator('body').innerText();
  verificar(txt.includes('Construtora E2E') && txt.includes('Gestor de obras'), 'Beto entra na empresa como Gestor de obras');
  verificar(await b.locator('.abas-segmento a', { hasText: 'Usuários' }).count() === 0, 'o Gestor não vê Usuários nem Perfis');
  await b.goto(BASE + '#/conta/usuarios'); await esperar(b);
  verificar(!b.url().includes('usuarios'), 'nem digitando o endereço');
  await b.goto(BASE + '#/conta/empresa'); await esperar(b);
  verificar(await b.locator('#em-nome[readonly]').count() === 1, 'a empresa é só para consulta para o Gestor');

  console.log('Regras de acesso');
  await a.goto(BASE + '#/conta/usuarios'); await esperar(a);
  verificar(await a.locator('select[data-acao-mudar="of-perfil-membro"]').count() === 1, 'o Administrador não tem a lista para mudar o próprio perfil');
  await a.selectOption('select[data-acao-mudar="of-perfil-membro"]', { label: 'Trabalhador' }); await esperar(a, 2000);
  verificar((await sql(`select pa.chave from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id join auth.users u on u.id = m.user_id where u.email = '${BETO}'`))[0].chave === 'trabalhador', 'perfil do Beto trocado para Trabalhador');
  a.on('dialog', (d) => d.accept());
  await a.click('[data-acao="of-ativar"]');
  const dlg = a.locator('dialog[open] button', { hasText: 'Desativar' });
  if (await dlg.count()) await dlg.click();
  await esperar(a, 2000);
  verificar((await sql(`select ativo from public.membros m join auth.users u on u.id = m.user_id where u.email = '${BETO}'`))[0].ativo === false, 'Beto desativado');
  await b.goto(BASE + '#/conta'); await b.reload(); await esperar(b, 2500);
  verificar((await b.locator('body').innerText()).includes('Seu acesso foi desativado'), 'Beto, desativado, vê "Seu acesso foi desativado"');
  const aud = await sql(`select count(*)::int as n from public.auditoria where empresa_id = (select id from public.empresas where nome = 'Construtora E2E')`);
  verificar(aud[0].n >= 5, 'tudo ficou na auditoria da empresa (' + aud[0].n + ' registros)');

  console.log('Sair');
  await a.click('[data-acao="of-sair"]'); await esperar(a, 1500);
  verificar(a.url().includes('#/entrar'), 'sair volta para a entrada');
  verificar(erros.length === 0, 'sem erros na página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close();
  await limpar();
  const sobrou = await sql(`select count(*)::int as n from auth.users where email like 'kb-e2e-%@example.com'`);
  verificar(sobrou[0].n === 0, 'limpeza: nenhum usuário de teste ficou no banco');
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
