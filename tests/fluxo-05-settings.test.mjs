/* KORbuild — Fluxo F05: Settings, usuários, perfis de acesso, empresa e isolamento (docs/testes/fluxos/F05-settings.md).
 * Conta real, em português, só pelas telas (o banco só é lido para conferir o que a tela mostra).
 * Banco local:  python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/fluxo-05-settings.test.mjs [--relatorio] [--manter]
 * Supabase de verdade (js/config.js):  $env:SUPABASE_ACCESS_TOKEN = "sbp_…"  →  node tests/fluxo-05-settings.test.mjs --real [--relatorio]
 * Só no --real a Gabi entra pela tela de login (o banco local não tem o serviço de login: lá a sessão já vem gravada). */

import { chromium } from 'playwright';
import { criarFluxo } from './_fluxo.mjs';
import { AMBIENTE, REAL, BASE, SENHA_FLUXO, sql, sqlExec, rest, aspas, esperarAte, texto, irPara, abrirComo, preencher, garantirUsuario, garantirEmpresaFluxo, apagarEmpresaFluxo, NOME_EMPRESA } from './_fluxo-dados.mjs';

const MANTER = process.argv.includes('--manter');
const fluxo = criarFluxo({ id: 'F05', modo: AMBIENTE, roteiro: 'docs/testes/fluxos/F05-settings.md', ambiente: BASE });
const { verificar } = fluxo;
const GABI = { email: 'fluxo.gabi@example.com', nome: 'Gabi Gestora' };
const OLGA = { email: 'fluxo.olga@example.com', nome: 'Olga Outra' };
const HEITOR = { email: 'fluxo.heitor@example.com', nome: 'Heitor Novo' };

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
await apagarEmpresaFluxo();   // começa sempre do zero
const dados = await garantirEmpresaFluxo({ catalogo: false });
await garantirUsuario(GABI.email, GABI.nome);   // login confirmado, sem empresa
const idOlga = await garantirUsuario(OLGA.email, OLGA.nome);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const adm = await abrirComo(browser, 'admin');
const { p } = adm;
fluxo.pagina(p);
let gabi = null;   // a Gabi só tem aparelho depois do convite

const empresaId = dados.empresaId;
const membroDaGabi = async () => (await sql(`select m.id, m.ativo, pa.chave, pa.nome as perfil from public.membros m join public.perfis_acesso pa on pa.id = m.perfil_id join auth.users u on u.id = m.user_id where u.email = '${GABI.email}' and m.empresa_id = '${empresaId}'`))[0];
const abaVisivel = async (pagina, rotulo) => (await pagina.locator('nav a', { hasText: rotulo }).count()) > 0;

try {
  await fluxo.passo(1, async () => {
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await p.waitForSelector('.tabela-membros tbody tr', { timeout: 30000 });
    await esperarAte(async () => (await p.locator('.tabela-membros tbody tr').count()) >= 2, 20000);
    const linhas = (await texto(p, '.tabela-membros'));
    verificar(linhas.includes('Fábio Fluxo') && linhas.includes('Eduardo Encarregado'), 'a lista mostra o Fábio e o Eduardo', linhas.slice(0, 300));
    verificar(await p.locator('select[data-acao-mudar="of-perfil-membro"]').count() === 1, 'o Administrador não tem seletor para mudar o próprio perfil (só o do Eduardo)', await p.locator('select[data-acao-mudar="of-perfil-membro"]').count());
    await p.click('[data-acao="of-convidar-link"]');
    await p.waitForSelector('dialog.painel #cv-email');
    verificar(await preencher(p, [['#cv-email', GABI.email], ['#cv-nome', GABI.nome]]), 'o painel do convite guardou e-mail e nome antes de enviar');
    await p.selectOption('#cv-perfil', { label: 'Gestor de obras' });
    await p.click('dialog.painel [data-painel-salvar]');
    await p.waitForSelector('.oficial-link', { timeout: 30000 });
    const link = await p.locator('.oficial-link').inputValue();
    verificar(link.includes('#/aceitar/'), 'o convite gera o link de aceite', link.slice(0, 80));
    verificar(await esperarAte(async () => (await sql(`select count(*)::int as n from public.convites_usuario where empresa_id = '${empresaId}' and lower(email) = '${GABI.email}'`))[0].n === 1, 20000), 'no banco: um convite pendente para a Gabi');
    const [cv] = await sql(`select pa.chave from public.convites_usuario cu join public.perfis_acesso pa on pa.id = cu.perfil_id where cu.empresa_id = '${empresaId}' and lower(cu.email) = '${GABI.email}'`);
    verificar(cv && cv.chave === 'gestor', 'no banco: o convite é com o perfil Gestor de obras', cv);
    fluxo.link = link.slice(link.indexOf('#'));
  });

  await fluxo.passo(2, async () => {
    gabi = await abrirComo(browser, GABI, REAL ? { semSessao: true, ir: fluxo.link } : { ir: fluxo.link });
    fluxo.pagina(gabi.p);
    if (REAL) {
      await gabi.p.waitForSelector('h2', { timeout: 40000 });
      verificar((await gabi.p.locator('h2').first().innerText()).includes('Você foi convidado'), 'o link, sem login: "Você foi convidado"');
      await irPara(gabi.p, '#/entrar', '#form-login-oficial');
      await gabi.p.fill('#oficial-email', GABI.email); await gabi.p.fill('#oficial-senha', SENHA_FLUXO);
      await gabi.p.click('#form-login-oficial button[type="submit"]');
    }
    await gabi.p.waitForSelector('[data-acao="of-aceitar"]', { timeout: 40000 });
    verificar((await texto(gabi.p, 'body')).includes('Aceitar o convite'), 'o convite guardado aparece com "Aceitar o convite"', (await texto(gabi.p, 'body')).slice(0, 200));
  });

  await fluxo.passo(3, async () => {
    await gabi.p.click('[data-acao="of-aceitar"]');
    await gabi.p.waitForSelector('.oficial-topo', { timeout: 40000 });
    const t = await texto(gabi.p, 'body');
    verificar(t.includes(NOME_EMPRESA) && t.includes('Gestor de obras'), 'a Gabi entra na empresa como Gestor de obras', t.slice(0, 300));
    verificar(!(await abaVisivel(gabi.p, 'Usuários')) && !(await abaVisivel(gabi.p, 'Perfis de acesso')), 'o Gestor não vê Usuários nem Perfis de acesso');
    await gabi.p.goto(BASE + '#/conta/usuarios'); await gabi.p.waitForTimeout(1500);
    verificar(!gabi.p.url().includes('usuarios'), 'nem digitando o endereço de Usuários', gabi.p.url());
    await irPara(gabi.p, '#/conta/empresa', '#em-nome');
    verificar(await gabi.p.locator('#em-nome[readonly]').count() === 1, 'a Empresa é só para consulta para o Gestor');
    const m = await membroDaGabi();
    verificar(m && m.ativo === true && m.chave === 'gestor', 'no banco: a Gabi é membro ativo com o perfil Gestor', m);
  });

  await fluxo.passo(4, async () => {
    await irPara(p, '#/conta/perfis', '.perfil-cartao');
    await esperarAte(async () => (await p.locator('.perfil-cartao').count()) === 4, 20000);
    verificar(await p.locator('.perfil-cartao').count() === 4, 'os quatro perfis padrão', await p.locator('.perfil-cartao').count());
    await p.click('[data-acao="of-novo-perfil"]');
    await p.waitForSelector('dialog.painel #np-nome');
    verificar(await preencher(p, [['#np-nome', 'Encarregado com diário']]), 'o painel guardou o nome do perfil novo antes de criar');
    await p.selectOption('#np-base', { label: 'Encarregado' });
    await p.click('dialog.painel [data-painel-salvar]');
    verificar(await esperarAte(async () => (await p.locator('.perfil-cartao').count()) === 5, 25000), 'o perfil novo aparece: cinco perfis', await p.locator('.perfil-cartao').count());
    await p.waitForSelector('dialog.painel #pf-nome', { timeout: 15000 });   // depois de criar, o editor de permissões do perfil novo abre sozinho
    verificar(await p.inputValue('dialog.painel #pf-nome') === 'Encarregado com diário', 'o editor do perfil novo abre para ajustar as permissões');
    await p.click('dialog.painel [data-painel-fechar]');
    await p.waitForSelector('dialog.painel', { state: 'detached' });
    await p.locator('.perfil-cartao').first().locator('[data-acao="of-editar-perfil"]').click();
    await p.waitForSelector('dialog.painel input[name="perm"]');
    verificar(await p.locator('dialog.painel input[name="perm"]:disabled').count() > 0, 'o Administrador continua travado (caixas desabilitadas)');
    await p.click('dialog.painel [data-painel-fechar]');
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await p.click('[data-acao="of-convidar-link"]');
    await p.waitForSelector('dialog.painel #cv-perfil');
    verificar(await p.locator('#cv-perfil option', { hasText: 'Encarregado com diário' }).count() === 1, 'o perfil novo aparece na lista de perfis do convite');
  });

  await fluxo.passo(5, async () => {
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await esperarAte(async () => (await p.locator('.tabela-membros tbody tr').count()) === 3, 25000);
    const seletor = p.locator('.tabela-membros tr', { hasText: GABI.nome }).locator('select[data-acao-mudar="of-perfil-membro"]');
    verificar(await esperarAte(async () => (await seletor.count()) === 1, 20000), 'a lista tem o seletor de perfil da Gabi', await p.locator('.tabela-membros tbody tr').count() + ' linhas');
    await seletor.selectOption({ label: 'Trabalhador' });
    verificar(await esperarAte(async () => { const m = await membroDaGabi(); return m && m.chave === 'trabalhador'; }, 25000), 'no banco: o perfil da Gabi virou Trabalhador', await membroDaGabi());
    p.on('dialog', (d) => d.accept());
    await p.locator('.tabela-membros tr', { hasText: GABI.nome }).locator('[data-acao="of-ativar"]').click();
    const dlg = p.locator('dialog[open] button', { hasText: 'Desativar' });
    if (await dlg.count()) await dlg.click();
    verificar(await esperarAte(async () => { const m = await membroDaGabi(); return m && m.ativo === false; }, 25000), 'no banco: a Gabi foi desativada', await membroDaGabi());
    await gabi.p.goto(BASE + '#/conta'); await gabi.p.reload();
    await gabi.p.waitForFunction(() => document.body.innerText.includes('Seu acesso foi desativado'), null, { timeout: 40000 }).catch(() => null);
    verificar((await texto(gabi.p, 'body')).includes('Seu acesso foi desativado'), 'a Gabi, desativada, vê "Seu acesso foi desativado"', (await texto(gabi.p, 'body')).slice(0, 200));
  });

  await fluxo.passo(6, async () => {
    await irPara(p, '#/conta/empresa', '#em-telefone');
    verificar(await preencher(p, [['#em-telefone', '(603) 555-0199']]), 'o formulário da empresa guardou o telefone antes de salvar');
    await p.click('[data-acao="of-salvar-empresa"]');
    verificar(await esperarAte(async () => (await sql(`select telefone from public.empresas where id = '${empresaId}'`))[0].telefone === '(603) 555-0199', 25000), 'no banco: o telefone da empresa foi salvo');
    await irPara(p, '#/conta/perfil', '#mp-telefone');
    verificar(await preencher(p, [['#mp-telefone', '(603) 555-0123']]), 'o formulário do perfil guardou o telefone antes de salvar');
    await p.click('[data-acao="of-salvar-meu-perfil"]');
    verificar(await esperarAte(async () => (await sql(`select m.telefone from public.membros m join auth.users u on u.id = m.user_id where u.email = 'fluxo.admin@example.com' and m.empresa_id = '${empresaId}'`))[0].telefone === '(603) 555-0123', 25000), 'no banco: o telefone do perfil do Fábio foi salvo');
  });

  await fluxo.passo(7, async () => {
    const olga = await rest(idOlga, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: 'Fluxo Outra Ltda', atuacao: 'construtora' } } });
    await sqlExec(`update public.empresas set plano = plano || '{"demo": true, "massa": "fluxo"}'::jsonb where id = '${olga}'`);   // marca para a limpeza
    await rest(idOlga, '/contatos', { metodo: 'POST', corpo: { nome: 'Contato da Olga', papeis: ['cliente'] } });
    const membros = await rest(idOlga, '/membros?select=id,empresa_id');
    verificar(membros.length === 1 && membros.every((x) => x.empresa_id === olga), 'a Olga só enxerga os membros da empresa dela', membros);
    const contatos = await rest(idOlga, '/contatos?select=nome');
    verificar(contatos.length === 1 && contatos[0].nome === 'Contato da Olga', 'a Olga só enxerga os contatos dela', contatos);
    const convites = await rest(idOlga, '/convites_usuario?select=id');
    verificar(convites.length === 0, 'a Olga não enxerga os convites da empresa dos fluxos', convites);
    const perfis = await rest(idOlga, '/perfis_acesso?select=id,nome,empresa_id');
    verificar(perfis.length > 0 && perfis.every((x) => x.empresa_id === olga) && !perfis.some((x) => x.nome === 'Encarregado com diário'), 'a Olga não enxerga os perfis da empresa dos fluxos (nem o perfil novo)', perfis.map((x) => x.nome));
  });

  await fluxo.passo(8, async () => {
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await p.click('[data-acao="of-novo-usuario"]');
    await p.waitForSelector('dialog.painel #nu-nome');
    verificar(await preencher(p, [['#nu-nome', HEITOR.nome], ['#nu-email', HEITOR.email], ['#nu-telefone', '(603) 555-0180'], ['#nu-cargo', 'Encarregado de obra']]), 'o painel guardou os dados do usuário novo antes de criar');
    await p.selectOption('#nu-perfil', { label: 'Encarregado' });
    await p.click('dialog.painel [data-painel-salvar]');
    await p.waitForSelector('.senha-provisoria', { timeout: 40000 });
    const senha = await p.inputValue('.senha-provisoria');
    verificar(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(senha), 'a senha provisória aparece uma vez, em três grupos de quatro, sem caracteres que se confundem', senha.replace(/./g, '*'));
    verificar(await p.locator('dialog.painel', { hasText: HEITOR.email }).count() === 1 && /só agora/.test(await texto(p, 'dialog.painel')), 'o painel mostra o e-mail e avisa que a senha aparece só agora');
    await p.click('dialog.painel [data-acao="of-copiar-texto"]');
    await p.waitForFunction(() => /Copiado|Selecione o texto/.test((document.getElementById('toast') || {}).textContent || ''), null, { timeout: 5000 }).catch(() => null);
    verificar(/Copiado|Selecione o texto/.test(await texto(p, '#toast')), 'o botão "Copiar endereço, e-mail e senha" funciona dentro do painel', await texto(p, '#toast'));
    await p.click('dialog.painel [data-painel-fechar]');
    const [m] = await sql(`select m.id, m.cargo, m.telefone, m.ativo, pa.chave from public.membros m join auth.users u on u.id = m.user_id join public.perfis_acesso pa on pa.id = m.perfil_id where u.email = '${HEITOR.email}' and m.empresa_id = '${empresaId}'`);
    verificar(m && m.ativo && m.chave === 'encarregado' && m.cargo === 'Encarregado de obra' && m.telefone === '(603) 555-0180', 'no banco: membro ativo com o perfil Encarregado, cargo e telefone', m);
    const [aud] = await sql(`select a.quem, a.motivo from public.auditoria a where a.tabela = 'membros' and a.acao = 'insert' and a.registro = '${m.id}'`);
    const [fab] = await sql(`select id from auth.users where email = 'fluxo.admin@example.com'`);
    verificar(aud && aud.quem === fab.id && /Cadastro direto/.test(aud.motivo || ''), 'a auditoria atribui o cadastro ao Fábio (e não à função do servidor)', aud);
    // o mesmo e-mail de novo: o painel recusa, sem criar nada
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await p.click('[data-acao="of-novo-usuario"]');
    await p.waitForSelector('dialog.painel #nu-nome');
    await preencher(p, [['#nu-nome', 'Outro Nome'], ['#nu-email', HEITOR.email]]);
    await p.click('dialog.painel [data-painel-salvar]');
    await p.waitForSelector('dialog.painel .painel-erro:not([hidden])', { timeout: 20000 });
    verificar(/já tem conta/.test(await texto(p, 'dialog.painel .painel-erro')), 'e-mail que já tem conta é recusado com uma mensagem clara', await texto(p, 'dialog.painel .painel-erro'));
    await p.click('dialog.painel [data-painel-fechar]');
    // nova senha provisória para a pessoa
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await p.locator('.tabela-membros tr', { hasText: HEITOR.nome }).locator('[data-acao="of-editar-usuario"]').click();
    await p.waitForSelector('dialog.painel [data-painel-extra]');
    await p.click('dialog.painel [data-painel-extra]');
    await p.click('dialog:not(.painel) button:text-is("Gerar")');
    await p.waitForSelector('.senha-provisoria', { timeout: 40000 });
    const senha2 = await p.inputValue('.senha-provisoria');
    verificar(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(senha2), 'gerar nova senha provisória mostra a senha nova uma vez');
    verificar((await sql(`select count(*)::int as n from public.auditoria where tabela = 'membros' and acao = 'senha_provisoria' and registro = '${m.id}'`))[0].n === 1, 'a auditoria registra que o Fábio gerou uma senha provisória');
    await p.click('dialog.painel [data-painel-fechar]');
    if (REAL) {   // só no Supabase de verdade há serviço de login: a pessoa entra com a senha provisória e é obrigada a trocá-la
      const hei = await abrirComo(browser, HEITOR, { semSessao: true, ir: '#/entrar' });
      fluxo.pagina(hei.p);
      await hei.p.waitForSelector('#form-login-oficial', { timeout: 40000 });
      await hei.p.fill('#oficial-email', HEITOR.email); await hei.p.fill('#oficial-senha', senha2);
      await hei.p.click('#form-login-oficial button[type="submit"]');
      await hei.p.waitForURL((u) => String(u).includes('#/nova-senha'), { timeout: 40000 });
      verificar(/senha provisória/.test(await texto(hei.p, 'body')), 'o primeiro acesso cai na troca de senha, com o aviso da senha provisória');
      const noSistema = await hei.p.goto(BASE + '#/conta').then(() => hei.p.waitForTimeout(1500)).then(() => hei.p.url());
      verificar(noSistema.includes('#/nova-senha'), 'sem trocar a senha não dá para abrir o resto do sistema', noSistema);
      await hei.p.fill('#ns-senha', 'Nova' + SENHA_FLUXO);
      await hei.p.click('#form-nova-senha button[type="submit"]');
      await hei.p.waitForSelector('.oficial-topo', { timeout: 40000 });
      verificar((await texto(hei.p, 'body')).includes(NOME_EMPRESA), 'depois de trocar a senha ele entra na empresa');
      verificar(await esperarAte(async () => (await sql(`select raw_user_meta_data ->> 'trocar_senha' as t from auth.users where email = '${HEITOR.email}'`))[0].t === 'false', 20000), 'a marca de "trocar a senha" foi limpa');
      verificar(adm.erros.length === 0 && hei.erros.length === 0, 'sem erro de JavaScript neste passo');
    }
  });

  await fluxo.passo(9, async () => {
    const [a] = await sql(`select count(*)::int as n from public.auditoria where empresa_id = '${empresaId}'`);
    verificar(a.n >= 4, 'a auditoria da empresa registra o que foi feito (' + a.n + ' registros)', a);
    const tabelas = (await sql(`select distinct tabela from public.auditoria where empresa_id = '${empresaId}'`)).map((x) => x.tabela);
    verificar(tabelas.includes('membros') && tabelas.includes('perfis_acesso'), 'a auditoria cobre membros e perfis de acesso', tabelas);
    verificar(adm.erros.length === 0 && gabi.erros.length === 0, 'nenhum erro de JavaScript em todo o fluxo' + (adm.erros.length + gabi.erros.length ? ': ' + [...adm.erros, ...gabi.erros].slice(0, 3).join(' | ') : ''));
  });
} finally {
  await browser.close();
  if (!MANTER) await apagarEmpresaFluxo();
}
const codigo = await fluxo.fim();
if (codigo) { for (const d of [...adm.ruins, ...adm.consoleErros].slice(0, 15)) console.log('      ' + d); }
process.exit(codigo);
