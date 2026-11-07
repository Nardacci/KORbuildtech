/* KORbuild — guarda do padrão de telas (docs/padrao-de-telas.md): acusa quando uma tela sai do desenho e do comportamento que todas devem ter.
 * Telas de lista: um cabeçalho de página (título + botão primário do mesmo tamanho), a barra de busca, a grade em cartão, o botão da linha na última coluna,
 * a busca que só esconde linhas e a mensagem de "nada encontrado". Formulários: o erro aparece onde a pessoa está olhando (no painel ou acima dos botões), nunca só num aviso que some.
 * Uso: python3 -m http.server 8123 &  →  bash tools/supabase-local.sh  →  node tests/padrao-telas.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';
import { sql, rest, BASE, hoje, irPara, abrirComo, garantirEmpresaFluxo, criarProjetoLiberado, apagarEmpresaFluxo } from './_fluxo-dados.mjs';

let falhas = 0, total = 0;
const verificar = (c, t, d) => { total++; if (c) console.log('  ok  ' + t); else { falhas++; console.log('FALHA ' + t + (d !== undefined ? '\n      encontrado: ' + (typeof d === 'string' ? d : JSON.stringify(d)) : '')); } };

await apagarEmpresaFluxo();
const dados = await garantirEmpresaFluxo();
await criarProjetoLiberado(dados, { nome: 'Garagem Pereira', tarefas: [{ id: 'tf-1', nome: 'Demolição', quem: 'proprio', inicio: hoje(), dias: 3, pct: 0 }] });
await rest(dados.ids.admin, '/rpc/criar_funcionario', { metodo: 'POST', corpo: { p: { nome: 'Carlos Mendes', codigo: 'E-1', funcao: 'Carpenter', admissao: '2026-01-05', classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', desligamento: null, telefone: '', emergencia: '', aviso_gps_em: null, certificacoes: [] }, p_valor: 30 } });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const a = await abrirComo(browser, 'admin', { larg: 1440, alt: 900, ir: '#/conta' });
const p = a.p;

// ---------- 1. as telas de lista ----------
const LISTAS = [
  ['Settings › Usuários', '#/conta/usuarios', '.tabela-membros', true],
  ['Settings › Perfis de acesso', '#/conta/perfis', '.tabela-perfis, .grade', true],
  ['Settings › Contatos', '#/conta/contatos', '.tabela-contatos', true],
  ['Settings › Funções', '#/conta/funcoes', '.tabela-funcoes', true],
  ['Takeoff › Projetos', '#/measure', '.tabela-projetos', true],
  ['Takeoff › Itens', '#/measure/itens', '.tabela-itens', true],
  ['Takeoff › Assemblies', '#/measure/assemblies', '.mz-assemblies', true],
];
const alturas = [];
for (const [nome, hash, grade] of LISTAS) {
  console.log(nome);
  await irPara(p, hash, grade);
  await p.waitForTimeout(1500);
  const cab = p.locator('.pg-cab').first();
  verificar(await p.locator('.pg-cab').count() === 1 && await cab.locator('.pg-titulo').count() === 1, 'um cabeçalho de página com título', await p.locator('.pg-cab').count());
  const primario = cab.locator('.btn-primario').first();
  const h = await primario.count() ? Math.round((await primario.boundingBox()).height) : 0;
  alturas.push([nome, h]);
  verificar(h >= 38 && h <= 46, 'o botão primário do cabeçalho tem o tamanho padrão (' + h + ' px)', h);
  verificar(await p.locator('.pg-barra #grade-busca').count() === 1, 'a busca fica na barra padrão');
  verificar(await p.locator('.grade-cartao table.grade').count() >= 1, 'a lista é a grade em cartão');
  const linhas = await p.locator('table.grade tbody tr[data-linha]').count();
  verificar(linhas >= 1, 'as linhas são filtráveis (data-linha)', linhas);
  const semAcao = await p.locator('table.grade tbody tr[data-linha]:not([hidden])').evaluateAll((trs) => trs.filter((t) => !t.querySelector('td.acoes-linha .btn')).length);
  verificar(semAcao === 0, 'cada linha tem o botão de ação na última coluna', semAcao);
  await p.fill('#grade-busca', 'zzzz-nada-assim');
  await p.waitForTimeout(250);
  verificar(await p.locator('table.grade tbody tr[data-linha]:not([hidden])').count() === 0 && await p.locator('#grade-vazio:not([hidden])').count() === 1, 'a busca esconde as linhas e mostra "nada encontrado"');
  await p.fill('#grade-busca', '');
  await p.waitForTimeout(250);
  verificar(await p.locator('table.grade tbody tr[data-linha]:not([hidden])').count() >= 1, 'limpar a busca traz as linhas de volta');
}

// as telas que ainda não estão na 1ª versão seguem o mesmo padrão (a versão completa as mostra)
LISTAS.push(['Settings › Funcionários', '#/conta/funcionarios', '.tabela-funcionarios', true], ['Settings › Obras', '#/conta/obras', '.tabela-obras', true]);
for (const [nome, hash, grade] of LISTAS.slice(-2)) {
  console.log(nome);
  await p.goto('about:blank'); await p.goto(BASE + '?versao=completa' + hash);   // a versão completa mostra o que a 1ª versão esconde
  await p.waitForSelector(grade, { timeout: 40000 });
  await p.waitForTimeout(1500);
  const h = await p.locator('.pg-cab .btn-primario').first().evaluate((el) => Math.round(el.getBoundingClientRect().height)).catch(() => 0);
  alturas.push([nome, h]);
  verificar(await p.locator('.pg-cab').count() === 1 && h >= 38 && h <= 46, 'cabeçalho de página com o botão primário do tamanho padrão (' + h + ' px)', h);
  verificar(await p.locator('.pg-barra #grade-busca').count() === 1 && await p.locator('.grade-cartao table.grade').count() === 1, 'busca na barra padrão e grade em cartão');
  const semAcao = await p.locator('table.grade tbody tr[data-linha]').evaluateAll((trs) => trs.filter((t) => !t.querySelector('td.acoes-linha .btn')).length);
  verificar(await p.locator('table.grade tbody tr[data-linha]').count() >= 1 && semAcao === 0, 'as linhas são filtráveis e têm o botão de ação na última coluna', semAcao);
}
const hs = alturas.map((x) => x[1]);
verificar(Math.max(...hs) - Math.min(...hs) <= 1, 'o botão primário do cabeçalho tem a mesma altura em todas as telas de lista (' + alturas.length + ' telas)', alturas);
await p.goto('about:blank'); await p.goto(BASE + '?versao=completa#/conta/regras'); await p.waitForSelector('main', { timeout: 40000 }); await p.waitForTimeout(1500);
verificar(await p.locator('.pg-cab').count() === 1, 'Settings › Regras: cabeçalho de página padrão');

// ---------- 2. erro de formulário: sempre onde a pessoa olha ----------
console.log('Erros de formulário');
await irPara(p, '#/conta/contatos', '.tabela-contatos');
await p.click('[data-acao="cad-novo-contato"]');
await p.waitForSelector('dialog.painel #form-contato');
await p.click('dialog.painel [data-painel-salvar]');
await p.waitForSelector('dialog.painel .painel-erro:not([hidden])', { timeout: 10000 }).catch(() => null);
verificar(await p.locator('dialog.painel .painel-erro:not([hidden])').count() === 1, 'no painel, o erro aparece no próprio painel');
await p.click('dialog.painel [data-painel-fechar]');
await irPara(p, '#/measure/item/novo', '#it-nome');
await p.click('[data-acao="item-salvar"]');
await p.waitForSelector('.form-erro:not([hidden])', { timeout: 10000 }).catch(() => null);
verificar(await p.locator('.form-erro:not([hidden])').count() === 1 && !(await p.locator('#toast.erro.on').count()), 'na página de formulário (item), o erro aparece acima dos botões, não num aviso que some', await p.locator('.form-erro').count());
verificar((await p.locator('.form-erro').first().innerText()).length > 3, 'o erro diz o que fazer');
await irPara(p, '#/measure/projeto/novo', '#form-projeto');
await p.click('[data-acao="mz-salvar-projeto"]');
await p.waitForSelector('.form-erro:not([hidden])', { timeout: 10000 }).catch(() => null);
verificar(await p.locator('.form-erro:not([hidden])').count() === 1, 'na página de formulário (projeto), o erro aparece acima dos botões');
await p.fill('#pj-nome', 'x');
await p.waitForTimeout(200);
verificar(await p.locator('.form-erro:not([hidden])').count() === 0, 'ao voltar a digitar, o erro some');

// ---------- 3. rodapé dos formulários: Salvar sempre à direita ----------
console.log('Rodapé dos formulários');
for (const [nome, hash, esp] of [['Empresa', '#/conta/empresa', '#em-telefone'], ['Meu perfil', '#/conta/perfil', '#mp-telefone'], ['Novo item', '#/measure/item/novo', '#it-nome'], ['Novo projeto', '#/measure/projeto/novo', '#form-projeto']]) {
  await irPara(p, hash, esp); await p.waitForTimeout(800);
  const r = await p.locator('.rodape-form').first().evaluate((el) => { const b = [...el.querySelectorAll('.btn-primario')].pop(); if (!b) return null; const rb = b.getBoundingClientRect(), re = el.getBoundingClientRect(); return { direita: Math.round(re.right - rb.right) }; }).catch(() => null);
  verificar(r && r.direita <= 4, nome + ': o botão primário fica na ponta direita do rodapé', r);
}

// ---------- 4. no celular, nada passa da largura da tela ----------
console.log('Celular');
await a.ctx.close();
const c = await abrirComo(browser, 'admin', { campo: true, ir: '#/conta' });
for (const [nome, hash, grade] of LISTAS.slice(0, 7)) {   // no celular, as telas da 1ª versão
  await irPara(c.p, hash, grade); await c.p.waitForTimeout(1200);
  const w = await c.p.evaluate(() => document.documentElement.scrollWidth);
  verificar(w <= 392, nome + ' no celular: a página não passa da largura da tela (' + w + ' px)', w);
}
verificar([...a.erros, ...c.erros].length === 0, 'sem erros de JavaScript', [...a.erros, ...c.erros]);
await browser.close();
await apagarEmpresaFluxo();
console.log('\n' + (total - falhas) + '/' + total + ' verificações passaram');
process.exit(falhas ? 1 : 0);
