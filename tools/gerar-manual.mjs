/* KORbuild — gera o manual do usuário em PDF, em português e em inglês, a partir de manual-usuario/fonte/<idioma>/*.md
 * e das capturas de manual-usuario/evidencias/<idioma>/ (tools/manual-capturas.mjs). No fim de cada manual entra o capítulo
 * "Evidências do teste": versão, data, o resultado de cada captura e o das rodadas dos fluxos (docs/testes/rodadas/).
 *
 * Uso: node tools/gerar-manual.mjs [--idioma=pt|en]
 * Saída: manual/KORbuild_Manual_do_Usuario_pt.pdf e manual/KORbuild_User_Manual_en.pdf (o app oferece o download no menu da conta, depois do login) */

import { chromium } from 'playwright';
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const RAIZ = new URL('../', import.meta.url).pathname;
const ARG = process.argv.find((a) => a.startsWith('--idioma='));
const IDIOMAS = ARG ? [ARG.slice(9)] : ['pt', 'en'];
const TMP = process.env.MANUAL_TMP || '/tmp/manual-html';
mkdirSync(TMP, { recursive: true });

const TXT = {
  pt: {
    arquivo: 'KORbuild_Manual_do_Usuario_pt.pdf', lang: 'pt-BR', titulo: 'Manual do usuário', sub: '1ª versão: Takeoff, Daily e Settings', toc: 'Conteúdo',
    versao: 'Versão do sistema', data: 'Gerado em', rodape: 'KORbuild · Manual do usuário',
    evTitulo: 'Evidências do teste', evIntro: 'Cada imagem deste manual foi capturada por um percurso automatizado, pelas telas do sistema, como uma pessoa faria. A captura só é gravada se a tela mostra o que o manual diz que ela mostra. A tabela abaixo é o registro dessa conferência.',
    evResumo: 'Resumo', evVersao: 'Versão', evCommit: 'Código (commit)', evData: 'Data do percurso', evAmb: 'Ambiente', evAmbValor: 'banco local com dados de exemplo (empresa Northfield Builders)', evTotal: 'Capturas conferidas',
    evTabela: 'Capturas', colN: '#', colTela: 'Tela', colCap: 'Arquivo', colRes: 'Resultado', ok: 'conferida', falha: 'FALHOU',
    evFluxos: 'Rodadas dos fluxos de teste', evFluxosIntro: 'Os fluxos de teste exercitam as mesmas áreas com verificações de banco de dados (o que a tela mostra e o que foi gravado). Última rodada de cada um:',
    colFluxo: 'Fluxo', colPassos: 'Passos', colVerif: 'Verificações', colQuando: 'Quando', colCommit: 'Commit',
    fluxos: { F01: 'Empresa nova: conta, perfis, funções, contatos, itens e assemblies', F02: 'Projeto do zero até "Liberar para obra"', F03: 'Obra: diário do campo, aprovação e % feito no Gantt', F05: 'Settings: usuários, perfis de acesso, empresa e isolamento' },
    nota: 'Os fluxos de concorrências e do Crew não fazem parte desta versão.', passos: 'passos', verif: 'verificações',
  },
  en: {
    arquivo: 'KORbuild_User_Manual_en.pdf', lang: 'en', titulo: 'User manual', sub: 'First version: Takeoff, Daily and Settings', toc: 'Contents',
    versao: 'System version', data: 'Generated on', rodape: 'KORbuild · User manual',
    evTitulo: 'Test evidence', evIntro: 'Every image in this manual was captured by an automated run through the system\'s screens, the way a person would use them. A capture is only saved if the screen shows what the manual says it shows. The table below is the record of that check.',
    evResumo: 'Summary', evVersao: 'Version', evCommit: 'Code (commit)', evData: 'Run date', evAmb: 'Environment', evAmbValor: 'local database with sample data (company Northfield Builders)', evTotal: 'Captures checked',
    evTabela: 'Captures', colN: '#', colTela: 'Screen', colCap: 'File', colRes: 'Result', ok: 'checked', falha: 'FAILED',
    evFluxos: 'Test flow runs', evFluxosIntro: 'The test flows exercise the same areas with database checks (what the screen shows and what was saved). Latest run of each:',
    colFluxo: 'Flow', colPassos: 'Steps', colVerif: 'Checks', colQuando: 'When', colCommit: 'Commit',
    fluxos: { F01: 'New company: account, roles, job roles, contacts, items and assemblies', F02: 'Project from scratch to "Release for construction"', F03: 'Job: field daily report, approval and % done on the Gantt', F05: 'Settings: users, access roles, company and isolation' },
    nota: 'The bids and Crew flows are not part of this version.', passos: 'steps', verif: 'checks',
  },
};

const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = (t) => esc(t).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
const slug = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function tamanhoPng(arq) { const b = readFileSync(arq); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }

/** Markdown do manual → HTML. Devolve { html, titulos: [{nivel, texto, id}], legendas: {chave: legenda} }. */
function converter(src, idioma, estado) {
  const linhas = src.replace(/\r/g, '').split('\n');
  const out = [];
  let i = 0;
  while (i < linhas.length) {
    const l = linhas[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = /^(#{1,3}) (.+)$/.exec(l))) {
      const nivel = m[1].length, texto = m[2].trim(), id = slug(texto) + '-' + (estado.n++);
      estado.titulos.push({ nivel, texto, id });
      out.push('<h' + nivel + ' id="' + id + '">' + inline(texto) + '</h' + nivel + '>'); i++; continue;
    }
    if (l.startsWith('>')) {
      const bl = []; while (i < linhas.length && linhas[i].startsWith('>')) { bl.push(linhas[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + inline(bl.join(' ')) + '</blockquote>'); continue;
    }
    if (l.startsWith('|')) {
      const tl = []; while (i < linhas.length && linhas[i].startsWith('|')) { tl.push(linhas[i]); i++; }
      const cel = (x) => x.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const cab = cel(tl[0]), corpo = tl.slice(2).map(cel);
      out.push('<table><thead><tr>' + cab.map((c) => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + corpo.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table>'); continue;
    }
    if ((m = /^!\[(.*)\]\(img:([a-z0-9-]+)\)\s*$/.exec(l))) {
      const [, legenda, chave] = m;
      const arq = path.join(RAIZ, 'manual-usuario/evidencias', idioma, chave + '.png');
      if (!existsSync(arq)) throw new Error('Falta a captura "' + chave + '" (' + arq + ')');
      const { w, h } = tamanhoPng(arq);
      estado.legendas[chave] = legenda; estado.usadas.add(chave);
      out.push('<figure class="' + (h > w * 1.3 ? 'celular' : 'tela') + '"><img src="file://' + arq + '" alt="' + esc(legenda) + '"><figcaption>' + inline(legenda) + '</figcaption></figure>'); i++; continue;
    }
    if (/^- /.test(l)) {
      const it = []; while (i < linhas.length && /^- /.test(linhas[i])) { it.push(linhas[i].slice(2)); i++; }
      out.push('<ul>' + it.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ul>'); continue;
    }
    if (/^\d+\. /.test(l)) {
      const it = []; while (i < linhas.length && /^\d+\. /.test(linhas[i])) { it.push(linhas[i].replace(/^\d+\. /, '')); i++; }
      out.push('<ol>' + it.map((x) => '<li>' + inline(x) + '</li>').join('') + '</ol>'); continue;
    }
    const par = []; while (i < linhas.length && linhas[i].trim() && !/^(#{1,3} |>|\||- |\d+\. |!\[)/.test(linhas[i])) { par.push(linhas[i]); i++; }
    out.push('<p>' + inline(par.join(' ')) + '</p>');
  }
  return out.join('\n');
}

function ultimaRodada(id) {
  const dir = path.join(RAIZ, 'docs/testes/rodadas');
  const arqs = readdirSync(dir).filter((f) => f.endsWith('_' + id + '.md')).sort();
  if (!arqs.length) return null;
  const t = readFileSync(path.join(dir, arqs[arqs.length - 1]), 'utf8');
  const g = (re) => (re.exec(t) || [])[1] || '';
  const r = /Resultado: (\d+) de (\d+) passos ok · (\d+) de (\d+) verificações · (\d+) falharam · (\d+) bloqueados/.exec(t) || [];
  return { id, data: g(/- Data: (.+)/), commit: g(/- Commit: (\S+)/), passosOk: r[1], passos: r[2], verifOk: r[3], verif: r[4], falhas: r[5], bloqueados: r[6] };
}

const CSS = `
@page { size: A4; margin: 20mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font: 10.5pt/1.5 -apple-system, "Segoe UI", "Helvetica Neue", Arial, "Liberation Sans", sans-serif; color: #1c2430; margin: 0; }
h1 { font-size: 22pt; margin: 0 0 6mm; padding-bottom: 3mm; border-bottom: 3px solid #c2410c; page-break-before: always; break-after: avoid; }
h2 { font-size: 14.5pt; margin: 9mm 0 3mm; color: #111827; break-after: avoid; }
h3 { font-size: 11.5pt; margin: 6mm 0 2mm; color: #374151; break-after: avoid; }
p { margin: 0 0 3mm; } ul, ol { margin: 0 0 3mm; padding-left: 6mm; } li { margin: 0 0 1.2mm; }
code { font: 9.5pt/1 "SF Mono", Menlo, Consolas, "Liberation Mono", monospace; background: #f1f3f6; padding: .3mm 1.2mm; border-radius: 1mm; }
blockquote { margin: 3mm 0; padding: 2.5mm 4mm; background: #fff7ed; border-left: 3px solid #c2410c; border-radius: 0 2mm 2mm 0; break-inside: avoid; }
table { width: 100%; border-collapse: collapse; margin: 3mm 0 5mm; font-size: 9.5pt; break-inside: auto; }
th { text-align: left; background: #f3f4f6; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .03em; color: #4b5563; }
th, td { padding: 1.8mm 2.4mm; border-bottom: 1px solid #e5e7eb; vertical-align: top; } tr { break-inside: avoid; }
figure { margin: 3mm 0 4mm; text-align: center; break-inside: avoid; }
figure img { border: 1px solid #d1d5db; border-radius: 2mm; box-shadow: 0 1mm 3mm rgba(0,0,0,.12); }
figure.tela img { width: 84%; } figure.celular img { height: 100mm; width: auto; }
figcaption { margin-top: 1.8mm; font-size: 8.8pt; color: #6b7280; font-style: italic; }
.capa { page-break-after: always; display: flex; flex-direction: column; justify-content: center; height: 245mm; }
.capa .marca { font-size: 15pt; letter-spacing: .08em; color: #c2410c; font-weight: 700; }
.capa h1 { all: unset; display: block; font-size: 36pt; font-weight: 800; margin: 6mm 0 3mm; color: #111827; }
.capa .sub { font-size: 15pt; color: #4b5563; margin-bottom: 18mm; }
.capa .meta { font-size: 10pt; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 4mm; }
.toc h1 { page-break-before: auto; } .toc ol { list-style: none; padding: 0; columns: 2; column-gap: 9mm; } .toc li { padding: 1.6mm 0; border-bottom: 1px dotted #d1d5db; font-size: 11pt; }
.toc li.n2 { padding-left: 7mm; font-size: 10pt; color: #4b5563; border-bottom: 0; padding-top: .6mm; padding-bottom: .6mm; }
.ok { color: #047857; font-weight: 600; } .falha { color: #b91c1c; font-weight: 700; }
.resumo td:first-child { width: 42mm; color: #6b7280; }
`;

async function gerar(idioma) {
  const T = TXT[idioma];
  const dirFonte = path.join(RAIZ, 'manual-usuario/fonte', idioma);
  const arqs = readdirSync(dirFonte).filter((f) => f.endsWith('.md')).sort();
  const estado = { n: 0, titulos: [], legendas: {}, usadas: new Set() };
  const capitulos = arqs.map((f) => converter(readFileSync(path.join(dirFonte, f), 'utf8'), idioma, estado));
  const manifesto = JSON.parse(readFileSync(path.join(RAIZ, 'manual-usuario/evidencias', idioma, 'manifesto.json'), 'utf8'));
  const caps = manifesto.capturas.filter((c) => !c.chave.startsWith('('));
  const falhas = manifesto.capturas.filter((c) => !c.ok);
  const naoUsadas = caps.map((c) => c.chave).filter((k) => !estado.usadas.has(k));
  if (naoUsadas.length) console.log('  aviso (' + idioma + '): capturas que o texto não usa: ' + naoUsadas.join(', '));
  const quando = (iso) => iso.slice(0, 16).replace('T', ' ');

  const linhasCap = caps.map((c, n) => '<tr><td>' + (n + 1) + '</td><td>' + esc(estado.legendas[c.chave] || c.titulo) + '</td><td><code>' + esc(c.chave) + '.png</code></td><td class="' + (c.ok ? 'ok' : 'falha') + '">' + (c.ok ? '✓ ' + T.ok : '✗ ' + T.falha + (c.motivo ? ' · ' + esc(c.motivo) : '')) + '</td></tr>').join('');
  const rod = ['F01', 'F02', 'F03', 'F05'].map(ultimaRodada).filter(Boolean);
  const linhasFlux = rod.map((r) => '<tr><td><b>' + r.id + '</b> · ' + esc(T.fluxos[r.id]) + '</td><td>' + r.passosOk + '/' + r.passos + '</td><td class="' + (Number(r.falhas) || Number(r.bloqueados) ? 'falha' : 'ok') + '">' + r.verifOk + '/' + r.verif + '</td><td>' + esc(r.data) + '</td><td><code>' + esc(r.commit) + '</code></td></tr>').join('');
  const evid = '<h1 id="evidencias">' + T.evTitulo + '</h1><p>' + T.evIntro + '</p>' +
    '<h2>' + T.evResumo + '</h2><table class="resumo"><tbody>' +
      '<tr><td>' + T.evVersao + '</td><td>' + esc(manifesto.versao) + '</td></tr><tr><td>' + T.evCommit + '</td><td><code>' + esc(manifesto.commit) + '</code></td></tr>' +
      '<tr><td>' + T.evData + '</td><td>' + esc(quando(manifesto.geradoEm)) + ' UTC</td></tr><tr><td>' + T.evAmb + '</td><td>' + T.evAmbValor + '</td></tr>' +
      '<tr><td>' + T.evTotal + '</td><td class="' + (falhas.length ? 'falha' : 'ok') + '">' + (caps.length - falhas.filter((c) => !c.chave.startsWith('(')).length) + ' / ' + caps.length + (falhas.length ? ' · ' + falhas.length + ' ✗' : ' ✓') + '</td></tr></tbody></table>' +
    '<h2>' + T.evTabela + '</h2><table><thead><tr><th>' + T.colN + '</th><th>' + T.colTela + '</th><th>' + T.colCap + '</th><th>' + T.colRes + '</th></tr></thead><tbody>' + linhasCap + '</tbody></table>' +
    '<h2>' + T.evFluxos + '</h2><p>' + T.evFluxosIntro + '</p><table><thead><tr><th>' + T.colFluxo + '</th><th>' + T.colPassos + '</th><th>' + T.colVerif + '</th><th>' + T.colQuando + '</th><th>' + T.colCommit + '</th></tr></thead><tbody>' + linhasFlux + '</tbody></table><p>' + T.nota + '</p>';

  const toc = '<div class="toc"><h1>' + T.toc + '</h1><ol>' + estado.titulos.filter((x) => x.nivel <= 2).map((x) => '<li class="n' + x.nivel + '"><a style="color:inherit;text-decoration:none" href="#' + x.id + '">' + esc(x.texto) + '</a></li>').join('') + '<li class="n1"><a style="color:inherit;text-decoration:none" href="#evidencias">' + T.evTitulo + '</a></li></ol></div>';
  const capa = '<section class="capa"><div class="marca">KORbuild</div><h1>' + T.titulo + '</h1><div class="sub">' + T.sub + '</div><div class="meta">' + T.versao + ': ' + esc(manifesto.versao) + ' · ' + T.data + ' ' + esc(quando(new Date().toISOString())) + ' UTC</div></section>';
  const html = '<!doctype html><html lang="' + T.lang + '"><head><meta charset="utf-8"><title>KORbuild · ' + T.titulo + '</title><style>' + CSS + '</style></head><body>' + capa + toc + capitulos.join('\n') + evid + '</body></html>';
  const arqHtml = path.join(TMP, 'manual-' + idioma + '.html');
  writeFileSync(arqHtml, html);

  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const pagina = await browser.newPage();
  await pagina.goto('file://' + arqHtml);
  await pagina.waitForFunction(() => [...document.images].every((im) => im.complete), null, { timeout: 60000 });
  const saida = path.join(RAIZ, 'manual', T.arquivo);   // é daqui que o app serve o download (menu da conta)
  await pagina.pdf({ path: saida, format: 'A4', printBackground: true, outline: true, tagged: true, displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;color:#9ca3af;width:100%;text-align:center;font-family:Arial,sans-serif">' + T.rodape + ' · <span class="pageNumber"></span>/<span class="totalPages"></span></div>', margin: { top: '20mm', bottom: '20mm', left: '17mm', right: '17mm' } });
  await browser.close();
  console.log(idioma + ': ' + saida + ' (' + arqs.length + ' capítulos, ' + caps.length + ' capturas, ' + estado.usadas.size + ' no texto)');
}

for (const idioma of IDIOMAS) await gerar(idioma);
