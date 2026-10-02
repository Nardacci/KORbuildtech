/* KORbuild RDO — telas, navegação e fila de envio. */

import {
  esc, novoId, hoje, somarDias, diasEntre, dataCurta, dataLonga, dataRelativa, horaCurta, dataHora, tamanho,
  toast, abrirDialogo, confirmar,
} from './util.js';
import {
  estado, definirEstado, salvar, obra as acharObra, rdo as acharRdo, rdosDaObra, rdoDoDia, recebido, registrar,
  guardarFoto, apagarFoto, hidratarFotos, apagarTudo,
} from './armazem.js';
import { criarDemonstracao, PESSOAS, CONSTRUTORA } from './exemplo.js';
import { processarFoto } from './fotos.js';
import { buscarClima, TEMPOS } from './clima.js';
import { melhorarTexto, ditar, ditadoDisponivel } from './ia.js';
import { lacrar, conferirLacre } from './lacre.js';
import { htmlRelatorio, seloStatus, iconeTempo, SITUACOES, STATUS_EQUIP, TIPOS_OCORRENCIA, STATUS_RDO } from './relatorio.js';

const app = document.getElementById('app');

const FUNCOES = ['Pedreiro', 'Servente', 'Carpinteiro', 'Armador', 'Eletricista', 'Encanador', 'Pintor', 'Mestre de obras', 'Encarregado', 'Engenheiro(a)', 'Operador de máquinas'];
const EQUIPAMENTOS = ['Betoneira 400 L', 'Andaime', 'Grua', 'Guincho de coluna', 'Retroescavadeira', 'Escavadeira', 'Caminhão betoneira', 'Vibrador de concreto', 'Rolo compactador', 'Serra circular de bancada'];

/* ---------- Estado de tela (não vai para o armazenamento) ---------- */

let rotaAnterior = '';
let climaCarregando = false;
let fotosProcessando = '';
let pararDitado = null;
let sincronizando = null; // { feito, total, nome }
let pedidoInstalar = null;

/* ---------- Conexão (real + simulada) ---------- */

function semInternet() {
  return !navigator.onLine || estado().offlineSimulado;
}

function htmlConexao() {
  const pendentes = estado().rdos.filter((r) => r.sync === 'pendente').length;
  if (sincronizando) {
    return '<span class="pontinho azul"></span>Enviando ' + esc(sincronizando.nome) + ' · ' + sincronizando.feito + '/' + sincronizando.total;
  }
  if (semInternet()) {
    return '<span class="pontinho ambar"></span>Sem internet' + (estado().offlineSimulado ? ' (simulado)' : '') +
      (pendentes ? ' · ' + pendentes + ' no aparelho' : '');
  }
  return '<span class="pontinho verde"></span>Online';
}

function atualizarConexao() {
  const el = document.getElementById('conexao');
  if (el) el.innerHTML = htmlConexao();
}

const espera = (ms) => new Promise((ok) => setTimeout(ok, ms));

/* Envia ao "servidor" os RDOs guardados no aparelho. Foto por foto, como seria de verdade. */
async function sincronizar() {
  if (sincronizando || semInternet()) return;
  const fila = estado().rdos.filter((r) => r.sync === 'pendente');
  if (!fila.length) return;
  let enviados = 0;
  for (const r of fila) {
    const o = acharObra(r.obraId);
    sincronizando = { feito: 0, total: r.fotos.length + 1, nome: 'RDO nº ' + r.numero };
    r.sync = 'enviando';
    atualizarConexao();
    let interrompido = false;
    for (let i = 0; i <= r.fotos.length; i++) {
      await espera(450);
      if (semInternet()) { interrompido = true; break; }
      sincronizando.feito = i + 1;
      atualizarConexao();
    }
    if (interrompido) {
      r.sync = 'pendente';
      salvar();
      break;
    }
    r.sync = 'enviado';
    registrar(r, 'Aparelho de ' + r.autor, 'Recebido no escritório (' + r.fotos.length + ' fotos, ' + tamanho(r.fotos.reduce((s, f) => s + f.tamanho, 0)) + ')');
    salvar();
    enviados++;
    toast('RDO nº ' + r.numero + ' (' + o.nome + ') chegou ao escritório.');
  }
  sincronizando = null;
  if (enviados) desenhar(); else atualizarConexao();
}

/* ---------- Navegação ---------- */

function rota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return partes.length ? partes : [''];
}

function desenhar() {
  const p = rota();
  const chave = location.hash;
  const focoAntes = chaveDoFoco(document.activeElement);
  let html;
  if (p[0] === 'campo' && p[1] === 'obra') html = telaObraCampo(p[2]);
  else if (p[0] === 'campo' && p[1] === 'rdo') html = telaRdoCampo(p[2]);
  else if (p[0] === 'campo') html = telaCampo();
  else if (p[0] === 'painel' && p[1] === 'rdo') html = telaRdoPainel(p[2]);
  else if (p[0] === 'painel') html = telaPainel();
  else if (p[0] === 'pdf') html = telaPdf(p[1]);
  else if (p[0] === 'cliente') html = telaCliente(p[1]);
  else html = telaInicio();
  app.innerHTML = html;
  document.body.dataset.modo = p[0] || 'inicio';
  if (chave !== rotaAnterior) {
    window.scrollTo(0, 0);
    rotaAnterior = chave;
  } else if (focoAntes) {
    const alvo = Array.from(app.querySelectorAll('[data-acao]')).find((el) => chaveDoFoco(el) === focoAntes);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  hidratarFotos(app);
  if (p[0] === 'cliente') verificarLacreNaTela(p[1]);
}

function chaveDoFoco(el) {
  if (!el || !el.dataset || !el.dataset.acao) return '';
  const d = el.dataset;
  return [d.acao, d.i, d.campo, d.valor, d.turno].join('|');
}

function ir(hash) {
  if (location.hash === hash) desenhar();
  else location.hash = hash;
}

/* ---------- Moldura ---------- */

function moldura({ modo, titulo, subtitulo, voltar, conteudo, rodape, largo }) {
  const marca = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>';
  const esquerda = voltar
    ? '<a class="barra-voltar" href="' + voltar + '" aria-label="Voltar"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></a>'
    : '<a class="barra-marca" href="#/" aria-label="Início da demonstração"><span class="marca-icone">' + marca + '</span></a>';
  return '<div class="faixa-prototipo">Protótipo · dados fictícios · ' +
      (modo === 'campo' ? 'você é ' + PESSOAS.campo.nome + ', do canteiro' : modo === 'painel' ? 'você é ' + PESSOAS.escritorio.nome + ', do escritório' : 'KORbuild RDO') +
      ' · <a href="#/">trocar</a></div>' +
    '<header class="barra"><div class="barra-dentro' + (largo ? ' largo' : '') + '">' + esquerda +
      '<div class="barra-titulo"><b>' + esc(titulo) + '</b>' + (subtitulo ? '<span>' + esc(subtitulo) + '</span>' : '') + '</div>' +
      '<button type="button" class="conexao" id="conexao" data-acao="alternar-internet" title="Tocar para simular a falta de internet">' + htmlConexao() + '</button>' +
    '</div></header>' +
    '<main class="conteudo' + (largo ? ' largo' : '') + '">' + conteudo + '</main>' +
    (rodape || '');
}

/* ---------- Início da demonstração ---------- */

function telaInicio() {
  return '<div class="faixa-prototipo">Protótipo de validação · todos os dados são fictícios</div>' +
  '<main class="inicio">' +
    '<div class="inicio-topo"><span class="marca-icone grande"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg></span>' +
      '<span class="marca-nome">KORbuild <span>RDO</span></span></div>' +
    '<h1>O diário da obra, preenchido no canteiro em poucos minutos.</h1>' +
    '<p class="inicio-sub">Fotos com data, hora e GPS, clima automático, equipe e atividades. Funciona sem internet e chega ao escritório pronto para aprovar e virar PDF.</p>' +
    '<div class="perfis">' +
      '<a class="perfil" href="#/campo"><span class="perfil-icone campo"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"/><path d="M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/></svg></span>' +
        '<span><b>Canteiro</b><span>' + PESSOAS.campo.nome + ' · ' + PESSOAS.campo.papel + '</span><small>No celular: preencher e enviar o RDO do dia</small></span></a>' +
      '<a class="perfil" href="#/painel"><span class="perfil-icone escritorio"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-4"/></svg></span>' +
        '<span><b>Escritório</b><span>' + PESSOAS.escritorio.nome + ' · Engenheira responsável</span><small>No computador: acompanhar as obras, aprovar e gerar o PDF</small></span></a>' +
    '</div>' +
    '<details class="roteiro" open><summary>Roteiro da demonstração (5 minutos)</summary><ol>' +
      '<li><b>Canteiro</b> → Residencial Jardim das Flores → <b>Começar copiando o RDO de ontem</b>. Equipe e equipamentos já vêm preenchidos.</li>' +
      '<li>O clima é buscado sozinho pela localização da obra. Tire uma ou duas fotos: veja o carimbo com data, hora e GPS e quanto a foto encolheu.</li>' +
      '<li>Em uma atividade, toque em <b>Ditar</b> (ou digite) <i>"hj a gente fecho a viga 2 mas faltou cimento pq a entrega atrasou"</i> e toque em <b>Melhorar texto</b>.</li>' +
      '<li>Toque em <b>Online</b>, no topo, para simular a falta de internet, e envie. O RDO fica guardado no aparelho. Toque de novo e ele sobe sozinho.</li>' +
      '<li><b>Escritório</b>: o farol da obra fica verde. Abra o RDO, aprove (ele fica lacrado), baixe o PDF e copie o link do cliente.</li>' +
      '<li>No Galpão Logístico há um RDO com <b>ajustes pedidos</b>: corrija pelo canteiro e reenvie.</li>' +
    '</ol></details>' +
    '<div class="inicio-acoes">' +
      '<button type="button" class="btn btn-claro" data-acao="instalar"' + (pedidoInstalar ? '' : ' hidden') + ' id="btn-instalar">Instalar no celular</button>' +
      '<button type="button" class="btn btn-claro" data-acao="recomecar">Recomeçar a demonstração</button>' +
    '</div>' +
  '</main>';
}

/* ---------- Canteiro: minhas obras ---------- */

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function situacaoHoje(o) {
  const r = rdoDoDia(o.id, hoje());
  if (!r) return { classe: 'ambar', texto: 'RDO de hoje não iniciado' };
  if (r.status === 'rascunho') return { classe: 'neutro', texto: 'RDO de hoje em rascunho' };
  if (r.sync !== 'enviado') return { classe: 'ambar', texto: 'Guardado no aparelho · sobe quando houver internet' };
  if (r.status === 'enviado') return { classe: 'azul', texto: 'Enviado · aguardando aprovação' };
  if (r.status === 'ajustes') return { classe: 'alerta', texto: 'Ajustes pedidos pelo escritório' };
  return { classe: 'verde', texto: 'Aprovado' };
}

function telaCampo() {
  const { obras, rdos } = estado();
  const ajustes = rdos.filter((r) => r.status === 'ajustes');
  return moldura({
    modo: 'campo', titulo: 'Minhas obras', subtitulo: CONSTRUTORA.nome,
    conteudo:
      '<div class="ola"><h1>' + saudacao() + ', ' + PESSOAS.campo.nome.split(' ')[0] + '</h1><p>' + dataLonga(hoje()) + '</p></div>' +
      ajustes.map((r) => {
        const o = acharObra(r.obraId);
        return '<a class="aviso aviso-alerta" href="#/campo/rdo/' + r.id + '"><b>O escritório pediu ajustes no RDO nº ' + r.numero + '</b>' +
          '<span>' + esc(o.nome) + ' · ' + dataCurta(r.data) + '</span><span class="aviso-citacao">"' + esc(r.motivoAjuste) + '"</span><span class="aviso-link">Corrigir agora →</span></a>';
      }).join('') +
      '<h2 class="titulo-secao">Obras em andamento</h2>' +
      '<div class="lista">' + obras.map((o) => {
        const s = situacaoHoje(o);
        return '<a class="cartao-obra" href="#/campo/obra/' + o.id + '">' +
          '<div class="cartao-obra-topo"><b>' + esc(o.nome) + '</b><span class="seta">›</span></div>' +
          '<span class="mudo">' + esc(o.cidade) + ' · ' + esc(o.etapa) + '</span>' +
          '<span class="etiqueta etiqueta-' + s.classe + '">' + s.texto + '</span></a>';
      }).join('') + '</div>',
  });
}

/* ---------- Canteiro: uma obra ---------- */

function telaObraCampo(id) {
  const o = acharObra(id);
  if (!o) return naoEncontrado('#/campo');
  const lista = rdosDaObra(o.id);
  const deHoje = rdoDoDia(o.id, hoje());
  const ultimo = lista.find((r) => r.data < hoje());
  let acoes;
  if (deHoje) {
    acoes = '<a class="btn btn-primario btn-grande" href="#/campo/rdo/' + deHoje.id + '">' + (deHoje.status === 'rascunho' ? 'Continuar o RDO de hoje' : 'Ver o RDO de hoje') + '</a>';
  } else {
    acoes = (ultimo
      ? '<button type="button" class="btn btn-primario btn-grande" data-acao="novo-rdo" data-obra="' + o.id + '" data-copiar="1">Começar copiando o RDO de ' + (diasEntre(ultimo.data, hoje()) === 1 ? 'ontem' : dataCurta(ultimo.data)) + '</button>' +
        '<p class="dica">Traz a equipe, os equipamentos e as atividades que ainda estavam em andamento. Você só ajusta o que mudou.</p>'
      : '') +
      '<button type="button" class="btn ' + (ultimo ? 'btn-contorno' : 'btn-primario btn-grande') + '" data-acao="novo-rdo" data-obra="' + o.id + '">Começar o RDO de hoje em branco</button>';
  }
  return moldura({
    modo: 'campo', titulo: o.nome, subtitulo: o.cidade, voltar: '#/campo',
    conteudo:
      '<section class="cartao obra-resumo">' +
        '<div class="linha-info"><span>Cliente</span><b>' + esc(o.cliente) + '</b></div>' +
        '<div class="linha-info"><span>Etapa atual</span><b>' + esc(o.etapa) + '</b></div>' +
        '<div class="linha-info"><span>Endereço</span><b>' + esc(o.endereco) + '</b></div>' +
      '</section>' +
      '<section class="acoes-obra"><h2 class="titulo-secao">Hoje · ' + dataLonga(hoje()) + '</h2>' + acoes + '</section>' +
      '<h2 class="titulo-secao">RDOs anteriores</h2>' +
      '<div class="lista">' + lista.filter((r) => r !== deHoje).map(itemRdo).join('') + '</div>',
  });
}

function itemRdo(r) {
  const pessoas = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  return '<a class="item-rdo" href="#/campo/rdo/' + r.id + '"><div><b>RDO nº ' + r.numero + ' · ' + dataRelativa(r.data) + '</b>' +
    '<span class="mudo">' + pessoas + ' pessoas · ' + r.atividades.length + ' atividades · ' + r.fotos.length + ' fotos</span></div>' + seloStatus(r) + '</a>';
}

function novoRdo(obraId, copiar) {
  const lista = rdosDaObra(obraId);
  const base = copiar ? lista.find((r) => r.data < hoje()) : null;
  const numero = Math.max(0, ...estado().rdos.filter((r) => r.obraId === obraId).map((r) => r.numero)) + 1;
  const r = {
    id: novoId('rdo'), obraId, data: hoje(), numero, status: 'rascunho', sync: 'local',
    autor: PESSOAS.campo.nome, criadoEm: Date.now(),
    clima: { manha: {}, tarde: {}, fonte: null },
    equipe: base ? base.equipe.map((e) => ({ funcao: e.funcao, presentes: e.presentes, faltas: 0 })) : [],
    equipamentos: base ? base.equipamentos.map((e) => ({ ...e })) : [],
    atividades: base ? base.atividades.filter((a) => a.situacao !== 'concluida').map((a) => ({ id: novoId('at'), descricao: a.descricao, local: a.local, situacao: 'andamento' })) : [],
    ocorrencias: [], fotos: [], observacoes: '', historico: [],
  };
  if (!r.atividades.length) r.atividades.push({ id: novoId('at'), descricao: '', local: '', situacao: 'andamento' });
  registrar(r, PESSOAS.campo.nome, base ? 'Começou o RDO copiando o RDO nº ' + base.numero : 'Começou o RDO');
  estado().rdos.push(r);
  salvar();
  ir('#/campo/rdo/' + r.id);
  climaAutomatico(r, true);
}

/* ---------- Canteiro: preencher o RDO ---------- */

function editavel(r) { return r.status === 'rascunho' || r.status === 'ajustes'; }

function pendencias(r) {
  const p = [];
  if (!r.clima.manha.tempo || !r.clima.tarde.tempo) p.push('Clima da manhã e da tarde');
  if (!r.equipe.some((e) => Number(e.presentes) > 0)) p.push('Pelo menos uma pessoa na equipe');
  if (!r.atividades.some((a) => a.descricao.trim())) p.push('Pelo menos uma atividade descrita');
  return p;
}

function telaRdoCampo(id) {
  const r = acharRdo(id);
  if (!r) return naoEncontrado('#/campo');
  const o = acharObra(r.obraId);
  if (!editavel(r)) return telaRdoLeitura(r, o);

  const p = pendencias(r);
  const passos = [
    ['Clima', !!(r.clima.manha.tempo && r.clima.tarde.tempo)],
    ['Equipe', r.equipe.some((e) => Number(e.presentes) > 0)],
    ['Atividades', r.atividades.some((a) => a.descricao.trim())],
    ['Fotos', r.fotos.length > 0],
  ];
  return moldura({
    modo: 'campo', titulo: 'RDO nº ' + r.numero, subtitulo: o.nome + ' · ' + dataRelativa(r.data), voltar: '#/campo/obra/' + o.id,
    conteudo:
      (r.status === 'ajustes'
        ? '<div class="aviso aviso-alerta"><b>O escritório pediu ajustes</b><span class="aviso-citacao">"' + esc(r.motivoAjuste) + '"</span><span>Corrija e toque em "Reenviar".</span></div>'
        : '') +
      '<nav class="passos" aria-label="O que já foi preenchido">' + passos.map(([nome, ok]) =>
        '<a href="#s-' + nome.toLowerCase() + '" class="' + (ok ? 'ok' : '') + '" data-acao="rolar" data-alvo="s-' + nome.toLowerCase() + '"><span>' + (ok ? '✓' : '') + '</span>' + nome + '</a>').join('') + '</nav>' +
      secaoClima(r, o) + secaoEquipe(r) + secaoEquipamentos(r) + secaoAtividades(r) + secaoOcorrencias(r) + secaoFotos(r) + secaoObservacoes(r) +
      '<p class="salvo" id="salvo">Tudo o que você preenche fica salvo no aparelho, mesmo sem internet.</p>',
    rodape:
      '<div class="rodape-envio"><div class="rodape-dentro">' +
        '<span class="rodape-status">' + (p.length ? 'Falta: ' + esc(p.join(', ').toLowerCase()) : 'Pronto para enviar' + (r.fotos.length ? '' : ' · sem fotos')) + '</span>' +
        '<button type="button" class="btn btn-primario" data-acao="enviar">' + (r.status === 'ajustes' ? 'Reenviar' : 'Enviar para aprovação') + '</button>' +
      '</div></div>',
  });
}

function cabecalhoSecao(id, titulo, ok, extra) {
  return '<header class="secao-topo"><h2>' + titulo + '</h2>' + (extra || '') + (ok ? '<span class="feito" aria-label="Preenchido">✓</span>' : '') + '</header>';
}

function secaoClima(r, o) {
  const fonte = { automatico: 'Buscado automaticamente pela localização da obra', ajustado: 'Automático, com ajuste seu', manual: 'Marcado à mão' }[r.clima.fonte] || 'Ainda não informado';
  const turno = (chave, nome) => {
    const t = r.clima[chave] || {};
    return '<div class="turno"><div class="turno-nome"><b>' + nome + '</b>' + (t.temperatura != null ? '<span class="mudo">' + t.temperatura + ' °C' + (t.chuvaMm ? ' · ' + String(t.chuvaMm).replace('.', ',') + ' mm' : '') + '</span>' : '') + '</div>' +
      '<div class="opcoes" role="group" aria-label="Tempo de ' + nome.toLowerCase() + '">' + Object.entries(TEMPOS).map(([v, rot]) =>
        '<button type="button" class="opcao tempo-' + v + '" data-acao="clima-tempo" data-turno="' + chave + '" data-valor="' + v + '" aria-pressed="' + (t.tempo === v) + '">' + iconeTempo(v) + rot + '</button>').join('') + '</div>' +
      '<div class="opcoes opcoes-texto" role="group" aria-label="Condição do canteiro de ' + nome.toLowerCase() + '">' +
        '<button type="button" class="opcao" data-acao="clima-prat" data-turno="' + chave + '" data-valor="1" aria-pressed="' + (t.praticavel === true) + '">Praticável</button>' +
        '<button type="button" class="opcao" data-acao="clima-prat" data-turno="' + chave + '" data-valor="0" aria-pressed="' + (t.praticavel === false) + '">Impraticável</button>' +
      '</div></div>';
  };
  return '<section class="secao" id="s-clima">' + cabecalhoSecao('clima', 'Clima', r.clima.manha.tempo && r.clima.tarde.tempo) +
    '<p class="secao-nota">' + (climaCarregando ? '<span class="girando"></span>Buscando o clima de ' + esc(o.cidade) + '…' : fonte) + '</p>' +
    turno('manha', 'Manhã') + turno('tarde', 'Tarde') +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="clima-auto"' + (climaCarregando ? ' disabled' : '') + '>Buscar clima automático</button>' +
  '</section>';
}

function stepper(acao, i, campo, valor, rotulo) {
  return '<div class="stepper" role="group" aria-label="' + rotulo + '">' +
    '<button type="button" data-acao="' + acao + '" data-i="' + i + '" data-campo="' + campo + '" data-valor="-1" aria-label="Diminuir ' + rotulo + '">−</button>' +
    '<span aria-live="polite">' + valor + '</span>' +
    '<button type="button" data-acao="' + acao + '" data-i="' + i + '" data-campo="' + campo + '" data-valor="1" aria-label="Aumentar ' + rotulo + '">+</button></div>';
}

function secaoEquipe(r) {
  const total = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  const faltas = r.equipe.reduce((s, e) => s + Number(e.faltas || 0), 0);
  const usadas = new Set(r.equipe.map((e) => e.funcao));
  return '<section class="secao" id="s-equipe">' + cabecalhoSecao('equipe', 'Equipe', total > 0, '<span class="secao-total">' + total + ' presentes' + (faltas ? ' · ' + faltas + (faltas === 1 ? ' falta' : ' faltas') : '') + '</span>') +
    (r.equipe.length ? '<div class="tabela-edicao"><div class="tabela-cab"><span>Função</span><span>Presentes</span><span>Faltas</span><span></span></div>' +
      r.equipe.map((e, i) => '<div class="tabela-linha"><b>' + esc(e.funcao) + '</b>' +
        stepper('equipe-mudar', i, 'presentes', e.presentes, 'presentes de ' + esc(e.funcao)) +
        stepper('equipe-mudar', i, 'faltas', e.faltas, 'faltas de ' + esc(e.funcao)) +
        '<button type="button" class="remover" data-acao="equipe-remover" data-i="' + i + '" aria-label="Remover ' + esc(e.funcao) + '">×</button></div>').join('') + '</div>'
      : '<p class="vazio">Toque nas funções abaixo para adicionar quem está na obra hoje.</p>') +
    '<div class="chips">' + FUNCOES.filter((f) => !usadas.has(f)).map((f) => '<button type="button" class="chip" data-acao="equipe-add" data-valor="' + esc(f) + '">+ ' + esc(f) + '</button>').join('') + '</div>' +
    '<div class="adicionar-outro"><input type="text" id="outra-funcao" placeholder="Outra função" aria-label="Outra função"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="equipe-outra">Adicionar</button></div>' +
  '</section>';
}

function secaoEquipamentos(r) {
  const usados = new Set(r.equipamentos.map((e) => e.nome));
  return '<section class="secao" id="s-equipamentos">' + cabecalhoSecao('equipamentos', 'Equipamentos', false) +
    (r.equipamentos.length ? r.equipamentos.map((e, i) =>
      '<div class="equip"><div class="equip-topo"><b>' + esc(e.nome) + '</b>' + stepper('equip-mudar', i, 'qtd', e.qtd, 'quantidade de ' + esc(e.nome)) +
      '<button type="button" class="remover" data-acao="equip-remover" data-i="' + i + '" aria-label="Remover ' + esc(e.nome) + '">×</button></div>' +
      '<div class="opcoes opcoes-texto" role="group" aria-label="Situação de ' + esc(e.nome) + '">' + Object.entries(STATUS_EQUIP).map(([v, rot]) =>
        '<button type="button" class="opcao eq-op-' + v + '" data-acao="equip-status" data-i="' + i + '" data-valor="' + v + '" aria-pressed="' + (e.status === v) + '">' + rot + '</button>').join('') + '</div></div>').join('')
      : '<p class="vazio">Nenhum equipamento hoje.</p>') +
    '<div class="chips">' + EQUIPAMENTOS.filter((f) => !usados.has(f)).map((f) => '<button type="button" class="chip" data-acao="equip-add" data-valor="' + esc(f) + '">+ ' + esc(f) + '</button>').join('') + '</div>' +
    '<div class="adicionar-outro"><input type="text" id="outro-equip" placeholder="Outro equipamento" aria-label="Outro equipamento"><button type="button" class="btn btn-contorno btn-pequeno" data-acao="equip-outro">Adicionar</button></div>' +
  '</section>';
}

function ferramentasTexto(alvo) {
  return '<div class="ferramentas">' +
    '<button type="button" class="ferramenta' + (pararDitado && pararDitado.alvo === alvo ? ' gravando' : '') + '" data-acao="ditar" data-alvo="' + alvo + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>' +
      (pararDitado && pararDitado.alvo === alvo ? 'Parar' : 'Ditar') + '</button>' +
    '<button type="button" class="ferramenta ia" data-acao="melhorar" data-alvo="' + alvo + '">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/></svg>' +
      'Melhorar texto</button></div>';
}

function secaoAtividades(r) {
  return '<section class="secao" id="s-atividades">' + cabecalhoSecao('atividades', 'Atividades do dia', r.atividades.some((a) => a.descricao.trim())) +
    r.atividades.map((a, i) =>
      '<div class="atividade">' +
        '<div class="atividade-topo"><span class="numero">' + (i + 1) + '</span>' +
        '<button type="button" class="remover" data-acao="ativ-remover" data-i="' + i + '" aria-label="Remover atividade ' + (i + 1) + '">×</button></div>' +
        '<label class="visualmente-oculto" for="at-' + i + '">Descrição da atividade ' + (i + 1) + '</label>' +
        '<textarea id="at-' + i + '" rows="3" data-bind="atividades.' + i + '.descricao" placeholder="O que foi feito? Ex.: concretagem da laje do 2º pavimento, 45 m³">' + esc(a.descricao) + '</textarea>' +
        ferramentasTexto('atividades.' + i + '.descricao') +
        '<div class="atividade-campos">' +
          '<input type="text" data-bind="atividades.' + i + '.local" value="' + esc(a.local) + '" placeholder="Local / etapa" aria-label="Local ou etapa da atividade ' + (i + 1) + '">' +
          '<select data-bind="atividades.' + i + '.situacao" aria-label="Situação da atividade ' + (i + 1) + '">' +
            Object.entries(SITUACOES).map(([v, rot]) => '<option value="' + v + '"' + (a.situacao === v ? ' selected' : '') + '>' + rot + '</option>').join('') +
          '</select></div>' +
      '</div>').join('') +
    '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="ativ-add">+ Adicionar atividade</button>' +
  '</section>';
}

function secaoOcorrencias(r) {
  return '<section class="secao" id="s-ocorrencias">' + cabecalhoSecao('ocorrencias', 'Ocorrências', false) +
    (r.ocorrencias.length ? r.ocorrencias.map((oc, i) =>
      '<div class="atividade ocorrencia"><div class="atividade-topo"><b>' + TIPOS_OCORRENCIA[oc.tipo] + '</b>' +
        '<button type="button" class="remover" data-acao="ocor-remover" data-i="' + i + '" aria-label="Remover ocorrência">×</button></div>' +
        '<textarea rows="2" data-bind="ocorrencias.' + i + '.descricao" placeholder="O que aconteceu e qual o impacto?" aria-label="Descrição da ocorrência">' + esc(oc.descricao) + '</textarea>' +
        ferramentasTexto('ocorrencias.' + i + '.descricao') + '</div>').join('')
      : '<p class="vazio">Algo atrapalhou o dia? Registre aqui: atraso de material, chuva, equipamento parado, acidente. Isso protege a construtora se houver atraso.</p>') +
    '<div class="chips">' + Object.entries(TIPOS_OCORRENCIA).map(([v, rot]) => '<button type="button" class="chip" data-acao="ocor-add" data-valor="' + v + '">+ ' + rot + '</button>').join('') + '</div>' +
  '</section>';
}

function secaoFotos(r) {
  const totalOriginal = r.fotos.reduce((s, f) => s + f.tamanhoOriginal, 0);
  const total = r.fotos.reduce((s, f) => s + f.tamanho, 0);
  return '<section class="secao" id="s-fotos">' + cabecalhoSecao('fotos', 'Fotos', r.fotos.length > 0, r.fotos.length ? '<span class="secao-total">' + r.fotos.length + ' · ' + tamanho(total) + '</span>' : '') +
    '<div class="botoes-foto">' +
      '<label class="btn btn-primario"><input type="file" accept="image/*" capture="environment" data-fotos="camera" class="visualmente-oculto">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Tirar foto</label>' +
      '<label class="btn btn-contorno"><input type="file" accept="image/*" multiple data-fotos="galeria" class="visualmente-oculto">Da galeria</label>' +
    '</div>' +
    (fotosProcessando ? '<p class="secao-nota"><span class="girando"></span>' + esc(fotosProcessando) + '</p>' : '') +
    (r.fotos.length ? '<p class="secao-nota">Cada foto recebe o carimbo de data, hora e GPS e é reduzida no próprio celular: ' + tamanho(totalOriginal) + ' viraram ' + tamanho(total) + '.</p>' : '<p class="vazio">Fotos do antes, do durante e do depois. O carimbo de data, hora e GPS entra na própria imagem.</p>') +
    '<div class="fotos-grade">' + r.fotos.map((f, i) =>
      '<figure class="foto"><img data-foto="' + esc(f.id) + '" alt="Foto ' + (i + 1) + '">' +
        '<figcaption><input type="text" data-bind="fotos.' + i + '.legenda" value="' + esc(f.legenda) + '" placeholder="Legenda (ex.: armação antes da concretagem)" aria-label="Legenda da foto ' + (i + 1) + '">' +
        '<span class="mudo">' + horaCurta(f.tiradaEm) + ' · ' + (f.fonteGps === 'gps' ? 'GPS ✓' + (f.precisao ? ' ±' + f.precisao + ' m' : '') : 'sem GPS, local da obra') + ' · ' + tamanho(f.tamanhoOriginal) + ' → ' + tamanho(f.tamanho) + '</span></figcaption>' +
        '<button type="button" class="remover sobre-foto" data-acao="foto-remover" data-i="' + i + '" aria-label="Remover foto ' + (i + 1) + '">×</button></figure>').join('') + '</div>' +
  '</section>';
}

function secaoObservacoes(r) {
  return '<section class="secao" id="s-observacoes">' + cabecalhoSecao('observacoes', 'Observações gerais', false) +
    '<textarea rows="3" data-bind="observacoes" placeholder="Opcional: recados para o escritório, pendências para amanhã…" aria-label="Observações gerais">' + esc(r.observacoes) + '</textarea>' +
    ferramentasTexto('observacoes') +
  '</section>';
}

function telaRdoLeitura(r, o) {
  let aviso = '';
  if (r.sync === 'pendente' || r.sync === 'enviando') {
    aviso = '<div class="aviso aviso-ambar"><b>Guardado no aparelho</b><span>Sem internet agora. O RDO sobe sozinho, com as fotos, assim que a conexão voltar. Pode fechar o app.</span>' +
      '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="sincronizar">Tentar enviar agora</button></div>';
  } else if (r.status === 'enviado') {
    aviso = '<div class="aviso aviso-azul"><b>Enviado ao escritório' + (r.enviadoEm ? ' às ' + horaCurta(r.enviadoEm) : '') + '</b><span>Aguardando a aprovação de ' + PESSOAS.escritorio.nome + '. Se ela pedir ajustes, você recebe aqui.</span></div>';
  } else if (r.status === 'aprovado') {
    aviso = '<div class="aviso aviso-verde"><b>Aprovado e lacrado</b><span>Depois de aprovado, o RDO não pode mais ser alterado por ninguém. Código ' + esc(r.codigo) + '.</span>' +
      '<a class="btn btn-contorno btn-pequeno" href="#/pdf/' + r.id + '">Ver PDF</a></div>';
  }
  return moldura({
    modo: 'campo', titulo: 'RDO nº ' + r.numero, subtitulo: o.nome + ' · ' + dataRelativa(r.data), voltar: '#/campo/obra/' + o.id,
    conteudo: aviso + '<div class="relatorio-tela">' + htmlRelatorio(r, o) + '</div>',
  });
}

/* ---------- Escritório: painel ---------- */

function farol(o) {
  const recebidos = rdosDaObra(o.id).filter(recebido);
  const ultimo = recebidos[0];
  if (!ultimo) return { cor: 'vermelho', texto: 'Nenhum RDO recebido', ultimo };
  const dias = diasEntre(ultimo.data, hoje());
  if (dias <= 0) return { cor: 'verde', texto: 'RDO de hoje recebido', ultimo };
  if (dias === 1) return { cor: 'amarelo', texto: 'Último RDO ontem · 1 dia de atraso', ultimo };
  return { cor: 'vermelho', texto: 'Último RDO há ' + dias + ' dias', ultimo };
}

function telaPainel() {
  const { obras, rdos } = estado();
  const recebidos = rdos.filter(recebido);
  const aguardando = recebidos.filter((r) => r.status === 'enviado').sort((a, b) => (a.data < b.data ? -1 : 1));
  const ajustes = recebidos.filter((r) => r.status === 'ajustes');
  const aprovados = recebidos.filter((r) => r.status === 'aprovado').sort((a, b) => b.aprovadoEm - a.aprovadoEm).slice(0, 6);
  const faroes = obras.map((o) => ({ o, ...farol(o) }));
  const deHoje = recebidos.filter((r) => r.data === hoje());
  const fotosHoje = deHoje.reduce((s, r) => s + r.fotos.length, 0);
  const atrasadas = faroes.filter((f) => f.cor !== 'verde').length;

  return moldura({
    modo: 'painel', titulo: 'Painel do escritório', subtitulo: CONSTRUTORA.nome, largo: true,
    conteudo:
      '<div class="ola"><h1>' + saudacao() + ', ' + PESSOAS.escritorio.nome.split(' ')[0] + '</h1><p>' + dataLonga(hoje()) + '</p></div>' +
      '<div class="kpis">' +
        kpi('RDOs de hoje', deHoje.length + ' de ' + obras.length, deHoje.length === obras.length ? 'verde' : '') +
        kpi('Aguardando sua aprovação', aguardando.length, aguardando.length ? 'azul' : '') +
        kpi('Obras com RDO atrasado', atrasadas, atrasadas ? 'alerta' : 'verde') +
        kpi('Fotos recebidas hoje', fotosHoje, '') +
      '</div>' +
      '<div class="painel-grade">' +
        '<section class="cartao"><h2 class="cartao-titulo">Farol das obras</h2><p class="mudo pequeno">Verde: RDO de hoje recebido · amarelo: 1 dia de atraso · vermelho: 2 dias ou mais</p>' +
          '<ul class="faroes">' + faroes.map((f) =>
            '<li><span class="farol farol-' + f.cor + '" role="img" aria-label="' + f.cor + '"></span><div><b>' + esc(f.o.nome) + '</b><span class="mudo">' + esc(f.o.cidade) + ' · ' + f.texto + '</span></div>' +
            (f.ultimo ? '<a class="btn btn-contorno btn-pequeno" href="#/painel/rdo/' + f.ultimo.id + '">Último RDO</a>' : '') + '</li>').join('') + '</ul>' +
        '</section>' +
        '<section class="cartao"><h2 class="cartao-titulo">Aguardando aprovação <span class="contador">' + aguardando.length + '</span></h2>' +
          (aguardando.length ? '<ul class="fila">' + aguardando.map((r) => itemPainel(r, 'Revisar')).join('') + '</ul>' : '<p class="vazio">Nada pendente. Tudo aprovado.</p>') +
          (ajustes.length ? '<h3 class="subtitulo">Com o canteiro para ajustes</h3><ul class="fila">' + ajustes.map((r) => itemPainel(r, 'Ver')).join('') + '</ul>' : '') +
        '</section>' +
      '</div>' +
      '<section class="cartao"><h2 class="cartao-titulo">Aprovados recentemente</h2>' +
        '<ul class="fila">' + aprovados.map((r) => {
          const o = acharObra(r.obraId);
          return '<li><div><b>RDO nº ' + r.numero + ' · ' + esc(o.nome) + '</b><span class="mudo">' + dataCurta(r.data) + ' · aprovado ' + dataHora(r.aprovadoEm) + ' · código ' + esc(r.codigo) + '</span></div>' +
            '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/painel/rdo/' + r.id + '">Abrir</a><a class="btn btn-contorno btn-pequeno" href="#/pdf/' + r.id + '">PDF</a></div></li>';
        }).join('') + '</ul>' +
      '</section>',
  });
}

function kpi(rotulo, valor, cor) {
  return '<div class="kpi' + (cor ? ' kpi-' + cor : '') + '"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
}

function itemPainel(r, acao) {
  const o = acharObra(r.obraId);
  const pessoas = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  return '<li><div><b>RDO nº ' + r.numero + ' · ' + esc(o.nome) + '</b><span class="mudo">' + dataRelativa(r.data) + ' · ' + esc(r.autor) + ' · ' + pessoas + ' pessoas · ' + r.fotos.length + ' fotos' +
    (r.ocorrencias.length ? ' · <span class="texto-alerta">' + r.ocorrencias.length + (r.ocorrencias.length === 1 ? ' ocorrência' : ' ocorrências') + '</span>' : '') + '</span></div>' +
    '<a class="btn ' + (acao === 'Revisar' ? 'btn-primario' : 'btn-contorno') + ' btn-pequeno" href="#/painel/rdo/' + r.id + '">' + acao + '</a></li>';
}

/* ---------- Escritório: revisar um RDO ---------- */

function telaRdoPainel(id) {
  const r = acharRdo(id);
  if (!r || !recebido(r)) {
    return moldura({ modo: 'painel', titulo: 'RDO', voltar: '#/painel', largo: true,
      conteudo: '<div class="aviso aviso-ambar"><b>Este RDO ainda não chegou ao escritório</b><span>Ele pode estar em rascunho ou guardado no celular, esperando internet.</span></div>' });
  }
  const o = acharObra(r.obraId);
  let painelAcoes;
  if (r.status === 'enviado') {
    painelAcoes = '<h2 class="cartao-titulo">Revisão</h2><p class="mudo pequeno">Confira o relatório. Ao aprovar, ele é lacrado e não pode mais ser alterado.</p>' +
      '<button type="button" class="btn btn-primario btn-bloco" data-acao="aprovar">Aprovar e lacrar</button>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-acao="pedir-ajustes">Pedir ajustes ao canteiro</button>';
  } else if (r.status === 'ajustes') {
    painelAcoes = '<h2 class="cartao-titulo">Com o canteiro</h2><p class="aviso-citacao">"' + esc(r.motivoAjuste) + '"</p><p class="mudo pequeno">Quando ' + esc(r.autor) + ' reenviar, o RDO volta para a sua fila.</p>';
  } else {
    painelAcoes = '<h2 class="cartao-titulo">Aprovado e lacrado</h2>' +
      '<p class="mudo pequeno">Código de verificação</p><p class="codigo grande">' + esc(r.codigo) + '</p>' +
      '<a class="btn btn-primario btn-bloco" href="#/pdf/' + r.id + '">Baixar PDF</a>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-acao="copiar-link">Copiar link para o cliente</button>' +
      '<a class="btn btn-contorno btn-bloco" href="#/cliente/' + r.codigo + '">Ver como o cliente vê</a>';
  }
  const historico = '<h3 class="subtitulo">Histórico</h3><ol class="historico">' + r.historico.map((h) =>
    '<li><span class="mudo">' + dataHora(h.em) + '</span><b>' + esc(h.quem) + '</b><span>' + esc(h.acao) + '</span></li>').join('') + '</ol>';
  return moldura({
    modo: 'painel', titulo: 'RDO nº ' + r.numero + ' · ' + o.nome, subtitulo: dataLonga(r.data), voltar: '#/painel', largo: true,
    conteudo: '<div class="revisao"><div class="relatorio-tela">' + htmlRelatorio(r, o) + '</div>' +
      '<aside class="revisao-lado"><div class="cartao fixo">' + painelAcoes + historico + '</div></aside></div>',
  });
}

/* ---------- PDF ---------- */

function telaPdf(id) {
  const r = acharRdo(id);
  if (!r) return naoEncontrado('#/');
  const o = acharObra(r.obraId);
  const voltar = recebido(r) ? '#/painel/rdo/' + r.id : '#/campo/rdo/' + r.id;
  return '<div class="pdf-barra nao-imprimir"><a class="btn btn-claro btn-pequeno" href="' + voltar + '">← Voltar</a>' +
      '<span>Pré-visualização do PDF (A4)</span>' +
      '<button type="button" class="btn btn-limao btn-pequeno" data-acao="imprimir">Baixar PDF</button></div>' +
    '<div class="pdf-folha">' + htmlRelatorio(r, o) + '</div>' +
    '<p class="pdf-dica nao-imprimir">Na janela que abrir, escolha "Salvar como PDF". Na versão final, o PDF é gerado no servidor e chega pronto.</p>';
}

/* ---------- Link do cliente ---------- */

function telaCliente(codigo) {
  const r = estado().rdos.find((x) => x.codigo === codigo && x.status === 'aprovado');
  if (!r) {
    return '<main class="conteudo"><div class="aviso aviso-ambar"><b>Relatório não encontrado</b><span>Confira o link. No protótipo não há servidor, então o link do cliente só abre no mesmo navegador em que o RDO foi aprovado.</span></div></main>';
  }
  const o = acharObra(r.obraId);
  return '<div class="cliente-topo"><div><span class="mudo">Relatório compartilhado por</span><b>' + esc(CONSTRUTORA.nome) + '</b></div>' +
      '<a class="btn btn-claro btn-pequeno" href="#/pdf/' + r.id + '">Baixar PDF</a></div>' +
    '<main class="conteudo largo">' +
      '<div class="aviso aviso-verde" id="verificacao"><b>Verificando o lacre…</b></div>' +
      '<div class="relatorio-tela" id="cliente-relatorio">' + htmlRelatorio(r, o) + '</div>' +
    '</main>';
}

async function verificarLacreNaTela(codigo) {
  const r = estado().rdos.find((x) => x.codigo === codigo && x.status === 'aprovado');
  if (!r) return;
  const o = acharObra(r.obraId);
  const ok = await conferirLacre(r, o);
  const el = document.getElementById('verificacao');
  if (!el) return;
  el.className = 'aviso ' + (ok ? 'aviso-verde' : 'aviso-alerta');
  el.innerHTML = ok
    ? '<b>Documento autêntico</b><span>O conteúdo é idêntico ao aprovado por ' + esc(r.aprovadoPor) + ' em ' + dataHora(r.aprovadoEm) + '. Código ' + esc(r.codigo) + '.</span>'
    : '<b>Atenção: o conteúdo mudou depois da aprovação</b><span>O hash atual não bate com o lacre. Peça à construtora o PDF original.</span>';
  if (!ok) {
    const rel = document.getElementById('cliente-relatorio');
    rel.innerHTML = htmlRelatorio(r, o, { verificado: false });
    hidratarFotos(rel);
  }
}

function naoEncontrado(voltar) {
  return '<main class="conteudo"><div class="aviso aviso-ambar"><b>Não encontrado</b><span>Esse item não existe neste aparelho.</span><a class="btn btn-contorno btn-pequeno" href="' + voltar + '">Voltar</a></div></main>';
}

/* ---------- Ações ---------- */

function rdoDaTela() {
  const p = rota();
  return (p[1] === 'rdo' || p[0] === 'pdf') ? acharRdo(p[0] === 'pdf' ? p[1] : p[2]) : null;
}

function ler(obj, caminho) {
  return caminho.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}

function gravar(obj, caminho, valor) {
  const partes = caminho.split('.');
  const ultimo = partes.pop();
  partes.reduce((o, k) => o[k], obj)[ultimo] = valor;
}

let timerSalvo;
function salvarComAviso() {
  salvar();
  const el = document.getElementById('salvo');
  if (el) {
    el.textContent = 'Salvo no aparelho às ' + horaCurta(Date.now()) + '.';
    clearTimeout(timerSalvo);
    timerSalvo = setTimeout(() => { el.textContent = 'Tudo o que você preenche fica salvo no aparelho, mesmo sem internet.'; }, 2500);
  }
}

function mudar(fn) {
  const r = rdoDaTela();
  if (!r || !editavel(r)) return;
  fn(r);
  salvarComAviso();
  desenhar();
}

async function climaAutomatico(r, silencioso) {
  const o = acharObra(r.obraId);
  if (semInternet()) {
    if (!silencioso) toast('Sem internet: marque o clima à mão.');
    return;
  }
  climaCarregando = true;
  desenhar();
  try {
    const c = await buscarClima(o.lat, o.lon, r.data);
    r.clima = c;
    salvar();
    if (!silencioso) toast('Clima atualizado pela localização da obra.');
  } catch (e) {
    toast('Não foi possível buscar o clima agora. Marque à mão.');
  }
  climaCarregando = false;
  desenhar();
}

const acoes = {
  'alternar-internet'() {
    const d = estado();
    if (!navigator.onLine) { toast('O aparelho está sem internet de verdade agora.'); return; }
    d.offlineSimulado = !d.offlineSimulado;
    salvar();
    toast(d.offlineSimulado ? 'Simulando falta de internet. O que você enviar fica guardado no aparelho.' : 'Internet de volta. Enviando o que estava guardado…');
    atualizarConexao();
    if (!d.offlineSimulado) sincronizar();
  },
  instalar() {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    pedidoInstalar = null;
    const b = document.getElementById('btn-instalar');
    if (b) b.hidden = true;
  },
  async recomecar() {
    if (!(await confirmar('Recomeçar a demonstração?', 'Tudo o que foi feito neste aparelho é apagado e os dados de exemplo voltam ao início.', 'Recomeçar'))) return;
    await apagarTudo();
    app.innerHTML = carregando();
    definirEstado(await criarDemonstracao());
    toast('Demonstração recomeçada.');
    ir('#/');
  },
  rolar(el, ev) {
    ev.preventDefault();
    const alvo = document.getElementById(el.dataset.alvo);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'novo-rdo'(el) { novoRdo(el.dataset.obra, el.dataset.copiar === '1'); },
  'clima-auto'() { const r = rdoDaTela(); if (r) climaAutomatico(r, false); },
  'clima-tempo'(el) {
    mudar((r) => {
      r.clima[el.dataset.turno].tempo = el.dataset.valor;
      if (r.clima[el.dataset.turno].praticavel == null) r.clima[el.dataset.turno].praticavel = el.dataset.valor !== 'chuva';
      r.clima.fonte = r.clima.fonte === 'automatico' || r.clima.fonte === 'ajustado' ? 'ajustado' : 'manual';
    });
  },
  'clima-prat'(el) {
    mudar((r) => {
      r.clima[el.dataset.turno].praticavel = el.dataset.valor === '1';
      r.clima.fonte = r.clima.fonte === 'automatico' || r.clima.fonte === 'ajustado' ? 'ajustado' : 'manual';
    });
  },
  'equipe-add'(el) { mudar((r) => r.equipe.push({ funcao: el.dataset.valor, presentes: 1, faltas: 0 })); },
  'equipe-outra'() {
    const v = document.getElementById('outra-funcao').value.trim();
    if (!v) { toast('Escreva o nome da função.'); return; }
    mudar((r) => r.equipe.push({ funcao: v, presentes: 1, faltas: 0 }));
  },
  'equipe-mudar'(el) {
    mudar((r) => { const e = r.equipe[el.dataset.i]; e[el.dataset.campo] = Math.max(0, Number(e[el.dataset.campo]) + Number(el.dataset.valor)); });
  },
  'equipe-remover'(el) { mudar((r) => r.equipe.splice(el.dataset.i, 1)); },
  'equip-add'(el) { mudar((r) => r.equipamentos.push({ nome: el.dataset.valor, qtd: 1, status: 'operando' })); },
  'equip-outro'() {
    const v = document.getElementById('outro-equip').value.trim();
    if (!v) { toast('Escreva o nome do equipamento.'); return; }
    mudar((r) => r.equipamentos.push({ nome: v, qtd: 1, status: 'operando' }));
  },
  'equip-mudar'(el) {
    mudar((r) => { const e = r.equipamentos[el.dataset.i]; e.qtd = Math.max(1, Number(e.qtd) + Number(el.dataset.valor)); });
  },
  'equip-status'(el) { mudar((r) => { r.equipamentos[el.dataset.i].status = el.dataset.valor; }); },
  'equip-remover'(el) { mudar((r) => r.equipamentos.splice(el.dataset.i, 1)); },
  'ativ-add'() {
    mudar((r) => r.atividades.push({ id: novoId('at'), descricao: '', local: '', situacao: 'andamento' }));
    const campos = app.querySelectorAll('#s-atividades textarea');
    if (campos.length) campos[campos.length - 1].focus();
  },
  'ativ-remover'(el) { mudar((r) => r.atividades.splice(el.dataset.i, 1)); },
  'ocor-add'(el) {
    mudar((r) => r.ocorrencias.push({ id: novoId('oc'), tipo: el.dataset.valor, descricao: '' }));
    const campos = app.querySelectorAll('#s-ocorrencias textarea');
    if (campos.length) campos[campos.length - 1].focus();
  },
  'ocor-remover'(el) { mudar((r) => r.ocorrencias.splice(el.dataset.i, 1)); },
  async 'foto-remover'(el) {
    if (!(await confirmar('Remover esta foto?', 'Ela sai do RDO e é apagada do aparelho.', 'Remover', 'btn-perigo'))) return;
    const r = rdoDaTela();
    const [f] = r.fotos.splice(el.dataset.i, 1);
    await apagarFoto(f.id);
    salvarComAviso();
    desenhar();
  },
  ditar(el) {
    const r = rdoDaTela();
    const alvo = el.dataset.alvo;
    if (pararDitado) {
      const mesmo = pararDitado.alvo === alvo;
      pararDitado();
      if (mesmo) return;
    }
    if (!ditadoDisponivel()) {
      toast('Este navegador não tem ditado. Use o microfone do teclado do celular.');
      const c = app.querySelector('[data-bind="' + alvo + '"]');
      if (c) c.focus();
      return;
    }
    const inicio = (ler(r, alvo) || '').trim();
    const parar = ditar((texto) => {
      const valor = (inicio ? inicio + ' ' : '') + texto;
      gravar(r, alvo, valor);
      const c = app.querySelector('[data-bind="' + alvo + '"]');
      if (c) c.value = valor;
      salvarComAviso();
    }, (erro) => {
      pararDitado = null;
      if (erro === 'not-allowed') toast('Permita o uso do microfone para ditar.');
      else if (erro && erro !== 'aborted' && erro !== 'no-speech') toast('O ditado parou (' + erro + ').');
      desenhar();
    });
    pararDitado = () => parar();
    pararDitado.alvo = alvo;
    desenhar();
    toast('Pode falar. Toque em "Parar" quando terminar.');
  },
  async melhorar(el) {
    const r = rdoDaTela();
    const alvo = el.dataset.alvo;
    if (pararDitado) pararDitado();
    const original = (ler(r, alvo) || '').trim();
    if (!original) { toast('Escreva ou dite o texto primeiro.'); return; }
    const sugestao = melhorarTexto(original);
    const res = await abrirDialogo({
      titulo: 'Texto melhorado',
      corpo: '<p class="rotulo-pequeno">Como você escreveu</p><blockquote>' + esc(original) + '</blockquote>' +
        '<label class="rotulo-pequeno" for="texto-ia">Sugestão para o relatório (pode editar)</label>' +
        '<textarea id="texto-ia" name="texto" rows="5">' + esc(sugestao) + '</textarea>' +
        '<p class="nota-ia">No protótipo, a reescrita é simulada no próprio aparelho. Na versão final, ela usa IA e o texto original fica guardado junto.</p>',
      acoes: [{ rotulo: 'Manter o meu', valor: false }, { rotulo: 'Usar este texto', valor: true, classe: 'btn-primario' }],
    });
    if (res && res.valor) mudar((x) => gravar(x, alvo, res.campos.texto.trim()));
  },
  async enviar() {
    const r = rdoDaTela();
    if (pararDitado) pararDitado();
    const p = pendencias(r);
    if (p.length) {
      await abrirDialogo({
        titulo: 'Falta pouco',
        corpo: '<p>Para enviar, preencha:</p><ul class="lista-falta">' + p.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>',
        acoes: [{ rotulo: 'Entendi', valor: true, classe: 'btn-primario' }],
      });
      return;
    }
    if (!r.fotos.length && !(await confirmar('Enviar sem fotos?', 'As fotos são a principal prova do que foi feito no dia. Você pode enviar assim mesmo.', 'Enviar sem fotos'))) return;
    const reenvio = r.status === 'ajustes';
    r.status = 'enviado';
    r.sync = 'pendente';
    r.enviadoEm = Date.now();
    r.motivoAjuste = null;
    registrar(r, PESSOAS.campo.nome, reenvio ? 'Reenviou com os ajustes' : 'Enviou para aprovação');
    if (semInternet()) {
      registrar(r, 'Aparelho de ' + r.autor, 'Sem internet: guardado no aparelho para enviar depois');
      toast('Sem internet. O RDO ficou guardado no aparelho e sobe sozinho quando a conexão voltar.');
    }
    salvar();
    desenhar();
    sincronizar();
  },
  sincronizar() {
    if (semInternet()) toast('Ainda sem internet. Assim que voltar, o envio é automático.');
    else sincronizar();
  },
  async aprovar() {
    const r = rdoDaTela();
    if (!(await confirmar('Aprovar e lacrar o RDO nº ' + r.numero + '?', 'Depois de aprovado, o relatório não pode mais ser alterado por ninguém. Ele recebe um código de verificação para o cliente conferir.', 'Aprovar e lacrar'))) return;
    r.status = 'aprovado';
    r.aprovadoEm = Date.now();
    r.aprovadoPor = PESSOAS.escritorio.nome;
    await lacrar(r, acharObra(r.obraId));
    registrar(r, PESSOAS.escritorio.nome, 'Aprovou · código ' + r.codigo);
    salvar();
    desenhar();
    toast('RDO aprovado e lacrado. Código ' + r.codigo + '.');
  },
  async 'pedir-ajustes'() {
    const r = rdoDaTela();
    const res = await abrirDialogo({
      titulo: 'Pedir ajustes ao canteiro',
      corpo: '<label class="rotulo-pequeno" for="motivo">O que precisa ser corrigido?</label>' +
        '<textarea id="motivo" name="motivo" rows="4" placeholder="Ex.: falta a foto da armação antes da concretagem."></textarea>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Enviar pedido', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const motivo = res.campos.motivo.trim();
    if (!motivo) { toast('Escreva o que precisa ser corrigido.'); return; }
    r.status = 'ajustes';
    r.motivoAjuste = motivo;
    registrar(r, PESSOAS.escritorio.nome, 'Pediu ajustes: ' + motivo);
    salvar();
    desenhar();
    toast(r.autor + ' vai ver o pedido no app do canteiro.');
  },
  async 'copiar-link'() {
    const r = rdoDaTela();
    const link = location.origin + location.pathname + '#/cliente/' + r.codigo;
    try {
      await navigator.clipboard.writeText(link);
      toast('Link copiado. O cliente vê o relatório sem precisar de conta.');
    } catch (e) {
      await abrirDialogo({
        titulo: 'Link para o cliente',
        corpo: '<input type="text" readonly value="' + esc(link) + '" aria-label="Link para o cliente" onfocus="this.select()">',
        acoes: [{ rotulo: 'Fechar', valor: true, classe: 'btn-primario' }],
      });
    }
  },
  async imprimir() {
    const r = rdoDaTela();
    const o = acharObra(r.obraId);
    await hidratarFotos(app);
    const tituloAntes = document.title;
    document.title = 'RDO ' + r.numero + ' - ' + o.nome + ' - ' + dataCurta(r.data).replace(/\//g, '-');
    window.print();
    setTimeout(() => { document.title = tituloAntes; }, 1000);
  },
};

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const fn = acoes[el.dataset.acao];
  if (fn) fn(el, ev);
});

app.addEventListener('input', (ev) => {
  const el = ev.target;
  if (!el.dataset.bind) return;
  const r = rdoDaTela();
  if (!r || !editavel(r)) return;
  gravar(r, el.dataset.bind, el.value);
  salvarComAviso();
  atualizarRodape(r);
});

app.addEventListener('change', async (ev) => {
  const el = ev.target;
  if (el.dataset.bind && el.tagName === 'SELECT') {
    mudar((r) => gravar(r, el.dataset.bind, el.value));
    return;
  }
  if (!el.dataset.fotos || !el.files.length) return;
  const r = rdoDaTela();
  const o = acharObra(r.obraId);
  const arquivos = Array.from(el.files);
  const daCamera = el.dataset.fotos === 'camera';
  let ultimo;
  for (let i = 0; i < arquivos.length; i++) {
    fotosProcessando = 'Carimbando e reduzindo a foto' + (arquivos.length > 1 ? ' ' + (i + 1) + ' de ' + arquivos.length : '') + '…';
    desenhar();
    try {
      const { blob, meta } = await processarFoto(arquivos[i], o, daCamera);
      const id = novoId('foto');
      await guardarFoto(id, blob);
      r.fotos.push({ id, legenda: '', ...meta });
      salvarComAviso();
      ultimo = meta;
    } catch (e) {
      console.error(e);
      toast('Não foi possível ler essa imagem.');
    }
  }
  fotosProcessando = '';
  desenhar();
  if (ultimo) toast('Foto carimbada e reduzida: ' + tamanho(ultimo.tamanhoOriginal) + ' → ' + tamanho(ultimo.tamanho) + '.');
});

/* Atualiza só o rodapé enquanto a pessoa digita (sem redesenhar a tela e perder o foco). */
function atualizarRodape(r) {
  const el = document.querySelector('.rodape-status');
  if (!el) return;
  const p = pendencias(r);
  el.textContent = p.length ? 'Falta: ' + p.join(', ').toLowerCase() : 'Pronto para enviar' + (r.fotos.length ? '' : ' · sem fotos');
}

/* ---------- Partida ---------- */

function carregando() {
  return '<div class="carregando"><span class="girando grande"></span><p>Preparando a demonstração…</p></div>';
}

async function iniciar() {
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    pedidoInstalar = ev;
    const b = document.getElementById('btn-instalar');
    if (b) b.hidden = false;
  });
  if (!estado()) {
    app.innerHTML = carregando();
    definirEstado(await criarDemonstracao());
  }
  // Envio interrompido (app fechado no meio): volta para a fila.
  estado().rdos.forEach((r) => { if (r.sync === 'enviando') r.sync = 'pendente'; });
  window.addEventListener('hashchange', desenhar);
  window.addEventListener('online', () => { atualizarConexao(); sincronizar(); });
  window.addEventListener('offline', atualizarConexao);
  desenhar();
  sincronizar();
}

iniciar();
