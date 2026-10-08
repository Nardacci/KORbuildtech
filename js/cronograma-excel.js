/* KORbuild — cronograma em Excel (.xlsx de verdade) com layout profissional (docs/cronograma.md CR-11):
 * logo e dados da empresa, obra e contratante, tabela das etapas e o Gantt nas células, semana a semana.
 * Usa a ExcelJS (vendor/exceljs, licença MIT), carregada só na hora de exportar e sem internet. */

import { hoje, somarDias, diasEntre, dataCurta, diaMes, nomeDoMes, dataHora } from './util.js';
import { tr, emIngles } from './i18n.js';
import { enderecoDaEmpresa } from './contatos.js';
import { SITUACOES_ETAPA, duracao, desvio, situacaoDaEtapa, avancoDaObra, ultimaBase, datasDeBase } from './cronograma.js';

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

const COR = {
  marca: 'FFF26A1B', grafite: 'FF1F2733', texto: 'FF344054', mudo: 'FF667085', borda: 'FFD0D5DD', fundo: 'FFF2F4F7', cabecalho: 'FF1F2733',
  concluida: 'FF12B76A', atrasada: 'FFF04438', risco: 'FFF79009', andamento: 'FF2E90FA', futura: 'FF98A2B3', base: 'FF667085', hoje: 'FFF26A1B',
};
const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const fina = { style: 'thin', color: { argb: COR.borda } };

function medirImagem(dataUrl) {
  return new Promise((ok) => {
    const img = new Image();
    img.onload = () => ok({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => ok(null);
    img.src = dataUrl;
  });
}

function nomeSeguro(s) { return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[·•]/g, '-').replace(/[^\w .()-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90); }

/* opcoes: { c, obraNome, contratante, empresa, responsavel(id), nomeArquivo, versao?, publicadoEm? } */
export async function exportarExcel(opcoes) {
  const ExcelJS = await carregarExcelJS();
  const { c, empresa } = opcoes;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'KORbuild';
  wb.created = new Date();
  const ws = wb.addWorksheet(tr('Cronograma'), {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } },
    headerFooter: { oddFooter: '&L' + tr('Gerado pelo KORbuild') + '&R' + tr('Página') + ' &P / &N' },
    views: [{ state: 'frozen', xSplit: 2, ySplit: 9, showGridLines: false }],
  });

  // Semanas (segunda a domingo) cobrindo as etapas, a linha de base e hoje.
  const datas = c.etapas.flatMap((e) => { const b = datasDeBase(c, e); return [e.inicio, e.fim].concat(b ? [b.inicio, b.fim] : []); }).concat([hoje()]).sort();
  let ini = datas[0];
  ini = somarDias(ini, -((new Date(ini + 'T12:00:00').getDay() + 6) % 7));
  const fimTotal = datas[datas.length - 1];
  const semanas = [];
  for (let d = ini; d <= fimTotal; d = somarDias(d, 7)) semanas.push(d);
  const PRIMEIRA = 10; // coluna J: primeira semana
  const fixas = [
    [tr('Nº'), 5], [tr('Etapa da obra'), 36], [tr('Responsável'), 18], [tr('Início'), 11], [tr('Fim'), 11], [tr('Dias'), 6], [tr('% concl.'), 8], [tr('Situação'), 13], [tr('Desvio (dias)'), 9],
  ];
  ws.columns = fixas.map(([, w]) => ({ width: w })).concat(semanas.map(() => ({ width: 4.6 })));
  const ultimaCol = PRIMEIRA + semanas.length - 1;
  const letra = (n) => { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; };

  // ---------- Cabeçalho: logo, empresa e título ----------
  for (let r = 1; r <= 4; r++) ws.getRow(r).height = 18;
  if (empresa.logo && /^data:image\/(png|jpe?g)/.test(empresa.logo)) {
    const ext = /png/.test(empresa.logo) ? 'png' : 'jpeg';
    const id = wb.addImage({ base64: empresa.logo, extension: ext });
    const tam = await medirImagem(empresa.logo);
    const alt = 64, larg = tam ? Math.min(150, alt * tam.w / tam.h) : 120;
    ws.addImage(id, { tl: { col: 0.15, row: 0.2 }, ext: { width: larg, height: alt }, editAs: 'oneCell' });
  } else {
    ws.mergeCells('A1:A4');
    const s = ws.getCell('A1');
    s.value = empresa.sigla || '';
    s.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    s.fill = fill(COR.marca);
    s.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws.getCell('B1').value = empresa.nome;
  ws.getCell('B1').font = { bold: true, size: 15, color: { argb: COR.grafite } };
  ws.getCell('B2').value = [empresa.telefone, empresa.email].filter(Boolean).join('  ·  ');
  ws.getCell('B3').value = enderecoDaEmpresa(empresa) || '';
  ws.getCell('B4').value = empresa.licencas ? String(empresa.licencas).split('\n')[0] : '';
  ['B2', 'B3', 'B4'].forEach((k) => { ws.getCell(k).font = { size: 9, color: { argb: COR.mudo } }; });
  const colTitulo = Math.max(8, ultimaCol - 8);
  ws.mergeCells(1, colTitulo, 1, ultimaCol);
  const t = ws.getCell(1, colTitulo);
  t.value = tr('CRONOGRAMA DA OBRA');
  t.font = { bold: true, size: 16, color: { argb: COR.grafite } };
  t.alignment = { horizontal: 'right', vertical: 'middle' };
  ws.mergeCells(2, colTitulo, 2, ultimaCol);
  const sub = ws.getCell(2, colTitulo);
  sub.value = opcoes.versao ? tr('Versão {n}, publicada em {quando}', { n: opcoes.versao, quando: dataHora(opcoes.publicadoEm) }) : tr('Emitido em {quando}', { quando: dataHora(Date.now()) });
  sub.font = { size: 9, color: { argb: COR.mudo } };
  sub.alignment = { horizontal: 'right' };
  // faixa da marca
  ws.getRow(5).height = 4;
  for (let col = 1; col <= ultimaCol; col++) ws.getCell(5, col).fill = fill(COR.marca);

  // ---------- Dados da obra ----------
  const av = avancoDaObra(c);
  const base = ultimaBase(c);
  const info = [
    [tr('Obra'), opcoes.obraNome],
    [tr('Contratante'), opcoes.contratante || '—'],
    [tr('Avanço'), tr('{real}% real · {plan}% planejado para hoje', { real: av.real, plan: av.planejado })],
    [tr('Linha de base'), base ? tr('{data} · {motivo}', { data: dataCurta(new Date(base.em).toISOString().slice(0, 10)), motivo: base.motivo }) : '—'],
  ];
  ws.getRow(6).height = 20;
  ws.getRow(7).height = 20;
  info.forEach(([rot, val], i) => {
    const linha = 6 + Math.floor(i / 2);
    const col = i % 2 === 0 ? 1 : 6;
    const r = ws.getCell(linha, col);
    r.value = rot.toUpperCase();
    r.font = { bold: true, size: 8, color: { argb: COR.mudo } };
    r.alignment = { vertical: 'middle' };
    const ate = i % 2 === 0 ? 5 : Math.min(ultimaCol, 14);
    ws.mergeCells(linha, col + 1, linha, ate);
    const v = ws.getCell(linha, col + 1);
    v.value = val;
    v.font = { bold: true, size: 10, color: { argb: COR.grafite } };
    v.alignment = { vertical: 'middle' };
  });

  // ---------- Cabeçalho da tabela (linha 9) e meses (linha 8) ----------
  let mesAtual = null, mesIni = PRIMEIRA;
  const fecharMes = (ate) => {
    if (mesAtual == null) return;
    if (ate > mesIni) ws.mergeCells(8, mesIni, 8, ate);
    const m = ws.getCell(8, mesIni);
    m.value = nomeDoMes(Number(mesAtual.slice(5, 7)) - 1) + ' ' + mesAtual.slice(0, 4);
    m.font = { bold: true, size: 9, color: { argb: COR.grafite } };
    m.alignment = { horizontal: 'center' };
    m.fill = fill(COR.fundo);
    m.border = { left: fina, right: fina, top: fina };
  };
  semanas.forEach((s, i) => {
    const m = somarDias(s, 3).slice(0, 7); // mês da quinta-feira da semana
    if (m !== mesAtual) { fecharMes(PRIMEIRA + i - 1); mesAtual = m; mesIni = PRIMEIRA + i; }
  });
  fecharMes(ultimaCol);
  const cab = ws.getRow(9);
  cab.height = 34;
  fixas.forEach(([rot], i) => { cab.getCell(i + 1).value = rot; });
  semanas.forEach((s, i) => { cab.getCell(PRIMEIRA + i).value = diaMes(s); });
  for (let col = 1; col <= ultimaCol; col++) {
    const cel = cab.getCell(col);
    cel.font = { bold: true, size: col >= PRIMEIRA ? 7 : 9, color: { argb: 'FFFFFFFF' } };
    cel.fill = fill(COR.cabecalho);
    cel.alignment = col >= PRIMEIRA ? { horizontal: 'center', vertical: 'middle', textRotation: 90 } : { horizontal: col === 2 || col === 3 ? 'left' : 'center', vertical: 'middle', wrapText: true };
    cel.border = { left: fina, right: fina };
  }
  const colHoje = semanas.findIndex((s) => hoje() >= s && hoje() <= somarDias(s, 6));

  // ---------- Etapas ----------
  c.etapas.forEach((e, i) => {
    const linha = 10 + i;
    const row = ws.getRow(linha);
    row.height = 20;
    const s = situacaoDaEtapa(e);
    const dv = desvio(c, e);
    const valores = [i + 1, e.nome, opcoes.responsavel(e.responsavelId) || '', new Date(e.inicio + 'T12:00:00'), new Date(e.fim + 'T12:00:00'), duracao(e), (e.pct || 0) / 100, SITUACOES_ETAPA[s].nome, dv == null ? '' : dv];
    valores.forEach((v, k) => { row.getCell(k + 1).value = v; });
    const zebra = i % 2 ? COR.fundo : null;
    for (let col = 1; col <= 9; col++) {
      const cel = row.getCell(col);
      cel.font = { size: 9, color: { argb: COR.texto }, bold: col === 2 };
      cel.alignment = { vertical: 'middle', horizontal: col === 2 || col === 3 ? 'left' : 'center' };
      cel.border = { bottom: fina, left: fina, right: fina };
      if (zebra) cel.fill = fill(zebra);
    }
    row.getCell(4).numFmt = row.getCell(5).numFmt = emIngles() ? 'mm/dd/yyyy' : 'dd/mm/yyyy';
    row.getCell(7).numFmt = '0%';
    const sit = row.getCell(8);
    sit.font = { size: 9, bold: true, color: { argb: COR[s] } };
    if (dv) row.getCell(9).font = { size: 9, bold: true, color: { argb: dv > 0 ? COR.atrasada : COR.concluida } };
    const b = datasDeBase(c, e);
    semanas.forEach((sm, k) => {
      const fimSm = somarDias(sm, 6);
      const cel = row.getCell(PRIMEIRA + k);
      const naBarra = e.inicio <= fimSm && e.fim >= sm;
      const naBase = b && b.inicio <= fimSm && b.fim >= sm;
      if (naBarra) {
        cel.fill = fill(COR[s]);
        // a parte já executada (pelo %) vai mais escura: marca "■" nas semanas cobertas pelo andamento
        const semanasDaEtapa = Math.max(1, Math.ceil((diasEntre(e.inicio, e.fim) + 1) / 7));
        const idx = Math.floor(diasEntre(e.inicio, sm < e.inicio ? e.inicio : sm) / 7);
        if ((e.pct || 0) > 0 && idx < Math.round(semanasDaEtapa * (e.pct || 0) / 100)) { cel.value = '■'; cel.font = { size: 7, color: { argb: 'FFFFFFFF' } }; cel.alignment = { horizontal: 'center', vertical: 'middle' }; }
      } else if (zebra) cel.fill = fill(zebra);
      cel.border = {
        left: k === colHoje ? { style: 'medium', color: { argb: COR.hoje } } : { style: 'hair', color: { argb: COR.borda } },
        bottom: naBase ? { style: 'thick', color: { argb: COR.base } } : fina,
      };
    });
  });

  // ---------- Legenda ----------
  const lin = 10 + c.etapas.length + 1;
  const legenda = [
    ['concluida', SITUACOES_ETAPA.concluida.nome], ['andamento', SITUACOES_ETAPA.andamento.nome], ['risco', SITUACOES_ETAPA.risco.nome],
    ['atrasada', SITUACOES_ETAPA.atrasada.nome], ['futura', SITUACOES_ETAPA.futura.nome],
  ];
  ws.getCell(lin, 2).value = tr('Legenda');
  ws.getCell(lin, 2).font = { bold: true, size: 9, color: { argb: COR.grafite } };
  legenda.forEach(([k, nome], i) => {
    const r = lin + 1 + i;
    ws.getCell(r, 1).fill = fill(COR[k]);
    ws.getCell(r, 2).value = nome;
    ws.getCell(r, 2).font = { size: 9, color: { argb: COR.texto } };
  });
  const r2 = lin + 1 + legenda.length;
  ws.getCell(r2, 1).border = { bottom: { style: 'thick', color: { argb: COR.base } } };
  ws.getCell(r2, 2).value = tr('Linha de base (traço embaixo das semanas planejadas)');
  ws.getCell(r2 + 1, 1).border = { left: { style: 'medium', color: { argb: COR.hoje } } };
  ws.getCell(r2 + 1, 2).value = tr('Semana de hoje ({data})', { data: dataCurta(hoje()) });
  ws.getCell(r2 + 2, 1).value = '■';
  ws.getCell(r2 + 2, 2).value = tr('Parte já executada (pelo % concluído)');
  [r2, r2 + 1, r2 + 2].forEach((r) => { ws.getCell(r, 2).font = { size: 9, color: { argb: COR.texto } }; });
  ws.pageSetup.printTitlesRow = '8:9';
  ws.pageSetup.printArea = 'A1:' + letra(ultimaCol) + (r2 + 2);

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nomeSeguro(tr('Cronograma') + ' - ' + opcoes.nomeArquivo + ' - ' + hoje()) + '.xlsx';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  window.kbtUltimoExcel = { nome: a.download, etapas: c.etapas.length, semanas: semanas.length, tamanho: blob.size };
}
