/* KORbuild — telas dos cadastros na página oficial (docs/banco.md, fatia 2): Obras (e modelos de etapas),
 * Funcionários (e valor hora), Contatos e Regras (encargos e jornada). Os dados vêm de js/cadastros.js.
 * Mesmas frases e classes do protótipo (js/settings-telas.js, js/obras-telas.js), para o visual e a tradução
 * serem os mesmos. O mapa da obra e as linhas dos modelos reaproveitam js/obras-telas.js (só dependem dos ids). */

import { esc, toast, confirmar, dataCurta, dataHora, decimal, numTexto, hoje } from './util.js';
import { tr, tn } from './i18n.js';
import { icone } from './icones.js';
import { conta, pode } from './conta.js';
import { CLASSIFICACOES, FLSA, SITUACOES_FUNC, MODELOS_REGRA, ENCARGOS_INICIAIS, resumoRegra } from './settings.js';
import { PAPEIS } from './contatos.js';
import { SITUACOES_OBRA } from './obras.js';
import { NOMES_DIAS } from './prazos.js';
import { dinheiro } from './crew.js';
import { aposDesenharObras, aposDesenharModelo } from './obras-telas.js';
import {
  cad, carregar, jaLeu, funcionario, valoresDe, valorAtual, encargosVigentes, totalEncargos, certificacoesAVencer, vigente, historico, segundaDe,
  salvarFuncionario, novoValorHora, novosEncargos, novaRegra, contato, salvarContato, excluirContato, PAPEIS_CONTATO,
  obra, salvarObra, empresaExecuta, alocacoesDa, alocar, desalocar, RAIO_PADRAO, RAIO_MIN, RAIO_MAX, modelo, salvarModelo, excluirModelo,
} from './cadastros.js';

let redesenhar = () => {};
let ir = () => {};
export function ligarCadastros(fns) { redesenhar = fns.redesenhar; ir = fns.ir; }

/* As abas dos cadastros e a permissão de cada uma (catálogo em js/settings.js). */
export const ABAS_CADASTROS = [
  ['obras', 'Obras', 'settings.obras'],
  ['funcionarios', 'Funcionários', 'settings.funcionarios'],
  ['contatos', 'Contatos', 'settings.contatos'],
  ['regras', 'Regras', 'settings.regras'],
];
const PRECISA = {
  obras: ['obras', 'contatos', 'membros', 'alocacoes', 'funcionarios', 'modelos'],
  funcionarios: ['funcionarios', 'valores', 'encargos', 'regras', 'membros'],
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
    '<div class="oficial-cabeca"><h1 class="oficial-titulo">' + esc(titulo) + '</h1>' + (acoes || '') + '</div>';
}

/* Devolve { html, depois } ou { trocar }. Enquanto lê do banco, "Carregando…". */
export function telaCadastro(aba, resto) {
  const precisa = PRECISA[aba];
  if (!jaLeu(precisa)) {
    carregar(precisa).then(() => redesenhar()).catch(() => toast(tr('Sem conexão com o servidor. Confira a internet e tente de novo.')));
    return { html: '<p class="vazio">' + tr('Carregando…') + '</p>' };
  }
  if (aba === 'obras') {
    if (resto[0] === 'modelos') return resto[1] ? telaFormModelo(resto[1] === 'novo' ? null : resto[1]) : { html: telaModelos() };
    if (resto[0]) return telaFormObra(resto[0] === 'nova' ? null : resto[0]);
    return { html: telaObras() };
  }
  if (aba === 'funcionarios') {
    if (resto[0] === 'novo') return { html: telaFormFuncionario(null) };
    if (resto[0] && resto[0] !== 'desligados' && resto[0] !== 'todos') {
      if (!funcionario(resto[0])) return { trocar: '#/conta/funcionarios' };
      return { html: resto[1] === 'editar' ? telaFormFuncionario(resto[0]) : telaFuncionario(resto[0]) };
    }
    return { html: telaFuncionarios(resto[0] || '') };
  }
  if (aba === 'contatos') {
    if (resto[0]) return resto[0] === 'novo' || contato(resto[0]) ? { html: telaFormContato(resto[0] === 'novo' ? null : resto[0]) } : { trocar: '#/conta/contatos' };
    return { html: telaContatos() };
  }
  if (aba === 'regras') {
    if (resto[0] === 'encargos') return { html: telaFormEncargos() };
    if (resto[0] === 'jornada') return { html: telaFormRegra() };
    return { html: telaRegras() };
  }
  return { trocar: '#/conta' };
}

/* ---------- Funcionários ---------- */

const veValores = () => pode('settings.funcionarios') || pode('crew.custos');
function custoCarregado(f) { return valorAtual(f.id) * (1 + (f.classificacao === '1099' ? 0 : totalEncargos(encargosVigentes()))); }

function telaFuncionarios(filtro) {
  const lista = cad.funcionarios.filter((f) => (filtro === 'todos' ? true : filtro === 'desligados' ? f.situacao === 'desligado' : f.situacao !== 'desligado'));
  const abas = [['', tr('Ativos')], ['desligados', tr('Desligados')], ['todos', tr('Todos')]];
  const linhas = lista.map((f) => {
    const avisos = certificacoesAVencer(f);
    return '<tr><td><a href="#/conta/funcionarios/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.codigo || '') + '</span></td>' +
      '<td>' + esc(f.funcao) + '</td><td>' + esc(CLASSIFICACOES[f.classificacao] || '') + '</td>' +
      (veValores() ? '<td class="num"><b>' + dinheiro(valorAtual(f.id)) + '</b></td><td class="num">' + dinheiro(custoCarregado(f)) + '</td>' : '') +
      '<td>' + (f.situacao === 'ativo' ? '<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>' : '<span class="etiqueta etiqueta-neutro">' + SITUACOES_FUNC[f.situacao] + '</span>') +
        (avisos.length ? ' <span class="etiqueta etiqueta-ambar" title="' + esc(avisos.map((c) => c.nome).join(', ')) + '">' + tn(avisos.length, '{n} certificação a vencer', '{n} certificações a vencer') + '</span>' : '') + '</td></tr>';
  }).join('');
  return cabeca(tr('Funcionários'), '<a class="btn btn-primario btn-pequeno" href="#/conta/funcionarios/novo">' + icone('mais', 16) + tr('Novo funcionário') + '</a>') +
    '<p class="mudo">' + tr('Cadastro único da empresa: vale para o Crew, o Daily e o Measure') + '</p>' +
    '<nav class="abas-segmento abas-filtro" aria-label="' + tr('Filtro') + '">' + abas.map(([id, r]) => '<a href="#/conta/funcionarios' + (id ? '/' + id : '') + '"' + (filtro === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>' +
    '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-funcionarios"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('Função') + '</th><th>' + tr('Classificação') + '</th>' +
      (veValores() ? '<th class="num">' + tr('Valor hora') + '</th><th class="num">' + tr('Custo carregado') + '</th>' : '') + '<th>' + tr('Situação') + '</th></tr></thead><tbody>' +
      (linhas || '<tr><td colspan="6" class="mudo">' + tr('Nenhum funcionário.') + '</td></tr>') + '</tbody></table></div></section>' +
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
      (pode('settings.funcionarios') ? '<form id="form-valor-hora" class="grade-campos" data-id="' + f.id + '" onsubmit="return false">' +
        campo('vh-valor', tr('Novo valor hora (US$)'), '<input type="number" id="vh-valor" name="valor" min="1" step="0.01" inputmode="decimal">') +
        campo('vh-desde', tr('A partir de'), data('vh-desde', 'desde', proximaSegunda())) +
        campo('vh-motivo', tr('Motivo'), texto('vh-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: reajuste anual')) + '"')) +
      '</form><div class="btn-linha"><button type="button" class="btn btn-primario btn-pequeno" data-acao="cad-valor-hora">' + icone('dinheiro', 16) + tr('Alterar valor hora') + '</button></div>' : '') +
    '</section>' : '');
}

function telaFormFuncionario(id) {
  const f = id ? funcionario(id) : null;
  const v = f || { classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', admissao: hoje(), certificacoes: [] };
  const funcoes = Array.from(new Set(cad.funcionarios.map((x) => x.funcao))).sort();
  const certs = (v.certificacoes || []).concat([{}, {}]);
  return cabeca(f ? tr('Editar') + ' ' + f.nome : tr('Novo funcionário'), '', f ? ['#/conta/funcionarios/' + f.id, f.nome] : ['#/conta/funcionarios', tr('Funcionários')]) +
    '<form id="form-func" class="form-settings" data-id="' + (f ? f.id : '') + '" onsubmit="return false">' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Identificação') + '</h2><div class="grade-campos">' +
      campo('ff-nome', tr('Nome completo'), texto('ff-nome', 'nome', v.nome, ' autocomplete="off"')) +
      campo('ff-codigo', tr('Código (employee ID)'), texto('ff-codigo', 'codigo', v.codigo), tr('O mesmo do sistema de folha')) +
      campo('ff-telefone', tr('Telefone'), texto('ff-telefone', 'telefone', v.telefone, ' inputmode="tel"')) +
      campo('ff-emergencia', tr('Contato de emergência'), texto('ff-emergencia', 'emergencia', v.emergencia)) +
    '</div></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Contrato e trabalho') + '</h2><div class="grade-campos">' +
      campo('ff-classificacao', tr('Classificação'), '<select id="ff-classificacao" name="classificacao">' + opcoes(Object.entries(CLASSIFICACOES), v.classificacao) + '</select>', tr('Autônomo (1099) não tem hora extra nem encargos')) +
      campo('ff-flsa', 'FLSA', '<select id="ff-flsa" name="flsa">' + opcoes(Object.entries(FLSA), v.flsa) + '</select>', tr('Isento não recebe hora extra')) +
      campo('ff-funcao', tr('Função'), '<input type="text" id="ff-funcao" name="funcao" list="lista-funcoes" value="' + esc(v.funcao || '') + '"><datalist id="lista-funcoes">' + funcoes.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>') +
      campo('ff-admissao', tr('Admissão'), data('ff-admissao', 'admissao', v.admissao)) +
      campo('ff-situacao', tr('Situação'), '<select id="ff-situacao" name="situacao">' + opcoes(Object.entries(SITUACOES_FUNC), v.situacao) + '</select>') +
      campo('ff-desligamento', tr('Desligamento'), data('ff-desligamento', 'desligamento', v.desligamento), tr('Só quando desligado')) +
      (f ? '' : campo('ff-valorHora', tr('Valor hora inicial (US$)'), '<input type="number" id="ff-valorHora" name="valorHora" min="1" step="0.01" inputmode="decimal">', tr('Depois, mudanças ficam no histórico com data e motivo'))) +
    '</div></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Certificações') + '</h2><p class="mudo pequeno">' + tr('OSHA 10/30, licenças, operador de máquina… O sistema avisa 30 dias antes de vencer.') + '</p>' +
      certs.map((c, i) => '<div class="linha-cert"><input type="text" name="cert-nome-' + i + '" aria-label="' + tr('Certificação') + ' ' + (i + 1) + '" placeholder="' + tr('Certificação') + '" value="' + esc(c.nome || '') + '">' +
        '<input type="date" name="cert-validade-' + i + '" aria-label="' + tr('Validade da certificação') + ' ' + (i + 1) + '" value="' + esc(c.validade || '') + '"></div>').join('') +
    '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Privacidade') + '</h2><div class="grade-campos">' +
      campo('ff-avisoGps', tr('Aviso de localização aceito em'), data('ff-avisoGps', 'aviso_gps_em', v.aviso_gps_em), tr('O ponto com GPS só registra a localização com o ponto aberto')) +
    '</div></section>' +
    '<div class="rodape-form"><a class="btn btn-contorno" href="' + (f ? '#/conta/funcionarios/' + f.id : '#/conta/funcionarios') + '">' + tr('Cancelar') + '</a>' +
      '<button type="button" class="btn btn-primario" data-acao="cad-salvar-func">' + (f ? tr('Salvar alterações') : tr('Cadastrar funcionário')) + '</button></div></form>';
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
  return cabeca(tr('Regras'), '') +
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Encargos sobre a folha') + (enc ? ' · ' + tr('vigentes desde') + ' ' + dataCurta(enc.desde) : '') + '</h2>' +
      (edita ? '<a class="btn btn-primario btn-pequeno" href="#/conta/regras/encargos">' + tr('Nova versão') + '</a>' : '') + '</div>' +
      '<p class="mudo pequeno">' + tr('Labor burden: o que a empresa paga além do salário. Vale para todos os funcionários W-2') + '</p>' + encHtml +
      histTabela(cad.encargos, enc, [tr('A partir de'), tr('Total'), tr('Motivo'), tr('Registrado por')],
        (x) => '<td>' + dataCurta(x.desde) + etiquetaVigencia(x, enc) + '</td><td class="num">' + pct(totalEncargos(x)) + '</td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(autor(x.por)) + ' · ' + quando(x.em) + '</td>') +
    '</section>' +
    '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Regras de jornada') + (regra ? ' · ' + esc(regra.nome) : '') + '</h2>' +
      (edita ? '<a class="btn btn-primario btn-pequeno" href="#/conta/regras/jornada">' + tr('Nova versão') + '</a>' : '') + '</div>' +
      '<p class="mudo pequeno">' + tr('Hora extra e intervalo usados no ponto, nos timesheets e nos custos') + '</p>' + regraHtml +
      histTabela(cad.regras, regra, [tr('Semana de'), tr('Regra'), tr('Motivo'), tr('Registrado por')],
        (x) => '<td>' + dataCurta(x.desde) + etiquetaVigencia(x, regra) + '</td><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno bloco">' + esc(resumoRegra(x)) + '</span></td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(autor(x.por)) + ' · ' + quando(x.em) + '</td>') +
    '</section>' +
    '<p class="dica">' + tr('Mudanças valem da semana atual em diante: semanas fechadas não mudam, e cada versão fica no histórico com o motivo.') + '</p>';
}

function telaFormEncargos() {
  const v = encargosVigentes();
  const linhas = (v ? v.itens : ENCARGOS_INICIAIS).concat([{ nome: '', pct: '' }, { nome: '', pct: '' }]);
  return cabeca(tr('Nova versão dos encargos'), '', ['#/conta/regras', tr('Regras')]) +
    '<form id="form-encargos" class="form-settings" onsubmit="return false"><section class="cartao">' +
      '<p class="mudo pequeno">' + tr('Os custos de antes da data continuam com os encargos da época. Para tirar um item, apague o nome.') + '</p>' +
      linhas.map((i, n) => '<div class="linha-encargo"><input type="text" name="nome-' + n + '" aria-label="' + tr('Encargo') + ' ' + (n + 1) + '" placeholder="' + tr('Novo encargo') + '" value="' + esc(i.nome) + '">' +
        '<span class="campo-pct"><input type="number" name="pct-' + n + '" aria-label="' + tr('Percentual do encargo') + ' ' + (n + 1) + '" min="0" max="100" step="0.01" value="' + esc(String(i.pct)) + '" inputmode="decimal">%</span></div>').join('') +
      '<div class="grade-campos">' + campo('enc-desde', tr('Vale a partir de'), data('enc-desde', 'desde', segundaDe(hoje())), tr('A partir da semana atual; semanas fechadas não mudam')) +
        campo('enc-motivo', tr('Motivo'), texto('enc-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: nova taxa do workers\' comp na renovação da apólice')) + '"')) + '</div>' +
    '</section><div class="rodape-form"><a class="btn btn-contorno" href="#/conta/regras">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="cad-salvar-encargos">' + tr('Salvar nova versão') + '</button></div></form>';
}

function telaFormRegra() {
  const r = vigente(cad.regras) || { ...MODELOS_REGRA.federal };
  const numero = (nome, valor, rot, passo) => campo('rg-' + nome, rot, '<input type="number" id="rg-' + nome + '" name="' + nome + '" value="' + valor + '" min="0" step="' + (passo || '0.5') + '" inputmode="decimal">');
  return cabeca(tr('Nova versão da regra de jornada'), '', ['#/conta/regras', tr('Regras')]) +
    '<form id="form-regra" class="form-settings" onsubmit="return false">' +
    '<section class="cartao"><p class="mudo pequeno">' + tr('Preencher com um modelo (depois ajuste o que precisar):') + '</p><div class="btn-linha">' +
      Object.entries(MODELOS_REGRA).map(([id, m]) => '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="settings-modelo" data-modelo="' + id + '">' + esc(m.nome) + '</button>').join('') + '</div>' +
      campo('rg-nome', tr('Nome da regra'), texto('rg-nome', 'nome', r.nome)) + '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Hora extra semanal') + '</h2><div class="grade-campos">' +
      numero('semanal-limite', r.semanal.limite, tr('Acima de (horas na semana)')) + numero('semanal-fator', r.semanal.fator, tr('Fator'), '0.05') + '</div></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Hora extra diária') + '</h2>' +
      '<label class="check"><input type="checkbox" name="diaria-ativo" value="1"' + (r.diaria.ativo ? ' checked' : '') + '> ' + tr('Pagar hora extra por dia (além da semanal)') + '</label><div class="grade-campos">' +
      numero('diaria-limite', r.diaria.limite, tr('Acima de (horas no dia)')) + numero('diaria-fator', r.diaria.fator, tr('Fator'), '0.05') +
      numero('diaria-dobra', r.diaria.dobra, tr('Hora dobrada acima de (horas no dia)')) + numero('diaria-fatorDobra', r.diaria.fatorDobra, tr('Fator da dobrada'), '0.05') + '</div>' +
      '<p class="mudo pequeno">' + tr('A hora que já virou extra no dia não conta de novo para a semanal.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Intervalo') + '</h2><div class="grade-campos">' +
      numero('intervalo-minimo', r.intervalo.minimo, tr('Mínimo (minutos)'), '5') + numero('intervalo-apos', r.intervalo.apos, tr('Depois de (horas de trabalho)')) + '</div></section>' +
    '<section class="cartao"><div class="grade-campos">' +
      campo('rg-desde', tr('Vale a partir da semana de'), data('rg-desde', 'desde', segundaDe(hoje())), tr('A regra vale por semana inteira (de segunda a domingo); a data vai para a segunda')) +
      campo('rg-motivo', tr('Motivo'), texto('rg-motivo', 'motivo', '', ' placeholder="' + esc(tr('Ex.: acordo coletivo, obra em outro estado')) + '"')) + '</div></section>' +
    '<div class="rodape-form"><a class="btn btn-contorno" href="#/conta/regras">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="cad-salvar-regra">' + tr('Salvar nova versão') + '</button></div></form>';
}

/* ---------- Contatos ---------- */

function telaContatos() {
  const lista = cad.contatos;
  return cabeca(tr('Contatos'), '<a class="btn btn-primario btn-pequeno" href="#/conta/contatos/novo">' + icone('mais', 16) + tr('Novo contato') + '</a>') +
    '<p class="mudo">' + tr('Construtoras, clientes, fornecedores e prestadoras: um diretório só, com marcadores.') + '</p>' +
    '<section class="cartao"><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('Marcadores') + '</th><th>' + tr('Contato') + '</th><th>' + tr('Obras') + '</th></tr></thead><tbody>' +
      (lista.map((c) => {
        const obras = cad.obras.filter((o) => o.contratante_id === c.id || o.dono_id === c.id).length;
        return '<tr><td><a href="#/conta/contatos/' + c.id + '"><b>' + esc(c.nome) + '</b></a>' + (c.pessoa ? '<span class="mudo pequeno bloco">' + esc(c.pessoa) + '</span>' : '') + '</td>' +
          '<td>' + c.papeis.map((p) => '<span class="etiqueta etiqueta-neutro">' + esc((PAPEIS[p] || {}).nome || p) + '</span>').join(' ') + '</td>' +
          '<td class="pequeno">' + esc([c.email, c.telefone].filter(Boolean).join(' · ')) + '</td><td class="num">' + (obras || '') + '</td></tr>';
      }).join('') || '<tr><td colspan="4" class="mudo">' + tr('Nenhum contato ainda.') + '</td></tr>') +
    '</tbody></table></div></section>';
}

function telaFormContato(id) {
  const c = id ? contato(id) : { papeis: [], etapas: [] };
  return cabeca(id ? c.nome : tr('Novo contato'), '', ['#/conta/contatos', tr('Contatos')]) +
    '<form id="form-contato" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
    '<section class="cartao"><div class="grade-campos">' +
      campo('ct-nome', tr('Nome (empresa ou pessoa) *'), texto('ct-nome', 'nome', c.nome)) + campo('ct-pessoa', tr('Pessoa de contato'), texto('ct-pessoa', 'pessoa', c.pessoa)) +
      campo('ct-email', tr('E-mail'), '<input type="email" id="ct-email" name="email" value="' + esc(c.email || '') + '">') + campo('ct-telefone', tr('Telefone'), texto('ct-telefone', 'telefone', c.telefone, ' inputmode="tel"')) +
    '</div><fieldset class="dias-obra"><legend class="rotulo-pequeno">' + tr('Marcadores *') + '</legend>' +
      PAPEIS_CONTATO.map((p) => '<label class="check pequeno" title="' + esc((PAPEIS[p] || {}).dica || '') + '"><input type="checkbox" name="papeis" value="' + p + '"' + (c.papeis.includes(p) ? ' checked' : '') + '> ' + esc((PAPEIS[p] || {}).nome || p) + '</label>').join('') +
    '</fieldset></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Endereço') + '</h2>' + texto('ct-endereco', 'endereco', c.endereco, ' aria-label="' + tr('Endereço') + '"') +
      '<div class="grade-campos mz-grade-local">' + campo('ct-cidade', tr('Cidade'), texto('ct-cidade', 'cidade', c.cidade)) + campo('ct-estado', tr('Estado'), texto('ct-estado', 'estado', c.estado, ' maxlength="2"')) + campo('ct-zip', tr('ZIP code'), texto('ct-zip', 'zip', c.zip, ' maxlength="10"')) + '</div></section>' +
    '<section class="cartao">' + campo('ct-etapas', tr('Etapas que cota (fornecedor)'), texto('ct-etapas', 'etapas', (c.etapas || []).join(', ')), tr('Separadas por vírgula. Ex.: Framing, Siding')) +
      campo('ct-notas', tr('Notas'), '<textarea id="ct-notas" name="notas" rows="3">' + esc(c.notas || '') + '</textarea>') + '</section>' +
    '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="cad-excluir-contato" data-id="' + id + '">' + tr('Excluir') + '</button>' : '') +
      '<a class="btn btn-contorno" href="#/conta/contatos">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="cad-salvar-contato">' + (id ? tr('Salvar') : tr('Criar contato')) + '</button></div></form>';
}

/* ---------- Obras, alocações e modelos de etapas ---------- */

function telaObras() {
  const sit = (o) => SITUACOES_OBRA[o.situacao] || SITUACOES_OBRA.andamento;
  return cabeca(tr('Obras'), '<span class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/conta/obras/modelos">' + tr('Modelos de etapas') + '</a>' +
      '<a class="btn btn-primario btn-pequeno" href="#/conta/obras/nova">' + icone('mais', 16) + tr('Nova obra') + '</a></span>') +
    '<section class="cartao"><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Obra') + '</th><th>' + tr('Contratante') + '</th><th>' + tr('Prazo') + '</th><th>' + tr('Equipe') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>' +
      (cad.obras.map((o) => '<tr><td><a href="#/conta/obras/' + o.id + '"><b>' + esc(o.nome) + '</b></a><span class="mudo pequeno bloco">' + esc([o.municipio, o.estado].filter(Boolean).join(', ')) + '</span></td>' +
        '<td>' + esc((contato(o.contratante_id) || {}).nome || '') + '</td><td class="pequeno">' + dataCurta(o.inicio) + ' → ' + dataCurta(o.prazo) + '</td>' +
        '<td class="num">' + (alocacoesDa(o.id).filter((a) => !a.ate).length || '') + '</td><td><span class="etiqueta ' + sit(o).classe + '">' + sit(o).nome + '</span></td></tr>').join('') ||
        '<tr><td colspan="5" class="mudo">' + tr('Nenhuma obra ainda.') + '</td></tr>') +
    '</tbody></table></div></section>' +
    (cad.contatos.some((c) => c.papeis.includes('construtora') || c.papeis.includes('cliente')) ? '' : '<p class="dica">' + tr('Antes da primeira obra, cadastre o contratante em <a href="#/conta/contatos/novo">Contatos</a>.') + '</p>');
}

function telaFormObra(id) {
  const existente = id ? obra(id) : null;
  if (id && !existente) return { trocar: '#/conta/obras' };
  const o = existente || { raio: RAIO_PADRAO, dias_trabalho: [1, 2, 3, 4, 5], situacao: 'andamento', inicio: hoje() };
  const tem = Number.isFinite(o.lat) && Number.isFinite(o.lon);
  const centro = tem ? { lat: o.lat, lon: o.lon } : { lat: 43.0, lon: -71.46 };
  const executa = empresaExecuta();
  const perfilDoMembro = (m) => conta.perfis.find((p) => p.id === m.perfil_id);
  const preenchem = cad.membros.filter((m) => m.ativo && (perfilDoMembro(m) || { permissoes: [] }).permissoes.includes('daily.preencher'));
  const contratantes = cad.contatos.filter((c) => c.papeis.includes('construtora') || c.papeis.includes('cliente'));
  const html = cabeca(existente ? existente.nome : tr('Nova obra'), '', ['#/conta/obras', tr('Obras')]) +
    '<form id="form-obra" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Obra') + '</h2><div class="grade-campos">' +
      campo('ob-nome', tr('Nome da obra *'), texto('ob-nome', 'nome', o.nome, ' placeholder="' + esc(tr('Ex.: Residencial Thompson, Mezanino LogSul')) + '"')) +
      campo('ob-situacao', tr('Situação'), '<select id="ob-situacao" name="situacao">' + Object.entries(SITUACOES_OBRA).map(([k, s]) => '<option value="' + k + '"' + (o.situacao === k ? ' selected' : '') + '>' + s.nome + '</option>').join('') + '</select>') + '</div>' +
      '<p class="mudo pequeno">' + tr('Só obra em andamento cobra o diário e aparece no celular do campo e no ponto. Paralisada e concluída ficam no escritório, com o histórico.') + '</p></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Partes') + '</h2><div class="grade-campos">' +
      campo('ob-contratanteId', tr('Contratante * (recebe o diário)'), '<select id="ob-contratanteId" name="contratanteId"><option value="">' + tr('Escolha…') + '</option>' + opcoes(contratantes.map((c) => [c.id, c.nome]), o.contratante_id) + '</select>') +
      campo('ob-donoId', tr('Dono da obra (se for outro)'), '<select id="ob-donoId" name="donoId"><option value="">' + tr('O próprio contratante') + '</option>' + opcoes(contratantes.map((c) => [c.id, c.nome]), o.dono_id) + '</select>') + '</div>' +
      (contratantes.length ? '' : '<p class="mudo pequeno">' + tr('Antes da primeira obra, cadastre o contratante em <a href="#/conta/contatos/novo">Contatos</a>.') + '</p>') + '</section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + tr('Local e cerca do ponto') + '</h2>' +
      campo('ob-endereco', tr('Endereço'), texto('ob-endereco', 'endereco', o.endereco)) +
      '<div class="grade-campos mz-grade-local">' + campo('ob-municipio', tr('Cidade *'), texto('ob-municipio', 'municipio', o.municipio)) + campo('ob-estado', tr('Estado *'), texto('ob-estado', 'estado', o.estado, ' maxlength="2"')) + campo('ob-zip', tr('ZIP code'), texto('ob-zip', 'zip', o.zip, ' maxlength="10"')) + '</div>' +
      '<p class="mudo pequeno">' + tr('Clique no mapa onde fica a obra (ou use a localização atual, se estiver no canteiro). O círculo é a cerca: batida de ponto fora dela fica marcada para o escritório conferir. O mesmo local dá o clima do diário.') + '</p>' +
      '<div id="mapa-obra" class="mapa-obra" data-lat="' + centro.lat + '" data-lon="' + centro.lon + '" data-tem="' + (tem ? '1' : '') + '"><span class="mudo pequeno">' + tr('Carregando o mapa…') + '</span></div>' +
      '<div class="grade-campos mapa-obra-campos">' +
        campo('ob-lat', tr('Latitude *'), '<input type="text" inputmode="decimal" id="ob-lat" name="lat" value="' + (tem ? o.lat : '') + '">') +
        campo('ob-lon', tr('Longitude *'), '<input type="text" inputmode="decimal" id="ob-lon" name="lon" value="' + (tem ? o.lon : '') + '">') +
        campo('ob-raio', tr('Raio da cerca (m)'), '<input type="number" id="ob-raio" name="raio" min="' + RAIO_MIN + '" max="' + RAIO_MAX + '" step="10" value="' + (o.raio || RAIO_PADRAO) + '">') +
      '</div><button type="button" class="btn btn-contorno btn-pequeno" data-acao="obra-aqui">' + icone('pino', 16) + tr('Usar a localização atual') + '</button></section>' +
    '<section class="cartao"><h2 class="cartao-titulo">' + (executa ? tr('Prazo e diário de obra') : tr('Prazo')) + '</h2><div class="grade-campos">' +
      campo('ob-inicio', tr('Início *'), data('ob-inicio', 'inicio', o.inicio)) + campo('ob-prazo', tr('Prazo (término) *'), data('ob-prazo', 'prazo', o.prazo)) +
      (executa ? campo('ob-responsavelId', tr('Quem preenche o diário *'), '<select id="ob-responsavelId" name="responsavelId"><option value="">' + tr('Escolha…') + '</option>' + opcoes(preenchem.map((m) => [m.id, m.nome]), o.responsavel_id) + '</select>',
        preenchem.length ? '' : tr('Ninguém tem a permissão de preencher o diário: dê essa permissão a um perfil em Perfis de acesso.')) : '') + '</div>' +
      (executa ? '<fieldset class="dias-obra"><legend class="rotulo-pequeno">' + tr('Dias de trabalho * (cobram o diário)') + '</legend>' +
        [1, 2, 3, 4, 5, 6, 0].map((dia) => '<label class="check pequeno"><input type="checkbox" name="diasTrabalho" value="' + dia + '"' + ((o.dias_trabalho || []).includes(dia) ? ' checked' : '') + '> ' + NOMES_DIAS[dia] + '</label>').join('') + '</fieldset>'
        : '<p class="mudo pequeno">' + tr('O diário, o ponto e o cronograma são feitos pelas prestadoras, cada uma na obra dela ligada a esta.') + '</p>') +
    '</section>' +
    '<div class="rodape-form"><a class="btn btn-contorno" href="#/conta/obras">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="cad-salvar-obra">' + (existente ? tr('Salvar') : tr('Criar obra')) + '</button></div></form>' +
    (existente ? htmlEquipeDaObra(existente) : '');
  return { html, depois: aposDesenharObras };
}

/* Quem trabalha na obra: usuários (membros) e funcionários sem login. Uma pessoa pode estar em várias obras. */
function htmlEquipeDaObra(o) {
  const atuais = alocacoesDa(o.id).filter((a) => !a.ate);
  const nome = (a) => (a.membro_id ? (cad.membros.find((m) => m.id === a.membro_id) || {}).nome : (funcionario(a.funcionario_id) || {}).nome) || '—';
  const ja = new Set(atuais.map((a) => (a.membro_id ? 'm:' + a.membro_id : 'f:' + a.funcionario_id)));
  const escolhas = cad.membros.filter((m) => m.ativo).map((m) => ['m:' + m.id, m.nome + ' · ' + tr('usuário')])
    .concat(cad.funcionarios.filter((f) => f.situacao !== 'desligado').map((f) => ['f:' + f.id, f.nome + ' · ' + f.funcao])).filter(([k]) => !ja.has(k));
  return '<section class="cartao" id="equipe-obra"><h2 class="cartao-titulo">' + tr('Quem trabalha nesta obra') + '</h2>' +
    '<p class="mudo pequeno">' + tr('Uma pessoa pode estar em várias obras. O encarregado vê só as obras dele.') + '</p>' +
    (atuais.length ? '<ul class="lista-simples">' + atuais.map((a) => '<li><b>' + esc(nome(a)) + '</b>' + (a.papel ? ' · ' + esc(a.papel) : '') + (a.desde ? ' <span class="mudo pequeno">' + tr('desde') + ' ' + dataCurta(a.desde) + '</span>' : '') + ' ' +
      '<button type="button" class="link" data-acao="cad-desalocar" data-id="' + a.id + '">' + tr('Tirar') + '</button></li>').join('') + '</ul>' : '<p class="vazio">' + tr('Ninguém ainda.') + '</p>') +
    '<form id="form-alocar" class="grade-campos" data-obra="' + o.id + '" onsubmit="return false">' +
      campo('al-quem', tr('Pessoa'), '<select id="al-quem" name="quem"><option value="">' + tr('Escolha…') + '</option>' + opcoes(escolhas, '') + '</select>') +
      campo('al-papel', tr('Papel na obra'), texto('al-papel', 'papel', '', ' placeholder="' + esc(tr('Ex.: encarregado, carpinteiro')) + '"')) +
    '</form><div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="cad-alocar">' + icone('mais', 14) + tr('Incluir na obra') + '</button></div></section>';
}

function telaModelos() {
  const lista = cad.modelos;
  return cabeca(tr('Modelos de etapas'), '<a class="btn btn-primario btn-pequeno" href="#/conta/obras/modelos/novo">' + icone('mais', 16) + tr('Novo modelo') + '</a>', ['#/conta/obras', tr('Obras')]) +
    '<p class="mudo">' + tr('O cronograma inicial de cada tipo de obra ou serviço: etapas e a parte do prazo de cada uma') + '</p>' +
    (lista.length ? '<div class="grade-modelos">' + lista.map((m) => '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(m.nome) + '</h2><a class="link" href="#/conta/obras/modelos/' + m.id + '">' + tr('Editar') + '</a></div>' +
      '<ol class="lista-modelo">' + m.etapas.map((e) => '<li><span>' + esc(e.nome) + '</span><span class="barra-modelo"><span style="width:' + Math.round((e.pct / Math.max(...m.etapas.map((x) => x.pct))) * 100) + '%"></span></span><b>' + decimal(e.pct, e.pct % 1 ? 1 : 0) + '%</b></li>').join('') + '</ol></section>').join('') + '</div>'
      : '<p class="vazio">' + tr('Nenhum modelo ainda. Crie um com as etapas que a empresa sempre repete.') + '</p>');
}

const linhaModelo = (e) => '<div class="linha-modelo"><input type="text" name="etapaNome" value="' + esc(e.nome || '') + '" aria-label="' + tr('Etapa') + '" placeholder="' + esc(tr('Ex.: Framing do 1º pavimento')) + '">' +
  '<input type="text" inputmode="decimal" name="etapaPct" value="' + (e.pct != null ? e.pct : '') + '" aria-label="' + tr('Parte do prazo (%)') + '" placeholder="%">' +
  '<button type="button" class="btn-icone" data-acao="modelo-tirar-linha" aria-label="' + tr('Tirar etapa') + '" title="' + tr('Tirar etapa') + '">×</button></div>';

function telaFormModelo(id) {
  const m = id ? modelo(id) : { nome: '', etapas: [{ nome: '', pct: '' }] };
  if (!m) return { trocar: '#/conta/obras/modelos' };
  const html = cabeca(id ? m.nome : tr('Novo modelo'), '', ['#/conta/obras/modelos', tr('Modelos de etapas')]) +
    '<form id="form-modelo" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false"><section class="cartao">' +
      campo('md-nome', tr('Nome do modelo *'), '<input type="text" id="md-nome" name="nome" value="' + esc(m.nome) + '" placeholder="' + esc(tr('Ex.: Framing + siding (casa)')) + '">') +
      '<div class="cabeca-modelo rotulo-pequeno"><span>' + tr('Etapa, na ordem') + '</span><span>' + tr('Parte do prazo (%)') + '</span></div>' +
      '<div id="md-linhas">' + m.etapas.map(linhaModelo).join('') + '</div>' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="modelo-nova-linha">' + icone('mais', 14) + tr('Incluir etapa') + '</button>' +
      '<p class="pequeno" id="md-soma"></p>' +
      '<p class="mudo pequeno">' + tr('A parte do prazo diz quanto do período da obra cada etapa ocupa. As partes somam 100%. Ao criar a obra, as etapas entram em sequência.') + '</p>' +
    '</section><div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="cad-excluir-modelo" data-id="' + id + '">' + tr('Excluir') + '</button>' : '') +
      '<a class="btn btn-contorno" href="#/conta/obras/modelos">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="cad-salvar-modelo">' + (id ? tr('Salvar') : tr('Criar modelo')) + '</button></div></form>';
  return { html, depois: aposDesenharModelo };
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

export const acoesCadastros = {
  'cad-salvar-func'() {
    const f = form('form-func');
    const d = Object.fromEntries(new FormData(f).entries());
    d.certificacoes = [...f.querySelectorAll('.linha-cert')].map((_, i) => ({ nome: valor(f, 'cert-nome-' + i), validade: valor(f, 'cert-validade-' + i) }));
    const id = f.dataset.id || null;
    return resultado(salvarFuncionario(id, d), id ? tr('Cadastro salvo.') : tr('Funcionário cadastrado.'), (r) => '#/conta/funcionarios/' + (id || r.data));
  },
  'cad-valor-hora'() {
    const f = form('form-valor-hora');
    return resultado(novoValorHora(f.dataset.id, Object.fromEntries(new FormData(f).entries())), tr('Valor hora alterado.'));
  },
  'cad-salvar-encargos'() {
    const f = form('form-encargos');
    const itens = [...f.querySelectorAll('.linha-encargo')].map((_, i) => ({ nome: valor(f, 'nome-' + i), pct: valor(f, 'pct-' + i) }));
    return resultado(novosEncargos({ itens, desde: valor(f, 'desde'), motivo: valor(f, 'motivo') }), tr('Nova versão dos encargos salva.'), '#/conta/regras');
  },
  'cad-salvar-regra'() {
    const f = form('form-regra');
    const v = (k) => valor(f, k);
    return resultado(novaRegra({
      nome: v('nome'), desde: v('desde'), motivo: v('motivo'),
      semanalLimite: v('semanal-limite'), semanalFator: v('semanal-fator'), diariaAtivo: v('diaria-ativo'), diariaLimite: v('diaria-limite'), diariaFator: v('diaria-fator'),
      diariaDobra: v('diaria-dobra'), diariaFatorDobra: v('diaria-fatorDobra'), intervaloMinimo: v('intervalo-minimo'), intervaloApos: v('intervalo-apos'),
    }), tr('Nova regra salva.'), '#/conta/regras');
  },
  'cad-salvar-contato'() {
    const f = form('form-contato');
    const fd = new FormData(f);
    const id = f.dataset.id || null;
    return resultado(salvarContato(id, { ...Object.fromEntries(fd.entries()), papeis: fd.getAll('papeis') }), id ? tr('Contato salvo.') : tr('Contato criado.'), '#/conta/contatos');
  },
  async 'cad-excluir-contato'(el) {
    if (!(await confirmar(tr('Excluir este contato?'), '', tr('Excluir')))) return;
    resultado(excluirContato(el.dataset.id), tr('Contato excluído.'), '#/conta/contatos');
  },
  'cad-salvar-obra'() {
    const f = form('form-obra');
    const fd = new FormData(f);
    const id = f.dataset.id || null;
    return resultado(salvarObra(id, { ...Object.fromEntries(fd.entries()), diasTrabalho: fd.getAll('diasTrabalho') }), id ? tr('Obra atualizada.') : tr('Obra criada.'), (r) => '#/conta/obras/' + r.data);
  },
  'cad-alocar'() {
    const f = form('form-alocar');
    return resultado(alocar(f.dataset.obra, valor(f, 'quem'), valor(f, 'papel')), tr('Incluído na obra.'));
  },
  'cad-desalocar'(el) { return resultado(desalocar(el.dataset.id), tr('Tirado da obra.')); },
  'cad-salvar-modelo'() {
    const f = form('form-modelo');
    const fd = new FormData(f);
    const nomes = fd.getAll('etapaNome'), pcts = fd.getAll('etapaPct');
    return resultado(salvarModelo(f.dataset.id || null, { nome: fd.get('nome'), etapas: nomes.map((nome, i) => ({ nome, pct: pcts[i] })) }), tr('Modelo salvo.'), '#/conta/obras/modelos');
  },
  async 'cad-excluir-modelo'(el) {
    const m = modelo(el.dataset.id);
    if (!m || !(await confirmar(tr('Excluir o modelo "{nome}"?', { nome: m.nome }), tr('As obras que já usaram o modelo não mudam.'), tr('Excluir')))) return;
    resultado(excluirModelo(m.id), tr('Modelo excluído.'), '#/conta/obras/modelos');
  },
};
