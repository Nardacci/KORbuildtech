/* KORbuild — plataforma SaaS: login, casca das telas (barra superior, menu do usuário,
 * navegação dos módulos), tela de módulos e conta da empresa.
 * Cada empresa é um "inquilino" (tenant): tem os próprios usuários, obras e dados, e contrata
 * módulos. No protótipo há uma empresa só e tudo fica no navegador; na versão real, o servidor
 * isola os dados de cada empresa. */

import { esc, dataCurta, diasEntre, hoje, dataHora, isoDoDia, horaCurta } from './util.js';
import { estado, todasAsEmpresas, salvar } from './armazem.js';
import { pode, perfilDe, modulosDe } from './settings.js';
import { icone, marca, logotipo, ASSINATURA, SOBRESCRITO } from './icones.js';
import { tr, tn, htmlSeletorIdioma } from './i18n.js';

const CHAVE_SESSAO = 'kbt.sessao';

/* O que cada pessoa pode fazer vem do perfil de acesso (Settings › Perfis de acesso). */
export { pode, perfilDe, modulosDe } from './settings.js';

/* Os módulos da plataforma. "status" diz se já existe; a empresa contrata os que existem. */
export const MODULOS = [
  {
    id: 'daily', nome: 'Daily', status: 'disponivel',
    resumo: tr('Diário de obra: fotos com GPS, equipe, clima e atividades, aprovado pelo escritório e em PDF.'),
  },
  {
    id: 'crew', nome: 'Crew', status: 'disponivel',
    resumo: tr('Ponto da equipe: quem trabalhou, quantas horas, em qual obra e quanto custou.'),
    oQueFaz: [
      tr('Ponto no celular do encarregado, com foto e localização, mesmo sem internet.'),
      tr('Horas por pessoa, por obra e por etapa, com horas extras e faltas.'),
      tr('Custo de mão de obra de cada obra, dia a dia, pronto para a folha.'),
    ],
    ligacao: tr('Quem bateu ponto na obra entra sozinho na equipe do relatório do Daily. Ninguém digita "6 pedreiros" de novo.'),
  },
  {
    // o Measure é de quem executa o serviço: a construtora não abre os desenhos (no futuro, recebe os relatórios)
    id: 'measure', nome: 'Measure', status: 'disponivel', prototipo: true, atuacoes: ['prestadora', 'ambas'],
    resumo: tr('Medição de plantas (takeoff): abre o PDF, calibra a escala e mede em pés e polegadas: lin ft, sq ft, cu yd e unidades.'),
    oQueFaz: [
      tr('Abre a planta em PDF e mede na tela: comprimentos, áreas e contagens.'),
      tr('Monta as quantidades por condição (paredes, piso, portas…), com altura, inclinação e profundidade.'),
      tr('Depois: assemblies, fórmulas, preços e a estimativa da obra.'),
    ],
    ligacao: tr('As quantidades viram a meta da obra. O relatório do Daily passa a mostrar o avanço: "45 de 180 cu yd de concreto".'),
  },
  {
    id: 'settings', nome: 'Settings', status: 'disponivel', incluso: true, soAdmin: true,
    resumo: tr('Configuração da empresa: funcionários, encargos, regras de jornada e auditoria. Vale para todos os módulos.'),
  },
];

export function modulo(id) { return MODULOS.find((m) => m.id === id); }

/* ---------- Sessão ---------- */

export function usuarioAtual() {
  let id;
  try { id = localStorage.getItem(CHAVE_SESSAO); } catch (e) { id = null; }
  const d = estado();
  return (id && d && d.usuarios.find((u) => u.id === id && u.ativo)) || null;
}

export function entrar(usuario) { localStorage.setItem(CHAVE_SESSAO, usuario.id); }
export function sair() { localStorage.removeItem(CHAVE_SESSAO); }

/* Na entrada, o e-mail diz a empresa: procura em todas e a sessão abre a empresa do usuário. */
export function usuarioPorEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  for (const d of todasAsEmpresas()) {
    const u = d.usuarios.find((x) => x.email.toLowerCase() === e && x.ativo);
    if (u) return u;
  }
  return null;
}

/* Módulos que a pessoa abre e estão contratados (Settings vem em todo plano). */
export function modulosLiberados(u) {
  const contratados = estado().empresa.modulos;
  return modulosDe(u).filter((id) => id === 'settings' || (contratados.includes(id) && moduloParaEmpresa(id)));
}
/* Módulo oferecido para o tipo da empresa (ex.: o Measure é das prestadoras, não da construtora). */
export function moduloParaEmpresa(id) {
  const m = MODULOS.find((x) => x.id === id);
  return !m || !m.atuacoes || m.atuacoes.includes(estado().empresa.atuacao);
}
/* Para onde a pessoa vai ao entrar: com um módulo só (ex.: o trabalhador, só ponto), direto para ele. */
export function inicioDoUsuario(u) {
  const mods = modulosLiberados(u);
  return mods.length === 1 ? '#/' + mods[0] : '#/inicio';
}

export function diasDeTeste() {
  const p = estado().empresa.plano;
  return p.status === 'teste' ? Math.max(0, diasEntre(hoje(), p.testeAte)) : 0;
}

export function registrarInteresse(moduloId, u) {
  const d = estado();
  d.interesses = d.interesses || [];
  if (!d.interesses.some((i) => i.modulo === moduloId && i.usuario === u.id)) {
    d.interesses.push({ modulo: moduloId, usuario: u.id, em: Date.now() });
    salvar();
  }
}

export function temInteresse(moduloId, u) {
  return (estado().interesses || []).some((i) => i.modulo === moduloId && i.usuario === u.id);
}

/* ---------- Notificações (sininho) ----------
 * Cada módulo informa as suas notificações por uma função (u) => [{ id, em, modulo, titulo, href }].
 * As lidas ficam guardadas por usuário. */
let fonteNotificacoes = () => [];
export function definirFonteNotificacoes(fn) { fonteNotificacoes = fn; }

export function notificacoesDe(u) {
  const agora = Date.now();
  const lidas = new Set(((estado().lidas || {})[u.id]) || []);
  return fonteNotificacoes(u).filter((n) => n.em <= agora).sort((a, b) => b.em - a.em).slice(0, 30)
    .map((n) => ({ ...n, lida: lidas.has(n.id) }));
}

export function marcarLidas(u, ids) {
  const d = estado();
  d.lidas = d.lidas || {};
  d.lidas[u.id] = Array.from(new Set((d.lidas[u.id] || []).concat(ids)));
  salvar();
}

function quandoFoi(ts) {
  const iso = isoDoDia(new Date(ts));
  const dias = diasEntre(iso, hoje());
  return tr('{dia} às {hora}', { dia: dias === 0 ? tr('hoje') : dias === 1 ? tr('ontem') : dataCurta(iso), hora: horaCurta(ts) });
}

function sino(u) {
  const lista = notificacoesDe(u);
  const naoLidas = lista.filter((n) => !n.lida).length;
  return '<details class="menu-usuario sino"><summary aria-label="' + (naoLidas ? tn(naoLidas, 'Notificações: {n} não lida', 'Notificações: {n} não lidas') : tr('Notificações')) + '"><span class="topo-botao">' + icone('sino') +
      (naoLidas ? '<span class="sino-contador">' + (naoLidas > 9 ? '9+' : naoLidas) + '</span>' : '') + '</span></summary>' +
    ('<div class="menu painel-notificacoes"><div class="notif-cabeca"><b>' + tr('Notificações') + '</b>') +
      (naoLidas ? ('<button type="button" class="link" data-acao="ler-todas">' + tr('Marcar todas como lidas') + '</button>') : '') + '</div>' +
      (lista.length ? '<ul class="notif-lista">' + lista.map((n) =>
        '<li class="' + (n.lida ? 'lida' : '') + '"><a href="' + n.href + '" data-acao="ler-notificacao" data-id="' + esc(n.id) + '">' +
          '<span class="notif-modulo modulo-' + n.modulo + '">' + icone(n.modulo, 16) + '</span>' +
          '<span class="notif-texto"><b>' + esc(n.titulo) + '</b><span class="mudo">' + (modulo(n.modulo) || {}).nome + ' · ' + quandoFoi(n.em) + '</span></span></a></li>').join('') + '</ul>'
        : ('<p class="vazio">' + tr('Nenhuma notificação por enquanto.') + '</p>')) +
    '</div></details>';
}

let podeInstalar = false;
export function definirPodeInstalar(valor) { podeInstalar = valor; }

function iniciais(nome) {
  return nome.split(' ').map((p) => p[0]).slice(0, 2).join('');
}

/* ---------- Casca: a moldura de todas as telas logadas ----------
 * casca({ modulo, nav: [{ id, href, rotulo, icone, contador }], ativo, titulo, subtitulo,
 *         voltar: { href, rotulo }, acoes, conteudo, rodape, topoExtra, semAbas, largura })
 * No computador, a navegação do módulo fica numa coluna à esquerda; no celular, em abas embaixo. */
export function casca(o) {
  const u = usuarioAtual();
  const m = o.modulo ? modulo(o.modulo) : null;
  const nav = o.nav || [];
  const abas = nav.length && !o.semAbas;
  const itens = (classe) => nav.map((it) => {
    const ativo = it.id === o.ativo;
    return '<a class="' + classe + '-item' + (ativo ? ' ativo' : '') + '" href="' + it.href + '"' + (ativo ? ' aria-current="page"' : '') + '>' +
      icone(it.icone) + '<span>' + esc(it.rotulo) + '</span>' +
      (it.contador ? '<span class="contador" aria-label="' + tn(it.contador, '{n} pendente', '{n} pendentes') + '">' + it.contador + '</span>' : '') + '</a>';
  }).join('');
  return '<header class="topo"><div class="topo-dentro">' +
      ('<a class="topo-marca" href="#/inicio" aria-label="' + tr('KORbuild: módulos') + '">') + marca(26) + logotipo({ classe: 'topo-nome' }) + '</a>' +
      (m ? '<span class="topo-sep" aria-hidden="true"></span><a class="topo-modulo modulo-' + m.id + '" href="#/' + m.id + '">' + icone(m.id, 18) + '<span>' + m.nome + '</span></a>' : '') +
      ('<span class="selo-prototipo" title="' + tr('Protótipo com dados fictícios') + '">' + tr('Protótipo') + '</span>') +
      '<span class="topo-espaco"></span>' +
      (o.topoExtra || '') +
      sino(u) +
      (modulosLiberados(u).length > 1 ? ('<a class="topo-botao" href="#/inicio" aria-label="' + tr('Módulos') + '" title="' + tr('Módulos') + '">') + icone('modulos') + '</a>' : '') +
      menuUsuario(u) +
    '</div></header>' +
    '<div class="corpo' + (nav.length ? ' com-lateral' : '') + (abas ? ' com-abas' : '') + '">' +
      (nav.length ? '<nav class="lateral" aria-label="' + tr('Navegação do {modulo}', { modulo: m.nome }) + '"><span class="lateral-titulo">' + m.nome + '</span>' + itens('lateral') + '</nav>' : '') +
      '<main class="pagina pagina-' + (o.largura || 'larga') + '" id="conteudo">' +
        (o.voltar ? '<a class="voltar" href="' + o.voltar.href + '">' + icone('voltar', 18) + esc(o.voltar.rotulo) + '</a>' : '') +
        (o.titulo ? '<div class="pagina-cabeca"><div class="pagina-titulo"><h1>' + esc(o.titulo) + '</h1>' + (o.subtitulo ? '<p>' + esc(o.subtitulo) + '</p>' : '') + '</div>' + (o.acoes || '') + '</div>' : '') +
        o.conteudo +
      '</main>' +
    '</div>' +
    (abas ? '<nav class="abas" aria-label="' + tr('Navegação do {modulo}', { modulo: m.nome }) + '">' + itens('abas') + '</nav>' : '') +
    (o.rodape || '');
}

function menuUsuario(u) {
  return '<details class="menu-usuario"><summary aria-label="' + tr('Menu de {nome}', { nome: esc(u.nome) }) + '"><span class="avatar">' + esc(iniciais(u.nome)) + '</span></summary>' +
    '<div class="menu">' +
      '<div class="menu-quem"><span class="avatar grande">' + esc(iniciais(u.nome)) + '</span><div><b>' + esc(u.nome) + '</b><span>' + esc(u.email) + '</span>' +
        '<span class="menu-papel">' + esc(estado().empresa.nome) + ' · ' + esc((perfilDe(u) || {}).nome || tr('sem perfil')) + '</span></div></div>' +
      (pode(u, 'settings.conta') ? '<a class="menu-item" href="#/conta">' + icone('conta', 18) + (tr('Conta da empresa') + '</a>') : '') +
      (podeInstalar ? '<button type="button" class="menu-item" data-acao="instalar">' + icone('instalar', 18) + (tr('Instalar no celular') + '</button>') : '') +
      '<div class="menu-item menu-idioma">' + icone('idioma', 18) + '<span>' + tr('Idioma') + '</span>' + htmlSeletorIdioma() + '</div>' +
      '<button type="button" class="menu-item" data-acao="recomecar">' + icone('recomecar', 18) + (tr('Recomeçar demonstração') + '</button>') +
      '<button type="button" class="menu-item" data-acao="sair">' + icone('sair', 18) + (tr('Sair') + '</button>') +
    '</div></details>';
}

/* ---------- Login ---------- */

/* grupos: [{ empresa, usuarios: [{ u, perfil }] }] — os usuários de demonstração de cada empresa. */
export function telaLogin(grupos) {
  const email = (u) => '<button type="button" class="email-demo" data-acao="preencher-email" data-email="' + esc(u.email) + '">' + esc(u.email) + '</button>';
  const admin = grupos.length ? grupos[0].usuarios.filter((x) => x.admin).map((x) => x.u) : [];
  return '<div class="login-pagina">' +
    '<section class="login-marca">' +
      marca(40) +
      '<div class="login-chamada">' +
        '<p class="login-sobrescrito">' + SOBRESCRITO + '</p>' +
        '<h1 class="login-logotipo">' + logotipo() + '</h1>' +
        '<span class="login-traco" aria-hidden="true"></span>' +
        '<p class="login-assinatura">' + ASSINATURA.map((l) => '<span>' + l + '</span>').join('') + '</p>' +
        '<ul class="login-modulos">' + MODULOS.filter((m) => !m.incluso).map((m) => '<li class="modulo-' + m.id + '">' + icone(m.id, 18) + '<span><b>' + m.nome + '</b> ' + esc(m.resumo.split(':')[0].toLowerCase()) + '</span></li>').join('') + '</ul></div>' +
      ('<p class="login-rodape">' + tr('Protótipo · dados fictícios') + '</p>') +
    '</section>' +
    '<section class="login-lado">' +
      '<form class="login-form" id="form-login" novalidate>' +
        htmlSeletorIdioma('login-idioma') + ('<h2>' + tr('Entrar') + '</h2><p class="mudo">' + tr('Use o e-mail da sua empresa.') + '</p>') +
        ('<label for="login-email">' + tr('E-mail') + '</label>') +
        '<input id="login-email" name="email" type="email" autocomplete="email" value="' + esc(admin[0] ? admin[0].email : '') + '" required>' +
        ('<div class="login-linha"><label for="login-senha">' + tr('Senha') + '</label><button type="button" class="link" data-acao="esqueci-senha">' + tr('Esqueci a senha') + '</button></div>') +
        '<input id="login-senha" name="senha" type="password" autocomplete="current-password" value="demonstracao">' +
        ('<label class="lembrar"><input type="checkbox" checked> ' + tr('Manter conectado') + '</label>') +
        '<p class="login-erro" id="login-erro" role="alert" hidden></p>' +
        ('<button type="submit" class="btn btn-primario btn-bloco btn-grande">' + tr('Entrar') + '</button>') +
        ('<div class="usuarios-demo"><b>' + tr('Usuários de demonstração') + '</b>') + grupos.map((g) => '<p><span class="usuarios-demo-empresa">' + esc(g.empresa) + '</span>' +
          g.usuarios.map((x) => ' · ' + esc(x.perfil) + ': ' + email(x.u)).join('') + '</p>').join('') + '</div>' +
      '</form>' +
    '</section>' +
  '</div>';
}

/* ---------- Módulos ---------- */

export function telaModulos(u, saudacao) {
  const d = estado();
  // Settings vem em todo plano, mas só aparece para quem pode configurar (escritório)
  // Só os módulos que o perfil abre; os "em breve" aparecem para quem usa mais de um módulo (escritório)
  const meus = modulosDe(u);
  const cartoes = MODULOS.filter((m) => moduloParaEmpresa(m.id) && (m.status === 'em-breve' ? meus.length > 1 : meus.includes(m.id))).map((m) => {
    const contratado = m.incluso || d.empresa.modulos.includes(m.id);
    const disponivel = m.status === 'disponivel';
    const etiqueta = disponivel
      ? (m.incluso ? ('<span class="etiqueta etiqueta-neutro">' + tr('Incluído no plano') + '</span>') : m.prototipo && contratado ? ('<span class="etiqueta etiqueta-ambar">' + tr('Protótipo') + '</span>') : contratado ? ('<span class="etiqueta etiqueta-verde">' + tr('Contratado') + '</span>') : ('<span class="etiqueta etiqueta-neutro">' + tr('Não contratado') + '</span>'))
      : ('<span class="etiqueta etiqueta-neutro">' + tr('Em breve') + '</span>');
    return '<a class="modulo modulo-' + m.id + (disponivel ? '' : ' em-breve') + '" href="#/' + m.id + '">' +
      '<div class="modulo-topo"><span class="modulo-icone">' + icone(m.id, 26) + '</span>' + etiqueta + '</div>' +
      '<span class="modulo-nome"><small>KORbuild</small>' + m.nome + '</span>' +
      '<span class="modulo-resumo">' + esc(m.resumo) + '</span>' +
      '<span class="modulo-acao">' + (disponivel && contratado ? tr('Abrir') : tr('Conhecer')) + icone('seta', 18) + '</span></a>';
  }).join('');
  return casca({
    titulo: saudacao + ', ' + u.nome.split(' ')[0],
    subtitulo: d.empresa.nome + (' ' + tr('· escolha um módulo')),
    conteudo: '<div class="modulos">' + cartoes + '</div>',
  });
}

export function telaEmBreve(u, id) {
  const m = modulo(id);
  const registrado = temInteresse(id, u);
  return casca({
    modulo: id, largura: 'estreita',
    voltar: { href: '#/inicio', rotulo: tr('Módulos') },
    conteudo:
      '<section class="cartao em-breve-topo modulo-' + m.id + '"><span class="modulo-icone">' + icone(m.id, 28) + '</span>' +
        ('<div><span class="etiqueta etiqueta-neutro">' + tr('Em breve') + '</span><h1>KORbuild ') + m.nome + '</h1><p>' + esc(m.resumo) + '</p></div></section>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('O que vai fazer') + '</h2><ul class="lista-check">') + m.oQueFaz.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></section>' +
      ('<section class="cartao ligacao"><h2 class="cartao-titulo">' + tr('Como se liga ao Daily') + '</h2><p>') + esc(m.ligacao) + '</p></section>' +
      '<button type="button" class="btn ' + (registrado ? 'btn-contorno' : 'btn-primario') + ' btn-grande btn-bloco" data-acao="interesse" data-modulo="' + m.id + '"' + (registrado ? ' disabled' : '') + '>' +
        (registrado ? tr('Interesse registrado ✓') : tr('Tenho interesse: quero ser avisado')) + '</button>' +
      ('<p class="dica centro">' + tr('O interesse fica registrado na conta da empresa e ajuda a decidir o que construir primeiro.') + '</p>'),
  });
}

/* ---------- Conta da empresa ---------- */

export function telaConta(u) {
  const d = estado();
  const p = d.empresa.plano;
  const obrasAtivas = d.obras.length;
  const dias = diasDeTeste();
  const interesses = d.interesses || [];
  return casca({
    titulo: tr('Conta da empresa'), subtitulo: d.empresa.nome,
    voltar: { href: '#/inicio', rotulo: tr('Módulos') },
    conteudo:
      '<div class="conta-grade">' +
        ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Empresa') + '</h2>') +
          '<div class="empresa-id"><span class="rel-logo">' + esc(d.empresa.sigla) + '</span><div><b>' + esc(d.empresa.nome) + '</b><span class="mudo">EIN ' + esc(d.empresa.ein) + '</span></div></div>' +
          ('<p class="mudo pequeno">' + tr('O logotipo e o nome aparecem nos relatórios em PDF e no link do cliente.') + '</p>') +
          ('<div class="linha-info"><span>' + tr('Cliente desde') + '</span><b>') + dataCurta(d.empresa.desde) + '</b></div>' +
          ('<div class="linha-info"><span>' + tr('Identificador da conta') + '</span><b class="codigo">') + esc(d.empresa.id) + '</b></div>' +
        '</section>' +
        ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Assinatura') + '</h2>') +
          '<div class="plano"><b>' + tr('Plano {nome}', { nome: esc(p.nome) }) + '</b><span class="etiqueta ' + (p.status === 'teste' ? 'etiqueta-azul' : 'etiqueta-verde') + '">' + (p.status === 'teste' ? tn(dias, 'Teste grátis · {n} dia', 'Teste grátis · {n} dias') : tr('Ativa')) + '</span></div>' +
          ('<div class="uso"><div class="uso-topo"><span>' + tr('Obras ativas') + '</span><b>') + tr('{n} de {total}', { n: obrasAtivas, total: p.limiteObras }) + '</b></div>' +
            ('<div class="uso-barra" role="progressbar" aria-label="' + tr('Obras ativas') + '" aria-valuemin="0" aria-valuemax="') + p.limiteObras + '" aria-valuenow="' + obrasAtivas + '"><span style="width:' + Math.min(100, Math.round(obrasAtivas / p.limiteObras * 100)) + '%"></span></div></div>' +
          ('<div class="linha-info"><span>' + tr('Usuários') + '</span><b>' + tr('Ilimitados') + '</b></div>') +
          ('<div class="linha-info"><span>' + tr('Clientes externos (link)') + '</span><b>' + tr('Ilimitados, sem custo') + '</b></div>') +
          ('<div class="linha-info"><span>' + tr('Fim do teste') + '</span><b>') + dataCurta(p.testeAte) + '</b></div>' +
          ('<button type="button" class="btn btn-primario btn-bloco" data-acao="em-breve" data-texto="' + tr('A contratação e o pagamento ainda não fazem parte do protótipo.') + '">' + tr('Assinar o plano') + '</button>') +
        '</section>' +
      '</div>' +
      ('<section class="cartao"><h2 class="cartao-titulo">' + tr('Módulos') + '</h2><ul class="fila fila-modulos">') + MODULOS.map((m) => {
        const contratado = m.incluso || d.empresa.modulos.includes(m.id);
        const qtd = interesses.filter((i) => i.modulo === m.id).length;
        return '<li><span class="modulo-icone pequeno modulo-' + m.id + '">' + icone(m.id, 20) + '</span><div class="fila-texto"><b>KORbuild ' + m.nome + '</b><span class="mudo">' + esc(m.resumo) + '</span></div>' +
          (m.status === 'em-breve'
            ? ('<span class="etiqueta etiqueta-neutro">' + tr('Em breve')) + (qtd ? ' · ' + tn(qtd, '{n} interessado', '{n} interessados') : '') + '</span>'
            : '<span class="etiqueta ' + (contratado ? 'etiqueta-verde' : 'etiqueta-neutro') + '">' + (m.incluso ? tr('Incluído no plano') : contratado ? tr('Contratado') : tr('Não contratado')) + '</span>') + '</li>';
      }).join('') + '</ul></section>' +
      ('<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">' + tr('Usuários') + '</h2>') +
        (pode(u, 'settings.acesso') ? ('<a class="btn btn-contorno btn-pequeno" href="#/settings/usuarios">' + tr('Gerenciar em Settings') + '</a>') : '') + '</div>' +
        ('<div class="tabela-rolagem"><table class="rel-tabela tabela-usuarios"><thead><tr><th>' + tr('Usuário') + '</th><th>' + tr('Perfil de acesso') + '</th><th>' + tr('Último acesso') + '</th></tr></thead><tbody>') +
        d.usuarios.map((x) => '<tr><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno usuario-detalhe">' + esc(x.cargo) + ' · ' + esc(x.email) + '</span></td>' +
          '<td><span class="etiqueta etiqueta-neutro">' + esc((perfilDe(x) || {}).nome || '—') + '</span></td>' +
          '<td>' + (x.ultimoAcesso ? dataHora(x.ultimoAcesso) : ('<span class="mudo">' + tr('Nunca') + '</span>')) + '</td></tr>').join('') +
        '</tbody></table></div>' +
        ('<p class="mudo pequeno">' + tr('O que cada perfil pode fazer é configurado em Settings › Perfis de acesso. O cliente (convidado) recebe os relatórios aprovados por link, sem conta e sem custo.') + '</p>') +
      '</section>',
  });
}
