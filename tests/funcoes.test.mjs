/* KORbuild — Funções com valor hora padrão (protótipo, docs/funcoes.md): Settings › Funções (lista, nova, valor com vigência, inativar),
 * item de mão de obra ligado à função (preço vem da função + encargos), funcionário escolhe a função.
 * Uso: python3 -m http.server 8123 &  →  node tests/funcoes.test.mjs [http://localhost:8123/] */

import { chromium } from 'playwright';

const BASE = (process.argv.slice(2).find((a) => a.startsWith('http')) || 'http://localhost:8123/').replace(/\/?$/, '/') + '?demo';
let falhas = 0, passos = 0;
function verificar(cond, texto, detalhe) {
  passos++;
  if (cond) console.log('  ok  ' + texto);
  else { falhas++; console.log('FALHA ' + texto + (detalhe !== undefined ? '\n      encontrado: ' + (typeof detalhe === 'string' ? detalhe : JSON.stringify(detalhe).slice(0, 400)) : '')); }
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await ctx.addInitScript(() => { try { localStorage.setItem('kbt.idioma', 'pt'); localStorage.setItem('kbt.versao', 'primeira'); } catch { /* */ } });
await ctx.route(/fonts\.|tile\.openstreetmap|open-meteo/, (r) => r.abort());
const p = await ctx.newPage();
const erros = [];
p.on('pageerror', (e) => { if (!/localStorage/.test(e.message)) erros.push(e.message); });
await p.goto(BASE);
await p.waitForSelector('#form-login', { timeout: 30000 });
await p.evaluate(() => localStorage.setItem('kbt.sessao', 'u-tom'));
const ir = async (rota, espera) => { await p.goto('about:blank'); await p.goto(BASE + rota); await p.waitForSelector(espera, { timeout: 20000 }); await p.waitForTimeout(300); };
const texto = async (sel = 'main') => (await p.locator(sel).innerText()).replace(/\s+/g, ' ');
const toast = async () => { await p.waitForSelector('#toast.on', { timeout: 5000 }); const t = await p.textContent('#toast'); await p.evaluate(() => document.getElementById('toast').classList.remove('on')); return t; };

console.log('Settings › Funções: a lista antiga de nomes virou cadastro');
await ir('#/settings/funcoes', '.tabela-funcoes');
let t = await texto();
verificar(await p.locator('.lateral-item:has-text("Funções")').count() === 1, 'o menu do Settings tem Funções (também na 1ª versão)');
const linhas = await p.locator('.tabela-funcoes tbody tr').count();
verificar(linhas >= 10 && /Carpinteiro/.test(t) && /Eletricista/.test(t), 'as funções padrão aparecem como cadastro', linhas + ' · ' + t.slice(0, 200));
verificar((t.match(/sem valor/g) || []).length >= 10, 'sem valor hora ainda: etiqueta "sem valor"');
verificar(/Custo da hora = valor hora padrão \+ \d/.test(t), 'a dica explica custo da hora = valor + encargos', t.slice(-300));

console.log('Nova função com valor inicial; nome repetido é recusado');
await ir('#/settings/funcao/nova', '#form-funcao');
await p.fill('#fn-nome', 'Carpinteiro');
await p.click('[data-acao="settings-salvar-funcao"]');
verificar(/Já existe uma função/.test(await toast()), 'nome repetido (mesmo com outra caixa) é recusado');
await p.fill('#fn-nome', 'Instalador de drywall');
await p.fill('#fn-valor', '38');
await p.fill('#fn-desde', '2026-01-01');
await p.click('[data-acao="settings-salvar-funcao"]');
await p.waitForTimeout(500);
verificar(/#\/settings\/funcao\/fn-/.test(p.url()), 'criada: abre a página da função', p.url());
const idFuncao = p.url().split('/funcao/')[1];
t = await texto();
verificar(/Valor hora padrão\s*US\$\s*38/.test(t) && /vigente/.test(t), 'a página mostra o valor hora padrão vigente', t.slice(0, 400));
const encargos = await p.evaluate(async () => { const s = await import('/js/settings.js'); return s.encargosEm(new Date().toISOString().slice(0, 10)); });
const custoEsperado = Math.round(38 * (1 + encargos) * 100) / 100;
verificar(new RegExp('Custo da hora.*US\\$\\s*' + custoEsperado.toFixed(2).replace('.', '[.,]')).test(t), 'custo da hora = 38 × (1 + encargos ' + Math.round(encargos * 100) + '%) = ' + custoEsperado, t.slice(0, 400));

console.log('Novo valor hora com vigência (diálogo)');
await p.click('[data-acao="settings-valor-funcao"]');
await p.waitForSelector('dialog #nv-valor');
await p.fill('dialog #nv-valor', '41.5');
await p.fill('dialog #nv-desde', '2030-01-01');
await p.fill('dialog #nv-motivo', 'Reajuste futuro');
await p.click('dialog button:has-text("Registrar")');
await p.waitForTimeout(500);
t = await texto();
verificar(/41,50|41\.50/.test(t) && /futuro/.test(t) && /Reajuste futuro/.test(t) && /\+9,2\d?%|\+9\.2\d?%/.test(t), 'o histórico mostra o valor futuro, o motivo e a variação; o vigente continua 38', t.slice(0, 600));
await p.click('[data-acao="settings-valor-funcao"]');
await p.waitForSelector('dialog #nv-valor');
await p.fill('dialog #nv-valor', '40'); await p.fill('dialog #nv-desde', '2030-01-01'); await p.fill('dialog #nv-motivo', 'x');
await p.click('dialog button:has-text("Registrar")');
verificar(/Já existe um valor a partir dessa data/.test(await toast()), 'mesma data é recusada');

console.log('Item de mão de obra ligado à função: o preço vem da função');
await ir('#/measure/item/novo', '#form-item');
verificar(await p.locator('#campo-funcao').isHidden(), 'categoria Material: o campo Função fica escondido');
await p.selectOption('#it-cat', 'mao-de-obra');
await p.waitForTimeout(200);
verificar(await p.locator('#campo-funcao').isVisible(), 'categoria Mão de obra: o campo Função aparece');
verificar(await p.locator('#it-funcao option:has-text("Instalador de drywall")').count() === 1 && /38/.test(await p.locator('#it-funcao option:has-text("Instalador de drywall")').innerText()), 'a lista de funções mostra o valor hora de cada uma');
await p.fill('#it-nome', 'Hora de instalador de drywall');
await p.fill('#it-un', 'hora');
await p.selectOption('#it-funcao', idFuncao);
await p.click('[data-acao="item-salvar"]');
await p.waitForTimeout(800);
verificar(/\/item\/it-[^/]+\/prices$/.test(p.url()), 'item criado: abre a aba Preços', p.url() + ' · ' + (await p.locator('#toast').textContent().catch(() => '')));
await p.waitForSelector('main .itens-preco-grande, main .cartao .vazio', { timeout: 10000 });
t = await texto();
verificar(new RegExp('US\\$\\s*' + custoEsperado.toFixed(2).replace('.', '[.,]')).test(t) && /Função: Instalador de drywall/.test(t) && await p.locator('[data-acao="preco-novo"]').count() === 0, 'aba Preços: preço = valor da função + encargos, origem "Função: …", sem "Novo preço"', t.slice(0, 500));
const itemId = p.url().split('/item/')[1].split('/')[0];
const precoNoMotor = await p.evaluate(async (id) => { const m = await import('/js/measure.js'); const pr = await import('/js/precos.js'); const it = m.item(id); return { p: pr.precoEm(it), f: it.funcaoId }; }, itemId);
verificar(precoNoMotor.f === idFuncao && precoNoMotor.p && precoNoMotor.p.valor === custoEsperado && precoNoMotor.p.daFuncao === true, 'no motor, precoEm do item vem da função', precoNoMotor);
await ir('#/settings/funcao/' + idFuncao, '.tabela-valores');
verificar(/Hora de instalador de drywall/.test(await texto()), 'a página da função lista o item de mão de obra que aponta para ela');

console.log('Funcionário escolhe a função cadastrada; inativar tira das listas');
await ir('#/settings/funcao/' + idFuncao + '/editar', '#form-funcao');
await p.selectOption('#fn-ativa', 'false');
await p.click('[data-acao="settings-salvar-funcao"]');
await p.waitForTimeout(400);
verificar(/Função inativa/.test(await texto()), 'função inativada, histórico fica');
await ir('#/measure/item/' + itemId, '#form-item');
verificar(await p.locator('#it-funcao option:has-text("Instalador de drywall")').count() === 1, 'o item que já aponta a função inativa continua mostrando a escolha dele');
await ir('#/measure/item/novo', '#form-item');
verificar(await p.locator('#it-funcao option:has-text("Instalador de drywall")').count() === 0, 'item novo não vê a função inativa');
await ir('#/settings/funcoes', '.tabela-funcoes');
verificar(/Instalador de drywall\s*inativa/.test(await texto()), 'a lista marca a função como inativa');

verificar(erros.length === 0, 'sem erros de JavaScript' + (erros.length ? ': ' + erros.slice(0, 3).join(' | ') : ''));
await browser.close();
console.log(passos - falhas + '/' + passos + ' verificações passaram');
process.exit(falhas ? 1 : 0);
