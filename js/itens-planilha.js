/* KORbuild Takeoff — Itens: exportar e importar (Excel e CSV).
 * Exportar: todos os itens com o preço atual (e, no Excel, o histórico de preços numa segunda aba).
 * Importar: modelo para baixar; a planilha é conferida antes de gravar (novos, alterados, preços novos, erros); só grava depois de confirmar.
 * O casamento é pelo código (ou pelo nome, quando não há código). Preço importado vira preço novo com data: nunca sobrescreve nem apaga o histórico.
 * Usa a ExcelJS (vendor/exceljs, MIT), carregada só na hora. */

import { esc, toast, abrirDialogo, hoje, dataCurta } from './util.js';
import { tr, tn } from './i18n.js';
import { estado } from './armazem.js';
import { usuarioAtual } from './plataforma.js';
import { CATEGORIAS, itens, salvarItem, definirAtivoItem } from './measure.js';
import { contato } from './contatos.js';
import { precoEm, historicoDePrecos, registrarPreco } from './precos.js';
import { PERSISTE_ATIVO_ITEM } from './measure-oficial.js';

let carregando = null;
function carregarExcelJS() {
  if (window.ExcelJS) return Promise.resolve(window.ExcelJS);
  if (!carregando) {
    carregando = new Promise((ok, falha) => {
      const s = document.createElement('script');
      s.src = 'vendor/exceljs/exceljs.min.js';
      s.onload = () => ok(window.ExcelJS);
      s.onerror = () => { carregando = null; falha(new Error('ExcelJS indisponível')); };
      document.head.appendChild(s);
    });
  }
  return carregando;
}

const quem = () => (usuarioAtual() || {}).nome || '';
const ativoDisponivel = () => !estado().oficial || PERSISTE_ATIVO_ITEM;

/* As colunas, com os nomes que aceitamos (sem acento e em minúsculas). */
const COLUNAS = [
  { k: 'codigo', nome: 'Code', apelidos: ['code', 'codigo', 'sku', 'item code'] },
  { k: 'nome', nome: 'Name', apelidos: ['name', 'nome', 'item', 'description', 'descricao'] },
  { k: 'categoria', nome: 'Category', apelidos: ['category', 'categoria', 'type', 'tipo'] },
  { k: 'unidade', nome: 'Purchase unit', apelidos: ['purchase unit', 'unit', 'unidade', 'unidade de compra', 'uom'] },
  { k: 'etapa', nome: 'Cost code', apelidos: ['cost code', 'costcode', 'etapa', 'etapa (cost code)', 'csi'] },
  { k: 'nota', nome: 'Note', apelidos: ['note', 'notes', 'nota', 'observacao'] },
  { k: 'preco', nome: 'Price', apelidos: ['price', 'preco', 'current price', 'preco atual', 'cost', 'custo'] },
  { k: 'desde', nome: 'Price valid from', apelidos: ['price valid from', 'valid from', 'vale desde', 'desde', 'price date', 'data do preco', 'effective date'] },
  { k: 'fonte', nome: 'Price source', apelidos: ['price source', 'source', 'origem', 'fonte', 'supplier', 'fornecedor'] },
  { k: 'ativo', nome: 'Active', apelidos: ['active', 'ativo', 'status'] },
];
const semAcento = (t) => String(t == null ? '' : t).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const CAT_APELIDOS = {
  material: ['material', 'materials', 'materiais'], 'mao-de-obra': ['labor', 'labour', 'manpower', 'mao de obra', 'mao-de-obra', 'mao de obra (hora)'],
  equipamento: ['equipment', 'equipamento', 'equipamentos'], subempreiteiro: ['subcontractor', 'subcontractors', 'subempreiteiro', 'subempreiteiros', 'sub'],
};
const categoriaDe = (t) => { const x = semAcento(t); return Object.keys(CAT_APELIDOS).find((k) => k === x || CAT_APELIDOS[k].includes(x)) || null; };
const sim = (t) => ['yes', 'y', 'sim', 's', 'true', '1', 'active', 'ativo', 'x'].includes(semAcento(t));
const nao = (t) => ['no', 'n', 'nao', 'false', '0', 'inactive', 'inativo'].includes(semAcento(t));

/* ---------- Exportar ---------- */

function baixar(blob, nome) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  window.kbtUltimoExcel = { nome, tamanho: blob.size };
}

function linhasDosItens() {
  return itens().slice().sort((a, b) => (a.categoria + a.etapa + a.nome).localeCompare(b.categoria + b.etapa + b.nome)).map((it) => {
    const p = precoEm(it);
    return [it.codigo || '', it.nome, CATEGORIAS[it.categoria] || it.categoria, it.unidade, it.etapa || '', it.nota || '', p ? p.valor : '', p ? p.desde : '', p ? p.fonte : '', it.ativo === false ? 'No' : 'Yes'];
  });
}

function estilizar(ws, larguras) {
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2733' } };
  ws.getRow(1).alignment = { vertical: 'middle' };
  larguras.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: larguras.length } };
}

export async function exportarItens(formato) {
  const data = hoje();
  if (formato === 'csv') {
    const csv = [COLUNAS.map((c) => c.nome)].concat(linhasDosItens()).map((l) => l.map((v) => { const t = String(v == null ? '' : v); return /[",\n;]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(',')).join('\r\n');
    baixar(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'Items - ' + data + '.csv');
    return;
  }
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KORbuild Takeoff'; wb.created = new Date();
  const ws = wb.addWorksheet('Items');
  ws.addRow(COLUNAS.map((c) => c.nome));
  linhasDosItens().forEach((l) => ws.addRow(l));
  estilizar(ws, [14, 38, 16, 16, 30, 30, 12, 18, 26, 9]);
  ws.getColumn(7).numFmt = '#,##0.00';
  const wh = wb.addWorksheet('Price history');
  wh.addRow(['Code', 'Name', 'Valid from', 'Price', 'Source', 'Supplier', 'Recorded by']);
  itens().slice().sort((a, b) => a.nome.localeCompare(b.nome)).forEach((it) => {
    historicoDePrecos(it).forEach((x) => wh.addRow([it.codigo || '', it.nome, x.desde, x.valor, x.fonte || '', (x.fornecedorId && contato(x.fornecedorId) ? contato(x.fornecedorId).nome : ''), x.por || '']));
  });
  estilizar(wh, [14, 38, 14, 12, 30, 26, 22]);
  wh.getColumn(4).numFmt = '#,##0.00';
  const buffer = await wb.xlsx.writeBuffer();
  baixar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Items - ' + data + '.xlsx');
}

export async function baixarModelo() {
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Items');
  ws.addRow(COLUNAS.map((c) => c.nome));
  ws.addRow(['DW-58X', 'Drywall 5/8" Type X 4\'×8\'', 'Material', 'sheet', '09 29 00 · Gypsum board', 'covers 32 sq ft', 15.8, hoje(), 'Supplier list', 'Yes']);
  ws.addRow(['MO-DW', 'Drywall: hang and finish', 'Labor', 'hour', '09 29 00 · Gypsum board', '', 38, hoje(), 'Typed', 'Yes']);
  estilizar(ws, [14, 38, 16, 16, 30, 30, 12, 18, 26, 9]);
  const wi = wb.addWorksheet('How to fill');
  [['Column', 'What to write'],
    ['Code', 'Optional but recommended: it is how the import finds an item that already exists. Without a code, the name is used.'],
    ['Name', 'Required for new items.'],
    ['Category', 'Material, Labor, Equipment or Subcontractor.'],
    ['Purchase unit', 'Required for new items: sheet, box, roll, piece, cu yd, hour…'],
    ['Cost code', 'Optional. Example: 09 29 00 · Gypsum board.'],
    ['Note', 'Optional.'],
    ['Price', 'Optional. A price that is different from the current one becomes a NEW price (the history is never changed).'],
    ['Price valid from', 'Date the price takes effect (YYYY-MM-DD). Empty = today.'],
    ['Price source', 'Optional. Empty = "Imported".'],
    ['Active', 'Yes or No. Items are never deleted: "No" makes the item inactive.'],
  ].forEach((l) => wi.addRow(l));
  estilizar(wi, [20, 110]);
  const buffer = await wb.xlsx.writeBuffer();
  baixar(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'Items - import template.xlsx');
}

/* ---------- Ler a planilha ---------- */

/* CSV: aspas, vírgula ou ponto e vírgula (detecta), quebras de linha dentro de aspas. */
export function lerCSV(texto) {
  const t = String(texto || '').replace(/^﻿/, '');
  const primeira = t.split(/\r?\n/)[0] || '';
  const delim = (primeira.match(/;/g) || []).length > (primeira.match(/,/g) || []).length ? ';' : (primeira.includes('\t') ? '\t' : ',');
  const linhas = []; let campo = '', linha = [], aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (c === '"') aspas = false; else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === delim) { linha.push(campo); campo = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += c;
  }
  if (campo !== '' || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter((l) => l.some((x) => String(x).trim() !== ''));
}

const celula = (v) => {
  if (v == null) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') { if ('result' in v) return celula(v.result); if ('text' in v) return String(v.text); if (v.richText) return v.richText.map((x) => x.text).join(''); return String(v); }
  return v;
};

export async function lerArquivo(arquivo) {
  const nome = (arquivo.name || '').toLowerCase();
  if (nome.endsWith('.csv') || nome.endsWith('.txt')) return lerCSV(await arquivo.text());
  if (!nome.endsWith('.xlsx')) throw new Error(tr('Envie um arquivo .xlsx ou .csv.'));
  const ExcelJS = await carregarExcelJS();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await arquivo.arrayBuffer());
  const ws = wb.getWorksheet('Items') || wb.worksheets[0];
  if (!ws) throw new Error(tr('A planilha está vazia.'));
  const linhas = [];
  ws.eachRow({ includeEmpty: false }, (row) => { const v = []; for (let c = 1; c <= Math.max(row.cellCount, 10); c++) v.push(celula(row.getCell(c).value)); linhas.push(v); });
  return linhas.filter((l) => l.some((x) => String(x).trim() !== ''));
}

/* ---------- Conferir ---------- */

function mapaDeColunas(cabecalho) {
  const mapa = {};
  cabecalho.forEach((h, i) => { const x = semAcento(h); const col = COLUNAS.find((c) => c.apelidos.includes(x)); if (col && mapa[col.k] == null) mapa[col.k] = i; });
  return mapa;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
function dataDe(v) {
  const t = String(v == null ? '' : v).trim();
  if (!t) return '';
  if (ISO.test(t)) return t;
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + m[1].padStart(2, '0') + '-' + m[2].padStart(2, '0');   // mm/dd/aaaa (EUA)
  return null;
}
function numeroDe(v) {
  if (typeof v === 'number') return v;
  const t = String(v == null ? '' : v).replace(/[^\d.,-]/g, '');
  if (!t) return NaN;
  if (t.includes(',') && t.includes('.')) return t.lastIndexOf(',') > t.lastIndexOf('.') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t.replace(/,/g, ''));
  return t.includes(',') ? Number(t.replace(',', '.')) : Number(t);
}

/* Compara a planilha com o catálogo e diz o que vai acontecer, sem gravar nada. */
export function planejarImportacao(linhas) {
  const plano = { novos: [], alterados: [], precos: [], ativos: [], iguais: 0, erros: [], total: 0, semColunas: null };
  if (linhas.length < 2) { plano.semColunas = tr('A planilha não tem linhas de itens.'); return plano; }
  const col = mapaDeColunas(linhas[0]);
  if (col.nome == null && col.codigo == null) { plano.semColunas = tr('Não achei as colunas Code ou Name na primeira linha. Use o modelo.'); return plano; }
  const lista = itens();
  const porCodigo = new Map(lista.filter((i) => i.codigo).map((i) => [semAcento(i.codigo), i]));
  const porNome = new Map(lista.map((i) => [semAcento(i.nome), i]));
  const vistos = new Set();
  const v = (l, k) => (col[k] == null ? '' : String(celula(l[col[k]]) == null ? '' : celula(l[col[k]])).trim());
  linhas.slice(1).forEach((l, idx) => {
    const n = idx + 2;   // número da linha na planilha
    plano.total++;
    const dados = { codigo: v(l, 'codigo'), nome: v(l, 'nome'), categoria: v(l, 'categoria'), unidade: v(l, 'unidade'), etapa: v(l, 'etapa'), nota: v(l, 'nota') };
    const chave = dados.codigo ? 'c:' + semAcento(dados.codigo) : 'n:' + semAcento(dados.nome);
    if (chave === 'n:') { plano.erros.push({ n, motivo: tr('Sem código nem nome.') }); return; }
    if (vistos.has(chave)) { plano.erros.push({ n, motivo: tr('Repetido na planilha: {item}', { item: dados.codigo || dados.nome }) }); return; }
    vistos.add(chave);
    const existente = dados.codigo ? porCodigo.get(semAcento(dados.codigo)) : porNome.get(semAcento(dados.nome));
    let cat = null;
    if (dados.categoria) { cat = categoriaDe(dados.categoria); if (!cat) { plano.erros.push({ n, motivo: tr('Categoria desconhecida: {c}', { c: dados.categoria }) }); return; } }
    // preço
    let preco = null;
    if (col.preco != null && String(celula(l[col.preco])).trim() !== '') {
      const valor = numeroDe(celula(l[col.preco]));
      if (!(valor > 0)) { plano.erros.push({ n, motivo: tr('Preço inválido: {p}', { p: String(celula(l[col.preco])) }) }); return; }
      const desde = col.desde != null && String(celula(l[col.desde])).trim() !== '' ? dataDe(celula(l[col.desde])) : hoje();
      if (!desde) { plano.erros.push({ n, motivo: tr('Data inválida: use AAAA-MM-DD ou mm/dd/aaaa.') }); return; }
      preco = { valor: Math.round(valor * 100) / 100, desde, fonte: v(l, 'fonte') || tr('Importado') };
    }
    let ativo = null;
    if (col.ativo != null && v(l, 'ativo')) { if (sim(v(l, 'ativo'))) ativo = true; else if (nao(v(l, 'ativo'))) ativo = false; else { plano.erros.push({ n, motivo: tr('Active: use Yes ou No.') }); return; } }
    if (!existente) {
      if (!dados.nome) { plano.erros.push({ n, motivo: tr('Item novo sem nome.') }); return; }
      if (!dados.unidade) { plano.erros.push({ n, motivo: tr('Item novo sem unidade de compra: {item}', { item: dados.nome }) }); return; }
      plano.novos.push({ n, dados: { ...dados, categoria: cat || 'material' }, preco, ativo });
      return;
    }
    // existente: só muda o que veio preenchido e é diferente
    const novo = {};
    if (dados.nome && dados.nome !== existente.nome) novo.nome = dados.nome;
    if (cat && cat !== existente.categoria) novo.categoria = cat;
    if (dados.unidade && dados.unidade !== existente.unidade) novo.unidade = dados.unidade;
    if (dados.etapa && dados.etapa !== (existente.etapa || '')) novo.etapa = dados.etapa;
    if (dados.nota && dados.nota !== (existente.nota || '')) novo.nota = dados.nota;
    if (dados.codigo && dados.codigo !== existente.codigo) novo.codigo = dados.codigo;
    let mudou = false;
    if (Object.keys(novo).length) { plano.alterados.push({ n, id: existente.id, nome: existente.nome, mudancas: novo }); mudou = true; }
    const atual = precoEm(existente);
    if (preco && !(atual && atual.valor === preco.valor && atual.desde === preco.desde) && !(atual && atual.valor === preco.valor && !col.desde)) { plano.precos.push({ n, id: existente.id, nome: existente.nome, ...preco, antes: atual ? atual.valor : null }); mudou = true; }
    if (ativo != null && ativo !== (existente.ativo !== false)) { plano.ativos.push({ n, id: existente.id, nome: existente.nome, ativo }); mudou = true; }
    if (!mudou) plano.iguais++;
  });
  // preço dos itens novos também conta como preço novo
  return plano;
}

/* Grava o que foi conferido. */
export function aplicarImportacao(plano) {
  let itensNovos = 0, itensAlterados = 0, precos = 0, ativos = 0;
  const falhas = [];
  for (const x of plano.novos) {
    const r = salvarItem(null, x.dados);
    if (r.erro) { falhas.push({ n: x.n, motivo: r.erro }); continue; }
    itensNovos++;
    if (x.preco) { const p = registrarPreco(r.id, x.preco, quem()); if (p.erro) falhas.push({ n: x.n, motivo: p.erro }); else precos++; }
    if (x.ativo === false && ativoDisponivel()) { definirAtivoItem(r.id, false); ativos++; }
  }
  for (const x of plano.alterados) {
    const atual = itens().find((i) => i.id === x.id);
    const r = salvarItem(x.id, { codigo: atual.codigo, nome: atual.nome, categoria: atual.categoria, unidade: atual.unidade, etapa: atual.etapa, nota: atual.nota, ...x.mudancas });
    if (r.erro) falhas.push({ n: x.n, motivo: r.erro }); else itensAlterados++;
  }
  for (const x of plano.precos) { const p = registrarPreco(x.id, { valor: x.valor, desde: x.desde, fonte: x.fonte }, quem()); if (p.erro) falhas.push({ n: x.n, motivo: p.erro }); else precos++; }
  if (ativoDisponivel()) for (const x of plano.ativos) { definirAtivoItem(x.id, x.ativo); ativos++; }
  return { itensNovos, itensAlterados, precos, ativos, falhas };
}

/* ---------- As janelas ---------- */

export async function dialogoExportar() {
  const res = await abrirDialogo({
    titulo: tr('Exportar itens'),
    corpo: '<p class="mudo pequeno">' + tr('Todos os itens com o preço atual. No Excel, uma segunda aba traz o histórico completo de preços.') + '</p>' +
      '<label class="check"><input type="radio" name="formato" value="xlsx" checked> ' + tr('Excel (.xlsx), com o histórico de preços') + '</label>' +
      '<label class="check"><input type="radio" name="formato" value="csv"> ' + tr('CSV (.csv), só os itens') + '</label>',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Exportar'), valor: true, classe: 'btn-primario' }],
  });
  if (!res || !res.valor) return;
  try { await exportarItens(res.campos.formato); toast(tr('Planilha gerada.')); } catch (e) { console.error(e); toast(tr('Não foi possível gerar a planilha.')); }
}

const lista = (itensTxt) => itensTxt.length ? '<ul class="lista-simples">' + itensTxt.map((t) => '<li>' + t + '</li>').join('') + '</ul>' : '';

export async function dialogoImportar() {
  const passo1 = await abrirDialogo({
    titulo: tr('Importar itens'),
    corpo: '<p class="mudo pequeno">' + tr('Envie uma planilha (.xlsx ou .csv) com os itens. Antes de gravar, você vê o que vai mudar. Itens são achados pelo código (ou pelo nome); um preço diferente vira um preço novo, sem mexer no histórico.') + '</p>' +
      '<p><button type="button" class="btn btn-contorno btn-pequeno" data-acao="itens-modelo">' + tr('Baixar o modelo (Excel)') + '</button></p>' +
      '<label class="rotulo-pequeno" for="imp-arquivo">' + tr('Planilha') + '</label><input type="file" id="imp-arquivo" name="arquivo" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">',
    acoes: [{ rotulo: tr('Cancelar'), valor: false }, { rotulo: tr('Conferir a planilha'), valor: true, classe: 'btn-primario' }],
  });
  if (!passo1 || !passo1.valor) return null;
  if (!passo1.campos.arquivo) { toast(tr('Escolha a planilha.')); return null; }
  let plano;
  try { plano = planejarImportacao(await lerArquivo(passo1.campos.arquivo)); } catch (e) { console.error(e); toast(e && e.message ? e.message : tr('Não foi possível ler a planilha.')); return null; }
  if (plano.semColunas) { toast(plano.semColunas); return null; }
  const mudancas = plano.novos.length + plano.alterados.length + plano.precos.length + plano.ativos.length;
  const passo2 = await abrirDialogo({
    titulo: tr('Conferir a importação'),
    corpo: '<div class="co-kpis co-kpis-4">' +
      '<div class="co-kpi"><span>' + tr('Itens novos') + '</span><b>' + plano.novos.length + '</b></div><div class="co-kpi"><span>' + tr('Itens alterados') + '</span><b>' + plano.alterados.length + '</b></div>' +
      '<div class="co-kpi"><span>' + tr('Preços novos') + '</span><b>' + (plano.precos.length + plano.novos.filter((x) => x.preco).length) + '</b></div><div class="co-kpi"><span>' + tr('Com erro') + '</span><b>' + plano.erros.length + '</b></div></div>' +
      '<p class="mudo pequeno">' + tn(plano.total, '{n} linha lida', '{n} linhas lidas') + ' · ' + tn(plano.iguais, '{n} igual ao catálogo', '{n} iguais ao catálogo') + (plano.ativos.length ? ' · ' + tn(plano.ativos.length, '{n} muda de ativo/inativo', '{n} mudam de ativo/inativo') : '') + '</p>' +
      (plano.alterados.length ? '<p class="pequeno"><b>' + tr('Alterados') + '</b></p>' + lista(plano.alterados.slice(0, 6).map((x) => esc(x.nome) + ' <span class="mudo">(' + esc(Object.keys(x.mudancas).join(', ')) + ')</span>')) : '') +
      (plano.precos.length ? '<p class="pequeno"><b>' + tr('Preços novos') + '</b></p>' + lista(plano.precos.slice(0, 6).map((x) => esc(x.nome) + ': ' + (x.antes != null ? x.antes + ' → ' : '') + x.valor + ' <span class="mudo">(' + dataCurta(x.desde) + ')</span>')) : '') +
      (plano.erros.length ? '<p class="pequeno texto-alerta"><b>' + tr('Linhas com erro (não serão importadas)') + '</b></p>' + lista(plano.erros.slice(0, 8).map((x) => tr('Linha {n}', { n: x.n }) + ': ' + esc(x.motivo))) + (plano.erros.length > 8 ? '<p class="mudo pequeno">' + tr('… e mais {n}.', { n: plano.erros.length - 8 }) + '</p>' : '') : '') +
      (!ativoDisponivel() && plano.ativos.length ? '<p class="mudo pequeno">' + tr('A coluna Active será ignorada até a próxima atualização do banco.') + '</p>' : '') +
      (!mudancas ? '<p class="vazio">' + tr('Nada para importar: a planilha é igual ao catálogo.') + '</p>' : ''),
    acoes: [{ rotulo: tr('Cancelar'), valor: false }].concat(mudancas ? [{ rotulo: plano.erros.length ? tr('Importar só as linhas certas') : tr('Importar'), valor: true, classe: 'btn-primario' }] : []),
  });
  if (!passo2 || !passo2.valor) return null;
  const r = aplicarImportacao(plano);
  toast(tr('Importado: {a} itens novos, {b} alterados, {c} preços novos.', { a: r.itensNovos, b: r.itensAlterados, c: r.precos }) + (r.falhas.length ? ' ' + tn(r.falhas.length, '{n} linha falhou.', '{n} linhas falharam.') : ''));
  return r;
}

export const acoesPlanilha = {
  async 'itens-exportar'() { await dialogoExportar(); },
  async 'itens-modelo'() { try { await baixarModelo(); } catch (e) { console.error(e); toast(tr('Não foi possível gerar o modelo.')); } },
};
