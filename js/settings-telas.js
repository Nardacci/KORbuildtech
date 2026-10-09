/* KORbuild Settings — telas: funcionários, encargos, regras de jornada e auditoria.
 * Só o escritório (administrador) entra. */

import { esc, hoje, somarDias, diasEntre, dataCurta, dataHora, toast, abrirDialogo, decimal, numTexto } from './util.js';
import { tr, tn } from './i18n.js';
import { estado } from './armazem.js';
import { casca, usuarioAtual, pode, MODULOS } from './plataforma.js';
import { icone } from './icones.js';
import { dinheiro, valorAtual, equipe, inicioDaSemana } from './crew.js';
import {
  funcionarios, salvarFuncionario, certificacoesAVencer, CLASSIFICACOES, FLSA, SITUACOES_FUNC,
  regraEm, historicoRegras, novaRegra, resumoRegra, MODELOS_REGRA,
  encargosVersao, encargosEm, historicoEncargos, novosEncargos, auditoria, segundaDe,
  PERMISSOES, perfis, perfilDe, modulosDe, salvarPermissoes, criarPerfil, excluirPerfil, salvarUsuario,
} from './settings.js';
import { telaEmpresa, telaContatos, telaFormContato } from './contatos-telas.js';
import { telaObras, telaFormObra, telaModelos, telaFormModelo } from './obras-telas.js';

let app = { desenhar: () => {}, ir: () => {}, topoExtra: () => '' };
export function ligarSettings(funcoes) { app = { ...app, ...funcoes }; }

function nav() {
  const u = usuarioAtual();
  const itens = [];
  if (pode(u, 'settings.funcionarios')) {
    const alertas = funcionarios().filter((f) => f.situacao !== 'desligado' && certificacoesAVencer(f).length).length;
    itens.push({ id: 'funcionarios', href: '#/settings/funcionarios', rotulo: tr('Funcionários'), icone: 'crew', contador: alertas });
  }
  if (pode(u, 'settings.regras')) itens.push({ id: 'encargos', href: '#/settings/encargos', rotulo: tr('Encargos'), icone: 'dinheiro' }, { id: 'regras', href: '#/settings/regras', rotulo: tr('Jornada'), icone: 'relogio' });
  if (pode(u, 'settings.conta')) itens.push({ id: 'empresa', href: '#/settings/empresa', rotulo: tr('Empresa'), icone: 'obras' });
  if (pode(u, 'settings.obras')) itens.push({ id: 'obras', href: '#/settings/obras', rotulo: tr('Obras'), icone: 'obras' });
  if (pode(u, 'settings.contatos')) itens.push({ id: 'contatos', href: '#/settings/contatos', rotulo: tr('Contatos'), icone: 'link' });
  if (pode(u, 'settings.acesso')) itens.push({ id: 'usuarios', href: '#/settings/usuarios', rotulo: tr('Usuários'), icone: 'conta' }, { id: 'perfis', href: '#/settings/perfis', rotulo: tr('Perfis'), icone: 'aprovacoes' }, { id: 'auditoria', href: '#/settings/auditoria', rotulo: tr('Auditoria'), icone: 'historico' });
  return itens;
}

function moldura(o) {
  return casca({ modulo: 'settings', nav: nav(), largura: o.largo === false ? 'estreita' : 'larga', topoExtra: app.topoExtra(), ...o });
}

const pct = (v, casas) => decimal(v * 100, casas == null ? 2 : casas).replace(/[.,]00$/, '') + '%';
const num = (v) => numTexto(v);
const proximaSegunda = () => somarDias(segundaDe(hoje()), 7);

/* Rotas #/settings/... */
export function telaSettings(q) {
  const u = usuarioAtual();
  const precisa = { funcionarios: 'settings.funcionarios', funcionario: 'settings.funcionarios', encargos: 'settings.regras', regras: 'settings.regras', usuarios: 'settings.acesso', usuario: 'settings.acesso', perfis: 'settings.acesso', auditoria: 'settings.acesso', empresa: 'settings.conta', contatos: 'settings.contatos', contato: 'settings.contatos', obras: 'settings.obras', obra: 'settings.obras', modelos: 'settings.obras', modelo: 'settings.obras' };
  const primeira = nav()[0];
  if (!primeira) return { trocar: '#/inicio' };
  if (!q.length || (precisa[q[0]] && !pode(u, precisa[q[0]]))) return { trocar: primeira.href };
  if (q[0] === 'empresa') return telaEmpresa(moldura);
  if (q[0] === 'contatos') return telaContatos(moldura, q[1]);
  if (q[0] === 'contato' && q[1] === 'novo') return telaFormContato(moldura, null, q[2]);
  if (q[0] === 'contato' && q[1]) return telaFormContato(moldura, q[1]);
  if (q[0] === 'obras') return telaObras(moldura, q[1]);
  if (q[0] === 'obra' && q[1] === 'nova') return telaFormObra(moldura, null, q[2]);
  if (q[0] === 'obra' && q[1]) return telaFormObra(moldura, q[1]);
  if (q[0] === 'modelos') return telaModelos(moldura);
  if (q[0] === 'modelo' && q[1]) return telaFormModelo(moldura, q[1] === 'novo' ? null : q[1]);
  if (q[0] === 'usuarios') return telaUsuarios();
  if (q[0] === 'usuario') return telaFormUsuario(q[1] === 'novo' ? null : q[1]);
  if (q[0] === 'perfis') return telaPerfis();
  if (q[0] === 'funcionarios') return telaFuncionarios(q[1]);
  if (q[0] === 'funcionario' && q[1] === 'novo') return telaFormFuncionario(null);
  if (q[0] === 'funcionario' && q[2] === 'editar') return telaFormFuncionario(q[1]);
  if (q[0] === 'funcionario') return telaFuncionario(q[1]);
  if (q[0] === 'encargos' && q[1] === 'nova') return telaFormEncargos();
  if (q[0] === 'encargos') return telaEncargos();
  if (q[0] === 'regras' && q[1] === 'nova') return telaFormRegra();
  if (q[0] === 'regras') return telaRegras();
  if (q[0] === 'auditoria') return telaAuditoria();
  return { trocar: primeira.href };
}

/* ---------- Funcionários ---------- */

function situacaoCert(c) {
  if (!c.validade) return ('<span class="etiqueta etiqueta-neutro">' + tr('sem validade') + '</span>');
  const d = diasEntre(hoje(), c.validade);
  if (d < 0) return '<span class="etiqueta etiqueta-alerta">' + tn(-d, 'vencida há {n} dia', 'vencida há {n} dias') + '</span>';
  if (d <= 30) return '<span class="etiqueta etiqueta-ambar">' + tn(d, 'vence em {n} dia', 'vence em {n} dias') + '</span>';
  return ('<span class="etiqueta etiqueta-verde">' + tr('válida até') + ' ') + dataCurta(c.validade) + '</span>';
}

function custoCarregado(f) { return valorAtual(f) * (1 + (f.classificacao === '1099' ? 0 : encargosEm(hoje()))); }

function telaFuncionarios(filtro) {
  const todos = funcionarios();
  const lista = todos.filter((f) => (filtro === 'todos' ? true : filtro === 'desligados' ? f.situacao === 'desligado' : f.situacao !== 'desligado'))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const abas = [['', tr('Ativos')], ['desligados', tr('Desligados')], ['todos', tr('Todos')]];
  const linhas = lista.map((f) => {
    const avisos = certificacoesAVencer(f);
    return '<tr><td><a href="#/settings/funcionario/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.codigo || '') + '</span></td>' +
      '<td>' + esc(f.funcao) + '<span class="mudo pequeno bloco">' + esc((equipe(f.equipeId) || {}).nome || tr('Sem equipe')) + '</span></td>' +
      '<td>' + esc(CLASSIFICACOES[f.classificacao] || '') + '</td>' +
      '<td class="num"><b>' + dinheiro(valorAtual(f)) + '</b></td>' +
      '<td class="num">' + dinheiro(custoCarregado(f)) + '</td>' +
      '<td>' + (f.situacao === 'ativo' ? ('<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>') : '<span class="etiqueta etiqueta-neutro">' + SITUACOES_FUNC[f.situacao] + '</span>') +
        (avisos.length ? ' <span class="etiqueta etiqueta-ambar" title="' + esc(avisos.map((c) => c.nome).join(', ')) + '">' + tn(avisos.length, '{n} certificação a vencer', '{n} certificações a vencer') + '</span>' : '') + '</td></tr>';
  }).join('');
  return moldura({
    ativo: 'funcionarios', titulo: tr('Funcionários'), subtitulo: tr('Cadastro único da empresa: vale para o Crew, o Daily e o Measure'),
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/funcionario/novo">' + icone('mais', 16) + (tr('Novo funcionário') + '</a>'),
    conteudo: ('<nav class="abas-segmento" aria-label="' + tr('Filtro') + '">') + abas.map(([id, r]) => '<a href="#/settings/funcionarios' + (id ? '/' + id : '') + '"' + ((filtro || '') === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>' +
      ('<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-funcionarios"><thead><tr><th>' + tr('Nome') + '</th><th>' + tr('Função e equipe') + '</th><th>' + tr('Classificação') + '</th><th class="num">' + tr('Valor hora') + '</th><th class="num">' + tr('Custo carregado') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>') +
      (linhas || ('<tr><td colspan="6" class="mudo">' + tr('Nenhum funcionário.') + '</td></tr>')) + '</tbody></table></div></section>' +
      '<p class="dica">' + tr('Custo carregado = valor hora + {pct} de <a href="#/settings/encargos">encargos</a>. Autônomo (1099) não tem encargos nem hora extra.', { pct: pct(encargosEm(hoje())) }) + '</p>',
  });
}

function telaFuncionario(id) {
  const f = funcionarios().find((x) => x.id === id);
  if (!f) return { trocar: '#/settings/funcionarios' };
  const regra = regraEm(hoje());
  const hist = (f.valores || []).slice().sort((a, b) => (a.desde < b.desde ? 1 : -1));
  const linhasValor = hist.map((x, i) => {
    const ate = i > 0 ? somarDias(hist[i - 1].desde, -1) : null;
    const ant = hist[i + 1];
    const variacao = ant ? (x.valor - ant.valor) / ant.valor : null;
    const vigente = x.desde <= hoje() && (!ate || ate >= hoje());
    return '<tr' + (vigente ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + ' → ' + (ate ? dataCurta(ate) : (x.desde > hoje() ? '…' : tr('hoje'))) +
      (vigente ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futuro') + '</span>' : '') + '</td>' +
      '<td class="num"><b>' + dinheiro(x.valor) + '</b></td>' +
      '<td class="num">' + (variacao == null ? '—' : (variacao >= 0 ? '+' : '') + pct(variacao, 1)) + '</td>' +
      '<td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>';
  }).join('');
  const dado = (rot, v) => '<div><dt>' + rot + '</dt><dd>' + (v || '<span class="mudo">—</span>') + '</dd></div>';
  const autonomo = f.classificacao === '1099';
  return moldura({
    ativo: 'funcionarios', titulo: f.nome, subtitulo: f.funcao + ' · ' + ((equipe(f.equipeId) || {}).nome || tr('sem equipe')) + ' · ' + (CLASSIFICACOES[f.classificacao] || ''),
    voltar: { href: '#/settings/funcionarios', rotulo: tr('Funcionários') },
    acoes: '<a class="btn btn-contorno btn-pequeno" href="#/settings/funcionario/' + f.id + ('/editar">' + tr('Editar cadastro') + '</a>'),
    conteudo:
      '<div class="kpis kpis-3">' +
        ('<div class="kpi kpi-azul"><span>' + tr('Valor hora atual') + '</span><b>') + dinheiro(valorAtual(f)) + '</b></div>' +
        '<div class="kpi"><span>' + (autonomo || f.flsa === 'isento' ? tr('Hora extra') : tr('Hora extra (') + num(regra.semanal.fator) + tr('×)')) + '</span><b>' + (autonomo || f.flsa === 'isento' ? tr('Não se aplica') : dinheiro(valorAtual(f) * regra.semanal.fator)) + '</b></div>' +
        ('<div class="kpi"><span>' + tr('Custo carregado')) + (autonomo ? (' ' + tr('(sem encargos: 1099)')) : ' (+' + pct(encargosEm(hoje())) + (' ' + tr('encargos)'))) + '</span><b>' + dinheiro(custoCarregado(f)) + '</b></div>' +
      '</div>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Cadastro') + '</h2><dl class="dados-func">') +
        dado(tr('Código'), esc(f.codigo)) + dado(tr('Situação'), SITUACOES_FUNC[f.situacao] + (f.desligamento ? ' ' + tr('em') + ' ' + dataCurta(f.desligamento) : '')) +
        dado(tr('Função'), esc(f.funcao)) + dado(tr('Equipe'), esc((equipe(f.equipeId) || {}).nome || '')) +
        dado(tr('Classificação'), CLASSIFICACOES[f.classificacao]) + dado('FLSA', FLSA[f.flsa]) +
        dado(tr('Admissão'), f.admissao ? dataCurta(f.admissao) : '') + dado(tr('Telefone'), esc(f.telefone)) +
        dado(tr('Contato de emergência'), esc(f.emergencia)) + dado(tr('Aviso de localização aceito em'), f.avisoGps ? dataCurta(f.avisoGps) : '<span class="etiqueta etiqueta-ambar">' + tr('pendente') + '</span>') +
      ('</dl><p class="mudo pequeno">' + tr('SSN e documentos de imigração não ficam no KORbuild: ficam no sistema de folha. Aqui fica só o código para o cruzamento.') + '</p></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Certificações') + '</h2>') +
        ((f.certificacoes || []).length ? '<ul class="lista-cert">' + f.certificacoes.map((c) => '<li><b>' + esc(c.nome) + '</b>' + situacaoCert(c) + '</li>').join('') + '</ul>' : ('<p class="vazio">' + tr('Nenhuma certificação cadastrada.') + '</p>')) +
      '</section>' +
      ('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Histórico do valor hora') + '</h2>') +
        '<button type="button" class="btn btn-primario btn-pequeno" data-acao="crew-valor-hora" data-id="' + f.id + '">' + icone('dinheiro', 16) + ('<span>' + tr('Alterar valor hora') + '</span></button></div>') +
        ('<p class="mudo pequeno">' + tr('Cada mudança vale a partir de uma data e nunca apaga a anterior: as horas de cada dia são pagas e custeadas pelo valor vigente naquele dia.') + '</p>') +
        ('<div class="tabela-rolagem"><table class="tabela tabela-valores"><thead><tr><th>' + tr('Vigência') + '</th><th class="num">' + tr('Valor hora') + '</th><th class="num">' + tr('Variação') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>') + linhasValor + '</tbody></table></div></section>' +
      '<p class="dica"><a href="#/crew/semana/' + f.id + '/' + inicioDaSemana(hoje()) + ('">' + tr('Ver as horas desta semana no Crew') + '</a></p>'),
  });
}

function opcoes(lista, atual) {
  return lista.map(([v, r]) => '<option value="' + esc(v) + '"' + (v === atual ? ' selected' : '') + '>' + esc(r) + '</option>').join('');
}

function telaFormFuncionario(id) {
  const f = id ? funcionarios().find((x) => x.id === id) : null;
  if (id && !f) return { trocar: '#/settings/funcionarios' };
  const v = f || { classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo', admissao: hoje(), certificacoes: [] };
  const funcoes = Array.from(new Set((estado().settings.funcoes || []).concat(funcionarios().map((x) => x.funcao)))).sort();
  const campo = (nome, rot, html, dica) => '<div class="campo"><label class="rotulo-pequeno" for="ff-' + nome + '">' + rot + '</label>' + html + (dica ? '<span class="mudo pequeno">' + dica + '</span>' : '') + '</div>';
  const texto = (nome, valor, extra) => '<input type="text" id="ff-' + nome + '" name="' + nome + '" value="' + esc(valor || '') + '"' + (extra || '') + '>';
  const data = (nome, valor) => '<input type="date" id="ff-' + nome + '" name="' + nome + '" value="' + esc(valor || '') + '">';
  const certs = (v.certificacoes || []).concat([{}, {}]);
  return moldura({
    ativo: 'funcionarios', largo: false, titulo: f ? (tr('Editar') + ' ') + f.nome : tr('Novo funcionário'),
    voltar: f ? { href: '#/settings/funcionario/' + f.id, rotulo: f.nome } : { href: '#/settings/funcionarios', rotulo: tr('Funcionários') },
    conteudo: '<form id="form-func" class="form-settings" data-id="' + (f ? f.id : '') + '" onsubmit="return false">' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Identificação') + '</h2><div class="grade-campos">') +
        campo('nome', tr('Nome completo'), texto('nome', v.nome, ' autocomplete="off"')) +
        campo('codigo', tr('Código (employee ID)'), texto('codigo', v.codigo), tr('O mesmo do sistema de folha')) +
        campo('telefone', tr('Telefone'), texto('telefone', v.telefone, ' inputmode="tel"')) +
        campo('emergencia', tr('Contato de emergência'), texto('emergencia', v.emergencia)) +
      '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Contrato e trabalho') + '</h2><div class="grade-campos">') +
        campo('classificacao', tr('Classificação'), '<select id="ff-classificacao" name="classificacao">' + opcoes(Object.entries(CLASSIFICACOES), v.classificacao) + '</select>', tr('Autônomo (1099) não tem hora extra nem encargos')) +
        campo('flsa', 'FLSA', '<select id="ff-flsa" name="flsa">' + opcoes(Object.entries(FLSA), v.flsa) + '</select>', tr('Isento não recebe hora extra')) +
        campo('funcao', tr('Função'), '<input type="text" id="ff-funcao" name="funcao" list="lista-funcoes" value="' + esc(v.funcao || '') + '"><datalist id="lista-funcoes">' + funcoes.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>') +
        campo('equipeId', tr('Equipe'), ('<select id="ff-equipeId" name="equipeId"><option value="">' + tr('Sem equipe') + '</option>') + opcoes(estado().crew.equipes.map((e) => [e.id, e.nome]), v.equipeId) + '</select>') +
        campo('admissao', tr('Admissão'), data('admissao', v.admissao)) +
        campo('situacao', tr('Situação'), '<select id="ff-situacao" name="situacao">' + opcoes(Object.entries(SITUACOES_FUNC), v.situacao) + '</select>') +
        campo('desligamento', tr('Desligamento'), data('desligamento', v.desligamento), tr('Só quando desligado')) +
        (f ? '' : campo('valorHora', tr('Valor hora inicial (US$)'), '<input type="number" id="ff-valorHora" name="valorHora" min="1" step="0.01" inputmode="decimal">', tr('Depois, mudanças ficam no histórico com data e motivo'))) +
      '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Certificações') + '</h2><p class="mudo pequeno">' + tr('OSHA 10/30, licenças, operador de máquina… O sistema avisa 30 dias antes de vencer.') + '</p>') +
        certs.map((c, i) => '<div class="linha-cert"><input type="text" name="cert-nome-' + i + ('" aria-label="' + tr('Certificação') + ' ') + (i + 1) + ('" placeholder="' + tr('Certificação') + '" value="') + esc(c.nome || '') + '">' +
          '<input type="date" name="cert-validade-' + i + ('" aria-label="' + tr('Validade da certificação') + ' ') + (i + 1) + '" value="' + esc(c.validade || '') + '"></div>').join('') +
      '</section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Privacidade') + '</h2><div class="grade-campos">') +
        campo('avisoGps', tr('Aviso de localização aceito em'), data('avisoGps', v.avisoGps), tr('O ponto com GPS só registra a localização com o ponto aberto')) +
      '</div></section>' +
      '<div class="rodape-form"><a class="btn btn-contorno" href="' + (f ? '#/settings/funcionario/' + f.id : '#/settings/funcionarios') + ('">' + tr('Cancelar') + '</a>') +
        '<button type="button" class="btn btn-primario" data-acao="settings-salvar-func">' + (f ? tr('Salvar alterações') : tr('Cadastrar funcionário')) + '</button></div>' +
    '</form>',
  });
}

/* ---------- Encargos ---------- */

function telaEncargos() {
  const v = encargosVersao(hoje());
  const total = encargosEm(hoje());
  const futuro = historicoEncargos().find((x) => x.desde > hoje());
  const exemplo = 30;
  return moldura({
    ativo: 'encargos', titulo: tr('Encargos sobre a folha'), subtitulo: tr('Labor burden: o que a empresa paga além do salário. Vale para todos os funcionários W-2'),
    acoes: ('<a class="btn btn-primario btn-pequeno" href="#/settings/encargos/nova">' + tr('Nova versão') + '</a>'),
    conteudo:
      (futuro ? '<p class="aviso-info">' + icone('relogio', 16) + (tr('Há uma versão programada a partir de') + ' ') + dataCurta(futuro.desde) + ' (' + pct(futuro.itens.reduce((t, i) => t + i.pct, 0) / 100) + ').</p>' : '') +
      ('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Vigentes desde') + ' ') + dataCurta(v.desde) + '</h2><b class="total-encargos">' + pct(total) + '</b></div>' +
        '<table class="tabela"><tbody>' + v.itens.map((i) => '<tr><td>' + esc(i.nome) + '</td><td class="num"><b>' + num(i.pct) + '%</b></td></tr>').join('') +
        ('<tr class="linha-total"><td>' + tr('Total sobre o salário') + '</td><td class="num"><b>') + pct(total) + '</b></td></tr></tbody></table>' +
        ('<p class="mudo pequeno">' + tr('Exemplo: quem ganha') + ' ') + dinheiro(exemplo) + (tr('/h custa') + ' ') + dinheiro(exemplo * (1 + total)) + (tr('/h para a empresa. Autônomos (1099) não têm encargos.') + '</p></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Histórico de versões') + '</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('A partir de') + '</th><th class="num">' + tr('Total') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>') +
        historicoEncargos().map((x) => '<tr' + (x === v ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (x === v ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futuro') + '</span>' : '') + '</td><td class="num">' + pct(x.itens.reduce((t, i) => t + i.pct, 0) / 100) + '</td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      ('<p class="dica">' + tr('Os % dependem do estado e da seguradora: confira com o contador. Simplificação do protótipo: FUTA e SUTA incidem sobre todo o salário (na prática, só até o teto anual de cada um).') + '</p>'),
  });
}

function telaFormEncargos() {
  const v = encargosVersao(hoje());
  const linhas = v.itens.concat([{ nome: '', pct: '' }, { nome: '', pct: '' }]);
  return moldura({
    ativo: 'encargos', largo: false, titulo: tr('Nova versão dos encargos'), voltar: { href: '#/settings/encargos', rotulo: tr('Encargos') },
    conteudo: '<form id="form-encargos" class="form-settings" onsubmit="return false"><section class="cartao">' +
      ('<p class="mudo pequeno">' + tr('Os custos de antes da data continuam com os encargos da época. Para tirar um item, apague o nome.') + '</p>') +
      linhas.map((i, n) => '<div class="linha-encargo"><input type="text" name="nome-' + n + ('" aria-label="' + tr('Encargo') + ' ') + (n + 1) + ('" placeholder="' + tr('Novo encargo') + '" value="') + esc(i.nome) + '">' +
        '<span class="campo-pct"><input type="number" name="pct-' + n + ('" aria-label="' + tr('Percentual do encargo') + ' ') + (n + 1) + '" min="0" max="100" step="0.01" value="' + esc(String(i.pct)) + '" inputmode="decimal">%</span></div>').join('') +
      ('<div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="enc-desde">' + tr('Vale a partir de') + '</label><input type="date" id="enc-desde" name="desde" value="') + proximaSegunda() + ('"><span class="mudo pequeno">' + tr('A partir da semana atual; semanas fechadas não mudam') + '</span></div>') +
      ('<div class="campo"><label class="rotulo-pequeno" for="enc-motivo">' + tr('Motivo') + ('</label><input type="text" id="enc-motivo" name="motivo" placeholder="' + tr('Ex.: nova taxa do workers\' comp na renovação da apólice') + '"></div></div>')) +
      ('</section><div class="rodape-form"><a class="btn btn-contorno" href="#/settings/encargos">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="settings-salvar-encargos">' + tr('Salvar nova versão') + '</button></div></form>'),
  });
}

/* ---------- Regras de jornada ---------- */

function telaRegras() {
  const r = regraEm(hoje());
  const futura = historicoRegras().find((x) => x.desde > hoje());
  const item = (titulo, texto) => '<li><b>' + titulo + '</b><span>' + texto + '</span></li>';
  return moldura({
    ativo: 'regras', titulo: tr('Regras de jornada'), subtitulo: tr('Hora extra e intervalo usados no ponto, nos timesheets e nos custos'),
    acoes: ('<a class="btn btn-primario btn-pequeno" href="#/settings/regras/nova">' + tr('Nova versão') + '</a>'),
    conteudo:
      (futura ? '<p class="aviso-info">' + icone('relogio', 16) + (tr('Há uma regra programada a partir da semana de') + ' ') + dataCurta(futura.desde) + ': ' + esc(futura.nome) + '.</p>' : '') +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(r.nome) + ('</h2><span class="etiqueta etiqueta-verde">' + tr('vigente desde') + ' ') + dataCurta(r.desde) + '</span></div>' +
        '<ul class="lista-regras">' +
          item(tr('Hora extra semanal'), tr('Acima de') + ' ' + num(r.semanal.limite) + (' ' + tr('h na semana (segunda a domingo):') + ' ') + num(r.semanal.fator) + tr('×')) +
          item(tr('Hora extra diária'), r.diaria.ativo ? (tr('Acima de') + ' ') + num(r.diaria.limite) + (' ' + tr('h no dia:') + ' ') + num(r.diaria.fator) + (tr('×; acima de') + ' ') + num(r.diaria.dobra) + ' h: ' + num(r.diaria.fatorDobra) + tr('×') : tr('Não se aplica')) +
          item(tr('Intervalo'), num(r.intervalo.minimo) + (' ' + tr('min depois de') + ' ') + num(r.intervalo.apos) + (' ' + tr('h de trabalho (gera alerta se faltar)'))) +
          item(tr('Arredondamento'), tr('Nenhum: paga-se o minuto (princípio do produto)')) +
        '</ul>' + (r.nota ? '<p class="mudo pequeno">' + esc(r.nota) + '</p>' : '') + '</section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Histórico de versões') + '</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Semana de') + '</th><th>' + tr('Regra') + '</th><th>' + tr('Motivo') + '</th><th>' + tr('Registrado por') + '</th></tr></thead><tbody>') +
        historicoRegras().map((x) => '<tr' + (x === r ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (x === r ? ' <span class="etiqueta etiqueta-verde">' + tr('vigente') + '</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">' + tr('futura') + '</span>' : '') + '</td><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno bloco">' + esc(resumoRegra(x)) + '</span></td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      ('<p class="dica">' + tr('A regra não fica presa a um estado: os modelos só preenchem o formulário, e a empresa ajusta (acordo sindical, política interna). Próximo passo: regra por obra, para quem trabalha em mais de um estado.') + '</p>'),
  });
}

function telaFormRegra() {
  const r = regraEm(hoje());
  const numero = (nome, valor, rot, passo) => '<div class="campo"><label class="rotulo-pequeno" for="rg-' + nome + '">' + rot + '</label><input type="number" id="rg-' + nome + '" name="' + nome + '" value="' + valor + '" min="0" step="' + (passo || '0.5') + '" inputmode="decimal"></div>';
  return moldura({
    ativo: 'regras', largo: false, titulo: tr('Nova versão da regra de jornada'), voltar: { href: '#/settings/regras', rotulo: tr('Regras de jornada') },
    conteudo: '<form id="form-regra" class="form-settings" onsubmit="return false">' +
      ('<section class="cartao"><p class="mudo pequeno">' + tr('Preencher com um modelo (depois ajuste o que precisar):') + '</p><div class="btn-linha">') +
        Object.entries(MODELOS_REGRA).map(([id, m]) => '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="settings-modelo" data-modelo="' + id + '">' + esc(m.nome) + '</button>').join('') + '</div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="rg-nome">' + tr('Nome da regra') + '</label><input type="text" id="rg-nome" name="nome" value="') + esc(r.nome) + '"></div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Hora extra semanal') + '</h2><div class="grade-campos">') +
        numero('semanal-limite', r.semanal.limite, tr('Acima de (horas na semana)')) + numero('semanal-fator', r.semanal.fator, tr('Fator'), '0.05') + '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Hora extra diária') + '</h2>') +
        '<label class="check"><input type="checkbox" name="diaria-ativo" value="1"' + (r.diaria.ativo ? ' checked' : '') + ('> ' + tr('Pagar hora extra por dia (além da semanal)') + '</label><div class="grade-campos">') +
        numero('diaria-limite', r.diaria.limite, tr('Acima de (horas no dia)')) + numero('diaria-fator', r.diaria.fator, tr('Fator'), '0.05') +
        numero('diaria-dobra', r.diaria.dobra, tr('Hora dobrada acima de (horas no dia)')) + numero('diaria-fatorDobra', r.diaria.fatorDobra, tr('Fator da dobrada'), '0.05') + '</div>' +
        ('<p class="mudo pequeno">' + tr('A hora que já virou extra no dia não conta de novo para a semanal.') + '</p></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Intervalo') + '</h2><div class="grade-campos">') +
        numero('intervalo-minimo', r.intervalo.minimo, tr('Mínimo (minutos)'), '5') + numero('intervalo-apos', r.intervalo.apos, tr('Depois de (horas de trabalho)')) + '</div></section>' +
      ('<section class="cartao"><div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="rg-desde">' + tr('Vale a partir da semana de') + '</label><input type="date" id="rg-desde" name="desde" value="') + proximaSegunda() + ('"><span class="mudo pequeno">' + tr('A regra vale por semana inteira (de segunda a domingo); a data vai para a segunda') + '</span></div>') +
        ('<div class="campo"><label class="rotulo-pequeno" for="rg-motivo">' + tr('Motivo') + '</label><input type="text" id="rg-motivo" name="motivo" placeholder="' + tr('Ex.: acordo coletivo, obra em outro estado') + '"></div></div></section>') +
      ('<div class="rodape-form"><a class="btn btn-contorno" href="#/settings/regras">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="settings-salvar-regra">' + tr('Salvar nova versão') + '</button></div></form>'),
  });
}

/* ---------- Usuários ---------- */

function telaUsuarios() {
  const us = estado().usuarios.slice().sort((a, b) => (b.ativo - a.ativo) || a.nome.localeCompare(b.nome));
  return moldura({
    ativo: 'usuarios', titulo: tr('Usuários'), subtitulo: tr('Quem entra no KORbuild e com qual perfil de acesso'),
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/usuario/novo">' + icone('mais', 16) + (tr('Novo usuário') + '</a>'),
    conteudo: ('<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-usuarios-settings"><thead><tr><th>' + tr('Usuário') + '</th><th>' + tr('Perfil de acesso') + '</th><th>' + tr('Funcionário') + '</th><th>' + tr('Situação') + '</th><th>' + tr('Último acesso') + '</th></tr></thead><tbody>') +
      us.map((x) => {
        const f = x.funcionarioId && funcionarios().find((y) => y.id === x.funcionarioId);
        return '<tr><td><a href="#/settings/usuario/' + x.id + '"><b>' + esc(x.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(x.email) + '</span></td>' +
          '<td><span class="etiqueta etiqueta-neutro">' + esc((perfilDe(x) || {}).nome || '—') + '</span></td>' +
          '<td>' + (f ? esc(f.nome) + '<span class="mudo pequeno bloco">' + esc(f.codigo || '') + '</span>' : '<span class="mudo">—</span>') + '</td>' +
          '<td>' + (x.ativo ? ('<span class="etiqueta etiqueta-verde">' + tr('Ativo') + '</span>') : ('<span class="etiqueta etiqueta-neutro">' + tr('Inativo') + '</span>')) + '</td>' +
          '<td>' + (x.ultimoAcesso ? dataHora(x.ultimoAcesso) : ('<span class="mudo">' + tr('Nunca') + '</span>')) + '</td></tr>';
      }).join('') + '</tbody></table></div></section>' +
      ('<p class="dica">' + tr('Usuário é quem tem login. Funcionário é quem trabalha nas obras. O trabalhador que bate o próprio ponto precisa dos dois, ligados. Quem só tem o ponto batido pelo encarregado não precisa de login.') + '</p>'),
  });
}

function descricaoInicio(p) {
  const mods = modulosDe({ perfilId: p.id });
  if (!mods.length) return tr('Sem acesso');
  if (mods.length === 1) {
    if (mods[0] === 'crew' && p.permissoes.length === 1 && p.permissoes[0] === 'crew.ponto.proprio') return tr('Direto no "Meu ponto", sem a tela de módulos');
    return (tr('Direto no') + ' ') + (MODULOS.find((m) => m.id === mods[0]) || {}).nome + tr(', sem a tela de módulos');
  }
  return tr('Tela de módulos (') + mods.map((id) => (MODULOS.find((m) => m.id === id) || {}).nome).join(', ') + ')';
}

function telaFormUsuario(id) {
  const x = id ? estado().usuarios.find((y) => y.id === id) : null;
  if (id && !x) return { trocar: '#/settings/usuarios' };
  const v = x || { ativo: true, perfilId: 'trabalhador' };
  const livres = funcionarios().filter((f) => f.situacao !== 'desligado' && (!estado().usuarios.some((y) => y.funcionarioId === f.id) || f.id === v.funcionarioId));
  return moldura({
    ativo: 'usuarios', largo: false, titulo: x ? x.nome : tr('Novo usuário'), voltar: { href: '#/settings/usuarios', rotulo: tr('Usuários') },
    conteudo: '<form id="form-usuario" class="form-settings" data-id="' + (x ? x.id : '') + '" onsubmit="return false"><section class="cartao"><div class="grade-campos">' +
        ('<div class="campo"><label class="rotulo-pequeno" for="us-nome">' + tr('Nome') + '</label><input type="text" id="us-nome" name="nome" value="') + esc(v.nome || '') + '"></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="us-email">' + tr('E-mail (login)') + '</label><input type="email" id="us-email" name="email" value="') + esc(v.email || '') + '"></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="us-cargo">' + tr('Cargo') + '</label><input type="text" id="us-cargo" name="cargo" value="') + esc(v.cargo || '') + '"></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="us-func">' + tr('Cadastro de funcionário') + '</label><select id="us-func" name="funcionarioId"><option value="">' + tr('Não é funcionário de obra') + '</option>') +
          livres.map((f) => '<option value="' + f.id + '"' + (f.id === v.funcionarioId ? ' selected' : '') + '>' + esc(f.nome) + ' · ' + esc(f.funcao) + '</option>').join('') + '</select></div>' +
      '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Perfil de acesso') + '</h2><div class="opcoes-perfil">') +
        perfis().map((p) => '<label class="opcao-perfil"><input type="radio" name="perfilId" value="' + p.id + '"' + (p.id === v.perfilId ? ' checked' : '') + '>' +
          '<span><b>' + esc(p.nome) + '</b><span class="mudo pequeno">' + esc(p.descricao || '') + '</span><span class="pequeno inicio-perfil">' + icone('seta', 14) + esc(descricaoInicio(p)) + '</span></span></label>').join('') +
      ('</div><p class="mudo pequeno">' + tr('O que cada perfil pode fazer está em') + ' <a href="#/settings/perfis">' + tr('Perfis de acesso') + '</a>.</p></section>') +
      (x ? '<section class="cartao"><label class="check"><input type="checkbox" name="ativo" value="1"' + (v.ativo ? ' checked' : '') + ('> ' + tr('Acesso ativo (desmarque para bloquear o login)') + '</label></section>') : '') +
      ('<div class="rodape-form"><a class="btn btn-contorno" href="#/settings/usuarios">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="settings-salvar-usuario">') + (x ? tr('Salvar') : tr('Criar usuário')) + '</button></div>' +
    '</form>',
  });
}

/* ---------- Perfis de acesso: matriz de permissões ---------- */

function telaPerfis() {
  const ps = perfis();
  const usando = (p) => estado().usuarios.filter((u) => u.perfilId === p.id && u.ativo).length;
  const cab = ('<tr><th>' + tr('Permissão') + '</th>') + ps.map((p) => '<th class="col-perfil"><b>' + esc(p.nome) + '</b><span class="mudo pequeno bloco">' + usando(p) + (usando(p) === 1 ? (' ' + tr('usuário')) : (' ' + tr('usuários'))) + (p.sistema ? (' ' + tr('· fixo')) : '') + '</span>' +
    (!p.sistema && !usando(p) ? '<button type="button" class="link-botao pequeno" data-acao="settings-excluir-perfil" data-id="' + p.id + '">' + tr('excluir') + '</button>' : '') + '</th>').join('') + '</tr>';
  const linhas = PERMISSOES.map((g) => '<tr class="grupo"><th colspan="' + (ps.length + 1) + '">' + esc(g.grupo) + '</th></tr>' +
    g.itens.map((i) => '<tr><th class="nome-perm"><b>' + esc(i.nome) + '</b><span class="mudo pequeno bloco">' + esc(i.descricao) + (i.requer ? (' ' + tr('· inclui "')) + esc(i.requer.map((r) => PERMISSOES.flatMap((x) => x.itens).find((y) => y.id === r).nome).join(', ')) + '"' : '') + '</span></th>' +
      ps.map((p) => '<td class="celula-perm"><input type="checkbox" name="' + p.id + '|' + i.id + '" aria-label="' + esc(p.nome + ': ' + i.nome) + '"' + (p.permissoes.includes(i.id) ? ' checked' : '') + (p.sistema ? ' disabled' : '') + '></td>').join('') + '</tr>').join('')).join('') +
    ('<tr class="linha-inicio"><th>' + tr('Ao entrar') + '</th>') + ps.map((p) => '<td class="pequeno">' + esc(descricaoInicio(p)) + '</td>').join('') + '</tr>';
  return moldura({
    ativo: 'perfis', titulo: tr('Perfis de acesso'), subtitulo: tr('O que cada perfil pode fazer. Nada fica fixo no código: crie perfis e ajuste as permissões'),
    acoes: '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="settings-novo-perfil">' + icone('mais', 16) + (tr('Novo perfil') + '</button>') +
      ('<button type="button" class="btn btn-primario btn-pequeno" data-acao="settings-salvar-perfis">' + tr('Salvar permissões') + '</button></div>'),
    conteudo: '<form id="form-perfis" onsubmit="return false"><section class="cartao"><div class="tabela-rolagem"><table class="tabela matriz-perfis"><thead>' + cab + '</thead><tbody>' + linhas + '</tbody></table></div></section></form>' +
      ('<p class="dica">' + tr('O perfil Administrador é fixo, para a empresa nunca ficar sem quem gerencie os acessos. Para um administrador que também preenche o RDO, crie um perfil novo a partir dele. Toda mudança vai para a auditoria.') + '</p>'),
  });
}

/* ---------- Auditoria ---------- */

function telaAuditoria() {
  const lista = auditoria();
  return moldura({
    ativo: 'auditoria', titulo: tr('Auditoria'), subtitulo: tr('Toda mudança de configuração e de cadastro: quem, quando, antes e depois'),
    conteudo: '<section class="cartao"><ol class="lista-auditoria">' + lista.map((a) =>
      '<li><div class="aud-topo"><span class="etiqueta etiqueta-neutro">' + esc(a.area) + '</span><b>' + esc(a.descricao) + '</b></div>' +
      (a.antes || a.depois ? '<div class="aud-mudanca">' + (a.antes ? '<span class="aud-antes">' + esc(a.antes) + '</span>' : '') + (a.antes && a.depois ? icone('seta', 14) : '') + (a.depois ? '<span class="aud-depois">' + esc(a.depois) + '</span>' : '') + '</div>' : '') +
      '<span class="mudo pequeno">' + esc(a.por) + ' · ' + dataHora(a.em) + (a.motivo ? (' ' + tr('· motivo:') + ' ') + esc(a.motivo) : '') + '</span></li>').join('') + '</ol></section>',
  });
}

/* ---------- Ações ---------- */

const valorDe = (form, nome) => { const el = form.querySelector('[name="' + nome + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };

export const acoesSettings = {
  'settings-salvar-usuario'() {
    const form = document.getElementById('form-usuario');
    const marcado = form.querySelector('[name="perfilId"]:checked');
    const ativo = form.querySelector('[name="ativo"]');
    const r = salvarUsuario(form.dataset.id || null, {
      nome: valorDe(form, 'nome'), email: valorDe(form, 'email'), cargo: valorDe(form, 'cargo'), funcionarioId: valorDe(form, 'funcionarioId'),
      perfilId: marcado ? marcado.value : '', ativo: ativo ? ativo.checked : true,
    }, usuarioAtual().nome, usuarioAtual());
    if (r.erro) { toast(r.erro); return; }
    toast(form.dataset.id ? tr('Acesso atualizado.') : tr('Usuário criado. Na versão real, ele recebe um convite por e-mail.'));
    app.ir('#/settings/usuarios');
  },
  'settings-salvar-perfis'() {
    const form = document.getElementById('form-perfis');
    const mapa = {};
    for (const p of perfis()) mapa[p.id] = [];
    form.querySelectorAll('input[type="checkbox"]:checked').forEach((c) => { const [pid, perm] = c.name.split('|'); if (mapa[pid]) mapa[pid].push(perm); });
    const r = salvarPermissoes(mapa, usuarioAtual().nome);
    toast(r.mudancas.length ? (tr('Permissões salvas:') + ' ') + r.mudancas.join(', ') + '.' : tr('Nada mudou.'));
    app.desenhar();
  },
  async 'settings-novo-perfil'() {
    const res = await abrirDialogo({
      titulo: tr('Novo perfil de acesso'),
      corpo: ('<label class="rotulo-pequeno" for="np-nome">' + tr('Nome') + '</label><input type="text" id="np-nome" name="nome" placeholder="' + tr('Ex.: Encarregado com aprovação') + '">') +
        ('<label class="rotulo-pequeno" for="np-base">' + tr('Começar com as permissões de') + '</label><select id="np-base" name="base"><option value="">' + tr('Nenhuma') + '</option>') + perfis().map((p) => '<option value="' + p.id + '">' + esc(p.nome) + '</option>').join('') + '</select>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Criar perfil'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = criarPerfil(res.campos.nome, res.campos.base, usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Perfil criado. Ajuste as permissões e salve.'));
    app.desenhar();
  },
  'settings-excluir-perfil'(el) {
    const r = excluirPerfil(el.dataset.id, usuarioAtual().nome);
    toast(r.erro || tr('Perfil excluído.'));
    app.desenhar();
  },
  'settings-salvar-func'() {
    const form = document.getElementById('form-func');
    const dados = {};
    for (const k of ['nome', 'codigo', 'telefone', 'emergencia', 'classificacao', 'flsa', 'funcao', 'equipeId', 'admissao', 'situacao', 'desligamento', 'avisoGps', 'valorHora']) dados[k] = valorDe(form, k);
    dados.certificacoes = [];
    for (let i = 0; form.querySelector('[name="cert-nome-' + i + '"]'); i++) dados.certificacoes.push({ nome: valorDe(form, 'cert-nome-' + i), validade: valorDe(form, 'cert-validade-' + i) });
    const r = salvarFuncionario(form.dataset.id || null, dados, usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast(r.semMudanca ? tr('Nada mudou.') : form.dataset.id ? tr('Cadastro atualizado.') : tr('Funcionário cadastrado.'));
    app.ir('#/settings/funcionario/' + r.id);
  },
  'settings-salvar-encargos'() {
    const form = document.getElementById('form-encargos');
    const itens = [];
    for (let i = 0; form.querySelector('[name="nome-' + i + '"]'); i++) itens.push({ nome: valorDe(form, 'nome-' + i), pct: valorDe(form, 'pct-' + i) });
    const r = novosEncargos(itens, valorDe(form, 'desde'), valorDe(form, 'motivo'), usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Nova versão dos encargos salva.'));
    app.ir('#/settings/encargos');
  },
  'settings-modelo'(el) {
    const m = MODELOS_REGRA[el.dataset.modelo];
    const form = document.getElementById('form-regra');
    const preencher = (nome, v) => { const x = form.querySelector('[name="' + nome + '"]'); if (x.type === 'checkbox') x.checked = !!v; else x.value = v; };
    preencher('nome', m.nome);
    preencher('semanal-limite', m.semanal.limite); preencher('semanal-fator', m.semanal.fator);
    preencher('diaria-ativo', m.diaria.ativo); preencher('diaria-limite', m.diaria.limite); preencher('diaria-fator', m.diaria.fator); preencher('diaria-dobra', m.diaria.dobra); preencher('diaria-fatorDobra', m.diaria.fatorDobra);
    preencher('intervalo-minimo', m.intervalo.minimo); preencher('intervalo-apos', m.intervalo.apos);
    toast(tr('Formulário preenchido com o modelo. Ajuste e salve.'));
  },
  'settings-salvar-regra'() {
    const form = document.getElementById('form-regra');
    const v = (n) => valorDe(form, n);
    const r = novaRegra({
      nome: v('nome'), desde: v('desde'),
      semanal: { limite: v('semanal-limite'), fator: v('semanal-fator') },
      diaria: { ativo: v('diaria-ativo'), limite: v('diaria-limite'), fator: v('diaria-fator'), dobra: v('diaria-dobra'), fatorDobra: v('diaria-fatorDobra') },
      intervalo: { minimo: v('intervalo-minimo'), apos: v('intervalo-apos') },
    }, v('motivo'), usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast((tr('Nova regra salva: vale a partir da semana de') + ' ') + dataCurta(r.desde) + '.');
    app.ir('#/settings/regras');
  },
};

/* Sininho: certificações vencendo (só para o escritório). */
export function notificacoesSettings(u) {
  if (!pode(u, 'settings.funcionarios')) return [];
  return funcionarios().filter((f) => f.situacao !== 'desligado').flatMap((f) => certificacoesAVencer(f).map((c) => ({
    id: 'cert-' + f.id + '-' + c.nome + '-' + c.validade, em: new Date(hoje() + 'T07:30:00').getTime(), modulo: 'settings',
    titulo: f.nome + ': ' + c.nome + (c.validade < hoje() ? (' ' + tr('venceu em') + ' ') : (' ' + tr('vence em') + ' ')) + dataCurta(c.validade),
    href: '#/settings/funcionario/' + f.id,
  })));
}
