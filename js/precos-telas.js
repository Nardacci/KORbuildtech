/* KORbuild Measure — tela de preços: o preço de cada item com vigência (de onde veio e desde quando),
 * as margens (overhead, lucro, imposto sobre material) com vigência, e o registro dos preços que o
 * fornecedor devolveu na cotação. */

import { esc, toast, abrirDialogo, hoje, dataCurta } from './util.js';
import { usuarioAtual, pode } from './plataforma.js';
import { salvar } from './armazem.js';
import { icone } from './icones.js';
import { numero } from './imperial.js';
import { dinheiro } from './crew.js';
import { CATEGORIAS, itens, item, projeto } from './measure.js';
import { contato } from './contatos.js';
import {
  precoEm, historicoDePrecos, registrarPreco, custoHoraDoCrew, MODOS_LUCRO, margensEm, historicoDeMargens, novasMargens, textoMargens, precoDeVenda,
} from './precos.js';
import { lerValor, listaDeCotacao } from './measure-relatorios.js';

let app = { desenhar: () => {} };
export function ligarPrecos(funcoes) { app = { ...app, ...funcoes }; }
const quem = () => (usuarioAtual() || {}).nome || '';
const podeEditar = () => pode(usuarioAtual(), 'measure.catalogo');
const pct = (v) => numero(v, Number.isInteger(v) ? 0 : 1) + '%';

export function telaPrecos(moldura) {
  const m = margensEm();
  const ed = podeEditar();
  const crew = custoHoraDoCrew();
  const exemplo = precoDeVenda(1000, m);
  const linha = (it) => {
    const p = precoEm(it);
    const h = historicoDePrecos(it);
    return '<tr><td class="mudo">' + esc(it.codigo) + '</td><td><b>' + esc(it.nome) + '</b>' + (h.length > 1 ? '<details class="preco-historico"><summary>' + h.length + ' preços</summary><ul>' +
        h.map((x) => '<li>' + dinheiro(x.valor) + ' desde ' + dataCurta(x.desde) + ' · ' + esc(x.fonte) + '</li>').join('') + '</ul></details>' : '') + '</td>' +
      '<td class="num">' + (p ? '<b>' + dinheiro(p.valor) + '</b> / ' + esc(it.unidade) : '<span class="etiqueta etiqueta-ambar">sem preço</span>') + '</td>' +
      '<td class="pequeno">' + (p ? 'desde ' + dataCurta(p.desde) + '<span class="mudo bloco">' + esc(p.fonte) + '</span>' : '') + '</td>' +
      '<td class="num">' + (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="preco-novo" data-id="' + it.id + '">Novo preço</button>' : '') + '</td></tr>';
  };
  return moldura({
    ativo: 'precos', largura: 'larga', titulo: 'Preços', subtitulo: 'Custo de cada item com vigência, e as margens que viram o preço de venda da proposta',
    conteudo:
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Margens</h2>' + (ed ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="margens-nova">Nova versão</button>' : '') + '</div>' +
        '<p class="margens-atual"><b>' + esc(textoMargens(m)) + '</b> <span class="mudo pequeno">desde ' + dataCurta(m.desde) + '</span></p>' +
        '<p class="mudo pequeno">Exemplo: custo de US$ 1.000,00 → com overhead ' + dinheiro(exemplo.comOverhead) + ' → preço de venda <b>' + dinheiro(exemplo.venda) + '</b>. ' +
          'Markup: lucro sobre o custo com overhead. Margem: lucro como parte do preço de venda.</p>' +
        (historicoDeMargens().length > 1 ? '<details class="preco-historico"><summary>Histórico</summary><ul>' + historicoDeMargens().map((x) => '<li>' + dataCurta(x.desde) + ' · ' + esc(textoMargens(x)) + ' · ' + esc(x.motivo) + ' · ' + esc(x.por) + '</li>').join('') + '</ul></details>' : '') +
      '</section>' +
      Object.entries(CATEGORIAS).map(([cat, nome]) => {
        const lista = itens().filter((i) => i.categoria === cat);
        if (!lista.length) return '';
        return '<section class="cartao"><h2 class="cartao-titulo">' + nome + '</h2>' +
          (cat === 'mao-de-obra' && crew ? '<p class="aviso-info">' + icone('crew', 16) + 'Pelo Crew, a hora custa em média <b>' + dinheiro(crew.custo) + '</b>: valor hora médio de ' + dinheiro(crew.media) +
            ' (' + crew.funcionarios + ' funcionários) + ' + pct(crew.encargos * 100) + ' de encargos.</p>' : '') +
          '<div class="tabela-rolagem"><table class="tabela tabela-precos"><thead><tr><th>Código</th><th>Item</th><th class="num">Preço atual</th><th>Vigência e origem</th><th></th></tr></thead><tbody>' +
          lista.map(linha).join('') + '</tbody></table></div></section>';
      }).join('') +
      '<p class="dica">Os preços nunca são apagados: um preço novo vale a partir de uma data, e a proposta usa o que vale no dia em que é emitida. Preços que o fornecedor devolveu entram pela Lista para cotação.</p>',
  });
}

async function dialogoPreco(it) {
  const atual = precoEm(it);
  const crew = it.categoria === 'mao-de-obra' ? custoHoraDoCrew() : null;
  const res = await abrirDialogo({
    titulo: 'Novo preço · ' + it.nome,
    corpo: (atual ? '<p class="mudo pequeno">Atual: ' + dinheiro(atual.valor) + ' / ' + esc(it.unidade) + ' desde ' + dataCurta(atual.desde) + ' (' + esc(atual.fonte) + ')</p>' : '') +
      '<label class="rotulo-pequeno" for="pr-valor">Preço por ' + esc(it.unidade) + ' (US$)</label><input type="text" inputmode="decimal" id="pr-valor" name="valor" value="' + (crew ? esc(numero(crew.custo, 2)) : '') + '">' +
      (crew ? '<p class="mudo pequeno">Sugestão do Crew: ' + dinheiro(crew.custo) + ' (valor hora médio + encargos).</p>' : '') +
      '<label class="rotulo-pequeno" for="pr-desde">Vale a partir de</label><input type="date" id="pr-desde" name="desde" value="' + hoje() + '">' +
      '<label class="rotulo-pequeno" for="pr-fonte">Origem</label><input type="text" id="pr-fonte" name="fonte" value="' + (crew ? 'Crew (valor hora + encargos)' : 'Digitado') + '">',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar preço', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = registrarPreco(it.id, { valor: lerValor(res.campos.valor), desde: res.campos.desde, fonte: res.campos.fonte }, quem());
  toast(r.erro || 'Preço salvo.');
  if (r.ok) app.desenhar();
}

async function dialogoMargens() {
  const m = margensEm();
  const res = await abrirDialogo({
    titulo: 'Nova versão das margens',
    corpo: '<div class="grade-campos"><div class="campo"><label class="rotulo-pequeno" for="mg-oh">Overhead (% sobre o custo)</label><input type="number" step="0.1" min="0" max="99" id="mg-oh" name="overheadPct" value="' + m.overheadPct + '"></div>' +
      '<div class="campo"><label class="rotulo-pequeno" for="mg-lucro">Lucro (%)</label><input type="number" step="0.1" min="0" max="99" id="mg-lucro" name="lucroPct" value="' + m.lucroPct + '"></div></div>' +
      '<label class="rotulo-pequeno" for="mg-modo">O lucro é</label><select id="mg-modo" name="modo">' + Object.entries(MODOS_LUCRO).map(([k, n]) => '<option value="' + k + '"' + (k === m.modo ? ' selected' : '') + '>' + n + '</option>').join('') + '</select>' +
      '<label class="rotulo-pequeno" for="mg-imp">Imposto sobre material (sales tax, %)</label><input type="number" step="0.01" min="0" max="99" id="mg-imp" name="impostoMaterialPct" value="' + m.impostoMaterialPct + '">' +
      '<label class="rotulo-pequeno" for="mg-desde">Vale a partir de</label><input type="date" id="mg-desde" name="desde" value="' + hoje() + '">' +
      '<label class="rotulo-pequeno" for="mg-motivo">Motivo</label><input type="text" id="mg-motivo" name="motivo" placeholder="Ex.: aumento do aluguel do galpão">',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  const r = novasMargens(res.campos, quem());
  toast(r.erro || 'Margens salvas.');
  if (r.ok) app.desenhar();
}

/* Preços que o fornecedor devolveu: viram o preço do item (com vigência e a origem "Cotação · fornecedor"). */
async function dialogoRespostaCotacao(projetoId, fornecedorId) {
  const f = contato(fornecedorId);
  const g = listaDeCotacao(projetoId).grupos.find((x) => x.fornecedor.id === fornecedorId);
  if (!g) return;
  const res = await abrirDialogo({
    titulo: 'Preços recebidos · ' + f.nome,
    corpo: '<p class="mudo pequeno">Digite o preço unitário de cada item, como veio na resposta. Em branco, o item mantém o preço atual.</p><div class="resposta-cotacao">' +
      g.itens.map((x) => { const p = precoEm(x.item); return '<label class="rotulo-pequeno" for="rc-' + x.item.id + '">' + esc(x.item.nome) + ' <span class="mudo">(' + esc(x.item.unidade) + (p ? ' · atual ' + dinheiro(p.valor) : '') + ')</span></label>' +
        '<input type="text" inputmode="decimal" id="rc-' + x.item.id + '" name="preco-' + x.item.id + '" placeholder="' + (p ? esc(numero(p.valor, 2)) : '0,00') + '">'; }).join('') + '</div>' +
      '<label class="rotulo-pequeno" for="rc-desde">Válido a partir de</label><input type="date" id="rc-desde" name="desde" value="' + hoje() + '">',
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar preços', valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  let n = 0;
  for (const [k, v] of Object.entries(res.campos)) {
    if (!k.startsWith('preco-') || !String(v).trim()) continue;
    const valor = lerValor(v);
    const r = registrarPreco(k.slice(6), { valor, desde: res.campos.desde, fonte: 'Cotação · ' + f.nome, fornecedorId }, quem());
    if (r.erro) { toast(item(k.slice(6)).nome + ': ' + r.erro); return; }
    n++;
  }
  const p = projeto(projetoId);
  p.cotacao = p.cotacao || {};
  p.cotacao.respostas = (p.cotacao.respostas || []).concat([{ fornecedorId, em: new Date().toISOString(), por: quem(), itens: n }]);
  salvar();
  toast(n ? n + (n === 1 ? ' preço salvo' : ' preços salvos') + ' de ' + f.nome + '. A proposta já usa os preços novos.' : 'Nenhum preço digitado.');
  app.desenhar();
}

export const acoesPrecos = {
  async 'preco-novo'(el) { await dialogoPreco(item(el.dataset.id)); },
  async 'margens-nova'() { await dialogoMargens(); },
  async 'cot-resposta'(el) { await dialogoRespostaCotacao(el.dataset.projeto, el.dataset.fornecedor); },
};
