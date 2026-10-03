/* KORbuild Measure — telas: projeto (folhas e quantidades) e o visor de medição (PDF.js + canvas).
 * Medir planta é trabalho de computador: o visor é pensado para mouse e teclado. */

import { esc, toast, abrirDialogo, confirmar, novoId } from './util.js';
import { lerFoto, guardarFoto } from './armazem.js';
import { casca, usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import {
  ESCALAS, polPorPontoDaEscala, interpretarComprimento, interpretarInclinacao, formatarInclinacao,
  formatarPesPolegadas, formatarLinear, formatarArea, formatarVolume, numero, distancia, comprimento, areaPoligono,
} from './imperial.js';
import {
  projetos, projeto, folha, folhasDo, condicao, condicoesDo, TIPOS, definirEscala, registrarConferencia,
  salvarCondicao, excluirCondicao, adicionarMedicao, excluirMedicao, totaisDaCondicao, valorDaMedicao, verticeProximo, criarFolhas,
  CATEGORIAS, itens, item, salvarItem, excluirItem, assemblies, assembly, salvarAssembly, excluirAssembly, aplicarAssembly, removerAssembly,
  quantidadesDoProjeto, variaveisDaCondicao,
} from './measure.js';
import { motorPronto, carregarMotor, variaveisDoTipo, FUNCOES, VALORES_DE_TESTE, calcularLinha, VARIAVEIS } from './formulas.js';

let app = { desenhar: () => {}, ir: () => {}, topoExtra: () => '' };
export function ligarMeasure(funcoes) { app = { ...app, ...funcoes }; }

function navMeasure() {
  return [
    { id: 'projeto', href: '#/measure/projeto/' + projetos()[0].id, rotulo: 'Projeto', icone: 'obras' },
    { id: 'assemblies', href: '#/measure/assemblies', rotulo: 'Assemblies', icone: 'tabela' },
    { id: 'itens', href: '#/measure/itens', rotulo: 'Itens', icone: 'measure' },
  ];
}
// o visor da planta usa a tela inteira, sem o menu lateral
function moldura(o) {
  return casca({ modulo: 'measure', nav: o.semMenu ? [] : navMeasure(), topoExtra: app.topoExtra(), ...o });
}
const podeCatalogo = () => pode(usuarioAtual(), 'measure.catalogo');

export function telaMeasure(q) {
  if (!pode(usuarioAtual(), 'measure.medir')) return { trocar: '#/inicio' };
  // o motor de fórmulas (mathjs) só carrega no Measure; enquanto carrega, uma tela de espera
  if (!motorPronto()) {
    carregarMotor().then(() => app.desenhar()).catch(() => toast('Não foi possível carregar o motor de fórmulas.'));
    return moldura({ titulo: 'Measure', conteudo: '<p class="vazio">Carregando o motor de fórmulas…</p>' });
  }
  if (!q.length) return { trocar: '#/measure/projeto/' + projetos()[0].id };
  if (q[0] === 'projeto' && projeto(q[1])) return telaProjeto(q[1]);
  if (q[0] === 'folha' && folha(q[1])) return telaFolha(q[1]);
  if (q[0] === 'itens') return telaItens();
  if (q[0] === 'assemblies') return telaAssemblies();
  if (q[0] === 'assembly' && (q[1] === 'novo' || assembly(q[1]))) return telaAssembly(q[1] === 'novo' ? null : q[1]);
  return { trocar: '#/measure' };
}

/* Quantidade com até 2 casas (inteiro sem casas). */
function qtd(v) { const r = Math.round(v * 100) / 100; return numero(r, Number.isInteger(r) ? 0 : 2); }
const ARREDONDAMENTOS = [[0, 'Não arredondar'], [1, 'Para cima, inteiro'], [0.5, 'Para cima, de 0,5 em 0,5'], [0.25, 'Para cima, de 0,25 em 0,25']];
const nomeArred = (passo) => (ARREDONDAMENTOS.find(([p]) => p === passo) || [0, 'Não arredondar'])[1];
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
  if (d.pol3 != null) return formatarVolume(d.pol3) + ' · ' + numero(d.pol3 / 1728, 0) + ' cu ft';
  if (d.pol2 != null) return formatarArea(d.pol2);
  return formatarLinear(d.pol);
}
function textoProps(c) {
  const p = c.props || {};
  return [p.alturaPol ? 'altura ' + formatarPesPolegadas(p.alturaPol) : '', p.inclinacao ? 'inclinação ' + formatarInclinacao(p.inclinacao) : '', p.profundidadePol ? 'espessura ' + formatarPesPolegadas(p.profundidadePol) : ''].filter(Boolean).join(' · ');
}

/* ---------- Projeto: folhas e quantidades ---------- */

function telaProjeto(id) {
  const p = projeto(id);
  const fs = folhasDo(id);
  const cs = condicoesDo(id);
  const escalaTxt = (f) => !f.escala ? '<span class="etiqueta etiqueta-ambar">sem escala</span>'
    : esc(f.escala.nome) + (f.escala.conferencia ? (f.escala.conferencia.ok ? ' <span class="etiqueta etiqueta-verde">conferida</span>' : ' <span class="etiqueta etiqueta-alerta">conferência com diferença</span>') : ' <span class="etiqueta etiqueta-neutro">não conferida</span>');
  return moldura({
    ativo: 'projeto', largura: 'larga', titulo: p.nome, subtitulo: p.endereco + ' · ' + p.descricao,
    acoes: '<label class="btn btn-primario btn-pequeno">' + icone('mais', 16) + 'Enviar PDF<input type="file" accept="application/pdf,.pdf" id="mz-enviar" data-projeto="' + p.id + '" class="visualmente-oculto"></label>',
    conteudo:
      '<p class="aviso-info">' + icone('measure', 16) + 'Protótipo do Measure: abrir a planta, definir e conferir a escala, e medir comprimentos, áreas e contagens em pés e polegadas. Assemblies, fórmulas e estimativa vêm na próxima etapa.</p>' +
      '<section class="cartao"><h2 class="cartao-titulo">Folhas</h2><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Folha</th><th>Escala</th><th class="num">Medições</th><th></th></tr></thead><tbody>' +
        fs.map((f) => {
          const n = cs.reduce((t, c) => t + c.medicoes.filter((m) => m.folhaId === f.id).length, 0);
          return '<tr><td><a href="#/measure/folha/' + f.id + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(f.arquivo.nome || '') + (f.pagina > 1 ? ' · página ' + f.pagina : '') + '</span></td>' +
            '<td>' + escalaTxt(f) + '</td><td class="num">' + n + '</td><td class="num"><a class="btn btn-contorno btn-pequeno" href="#/measure/folha/' + f.id + '">Abrir</a></td></tr>';
        }).join('') + '</tbody></table></div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Quantidades</h2><div class="tabela-rolagem"><table class="tabela tabela-quantidades"><thead><tr><th>Condição</th><th>Medido</th><th>Derivadas</th><th class="num">Medições</th></tr></thead><tbody>' +
        cs.map((c) => {
          const t = totaisDaCondicao(c);
          return '<tr><td><span class="mz-cor" style="background:' + c.cor + '"></span><b>' + esc(c.nome) + '</b><span class="mudo pequeno bloco">' + TIPOS[c.tipo].nome + (textoProps(c) ? ' · ' + esc(textoProps(c)) : '') + '</span></td>' +
            '<td><b>' + (t.medicoes ? textoPrincipal(c, t) : '<span class="mudo">—</span>') + '</b>' + (t.semEscala ? '<span class="etiqueta etiqueta-ambar">' + t.semEscala + ' sem escala</span>' : '') + '</td>' +
            '<td>' + (t.medicoes ? t.derivados.map((d) => '<span class="bloco">' + esc(d.nome) + ': <b>' + textoDerivado(d) + '</b></span>').join('') : '') + '</td>' +
            '<td class="num">' + t.medicoes + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +
      htmlMateriais(id) +
      '<p class="dica">Tudo é guardado em polegadas (e polegadas², polegadas³) e mostrado em pés e polegadas, sq ft e cu yd. Os pontos ficam na página do PDF, não em pixels: mudar o zoom não muda a medida.</p>',
  });
}

/* Materiais e mão de obra: o que os assemblies calculam a partir das medições. */
function htmlMateriais(projetoId) {
  const q = quantidadesDoProjeto(projetoId);
  const pend = q.linhas.filter((x) => x.erro);
  const grupos = Object.keys(CATEGORIAS).map((cat) => [cat, q.porItem.filter((g) => g.item.categoria === cat)]).filter(([, gs]) => gs.length);
  const horas = q.porItem.filter((g) => g.item.categoria === 'mao-de-obra').reduce((t, g) => t + g.total, 0);
  return '<section class="cartao" id="mz-materiais"><div class="cartao-cabeca"><h2 class="cartao-titulo">Materiais e mão de obra</h2>' +
      (q.porItem.length ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-csv" data-projeto="' + projetoId + '">' + icone('baixar', 16) + 'Exportar CSV</button>' : '') + '</div>' +
    '<p class="mudo pequeno">Calculado pelos assemblies aplicados em cada condição. Toque num item para ver o cálculo: condição → variáveis → fórmula → perda → arredondamento.</p>' +
    (horas ? '<p class="mz-horas">' + icone('relogio', 16) + 'Mão de obra estimada: <b>' + qtd(horas) + ' h</b> <span class="mudo pequeno">(por etapa, vira o orçamento de horas do Crew na próxima etapa)</span></p>' : '') +
    (grupos.length ? grupos.map(([cat, gs]) => '<h3 class="mz-grupo">' + CATEGORIAS[cat] + '</h3><div class="mz-itens">' + gs.map((g) =>
      '<details class="mz-item"><summary><span class="mz-item-nome"><b>' + esc(g.item.nome) + '</b><span class="mudo pequeno">' + esc(g.item.codigo) + ' · ' + esc(g.item.etapa) + '</span></span>' +
        '<span class="mz-item-qtd"><b>' + qtd(g.total) + '</b> ' + esc(g.item.unidade) + '</span></summary>' +
        '<ul class="mz-rastro">' + g.linhas.map((x) => '<li><span><b>' + esc(x.condicao.nome) + '</b> · ' + esc(x.assembly.nome) + '</span><span class="mz-conta">' + rastro(x, g.item.unidade) + '</span>' +
          '<span class="mudo pequeno">' + esc(textoVariaveis(x.vars)) + '</span></li>').join('') + '</ul></details>').join('') + '</div>').join('')
      : '<p class="vazio">Meça as condições que têm assemblies para ver os materiais.</p>') +
    (pend.length ? '<div class="mz-pendencias"><b>Pendências</b><ul>' + Array.from(new Set(pend.map((x) => esc(x.condicao.nome) + ' · ' + esc(x.assembly.nome) + ': ' + esc(x.erro)))).map((t) => '<li>' + t + '</li>').join('') + '</ul></div>' : '') +
    '</section>';
}

/* ---------- Itens (catálogo) ---------- */

function telaItens() {
  const pc = podeCatalogo();
  return moldura({
    ativo: 'itens', largura: 'larga', titulo: 'Itens', subtitulo: 'Catálogo de materiais, mão de obra, equipamentos e subempreiteiros, na unidade de compra',
    acoes: pc ? '<button type="button" class="btn btn-primario btn-pequeno" data-acao="mz-item" data-id="">' + icone('mais', 16) + 'Novo item</button>' : '',
    conteudo: Object.entries(CATEGORIAS).map(([cat, nome]) => {
      const lista = itens().filter((i) => i.categoria === cat);
      if (!lista.length) return '';
      return '<section class="cartao"><h2 class="cartao-titulo">' + nome + '</h2><div class="tabela-rolagem"><table class="tabela tabela-itens"><thead><tr><th>Código</th><th>Item</th><th>Unidade de compra</th><th>Etapa (cost code)</th><th></th></tr></thead><tbody>' +
        lista.map((i) => '<tr><td class="mudo">' + esc(i.codigo) + '</td><td><b>' + esc(i.nome) + '</b>' + (i.nota ? '<span class="mudo pequeno bloco">' + esc(i.nota) + '</span>' : '') + '</td><td>' + esc(i.unidade) + '</td><td>' + esc(i.etapa) + '</td>' +
          '<td class="num">' + (pc ? '<button type="button" class="link-botao pequeno" data-acao="mz-item" data-id="' + i.id + '">Editar</button> <button type="button" class="link-botao pequeno" data-acao="mz-excluir-item" data-id="' + i.id + '">Excluir</button>' : '') + '</td></tr>').join('') +
        '</tbody></table></div></section>';
    }).join('') +
      '<p class="dica">Preço não fica aqui: ele terá vigência (data de início) e entra na próxima etapa, a estimativa. As coberturas nas notas são exemplos.</p>',
  });
}

/* ---------- Assemblies ---------- */

function telaAssemblies() {
  const usos = (a) => projetos().flatMap((p) => condicoesDo(p.id)).filter((c) => (c.assemblies || []).includes(a.id));
  return moldura({
    ativo: 'assemblies', largura: 'larga', titulo: 'Assemblies', subtitulo: 'Um conjunto de itens com fórmulas: uma medição alimenta vários materiais e a mão de obra',
    acoes: podeCatalogo() ? '<a class="btn btn-primario btn-pequeno" href="#/measure/assembly/novo">' + icone('mais', 16) + 'Novo assembly</a>' : '',
    conteudo: '<div class="mz-assemblies">' + assemblies().map((a) => '<a class="cartao mz-assembly" href="#/measure/assembly/' + a.id + '"><span class="etiqueta etiqueta-neutro">' + TIPOS[a.tipo].nome + '</span>' +
      '<h2 class="cartao-titulo">' + esc(a.nome) + '</h2><p class="mudo pequeno">' + esc(a.descricao) + '</p>' +
      '<p class="pequeno">' + a.linhas.length + ' linhas · ' + a.linhas.map((l) => esc((item(l.itemId) || {}).nome || '?')).slice(0, 4).join(', ') + (a.linhas.length > 4 ? '…' : '') + '</p>' +
      '<p class="mudo pequeno">' + (usos(a).length ? 'Aplicado em: ' + usos(a).map((c) => esc(c.nome)).join(', ') : 'Ainda não aplicado') + '</p></a>').join('') + '</div>',
  });
}

function htmlLinhaAssembly(l, tipo, i, editavel) {
  const dis = editavel ? '' : ' disabled';
  return '<tr class="mz-linha" data-i="' + i + '"><td><select name="item"' + dis + '><option value="">Escolha o item</option>' +
      Object.entries(CATEGORIAS).map(([cat, nome]) => '<optgroup label="' + nome + '">' + itens().filter((x) => x.categoria === cat).map((x) => '<option value="' + x.id + '"' + (x.id === l.itemId ? ' selected' : '') + '>' + esc(x.nome) + ' (' + esc(x.unidade) + ')</option>').join('') + '</optgroup>').join('') + '</select></td>' +
    '<td><input type="text" name="formula" class="mz-formula" value="' + esc(l.formula || '') + '" placeholder="Ex.: MeasuredArea / 32" spellcheck="false" autocomplete="off"' + dis + '></td>' +
    '<td><span class="campo-pct"><input type="number" name="perda" min="0" max="100" step="0.5" value="' + (l.perda != null ? l.perda : 0) + '"' + dis + '>%</span></td>' +
    '<td><select name="passo"' + dis + '>' + ARREDONDAMENTOS.map(([p, n]) => '<option value="' + p + '"' + (p === (l.passo || 0) ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></td>' +
    '<td class="mz-teste" aria-live="polite"></td>' +
    '<td>' + (editavel ? '<button type="button" class="link-botao" data-acao="mz-tirar-linha" aria-label="Tirar a linha">✕</button>' : '') + '</td></tr>';
}

function htmlAjudaVariaveis(tipo) {
  const teste = VALORES_DE_TESTE[tipo];
  return '<b>Variáveis desta condição</b><ul>' + variaveisDoTipo(tipo).map((v) => '<li><code>' + v.nome + '</code> <span class="mudo">' + esc(v.unidade) + ' · ' + esc(v.descricao) + (v.requer ? ' (precisa de ' + v.requer + ')' : '') + '</span></li>').join('') + '</ul>' +
    '<p class="pequeno">Funções: ' + FUNCOES.map((f) => '<code>' + f + '()</code>').join(' ') + '. Perda e arredondamento ficam nas colunas, fora da fórmula.</p>' +
    '<p class="pequeno mudo">A coluna "Teste" usa: ' + esc(textoVariaveis(teste)) + '.</p>';
}

function telaAssembly(id) {
  const a = id ? assembly(id) : { nome: '', tipo: 'area', descricao: '', linhas: [] };
  const ed = podeCatalogo();
  const linhas = a.linhas.length ? a.linhas : [{ perda: 0, passo: 1 }];
  return moldura({
    ativo: 'assemblies', largura: 'larga', titulo: id ? a.nome : 'Novo assembly', voltar: { href: '#/measure/assemblies', rotulo: 'Assemblies' },
    conteudo: '<form id="form-assembly" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      '<section class="cartao"><div class="grade-campos">' +
        '<div class="campo"><label class="rotulo-pequeno" for="as-nome">Nome</label><input type="text" id="as-nome" name="nome" value="' + esc(a.nome) + '"' + (ed ? '' : ' disabled') + '></div>' +
        '<div class="campo"><label class="rotulo-pequeno" for="as-tipo">Para condições do tipo</label><select id="as-tipo" name="tipo"' + (id || !ed ? ' disabled' : '') + '>' + Object.entries(TIPOS).map(([t, x]) => '<option value="' + t + '"' + (t === a.tipo ? ' selected' : '') + '>' + x.nome + ' (' + x.unidade + ')</option>').join('') + '</select></div>' +
      '</div><div class="campo"><label class="rotulo-pequeno" for="as-desc">Descrição</label><input type="text" id="as-desc" name="descricao" value="' + esc(a.descricao) + '"' + (ed ? '' : ' disabled') + '></div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Linhas</h2><div class="tabela-rolagem"><table class="tabela mz-tabela-linhas"><thead><tr><th>Item</th><th>Fórmula (quantidade bruta)</th><th>Perda</th><th>Arredondamento</th><th>Teste</th><th></th></tr></thead><tbody id="as-linhas">' +
        linhas.map((l, i) => htmlLinhaAssembly(l, a.tipo, i, ed)).join('') + '</tbody></table></div>' +
        (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-nova-linha">' + icone('mais', 14) + 'Linha</button>' : '') +
        '<div class="mz-ajuda" id="as-ajuda">' + htmlAjudaVariaveis(a.tipo) + '</div></section>' +
      (ed ? '<div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="mz-excluir-assembly" data-id="' + id + '">Excluir</button>' : '') +
        '<a class="btn btn-contorno" href="#/measure/assemblies">Cancelar</a><button type="button" class="btn btn-primario" data-acao="mz-salvar-assembly">Salvar assembly</button></div>' : '<p class="dica">Só quem tem a permissão "Itens e assemblies" edita.</p>') +
    '</form>',
  });
}

/* Teste ao vivo de cada linha, com os valores de exemplo do tipo. */
function testarLinhas() {
  const form = document.getElementById('form-assembly');
  if (!form) return;
  const tipo = form.querySelector('[name="tipo"]').value;
  form.querySelectorAll('.mz-linha').forEach((tr) => {
    const alvo = tr.querySelector('.mz-teste');
    const formula = tr.querySelector('[name="formula"]').value;
    const it = item(tr.querySelector('[name="item"]').value);
    if (!formula.trim()) { alvo.textContent = ''; alvo.className = 'mz-teste'; return; }
    const r = calcularLinha({ formula, perda: Number(tr.querySelector('[name="perda"]').value) || 0, passo: Number(tr.querySelector('[name="passo"]').value) || 0 }, tipo, VALORES_DE_TESTE[tipo]);
    alvo.className = 'mz-teste' + (r.erro ? ' erro' : '');
    alvo.textContent = r.erro ? r.erro : qtd(r.bruta) + (r.comPerda !== r.bruta ? ' → ' + qtd(r.comPerda) : '') + (r.final !== r.comPerda ? ' → ' + qtd(r.final) : '') + ' ' + (it ? it.unidade : '');
  });
}

/* ---------- Visor de medição ---------- */

const visor = {
  folhaId: null, condicaoId: null, ferramenta: 'medir', desconto: false, zoom: 1,
  pontos: [], cursor: null, cal: [], viewport: null, page: null, arrastando: null, espaco: false,
};

function telaFolha(id) {
  const f = folha(id);
  if (visor.folhaId !== id) {
    Object.assign(visor, { folhaId: id, pontos: [], cal: [], cursor: null, zoom: 0, page: null, viewport: null, desconto: false });
    const cs = condicoesDo(f.projetoId);
    visor.condicaoId = cs.length ? cs[0].id : null;
    visor.ferramenta = f.escala ? 'medir' : 'mover';
  }
  return moldura({
    largura: 'total', semMenu: true, titulo: f.nome, voltar: { href: '#/measure/projeto/' + f.projetoId, rotulo: projeto(f.projetoId).nome },
    conteudo: '<div class="mz-visor">' +
      '<div class="mz-barra" id="mz-barra">' + htmlBarra() + '</div>' +
      '<div class="mz-corpo"><div class="mz-area" id="mz-area" tabindex="0" aria-label="Planta: use o mouse para medir"><div class="mz-folha" id="mz-folha"><canvas id="mz-pdf"></canvas><canvas id="mz-desenho"></canvas></div>' +
        '<p class="mz-carregando" id="mz-carregando">Abrindo a planta…</p></div>' +
        '<aside class="mz-painel" id="mz-painel">' + htmlPainel() + '</aside></div>' +
      '<p class="mz-dica" id="mz-dica">' + esc(dica()) + '</p></div>',
  });
}

function htmlBarra() {
  const f = folha(visor.folhaId);
  const b = (ferr, rot, ic, extra) => '<button type="button" class="btn btn-pequeno ' + (visor.ferramenta === ferr ? 'btn-primario' : 'btn-contorno') + '" data-acao="mz-ferramenta" data-ferramenta="' + ferr + '"' + (extra || '') + '>' + icone(ic, 16) + rot + '</button>';
  const semEscala = !f.escala;
  return '<div class="btn-linha">' + b('mover', 'Mover', 'seta') + b('medir', 'Medir', 'measure', semEscala ? ' disabled title="Defina a escala primeiro"' : '') + '</div>' +
    '<div class="btn-linha"><button type="button" class="btn btn-pequeno ' + (semEscala ? 'btn-primario' : 'btn-contorno') + '" data-acao="mz-escala">' + icone('measure', 16) + (f.escala ? 'Escala: ' + esc(f.escala.nome) : 'Definir escala') + '</button>' +
      (f.escala ? b('conferir', 'Conferir', 'aprovacoes') : '') +
      (f.escala && f.escala.conferencia ? '<span class="etiqueta ' + (f.escala.conferencia.ok ? 'etiqueta-verde' : 'etiqueta-alerta') + '">' + (f.escala.conferencia.ok ? 'conferida' : 'diferença') + ' ' + numero(f.escala.conferencia.diferenca * 100, 1) + '%</span>' : f.escala ? '<span class="etiqueta etiqueta-ambar">não conferida</span>' : '') + '</div>' +
    '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-zoom" data-passo="-1" aria-label="Diminuir o zoom">−</button><span class="mz-zoom" id="mz-zoom">' + Math.round(visor.zoom * 100) + '%</span>' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-zoom" data-passo="1" aria-label="Aumentar o zoom">+</button><button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-zoom" data-passo="0">Ajustar</button></div>';
}

function htmlPainel() {
  const f = folha(visor.folhaId);
  const cs = condicoesDo(f.projetoId);
  return '<div class="mz-painel-cabeca"><h2>Condições</h2><button type="button" class="btn btn-contorno btn-pequeno" data-acao="mz-nova-condicao">' + icone('mais', 14) + 'Nova</button></div>' +
    (cs.length ? '' : '<p class="mudo pequeno">Crie uma condição (ex.: Paredes externas) para começar a medir.</p>') +
    cs.map((c) => {
      const t = totaisDaCondicao(c);
      const aqui = c.medicoes.filter((m) => m.folhaId === f.id);
      const ativa = c.id === visor.condicaoId;
      return '<div class="mz-cond' + (ativa ? ' ativa' : '') + '" style="--cor:' + c.cor + '">' +
        '<button type="button" class="mz-cond-topo" data-acao="mz-condicao" data-id="' + c.id + '" aria-pressed="' + ativa + '"><span class="mz-cor" style="background:' + c.cor + '"></span><span><b>' + esc(c.nome) + '</b><span class="mudo pequeno bloco">' + TIPOS[c.tipo].nome + (textoProps(c) ? ' · ' + esc(textoProps(c)) : '') + '</span></span></button>' +
        '<div class="mz-total">' + (t.medicoes ? textoPrincipal(c, t) : '<span class="mudo">nada medido</span>') + '</div>' +
        (t.medicoes ? t.derivados.map((d) => '<div class="mz-derivado">' + esc(d.nome) + ': <b>' + textoDerivado(d) + '</b></div>').join('') : '') +
        (ativa && c.tipo === 'area' ? '<label class="check pequeno"><input type="checkbox" data-acao="mz-desconto"' + (visor.desconto ? ' checked' : '') + '> Desenhar como desconto (vão, recorte)</label>' : '') +
        (ativa ? '<div class="mz-cond-assemblies"><span class="mudo pequeno">Assemblies</span>' + ((c.assemblies || []).map((aid) => assembly(aid)).filter(Boolean).map((a) =>
            '<span class="mz-chip">' + esc(a.nome) + '<button type="button" class="link-botao" data-acao="mz-remover-assembly" data-cond="' + c.id + '" data-id="' + a.id + '" aria-label="Tirar ' + esc(a.nome) + '">✕</button></span>').join('') || '<span class="mudo pequeno">nenhum</span>') +
            '<button type="button" class="link-botao pequeno" data-acao="mz-aplicar-assembly" data-cond="' + c.id + '">+ Aplicar assembly</button></div>' : '') +
        (ativa ? '<div class="mz-cond-acoes"><button type="button" class="link-botao pequeno" data-acao="mz-editar-condicao" data-id="' + c.id + '">Editar</button>' +
          '<button type="button" class="link-botao pequeno" data-acao="mz-excluir-condicao" data-id="' + c.id + '">Excluir</button></div>' +
          (aqui.length ? '<ol class="mz-medicoes">' + aqui.map((m, i) => {
            const v = valorDaMedicao(c, m);
            const txt = c.tipo === 'contagem' ? '1 each' : v == null ? 'sem escala' : c.tipo === 'linear' ? formatarPesPolegadas(v) : formatarArea(v);
            return '<li><span>' + (i + 1) + '. ' + (m.desconto ? 'desconto ' : '') + txt + '</span><button type="button" class="link-botao" data-acao="mz-apagar-medicao" data-cond="' + c.id + '" data-id="' + m.id + '" aria-label="Apagar a medição ' + (i + 1) + '">✕</button></li>';
          }).join('') + '</ol>' : '') : '') +
        '</div>';
    }).join('');
}

function dica() {
  const f = folha(visor.folhaId);
  const c = condicao(visor.condicaoId);
  if (visor.ferramenta === 'calibrar') return visor.cal.length ? 'Agora clique na outra ponta da cota.' : 'Calibrar: clique nas duas pontas de uma cota conhecida (ex.: a de 40\'-0"). Shift deixa a linha reta.';
  if (visor.ferramenta === 'conferir') return visor.cal.length ? 'Agora clique na outra ponta da cota.' : 'Conferir: meça OUTRA cota conhecida, de preferência na outra direção. O sistema mostra a diferença.';
  if (!f.escala) return 'Primeiro, defina a escala da folha: escolha da lista (a escala está no carimbo) ou calibre por uma cota.';
  if (visor.ferramenta === 'mover') return 'Arraste para mover a planta. Ctrl + rolagem do mouse: zoom.';
  if (!c) return 'Escolha ou crie uma condição no painel ao lado.';
  if (c.tipo === 'contagem') return 'Contagem: clique em cada item de "' + c.nome + '".';
  if (c.tipo === 'linear') return 'Linear: clique nos pontos. Duplo clique ou Enter conclui, Esc cancela, Backspace desfaz o último ponto. Shift: linha reta. Perto de um ponto já medido, o clique gruda nele (Alt desliga). Para mais precisão, aumente o zoom.';
  return 'Área: clique nos cantos. Duplo clique, Enter ou clique no primeiro ponto fecha a área.' + (visor.desconto ? ' Modo desconto: a área será subtraída.' : '');
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
    const ancora = visor.pontos.length >= 3 && distancia(visor.pontos[0], p) < raio ? visor.pontos[0] : verticeProximo(visor.folhaId, p, raio);
    if (ancora) return [ancora[0], ancora[1]];
  }
  const ultimo = visor.ferramenta === 'medir' ? visor.pontos[visor.pontos.length - 1] : visor.cal[visor.cal.length - 1];
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
  for (const c of condicoesDo(f.projetoId)) {
    const ativa = c.id === visor.condicaoId;
    for (const m of c.medicoes.filter((x) => x.folhaId === f.id)) {
      const v = valorDaMedicao(c, m);
      ctx.strokeStyle = c.cor; ctx.fillStyle = c.cor; ctx.lineWidth = ativa ? 3 : 2; ctx.setLineDash(m.desconto ? [6, 4] : []);
      if (c.tipo === 'contagem') {
        const [x, y] = paraTela(m.pontos[0]);
        ctx.beginPath(); ctx.arc(x, y, ativa ? 8 : 7, 0, Math.PI * 2); ctx.globalAlpha = 0.85; ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      } else if (c.tipo === 'linear') {
        caminho(m.pontos); ctx.stroke();
        if (v != null && ativa) { const [x, y] = centro([m.pontos[0], m.pontos[m.pontos.length - 1]]); rotulo(x, y, formatarPesPolegadas(v), c.cor); }
      } else {
        caminho(m.pontos, true); ctx.globalAlpha = m.desconto ? 0.12 : 0.22; ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
        if (v != null && ativa) { const [x, y] = centro(m.pontos); rotulo(x, y, (m.desconto ? '− ' : '') + formatarArea(Math.abs(v)), c.cor); }
      }
      ctx.setLineDash([]);
    }
  }
  // em andamento: calibração/conferência ou medição
  const cor = visor.ferramenta === 'medir' ? (condicao(visor.condicaoId) || {}).cor || '#C2410C' : '#C2410C';
  const pts = (visor.ferramenta === 'medir' ? visor.pontos : visor.cal).concat(visor.cursor && (visor.ferramenta === 'medir' ? visor.pontos.length : visor.cal.length) ? [visor.cursor] : []);
  if (pts.length) {
    ctx.strokeStyle = cor; ctx.lineWidth = 2; ctx.setLineDash([6, 4]);
    const c = condicao(visor.condicaoId);
    const area = visor.ferramenta === 'medir' && c && c.tipo === 'area';
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
  if (!c || visor.ferramenta !== 'medir') return;
  const minimo = c.tipo === 'area' ? 3 : 2;
  if (visor.pontos.length < minimo) { toast(c.tipo === 'area' ? 'A área precisa de pelo menos 3 pontos.' : 'Marque pelo menos 2 pontos.'); return; }
  adicionarMedicao(c.id, visor.folhaId, visor.pontos, c.tipo === 'area' && visor.desconto);
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
    titulo: conferir ? 'Conferir a escala' : 'Calibrar a escala',
    corpo: '<label class="rotulo-pequeno" for="mz-real">Qual a medida real dessa cota (está escrita na planta)?</label><input type="text" id="mz-real" name="real" placeholder="Ex.: 40\'-0&quot;" autocomplete="off">' +
      '<p class="mudo pequeno">Aceita 40\'-0", 40\', 12\'-6 1/2", 150" ou 12-6-1/2.</p>',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: conferir ? 'Conferir' : 'Calibrar', valor: true, classe: 'btn-primario' }],
  });
  visor.cal = [];
  if (!res || !res.valor) { atualizarInterface(); return; }
  const r = interpretarComprimento(res.campos.real);
  if (r.erro || !(r.pol > 0)) { toast(r.erro || 'Informe uma medida maior que zero.'); atualizarInterface(); return; }
  if (conferir) {
    const k = registrarConferencia(f.id, r.pol, dPts * f.escala.polPorPonto);
    toast(k.ok ? 'Escala conferida ✓ medido ' + formatarPesPolegadas(k.medidoPol) + ' para ' + formatarPesPolegadas(r.pol) + ' (' + numero(k.diferenca * 100, 1) + '%).'
      : 'Atenção: a medida deu ' + formatarPesPolegadas(k.medidoPol) + ' para ' + formatarPesPolegadas(r.pol) + ' (' + numero(k.diferenca * 100, 1) + '%). Confira a escala ou recalibre.');
    visor.ferramenta = 'medir';
  } else {
    definirEscala(f.id, { polPorPonto: r.pol / dPts, nome: 'calibrada em ' + formatarPesPolegadas(r.pol), origem: 'calibrada' });
    toast('Escala calibrada. Agora confira: meça outra cota conhecida.');
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
    const c = condicao(visor.condicaoId);
    if (!c) { toast('Escolha uma condição no painel.'); return; }
    if (c.tipo === 'contagem') { adicionarMedicao(c.id, visor.folhaId, [p]); atualizarInterface(); return; }
    const ultimo = visor.pontos[visor.pontos.length - 1];
    if (ultimo && distancia(ultimo, p) < 0.5 / visor.zoom) return; // segundo clique do duplo clique
    if (c.tipo === 'area' && visor.pontos.length >= 3 && distancia(visor.pontos[0], p) < 0.01) { finalizar(); return; } // fechou no primeiro ponto
    visor.pontos.push(p);
    desenharSobreposicao();
  });
  cv.addEventListener('dblclick', (ev) => { ev.preventDefault(); if (visor.ferramenta === 'medir' && visor.pontos.length) finalizar(); });
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
    if (carregando) carregando.textContent = 'Não foi possível abrir este PDF.';
  }
}

async function enviarPdf(input) {
  const arq = input.files && input.files[0];
  if (!arq) return;
  toast('Lendo o PDF…');
  try {
    const dados = new Uint8Array(await arq.arrayBuffer());
    const pdfjs = await carregarPdfjs();
    const doc = await pdfjs.getDocument({ data: dados.slice() }).promise;
    const id = novoId('pdf');
    await guardarFoto(id, new Blob([dados], { type: 'application/pdf' }));
    const novas = criarFolhas(input.dataset.projeto, id, arq.name, doc.numPages);
    toast(novas.length === 1 ? 'Folha adicionada. Abra e defina a escala.' : novas.length + ' folhas adicionadas. Abra cada uma e defina a escala.');
    app.desenhar();
  } catch (e) {
    console.error(e);
    toast('Não foi possível ler esse arquivo. Envie um PDF.');
  }
}

/* ---------- Ações ---------- */

async function dialogoCondicao(c) {
  const tipoInicial = c ? c.tipo : 'linear';
  const p = (c && c.props) || {};
  const res = await abrirDialogo({
    titulo: c ? 'Editar condição' : 'Nova condição',
    corpo: '<label class="rotulo-pequeno" for="mz-nome">Nome</label><input type="text" id="mz-nome" name="nome" value="' + esc(c ? c.nome : '') + '" placeholder="Ex.: Paredes internas, Forro, Tomadas">' +
      '<label class="rotulo-pequeno" for="mz-tipo">Tipo</label><select id="mz-tipo" name="tipo"' + (c ? ' disabled' : '') + '>' + Object.entries(TIPOS).map(([id, t]) => '<option value="' + id + '"' + (id === tipoInicial ? ' selected' : '') + '>' + t.nome + ' (' + t.unidade + ')</option>').join('') + '</select>' +
      '<p class="mudo pequeno">Propriedades opcionais (geram as medidas derivadas):</p>' +
      '<label class="rotulo-pequeno" for="mz-altura">Altura (linear → superfície). Ex.: 9\'-0"</label><input type="text" id="mz-altura" name="altura" value="' + (p.alturaPol ? esc(formatarPesPolegadas(p.alturaPol)) : '') + '">' +
      '<label class="rotulo-pequeno" for="mz-inclinacao">Inclinação (telhado). Ex.: 6/12</label><input type="text" id="mz-inclinacao" name="inclinacao" value="' + (p.inclinacao ? formatarInclinacao(p.inclinacao) : '') + '">' +
      '<label class="rotulo-pequeno" for="mz-espessura">Espessura (área → volume). Ex.: 4"</label><input type="text" id="mz-espessura" name="espessura" value="' + (p.profundidadePol ? esc(formatarPesPolegadas(p.profundidadePol)) : '') + '">',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: c ? 'Salvar' : 'Criar condição', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const props = {};
  if (res.campos.altura.trim()) { const r = interpretarComprimento(res.campos.altura); if (r.erro) { toast('Altura: ' + r.erro); return; } props.alturaPol = r.pol; }
  if (res.campos.inclinacao.trim()) { const r = interpretarInclinacao(res.campos.inclinacao); if (r.erro) { toast(r.erro); return; } props.inclinacao = r.razao; }
  if (res.campos.espessura.trim()) { const r = interpretarComprimento(res.campos.espessura, 'pol'); if (r.erro) { toast('Espessura: ' + r.erro); return; } props.profundidadePol = r.pol; }
  const r = salvarCondicao(c ? c.id : null, { projetoId: folha(visor.folhaId).projetoId, nome: res.campos.nome, tipo: c ? c.tipo : res.campos.tipo, props });
  if (r.erro) { toast(r.erro); return; }
  visor.condicaoId = r.id;
  visor.pontos = [];
  if (folha(visor.folhaId).escala) visor.ferramenta = 'medir';
  atualizarInterface();
}

async function dialogoItem(it) {
  const v = it || { categoria: 'material' };
  const res = await abrirDialogo({
    titulo: it ? 'Editar item' : 'Novo item',
    corpo: '<label class="rotulo-pequeno" for="it-nome">Nome</label><input type="text" id="it-nome" name="nome" value="' + esc(v.nome || '') + '" placeholder="Ex.: Drywall 5/8&quot; tipo X 4\'×8\'">' +
      '<label class="rotulo-pequeno" for="it-codigo">Código</label><input type="text" id="it-codigo" name="codigo" value="' + esc(v.codigo || '') + '">' +
      '<label class="rotulo-pequeno" for="it-cat">Categoria</label><select id="it-cat" name="categoria">' + Object.entries(CATEGORIAS).map(([c, n]) => '<option value="' + c + '"' + (c === v.categoria ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<label class="rotulo-pequeno" for="it-un">Unidade de compra</label><input type="text" id="it-un" name="unidade" value="' + esc(v.unidade || '') + '" placeholder="chapa, caixa, rolo, peça, cu yd, hora…">' +
      '<label class="rotulo-pequeno" for="it-etapa">Etapa (cost code)</label><input type="text" id="it-etapa" name="etapa" value="' + esc(v.etapa || '') + '" placeholder="Ex.: 09 29 00 · Gypsum board">' +
      '<label class="rotulo-pequeno" for="it-nota">Nota</label><input type="text" id="it-nota" name="nota" value="' + esc(v.nota || '') + '" placeholder="Ex.: cobre 32 sq ft">',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: it ? 'Salvar' : 'Criar item', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = salvarItem(it ? it.id : null, res.campos);
  if (r.erro) { toast(r.erro); return; }
  toast(it ? 'Item atualizado.' : 'Item criado.');
  app.desenhar();
}

export const acoesMeasure = {
  async 'mz-item'(el) { await dialogoItem(el.dataset.id ? item(el.dataset.id) : null); },
  async 'mz-excluir-item'(el) {
    const it = item(el.dataset.id);
    if (!(await confirmar('Excluir "' + it.nome + '"?', 'O item sai do catálogo.', 'Excluir'))) return;
    const r = excluirItem(it.id);
    toast(r.erro || 'Item excluído.');
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
    const linhas = Array.from(form.querySelectorAll('.mz-linha')).map((tr) => ({
      itemId: tr.querySelector('[name="item"]').value, formula: tr.querySelector('[name="formula"]').value,
      perda: tr.querySelector('[name="perda"]').value, passo: tr.querySelector('[name="passo"]').value,
    }));
    const id = form.dataset.id || null;
    const r = salvarAssembly(id, { nome: form.querySelector('[name="nome"]').value, tipo: form.querySelector('[name="tipo"]').value, descricao: form.querySelector('[name="descricao"]').value, linhas });
    if (r.erro) { toast(r.erro); return; }
    toast('Assembly salvo.');
    app.ir('#/measure/assemblies');
  },
  async 'mz-excluir-assembly'(el) {
    const a = assembly(el.dataset.id);
    if (!(await confirmar('Excluir "' + a.nome + '"?', 'Ele sai das condições em que foi aplicado.', 'Excluir'))) return;
    excluirAssembly(a.id);
    toast('Assembly excluído.');
    app.ir('#/measure/assemblies');
  },
  async 'mz-aplicar-assembly'(el) {
    const c = condicao(el.dataset.cond);
    const opcoes = assemblies().filter((a) => a.tipo === c.tipo && !(c.assemblies || []).includes(a.id));
    if (!opcoes.length) { toast('Não há outro assembly para condições do tipo ' + TIPOS[c.tipo].nome.toLowerCase() + '. Crie em Measure › Assemblies.'); return; }
    const res = await abrirDialogo({
      titulo: 'Aplicar assembly em "' + c.nome + '"',
      corpo: '<label class="rotulo-pequeno" for="mz-as">Assembly</label><select id="mz-as" name="assembly">' + opcoes.map((a) => '<option value="' + a.id + '">' + esc(a.nome) + '</option>').join('') + '</select>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Aplicar', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = aplicarAssembly(c.id, res.campos.assembly);
    toast(r.erro || 'Assembly aplicado. Os materiais aparecem nas quantidades do projeto.');
    atualizarInterface();
  },
  'mz-remover-assembly'(el) { removerAssembly(el.dataset.cond, el.dataset.id); atualizarInterface(); },
  'mz-csv'(el) {
    const q = quantidadesDoProjeto(el.dataset.projeto);
    const linhas = [['Categoria', 'Código', 'Item', 'Etapa', 'Unidade', 'Quantidade', 'Condição', 'Assembly', 'Fórmula', 'Bruta', 'Perda %', 'Com perda', 'Arredondamento', 'Final']];
    for (const g of q.porItem) for (const x of g.linhas) {
      linhas.push([CATEGORIAS[g.item.categoria], g.item.codigo, g.item.nome, g.item.etapa, g.item.unidade, Math.round(g.total * 100) / 100, x.condicao.nome, x.assembly.nome, x.linha.formula,
        Math.round(x.bruta * 1000) / 1000, x.linha.perda, Math.round(x.comPerda * 1000) / 1000, nomeArred(x.linha.passo), Math.round(x.final * 1000) / 1000]);
    }
    const csv = linhas.map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
    a.download = 'korbuild-measure-quantidades.csv';
    document.body.appendChild(a); a.click(); a.remove();
    toast('CSV com ' + (linhas.length - 1) + ' linhas de cálculo.');
  },
  'mz-ferramenta'(el) { visor.ferramenta = el.dataset.ferramenta; visor.pontos = []; visor.cal = []; atualizarInterface(); },
  'mz-condicao'(el) {
    visor.condicaoId = el.dataset.id; visor.pontos = []; visor.desconto = false;
    if (folha(visor.folhaId).escala && visor.ferramenta === 'mover') visor.ferramenta = 'medir';
    atualizarInterface();
  },
  'mz-desconto'(el) { visor.desconto = el.checked; visor.pontos = []; atualizarInterface(); },
  async 'mz-escala'() {
    const f = folha(visor.folhaId);
    const atual = f.escala && f.escala.origem === 'lista' ? f.escala.razao : 48;
    const grupos = ['Arquitetônica', 'Engenharia'];
    const res = await abrirDialogo({
      titulo: 'Escala da folha',
      corpo: '<p class="mudo pequeno">A escala está no carimbo ou embaixo do desenho (ex.: SCALE: 1/4" = 1\'-0"). Se a planta foi impressa ou digitalizada fora de escala, calibre por uma cota.</p>' +
        '<label class="rotulo-pequeno" for="mz-esc">Escala</label><select id="mz-esc" name="razao">' + grupos.map((g) => '<optgroup label="' + g + '">' + ESCALAS.filter((e) => e.grupo === g).map((e) => '<option value="' + e.razao + '"' + (e.razao === atual ? ' selected' : '') + '>' + esc(e.nome) + '</option>').join('') + '</optgroup>').join('') + '</select>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Calibrar por uma cota', valor: 'calibrar' }, { rotulo: 'Usar esta escala', valor: 'lista', classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    if (res.valor === 'calibrar') { visor.ferramenta = 'calibrar'; visor.cal = []; atualizarInterface(); return; }
    const e = ESCALAS.find((x) => x.razao === Number(res.campos.razao));
    definirEscala(f.id, { polPorPonto: polPorPontoDaEscala(e.razao), razao: e.razao, nome: e.nome, origem: 'lista' });
    visor.ferramenta = 'conferir'; visor.cal = [];
    toast('Escala ' + e.nome + ' definida. Confira medindo uma cota conhecida.');
    atualizarInterface();
  },
  'mz-zoom'(el) {
    const passo = Number(el.dataset.passo);
    const area = document.getElementById('mz-area');
    const cx = area.scrollLeft + area.clientWidth / 2, cy = area.scrollTop + area.clientHeight / 2;
    if (!passo) { visor.zoom = ajustarZoom(area); renderizar(); return; }
    zoomEm(visor.zoom * (passo > 0 ? 1.25 : 0.8), cx, cy);
  },
  async 'mz-nova-condicao'() { await dialogoCondicao(null); },
  async 'mz-editar-condicao'(el) { await dialogoCondicao(condicao(el.dataset.id)); },
  async 'mz-excluir-condicao'(el) {
    const c = condicao(el.dataset.id);
    if (!(await confirmar('Excluir "' + c.nome + '"?', c.medicoes.length ? 'As ' + c.medicoes.length + ' medições dela, em todas as folhas, também serão apagadas.' : 'A condição não tem medições.', 'Excluir'))) return;
    excluirCondicao(c.id);
    visor.condicaoId = (condicoesDo(folha(visor.folhaId).projetoId)[0] || {}).id || null;
    atualizarInterface();
  },
  'mz-apagar-medicao'(el) { excluirMedicao(el.dataset.cond, el.dataset.id); atualizarInterface(); },
};
