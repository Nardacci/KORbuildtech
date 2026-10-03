/* KORbuild — dados fictícios da demonstração: a empresa (cliente da plataforma), os usuários e o Daily.
 * As datas são relativas a hoje, para o painel sempre mostrar os três faróis:
 *  - Residencial Jardim das Flores: último RDO ontem (amarelo) — o RDO de hoje é feito ao vivo.
 *  - Edifício Atlântico: RDO de hoje já enviado (verde), aguardando aprovação.
 *  - Galpão Logístico Rodovia: último RDO há 2 dias, com ajustes pedidos (vermelho). */

import { hoje, somarDias, diasEntre, novoId, sha256 } from './util.js';
import { DIAS_TRABALHO, ehDiaDeTrabalho } from './prazos.js';
import { criarDadosCrew, RAIO_CERCA } from './crew.js';
import { criarSettings } from './settings.js';
import { criarDadosMeasure } from './measure.js';
import { guardarFoto } from './armazem.js';
import { fotoDeExemplo } from './fotos.js';

export const CONSTRUTORA = { nome: 'Construtora Exemplo', sigla: 'CE', ein: '00-0000000' };
export const PESSOAS = {
  campo: { nome: 'Carlos Mendes', papel: 'Mestre de obras' },
  escritorio: { nome: 'Ana Ribeiro', papel: 'Engenheira responsável · PE, NH nº 00000' },
};

/* Usuários da empresa. Os dois primeiros são as contas de demonstração da tela de login. */
// perfilId: perfil de acesso do Settings (Administrador, Gestor de obras, Encarregado, Trabalhador)
const USUARIOS = [
  { id: 'u-carlos', nome: 'Carlos Mendes', email: 'carlos@construtoraexemplo.com', perfilId: 'encarregado', funcionarioId: 'f-carlos', cargo: 'Mestre de obras', telefone: '(603) 555-0142' },
  { id: 'u-ana', nome: 'Ana Ribeiro', email: 'ana@construtoraexemplo.com', perfilId: 'administrador', cargo: 'Engenheira responsável', telefone: '(603) 555-0187' },
  { id: 'u-roberto', nome: 'Roberto Lima', email: 'roberto@construtoraexemplo.com', perfilId: 'encarregado', funcionarioId: 'f-roberto', cargo: 'Encarregado', telefone: '(603) 555-0163' },
  { id: 'u-marcia', nome: 'Márcia Souza', email: 'marcia@construtoraexemplo.com', perfilId: 'gestor', cargo: 'Diretora de obras', telefone: '(603) 555-0119' },
  { id: 'u-diego', nome: 'Diego Santos', email: 'diego@construtoraexemplo.com', perfilId: 'trabalhador', funcionarioId: 'f-diego', cargo: 'Pedreiro', telefone: '(603) 555-0175' },
];
// Contas da tela de login: uma de cada jeito de usar (só ponto, campo, escritório)
export const CONTAS_DEMO = ['u-diego', 'u-carlos', 'u-ana'];

const OBRAS = [
  {
    id: 'jardim', nome: 'Residencial Jardim das Flores', cliente: 'Incorporadora Horizonte',
    endereco: '1450 Elm St · North End', cidade: 'Manchester, NH 03104',
    lat: 43.0040, lon: -71.4635, etapa: 'Alvenaria do 3º pavimento', inicio: -120, prazo: 240,
  },
  {
    id: 'atlantico', nome: 'Edifício Atlântico', cliente: 'Condomínio Atlântico',
    endereco: '120 Market St · Downtown', cidade: 'Portsmouth, NH 03801',
    lat: 43.0757, lon: -70.7568, etapa: 'Estrutura do 7º pavimento', inicio: -200, prazo: 400,
  },
  {
    id: 'galpao', nome: 'Galpão Logístico Rodovia', cliente: 'LogSul Armazéns',
    endereco: '45 Northeastern Blvd · Industrial Park', cidade: 'Nashua, NH 03062',
    lat: 42.7268, lon: -71.4402, etapa: 'Piso industrial', inicio: -60, prazo: 150,
  },
];

const EQUIPES = {
  jardim: [['Mestre de obras', 1, 0], ['Pedreiro', 6, 1], ['Servente', 5, 0], ['Armador', 2, 0], ['Eletricista', 1, 0]],
  atlantico: [['Mestre de obras', 1, 0], ['Carpinteiro', 8, 0], ['Armador', 6, 1], ['Pedreiro', 3, 0], ['Servente', 7, 0], ['Operador de grua', 1, 0]],
  galpao: [['Encarregado', 1, 0], ['Pedreiro', 4, 0], ['Servente', 6, 2], ['Operador de máquinas', 2, 0]],
};

const EQUIPAMENTOS = {
  jardim: [['Betoneira 400 L', 1, 'operando'], ['Andaime fachadeiro', 4, 'operando'], ['Guincho de coluna', 1, 'operando']],
  atlantico: [['Grua', 1, 'operando'], ['Vibrador de concreto', 3, 'operando'], ['Serra circular de bancada', 1, 'operando']],
  galpao: [['Retroescavadeira', 1, 'operando'], ['Rolo compactador', 1, 'manutencao'], ['Caminhão betoneira', 2, 'operando']],
};

const ATIVIDADES = {
  jardim: [
    ['Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D.', '3º pavimento · Bloco A', 'andamento'],
    ['Chumbamento de caixinhas elétricas e passagem de eletrodutos.', '2º pavimento', 'andamento'],
    ['Limpeza geral e organização do canteiro.', 'Canteiro', 'concluida'],
  ],
  atlantico: [
    ['Montagem de fôrmas das vigas e da laje do 7º pavimento.', '7º pavimento', 'andamento'],
    ['Armação dos pilares P12 a P20 conferida pelo engenheiro.', '7º pavimento', 'concluida'],
    ['Desforma das lajes do 5º pavimento e reescoramento.', '5º pavimento', 'andamento'],
  ],
  galpao: [
    ['Compactação da sub-base do piso, quadrantes 3 e 4.', 'Área de armazenagem', 'andamento'],
    ['Lançamento de concreto do piso industrial, 180 m².', 'Quadrante 2', 'concluida'],
  ],
};

/* Primeira atividade de cada dia, para os RDOs não parecerem cópias na lista. */
const ATIVIDADE_DO_DIA = {
  jardim: [
    'Marcação da primeira fiada de alvenaria do 3º pavimento, eixos A a D.',
    'Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A e B.',
    'Execução de vergas e contravergas das janelas do 2º pavimento.',
    'Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos C e D.',
    'Encunhamento da alvenaria do 2º pavimento e conferência de prumo.',
    'Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D.',
  ],
  atlantico: [
    'Concretagem dos pilares do 6º pavimento, 18 m³, com caminhão-bomba.',
    'Montagem de fôrmas dos pilares do 7º pavimento.',
    'Armação dos pilares P1 a P11 do 7º pavimento.',
    'Escoramento e montagem de fôrmas das vigas do 7º pavimento.',
    'Montagem de fôrmas das vigas e da laje do 7º pavimento.',
  ],
  galpao: [
    'Regularização e nivelamento da base do piso, quadrantes 1 e 2.',
    'Instalação de barras de transferência nas juntas do quadrante 2.',
    'Armação em tela soldada do quadrante 2 do piso industrial.',
    'Compactação da sub-base do piso, quadrantes 3 e 4.',
  ],
};

const OCORRENCIAS = {
  'jardim:-1': [['material', 'Entrega de cimento atrasou 3 horas; assentamento começou às 10h.']],
  'atlantico:0': [['visita', 'Visita do fiscal do cliente às 10h; sem apontamentos.']],
  'galpao:ajustes': [['equipamento', 'Rolo compactador parado por vazamento hidráulico; técnico agendado para amanhã.'], ['chuva', 'Chuva forte das 14h às 16h; lançamento de concreto suspenso.']],
};

const CLIMA_DIAS = [
  { manha: ['sol', true], tarde: ['sol', true] },
  { manha: ['nublado', true], tarde: ['chuva', false] },
  { manha: ['sol', true], tarde: ['nublado', true] },
  { manha: ['chuva', true], tarde: ['nublado', true] },
];

const CENA = { jardim: 'alvenaria', atlantico: 'estrutura', galpao: 'galpao' };

/* Quais dias cada obra tem RDO, e em que estado. */
const PLANO = {
  jardim: [[-6, 'aprovado'], [-5, 'aprovado'], [-4, 'aprovado'], [-3, 'aprovado'], [-2, 'aprovado'], [-1, 'enviado']],
  atlantico: [[-4, 'aprovado'], [-3, 'aprovado'], [-2, 'aprovado'], [-1, 'aprovado'], [0, 'enviado']],
  galpao: null, // calculado: falta o RDO do último dia de trabalho (para mostrar o atraso)
};

/* Galpão: o último dia de trabalho antes de hoje fica sem RDO; os 4 dias de trabalho anteriores têm RDO,
 * o mais recente com ajustes pedidos. Assim a demonstração sempre mostra um RDO atrasado. */
function planoGalpao(dia0) {
  const dias = [];
  let d = dia0;
  let pulouOFaltante = false;
  while (dias.length < 4) {
    d = somarDias(d, -1);
    if (!ehDiaDeTrabalho({ diasTrabalho: DIAS_TRABALHO }, d)) continue;
    if (!pulouOFaltante) { pulouOFaltante = true; continue; }
    dias.unshift(d);
  }
  return dias.map((x, i) => [diasEntre(dia0, x), i === dias.length - 1 ? 'ajustes' : 'aprovado']);
}

function momento(iso, hora, minuto) {
  const [a, m, d] = iso.split('-').map(Number);
  return new Date(a, m - 1, d, hora, minuto).getTime();
}

/* Mude quando o formato dos dados mudar: dados de versão antiga são recriados. */
export const VERSAO_DADOS = 10;

export async function criarDemonstracao() {
  const dia0 = hoje();
  // Cada obra tem um responsável pelo RDO e um calendário de dias de trabalho (prazo diário: 18h).
  const obras = OBRAS.map((o) => ({ ...o, inicio: somarDias(dia0, o.inicio), prazo: somarDias(dia0, o.prazo), responsavelId: 'u-carlos', diasTrabalho: DIAS_TRABALHO, cerca: { lat: o.lat, lon: o.lon, raio: RAIO_CERCA } }));
  const rdos = [];
  let semente = 7;

  for (const obra of obras) {
    const plano = PLANO[obra.id] || planoGalpao(dia0);
    const primeiroNumero = 40 + Math.abs(obras.indexOf(obra)) * 37;
    for (let i = 0; i < plano.length; i++) {
      const [desloc, status] = plano[i];
      const data = somarDias(dia0, desloc);
      const clima = CLIMA_DIAS[(i + obras.indexOf(obra)) % CLIMA_DIAS.length];
      const recente = desloc >= -2;
      const fotos = [];
      const qtdFotos = recente ? 3 : 2;
      for (let f = 0; f < qtdFotos; f++) {
        const quando = momento(data, 9 + f * 2, 10 + f * 7);
        const { blob, mini, largura, altura } = await fotoDeExemplo({ cena: f === 2 && obra.id !== 'galpao' ? 'concreto' : CENA[obra.id], obra, quando, semente: semente++ });
        const id = novoId('foto');
        await guardarFoto(id, blob, mini);
        fotos.push({
          id, legenda: ['Vista geral da frente de serviço', 'Detalhe da execução', 'Chegada de material'][f],
          tiradaEm: quando, origem: 'camera', lat: obra.lat, lon: obra.lon, fonteGps: 'gps', precisao: 6,
          tamanhoOriginal: 4200000 + f * 731000, tamanho: blob.size, largura, altura,
          hashOriginal: await sha256(id + data),
        });
      }
      const enviadoEm = momento(data, 17, 20 + i);
      const r = {
        id: 'rdo-' + obra.id + '-' + (desloc < 0 ? 'm' + -desloc : 'hoje'),
        obraId: obra.id,
        data,
        numero: primeiroNumero + i,
        status,
        sync: 'enviado',
        autor: PESSOAS.campo.nome,
        criadoEm: momento(data, 7, 40),
        enviadoEm,
        primeiroEnvioEm: enviadoEm,
        clima: {
          manha: { tempo: clima.manha[0], praticavel: clima.manha[1] },
          tarde: { tempo: clima.tarde[0], praticavel: clima.tarde[1] },
          fonte: 'automatico',
        },
        equipe: EQUIPES[obra.id].map(([funcao, presentes, faltas]) => ({ funcao, presentes: presentes - (i % 2 && presentes > 2 ? 1 : 0), faltas })),
        equipamentos: EQUIPAMENTOS[obra.id].map(([nome, qtd, st]) => ({ nome, qtd, status: st })),
        atividades: ATIVIDADES[obra.id].map(([descricao, local, situacao], k) => ({
          id: novoId('at'), descricao: k === 0 ? ATIVIDADE_DO_DIA[obra.id][i] : descricao, local, situacao: desloc < -2 && k === 0 ? 'andamento' : situacao,
        })),
        ocorrencias: (OCORRENCIAS[obra.id + ':' + desloc] || (status === 'ajustes' ? OCORRENCIAS[obra.id + ':ajustes'] : null) || []).map(([tipo, descricao]) => ({ id: novoId('oc'), tipo, descricao })),
        fotos,
        observacoes: '',
        historico: [
          { em: momento(data, 7, 40), quem: PESSOAS.campo.nome, acao: 'Começou o RDO' },
          { em: enviadoEm, quem: PESSOAS.campo.nome, acao: 'Enviou para aprovação' },
        ],
      };
      if (status === 'aprovado') {
        r.aprovadoEm = momento(somarDias(data, 1), 8, 15);
        r.aprovadoPor = PESSOAS.escritorio.nome;
      }
      if (status === 'ajustes') {
        r.motivoAjuste = 'Faltou a foto da armação do quadrante 2 antes do lançamento do concreto. Inclua e reenvie, por favor.';
        r.historico.push({ em: momento(somarDias(data, 1), 8, 30), quem: PESSOAS.escritorio.nome, acao: 'Pediu ajustes: ' + r.motivoAjuste });
      }
      rdos.push(r);
    }
  }

  // Aprovados ganham o lacre (hash do documento) do mesmo jeito que na aprovação ao vivo.
  const { lacrar } = await import('./lacre.js');
  for (const r of rdos) {
    if (r.status === 'aprovado') {
      await lacrar(r, obras.find((o) => o.id === r.obraId));
      r.historico.push({ em: r.aprovadoEm, quem: PESSOAS.escritorio.nome, acao: 'Aprovou · código ' + r.codigo });
    }
  }

  const empresa = {
    id: 'construtora-exemplo', ...CONSTRUTORA, desde: somarDias(dia0, -2),
    plano: { nome: 'Profissional', status: 'teste', testeAte: somarDias(dia0, 12), limiteObras: 5 },
    modulos: ['daily', 'crew', 'measure'],
  };
  const usuarios = USUARIOS.map((u, i) => ({ ...u, ativo: true, ultimoAcesso: i < 2 ? null : momento(somarDias(dia0, -i), 17, 5) }));
  // Settings: regra de jornada e encargos da empresa desde antes da primeira admissão
  const inicioEmpresa = somarDias(dia0, -400);
  const settings = criarSettings(inicioEmpresa, new Date(inicioEmpresa + 'T09:00:00').getTime());
  const { funcionarios, ...crew } = criarDadosCrew(obras);
  return { versao: VERSAO_DADOS, criadoEm: Date.now(), offlineSimulado: false, empresa, usuarios, interesses: [], obras, rdos, funcionarios, settings, crew, measure: criarDadosMeasure() };
}
