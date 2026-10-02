/* KORbuild Crew — telas do ponto.
 * Campo (encarregado): bate o ponto da equipe (entrada, intervalo, troca de obra, chegada, saída) com GPS e cerca,
 *   e vê as horas da semana.
 * Administrador: quem está trabalhando agora, timesheets com aprovação e ajustes, custo por obra e o mapa do dia. */

import { esc, hoje, somarDias, diasEntre, isoDoDia, dataCurta, dataLonga, diaDaSemana, horaCurta, dataHora, toast, abrirDialogo, confirmar } from './util.js';
import { estado, salvar, obra as acharObra } from './armazem.js';
import { casca, usuarioAtual, pode } from './plataforma.js';
import { icone } from './icones.js';
import { obterPosicao } from './fotos.js';
import {
  ETAPAS, distanciaM, dentroDaCerca, inicioDaSemana, diasDaSemana, horas, dinheiro, funcionario, equipe,
  equipeDoEncarregado, membros, jornada, semana, aprovacaoDaSemana, registrarBatidas, decidirSemana,
  valorHoraEm, valorAtual, historicoDeValores, alterarValorHora, encargos, orcamento, definirOrcamento,
  custosDoPeriodo, resumoDaObra, statusSemana,
} from './crew.js';
import { ativos, funcionarios as todosFuncionarios, regraEm, resumoRegra, encargosVersao } from './settings.js';

let app = { desenhar: () => {}, ir: () => {}, topoExtra: () => '' };
export function ligarCrew(funcoes) { app = { ...app, ...funcoes }; }

const selecionados = new Set();
let relogioTimer = null;

const ROTULO_BATIDA = {
  'entrada': 'Entrada', 'intervalo-inicio': 'Início do intervalo', 'intervalo-fim': 'Fim do intervalo',
  'troca': 'Saiu para outra obra', 'chegada': 'Chegou na obra', 'etapa': 'Mudou de etapa', 'saida': 'Saída',
};
const STATUS_SEMANA = {
  aberta: ['etiqueta-neutro', 'Semana em andamento'], pendente: ['etiqueta-ambar', 'Aguardando aprovação'],
  aprovado: ['etiqueta-verde', 'Aprovado'], devolvido: ['etiqueta-alerta', 'Devolvido'],
};

function primeiraMaiuscula(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
function nomeObra(id) { const o = acharObra(id); return o ? o.nome : '—'; }
function nomeCurto(id) { return nomeObra(id).split(' ').slice(0, 2).join(' '); }

/* ---------- Moldura e navegação ---------- */

function navCrew() {
  const u = usuarioAtual();
  const itens = [];
  if (pode(u, 'crew.ponto.equipe')) {
    itens.push({ id: 'equipe', href: '#/crew/equipe', rotulo: 'Ponto', icone: 'relogio' }, { id: 'horas', href: '#/crew/horas', rotulo: 'Horas', icone: 'tabela' });
  } else if (pode(u, 'crew.ponto.proprio')) itens.push({ id: 'meu', href: '#/crew/meu', rotulo: 'Meu ponto', icone: 'relogio' });
  if (pode(u, 'crew.acompanhar')) {
    const pendentes = pode(u, 'crew.aprovar') ? todosFuncionarios().filter((f) => semana(f.id, somarDias(inicioDaSemana(hoje()), -7)).status === 'pendente').length : 0;
    itens.push({ id: 'agora', href: '#/crew/agora', rotulo: 'Agora', icone: 'pino' }, { id: 'timesheets', href: '#/crew/timesheets', rotulo: 'Timesheets', icone: 'tabela', contador: pendentes });
  }
  if (pode(u, 'crew.custos')) itens.push({ id: 'custos', href: '#/crew/custos', rotulo: 'Custos', icone: 'dinheiro' });
  // com uma tela só (ex.: o trabalhador, só "Meu ponto"), sem menu
  return itens.length > 1 ? itens : [];
}

function moldura(o) {
  return casca({ modulo: 'crew', nav: navCrew(), largura: o.largo ? 'larga' : 'estreita', topoExtra: app.topoExtra(), ...o });
}

/* Ponto de entrada das rotas #/crew/... Devolve o HTML ou { trocar: '#/...' }. */
export function telaCrew(q) {
  const u = usuarioAtual();
  pararRelogio();
  // cada tela pede uma permissão do perfil (Settings › Perfis de acesso)
  const precisa = { equipe: 'crew.ponto.equipe', horas: 'crew.ponto.equipe', meu: 'crew.ponto.proprio', agora: 'crew.acompanhar', timesheets: 'crew.acompanhar', semana: 'crew.acompanhar', custos: 'crew.custos' };
  const inicio = pode(u, 'crew.ponto.equipe') ? '#/crew/equipe' : pode(u, 'crew.ponto.proprio') ? '#/crew/meu' : pode(u, 'crew.acompanhar') ? '#/crew/agora' : '#/inicio';
  if (!q.length) return { trocar: inicio };
  if (precisa[q[0]] && !pode(u, precisa[q[0]])) return { trocar: inicio };
  if (q[0] === 'dia' && !pode(u, 'crew.acompanhar') && !pode(u, 'crew.ponto.equipe')) return { trocar: inicio };
  if (q[0] === 'equipe') return telaEquipe();
  if (q[0] === 'meu') return telaMeuPonto();
  if (q[0] === 'horas') return telaHorasEquipe(q[1]);
  if (q[0] === 'agora') return telaAgora();
  if (q[0] === 'timesheets') return telaTimesheets(q[1]);
  if (q[0] === 'semana') return telaSemanaFuncionario(q[1], q[2]);
  if (q[0] === 'custos') return telaCustos(q[1], q[2]);
  // o cadastro de funcionários mudou para o Settings
  if (q[0] === 'funcionarios') return { trocar: '#/settings/funcionarios' };
  if (q[0] === 'funcionario') return { trocar: '#/settings/funcionario/' + q[1] };
  if (q[0] === 'dia') return telaDia(q[1], q[2]);
  return { trocar: inicio };
}

/* ---------- Campo: ponto da equipe ---------- */

function descricaoEstado(j) {
  const a = j.atual;
  if (j.estado === 'trabalho') return { classe: 'verde', texto: 'Trabalhando desde ' + horaCurta(a.ini) + ' · ' + nomeCurto(a.obraId) + ' · ' + a.etapa };
  if (j.estado === 'intervalo') return { classe: 'neutro', texto: 'Em intervalo desde ' + horaCurta(a.ini) };
  if (j.estado === 'deslocamento') return { classe: 'azul', texto: 'Indo para ' + nomeCurto(a.obraId) + ' desde ' + horaCurta(a.ini) };
  if (j.estado === 'saiu') return { classe: 'neutro', texto: 'Saiu às ' + horaCurta(j.batidas[j.batidas.length - 1].em) };
  return { classe: 'ambar', texto: 'Ainda não bateu entrada' };
}

/* Para cada ação, quem do grupo selecionado pode recebê-la. */
function aplicaveis(ids) {
  const js = ids.map((id) => [id, jornada(id, hoje())]);
  const de = (estados) => js.filter(([, j]) => estados.includes(j.estado)).map(([id]) => id);
  return {
    entrada: de(['fora', 'saiu']),
    intervalo: de(['trabalho']),
    volta: de(['intervalo']),
    troca: de(['trabalho']),
    chegada: de(['deslocamento']),
    saida: de(['trabalho', 'intervalo', 'deslocamento']),
  };
}

function telaEquipe() {
  const u = usuarioAtual();
  const eq = equipeDoEncarregado(u.id);
  if (!eq) return moldura({ ativo: 'equipe', titulo: 'Ponto da equipe', conteudo: '<p class="vazio">Você ainda não é encarregado de nenhuma equipe.</p>' });
  const lista = membros(eq.id);
  for (const id of Array.from(selecionados)) if (!lista.some((f) => f.id === id)) selecionados.delete(id);
  const js = lista.map((f) => ({ f, j: jornada(f.id, hoje()) }));
  const conta = (e) => js.filter((x) => x.j.estado === e).length;
  const ap = aplicaveis(Array.from(selecionados));
  const botao = (acao, rotulo, ic, ids, classe) =>
    '<button type="button" class="btn ' + (classe || 'btn-contorno') + ' btn-pequeno" data-acao="crew-' + acao + '"' + (ids.length ? '' : ' disabled') + '>' + icone(ic, 16) + rotulo + (ids.length ? ' (' + ids.length + ')' : '') + '</button>';
  iniciarRelogio();
  return moldura({
    ativo: 'equipe', titulo: 'Ponto da equipe', subtitulo: eq.nome + ' · ' + primeiraMaiuscula(dataLonga(hoje())),
    conteudo:
      '<section class="cartao relogio-ponto"><div><span class="mudo pequeno">Hora oficial do ponto</span><b id="relogio-crew">' + horaComSegundos() + '</b></div>' +
        '<div class="resumo-ponto"><span><b>' + conta('trabalho') + '</b> trabalhando</span><span><b>' + conta('intervalo') + '</b> em intervalo</span>' +
        '<span><b>' + conta('deslocamento') + '</b> em deslocamento</span><span><b>' + (conta('fora') + conta('saiu')) + '</b> fora</span></div></section>' +
      '<div class="lista-equipe-topo"><h2 class="titulo-secao">' + lista.length + ' pessoas</h2>' +
        '<button type="button" class="link" data-acao="crew-todos">' + (selecionados.size === lista.length ? 'Limpar seleção' : 'Selecionar todos') + '</button></div>' +
      '<ul class="lista-equipe">' + js.map(({ f, j }) => {
        const d = descricaoEstado(j);
        const marcado = selecionados.has(f.id);
        return '<li class="' + (marcado ? 'marcado' : '') + '"><label class="membro"><input type="checkbox" data-acao="crew-marcar" data-id="' + f.id + '"' + (marcado ? ' checked' : '') + '>' +
          '<span class="avatar">' + esc(f.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')) + '</span>' +
          '<span class="membro-texto"><b>' + esc(f.nome) + '</b><span class="mudo">' + esc(f.funcao) + '</span>' +
          '<span class="estado-ponto estado-' + d.classe + '">' + esc(d.texto) + '</span></span>' +
          '<span class="membro-horas">' + (j.pago ? horas(j.pago) : '') + (j.alertas.length ? '<span class="alerta-mini" title="' + esc(j.alertas.map((a) => a.texto).join(', ')) + '">!</span>' : '') + '</span></label>' +
          '<a class="membro-dia" href="#/crew/dia/' + f.id + '/' + hoje() + '" aria-label="Dia de ' + esc(f.nome) + '">' + icone('seta', 18) + '</a></li>';
      }).join('') + '</ul>' +
      '<p class="dica centro">Marque as pessoas e use os botões abaixo. Cada batida guarda a hora, o GPS do seu celular e quem registrou. Funciona sem internet.</p>',
    rodape:
      '<div class="rodape-envio barra-ponto"><div class="rodape-dentro">' +
        (selecionados.size ? '<span class="rodape-status">' + selecionados.size + ' selecionada' + (selecionados.size > 1 ? 's' : '') + '</span>' : '<span class="rodape-status">Selecione quem vai bater o ponto</span>') +
        '<div class="botoes-ponto">' +
          botao('entrada', 'Entrada', 'entrar', ap.entrada, 'btn-primario') +
          botao('intervalo', 'Intervalo', 'cafe', ap.intervalo) +
          botao('volta', 'Volta', 'cafe', ap.volta) +
          botao('troca', 'Trocar obra', 'troca', ap.troca) +
          botao('chegada', 'Chegou', 'pino', ap.chegada) +
          botao('saida', 'Saída', 'sair', ap.saida) +
        '</div></div></div>',
  });
}

/* ---------- Trabalhador: o próprio ponto (sem tela de módulos) ---------- */

function telaMeuPonto() {
  const u = usuarioAtual();
  const f = u.funcionarioId && funcionario(u.funcionarioId);
  if (!f) return moldura({ ativo: 'meu', titulo: 'Meu ponto', conteudo: '<p class="vazio">Seu acesso ainda não está ligado ao seu cadastro de funcionário. Fale com o escritório.</p>' });
  selecionados.clear();
  selecionados.add(f.id); // os botões do ponto valem só para a própria pessoa
  const j = jornada(f.id, hoje());
  const d = descricaoEstado(j);
  const ap = aplicaveis([f.id]);
  const s = semana(f.id, inicioDaSemana(hoje()));
  const botao = (acao, rotulo, ic, ok, classe) => ok.length ? '<button type="button" class="btn ' + (classe || 'btn-contorno') + ' btn-grande" data-acao="crew-' + acao + '">' + icone(ic, 20) + rotulo + '</button>' : '';
  iniciarRelogio();
  return moldura({
    ativo: 'meu', titulo: 'Olá, ' + f.nome.split(' ')[0], subtitulo: primeiraMaiuscula(dataLonga(hoje())),
    conteudo:
      '<section class="cartao meu-ponto"><span class="mudo pequeno">Hora oficial do ponto</span><b id="relogio-crew" class="relogio-grande">' + horaComSegundos() + '</b>' +
        '<span class="estado-ponto estado-' + d.classe + '">' + esc(d.texto) + '</span>' +
        (j.pago ? '<span class="mudo">Hoje: <b>' + horas(j.pago) + '</b> trabalhadas</span>' : '') +
        '<div class="botoes-meu-ponto">' +
          botao('entrada', 'Bater entrada', 'entrar', ap.entrada, 'btn-primario') + botao('intervalo', 'Começar intervalo', 'cafe', ap.intervalo) +
          botao('volta', 'Voltar do intervalo', 'cafe', ap.volta, 'btn-primario') + botao('troca', 'Ir para outra obra', 'troca', ap.troca) +
          botao('chegada', 'Cheguei na obra', 'pino', ap.chegada, 'btn-primario') + botao('saida', 'Bater saída', 'sair', ap.saida) +
        '</div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Hoje</h2>' +
        (j.batidas.length ? '<ol class="linha-tempo">' + j.batidas.map((b) => '<li class="' + (b.dentroCerca === false ? 'fora' : '') + '"><span class="lt-hora">' + horaCurta(b.em) + '</span><div><span><b>' + ROTULO_BATIDA[b.tipo] + '</b> · ' + esc(nomeObra(b.obraId)) + '</span>' +
          '<span class="mudo pequeno">' + (b.fonteGps === 'gps' ? (b.dentroCerca ? 'Dentro da obra' : 'Fora da obra') : 'Sem GPS') + (b.registradoPor !== u.id ? ' · registrado pelo encarregado' : '') + '</span></div></li>').join('') + '</ol>' : '<p class="vazio">Nenhuma batida hoje.</p>') +
      '</section>' +
      '<section class="cartao"><h2 class="cartao-titulo">Minha semana</h2><ul class="minha-semana">' +
        s.dias.filter((x) => x.pago || x.iso === hoje()).map((x) => '<li><span>' + primeiraMaiuscula(diaDaSemana(x.iso)).slice(0, 3) + ' ' + dataCurta(x.iso).slice(0, 5) + '</span><b>' + (x.pago ? horas(x.pago) : '–') + '</b></li>').join('') +
        '<li class="total"><span>Total</span><b>' + horas(s.total) + (s.extra + s.dobra ? ' · ' + horas(s.extra + s.dobra) + ' extras' : '') + '</b></li></ul></section>' +
      '<p class="dica centro">Sua localização só é registrada com o ponto aberto: na batida e durante a jornada. Nada no intervalo nem depois da saída.</p>',
  });
}

function horaComSegundos() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}
function iniciarRelogio() {
  pararRelogio();
  relogioTimer = setInterval(() => {
    const el = document.getElementById('relogio-crew');
    if (el) el.textContent = horaComSegundos(); else pararRelogio();
  }, 1000);
}
function pararRelogio() { if (relogioTimer) { clearInterval(relogioTimer); relogioTimer = null; } }

/* Localiza o celular e diz se está dentro da cerca da obra. */
async function localizar(obraId) {
  const o = acharObra(obraId);
  const p = await obterPosicao(o);
  const dist = distanciaM(o.cerca.lat, o.cerca.lon, p.lat, p.lon);
  return { ...p, distancia: dist, dentro: p.fonte === 'gps' ? dentroDaCerca(o, p.lat, p.lon) : null };
}

function textoDistancia(loc) {
  if (loc.fonte !== 'gps') return '<span class="cerca-aviso ambar">Não foi possível obter o GPS. A batida fica sem localização e vai para conferência.</span>';
  const d = loc.distancia >= 1000 ? (loc.distancia / 1000).toFixed(1).replace('.', ',') + ' km' : loc.distancia + ' m';
  return loc.dentro
    ? '<span class="cerca-aviso verde">' + icone('pino', 16) + 'Você está a ' + d + ' da obra: dentro da cerca ✓</span>'
    : '<span class="cerca-aviso vermelho">' + icone('pino', 16) + 'Você está a ' + d + ' da obra: fora da cerca. A batida fica marcada para o escritório conferir.</span>';
}

function opcoesObras(selecionada, excluir) {
  return estado().obras.filter((o) => o.id !== excluir).map((o) => '<option value="' + o.id + '"' + (o.id === selecionada ? ' selected' : '') + '>' + esc(o.nome) + '</option>').join('');
}
function opcoesEtapas(selecionada) {
  return ETAPAS.map((e) => '<option' + (e === selecionada ? ' selected' : '') + '>' + esc(e) + '</option>').join('');
}

const simulacao = '<label class="simular-local"><input type="checkbox" name="simular" value="1"> Usar a localização da obra (simulação do protótipo)</label>';

async function dialogoComLocal({ titulo, obraId, corpoAntes, corpoDepois, rotulo, comObra }) {
  toast('Localizando o celular…');
  let loc = await localizar(obraId);
  const promessa = abrirDialogo({
    titulo,
    corpo: (corpoAntes || '') +
      (comObra ? '<label class="rotulo-pequeno" for="crew-obra">Obra</label><select id="crew-obra" name="obra">' + opcoesObras(obraId) + '</select>' : '') +
      '<div id="crew-local">' + textoDistancia(loc) + '</div>' + (loc.dentro === false ? simulacao : '') +
      (corpoDepois || ''),
    acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo, valor: true, classe: 'btn-primario' }],
  });
  const sel = document.getElementById('crew-obra');
  if (sel) {
    sel.addEventListener('change', async () => {
      loc = await localizar(sel.value);
      const alvo = document.getElementById('crew-local');
      if (alvo) alvo.innerHTML = textoDistancia(loc);
    });
  }
  const res = await promessa;
  if (!res || !res.valor) return null;
  const obraEscolhida = res.campos.obra || obraId;
  if (res.campos.simular) {
    const o = acharObra(obraEscolhida);
    loc = { lat: o.cerca.lat + 0.0002, lon: o.cerca.lon + 0.0002, precisao: 12, fonte: 'gps', dentro: true };
  } else if (obraEscolhida !== obraId) {
    loc = await localizar(obraEscolhida);
  }
  return { campos: res.campos, obraId: obraEscolhida, loc };
}

/* A pessoa batendo o próprio ponto (Meu ponto), e não o encarregado pela equipe. */
function proprio(ids) { return ids.length === 1 && ids[0] === usuarioAtual().funcionarioId; }

function aplicar(ids, tipo, obraId, etapa, loc, extra) {
  registrarBatidas(ids, {
    tipo, obraId, etapa, lat: loc.lat, lon: loc.lon, precisao: loc.precisao, dentroCerca: loc.fonte === 'gps' ? !!loc.dentro : false,
    fonteGps: loc.fonte, registradoPor: usuarioAtual().id, modo: proprio(ids) ? 'pessoal' : 'equipe', ...(extra || {}),
  });
}

function obraAtualDe(id) {
  const j = jornada(id, hoje());
  return j.atual ? j.atual.obraId : (equipe(funcionario(id).equipeId) || {}).obraBaseId;
}

export const acoesCrew = {
  'crew-mapa-cheio'() { alternarTelaCheia(); },
  async 'crew-valor-hora'(el) {
    const f = funcionario(el.dataset.id);
    // padrão: a partir da próxima segunda (semana nova, ainda aberta)
    const proxSegunda = somarDias(inicioDaSemana(hoje()), 7);
    const res = await abrirDialogo({
      titulo: 'Alterar valor hora · ' + f.nome,
      corpo: '<p class="mudo pequeno">Valor atual: <b>' + dinheiro(valorAtual(f)) + '/h</b>. O novo valor vale a partir da data escolhida; o histórico fica guardado.</p>' +
        '<label class="rotulo-pequeno" for="vh-valor">Novo valor hora (US$)</label><input type="number" id="vh-valor" name="valor" min="1" step="0.01" value="' + valorAtual(f).toFixed(2) + '" inputmode="decimal">' +
        '<label class="rotulo-pequeno" for="vh-desde">A partir de</label><input type="date" id="vh-desde" name="desde" value="' + proxSegunda + '">' +
        '<label class="rotulo-pequeno" for="vh-motivo">Motivo</label><input type="text" id="vh-motivo" name="motivo" placeholder="Ex.: reajuste anual, promoção, nova certificação">' +
        '<p class="mudo pequeno">Não é possível começar dentro de uma semana já aprovada (já foi para a folha).</p>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar novo valor', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const r = alterarValorHora(f.id, Number(String(res.campos.valor).replace(',', '.')), res.campos.desde, res.campos.motivo, usuarioAtual().nome);
    if (r.erro) { toast(r.erro); return; }
    toast('Novo valor de ' + f.nome.split(' ')[0] + ': ' + dinheiro(Number(String(res.campos.valor).replace(',', '.'))) + '/h a partir de ' + dataCurta(res.campos.desde) + '.');
    app.desenhar();
  },
  async 'crew-orcamento'(el) {
    const id = el.dataset.obra;
    const o = orcamento(id) || { valor: '', avanco: '' };
    const res = await abrirDialogo({
      titulo: 'Orçamento de mão de obra · ' + nomeObra(id),
      corpo: '<label class="rotulo-pequeno" for="or-valor">Orçamento total de mão de obra (US$)</label><input type="number" id="or-valor" name="valor" min="0" step="100" value="' + (o.valor || '') + '" inputmode="decimal">' +
        '<label class="rotulo-pequeno" for="or-avanco">Avanço físico da obra (%)</label><input type="number" id="or-avanco" name="avanco" min="0" max="100" step="1" value="' + (o.avanco || '') + '" inputmode="numeric">' +
        '<p class="mudo pequeno">O avanço físico é quanto da obra já foi executado (medição). Com ele, a projeção compara o que foi gasto com o que foi feito. Na versão completa, ele virá do RDO (Daily) e das medições.</p>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Salvar', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const valor = Number(res.campos.valor), avanco = res.campos.avanco === '' ? null : Number(res.campos.avanco);
    if (!(valor > 0) || (avanco != null && (avanco < 0 || avanco > 100))) { toast('Informe um orçamento maior que zero e um avanço entre 0 e 100%.'); return; }
    definirOrcamento(id, { valor, avanco }, usuarioAtual().nome);
    toast('Orçamento de ' + nomeObra(id) + ' atualizado.');
    app.desenhar();
  },
  'crew-reproduzir'() { if (mapaAtual) mapaAtual.reproduzir(); },
  'crew-passo'(el) { if (mapaAtual) mapaAtual.selecionarPasso(Number(el.dataset.n), 'lista'); },
  'crew-marcar'(el) {
    if (el.checked) selecionados.add(el.dataset.id); else selecionados.delete(el.dataset.id);
    app.desenhar();
  },
  'crew-todos'() {
    const eq = equipeDoEncarregado(usuarioAtual().id);
    const lista = membros(eq.id);
    if (selecionados.size === lista.length) selecionados.clear(); else lista.forEach((f) => selecionados.add(f.id));
    app.desenhar();
  },
  async 'crew-entrada'() {
    const ids = aplicaveis(Array.from(selecionados)).entrada;
    const eq = equipeDoEncarregado(usuarioAtual().id) || equipe(funcionario(ids[0]).equipeId) || { obraBaseId: estado().obras[0].id };
    const r = await dialogoComLocal({
      titulo: proprio(ids) ? 'Sua entrada' : 'Entrada de ' + ids.length + (ids.length === 1 ? ' pessoa' : ' pessoas'), obraId: eq.obraBaseId, comObra: true, rotulo: 'Bater entrada',
      corpoDepois: '<label class="rotulo-pequeno" for="crew-etapa">Etapa (cost code)</label><select id="crew-etapa" name="etapa">' + opcoesEtapas(acharObra(eq.obraBaseId).etapa.includes('Alvenaria') ? 'Alvenaria' : ETAPAS[0]) + '</select>' +
        '<label class="lembrar"><input type="checkbox" name="foto" value="1"> Foto da equipe (no celular, abre a câmera)</label>',
    });
    if (!r) return;
    aplicar(ids, 'entrada', r.obraId, r.campos.etapa, r.loc, { foto: !!r.campos.foto });
    selecionados.clear();
    toast('Entrada registrada' + (proprio(ids) ? '' : ' para ' + ids.length + (ids.length === 1 ? ' pessoa' : ' pessoas')) + ' às ' + horaCurta(Date.now()) + '.');
    app.desenhar();
  },
  async 'crew-intervalo'() { await batidaSimples('intervalo', 'intervalo-inicio', 'Intervalo iniciado'); },
  async 'crew-volta'() { await batidaSimples('volta', 'intervalo-fim', 'Volta do intervalo registrada'); },
  async 'crew-saida'() {
    const ids = aplicaveis(Array.from(selecionados)).saida;
    if (!(await confirmar(proprio(ids) ? 'Bater a sua saída?' : 'Bater a saída de ' + ids.length + (ids.length === 1 ? ' pessoa' : ' pessoas') + '?', 'A jornada de hoje é encerrada. Se alguém continuar trabalhando, deixe essa pessoa de fora.', 'Bater saída'))) return;
    await batidaSimples('saida', 'saida', 'Saída registrada', true);
  },
  async 'crew-troca'() {
    const ids = aplicaveis(Array.from(selecionados)).troca;
    const atual = obraAtualDe(ids[0]);
    const res = await abrirDialogo({
      titulo: 'Trocar de obra',
      corpo: '<p class="mudo pequeno">' + ids.length + (ids.length === 1 ? ' pessoa sai' : ' pessoas saem') + ' de ' + esc(nomeObra(atual)) + '. O tempo de deslocamento até a outra obra conta como hora trabalhada.</p>' +
        '<label class="rotulo-pequeno" for="crew-destino">Para qual obra?</label><select id="crew-destino" name="destino">' + opcoesObras(null, atual) + '</select>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Sair para a obra', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    toast('Localizando o celular…');
    const loc = await localizar(atual);
    aplicar(ids, 'troca', res.campos.destino, null, loc);
    selecionados.clear();
    toast('Deslocamento para ' + nomeObra(res.campos.destino) + ' iniciado. Toque em "Chegou" na chegada.');
    app.desenhar();
  },
  async 'crew-chegada'() {
    const ids = aplicaveis(Array.from(selecionados)).chegada;
    const destino = obraAtualDe(ids[0]);
    const r = await dialogoComLocal({
      titulo: 'Chegada em ' + nomeObra(destino), obraId: destino, rotulo: 'Registrar chegada',
      corpoDepois: '<label class="rotulo-pequeno" for="crew-etapa">Etapa nesta obra</label><select id="crew-etapa" name="etapa">' + opcoesEtapas(ETAPAS[0]) + '</select>',
    });
    if (!r) return;
    aplicar(ids, 'chegada', destino, r.campos.etapa, r.loc);
    selecionados.clear();
    toast('Chegada registrada.');
    app.desenhar();
  },
  async 'crew-conferir'(el) {
    const b = estado().crew.batidas.find((x) => x.id === el.dataset.id);
    if (!b) return;
    b.conferida = true;
    b.conferidaPor = usuarioAtual().nome;
    salvar();
    toast('Batida conferida. Ela continua registrada como fora da cerca.');
    app.desenhar();
  },
  'crew-sel-ts'(el) {
    if (el.checked) selecionados.add(el.dataset.id); else selecionados.delete(el.dataset.id);
    app.desenhar();
  },
  async 'crew-aprovar'(el) {
    const segunda = el.dataset.semana;
    const ids = el.dataset.id ? [el.dataset.id] : Array.from(selecionados);
    const bloqueados = ids.filter((id) => semana(id, segunda).alertas.some((a) => a.tipo === 'sem-saida'));
    if (bloqueados.length) {
      toast('Antes de aprovar, ajuste as batidas sem saída de: ' + bloqueados.map((id) => funcionario(id).nome).join(', ') + '.');
      return;
    }
    if (!(await confirmar('Aprovar ' + ids.length + (ids.length === 1 ? ' timesheet' : ' timesheets') + '?', 'As horas aprovadas ficam liberadas para a folha de pagamento.', 'Aprovar'))) return;
    decidirSemana(ids, segunda, 'aprovado', usuarioAtual().nome);
    selecionados.clear();
    toast('Aprovado. As horas já podem ser exportadas para a folha.');
    app.desenhar();
  },
  async 'crew-devolver'(el) {
    const res = await abrirDialogo({
      titulo: 'Devolver timesheet',
      corpo: '<label class="rotulo-pequeno" for="motivo-dev">O que precisa ser revisto?</label><textarea id="motivo-dev" name="motivo" rows="3" placeholder="Ex.: confirmar a saída de terça com o encarregado."></textarea>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Devolver', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor || !res.campos.motivo.trim()) return;
    decidirSemana([el.dataset.id], el.dataset.semana, 'devolvido', usuarioAtual().nome, res.campos.motivo.trim());
    toast('Devolvido ao encarregado com o motivo.');
    app.desenhar();
  },
  async 'crew-ajustar'(el) {
    const f = funcionario(el.dataset.id);
    const iso = el.dataset.dia;
    const res = await abrirDialogo({
      titulo: 'Ajustar o dia ' + dataCurta(iso) + ' · ' + f.nome,
      corpo: '<p class="mudo pequeno">O ajuste entra como uma batida nova, marcada como ajuste, com o seu nome e o motivo. As batidas originais continuam visíveis.</p>' +
        '<label class="rotulo-pequeno" for="aj-tipo">Batida</label><select id="aj-tipo" name="tipo"><option value="saida">Saída</option><option value="intervalo-inicio">Início do intervalo</option><option value="intervalo-fim">Fim do intervalo</option><option value="entrada">Entrada</option></select>' +
        '<label class="rotulo-pequeno" for="aj-hora">Hora</label><input type="text" id="aj-hora" name="hora" value="17:00" inputmode="numeric" pattern="[0-9]{2}:[0-9]{2}">' +
        '<label class="rotulo-pequeno" for="aj-motivo">Motivo</label><textarea id="aj-motivo" name="motivo" rows="2" placeholder="Ex.: esqueceu de bater a saída; confirmado com o encarregado."></textarea>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Registrar ajuste', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const m = /^(\d{1,2}):(\d{2})$/.exec(res.campos.hora.trim());
    if (!m || !res.campos.motivo.trim()) { toast('Informe a hora (ex.: 17:00) e o motivo.'); return; }
    const [a, me, d] = iso.split('-').map(Number);
    const em = new Date(a, me - 1, d, Number(m[1]), Number(m[2])).getTime();
    const j = jornada(f.id, iso);
    const ultima = j.batidas[j.batidas.length - 1];
    registrarBatidas([f.id], {
      tipo: res.campos.tipo, obraId: ultima ? ultima.obraId : (equipe(f.equipeId) || {}).obraBaseId, etapa: ultima ? ultima.etapa : null, em,
      lat: null, lon: null, dentroCerca: null, fonteGps: 'ajuste', registradoPor: usuarioAtual().id, modo: 'ajuste',
      ajuste: { motivo: res.campos.motivo.trim(), por: usuarioAtual().nome, em: Date.now() },
    });
    toast('Ajuste registrado.');
    app.desenhar();
  },
  'crew-csv'(el) {
    const segunda = el.dataset.semana;
    const linhas = [['Semana', 'Funcionário', 'Função', 'Data', 'Obra', 'Etapa', 'Tipo', 'Início', 'Fim', 'Horas', 'Status']];
    for (const f of todosFuncionarios()) {
      const s = semana(f.id, segunda);
      if (s.status !== 'aprovado') continue;
      for (const d of s.dias) for (const seg of d.segmentos) {
        if (seg.tipo === 'intervalo' || !seg.fim) continue;
        linhas.push([segunda, f.nome, f.funcao, d.iso, nomeObra(seg.obraId), seg.tipo === 'deslocamento' ? 'Deslocamento' : seg.etapa, seg.tipo,
          horaCurta(seg.ini), horaCurta(seg.fim), ((seg.fim - seg.ini) / 3600000).toFixed(2), 'aprovado']);
      }
    }
    if (linhas.length === 1) { toast('Nenhum timesheet aprovado nesta semana.'); return; }
    const csv = linhas.map((l) => l.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }));
    a.download = 'korbuild-crew-' + segunda + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast('CSV gerado com ' + (linhas.length - 1) + ' linhas, pronto para a folha (QuickBooks, Gusto, ADP…).');
  },
};

async function batidaSimples(acao, tipo, mensagem, saida) {
  const ids = aplicaveis(Array.from(selecionados))[acao];
  if (!ids.length) return;
  toast('Localizando o celular…');
  const obraId = obraAtualDe(ids[0]);
  const loc = await localizar(obraId);
  // Mantém a obra e a etapa de cada pessoa
  for (const id of ids) {
    const j = jornada(id, hoje());
    const a = j.atual || {};
    registrarBatidas([id], {
      tipo, obraId: a.obraId || obraId, etapa: a.etapa || null, lat: loc.lat, lon: loc.lon, precisao: loc.precisao,
      dentroCerca: loc.fonte === 'gps' ? dentroDaCerca(acharObra(a.obraId || obraId), loc.lat, loc.lon) : false,
      fonteGps: loc.fonte, registradoPor: usuarioAtual().id, modo: proprio(ids) ? 'pessoal' : 'equipe',
    });
  }
  selecionados.clear();
  toast(mensagem + (proprio(ids) ? '' : ' para ' + ids.length + (ids.length === 1 ? ' pessoa' : ' pessoas')) + (saida ? '.' : ' às ' + horaCurta(Date.now()) + '.'));
  app.desenhar();
}

/* ---------- Campo: horas da equipe na semana ---------- */

function seletorSemana(base, segunda) {
  const atual = inicioDaSemana(hoje());
  const ant = somarDias(segunda, -7), prox = somarDias(segunda, 7);
  return '<div class="seletor-semana"><a class="btn btn-contorno btn-pequeno" href="' + base + '/' + ant + '">' + icone('voltar', 16) + 'Anterior</a>' +
    '<b>' + dataCurta(segunda).slice(0, 5) + ' a ' + dataCurta(somarDias(segunda, 6)).slice(0, 5) + (segunda === atual ? ' · semana atual' : '') + '</b>' +
    (segunda < atual ? '<a class="btn btn-contorno btn-pequeno" href="' + base + '/' + prox + '">Próxima' + icone('seta', 16) + '</a>' : '<span></span>') + '</div>';
}

function tabelaSemana(funcs, segunda, opcoes) {
  const dias = diasDaSemana(segunda);
  const op = opcoes || {};
  return '<div class="tabela-rolagem"><table class="tabela-horas"><thead><tr>' + (op.selecao ? '<th></th>' : '') + '<th>Funcionário</th>' +
    dias.map((d) => '<th class="num">' + diaDaSemana(d).slice(0, 3) + '<br><span class="mudo">' + dataCurta(d).slice(0, 5) + '</span></th>').join('') +
    '<th class="num">Total</th><th class="num">Extra</th>' + (op.custo ? '<th class="num">Custo</th>' : '') + '<th>Situação</th></tr></thead><tbody>' +
    funcs.map((f) => {
      const s = semana(f.id, segunda);
      const [cls, txt] = STATUS_SEMANA[s.status];
      const pendente = s.status === 'pendente' || s.status === 'devolvido';
      return '<tr>' + (op.selecao ? '<td>' + (pendente ? '<input type="checkbox" data-acao="crew-sel-ts" data-id="' + f.id + '"' + (selecionados.has(f.id) ? ' checked' : '') + ' aria-label="Selecionar ' + esc(f.nome) + '">' : '') + '</td>' : '') +
        '<td><a href="' + (op.link ? op.link(f) : '#/crew/dia/' + f.id + '/' + hoje()) + '"><b>' + esc(f.nome) + '</b></a><span class="mudo pequeno usuario-detalhe">' + esc(f.funcao) + '</span></td>' +
        s.dias.map((d) => '<td class="num' + (d.alertas.length ? ' com-alerta' : '') + '" title="' + esc(d.alertas.map((a) => a.texto).join(', ')) + '">' + (d.pago ? horas(d.pago) : (d.batidas.length ? '0h00' : '–')) + (d.alertas.length ? ' !' : '') + '</td>').join('') +
        '<td class="num"><b>' + horas(s.total) + '</b></td><td class="num' + ((s.extra + s.dobra) ? ' extra' : '') + '">' + ((s.extra + s.dobra) ? horas(s.extra + s.dobra) : '–') + '</td>' +
        (op.custo ? '<td class="num">' + dinheiro(s.custo) + '</td>' : '') +
        '<td><span class="etiqueta ' + cls + '">' + txt + '</span></td></tr>';
    }).join('') + '</tbody></table></div>';
}

function telaHorasEquipe(param) {
  const eq = equipeDoEncarregado(usuarioAtual().id);
  const segunda = param || inicioDaSemana(hoje());
  if (!eq) return moldura({ ativo: 'horas', titulo: 'Horas', conteudo: '<p class="vazio">Você ainda não é encarregado de nenhuma equipe.</p>' });
  return moldura({
    ativo: 'horas', largo: true, titulo: 'Horas da equipe', subtitulo: eq.nome,
    conteudo: seletorSemana('#/crew/horas', segunda) + tabelaSemana(membros(eq.id), segunda) +
      '<p class="dica">"!" indica algo para conferir (sem saída, batida fora da obra ou sem intervalo). Quem aprova as horas é o escritório.</p>',
  });
}

/* ---------- Administrador: quem está trabalhando agora ---------- */

function telaAgora() {
  const { obras, funcionarios, batidas } = { obras: estado().obras, batidas: estado().crew.batidas, funcionarios: ativos() };
  const hojeIso = hoje();
  const js = funcionarios.map((f) => ({ f, j: jornada(f.id, hojeIso) }));
  const conta = (e) => js.filter((x) => x.j.estado === e).length;
  const horasHoje = js.reduce((t, x) => t + x.j.pago, 0);
  const ontem = somarDias(hojeIso, -1);
  const conferir = batidas.filter((b) => b.dentroCerca === false && !b.conferida && isoDoDia(new Date(b.em)) >= ontem)
    .sort((a, b) => b.em - a.em);
  const kpi = (r, v, c) => '<div class="kpi' + (c ? ' kpi-' + c : '') + '"><span>' + r + '</span><b>' + v + '</b></div>';
  return moldura({
    ativo: 'agora', largo: true, titulo: 'Quem está trabalhando', subtitulo: primeiraMaiuscula(dataLonga(hojeIso)) + ' · atualizado às ' + horaCurta(Date.now()),
    conteudo:
      '<div class="kpis">' + kpi('Trabalhando agora', conta('trabalho'), 'verde') + kpi('Em intervalo', conta('intervalo')) +
        kpi('Em deslocamento', conta('deslocamento'), conta('deslocamento') ? 'azul' : '') + kpi('Horas hoje', horas(horasHoje)) + '</div>' +
      (conferir.length ? '<section class="cartao"><h2 class="cartao-titulo">Batidas fora da obra para conferir <span class="contador">' + conferir.length + '</span></h2><ul class="fila">' +
        conferir.map((b) => {
          const f = funcionario(b.funcionarioId);
          const o = acharObra(b.obraId);
          const dist = b.lat != null ? distanciaM(o.cerca.lat, o.cerca.lon, b.lat, b.lon) : null;
          return '<li><div><b>' + esc(f.nome) + ' · ' + ROTULO_BATIDA[b.tipo] + ' às ' + horaCurta(b.em) + '</b><span class="mudo">' + dataCurta(isoDoDia(new Date(b.em))) + ' · ' + esc(o.nome) +
            (dist != null ? ' · a ' + (dist >= 1000 ? (dist / 1000).toFixed(1).replace('.', ',') + ' km' : dist + ' m') + ' da obra' : ' · sem GPS') + '</span></div>' +
            '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/crew/dia/' + f.id + '/' + isoDoDia(new Date(b.em)) + '">Ver dia</a>' +
            '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-conferir" data-id="' + b.id + '">Conferido</button></div></li>';
        }).join('') + '</ul></section>' : '') +
      '<div class="grade-obras-agora">' + obras.map((o) => {
        const aqui = js.filter((x) => x.j.atual && x.j.atual.obraId === o.id);
        return '<section class="cartao obra-agora"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(o.nome) + '</h2><span class="etiqueta ' + (aqui.length ? 'etiqueta-verde' : 'etiqueta-neutro') + '">' + aqui.length + (aqui.length === 1 ? ' pessoa' : ' pessoas') + '</span></div>' +
          '<p class="mudo pequeno">' + esc(o.cidade) + ' · cerca de ' + o.cerca.raio + ' m</p>' +
          (aqui.length ? '<ul class="pessoas-agora">' + aqui.map(({ f, j }) => {
            const d = descricaoEstado(j);
            return '<li><a href="#/crew/dia/' + f.id + '/' + hojeIso + '"><span class="avatar">' + esc(f.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')) + '</span><span><b>' + esc(f.nome) + '</b><span class="estado-ponto estado-' + d.classe + '">' + esc(d.texto.replace(' · ' + nomeCurto(o.id), '')) + '</span></span>' +
              (j.alertas.length ? '<span class="alerta-mini">!</span>' : '') + '</a></li>';
          }).join('') + '</ul>' : '<p class="vazio">Ninguém com ponto aberto nesta obra agora.</p>') + '</section>';
      }).join('') + '</div>',
  });
}

/* ---------- Administrador: timesheets ---------- */

function telaTimesheets(param) {
  const segunda = param || somarDias(inicioDaSemana(hoje()), -7);
  const funcs = todosFuncionarios();
  const pendentes = funcs.filter((f) => ['pendente', 'devolvido'].includes(semana(f.id, segunda).status));
  for (const id of Array.from(selecionados)) if (!pendentes.some((f) => f.id === id)) selecionados.delete(id);
  const totais = funcs.map((f) => semana(f.id, segunda));
  const soma = (k) => totais.reduce((t, s) => t + s[k], 0);
  const podeAprovar = pode(usuarioAtual(), 'crew.aprovar'), verDinheiro = pode(usuarioAtual(), 'crew.custos');
  return moldura({
    ativo: 'timesheets', largo: true, titulo: 'Timesheets', subtitulo: 'Horas por funcionário · ' + regraEm(segunda).nome + ' (configurável em Settings), sem arredondamento',
    acoes: !podeAprovar ? '' : '<div class="btn-linha">' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-csv" data-semana="' + segunda + '">' + icone('baixar', 16) + 'Exportar CSV (aprovados)</button>' +
      '<button type="button" class="btn btn-primario btn-pequeno" data-acao="crew-aprovar" data-semana="' + segunda + '"' + (selecionados.size ? '' : ' disabled') + '>Aprovar selecionados' + (selecionados.size ? ' (' + selecionados.size + ')' : '') + '</button></div>',
    conteudo: seletorSemana('#/crew/timesheets', segunda) +
      '<div class="kpis">' +
        '<div class="kpi"><span>Horas na semana</span><b>' + horas(soma('total')) + '</b></div>' +
        '<div class="kpi' + ((soma('extra') + soma('dobra')) ? ' kpi-alerta' : '') + '"><span>Horas extras</span><b>' + horas(soma('extra') + soma('dobra')) + '</b></div>' +
        (verDinheiro ? '<div class="kpi"><span>Custo de mão de obra</span><b>' + dinheiro(soma('custo')) + '</b></div>' : '<div class="kpi"><span>Pessoas</span><b>' + funcs.length + '</b></div>') +
        '<div class="kpi' + (pendentes.length ? ' kpi-azul' : ' kpi-verde') + '"><span>Aguardando aprovação</span><b>' + pendentes.length + '</b></div>' +
      '</div>' +
      tabelaSemana(funcs, segunda, { selecao: podeAprovar, custo: verDinheiro, link: (f) => '#/crew/semana/' + f.id + '/' + segunda }),
  });
}

function telaSemanaFuncionario(funcId, segunda) {
  const f = funcionario(funcId);
  if (!f) return { trocar: '#/crew/timesheets' };
  const s = semana(funcId, segunda);
  const ap = aprovacaoDaSemana(funcId, segunda);
  const [cls, txt] = STATUS_SEMANA[s.status];
  const podeAprovar = pode(usuarioAtual(), 'crew.aprovar'), verDinheiro = pode(usuarioAtual(), 'crew.custos');
  const decisao = podeAprovar && (s.status === 'pendente' || s.status === 'devolvido')
    ? '<div class="btn-linha"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-devolver" data-id="' + f.id + '" data-semana="' + segunda + '">Devolver</button>' +
      '<button type="button" class="btn btn-primario btn-pequeno" data-acao="crew-aprovar" data-id="' + f.id + '" data-semana="' + segunda + '">Aprovar semana</button></div>'
    : '';
  return moldura({
    ativo: 'timesheets', largo: true, titulo: f.nome, subtitulo: f.funcao + ' · ' + (equipe(f.equipeId) || {}).nome + (verDinheiro ? ' · ' + dinheiro(valorAtual(f)) + '/h' : ''),
    voltar: { href: '#/crew/timesheets/' + segunda, rotulo: 'Timesheets' },
    acoes: decisao,
    conteudo:
      '<div class="kpis">' +
        '<div class="kpi"><span>Total na semana</span><b>' + horas(s.total) + '</b></div>' +
        '<div class="kpi"><span>Regulares</span><b>' + horas(s.regular) + '</b></div>' +
        '<div class="kpi' + ((s.extra + s.dobra) ? ' kpi-alerta' : '') + '"><span>Horas extras</span><b>' + horas(s.extra + s.dobra) + '</b></div>' +
        (verDinheiro ? '<div class="kpi"><span>Custo</span><b>' + dinheiro(s.custo) + '</b></div>' : '') +
      '</div>' +
      '<p><span class="etiqueta ' + cls + '">' + txt + '</span>' + (ap ? ' <span class="mudo pequeno">por ' + esc(ap.por) + ' em ' + dataHora(ap.em) + (ap.motivo ? ' · "' + esc(ap.motivo) + '"' : '') + '</span>' : '') + '</p>' +
      '<div class="lista">' + s.dias.filter((d) => d.batidas.length).map((d) =>
        '<section class="cartao dia-semana"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + primeiraMaiuscula(diaDaSemana(d.iso)) + ', ' + dataCurta(d.iso) + '</h2><b>' + horas(d.pago) + '</b></div>' +
          (d.alertas.length ? '<p class="alertas-dia">' + d.alertas.map((a) => '<span class="etiqueta etiqueta-alerta">' + esc(a.texto) + '</span>').join('') + '</p>' : '') +
          '<ul class="segmentos">' + d.segmentos.map((sg) => '<li class="seg-' + sg.tipo + '"><span>' + horaCurta(sg.ini) + '–' + (sg.fim ? horaCurta(sg.fim) : (sg.aberto ? 'agora' : '?')) + '</span><b>' +
            (sg.tipo === 'trabalho' ? esc(nomeObra(sg.obraId)) + ' · ' + esc(sg.etapa) : sg.tipo === 'intervalo' ? 'Intervalo' : 'Deslocamento para ' + esc(nomeObra(sg.obraId))) + '</b></li>').join('') + '</ul>' +
          '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/crew/dia/' + f.id + '/' + d.iso + '">' + icone('pino', 16) + 'Mapa do dia</a>' +
          (podeAprovar && s.status !== 'aprovado' ? '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-ajustar" data-id="' + f.id + '" data-dia="' + d.iso + '">Ajustar</button>' : '') + '</div></section>').join('') + '</div>',
  });
}

/* ---------- Formatação de valores ---------- */

function pct(v, casas) { return (v * 100).toFixed(casas || 0).replace('.', ',') + '%'; }
function dinheiroInteiro(v) { return 'US$ ' + Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function dinheiroCurto(v) {
  if (Math.abs(v) < 10000) return dinheiroInteiro(v);
  if (Math.abs(v) < 100000) return 'US$ ' + (v / 1000).toFixed(1).replace('.', ',').replace(',0', '') + ' mil';
  return 'US$ ' + (v / 1000).toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ' mil';
}

/* ---------- Administrador: custos ---------- */

const STATUS_OBRA = {
  'no-rumo': ['No rumo', 'etiqueta-verde'], atencao: ['Atenção', 'etiqueta-ambar'], estouro: ['Estouro previsto', 'etiqueta-alerta'], 'sem-orcamento': ['Sem orçamento', 'etiqueta-neutro'],
};

function abasCustos(ativa) {
  const abas = [['obras', 'Obras', '#/crew/custos'], ['mes', 'Mês', '#/crew/custos/mes'], ['semana', 'Semana', '#/crew/custos/semana']];
  return '<nav class="abas-segmento" aria-label="Período">' + abas.map(([id, r, h]) => '<a href="' + h + '"' + (id === ativa ? ' class="ativa" aria-current="page"' : '') + '>' + r + '</a>').join('') + '</nav>';
}

function blocoEncargos() {
  const v = encargosVersao(hoje());
  return '<p class="dica">Custos com <b>' + pct(encargos(), 2).replace(',00', '') + ' de encargos sobre a folha</b> (' + v.itens.map((i) => esc(i.nome.split(' (')[0]) + ' ' + String(i.pct).replace('.', ',') + '%').join(' · ') + '), vigentes desde ' + dataCurta(v.desde) + '. ' +
    '<a href="#/settings/encargos">Configurar em Settings</a></p>';
}

function telaCustos(modo, ref) {
  // compatibilidade: #/crew/custos/AAAA-MM-DD = semana
  if (modo && /^\d{4}-\d{2}-\d{2}$/.test(modo)) { ref = modo; modo = 'semana'; }
  if (modo === 'semana') return telaCustosPeriodo('semana', ref || inicioDaSemana(hoje()));
  if (modo === 'mes') return telaCustosPeriodo('mes', ref || hoje().slice(0, 7));
  return telaCustosObras();
}

function telaCustosObras() {
  const resumos = estado().obras.map((o) => resumoDaObra(o.id)).filter((r) => r.realizado > 0 || r.orcamento);
  const soma = (k) => resumos.reduce((t, r) => t + (r[k] || 0), 0);
  const saldo = soma('orcamento') - soma('projecao');
  return moldura({
    ativo: 'custos', largo: true, titulo: 'Custo de mão de obra', subtitulo: 'Orçado × realizado × projeção para o fim de cada obra',
    conteudo: abasCustos('obras') +
      '<div class="kpis">' +
        '<div class="kpi"><span>Orçamento de mão de obra</span><b>' + dinheiroCurto(soma('orcamento')) + '</b></div>' +
        '<div class="kpi kpi-azul"><span>Realizado até hoje</span><b>' + dinheiroCurto(soma('realizado')) + '</b></div>' +
        '<div class="kpi"><span>Projeção ao final</span><b>' + dinheiroCurto(soma('projecao')) + '</b></div>' +
        '<div class="kpi ' + (saldo >= 0 ? 'kpi-verde' : 'kpi-alerta') + '"><span>' + (saldo >= 0 ? 'Sobra projetada' : 'Estouro projetado') + '</span><b>' + dinheiroCurto(Math.abs(saldo)) + '</b></div>' +
      '</div>' +
      resumos.sort((a, b) => (a.saldo == null ? 1 : b.saldo == null ? -1 : a.saldo / a.orcamento - b.saldo / b.orcamento)).map(cartaoObra).join('') +
      blocoEncargos() +
      '<p class="dica">Como projetamos: com o <b>avanço físico</b> informado, projeção = realizado ÷ avanço (se gastou 31% e fez 30%, vai gastar ~3% a mais que o orçado). Sem avanço, usamos o <b>ritmo</b> das últimas 4 semanas até o fim do prazo. Só mão de obra: material, subempreiteiros e equipamentos ficam de fora (ver docs/crew.md).</p>',
  });
}

function cartaoObra(r) {
  const [rot, cls] = STATUS_OBRA[r.status];
  const barra = (rotulo, v, classe) => '<li><span class="barra-rotulo">' + rotulo + '</span><span class="barra"><span class="' + classe + '" style="width:' + Math.min(100, Math.round(v * 100)) + '%"></span></span><span class="barra-valor">' + pct(v) + '</span></li>';
  const etapas = r.etapas.filter((e) => e.orcado || e.custo).map((e) => {
    const uso = e.orcado ? e.custo / e.orcado : null;
    return '<tr><td>' + esc(e.nome) + '</td><td class="num">' + (e.orcado ? dinheiroInteiro(e.orcado) : '<span class="mudo">não orçado</span>') + '</td><td class="num">' + dinheiroInteiro(e.custo) + '</td>' +
      '<td class="num">' + (uso == null ? '—' : pct(uso)) + '</td><td>' + horas(e.min) + '</td></tr>';
  }).join('');
  return '<section class="cartao custo-obra" id="obra-' + r.obra.id + '"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(r.obra.nome) + ' <span class="etiqueta ' + cls + '">' + rot + '</span></h2>' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-orcamento" data-obra="' + r.obra.id + '">Editar orçamento</button></div>' +
    '<p class="mudo pequeno">' + dataCurta(r.obra.inicio) + ' a ' + dataCurta(r.obra.prazo) + ' · faltam ' + Math.round(r.semanasRestantes) + ' semanas</p>' +
    '<div class="numeros-obra">' +
      '<div><span>Orçamento</span><b>' + (r.orcamento ? dinheiroInteiro(r.orcamento) : '—') + '</b></div>' +
      '<div><span>Realizado</span><b>' + dinheiroInteiro(r.realizado) + '</b>' + (r.pctConsumido != null ? '<small>' + pct(r.pctConsumido) + ' do orçamento</small>' : '') + '</div>' +
      '<div><span>Projeção ao final</span><b>' + dinheiroInteiro(r.projecao) + '</b><small>' + (r.projecaoAvanco != null ? 'pelo avanço físico' : 'pelo ritmo recente') + '</small></div>' +
      '<div class="' + (r.saldo == null ? '' : r.saldo >= 0 ? 'positivo' : 'negativo') + '"><span>' + (r.saldo == null || r.saldo >= 0 ? 'Sobra projetada' : 'Estouro projetado') + '</span><b>' + (r.saldo == null ? '—' : dinheiroInteiro(Math.abs(r.saldo))) + '</b>' + (r.saldo != null ? '<small>' + pct(Math.abs(r.saldo) / r.orcamento, 1) + ' do orçamento</small>' : '') + '</div>' +
    '</div>' +
    '<ul class="barras barras-ritmo">' + barra('Prazo decorrido', r.pctPrazo, 'b-prazo') + (r.pctConsumido != null ? barra('Orçamento consumido', r.pctConsumido, r.status === 'estouro' ? 'b-estouro' : 'b-consumo') : '') + (r.avanco != null ? barra('Avanço físico', r.avanco, 'b-avanco') : '') + '</ul>' +
    graficoObra(r) +
    '<details class="detalhe-etapas"><summary>Orçado × realizado por etapa</summary><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Etapa</th><th class="num">Orçado</th><th class="num">Realizado</th><th class="num">Consumido</th><th>Horas</th></tr></thead><tbody>' + etapas + '</tbody></table></div></details>' +
    '<details class="detalhe-etapas"><summary>Semana a semana (tabela)</summary><div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Semana</th><th class="num">Custo</th><th class="num">Acumulado</th><th>Horas</th></tr></thead><tbody>' +
      r.semanas.slice().reverse().map((x) => '<tr><td><a href="#/crew/custos/semana/' + x.segunda + '">' + dataCurta(x.segunda) + '</a></td><td class="num">' + dinheiroInteiro(x.custo) + '</td><td class="num">' + dinheiroInteiro(x.acumulado) + '</td><td>' + horas(x.min) + '</td></tr>').join('') +
    '</tbody></table></div></details></section>';
}

/* Gráfico da obra: custo acumulado (realizado), o planejado (orçamento distribuído no prazo) e a projeção até o fim. */
function graficoObra(r) {
  const W = 760, H = 260, m = { l: 84, r: 132, t: 18, b: 30 };
  const n = Math.max(1, Math.ceil(diasEntre(inicioDaSemana(r.obra.inicio), r.obra.prazo) / 7));
  // escala "redonda": 4 ou 5 linhas de grade com passos 1, 2, 2,5 ou 5 × 10^k
  const bruto = Math.max(r.orcamento || 0, r.projecao, r.realizado, 1) * 1.04 / 4;
  const pot = Math.pow(10, Math.floor(Math.log10(bruto)));
  const passo = [1, 2, 2.5, 5, 10].map((k) => k * pot).find((v) => v >= bruto);
  const ymax = Math.ceil(Math.max(r.orcamento || 0, r.projecao, r.realizado, 1) * 1.04 / passo) * passo;
  const x = (i) => m.l + (W - m.l - m.r) * i / n;
  const y = (v) => H - m.b - (H - m.t - m.b) * v / ymax;
  const f1 = (v) => v.toFixed(1);
  const real = r.semanas.map((s, i) => [x(i + 1), y(s.acumulado)]);
  const ultimo = real.length ? real[real.length - 1] : [x(0), y(0)];
  const linha = (pts) => 'M' + pts.map((p) => f1(p[0]) + ',' + f1(p[1])).join('L');
  const passoY = [];
  for (let v = passo; v <= ymax + 0.5; v += passo) passoY.push(v);
  const grade = passoY.map((v) => '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(y(v)) + '" y2="' + f1(y(v)) + '" class="g-grade"/><text x="' + (m.l - 8) + '" y="' + f1(y(v) + 4) + '" class="g-eixo" text-anchor="end">' + esc(dinheiroCurto(v)) + '</text>').join('');
  const hojeX = ultimo[0];
  const rotulosX = '<text x="' + m.l + '" y="' + (H - 8) + '" class="g-eixo">' + dataCurta(r.obra.inicio).slice(0, 5) + '</text>' +
    '<text x="' + f1(hojeX) + '" y="' + (H - 8) + '" class="g-eixo" text-anchor="middle">hoje</text>' +
    '<text x="' + (W - m.r) + '" y="' + (H - 8) + '" class="g-eixo" text-anchor="end">' + dataCurta(r.obra.prazo).slice(0, 5) + '</text>';
  // rótulos à direita (orçamento e projeção) afastados no mínimo 30 unidades para não encavalar
  let yOrc = r.orcamento ? y(r.orcamento) : null, yProj = y(r.projecao);
  if (yOrc != null && Math.abs(yOrc - yProj) < 30) {
    const meio = (yOrc + yProj) / 2, sinal = r.projecao > r.orcamento ? 1 : -1;
    yProj = meio - sinal * 15; yOrc = meio + sinal * 15;
  }
  const rotulo = (yy, titulo, valor) => '<text x="' + (W - m.r + 10) + '" y="' + f1(yy - 2) + '" class="g-rotulo">' + titulo + '</text><text x="' + (W - m.r + 10) + '" y="' + f1(yy + 11) + '" class="g-rotulo-valor">' + esc(valor) + '</text>';
  const orc = r.orcamento ? '<line x1="' + m.l + '" x2="' + (W - m.r) + '" y1="' + f1(y(r.orcamento)) + '" y2="' + f1(y(r.orcamento)) + '" class="g-orcamento"/>' + rotulo(yOrc, 'Orçamento', dinheiroCurto(r.orcamento)) : '';
  const plano = r.orcamento ? '<path d="' + linha([[x(0), y(0)], [x(n), y(r.orcamento)]]) + '" class="g-planejado"/>' : '';
  const proj = '<path d="' + linha([ultimo, [x(n), y(r.projecao)]]) + '" class="g-projecao"/>' +
    '<circle cx="' + f1(x(n)) + '" cy="' + f1(y(r.projecao)) + '" r="4" class="g-ponto-projecao"/>' +
    rotulo(yProj, 'Projeção', dinheiroCurto(r.projecao));
  const dados = {
    x0: m.l, larg: W - m.l - m.r, n, W, ini: inicioDaSemana(r.obra.inicio),
    sem: r.semanas.map((s) => [Math.round(s.custo), Math.round(s.acumulado)]), orc: r.orcamento || 0, proj: Math.round(r.projecao),
  };
  return '<div class="grafico-obra"><p class="legenda-grafico"><span><i class="lg-real"></i>Realizado (acumulado)</span>' + (r.orcamento ? '<span><i class="lg-plano"></i>Planejado</span>' : '') + '<span><i class="lg-proj"></i>Projeção</span></p>' +
    '<div class="grafico-area" data-grafico="' + esc(JSON.stringify(dados)) + '"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Custo acumulado da obra: realizado ' + esc(dinheiroInteiro(r.realizado)) + ', projeção ' + esc(dinheiroInteiro(r.projecao)) + (r.orcamento ? ', orçamento ' + esc(dinheiroInteiro(r.orcamento)) : '') + '">' +
      grade + '<line x1="' + f1(hojeX) + '" x2="' + f1(hojeX) + '" y1="' + m.t + '" y2="' + (H - m.b) + '" class="g-hoje"/>' + orc + plano + proj +
      '<path d="' + linha([[x(0), y(0)]].concat(real)) + '" class="g-realizado"/>' + rotulosX +
      '<line class="g-cruz" x1="0" x2="0" y1="' + m.t + '" y2="' + (H - m.b) + '" visibility="hidden"/></svg><div class="g-dica" hidden></div></div></div>';
}

function ligarGraficos() {
  document.querySelectorAll('.grafico-area').forEach((area) => {
    const d = JSON.parse(area.dataset.grafico);
    const svg = area.querySelector('svg'), cruz = svg.querySelector('.g-cruz'), dica = area.querySelector('.g-dica');
    const mostrar = (ev) => {
      const r = svg.getBoundingClientRect();
      const vx = (ev.clientX - r.left) * d.W / r.width;
      const i = Math.round((vx - d.x0) / d.larg * d.n);
      if (i < 1 || i > d.n) { esconder(); return; }
      const xi = d.x0 + d.larg * i / d.n;
      cruz.setAttribute('x1', xi); cruz.setAttribute('x2', xi); cruz.setAttribute('visibility', 'visible');
      const sem = d.sem[i - 1];
      const linhas = [['Semana de', dataCurta(somarDias(d.ini, (i - 1) * 7))]];
      if (sem) linhas.push(['Realizado acumulado', dinheiroInteiro(sem[1])], ['Custo na semana', dinheiroInteiro(sem[0])]);
      else linhas.push(['Projeção ao final', dinheiroInteiro(d.proj)]);
      if (d.orc) linhas.push(['Planejado', dinheiroInteiro(d.orc * i / d.n)]);
      dica.replaceChildren(...linhas.map(([k, v]) => { const p = document.createElement('p'); const b = document.createElement('b'); b.textContent = v; p.append(b, ' ' + k); return p; }));
      dica.hidden = false;
      const px = xi / d.W * r.width;
      dica.style.left = Math.min(r.width - 190, Math.max(0, px + 12)) + 'px';
    };
    const esconder = () => { cruz.setAttribute('visibility', 'hidden'); dica.hidden = true; };
    svg.addEventListener('pointermove', mostrar);
    svg.addEventListener('pointerdown', mostrar);
    svg.addEventListener('pointerleave', esconder);
  });
}

function seletorMes(ym) {
  const [a, m] = ym.split('-').map(Number);
  const ant = new Date(a, m - 2, 1), prox = new Date(a, m, 1);
  const fmt = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const nome = new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  return '<div class="seletor-semana"><a class="btn btn-contorno btn-pequeno" href="#/crew/custos/mes/' + fmt(ant) + '">' + icone('voltar', 16) + 'Anterior</a>' +
    '<b>' + primeiraMaiuscula(nome) + (ym === hoje().slice(0, 7) ? ' · mês atual' : '') + '</b>' +
    (ym < hoje().slice(0, 7) ? '<a class="btn btn-contorno btn-pequeno" href="#/crew/custos/mes/' + fmt(prox) + '">Próximo' + icone('seta', 16) + '</a>' : '<span></span>') + '</div>';
}

function telaCustosPeriodo(modo, ref) {
  let ini, fim, seletor;
  if (modo === 'semana') { ini = ref; fim = somarDias(ref, 6); seletor = seletorSemana('#/crew/custos/semana', ref); }
  else {
    const [a, m] = ref.split('-').map(Number);
    ini = ref + '-01'; fim = isoDoDia(new Date(a, m, 0)); seletor = seletorMes(ref);
  }
  const p = custosDoPeriodo(ini, fim);
  const maior = Math.max(1, ...p.obras.flatMap((o) => o.etapas.map((e) => e.custo)));
  return moldura({
    ativo: 'custos', largo: true, titulo: 'Custo de mão de obra', subtitulo: modo === 'semana' ? 'Por obra e por etapa, na semana' : 'Por obra e por etapa, no mês',
    conteudo: abasCustos(modo) + seletor +
      '<div class="kpis">' +
        '<div class="kpi kpi-azul"><span>Total ' + (modo === 'semana' ? 'da semana' : 'do mês') + '</span><b>' + dinheiroInteiro(p.custo) + '</b></div>' +
        '<div class="kpi"><span>Salários (horas × valor hora)</span><b>' + dinheiroInteiro(p.base) + '</b></div>' +
        '<div class="kpi' + (p.adicional ? ' kpi-alerta' : '') + '"><span>Adicional de hora extra</span><b>' + dinheiroInteiro(p.adicional) + '</b></div>' +
        '<div class="kpi"><span>Encargos sobre a folha</span><b>' + dinheiroInteiro(p.encargos) + '</b></div>' +
      '</div>' +
      (p.obras.length ? p.obras.map((o) =>
        '<section class="cartao custo-obra"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + esc(nomeObra(o.obraId)) + '</h2><b>' + dinheiroInteiro(o.custo) + '</b></div>' +
        '<p class="mudo pequeno">' + horas(o.min) + ' · ' + o.pessoasDia + ' pessoas-dia · salários ' + dinheiroInteiro(o.base) + ' · hora extra ' + dinheiroInteiro(o.adicional) + ' · encargos ' + dinheiroInteiro(o.encargos) + '</p>' +
        '<ul class="barras">' + o.etapas.map((e) => '<li><span class="barra-rotulo">' + esc(e.nome) + '</span><span class="barra"><span style="width:' + Math.max(2, Math.round(e.custo / maior * 100)) + '%"' + (e.nome.startsWith('Deslocamento') ? ' class="desl"' : '') + '></span></span><span class="barra-valor">' + dinheiroInteiro(e.custo) + ' · ' + horas(e.min) + '</span></li>').join('') + '</ul></section>'
      ).join('') : '<p class="vazio">Nenhuma hora registrada neste período.</p>') +
      blocoEncargos() +
      '<p class="dica">Custo = horas × valor hora vigente no dia + adicional de hora extra (pela regra de jornada vigente: ' + esc(resumoRegra(regraEm(ini))) + '; rateado entre as obras pelas horas daquela semana) + encargos sobre a folha. Mudou o valor hora, a regra ou os encargos? O custo dos dias anteriores não muda.</p>',
  });
}

/* ---------- Dia de um funcionário: linha do tempo e mapa ---------- */

function semearRnd(texto) {
  let s = 0;
  for (const c of texto) s = (s * 31 + c.charCodeAt(0)) % 233280;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}

/* Registro de localização (simulado): só com o ponto aberto e pausado no intervalo.
 * Um registro a cada 15 min na obra, a cada 5 min em deslocamento e a cada 3 min fora da cerca.
 * As próprias batidas também são pontos do caminho (ver passosDoDia). */
const REGISTRO_GPS_MIN = 15;
const REGISTRO_MOVIMENTO_MIN = 5;
function trilhaDoDia(f, iso, j) {
  const rnd = semearRnd(f.id + iso);
  const exc = (estado().crew.excursoes || []).filter((e) => e.funcionarioId === f.id && e.data === iso);
  const pts = [];
  let naObra = 0;
  for (const s of j.segmentos) {
    const fim = s.fim || (s.aberto ? Date.now() : s.ini);
    if (s.tipo === 'intervalo') continue;
    if (s.tipo === 'deslocamento') {
      const anterior = j.segmentos[j.segmentos.indexOf(s) - 1];
      const de = acharObra((anterior || s).obraId), para = acharObra(s.obraId);
      const n = Math.max(2, Math.round((fim - s.ini) / (REGISTRO_MOVIMENTO_MIN * 60000)));
      for (let i = 1; i < n; i++) pts.push({ em: s.ini + (fim - s.ini) * i / n, lat: de.lat + (para.lat - de.lat) * i / n + (rnd() - 0.5) * 0.002, lon: de.lon + (para.lon - de.lon) * i / n + (rnd() - 0.5) * 0.002, situacao: 'deslocamento', obraId: para.id, precisao: 8 + Math.round(rnd() * 22) });
      continue;
    }
    const o = acharObra(s.obraId);
    // Dentro da obra a pessoa anda pouco: cada registro fica perto do anterior
    let la = o.lat, lo = o.lon;
    for (let t = s.ini + REGISTRO_GPS_MIN * 60000; t < fim; t += REGISTRO_GPS_MIN * 60000) {
      if (exc.some((x) => t >= x.ini && t <= x.fim)) continue;
      la = o.lat + ((la - o.lat) * 0.4 + (rnd() - 0.5) * 0.0007);
      lo = o.lon + ((lo - o.lon) * 0.4 + (rnd() - 0.5) * 0.0007);
      // no protótipo, o 3º registro do dia é o de quando o funcionário abriu o app
      pts.push({ em: t, lat: la, lon: lo, situacao: 'obra', obraId: o.id, precisao: 5 + Math.round(rnd() * 20), gatilho: naObra++ === 2 ? 'app' : 'periodico' });
    }
    // Saída da cerca: ida e volta até o local, a cada 3 minutos
    for (const e of exc) {
      if (e.ini < s.ini || e.ini > fim) continue;
      const n = Math.max(4, Math.round((e.fim - e.ini) / 180000));
      for (let i = 0; i <= n; i++) {
        const k = i <= n / 2 ? i / (n / 2) : (n - i) / (n / 2); // 0 → 1 → 0
        const lat = o.lat + (e.lat - o.lat) * k + (rnd() - 0.5) * 0.0003;
        const lon = o.lon + (e.lon - o.lon) * k + (rnd() - 0.5) * 0.0003;
        const fora = !dentroDaCerca(o, lat, lon);
        pts.push({ em: e.ini + (e.fim - e.ini) * i / n, lat, lon, fora, situacao: fora ? 'fora' : 'obra', obraId: o.id, local: e.local, precisao: 6 + Math.round(rnd() * 14) });
      }
    }
  }
  return { pontos: pts.sort((a, b) => a.em - b.em), excursoes: exc };
}

/* Passos do dia: batidas + registros de localização, em ordem, da entrada à saída. */
function passosDoDia(j, trilha) {
  const itens = j.batidas.filter((b) => b.lat != null).map((b) => ({ em: b.em, lat: b.lat, lon: b.lon, tipo: b.tipo, batida: true, fora: b.dentroCerca === false, obraId: b.obraId, precisao: b.precisao }))
    .concat(trilha.pontos.map((p) => ({ em: p.em, lat: p.lat, lon: p.lon, tipo: 'gps', batida: false, fora: !!p.fora, obraId: p.obraId, situacao: p.situacao, local: p.local, precisao: p.precisao, gatilho: p.gatilho })))
    .sort((a, b) => a.em - b.em);
  let total = 0;
  itens.forEach((p, i) => {
    p.n = i + 1;
    p.dist = i ? distanciaM(itens[i - 1].lat, itens[i - 1].lon, p.lat, p.lon) : 0;
    total += p.dist;
    p.rotulo = p.batida ? ROTULO_BATIDA[p.tipo] : p.gatilho === 'app' ? 'Abriu o aplicativo' : p.situacao === 'deslocamento' ? 'Em deslocamento' : p.fora ? 'Fora da cerca' : 'Localização';
    p.onde = p.situacao === 'deslocamento' ? 'a caminho de ' + nomeObra(p.obraId) : p.fora && p.local ? p.local : nomeObra(p.obraId) + (p.fora ? ' · fora da cerca' : '');
  });
  const entrada = j.batidas.find((b) => b.tipo === 'entrada');
  const saida = j.batidas.slice().reverse().find((b) => b.tipo === 'saida');
  return { itens, total, entrada: entrada ? entrada.em : null, saida: saida ? saida.em : null, aberto: j.segmentos.some((s) => s.aberto) };
}

function resumoPassos(passos) {
  return '<p class="mapa-resumo">' +
    '<span><i class="lg-inicio"></i>Entrada <b>' + (passos.entrada ? horaCurta(passos.entrada) : '—') + '</b></span>' +
    '<span><i class="lg-fim"></i>' + (passos.saida ? 'Saída <b>' + horaCurta(passos.saida) + '</b>' : passos.aberto ? '<b>Ponto aberto</b>' : 'Sem saída') + '</span>' +
    '<span><b>' + passos.itens.length + '</b> registros</span>' +
    '<span>≈ <b>' + formatarDistancia(passos.total) + '</b> percorridos</span></p>';
}

function htmlPassos(passos) {
  return '<section class="cartao" id="passos-dia"><div class="cartao-cabeca"><h2 class="cartao-titulo">Registros de localização</h2>' +
    '<span class="mudo pequeno">a cada ' + REGISTRO_GPS_MIN + ' min com o ponto aberto</span></div>' +
    '<p class="mudo pequeno">Da entrada à saída, na ordem: batidas, troca de obra, abertura do app e registros periódicos. Sem registro no intervalo e com o ponto fechado. Toque num registro para vê-lo no mapa.</p>' +
    '<ol class="passos-lista">' + passos.itens.map((p, i) => {
      const ponta = i === 0 ? ' inicio' : (i === passos.itens.length - 1 && p.tipo === 'saida' ? ' fim' : '');
      return '<li><button type="button" class="passo' + (p.batida ? ' batida' : '') + (p.fora ? ' fora' : '') + ponta + '" data-acao="crew-passo" data-n="' + p.n + '">' +
        '<span class="passo-n">' + p.n + '</span><span class="passo-hora">' + horaCurta(p.em) + '</span>' +
        '<span class="passo-texto"><b>' + esc(p.rotulo) + '</b><span>' + esc(p.onde) + (p.precisao ? ' · GPS ±' + p.precisao + ' m' : '') + '</span></span>' +
        '<span class="passo-dist">' + (i ? '+' + formatarDistancia(p.dist) : '') + '</span></button></li>';
    }).join('') + '</ol></section>';
}

function mapaSvg(j, trilha) {
  const obrasIds = Array.from(new Set(j.segmentos.map((s) => s.obraId).concat(j.batidas.map((b) => b.obraId)).filter(Boolean)));
  const pontos = trilha.pontos.concat(j.batidas.filter((b) => b.lat != null)).concat(obrasIds.map((id) => acharObra(id)));
  if (!pontos.length) return '';
  const lats = pontos.map((p) => p.lat), lons = pontos.map((p) => p.lon);
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2;
  const kx = Math.cos(lat0 * Math.PI / 180);
  let minX = Math.min(...lons) * kx, maxX = Math.max(...lons) * kx, minY = Math.min(...lats), maxY = Math.max(...lats);
  const margem = Math.max(maxX - minX, maxY - minY) * 0.15 + 0.002;
  minX -= margem; maxX += margem; minY -= margem; maxY += margem;
  const W = 640, H = 380;
  const escala = Math.min(W / (maxX - minX), H / (maxY - minY));
  const ox = (W - (maxX - minX) * escala) / 2, oy = (H - (maxY - minY) * escala) / 2;
  const xy = (lat, lon) => [ox + (lon * kx - minX) * escala, oy + (maxY - lat) * escala];
  const metrosPorGrau = 111320;
  const cercas = obrasIds.map((id) => {
    const o = acharObra(id);
    const [x, y] = xy(o.cerca.lat, o.cerca.lon);
    const r = Math.max(10, o.cerca.raio / metrosPorGrau * escala);
    return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + r.toFixed(1) + '" class="mapa-cerca"/>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y - r - 6).toFixed(1) + '" class="mapa-obra" text-anchor="middle">' + esc(o.nome) + '</text>';
  }).join('');
  const linha = trilha.pontos.map((p) => xy(p.lat, p.lon).map((v) => v.toFixed(1)).join(',')).join(' ');
  const marcas = j.batidas.filter((b) => b.lat != null).map((b) => {
    const [x, y] = xy(b.lat, b.lon);
    return '<g class="mapa-batida tipo-' + b.tipo + (b.dentroCerca === false ? ' fora' : '') + '"><circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="6"/>' +
      '<text x="' + (x + 9).toFixed(1) + '" y="' + (y + 4).toFixed(1) + '">' + horaCurta(b.em) + '</text></g>';
  }).join('');
  const pontosGps = trilha.pontos.filter((p) => !p.fora).map((p) => { const [x, y] = xy(p.lat, p.lon); return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="3" class="mapa-ponto"/>'; }).join('');
  const foras = trilha.pontos.filter((p) => p.fora).map((p) => { const [x, y] = xy(p.lat, p.lon); return '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="4" class="mapa-fora"/>'; }).join('');
  return '<svg class="mapa-dia" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Mapa do dia: trilha do GPS e batidas">' +
    '<defs><pattern id="grade-mapa" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M32 0H0V32" fill="none" class="mapa-grade"/></pattern></defs>' +
    '<rect width="' + W + '" height="' + H + '" fill="url(#grade-mapa)"/>' + cercas +
    (linha ? '<polyline points="' + linha + '" class="mapa-trilha"/>' : '') + pontosGps + foras + marcas + '</svg>';
}

/* ---------- Mapa de ruas (Leaflet + OpenStreetMap) ----------
 * A biblioteca fica no próprio projeto (vendor/leaflet). Os mapas de rua vêm da internet;
 * sem internet ou sem a biblioteca, fica o desenho simples (SVG) que já está na tela. */

/* Percurso do dia: as obras na ordem em que a pessoa esteve (paradas) e os trechos entre elas (pernas).
 * Perna = deslocamento entre obras ou saída da cerca com o ponto aberto (ida e volta). */
function percursoDoDia(j, trilha) {
  const paradas = [];
  const pernas = [];
  let atual = null;
  for (const sg of j.segmentos) {
    const fim = sg.fim || (sg.aberto ? Date.now() : null);
    if (sg.tipo === 'deslocamento') {
      const destino = acharObra(sg.obraId);
      pernas.push({ tipo: 'deslocamento', ini: sg.ini, fim, de: atual ? [atual.lat, atual.lon] : null, para: [destino.cerca.lat, destino.cerca.lon], deNome: atual ? atual.nome : '', paraNome: destino.nome });
      atual = null;
      continue;
    }
    if (!atual || atual.obraId !== sg.obraId) {
      const o = acharObra(sg.obraId);
      atual = { n: paradas.length + 1, obraId: o.id, nome: o.nome, endereco: o.endereco, cidade: o.cidade, lat: o.cerca.lat, lon: o.cerca.lon, chegada: sg.ini, saida: fim, aberto: !!sg.aberto, fora: [] };
      paradas.push(atual);
    } else {
      atual.saida = fim;
      atual.aberto = !!sg.aberto;
    }
  }
  // perna sem origem (ex.: troca logo na primeira batida): usa a obra anterior conhecida
  pernas.forEach((p) => { if (!p.de && paradas.length) { p.de = [paradas[0].lat, paradas[0].lon]; p.deNome = paradas[0].nome; } });
  for (const e of trilha.excursoes) {
    const o = paradas.find((p) => e.ini >= p.chegada && (!p.saida || e.ini <= p.saida)) || paradas[0];
    if (!o) continue;
    pernas.push({ tipo: 'saida-cerca', ini: e.ini, fim: e.fim, de: [o.lat, o.lon], via: [e.lat, e.lon], para: [o.lat, o.lon], deNome: o.nome, paraNome: o.nome, local: e.local });
  }
  // batidas fora da cerca: o endereço aproximado é buscado depois (geocodificação reversa)
  j.batidas.filter((b) => b.dentroCerca === false && b.lat != null).forEach((b) => {
    const p = paradas.find((x) => x.obraId === b.obraId) || paradas[0];
    if (!p) return;
    const o = acharObra(b.obraId);
    p.fora.push({ id: b.id, tipo: ROTULO_BATIDA[b.tipo], hora: horaCurta(b.em), lat: b.lat, lon: b.lon, distancia: distanciaM(o.cerca.lat, o.cerca.lon, b.lat, b.lon) });
  });
  pernas.sort((a, b) => a.ini - b.ini);
  return { paradas, pernas };
}

function dadosDoMapa(j, trilha, percurso, passos) {
  const naPerna = (em) => percurso.pernas.findIndex((p) => em > p.ini && em < (p.fim || p.ini));
  const obrasIds = Array.from(new Set(j.segmentos.map((s) => s.obraId).concat(j.batidas.map((b) => b.obraId)).filter(Boolean)));
  return {
    cercas: obrasIds.map((id) => { const o = acharObra(id); return { lat: o.cerca.lat, lon: o.cerca.lon, raio: o.cerca.raio, nome: o.nome }; }),
    paradas: percurso.paradas.map((p) => ({ n: p.n, lat: p.lat, lon: p.lon, nome: p.nome, endereco: p.endereco + ' · ' + p.cidade })),
    pernas: percurso.pernas.map((p) => ({ tipo: p.tipo, de: p.de, via: p.via || null, para: p.para, ini: p.ini, fim: p.fim || p.ini })),
    fora: percurso.paradas.flatMap((p) => p.fora.map((f) => ({ id: f.id, lat: f.lat, lon: f.lon }))),
    passos: passos.itens.map((p, i) => {
      const perna = naPerna(p.em);
      const pe = percurso.pernas[perna];
      return {
        n: p.n, em: p.em, lat: Number(p.lat.toFixed(6)), lon: Number(p.lon.toFixed(6)), hora: horaCurta(p.em), tipo: p.tipo, batida: p.batida, fora: p.fora,
        texto: p.n + ' · ' + horaCurta(p.em) + ' · ' + p.rotulo + ' · ' + p.onde + (p.precisao ? ' · GPS ±' + p.precisao + ' m' : ''),
        perna,
        ponta: i === 0 && p.tipo === 'entrada' ? 'inicio' : i === passos.itens.length - 1 && p.tipo === 'saida' ? 'fim' : '',
      };
    }),
  };
}

function minutosEntre(a, b) { return Math.max(0, Math.round((b - a) / 60000)); }
function formatarDistancia(m) { return m >= 1000 ? (m / 1000).toFixed(1).replace('.', ',') + ' km' : Math.round(m) + ' m'; }

function htmlPercurso(percurso) {
  const itens = percurso.paradas.map((p) => ({ em: p.chegada, html:
    '<li class="parada"><span class="parada-num">' + p.n + '</span><div><b>' + esc(p.nome) + '</b>' +
      '<span class="parada-endereco">' + icone('pino', 14) + esc(p.endereco) + ' · ' + esc(p.cidade) + '</span>' +
      '<span class="mudo pequeno">Chegada ' + horaCurta(p.chegada) + ' · ' + (p.aberto ? 'ainda na obra' : p.saida ? 'saída ' + horaCurta(p.saida) : 'sem saída') +
        (p.saida || p.aberto ? ' · ' + horas(minutosEntre(p.chegada, p.saida || Date.now())) : '') + '</span>' +
      p.fora.map((f) => '<span class="parada-fora" id="fora-' + esc(f.id) + '">' + esc(f.tipo) + ' às ' + f.hora + ' batida a ' + formatarDistancia(f.distancia) + ' da obra · <span class="endereco-fora">' + f.lat.toFixed(5) + ', ' + f.lon.toFixed(5) + '</span></span>').join('') +
    '</div></li>' }));
  percurso.pernas.forEach((p, i) => itens.push({ em: p.ini + 1, html:
    '<li class="perna perna-' + p.tipo + '" id="perna-' + i + '"><span class="perna-linha"></span><div>' +
      (p.tipo === 'deslocamento'
        ? '<b>Deslocamento ' + horaCurta(p.ini) + '–' + (p.fim ? horaCurta(p.fim) : 'agora') + (p.fim ? ' (' + minutosEntre(p.ini, p.fim) + ' min)' : '') + '</b><span class="mudo pequeno">' + esc(p.deNome) + ' → ' + esc(p.paraNome) + '</span>'
        : '<b>Saiu da cerca ' + horaCurta(p.ini) + '–' + horaCurta(p.fim) + ' (' + minutosEntre(p.ini, p.fim) + ' min)</b><span class="mudo pequeno">' + esc(p.local) + ', com o ponto aberto</span>') +
      '<span class="perna-dist">' + formatarDistancia(distanciaM(p.de[0], p.de[1], (p.via || p.para)[0], (p.via || p.para)[1]) * (p.via ? 2 : 1)) + ' em linha reta' + (p.via ? ' (ida e volta)' : '') + '</span>' +
    '</div></li>' }));
  itens.sort((a, b) => a.em - b.em);
  return '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Percurso do dia</h2><span class="mudo pequeno">' + percurso.paradas.length + (percurso.paradas.length === 1 ? ' obra' : ' obras') + '</span></div>' +
    '<ol class="percurso">' + itens.map((x) => x.html).join('') + '</ol></section>';
}

let leafletPromessa = null;
function carregarLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  if (!leafletPromessa) {
    leafletPromessa = new Promise((ok, falha) => {
      const css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = 'vendor/leaflet/leaflet.css';
      document.head.appendChild(css);
      const js = document.createElement('script');
      js.src = 'vendor/leaflet/leaflet.js';
      js.onload = () => ok(window.L);
      js.onerror = () => { leafletPromessa = null; falha(new Error('Leaflet indisponível')); };
      document.head.appendChild(js);
    });
  }
  return leafletPromessa;
}

/* Rota pelas ruas entre pontos (serviço público OSRM, gratuito para protótipo).
 * Devolve { coords: [[lat, lon]…], distancia (m), duracao (s) } ou null sem internet. */
const rotasCache = new Map();
function rotaPelasRuas(pontos) {
  const chave = pontos.map((p) => p[1].toFixed(5) + ',' + p[0].toFixed(5)).join(';');
  if (!rotasCache.has(chave)) {
    const url = 'https://router.project-osrm.org/route/v1/driving/' + chave + '?overview=full&geometries=geojson';
    rotasCache.set(chave, fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => {
      const rota = j && j.code === 'Ok' && j.routes && j.routes[0];
      return rota ? { coords: rota.geometry.coordinates.map(([lon, lat]) => [lat, lon]), distancia: rota.distance, duracao: rota.duration } : null;
    }).catch(() => { rotasCache.delete(chave); return null; }));
  }
  return rotasCache.get(chave);
}

/* Endereço aproximado de uma coordenada (Nominatim / OpenStreetMap). */
const enderecosCache = new Map();
function enderecoAproximado(lat, lon) {
  const chave = lat.toFixed(5) + ',' + lon.toFixed(5);
  if (!enderecosCache.has(chave)) {
    const url = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=en-US&lat=' + lat + '&lon=' + lon;
    enderecosCache.set(chave, fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => {
      if (!j) return null;
      const a = j.address || {};
      const rua = [a.house_number, a.road].filter(Boolean).join(' '); // formato americano: número antes da rua
      const resto = [a.suburb || a.neighbourhood, a.city || a.town || a.village].filter(Boolean).join(' · ');
      return [rua, resto].filter(Boolean).join(' · ') || j.display_name || null;
    }).catch(() => { enderecosCache.delete(chave); return null; }));
  }
  return enderecosCache.get(chave);
}

let mapaAtual = null;
const COR_BATIDA = { entrada: '#0F766E', 'intervalo-inicio': '#667085', 'intervalo-fim': '#667085', troca: '#1D4ED8', chegada: '#1D4ED8', etapa: '#0F766E', saida: '#141B26' };

async function montarMapa() {
  const area = document.getElementById('mapa-dia');
  if (!area || area.dataset.montado) return;
  area.dataset.montado = '1';
  let L;
  try { L = await carregarLeaflet(); } catch (e) { return; } // fica o SVG
  if (!document.body.contains(area)) return;
  const d = JSON.parse(area.dataset.mapa);
  area.innerHTML = '';
  area.classList.add('com-ruas');
  const m = L.map(area, { scrollWheelZoom: true, zoomControl: true, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m);
  const limites = [];
  for (const c of d.cercas) {
    L.circle([c.lat, c.lon], { radius: c.raio, color: '#0F766E', weight: 2, dashArray: '6 5', fillColor: '#0F766E', fillOpacity: 0.12 }).addTo(m);
    limites.push(L.latLng(c.lat, c.lon).toBounds(c.raio * 2));
  }
  // obras na ordem da visita: pino numerado com nome e endereço, logo acima da cerca
  for (const p of d.paradas) {
    const c = d.cercas.find((x) => x.nome === p.nome);
    const topo = [p.lat + (c ? c.raio : 150) / 111320, p.lon];
    L.marker(topo, { icon: L.divIcon({ className: 'pino-parada', html: '<span class="pino"><b>' + p.n + '</b></span>', iconSize: [28, 28], iconAnchor: [14, 28] }) })
      .addTo(m).bindTooltip('<b>' + esc(p.nome) + '</b><br>' + esc(p.endereco), { permanent: true, direction: 'top', className: 'mapa-rotulo-obra', offset: [0, -26] });
  }
  // pernas (deslocamento entre obras e saída da cerca): primeiro em linha reta tracejada;
  // depois, pelas ruas (OSRM), quando houver internet
  const rotas = d.pernas.map(() => null);
  const passos = d.passos;
  const fracao = (pe, em) => Math.max(0, Math.min(1, (em - pe.ini) / ((pe.fim - pe.ini) || 1)));
  const posicao = (p) => (p.perna >= 0 && rotas[p.perna] ? aoLongo(rotas[p.perna], fracao(d.pernas[p.perna], p.em)).pos : [p.lat, p.lon]);
  // caminho entre dois registros seguidos: pela rota da perna, se houver, ou em linha reta
  const caminho = (a, b) => {
    const k = d.pernas.findIndex((pe) => pe.ini < b.em && pe.fim > a.em);
    if (k >= 0 && rotas[k]) return [posicao(a)].concat(trechoDaRota(rotas[k], fracao(d.pernas[k], a.em), fracao(d.pernas[k], b.em))).concat([posicao(b)]);
    return [posicao(a), posicao(b)];
  };
  const corDoTrecho = (a, b) => {
    const pe = d.pernas.find((x) => x.ini < b.em && x.fim > a.em);
    return pe ? (pe.tipo === 'deslocamento' ? '#1D4ED8' : '#F04438') : '#2E90FA';
  };
  // na obra: o caminho entre os registros, em linha fina
  let trecho = [];
  const fecharTrecho = () => { if (trecho.length > 1) L.polyline(trecho, { color: '#2E90FA', weight: 3, opacity: 0.75, lineJoin: 'round' }).addTo(m); trecho = []; };
  passos.forEach((p, i) => {
    if (p.perna >= 0) { fecharTrecho(); return; }
    const ant = passos[i - 1];
    if (ant && d.pernas.some((pe) => pe.ini < p.em && pe.fim > ant.em)) fecharTrecho();
    trecho.push([p.lat, p.lon]);
  });
  fecharTrecho();
  const setas = L.layerGroup().addTo(m);
  const desenharSetas = () => {
    setas.clearLayers();
    passos.forEach((p, i) => {
      if (!i) return;
      const cam = caminho(passos[i - 1], p);
      const comp = comprimento(cam);
      if (comp < 40) return;
      for (const f of [0.5]) {
        const { pos, ang } = aoLongo(cam, f);
        L.marker(pos, { interactive: false, keyboard: false, icon: L.divIcon({ className: 'seta-rota', html: '<span style="transform:rotate(' + ang.toFixed(0) + 'deg);background:' + corDoTrecho(passos[i - 1], p) + '"></span>', iconSize: [14, 14], iconAnchor: [7, 7] }) }).addTo(setas);
      }
    });
  };
  const marcadores = new Map();
  d.pernas.forEach((p, i) => {
    const pontos = [p.de].concat(p.via ? [p.via] : []).concat([p.para]);
    const cor = p.tipo === 'deslocamento' ? '#1D4ED8' : '#F04438';
    const reta = L.polyline(pontos, { color: cor, weight: 3, opacity: 0.7, dashArray: '8 8' }).addTo(m);
    limites.push(reta.getBounds());
    rotaPelasRuas(pontos).then((r) => {
      if (!r || !document.body.contains(area)) return;
      m.removeLayer(reta);
      L.polyline(r.coords, { color: cor, weight: 5, opacity: 0.85, lineJoin: 'round' }).addTo(m);
      rotas[i] = r.coords;
      // os registros feitos no caminho vão para cima da rua (proporcional ao horário)
      passos.filter((x) => x.perna === i).forEach((x) => { const mk = marcadores.get(x.n); if (mk) mk.setLatLng(posicao(x)); });
      desenharSetas();
      const el = document.querySelector('#perna-' + i + ' .perna-dist');
      if (el) el.textContent = formatarDistancia(r.distancia) + ' pelas ruas' + (p.via ? ' (ida e volta)' : '') + ' · cerca de ' + Math.max(1, Math.round(r.duracao / 60)) + ' min de carro';
    });
  });
  desenharSetas();
  // endereço aproximado de onde foram batidas as entradas/saídas fora da cerca
  for (const f of d.fora) {
    enderecoAproximado(f.lat, f.lon).then((txt) => {
      const el = txt && document.querySelector('#fora-' + CSS.escape(f.id) + ' .endereco-fora');
      if (el) el.textContent = 'perto de ' + txt;
    });
  }
  // os registros: entrada (verde), saída (grafite), batidas e registros de localização
  for (const p of passos) {
    let mk;
    if (p.ponta) {
      mk = L.marker([p.lat, p.lon], { zIndexOffset: 500, icon: L.divIcon({ className: 'pino-ponto ' + p.ponta, html: '<span class="pino"><b>' + (p.ponta === 'inicio' ? 'E' : 'S') + '</b></span>', iconSize: [26, 26], iconAnchor: [13, 26] }) })
        .bindTooltip((p.ponta === 'inicio' ? 'Entrada ' : 'Saída ') + p.hora, { permanent: true, direction: 'right', className: 'mapa-rotulo-hora', offset: [10, -14] });
    } else if (p.batida) {
      const intervalo = p.tipo.startsWith('intervalo') && !p.fora;
      mk = L.circleMarker([p.lat, p.lon], { radius: intervalo ? 6 : 8, color: '#fff', weight: 2, fillColor: p.fora ? '#F04438' : (COR_BATIDA[p.tipo] || '#0F766E'), fillOpacity: 1 })
        .bindTooltip(intervalo ? p.texto : p.hora, { permanent: !intervalo, direction: 'right', className: 'mapa-rotulo-hora secundario', offset: [8, 0] });
    } else {
      mk = L.circleMarker(posicao(p), { radius: 5, color: '#fff', weight: 1.5, fillColor: p.fora ? '#F04438' : '#2E90FA', fillOpacity: 1 })
        .bindTooltip(p.texto, { direction: 'top', className: 'mapa-rotulo-passo' });
    }
    mk.addTo(m).on('click', () => selecionarPasso(p.n, 'mapa'));
    marcadores.set(p.n, mk);
    limites.push(L.latLngBounds([p.lat, p.lon], [p.lat, p.lon]));
  }
  const total = limites.reduce((acc, l) => acc.extend(l), L.latLngBounds(limites[0].getSouthWest(), limites[0].getNorthEast()));
  // de longe, só os horários de entrada e saída (os demais aparecem ao aproximar)
  const ajustarRotulos = () => area.classList.toggle('zoom-longe', m.getZoom() < 15);
  m.on('zoomend', ajustarRotulos);
  m.fitBounds(total, { padding: [40, 40], maxZoom: 17 });
  ajustarRotulos();

  // destaque do registro escolhido e reprodução (playback) do percurso
  const halo = L.circleMarker([0, 0], { radius: 15, color: '#C2410C', weight: 3, fill: false, interactive: false });
  const pessoa = L.marker([0, 0], { interactive: false, keyboard: false, zIndexOffset: 1000, icon: L.divIcon({ className: 'pessoa-rota', html: '<span></span>', iconSize: [22, 22], iconAnchor: [11, 11] }) });
  const relogio = L.DomUtil.create('div', 'mapa-relogio', area);
  relogio.hidden = true;
  let atual = 0, quadro = null;
  function destacar(n) {
    const mk = marcadores.get(n);
    if (!mk) return;
    halo.setLatLng(mk.getLatLng()).addTo(m);
    document.querySelectorAll('.passo.ativo').forEach((el) => el.classList.remove('ativo'));
    const linha = document.querySelector('.passo[data-n="' + n + '"]');
    if (linha) {
      linha.classList.add('ativo');
      const lista = linha.closest('.passos-lista');
      if (lista) lista.scrollTop = linha.offsetTop - lista.offsetTop - lista.clientHeight / 2;
    }
  }
  function selecionarPasso(n, origem) {
    if (quadro) pausar();
    pessoa.remove();
    relogio.hidden = true;
    atual = n - 1;
    destacar(n);
    const mk = marcadores.get(n);
    if (origem === 'lista' && mk) {
      m.setView(mk.getLatLng(), Math.max(m.getZoom(), 18));
      mk.openTooltip();
      const cartao = document.getElementById('mapa-cartao');
      const r = cartao.getBoundingClientRect();
      if (r.top < 0 || r.top > innerHeight * 0.5) cartao.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
  function botao(tocando) {
    const b = document.querySelector('[data-acao="crew-reproduzir"]');
    if (b) b.innerHTML = icone(tocando ? 'pausa' : 'play', 16) + '<span>' + (tocando ? 'Pausar' : 'Reproduzir') + '</span>';
  }
  function pausar() { cancelAnimationFrame(quadro); quadro = null; botao(false); }
  function reproduzir() {
    if (quadro) { pausar(); return; }
    if (atual >= passos.length - 1) atual = 0;
    halo.remove();
    pessoa.setLatLng(posicao(passos[atual])).addTo(m);
    relogio.hidden = false;
    botao(true);
    let ini = null;
    const passo = (t) => {
      if (!document.body.contains(area)) return;
      const a = passos[atual], b = passos[atual + 1];
      if (!b) { pausar(); destacar(a.n); relogio.textContent = a.hora + ' · ' + 'Fim do dia'; return; }
      const cam = caminho(a, b);
      // duração pelo tamanho do trecho na tela: andar dentro da obra passa rápido, a viagem é visível
      const pa = m.latLngToContainerPoint(cam[0]), pb = m.latLngToContainerPoint(cam[cam.length - 1]);
      const dur = Math.max(160, Math.min(1500, pa.distanceTo(pb) * 9));
      if (ini == null) ini = t;
      const k = Math.min(1, (t - ini) / dur);
      const pos = aoLongo(cam, k).pos;
      pessoa.setLatLng(pos);
      relogio.textContent = horaCurta(a.em + (b.em - a.em) * k) + ' · ' + (b.batida ? b.texto.split(' · ')[2] : a.texto.split(' · ')[2]);
      if (!m.getBounds().pad(-0.1).contains(pos)) m.panTo(pos, { animate: false });
      if (k >= 1) { atual++; ini = null; destacar(b.n); halo.remove(); }
      quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
  }
  mapaAtual = { m, selecionarPasso, reproduzir, parar: () => { if (quadro) cancelAnimationFrame(quadro); quadro = null; } };
}

/* Geometria simples sobre uma linha [[lat, lon]…]: comprimento, ponto a uma fração e direção. */
function comprimento(coords) {
  let t = 0;
  for (let i = 1; i < coords.length; i++) t += distanciaM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
  return t;
}
function rumo(a, b) { return Math.atan2((b[1] - a[1]) * Math.cos(a[0] * Math.PI / 180), b[0] - a[0]) * 180 / Math.PI; }
function aoLongo(coords, f) {
  if (coords.length < 2) return { pos: coords[0], ang: 0 };
  let alvo = Math.max(0, Math.min(1, f)) * comprimento(coords);
  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1], b = coords[i];
    const d = distanciaM(a[0], a[1], b[0], b[1]);
    if (alvo <= d || i === coords.length - 1) {
      const k = d ? Math.min(1, alvo / d) : 0;
      return { pos: [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k], ang: rumo(a, b) };
    }
    alvo -= d;
  }
}
function trechoDaRota(coords, fa, fb) {
  if (fb <= fa) return [];
  const total = comprimento(coords);
  const out = [aoLongo(coords, fa).pos];
  let acc = 0;
  for (let i = 1; i < coords.length; i++) {
    acc += distanciaM(coords[i - 1][0], coords[i - 1][1], coords[i][0], coords[i][1]);
    const f = acc / (total || 1);
    if (f > fa && f < fb) out.push(coords[i]);
  }
  out.push(aoLongo(coords, fb).pos);
  return out;
}

/* Chamado depois de desenhar uma tela do Crew. */
export function aposDesenharCrew() {
  if (mapaAtual) mapaAtual.parar();
  mapaAtual = null;
  ligarGraficos();
  montarMapa();
}

function alternarTelaCheia(forcarSair) {
  const cartao = document.getElementById('mapa-cartao');
  if (!cartao) return;
  const cheio = forcarSair ? false : !cartao.classList.contains('tela-cheia');
  cartao.classList.toggle('tela-cheia', cheio);
  document.body.classList.toggle('sem-rolagem', cheio);
  const rotulo = cartao.querySelector('[data-acao="crew-mapa-cheio"] span');
  if (rotulo) rotulo.textContent = cheio ? 'Sair da tela cheia' : 'Tela cheia';
  if (mapaAtual) setTimeout(() => mapaAtual.m.invalidateSize(), 50);
}

document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') alternarTelaCheia(true); });

function telaDia(funcId, iso) {
  const f = funcionario(funcId);
  if (!f) return { trocar: '#/crew' };
  const u = usuarioAtual();
  const admin = pode(u, 'crew.acompanhar');
  const j = jornada(funcId, iso);
  const trilha = admin ? trilhaDoDia(f, iso, j) : { pontos: [], excursoes: [] };
  const percurso = admin ? percursoDoDia(j, trilha) : null;
  const passos = admin ? passosDoDia(j, trilha) : null;
  const eventos = j.batidas.map((b) => ({
    em: b.em, html: '<span><b>' + ROTULO_BATIDA[b.tipo] + '</b> · ' + esc(nomeObra(b.obraId)) + (b.etapa ? ' · ' + esc(b.etapa) : '') + '</span>' +
      '<span class="mudo pequeno">' + (b.ajuste ? 'Ajuste de ' + esc(b.ajuste.por) + ': "' + esc(b.ajuste.motivo) + '"'
        : (b.fonteGps === 'gps' ? (b.dentroCerca ? 'Dentro da cerca' : 'Fora da cerca' + (b.conferida ? ' · conferida' : '')) + ' · GPS ±' + b.precisao + ' m' : 'Sem GPS') +
          ' · registrado por ' + esc((estado().usuarios.find((x) => x.id === b.registradoPor) || {}).nome || '—') + (b.foto ? ' · com foto' : '')) + '</span>',
    classe: b.ajuste ? 'ajuste' : b.dentroCerca === false ? 'fora' : '',
  })).concat(trilha.excursoes.map((e) => ({
    em: e.ini, html: '<span><b>Saiu da cerca com o ponto aberto</b> · ' + horaCurta(e.ini) + '–' + horaCurta(e.fim) + '</span><span class="mudo pequeno">' + esc(e.local) + ' (trilha do GPS)</span>', classe: 'fora',
  }))).sort((a, b) => a.em - b.em);
  const voltar = admin ? { href: '#/crew/semana/' + f.id + '/' + inicioDaSemana(iso), rotulo: 'Semana de ' + f.nome.split(' ')[0] } : { href: '#/crew/equipe', rotulo: 'Ponto da equipe' };
  return moldura({
    ativo: admin ? 'timesheets' : 'equipe', largo: admin, titulo: f.nome, subtitulo: primeiraMaiuscula(diaDaSemana(iso)) + ', ' + dataCurta(iso) + ' · ' + horas(j.pago) + ' pagas',
    voltar,
    conteudo:
      (j.alertas.length ? '<p class="alertas-dia">' + j.alertas.map((a) => '<span class="etiqueta etiqueta-alerta">' + esc(a.texto) + '</span>').join('') + '</p>' : '') +
      '<div class="dia-coluna">' +
        (admin ? '<section class="cartao mapa-cartao" id="mapa-cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Mapa do dia <span class="etiqueta etiqueta-neutro">Trilha simulada</span></h2>' +
            (j.batidas.length ? '<div class="mapa-botoes"><button type="button" class="btn btn-primario btn-pequeno" data-acao="crew-reproduzir">' + icone('play', 16) + '<span>Reproduzir</span></button>' +
              '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="crew-mapa-cheio">' + icone('olho', 16) + '<span>Tela cheia</span></button></div>' : '') + '</div>' +
          (j.batidas.length ? resumoPassos(passos) + '<div class="mapa-area" id="mapa-dia" data-mapa="' + esc(JSON.stringify(dadosDoMapa(j, trilha, percurso, passos))) + '">' + mapaSvg(j, trilha) + '</div>' : '<p class="vazio">Sem batidas neste dia.</p>') +
          '<p class="legenda-mapa"><span><i class="lg-inicio"></i>entrada</span><span><i class="lg-fim"></i>saída</span><span><i class="lg-ponto"></i>registro de localização</span><span><i class="lg-seta"></i>sentido do percurso</span><span><i class="lg-parada">1</i>obra (ordem da visita)</span><span><i class="lg-cerca"></i>cerca da obra</span><span><i class="lg-desloc"></i>deslocamento</span><span><i class="lg-batida"></i>batida</span><span><i class="lg-fora"></i>fora da cerca</span></p>' +
          '<p class="mudo pequeno">A localização só é registrada com o ponto aberto: na entrada, na saída, na troca de obra, quando o app é aberto e a cada ' + REGISTRO_GPS_MIN + ' min (a cada ' + REGISTRO_MOVIMENTO_MIN + ' min em deslocamento). Nada é registrado no intervalo nem com o ponto fechado. O trabalhador é avisado e vê o próprio mapa. No protótipo, os registros são simulados; na versão real, vêm do GPS do app nativo.</p></section>' +
          (j.batidas.length ? htmlPercurso(percurso) + htmlPassos(passos) : '') : '') +
        '<section class="cartao"><h2 class="cartao-titulo">Linha do tempo</h2>' +
          (eventos.length ? '<ol class="linha-tempo">' + eventos.map((e) => '<li class="' + e.classe + '"><span class="lt-hora">' + horaCurta(e.em) + '</span><div>' + e.html + '</div></li>').join('') + '</ol>' : '<p class="vazio">Sem batidas neste dia.</p>') +
          '<div class="resumo-dia"><span>Trabalho <b>' + horas(j.trabalho) + '</b></span><span>Deslocamento <b>' + horas(j.deslocamento) + '</b></span><span>Intervalo <b>' + horas(j.intervalo) + '</b></span></div>' +
        '</section>' +
      '</div>',
  });
}

/* ---------- Notificações do Crew (para o sininho) ---------- */

export function notificacoesCrew(u) {
  const c = estado().crew;
  if (!c) return [];
  const lista = [];
  const hojeIso = hoje();
  if (pode(u, 'crew.acompanhar')) {
    const anterior = somarDias(inicioDaSemana(hojeIso), -7);
    const pend = todosFuncionarios().filter((f) => semana(f.id, anterior).status === 'pendente').length;
    if (pend && pode(u, 'crew.aprovar')) lista.push({ id: 'crew-ts-' + anterior, em: new Date(inicioDaSemana(hojeIso) + 'T08:00:00').getTime(), modulo: 'crew', titulo: pend + ' timesheets da semana passada aguardando aprovação', href: '#/crew/timesheets/' + anterior });
    for (const b of c.batidas.filter((x) => x.dentroCerca === false && !x.conferida && x.em > Date.now() - 2 * 86400000)) {
      lista.push({ id: 'crew-fora-' + b.id, em: b.em, modulo: 'crew', titulo: funcionario(b.funcionarioId).nome + ': ' + ROTULO_BATIDA[b.tipo].toLowerCase() + ' fora da obra', href: '#/crew/agora' });
    }
  } else if (pode(u, 'crew.ponto.equipe')) {
    const eq = equipeDoEncarregado(u.id);
    if (eq) {
      const ms = membros(eq.id);
      const ontem = somarDias(hojeIso, -1);
      for (const f of ms) if (jornada(f.id, ontem).alertas.some((a) => a.tipo === 'sem-saida')) {
        lista.push({ id: 'crew-semsaida-' + f.id + ontem, em: new Date(hojeIso + 'T07:00:00').getTime(), modulo: 'crew', titulo: f.nome + ' ficou sem saída ontem: avise o escritório', href: '#/crew/horas' });
      }
      const h = new Date().getHours();
      if (h >= 8 && new Date().getDay() !== 0 && ms.every((f) => !jornada(f.id, hojeIso).batidas.length)) {
        lista.push({ id: 'crew-semponto-' + hojeIso, em: new Date(hojeIso + 'T08:00:00').getTime(), modulo: 'crew', titulo: 'Sua equipe ainda não bateu a entrada hoje', href: '#/crew/equipe' });
      }
    }
  }
  return lista;
}
