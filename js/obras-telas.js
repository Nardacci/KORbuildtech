/* KORbuild — telas do cadastro de obras e dos modelos de etapas (docs/obras.md).
 * Ficam em Settings › Obras; a lista de obras do Daily e o projeto ganho do Measure levam até aqui. */

import { esc, dataCurta, decimal, toast, confirmar } from './util.js';
import { tr, tn } from './i18n.js';
import { estado } from './armazem.js';
import { usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { htmlEscolhaContato } from './contatos-telas.js';
import { nomeContato } from './contatos.js';
import { NOMES_DIAS } from './prazos.js';
import { cronogramaDe, avancoDaObra } from './cronograma.js';
import { carregarLeaflet } from './crew-telas.js';
import {
  obras, situacaoDaObra, SITUACOES_OBRA, salvarObra, obraEmBranco, projetoDaObra, RAIO_MIN, RAIO_MAX,
  modelos, modelo, salvarModelo, excluirModelo, distribuir,
} from './obras.js';

let app = { desenhar: () => {}, ir: () => {} };
export function ligarObras(funcoes) { app = { ...app, ...funcoes }; }

const quem = () => (usuarioAtual() || {}).nome;
const campo = (id, rotulo, html, classe) => '<div class="campo' + (classe ? ' ' + classe : '') + '"><label class="rotulo-pequeno" for="' + id + '">' + rotulo + '</label>' + html + '</div>';
const texto = (nome, rotulo, valor, extra) => campo('ob-' + nome, rotulo, '<input type="text" id="ob-' + nome + '" name="' + nome + '" value="' + esc(valor == null ? '' : valor) + '"' + (extra || '') + '>');
const etiquetaSituacao = (o) => { const s = SITUACOES_OBRA[situacaoDaObra(o)]; return '<span class="etiqueta ' + s.classe + '">' + s.nome + '</span>'; };
const nomeUsuario = (id) => (estado().usuarios.find((u) => u.id === id) || {}).nome || '—';
// NH: o centro do mapa quando a obra ainda não tem local
const CENTRO_PADRAO = { lat: 43.0, lon: -71.46 };

/* ---------- Lista ---------- */

export function telaObras(moldura, filtro) {
  const todas = obras().slice().sort((a, b) => a.nome.localeCompare(b.nome));
  const lista = todas.filter((o) => !filtro || situacaoDaObra(o) === filtro);
  const abas = [['', tr('Todas'), todas.length]].concat(Object.entries(SITUACOES_OBRA).map(([id, s]) => [id, s.nome, todas.filter((o) => situacaoDaObra(o) === id).length]));
  return moldura({
    ativo: 'obras', titulo: tr('Obras'), subtitulo: tr('Um cadastro só para a empresa: usado pelo Daily, pelo Crew e pelo Measure'),
    acoes: '<a class="btn btn-contorno btn-pequeno" href="#/settings/modelos">' + icone('tabela', 16) + tr('Modelos de etapas') + '</a>' +
      '<a class="btn btn-primario btn-pequeno" href="#/settings/obra/nova">' + icone('mais', 16) + tr('Nova obra') + '</a>',
    conteudo: '<nav class="abas-segmento" aria-label="' + tr('Filtro') + '">' + abas.map(([id, r, n]) => '<a href="#/settings/obras' + (id ? '/' + id : '') + '"' + ((filtro || '') === id ? ' class="ativa" aria-current="page"' : '') + '>' + r + ' <span class="mz-contagem">' + n + '</span></a>').join('') + '</nav>' +
      (lista.length ? '<section class="cartao"><div class="tabela-rolagem"><table class="tabela tabela-obras"><thead><tr><th>' + tr('Obra') + '</th><th>' + tr('Contratante') + '</th><th>' + tr('Período') + '</th><th>' + tr('Responsável pelo diário') + '</th><th>' + tr('Cronograma') + '</th><th>' + tr('Situação') + '</th></tr></thead><tbody>' +
        lista.map((o) => {
          const c = cronogramaDe(o.id);
          const n = c ? c.etapas.length : 0;
          return '<tr><td><a href="#/settings/obra/' + o.id + '"><b>' + esc(o.nome) + '</b></a><span class="mudo pequeno bloco">' + esc(o.cidade || '') + '</span></td>' +
            '<td>' + esc(nomeContato(o.contratanteId) || '—') + '</td>' +
            '<td class="pequeno">' + (o.inicio ? dataCurta(o.inicio) + ' → ' + dataCurta(o.prazo) : '—') + '</td>' +
            '<td>' + esc(nomeUsuario(o.responsavelId)) + '</td>' +
            '<td class="pequeno">' + (n ? '<a href="#/daily/obras/' + o.id + '/cronograma">' + tn(n, '{n} etapa', '{n} etapas') + ' · ' + Math.round(avancoDaObra(c).real) + '%</a>' : '<a href="#/daily/obras/' + o.id + '/cronograma" class="mudo">' + tr('Sem etapas') + '</a>') + '</td>' +
            '<td>' + etiquetaSituacao(o) + '</td></tr>';
        }).join('') + '</tbody></table></div></section>'
        : '<p class="vazio">' + tr('Nenhuma obra aqui.') + '</p>'),
  });
}

/* ---------- Formulário ---------- */

export function telaFormObra(moldura, id, projetoId) {
  const existente = id ? obras().find((o) => o.id === id) : null;
  if (id && !existente) return moldura({ ativo: 'obras', titulo: tr('Obra não encontrada'), voltar: { href: '#/settings/obras', rotulo: tr('Obras') }, conteudo: '' });
  const pj = projetoId ? ((estado().measure || {}).projetos || []).find((p) => p.id === projetoId) : null;
  const o = existente || obraEmBranco(pj);
  const lat = o.cerca && o.cerca.lat != null ? o.cerca.lat : o.lat;
  const lon = o.cerca && o.cerca.lon != null ? o.cerca.lon : o.lon;
  const raio = (o.cerca && o.cerca.raio) || 150;
  const responsaveis = estado().usuarios.filter((u) => u.ativo !== false && pode(u, 'daily.preencher'));
  const dias = o.diasTrabalho || [];
  const projeto = existente ? projetoDaObra(existente) : pj;
  const voltar = existente && pode(usuarioAtual(), 'daily.acompanhar') ? { href: '#/daily/obras/' + id, rotulo: existente.nome } : { href: '#/settings/obras', rotulo: tr('Obras') };
  const centro = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : CENTRO_PADRAO;
  return moldura({
    ativo: 'obras', titulo: existente ? existente.nome : tr('Nova obra'), subtitulo: pj ? tr('A partir do projeto {nome} (Measure)', { nome: pj.nome }) : '', voltar,
    conteudo: '<form id="form-obra" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false">' +
      '<input type="hidden" name="projetoId" value="' + esc((pj && pj.id) || '') + '">' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Obra') + '</h2><div class="grade-campos">' +
        texto('nome', tr('Nome da obra *'), o.nome, ' placeholder="' + esc(tr('Ex.: Residencial Thompson, Mezanino LogSul')) + '"') +
        campo('ob-situacao', tr('Situação'), '<select id="ob-situacao" name="situacao">' + Object.entries(SITUACOES_OBRA).map(([k, s]) => '<option value="' + k + '"' + (situacaoDaObra(o) === k ? ' selected' : '') + '>' + s.nome + '</option>').join('') + '</select>') + '</div>' +
        '<p class="mudo pequeno">' + tr('Só obra em andamento cobra o diário e aparece no celular do campo e no ponto. Paralisada e concluída ficam no escritório, com o histórico.') + '</p>' +
        (projeto ? '<p class="pequeno">' + tr('Projeto no Measure:') + ' <a href="#/measure/projeto/' + projeto.id + '">' + esc(projeto.nome) + '</a></p>' : '') +
      '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Partes') + '</h2><div class="grade-campos">' +
        htmlEscolhaContato({ id: 'ob-contratanteId', nome: 'contratanteId', rotulo: tr('Contratante * (recebe o diário)'), papeis: ['construtora', 'cliente'], atual: o.contratanteId }) +
        htmlEscolhaContato({ id: 'ob-donoId', nome: 'donoId', rotulo: tr('Dono da obra (se for outro)'), papeis: ['cliente', 'construtora'], atual: o.donoId, vazio: tr('O próprio contratante') }) + '</div>' +
      '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Local e cerca do ponto') + '</h2>' +
        texto('endereco', tr('Endereço'), o.endereco) +
        '<div class="grade-campos mz-grade-local">' + texto('municipio', tr('Cidade *'), o.municipio) + texto('estado', tr('Estado *'), o.estado, ' maxlength="2"') + texto('zip', tr('ZIP code'), o.zip, ' maxlength="10"') + '</div>' +
        '<p class="mudo pequeno">' + tr('Clique no mapa onde fica a obra (ou use a localização atual, se estiver no canteiro). O círculo é a cerca: batida de ponto fora dela fica marcada para o escritório conferir. O mesmo local dá o clima do diário.') + '</p>' +
        '<div id="mapa-obra" class="mapa-obra" data-lat="' + centro.lat + '" data-lon="' + centro.lon + '" data-tem="' + (Number.isFinite(lat) ? '1' : '') + '"><span class="mudo pequeno">' + tr('Carregando o mapa…') + '</span></div>' +
        '<div class="grade-campos mapa-obra-campos">' +
          campo('ob-lat', tr('Latitude *'), '<input type="text" inputmode="decimal" id="ob-lat" name="lat" value="' + (Number.isFinite(lat) ? lat : '') + '">') +
          campo('ob-lon', tr('Longitude *'), '<input type="text" inputmode="decimal" id="ob-lon" name="lon" value="' + (Number.isFinite(lon) ? lon : '') + '">') +
          campo('ob-raio', tr('Raio da cerca (m)'), '<input type="number" id="ob-raio" name="raio" min="' + RAIO_MIN + '" max="' + RAIO_MAX + '" step="10" value="' + raio + '">') +
        '</div>' +
        '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="obra-aqui">' + icone('pino', 16) + tr('Usar a localização atual') + '</button>' +
      '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">' + tr('Prazo e diário de obra') + '</h2><div class="grade-campos">' +
        campo('ob-inicio', tr('Início *'), '<input type="date" id="ob-inicio" name="inicio" value="' + esc(o.inicio || '') + '">') +
        campo('ob-prazo', tr('Prazo (término) *'), '<input type="date" id="ob-prazo" name="prazo" value="' + esc(o.prazo || '') + '">') +
        campo('ob-responsavelId', tr('Quem preenche o diário *'), '<select id="ob-responsavelId" name="responsavelId"><option value="">' + tr('Escolha…') + '</option>' +
          responsaveis.map((u) => '<option value="' + u.id + '"' + (u.id === o.responsavelId ? ' selected' : '') + '>' + esc(u.nome) + (u.cargo ? ' · ' + esc(u.cargo) : '') + '</option>').join('') + '</select>') + '</div>' +
        '<fieldset class="dias-obra"><legend class="rotulo-pequeno">' + tr('Dias de trabalho * (cobram o diário)') + '</legend>' +
          [1, 2, 3, 4, 5, 6, 0].map((dia) => '<label class="check pequeno"><input type="checkbox" name="diasTrabalho" value="' + dia + '"' + (dias.includes(dia) ? ' checked' : '') + '> ' + NOMES_DIAS[dia] + '</label>').join('') + '</fieldset>' +
      '</section>' +
      (existente ? '' : '<section class="cartao"><h2 class="cartao-titulo">' + tr('Cronograma') + '</h2>' +
        campo('ob-modeloId', tr('Começar com um modelo de etapas'), '<select id="ob-modeloId" name="modeloId"><option value="">' + tr('Nenhum: monto depois') + '</option>' +
          modelos().map((m, i) => '<option value="' + m.id + '"' + (i === 0 ? ' selected' : '') + '>' + esc(m.nome) + ' · ' + tn(m.etapas.length, '{n} etapa', '{n} etapas') + '</option>').join('') + '</select>') +
        '<div id="ob-previa" class="previa-modelo"></div>' +
        '<p class="mudo pequeno">' + tr('As etapas dividem o período entre o início e o prazo, na proporção do modelo. Depois tudo se ajusta no cronograma.') + ' <a href="#/settings/modelos">' + tr('Ver os modelos') + '</a></p>' +
      '</section>') +
      '<div class="rodape-form"><a class="btn btn-contorno" href="' + voltar.href + '">' + tr('Cancelar') + '</a>' +
        '<button type="button" class="btn btn-primario" data-acao="obra-salvar">' + (existente ? tr('Salvar') : tr('Criar obra')) + '</button></div>' +
    '</form>',
  });
}

/* Prévia das etapas do modelo escolhido, com as datas que vão sair. */
function atualizarPrevia() {
  const area = document.getElementById('ob-previa');
  if (!area) return;
  const m = modelo((document.getElementById('ob-modeloId') || {}).value);
  const ini = (document.getElementById('ob-inicio') || {}).value;
  const fim = (document.getElementById('ob-prazo') || {}).value;
  if (!m || !ini || !fim || fim < ini) { area.innerHTML = ''; return; }
  area.innerHTML = '<ol class="lista-previa">' + distribuir(m.etapas, ini, fim).map((e) => '<li><b>' + esc(e.nome) + '</b><span class="mudo">' + dataCurta(e.inicio) + ' → ' + dataCurta(e.fim) + '</span></li>').join('') + '</ol>';
}

/* Mapa do formulário: clique marca o local; o círculo mostra a cerca. */
let mapaObra = null;
export async function aposDesenharObras() {
  atualizarPrevia();
  const area = document.getElementById('mapa-obra');
  if (!area || area.dataset.montado) return;
  area.dataset.montado = '1';
  let L;
  try { L = await carregarLeaflet(); } catch (e) { area.innerHTML = '<span class="mudo pequeno">' + tr('Mapa indisponível: digite a latitude e a longitude.') + '</span>'; return; }
  if (!document.body.contains(area)) return;
  area.innerHTML = '';
  const lat0 = Number(area.dataset.lat), lon0 = Number(area.dataset.lon);
  const m = L.map(area, { scrollWheelZoom: false }).setView([lat0, lon0], area.dataset.tem ? 16 : 8);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  let pino = null, cerca = null;
  const raio = () => Number((document.getElementById('ob-raio') || {}).value) || 150;
  const marcar = (lat, lon, mover) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    if (!pino) { pino = L.marker([lat, lon]).addTo(m); cerca = L.circle([lat, lon], { radius: raio(), color: '#0F766E', weight: 2, dashArray: '6 5', fillColor: '#0F766E', fillOpacity: 0.12 }).addTo(m); }
    pino.setLatLng([lat, lon]); cerca.setLatLng([lat, lon]); cerca.setRadius(raio());
    if (mover) m.setView([lat, lon], Math.max(m.getZoom(), 16));
  };
  if (area.dataset.tem) marcar(lat0, lon0);
  m.on('click', (ev) => {
    const lat = Math.round(ev.latlng.lat * 1e6) / 1e6, lon = Math.round(ev.latlng.lng * 1e6) / 1e6;
    document.getElementById('ob-lat').value = lat;
    document.getElementById('ob-lon').value = lon;
    marcar(lat, lon);
  });
  mapaObra = { marcar };
}
// campos digitados e raio refletem no mapa; datas e modelo, na prévia
document.addEventListener('input', (ev) => {
  if (!ev.target.closest || !ev.target.closest('#form-obra')) return;
  if (['lat', 'lon', 'raio'].includes(ev.target.name) && mapaObra) {
    mapaObra.marcar(Number(String(document.getElementById('ob-lat').value).replace(',', '.')), Number(String(document.getElementById('ob-lon').value).replace(',', '.')), ev.target.name !== 'raio');
  }
  if (['inicio', 'prazo'].includes(ev.target.name)) atualizarPrevia();
});
document.addEventListener('change', (ev) => {
  if (ev.target.id === 'ob-modeloId') atualizarPrevia();
  if (ev.target.closest && ev.target.closest('#form-modelo')) somaModelo();
});

/* ---------- Modelos de etapas ---------- */

export function telaModelos(moldura) {
  const lista = modelos();
  return moldura({
    ativo: 'obras', titulo: tr('Modelos de etapas'), subtitulo: tr('O cronograma inicial de cada tipo de obra ou serviço: etapas e a parte do prazo de cada uma'),
    voltar: { href: '#/settings/obras', rotulo: tr('Obras') },
    acoes: '<a class="btn btn-primario btn-pequeno" href="#/settings/modelo/novo">' + icone('mais', 16) + tr('Novo modelo') + '</a>',
    conteudo: lista.length ? '<div class="grade-modelos">' + lista.map((m) => '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(m.nome) + '</h2><a class="link" href="#/settings/modelo/' + m.id + '">' + tr('Editar') + '</a></div>' +
      '<ol class="lista-modelo">' + m.etapas.map((e) => '<li><span>' + esc(e.nome) + '</span><span class="barra-modelo"><span style="width:' + Math.round((e.pct / Math.max(...m.etapas.map((x) => x.pct))) * 100) + '%"></span></span><b>' + decimal(e.pct, e.pct % 1 ? 1 : 0) + '%</b></li>').join('') + '</ol></section>').join('') + '</div>'
      : '<p class="vazio">' + tr('Nenhum modelo ainda. Crie um com as etapas que a empresa sempre repete.') + '</p>',
  });
}

const linhaModelo = (e) => '<div class="linha-modelo"><input type="text" name="etapaNome" value="' + esc(e.nome || '') + '" aria-label="' + tr('Etapa') + '" placeholder="' + esc(tr('Ex.: Framing do 1º pavimento')) + '">' +
  '<input type="text" inputmode="decimal" name="etapaPct" value="' + (e.pct != null ? e.pct : '') + '" aria-label="' + tr('Parte do prazo (%)') + '" placeholder="%">' +
  '<button type="button" class="btn-icone" data-acao="modelo-tirar-linha" aria-label="' + tr('Tirar etapa') + '" title="' + tr('Tirar etapa') + '">×</button></div>';

export function telaFormModelo(moldura, id) {
  const m = id ? modelo(id) : { nome: '', etapas: [{ nome: '', pct: '' }] };
  if (!m) return moldura({ ativo: 'obras', titulo: tr('Modelo não encontrado'), voltar: { href: '#/settings/modelos', rotulo: tr('Modelos de etapas') }, conteudo: '' });
  return moldura({
    ativo: 'obras', titulo: id ? m.nome : tr('Novo modelo'), voltar: { href: '#/settings/modelos', rotulo: tr('Modelos de etapas') },
    conteudo: '<form id="form-modelo" class="form-settings" data-id="' + (id || '') + '" onsubmit="return false"><section class="cartao">' +
      campo('md-nome', tr('Nome do modelo *'), '<input type="text" id="md-nome" name="nome" value="' + esc(m.nome) + '" placeholder="' + esc(tr('Ex.: Framing + siding (casa)')) + '">') +
      '<div class="cabeca-modelo rotulo-pequeno"><span>' + tr('Etapa, na ordem') + '</span><span>' + tr('Parte do prazo (%)') + '</span></div>' +
      '<div id="md-linhas">' + m.etapas.map(linhaModelo).join('') + '</div>' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="modelo-nova-linha">' + icone('mais', 14) + tr('Incluir etapa') + '</button>' +
      '<p class="pequeno" id="md-soma"></p>' +
      '<p class="mudo pequeno">' + tr('A parte do prazo diz quanto do período da obra cada etapa ocupa. As partes somam 100%. Ao criar a obra, as etapas entram em sequência.') + '</p>' +
      '</section><div class="rodape-form">' + (id ? '<button type="button" class="btn btn-contorno" data-acao="modelo-excluir" data-id="' + id + '">' + tr('Excluir') + '</button>' : '') +
      '<a class="btn btn-contorno" href="#/settings/modelos">' + tr('Cancelar') + '</a><button type="button" class="btn btn-primario" data-acao="modelo-salvar">' + (id ? tr('Salvar') : tr('Criar modelo')) + '</button></div></form>',
  });
}
function somaModelo() {
  const el = document.getElementById('md-soma');
  if (!el) return;
  const soma = [...document.querySelectorAll('#md-linhas [name="etapaPct"]')].reduce((s, i) => s + (Number(String(i.value).replace(',', '.')) || 0), 0);
  const ok = Math.abs(soma - 100) <= 0.5;
  el.className = 'pequeno ' + (ok ? 'texto-verde' : 'texto-alerta');
  el.textContent = tr('Soma: {soma}%', { soma: decimal(soma, soma % 1 ? 1 : 0) }) + (ok ? ' ✓' : ' · ' + tr('precisa somar 100%'));
}
document.addEventListener('input', (ev) => { if (ev.target.name === 'etapaPct') somaModelo(); });
export function aposDesenharModelo() { somaModelo(); }

/* ---------- Ações ---------- */

export const acoesObras = {
  'obra-salvar'() {
    const form = document.getElementById('form-obra');
    const fd = new FormData(form);
    const id = form.dataset.id || null;
    const r = salvarObra(id, { ...Object.fromEntries(fd.entries()), diasTrabalho: fd.getAll('diasTrabalho') }, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(id ? tr('Obra atualizada.') : tr('Obra criada.'));
    app.ir(pode(usuarioAtual(), 'daily.acompanhar') ? '#/daily/obras/' + r.id : '#/settings/obras');
  },
  'obra-aqui'() {
    if (!navigator.geolocation) { toast(tr('Este aparelho não informa a localização.')); return; }
    toast(tr('Buscando a sua localização…'));
    navigator.geolocation.getCurrentPosition((p) => {
      const lat = Math.round(p.coords.latitude * 1e6) / 1e6, lon = Math.round(p.coords.longitude * 1e6) / 1e6;
      const a = document.getElementById('ob-lat'), b = document.getElementById('ob-lon');
      if (!a || !b) return;
      a.value = lat; b.value = lon;
      if (mapaObra) mapaObra.marcar(lat, lon, true);
      toast(tr('Local marcado (precisão de {m} m).', { m: Math.round(p.coords.accuracy) }));
    }, () => toast(tr('Não foi possível pegar a localização. Marque no mapa.')), { enableHighAccuracy: true, timeout: 8000 });
  },
  'modelo-nova-linha'() {
    document.getElementById('md-linhas').insertAdjacentHTML('beforeend', linhaModelo({}));
    const campos = document.querySelectorAll('#md-linhas [name="etapaNome"]');
    campos[campos.length - 1].focus();
  },
  'modelo-tirar-linha'(el) {
    const linhas = document.querySelectorAll('#md-linhas .linha-modelo');
    if (linhas.length > 1) el.closest('.linha-modelo').remove();
    somaModelo();
  },
  'modelo-salvar'() {
    const form = document.getElementById('form-modelo');
    const fd = new FormData(form);
    const nomes = fd.getAll('etapaNome'), pcts = fd.getAll('etapaPct');
    const r = salvarModelo(form.dataset.id || null, { nome: fd.get('nome'), etapas: nomes.map((nome, i) => ({ nome, pct: pcts[i] })) }, quem());
    if (r.erro) { toast(r.erro); return; }
    toast(tr('Modelo salvo.'));
    app.ir('#/settings/modelos');
  },
  async 'modelo-excluir'(el) {
    const m = modelo(el.dataset.id);
    if (!m || !(await confirmar(tr('Excluir o modelo "{nome}"?', { nome: m.nome }), tr('As obras que já usaram o modelo não mudam.'), tr('Excluir')))) return;
    excluirModelo(m.id, quem());
    toast(tr('Modelo excluído.'));
    app.ir('#/settings/modelos');
  },
};
