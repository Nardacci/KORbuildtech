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
const SENHA = 'Teste-e2e-1234', SENHA2 = 'Teste-e2e-5678';
const ANA = 'kb-e2e-ana@example.com', BETO = 'kb-e2e-beto@example.com';

let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe)) : '')); }
}

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
const ESPERA = 20000; // o banco de verdade, pela internet: espera o estado, não um tempo fixo
/* Espera um elemento; se não vier, segue (a verificação seguinte falha e mostra o que havia na tela). */
const aparecer = (p, seletor) => p.waitForSelector(seletor, { timeout: ESPERA }).catch(() => null);
const naoCarregando = (p) => p.waitForFunction(() => !document.body.innerText.includes('Carregando…') && !document.body.innerText.includes('Loading…'), null, { timeout: ESPERA }).catch(() => null);
const irPara = async (p, hash, seletor) => { await p.goto(BASE + hash); await naoCarregando(p); if (seletor) await aparecer(p, seletor); };
const tela = async (p) => p.url().replace(BASE, '') + ' | ' + (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 300);
async function entrarComo(p, email) {
  await irPara(p, '#/entrar', '#form-login-oficial');
  await p.fill('#oficial-email', email); await p.fill('#oficial-senha', SENHA);
  await p.click('#form-login-oficial button[type="submit"]');
  await p.waitForURL((u) => !String(u).includes('#/entrar'), { timeout: ESPERA }).catch(() => null);
  await naoCarregando(p);
}

try {
  console.log('Entrar e criar a empresa');
  const a = await pagina();
  await irPara(a, '#/entrar', '#form-login-oficial');
  await a.fill('#oficial-email', ANA); await a.fill('#oficial-senha', 'senha-errada');
  await a.click('#form-login-oficial button[type="submit"]');
  await a.waitForFunction(() => (document.querySelector('#login-erro') || {}).innerText, null, { timeout: ESPERA }).catch(() => null);
  const erroLogin = await a.locator('#login-erro').innerText().catch(() => '(sem #login-erro)');
  verificar(erroLogin.includes('E-mail ou senha incorretos'), 'senha errada: "E-mail ou senha incorretos."', erroLogin);
  await entrarComo(a, ANA);
  await aparecer(a, '#ne-pessoa');
  const nomeAna = await a.locator('#ne-pessoa').inputValue().catch(() => '(sem #ne-pessoa)');
  verificar(a.url().includes('#/nova-empresa') && nomeAna === 'Ana E2E', 'primeiro acesso sem empresa: "Sua empresa", com o nome já preenchido', 'nome="' + nomeAna + '" · ' + await tela(a));
  await a.fill('#ne-empresa', 'Construtora E2E'); await a.selectOption('#ne-atuacao', 'construtora');
  await a.click('#form-nova-empresa button[type="submit"]');
  await aparecer(a, '.oficial-topo');
  let txt = await a.locator('body').innerText();
  verificar(a.url().includes('#/conta') && txt.includes('Construtora E2E') && txt.includes('Administrador'), 'empresa criada: a área da conta, como Administrador', await tela(a));
  verificar(await a.locator('.abas-segmento a', { hasText: 'Usuários' }).count() === 1 && await a.locator('.abas-segmento a', { hasText: 'Perfis de acesso' }).count() === 1, 'o Administrador vê Usuários e Perfis de acesso');

  console.log('Perfis e empresa');
  await irPara(a, '#/conta/perfis', '.perfil-cartao');
  verificar(await a.locator('.perfil-cartao').count() === 4, 'os quatro perfis padrão', await a.locator('.perfil-cartao').count());
  verificar(await a.locator('.perfil-cartao').first().locator('input[name="perm"]:disabled').count() > 0, 'o Administrador é travado (caixas desabilitadas)');
  await a.fill('#np-nome', 'Encarregado com diário'); await a.selectOption('#np-base', { label: 'Encarregado' });
  await a.click('[data-acao="of-novo-perfil"]');
  await a.waitForFunction(() => document.querySelectorAll('.perfil-cartao').length === 5, null, { timeout: ESPERA }).catch(() => null);
  verificar(await a.locator('.perfil-cartao').count() === 5, 'perfil novo a partir do Encarregado', await a.locator('.perfil-cartao').count() + ' cartões · ' + await tela(a));
  await irPara(a, '#/conta/empresa', '#em-telefone');
  await a.fill('#em-telefone', '(603) 555-0199'); await a.click('[data-acao="of-salvar-empresa"]'); await esperar(a, 3000);
  verificar((await sql(`select telefone from public.empresas where nome = 'Construtora E2E'`))[0].telefone === '(603) 555-0199', 'dados da empresa salvos no banco');

  console.log('Meu perfil');
  await irPara(a, '#/conta/perfil', '#mp-nome');
  await a.fill('#mp-nome', 'Ana E2E Silva'); await a.fill('#mp-telefone', '(603) 555-0123');
  await a.click('[data-acao="of-salvar-meu-perfil"]'); await esperar(a, 3000);
  const mp = (await sql(`select m.nome, m.telefone from public.membros m join auth.users u on u.id = m.user_id where u.email = '${ANA}'`))[0] || {};
  verificar(mp.nome === 'Ana E2E Silva' && mp.telefone === '(603) 555-0123', 'meu perfil: nome e telefone salvos no banco', mp);
  await a.fill('#mp-email', ANA); await a.click('[data-acao="of-trocar-email"]'); await esperar(a, 1000);
  verificar((await a.locator('body').innerText()).includes('Este já é o seu e-mail'), 'trocar para o mesmo e-mail é recusado');
  await a.fill('#mp-senha', SENHA2); await a.fill('#mp-senha2', SENHA2);
  await a.click('[data-acao="of-trocar-senha"]'); await esperar(a, 3000);
  const b0 = await pagina();
  await irPara(b0, '#/entrar', '#form-login-oficial');
  await b0.fill('#oficial-email', ANA); await b0.fill('#oficial-senha', SENHA2);
  await b0.click('#form-login-oficial button[type="submit"]');
  await b0.waitForURL((u) => !String(u).includes('#/entrar'), { timeout: ESPERA }).catch(() => null);
  verificar(b0.url().includes('#/conta'), 'a senha nova vale para entrar', b0.url());
  await b0.close();

  console.log('Cadastros (fatia 2)');
  await irPara(a, '#/conta/contatos/novo', '#form-contato');
  await a.fill('#ct-nome', 'Granite E2E'); await a.check('input[name="papeis"][value="cliente"]');
  await a.click('[data-acao="cad-salvar-contato"]'); await esperar(a, 3000);
  verificar((await sql(`select count(*)::int n from public.contatos c join public.empresas e on e.id = c.empresa_id where e.nome = 'Construtora E2E' and c.nome = 'Granite E2E'`))[0].n === 1, 'contato gravado no banco');
  await irPara(a, '#/conta/obras/nova', '#form-obra');
  await a.fill('#ob-nome', 'Obra E2E'); await a.selectOption('#ob-contratanteId', { label: 'Granite E2E' });
  await a.fill('#ob-municipio', 'Manchester'); await a.fill('#ob-estado', 'NH'); await a.fill('#ob-lat', '42.99'); await a.fill('#ob-lon', '-71.46');
  await a.fill('#ob-inicio', '2026-10-01'); await a.fill('#ob-prazo', '2026-12-15');
  await a.click('[data-acao="cad-salvar-obra"]'); await aparecer(a, '#equipe-obra');
  verificar(a.url().includes('#/conta/obras/') && (await sql(`select count(*)::int n from public.obras where nome = 'Obra E2E'`))[0].n === 1, 'obra gravada no banco (construtora: sem responsável pelo diário)', a.url());
  await a.selectOption('#al-quem', { index: 1 }); await a.click('[data-acao="cad-alocar"]'); await esperar(a, 3000);
  verificar((await sql(`select count(*)::int n from public.alocacoes al join public.obras o on o.id = al.obra_id where o.nome = 'Obra E2E'`))[0].n === 1, 'alguém incluído na obra');
  await irPara(a, '#/conta/funcionarios/novo', '#form-func');
  await a.fill('#ff-nome', 'Carlos E2E'); await a.fill('#ff-funcao', 'Carpenter'); await a.fill('#ff-admissao', '2026-01-05'); await a.fill('#ff-valorHora', '32.5');
  await a.click('[data-acao="cad-salvar-func"]'); await aparecer(a, '#form-valor-hora');
  await a.fill('#vh-valor', '34'); await a.fill('#vh-motivo', 'Reajuste E2E'); await a.click('[data-acao="cad-valor-hora"]'); await esperar(a, 3000);
  const vals = await sql(`select v.valor::float valor, v.motivo from public.funcionario_valores v join public.funcionarios f on f.id = v.funcionario_id where f.nome = 'Carlos E2E' order by v.desde`);
  verificar(vals.length === 2 && vals[0].valor === 32.5 && vals[1].motivo === 'Reajuste E2E', 'funcionário com o valor da admissão e um reajuste', vals);
  await irPara(a, '#/conta/regras/encargos', '#form-encargos');
  await a.fill('#enc-motivo', 'Tabela E2E'); await a.click('[data-acao="cad-salvar-encargos"]'); await esperar(a, 3000);
  await irPara(a, '#/conta/regras/jornada', '#form-regra');
  await a.fill('#rg-motivo', 'Regra E2E'); await a.click('[data-acao="cad-salvar-regra"]'); await esperar(a, 3000);
  const vers = (await sql(`select (select count(*)::int from public.encargos_versoes where motivo = 'Tabela E2E') enc, (select count(*)::int from public.regras_jornada_versoes where motivo = 'Regra E2E') reg`))[0];
  verificar(vers.enc === 1 && vers.reg === 1, 'encargos e regra de jornada gravados como versões', vers);
  await irPara(a, '#/conta/obras/modelos/novo', '#form-modelo');
  await a.fill('#md-nome', 'Modelo E2E'); await a.fill('#md-linhas [name="etapaNome"]', 'Framing'); await a.fill('#md-linhas [name="etapaPct"]', '100');
  await a.click('[data-acao="cad-salvar-modelo"]'); await esperar(a, 3000);
  verificar((await sql(`select count(*)::int n from public.modelos_cronograma where nome = 'Modelo E2E'`))[0].n === 1, 'modelo de etapas gravado');

  console.log('Convidar e aceitar');
  await irPara(a, '#/conta/usuarios', '#cv-email');
  await a.fill('#cv-email', BETO); await a.fill('#cv-nome', 'Beto E2E'); await a.selectOption('#cv-perfil', { label: 'Gestor de obras' });
  await a.click('[data-acao="of-convidar"]');
  await aparecer(a, '.oficial-link');
  const link = await a.locator('.oficial-link').inputValue().catch(() => '');
  verificar(link.includes('#/aceitar/') && (await a.locator('body').innerText()).includes(BETO), 'convite gerado: o link e o convite pendente', 'link="' + link + '"');
  const b = await pagina();
  await b.goto(link); await naoCarregando(b); await aparecer(b, 'h2');
  const tituloLink = await b.locator('h2').first().innerText().catch(() => '');
  verificar(tituloLink.includes('Você foi convidado'), 'o link, sem login: "Você foi convidado"', await tela(b));
  await entrarComo(b, BETO);
  await aparecer(b, '[data-acao="of-aceitar"]');
  verificar((await b.locator('body').innerText()).includes('Aceitar o convite'), 'depois de entrar, o convite guardado aparece para aceitar', await tela(b));
  await b.click('[data-acao="of-aceitar"]');
  await aparecer(b, '.oficial-topo');
  txt = await b.locator('body').innerText();
  verificar(txt.includes('Construtora E2E') && txt.includes('Gestor de obras'), 'Beto entra na empresa como Gestor de obras', await tela(b));
  verificar(await b.locator('.abas-segmento a', { hasText: 'Usuários' }).count() === 0, 'o Gestor não vê Usuários nem Perfis');
  verificar(await b.locator('.abas-segmento a', { hasText: 'Obras' }).count() === 1 && await b.locator('.abas-segmento a', { hasText: 'Funcionários' }).count() === 0,
    'o Gestor cuida das obras, mas não dos funcionários');
  await irPara(b, '#/conta/obras', '.tabela');
  verificar((await b.locator('body').innerText()).includes('Obra E2E'), 'o Gestor vê a obra da empresa');
  await irPara(b, '#/conta/usuarios'); await esperar(b, 500);
  verificar(!b.url().includes('usuarios'), 'nem digitando o endereço', b.url());
  await irPara(b, '#/conta/empresa', '#em-nome');
  verificar(await b.locator('#em-nome[readonly]').count() === 1, 'a empresa é só para consulta para o Gestor');

  console.log('Regras de acesso');
  // o Beto entrou depois que a Ana abriu Usuários (ela ficou nessa aba depois de convidar): como quem clica nas abas,
  // passa pelo Início e volta para Usuários, que relê do banco ao abrir
  await irPara(a, '#/conta', '.oficial-topo');
  await irPara(a, '#/conta/usuarios', '.tabela-membros');
  await a.waitForFunction(() => document.querySelectorAll('.tabela-membros tbody tr').length === 2, null, { timeout: ESPERA }).catch(() => null);
  const listas = await a.locator('select[data-acao-mudar="of-perfil-membro"]').count();
  verificar(listas === 1, 'o Administrador não tem a lista para mudar o próprio perfil (só a do Beto)', listas + ' lista(s) · ' + await a.locator('.tabela-membros tbody tr').count() + ' usuário(s) na tabela');
  if (!listas) throw new Error('sem a lista de perfil do Beto: as verificações seguintes dependem dela');
  await a.selectOption('select[data-acao-mudar="of-perfil-membro"]', { label: 'Trabalhador' }); await esperar(a, 3000);
  verificar((await sql(`select pa.chave from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id join auth.users u on u.id = m.user_id where u.email = '${BETO}'`))[0].chave === 'trabalhador', 'perfil do Beto trocado para Trabalhador');
  a.on('dialog', (d) => d.accept());
  await a.click('[data-acao="of-ativar"]');
  const dlg = a.locator('dialog[open] button', { hasText: 'Desativar' });
  if (await dlg.count()) await dlg.click();
  await esperar(a, 3000);
  verificar((await sql(`select ativo from public.membros m join auth.users u on u.id = m.user_id where u.email = '${BETO}'`))[0].ativo === false, 'Beto desativado');
  await b.goto(BASE + '#/conta'); await b.reload(); await naoCarregando(b);
  await b.waitForFunction(() => document.body.innerText.includes('Seu acesso foi desativado'), null, { timeout: ESPERA }).catch(() => null);
  verificar((await b.locator('body').innerText()).includes('Seu acesso foi desativado'), 'Beto, desativado, vê "Seu acesso foi desativado"', await tela(b));
  const aud = await sql(`select count(*)::int as n from public.auditoria where empresa_id = (select id from public.empresas where nome = 'Construtora E2E')`);
  verificar(aud[0].n >= 5, 'tudo ficou na auditoria da empresa (' + aud[0].n + ' registros)');

  console.log('Sair');
  await a.click('[data-acao="of-sair"]');
  await a.waitForURL((u) => String(u).includes('#/entrar'), { timeout: ESPERA }).catch(() => null);
  verificar(a.url().includes('#/entrar'), 'sair volta para a entrada', a.url());
  verificar(erros.length === 0, 'sem erros na página' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close();
  await limpar();
  const sobrou = await sql(`select count(*)::int as n from auth.users where email like 'kb-e2e-%@example.com'`);
  verificar(sobrou[0].n === 0, 'limpeza: nenhum usuário de teste ficou no banco');
}
console.log('\n' + (passos - falhas) + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
