/* KORbuild — navegação da plataforma e telas do módulo Daily (diário de obra) e fila de envio. */

import {
  esc, novoId, hoje, somarDias, diasEntre, dataCurta, dataLonga, dataRelativa, diaDaSemana, horaCurta, dataHora, tamanho,
  toast, abrirDialogo, confirmar,
} from './util.js';
import {
  estado, bancoDeDados, todasAsEmpresas, definirEstado, salvar, obra as acharObra, rdo as acharRdo, rdosDaObra, rdoDoDia, recebido, registrar,
  guardarFoto, apagarFoto, hidratarFotos, apagarTudo, idMiniatura,
} from './armazem.js';
import { criarDemonstracao, VERSAO_DADOS } from './exemplo.js';
import {
  usuarioAtual, entrar, sair, usuarioPorEmail, pode, inicioDoUsuario, modulosLiberados, registrarInteresse, modulo, definirPodeInstalar,
  casca, telaLogin, telaModulos, telaEmBreve, telaConta, definirFonteNotificacoes, marcarLidas, notificacoesDe,
} from './plataforma.js';
import { telaCrew, acoesCrew, ligarCrew, notificacoesCrew, aposDesenharCrew } from './crew-telas.js';
import { telaSettings, acoesSettings, ligarSettings, notificacoesSettings } from './settings-telas.js';
import { telaMeasure, acoesMeasure, ligarMeasure, aposDesenharMeasure } from './measure-telas.js';
import { acoesContatos, ligarContatos, htmlLogo } from './contatos-telas.js';
import { acoesRelatorios, ligarRelatorios } from './measure-relatorios.js';
import { contratanteDe, donoDe, textoPartes } from './contatos.js';
import { presencaNaObra } from './crew.js';
import { icone, marca } from './icones.js';
import {
  PRAZO_HORA, ESCALADA_HORA, prazoDe, situacaoDeHoje, diasAtrasados, pendenciasDoCampo, semRdoOntem, enviadoComAtraso, descreverDias,
} from './prazos.js';
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

/* ---------- Lembretes: notificação no celular e número no ícone do app ---------- */

/* Mostra uma notificação de verdade (pelo service worker, para funcionar no Android instalado). */
async function notificar(titulo, corpo, tag) {
  if (!('Notification' in window)) return false;
  let permissao = Notification.permission;
  if (permissao === 'default') permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return false;
  const opcoes = { body: corpo, tag: 'kbt-' + tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', data: { url: '#/daily/campo' } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg) await reg.showNotification('KORbuild Daily · ' + titulo, opcoes);
    else new Notification('KORbuild Daily · ' + titulo, opcoes);
    return true;
  } catch (e) {
    return false;
  }
}

/* Com o app aberto, confere a cada minuto: às 16h lembra, às 18h avisa do atraso (uma vez por obra e dia).
 * Na versão final, quem dispara é o servidor (notificação no celular e no sininho), mesmo com o app fechado. */
function conferirLembretes() {
  const u = usuarioAtual();
  if (!u || !pode(u, 'daily.preencher')) { atualizarBadge(0); return; }
  const p = pendenciasDoCampo();
  atualizarBadge(p.total);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  for (const o of estado().obras) {
    const s = situacaoDeHoje(o);
    if (s !== 'lembrete' && s !== 'atrasado') continue;
    const chave = 'kbt.lembrete.' + o.id + '.' + hoje() + '.' + s;
    try { if (sessionStorage.getItem(chave)) continue; sessionStorage.setItem(chave, '1'); } catch (e) { continue; }
    notificar(s === 'lembrete' ? 'Falta o RDO de hoje' : 'RDO de hoje atrasado',
      o.nome + (s === 'lembrete' ? ' · prazo ' + PRAZO_HORA + 'h.' : ' · o prazo venceu às ' + PRAZO_HORA + 'h.') + ' Toque para preencher.', o.id + '-' + s);
  }
}

function atualizarBadge(n) {
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (e) { /* sem suporte */ }
}

/* ---------- Navegação ---------- */

function rota() {
  const partes = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
  return partes.length ? partes : [''];
}

/* Partes da rota dentro do módulo Daily (#/daily/campo/... → ['campo', ...]). */
function rotaDaily() {
  const p = rota();
  return p[0] === 'daily' ? p.slice(1) : [];
}

function trocarRota(hash) {
  location.replace(hash);
}

function desenhar() {
  const p = rota();
  const u = usuarioAtual();
  // O link do cliente é público; todo o resto pede login.
  if (p[0] !== 'cliente') {
    if (!u && p[0] !== 'entrar') return trocarRota('#/entrar');
    if (u && (p[0] === '' || p[0] === 'entrar')) return trocarRota('#/inicio');
  }
  const chave = location.hash;
  const focoAntes = chaveDoFoco(document.activeElement);
  let html;
  let modo = p[0];
  if (p[0] === 'daily') {
    const q = rotaDaily();
    if (!modulosLiberados(u).includes('daily')) return trocarRota(inicioDoUsuario(u));
    // Dentro do Daily, cada perfil tem a sua área: quem acompanha (painel, aprovações, obras) e quem preenche (hoje, histórico).
    const inicioDoPapel = pode(u, 'daily.acompanhar') ? '#/daily/painel' : '#/daily/campo';
    if (!q.length) return trocarRota(inicioDoPapel);
    const precisa = { painel: 'daily.acompanhar', obras: 'daily.acompanhar', aprovacoes: 'daily.aprovar', campo: 'daily.preencher', historico: 'daily.preencher', pdf: 'daily.acompanhar' }[q[0]];
    if (precisa && !pode(u, precisa) && !(q[0] === 'pdf' && pode(u, 'daily.preencher'))) return trocarRota(inicioDoPapel);
    modo = q[0];
    if (q[0] === 'campo' && q[1] === 'obra') html = telaObraCampo(q[2]);
    else if (q[0] === 'campo' && q[1] === 'rdo') html = telaRdoCampo(q[2]);
    else if (q[0] === 'campo') html = telaCampo();
    else if (q[0] === 'historico') html = telaHistorico();
    else if (q[0] === 'painel' && q[1] === 'rdo') html = telaRdoPainel(q[2]);
    else if (q[0] === 'painel') html = telaPainel();
    else if (q[0] === 'aprovacoes') html = telaAprovacoes();
    else if (q[0] === 'obras' && q[1]) html = telaObraAdmin(q[1]);
    else if (q[0] === 'obras') html = telaObrasAdmin();
    else if (q[0] === 'pdf') html = telaPdf(q[1]);
    else return trocarRota(inicioDoPapel);
  } else if (p[0] === 'cliente') html = telaCliente(p[1]);
  else if (p[0] === 'entrar') html = telaLogin(gruposDeEntrada());
  else if (p[0] === 'conta') {
    if (!pode(u, 'settings.conta')) return trocarRota(inicioDoUsuario(u));
    html = telaConta(u);
  } else if (p[0] === 'crew' && modulosLiberados(u).includes('crew')) {
    const r = telaCrew(p.slice(1));
    if (r && r.trocar) return trocarRota(r.trocar);
    html = r;
    modo = 'crew';
  } else if (p[0] === 'measure') {
    if (!modulosLiberados(u).includes('measure')) return trocarRota(inicioDoUsuario(u));
    const r = telaMeasure(p.slice(1));
    if (r && r.trocar) return trocarRota(r.trocar);
    html = r;
    modo = 'measure';
  } else if (p[0] === 'settings') {
    const r = telaSettings(p.slice(1));
    if (r && r.trocar) return trocarRota(r.trocar);
    html = r;
    modo = 'settings';
  } else if (modulo(p[0])) html = telaEmBreve(u, p[0]);
  else if (p[0] === 'inicio') {
    // com um módulo só (ex.: trabalhador que só bate ponto), não há tela de módulos
    const destino = inicioDoUsuario(u);
    if (destino !== '#/inicio') return trocarRota(destino);
    html = telaModulos(u, saudacao());
  }
  else return trocarRota('#/inicio');
  app.innerHTML = html;
  document.body.dataset.modo = modo;
  if (chave !== rotaAnterior) {
    window.scrollTo(0, 0);
    rotaAnterior = chave;
  } else if (focoAntes) {
    const alvo = Array.from(app.querySelectorAll('[data-acao]')).find((el) => chaveDoFoco(el) === focoAntes);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  hidratarFotos(app);
  if (p[0] === 'cliente') verificarLacreNaTela(p[1]);
  if (p[0] === 'crew') aposDesenharCrew();
  if (p[0] === 'measure') aposDesenharMeasure();
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

/* ---------- Moldura do Daily ---------- */

/* Navegação do Daily conforme o papel: o escritório acompanha e aprova; o campo preenche. */
function navDaily() {
  const u = usuarioAtual();
  const { rdos } = estado();
  const itens = [];
  if (pode(u, 'daily.acompanhar')) {
    itens.push({ id: 'painel', href: '#/daily/painel', rotulo: 'Painel', icone: 'painel' });
    if (pode(u, 'daily.aprovar')) itens.push({ id: 'aprovacoes', href: '#/daily/aprovacoes', rotulo: 'Aprovações', icone: 'aprovacoes', contador: rdos.filter((r) => recebido(r) && r.status === 'enviado').length });
    itens.push({ id: 'obras', href: '#/daily/obras', rotulo: 'Obras', icone: 'obras' });
  }
  if (pode(u, 'daily.preencher')) {
    // Contador de Hoje: dias atrasados, obras sem RDO hoje e ajustes pedidos.
    itens.push({ id: 'hoje', href: '#/daily/campo', rotulo: 'Hoje', icone: 'hoje', contador: pendenciasDoCampo().total });
    itens.push({ id: 'historico', href: '#/daily/historico', rotulo: 'Histórico', icone: 'historico' });
  }
  return itens;
}

function botaoConexao() {
  return '<button type="button" class="conexao" id="conexao" data-acao="alternar-internet" title="Tocar para simular a falta de internet">' + htmlConexao() + '</button>';
}

function moldura({ ativo, titulo, subtitulo, voltar, acoes, conteudo, rodape, largo, semAbas }) {
  return casca({
    modulo: 'daily', nav: navDaily(), ativo, titulo, subtitulo, voltar, acoes, conteudo, rodape, semAbas,
    largura: largo ? 'larga' : 'estreita', topoExtra: botaoConexao(),
  });
}

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
}

function primeiraMaiuscula(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/* ---------- Campo: hoje ---------- */

function situacaoHoje(o) {
  const r = rdoDoDia(o.id, hoje());
  if (r && r.semAtividade) return { classe: 'neutro', texto: 'Sem atividade hoje · ' + r.semAtividade.motivo };
  if (r && r.status === 'rascunho') {
    const s = situacaoDeHoje(o);
    return s === 'atrasado' ? { classe: 'alerta', texto: 'Rascunho · prazo venceu às ' + PRAZO_HORA + 'h' } : { classe: 'neutro', texto: 'RDO de hoje em rascunho · prazo ' + PRAZO_HORA + 'h' };
  }
  if (!r) {
    const s = situacaoDeHoje(o);
    if (s === 'folga') return { classe: 'neutro', texto: 'Hoje não é dia de trabalho' };
    if (s === 'atrasado') return { classe: 'alerta', texto: 'RDO de hoje atrasado · prazo era ' + PRAZO_HORA + 'h' };
    if (s === 'lembrete') return { classe: 'ambar', texto: 'Falta o RDO de hoje · prazo ' + PRAZO_HORA + 'h' };
    return { classe: 'ambar', texto: 'RDO de hoje não iniciado · prazo ' + PRAZO_HORA + 'h' };
  }
  if (r.sync !== 'enviado') return { classe: 'ambar', texto: 'Guardado no aparelho · sobe quando houver internet' };
  if (r.status === 'enviado') return { classe: 'azul', texto: 'Enviado · aguardando aprovação' };
  if (r.status === 'ajustes') return { classe: 'alerta', texto: 'Ajustes pedidos pelo escritório' };
  return { classe: 'verde', texto: 'Aprovado' };
}

function tempoAte(ts) {
  const min = Math.max(0, Math.round((ts - Date.now()) / 60000));
  return min >= 60 ? Math.floor(min / 60) + 'h' + (min % 60 ? String(min % 60).padStart(2, '0') : '') : min + ' min';
}

/* Faixas do topo da tela Hoje: atrasados (vermelho) e o que falta hoje (âmbar). */
function avisosDePrazo() {
  const p = pendenciasDoCampo();
  let html = '';
  if (p.atrasados.length) {
    html += '<section class="aviso aviso-alerta aviso-atraso"><b>' + (p.atrasados.length === 1 ? '1 RDO atrasado' : p.atrasados.length + ' RDOs atrasados') + '</b>' +
      '<span>O RDO é obrigatório em todo dia de trabalho. Preencha agora; ele fica registrado como enviado com atraso.</span>' +
      '<ul class="lista-atrasos">' + p.atrasados.map(({ obra, data }) =>
        '<li><a href="#/daily/campo/obra/' + obra.id + '"><b>' + esc(obra.nome) + '</b><span>' + primeiraMaiuscula(dataRelativa(data) === 'Hoje' ? 'hoje (prazo era ' + PRAZO_HORA + 'h)' : dataRelativa(data) === 'Ontem' ? 'ontem, ' + dataCurta(data) : diaDaSemana(data) + ', ' + dataCurta(data)) + '</span>' + icone('seta', 18) + '</a></li>').join('') +
      '</ul></section>';
  }
  if (p.hojeSemRdo.length) {
    const lembrete = p.hojeSemRdo.some((x) => x.situacao === 'lembrete');
    html += '<section class="aviso ' + (lembrete ? 'aviso-ambar' : 'aviso-azul') + ' aviso-prazo"><b>' +
      (p.hojeSemRdo.length === 1 ? 'Falta o RDO de hoje em 1 obra' : 'Falta o RDO de hoje em ' + p.hojeSemRdo.length + ' obras') + '</b>' +
      '<span>Prazo: hoje às ' + PRAZO_HORA + 'h' + (lembrete ? ' · faltam ' + tempoAte(prazoDe(hoje())) : '') + '. Se não houver trabalho na obra, registre "sem atividade".</span></section>';
  }
  return html;
}

function telaCampo() {
  const { obras, rdos } = estado();
  const ajustes = rdos.filter((r) => r.status === 'ajustes');
  return moldura({
    ativo: 'hoje', titulo: saudacao() + ', ' + usuarioAtual().nome.split(' ')[0], subtitulo: primeiraMaiuscula(dataLonga(hoje())),
    conteudo:
      avisosDePrazo() +
      ajustes.map((r) => {
        const o = acharObra(r.obraId);
        return '<a class="aviso aviso-alerta aviso-ajustes" href="#/daily/campo/rdo/' + r.id + '"><b>O escritório pediu ajustes no RDO nº ' + r.numero + '</b>' +
          '<span>' + esc(o.nome) + ' · ' + dataCurta(r.data) + '</span><span class="aviso-citacao">"' + esc(r.motivoAjuste) + '"</span><span class="aviso-link">Corrigir agora →</span></a>';
      }).join('') +
      '<h2 class="titulo-secao">Suas obras</h2>' +
      '<div class="lista">' + obras.map((o) => {
        const s = situacaoHoje(o);
        const atrasos = diasAtrasados(o);
        return '<a class="cartao-obra" href="#/daily/campo/obra/' + o.id + '">' +
          '<div class="cartao-obra-topo"><b>' + esc(o.nome) + '</b>' + icone('seta', 18) + '</div>' +
          '<span class="mudo">' + esc(o.cidade) + ' · ' + esc(o.etapa) + '</span>' +
          '<span class="etiquetas">' + '<span class="etiqueta etiqueta-' + s.classe + '">' + s.texto + '</span>' +
            atrasos.map((d) => '<span class="etiqueta etiqueta-alerta">RDO de ' + dataCurta(d).slice(0, 5) + ' atrasado</span>').join('') + '</span></a>';
      }).join('') + '</div>' +
      '<button type="button" class="link-sutil" data-acao="testar-lembrete">Como funcionam os lembretes? Testar no celular</button>',
  });
}

/* ---------- Uma obra (campo: fazer o RDO; escritório: acompanhar) ---------- */

function resumoObra(o) {
  return '<section class="cartao obra-resumo">' +
    '<div class="linha-info"><span>Contratante</span><b>' + esc((contratanteDe(o) || {}).nome || '—') + '</b></div>' +
    (o.donoId && o.donoId !== o.contratanteId ? '<div class="linha-info"><span>Dono da obra</span><b>' + esc((donoDe(o) || {}).nome || '—') + '</b></div>' : '') +
    '<div class="linha-info"><span>Etapa atual</span><b>' + esc(o.etapa) + '</b></div>' +
    '<div class="linha-info"><span>Endereço</span><b>' + esc(o.endereco) + ' · ' + esc(o.cidade) + '</b></div>' +
  '</section>';
}

/* Bloco de ações de um dia: Adicionar nova RDO (destaque) + copiar (discreto) + sem atividade (discreto). */
function acoesDoDia(o, data, lista) {
  const anterior = lista.find((r) => r.data < data);
  const ehHoje = data === hoje();
  return '<button type="button" class="btn btn-primario btn-grande" data-acao="novo-rdo" data-obra="' + o.id + '" data-data="' + data + '">' + icone('mais', 20) +
      (ehHoje ? 'Adicionar nova RDO' : 'Preencher RDO de ' + dataCurta(data).slice(0, 5)) + '</button>' +
    '<div class="links-sutis">' +
      (anterior ? '<button type="button" class="link-sutil" data-acao="copiar-rdo" data-obra="' + o.id + '" data-data="' + data + '">ou copiar de um RDO anterior</button>' : '') +
      '<button type="button" class="link-sutil" data-acao="sem-atividade" data-obra="' + o.id + '" data-data="' + data + '">' + (ehHoje ? 'Sem atividade hoje' : 'Sem atividade neste dia') + '</button>' +
    '</div>';
}

function telaObraCampo(id) {
  const o = acharObra(id);
  if (!o) return naoEncontrado('#/daily/campo');
  const lista = rdosDaObra(o.id);
  const deHoje = rdoDoDia(o.id, hoje());
  const atrasos = diasAtrasados(o);
  const situacao = situacaoDeHoje(o);
  let acoes;
  if (deHoje) {
    acoes = '<a class="btn btn-primario btn-grande" href="#/daily/campo/rdo/' + deHoje.id + '">' + (deHoje.status === 'rascunho' ? 'Continuar o RDO de hoje' : 'Ver o RDO de hoje') + '</a>';
  } else if (situacao === 'folga') {
    acoes = '<p class="vazio">Hoje não é dia de trabalho nesta obra (' + descreverDias(o) + '). Se houver serviço, o RDO pode ser feito assim mesmo.</p>' + acoesDoDia(o, hoje(), lista);
  } else {
    acoes = acoesDoDia(o, hoje(), lista);
  }
  const prazoHoje = situacao === 'folga' || (deHoje && deHoje.status !== 'rascunho') ? '' :
    '<span class="prazo-dia' + (situacao === 'atrasado' ? ' vencido' : situacao === 'lembrete' ? ' perto' : '') + '">' +
      (situacao === 'atrasado' ? 'Prazo venceu às ' + PRAZO_HORA + 'h' : 'Prazo: ' + PRAZO_HORA + 'h' + (situacao === 'lembrete' ? ' · faltam ' + tempoAte(prazoDe(hoje())) : '')) + '</span>';
  return moldura({
    ativo: 'hoje', titulo: o.nome, subtitulo: o.cidade, voltar: { href: '#/daily/campo', rotulo: 'Hoje' },
    conteudo:
      atrasos.map((d) =>
        '<section class="cartao atrasado"><div class="cartao-cabeca"><h2 class="cartao-titulo">RDO de ' + diaDaSemana(d) + ', ' + dataCurta(d) + '</h2><span class="etiqueta etiqueta-alerta">Atrasado</span></div>' +
          '<p class="mudo pequeno">O prazo era ' + dataCurta(d) + ' às ' + PRAZO_HORA + 'h. Preencha agora: o relatório fica marcado como enviado com atraso.</p>' +
          '<div class="acoes-obra">' + acoesDoDia(o, d, lista) + '</div></section>').join('') +
      '<section class="acoes-obra acoes-hoje"><div class="titulo-com-prazo"><h2 class="titulo-secao">' + primeiraMaiuscula(dataLonga(hoje())) + '</h2>' + prazoHoje + '</div>' + acoes + '</section>' +
      resumoObra(o) +
      '<h2 class="titulo-secao">RDOs anteriores</h2>' +
      '<div class="lista">' + lista.filter((r) => r !== deHoje).map((r) => itemRdo(r)).join('') + '</div>',
  });
}

/* ---------- Campo: histórico ---------- */

function telaHistorico() {
  const lista = estado().rdos.slice().sort((a, b) => (a.data === b.data ? b.numero - a.numero : a.data < b.data ? 1 : -1));
  return moldura({
    ativo: 'historico', titulo: 'Histórico', subtitulo: lista.length + ' relatórios de todas as obras',
    conteudo: '<div class="lista">' + lista.map((r) => itemRdo(r, { comObra: true })).join('') + '</div>',
  });
}

const TRECHO_MAXIMO = 120;

function trecho(texto) {
  const t = texto.trim().replace(/\s+/g, ' ');
  return t.length > TRECHO_MAXIMO ? t.slice(0, TRECHO_MAXIMO).replace(/\s+\S*$/, '') + '…' : t;
}

/* Item da lista de RDOs: duas primeiras fotos em miniatura e o começo da primeira atividade.
 * opcoes.href troca o destino (o escritório abre a revisão); opcoes.comObra mostra o nome da obra. */
function itemRdo(r, opcoes) {
  const op = opcoes || {};
  const pessoas = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  const atividade = r.atividades.find((a) => a.descricao.trim());
  const fotos = r.fotos.slice(0, 2);
  const restantes = r.fotos.length - fotos.length;
  if (r.semAtividade) {
    return '<a class="item-rdo" href="' + (op.href || '#/daily/campo/rdo/' + r.id) + '">' +
      '<div class="item-rdo-topo"><b>RDO nº ' + r.numero + ' · ' + dataRelativa(r.data) + '</b>' + seloStatus(r) + '</div>' +
      (op.comObra ? '<span class="item-rdo-obra">' + esc(acharObra(r.obraId).nome) + '</span>' : '') +
      '<p class="item-rdo-trecho mudo">Dia sem atividade: ' + esc(r.semAtividade.motivo) + '</p></a>';
  }
  return '<a class="item-rdo" href="' + (op.href || '#/daily/campo/rdo/' + r.id) + '">' +
    '<div class="item-rdo-topo"><b>RDO nº ' + r.numero + ' · ' + dataRelativa(r.data) + '</b>' + seloStatus(r) + '</div>' +
    (enviadoComAtraso(r) ? '<span class="item-rdo-atraso">Enviado com atraso</span>' : '') +
    (op.comObra ? '<span class="item-rdo-obra">' + esc(acharObra(r.obraId).nome) + '</span>' : '') +

    '<p class="item-rdo-trecho' + (atividade ? '' : ' mudo') + '">' + (atividade ? esc(trecho(atividade.descricao)) : 'Nenhuma atividade descrita') + '</p>' +
    (fotos.length
      ? '<div class="item-rdo-fotos">' + fotos.map((f, i) =>
          '<img data-foto="' + esc(idMiniatura(f.id)) + '" data-foto-reserva="' + esc(f.id) + '" alt="Foto ' + (i + 1) + (f.legenda ? ': ' + esc(f.legenda) : '') + '" width="96" height="72" loading="lazy">').join('') +
        (restantes > 0 ? '<span class="item-rdo-mais" aria-label="mais ' + restantes + ' fotos">+' + restantes + '</span>' : '') + '</div>'
      : '') +
    '<span class="mudo item-rdo-meta">' + pessoas + ' pessoas · ' + r.atividades.length + ' atividades · ' + r.fotos.length + ' fotos</span></a>';
}

/* Cria o RDO de hoje, em branco ou copiando um RDO anterior escolhido (baseId). */
function novoRdo(obraId, baseId, data) {
  const base = baseId ? acharRdo(baseId) : null;
  data = data || hoje();
  const numero = Math.max(0, ...estado().rdos.filter((r) => r.obraId === obraId).map((r) => r.numero)) + 1;
  const r = {
    id: novoId('rdo'), obraId, data, numero, status: 'rascunho', sync: 'local',
    autor: usuarioAtual().nome, criadoEm: Date.now(),
    clima: { manha: {}, tarde: {}, fonte: null },
    equipe: base ? base.equipe.map((e) => ({ funcao: e.funcao, presentes: e.presentes, faltas: 0 })) : [],
    equipamentos: base ? base.equipamentos.map((e) => ({ ...e })) : [],
    atividades: base ? base.atividades.filter((a) => a.situacao !== 'concluida').map((a) => ({ id: novoId('at'), descricao: a.descricao, local: a.local, situacao: 'andamento' })) : [],
    ocorrencias: [], fotos: [], observacoes: '', historico: [],
  };
  if (!r.atividades.length) r.atividades.push({ id: novoId('at'), descricao: '', local: '', situacao: 'andamento' });
  equipeDoPonto(r);
  registrar(r, usuarioAtual().nome, (base ? 'Começou o RDO copiando o RDO nº ' + base.numero : 'Começou o RDO') + (data < hoje() ? ' (preenchimento atrasado de ' + dataCurta(data) + ')' : ''));
  estado().rdos.push(r);
  salvar();
  ir('#/daily/campo/rdo/' + r.id);
  climaAutomatico(r, true);
}

/* Com o KORbuild Crew contratado, a equipe do RDO vem do ponto: quem bateu entrada na obra no dia. */
function equipeDoPonto(r) {
  if (!estado().empresa.modulos.includes('crew') || !estado().crew) return false;
  const p = presencaNaObra(r.obraId, r.data);
  if (!p.total) return false;
  r.equipe = Object.entries(p.porFuncao).map(([funcao, v]) => ({ funcao, presentes: v.presentes, faltas: v.faltas }));
  r.equipeFonte = 'crew';
  return true;
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
  if (!r) return naoEncontrado('#/daily/campo');
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
    ativo: 'hoje', semAbas: true, titulo: 'RDO nº ' + r.numero, subtitulo: dataRelativa(r.data) + ' · ' + o.nome,
    voltar: { href: '#/daily/campo/obra/' + o.id, rotulo: o.nome },
    conteudo:
      (r.status !== 'ajustes' && Date.now() > prazoDe(r.data)
        ? '<div class="aviso aviso-ambar"><b>Preenchimento com atraso</b><span>O prazo deste RDO era ' + dataHora(prazoDe(r.data)) + '. Ao enviar, ele fica marcado como enviado com atraso.</span></div>'
        : '') +
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
  const temCrew = estado().empresa.modulos.includes('crew');
  return '<section class="secao" id="s-equipe">' + cabecalhoSecao('equipe', 'Equipe', total > 0, '<span class="secao-total">' + total + ' presentes' + (faltas ? ' · ' + faltas + (faltas === 1 ? ' falta' : ' faltas') : '') + '</span>') +
    (r.equipeFonte === 'crew' ? '<p class="fonte-crew">' + icone('crew', 16) + 'Preenchida pelo ponto do KORbuild Crew: quem bateu entrada nesta obra. Ajuste se precisar.</p>' : '') +
    (temCrew ? '<button type="button" class="link-sutil alinhado-esquerda" data-acao="equipe-do-ponto">Atualizar pela equipe que bateu ponto</button>' : '') +
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
    aviso = '<div class="aviso aviso-azul"><b>Enviado ao escritório' + (r.enviadoEm ? ' às ' + horaCurta(r.enviadoEm) : '') + '</b><span>Aguardando a aprovação do escritório. Se pedirem ajustes, você recebe aqui.</span></div>';
  } else if (r.status === 'aprovado') {
    aviso = '<div class="aviso aviso-verde"><b>Aprovado e lacrado</b><span>Depois de aprovado, o RDO não pode mais ser alterado por ninguém. Código ' + esc(r.codigo) + '.</span>' +
      '<a class="btn btn-contorno btn-pequeno" href="#/daily/pdf/' + r.id + '">Ver PDF</a></div>';
  }
  return moldura({
    ativo: r.data === hoje() ? 'hoje' : 'historico', titulo: 'RDO nº ' + r.numero, subtitulo: dataRelativa(r.data) + ' · ' + o.nome,
    voltar: { href: '#/daily/campo/obra/' + o.id, rotulo: o.nome },
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

const NOME_FAROL = { verde: 'em dia', amarelo: '1 dia de atraso', vermelho: '2 dias ou mais de atraso' };

function aguardandoAprovacao() {
  return estado().rdos.filter((r) => recebido(r) && r.status === 'enviado').sort((a, b) => (a.data < b.data ? -1 : 1));
}

function telaPainel() {
  const { obras, rdos } = estado();
  const recebidos = rdos.filter(recebido);
  const aguardando = aguardandoAprovacao();
  const faroes = obras.map((o) => ({ o, ...farol(o) }));
  const deHoje = recebidos.filter((r) => r.data === hoje());
  const fotosHoje = deHoje.reduce((s, r) => s + r.fotos.length, 0);
  const atrasadas = faroes.filter((f) => f.cor !== 'verde').length;

  return moldura({
    ativo: 'painel', largo: true, titulo: saudacao() + ', ' + usuarioAtual().nome.split(' ')[0], subtitulo: primeiraMaiuscula(dataLonga(hoje())),
    conteudo:
      '<div class="kpis">' +
        kpi('RDOs de hoje', deHoje.length + ' de ' + obras.length, deHoje.length === obras.length ? 'verde' : '') +
        kpi('Aguardando aprovação', aguardando.length, aguardando.length ? 'azul' : '') +
        kpi('Obras com RDO atrasado', atrasadas, atrasadas ? 'alerta' : 'verde') +
        kpi('Fotos recebidas hoje', fotosHoje, '') +
      '</div>' +
      blocoSemRdoOntem() +
      '<div class="painel-grade">' +
        '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Farol das obras</h2><a class="link" href="#/daily/obras">Ver obras</a></div>' +
          '<ul class="faroes">' + faroes.map((f) =>
            '<li><span class="farol farol-' + f.cor + '" role="img" aria-label="' + NOME_FAROL[f.cor] + '"></span><div><b>' + esc(f.o.nome) + '</b><span class="mudo">' + esc(f.o.cidade) + ' · ' + f.texto + '</span></div>' +
            '<a class="btn btn-contorno btn-pequeno" href="#/daily/obras/' + f.o.id + '">Abrir</a></li>').join('') + '</ul>' +
          '<p class="legenda-farol"><span><i class="farol farol-verde"></i>em dia</span><span><i class="farol farol-amarelo"></i>1 dia de atraso</span><span><i class="farol farol-vermelho"></i>2 dias ou mais</span></p>' +
        '</section>' +
        '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Aguardando aprovação <span class="contador">' + aguardando.length + '</span></h2>' +
          (aguardando.length > 3 ? '<a class="link" href="#/daily/aprovacoes">Ver todas</a>' : '') + '</div>' +
          (aguardando.length ? '<ul class="fila">' + aguardando.slice(0, 3).map((r) => itemPainel(r, 'Revisar')).join('') + '</ul>' : '<p class="vazio">Nada pendente. Tudo aprovado.</p>') +
        '</section>' +
      '</div>',
  });
}

/* Escalada da manhã seguinte: obras que ficaram sem RDO no último dia de trabalho. */
function blocoSemRdoOntem() {
  const lista = semRdoOntem();
  if (!lista.length) return '';
  return '<section class="aviso aviso-alerta aviso-escalada"><div class="aviso-cabeca"><b>' +
      (lista.length === 1 ? '1 obra ficou sem RDO' : lista.length + ' obras ficaram sem RDO') + ' no último dia de trabalho</b>' +
      '</div>' +
    '<ul class="lista-atrasos">' + lista.map(({ obra, data }) => {
      const resp = estado().usuarios.find((u) => u.id === obra.responsavelId);
      return '<li><a href="#/daily/obras/' + obra.id + '"><b>' + esc(obra.nome) + '</b><span>' + primeiraMaiuscula(diaDaSemana(data)) + ', ' + dataCurta(data) + ' · responsável: ' + esc(resp ? resp.nome : '—') + '</span>' + icone('seta', 18) + '</a></li>';
    }).join('') + '</ul></section>';
}

function kpi(rotulo, valor, cor) {
  return '<div class="kpi' + (cor ? ' kpi-' + cor : '') + '"><span>' + rotulo + '</span><b>' + valor + '</b></div>';
}

function itemPainel(r, acao) {
  const o = acharObra(r.obraId);
  const pessoas = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
  return '<li><div><b>RDO nº ' + r.numero + ' · ' + esc(o.nome) + '</b><span class="mudo">' + dataRelativa(r.data) + ' · ' + esc(r.autor) + ' · ' + pessoas + ' pessoas · ' + r.fotos.length + ' fotos' +
    (r.ocorrencias.length ? ' · <span class="texto-alerta">' + r.ocorrencias.length + (r.ocorrencias.length === 1 ? ' ocorrência' : ' ocorrências') + '</span>' : '') + '</span></div>' +
    '<a class="btn ' + (acao === 'Revisar' ? 'btn-primario' : 'btn-contorno') + ' btn-pequeno" href="#/daily/painel/rdo/' + r.id + '">' + acao + '</a></li>';
}

/* ---------- Escritório: aprovações ---------- */

function telaAprovacoes() {
  const recebidos = estado().rdos.filter(recebido);
  const aguardando = aguardandoAprovacao();
  const ajustes = recebidos.filter((r) => r.status === 'ajustes');
  const aprovados = recebidos.filter((r) => r.status === 'aprovado').sort((a, b) => b.aprovadoEm - a.aprovadoEm).slice(0, 8);
  return moldura({
    ativo: 'aprovacoes', largo: true, titulo: 'Aprovações', subtitulo: aguardando.length ? aguardando.length + ' relatórios esperando a sua revisão' : 'Nenhum relatório esperando revisão',
    conteudo:
      '<section class="cartao"><h2 class="cartao-titulo">Aguardando aprovação <span class="contador">' + aguardando.length + '</span></h2>' +
        (aguardando.length ? '<ul class="fila">' + aguardando.map((r) => itemPainel(r, 'Revisar')).join('') + '</ul>' : '<p class="vazio">Nada pendente. Tudo aprovado.</p>') +
      '</section>' +
      (ajustes.length ? '<section class="cartao"><h2 class="cartao-titulo">Com o canteiro para ajustes</h2><ul class="fila">' + ajustes.map((r) => itemPainel(r, 'Ver')).join('') + '</ul></section>' : '') +
      '<section class="cartao"><h2 class="cartao-titulo">Aprovados recentemente</h2>' +
        '<ul class="fila">' + aprovados.map((r) => {
          const o = acharObra(r.obraId);
          return '<li><div><b>RDO nº ' + r.numero + ' · ' + esc(o.nome) + '</b><span class="mudo">' + dataCurta(r.data) + ' · aprovado ' + dataHora(r.aprovadoEm) + ' · código ' + esc(r.codigo) + '</span></div>' +
            '<div class="btn-linha"><a class="btn btn-contorno btn-pequeno" href="#/daily/painel/rdo/' + r.id + '">Abrir</a><a class="btn btn-contorno btn-pequeno" href="#/daily/pdf/' + r.id + '">PDF</a></div></li>';
        }).join('') + '</ul>' +
      '</section>',
  });
}

/* ---------- Escritório: obras ---------- */

function telaObrasAdmin() {
  const { obras } = estado();
  return moldura({
    ativo: 'obras', largo: true, titulo: 'Obras', subtitulo: obras.length + ' obras ativas',
    conteudo: '<div class="lista grade-obras">' + obras.map((o) => {
      const f = farol(o);
      const qtd = rdosDaObra(o.id).filter(recebido).length;
      return '<a class="cartao-obra" href="#/daily/obras/' + o.id + '">' +
        '<div class="cartao-obra-topo"><span class="farol farol-' + f.cor + '" role="img" aria-label="' + NOME_FAROL[f.cor] + '"></span><b>' + esc(o.nome) + '</b>' + icone('seta', 18) + '</div>' +
        '<span class="mudo">' + esc(o.cidade) + ' · ' + esc(textoPartes(o)) + '</span>' +
        '<span class="mudo">' + esc(o.etapa) + '</span>' +
        '<span class="cartao-obra-rodape">' + f.texto + ' · ' + qtd + ' RDOs recebidos</span></a>';
    }).join('') + '</div>',
  });
}

function telaObraAdmin(id) {
  const o = acharObra(id);
  if (!o) return naoEncontrado('#/daily/obras');
  const f = farol(o);
  const lista = rdosDaObra(o.id).filter(recebido);
  return moldura({
    ativo: 'obras', largo: true, titulo: o.nome, subtitulo: o.cidade + ' · ' + f.texto, voltar: { href: '#/daily/obras', rotulo: 'Obras' },
    conteudo: resumoObra(o) +
      '<section class="cartao obra-resumo"><div class="cartao-cabeca"><h2 class="cartao-titulo">RDO obrigatório</h2>' +
        '<button type="button" class="link" data-acao="em-breve" data-texto="Editar responsável, prazo e calendário vem na próxima etapa.">Editar</button></div>' +
        '<div class="linha-info"><span>Responsável</span><b>' + esc((estado().usuarios.find((u) => u.id === o.responsavelId) || {}).nome || '—') + '</b></div>' +
        '<div class="linha-info"><span>Prazo diário</span><b>' + PRAZO_HORA + 'h · lembrete às 16h e alerta às 18h (sininho e celular)</b></div>' +
        '<div class="linha-info"><span>Dias de trabalho</span><b>' + primeiraMaiuscula(descreverDias(o)) + '</b></div>' +
        '<div class="linha-info"><span>Escritório é avisado</span><b>No dia seguinte, às ' + ESCALADA_HORA + 'h</b></div>' +
      '</section>' +
      '<h2 class="titulo-secao">Relatórios recebidos</h2>' +
      (lista.length ? '<div class="lista grade-rdos">' + lista.map((r) => itemRdo(r, { href: '#/daily/painel/rdo/' + r.id })).join('') + '</div>' : '<p class="vazio">Nenhum relatório recebido desta obra.</p>'),
  });
}

/* ---------- Escritório: revisar um RDO ---------- */

function telaRdoPainel(id) {
  const r = acharRdo(id);
  if (!r || !recebido(r)) {
    return moldura({ ativo: 'aprovacoes', largo: true, titulo: 'RDO', voltar: { href: '#/daily/aprovacoes', rotulo: 'Aprovações' },
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
      '<a class="btn btn-primario btn-bloco" href="#/daily/pdf/' + r.id + '">' + icone('baixar', 18) + 'Baixar PDF</a>' +
      '<button type="button" class="btn btn-contorno btn-bloco" data-acao="copiar-link">' + icone('link', 18) + 'Copiar link para o contratante</button>' +
      '<a class="btn btn-contorno btn-bloco" href="#/cliente/' + r.codigo + '">' + icone('olho', 18) + 'Ver como o contratante vê</a>' +
      (contratanteDe(acharObra(r.obraId)) ? '<p class="mudo pequeno">Contratante: <b>' + esc(contratanteDe(acharObra(r.obraId)).nome) + '</b>' + (contratanteDe(acharObra(r.obraId)).email ? ' · ' + esc(contratanteDe(acharObra(r.obraId)).email) : '') + '</p>' : '');
  }
  const historico = '<h3 class="subtitulo">Histórico</h3><ol class="historico">' + r.historico.map((h) =>
    '<li><span class="mudo">' + dataHora(h.em) + '</span><b>' + esc(h.quem) + '</b><span>' + esc(h.acao) + '</span></li>').join('') + '</ol>';
  // Voltar para onde a pessoa estava: a fila (se ainda pendente) ou a obra.
  const voltar = r.status === 'enviado' ? { href: '#/daily/aprovacoes', rotulo: 'Aprovações' } : { href: '#/daily/obras/' + o.id, rotulo: o.nome };
  return moldura({
    ativo: r.status === 'enviado' ? 'aprovacoes' : 'obras', largo: true,
    titulo: 'RDO nº ' + r.numero, subtitulo: o.nome + ' · ' + primeiraMaiuscula(dataLonga(r.data)), voltar,
    conteudo: '<div class="revisao"><div class="relatorio-tela">' + htmlRelatorio(r, o) + '</div>' +
      '<aside class="revisao-lado"><div class="cartao fixo">' + painelAcoes + historico + '</div></aside></div>',
  });
}

/* ---------- PDF ---------- */

function telaPdf(id) {
  const r = acharRdo(id);
  if (!r) return naoEncontrado('#/daily');
  const o = acharObra(r.obraId);
  const voltar = pode(usuarioAtual(), 'daily.acompanhar') ? '#/daily/painel/rdo/' + r.id : '#/daily/campo/rdo/' + r.id;
  return '<div class="pdf-barra nao-imprimir"><a class="btn btn-escuro btn-pequeno" href="' + voltar + '">' + icone('voltar', 16) + 'Voltar</a>' +
      '<span>Pré-visualização do PDF (A4)</span>' +
      '<button type="button" class="btn btn-primario btn-pequeno" data-acao="imprimir">' + icone('baixar', 16) + 'Baixar PDF</button></div>' +
    '<div class="pdf-folha">' + htmlRelatorio(r, o) + '</div>' +
    '<p class="pdf-dica nao-imprimir">Na janela que abrir, escolha "Salvar como PDF". Na versão final, o PDF é gerado no servidor e chega pronto.</p>';
}

/* Usuários de demonstração de cada empresa, para a tela de entrada. */
function gruposDeEntrada() {
  return todasAsEmpresas().map((d) => ({
    empresa: d.empresa.nome,
    usuarios: d.usuarios.filter((u) => (d.contasDemo || []).includes(u.id)).map((u) => {
      const perfil = d.settings.perfis.find((x) => x.id === u.perfilId) || {};
      return { u, perfil: perfil.nome || '', admin: (perfil.permissoes || []).includes('settings.acesso') };
    }),
  }));
}

/* ---------- Link do contratante (a construtora, ou o dono quando contrata direto) ---------- */

function telaCliente(codigo) {
  const r = estado().rdos.find((x) => x.codigo === codigo && x.status === 'aprovado');
  if (!r) {
    return '<main class="pagina pagina-estreita"><div class="aviso aviso-ambar"><b>Relatório não encontrado</b><span>Confira o link. No protótipo não há servidor, então o link do cliente só abre no mesmo navegador em que o RDO foi aprovado.</span></div></main>';
  }
  const o = acharObra(r.obraId);
  return '<header class="cliente-topo"><div class="cliente-empresa">' + htmlLogo('rel-logo-img') + '<div><span class="mudo">Relatório compartilhado por</span><b>' + esc(estado().empresa.nome) + '</b></div></div>' +
      '<span class="cliente-via">via ' + marca(18) + 'KORbuild Daily</span></header>' +
    '<main class="pagina pagina-larga">' +
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
  return '<main class="pagina pagina-estreita"><div class="aviso aviso-ambar"><b>Não encontrado</b><span>Esse item não existe neste aparelho.</span><a class="btn btn-contorno btn-pequeno" href="' + voltar + '">Voltar</a></div></main>';
}

/* ---------- Ações ---------- */

function rdoDaTela() {
  const q = rotaDaily();
  return (q[1] === 'rdo' || q[0] === 'pdf') ? acharRdo(q[0] === 'pdf' ? q[1] : q[2]) : null;
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
    definirPodeInstalar(false);
    desenhar();
  },
  async recomecar() {
    if (!(await confirmar('Recomeçar a demonstração?', 'Tudo o que foi feito neste aparelho é apagado e os dados de exemplo voltam ao início.', 'Recomeçar'))) return;
    await apagarTudo();
    app.innerHTML = carregando();
    definirEstado(await criarDemonstracao());
    sair();
    toast('Demonstração recomeçada.');
    ir('#/entrar');
  },
  'preencher-email'(el) {
    document.getElementById('login-email').value = el.dataset.email;
    document.getElementById('login-erro').hidden = true;
    document.getElementById('login-senha').focus();
  },
  'esqueci-senha'() {
    toast('No protótipo, a senha não é conferida. A recuperação por e-mail vem na versão final.');
  },
  sair() {
    if (pararDitado) pararDitado();
    sair();
    ir('#/entrar');
  },
  'em-breve'(el) { toast(el.dataset.texto); },
  interesse(el) {
    registrarInteresse(el.dataset.modulo, usuarioAtual());
    toast('Obrigado! Avisaremos quando o KORbuild ' + modulo(el.dataset.modulo).nome + ' estiver disponível.');
    desenhar();
  },
  rolar(el, ev) {
    ev.preventDefault();
    const alvo = document.getElementById(el.dataset.alvo);
    if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  'novo-rdo'(el) { novoRdo(el.dataset.obra, null, el.dataset.data); },
  async 'copiar-rdo'(el) {
    const data = el.dataset.data || hoje();
    const anteriores = rdosDaObra(el.dataset.obra).filter((r) => r.data < data && !r.semAtividade);
    const res = await abrirDialogo({
      titulo: 'Copiar de um RDO anterior',
      corpo: '<p class="mudo pequeno">Vêm a equipe, os equipamentos e as atividades que ainda estavam em andamento. Clima, fotos e ocorrências começam em branco.</p>' +
        '<div class="escolha-rdo" role="radiogroup" aria-label="RDO para copiar">' + anteriores.map((r, i) => {
          const pessoas = r.equipe.reduce((s, e) => s + Number(e.presentes || 0), 0);
          const emAndamento = r.atividades.filter((a) => a.situacao !== 'concluida').length;
          return '<label class="opcao-rdo"><input type="radio" name="base" value="' + esc(r.id) + '"' + (i === 0 ? ' checked' : '') + '>' +
            '<span><b>' + dataRelativa(r.data) + (dataRelativa(r.data) === dataCurta(r.data) ? '' : ' · ' + dataCurta(r.data)) + '</b>' +
            '<span class="mudo">RDO nº ' + r.numero + ' · ' + pessoas + ' pessoas · ' + r.equipamentos.length + ' equipamentos · ' + emAndamento + ' em andamento</span></span></label>';
        }).join('') + '</div>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Copiar', valor: true, classe: 'btn-primario' }],
    });
    if (res && res.valor && res.campos.base) novoRdo(el.dataset.obra, res.campos.base, data);
  },
  async 'sem-atividade'(el) {
    const data = el.dataset.data || hoje();
    const o = acharObra(el.dataset.obra);
    const MOTIVOS = ['Chuva / tempo impraticável', 'Feriado ou folga', 'Obra paralisada pelo cliente', 'Falta de material', 'Greve ou paralisação', 'Outro motivo'];
    const res = await abrirDialogo({
      titulo: 'Sem atividade ' + (data === hoje() ? 'hoje' : 'em ' + dataCurta(data)),
      corpo: '<p class="mudo pequeno">' + esc(o.nome) + '. Fica registrado como o RDO do dia e vai para o escritório. Os lembretes deste dia param.</p>' +
        '<div class="escolha-rdo" role="radiogroup" aria-label="Motivo">' + MOTIVOS.map((m, i) =>
          '<label class="opcao-rdo"><input type="radio" name="motivo" value="' + esc(m) + '"' + (i === 0 ? ' checked' : '') + '><span><b>' + esc(m) + '</b></span></label>').join('') + '</div>' +
        '<label class="rotulo-pequeno" for="obs-sem-atividade">Observação (opcional)</label>' +
        '<textarea id="obs-sem-atividade" name="obs" rows="2" placeholder="Ex.: chuva forte desde as 6h, canteiro alagado."></textarea>',
      acoes: [{ rotulo: 'Cancelar', valor: false }, { rotulo: 'Registrar', valor: true, classe: 'btn-primario' }],
    });
    if (!res || !res.valor) return;
    const u = usuarioAtual();
    const numero = Math.max(0, ...estado().rdos.filter((r) => r.obraId === o.id).map((r) => r.numero)) + 1;
    const r = {
      id: novoId('rdo'), obraId: o.id, data, numero, status: 'enviado', sync: 'pendente', autor: u.nome,
      criadoEm: Date.now(), enviadoEm: Date.now(), primeiroEnvioEm: Date.now(),
      semAtividade: { motivo: res.campos.motivo, obs: (res.campos.obs || '').trim() },
      clima: { manha: {}, tarde: {}, fonte: null }, equipe: [], equipamentos: [], atividades: [], ocorrencias: [], fotos: [], observacoes: '', historico: [],
    };
    registrar(r, u.nome, 'Registrou dia sem atividade: ' + res.campos.motivo);
    if (semInternet()) registrar(r, 'Aparelho de ' + u.nome, 'Sem internet: guardado no aparelho para enviar depois');
    estado().rdos.push(r);
    salvar();
    toast('Dia sem atividade registrado. Os lembretes deste dia param.');
    ir('#/daily/campo/obra/' + o.id);
    desenhar();
    sincronizar();
  },
  'ler-notificacao'(el) {
    marcarLidas(usuarioAtual(), [el.dataset.id]);
    // a navegação segue pelo href do link
  },
  'ler-todas'(el, ev) {
    ev.preventDefault();
    const u = usuarioAtual();
    marcarLidas(u, notificacoesDe(u).map((n) => n.id));
    desenhar();
  },
  async 'testar-lembrete'() {
    const exemplo = pendenciasDoCampo().hojeSemRdo[0] || { obra: estado().obras[0] };
    const res = await abrirDialogo({
      titulo: 'Lembretes do RDO',
      corpo: '<ol class="regua">' +
          '<li><b>16h · sininho + notificação no celular</b><span>"Falta o RDO de hoje do ' + esc(exemplo.obra.nome) + '. Prazo: 18h."</span></li>' +
          '<li><b>18h · sininho + notificação no celular</b><span>"O RDO de hoje do ' + esc(exemplo.obra.nome) + ' está atrasado. Toque para preencher."</span></li>' +
          '<li><b>8h do dia seguinte · escritório</b><span>O escritório vê no sininho e no painel as obras que ficaram sem RDO.</span></li>' +
        '</ol>' +
        '<p class="mudo pequeno">Dias sem trabalho no calendário da obra, ou registrados como "sem atividade", não geram lembrete. No protótipo, os lembretes saem só com o app aberto; na versão final, o servidor envia mesmo com o app fechado.</p>',
      acoes: [{ rotulo: 'Fechar', valor: false }, { rotulo: 'Enviar notificação de teste', valor: true, classe: 'btn-primario' }],
    });
    if (res && res.valor) {
      const ok = await notificar('Falta o RDO de hoje', exemplo.obra.nome + ' · prazo ' + PRAZO_HORA + 'h. Toque para preencher.', 'teste');
      toast(ok ? 'Notificação enviada. Veja na barra do celular.' : 'Este navegador não permitiu notificações. No celular, instale o app e permita as notificações.');
    }
  },
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
  'equipe-do-ponto'() {
    const r = rdoDaTela();
    if (!r || !editavel(r)) return;
    if (equipeDoPonto(r)) { salvarComAviso(); desenhar(); toast('Equipe atualizada pelo ponto do Crew.'); }
    else toast('Ninguém bateu entrada nesta obra neste dia ainda.');
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
    if (!r.primeiroEnvioEm) r.primeiroEnvioEm = r.enviadoEm;
    r.motivoAjuste = null;
    registrar(r, usuarioAtual().nome, reenvio ? 'Reenviou com os ajustes' : 'Enviou para aprovação');
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
    r.aprovadoPor = usuarioAtual().nome;
    await lacrar(r, acharObra(r.obraId));
    registrar(r, usuarioAtual().nome, 'Aprovou · código ' + r.codigo);
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
    registrar(r, usuarioAtual().nome, 'Pediu ajustes: ' + motivo);
    salvar();
    desenhar();
    toast(r.autor + ' vai ver o pedido no app do canteiro.');
  },
  async 'copiar-link'() {
    const r = rdoDaTela();
    const link = location.origin + location.pathname + '#/cliente/' + r.codigo;
    try {
      await navigator.clipboard.writeText(link);
      const ct = contratanteDe(acharObra(r.obraId));
      toast('Link copiado' + (ct ? ' para enviar a ' + ct.nome : '') + '. Ele vê o relatório sem precisar de conta.');
    } catch (e) {
      await abrirDialogo({
        titulo: 'Link para o contratante',
        corpo: '<input type="text" readonly value="' + esc(link) + '" aria-label="Link para o contratante" onfocus="this.select()">',
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

document.addEventListener('click', (ev) => {
  document.querySelectorAll('details.menu-usuario[open]').forEach((m) => { if (!m.contains(ev.target)) m.open = false; });
});

app.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-acao]');
  if (!el || el.disabled) return;
  const fn = acoes[el.dataset.acao];
  if (fn) fn(el, ev);
});

function fazerLogin(u) {
  u.ultimoAcesso = Date.now();
  salvar();
  entrar(u);
  ir('#/inicio');
}

app.addEventListener('submit', (ev) => {
  if (ev.target.id !== 'form-login') return;
  ev.preventDefault();
  const email = ev.target.email.value;
  const erro = document.getElementById('login-erro');
  const u = usuarioPorEmail(email);
  if (!u) {
    erro.textContent = email.trim()
      ? 'Não encontramos uma conta com esse e-mail. No protótipo, use um dos usuários do Daily listados abaixo.'
      : 'Digite o seu e-mail.';
    erro.hidden = false;
    return;
  }
  fazerLogin(u);
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
      const { blob, mini, meta } = await processarFoto(arquivos[i], o, daCamera);
      const id = novoId('foto');
      await guardarFoto(id, blob, mini);
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

/* ---------- Notificações do Daily (para o sininho) ---------- */

function notificacoesDaily(u) {
  const lista = [];
  const { rdos } = estado();
  if (pode(u, 'daily.acompanhar')) {
    for (const { obra, data } of semRdoOntem()) {
      const resp = estado().usuarios.find((x) => x.id === obra.responsavelId);
      lista.push({ id: 'd-semrdo-' + obra.id + data, em: new Date(hoje() + 'T08:00:00').getTime(), modulo: 'daily', titulo: obra.nome + ' ficou sem RDO em ' + dataCurta(data).slice(0, 5) + (resp ? ' (' + resp.nome + ')' : ''), href: '#/daily/obras/' + obra.id });
    }
    for (const r of rdos.filter((x) => pode(u, 'daily.aprovar') && recebido(x) && x.status === 'enviado')) {
      lista.push({ id: 'd-recebido-' + r.id, em: r.enviadoEm, modulo: 'daily', titulo: 'RDO nº ' + r.numero + ' de ' + acharObra(r.obraId).nome + ' aguardando aprovação', href: '#/daily/painel/rdo/' + r.id });
    }
  } else if (pode(u, 'daily.preencher')) {
    const p = pendenciasDoCampo();
    for (const { obra, situacao } of p.hojeSemRdo) if (situacao === 'lembrete') {
      lista.push({ id: 'd-lembrete-' + obra.id + hoje(), em: new Date(hoje() + 'T16:00:00').getTime(), modulo: 'daily', titulo: 'Falta o RDO de hoje de ' + obra.nome + ' · prazo ' + PRAZO_HORA + 'h', href: '#/daily/campo/obra/' + obra.id });
    }
    for (const { obra, data } of p.atrasados) {
      lista.push({ id: 'd-atraso-' + obra.id + data, em: prazoDe(data), modulo: 'daily', titulo: 'RDO de ' + dataCurta(data).slice(0, 5) + ' atrasado: ' + obra.nome, href: '#/daily/campo/obra/' + obra.id });
    }
    for (const r of p.ajustes) {
      const h = r.historico.filter((x) => x.acao.startsWith('Pediu ajustes')).slice(-1)[0];
      lista.push({ id: 'd-ajuste-' + r.id + (h ? h.em : ''), em: h ? h.em : r.enviadoEm, modulo: 'daily', titulo: 'O escritório pediu ajustes no RDO nº ' + r.numero, href: '#/daily/campo/rdo/' + r.id });
    }
    for (const r of rdos.filter((x) => x.status === 'aprovado' && x.aprovadoEm > Date.now() - 3 * 86400000)) {
      lista.push({ id: 'd-aprovado-' + r.id, em: r.aprovadoEm, modulo: 'daily', titulo: 'RDO nº ' + r.numero + ' de ' + acharObra(r.obraId).nome + ' aprovado', href: '#/daily/campo/rdo/' + r.id });
    }
  }
  return lista;
}

async function iniciar() {
  Object.assign(acoes, acoesCrew, acoesSettings, acoesMeasure, acoesContatos, acoesRelatorios);
  ligarCrew({ desenhar, ir, topoExtra: botaoConexao });
  ligarSettings({ desenhar, ir, topoExtra: botaoConexao });
  ligarMeasure({ desenhar, ir, topoExtra: botaoConexao });
  ligarContatos({ desenhar, ir });
  ligarRelatorios({ desenhar, ir });
  definirFonteNotificacoes((u) => {
    const mods = estado().empresa.modulos;
    return (mods.includes('daily') ? notificacoesDaily(u) : []).concat(mods.includes('crew') ? notificacoesCrew(u) : []).concat(notificacoesSettings(u));
  });
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  window.addEventListener('beforeinstallprompt', (ev) => {
    ev.preventDefault();
    pedidoInstalar = ev;
    definirPodeInstalar(true);
  });
  // Dados de uma versão antiga do protótipo são recriados no formato novo.
  if (!bancoDeDados() || bancoDeDados().versao !== VERSAO_DADOS) {
    app.innerHTML = carregando();
    await apagarTudo();
    sair();
    definirEstado(await criarDemonstracao());
  }
  // Envio interrompido (app fechado no meio): volta para a fila.
  estado().rdos.forEach((r) => { if (r.sync === 'enviando') r.sync = 'pendente'; });
  window.addEventListener('hashchange', desenhar);
  window.addEventListener('online', () => { atualizarConexao(); sincronizar(); });
  window.addEventListener('offline', atualizarConexao);
  desenhar();
  sincronizar();
  conferirLembretes();
  setInterval(conferirLembretes, 60000);
}

iniciar();
