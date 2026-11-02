/* KORbuild — corredor dos testes por fluxo (docs/testes/fluxos/README.md).
 * O roteiro em Markdown é a fonte única: a tabela de passos (# | Quem | Onde | O que faz | Esperado) dá o título de cada passo do teste.
 * O teste chama passo(n, fn) com o número do roteiro; dentro, verificar(cond, texto) conta cada checagem.
 * O que o corredor garante:
 *   - passo que falha derruba os seguintes (ficam "bloqueado"), a não ser que o passo seja { critico: false };
 *   - passo do roteiro sem teste aparece como "sem teste", e passo do teste que não existe no roteiro é erro;
 *   - o resultado sai numa tabela por passo e, com --relatorio, num arquivo em docs/testes/rodadas/ (o registro da rodada).
 * Uso:
 *   const fluxo = criarFluxo({ id: 'F02', modo: 'real (banco local)', roteiro: 'docs/testes/fluxos/F02-….md' });
 *   await fluxo.passo(3, async () => { fluxo.verificar(cond, 'texto'); });
 *   process.exit(await fluxo.fim());
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pad = (n) => String(n).padStart(2, '0');
const curto = (v, n = 300) => { const t = typeof v === 'string' ? v : JSON.stringify(v); return String(t === undefined ? '' : t).replace(/\s+/g, ' ').slice(0, n); };
const celula = (t) => String(t || '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function lerRoteiro(caminho) {
  const md = readFileSync(path.resolve(RAIZ, caminho), 'utf8');
  const passos = new Map();
  for (const linha of md.split(/\r?\n/)) {
    const m = linha.match(/^\|\s*(\d+)\s*\|(.+)\|\s*$/);
    if (!m) continue;
    const c = m[2].split('|').map((s) => s.trim());
    passos.set(Number(m[1]), { quem: c[0] || '', onde: c[1] || '', faz: c[2] || '', esperado: c.slice(3).join(' | ') });
  }
  const titulo = (md.match(/^#\s+(.+)$/m) || [])[1] || caminho;
  return { passos, titulo };
}

export function criarFluxo({ id, modo, roteiro, ambiente = '' }) {
  const { passos: doRoteiro, titulo } = lerRoteiro(roteiro);
  const argumento = process.argv.find((a) => a === '--relatorio' || a.startsWith('--relatorio='));
  const resultados = new Map();   // número → { estado, checks, oks, falhas[], ms, tela }
  let atual = null, bloqueado = false, pagina = null;
  const inicio = Date.now();

  const f = {
    /** A página em uso, para a foto e o texto da tela quando um passo falha. */
    pagina(p) { pagina = p; },
    verificar(cond, texto, detalhe) {
      if (!atual) throw new Error('verificar() fora de um passo: ' + texto);
      atual.checks++;
      if (cond) { atual.oks++; console.log('      ok  ' + texto); }
      else { atual.falhas.push(texto + (detalhe !== undefined ? ' · encontrado: ' + curto(detalhe) : '')); console.log('      FALHA ' + texto + (detalhe !== undefined ? '\n        encontrado: ' + curto(detalhe) : '')); }
    },
    async passo(n, fn, { critico = true } = {}) {
      const def = doRoteiro.get(n);
      if (!def) throw new Error('O passo ' + n + ' não existe no roteiro ' + roteiro);
      if (resultados.has(n)) throw new Error('O passo ' + n + ' foi chamado duas vezes');
      const r = { estado: 'ok', checks: 0, oks: 0, falhas: [], ms: 0, tela: '' };
      resultados.set(n, r);
      console.log('\n  Passo ' + n + ' · ' + def.quem + ' · ' + def.onde + '\n    ' + def.faz);
      if (bloqueado) { r.estado = 'bloqueado'; console.log('    (bloqueado: um passo anterior falhou)'); return; }
      atual = r;
      const t0 = Date.now();
      try { await fn(def); }
      catch (e) { r.falhas.push('exceção: ' + curto(String((e && e.message) || e).split('\n')[0], 400)); console.log('      EXCEÇÃO ' + curto((e && e.message) || e, 400)); }
      r.ms = Date.now() - t0;
      atual = null;
      if (r.falhas.length || r.checks === 0) {
        if (!r.falhas.length) r.falhas.push('o passo não fez nenhuma verificação');
        r.estado = 'FALHOU';
        if (pagina) {
          try {
            r.tela = curto(await pagina.locator('body').innerText(), 280);
            const dir = path.join(RAIZ, '.testes', 'fluxos'); mkdirSync(dir, { recursive: true });
            await pagina.screenshot({ path: path.join(dir, id + '_passo' + n + '.png') });
          } catch { /* a página pode ter fechado */ }
        }
        if (critico) bloqueado = true;
      }
    },
    /** Imprime a tabela, grava o relatório (com --relatorio) e devolve o código de saída. */
    async fim() {
      const fora = [...resultados.keys()].filter((n) => !doRoteiro.has(n));
      const semTeste = [...doRoteiro.keys()].filter((n) => !resultados.has(n));
      for (const n of semTeste) resultados.set(n, { estado: 'sem teste', checks: 0, oks: 0, falhas: [], ms: 0, tela: '' });
      const ordem = [...doRoteiro.keys()].sort((a, b) => a - b);
      const total = [...resultados.values()].reduce((s, r) => s + r.checks, 0), certas = [...resultados.values()].reduce((s, r) => s + r.oks, 0);
      const contagem = (e) => ordem.filter((n) => resultados.get(n).estado === e).length;
      const commit = (() => { try { return execFileSync('git', ['-C', RAIZ, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { return '?'; } })();
      const cache = (() => { try { return (readFileSync(path.join(RAIZ, 'sw.js'), 'utf8').match(/CACHE\s*=\s*'([^']+)'/) || [])[1] || ''; } catch { return ''; } })();
      const agora = new Date();
      const data = agora.getFullYear() + '-' + pad(agora.getMonth() + 1) + '-' + pad(agora.getDate()) + ' ' + pad(agora.getHours()) + ':' + pad(agora.getMinutes());

      console.log('\n  ' + titulo + ' · ' + modo);
      for (const n of ordem) { const r = resultados.get(n), d = doRoteiro.get(n); console.log('   ' + String(n).padStart(2) + '  ' + r.estado.padEnd(10) + ' ' + (r.checks ? r.oks + '/' + r.checks : '—').padEnd(6) + ' ' + curto(d.faz, 80)); }
      if (fora.length) console.log('  ERRO: passos do teste que não estão no roteiro: ' + fora.join(', '));

      const linhas = ['# Rodada ' + id + ' · ' + titulo.replace(/^F\d+\s*·\s*/, ''), '',
        '- Data: ' + data, '- Commit: ' + commit + (cache ? ' · cache ' + cache : ''), '- Modo: ' + modo, ambiente ? '- Ambiente: ' + ambiente : null, '- Roteiro: `' + roteiro + '`',
        '- Resultado: ' + contagem('ok') + ' de ' + ordem.length + ' passos ok · ' + certas + ' de ' + total + ' verificações · ' + contagem('FALHOU') + ' falharam · ' + contagem('bloqueado') + ' bloqueados · ' + contagem('sem teste') + ' sem teste · ' + Math.round((Date.now() - inicio) / 1000) + ' s',
        '', '| # | Quem | O que faz | Resultado | Verificações | Tempo |', '|---|---|---|---|---|---|']
        .filter((x) => x !== null);
      for (const n of ordem) { const r = resultados.get(n), d = doRoteiro.get(n); linhas.push('| ' + n + ' | ' + celula(d.quem) + ' | ' + celula(curto(d.faz, 110)) + ' | ' + r.estado + ' | ' + (r.checks ? r.oks + '/' + r.checks : '—') + ' | ' + (r.ms ? (r.ms / 1000).toFixed(1) + ' s' : '—') + ' |'); }
      const falhos = ordem.filter((n) => resultados.get(n).estado === 'FALHOU');
      if (falhos.length) {
        linhas.push('', '## Falhas', '');
        for (const n of falhos) { const r = resultados.get(n), d = doRoteiro.get(n); linhas.push('### Passo ' + n + ' · ' + d.faz, '', '- Esperado: ' + d.esperado); for (const x of r.falhas) linhas.push('- Falhou: ' + x); if (r.tela) linhas.push('- Tela: ' + r.tela); linhas.push(''); }
      }
      if (semTeste.length) linhas.push('', '## Passos do roteiro sem teste', '', ...semTeste.map((n) => '- Passo ' + n + ': ' + doRoteiro.get(n).faz));
      if (argumento) {
        const dest = argumento.includes('=') ? argumento.split('=')[1] : path.join('docs', 'testes', 'rodadas', data.replace(' ', '_').replace(':', '-') + '_' + id + '.md');
        mkdirSync(path.dirname(path.resolve(RAIZ, dest)), { recursive: true });
        writeFileSync(path.resolve(RAIZ, dest), linhas.join('\n') + '\n');
        console.log('  Relatório: ' + dest);
      }
      console.log('\n' + id + ': ' + certas + '/' + total + ' verificações passaram · ' + contagem('ok') + '/' + ordem.length + ' passos' + (falhos.length ? ' · FALHOU: ' + falhos.join(', ') : '') + (semTeste.length ? ' · sem teste: ' + semTeste.join(', ') : ''));
      return falhos.length || fora.length || contagem('bloqueado') || semTeste.length ? 1 : 0;
    },
  };
  return f;
}
