/* KORbuild Daily — o relatório em si: a mesma peça serve para a tela, o PDF e o link do cliente. */

import { contratanteDe, donoDe } from './contatos.js';
import { tr, tn } from './i18n.js';
import { esc, dataCurta, diaDaSemana, horaCurta, dataHora, coordenadas, diasEntre } from './util.js';
import { estado } from './armazem.js';
import { enviadoComAtraso, prazoDe } from './prazos.js';

export const SITUACOES = { iniciada: tr('Iniciada'), andamento: tr('Em andamento'), concluida: tr('Concluída') };
export const STATUS_EQUIP = { operando: tr('Operando'), parado: tr('Parado'), manutencao: tr('Em manutenção') };
export const TIPOS_OCORRENCIA = {
  material: tr('Material / entrega'), chuva: tr('Chuva'), equipamento: tr('Equipamento'), seguranca: tr('Segurança / acidente'),
  equipe: tr('Equipe / faltas'), visita: tr('Visita / fiscalização'), projeto: tr('Projeto / interferência'), outro: tr('Outro'),
};
export const STATUS_RDO = {
  rascunho: tr('Rascunho'), enviado: tr('Aguardando aprovação'), ajustes: tr('Ajustes pedidos'), aprovado: tr('Aprovado'),
};

const ICONES_TEMPO = {
  sol: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg>',
  nublado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18z"/></svg>',
  chuva: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 14h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 5.6 4.2 4.2 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/></svg>',
};

export function iconeTempo(tempo) { return ICONES_TEMPO[tempo] || ''; }

export function seloStatus(r) {
  if (r.status === 'enviado' && r.sync !== 'enviado') return ('<span class="selo selo-alerta">' + tr('Guardado no aparelho') + '</span>');
  const classe = { rascunho: 'selo-neutro', enviado: 'selo-azul', ajustes: 'selo-alerta', aprovado: 'selo-verde' }[r.status];
  return '<span class="selo ' + classe + '">' + STATUS_RDO[r.status] + '</span>';
}

function turnoClima(nome, t) {
  if (!t || !t.tempo) return '<div class="rel-clima-turno"><b>' + nome + ('</b><span class="mudo">' + tr('Não informado') + '</span></div>');
  return '<div class="rel-clima-turno tempo-' + t.tempo + '">' + iconeTempo(t.tempo) +
    '<div><b>' + nome + '</b><span>' + ({ sol: tr('Sol'), nublado: tr('Nublado'), chuva: tr('Chuva') })[t.tempo] +
    (t.temperatura != null ? ' · ' + t.temperatura + (' ' + tr('°C')) : '') + '</span>' +
    '<span class="' + (t.praticavel ? 'ok' : 'nao') + '">' + (t.praticavel ? tr('Praticável') : tr('Impraticável')) + '</span></div></div>';
}

export function htmlRelatorio(r, obra, { verificado } = {}) {
  const totalPresentes = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  const totalFaltas = r.equipe.reduce((s, e) => s + Number(e.faltas || 0), 0);
  const decorridos = diasEntre(obra.inicio, r.data);
  const restantes = diasEntre(r.data, obra.prazo);
  const fonteClima = { automatico: tr('Clima automático pela localização da obra'), manual: tr('Clima informado no canteiro'), ajustado: tr('Clima automático, ajustado no canteiro') }[r.clima.fonte] || '';

  const empresa = estado().empresa;
  return '<article class="relatorio">' +
    '<header class="rel-topo">' +
      '<div class="rel-marca">' + (empresa.logo ? '<img class="rel-logo-img" src="' + empresa.logo + '" alt="' + esc(empresa.nome) + '">' : '<span class="rel-logo">' + esc(empresa.sigla) + '</span>') + '<div><b>' + esc(empresa.nome) + '</b><small>EIN ' + esc(empresa.ein) + '</small></div></div>' +
      ('<div class="rel-titulo"><h1>' + tr('Relatório Diário de Obra') + '</h1><p>' + tr('RDO nº') + ' ') + r.numero + ' · ' + diaDaSemana(r.data) + ', ' + dataCurta(r.data) + '</p></div>' +
      '<div class="rel-status">' + seloStatus(r) + '</div>' +
    '</header>' +

    '<section class="rel-obra">' +
      campo(tr('Obra'), obra.nome) + campo(tr('Contratante'), (contratanteDe(obra) || {}).nome || '—') + (obra.donoId && obra.donoId !== obra.contratanteId ? campo(tr('Dono da obra'), (donoDe(obra) || {}).nome || '') : '') + campo(tr('Endereço'), obra.endereco + ' · ' + obra.cidade) +
      campo(tr('Preenchido por'), r.autor + (' ' + tr('· Mestre de obras'))) + campo(tr('Etapa atual'), obra.etapa) +
      campo(tr('Prazo'), decorridos + (' ' + tr('dias decorridos ·') + ' ') + Math.max(0, restantes) + ' restantes') +
    '</section>' +
    (enviadoComAtraso(r)
      ? ('<p class="rel-atraso">' + tr('Enviado com atraso:') + ' ') + dataHora(r.primeiroEnvioEm || r.enviadoEm) + (' ' + tr('· prazo era') + ' ') + dataHora(prazoDe(r.data)) + '</p>'
      : '') +

    ('<section class="rel-bloco"><h2>' + tr('Condições climáticas') + '</h2>') +
      '<div class="rel-clima">' + turnoClima(tr('Manhã'), r.clima.manha) + turnoClima(tr('Tarde'), r.clima.tarde) + '</div>' +
      (fonteClima ? '<p class="rel-nota">' + fonteClima + '</p>' : '') +
    '</section>' +

    (r.semAtividade
      ? ('<section class="rel-bloco rel-sem-atividade"><h2>' + tr('Dia sem atividade') + '</h2>') +
          '<p><b>' + esc(r.semAtividade.motivo) + '</b></p>' +
          (r.semAtividade.obs ? '<p class="rel-texto">' + esc(r.semAtividade.obs) + '</p>' : '') +
          ('<p class="rel-nota">' + tr('Registrado no canteiro por') + ' ') + esc(r.autor) + (tr('. Não houve execução de serviços na obra neste dia.') + '</p></section>')
      : '' +
    '<div class="rel-duas">' +
    ('<section class="rel-bloco"><h2>' + tr('Mão de obra') + '</h2>') +
      (r.equipe.length ? ('<table class="rel-tabela"><thead><tr><th>' + tr('Função') + '</th><th class="num">' + tr('Presentes') + '</th><th class="num">' + tr('Faltas') + '</th></tr></thead><tbody>') +
        r.equipe.map((e) => '<tr><td>' + esc(e.funcao) + '</td><td class="num">' + Number(e.presentes) + '</td><td class="num">' + (Number(e.faltas) || '–') + '</td></tr>').join('') +
        ('</tbody><tfoot><tr><td>' + tr('Total') + '</td><td class="num">') + totalPresentes + '</td><td class="num">' + (totalFaltas || '–') + '</td></tr></tfoot></table>'
        : ('<p class="mudo">' + tr('Nenhuma equipe registrada.') + '</p>')) +
    '</section>' +

    ('<section class="rel-bloco"><h2>' + tr('Equipamentos') + '</h2>') +
      (r.equipamentos.length ? ('<table class="rel-tabela"><thead><tr><th>' + tr('Equipamento') + '</th><th class="num">' + tr('Qtd.') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>') +
        r.equipamentos.map((e) => '<tr><td>' + esc(e.nome) + '</td><td class="num">' + Number(e.qtd) + '</td><td><span class="eq-' + e.status + '">' + STATUS_EQUIP[e.status] + '</span></td></tr>').join('') +
        '</tbody></table>' : ('<p class="mudo">' + tr('Nenhum equipamento registrado.') + '</p>')) +
    '</section>' +
    '</div>' +

    ('<section class="rel-bloco"><h2>' + tr('Atividades executadas') + '</h2>') +
      (r.atividades.length ? '<ol class="rel-lista">' + r.atividades.map((a) =>
        '<li><p>' + esc(a.descricao) + '</p><small>' + (a.local ? esc(a.local) + ' · ' : '') + SITUACOES[a.situacao] + '</small></li>').join('') + '</ol>'
        : ('<p class="mudo">' + tr('Nenhuma atividade registrada.') + '</p>')) +
    '</section>' +

    ('<section class="rel-bloco"><h2>' + tr('Ocorrências') + '</h2>') +
      (r.ocorrencias.length ? '<ul class="rel-lista rel-ocorrencias">' + r.ocorrencias.map((o) =>
        '<li><b>' + TIPOS_OCORRENCIA[o.tipo] + '</b><p>' + esc(o.descricao) + '</p></li>').join('') + '</ul>'
        : ('<p class="mudo">' + tr('Sem ocorrências no dia.') + '</p>')) +
    '</section>' +

    (r.observacoes ? ('<section class="rel-bloco"><h2>' + tr('Observações') + '</h2><p class="rel-texto">') + esc(r.observacoes) + '</p></section>' : '') +

    ('<section class="rel-bloco rel-fotos-bloco"><h2>' + tr('Registro fotográfico') + ' <small>') + r.fotos.length + (r.fotos.length === 1 ? ' foto' : ' fotos') + '</small></h2>' +
      (r.fotos.length ? '<div class="rel-fotos">' + r.fotos.map((f, i) =>
        '<figure><img data-foto="' + esc(f.id) + ('" alt="' + tr('Foto') + ' ') + (i + 1) + ': ' + esc(f.legenda || tr('sem legenda')) + '" width="' + f.largura + '" height="' + f.altura + '">' +
        ('<figcaption><b>' + tr('Foto') + ' ') + (i + 1) + (f.legenda ? ' — ' + esc(f.legenda) : '') + '</b>' +
        '<span>' + dataHora(f.tiradaEm) + ' · ' + (f.fonteGps === 'gps' ? 'GPS ' : (tr('Local da obra') + ' ')) + coordenadas(f.lat, f.lon) + '</span>' +
        ('<span class="hash">' + tr('Impressão digital do original:') + ' ') + f.hashOriginal.slice(0, 16) + '…</span></figcaption></figure>').join('') + '</div>'
        : ('<p class="mudo">' + tr('Nenhuma foto anexada.') + '</p>')) +
    '</section>') +

    '<footer class="rel-rodape">' +
      (r.status === 'aprovado'
        ? '<div class="rel-lacre' + (verificado === false ? ' alterado' : '') + '">' +
            '<div class="rel-lacre-selo">' + (verificado === false ? '!' : '✓') + '</div>' +
            '<div><b>' + (verificado === false ? tr('Conteúdo diferente do aprovado') : tr('Aprovado e lacrado')) + '</b>' +
            ('<span>' + tr('Aprovado por') + ' ') + esc(r.aprovadoPor) + ' em ' + dataHora(r.aprovadoEm) + '</span>' +
            ('<span>' + tr('Código de verificação') + ' <b class="codigo">') + esc(r.codigo) + '</b></span>' +
            ('<span class="hash">' + tr('SHA-256') + ' ') + esc(r.hashDocumento) + '</span></div></div>'
        : ('<div class="rel-lacre pendente"><div class="rel-lacre-selo">…</div><div><b>' + tr('Ainda não aprovado') + '</b><span>' + tr('Este relatório pode mudar até ser aprovado pelo escritório.') + '</span></div></div>')) +
      '<div class="rel-assinaturas">' +
        '<div><span class="linha"></span><b>' + esc(r.autor) + ('</b><small>' + tr('Responsável pelo preenchimento · enviado') + ' ') + (r.enviadoEm ? (tr('às') + ' ') + horaCurta(r.enviadoEm) : '—') + '</small></div>' +
        '<div><span class="linha"></span><b>' + esc(r.aprovadoPor || tr('Engenheiro(a) responsável')) + ('</b><small>' + tr('Aprovação') + '</small></div>') +
      '</div>' +
      ('<p class="rel-gerado">' + tr('Gerado pelo KORbuild Daily · protótipo com dados fictícios') + '</p>') +
    '</footer>' +
  '</article>';
}

function campo(rotulo, valor) {
  return '<div><span>' + rotulo + '</span><b>' + esc(valor) + '</b></div>';
}
