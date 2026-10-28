/* KORbuild — cadastro de Funções (docs/funcoes.md): a função (Carpinteiro, Eletricista…) com o valor hora padrão, com vigência.
 * O orçamento (Takeoff) usa o valor da função; o custo real (Crew) usa o valor hora de cada funcionário.
 *   funcao = { id, nome, ativa, valores: [{ desde, valor, motivo, por, em }], criadoEm }
 * No protótipo os dados ficam em estado().funcoes (migrados da lista antiga settings.funcoes, que era só de nomes);
 * na conta com banco, o espelho traz funcoes + funcao_valores (migração 0023) para o mesmo lugar. As telas são compartilhadas
 * (htmlListaFuncoes, htmlFuncao, htmlFormFuncao) e cada lado liga as suas ações. */

import { novoId, hoje, esc, dataCurta, dataHora } from './util.js';
import { tr, tn } from './i18n.js';
import { estado, salvar } from './armazem.js';
import { auditar } from './settings.js';
import { dinheiro } from './crew.js';
import { icone } from './icones.js';

const r2 = (v) => Math.round(v * 100) / 100;
const chave = (nome) => String(nome || '').trim().toLowerCase();

/* As funções da empresa. No protótipo, a primeira leitura converte a lista antiga de nomes (e as funções dos funcionários) em cadastros. */
export function funcoes(dados = estado()) {
  if (!dados) return [];
  if (!Array.isArray(dados.funcoes)) {
    const nomes = new Set(((dados.settings || {}).funcoes || []).concat((dados.funcionarios || []).map((f) => f.funcao)).map((n) => String(n || '').trim()).filter(Boolean));
    dados.funcoes = [...nomes].sort((a, b) => a.localeCompare(b)).map((nome) => ({ id: novoId('fn'), nome, ativa: true, valores: [], criadoEm: Date.now() }));
    if (dados === estado() && dados.funcoes.length) salvar();
  }
  return dados.funcoes;
}
export const funcao = (id, dados) => funcoes(dados).find((f) => f.id === id) || null;
export const funcaoPorNome = (nome, dados) => funcoes(dados).find((f) => chave(f.nome) === chave(nome)) || null;
export const funcoesAtivas = (dados) => funcoes(dados).filter((f) => f.ativa !== false).sort((a, b) => a.nome.localeCompare(b.nome));

/* O valor hora que vale na data (o mais recente com "desde" até a data), ou null. */
export function valorDaFuncao(f, iso = hoje()) {
  return ((f && f.valores) || []).filter((v) => v.desde <= iso).sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : (b.em || 0) - (a.em || 0)))[0] || null;
}
/* Custo da hora para a empresa: valor hora padrão × (1 + encargos), com os encargos (fração) de quem chama. */
export function custoHoraDaFuncao(f, iso = hoje(), encargos = 0) {
  const v = valorDaFuncao(f, iso);
  return v ? r2(v.valor * (1 + (Number(encargos) || 0))) : null;
}
export const historicoDaFuncao = (f) => ((f && f.valores) || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : a.desde > b.desde ? -1 : (b.em || 0) - (a.em || 0)));

/* ---------- Gravação (protótipo) ---------- */

export function validarFuncao(dados, id, lista) {
  const nome = String(dados.nome || '').trim();
  if (nome.length < 2) return { erro: tr('Informe o nome da função.') };
  if (lista.some((f) => f.id !== id && chave(f.nome) === chave(nome))) return { erro: tr('Já existe uma função com esse nome.') };
  return { nome, ativa: dados.ativa !== false && dados.ativa !== 'false' && dados.ativa !== '' };
}
export function validarValor(dados) {
  const valor = Number(String(dados.valor == null ? '' : dados.valor).replace(',', '.'));
  if (!(valor > 0)) return { erro: tr('Informe um valor hora maior que zero.') };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dados.desde || '')) return { erro: tr('Informe a data a partir da qual vale.') };
  const motivo = String(dados.motivo || '').trim();
  if (!motivo) return { erro: tr('O motivo é obrigatório: fica no histórico.') };
  return { valor: r2(valor), desde: dados.desde, motivo };
}

export function salvarFuncao(id, dados, por = '') {
  const lista = funcoes();
  const v = validarFuncao(dados, id, lista);
  if (v.erro) return v;
  if (id) {
    const f = lista.find((x) => x.id === id);
    if (!f) return { erro: tr('Função não encontrada.') };
    const antes = f.nome + (f.ativa === false ? ' (' + tr('inativa') + ')' : '');
    Object.assign(f, { nome: v.nome, ativa: v.ativa });
    // o funcionário guarda o nome da função: renomear leva o nome junto
    for (const fun of estado().funcionarios || []) if (chave(fun.funcao) === chave(antes.replace(/ \(.*\)$/, ''))) fun.funcao = v.nome;
    auditar(tr('Funções'), tr('Função alterada: {nome}', { nome: v.nome }), antes, v.nome + (v.ativa ? '' : ' (' + tr('inativa') + ')'), '', por);
    salvar();
    return { ok: true, id };
  }
  const nova = { id: novoId('fn'), nome: v.nome, ativa: v.ativa, valores: [], criadoEm: Date.now() };
  if (dados.valor != null && String(dados.valor).trim() !== '') {
    const vv = validarValor({ valor: dados.valor, desde: dados.desde || hoje(), motivo: dados.motivo || tr('Cadastro da função') });
    if (vv.erro) return vv;
    nova.valores.push({ ...vv, por, em: Date.now() });
  }
  lista.push(nova);
  auditar(tr('Funções'), tr('Função cadastrada: {nome}', { nome: nova.nome }), '', nova.valores.length ? dinheiro(nova.valores[0].valor) + '/h' : '', '', por);
  salvar();
  return { ok: true, id: nova.id };
}

export function novoValorDaFuncao(id, dados, por = '') {
  const f = funcao(id);
  if (!f) return { erro: tr('Função não encontrada.') };
  const v = validarValor(dados);
  if (v.erro) return v;
  if ((f.valores || []).some((x) => x.desde === v.desde)) return { erro: tr('Já existe um valor a partir dessa data.') };
  const antes = valorDaFuncao(f, v.desde);
  f.valores = (f.valores || []).concat([{ ...v, por, em: Date.now() }]);
  auditar(tr('Funções'), tr('Valor hora de {nome} a partir de {data}', { nome: f.nome, data: dataCurta(v.desde) }), antes ? dinheiro(antes.valor) + '/h' : '', dinheiro(v.valor) + '/h', v.motivo, por);
  salvar();
  return { ok: true };
}

/* ---------- Telas compartilhadas (protótipo e conta com banco) ----------
 * ctx = { base: '#/settings/funcao' | '#/conta/funcoes', lista: '#/settings/funcoes' | '#/conta/funcoes', prefixo: 'settings' | 'cad',
 *         podeEditar, encargos (fração), funcionariosDe(f) → n, itensDe(f) → [{ id, nome }], dados } */

const pct = (v) => (Math.round(v * 10000) / 100).toString().replace('.', ',') + '%';
const campo = (id, rotulo, html, dica) => '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + (dica ? '<span class="mudo pequeno">' + dica + '</span>' : '') + '</div>';

export function htmlListaFuncoes(ctx) {
  const lista = funcoes(ctx.dados).slice().sort((a, b) => (a.ativa === false) - (b.ativa === false) || a.nome.localeCompare(b.nome));
  const linhas = lista.map((f) => {
    const v = valorDaFuncao(f, hoje()), custo = custoHoraDaFuncao(f, hoje(), ctx.encargos), nFun = ctx.funcionariosDe(f), itens = ctx.itensDe(f);
    return '<tr' + (f.ativa === false ? ' class="inativa"' : '') + '><td><a href="' + ctx.base + '/' + f.id + '"><b>' + esc(f.nome) + '</b></a>' + (f.ativa === false ? ' <span class="etiqueta etiqueta-neutro">' + tr('inativa') + '</span>' : '') + '</td>' +
      '<td class="num">' + (v ? '<b>' + dinheiro(v.valor) + '</b><span class="mudo pequeno bloco">' + tr('desde {data}', { data: dataCurta(v.desde) }) + '</span>' : '<span class="etiqueta etiqueta-ambar">' + tr('sem valor') + '</span>') + '</td>' +
      '<td class="num">' + (custo != null ? dinheiro(custo) : '—') + '</td>' +
      '<td class="num">' + (nFun || '—') + '</td><td class="num">' + (itens.length || '—') + '</td></tr>';
  }).join('');
  return '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-funcoes"><thead><tr><th>' + tr('Função') + '</th><th class="num">' + tr('Valor hora padrão') + '</th><th class="num">' + tr('Custo da hora') + '</th><th class="num">' + tr('Funcionários') + '</th><th class="num">' + tr('Itens de mão de obra') + '</th></tr></thead><tbody>' +
    (linhas || '<tr><td colspan="5" class="mudo">' + tr('Nenhuma função cadastrada.') + '</td></tr>') + '</tbody></table></div></section>' +
    '<p class="dica">' + tr('Custo da hora = valor hora padrão + {pct} de encargos. O orçamento (Takeoff) usa o valor da função; o custo real (Crew) usa o valor hora de cada funcionário.', { pct: pct(ctx.encargos) }) + '</p>';
}

export function htmlFuncao(ctx, f) {
  const hist = historicoDaFuncao(f), atual = valorDaFuncao(f, hoje()), custo = custoHoraDaFuncao(f, hoje(), ctx.encargos), itens = ctx.itensDe(f);
  const linhas = hist.map((x, i) => {
    const ate = i > 0 ? hist[i - 1].desde : null, ant = hist[i + 1];
    const variacao = ant && ant.valor > 0 ? (x.valor - ant.valor) / ant.valor : null;
    const vigente = atual && x.desde === atual.desde;
    return '<tr' + (vigente ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (vigente ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futuro') + '</span>' : ate ? ' <span class="mudo pequeno">→ ' + dataCurta(ate) + '</span>' : '') + '</td>' +
      '<td class="num"><b>' + dinheiro(x.valor) + '</b></td><td class="num">' + (variacao == null ? '—' : (variacao >= 0 ? '+' : '') + pct(variacao)) + '</td>' +
      '<td>' + esc(x.motivo || '') + '</td><td class="mudo pequeno">' + esc(x.por || '') + (x.em ? ' · ' + dataHora(x.em) : '') + '</td></tr>';
  }).join('');
  return '<div class="kpis kpis-3">' +
      '<div class="kpi kpi-azul"><span>' + tr('Valor hora padrão') + '</span><b>' + (atual ? dinheiro(atual.valor) : '—') + '</b></div>' +
      '<div class="kpi"><span>' + tr('Custo da hora (+{pct} encargos)', { pct: pct(ctx.encargos) }) + '</span><b>' + (custo != null ? dinheiro(custo) : '—') + '</b></div>' +
      '<div class="kpi"><span>' + tr('Funcionários com esta função') + '</span><b>' + ctx.funcionariosDe(f) + '</b></div></div>' +
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Histórico do valor hora') + '</h2>' +
      (ctx.podeEditar ? '<button type="button" class="btn btn-primario btn-pequeno" data-acao="' + ctx.prefixo + '-valor-funcao" data-id="' + f.id + '">' + icone('dinheiro', 16) + '<span>' + tr('Novo valor hora') + '</span></button>' : '') + '</div>' +
      '<p class="mudo pequeno">' + tr('Cada valor vale a partir de uma data e nunca apaga o anterior: a proposta usa o valor que vale no dia em que é emitida.') + '</p>' +
      (hist.length ? '<div class="tabela-rolagem"><table class="tabela tabela-valores"><thead><tr><th>' + tr('Vale desde') + '</th><th class="num">' + tr('Valor hora') + '</th><th class="num">' + tr('Variação') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>' + linhas + '</tbody></table></div>'
        : '<p class="vazio">' + tr('Esta função ainda não tem valor hora: os itens de mão de obra ligados a ela ficam sem preço.') + '</p>') + '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Itens de mão de obra com esta função') + '</h2>' + (itens.length
      ? '<ul class="lista-simples">' + itens.map((it) => '<li><a href="#/measure/item/' + it.id + '"><b>' + esc(it.nome) + '</b></a></li>').join('') + '</ul>'
      : '<p class="vazio">' + tr('Nenhum item de mão de obra aponta esta função. No catálogo, no item de mão de obra, escolha a função: o preço passa a vir daqui.') + '</p>') + '</section>';
}

export function htmlFormFuncao(ctx, f) {
  const v = f || { nome: '', ativa: true };
  return '<form id="form-funcao" class="form-settings" data-id="' + (f ? f.id : '') + '" data-sem-envio>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Função') + '</h2><div class="grade-campos">' +
      campo('fn-nome', tr('Nome *'), '<input type="text" id="fn-nome" name="nome" value="' + esc(v.nome) + '" placeholder="' + esc(tr('Ex.: Carpinteiro')) + '">') +
      (f ? campo('fn-ativa', tr('Situação'), '<select id="fn-ativa" name="ativa"><option value="true"' + (v.ativa !== false ? ' selected' : '') + '>' + tr('Ativa') + '</option><option value="false"' + (v.ativa === false ? ' selected' : '') + '>' + tr('Inativa') + '</option></select>', tr('Inativa some das listas; o histórico fica.')) : '') +
    '</div></section>' +
    (f ? '' : '<section class="cartao"><h2 class="cartao-titulo">' + tr('Valor hora padrão (opcional)') + '</h2><div class="grade-campos">' +
      campo('fn-valor', tr('Valor hora (US$)'), '<input type="number" id="fn-valor" name="valor" min="0.01" step="0.01" inputmode="decimal">', tr('Sem encargos: eles entram no custo da hora.')) +
      campo('fn-desde', tr('Vale a partir de'), '<input type="date" id="fn-desde" name="desde" value="' + hoje() + '">') + '</div></section>') +
    '<div class="rodape-form"><a class="btn btn-contorno" href="' + (f ? ctx.base + '/' + f.id : ctx.lista) + '">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="' + ctx.prefixo + '-salvar-funcao">' + (f ? tr('Salvar') : tr('Criar função')) + '</button></div></form>';
}

/* O diálogo de novo valor (o mesmo nos dois lados): devolve { valor, desde, motivo } ou null. */
export async function dialogoNovoValor(abrirDialogo, f) {
  const atual = valorDaFuncao(f);
  const res = await abrirDialogo({
    titulo: tr('Novo valor hora: {nome}', { nome: f.nome }),
    corpo: (atual ? '<p class="mudo pequeno">' + tr('Hoje: {valor}/h desde {data}.', { valor: dinheiro(atual.valor), data: dataCurta(atual.desde) }) + '</p>' : '') +
      '<label class="rotulo-pequeno" for="nv-valor">' + tr('Valor hora (US$)') + '</label><input type="number" id="nv-valor" name="valor" min="0.01" step="0.01" inputmode="decimal">' +
      '<label class="rotulo-pequeno" for="nv-desde">' + tr('Vale a partir de') + '</label><input type="date" id="nv-desde" name="desde" value="' + hoje() + '">' +
      '<label class="rotulo-pequeno" for="nv-motivo">' + tr('Motivo') + '</label><input type="text" id="nv-motivo" name="motivo" placeholder="' + esc(tr('Ex.: reajuste anual')) + '">',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Registrar'), valor: true, classe: 'btn-primario' }],
  });
  return res && res.valor ? res.campos : null;
}

export const textoFuncoesDoCatalogo = () => tn(funcoesAtivas().length, '{n} função', '{n} funções');
