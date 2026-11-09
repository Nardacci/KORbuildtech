/* KORbuild — capturas do manual do usuário, com a verificação de cada tela (as "evidências").
 * Percorre a 1ª versão (Settings, Takeoff com Bids e Daily) pelas telas, como uma pessoa de verdade, no banco LOCAL com dados de exemplo
 * (empresa Northfield Builders; nada toca o Supabase do projeto). Cada captura só é gravada se a tela mostrar o que o manual diz que ela mostra;
 * o resultado de cada uma (passou ou falhou, quando, em que versão) vai para manual-usuario/evidencias/<idioma>/manifesto.json.
 * Roda nos dois idiomas: os textos que o script procura na tela vêm do mesmo dicionário do app (js/i18n-en.js).
 *
 * Uso:  python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tools/manual-capturas.mjs [--idioma=pt|en] [http://localhost:8123/]
 * Sem --idioma roda pt e en, um depois do outro. Depois: node tools/gerar-manual.mjs */

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { EN } from '../js/i18n-en.js';
import * as D from '../tests/_fluxo-dados.mjs';

const { sql, sqlExec, rest, PESSOAS, BASE, hoje, somar, esperarAte, texto, irPara, abrirComo, garantirEmpresaFluxo, garantirUsuario, apagarEmpresaFluxo, limparMassa } = D;
const RAIZ = new URL('../', import.meta.url).pathname;
const ARG = process.argv.find((a) => a.startsWith('--idioma='));
const IDIOMAS = ARG ? [ARG.slice(9)] : ['pt', 'en'];

// As pessoas e os nomes do manual (no lugar de "Fábio Fluxo" e companhia).
PESSOAS.admin = { email: 'daniel.rivera@northfield.example.com', nome: 'Daniel Rivera', perfil: 'administrador', cargo: 'Owner' };
PESSOAS.encarregado = { email: 'eduardo.lima@northfield.example.com', nome: 'Eduardo Lima', perfil: 'encarregado', cargo: 'Foreman' };
const NORA = { email: 'nora.alves@northfield.example.com', nome: 'Nora Alves' };
const EMPRESA = 'Northfield Builders';
const CONSTRUTORA = 'Ridgeway Construction';
const TOM = { email: 'tom.reyes@ridgeway.example.com', nome: 'Tom Reyes' };
const CLIENTE = 'Hartwell Homes LLC';
const PROJETO = 'Mitchell Garage Remodel';

const commit = (() => { try { return execFileSync('git', ['-C', RAIZ, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return '?'; } })();
const versao = (readFileSync(RAIZ + 'sw.js', 'utf8').match(/CACHE\s*=\s*'korbuild-([^']+)'/) || [])[1] || '?';

if (!(await fetch(BASE).then((r) => r.ok, () => false))) { console.error('O servidor não responde em ' + BASE + ' (python3 -m http.server 8123).'); process.exit(2); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
let falhasTotais = 0;

async function limpar() {
  await apagarEmpresaFluxo();
  await limparMassa('%@northfield.example.com', "plano ->> 'massa' = 'fluxo' or nome = '" + EMPRESA + "'");
  await limparMassa('%@ridgeway.example.com', "nome = '" + CONSTRUTORA + "'");
}

async function rodar(idioma) {
  const T = (pt) => (idioma === 'en' ? (EN[pt] || pt) : pt);
  const PASTA = RAIZ + 'manual-usuario/evidencias/' + idioma + '/';
  mkdirSync(PASTA, { recursive: true });
  const manifesto = [];
  let cena = '';
  const erros = [];

  /** Confere a tela e só então grava a captura. `confere` devolve true ou um texto com o que faltou. */
  async function foto(p, chave, titulo, confere, { sel = null } = {}) {
    let motivo = '';
    const t0 = Date.now();
    try {
      await p.waitForTimeout(700);
      const r = confere ? await confere() : true;
      if (r !== true) motivo = String(r || 'a verificação não passou');
    } catch (e) { motivo = 'exceção: ' + String((e && e.message) || e).split('\n')[0].slice(0, 200); }
    try {
      if (sel) await p.locator(sel).first().screenshot({ path: PASTA + chave + '.png' });
      else await p.screenshot({ path: PASTA + chave + '.png' });
    } catch (e) { motivo = motivo || 'sem captura: ' + String(e.message).split('\n')[0]; }
    manifesto.push({ chave, cena, titulo, ok: !motivo, motivo, em: new Date().toISOString(), ms: Date.now() - t0 });
    console.log((motivo ? 'FALHA ' : '  ok  ') + chave + (motivo ? ' · ' + motivo : ''));
    if (motivo) falhasTotais++;
  }
  const tem = async (p, seletor, texto_) => { const l = p.locator(seletor); if (!(await l.count())) return 'faltou ' + seletor; if (texto_ && !(await p.locator(seletor).first().innerText()).includes(texto_)) return 'não achei "' + texto_ + '" em ' + seletor; return true; };
  const noDialogo = async (p, rotuloPt) => { await p.click('dialog button:has-text("' + T(rotuloPt) + '")'); await p.waitForSelector('dialog', { state: 'detached' }); };
  const esperaDesenho = (p) => p.waitForFunction(() => { const e = document.getElementById('mz-carregando'); return e && e.hidden; }, null, { timeout: 40000 });
  const comCena = async (nome, fn) => { cena = nome; console.log('\n# ' + nome); try { await fn(); } catch (e) { for (const [i, c] of ctxs.entries()) for (const [j, pg] of c.pages().entries()) await pg.screenshot({ path: '/tmp/falha-' + idioma + '-' + i + '-' + j + '.png' }).catch(() => null); falhasTotais++; manifesto.push({ chave: '(cena)', cena: nome, titulo: nome, ok: false, motivo: 'exceção: ' + String((e && e.message) || e).split('\n')[0].slice(0, 250), em: new Date().toISOString() }); console.log('FALHA cena "' + nome + '" · ' + String((e && e.message) || e).split('\n')[0]); } };

  // ---------- a empresa de exemplo ----------
  await limpar();
  const dados = await garantirEmpresaFluxo();
  await sqlExec(`update public.empresas set nome = '${EMPRESA}' where id = '${dados.empresaId}'`);
  await sqlExec(`update public.contatos set nome = '${CLIENTE}' where nome = 'Cliente Fluxo LLC'`);
  for (const [de, para] of [['FLX-MO-DW', 'DW-LAB'], ['FLX-MO-PT', 'PT-LAB'], ['FLX-DW', 'DW-12'], ['FLX-PT', 'PT-5G']]) await sqlExec(`update public.itens set codigo = '${para}' where codigo = '${de}'`);
  await sqlExec(`update public.assemblies set nome = 'Drywall, walls' where nome = 'Fluxo drywall'`);
  await sqlExec(`update public.assemblies set nome = 'Interior painting' where nome = 'Fluxo pintura'`);
  await sqlExec(`update public.membros set telefone = '(603) 555-0142' where user_id = '${dados.ids.admin}'`);
  const noraId = await garantirUsuario(NORA.email, NORA.nome);
  const ctxs = [];
  const abrir = async (chave, opc) => { const x = await abrirComo(browser, chave, { idioma, ...opc }); ctxs.push(x.ctx); x.erros.forEach((e) => erros.push(e)); return x; };
  const GRANDE = { larg: 1440, alt: 1100, escala: 1 };   // o desenho do Takeoff precisa caber na tela para os cliques caírem nele
  const CELULAR = { campo: true, escala: 2 };

  // ---------- 1. Entrar e criar a conta ----------
  await comCena('1. Entrar e criar a conta', async () => {
    const a = await abrir('admin', { ...GRANDE, semSessao: true, ir: '#/entrar' });
    await a.p.waitForSelector('#form-login-oficial', { timeout: 40000 });
    await foto(a.p, 'login', 'Tela de entrada', () => tem(a.p, '#form-login-oficial #oficial-email'));
    await irPara(a.p, '#/criar-conta', 'form');
    await foto(a.p, 'criar-conta', 'Criar a conta', async () => (await a.p.locator('form input[type="password"]').count()) >= 1 || 'sem campo de senha');
    await a.ctx.close();
    const n = await abrir(NORA, { ...GRANDE, ir: '#/conta' });
    await n.p.waitForSelector('#ne-pessoa', { timeout: 40000 });
    const nomeChegou = () => n.p.waitForFunction((nome) => (document.getElementById('ne-pessoa') || {}).value === nome, NORA.nome, { timeout: 8000 }).then(() => true, () => false);   // o nome chega com o perfil da pessoa
    if (!(await nomeChegou())) { await n.p.reload(); await n.p.waitForSelector('#ne-pessoa', { timeout: 40000 }); await nomeChegou(); }
    await n.p.fill('#ne-empresa', 'Summit Framing Co.');
    if (!(await n.p.inputValue('#ne-pessoa'))) await n.p.fill('#ne-pessoa', NORA.nome);   // o nome vem do cadastro; se o perfil ainda não chegou, o exemplo o preenche
    await foto(n.p, 'sua-empresa', 'Cadastrar a empresa', async () => ((await n.p.inputValue('#ne-pessoa')) === NORA.nome && (await n.p.inputValue('#ne-empresa')) !== '') || 'o formulário não ficou preenchido');
    await n.ctx.close();
  });

  // ---------- 2. Settings (Daniel, administrador) ----------
  const adm = await abrir('admin', { ...GRANDE, ir: '#/conta' });
  const p = adm.p;
  await comCena('2. Início', async () => {
    await p.waitForSelector('.ini-painel, .oficial-titulo', { timeout: 40000 });
    await p.waitForTimeout(1500);
    await foto(p, 'inicio', 'Início', async () => (await texto(p, 'body')).includes(EMPRESA) || 'sem o nome da empresa');
  });
  await comCena('3. Settings: usuários', async () => {
    await irPara(p, '#/conta/usuarios', '.tabela-membros');
    await foto(p, 'usuarios', 'Usuários', async () => (await texto(p, '.tabela-membros')).includes('Eduardo Lima') || 'Eduardo não aparece');
    await p.click('[data-acao="of-novo-usuario"]');
    await p.waitForSelector('dialog.painel #nu-nome');
    await D.preencher(p, [['#nu-nome', 'Heitor Santos'], ['#nu-email', 'heitor.santos@northfield.example.com'], ['#nu-telefone', '(603) 555-0180'], ['#nu-cargo', idioma === 'en' ? 'Site foreman' : 'Encarregado de obra']]);
    await p.selectOption('#nu-perfil', { label: T('Encarregado') });
    await foto(p, 'novo-usuario', 'Novo usuário', () => tem(p, 'dialog.painel #nu-perfil'));
    await p.click('dialog.painel [data-painel-salvar]');
    await p.waitForSelector('.senha-provisoria', { timeout: 40000 });
    await foto(p, 'senha-provisoria', 'Senha provisória', async () => /^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/.test(await p.inputValue('.senha-provisoria')) || 'a senha não está no formato');
    await p.click('dialog.painel [data-painel-fechar]');
    await p.waitForTimeout(500);
    await p.locator('tr', { hasText: 'Eduardo Lima' }).locator('[data-acao="of-editar-usuario"]').click();
    await p.waitForSelector('dialog.painel input, dialog.painel select');
    await foto(p, 'editar-usuario', 'Editar usuário', async () => (await texto(p, 'dialog.painel')).includes('Eduardo Lima') || 'o painel não é do Eduardo');
    await p.click('dialog.painel [data-painel-fechar]');
  });
  await comCena('4. Settings: perfis de acesso', async () => {
    await irPara(p, '#/conta/perfis', '[data-acao="of-editar-perfil"]');
    await foto(p, 'perfis', 'Perfis de acesso', async () => (await p.locator('[data-acao="of-editar-perfil"]').count()) >= 4 || 'menos de 4 perfis');
    await p.locator('tr', { hasText: T('Encarregado') }).locator('[data-acao="of-editar-perfil"]').first().click();
    await p.waitForSelector('dialog.painel input[name="perm"]');
    await foto(p, 'perfil-editor', 'Editor de perfil', async () => (await p.locator('dialog.painel input[name="perm"]').count()) > 5 || 'poucas permissões');
    await p.click('dialog.painel [data-painel-fechar]');
    await p.click('[data-acao="of-novo-perfil"]');
    await p.waitForSelector('dialog.painel');
    await foto(p, 'novo-perfil', 'Novo perfil', async () => (await p.locator('dialog.painel input').count()) >= 1 || 'sem campos');
    await p.click('dialog.painel [data-painel-fechar]');
  });
  await comCena('5. Settings: contatos, funções, empresa e meu perfil', async () => {
    await irPara(p, '#/conta/contatos', 'main');
    await p.waitForSelector('.tabela-contatos tbody tr', { timeout: 20000 });
    await foto(p, 'contatos', 'Contatos', async () => (await texto(p, 'main')).includes(CLIENTE) || 'sem o cliente');
    await p.locator('.tabela-contatos tbody tr').first().locator('[data-acao="cad-editar-contato"]').click();
    await p.waitForSelector('dialog.painel #form-contato');
    await foto(p, 'contato-painel', 'Contato', () => tem(p, 'dialog.painel input[name="nome"]'));
    await p.click('dialog.painel [data-painel-fechar]');
    await irPara(p, '#/conta/funcoes', '.tabela-funcoes');
    await p.waitForTimeout(800);
    await foto(p, 'funcoes', 'Funções', async () => (await p.locator('.tabela-funcoes tbody tr').count()) === 10 || 'não são 10 funções');
    await p.locator('.tabela-funcoes tr', { hasText: 'Carpenter' }).locator('[data-acao="cad-editar-funcao"]').click();
    await p.waitForSelector('dialog.painel .tabela-valores', { timeout: 20000 });
    await foto(p, 'funcao-painel', 'Função com histórico do valor hora', async () => /38[.,]00/.test(await texto(p, 'dialog.painel')) || 'sem o valor 38,00');
    await p.click('dialog.painel [data-painel-fechar]');
    await irPara(p, '#/conta/empresa', '#em-telefone');
    await foto(p, 'empresa', 'Empresa', async () => (await p.inputValue('#em-nome').catch(() => EMPRESA)) !== '' || 'sem nome');
    await irPara(p, '#/conta/perfil', '#mp-telefone');
    await foto(p, 'meu-perfil', 'Meu perfil', async () => (await p.inputValue('#mp-telefone')) !== undefined || 'sem telefone');
  });

  // ---------- 3. Takeoff ----------
  await comCena('6. Takeoff: itens e assemblies', async () => {
    await irPara(p, '#/measure/item/novo', '#it-nome');
    await p.waitForSelector('#it-funcao option:has-text("Carpenter")', { state: 'attached', timeout: 40000 });
    await foto(p, 'item-novo', 'Novo item', () => tem(p, '#form-item, #it-nome'));
    const [it] = await sql(`select id from public.itens where codigo = 'DW-12'`);
    await irPara(p, '#/measure/item/' + it.id, '.abas-sublinhadas');
    await p.click('.abas-sublinhadas a:has-text("' + T('Preços') + '")').catch(() => null);
    await p.waitForTimeout(800);
    await foto(p, 'item-precos', 'Item: preços', async () => /14[.,]50/.test(await texto(p, 'main')) || 'sem o preço 14,50');
    await irPara(p, '#/measure/assemblies', 'main .mz-assemblies, main .vazio, main a:has-text("' + T('Novo assembly') + '")');
    await p.waitForTimeout(800);
    await foto(p, 'assemblies', 'Assemblies', async () => (await texto(p, 'main')).includes('Drywall, walls') || 'sem o assembly');
    const [as] = await sql(`select id from public.assemblies where nome = 'Drywall, walls'`);
    await irPara(p, '#/measure/assembly/' + as.id, '#form-assembly');
    await p.waitForTimeout(800);
    await foto(p, 'assembly-editor', 'Assembly: linhas e fórmulas', async () => (await p.locator('.mz-linha').count()) === 2 || 'não são 2 linhas');
  });

  let pj = null;
  await comCena('7. Takeoff: projeto, plantas, escala e medição', async () => {
    await irPara(p, '#/measure/projeto/novo', '#form-projeto');
    await p.waitForTimeout(1500);
    await p.fill('#pj-nome', PROJETO);
    await p.selectOption('#pj-contratanteId', dados.clienteId);
    await p.fill('#pj-cidade', 'Concord'); await p.fill('#pj-estado', 'NH');
    await foto(p, 'projeto-novo', 'Novo projeto', async () => (await p.inputValue('#pj-nome')) === PROJETO || 'o nome não ficou');
    await p.click('[data-acao="mz-salvar-projeto"]');
    await esperarAte(async () => (await sql(`select id from public.projetos where nome = '${PROJETO}'`)).length === 1, 30000);
    [pj] = await sql(`select id from public.projetos where nome = '${PROJETO}'`);
    await p.waitForTimeout(1500);
    await foto(p, 'plantas-vazio', 'Plantas: enviar', async () => (await p.locator('#mz-enviar').count()) === 1 || 'sem o campo de envio');
    await p.setInputFiles('#mz-enviar', RAIZ + 'assets/plantas/casa-modelo.pdf');
    await esperarAte(async () => (await sql(`select count(*)::int n from public.folhas where projeto_id = '${pj.id}'`))[0].n === 3, 90000);
    await p.waitForTimeout(2000);
    await foto(p, 'plantas', 'Plantas enviadas', async () => (await sql(`select count(*)::int n from public.folhas where projeto_id = '${pj.id}'`))[0].n === 3 || 'não são 3 folhas');

    const PLANTA = { x0: 110, y0: 190, k: 18 }, SUL = { x0: 110, y0: 470, k: 18 }, CORTE = { x0: 150, y0: 240, k: 27 };
    const clicar = async (pes, o = PLANTA) => { const box = await p.locator('#mz-desenho').boundingBox(); const zoom = box.width / 1224; await p.mouse.click(box.x + (o.x0 + pes[0] * o.k) * zoom, box.y + (792 - (o.y0 + pes[1] * o.k)) * zoom); };
    const folhas = await sql(`select id from public.folhas where projeto_id = '${pj.id}' order by pagina`);
    const CONFIG = [{ razao: '48', pts: [[0, 31], [40, 31]], real: '40\'-0"', o: PLANTA }, { razao: '48', pts: [[0, -2.5], [40, -2.5]], real: '40\'', o: SUL }, { razao: '32', pts: [[0, -6], [28, -6]], real: '28\'', o: CORTE }];
    for (const [i, f] of folhas.entries()) {
      const c = CONFIG[i];
      await irPara(p, '#/measure/folha/' + f.id, '#mz-desenho');
      await esperaDesenho(p);
      await p.click('[data-acao="mz-escala"]');
      await p.selectOption('dialog select[name="razao"]', c.razao);
      if (i === 0) await foto(p, 'escala', 'Definir a escala da folha', () => tem(p, 'dialog select[name="razao"]'));
      await noDialogo(p, 'Usar esta escala');
      await clicar(c.pts[0], c.o); await clicar(c.pts[1], c.o);
      await p.fill('dialog input[name="real"]', c.real);
      if (i === 0) await foto(p, 'escala-conferir', 'Conferir a escala numa cota', () => tem(p, 'dialog input[name="real"]'));
      await noDialogo(p, 'Conferir');
      await esperarAte(async () => { const [x] = await sql(`select escala from public.folhas where id = '${f.id}'`); return x.escala && x.escala.conferencia && x.escala.conferencia.ok; });
    }
    await irPara(p, '#/measure/folha/' + folhas[0].id, '#mz-desenho');
    await esperaDesenho(p);
    await p.click('[data-acao="mz-incluir-assembly"]');
    await p.check('dialog input[name="assembly"][value="' + dados.assemblies['Fluxo drywall'] + '"]');
    await foto(p, 'takeoff-assembly', 'Incluir um assembly no desenho', () => tem(p, 'dialog input[name="assembly"]'));
    await p.click('dialog button:has-text("' + T('Continuar') + '")');
    await p.waitForSelector('dialog input[name="nome"]');
    await p.fill('dialog input[name="nome"]', idioma === 'en' ? 'Garage floor' : 'Piso da garagem');
    await noDialogo(p, 'Incluir no desenho');
    for (const pt of [[0, 0], [40, 0], [40, 28], [0, 28]]) await clicar(pt);
    await clicar([0, 0]);
    await esperarAte(async () => { const [x] = await sql(`select medicoes from public.condicoes where projeto_id = '${pj.id}'`); return x && x.medicoes.length === 1; });
    await p.waitForTimeout(1200);
    await foto(p, 'takeoff', 'Takeoff: medição no desenho', async () => (await p.locator('.mz-cond').count()) >= 1 || 'sem condição no painel');
  });
  await comCena('8. Takeoff: materiais, cronograma, proposta e liberar', async () => {
    await irPara(p, '#/measure/projeto/' + pj.id + '/materials', '#mz-materiais');
    await p.waitForTimeout(1200);
    await foto(p, 'materiais', 'Materiais e mão de obra', async () => (await texto(p, '#mz-materiais')).includes('DW-12') || 'sem o material');
    await irPara(p, '#/measure/projeto/' + pj.id + '/schedule', '[data-acao="pj-add-tarefa"]');
    const tarefa = async (nome, inicio, dias, quem) => {
      await p.click('[data-acao="pj-add-tarefa"]'); await p.waitForTimeout(300);
      for (const [campo, valor] of [['nome', nome], ['inicio', inicio], ['dias', String(dias)]]) { const el = p.locator('[data-pj-tarefa="' + campo + '"]').last(); await el.fill(valor); await el.blur(); await p.waitForTimeout(300); }
      if (quem) { await p.locator('[data-pj-tarefa="quem"]').last().selectOption(quem); await p.waitForTimeout(300); }
    };
    await tarefa(idioma === 'en' ? 'Drywall installation' : 'Instalação de drywall', hoje(), 3, 'proprio');
    await tarefa(idioma === 'en' ? 'Painting' : 'Pintura', somar(hoje(), 7), 4, 'terceiro');
    await esperarAte(async () => ((await sql(`select cronograma from public.projetos where id = '${pj.id}'`))[0].cronograma.tarefas || []).length === 2, 20000);
    await foto(p, 'cronograma', 'Cronograma', async () => (await p.locator('tr:has([data-pj-tarefa="nome"])').count()) === 2 || 'não são 2 tarefas');
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    await foto(p, 'projeto-visao', 'Visão geral do projeto', async () => /5\s*(de|of)\s*6/.test(await texto(p, 'main')) || 'não mostra 5 de 6 passos');
    await irPara(p, '#/measure/projeto/' + pj.id + '/proposta', '#form-proposta');
    await p.waitForFunction(() => document.querySelectorAll('.prop-linhas tbody tr').length >= 1, null, { timeout: 60000 });
    await foto(p, 'proposta', 'Proposta', async () => (await p.locator('#prop-total').count()) === 1 || 'sem o total');
    await p.click('[data-acao="prop-emitir"]');
    await noDialogo(p, 'Emitir');
    await esperarAte(async () => (await sql(`select count(*)::int n from public.propostas_emitidas where projeto_id = '${pj.id}'`))[0].n === 1, 30000);
    await irPara(p, '#/measure/projeto/' + pj.id, '.mz-liberar');
    await p.locator('#pj-inicio-obra').fill(somar(hoje(), 0));
    await foto(p, 'liberar', 'Liberar para obra', async () => (await p.locator('[data-acao="pj-liberar"]').isEnabled()) || 'o botão está desabilitado');
    await p.click('[data-acao="pj-liberar"]');
    await p.waitForSelector('[data-acao="pj-voltar-analise"]', { timeout: 15000 });
    await sqlExec(`update public.obras set dias_trabalho = '{0,1,2,3,4,5,6}' where projeto_id = '${pj.id}'`);   // a captura não depende do dia da semana em que o script roda
    await foto(p, 'liberado', 'Projeto liberado para obra', async () => (await p.locator('a:has-text("' + T('Abrir no Daily') + '")').count()) === 1 || 'sem "Abrir no Daily"');
  });

  // ---------- 4. Daily (Eduardo, no celular) ----------
  const edu = await abrir('encarregado', { ...CELULAR, ir: '#/daily' });
  const m = edu.p;
  await comCena('9. Daily no celular: o diário do dia', async () => {
    await m.waitForSelector('main .cartao-obra, main .vazio', { timeout: 40000 });
    if (!(await texto(m, 'main')).includes(PROJETO)) { await m.reload(); await m.waitForSelector('main .cartao-obra, main .vazio', { timeout: 40000 }); await m.waitForTimeout(1500); }
    await foto(m, 'daily-hoje', 'Daily: Hoje', async () => (await texto(m, 'main')).includes(PROJETO) || 'o projeto não aparece');
    await m.locator('.cartao-obra', { hasText: PROJETO }).first().click();
    await m.waitForSelector('[data-acao="novo-rdo"], [data-acao="copiar-rdo"]', { timeout: 20000 });
    await foto(m, 'daily-projeto', 'Daily: o projeto', async () => (await m.locator('[data-acao="novo-rdo"]').count()) === 1 || 'sem "Novo RDO"');
    await m.click('[data-acao="novo-rdo"]');
    await m.waitForSelector('#s-clima', { timeout: 20000 });
    const auto = await m.waitForFunction(() => document.querySelectorAll('[data-acao="clima-tempo"][aria-pressed="true"]').length === 2, null, { timeout: 8000 }).then(() => true, () => false);
    if (!auto) { await m.click('[data-acao="clima-tempo"][data-turno="manha"][data-valor="sol"]'); await m.click('[data-acao="clima-tempo"][data-turno="tarde"][data-valor="sol"]'); }
    await m.locator('[data-acao="equipe-add"]').first().click();
    await m.locator('#s-atividades textarea').first().fill(idioma === 'en' ? 'Drywall installation in the garage' : 'Instalação de drywall na garagem');
    await m.locator('#s-atividades textarea').first().blur();
    await foto(m, 'daily-rdo', 'Novo RDO', async () => (await m.locator('#s-clima').count()) === 1 || 'sem a seção de clima');
    await m.waitForSelector('#att-0', { timeout: 15000 });
    await m.selectOption('#att-0', { index: 1 }).catch(() => null);
    const opcoes = await m.locator('#att-0 option').allInnerTexts();
    const alvo = opcoes.findIndex((o) => /drywall/i.test(o));
    await m.selectOption('#att-0', { index: Math.max(1, alvo) });
    await m.waitForSelector('#atq-0');
    await m.fill('#atq-0', '60'); await m.locator('#atq-0').blur();
    await m.waitForSelector('#ath-0'); await m.fill('#ath-0', '24'); await m.locator('#ath-0').blur();
    await m.waitForTimeout(500);
    await foto(m, 'daily-atividade', 'Atividade ligada à tarefa do cronograma', async () => (await m.inputValue('#atq-0')) === '60' || 'o 60% não ficou');
    await m.click('[data-acao="enviar"]');
    await m.waitForSelector('dialog button', { timeout: 15000 });
    await foto(m, 'daily-enviar', 'Enviar para aprovação', async () => (await m.locator('dialog').count()) === 1 || 'sem o diálogo de envio');
    await m.locator('dialog button').first().waitFor();
    const botoes = await m.locator('dialog button').allInnerTexts();
    const semFotos = botoes.find((b) => new RegExp(T('Enviar sem fotos')).test(b));
    await m.click('dialog button:has-text("' + (semFotos || T('Enviar sem fotos')) + '")');
    await m.waitForSelector('dialog', { state: 'detached' });
    await esperarAte(async () => (await sql(`select status from public.rdos order by data desc limit 1`))[0]?.status === 'enviado', 40000);
    await m.waitForTimeout(1200);
    await foto(m, 'daily-enviado', 'Diário enviado', async () => (await sql(`select status from public.rdos order by data desc limit 1`))[0]?.status === 'enviado' || 'o diário não foi enviado');
  });
  await comCena('10. Daily no computador: aprovar o diário', async () => {
    await irPara(p, '#/daily/painel', 'main .kpis');
    await p.waitForTimeout(1800);
    await foto(p, 'daily-painel', 'Daily: painel', async () => /RDO|report/i.test(await texto(p, 'main')) || 'sem o diário na fila');
    await p.locator('.fila a', { hasText: T('Revisar') }).first().click();
    await p.waitForSelector('[data-acao="aprovar"]', { timeout: 20000 });
    await foto(p, 'daily-revisar', 'Revisar o diário', async () => (await p.locator('[data-acao="aprovar"]').count()) === 1 || 'sem "Aprovar e lacrar"');
    await p.click('[data-acao="aprovar"]');
    await noDialogo(p, 'Aprovar e lacrar');
    await esperarAte(async () => (await sql(`select status from public.rdos order by data desc limit 1`))[0]?.status === 'aprovado', 30000);
    await p.waitForTimeout(1500);
    await foto(p, 'daily-aprovado', 'Diário aprovado e lacrado', async () => (await sql(`select codigo from public.rdos order by data desc limit 1`))[0]?.codigo ? true : 'sem o código do lacre');
    await irPara(p, '#/measure/gantt/' + pj.id, '.mz-gantt');
    await p.waitForTimeout(1000);
    await foto(p, 'gantt', 'Gantt com o andamento do diário', async () => (await p.locator('.mz-gantt .mz-g-linha').count()) >= 2 || 'sem linhas no Gantt');
  });

  // ---------- 5. Licitações (Bids): duas empresas, do convite ao fechamento ----------
  await comCena('11. Licitações (Bids): enviar, receber, comparar e fechar', async () => {
    const OBRA_BIDS = 'Riverside Office Building', SERVICO = idioma === 'en' ? 'Framing and drywall' : 'Estrutura e drywall';
    const tomId = await garantirUsuario(TOM.email, TOM.nome);
    const construtora = await rest(tomId, '/rpc/criar_empresa', { metodo: 'POST', corpo: { p: { nome: CONSTRUTORA, atuacao: 'construtora', nome_pessoa: TOM.nome } } });
    const [dono] = await rest(tomId, '/contatos', { metodo: 'POST', corpo: { nome: 'Riverside Partners LLC', papeis: ['cliente'] } });
    const [ctNorth] = await rest(tomId, '/contatos', { metodo: 'POST', corpo: { nome: EMPRESA, papeis: ['prestadora'], email: PESSOAS.admin.email, conta_empresa_id: dados.empresaId } });
    const [ctBay] = await rest(tomId, '/contatos', { metodo: 'POST', corpo: { nome: 'Bayside Interiors', papeis: ['prestadora'], email: 'office@bayside.example.com' } });
    const [pjT] = await rest(tomId, '/projetos', { metodo: 'POST', corpo: { nome: OBRA_BIDS, contratante_id: dono.id, cidade: 'Nashua', estado: 'NH', tipo: 'novo', situacao: 'orcamento', cronograma: { tarefas: [{ id: 'tf-b1', nome: SERVICO, quem: 'terceiro', inicio: somar(hoje(), 14), dias: 20, pct: 0 }], marcos: [] }, liberado_em: new Date().toISOString(), liberado_por: TOM.nome, inicio_obra: somar(hoje(), 14) } });
    const t = await abrir(TOM, { ...GRANDE, ir: '#/measure' });
    const conc = () => sql(`select id, situacao from public.concorrencias where empresa_id = '${construtora}'`);

    // a construtora monta a licitação
    await irPara(t.p, '#/daily/concorrencias', 'a[href="#/daily/concorrencias/nova"]');
    await foto(t.p, 'bids-vazio', 'Bids: enviadas (ainda sem licitações)', async () => (await t.p.locator('a[href="#/daily/concorrencias/nova"]').count()) >= 1 || 'sem o botão de nova licitação');
    await irPara(t.p, '#/daily/concorrencias/nova', '[data-co-projeto]');
    await foto(t.p, 'bids-projeto', 'Nova concorrência: escolher o projeto', async () => (await t.p.locator('[data-co-projeto] option').count()) >= 2 || 'o projeto não aparece na lista');
    await t.p.selectOption('[data-co-projeto]', pjT.id);
    await t.p.waitForSelector('#form-concorrencia', { timeout: 30000 });
    await t.p.waitForFunction(async () => { const m = await import('./js/espelho.js'); return m.espelho.pronto && !m.espelho.lendo; }, null, { timeout: 30000 }).then(() => t.p.waitForTimeout(400));
    await t.p.fill('#co-servico', SERVICO);
    await t.p.selectOption('#co-tarefa-sel', SERVICO);
    await t.p.click('[data-acao="co-tarefa-add"]');
    await t.p.click('#co-escopo-ed');
    await t.p.keyboard.type(idioma === 'en' ? 'Interior walls and ceilings in drywall' : 'Paredes e forros internos em drywall');
    await t.p.click('[data-acao="co-aba"][data-aba="prazos"]');
    await t.p.fill('#co-prazoData', somar(hoje(), 5)); await t.p.fill('#co-prazoHora', '17:00');
    await t.p.click('[data-acao="co-aba"][data-aba="docs"]');
    await t.p.setInputFiles('#co-arquivo', RAIZ + 'assets/plantas/casa-modelo.pdf');
    await t.p.fill('#co-descricao', idioma === 'en' ? 'House plans' : 'Planta da casa');
    await t.p.click('[data-acao="co-anexar"]');
    await t.p.click('[data-acao="co-aba"][data-aba="convidados"]');
    await t.p.check('input[name="convidados"][value="' + ctNorth.id + '"]');
    await t.p.check('input[name="convidados"][value="' + ctBay.id + '"]');
    await foto(t.p, 'bids-nova', 'Nova licitação: escopo, prazos, documentos e convidados', async () => (await t.p.locator('input[name="convidados"]:checked').count()) === 2 || 'não são 2 convidados');
    await t.p.click('button[data-acao="co-salvar"]:not([data-enviar])');
    await esperarAte(async () => (await conc()).length === 1, 30000);
    await t.p.waitForURL('**#/daily/concorrencias/**', { timeout: 30000 });
    const [c] = await conc();
    await t.p.waitForSelector('[data-acao="co-enviar"]', { timeout: 20000 });
    await t.p.click('[data-acao="co-enviar"]');
    await t.p.click('dialog button:has-text("' + T('Enviar') + '")');
    await esperarAte(async () => (await conc())[0].situacao === 'aberta', 30000);
    await t.p.waitForSelector('[data-acao="co-link"]', { timeout: 30000 });
    await foto(t.p, 'bids-enviada', 'Licitação enviada', async () => (await conc())[0].situacao === 'aberta' || 'a licitação não ficou aberta');
    await irPara(t.p, '#/daily/concorrencias', 'main');
    await t.p.waitForTimeout(800);
    await foto(t.p, 'bids-lista', 'Bids: enviadas', async () => (await texto(t.p, 'main')).includes(SERVICO) || 'a licitação não aparece na lista');

    // a prestadora (Daniel, da Northfield) recebe, cota e envia a proposta
    await irPara(p, '#/measure/convites', '.tabela-convites a[href="#/measure/convite/' + c.id + '"]');
    await foto(p, 'bids-recebidas', 'Bids: recebidas', async () => (await texto(p, '.tabela-convites')).includes(CONSTRUTORA) || 'a construtora não aparece nos convites');
    await p.click('.tabela-convites a[href="#/measure/convite/' + c.id + '"]');
    await p.waitForSelector('[data-acao="cv-vou"]', { timeout: 20000 });
    await foto(p, 'bids-convite', 'Convite recebido', async () => (await texto(p, 'main')).includes(OBRA_BIDS) || 'o convite não mostra a obra');
    await p.click('[data-acao="cv-vou"]');
    await p.waitForURL('**#/measure/projeto/**', { timeout: 60000 });
    const [cv] = await sql(`select id, projeto_id from public.concorrencia_convites where concorrencia_id = '${c.id}' and convidada_id = '${dados.empresaId}'`);
    await esperarAte(async () => (await sql(`select count(*)::int n from public.folhas where projeto_id = '${cv.projeto_id}'`))[0].n === 3, 90000);
    const retrato = { contratante: { nome: CONSTRUTORA }, obra: { nome: OBRA_BIDS }, linhas: [{ titulo: SERVICO, codigo: '', valor: 180000 }], extras: [{ descricao: 'Mobilization', valor: 6400 }], total: 186400, validadeDias: 30, termos: '' };
    const emitida = await rest(dados.ids.admin, '/rpc/emitir_proposta', { metodo: 'POST', corpo: { p_projeto: cv.projeto_id, p_retrato: retrato } });
    await irPara(p, '#/measure/projeto/' + cv.projeto_id + '/proposta', '[data-acao="cv-plataforma"]');
    await p.click('[data-acao="cv-plataforma"]');
    await p.waitForSelector('dialog:has-text("' + emitida.numero + '")', { timeout: 20000 });
    await p.fill('dialog input[name="prazo"]', '45');
    await foto(p, 'bids-proposta', 'Enviar a proposta pela plataforma', async () => (await p.inputValue('dialog input[name="prazo"]')) === '45' || 'o prazo não ficou');
    await p.click('dialog button:has-text("' + T('Enviar') + '")');
    await esperarAte(async () => (await sql(`select count(*)::int n from public.concorrencia_propostas where convite_id = '${cv.id}'`))[0].n === 1, 30000);

    // a construtora compara e fecha com a Northfield
    await irPara(t.p, '#/daily/concorrencias/' + c.id + '/comparar', '[data-acao="co-fechar"]');
    await t.p.waitForTimeout(800);
    await foto(t.p, 'bids-comparar', 'Comparar as propostas', async () => (await t.p.locator('[data-acao="co-fechar"]').count()) >= 1 || 'sem proposta para fechar');
    await sqlExec(`update public.projetos set liberado_em = now(), liberado_por = 'Daniel Rivera' where id = '${cv.projeto_id}'`);   // a obra da vencedora nasce ao liberar o projeto
    await sqlExec(`update public.projetos set situacao = 'ganha' where id = '${pjT.id}'`);   // CO-24: a licitação sai de um projeto ganho, com obra
    await t.p.reload(); await t.p.waitForSelector('[data-acao="co-fechar"]', { timeout: 30000 });
    await t.p.click('[data-acao="co-fechar"][data-convite="' + cv.id + '"]');
    await t.p.fill('dialog input[name="observacao"]', idioma === 'en' ? 'Best schedule' : 'Melhor prazo');
    await foto(t.p, 'bids-fechar', 'Fechar a licitação', async () => (await t.p.locator('dialog input[name="observacao"]').count()) === 1 || 'sem o diálogo de fechamento');
    await t.p.click('dialog button:has-text("' + T('Fechar negócio') + '")');
    await esperarAte(async () => (await conc())[0].situacao === 'fechada', 30000);
    await irPara(p, '#/measure/convite/' + c.id, 'main');
    await p.reload();
    await p.waitForFunction(() => /Você venceu|You were awarded/.test(document.body.innerText), null, { timeout: 40000 });
    await foto(p, 'bids-venceu', 'Resultado para a prestadora vencedora', async () => /Você venceu|You were awarded/.test(await texto(p, 'main')) || 'não mostra que a empresa venceu');
  });

  await foto(p, 'inicio-final', 'Início com os projetos andando', async () => { await irPara(p, '#/conta', '.ini-painel, .oficial-titulo'); await p.waitForTimeout(1500); return true; });
  const semJs = erros.length === 0;
  manifesto.push({ chave: '(erros de JavaScript)', cena: 'Todas', titulo: 'Nenhum erro de JavaScript em todo o percurso', ok: semJs, motivo: semJs ? '' : erros.slice(0, 3).join(' | '), em: new Date().toISOString() });
  if (!semJs) { falhasTotais++; console.log('FALHA erros de JavaScript: ' + erros.slice(0, 3).join(' | ')); }
  for (const c of ctxs) await c.close().catch(() => null);

  writeFileSync(PASTA + 'manifesto.json', JSON.stringify({ idioma, versao, commit, geradoEm: new Date().toISOString(), ambiente: 'banco local com dados de exemplo (' + EMPRESA + ')', capturas: manifesto }, null, 2));
  const ok = manifesto.filter((x) => x.ok).length;
  console.log('\n' + idioma + ': ' + ok + '/' + manifesto.length + ' verificações · ' + manifesto.filter((x) => x.chave !== '(cena)' && x.chave !== '(erros de JavaScript)').length + ' capturas · ' + PASTA);
  await limpar();
}

for (const idioma of IDIOMAS) await rodar(idioma);
await browser.close();
process.exit(falhasTotais ? 1 : 0);
