/* KORbuild — plataforma SaaS: login, empresa (cliente da plataforma), plano, módulos e usuários.
 * Cada empresa é um "inquilino" (tenant): tem os próprios usuários, obras e dados, e contrata
 * módulos. No protótipo há uma empresa só e tudo fica no navegador; na versão real, o servidor
 * isola os dados de cada empresa. */

import { esc, dataCurta, diasEntre, hoje, dataHora } from './util.js';
import { estado, salvar } from './armazem.js';

const CHAVE_SESSAO = 'kbt.sessao';

export const PAPEIS = {
  admin: { nome: 'Administrador', descricao: 'Escritório: vê todas as obras, aprova, gerencia a conta e os usuários' },
  campo: { nome: 'Campo', descricao: 'Canteiro: preenche e envia os relatórios das obras em que atua' },
};

const ICONES = {
  daily: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 3v4M16 3v4M8 11h8M8 15h5"/></svg>',
  crew: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><circle cx="17.5" cy="15.5" r="4"/><path d="M17.5 13.5v2l1.4 1.2"/></svg>',
  measure: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17L17 3l4 4L7 21H3z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/></svg>',
};

/* Os módulos da plataforma. "status" diz se já existe; a empresa contrata os que existem. */
export const MODULOS = [
  {
    id: 'daily', nome: 'Daily', status: 'disponivel',
    resumo: 'Diário de obra no celular: fotos com GPS, equipe, clima e atividades, aprovado pelo escritório e em PDF.',
  },
  {
    id: 'crew', nome: 'Crew', status: 'em-breve',
    resumo: 'Ponto da equipe no celular: quem trabalhou, quantas horas, em qual obra e quanto custou.',
    oQueFaz: [
      'Ponto no celular do encarregado, com foto e localização, mesmo sem internet.',
      'Horas por pessoa, por obra e por etapa, com horas extras e faltas.',
      'Custo de mão de obra de cada obra, dia a dia, pronto para a folha.',
    ],
    ligacao: 'Quem bateu ponto na obra entra sozinho na equipe do relatório do Daily. Ninguém digita "6 pedreiros" de novo.',
  },
  {
    id: 'measure', nome: 'Measure', status: 'em-breve',
    resumo: 'Medição de plantas: quantidades tiradas do projeto em PDF e o orçamento da obra.',
    oQueFaz: [
      'Abre a planta em PDF e mede na tela: áreas, comprimentos e contagens.',
      'Monta a lista de quantidades por etapa (m² de alvenaria, m³ de concreto…).',
      'Gera o orçamento a partir das quantidades e dos preços da empresa.',
    ],
    ligacao: 'As quantidades viram a meta da obra. O relatório do Daily passa a mostrar o avanço: "laje do 2º pavimento: 45 de 180 m³".',
  },
];

export function icone(id) { return ICONES[id] || ''; }
export function modulo(id) { return MODULOS.find((m) => m.id === id); }

/* ---------- Sessão ---------- */

export function usuarioAtual() {
  let id;
  try { id = localStorage.getItem(CHAVE_SESSAO); } catch (e) { id = null; }
  const d = estado();
  return (id && d && d.usuarios.find((u) => u.id === id && u.ativo)) || null;
}

export function entrar(usuario) {
  localStorage.setItem(CHAVE_SESSAO, usuario.id);
}

export function sair() {
  localStorage.removeItem(CHAVE_SESSAO);
}

export function usuarioPorEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  return estado().usuarios.find((u) => u.email.toLowerCase() === e && u.ativo) || null;
}

export function ehAdmin(u) { return !!u && u.papel === 'admin'; }

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

/* ---------- Telas ---------- */

const MARCA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11"/><path d="M9 20v-6h6v6"/></svg>';

export function telaLogin(contasDemo, podeInstalar) {
  return '<div class="faixa-prototipo">Protótipo de validação · todos os dados são fictícios</div>' +
  '<main class="inicio">' +
    '<div class="inicio-topo"><span class="marca-icone grande">' + MARCA.replace(/18/g, '24') + '</span>' +
      '<span class="marca-nome">KOR<span>build</span></span></div>' +
    '<h1>A obra inteira, do canteiro ao escritório.</h1>' +
    '<p class="inicio-sub">Diário de obra, ponto da equipe e medição de plantas na mesma plataforma, com os dados de uma alimentando a outra.</p>' +
    '<form class="login" id="form-login" data-acao-form="entrar" novalidate>' +
      '<label for="login-email">E-mail</label>' +
      '<input id="login-email" name="email" type="email" autocomplete="email" placeholder="voce@suaempresa.com" required>' +
      '<label for="login-senha">Senha</label>' +
      '<input id="login-senha" name="senha" type="password" autocomplete="current-password" placeholder="Sua senha">' +
      '<p class="login-erro" id="login-erro" role="alert" hidden></p>' +
      '<button type="submit" class="btn btn-limao btn-grande">Entrar</button>' +
      '<button type="button" class="link-claro" data-acao="criar-conta">Sua empresa ainda não usa? Teste grátis por 14 dias</button>' +
    '</form>' +
    '<section class="contas-demo"><h2>Contas de demonstração</h2><p>Na demonstração, a senha não é conferida. Entre com um toque:</p>' +
      '<div class="perfis">' + contasDemo.map((u) =>
        '<button type="button" class="perfil" data-acao="entrar-como" data-usuario="' + esc(u.id) + '">' +
          '<span class="perfil-icone ' + (u.papel === 'campo' ? 'campo' : 'escritorio') + '">' + (u.papel === 'campo'
            ? '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 18h18"/><path d="M5 18v-3a7 7 0 0 1 14 0v3"/><path d="M10 8V5h4v3"/></svg>'
            : '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 13l3-3 2 2 4-4"/></svg>') + '</span>' +
          '<span><b>' + esc(u.nome) + '</b><span>' + esc(u.cargo) + ' · ' + PAPEIS[u.papel].nome + '</span><small>' + esc(u.email) + '</small></span></button>').join('') +
      '</div></section>' +
    '<details class="roteiro"><summary>Roteiro da demonstração (5 minutos)</summary><ol>' +
      '<li>Entre como <b>Carlos</b> (campo). Abra o <b>Daily</b> → Residencial Jardim das Flores → <b>Começar copiando o RDO de ontem</b>.</li>' +
      '<li>O clima é buscado sozinho. Tire uma ou duas fotos: veja o carimbo com data, hora e GPS e quanto a foto encolheu.</li>' +
      '<li>Em uma atividade, toque em <b>Ditar</b> (ou digite) <i>"hj a gente fecho a viga 2 mas faltou cimento pq a entrega atrasou"</i> e toque em <b>Melhorar texto</b>.</li>' +
      '<li>Toque em <b>Online</b>, no topo, para simular a falta de internet, e envie. O RDO fica no aparelho. Toque de novo e ele sobe sozinho.</li>' +
      '<li>Saia e entre como <b>Ana</b> (administradora). No Daily, o farol da obra está verde: abra o RDO, aprove, baixe o PDF e copie o link do cliente.</li>' +
      '<li>Volte aos módulos: mostre <b>Crew</b> e <b>Measure</b> (em breve) e a página <b>Conta da empresa</b> (plano, módulos e usuários).</li>' +
    '</ol></details>' +
    '<div class="inicio-acoes">' +
      '<button type="button" class="btn btn-claro" data-acao="instalar"' + (podeInstalar ? '' : ' hidden') + ' id="btn-instalar">Instalar no celular</button>' +
      '<button type="button" class="btn btn-claro" data-acao="recomecar">Recomeçar a demonstração</button>' +
    '</div>' +
  '</main>';
}

function barraPlataforma(u, titulo) {
  const d = estado();
  return '<div class="faixa-prototipo">Protótipo · dados fictícios · você é ' + esc(u.nome) + ' (' + PAPEIS[u.papel].nome.toLowerCase() + ') · <button type="button" class="link-faixa" data-acao="sair">sair</button></div>' +
    '<header class="barra"><div class="barra-dentro largo">' +
      '<a class="barra-marca" href="#/inicio" aria-label="Módulos"><span class="marca-icone">' + MARCA + '</span></a>' +
      '<div class="barra-titulo"><b>' + esc(titulo) + '</b><span>' + esc(d.empresa.nome) + '</span></div>' +
      '<span class="avatar" title="' + esc(u.nome) + '">' + esc(u.nome.split(' ').map((p) => p[0]).slice(0, 2).join('')) + '</span>' +
    '</div></header>';
}

function avisoTeste(u) {
  const d = estado();
  const p = d.empresa.plano;
  if (p.status !== 'teste') return '';
  const dias = diasDeTeste();
  return '<div class="aviso aviso-azul aviso-linha"><span><b>Teste grátis do plano ' + esc(p.nome) + '</b> · ' + dias + (dias === 1 ? ' dia restante' : ' dias restantes') + ' (até ' + dataCurta(p.testeAte) + ')</span>' +
    (ehAdmin(u) ? '<a class="btn btn-contorno btn-pequeno" href="#/conta">Ver plano</a>' : '') + '</div>';
}

export function telaModulos(u, saudacao) {
  const d = estado();
  const cartoes = MODULOS.map((m) => {
    const contratado = d.empresa.modulos.includes(m.id);
    const disponivel = m.status === 'disponivel';
    let etiqueta, acao;
    if (disponivel && contratado) {
      etiqueta = '<span class="etiqueta etiqueta-verde">Incluído no seu plano</span>';
      acao = '<span class="modulo-acao">Abrir →</span>';
    } else if (disponivel) {
      etiqueta = '<span class="etiqueta etiqueta-neutro">Não contratado</span>';
      acao = '<span class="modulo-acao">Conhecer →</span>';
    } else {
      etiqueta = '<span class="etiqueta etiqueta-ambar">Em breve</span>';
      acao = '<span class="modulo-acao">' + (temInteresse(m.id, u) ? 'Interesse registrado ✓' : 'Conhecer →') + '</span>';
    }
    return '<a class="modulo modulo-' + m.id + (disponivel ? '' : ' em-breve') + '" href="#/' + m.id + '">' +
      '<span class="modulo-icone">' + ICONES[m.id] + '</span>' +
      '<span class="modulo-nome"><small>KORbuild</small>' + m.nome + '</span>' +
      '<span class="modulo-resumo">' + esc(m.resumo) + '</span>' + etiqueta + acao + '</a>';
  }).join('');
  return barraPlataforma(u, 'Módulos') +
    '<main class="conteudo largo">' +
      '<div class="ola"><h1>' + saudacao + ', ' + esc(u.nome.split(' ')[0]) + '</h1><p>' + esc(d.empresa.nome) + ' · ' + esc(u.cargo) + '</p></div>' +
      avisoTeste(u) +
      '<div class="modulos">' + cartoes + '</div>' +
      (ehAdmin(u) ? '<a class="cartao cartao-link" href="#/conta"><b>Conta da empresa</b><span class="mudo">Plano, módulos contratados, uso e usuários</span><span class="seta">›</span></a>' : '') +
    '</main>';
}

export function telaEmBreve(u, id) {
  const m = modulo(id);
  const registrado = temInteresse(id, u);
  return barraPlataforma(u, 'KORbuild ' + m.nome) +
    '<main class="conteudo">' +
      '<a class="voltar-texto" href="#/inicio">← Módulos</a>' +
      '<section class="cartao em-breve-topo modulo-' + m.id + '"><span class="modulo-icone">' + ICONES[m.id] + '</span>' +
        '<div><span class="etiqueta etiqueta-ambar">Em breve</span><h1>KORbuild ' + m.nome + '</h1><p>' + esc(m.resumo) + '</p></div></section>' +
      '<section class="cartao"><h2 class="cartao-titulo">O que vai fazer</h2><ul class="lista-check">' + m.oQueFaz.map((t) => '<li>' + esc(t) + '</li>').join('') + '</ul></section>' +
      '<section class="cartao ligacao"><h2 class="cartao-titulo">Como se liga ao Daily</h2><p>' + esc(m.ligacao) + '</p></section>' +
      '<button type="button" class="btn ' + (registrado ? 'btn-contorno' : 'btn-primario') + ' btn-grande" data-acao="interesse" data-modulo="' + m.id + '"' + (registrado ? ' disabled' : '') + '>' +
        (registrado ? 'Interesse registrado ✓' : 'Tenho interesse: quero ser avisado') + '</button>' +
      '<p class="dica centro">O interesse fica registrado na conta da empresa e ajuda a decidir o que construir primeiro.</p>' +
    '</main>';
}

export function telaConta(u) {
  const d = estado();
  const p = d.empresa.plano;
  const obrasAtivas = d.obras.length;
  const dias = diasDeTeste();
  const interesses = (d.interesses || []);
  return barraPlataforma(u, 'Conta da empresa') +
    '<main class="conteudo largo">' +
      '<a class="voltar-texto" href="#/inicio">← Módulos</a>' +
      '<div class="conta-grade">' +
        '<section class="cartao"><h2 class="cartao-titulo">Empresa</h2>' +
          '<div class="empresa-id"><span class="rel-logo">' + esc(d.empresa.sigla) + '</span><div><b>' + esc(d.empresa.nome) + '</b><span class="mudo">CNPJ ' + esc(d.empresa.cnpj) + '</span></div></div>' +
          '<p class="mudo pequeno">O logotipo e o nome aparecem nos relatórios em PDF e no link do cliente.</p>' +
          '<div class="linha-info"><span>Cliente desde</span><b>' + dataCurta(d.empresa.desde) + '</b></div>' +
          '<div class="linha-info"><span>Identificador da conta</span><b class="codigo">' + esc(d.empresa.id) + '</b></div>' +
        '</section>' +
        '<section class="cartao"><h2 class="cartao-titulo">Assinatura</h2>' +
          '<div class="plano"><b>Plano ' + esc(p.nome) + '</b><span class="etiqueta ' + (p.status === 'teste' ? 'etiqueta-azul' : 'etiqueta-verde') + '">' + (p.status === 'teste' ? 'Teste grátis · ' + dias + ' dias' : 'Ativa') + '</span></div>' +
          '<div class="uso"><div class="uso-topo"><span>Obras ativas</span><b>' + obrasAtivas + ' de ' + p.limiteObras + '</b></div>' +
            '<div class="uso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="' + p.limiteObras + '" aria-valuenow="' + obrasAtivas + '"><span style="width:' + Math.min(100, Math.round(obrasAtivas / p.limiteObras * 100)) + '%"></span></div></div>' +
          '<div class="linha-info"><span>Usuários</span><b>Ilimitados</b></div>' +
          '<div class="linha-info"><span>Clientes externos (link)</span><b>Ilimitados, sem custo</b></div>' +
          '<div class="linha-info"><span>Fim do teste</span><b>' + dataCurta(p.testeAte) + '</b></div>' +
          '<button type="button" class="btn btn-primario btn-bloco" data-acao="em-breve" data-texto="A contratação e o pagamento ainda não fazem parte do protótipo.">Assinar o plano</button>' +
        '</section>' +
      '</div>' +
      '<section class="cartao"><h2 class="cartao-titulo">Módulos</h2><ul class="fila fila-modulos">' + MODULOS.map((m) => {
        const contratado = d.empresa.modulos.includes(m.id);
        const qtd = interesses.filter((i) => i.modulo === m.id).length;
        return '<li><span class="modulo-icone pequeno modulo-' + m.id + '">' + ICONES[m.id] + '</span><div class="fila-texto"><b>KORbuild ' + m.nome + '</b><span class="mudo">' + esc(m.resumo) + '</span></div>' +
          (m.status === 'em-breve'
            ? '<span class="etiqueta etiqueta-ambar">Em breve' + (qtd ? ' · ' + qtd + (qtd === 1 ? ' interessado' : ' interessados') : '') + '</span>'
            : '<span class="etiqueta ' + (contratado ? 'etiqueta-verde' : 'etiqueta-neutro') + '">' + (contratado ? 'Contratado' : 'Não contratado') + '</span>') + '</li>';
      }).join('') + '</ul></section>' +
      '<section class="cartao"><div class="cartao-cabeca"><h2 class="cartao-titulo">Usuários</h2>' +
        '<button type="button" class="btn btn-contorno btn-pequeno" data-acao="em-breve" data-texto="Convidar usuários ainda não faz parte do protótipo.">+ Convidar usuário</button></div>' +
        '<div class="tabela-rolagem"><table class="rel-tabela tabela-usuarios"><thead><tr><th>Usuário</th><th>Papel</th><th>Último acesso</th></tr></thead><tbody>' +
        d.usuarios.map((x) => '<tr><td><b>' + esc(x.nome) + '</b><span class="mudo pequeno usuario-detalhe">' + esc(x.cargo) + ' · ' + esc(x.email) + '</span></td>' +
          '<td><span class="etiqueta ' + (x.papel === 'admin' ? 'etiqueta-azul' : 'etiqueta-neutro') + '">' + PAPEIS[x.papel].nome + '</span></td>' +
          '<td>' + (x.ultimoAcesso ? dataHora(x.ultimoAcesso) : '<span class="mudo">Nunca</span>') + '</td></tr>').join('') +
        '</tbody></table></div>' +
        '<ul class="papeis">' + Object.values(PAPEIS).map((pp) => '<li><b>' + pp.nome + '</b>: ' + esc(pp.descricao) + '.</li>').join('') +
          '<li><b>Cliente (convidado)</b>: recebe os relatórios aprovados por link, sem conta e sem custo.</li></ul>' +
      '</section>' +
      '<div class="inicio-acoes"><button type="button" class="btn btn-contorno" data-acao="recomecar">Recomeçar a demonstração</button></div>' +
    '</main>';
}
