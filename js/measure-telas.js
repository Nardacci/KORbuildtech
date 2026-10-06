/* KORbuild Measure — telas: projeto (folhas e quantidades) e o visor de medição (PDF.js + canvas).
 * Medir planta é trabalho de computador: o visor é pensado para mouse e teclado. */

import { esc, toast, abrirDialogo, confirmar, novoId, hoje, diasEntre, dataCurta } from './util.js';
import { tr, tn } from './i18n.js';
import { lerFoto, guardarFoto, estado, obra } from './armazem.js';
import { casca, usuarioAtual, pode, modulosLiberados } from './plataforma.js';
import { icone } from './icones.js';
import {
  ESCALAS, polPorPontoDaEscala, interpretarComprimento, interpretarInclinacao, formatarInclinacao,
  formatarPesPolegadas, formatarLinear, formatarArea, formatarVolume, numero, distancia, comprimento, areaPoligono,
} from './imperial.js';
import {
  projetos, projeto, folha, folhasDo, condicao, condicoesDo, TIPOS, definirEscala, registrarConferencia,
  salvarCondicao, excluirCondicao, adicionarMedicao, excluirMedicao, totaisDaCondicao, valorDaMedicao, verticeProximo, criarFolhas,
  CATEGORIAS, itens, item, salvarItem, excluirItem, assemblies, assembly, salvarAssembly, excluirAssembly, aplicarAssembly, removerAssembly,
  quantidadesDoProjeto, variaveisDaCondicao, mostrarCondicao, adicionarVao,
  condicoesDaFolha, incluirNaFolha, tirarDaFolha, folhasDaCondicao,
  typicaisDo, typicaisDaFolha, typical, repeticoes, fatorDaMedicao, typicalDaMedicao, salvarTypical, excluirTypical, medidoNoTypical,
  TIPOS_PROJETO, SITUACOES, enderecoDoProjeto, salvarProjeto, excluirProjeto, PALETA,
} from './measure.js';
import { contratanteDe, contato, textoPartes, PAPEIS } from './contatos.js';
import { htmlEscolhaContato } from './contatos-telas.js';
import { telaCotacao, telaImpressaoCotacao, telaProposta, telaImpressaoProposta } from './measure-relatorios.js';
import { telaPrecos } from './precos-telas.js';
import { motorPronto, carregarMotor, variaveisDoTipo, FUNCOES, VALORES_DE_TESTE, calcularLinha, VARIAVEIS } from './formulas.js';

let app = { desenhar: () => {}, ir: () => {}, topoExtra: () => '' };
export function ligarMeasure(funcoes) { app = { ...app, ...funcoes }; }

function navMeasure() {
  return [
    { id: 'projetos', href: '#/measure', rotulo: tr('Projetos'), icone: 'obras' },
    { id: 'assemblies', href: '#/measure/assemblies', rotulo: tr('Assemblies'), icone: 'tabela' },
    { id: 'itens', href: '#/measure/itens', rotulo: tr('Itens'), icone: 'measure' },
    { id: 'precos', href: '#/measure/precos', rotulo: tr('Preços'), icone: 'dinheiro' },
  ];
}
// o visor da planta usa a tela inteira, sem o menu lateral
function moldura(o) {
  return casca({ modulo: 'measure', nav: o.semMenu ? [] : navMeasure(), topoExtra: app.topoExtra(), ...o });
}
const podeCatalogo = () => pode(usuarioAtual(), 'measure.catalogo');

export function telaMeasure(q) {
  if (!pode(usuarioAtual(), 'measure.medir') || !modulosLiberados(usuarioAtual()).includes('measure')) return { trocar: '#/inicio' };
  // o motor de fórmulas (mathjs) só carrega no Measure; enquanto carrega, uma tela de espera
  if (!motorPronto()) {
    carregarMotor().then(() => app.desenhar()).catch(() => toast(tr('Não foi possível carregar o motor de fórmulas.')));
    return moldura({ titulo: 'Measure', conteudo: ('<p class="vazio">' + tr('Carregando o motor de fórmulas…') + '</p>') });
  }
  if (!q.length) return telaProjetos();
  if (q[0] === 'projeto' && q[1] === 'novo') return telaFormProjeto(null);
  if (q[0] === 'projeto' && projeto(q[1])) {
    if (q[2] === 'editar') return telaFormProjeto(q[1]);
    // relatórios do projeto: lista para cotação (por fornecedor) e proposta
    if (q[2] === 'cotacao' && q[4] === 'imprimir' && contato(q[3])) return telaImpressaoCotacao(q[1], q[3]);
    if (q[2] === 'cotacao') return telaCotacao(q[1], moldura);
    if (q[2] === 'proposta' && q[3] === 'imprimir') return telaImpressaoProposta(q[1], q[4] ? decodeURIComponent(q[4]) : null);
    if (q[2] === 'proposta') return telaProposta(q[1], moldura);
    return telaProjeto(q[1]);
  }
  if (q[0] === 'folha' && folha(q[1])) return telaFolha(q[1]);
  if (q[0] === 'itens') return telaItens();
  if (q[0] === 'precos') return telaPrecos(moldura);
  if (q[0] === 'assemblies') return telaAssemblies();
  if (q[0] === 'assembly' && (q[1] === 'novo' || assembly(q[1]))) return telaAssembly(q[1] === 'novo' ? null : q[1]);
  return { trocar: '#/measure' };
}

/* Quantidade com até 2 casas (inteiro sem casas). */
function qtd(v) { const r = Math.round(v * 100) / 100; return numero(r, Number.isInteger(r) ? 0 : 2); }
const ARREDONDAMENTOS = [[0, tr('Não arredondar')], [1, tr('Para cima, inteiro')], [0.5, tr('Para cima, de 0,5 em 0,5')], [0.25, tr('Para cima, de 0,25 em 0,25')]];
const nomeArred = (passo) => (ARREDONDAMENTOS.find(([p]) => p === passo) || [0, tr('Não arredondar')])[1];
/* O cálculo inteiro de uma linha, em texto (RB-004: fórmula transparente). */
function rastro(x, unidade) {
  return esc(x.linha.formula) + ' = ' + qtd(x.bruta) + (x.linha.perda ? ' → +' + numero(x.linha.perda, x.linha.perda % 1 ? 1 : 0) + '% = ' + qtd(x.comPerda) : '') +
    (x.linha.passo ? ' → ' + nomeArred(x.linha.passo).toLowerCase() + ': ' + qtd(x.final) : '') + ' ' + esc(unidade);
}
function textoVariaveis(vars, usadas) {
  return Object.entries(vars).filter(([k]) => !usadas || usadas.includes(k)).map(([k, v]) => k + ' = ' + qtd(v) + ' ' + ((VARIAVEIS.find((x) => x.nome === k) || {}).unidade || '')).join(' · ');
}

/* ---------- Formatação das quantidades ---------- */

function textoPrincipal(c, t) {
  if (c.tipo === 'contagem') return numero(t.base) + ' each';
  if (c.tipo === 'linear') return formatarPesPolegadas(t.base) + ' · ' + formatarLinear(t.base);
  return formatarArea(t.base);
}
function textoDerivado(d) {
  if (d.pol3 != null) return formatarVolume(d.pol3) + ' · ' + numero(d.pol3 / 1728, 0) + (' ' + tr('cu ft'));
  if (d.pol2 != null) return formatarArea(d.pol2);
  return formatarLinear(d.pol);
}
function textoProps(c) {
  const p = c.props || {};
  const vao = c.tipo === 'contagem' && p.larguraPol && p.alturaPol ? (tr('vão') + ' ') + formatarPesPolegadas(p.larguraPol) + (' ' + tr('×') + ' ') + formatarPesPolegadas(p.alturaPol) : '';
  const vaos = (p.vaos || []).length ? 'desconta ' + p.vaos.map((id) => (condicao(id) || {}).nome).filter(Boolean).map((n) => n.split(' (')[0]).join(', ') : '';
  return [vao, c.tipo !== 'contagem' && p.alturaPol ? 'altura ' + formatarPesPolegadas(p.alturaPol) : '', p.inclinacao ? (tr('inclinação') + ' ') + formatarInclinacao(p.inclinacao) : '', p.profundidadePol ? 'espessura ' + formatarPesPolegadas(p.profundidadePol) : '', vaos].filter(Boolean).join(' · ');
}

/* ---------- Projetos: lista e cadastro ---------- */

let filtroSituacao = 'todos';
const nomeUsuario = (id) => (estado().usuarios.find((u) => u.id === id) || {}).nome || '';
const etiquetaSituacao = (p) => '<span class="etiqueta ' + SITUACOES[p.situacao].classe + '">' + SITUACOES[p.situacao].nome + '</span>';
/* Prazo da proposta (bid due date): em quantos dias, ou se já passou. */
function textoPrazo(p) {
  if (!p.prazoProposta) return '<span class="mudo">—</span>';
  const n = diasEntre(hoje(), p.prazoProposta);
  const aberto = p.situacao === 'orcamento';
  const nota = !aberto ? '' : n < 0 ? '<span class="etiqueta etiqueta-alerta">vencido</span>' : n === 0 ? '<span class="etiqueta etiqueta-ambar">hoje</span>' : n <= 3 ? '<span class="etiqueta etiqueta-ambar">em ' + n + (n === 1 ? ' dia' : ' dias') + '</span>' : '<span class="mudo pequeno">em ' + n + ' dias</span>';
  return dataCurta(p.prazoProposta) + ' ' + nota;
}

function telaProjetos() {
  const todos = projetos();
  const lista = todos.filter((p) => filtroSituacao === 'todos' || p.situacao === filtroSituacao)
    .sort((a, b) => (a.situacao === 'orcamento' ? 0 : 1) - (b.situacao === 'orcamento' ? 0 : 1) || String(a.prazoProposta || '9').localeCompare(String(b.prazoProposta || '9')));
  const filtro = (id, nome, n) => '<button type="button" class="btn btn-pequeno ' + (filtroSituacao === id ? 'btn-primario' : 'btn-contorno') + '" data-acao="mz-filtro" data-situacao="' + id + '" aria-pressed="' + (filtroSituacao === id) + '">' + nome + ' <span class="mz-contagem">' + n + '</span></button>';
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: tr('Projetos'), subtitulo: tr('Orçamentos em andamento e propostas já enviadas'),
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/measure/projeto/novo">' + icone('mais', 16) + (tr('Novo projeto') + '</a>'),
    conteudo: ('<div class="btn-linha mz-filtros" role="group" aria-label="' + tr('Filtrar por situação') + '">') + filtro('todos', tr('Todos'), todos.length) +
        Object.entries(SITUACOES).map(([id, x]) => filtro(id, x.nome, todos.filter((p) => p.situacao === id).length)).join('') + '</div>' +
      (lista.length ? ('<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-projetos"><thead><tr><th>' + tr('Projeto') + '</th><th>' + tr('Local') + '</th><th>' + tr('Tipo') + '</th><th>' + tr('Estimador') + '</th><th>' + tr('Prazo da proposta') + '</th><th class="num">' + tr('Folhas') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>') +
        lista.map((p) => '<tr><td><a href="#/measure/projeto/' + p.id + '" class="mz-projeto-nome"><b>' + esc(p.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(textoPartes(p)) + (p.obraId && obra(p.obraId) ? (' ' + tr('· obra') + ' ') + esc(obra(p.obraId).nome) : '') + '</span></td>' +
          '<td>' + esc(p.cidade) + ', ' + esc(p.estado) + '</td><td>' + esc(TIPOS_PROJETO[p.tipo] || '') + '</td><td>' + esc(nomeUsuario(p.estimadorId)) + '</td>' +
          '<td>' + textoPrazo(p) + '</td><td class="num">' + folhasDo(p.id).length + '</td><td>' + etiquetaSituacao(p) + '</td></tr>').join('') +
        '</tbody></table></div></section>'
        : ('<p class="vazio">' + tr('Nenhum projeto') + ' ') + (filtroSituacao === 'todos' ? 'cadastrado.' : tr('com a situação "') + SITUACOES[filtroSituacao].nome + '".') + '</p>'),
  });
}

function telaFormProjeto(id) {
  const p = id ? projeto(id) : { estado: 'NH', tipo: 'residencial-uni', situacao: 'orcamento', estimadorId: usuarioAtual().id };
  const v = (k) => esc(p[k] || '');
  const campo = (nome, rotulo, html, classe) => '<div class="campo' + (classe ? ' ' + classe : '') + '"><label class="rotulo-pequeno" for="pj-' + nome + '">' + rotulo + '</label>' + html + '</div>';
  const texto = (nome, rotulo, extra) => campo(nome, rotulo, '<input type="text" id="pj-' + nome + '" name="' + nome + '" value="' + v(nome) + '"' + (extra || '') + '>');
  const opcoes = (lista, atual) => lista.map(([valor, nome]) => '<option value="' + valor + '"' + (valor === atual ? ' selected' : '') + '>' + esc(nome) + '</option>').join('');
  const estimadores = estado().usuarios.filter((u) => u.ativo !== false && pode(u, 'measure.medir'));
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: id ? tr('Editar projeto') : tr('Novo projeto'),
    voltar: id ? { href: '#/measure/projeto/' + id, rotulo: p.nome } : { href: '#/measure', rotulo: tr('Projetos') },
    conteudo: '<form id="form-projeto" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Projeto') + '</h2><div class="grade-campos">') +
        texto('nome', tr('Nome do projeto *'), (' placeholder="' + tr('Ex.: Casa Thompson, Mezanino LogSul') + '"')) + '<div></div>' +
        campo('tipo', tr('Tipo de obra'), '<select id="pj-tipo" name="tipo">' + opcoes(Object.entries(TIPOS_PROJETO), p.tipo) + '</select>') +
        campo('situacao', tr('Situação'), '<select id="pj-situacao" name="situacao">' + opcoes(Object.entries(SITUACOES).map(([k, x]) => [k, x.nome]), p.situacao) + '</select>') +
      '</div>' + campo('descricao', tr('Escopo'), ('<textarea id="pj-descricao" name="descricao" rows="2" placeholder="' + tr('Ex.: Residência térrea, wood framing, siding vinil') + '">') + v('descricao') + '</textarea>') + '</section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Para quem é a proposta') + '</h2><div class="grade-campos">') +
        htmlEscolhaContato({ id: 'pj-contratanteId', nome: 'contratanteId', rotulo: tr('Contratante * (recebe a proposta)'), papeis: ['construtora', 'cliente'], atual: p.contratanteId }) +
        htmlEscolhaContato({ id: 'pj-donoId', nome: 'donoId', rotulo: tr('Dono da obra (se não for o contratante)'), papeis: ['cliente'], atual: p.donoId, vazio: tr('O próprio contratante') }) +
      ('</div><p class="mudo pequeno">' + tr('Trabalhando para uma construtora, ela é a contratante e o cliente final é o dono. Contratado direto pelo dono do imóvel, ele é o contratante.') + '</p></section>') +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Local da obra') + '</h2>') + texto('endereco', tr('Endereço'), (' placeholder="' + tr('Ex.: 88 Bridge St') + '"')) +
        '<div class="grade-campos mz-grade-local">' + texto('cidade', tr('Cidade *')) + texto('estado', tr('Estado *'), ' maxlength="2" autocapitalize="characters"') + texto('zip', tr('ZIP code'), ' inputmode="numeric" maxlength="10"') + '</div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Proposta') + '</h2><div class="grade-campos">') +
        campo('prazoProposta', tr('Prazo da proposta (bid due date)'), '<input type="date" id="pj-prazoProposta" name="prazoProposta" value="' + v('prazoProposta') + '">') +
        campo('estimadorId', tr('Estimador responsável'), '<select id="pj-estimadorId" name="estimadorId"><option value="">—</option>' + opcoes(estimadores.map((u) => [u.id, u.nome]), p.estimadorId) + '</select>') +
        campo('obraId', tr('Obra vinculada (opcional)'), ('<select id="pj-obraId" name="obraId"><option value="">' + tr('Nenhuma (obra nova)') + '</option>') + opcoes(estado().obras.map((o) => [o.id, o.nome]), p.obraId) + '</select>') +
      ('</div><p class="mudo pequeno">' + tr('Vincule a uma obra já cadastrada quando o orçamento for um aditivo ou uma ampliação.') + '</p></section>') +
      '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="mz-excluir-projeto" data-id="' + id + ('">' + tr('Excluir') + '</button>') : '') +
        '<a class="btn btn-contorno" href="' + (id ? '#/measure/projeto/' + id : '#/measure') + ('">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="mz-salvar-projeto">') + (id ? tr('Salvar') : tr('Criar projeto')) + '</button></div>' +
    '</form>',
  });
}

/* ---------- Projeto: folhas e quantidades ---------- */

function telaProjeto(id) {
  const p = projeto(id);
  const fs = folhasDo(id);
  const cs = condicoesDo(id);
  const escalaTxt = (f) => !f.escala ? ('<span class="etiqueta etiqueta-ambar">' + tr('sem escala') + '</span>')
    : esc(f.escala.nome) + (f.escala.conferencia ? (f.escala.conferencia.ok ? ' <span class="etiqueta etiqueta-verde">conferida</span>' : (' <span class="etiqueta etiqueta-alerta">' + tr('conferência com diferença') + '</span>')) : (' <span class="etiqueta etiqueta-neutro">' + tr('não conferida') + '</span>'));
  const dado = (rot, html) => html ? '<div><dt>' + rot + '</dt><dd>' + html + '</dd></div>' : '';
  return moldura({
    ativo: 'projetos', largura: 'larga', titulo: p.nome, subtitulo: textoPartes(p) + ' · ' + enderecoDoProjeto(p), voltar: { href: '#/measure', rotulo: tr('Projetos') },
    acoes: '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + p.id + ('/editar">' + tr('Editar projeto') + '</a>') +
      '<a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + p.id + '/cotacao">' + icone('tabela', 16) + (tr('Lista para cotação') + '</a>') +
      '<a class="btn btn-contorno btn-pequeno" href="#/measure/projeto/' + p.id + '/proposta">' + icone('daily', 16) + tr('Proposta') + ((p.propostas || []).length ? ' · ' + p.propostas[p.propostas.length - 1].numero : '') + '</a>' +
      '<label class="btn btn-primario btn-pequeno">' + icone('mais', 16) + (tr('Enviar PDF') + '<input type="file" accept="application/pdf,.pdf" id="mz-enviar" data-projeto="') + p.id + '" class="visualmente-oculto"></label></div>',
    conteudo:
      '<section class="cartao"><dl class="mz-dados">' + dado(tr('Contratante'), contratanteDe(p) ? esc(contratanteDe(p).nome) + ' <span class="mudo pequeno">· ' + esc(contratanteDe(p).papeis.map((x) => PAPEIS[x].nome.toLowerCase()).join(', ')) + '</span>' : '') +
        dado(tr('Dono da obra'), p.donoId && contato(p.donoId) ? esc(contato(p.donoId).nome) : '') + dado(tr('Situação'), etiquetaSituacao(p)) + dado(tr('Tipo'), esc(TIPOS_PROJETO[p.tipo] || '')) + dado(tr('Prazo da proposta'), textoPrazo(p)) +
        dado(tr('Estimador'), esc(nomeUsuario(p.estimadorId))) + dado(tr('Obra vinculada'), p.obraId && obra(p.obraId) ? esc(obra(p.obraId).nome) : '') + dado(tr('Escopo'), esc(p.descricao)) + '</dl></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Folhas') + '</h2>') + (fs.length ? ('<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>' + tr('Folha') + '</th><th>' + tr('Escala') + '</th><th class="num">' + tr('Medições') + '</th><th></th></tr></thead><tbody>') +
        fs.map((f) => {
          const n = cs.reduce((t, c) => t + c.medicoes.filter((m) => m.folhaId === f.id).length, 0);
          return '<tr><td><a href="#/measure/folha/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.arquivo.nome || '') + (f.pagina > 1 ? (' ' + tr('· página') + ' ') + f.pagina : '') + '</span></td>' +
            '<td>' + escalaTxt(f) + '</td><td class="num">' + n + '</td><td class="num"><a class="btn btn-contorno btn-pequeno" href="#/measure/folha/' + f.id + ('">' + tr('Abrir') + '</a></td></tr>');
        }).join('') + '</tbody></table></div>' : ('<p class="vazio">' + tr('Nenhuma folha ainda. Envie o PDF do jogo de plantas: cada página vira uma folha.') + '</p>')) + '</section>' +
      htmlTypicaisDoProjeto(p) +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Quantidades') + '</h2><div class="tabela-rolagem"><table class="tabela tabela-quantidades"><thead><tr><th>' + tr('Condição') + '</th><th>' + tr('Medido') + '</th><th>' + tr('Derivadas') + '</th><th class="num">' + tr('Medições') + '</th></tr></thead><tbody>') +
        cs.map((c) => {
          const t = totaisDaCondicao(c);
          return '<tr><td><span class="mz-cor" style="background:' + c.cor + '"></span><b>' + esc(c.nome) + '</b><span class="mudo pequeno bloco">' + TIPOS[c.tipo].nome + (textoProps(c) ? ' · ' + esc(textoProps(c)) : '') +
              (folhasDaCondicao(c).length ? ' · ' + esc(folhasDaCondicao(c).map(nomeFolha).join(', ')) : '') + '</span></td>' +
            '<td><b>' + (t.medicoes ? textoPrincipal(c, t) : '<span class="mudo">—</span>') + '</b>' + (t.semEscala ? '<span class="etiqueta etiqueta-ambar">' + t.semEscala + (' ' + tr('sem escala') + '</span>') : '') + '</td>' +
            '<td>' + (t.medicoes ? t.derivados.map((d) => '<span class="bloco">' + esc(d.nome) + ': <b>' + textoDerivado(d) + '</b></span>').join('') : '') + '</td>' +
            '<td class="num">' + t.medicoes + '</td></tr>';
        }).join('') + (cs.length ? '' : ('<tr><td colspan="4" class="mudo">' + tr('Nada medido ainda. Abra uma folha e inclua os assemblies que vai medir.') + '</td></tr>')) + '</tbody></table></div></section>' +
      htmlMateriais(id) +
      ('<p class="dica">' + tr('Tudo é guardado em polegadas (e polegadas², polegadas³) e mostrado em pés e polegadas, sq ft e cu yd. Os pontos ficam na página do PDF, não em pixels: mudar o zoom não muda a medida.') + '</p>'),
  });
}

/* O que se repete no projeto: cada typical, as ocorrências e quanto cada condição mede por unidade. */
function htmlTypicaisDoProjeto(p) {
  const ts = typicaisDo(p.id);
  if (!ts.length) return '';
  const qtdPor = (c, base) => c.tipo === 'contagem' ? numero(base) + ' each' : c.tipo === 'linear' ? formatarLinear(base) : formatarArea(base);
  return '<section class="cartao" id="mz-typicais-projeto"><h2 class="cartao-titulo">' + icone('repetir', 18) + (' ' + tr('Typicals (o que se repete)') + '</h2>') + ts.map((t) => {
    const n = repeticoes(t);
    const med = medidoNoTypical(t);
    return '<div class="mz-typical-projeto"><p><b>' + esc(t.nome) + ('</b> <span class="mz-vezes">' + tr('×') + ' ') + n + '</span> <span class="mudo pequeno">· ' + esc((folha(t.folhaId) || {}).nome || '') + ' · ' + (t.regiao ? tr('região marcada') : tr('a folha inteira')) + '</span></p>' +
      ('<div class="tabela-rolagem"><table class="tabela tabela-typical"><thead><tr><th>' + tr('Condição') + '</th><th class="num">' + tr('Por unidade') + '</th>') + t.ocorrencias.map((o) => '<th class="num">' + esc(o.rotulo) + (' ' + tr('(×') + ' ') + o.quantidade + ')</th>').join('') + ('<th class="num">' + tr('Total (×') + ' ') + n + ')</th></tr></thead><tbody>' +
        (med.length ? med.map((x) => '<tr><td><span class="mz-cor" style="background:' + x.condicao.cor + '"></span>' + esc(x.condicao.nome) + '</td><td class="num">' + qtdPor(x.condicao, x.base) + '</td>' +
          t.ocorrencias.map((o) => '<td class="num">' + qtdPor(x.condicao, x.base * o.quantidade) + '</td>').join('') + '<td class="num"><b>' + qtdPor(x.condicao, x.base * n) + '</b></td></tr>').join('')
          : '<tr><td colspan="' + (3 + t.ocorrencias.length) + ('" class="mudo">' + tr('Nada medido dentro dele ainda.') + '</td></tr>')) + '</tbody></table></div></div>';
  }).join('') + ('<p class="mudo pequeno">' + tr('As quantidades, os materiais, a cotação e a proposta já contam as repetições.') + '</p></section>');
}

/* Materiais e mão de obra: o que os assemblies calculam a partir das medições. */
function htmlMateriais(projetoId) {
  const q = quantidadesDoProjeto(projetoId);
  const pend = q.linhas.filter((x) => x.erro);
  const grupos = Object.keys(CATEGORIAS).map((cat) => [cat, q.porItem.filter((g) => g.item.categoria === cat)]).filter(([, gs]) => gs.length);
  const horas = q.porItem.filter((g) => g.item.categoria === 'mao-de-obra').reduce((t, g) => t + g.total, 0);
  return ('<section class="cartao" id="mz-materiais"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Materiais e mão de obra') + '</h2>') +
      (q.porItem.length ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-csv" data-projeto="' + projetoId + '">' + icone('baixar', 16) + (tr('Exportar CSV') + '</button>') : '') + '</div>' +
    ('<p class="mudo pequeno">' + tr('Calculado pelos assemblies aplicados em cada condição. Toque num item para ver o cálculo: condição → variáveis → fórmula → perda → arredondamento.') + '</p>') +
    (horas ? '<p class="mz-horas">' + icone('relogio', 16) + (tr('Mão de obra estimada:') + ' <b>') + qtd(horas) + (' h</b> <span class="mudo pequeno">' + tr('(por etapa, vira o orçamento de horas do Crew na próxima etapa)') + '</span></p>') : '') +
    (grupos.length ? grupos.map(([cat, gs]) => '<h3 class="mz-grupo">' + CATEGORIAS[cat] + '</h3><div class="mz-itens">' + gs.map((g) =>
      '<details class="mz-item"><summary><span class="mz-item-nome"><b>' + esc(g.item.nome) + '</b><span class="mudo pequeno">' + esc(g.item.codigo) + ' · ' + esc(g.item.etapa) + '</span></span>' +
        '<span class="mz-item-qtd"><b>' + qtd(g.total) + '</b> ' + esc(g.item.unidade) + '</span></summary>' +
        '<ul class="mz-rastro">' + g.linhas.map((x) => '<li><span><b>' + esc(x.condicao.nome) + '</b> · ' + esc(x.assembly.nome) + '</span><span class="mz-conta">' + rastro(x, g.item.unidade) + '</span>' +
          '<span class="mudo pequeno">' + esc(textoVariaveis(x.vars)) + '</span></li>').join('') + '</ul></details>').join('') + '</div>').join('')
      : ('<p class="vazio">' + tr('Meça as condições que têm assemblies para ver os materiais.') + '</p>')) +
    (pend.length ? ('<div class="mz-pendencias"><b>' + tr('Pendências') + '</b><ul>') + Array.from(new Set(pend.map((x) => esc(x.condicao.nome) + ' · ' + esc(x.assembly.nome) + ': ' + esc(x.erro)))).map((t) => '<li>' + t + '</li>').join('') + '</ul></div>' : '') +
    '</section>';
}

/* ---------- Itens (catálogo) ---------- */

function telaItens() {
  const pc = podeCatalogo();
  return moldura({
    ativo: 'itens', largura: 'larga', titulo: tr('Itens'), subtitulo: tr('Catálogo de materiais, mão de obra, equipamentos e subempreiteiros, na unidade de compra'),
    acoes: pc ? '<button type="button" class="btn btn-primario btn-pequeno" data-acao="mz-item" data-id="">' + icone('mais', 16) + (tr('Novo item') + '</button>') : '',
    conteudo: Object.entries(CATEGORIAS).map(([cat, nome]) => {
      const lista = itens().filter((i) => i.categoria === cat);
      if (!lista.length) return '';
      return '<section class="cartao"><h2 class="cartao-titulo">' + nome + ('</h2><div class="tabela-rolagem"><table class="tabela tabela-itens"><thead><tr><th>' + tr('Código') + '</th><th>' + tr('Item') + '</th><th>' + tr('Unidade de compra') + '</th><th>' + tr('Etapa (cost code)') + '</th><th></th></tr></thead><tbody>') +
        lista.map((i) => '<tr><td class="mudo">' + esc(i.codigo) + '</td><td><b>' + esc(i.nome) + '</b>' + (i.nota ? '<span class="mudo pequeno bloco">' + esc(i.nota) + '</span>' : '') + '</td><td>' + esc(i.unidade) + '</td><td>' + esc(i.etapa) + '</td>' +
          '<td class="num">' + (pc ? '<button type="button" class="link-botao pequeno" data-acao="mz-item" data-id="' + i.id + ('">' + tr('Editar') + '</button> <button type="button" class="link-botao pequeno" data-acao="mz-excluir-item" data-id="') + i.id + ('">' + tr('Excluir') + '</button>') : '') + '</td></tr>').join('') +
        '</tbody></table></div></section>';
    }).join('') +
      ('<p class="dica">' + tr('Preço não fica aqui: ele terá vigência (data de início) e entra na próxima etapa, a estimativa. As coberturas nas notas são exemplos.') + '</p>'),
  });
}

/* ---------- Assemblies ---------- */

function telaAssemblies() {
  const usos = (a) => projetos().flatMap((p) => condicoesDo(p.id)).filter((c) => (c.assemblies || []).includes(a.id)).length;
  return moldura({
    ativo: 'assemblies', largura: 'larga', titulo: tr('Assemblies'), subtitulo: tr('Um conjunto de itens com fórmulas: uma medição alimenta vários materiais e a mão de obra'),
    acoes: podeCatalogo() ? '<a class="btn btn-primario btn-pequeno" href="#/measure/assembly/novo">' + icone('mais', 16) + (tr('Novo assembly') + '</a>') : '',
    conteudo: ('<section class="cartao"><div class="tabela-rolagem"><table class="tabela mz-assemblies"><thead><tr><th>' + tr('Assembly') + '</th><th>' + tr('Tipo') + '</th><th>' + tr('Resumo') + '</th><th class="num">' + tr('Em uso') + '</th><th></th></tr></thead><tbody>') +
      assemblies().map((a) => '<tr><td><a class="mz-assembly" href="#/measure/assembly/' + a.id + '"><b>' + esc(a.nome) + '</b></a>' + (a.descricao ? '<span class="mudo pequeno bloco">' + esc(a.descricao) + '</span>' : '') + '</td>' +
        '<td>' + TIPOS[a.tipo].nome + '</td><td class="pequeno">' + esc(resumoAssembly(a)) + '</td>' +
        '<td class="num">' + (usos(a) ? usos(a) + (usos(a) === 1 ? (' ' + tr('condição')) : (' ' + tr('condições'))) : '<span class="mudo">—</span>') + '</td>' +
        '<td class="num"><a class="btn btn-contorno btn-pequeno" href="#/measure/assembly/' + a.id + '">' + (podeCatalogo() ? tr('Editar') : tr('Ver')) + '</a></td></tr>').join('') +
      '</tbody></table></div></section>',
  });
}

/* Cor das marcações da condição no desenho: paleta sugerida ou qualquer outra cor. */
function htmlEscolhaCor(cor) {
  const dis = '';
  const atual = cor.toUpperCase();
  return ('<fieldset class="campo mz-escolha-cor"><legend class="rotulo-pequeno">' + tr('Cor no desenho') + '</legend><div class="mz-cores">') +
    PALETA.map((c) => '<label class="mz-amostra" title="' + c + '"><input type="radio" name="corPaleta" value="' + c + '"' + (c === atual ? ' checked' : '') + dis + (' aria-label="' + tr('Cor') + ' ') + c + '"><span style="background:' + c + '"></span></label>').join('') +
    ('<label class="mz-outra-cor">' + tr('Outra') + ' <input type="color" name="cor" id="mz-cor" value="') + atual.toLowerCase() + '"' + dis + '></label></div></fieldset>';
}

function htmlLinhaAssembly(l, tipo, i, editavel) {
  const dis = editavel ? '' : ' disabled';
  return '<tr class="mz-linha" data-i="' + i + '"><td><select name="item"' + dis + ('><option value="">' + tr('Escolha o item') + '</option>') +
      Object.entries(CATEGORIAS).map(([cat, nome]) => '<optgroup label="' + nome + '">' + itens().filter((x) => x.categoria === cat).map((x) => '<option value="' + x.id + '"' + (x.id === l.itemId ? ' selected' : '') + '>' + esc(x.nome) + ' (' + esc(x.unidade) + ')</option>').join('') + '</optgroup>').join('') + '</select></td>' +
    '<td><input type="text" name="formula" class="mz-formula" value="' + esc(l.formula || '') + ('" placeholder="' + tr('Ex.: MeasuredArea / 32') + '" spellcheck="false" autocomplete="off"') + dis + '></td>' +
    '<td><span class="campo-pct"><input type="number" name="perda" min="0" max="100" step="0.5" value="' + (l.perda != null ? l.perda : 0) + '"' + dis + '>%</span></td>' +
    '<td><select name="passo"' + dis + '>' + ARREDONDAMENTOS.map(([p, n]) => '<option value="' + p + '"' + (p === (l.passo || 0) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></td>' +
    '<td class="mz-teste" aria-live="polite"></td>' +
    '<td>' + (editavel ? ('<button type="button" class="link-botao" data-acao="mz-tirar-linha" aria-label="' + tr('Tirar a linha') + '">✕</button>') : '') + '</td></tr>';
}

function htmlAjudaVariaveis(tipo) {
  const teste = VALORES_DE_TESTE[tipo];
  return ('<b>' + tr('Variáveis desta condição') + '</b><ul>') + variaveisDoTipo(tipo).map((v) => '<li><code>' + v.nome + '</code> <span class="mudo">' + esc(v.unidade) + ' · ' + esc(v.descricao) + (v.requer ? (' ' + tr('(precisa de') + ' ') + v.requer + ')' : '') + '</span></li>').join('') + '</ul>' +
    ('<p class="pequeno">' + tr('Funções:') + ' ') + FUNCOES.map((f) => '<code>' + f + '()</code>').join(' ') + (tr('. Perda e arredondamento ficam nas colunas, fora da fórmula.') + '</p>') +
    ('<p class="pequeno mudo">' + tr('A coluna "Teste" usa:') + ' ') + esc(textoVariaveis(teste)) + '.</p>';
}

function telaAssembly(id) {
  const a = id ? assembly(id) : { nome: '', tipo: 'area', descricao: '', linhas: [] };
  const ed = podeCatalogo();
  const linhas = a.linhas.length ? a.linhas : [{ perda: 0, passo: 1 }];
  return moldura({
    ativo: 'assemblies', largura: 'larga', titulo: id ? a.nome : tr('Novo assembly'), voltar: { href: '#/measure/assemblies', rotulo: tr('Assemblies') },
    conteudo: '<form id="form-assembly" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      '<section class="cartao"><div class="grade-campos">' +
        ('<div class="campo"><label class="rotulo-pequeno" for="as-nome">' + tr('Nome') + '</label><input type="text" id="as-nome" name="nome" value="') + esc(a.nome) + '"' + (ed ? '' : ' disabled') + '></div>' +
        ('<div class="campo"><label class="rotulo-pequeno" for="as-tipo">' + tr('Para condições do tipo') + '</label><select id="as-tipo" name="tipo"') + (id || !ed ? ' disabled' : '') + '>' + Object.entries(TIPOS).map(([t, x]) => '<option value="' + t + '"' + (t === a.tipo ? ' selected' : '') + '>' + x.nome + ' (' + x.unidade + ')</option>').join('') + '</select></div>' +
      ('</div><div class="campo"><label class="rotulo-pequeno" for="as-desc">' + tr('Descrição') + '</label><input type="text" id="as-desc" name="descricao" value="') + esc(a.descricao) + '"' + (ed ? '' : ' disabled') + '></div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Linhas') + '</h2><div class="tabela-rolagem"><table class="tabela mz-tabela-linhas"><thead><tr><th>' + tr('Item') + '</th><th>' + tr('Fórmula (quantidade bruta)') + '</th><th>' + tr('Perda') + '</th><th>' + tr('Arredondamento') + '</th><th>' + tr('Teste') + '</th><th></th></tr></thead><tbody id="as-linhas">') +
        linhas.map((l, i) => htmlLinhaAssembly(l, a.tipo, i, ed)).join('') + '</tbody></table></div>' +
        (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-nova-linha">' + icone('mais', 14) + (tr('Linha') + '</button>') : '') +
        '<div class="mz-ajuda" id="as-ajuda">' + htmlAjudaVariaveis(a.tipo) + '</div></section>' +
      (ed ? '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="mz-excluir-assembly" data-id="' + id + ('">' + tr('Excluir') + '</button>') : '') +
        ('<a class="btn btn-contorno" href="#/measure/assemblies">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="mz-salvar-assembly">' + tr('Salvar assembly') + '</button></div>') : ('<p class="dica">' + tr('Só quem tem a permissão "Itens e assemblies" edita.') + '</p>')) +
    '</form>',
  });
}

/* Teste ao vivo de cada linha, com os valores de exemplo do tipo. */
function testarLinhas() {
  const form = document.getElementById('form-assembly');
  if (!form) return;
  const tipo = form.querySelector('[name="tipo"]').value;
  form.querySelectorAll('.mz-linha').forEach((linha) => {
    const alvo = linha.querySelector('.mz-teste');
    const formula = linha.querySelector('[name="formula"]').value;
    const it = item(linha.querySelector('[name="item"]').value);
    if (!formula.trim()) { alvo.textContent = ''; alvo.className = 'mz-teste'; return; }
    const r = calcularLinha({ formula, perda: Number(linha.querySelector('[name="perda"]').value) || 0, passo: Number(linha.querySelector('[name="passo"]').value) || 0 }, tipo, VALORES_DE_TESTE[tipo]);
    alvo.className = 'mz-teste' + (r.erro ? ' erro' : '');
    alvo.textContent = r.erro ? r.erro : qtd(r.bruta) + (r.comPerda !== r.bruta ? ' → ' + qtd(r.comPerda) : '') + (r.final !== r.comPerda ? ' → ' + qtd(r.final) : '') + ' ' + (it ? it.unidade : '');
  });
}

/* ---------- Visor de medição ---------- */

const visor = {
  folhaId: null, condicaoId: null, ferramenta: 'medir', zoom: 1,
  pontos: [], cursor: null, cal: [], viewport: null, page: null, arrastando: null, espaco: false,
  abertas: new Set(), fechadas: new Set(), gruposFechados: new Set(), // estado da árvore do painel
};
const condicaoVisivel = (c) => !c.oculta;
// ferramentas que desenham pontos (as outras: mover, calibrar, conferir)
const desenhando = () => ['medir', 'recortar', 'vao', 'typical'].includes(visor.ferramenta);
const textoOcorrencias = (t) => t.ocorrencias.map((o) => o.rotulo + ' ' + o.quantidade).join(' · ');
const nomeCurto = (c) => c.nome.split(' (')[0];
const nomeFolha = (f) => f.nome.split(' · ')[0];
/* Total da condição só nesta folha (o painel mostra o que está no desenho aberto). */
function totalNaFolha(c, folhaId) {
  let base = 0, medicoes = 0;
  for (const m of c.medicoes) if (m.folhaId === folhaId) { const v = valorDaMedicao(c, m); medicoes++; if (v != null) base += v * fatorDaMedicao(m); }
  return { base, medicoes };
}

function telaFolha(id) {
  const f = folha(id);
  if (visor.folhaId !== id) {
    Object.assign(visor, { folhaId: id, pontos: [], cal: [], cursor: null, zoom: 0, page: null, viewport: null });
    const cs = condicoesDaFolha(id);
    visor.condicaoId = cs.length ? cs[0].id : null;
    visor.ferramenta = f.escala ? 'medir' : 'mover';
  }
  return moldura({
    largura: 'total', semMenu: true,
    conteudo: '<div class="mz-visor">' +
      '<div class="mz-barra" id="mz-barra">' + htmlBarra() + '</div>' +
      ('<div class="mz-corpo"><aside class="mz-painel" id="mz-painel" aria-label="' + tr('Condições') + '">') + htmlPainel() + '</aside>' +
        ('<div class="mz-area" id="mz-area" tabindex="0" aria-label="' + tr('Planta: use o mouse para medir') + '"><div class="mz-folha" id="mz-folha"><canvas id="mz-pdf"></canvas><canvas id="mz-desenho"></canvas></div>') +
        ('<p class="mz-carregando" id="mz-carregando">' + tr('Abrindo a planta…') + '</p></div></div>') +
      '<p class="mz-dica" id="mz-dica">' + esc(dica()) + '</p></div>',
  });
}

function htmlBarra() {
  const f = folha(visor.folhaId);
  const semEscala = !f.escala;
  const ativa = condicao(visor.condicaoId);
  const semArea = !ativa || ativa.tipo !== 'area';
  // botão de um grupo (segmentado): ícone + rótulo; o ativo fica em destaque
  const ferr = (id, rot, ic, motivo, dica) => '<button type="button" class="mz-seg' + (visor.ferramenta === id ? ' ativo' : '') + '" data-acao="mz-ferramenta" data-ferramenta="' + id + '" aria-pressed="' + (visor.ferramenta === id) + '"' +
    (motivo ? (' ' + tr('disabled title=') + '"') + motivo + '"' : ' title="' + dica + '"') + '>' + icone(ic, 16) + '<span>' + rot + '</span></button>';
  const precisaEscala = semEscala ? tr('Defina a escala primeiro') : '';
  const conf = f.escala && f.escala.conferencia;
  const estado = !f.escala ? '' : !conf ? 'pendente' : conf.ok ? 'ok' : 'erro';
  // a planta ocupa a tela: o caminho de volta e o nome da folha ficam na própria barra
  const fs = folhasDo(f.projetoId);
  return '<div class="mz-barra-titulo"><a class="voltar mz-voltar" href="#/measure/projeto/' + f.projetoId + ('" title="' + tr('Voltar para o projeto') + '">') + icone('voltar', 18) + '<span>' + esc(projeto(f.projetoId).nome) + '</span></a>' +
      (fs.length > 1 ? ('<select class="mz-trocar-folha" aria-label="' + tr('Folha') + '">') + fs.map((x) => '<option value="' + x.id + '"' + (x.id === f.id ? ' selected' : '') + '>' + esc(x.nome) + '</option>').join('') + '</select>' : '<h1 class="mz-titulo">' + esc(f.nome) + '</h1>') + '</div>' +
    ('<div class="mz-grupo-barra" role="toolbar" aria-label="' + tr('Ferramentas') + '">') +
      ferr('mover', tr('Mover'), 'seta', '', tr('Arrastar a planta (ou segure a barra de espaço)')) +
      ferr('medir', tr('Medir'), 'measure', precisaEscala, tr('Medir na condição escolhida')) +
      ferr('recortar', tr('Recortar'), 'borracha', precisaEscala || (semArea ? tr('Escolha uma condição de área (siding, piso…) para recortar') : ''), tr('Borracha: desenha uma área que sai do total')) +
      ferr('vao', tr('Vão'), 'janela', precisaEscala, tr('Desenhe a janela ou porta: conta o vão e recorta o siding')) +
      ferr('typical', tr('Typical'), 'repetir', typicaisDaFolha(f.id).some((t) => !t.regiao) ? tr('A folha inteira já é um typical') : '', tr('Marque a região que se repete (apartamento tipo, casa repetida)')) + '</div>' +
    (semEscala
      ? '<button type="button" class="mz-chamada" data-acao="mz-escala">' + icone('measure', 16) + (tr('Definir escala') + '</button>')
      : ('<div class="mz-grupo-barra" aria-label="' + tr('Escala') + '"><button type="button" class="mz-seg" data-acao="mz-escala" title="' + tr('Trocar a escala ou calibrar') + '"><span class="mz-ponto ') + estado + '" aria-hidden="true"></span>' + esc(f.escala.nome) + '</button>' +
          ferr('conferir', tr('Conferir'), 'aprovacoes', '', tr('Medir outra cota conhecida para conferir a escala')) + '</div>' +
        '<span class="mz-estado-escala ' + estado + '">' + (conf ? (conf.ok ? 'conferida ' : (tr('diferença') + ' ')) + numero(conf.diferenca * 100, 1) + '%' : tr('não conferida')) + '</span>') +
    '<div class="mz-barra-fim">' +
      ('<div class="mz-grupo-barra" aria-label="' + tr('Zoom') + '"><button type="button" class="mz-seg mz-seg-quadrado" data-acao="mz-zoom" data-passo="-1" aria-label="' + tr('Diminuir o zoom') + '" title="' + tr('Diminuir o zoom') + '">−</button>') +
        '<span class="mz-zoom" id="mz-zoom">' + Math.round(visor.zoom * 100) + '%</span>' +
        ('<button type="button" class="mz-seg mz-seg-quadrado" data-acao="mz-zoom" data-passo="1" aria-label="' + tr('Aumentar o zoom') + '" title="' + tr('Aumentar o zoom') + '">+</button>') +
        ('<button type="button" class="mz-seg" data-acao="mz-zoom" data-passo="0" title="' + tr('Caber a folha inteira') + '">' + tr('Ajustar') + '</button></div>') +
      '<button type="button" class="mz-seg mz-seg-solto" data-acao="mz-tela-cheia" aria-pressed="' + !!document.fullscreenElement + '" aria-label="' + (document.fullscreenElement ? tr('Sair da tela cheia') : tr('Tela cheia')) + '" title="' + (document.fullscreenElement ? tr('Sair da tela cheia') : tr('Tela cheia')) + '">' +
        icone(document.fullscreenElement ? 'recolher' : 'expandir', 16) + '</button></div>';
}

/* Quantidade curta para a linha da árvore (a completa, em ft-in, fica no detalhe). */
function textoCurto(c, t) {
  if (c.tipo === 'contagem') return numero(t.base) + ' each';
  if (c.tipo === 'linear') return formatarLinear(t.base);
  return formatarArea(t.base);
}

/* Painel em árvore: tipo → condição → assemblies e medições. A condição ativa abre sozinha. */
function htmlPainel() {
  const f = folha(visor.folhaId);
  const cs = condicoesDaFolha(f.id);
  const nOcultas = cs.filter((c) => c.oculta).length;
  const caret = (aberto) => '<span class="mz-caret' + (aberto ? ' aberto' : '') + '" aria-hidden="true">▸</span>';
  return ('<div class="mz-painel-cabeca"><h2>' + tr('Condições') + ' <span class="mz-contagem">') + cs.length + '</span></h2><button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-incluir-assembly">' + icone('mais', 14) + (tr('Incluir assembly') + '</button></div>') +
    (cs.length ? '' : ('<p class="mz-vazio-painel">' + tr('Nada no desenho ainda. Clique em') + ' <b>' + tr('Incluir assembly') + '</b>' + tr(', escolha do catálogo (parede, piso, janela…) e comece a medir.') + '</p>')) +
    (cs.length > 1 ? '<div class="mz-cond-acoes mz-visiveis"><button type="button" class="link-botao pequeno" data-acao="mz-mostrar-todas" data-mostrar="1"' + (nOcultas ? '' : ' disabled') + ('>' + tr('Mostrar todas') + '</button>') +
      '<button type="button" class="link-botao pequeno" data-acao="mz-mostrar-todas" data-mostrar=""' + (nOcultas === cs.length ? ' disabled' : '') + ('>' + tr('Ocultar todas') + '</button></div>') : '') +
    htmlTypicais(f) +
    '<div class="mz-arvore" role="tree">' + Object.entries(TIPOS).map(([tipo, tp]) => {
      const lista = cs.filter((c) => c.tipo === tipo);
      if (!lista.length) return '';
      const grupoAberto = !visor.gruposFechados.has(tipo);
      return '<div class="mz-grupo-arvore" role="group"><button type="button" class="mz-no-grupo" data-acao="mz-grupo" data-tipo="' + tipo + '" aria-expanded="' + grupoAberto + '">' + caret(grupoAberto) +
          '<span>' + tp.nome + '</span><span class="mz-contagem">' + lista.length + '</span><span class="mz-unidade">' + tp.unidade + '</span></button>' +
        (grupoAberto ? lista.map((c) => htmlNoCondicao(c, f, caret)).join('') : '') + '</div>';
    }).join('') + '</div>';
}

function htmlNoCondicao(c, f, caret) {
  const t = totaisDaCondicao(c);
  const tf = totalNaFolha(c, f.id);
  const outras = folhasDaCondicao(c).filter((x) => x.id !== f.id);
  const aqui = c.medicoes.filter((m) => m.folhaId === f.id);
  const ativa = c.id === visor.condicaoId;
  const aberta = ativa ? !visor.fechadas.has(c.id) : visor.abertas.has(c.id);
  const visivel = condicaoVisivel(c);
  const as = (c.assemblies || []).map((aid) => assembly(aid)).filter(Boolean);
  return '<div class="mz-cond' + (ativa ? ' ativa' : '') + (visivel ? '' : ' oculta') + '" style="--cor:' + c.cor + '" role="treeitem" aria-expanded="' + aberta + '" aria-selected="' + ativa + '">' +
    '<div class="mz-cond-cabeca"><button type="button" class="mz-abrir" data-acao="mz-abrir" data-id="' + c.id + '" aria-label="' + (aberta ? (tr('Recolher') + ' ') : (tr('Abrir') + ' ')) + esc(c.nome) + '">' + caret(aberta) + '</button>' +
      '<input type="checkbox" class="mz-visivel" data-acao="mz-visivel" data-id="' + c.id + '"' + (visivel ? ' checked' : '') + (' aria-label="' + tr('Mostrar') + ' ') + esc(c.nome) + (' ' + tr('no desenho') + '" title="' + tr('Mostrar no desenho') + '">') +
      '<button type="button" class="mz-cond-topo" data-acao="mz-condicao" data-id="' + c.id + '" aria-pressed="' + ativa + '"><span class="mz-cor" style="background:' + c.cor + '"></span>' +
        '<span class="mz-cond-nome"><b>' + esc(c.nome) + '</b>' + (visivel ? '' : ' <span class="etiqueta etiqueta-neutro">oculta</span>') +
        (textoProps(c) ? '<span class="mudo pequeno bloco">' + esc(textoProps(c)) + '</span>' : '') + '</span></button>' +
      '<span class="mz-total">' + (tf.medicoes ? textoCurto(c, tf) : '<span class="mudo">—</span>') + '</span></div>' +
    (aberta ? '<div class="mz-filhos">' +
      '<div class="mz-detalhe">' + (tf.medicoes ? ('<span>' + tr('Nesta folha:') + ' <b>') + textoPrincipal(c, tf) + '</b></span>' : ('<span class="mudo">' + tr('nada medido nesta folha') + '</span>')) +
        (outras.length ? ('<span>' + tr('Também em') + ' ') + esc(outras.map(nomeFolha).join(', ')) + (' ' + tr('· projeto:') + ' <b>') + (t.medicoes ? textoPrincipal(c, t) : '—') + '</b></span>' : '') +
        (t.medicoes ? t.derivados.map((d) => '<span class="mz-derivado">' + esc(d.nome) + ': <b>' + textoDerivado(d) + '</b></span>').join('') : '') + '</div>' +
      ('<div class="mz-ramo"><span class="mz-ramo-titulo">' + tr('Assemblies') + ' <span class="mz-contagem">') + as.length + '</span></span>' +
        '<ul class="mz-folhas-arvore">' + as.map((a) => '<li><span>' + esc(a.nome) + '</span><button type="button" class="link-botao" data-acao="mz-remover-assembly" data-cond="' + c.id + '" data-id="' + a.id + ('" aria-label="' + tr('Tirar') + ' ') + esc(a.nome) + ('" title="' + tr('Tirar o assembly') + '">✕</button></li>')).join('') +
          '<li><button type="button" class="link-botao pequeno" data-acao="mz-aplicar-assembly" data-cond="' + c.id + ('">' + tr('+ Aplicar assembly') + '</button></li></ul></div>') +
      ('<div class="mz-ramo"><span class="mz-ramo-titulo">' + tr('Medições nesta folha') + ' <span class="mz-contagem">') + aqui.length + '</span></span>' +
        (aqui.length ? '<ol class="mz-medicoes mz-folhas-arvore">' + aqui.map((m, i) => {
          const v = valorDaMedicao(c, m);
          const txt = c.tipo === 'contagem' ? tr('1 each') : v == null ? tr('sem escala') : c.tipo === 'linear' ? formatarPesPolegadas(v) : (v < 0 ? '− ' : '') + formatarArea(Math.abs(v));
          const tipoM = m.vaoDe ? (tr('Vão') + ' ') + esc(nomeCurto(condicao(m.vaoDe.condicaoId) || { nome: '?' })) + ': ' : m.desconto ? (tr('Recorte:') + ' ') : '';
          const nota = m.vao ? (' <span class="mudo">' + tr('(desenhado')) + (m.vao.recortes.length ? (tr(', recorta') + ' ') + esc(m.vao.recortes.map((r) => nomeCurto(condicao(r.condicaoId) || { nome: '?' })).join(', ')) : '') + ')</span>' : '';
          const fator = fatorDaMedicao(m);
          return '<li class="' + (m.desconto ? 'mz-med-recorte' : '') + '"><span>' + (i + 1) + '. ' + tipoM + txt + nota + (fator > 1 ? (' <span class="mz-vezes" title="' + tr('Typical:') + ' ') + esc(typicalDaMedicao(m).nome) + ('">' + tr('×') + ' ') + fator + '</span>' : '') + '</span><button type="button" class="link-botao" data-acao="mz-apagar-medicao" data-cond="' + c.id + '" data-id="' + m.id + ('" aria-label="' + tr('Apagar a medição') + ' ') + (i + 1) + '">✕</button></li>';
        }).join('') + '</ol>' : ('<p class="mudo pequeno mz-folhas-arvore">' + tr('Escolha a ferramenta Medir e clique na planta.') + '</p>')) + '</div>' +
      '<div class="mz-cond-acoes"><button type="button" class="link-botao pequeno" data-acao="mz-editar-condicao" data-id="' + c.id + ('">' + tr('Editar') + '</button>') +
        (outras.length ? '<button type="button" class="link-botao pequeno" data-acao="mz-tirar-da-folha" data-id="' + c.id + ('">' + tr('Tirar desta folha') + '</button>') : '') +
        '<button type="button" class="link-botao pequeno" data-acao="mz-excluir-condicao" data-id="' + c.id + ('">' + tr('Excluir') + '</button></div>') +
    '</div>' : '') + '</div>';
}

/* Os typicals desta folha: o que se repete e quantas vezes. */
function htmlTypicais(f) {
  const ts = typicaisDaFolha(f.id);
  return '<div class="mz-typicais">' + (ts.length ? ts.map((t) => '<div class="mz-typical"><span class="mz-typical-icone">' + icone('repetir', 14) + '</span>' +
      '<span class="mz-typical-nome"><b>' + esc(t.nome) + ('</b> <span class="mz-vezes">' + tr('×') + ' ') + repeticoes(t) + '</span><span class="mudo pequeno bloco">' + (t.regiao ? tr('região marcada') : tr('a folha inteira')) + ' · ' + esc(textoOcorrencias(t)) + '</span></span>' +
      '<button type="button" class="link-botao pequeno" data-acao="mz-typical-editar" data-id="' + t.id + ('">' + tr('Editar') + '</button></div>')).join('')
    : '<button type="button" class="link-botao pequeno" data-acao="mz-typical-folha">' + icone('repetir', 14) + (' ' + tr('Esta folha se repete (pavimento tipo, casa repetida)') + '</button>')) + '</div>';
}

function dica() {
  const f = folha(visor.folhaId);
  const c = condicao(visor.condicaoId);
  if (visor.ferramenta === 'calibrar') return visor.cal.length ? tr('Agora clique na outra ponta da cota.') : 'Calibrar: clique nas duas pontas de uma cota conhecida (ex.: a de 40\'-0"). Shift deixa a linha reta.';
  if (visor.ferramenta === 'conferir') return visor.cal.length ? tr('Agora clique na outra ponta da cota.') : tr('Conferir: meça OUTRA cota conhecida, de preferência na outra direção. O sistema mostra a diferença.');
  if (!f.escala) return tr('Primeiro, defina a escala da folha: escolha da lista (a escala está no carimbo) ou calibre por uma cota.');
  if (visor.ferramenta === 'typical') return visor.pontos.length ? tr('Agora clique no canto oposto da região que se repete.') : tr('Typical: clique num canto da unidade que se repete (ex.: o apartamento tipo) e depois no canto oposto. Tudo o que for medido dentro vale × as repetições.');
  if (visor.ferramenta === 'vao') return visor.pontos.length ? tr('Agora clique no canto oposto da janela ou porta.') : tr('Vão: clique num canto da janela ou porta e depois no canto oposto. Ela é contada e a área sai do siding (ou de outra área) que estiver por trás.');
  if (visor.ferramenta === 'mover') return tr('Arraste para mover a planta. Ctrl + rolagem do mouse: zoom.');
  if (!c) return tr('Inclua um assembly no painel ao lado (parede, piso, janela…) para começar a medir.');
  if (!condicaoVisivel(c)) return tr('As marcações de "') + c.nome + '" estão ocultas: marque a caixa ao lado do nome para vê-las.';
  if (c.tipo === 'contagem') return tr('Contagem: clique em cada item de "') + c.nome + '".';
  if (c.tipo === 'linear') return tr('Linear: clique nos pontos. Duplo clique ou Enter conclui, Esc cancela, Backspace desfaz o último ponto. Shift: linha reta. Perto de um ponto já medido, o clique gruda nele (Alt desliga). Para mais precisão, aumente o zoom.');
  if (visor.ferramenta === 'recortar') return tr('Recortar (borracha): clique nos cantos do que sai de "') + c.nome + '" (escada, chaminé, recorte). Duplo clique, Enter ou clique no primeiro ponto fecha.';
  return tr('Área: clique nos cantos. Duplo clique, Enter ou clique no primeiro ponto fecha a área.');
}

function atualizarInterface() {
  const barra = document.getElementById('mz-barra'), painel = document.getElementById('mz-painel'), dc = document.getElementById('mz-dica');
  if (barra) barra.innerHTML = htmlBarra();
  if (painel) painel.innerHTML = htmlPainel();
  if (dc) dc.textContent = dica();
  desenharSobreposicao();
}

/* ---------- PDF.js ---------- */

let pdfjsPromessa = null;
const documentos = new Map();
function carregarPdfjs() {
  if (!pdfjsPromessa) {
    pdfjsPromessa = import('../vendor/pdfjs/pdf.min.mjs').then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
      return m;
    });
  }
  return pdfjsPromessa;
}
async function abrirDocumento(f) {
  const chave = f.arquivo.tipo === 'url' ? f.arquivo.src : 'idb:' + f.arquivo.id;
  if (!documentos.has(chave)) {
    documentos.set(chave, (async () => {
      const pdfjs = await carregarPdfjs();
      const fonte = f.arquivo.tipo === 'url' ? { url: f.arquivo.src } : { data: new Uint8Array(await (await lerFoto(f.arquivo.id)).arrayBuffer()) };
      return pdfjs.getDocument(fonte).promise;
    })().catch((e) => { documentos.delete(chave); throw e; }));
  }
  return documentos.get(chave);
}

let tarefaRender = null;
async function renderizar() {
  const canvas = document.getElementById('mz-pdf');
  if (!canvas || !visor.page) return;
  const area = document.getElementById('mz-area');
  if (!visor.zoom) visor.zoom = ajustarZoom(area);
  const vp = visor.page.getViewport({ scale: visor.zoom });
  visor.viewport = vp;
  const dpr = window.devicePixelRatio || 1;
  for (const c of [canvas, document.getElementById('mz-desenho')]) {
    c.width = Math.floor(vp.width * dpr); c.height = Math.floor(vp.height * dpr);
    c.style.width = vp.width + 'px'; c.style.height = vp.height + 'px';
  }
  document.getElementById('mz-folha').style.width = vp.width + 'px';
  document.getElementById('mz-folha').style.height = vp.height + 'px';
  const z = document.getElementById('mz-zoom');
  if (z) z.textContent = Math.round(visor.zoom * 100) + '%';
  if (tarefaRender) { try { tarefaRender.cancel(); } catch (e) { /* já terminou */ } }
  tarefaRender = visor.page.render({ canvasContext: canvas.getContext('2d'), viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null });
  desenharSobreposicao();
  try { await tarefaRender.promise; } catch (e) { /* render cancelado por um zoom novo */ }
}
function ajustarZoom(area) {
  const base = visor.page.getViewport({ scale: 1 });
  return Math.max(0.25, Math.min(4, (area.clientWidth - 16) / base.width));
}

/* ---------- Coordenadas: tela (px do canvas) ↔ página do PDF (points) ---------- */

function paraPdf(x, y) { return visor.viewport.convertToPdfPoint(x, y); }
function paraTela(p) { return visor.viewport.convertToViewportPoint(p[0], p[1]); }

function pontoDoEvento(ev, comSnap) {
  let p = paraPdf(ev.offsetX, ev.offsetY);
  const raio = 6 / visor.zoom; // 6 px na tela, em points (Alt desliga a atração)
  if (comSnap && !ev.altKey) {
    const ancora = visor.pontos.length >= 3 && distancia(visor.pontos[0], p) < raio ? visor.pontos[0] : verticeProximo(visor.folhaId, p, raio, condicaoVisivel);
    if (ancora) return [ancora[0], ancora[1]];
  }
  const ultimo = desenhando() ? visor.pontos[visor.pontos.length - 1] : visor.cal[visor.cal.length - 1];
  if (ev.shiftKey && ultimo) p = Math.abs(p[0] - ultimo[0]) > Math.abs(p[1] - ultimo[1]) ? [p[0], ultimo[1]] : [ultimo[0], p[1]];
  return p;
}

/* ---------- Desenho das medições (camada de cima) ---------- */

function desenharSobreposicao() {
  const cv = document.getElementById('mz-desenho');
  if (!cv || !visor.viewport) return;
  const ctx = cv.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cv.width, cv.height);
  const f = folha(visor.folhaId);
  const rotulo = (x, y, texto, cor) => {
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    const w = ctx.measureText(texto).width + 10;
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.strokeStyle = cor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(x - w / 2, y - 10, w, 20, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#141B26'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, x, y + 0.5);
  };
  const caminho = (pts, fechar) => { ctx.beginPath(); pts.forEach((p, i) => { const [x, y] = paraTela(p); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); if (fechar) ctx.closePath(); };
  const centro = (pts) => { const t = pts.map(paraTela); return [t.reduce((s, p) => s + p[0], 0) / t.length, t.reduce((s, p) => s + p[1], 0) / t.length]; };
  // áreas embaixo, linhas no meio e contagens por cima (o ponto da janela fica visível sobre o recorte)
  const ordem = { area: 0, linear: 1, contagem: 2 };
  for (const c of condicoesDaFolha(f.id).sort((x, y) => ordem[x.tipo] - ordem[y.tipo])) {
    if (!condicaoVisivel(c)) continue;
    const ativa = c.id === visor.condicaoId;
    const corC = c.cor;
    for (const m of c.medicoes.filter((x) => x.folhaId === f.id)) {
      const v = valorDaMedicao(c, m);
      ctx.strokeStyle = corC; ctx.fillStyle = corC; ctx.lineWidth = ativa ? 3 : 2; ctx.setLineDash(m.desconto ? [6, 4] : []);
      if (c.tipo === 'contagem') {
        if (m.vao) { caminho(m.vao.pontos, true); ctx.lineWidth = 2; ctx.stroke(); } // o contorno do vão desenhado
        const [x, y] = paraTela(m.pontos[0]);
        ctx.beginPath(); ctx.arc(x, y, ativa ? 8 : 7, 0, Math.PI * 2); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      } else if (c.tipo === 'linear') {
        caminho(m.pontos); ctx.stroke();
        if (v != null && ativa) { const [x, y] = centro([m.pontos[0], m.pontos[m.pontos.length - 1]]); rotulo(x, y, formatarPesPolegadas(v), corC); }
      } else if (m.desconto) {
        // recorte (borracha) e vão: a área "apagada" fica clara, hachurada em vermelho, com a medida que saiu
        caminho(m.pontos, true); ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fill();
        ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(220,38,38,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([]);
        const t = m.pontos.map(paraTela), xs = t.map((p) => p[0]), ys = t.map((p) => p[1]);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        ctx.beginPath(); for (let d = x0 - (y1 - y0); d < x1; d += 7) { ctx.moveTo(d, y1); ctx.lineTo(d + (y1 - y0), y0); } ctx.stroke(); ctx.restore();
        caminho(m.pontos, true); ctx.strokeStyle = '#DC2626'; ctx.lineWidth = 2; ctx.setLineDash([5, 3]); ctx.stroke();
        // no vão, o rótulo vai logo abaixo (o ponto da contagem fica no centro)
        if (v != null) { const [x, y] = centro(m.pontos); rotulo(x, m.vaoDe ? y1 + 14 : y, '− ' + formatarArea(Math.abs(v)), '#DC2626'); }
      } else {
        caminho(m.pontos, true); ctx.globalAlpha = 0.22; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        if (v != null && ativa) { const [x, y] = centro(m.pontos); rotulo(x, y, formatarArea(Math.abs(v)), corC); }
      }
      ctx.setLineDash([]);
    }
  }
  // typicals: a região que se repete (ou a folha inteira), com o nome e as repetições
  for (const t of typicaisDaFolha(f.id)) {
    ctx.save();
    ctx.strokeStyle = '#6D28D9'; ctx.lineWidth = 2; ctx.setLineDash([10, 5]);
    if (t.regiao) {
      const [x0, y0] = paraTela([t.regiao[0], t.regiao[3]]), [x1, y1] = paraTela([t.regiao[2], t.regiao[1]]);
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.setLineDash([]); rotulo(Math.min(x0, x1) + 90, Math.min(y0, y1) + 14, t.nome + (' ' + tr('×') + ' ') + repeticoes(t), '#6D28D9');
    } else {
      ctx.setLineDash([]); rotulo(110, 18, t.nome + (' ' + tr('×') + ' ') + repeticoes(t), '#6D28D9');
    }
    ctx.restore();
  }
  // em andamento: calibração/conferência ou medição
  const cor = visor.ferramenta === 'medir' ? (condicao(visor.condicaoId) || {}).cor || '#C2410C' : visor.ferramenta === 'typical' ? '#6D28D9' : visor.ferramenta === 'recortar' || visor.ferramenta === 'vao' ? '#DC2626' : '#C2410C';
  const base = desenhando() ? visor.pontos : visor.cal;
  let pts = base.concat(visor.cursor && base.length ? [visor.cursor] : []);
  // vão: retângulo do primeiro canto até o cursor
  if ((visor.ferramenta === 'vao' || visor.ferramenta === 'typical') && pts.length === 2) { const [a, b] = pts; pts = [a, [b[0], a[1]], b, [a[0], b[1]]]; }
  if (pts.length) {
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    const c = condicao(visor.condicaoId);
    const area = (visor.ferramenta === 'medir' && c && c.tipo === 'area') || visor.ferramenta === 'recortar' || visor.ferramenta === 'vao' || visor.ferramenta === 'typical';
    caminho(pts, area && pts.length > 2); ctx.stroke(); ctx.setLineDash([]);
    if (area && pts.length > 2) { ctx.fillStyle = cor; ctx.globalAlpha = 0.12; ctx.fill(); ctx.globalAlpha = 1; }
    for (const p of pts) { const [x, y] = paraTela(p); ctx.beginPath(); ctx.arc(x, y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.stroke(); }
    if (f.escala && pts.length > 1) {
      const k = f.escala.polPorPonto;
      const txt = area && pts.length > 2 ? formatarArea(areaPoligono(pts) * k * k) : formatarPesPolegadas(comprimento(pts) * k);
      const [x, y] = paraTela(pts[pts.length - 1]);
      rotulo(x + 40, y - 18, txt, cor);
    }
  }
}

/* ---------- Interação ---------- */

function finalizar() {
  const c = condicao(visor.condicaoId);
  if (!c || (visor.ferramenta !== 'medir' && visor.ferramenta !== 'recortar')) return;
  const recorte = visor.ferramenta === 'recortar';
  const minimo = c.tipo === 'area' ? 3 : 2;
  if (visor.pontos.length < minimo) { toast(c.tipo === 'area' ? tr('A área precisa de pelo menos 3 pontos.') : tr('Marque pelo menos 2 pontos.')); return; }
  adicionarMedicao(c.id, visor.folhaId, visor.pontos, c.tipo === 'area' && recorte);
  visor.pontos = [];
  atualizarInterface();
}

async function cliqueCalibracao(p) {
  visor.cal.push(p);
  atualizarInterface();
  if (visor.cal.length < 2) return;
  const f = folha(visor.folhaId);
  const conferir = visor.ferramenta === 'conferir';
  const dPts = distancia(visor.cal[0], visor.cal[1]);
  const res = await abrirDialogo({
    titulo: conferir ? tr('Conferir a escala') : tr('Calibrar a escala'),
    corpo: ('<label class="rotulo-pequeno" for="mz-real">' + tr('Qual a medida real dessa cota (está escrita na planta)?') + '</label><input type="text" id="mz-real" name="real" placeholder="Ex.: 40\'-0&quot;" autocomplete="off">') +
      '<p class="mudo pequeno">Aceita 40\'-0", 40\', 12\'-6 1/2", 150" ou 12-6-1/2.</p>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: conferir ? tr('Conferir') : tr('Calibrar'), valor: true, classe: 'btn-primario' }],
  });
  visor.cal = [];
  if (!res || !res.valor) { atualizarInterface(); return; }
  const r = interpretarComprimento(res.campos.real);
  if (r.erro || !(r.pol > 0)) { toast(r.erro || tr('Informe uma medida maior que zero.')); atualizarInterface(); return; }
  if (conferir) {
    const k = registrarConferencia(f.id, r.pol, dPts * f.escala.polPorPonto);
    toast(k.ok ? (tr('Escala conferida ✓ medido') + ' ') + formatarPesPolegadas(k.medidoPol) + ' para ' + formatarPesPolegadas(r.pol) + ' (' + numero(k.diferenca * 100, 1) + '%).'
      : (tr('Atenção: a medida deu') + ' ') + formatarPesPolegadas(k.medidoPol) + ' para ' + formatarPesPolegadas(r.pol) + ' (' + numero(k.diferenca * 100, 1) + tr('%). Confira a escala ou recalibre.'));
    visor.ferramenta = 'medir';
  } else {
    definirEscala(f.id, { polPorPonto: r.pol / dPts, nome: (tr('calibrada em') + ' ') + formatarPesPolegadas(r.pol), origem: 'calibrada' });
    toast(tr('Escala calibrada. Agora confira: meça outra cota conhecida.'));
    visor.ferramenta = 'conferir';
  }
  atualizarInterface();
}

function ligarVisor() {
  const cv = document.getElementById('mz-desenho');
  const area = document.getElementById('mz-area');
  let inicioArrasto = null;
  cv.addEventListener('pointerdown', (ev) => {
    if (visor.ferramenta === 'mover' || visor.espaco || ev.button === 1) {
      inicioArrasto = { x: ev.clientX, y: ev.clientY, sl: area.scrollLeft, st: area.scrollTop, moveu: false };
      cv.setPointerCapture(ev.pointerId);
    }
  });
  cv.addEventListener('pointermove', (ev) => {
    if (inicioArrasto) {
      area.scrollLeft = inicioArrasto.sl - (ev.clientX - inicioArrasto.x);
      area.scrollTop = inicioArrasto.st - (ev.clientY - inicioArrasto.y);
      inicioArrasto.moveu = true;
      return;
    }
    if (!visor.viewport) return;
    visor.cursor = pontoDoEvento(ev, true);
    desenharSobreposicao();
  });
  cv.addEventListener('pointerup', () => { inicioArrasto = null; });
  cv.addEventListener('pointerleave', () => { visor.cursor = null; desenharSobreposicao(); });
  cv.addEventListener('click', (ev) => {
    if (!visor.viewport || visor.ferramenta === 'mover' || visor.espaco) return;
    const p = pontoDoEvento(ev, true);
    if (visor.ferramenta === 'calibrar' || visor.ferramenta === 'conferir') { cliqueCalibracao(p); return; }
    if (visor.ferramenta === 'vao' || visor.ferramenta === 'typical') {
      visor.pontos.push(p);
      if (visor.pontos.length === 2) { if (visor.ferramenta === 'vao') dialogoVao(); else { const r = visor.pontos; visor.pontos = []; dialogoTypical(null, r); } } else desenharSobreposicao();
      return;
    }
    const c = condicao(visor.condicaoId);
    if (!c) { toast(tr('Escolha uma condição no painel.')); return; }
    if (c.tipo === 'contagem') { adicionarMedicao(c.id, visor.folhaId, [p]); atualizarInterface(); return; }
    const ultimo = visor.pontos[visor.pontos.length - 1];
    if (ultimo && distancia(ultimo, p) < 0.5 / visor.zoom) return; // segundo clique do duplo clique
    if ((c.tipo === 'area') && visor.pontos.length >= 3 && distancia(visor.pontos[0], p) < 0.01) { finalizar(); return; } // fechou no primeiro ponto
    visor.pontos.push(p);
    desenharSobreposicao();
  });
  cv.addEventListener('dblclick', (ev) => { ev.preventDefault(); if ((visor.ferramenta === 'medir' || visor.ferramenta === 'recortar') && visor.pontos.length) finalizar(); });
  area.addEventListener('wheel', (ev) => {
    if (!ev.ctrlKey || !visor.viewport) return;
    ev.preventDefault();
    zoomEm(visor.zoom * (ev.deltaY < 0 ? 1.15 : 1 / 1.15), ev.offsetX, ev.offsetY);
  }, { passive: false });
}

async function zoomEm(novo, cx, cy) {
  const area = document.getElementById('mz-area');
  novo = Math.max(0.25, Math.min(6, novo));
  const ancora = cx != null ? paraPdf(cx, cy) : null;
  const antes = cx != null ? [cx - area.scrollLeft, cy - area.scrollTop] : null;
  visor.zoom = novo;
  await renderizarSoLayout();
  if (ancora) { const [x, y] = paraTela(ancora); area.scrollLeft = x - antes[0]; area.scrollTop = y - antes[1]; }
}
async function renderizarSoLayout() { await renderizar(); }

/* Teclado do visor: Enter conclui, Esc cancela, Backspace desfaz, espaço segurado move a planta. */
document.addEventListener('keydown', (ev) => {
  if (!document.getElementById('mz-desenho') || ev.target.closest('dialog, input, textarea, select')) return;
  if (ev.key === 'Enter') { ev.preventDefault(); finalizar(); }
  else if (ev.key === 'Escape') { visor.pontos = []; visor.cal = []; atualizarInterface(); }
  else if (ev.key === 'Backspace') { ev.preventDefault(); visor.pontos.pop(); desenharSobreposicao(); }
  else if (ev.key === ' ') { ev.preventDefault(); visor.espaco = true; }
});
document.addEventListener('keyup', (ev) => { if (ev.key === ' ') visor.espaco = false; });

/* Chamado depois de desenhar uma tela do Measure. */
export async function aposDesenharMeasure() {
  const fa = document.getElementById('form-assembly');
  if (fa) {
    fa.addEventListener('input', testarLinhas);
    fa.addEventListener('change', (ev) => {
      if (ev.target.name === 'tipo') document.getElementById('as-ajuda').innerHTML = htmlAjudaVariaveis(ev.target.value);
      testarLinhas();
    });
    testarLinhas();
  }
  const envio = document.getElementById('mz-enviar');
  if (envio) envio.addEventListener('change', () => enviarPdf(envio));
  const cv = document.getElementById('mz-desenho');
  if (!cv) return;
  ligarVisor();
  const f = folha(visor.folhaId);
  try {
    const doc = await abrirDocumento(f);
    visor.page = await doc.getPage(f.pagina);
    if (!document.getElementById('mz-desenho')) return;
    await renderizar();
    const carregando = document.getElementById('mz-carregando');
    if (carregando) carregando.hidden = true;
  } catch (e) {
    console.error(e);
    const carregando = document.getElementById('mz-carregando');
    if (carregando) carregando.textContent = tr('Não foi possível abrir este PDF.');
  }
}

async function enviarPdf(input) {
  const arq = input.files && input.files[0];
  if (!arq) return;
  toast(tr('Lendo o PDF…'));
  try {
    const dados = new Uint8Array(await arq.arrayBuffer());
    const pdfjs = await carregarPdfjs();
    const doc = await pdfjs.getDocument({ data: dados.slice() }).promise;
    const id = novoId('pdf');
    await guardarFoto(id, new Blob([dados], { type: 'application/pdf' }));
    const novas = criarFolhas(input.dataset.projeto, id, arq.name, doc.numPages);
    toast(novas.length === 1 ? tr('Folha adicionada. Abra e defina a escala.') : novas.length + (' ' + tr('folhas adicionadas. Abra cada uma e defina a escala.')));
    app.desenhar();
  } catch (e) {
    console.error(e);
    toast(tr('Não foi possível ler esse arquivo. Envie um PDF.'));
  }
}

/* ---------- Ações ---------- */

/* Incluir no desenho: escolher um assembly do catálogo (ou só medir, sem assembly). */
async function dialogoIncluir() {
  const f = folha(visor.folhaId);
  const daFolha = condicoesDaFolha(f.id);
  const usados = new Set(daFolha.flatMap((c) => c.assemblies || []));
  const deOutras = condicoesDo(f.projetoId).filter((c) => !daFolha.includes(c));
  const opcao = (valor, nome, resumo, marcado) => '<label class="mz-opcao-assembly"><input type="radio" name="assembly" value="' + valor + '"' + (marcado ? ' checked' : '') + '><span><b>' + esc(nome) + '</b>' +
    (usados.has(valor) ? (' <span class="etiqueta etiqueta-neutro">' + tr('já no desenho') + '</span>') : '') + '<span class="mudo pequeno bloco">' + esc(resumo) + '</span></span></label>';
  const res = await abrirDialogo({
    titulo: tr('Incluir assembly'),
    corpo: ('<p class="mudo pequeno">' + tr('Escolha o que vai medir. Depois você confirma o nome, a cor e as medidas (altura da parede, tamanho do vão…).') + '</p>') +
      '<div class="mz-lista-incluir">' + Object.entries(TIPOS).map(([tipo, t]) => {
        const lista = assemblies().filter((a) => a.tipo === tipo);
        return lista.length ? '<p class="mz-grupo">' + t.nome + ' (' + t.unidade + ')</p>' + lista.map((a) => opcao(a.id, a.nome, resumoAssembly(a), false)).join('') : '';
      }).join('') +
      (deOutras.length ? ('<p class="mz-grupo">' + tr('Já medido em outras folhas deste projeto') + '</p>') + deOutras.map((c) => opcao('cond:' + c.id, c.nome,
        (tr('Continua a mesma condição (soma no mesmo total) · em') + ' ') + folhasDaCondicao(c).map(nomeFolha).join(', '), false)).join('') : '') +
      ('<p class="mz-grupo">' + tr('Outro') + '</p>') + opcao('', tr('Só medir, sem assembly'), tr('Uma condição sem materiais; dá para aplicar um assembly depois'), false) + '</div>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Continuar'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  if (!('assembly' in res.campos)) { toast(tr('Escolha um assembly da lista.')); return; }
  if (res.campos.assembly.startsWith('cond:')) {
    const id = res.campos.assembly.slice(5);
    incluirNaFolha(id, f.id);
    visor.condicaoId = id; visor.pontos = [];
    if (f.escala) visor.ferramenta = 'medir';
    toast('"' + condicao(id).nome + '" incluída nesta folha: as medições daqui somam no mesmo total.');
    atualizarInterface();
    return;
  }
  await dialogoCondicao(null, res.campos.assembly ? assembly(res.campos.assembly) : null);
}
/* Resumo de um assembly: tipo, linhas e os primeiros itens. */
function resumoAssembly(a) {
  const nomes = a.linhas.map((l) => (item(l.itemId) || {}).nome).filter(Boolean);
  return a.linhas.length + (a.linhas.length === 1 ? ' linha: ' : ' linhas: ') + nomes.slice(0, 3).join(', ') + (nomes.length > 3 ? (' ' + tr('e mais') + ' ') + (nomes.length - 3) : '');
}

async function dialogoCondicao(c, comAssembly) {
  const tipoInicial = c ? c.tipo : comAssembly ? comAssembly.tipo : 'linear';
  const p = (c && c.props) || {};
  const projetoId = folha(visor.folhaId).projetoId;
  // os vãos podem estar em outra folha (janelas contadas na fachada, parede medida na planta)
  const vaosPossiveis = condicoesDo(projetoId).filter((x) => x.tipo === 'contagem' && (!c || x.id !== c.id));
  const ondeEsta = (x) => { const fs = folhasDaCondicao(x); return fs.length ? ' <span class="mudo">· ' + esc(fs.map(nomeFolha).join(', ')) + '</span>' : ''; };
  const ft = (pol) => (pol ? esc(formatarPesPolegadas(pol)) : '');
  // cada grupo de campos aparece só para os tipos em que faz sentido
  const grupo = (tipos, html) => '<div class="mz-campos" data-tipos="' + tipos + '"' + (tipos.split(' ').includes(tipoInicial) ? '' : ' hidden') + '>' + html + '</div>';
  const promessa = abrirDialogo({
    titulo: c ? tr('Editar condição') : comAssembly ? tr('Incluir "') + comAssembly.nome + '"' : tr('Nova condição'),
    corpo: ('<label class="rotulo-pequeno" for="mz-nome">' + tr('Nome no desenho') + '</label><input type="text" id="mz-nome" name="nome" value="') + esc(c ? c.nome : comAssembly ? comAssembly.nome : '') + ('" placeholder="' + tr('Ex.: Paredes internas, Siding, Janelas W3') + '">') +
      htmlEscolhaCor(c ? c.cor : PALETA.find((x) => !condicoesDo(projetoId).some((o) => o.cor === x)) || PALETA[0]) +
      ('<label class="rotulo-pequeno" for="mz-tipo">' + tr('Tipo') + '</label><select id="mz-tipo" name="tipo"') + (c || comAssembly ? ' disabled' : '') + '>' + Object.entries(TIPOS).map(([id, t]) => '<option value="' + id + '"' + (id === tipoInicial ? ' selected' : '') + '>' + t.nome + ' (' + t.unidade + ')</option>').join('') + '</select>' +
      ('<p class="mudo pequeno">' + tr('Propriedades (geram as medidas derivadas e as variáveis das fórmulas):') + '</p>') +
      grupo('linear', '<label class="rotulo-pequeno" for="mz-altura">Altura da parede. Ex.: 9\'-0"</label><input type="text" id="mz-altura" name="altura" value="' + (c && c.tipo === 'linear' ? ft(p.alturaPol) : '') + '">') +
      grupo('contagem', '<div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="mz-vlarg">Largura do vão. Ex.: 3\'-0"</label><input type="text" id="mz-vlarg" name="vaoLargura" value="' + ft(p.larguraPol) + '"></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="mz-valt">Altura do vão. Ex.: 6\'-8"</label><input type="text" id="mz-valt" name="vaoAltura" value="' + (c && c.tipo === 'contagem' ? ft(p.alturaPol) : '') + '"></div></div>' +
        ('<p class="mudo pequeno">' + tr('Janela ou porta: com largura e altura, a contagem gera a área e o perímetro dos vãos (guarnição, flashing) e pode ser descontada da parede e do siding.') + '</p>')) +
      grupo(tr('linear area'), ('<label class="rotulo-pequeno" for="mz-inclinacao">' + tr('Inclinação (telhado). Ex.: 6/12') + '</label><input type="text" id="mz-inclinacao" name="inclinacao" value="') + (p.inclinacao ? formatarInclinacao(p.inclinacao) : '') + '">') +
      grupo('area', ('<label class="rotulo-pequeno" for="mz-espessura">' + tr('Espessura (área → volume). Ex.: 4"') + '</label><input type="text" id="mz-espessura" name="espessura" value="') + ft(p.profundidadePol) + '">') +
      grupo(tr('linear area'), ('<fieldset class="mz-vaos"><legend class="rotulo-pequeno">' + tr('Descontar os vãos de') + '</legend>') +
        (vaosPossiveis.length ? vaosPossiveis.map((x) => '<label class="check pequeno"><input type="checkbox" name="vao-' + x.id + '" value="1"' + ((p.vaos || []).includes(x.id) ? ' checked' : '') + '> ' + esc(x.nome) +
          (x.props && x.props.larguraPol && x.props.alturaPol ? '' : (' <span class="mudo">' + tr('(sem tamanho)') + '</span>')) + ondeEsta(x) + '</label>').join('') : ('<p class="mudo pequeno">' + tr('Crie as contagens de janelas e portas com largura e altura.') + '</p>')) + '</fieldset>'),
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: c ? tr('Salvar') : comAssembly ? tr('Incluir no desenho') : tr('Criar condição'), valor: true, classe: 'btn-primario' }],
  });
  const sel = document.querySelector('dialog #mz-tipo');
  if (sel) sel.addEventListener('change', () => document.querySelectorAll('dialog .mz-campos').forEach((g) => { g.hidden = !g.dataset.tipos.split(' ').includes(sel.value); }));
  const res = await promessa;
  if (!res || !res.valor) return;
  const tipo = c ? c.tipo : comAssembly ? comAssembly.tipo : res.campos.tipo;
  const props = {};
  const ler = (campo, rotulo, semUnidade) => {
    const t = (res.campos[campo] || '').trim();
    if (!t) return null;
    const r = interpretarComprimento(t, semUnidade);
    if (r.erro || !(r.pol > 0)) throw new Error(rotulo + ': ' + (r.erro || tr('informe um valor maior que zero')));
    return r.pol;
  };
  try {
    if (tipo === 'linear') { const v = ler('altura', tr('Altura')); if (v) props.alturaPol = v; }
    if (tipo === 'contagem') {
      const w = ler('vaoLargura', tr('Largura do vão')), h = ler('vaoAltura', tr('Altura do vão'));
      if (w) props.larguraPol = w;
      if (h) props.alturaPol = h;
    }
    if (tipo === 'area') { const v = ler('espessura', tr('Espessura'), 'pol'); if (v) props.profundidadePol = v; }
  } catch (e) { toast(e.message); return; }
  if (tipo !== 'contagem' && (res.campos.inclinacao || '').trim()) { const r = interpretarInclinacao(res.campos.inclinacao); if (r.erro) { toast(r.erro); return; } props.inclinacao = r.razao; }
  if (tipo !== 'contagem') props.vaos = Object.keys(res.campos).filter((k) => k.startsWith('vao-')).map((k) => k.slice(4));
  const r = salvarCondicao(c ? c.id : null, { projetoId, folhaId: visor.folhaId, nome: res.campos.nome, tipo, props, cor: res.campos.cor });
  if (r.erro) { toast(r.erro); return; }
  if (comAssembly) aplicarAssembly(r.id, comAssembly.id);
  visor.condicaoId = r.id;
  visor.pontos = [];
  if (folha(visor.folhaId).escala) visor.ferramenta = 'medir';
  atualizarInterface();
}

/* Typical: nome e onde se repete (contando a unidade desenhada). Novo: região (2 cantos) ou a folha inteira. */
async function dialogoTypical(t, regiao) {
  const f = folha(visor.folhaId);
  const linhas = (t ? t.ocorrencias : [{ rotulo: '', quantidade: '' }]).concat(Array.from({ length: Math.max(0, 6 - (t ? t.ocorrencias.length : 1)) }, () => ({ rotulo: '', quantidade: '' })));
  const res = await abrirDialogo({
    titulo: t ? (tr('Typical ·') + ' ') + t.nome : regiao ? tr('Nova região que se repete') : tr('Esta folha se repete'),
    corpo: ('<label class="rotulo-pequeno" for="ty-nome">' + tr('Nome') + '</label><input type="text" id="ty-nome" name="nome" value="') + esc(t ? t.nome : regiao ? '' : tr('Pavimento tipo')) + ('" placeholder="' + tr('Ex.: Apartamento tipo A, Casa modelo B') + '">') +
      ('<p class="mudo pequeno">' + tr('Onde ele se repete e quantas vezes,') + ' <b>' + tr('contando o que está desenhado') + '</b>' + tr('. Ex.: 4 apartamentos iguais por andar, em 3 andares: 2º pavimento 4, 3º pavimento 4, 4º pavimento 4 (× 12).') + '</p>') +
      '<div class="ty-ocorrencias">' + linhas.map((o, i) => '<input type="text" name="oc-rotulo-' + i + '" value="' + esc(o.rotulo) + '" placeholder="' + (i ? '' : tr('Ex.: 2º pavimento')) + ('" aria-label="' + tr('Ocorrência') + ' ') + (i + 1) + '">' +
        '<input type="number" min="1" step="1" name="oc-qtd-' + i + '" value="' + esc(o.quantidade) + ('" placeholder="qtd" aria-label="' + tr('Quantidade') + ' ') + (i + 1) + '">').join('') + '</div>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }].concat(t ? [{ rotulo: tr('Excluir'), valor: 'excluir' }] : []).concat([{ rotulo: t ? tr('Salvar') : tr('Criar typical'), valor: true, classe: 'btn-primario' }]),
  });
  if (!res || !res.valor) { atualizarInterface(); return; }
  if (res.valor === 'excluir') {
    if (!(await confirmar(tr('Excluir "') + t.nome + '"?', tr('As medições continuam, mas passam a valer uma vez só.'), tr('Excluir')))) return;
    excluirTypical(t.id);
    toast(tr('Typical excluído: as medições voltam a valer uma vez.'));
    atualizarInterface();
    return;
  }
  const ocorrencias = linhas.map((_, i) => ({ rotulo: res.campos['oc-rotulo-' + i], quantidade: res.campos['oc-qtd-' + i] === '' ? 0 : Number(res.campos['oc-qtd-' + i]) }));
  const r = salvarTypical(t ? t.id : null, { folhaId: f.id, nome: res.campos.nome, regiao, ocorrencias }, (usuarioAtual() || {}).nome);
  if (r.erro) { toast(r.erro); atualizarInterface(); return; }
  const novo = typical(r.id);
  toast('"' + novo.nome + '" vale × ' + repeticoes(novo) + (tr(': as medições') + ' ') + (novo.regiao ? tr('dentro da região') : tr('desta folha')) + (' ' + tr('já contam as repetições.')));
  if (visor.ferramenta === 'typical') visor.ferramenta = 'medir';
  atualizarInterface();
}

/* Ponto dentro de um polígono (para achar a área que está por trás do vão). */
function dentro(p, pts) {
  let r = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    if ((pts[i][1] > p[1]) !== (pts[j][1] > p[1]) && p[0] < (pts[j][0] - pts[i][0]) * (p[1] - pts[i][1]) / (pts[j][1] - pts[i][1]) + pts[i][0]) r = !r;
  }
  return r;
}

/* Vão desenhado: qual janela/porta é, e de quais áreas ela sai. */
async function dialogoVao() {
  const [a, b] = visor.pontos;
  visor.pontos = [];
  const f = folha(visor.folhaId);
  const k = f.escala.polPorPonto;
  const largura = Math.abs(b[0] - a[0]) * k, altura = Math.abs(b[1] - a[1]) * k;
  if (largura < 1 || altura < 1) { toast(tr('Desenhe o vão clicando em dois cantos opostos.')); atualizarInterface(); return; }
  const cs = condicoesDaFolha(f.id);
  // a janela pode ter sido incluída em outra folha: as desta folha vêm primeiro
  const contagens = cs.filter((c) => c.tipo === 'contagem').concat(condicoesDo(f.projetoId).filter((c) => c.tipo === 'contagem' && !cs.includes(c)));
  if (!contagens.length) { toast(tr('Inclua primeiro o assembly da janela ou porta (uma contagem, como "Janela W2").')); atualizarInterface(); return; }
  const centro = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const areas = cs.filter((c) => c.tipo === 'area');
  // marca de saída as áreas desta folha que estão por trás do vão
  const atras = (c) => c.medicoes.some((m) => m.folhaId === f.id && !m.desconto && dentro(centro, m.pontos));
  const ativa = condicao(visor.condicaoId);
  const sugerida = ativa && ativa.tipo === 'contagem' ? ativa.id : contagens[0].id;
  const tam = (c) => c.props && c.props.larguraPol && c.props.alturaPol ? formatarPesPolegadas(c.props.larguraPol) + (' ' + tr('×') + ' ') + formatarPesPolegadas(c.props.alturaPol) : tr('sem tamanho cadastrado');
  atualizarInterface();
  const res = await abrirDialogo({
    titulo: tr('Vão desenhado'),
    corpo: ('<p class="mz-vao-medida">' + tr('Desenhado:') + ' <b>') + esc(formatarPesPolegadas(largura)) + (' ' + tr('×') + ' ') + esc(formatarPesPolegadas(altura)) + '</b> = ' + esc(formatarArea(largura * altura)) + '</p>' +
      ('<label class="rotulo-pequeno" for="mz-vao-cont">' + tr('Qual é (conta +1 nesta contagem)') + '</label><select id="mz-vao-cont" name="contagem">') +
        contagens.map((c) => '<option value="' + c.id + '"' + (c.id === sugerida ? ' selected' : '') + '>' + esc(nomeCurto(c)) + ' · ' + esc(tam(c)) + '</option>').join('') + '</select>' +
      ('<p class="mudo pequeno">' + tr('O recorte usa a medida desenhada; a contagem gera os materiais do vão (janela, flashing, guarnição).') + '</p>') +
      ('<fieldset class="mz-vaos"><legend class="rotulo-pequeno">' + tr('Recortar a área de') + '</legend>') +
        (areas.length ? areas.map((c) => '<label class="check pequeno"><input type="checkbox" name="recorta-' + c.id + '" value="1"' + (atras(c) ? ' checked' : '') + '> ' + esc(c.nome) + (atras(c) ? (' <span class="mudo">' + tr('(está por trás)') + '</span>') : '') + '</label>').join('')
          : ('<p class="mudo pequeno">' + tr('Nenhuma condição de área no desenho: o vão só será contado.') + '</p>')) + '</fieldset>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Contar e recortar'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) { atualizarInterface(); return; }
  const recortar = Object.keys(res.campos).filter((x) => x.startsWith('recorta-')).map((x) => x.slice(8));
  adicionarVao(res.campos.contagem, f.id, [a, b], recortar);
  const c = condicao(res.campos.contagem);
  toast(nomeCurto(c) + ': +1' + (recortar.length ? (tr(', recortado de') + ' ') + recortar.map((id) => nomeCurto(condicao(id))).join(', ') : '') + '.');
  atualizarInterface();
}

async function dialogoItem(it) {
  const v = it || { categoria: 'material' };
  const res = await abrirDialogo({
    titulo: it ? tr('Editar item') : tr('Novo item'),
    corpo: ('<label class="rotulo-pequeno" for="it-nome">' + tr('Nome') + '</label><input type="text" id="it-nome" name="nome" value="') + esc(v.nome || '') + '" placeholder="Ex.: Drywall 5/8&quot; tipo X 4\'×8\'">' +
      ('<label class="rotulo-pequeno" for="it-codigo">' + tr('Código') + '</label><input type="text" id="it-codigo" name="codigo" value="') + esc(v.codigo || '') + '">' +
      ('<label class="rotulo-pequeno" for="it-cat">' + tr('Categoria') + '</label><select id="it-cat" name="categoria">') + Object.entries(CATEGORIAS).map(([c, n]) => '<option value="' + c + '"' + (c === v.categoria ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      ('<label class="rotulo-pequeno" for="it-un">' + tr('Unidade de compra') + '</label><input type="text" id="it-un" name="unidade" value="') + esc(v.unidade || '') + ('" placeholder="' + tr('chapa, caixa, rolo, peça, cu yd, hora…') + '">') +
      ('<label class="rotulo-pequeno" for="it-etapa">' + tr('Etapa (cost code)') + '</label><input type="text" id="it-etapa" name="etapa" value="') + esc(v.etapa || '') + ('" placeholder="' + tr('Ex.: 09 29 00 · Gypsum board') + '">') +
      ('<label class="rotulo-pequeno" for="it-nota">' + tr('Nota') + '</label><input type="text" id="it-nota" name="nota" value="') + esc(v.nota || '') + ('" placeholder="' + tr('Ex.: cobre 32 sq ft') + '">'),
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: it ? tr('Salvar') : tr('Criar item'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = salvarItem(it ? it.id : null, res.campos);
  if (r.erro) { toast(r.erro); return; }
  toast(it ? tr('Item atualizado.') : tr('Item criado.'));
  app.desenhar();
}

export const acoesMeasure = {
  async 'mz-item'(el) { await dialogoItem(el.dataset.id ? item(el.dataset.id) : null); },
  async 'mz-excluir-item'(el) {
    const it = item(el.dataset.id);
    if (!(await confirmar(tr('Excluir "') + it.nome + '"?', tr('O item sai do catálogo.'), tr('Excluir')))) return;
    const r = excluirItem(it.id);
    toast(r.erro || tr('Item excluído.'));
    app.desenhar();
  },
  'mz-nova-linha'() {
    const corpo = document.getElementById('as-linhas');
    const tipo = document.querySelector('#form-assembly [name="tipo"]').value;
    corpo.insertAdjacentHTML('beforeend', htmlLinhaAssembly({ perda: 0, passo: 1 }, tipo, corpo.children.length, true));
    corpo.lastElementChild.querySelector('select').focus();
  },
  'mz-tirar-linha'(el) { el.closest('tr').remove(); testarLinhas(); },
  'mz-salvar-assembly'() {
    const form = document.getElementById('form-assembly');
    const linhas = Array.from(form.querySelectorAll('.mz-linha')).map((linha) => ({
      itemId: linha.querySelector('[name="item"]').value, formula: linha.querySelector('[name="formula"]').value,
      perda: linha.querySelector('[name="perda"]').value, passo: linha.querySelector('[name="passo"]').value,
    }));
    const id = form.dataset.id || null;
    const r = salvarAssembly(id, { nome: form.querySelector('[name="nome"]').value, tipo: form.querySelector('[name="tipo"]').value, descricao: form.querySelector('[name="descricao"]').value, linhas });
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Assembly salvo.'));
    app.ir('#/measure/assemblies');
  },
  async 'mz-excluir-assembly'(el) {
    const a = assembly(el.dataset.id);
    if (!(await confirmar(tr('Excluir "') + a.nome + '"?', tr('Ele sai das condições em que foi aplicado.'), tr('Excluir')))) return;
    excluirAssembly(a.id);
    toast(tr('Assembly excluído.'));
    app.ir('#/measure/assemblies');
  },
  async 'mz-aplicar-assembly'(el) {
    const c = condicao(el.dataset.cond);
    const opcoes = assemblies().filter((a) => a.tipo === c.tipo && !(c.assemblies || []).includes(a.id));
    if (!opcoes.length) { toast((tr('Não há outro assembly para condições do tipo') + ' ') + TIPOS[c.tipo].nome.toLowerCase() + tr('. Crie em Measure › Assemblies.')); return; }
    const res = await abrirDialogo({
      titulo: tr('Aplicar assembly em "') + c.nome + '"',
      corpo: ('<label class="rotulo-pequeno" for="mz-as">' + tr('Assembly') + '</label><select id="mz-as" name="assembly">') + opcoes.map((a) => '<option value="' + a.id + '">' + esc(a.nome) + '</option>').join('') + '</select>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Aplicar'), valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = aplicarAssembly(c.id, res.campos.assembly);
    toast(r.erro || tr('Assembly aplicado. Os materiais aparecem nas quantidades do projeto.'));
    atualizarInterface();
  },
  'mz-remover-assembly'(el) { removerAssembly(el.dataset.cond, el.dataset.id); atualizarInterface(); },
  'mz-csv'(el) {
    const q = quantidadesDoProjeto(el.dataset.projeto);
    const linhas = [[tr('Categoria'), tr('Código'), tr('Item'), tr('Etapa'), tr('Unidade'), tr('Quantidade'), tr('Condição'), tr('Assembly'), tr('Fórmula'), tr('Bruta'), tr('Perda %'), tr('Com perda'), tr('Arredondamento'), tr('Final')]];
    for (const g of q.porItem) for (const x of g.linhas) {
      linhas.push([CATEGORIAS[g.item.categoria], g.item.codigo, g.item.nome, g.item.etapa, g.item.unidade, Math.round(g.total * 100) / 100, x.condicao.nome, x.assembly.nome, x.linha.formula,
        Math.round(x.bruta * 1000) / 1000, x.linha.perda, Math.round(x.comPerda * 1000) / 1000, nomeArred(x.linha.passo), Math.round(x.final * 1000) / 1000]);
    }
    const csv = linhas.map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = 'korbuild-measure-quantidades.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast((tr('CSV com') + ' ') + (linhas.length - 1) + (' ' + tr('linhas de cálculo.')));
  },
  'mz-ferramenta'(el) { visor.ferramenta = el.dataset.ferramenta; visor.pontos = []; visor.cal = []; atualizarInterface(); },
  'mz-condicao'(el) {
    visor.condicaoId = el.dataset.id; visor.pontos = [];
    visor.fechadas.delete(el.dataset.id); // escolher a condição abre o nó dela na árvore
    // escolher uma condição é para medir nela (o Vão não usa a condição ativa)
    if (folha(visor.folhaId).escala && (visor.ferramenta === 'mover' || visor.ferramenta === 'vao')) visor.ferramenta = 'medir';
    if (visor.ferramenta === 'recortar' && condicao(el.dataset.id).tipo !== 'area') visor.ferramenta = 'medir';
    atualizarInterface();
  },
  async 'mz-escala'() {
    const f = folha(visor.folhaId);
    const atual = f.escala && f.escala.origem === 'lista' ? f.escala.razao : 48;
    const grupos = [tr('Arquitetônica'), tr('Engenharia')];
    const res = await abrirDialogo({
      titulo: tr('Escala da folha'),
      corpo: '<p class="mudo pequeno">A escala está no carimbo ou embaixo do desenho (ex.: SCALE: 1/4" = 1\'-0"). Se a planta foi impressa ou digitalizada fora de escala, calibre por uma cota.</p>' +
        ('<label class="rotulo-pequeno" for="mz-esc">' + tr('Escala') + '</label><select id="mz-esc" name="razao">') + grupos.map((g) => '<optgroup label="' + g + '">' + ESCALAS.filter((e) => e.grupo === g).map((e) => '<option value="' + e.razao + '"' + (e.razao === atual ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</optgroup>').join('') + '</select>',
      acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Calibrar por uma cota'), valor: 'calibrar' }, { rotulo: tr('Usar esta escala'), valor: 'lista', classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    if (res.valor === 'calibrar') { visor.ferramenta = 'calibrar'; visor.cal = []; atualizarInterface(); return; }
    const e = ESCALAS.find((x) => x.razao === Number(res.campos.razao));
    definirEscala(f.id, { polPorPonto: polPorPontoDaEscala(e.razao), razao: e.razao, nome: e.nome, origem: 'lista' });
    visor.ferramenta = 'conferir'; visor.cal = [];
    toast((tr('Escala') + ' ') + e.nome + (' ' + tr('definida. Confira medindo uma cota conhecida.')));
    atualizarInterface();
  },
  'mz-zoom'(el) {
    const passo = Number(el.dataset.passo);
    const area = document.getElementById('mz-area');
    const cx = area.scrollLeft + area.clientWidth / 2, cy = area.scrollTop + area.clientHeight / 2;
    if (!passo) { visor.zoom = ajustarZoom(area); renderizar(); return; }
    zoomEm(visor.zoom * (passo > 0 ? 1.25 : 0.8), cx, cy);
  },
  async 'mz-incluir-assembly'() { await dialogoIncluir(); },
  async 'mz-editar-condicao'(el) { await dialogoCondicao(condicao(el.dataset.id)); },
  async 'mz-excluir-condicao'(el) {
    const c = condicao(el.dataset.id);
    if (!(await confirmar(tr('Excluir "') + c.nome + '"?', c.medicoes.length ? (tr('As') + ' ') + c.medicoes.length + (' ' + tr('medições dela, em todas as folhas, também serão apagadas.')) : tr('A condição não tem medições.'), tr('Excluir')))) return;
    excluirCondicao(c.id);
    visor.condicaoId = (condicoesDaFolha(visor.folhaId)[0] || {}).id || null;
    atualizarInterface();
  },
  async 'mz-tirar-da-folha'(el) {
    const c = condicao(el.dataset.id);
    const n = c.medicoes.filter((m) => m.folhaId === visor.folhaId).length;
    if (!(await confirmar(tr('Tirar "') + c.nome + '" desta folha?', (n ? (tr('As') + ' ') + n + (' ' + tr('medições dela nesta folha serão apagadas.') + ' ') : '') + tr('Nas outras folhas ela continua.'), tr('Tirar')))) return;
    tirarDaFolha(c.id, visor.folhaId);
    visor.condicaoId = (condicoesDaFolha(visor.folhaId)[0] || {}).id || null;
    atualizarInterface();
  },
  'mz-apagar-medicao'(el) {
    const r = excluirMedicao(el.dataset.cond, el.dataset.id);
    if (r.vao) toast(tr('Vão apagado: a contagem e o recorte.'));
    atualizarInterface();
  },
  'mz-abrir'(el) {
    const id = el.dataset.id;
    const conj = id === visor.condicaoId ? visor.fechadas : visor.abertas;
    if (conj.has(id)) conj.delete(id); else conj.add(id);
    if (id !== visor.condicaoId && visor.abertas.has(id)) visor.fechadas.delete(id);
    atualizarInterface();
  },
  'mz-grupo'(el) {
    const t = el.dataset.tipo;
    if (visor.gruposFechados.has(t)) visor.gruposFechados.delete(t); else visor.gruposFechados.add(t);
    atualizarInterface();
  },
  async 'mz-typical-editar'(el) { await dialogoTypical(typical(el.dataset.id), null); },
  async 'mz-typical-folha'() { await dialogoTypical(null, null); },
  'mz-visivel'(el) { mostrarCondicao(el.dataset.id, el.checked); atualizarInterface(); },
  'mz-mostrar-todas'(el) {
    for (const c of condicoesDaFolha(visor.folhaId)) mostrarCondicao(c.id, !!el.dataset.mostrar);
    atualizarInterface();
  },
  async 'mz-tela-cheia'() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.querySelector('.mz-visor').requestFullscreen();
    } catch (e) { toast(tr('O navegador não permitiu a tela cheia.')); }
  },
  'mz-filtro'(el) { filtroSituacao = el.dataset.situacao; app.desenhar(); },
  'mz-salvar-projeto'() {
    const form = document.getElementById('form-projeto');
    const dados = Object.fromEntries(new FormData(form).entries());
    const id = form.dataset.id || null;
    const r = salvarProjeto(id, dados);
    if (r.erro) { toast(r.erro); return; }
    toast(id ? tr('Projeto atualizado.') : tr('Projeto criado. Agora envie o PDF das plantas.'));
    app.ir('#/measure/projeto/' + r.id);
  },
  async 'mz-excluir-projeto'(el) {
    const p = projeto(el.dataset.id);
    const nf = folhasDo(p.id).length, nc = condicoesDo(p.id).length;
    if (!(await confirmar(tr('Excluir "') + p.nome + '"?', nf || nc ? (tr('As') + ' ') + nf + (' ' + tr('folhas e as') + ' ') + nc + (' ' + tr('condições (com as medições) também serão apagadas.')) : tr('O projeto ainda não tem folhas.'), tr('Excluir')))) return;
    excluirProjeto(p.id);
    toast(tr('Projeto excluído.'));
    app.ir('#/measure');
  },
};

document.addEventListener('change', (ev) => {
  if (ev.target.matches('.mz-trocar-folha')) app.ir('#/measure/folha/' + ev.target.value);
  // paleta → seletor livre (o que vale ao salvar é o seletor, name="cor")
  if (ev.target.name === 'corPaleta') ev.target.closest('.mz-escolha-cor').querySelector('[name="cor"]').value = ev.target.value.toLowerCase();
});
document.addEventListener('input', (ev) => {
  if (ev.target.name === 'cor' && ev.target.closest('.mz-escolha-cor')) ev.target.closest('.mz-escolha-cor').querySelectorAll('[name="corPaleta"]').forEach((r) => { r.checked = r.value.toLowerCase() === ev.target.value.toLowerCase(); });
});

/* Tela cheia: refaz o ajuste da planta ao novo tamanho. */
document.addEventListener('fullscreenchange', () => {
  if (!document.getElementById('mz-desenho') || !visor.page) return;
  atualizarInterface();
  requestAnimationFrame(() => { visor.zoom = ajustarZoom(document.getElementById('mz-area')); renderizar(); });
});
