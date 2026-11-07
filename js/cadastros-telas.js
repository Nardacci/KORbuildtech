/* KORbuild — telas dos cadastros na página oficial (docs/banco.md, fatia 2): Obras (e modelos de etapas),
 * Funcionários (e valor hora), Contatos e Regras (encargos e jornada). Os dados vêm de js/cadastros.js.
 * Mesmas frases e classes do protótipo (js/settings-telas.js, js/obras-telas.js), para o visual e a tradução
 * serem os mesmos. O mapa da obra e as linhas dos modelos reaproveitam js/obras-telas.js (só dependem dos ids). */

import { PRIMEIRA_VERSAO } from './versao.js';
import { esc, toast, confirmar, abrirDialogo, abrirPainel, dataCurta, dataHora, decimal, numTexto, hoje } from './util.js';
import { cabecalhoDePagina, botaoCriar, barraDeBusca, atributosDeLinha, gradeEmCartao, avatar, campoPainel, lerCampos } from './padrao-cadastro.js';
import { dialogoNovoValor, valorDaFuncao, custoHoraDaFuncao, historicoDaFuncao } from './funcoes.js';
import { tr, tn } from './i18n.js';
import { icone } from './icones.js';
import { conta, pode } from './conta.js';
import { CLASSIFICACOES, FLSA, SITUACOES_FUNC, MODELOS_REGRA, ENCARGOS_INICIAIS, resumoRegra } from './settings.js';
import { PAPEIS } from './contatos.js';
import { SITUACOES_OBRA } from './obras.js';
import { estado } from './armazem.js';

/* O projeto do Measure no espelho (quando o Measure já foi aberto nesta sessão). */
const projetoDoEspelho = (id) => { try { return (((estado() || {}).measure || {}).projetos || []).find((p) => p.id === id) || null; } catch { return null; } };
import { NOMES_DIAS } from './prazos.js';
import { dinheiro } from './crew.js';
import { aposDesenharObras, aposDesenharModelo } from './obras-telas.js';
import {
  cad, carregar, jaLeu, funcionario, valoresDe, valorAtual, encargosVigentes, totalEncargos, certificacoesAVencer, vigente, historico, segundaDe,
  salvarFuncionario, novoValorHora, novosEncargos, novaRegra, contato, salvarContato, excluirContato, PAPEIS_CONTATO, funcoesCad, salvarFuncaoCad, novoValorDaFuncaoCad,
  obra, salvarObra, empresaExecuta, alocacoesDa, alocar, desalocar, RAIO_PADRAO, RAIO_MIN, RAIO_MAX, modelo, salvarModelo, excluirModelo,
} from './cadastros.js';

let redesenhar = () => {};
let ir = () => {};
export function ligarCadastros(fns) { redesenhar = fns.redesenhar; ir = fns.ir; }

/* As abas dos cadastros e a permissão de cada uma (catálogo em js/settings.js). */
export const ABAS_CADASTROS = [
  ['obras', 'Obras', 'settings.obras'],
  ['funcionarios', 'Funcionários', 'settings.funcionarios'],
  ['funcoes', 'Funções', 'settings.funcionarios'],
  ['contatos', 'Contatos', 'settings.contatos'],
  ['regras', 'Regras', 'settings.regras'],
];
const PRECISA = {
  obras: ['obras', 'contatos', 'membros', 'alocacoes', 'funcionarios', 'modelos'],
  funcionarios: ['funcionarios', 'valores', 'encargos', 'regras', 'membros', 'funcoes'],
  funcoes: ['funcoes', 'fvalores', 'encargos', 'membros', 'funcionarios', 'itens'],
  contatos: ['contatos', 'obras'],
  regras: ['encargos', 'regras', 'membros'],
};

const pct = (v, casas) => decimal(v * 100, casas == null ? 2 : casas).replace(/[.,]00$/, '') + '%';
const num = (v) => numTexto(v);
const quando = (ts) => (ts ? dataHora(new Date(ts).getTime()) : '');
const autor = (uid) => (cad.membros.find((m) => m.user_id === uid) || {}).nome || '';
const proximaSegunda = () => { const d = new Date(segundaDe(hoje()) + 'T12:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); };
const opcoes = (lista, atual) => lista.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
const campo = (id, rotulo, html, dica) => '<div class="campo"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + (dica ? '<span class="mudo pequeno">' + dica + '</span>' : '') + '</div>';
const texto = (id, nome, valor, extra) => '<input type="text" id="' + id + '" name="' + nome + '" value="' + esc(valor == null ? '' : valor) + '"' + (extra || '') + '>';
const data = (id, nome, valor) => '<input type="date" id="' + id + '" name="' + nome + '" value="' + esc(valor || '') + '">';
const etiquetaVigencia = (x, v) => (x === v ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futuro') + '</span>' : '');

function cabeca(titulo, acoes, voltar) {
  return (voltar ? '<a class="voltar" href="' + voltar[0] + '">← ' + esc(voltar[1]) + '</a>' : '') +
    cabecalhoDePagina(esc(titulo), '', acoes || '');
}

/* Devolve { html, depois } ou { trocar }. Enquanto lê do banco, "Carregando…". */
export function telaCadastro(aba, resto) {
  const precisa = PRECISA[aba];
  if (!jaLeu(precisa)) {
    carregar(precisa).then(() => redesenhar()).catch(() => toast(tr('Sem conexão com o servidor. Confira a internet e tente de novo.')));
    return { html: '<p class="vazio">' + tr('Carregando…') + '</p>' };
  }
  if (aba === 'obras') {
    if (resto[0] === 'modelos' && PRIMEIRA_VERSAO) return { trocar: '#/conta/obras' };
    if (resto[0] === 'modelos') {
      if (resto[1] && resto[1] !== 'novo' && !modelo(resto[1])) return { trocar: '#/conta/obras/modelos' };
      return { html: telaModelos(), depois: resto[1] ? () => { if (!document.querySelector('dialog.painel[open]')) painelModelo(resto[1] === 'novo' ? null : resto[1]); } : undefined };
    }
    if (resto[0] && resto[0] !== 'nova' && !obra(resto[0])) return { trocar: '#/conta/obras' };
    if (resto[0]) return { html: telaObras(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelObra(resto[0] === 'nova' ? null : resto[0], resto[0] === 'nova' ? resto[1] : null); } };
    return { html: telaObras() };
  }
  if (aba === 'funcionarios') {
    if (resto[0] === 'novo') return { html: telaFuncionarios(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelFuncionario(null); } };
    if (resto[0] && resto[0] !== 'desligados' && resto[0] !== 'todos') {
      if (!funcionario(resto[0])) return { trocar: '#/conta/funcionarios' };
      return resto[1] === 'editar' ? { html: telaFuncionario(resto[0]), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelFuncionario(resto[0]); } } : { html: telaFuncionario(resto[0]) };
    }
    return { html: telaFuncionarios() };
  }
  if (aba === 'funcoes') {
    if (resto[0] && resto[0] !== 'nova' && !funcoesCad().some((x) => x.id === resto[0])) return { trocar: '#/conta/funcoes' };
    if (resto[0]) return { html: telaFuncoesCad(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelFuncao(resto[0] === 'nova' ? null : resto[0]); } };
    return { html: telaFuncoesCad() };
  }
  if (aba === 'contatos') {
    if (resto[0] && resto[0] !== 'novo' && !contato(resto[0])) return { trocar: '#/conta/contatos' };
    if (resto[0]) return { html: telaContatos(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelContato(resto[0] === 'novo' ? null : resto[0]); } };
    return { html: telaContatos() };
  }
  if (aba === 'regras') {
    if (resto[0] === 'encargos') return { html: telaRegras(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelEncargos(); } };
    if (resto[0] === 'jornada') return { html: telaRegras(), depois: () => { if (!document.querySelector('dialog.painel[open]')) painelJornada(); } };
    return { html: telaRegras() };
  }
  return { trocar: '#/conta' };
}

/* ---------- Funções (docs/funcoes.md): grade + painel lateral; o valor hora tem vigência e nunca apaga o anterior ---------- */

const chaveFuncao = (x) => String(x || '').trim().toLowerCase();
const podeEditarFuncoes = () => pode('settings.funcionarios') || pode('measure.catalogo');
const funcionariosDaFuncao = (f) => cad.funcionarios.filter((x) => x.situacao !== 'desligado' && chaveFuncao(x.funcao) === chaveFuncao(f.nome)).length;
const itensDaFuncao = (f) => cad.itens.filter((it) => it.funcao_id === f.id && it.ativo !== false);

function telaFuncoesCad() {
  const enc = totalEncargos(encargosVigentes());
  const lista = funcoesCad().slice().sort((a, b) => (a.ativa === false) - (b.ativa === false) || a.nome.localeCompare(b.nome));
  const ativas = lista.filter((f) => f.ativa !== false).length;
  const linhas = lista.map((f) => {
    const v = valorDaFuncao(f, hoje()), custo = custoHoraDaFuncao(f, hoje(), enc), nFun = funcionariosDaFuncao(f), nItens = itensDaFuncao(f).length;
    return '<tr' + atributosDeLinha(f.nome, [f.ativa === false ? 'inativas' : 'ativas', v ? 'com-valor' : 'sem-valor']) + '><td><div class="pessoa">' + avatar(f.nome, f.ativa === false) + '<div><b>' + esc(f.nome) + '</b>' + (f.ativa === false ? ' <span class="etiqueta etiqueta-neutro">' + tr('inativa') + '</span>' : '') + '</div></div></td>' +
      '<td class="num">' + (v ? '<b>' + dinheiro(v.valor) + '</b><span class="mudo pequeno bloco">' + tr('desde {data}', { data: dataCurta(v.desde) }) + '</span>' : '<span class="etiqueta etiqueta-ambar">' + tr('sem valor') + '</span>') + '</td>' +
      '<td class="num">' + (custo != null ? dinheiro(custo) : '—') + '</td><td class="num">' + (nFun || '—') + '</td><td class="num">' + (nItens || '—') + '</td>' +
      '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-editar-funcao" data-id="' + f.id + '">' + (podeEditarFuncoes() ? tr('Editar') : tr('Ver')) + '</button></td></tr>';
  }).join('');
  return cabecalhoDePagina(tr('Funções'), tr('A função com o valor hora padrão: o orçamento do Takeoff usa; o funcionário tem o valor dele') + '. ' + tr('Custo da hora = valor hora padrão + {pct} de encargos.', { pct: pct(enc) }),
      podeEditarFuncoes() ? botaoCriar('cad-nova-funcao', tr('Nova função'), icone('mais', 16)) : '') +
    barraDeBusca(tr('Buscar função'), [['', tr('Todas'), lista.length], ['ativas', tr('Ativas'), ativas], ['inativas', tr('Inativas'), lista.length - ativas], ['sem-valor', tr('Sem valor'), lista.filter((f) => !valorDaFuncao(f, hoje())).length]]) +
    gradeEmCartao('tabela-funcoes', [tr('Função'), tr('Valor hora padrão'), tr('Custo da hora'), tr('Funcionários'), tr('Itens de mão de obra'), ''], linhas, tr('Nenhuma função cadastrada.'));
}

function painelFuncao(id) {
  const f = id ? funcoesCad().find((x) => x.id === id) : null;
  if (id && !f) return;
  const edita = podeEditarFuncoes(), enc = totalEncargos(encargosVigentes());
  const atual = f ? valorDaFuncao(f, hoje()) : null, hist = f ? historicoDaFuncao(f) : [];
  const historico = !f ? '' : '<h3 class="painel-secao">' + tr('Histórico do valor hora') + '</h3>' + (hist.length ? '<div class="tabela-rolagem"><table class="tabela tabela-valores"><thead><tr><th>' + tr('Vale desde') + '</th><th class="num">' + tr('Valor hora') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>' +
    hist.map((x) => '<tr' + (atual && x.desde === atual.desde ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (atual && x.desde === atual.desde ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futuro') + '</span>' : '') + '</td><td class="num"><b>' + dinheiro(x.valor) + '</b></td><td>' + esc(x.motivo || '') + '</td><td class="mudo pequeno">' + esc(x.por || '') + (x.em ? ' · ' + dataHora(x.em) : '') + '</td></tr>').join('') + '</tbody></table></div>'
    : '<p class="vazio">' + tr('Esta função ainda não tem valor hora: os itens de mão de obra ligados a ela ficam sem preço.') + '</p>') +
    '<p class="mudo pequeno">' + tr('Cada valor vale a partir de uma data e nunca apaga o anterior: a proposta usa o valor que vale no dia em que é emitida.') + '</p>' +
    (itensDaFuncao(f).length ? '<h3 class="painel-secao">' + tr('Itens de mão de obra com esta função') + '</h3><ul class="lista-simples">' + itensDaFuncao(f).map((it) => '<li><a href="#/measure/item/' + it.id + '"><b>' + esc(it.nome) + '</b></a></li>').join('') + '</ul>' : '');
  return abrirPainel({
    titulo: f ? f.nome : tr('Nova função'), subtitulo: f ? (atual ? dinheiro(atual.valor) + '/h · ' + tr('custo {v}/h', { v: dinheiro(custoHoraDaFuncao(f, hoje(), enc)) }) : tr('sem valor hora ainda')) : tr('Carpinteiro, Eletricista, Servente…'),
    classe: 'painel-largo', somenteLeitura: !edita, rotuloSalvar: f ? tr('Salvar') : tr('Criar função'),
    extras: f && edita ? [{ rotulo: tr('Novo valor hora'), classe: 'btn-contorno', aoClicar: async () => {
      const campos = await dialogoNovoValor(abrirDialogo, f);
      if (!campos) return null;
      const r = await novoValorDaFuncaoCad(f.id, campos);
      return r.erro ? r : { ok: true, reabrir: true };
    } }] : [],
    corpo: '<div id="form-funcao" class="painel-campos">' + campoPainel('fn-nome', tr('Nome *'), '<input id="fn-nome" name="nome" value="' + esc(f ? f.nome : '') + '" placeholder="' + esc(tr('Ex.: Carpinteiro')) + '"' + (edita ? '' : ' disabled') + '>') +
      (f ? campoPainel('fn-ativa', tr('Situação'), '<select id="fn-ativa" name="ativa"' + (edita ? '' : ' disabled') + '><option value="true"' + (f.ativa !== false ? ' selected' : '') + '>' + tr('Ativa') + '</option><option value="false"' + (f.ativa === false ? ' selected' : '') + '>' + tr('Inativa') + '</option></select>', tr('Inativa some das listas; o histórico fica.'))
        : '<div class="painel-linha">' + campoPainel('fn-valor', tr('Valor hora (US$)'), '<input type="number" id="fn-valor" name="valor" min="0.01" step="0.01" inputmode="decimal">', tr('Opcional. Sem encargos: eles entram no custo da hora.')) + campoPainel('fn-desde', tr('Vale a partir de'), '<input type="date" id="fn-desde" name="desde" value="' + hoje() + '">') + '</div>') + '</div>' + historico,
    aoSalvar: async (p) => {
      const r = await salvarFuncaoCad(id, lerCampos(p.querySelector('#form-funcao')));
      return r.erro ? r : { ok: true };
    },
  }).then((r) => {
    if (r) toast(r.reabrir ? tr('Valor hora registrado.') : id ? tr('Função atualizada.') : tr('Função cadastrada.'));
    if (location.hash.startsWith('#/conta/funcoes/')) ir('#/conta/funcoes'); else if (r) redesenhar();
    if (r && r.reabrir) setTimeout(() => painelFuncao(id), 80);
  });
}

/* ---------- Funcionários ---------- */

const veValores = () => pode('settings.funcionarios') || pode('crew.custos');
function custoCarregado(f) { return valorAtual(f.id) * (1 + (f.classificacao === '1099' ? 0 : totalEncargos(encargosVigentes()))); }

function telaFuncionarios() {
  const lista = cad.funcionarios.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const desligado = (f) => f.situacao === 'desligado';
  const aVencer = (f) => !desligado(f) && certificacoesAVencer(f).length > 0;
  const linhas = lista.map((f) => {
    const avisos = certificacoesAVencer(f);
    return '<tr' + atributosDeLinha([f.nome, f.codigo, f.funcao].join(' '), [desligado(f) ? 'desligados' : 'ativos'].concat(aVencer(f) ? ['a-vencer'] : [])) + '>' +
      '<td><div class="pessoa">' + avatar(f.nome, desligado(f)) + '<div><a href="#/conta/funcionarios/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.codigo || '') + '</span></div></div></td>' +
      '<td>' + esc(f.funcao) + '</td><td>' + esc(CLASSIFICACOES[f.classificacao] || '') + '</td>' +
      (veValores() ? '<td class="num"><b>' + dinheiro(valorAtual(f.id)) + '</b></td><td class="num">' + dinheiro(custoCarregado(f)) + '</td>' : '') +
      '<td>' + (f.situacao === 'ativo' ? '<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + SITUACOES_FUNC[f.situacao] + '</span>') +
        (avisos.length ? ' <span class="etiqueta etiqueta-ambar" title="' + esc(avisos.map((c) => c.nome).join(', ')) + '">' + tn(avisos.length, '{n} certificação a vencer', '{n} certificações a vencer') + '</span>' : '') + '</td>' +
      '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-editar-func" data-id="' + f.id + '">' + tr('Editar') + '</button></td></tr>';
  }).join('');
  const chips = [['', tr('Todos'), lista.length], ['ativos', tr('Ativos'), lista.filter((f) => !desligado(f)).length], ['desligados', tr('Desligados'), lista.filter(desligado).length]]
    .concat(lista.some(aVencer) ? [['a-vencer', tr('Certificação a vencer'), lista.filter(aVencer).length]] : []);
  return cabecalhoDePagina(tr('Funcionários'), tr('Cadastro único da empresa: vale para o Crew, o Daily e o Measure'), botaoCriar('cad-novo-func', tr('Novo funcionário'), icone('mais', 16))) +
    barraDeBusca(tr('Buscar por nome, código ou função'), chips) +
    gradeEmCartao('tabela-funcionarios', [tr('Funcionário'), tr('Função'), tr('Classificação')].concat(veValores() ? [tr('Valor hora'), tr('Custo carregado')] : []).concat([tr('Situação'), '']), linhas, tr('Nenhum funcionário ainda. Use "Novo funcionário".')) +
    (veValores() ? '<p class="dica">' + tr('Custo carregado = valor hora + {pct} de <a href="#/settings/encargos">encargos</a>. Autônomo (1099) não tem encargos nem hora extra.', { pct: pct(totalEncargos(encargosVigentes())) }).replace('#/settings/encargos', '#/conta/regras') + '</p>' : '');
}

function telaFuncionario(id) {
  const f = funcionario(id);
  const hist = historico(valoresDe(id));
  const atual = vigente(valoresDe(id));
  const dado = (rot, v) => '<div><dt>' + rot + '</dt><dd>' + (v || '<span class="mudo">—</span>') + '</dd></div>';
  const autonomo = f.classificacao === '1099';
  const regra = vigente(cad.regras);
  return cabeca(f.nome, '<a class="btn btn-contorno btn-pequeno" href="#/conta/funcionarios/' + f.id + '/editar">' + tr('Editar cadastro') + '</a>', ['#/conta/funcionarios', tr('Funcionários')]) +
    '<p class="mudo">' + esc(f.funcao) + ' · ' + esc(CLASSIFICACOES[f.classificacao] || '') + '</p>' +
    (veValores() ? '<div class="kpis kpis-3"><div class="kpi kpi-azul"><span>' + tr('Valor hora atual') + '</span><b>' + dinheiro(valorAtual(id)) + '</b></div>' +
      '<div class="kpi"><span>' + tr('Custo carregado') + (autonomo ? ' ' + tr('(sem encargos: 1099)') : ' (+' + pct(totalEncargos(encargosVigentes())) + ' ' + tr('encargos)')) + '</span><b>' + dinheiro(custoCarregado(f)) + '</b></div>' +
      '<div class="kpi"><span>' + (autonomo || f.flsa === 'isento' || !regra ? tr('Hora extra') : tr('Hora extra (') + num(regra.semanal.fator) + tr('×)')) + '</span><b>' +
        (autonomo || f.flsa === 'isento' ? tr('Não se aplica') : dinheiro(valorAtual(id) * (regra ? Number(regra.semanal.fator) : 1.5))) + '</b></div></div>' : '') +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Cadastro') + '</h2><dl class="dados-func">' +
      dado(tr('Código'), esc(f.codigo)) + dado(tr('Situação'), SITUACOES_FUNC[f.situacao] + (f.desligamento ? ' ' + tr('em') + ' ' + dataCurta(f.desligamento) : '')) +
      dado(tr('Função'), esc(f.funcao)) + dado(tr('Classificação'), CLASSIFICACOES[f.classificacao]) + dado('FLSA', FLSA[f.flsa]) +
      dado(tr('Admissão'), dataCurta(f.admissao)) + dado(tr('Telefone'), esc(f.telefone)) + dado(tr('Contato de emergência'), esc(f.emergencia)) +
      dado(tr('Aviso de localização aceito em'), f.aviso_gps_em ? dataCurta(f.aviso_gps_em) : '<span class="etiqueta etiqueta-ambar">' + tr('pendente') + '</span>') +
    '</dl><p class="mudo pequeno">' + tr('SSN e documentos de imigração não ficam no KORbuild: ficam no sistema de folha. Aqui fica só o código para o cruzamento.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Certificações') + '</h2>' +
      ((f.certificacoes || []).length ? '<ul class="lista-cert">' + f.certificacoes.map((c) => '<li><b>' + esc(c.nome) + '</b>' + (c.validade ? '<span class="mudo pequeno">' + tr('vence em') + ' ' + dataCurta(c.validade) + '</span>' : '') + '</li>').join('') + '</ul>' : '<p class="vazio">' + tr('Nenhuma certificação cadastrada.') + '</p>') +
    '</section>' +
    (veValores() ? '<section class="cartao"><h2 class="cartao-titulo">' + tr('Histórico do valor hora') + '</h2>' +
      '<p class="mudo pequeno">' + tr('Cada mudança vale a partir de uma data e nunca apaga a anterior: as horas de cada dia são pagas e custeadas pelo valor vigente naquele dia.') + '</p>' +
      '<div class="tabela-rolagem"><table class="tabela tabela-valores"><thead><tr><th>' + tr('Vigência') + '</th><th class="num">' + tr('Valor hora') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>' +
        hist.map((x) => '<tr' + (x === atual ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + etiquetaVigencia(x, atual) + '</td><td class="num"><b>' + dinheiro(Number(x.valor)) + '</b></td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(autor(x.por)) + ' · ' + quando(x.em) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (pode('settings.funcionarios') ? '<form id="form-valor-hora" class="grade-campos" data-id="' + f.id + '" data-sem-envio>' +
        campo('vh-valor', tr('Novo valor hora (US$)'), '<input type="number" id="vh-valor" name="valor" min="1" step="0.01" inputmode="decimal">') +
        campo('vh-desde', tr('A partir de'), data('vh-desde', 'desde', proximaSegunda())) +
        campo('vh-motivo', tr('Motivo'), texto('vh-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: reajuste anual')) + '"')) +
      '</form><div class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="cad-valor-hora">' + icone('dinheiro', 16) + tr('Alterar valor hora') + '</button></div>' : '') +
    '</section>' : '');
}

/* A edição abre num painel lateral: por "Novo funcionário", por "Editar" na lista ou pelos endereços funcionarios/novo e funcionarios/<id>/editar (lista ou página do funcionário, com o painel por cima). */
function painelFuncionario(id) {
  const f = id ? funcionario(id) : null;
  if (id && !f) return;
  const v = f || { classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', admissao: hoje(), certificacoes: [] };
  const funcoes = Array.from(new Set(cad.funcoes.filter((x) => x.ativa !== false).map((x) => x.nome).concat(cad.funcionarios.map((x) => x.funcao)))).sort();
  const certs = (v.certificacoes || []).concat([{}, {}]);
  return abrirPainel({
    titulo: f ? f.nome : tr('Novo funcionário'), subtitulo: f ? [f.funcao, CLASSIFICACOES[f.classificacao]].filter(Boolean).join(' · ') : tr('Quem trabalha na empresa, com ou sem login no sistema.'),
    classe: 'painel-largo', rotuloSalvar: f ? tr('Salvar') : tr('Cadastrar funcionário'),
    corpo: '<div id="form-func" class="painel-campos" data-id="' + (f ? f.id : '') + '">' +
      '<h3 class="painel-secao">' + tr('Identificação') + '</h3>' +
      '<div class="painel-linha">' + campoPainel('ff-nome', tr('Nome completo *'), texto('ff-nome', 'nome', v.nome, ' autocomplete="off"')) + campoPainel('ff-codigo', tr('Código (employee ID)'), texto('ff-codigo', 'codigo', v.codigo), tr('O mesmo do sistema de folha')) + '</div>' +
      '<div class="painel-linha">' + campoPainel('ff-telefone', tr('Telefone'), texto('ff-telefone', 'telefone', v.telefone, ' inputmode="tel"')) + campoPainel('ff-emergencia', tr('Contato de emergência'), texto('ff-emergencia', 'emergencia', v.emergencia)) + '</div>' +
      '<h3 class="painel-secao">' + tr('Contrato e trabalho') + '</h3>' +
      '<div class="painel-linha">' + campoPainel('ff-classificacao', tr('Classificação'), '<select id="ff-classificacao" name="classificacao">' + opcoes(Object.entries(CLASSIFICACOES), v.classificacao) + '</select>', tr('Autônomo (1099) não tem hora extra nem encargos')) +
        campoPainel('ff-flsa', 'FLSA', '<select id="ff-flsa" name="flsa">' + opcoes(Object.entries(FLSA), v.flsa) + '</select>', tr('Isento não recebe hora extra')) + '</div>' +
      '<div class="painel-linha">' + campoPainel('ff-funcao', tr('Função'), '<input type="text" id="ff-funcao" name="funcao" list="lista-funcoes" value="' + esc(v.funcao || '') + '"><datalist id="lista-funcoes">' + funcoes.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>') +
        campoPainel('ff-admissao', tr('Admissão'), data('ff-admissao', 'admissao', v.admissao)) + '</div>' +
      '<div class="painel-linha">' + campoPainel('ff-situacao', tr('Situação'), '<select id="ff-situacao" name="situacao">' + opcoes(Object.entries(SITUACOES_FUNC), v.situacao) + '</select>') +
        campoPainel('ff-desligamento', tr('Desligamento'), data('ff-desligamento', 'desligamento', v.desligamento), tr('Só quando desligado')) + '</div>' +
      (f ? '' : campoPainel('ff-valorHora', tr('Valor hora inicial (US$)'), '<input type="number" id="ff-valorHora" name="valorHora" min="1" step="0.01" inputmode="decimal">', tr('Depois, mudanças ficam no histórico com data e motivo'))) +
      '<h3 class="painel-secao">' + tr('Certificações') + '</h3><p class="mudo pequeno">' + tr('OSHA 10/30, licenças, operador de máquina… O sistema avisa 30 dias antes de vencer.') + '</p>' +
      certs.map((c, i) => '<div class="linha-cert"><input type="text" name="cert-nome-' + i + '" aria-label="' + tr('Certificação') + ' ' + (i + 1) + '" placeholder="' + tr('Certificação') + '" value="' + esc(c.nome || '') + '">' +
        '<input type="date" name="cert-validade-' + i + '" aria-label="' + tr('Validade da certificação') + ' ' + (i + 1) + '" value="' + esc(c.validade || '') + '"></div>').join('') +
      '<h3 class="painel-secao">' + tr('Privacidade') + '</h3>' +
      campoPainel('ff-avisoGps', tr('Aviso de localização aceito em'), data('ff-avisoGps', 'aviso_gps_em', v.aviso_gps_em), tr('O ponto com GPS só registra a localização com o ponto aberto')) +
      (f ? '<p class="dica"><a href="#/conta/funcionarios/' + f.id + '">' + tr('Ver a página do funcionário (valor hora, histórico e certificações)') + '</a></p>' : '') + '</div>',
    aoSalvar: async (p) => {
      const raiz = p.querySelector('#form-func');
      const d = lerCampos(raiz);
      d.certificacoes = [...raiz.querySelectorAll('.linha-cert')].map((_, i) => ({ nome: d['cert-nome-' + i], validade: d['cert-validade-' + i] }));
      const r = await salvarFuncionario(id, d);
      return r.erro ? r : { ok: true, id: r.data };
    },
  }).then((r) => {
    if (r) toast(id ? tr('Cadastro salvo.') : tr('Funcionário cadastrado.'));
    const h = location.hash;
    if (id && h.endsWith('/editar')) ir('#/conta/funcionarios/' + id);   // aberto pela página do funcionário: volta para ela
    else if (h === '#/conta/funcionarios/novo') ir('#/conta/funcionarios');
    else if (r) redesenhar();
  });
}

/* ---------- Regras: encargos e jornada ---------- */

function telaRegras() {
  const enc = encargosVigentes();
  const regra = vigente(cad.regras);
  const item = (titulo, txt) => '<li><b>' + titulo + '</b><span>' + txt + '</span></li>';
  const edita = pode('settings.regras');
  const encHtml = enc
    ? '<table class="tabela"><tbody>' + enc.itens.map((i) => '<tr><td>' + esc(i.nome) + '</td><td class="num"><b>' + num(i.pct) + '%</b></td></tr>').join('') +
      '<tr class="linha-total"><td>' + tr('Total sobre o salário') + '</td><td class="num"><b>' + pct(totalEncargos(enc)) + '</b></td></tr></tbody></table>'
    : '<p class="vazio">' + tr('Nenhuma versão ainda. A primeira já vem com os encargos mais comuns para você ajustar.') + '</p>';
  const regraHtml = regra
    ? '<ul class="lista-regras">' +
        item(tr('Hora extra semanal'), tr('Acima de') + ' ' + num(regra.semanal.limite) + ' ' + tr('h na semana (segunda a domingo):') + ' ' + num(regra.semanal.fator) + tr('×')) +
        item(tr('Hora extra diária'), regra.diaria.ativo ? tr('Acima de') + ' ' + num(regra.diaria.limite) + ' ' + tr('h no dia:') + ' ' + num(regra.diaria.fator) + tr('×; acima de') + ' ' + num(regra.diaria.dobra) + ' h: ' + num(regra.diaria.fatorDobra) + tr('×') : tr('Não se aplica')) +
        item(tr('Intervalo'), num(regra.intervalo.minimo) + ' ' + tr('min depois de') + ' ' + num(regra.intervalo.apos) + ' ' + tr('h de trabalho (gera alerta se faltar)')) +
      '</ul>'
    : '<p class="vazio">' + tr('Nenhuma versão ainda. Comece por um modelo (FLSA federal ou com hora extra diária) e ajuste.') + '</p>';
  const histTabela = (lista, v, colunas, linha) => lista.length ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr>' + colunas.map((c) => '<th>' + c + '</th>').join('') + '</tr></thead><tbody>' +
    historico(lista).map((x) => '<tr' + (x === v ? ' class="vigente"' : '') + '>' + linha(x) + '</tr>').join('') + '</tbody></table></div>' : '';
  return cabecalhoDePagina(tr('Regras'), tr('Encargos sobre a folha e regras de jornada: cada mudança vale de uma data em diante e fica no histórico com o motivo.'),
      edita ? '<button type="button" class="btn btn-contorno" data-acao="cad-nova-encargos">' + icone('mais', 16) + '<span>' + tr('Nova versão dos encargos') + '</span></button>' + botaoCriar('cad-nova-jornada', tr('Nova regra de jornada'), icone('mais', 16)) : '') +
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Encargos sobre a folha') + (enc ? ' · ' + tr('vigentes desde') + ' ' + dataCurta(enc.desde) : '') + '</h2></div>' +
      '<p class="mudo pequeno">' + tr('Labor burden: o que a empresa paga além do salário. Vale para todos os funcionários W-2') + '</p>' + encHtml +
      histTabela(cad.encargos, enc, [tr('A partir de'), tr('Total'), tr('Motivo'), tr('Registrado por')],
        (x) => '<td>' + dataCurta(x.desde) + etiquetaVigencia(x, enc) + '</td><td class="num">' + pct(totalEncargos(x)) + '</td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(autor(x.por)) + ' · ' + quando(x.em) + '</td>') +
    '</section>' +
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Regras de jornada') + (regra ? ' · ' + esc(regra.nome) : '') + '</h2></div>' +
      '<p class="mudo pequeno">' + tr('Hora extra e intervalo usados no ponto, nos timesheets e nos custos') + '</p>' + regraHtml +
      histTabela(cad.regras, regra, [tr('Semana de'), tr('Regra'), tr('Motivo'), tr('Registrado por')],
        (x) => '<td>' + dataCurta(x.desde) + etiquetaVigencia(x, regra) + '</td><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno bloco">' + esc(resumoRegra(x)) + '</span></td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(autor(x.por)) + ' · ' + quando(x.em) + '</td>') +
    '</section>' +
    '<p class="dica">' + tr('Mudanças valem da semana atual em diante: semanas fechadas não mudam, e cada versão fica no histórico com o motivo.') + '</p>';
}

/* Encargos e jornada: "Nova versão" abre um painel; os endereços regras/encargos e regras/jornada abrem a página com o painel por cima. */
function fecharRegras(r) {
  if (/^#\/conta\/regras\/(encargos|jornada)/.test(location.hash)) ir('#/conta/regras'); else if (r) redesenhar();
}
function painelEncargos() {
  const v = encargosVigentes();
  const linhas = (v ? v.itens : ENCARGOS_INICIAIS).concat([{ nome: '', pct: '' }, { nome: '', pct: '' }]);
  return abrirPainel({
    titulo: tr('Nova versão dos encargos'), subtitulo: tr('Labor burden: o que a empresa paga além do salário. Vale para todos os funcionários W-2'), rotuloSalvar: tr('Salvar nova versão'),
    corpo: '<div id="form-encargos" class="painel-campos"><p class="mudo pequeno">' + tr('Os custos de antes da data continuam com os encargos da época. Para tirar um item, apague o nome.') + '</p>' +
      linhas.map((i, n) => '<div class="linha-encargo"><input type="text" name="nome-' + n + '" aria-label="' + tr('Encargo') + ' ' + (n + 1) + '" placeholder="' + tr('Novo encargo') + '" value="' + esc(i.nome) + '">' +
        '<span class="campo-pct"><input type="number" name="pct-' + n + '" aria-label="' + tr('Percentual do encargo') + ' ' + (n + 1) + '" min="0" max="100" step="0.01" value="' + esc(String(i.pct)) + '" inputmode="decimal">%</span></div>').join('') +
      '<div class="painel-linha">' + campoPainel('enc-desde', tr('Vale a partir de'), data('enc-desde', 'desde', segundaDe(hoje())), tr('A partir da semana atual; semanas fechadas não mudam')) +
        campoPainel('enc-motivo', tr('Motivo'), texto('enc-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: nova taxa do workers\' comp na renovação da apólice')) + '"')) + '</div></div>',
    aoSalvar: async (p) => {
      const d = lerCampos(p.querySelector('#form-encargos'));
      const itens = [...p.querySelectorAll('.linha-encargo')].map((_, i) => ({ nome: d['nome-' + i], pct: d['pct-' + i] }));
      const r = await novosEncargos({ itens, desde: d.desde, motivo: d.motivo });
      return r.erro ? r : { ok: true };
    },
  }).then((r) => { if (r) toast(tr('Nova versão dos encargos salva.')); fecharRegras(r); });
}

function painelJornada() {
  const r = vigente(cad.regras) || { ...MODELOS_REGRA.federal };
  const numero = (nome, valor, rot, passo) => campoPainel('rg-' + nome, rot, '<input type="number" id="rg-' + nome + '" name="' + nome + '" value="' + valor + '" min="0" step="' + (passo || '0.5') + '" inputmode="decimal">');
  return abrirPainel({
    titulo: tr('Nova versão da regra de jornada'), subtitulo: tr('Hora extra e intervalo usados no ponto, nos timesheets e nos custos'), classe: 'painel-largo', rotuloSalvar: tr('Salvar nova versão'),
    corpo: '<div id="form-regra" class="painel-campos"><p class="mudo pequeno">' + tr('Preencher com um modelo (depois ajuste o que precisar):') + '</p><div class="btn-linha">' +
      Object.entries(MODELOS_REGRA).map(([id, m]) => '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="settings-modelo" data-modelo="' + id + '">' + esc(m.nome) + '</button>').join('') + '</div>' +
      campoPainel('rg-nome', tr('Nome da regra'), texto('rg-nome', 'nome', r.nome)) +
      '<h3 class="painel-secao">' + tr('Hora extra semanal') + '</h3><div class="painel-linha">' +
        numero('semanal-limite', r.semanal.limite, tr('Acima de (horas na semana)')) + numero('semanal-fator', r.semanal.fator, tr('Fator'), '0.05') + '</div>' +
      '<h3 class="painel-secao">' + tr('Hora extra diária') + '</h3>' +
        '<label class="check"><input type="checkbox" name="diaria-ativo" value="1"' + (r.diaria.ativo ? ' checked' : '') + '> ' + tr('Pagar hora extra por dia (além da semanal)') + '</label><div class="painel-linha">' +
        numero('diaria-limite', r.diaria.limite, tr('Acima de (horas no dia)')) + numero('diaria-fator', r.diaria.fator, tr('Fator'), '0.05') + '</div><div class="painel-linha">' +
        numero('diaria-dobra', r.diaria.dobra, tr('Hora dobrada acima de (horas no dia)')) + numero('diaria-fatorDobra', r.diaria.fatorDobra, tr('Fator da dobrada'), '0.05') + '</div>' +
        '<p class="mudo pequeno">' + tr('A hora que já virou extra no dia não conta de novo para a semanal.') + '</p>' +
      '<h3 class="painel-secao">' + tr('Intervalo') + '</h3><div class="painel-linha">' +
        numero('intervalo-minimo', r.intervalo.minimo, tr('Mínimo (minutos)'), '5') + numero('intervalo-apos', r.intervalo.apos, tr('Depois de (horas de trabalho)')) + '</div>' +
      '<h3 class="painel-secao">' + tr('Vigência') + '</h3><div class="painel-linha">' +
        campoPainel('rg-desde', tr('Vale a partir da semana de'), data('rg-desde', 'desde', segundaDe(hoje())), tr('A regra vale por semana inteira (de segunda a domingo); a data vai para a segunda')) +
        campoPainel('rg-motivo', tr('Motivo'), texto('rg-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: acordo coletivo, obra em outro estado')) + '"')) + '</div></div>',
    aoSalvar: async (p) => {
      const d = lerCampos(p.querySelector('#form-regra'));
      const x = await novaRegra({
        nome: d.nome, desde: d.desde, motivo: d.motivo,
        semanalLimite: d['semanal-limite'], semanalFator: d['semanal-fator'], diariaAtivo: !!d['diaria-ativo'], diariaLimite: d['diaria-limite'], diariaFator: d['diaria-fator'],
        diariaDobra: d['diaria-dobra'], diariaFatorDobra: d['diaria-fatorDobra'], intervaloMinimo: d['intervalo-minimo'], intervaloApos: d['intervalo-apos'],
      });
      return x.erro ? x : { ok: true };
    },
  }).then((r) => { if (r) toast(tr('Nova regra salva.')); fecharRegras(r); });
}

/* ---------- Contatos ---------- */

const etiquetaDoPapel = (p) => '<span class="etiqueta ' + ({ construtora: 'etiqueta-azul', fornecedor: 'etiqueta-ambar', prestadora: 'etiqueta-neutro' }[p] || 'etiqueta-verde') + '">' + esc((PAPEIS[p] || {}).nome || p) + '</span>';

function telaContatos() {
  const lista = cad.contatos.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const porPapel = (p) => lista.filter((c) => c.papeis.includes(p)).length;
  const chips = [['', tr('Todos'), lista.length]].concat(PAPEIS_CONTATO.filter((p) => porPapel(p) > 0).map((p) => [p, esc((PAPEIS[p] || {}).nome || p), porPapel(p)]));
  const linhas = lista.map((c) => {
    const obras = cad.obras.filter((o) => o.contratante_id === c.id || o.dono_id === c.id).length;
    return '<tr' + atributosDeLinha([c.nome, c.pessoa, c.email, c.telefone, c.cidade].join(' '), c.papeis) + '><td><div class="pessoa">' + avatar(c.nome) + '<div><b>' + esc(c.nome) + '</b>' + (c.pessoa ? '<span class="mudo pequeno bloco">' + esc(c.pessoa) + '</span>' : '') + '</div></div></td>' +
      '<td>' + c.papeis.map(etiquetaDoPapel).join(' ') + '</td><td class="pequeno">' + esc([c.email, c.telefone].filter(Boolean).join(' · ')) + '</td><td class="num">' + (obras || '') + '</td>' +
      '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-editar-contato" data-id="' + c.id + '">' + tr('Editar') + '</button></td></tr>';
  }).join('');
  return cabecalhoDePagina(tr('Contatos'), tr('Construtoras, clientes, fornecedores e prestadoras: um diretório só, com marcadores.'), botaoCriar('cad-novo-contato', tr('Novo contato'), icone('mais', 16))) +
    barraDeBusca(tr('Buscar por nome, pessoa, e-mail ou telefone'), chips) +
    gradeEmCartao('tabela-contatos', [tr('Contato'), tr('Marcadores'), tr('E-mail e telefone'), tr('Obras'), ''], linhas, tr('Nenhum contato ainda. Use "Novo contato".'));
}

/* A edição abre num painel lateral; os endereços antigos (contatos/novo e contatos/<id>) abrem a lista com o painel por cima. */
function painelContato(id) {
  const c = id ? contato(id) : { papeis: [], etapas: [] };
  if (!c) return;
  const v = (k) => esc(c[k] || '');
  return abrirPainel({
    titulo: id ? c.nome : tr('Novo contato'), subtitulo: id ? c.papeis.map((p) => (PAPEIS[p] || {}).nome || p).join(' · ') : tr('Empresa ou pessoa: construtora, cliente, fornecedor ou prestadora.'), classe: 'painel-largo',
    rotuloSalvar: id ? tr('Salvar') : tr('Criar contato'),
    extras: id ? [{ rotulo: tr('Excluir'), classe: 'btn-perigo', aoClicar: async () => {
      if (!(await confirmar(tr('Excluir este contato?'), '', tr('Excluir')))) return null;
      const r = await excluirContato(id);
      return r.erro ? r : { ok: true, excluido: true };
    } }] : [],
    corpo: '<div id="form-contato" class="painel-campos"><div class="painel-linha">' +
      campoPainel('ct-nome', tr('Nome (empresa ou pessoa) *'), '<input id="ct-nome" name="nome" value="' + v('nome') + '" autocomplete="off">') + campoPainel('ct-pessoa', tr('Pessoa de contato'), '<input id="ct-pessoa" name="pessoa" value="' + v('pessoa') + '">') +
      campoPainel('ct-email', tr('E-mail'), '<input type="email" id="ct-email" name="email" value="' + v('email') + '">') + campoPainel('ct-telefone', tr('Telefone'), '<input id="ct-telefone" name="telefone" inputmode="tel" value="' + v('telefone') + '">') + '</div>' +
      '<fieldset class="painel-marcadores"><legend class="rotulo-pequeno">' + tr('Marcadores *') + '</legend>' + PAPEIS_CONTATO.map((p) => '<label class="check pequeno" title="' + esc((PAPEIS[p] || {}).dica || '') + '"><input type="checkbox" name="papeis" value="' + p + '"' + (c.papeis.includes(p) ? ' checked' : '') + '> ' + esc((PAPEIS[p] || {}).nome || p) + '</label>').join('') + '</fieldset>' +
      '<h3 class="painel-secao">' + tr('Endereço') + '</h3>' + campoPainel('ct-endereco', tr('Rua e número'), '<input id="ct-endereco" name="endereco" value="' + v('endereco') + '">') +
      '<div class="painel-linha tres">' + campoPainel('ct-cidade', tr('Cidade'), '<input id="ct-cidade" name="cidade" value="' + v('cidade') + '">') + campoPainel('ct-estado', tr('Estado'), '<input id="ct-estado" name="estado" maxlength="2" value="' + v('estado') + '">') + campoPainel('ct-zip', 'ZIP', '<input id="ct-zip" name="zip" value="' + v('zip') + '">') + '</div>' +
      '<h3 class="painel-secao">' + tr('Outras informações') + '</h3>' + campoPainel('ct-etapas', tr('Etapas que cota (fornecedor)'), '<input id="ct-etapas" name="etapas" value="' + esc((c.etapas || []).join(', ')) + '">', tr('Separadas por vírgula. Ex.: Framing, Siding')) +
      campoPainel('ct-notas', tr('Notas'), '<textarea id="ct-notas" name="notas" rows="3">' + v('notas') + '</textarea>') + '</div>',
    aoSalvar: async (p) => {
      const d = lerCampos(p.querySelector('#form-contato'));
      const r = await salvarContato(id, { ...d, papeis: d.papeis || [] });
      return r.erro ? r : { ok: true };
    },
  }).then((r) => {
    if (r) toast(r.excluido ? tr('Contato excluído.') : id ? tr('Contato salvo.') : tr('Contato criado.'));
    if (location.hash.startsWith('#/conta/contatos/')) ir('#/conta/contatos'); else if (r) redesenhar();   // aberto por endereço (contatos/novo): volta à lista ao fechar
  });
}

/* ---------- Obras, alocações e modelos de etapas ---------- */

function telaObras() {
  const sit = (o) => SITUACOES_OBRA[o.situacao] || SITUACOES_OBRA.andamento;
  const lista = cad.obras.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const porSit = (k) => lista.filter((o) => (o.situacao || 'andamento') === k).length;
  const chips = [['', tr('Todas'), lista.length]].concat(Object.entries(SITUACOES_OBRA).filter(([k]) => porSit(k) > 0).map(([k, x]) => [k, x.nome, porSit(k)]));
  const linhas = lista.map((o) => '<tr' + atributosDeLinha([o.nome, o.municipio, o.estado, (contato(o.contratante_id) || {}).nome].join(' '), [o.situacao || 'andamento']) + '>' +
    '<td><div class="pessoa">' + avatar(o.nome, o.situacao === 'concluida') + '<div><a href="#/conta/obras/' + o.id + '"><b>' + esc(o.nome) + '</b></a><span class="mudo pequeno bloco">' + esc([o.municipio, o.estado].filter(Boolean).join(', ')) + '</span></div></div></td>' +
    '<td>' + esc((contato(o.contratante_id) || {}).nome || '') + '</td><td class="pequeno">' + dataCurta(o.inicio) + ' → ' + dataCurta(o.prazo) + '</td>' +
    (PRIMEIRA_VERSAO ? '' : '<td class="num">' + (alocacoesDa(o.id).filter((a) => !a.ate).length || '') + '</td>') +
    '<td><span class="etiqueta ' + sit(o).classe + '">' + sit(o).nome + '</span></td>' +
    '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-editar-obra" data-id="' + o.id + '">' + tr('Editar') + '</button></td></tr>').join('');
  return cabecalhoDePagina(tr('Obras'), tr('As obras da empresa: local, partes, prazo e, para quem executa, a equipe de cada uma.'),
      (PRIMEIRA_VERSAO ? '' : '<a class="btn btn-contorno" href="#/conta/obras/modelos">' + tr('Modelos de etapas') + '</a>') + botaoCriar('cad-nova-obra', tr('Nova obra'), icone('mais', 16))) +
    barraDeBusca(tr('Buscar por obra, cidade ou contratante'), chips) +
    gradeEmCartao('tabela-obras', [tr('Obra'), tr('Contratante'), tr('Prazo')].concat(PRIMEIRA_VERSAO ? [] : [tr('Equipe')]).concat([tr('Situação'), '']), linhas, tr('Nenhuma obra ainda. Use "Nova obra".')) +
    (cad.contatos.some((c) => c.papeis.includes('construtora') || c.papeis.includes('cliente')) ? '' : '<p class="dica">' + tr('Antes da primeira obra, cadastre o contratante em <a href="#/conta/contatos/novo">Contatos</a>.') + '</p>');
}

/* A edição da obra abre num painel lateral (com o mapa e, depois de criada, a equipe). Os endereços obras/nova, obras/nova/<projeto> e obras/<id> abrem a lista com o painel por cima. */
function painelObra(id, projetoId) {
  const existente = id ? obra(id) : null;
  if (id && !existente) return;
  // a partir do projeto ganho no Measure (OB-07; da concorrência, CO-14): nome, endereço e partes já vêm preenchidos
  const pj = projetoId ? projetoDoEspelho(projetoId) : null;
  const o = existente || { ...(pj ? { nome: pj.nome, contratante_id: pj.contratanteId, dono_id: pj.donoId, endereco: pj.endereco, municipio: pj.cidade, estado: pj.estado, zip: pj.zip } : {}), raio: RAIO_PADRAO, dias_trabalho: [1, 2, 3, 4, 5], situacao: 'andamento', inicio: hoje() };
  const tem = Number.isFinite(o.lat) && Number.isFinite(o.lon);
  const centro = tem ? { lat: o.lat, lon: o.lon } : { lat: 43.0, lon: -71.46 };
  const executa = empresaExecuta();
  const perfilDoMembro = (m) => conta.perfis.find((p) => p.id === m.perfil_id);
  const preenchem = cad.membros.filter((m) => m.ativo && (perfilDoMembro(m) || { permissoes: [] }).permissoes.includes('daily.preencher'));
  const contratantes = cad.contatos.filter((c) => c.papeis.includes('construtora') || c.papeis.includes('cliente'));
  // 1ª versão: sem diário, ponto nem cronograma; o banco ainda pede responsável e dias de trabalho, então vão os padrões (quem cria a obra, segunda a sexta)
  const ocultosDaObra = (executa ? '<input type="hidden" name="responsavelId" value="' + esc(o.responsavel_id || (conta.membro && conta.membro.id) || '') + '">' : '') + [1, 2, 3, 4, 5].map((d) => '<input type="hidden" name="diasTrabalho" value="' + d + '">').join('');
  const corpo = '<div id="form-obra" class="painel-campos" data-id="' + (id || '') + '">' +
    (pj ? '<input type="hidden" name="projetoId" value="' + esc(pj.id) + '"><p class="pequeno">' + tr('A partir do projeto {nome} (Measure)', { nome: esc(pj.nome) }) + (pj.concorrencia && pj.concorrencia.vinculo ? ' · ' + tr('ganho numa concorrência: a obra nasce ligada à obra da contratante') : '') + '</p>' : '') +
    '<h3 class="painel-secao">' + tr('Obra') + '</h3><div class="painel-linha">' +
      campo('ob-nome', tr('Nome da obra *'), texto('ob-nome', 'nome', o.nome, ' placeholder="' + esc(tr('Ex.: Residencial Thompson, Mezanino LogSul')) + '"')) +
      campo('ob-situacao', tr('Situação'), '<select id="ob-situacao" name="situacao">' + Object.entries(SITUACOES_OBRA).map(([k, s]) => '<option value="' + k + '"' + (o.situacao === k ? ' selected' : '') + '>' + s.nome + '</option>').join('') + '</select>') + '</div>' +
      (PRIMEIRA_VERSAO ? '' : '<p class="mudo pequeno">' + tr('Só obra em andamento cobra o diário e aparece no celular do campo e no ponto. Paralisada e concluída ficam no escritório, com o histórico.') + '</p>') +
    '<h3 class="painel-secao">' + tr('Partes') + '</h3><div class="painel-linha">' +
      campo('ob-contratanteId', (PRIMEIRA_VERSAO ? tr('Contratante *') : tr('Contratante * (recebe o diário)')), '<select id="ob-contratanteId" name="contratanteId"><option value="">' + tr('Escolha…') + '</option>' + opcoes(contratantes.map((c) => [c.id, c.nome]), o.contratante_id) + '</select>') +
      campo('ob-donoId', tr('Dono da obra (se for outro)'), '<select id="ob-donoId" name="donoId"><option value="">' + tr('O próprio contratante') + '</option>' + opcoes(contratantes.map((c) => [c.id, c.nome]), o.dono_id) + '</select>') + '</div>' +
      (contratantes.length ? '' : '<p class="mudo pequeno">' + tr('Antes da primeira obra, cadastre o contratante em <a href="#/conta/contatos/novo">Contatos</a>.') + '</p>') + '' +
    '<h3 class="painel-secao">' + (PRIMEIRA_VERSAO ? tr('Local') : tr('Local e cerca do ponto')) + '</h3>' +
      campo('ob-endereco', tr('Endereço'), texto('ob-endereco', 'endereco', o.endereco)) +
      '<div class="painel-linha tres">' + campo('ob-municipio', tr('Cidade *'), texto('ob-municipio', 'municipio', o.municipio)) + campo('ob-estado', tr('Estado *'), texto('ob-estado', 'estado', o.estado, ' maxlength="2"')) + campo('ob-zip', tr('ZIP code'), texto('ob-zip', 'zip', o.zip, ' maxlength="10"')) + '</div>' +
      '<p class="mudo pequeno">' + (PRIMEIRA_VERSAO ? tr('Clique no mapa onde fica a obra (ou use a localização atual, se estiver no local).') : tr('Clique no mapa onde fica a obra (ou use a localização atual, se estiver no canteiro). O círculo é a cerca: batida de ponto fora dela fica marcada para o escritório conferir. O mesmo local dá o clima do diário.')) + '</p>' +
      '<div id="mapa-obra" class="mapa-obra" data-lat="' + centro.lat + '" data-lon="' + centro.lon + '" data-tem="' + (tem ? '1' : '') + '"><span class="mudo pequeno">' + tr('Carregando o mapa…') + '</span></div>' +
      '<div class="painel-linha tres">' +
        campo('ob-lat', tr('Latitude *'), '<input type="text" inputmode="decimal" id="ob-lat" name="lat" value="' + (tem ? o.lat : '') + '">') +
        campo('ob-lon', tr('Longitude *'), '<input type="text" inputmode="decimal" id="ob-lon" name="lon" value="' + (tem ? o.lon : '') + '">') +
        (PRIMEIRA_VERSAO ? '<input type="hidden" name="raio" value="' + RAIO_PADRAO + '">' : campo('ob-raio', tr('Raio da cerca (m)'), '<input type="number" id="ob-raio" name="raio" min="' + RAIO_MIN + '" max="' + RAIO_MAX + '" step="10" value="' + (o.raio || RAIO_PADRAO) + '">')) +
      '</div><button type="button" class="btn btn-contorno btn-pequeno" data-acao="obra-aqui">' + icone('pino', 16) + tr('Usar a localização atual') + '</button>' +
    '<h3 class="painel-secao">' + (executa && !PRIMEIRA_VERSAO ? tr('Prazo e diário de obra') : tr('Prazo')) + '</h3><div class="painel-linha">' +
      campo('ob-inicio', tr('Início *'), data('ob-inicio', 'inicio', o.inicio)) + campo('ob-prazo', tr('Prazo (término) *'), data('ob-prazo', 'prazo', o.prazo)) +
      (executa && !PRIMEIRA_VERSAO ? campo('ob-responsavelId', tr('Quem preenche o diário *'), '<select id="ob-responsavelId" name="responsavelId"><option value="">' + tr('Escolha…') + '</option>' + opcoes(preenchem.map((m) => [m.id, m.nome]), o.responsavel_id) + '</select>',
        preenchem.length ? '' : tr('Ninguém tem a permissão de preencher o diário: dê essa permissão a um perfil em Perfis de acesso.')) : '') + '</div>' +
      (executa && !PRIMEIRA_VERSAO ? '<fieldset class="dias-obra"><legend class="rotulo-pequeno">' + tr('Dias de trabalho * (cobram o diário)') + '</legend>' +
        [1, 2, 3, 4, 5, 6, 0].map((dia) => '<label class="check pequeno"><input type="checkbox" name="diasTrabalho" value="' + dia + '"' + ((o.dias_trabalho || []).includes(dia) ? ' checked' : '') + '> ' + NOMES_DIAS[dia] + '</label>').join('') + '</fieldset>'
        : (PRIMEIRA_VERSAO ? ocultosDaObra : '<p class="mudo pequeno">' + tr('O diário, o ponto e o cronograma são feitos pelas prestadoras, cada uma na obra dela ligada a esta.') + '</p>')) +
    '' +
    '</div>' +
    (existente && !PRIMEIRA_VERSAO ? htmlEquipeDaObra(existente) : '');
  const painel = abrirPainel({
    titulo: existente ? existente.nome : tr('Nova obra'), subtitulo: existente ? [existente.municipio, existente.estado].filter(Boolean).join(', ') : tr('Local, partes e prazo da obra.'),
    classe: 'painel-largo', rotuloSalvar: existente ? tr('Salvar') : tr('Criar obra'), corpo,
    aoSalvar: async (p) => {
      const raiz = p.querySelector('#form-obra');
      const d = lerCampos(raiz);
      d.diasTrabalho = [...raiz.querySelectorAll('[name="diasTrabalho"]')].filter((x) => x.type !== 'checkbox' || x.checked).map((x) => x.value);
      const r = await salvarObra(id, d);
      return r.erro ? r : { ok: true, id: r.data };
    },
  }).then((r) => {
    if (r) toast(id ? tr('Obra atualizada.') : tr('Obra criada.'));
    if (/^#\/conta\/obras\/(?!modelos)/.test(location.hash)) ir('#/conta/obras'); else if (r) redesenhar();   // aberto por endereço (obras/nova, obras/<id>): volta à lista ao fechar
    if (r && !id && !PRIMEIRA_VERSAO) setTimeout(() => painelObra(r.id), 80);   // obra nova: reabre para incluir a equipe
  });
  setTimeout(aposDesenharObras, 0);   // o mapa só monta depois que o painel está na página
  return painel;
}

/* Quem trabalha na obra: usuários (membros) e funcionários sem login. Uma pessoa pode estar em várias obras. */
function htmlEquipeDaObra(o) {
  const atuais = alocacoesDa(o.id).filter((a) => !a.ate);
  const nome = (a) => (a.membro_id ? (cad.membros.find((m) => m.id === a.membro_id) || {}).nome : (funcionario(a.funcionario_id) || {}).nome) || '—';
  const ja = new Set(atuais.map((a) => (a.membro_id ? 'm:' + a.membro_id : 'f:' + a.funcionario_id)));
  const escolhas = cad.membros.filter((m) => m.ativo).map((m) => ['m:' + m.id, m.nome + ' · ' + tr('usuário')])
    .concat(cad.funcionarios.filter((f) => f.situacao !== 'desligado').map((f) => ['f:' + f.id, f.nome + ' · ' + f.funcao])).filter(([k]) => !ja.has(k));
  return '<div id="equipe-obra"><h3 class="painel-secao">' + tr('Quem trabalha nesta obra') + '</h3>' +
    '<p class="mudo pequeno">' + tr('Uma pessoa pode estar em várias obras. O encarregado vê só as obras dele.') + '</p>' +
    (atuais.length ? '<ul class="lista-simples">' + atuais.map((a) => '<li><b>' + esc(nome(a)) + '</b>' + (a.papel ? ' · ' + esc(a.papel) : '') + (a.desde ? ' <span class="mudo pequeno">' + tr('desde') + ' ' + dataCurta(a.desde) + '</span>' : '') + ' ' +
      '<button type="button" class="link" data-acao="cad-desalocar" data-id="' + a.id + '">' + tr('Tirar') + '</button></li>').join('') + '</ul>' : '<p class="vazio">' + tr('Ninguém ainda.') + '</p>') +
    '<div id="form-alocar" class="painel-linha" data-obra="' + o.id + '">' +
      campo('al-quem', tr('Pessoa'), '<select id="al-quem" name="quem"><option value="">' + tr('Escolha…') + '</option>' + opcoes(escolhas, '') + '</select>') +
      campo('al-papel', tr('Papel na obra'), texto('al-papel', 'papel', '', ' placeholder="' + esc(tr('Ex.: encarregado, carpinteiro')) + '"')) +
    '</div><div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-alocar">' + icone('mais', 14) + tr('Incluir na obra') + '</button></div></div>';
}


function telaModelos() {
  const lista = cad.modelos.slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const linhas = lista.map((m) => '<tr' + atributosDeLinha(m.nome + ' ' + m.etapas.map((e) => e.nome).join(' '), []) + '><td><b>' + esc(m.nome) + '</b></td>' +
    '<td class="pequeno">' + m.etapas.map((e) => esc(e.nome) + ' <span class="mudo">' + decimal(e.pct, e.pct % 1 ? 1 : 0) + '%</span>').join(' · ') + '</td><td class="num">' + m.etapas.length + '</td>' +
    '<td class="acoes-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-editar-modelo" data-id="' + m.id + '">' + tr('Editar') + '</button></td></tr>').join('');
  return '<a class="voltar" href="#/conta/obras">← ' + tr('Obras') + '</a>' +
    cabecalhoDePagina(tr('Modelos de etapas'), tr('O cronograma inicial de cada tipo de obra ou serviço: etapas e a parte do prazo de cada uma'), botaoCriar('cad-novo-modelo', tr('Novo modelo'), icone('mais', 16))) +
    barraDeBusca(tr('Buscar modelo ou etapa'), []) +
    gradeEmCartao('tabela-modelos', [tr('Modelo'), tr('Etapas e parte do prazo'), tr('Etapas'), ''], linhas, tr('Nenhum modelo ainda. Crie um com as etapas que a empresa sempre repete.'));
}

const linhaModelo = (e) => '<div class="linha-modelo"><input type="text" name="etapaNome" value="' + esc(e.nome || '') + '" aria-label="' + tr('Etapa') + '" placeholder="' + esc(tr('Ex.: Framing do 1º pavimento')) + '">' +
  '<input type="text" inputmode="decimal" name="etapaPct" value="' + (e.pct != null ? e.pct : '') + '" aria-label="' + tr('Parte do prazo (%)') + '" placeholder="%">' +
  '<button type="button" class="btn-icone" data-acao="modelo-tirar-linha" aria-label="' + tr('Tirar etapa') + '" title="' + tr('Tirar etapa') + '">×</button></div>';

function painelModelo(id) {
  const m = id ? modelo(id) : { nome: '', etapas: [{ nome: '', pct: '' }] };
  if (!m) return;
  const painel = abrirPainel({
    titulo: id ? m.nome : tr('Novo modelo'), subtitulo: tr('Etapas na ordem e a parte do prazo de cada uma.'), classe: 'painel-largo', rotuloSalvar: id ? tr('Salvar') : tr('Criar modelo'),
    extras: id ? [{ rotulo: tr('Excluir'), classe: 'btn-perigo', aoClicar: async () => {
      if (!(await confirmar(tr('Excluir o modelo "{nome}"?', { nome: m.nome }), tr('As obras que já usaram o modelo não mudam.'), tr('Excluir')))) return null;
      const r = await excluirModelo(id);
      return r.erro ? r : { ok: true, excluido: true };
    } }] : [],
    corpo: '<div id="form-modelo" class="painel-campos" data-id="' + (id || '') + '">' +
      campoPainel('md-nome', tr('Nome do modelo *'), '<input type="text" id="md-nome" name="nome" value="' + esc(m.nome) + '" placeholder="' + esc(tr('Ex.: Framing + siding (casa)')) + '">') +
      '<div class="cabeca-modelo rotulo-pequeno"><span>' + tr('Etapa, na ordem') + '</span><span>' + tr('Parte do prazo (%)') + '</span></div>' +
      '<div id="md-linhas">' + m.etapas.map(linhaModelo).join('') + '</div>' +
      '<div><button type="button" class="btn btn-contorno btn-pequeno" data-acao="modelo-nova-linha">' + icone('mais', 14) + tr('Incluir etapa') + '</button></div>' +
      '<p class="pequeno" id="md-soma"></p>' +
      '<p class="mudo pequeno">' + tr('A parte do prazo diz quanto do período da obra cada etapa ocupa. As partes somam 100%. Ao criar a obra, as etapas entram em sequência.') + '</p></div>',
    aoSalvar: async (p) => {
      const raiz = p.querySelector('#form-modelo');
      const nomes = [...raiz.querySelectorAll('[name="etapaNome"]')].map((x) => x.value), pcts = [...raiz.querySelectorAll('[name="etapaPct"]')].map((x) => x.value);
      const r = await salvarModelo(id, { nome: raiz.querySelector('[name="nome"]').value, etapas: nomes.map((nome, i) => ({ nome, pct: pcts[i] })) });
      return r.erro ? r : { ok: true };
    },
  }).then((r) => {
    if (r) toast(r.excluido ? tr('Modelo excluído.') : tr('Modelo salvo.'));
    if (/^#\/conta\/obras\/modelos\/./.test(location.hash)) ir('#/conta/obras/modelos'); else if (r) redesenhar();
  });
  aposDesenharModelo();
  return painel;
}

/* ---------- Ações ---------- */

const form = (id) => document.getElementById(id);
const valor = (f, nome) => { const el = f.querySelector('[name="' + nome + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };
async function resultado(promessa, ok, destino) {
  const r = await promessa;
  if (r.erro) { toast(r.erro); return r; }
  if (ok) toast(ok);
  if (destino) ir(typeof destino === 'function' ? destino(r) : destino); else redesenhar();
  return r;
}

/* Incluir ou tirar alguém da equipe acontece dentro do painel da obra: depois de gravar, o painel é reaberto para mostrar a equipe nova. */
async function naEquipe(obraId, promessa, ok) {
  const r = await promessa;
  if (r.erro) { toast(r.erro); return r; }
  toast(ok);
  const aberto = document.querySelector('dialog.painel[open]');
  if (aberto) aberto.close();
  await redesenhar();
  if (obraId) setTimeout(() => painelObra(obraId), 80);
  return r;
}

export const acoesCadastros = {
  'cad-nova-funcao'() { return painelFuncao(null); },
  'cad-editar-funcao'(el) { return painelFuncao(el.dataset.id); },
  'cad-novo-func'() { return painelFuncionario(null); },
  'cad-editar-func'(el) { return painelFuncionario(el.dataset.id); },
  'cad-nova-encargos'() { return painelEncargos(); },
  'cad-nova-jornada'() { return painelJornada(); },
  'cad-valor-hora'() {
    const f = form('form-valor-hora');
    return resultado(novoValorHora(f.dataset.id, Object.fromEntries(new FormData(f).entries())), tr('Valor hora alterado.'));
  },
  'cad-novo-contato'() { return painelContato(null); },
  'cad-editar-contato'(el) { return painelContato(el.dataset.id); },
  'cad-nova-obra'() { return painelObra(null); },
  'cad-editar-obra'(el) { return painelObra(el.dataset.id); },
  'cad-alocar'() {
    const f = form('form-alocar');
    return naEquipe(f.dataset.obra, alocar(f.dataset.obra, valor(f, 'quem'), valor(f, 'papel')), tr('Incluído na obra.'));
  },
  'cad-desalocar'(el) {
    const a = cad.alocacoes.find((x) => x.id === el.dataset.id);
    return naEquipe(a ? a.obra_id : null, desalocar(el.dataset.id), tr('Tirado da obra.'));
  },
  'cad-novo-modelo'() { return painelModelo(null); },
  'cad-editar-modelo'(el) { return painelModelo(el.dataset.id); },
};
