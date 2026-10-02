/* KORbuild Settings — telas: funcionários, encargos, regras de jornada e auditoria.
 * Só o escritório (administrador) entra. */

import { esc, hoje, somarDias, diasEntre, dataCurta, dataHora, toast } from './util.js';
import { estado } from './armazem.js';
import { casca, usuarioAtual, ehAdmin } from './plataforma.js';
import { icone } from './icones.js';
import { dinheiro, valorAtual, equipe, inicioDaSemana } from './crew.js';
import {
  funcionarios, salvarFuncionario, certificacoesAVencer, CLASSIFICACOES, FLSA, SITUACOES_FUNC,
  regraEm, historicoRegras, novaRegra, resumoRegra, MODELOS_REGRA,
  encargosVersao, encargosEm, historicoEncargos, novosEncargos, auditoria, segundaDe,
} from './settings.js';

let app = { desenhar: () => {}, ir: () => {}, topoExtra: () => '' };
export function ligarSettings(funcoes) { app = { ...app, ...funcoes }; }

function nav() {
  const alertas = funcionarios().filter((f) => f.situacao !== 'desligado' && certificacoesAVencer(f).length).length;
  return [
    { id: 'funcionarios', href: '#/settings/funcionarios', rotulo: 'Funcionários', icone: 'crew', contador: alertas },
    { id: 'encargos', href: '#/settings/encargos', rotulo: 'Encargos', icone: 'dinheiro' },
    { id: 'regras', href: '#/settings/regras', rotulo: 'Regras de jornada', icone: 'relogio' },
    { id: 'auditoria', href: '#/settings/auditoria', rotulo: 'Auditoria', icone: 'historico' },
  ];
}

function moldura(o) {
  return casca({ modulo: 'settings', nav: nav(), largura: o.largo === false ? 'estreita' : 'larga', topoExtra: app.topoExtra(), ...o });
}

const pct = (v, casas) => (v * 100).toFixed(casas == null ? 2 : casas).replace('.', ',').replace(/,00$/, '') + '%';
const num = (v) => String(v).replace('.', ',');
const proximaSegunda = () => somarDias(segundaDe(hoje()), 7);

/* Rotas #/settings/... */
export function telaSettings(q) {
  if (!ehAdmin(usuarioAtual())) return { trocar: '#/inicio' };
  if (!q.length) return { trocar: '#/settings/funcionarios' };
  if (q[0] === 'funcionarios') return telaFuncionarios(q[1]);
  if (q[0] === 'funcionario' && q[1] === 'novo') return telaFormFuncionario(null);
  if (q[0] === 'funcionario' && q[2] === 'editar') return telaFormFuncionario(q[1]);
  if (q[0] === 'funcionario') return telaFuncionario(q[1]);
  if (q[0] === 'encargos' && q[1] === 'nova') return telaFormEncargos();
  if (q[0] === 'encargos') return telaEncargos();
  if (q[0] === 'regras' && q[1] === 'nova') return telaFormRegra();
  if (q[0] === 'regras') return telaRegras();
  if (q[0] === 'auditoria') return telaAuditoria();
  return { trocar: '#/settings/funcionarios' };
}

/* ---------- Funcionários ---------- */

function situacaoCert(c) {
  if (!c.validade) return '<span class="etiqueta etiqueta-neutro">sem validade</span>';
  const d = diasEntre(hoje(), c.validade);
  if (d < 0) return '<span class="etiqueta etiqueta-alerta">vencida há ' + -d + ' dias</span>';
  if (d <= 30) return '<span class="etiqueta etiqueta-ambar">vence em ' + d + ' dias</span>';
  return '<span class="etiqueta etiqueta-verde">válida até ' + dataCurta(c.validade) + '</span>';
}

function custoCarregado(f) { return valorAtual(f) * (1 + (f.classificacao === '1099' ? 0 : encargosEm(hoje()))); }

function telaFuncionarios(filtro) {
  const todos = funcionarios();
  const lista = todos.filter((f) => (filtro === 'todos' ? true : filtro === 'desligados' ? f.situacao === 'desligado' : f.situacao !== 'desligado'))
    .sort((a, b) => a.nome.localeCompare(b.nome));
  const abas = [['', 'Ativos'], ['desligados', 'Desligados'], ['todos', 'Todos']];
  const linhas = lista.map((f) => {
    const avisos = certificacoesAVencer(f);
    return '<tr><td><a href="#/settings/funcionario/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.codigo || '') + '</span></td>' +
      '<td>' + esc(f.funcao) + '<span class="mudo pequeno bloco">' + esc((equipe(f.equipeId) || {}).nome || 'Sem equipe') + '</span></td>' +
      '<td>' + esc(CLASSIFICACOES[f.classificacao] || '') + '</td>' +
      '<td class="num"><b>' + dinheiro(valorAtual(f)) + '</b></td>' +
      '<td class="num">' + dinheiro(custoCarregado(f)) + '</td>' +
      '<td>' + (f.situacao === 'ativo' ? '<span class="etiqueta etiqueta-verde">Ativo</span>' : '<span class="etiqueta etiqueta-neutro">' + SITUACOES_FUNC[f.situacao] + '</span>') +
        (avisos.length ? ' <span class="etiqueta etiqueta-ambar" title="' + esc(avisos.map((c) => c.nome).join(', ')) + '">' + avisos.length + ' certificação a vencer</span>' : '') + '</td></tr>';
  }).join('');
  return moldura({
    ativo: 'funcionarios', titulo: 'Funcionários', subtitulo: 'Cadastro único da empresa: vale para o Crew, o Daily e o Measure',
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/funcionario/novo">' + icone('mais', 16) + 'Novo funcionário</a>',
    conteudo: '<nav class="abas-segmento" aria-label="Filtro">' + abas.map(([id, r]) => '<a href="#/settings/funcionarios' + (id ? '/' + id : '') + '"' + ((filtro || '') === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>' +
      '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-funcionarios"><thead><tr><th>Nome</th><th>Função e equipe</th><th>Classificação</th><th class="num">Valor hora</th><th class="num">Custo carregado</th><th>Situação</th></tr></thead><tbody>' +
      (linhas || '<tr><td colspan="6" class="mudo">Nenhum funcionário.</td></tr>') + '</tbody></table></div></section>' +
      '<p class="dica">Custo carregado = valor hora + ' + pct(encargosEm(hoje())) + ' de encargos (<a href="#/settings/encargos">Encargos</a>). Autônomo (1099) não tem encargos nem hora extra.</p>',
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
    return '<tr' + (vigente ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + ' → ' + (ate ? dataCurta(ate) : (x.desde > hoje() ? '…' : 'hoje')) +
      (vigente ? ' <span class="etiqueta etiqueta-verde">vigente</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">futuro</span>' : '') + '</td>' +
      '<td class="num"><b>' + dinheiro(x.valor) + '</b></td>' +
      '<td class="num">' + (variacao == null ? '—' : (variacao >= 0 ? '+' : '') + pct(variacao, 1)) + '</td>' +
      '<td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>';
  }).join('');
  const dado = (rot, v) => '<div><dt>' + rot + '</dt><dd>' + (v || '<span class="mudo">—</span>') + '</dd></div>';
  const autonomo = f.classificacao === '1099';
  return moldura({
    ativo: 'funcionarios', titulo: f.nome, subtitulo: f.funcao + ' · ' + ((equipe(f.equipeId) || {}).nome || 'sem equipe') + ' · ' + (CLASSIFICACOES[f.classificacao] || ''),
    voltar: { href: '#/settings/funcionarios', rotulo: 'Funcionários' },
    acoes: '<a class="btn btn-contorno btn-pequeno" href="#/settings/funcionario/' + f.id + '/editar">Editar cadastro</a>',
    conteudo:
      '<div class="kpis kpis-3">' +
        '<div class="kpi kpi-azul"><span>Valor hora atual</span><b>' + dinheiro(valorAtual(f)) + '</b></div>' +
        '<div class="kpi"><span>' + (autonomo || f.flsa === 'isento' ? 'Hora extra' : 'Hora extra (' + num(regra.semanal.fator) + '×)') + '</span><b>' + (autonomo || f.flsa === 'isento' ? 'Não se aplica' : dinheiro(valorAtual(f) * regra.semanal.fator)) + '</b></div>' +
        '<div class="kpi"><span>Custo carregado' + (autonomo ? ' (sem encargos: 1099)' : ' (+' + pct(encargosEm(hoje())) + ' encargos)') + '</span><b>' + dinheiro(custoCarregado(f)) + '</b></div>' +
      '</div>' +
      '<section class="cartao"><h2 class="cartao-titulo">Cadastro</h2><dl class="dados-func">' +
        dado('Código', esc(f.codigo)) + dado('Situação', SITUACOES_FUNC[f.situacao] + (f.desligamento ? ' em ' + dataCurta(f.desligamento) : '')) +
        dado('Função', esc(f.funcao)) + dado('Equipe', esc((equipe(f.equipeId) || {}).nome || '')) +
        dado('Classificação', CLASSIFICACOES[f.classificacao]) + dado('FLSA', FLSA[f.flsa]) +
        dado('Admissão', f.admissao ? dataCurta(f.admissao) : '') + dado('Telefone', esc(f.telefone)) +
        dado('Contato de emergência', esc(f.emergencia)) + dado('Aviso de localização aceito em', f.avisoGps ? dataCurta(f.avisoGps) : '<span class="etiqueta etiqueta-ambar">pendente</span>') +
      '</dl><p class="mudo pequeno">SSN e documentos de imigração não ficam no KORbuild: ficam no sistema de folha. Aqui fica só o código para o cruzamento.</p></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Certificações</h2>' +
        ((f.certificacoes || []).length ? '<ul class="lista-cert">' + f.certificacoes.map((c) => '<li><b>' + esc(c.nome) + '</b>' + situacaoCert(c) + '</li>').join('') + '</ul>' : '<p class="vazio">Nenhuma certificação cadastrada.</p>') +
      '</section>' +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Histórico do valor hora</h2>' +
        '<button type="button" class="btn btn-primario btn-pequeno" data-acao="crew-valor-hora" data-id="' + f.id + '">' + icone('dinheiro', 16) + '<span>Alterar valor hora</span></button></div>' +
        '<p class="mudo pequeno">Cada mudança vale a partir de uma data e nunca apaga a anterior: as horas de cada dia são pagas e custeadas pelo valor vigente naquele dia.</p>' +
        '<div class="tabela-rolagem"><table class="tabela tabela-valores"><thead><tr><th>Vigência</th><th class="num">Valor hora</th><th class="num">Variação</th><th>Motivo</th><th>Registrado por</th></tr></thead><tbody>' + linhasValor + '</tbody></table></div></section>' +
      '<p class="dica"><a href="#/crew/semana/' + f.id + '/' + inicioDaSemana(hoje()) + '">Ver as horas desta semana no Crew</a></p>',
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
    ativo: 'funcionarios', largo: false, titulo: f ? 'Editar ' + f.nome : 'Novo funcionário',
    voltar: f ? { href: '#/settings/funcionario/' + f.id, rotulo: f.nome } : { href: '#/settings/funcionarios', rotulo: 'Funcionários' },
    conteudo: '<form id="form-func" class="form-settings" data-id="' + (f ? f.id : '') + '" onsubmit="return false">' +
      '<section class="cartao"><h2 class="cartao-titulo">Identificação</h2><div class="grade-campos">' +
        campo('nome', 'Nome completo', texto('nome', v.nome, ' autocomplete="off"')) +
        campo('codigo', 'Código (employee ID)', texto('codigo', v.codigo), 'O mesmo do sistema de folha') +
        campo('telefone', 'Telefone', texto('telefone', v.telefone, ' inputmode="tel"')) +
        campo('emergencia', 'Contato de emergência', texto('emergencia', v.emergencia)) +
      '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Contrato e trabalho</h2><div class="grade-campos">' +
        campo('classificacao', 'Classificação', '<select id="ff-classificacao" name="classificacao">' + opcoes(Object.entries(CLASSIFICACOES), v.classificacao) + '</select>', 'Autônomo (1099) não tem hora extra nem encargos') +
        campo('flsa', 'FLSA', '<select id="ff-flsa" name="flsa">' + opcoes(Object.entries(FLSA), v.flsa) + '</select>', 'Isento não recebe hora extra') +
        campo('funcao', 'Função', '<input type="text" id="ff-funcao" name="funcao" list="lista-funcoes" value="' + esc(v.funcao || '') + '"><datalist id="lista-funcoes">' + funcoes.map((x) => '<option value="' + esc(x) + '">').join('') + '</datalist>') +
        campo('equipeId', 'Equipe', '<select id="ff-equipeId" name="equipeId"><option value="">Sem equipe</option>' + opcoes(estado().crew.equipes.map((e) => [e.id, e.nome]), v.equipeId) + '</select>') +
        campo('admissao', 'Admissão', data('admissao', v.admissao)) +
        campo('situacao', 'Situação', '<select id="ff-situacao" name="situacao">' + opcoes(Object.entries(SITUACOES_FUNC), v.situacao) + '</select>') +
        campo('desligamento', 'Desligamento', data('desligamento', v.desligamento), 'Só quando desligado') +
        (f ? '' : campo('valorHora', 'Valor hora inicial (US$)', '<input type="number" id="ff-valorHora" name="valorHora" min="1" step="0.01" inputmode="decimal">', 'Depois, mudanças ficam no histórico com data e motivo')) +
      '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Certificações</h2><p class="mudo pequeno">OSHA 10/30, licenças, operador de máquina… O sistema avisa 30 dias antes de vencer.</p>' +
        certs.map((c, i) => '<div class="linha-cert"><input type="text" name="cert-nome-' + i + '" aria-label="Certificação ' + (i + 1) + '" placeholder="Certificação" value="' + esc(c.nome || '') + '">' +
          '<input type="date" name="cert-validade-' + i + '" aria-label="Validade da certificação ' + (i + 1) + '" value="' + esc(c.validade || '') + '"></div>').join('') +
      '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Privacidade</h2><div class="grade-campos">' +
        campo('avisoGps', 'Aviso de localização aceito em', data('avisoGps', v.avisoGps), 'O ponto com GPS só registra a localização com o ponto aberto') +
      '</div></section>' +
      '<div class="rodape-form"><a class="btn btn-contorno" href="' + (f ? '#/settings/funcionario/' + f.id : '#/settings/funcionarios') + '">Cancelar</a>' +
        '<button type="button" class="btn btn-primario" data-acao="settings-salvar-func">' + (f ? 'Salvar alterações' : 'Cadastrar funcionário') + '</button></div>' +
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
    ativo: 'encargos', titulo: 'Encargos sobre a folha', subtitulo: 'Labor burden: o que a empresa paga além do salário. Vale para todos os funcionários W-2',
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/encargos/nova">Nova versão</a>',
    conteudo:
      (futuro ? '<p class="aviso-info">' + icone('relogio', 16) + 'Há uma versão programada a partir de ' + dataCurta(futuro.desde) + ' (' + pct(futuro.itens.reduce((t, i) => t + i.pct, 0) / 100) + ').</p>' : '') +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Vigentes desde ' + dataCurta(v.desde) + '</h2><b class="total-encargos">' + pct(total) + '</b></div>' +
        '<table class="tabela"><tbody>' + v.itens.map((i) => '<tr><td>' + esc(i.nome) + '</td><td class="num"><b>' + num(i.pct) + '%</b></td></tr>').join('') +
        '<tr class="linha-total"><td>Total sobre o salário</td><td class="num"><b>' + pct(total) + '</b></td></tr></tbody></table>' +
        '<p class="mudo pequeno">Exemplo: quem ganha ' + dinheiro(exemplo) + '/h custa ' + dinheiro(exemplo * (1 + total)) + '/h para a empresa. Autônomos (1099) não têm encargos.</p></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Histórico de versões</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>A partir de</th><th class="num">Total</th><th>Motivo</th><th>Registrado por</th></tr></thead><tbody>' +
        historicoEncargos().map((x) => '<tr' + (x === v ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (x === v ? ' <span class="etiqueta etiqueta-verde">vigente</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">futuro</span>' : '') + '</td><td class="num">' + pct(x.itens.reduce((t, i) => t + i.pct, 0) / 100) + '</td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      '<p class="dica">Os % dependem do estado e da seguradora: confira com o contador. Simplificação do protótipo: FUTA e SUTA incidem sobre todo o salário (na prática, só até o teto anual de cada um).</p>',
  });
}

function telaFormEncargos() {
  const v = encargosVersao(hoje());
  const linhas = v.itens.concat([{ nome: '', pct: '' }, { nome: '', pct: '' }]);
  return moldura({
    ativo: 'encargos', largo: false, titulo: 'Nova versão dos encargos', voltar: { href: '#/settings/encargos', rotulo: 'Encargos' },
    conteudo: '<form id="form-encargos" class="form-settings" onsubmit="return false"><section class="cartao">' +
      '<p class="mudo pequeno">Os custos de antes da data continuam com os encargos da época. Para tirar um item, apague o nome.</p>' +
      linhas.map((i, n) => '<div class="linha-encargo"><input type="text" name="nome-' + n + '" aria-label="Encargo ' + (n + 1) + '" placeholder="Novo encargo" value="' + esc(i.nome) + '">' +
        '<span class="campo-pct"><input type="number" name="pct-' + n + '" aria-label="Percentual do encargo ' + (n + 1) + '" min="0" max="100" step="0.01" value="' + esc(String(i.pct)) + '" inputmode="decimal">%</span></div>').join('') +
      '<div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="enc-desde">Vale a partir de</label><input type="date" id="enc-desde" name="desde" value="' + proximaSegunda() + '"><span class="mudo pequeno">A partir da semana atual; semanas fechadas não mudam</span></div>' +
      '<div class="campo"><label class="rotulo-pequeno" for="enc-motivo">Motivo</label><input type="text" id="enc-motivo" name="motivo" placeholder="Ex.: nova taxa do workers\' comp na renovação da apólice"></div></div>' +
      '</section><div class="rodape-form"><a class="btn btn-contorno" href="#/settings/encargos">Cancelar</a><button type="button" class="btn btn-primario" data-acao="settings-salvar-encargos">Salvar nova versão</button></div></form>',
  });
}

/* ---------- Regras de jornada ---------- */

function telaRegras() {
  const r = regraEm(hoje());
  const futura = historicoRegras().find((x) => x.desde > hoje());
  const item = (titulo, texto) => '<li><b>' + titulo + '</b><span>' + texto + '</span></li>';
  return moldura({
    ativo: 'regras', titulo: 'Regras de jornada', subtitulo: 'Hora extra e intervalo usados no ponto, nos timesheets e nos custos',
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/regras/nova">Nova versão</a>',
    conteudo:
      (futura ? '<p class="aviso-info">' + icone('relogio', 16) + 'Há uma regra programada a partir da semana de ' + dataCurta(futura.desde) + ': ' + esc(futura.nome) + '.</p>' : '') +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(r.nome) + '</h2><span class="etiqueta etiqueta-verde">vigente desde ' + dataCurta(r.desde) + '</span></div>' +
        '<ul class="lista-regras">' +
          item('Hora extra semanal', 'Acima de ' + num(r.semanal.limite) + ' h na semana (segunda a domingo): ' + num(r.semanal.fator) + '×') +
          item('Hora extra diária', r.diaria.ativo ? 'Acima de ' + num(r.diaria.limite) + ' h no dia: ' + num(r.diaria.fator) + '×; acima de ' + num(r.diaria.dobra) + ' h: ' + num(r.diaria.fatorDobra) + '×' : 'Não se aplica') +
          item('Intervalo', num(r.intervalo.minimo) + ' min depois de ' + num(r.intervalo.apos) + ' h de trabalho (gera alerta se faltar)') +
          item('Arredondamento', 'Nenhum: paga-se o minuto (princípio do produto)') +
        '</ul>' + (r.nota ? '<p class="mudo pequeno">' + esc(r.nota) + '</p>' : '') + '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Histórico de versões</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Semana de</th><th>Regra</th><th>Motivo</th><th>Registrado por</th></tr></thead><tbody>' +
        historicoRegras().map((x) => '<tr' + (x === r ? ' class="vigente"' : '') + '><td>' + dataCurta(x.desde) + (x === r ? ' <span class="etiqueta etiqueta-verde">vigente</span>' : x.desde > hoje() ? ' <span class="etiqueta etiqueta-neutro">futura</span>' : '') + '</td><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno bloco">' + esc(resumoRegra(x)) + '</span></td><td>' + esc(x.motivo) + '</td><td class="mudo pequeno">' + esc(x.por) + ' · ' + dataHora(x.em) + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      '<p class="dica">A regra não fica presa a um estado: os modelos só preenchem o formulário, e a empresa ajusta (acordo sindical, política interna). Próximo passo: regra por obra, para quem trabalha em mais de um estado.</p>',
  });
}

function telaFormRegra() {
  const r = regraEm(hoje());
  const numero = (nome, valor, rot, passo) => '<div class="campo"><label class="rotulo-pequeno" for="rg-' + nome + '">' + rot + '</label><input type="number" id="rg-' + nome + '" name="' + nome + '" value="' + valor + '" min="0" step="' + (passo || '0.5') + '" inputmode="decimal"></div>';
  return moldura({
    ativo: 'regras', largo: false, titulo: 'Nova versão da regra de jornada', voltar: { href: '#/settings/regras', rotulo: 'Regras de jornada' },
    conteudo: '<form id="form-regra" class="form-settings" onsubmit="return false">' +
      '<section class="cartao"><p class="mudo pequeno">Preencher com um modelo (depois ajuste o que precisar):</p><div class="btn-linha">' +
        Object.entries(MODELOS_REGRA).map(([id, m]) => '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="settings-modelo" data-modelo="' + id + '">' + esc(m.nome) + '</button>').join('') + '</div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="rg-nome">Nome da regra</label><input type="text" id="rg-nome" name="nome" value="' + esc(r.nome) + '"></div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Hora extra semanal</h2><div class="grade-campos">' +
        numero('semanal-limite', r.semanal.limite, 'Acima de (horas na semana)') + numero('semanal-fator', r.semanal.fator, 'Fator', '0.05') + '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Hora extra diária</h2>' +
        '<label class="check"><input type="checkbox" name="diaria-ativo" value="1"' + (r.diaria.ativo ? ' checked' : '') + '> Pagar hora extra por dia (além da semanal)</label><div class="grade-campos">' +
        numero('diaria-limite', r.diaria.limite, 'Acima de (horas no dia)') + numero('diaria-fator', r.diaria.fator, 'Fator', '0.05') +
        numero('diaria-dobra', r.diaria.dobra, 'Hora dobrada acima de (horas no dia)') + numero('diaria-fatorDobra', r.diaria.fatorDobra, 'Fator da dobrada', '0.05') + '</div>' +
        '<p class="mudo pequeno">A hora que já virou extra no dia não conta de novo para a semanal.</p></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Intervalo</h2><div class="grade-campos">' +
        numero('intervalo-minimo', r.intervalo.minimo, 'Mínimo (minutos)', '5') + numero('intervalo-apos', r.intervalo.apos, 'Depois de (horas de trabalho)') + '</div></section>' +
      '<section class="cartao"><div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="rg-desde">Vale a partir da semana de</label><input type="date" id="rg-desde" name="desde" value="' + proximaSegunda() + '"><span class="mudo pequeno">A regra vale por semana inteira (de segunda a domingo); a data vai para a segunda</span></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="rg-motivo">Motivo</label><input type="text" id="rg-motivo" name="motivo" placeholder="Ex.: acordo coletivo, obra em outro estado"></div></div></section>' +
      '<div class="rodape-form"><a class="btn btn-contorno" href="#/settings/regras">Cancelar</a><button type="button" class="btn btn-primario" data-acao="settings-salvar-regra">Salvar nova versão</button></div></form>',
  });
}

/* ---------- Auditoria ---------- */

function telaAuditoria() {
  const lista = auditoria();
  return moldura({
    ativo: 'auditoria', titulo: 'Auditoria', subtitulo: 'Toda mudança de configuração e de cadastro: quem, quando, antes e depois',
    conteudo: '<section class="cartao"><ol class="lista-auditoria">' + lista.map((a) =>
      '<li><div class="aud-topo"><span class="etiqueta etiqueta-neutro">' + esc(a.area) + '</span><b>' + esc(a.descricao) + '</b></div>' +
      (a.antes || a.depois ? '<div class="aud-mudanca">' + (a.antes ? '<span class="aud-antes">' + esc(a.antes) + '</span>' : '') + (a.antes && a.depois ? icone('seta', 14) : '') + (a.depois ? '<span class="aud-depois">' + esc(a.depois) + '</span>' : '') + '</div>' : '') +
      '<span class="mudo pequeno">' + esc(a.por) + ' · ' + dataHora(a.em) + (a.motivo ? ' · motivo: ' + esc(a.motivo) : '') + '</span></li>').join('') + '</ol></section>',
  });
}

/* ---------- Ações ---------- */

const valorDe = (form, nome) => { const el = form.querySelector('[name="' + nome + '"]'); return el ? (el.type === 'checkbox' ? el.checked : el.value) : ''; };

export const acoesSettings = {
  'settings-salvar-func'() {
    const form = document.getElementById('form-func');
    const dados = {};
    for (const k of ['nome', 'codigo', 'telefone', 'emergencia', 'classificacao', 'flsa', 'funcao', 'equipeId', 'admissao', 'situacao', 'desligamento', 'avisoGps', 'valorHora']) dados[k] = valorDe(form, k);
    dados.certificacoes = [];
    for (let i = 0; form.querySelector('[name="cert-nome-' + i + '"]'); i++) dados.certificacoes.push({ nome: valorDe(form, 'cert-nome-' + i), validade: valorDe(form, 'cert-validade-' + i) });
    const r = salvarFuncionario(form.dataset.id || null, dados, usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast(r.semMudanca ? 'Nada mudou.' : form.dataset.id ? 'Cadastro atualizado.' : 'Funcionário cadastrado.');
    app.ir('#/settings/funcionario/' + r.id);
  },
  'settings-salvar-encargos'() {
    const form = document.getElementById('form-encargos');
    const itens = [];
    for (let i = 0; form.querySelector('[name="nome-' + i + '"]'); i++) itens.push({ nome: valorDe(form, 'nome-' + i), pct: valorDe(form, 'pct-' + i) });
    const r = novosEncargos(itens, valorDe(form, 'desde'), valorDe(form, 'motivo'), usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast('Nova versão dos encargos salva.');
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
    toast('Formulário preenchido com o modelo. Ajuste e salve.');
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
    toast('Nova regra salva: vale a partir da semana de ' + dataCurta(r.desde) + '.');
    app.ir('#/settings/regras');
  },
};

/* Sininho: certificações vencendo (só para o escritório). */
export function notificacoesSettings(u) {
  if (!ehAdmin(u)) return [];
  return funcionarios().filter((f) => f.situacao !== 'desligado').flatMap((f) => certificacoesAVencer(f).map((c) => ({
    id: 'cert-' + f.id + '-' + c.nome + '-' + c.validade, em: new Date(hoje() + 'T07:30:00').getTime(), modulo: 'settings',
    titulo: f.nome + ': ' + c.nome + (c.validade < hoje() ? ' venceu em ' : ' vence em ') + dataCurta(c.validade),
    href: '#/settings/funcionario/' + f.id,
  })));
}
