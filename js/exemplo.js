/* KORbuild — dados fictícios da demonstração: as empresas (clientes da plataforma), os usuários e o Daily.
 * A construtora gerencia as obras; as prestadoras executam (docs/saas.md §Hierarquia). Os diários abaixo são
 * da prestadora de estrutura e alvenaria (Ridgeline), aprovados pela construtora.
 * As datas são relativas a hoje, para o painel sempre mostrar os três faróis:
 *  - Residencial Jardim das Flores: último RDO ontem (amarelo) — o RDO de hoje é feito ao vivo.
 *  - Edifício Atlântico: RDO de hoje já enviado (verde), aguardando aprovação.
 *  - Galpão Logístico Rodovia: último RDO há 2 dias, com ajustes pedidos (vermelho). */

import { hoje, somarDias, diasEntre, novoId, sha256 } from './util.js';
import { tr, emIngles } from './i18n.js';
import { DIAS_TRABALHO, ehDiaDeTrabalho } from './prazos.js';
import { criarDadosCrew, criarPontoPrestadora, RAIO_CERCA } from './crew.js';
import { criarSettings } from './settings.js';
import { criarDadosMeasure } from './measure.js';
import { retrato } from './cronograma.js';
import { modelosIniciais } from './obras.js';
import { guardarFoto } from './armazem.js';
import { fotoDeExemplo } from './fotos.js';

/* Domínios dos e-mails de exemplo no idioma da demonstração (o login aceita os dois: ver plataforma.js). */
export const DOMINIOS_EN = {
  'construtoraexemplo.com': 'examplebuilders.com', 'prestadoraexemplo.com': 'northfieldframing.com', 'estruturaexemplo.com': 'ridgelinemasonry.com',
  'cliente.exemplo.com': 'client.example.com', 'fornecedor.exemplo.com': 'supplier.example.com',
  'construtora.exemplo.com': 'gc.example.com', 'prestadora.exemplo.com': 'sub.example.com',
};
const em = (texto) => emIngles() ? texto.replace(/[a-z.]*exemplo\.com/g, (d) => DOMINIOS_EN[d] || d) : texto;

/* Três empresas assinam o KORbuild na demonstração, cada uma com os seus dados (docs/saas.md §Hierarquia):
 *  - a CONSTRUTORA (general contractor): gerencia as obras e aprova os diários das prestadoras; não executa;
 *  - a ESTRUTURA (Ridgeline, subcontractor de estrutura e alvenaria): diário e ponto nas três obras;
 *  - a PRESTADORA (Northfield, subcontractor de framing e siding): mede e orça no Measure, trabalha para a
 *    construtora e também tem cliente direto, sem construtora (HS-13). */
const TERMOS = tr('Proposta válida por 30 dias.\nPagamento: 30% na assinatura, 40% na metade do serviço e 30% na conclusão.\nNão inclui licenças, caçamba e reparos ocultos, salvo quando listados no escopo.\nAlterações de escopo só por escrito (change order), com preço e prazo combinados antes.');
const SEGUROS = tr('General liability: US$ 1.000.000 por ocorrência / US$ 2.000.000 agregado\nWorkers\' compensation\nCommercial auto');
export const CONSTRUTORA = {
  id: 'construtora-exemplo', nome: tr('Construtora Exemplo'), razaoSocial: tr('Construtora Exemplo LLC'), sigla: 'CE', ein: '00-0000000', atuacao: 'construtora',
  especialidades: tr('Gestão de obras residenciais, comerciais e industriais'), endereco: '900 Elm St', cidade: 'Manchester', estado: 'NH', zip: '03101',
  telefone: '(603) 555-0180', email: em('office@construtoraexemplo.com'), site: em('construtoraexemplo.com'),
  licencas: tr('Registro de contractor na cidade de Manchester'), seguros: SEGUROS, termosProposta: TERMOS, logo: null,
};
export const PRESTADORA = {
  id: 'prestadora-exemplo', nome: tr('Northfield Framing & Siding'), razaoSocial: tr('Northfield Framing & Siding LLC'), sigla: 'NFS', ein: '00-0000001', atuacao: 'prestadora',
  especialidades: tr('Framing, siding, janelas e acabamento externo'), endereco: '210 Canal St', cidade: 'Manchester', estado: 'NH', zip: '03101',
  telefone: '(603) 555-0100', email: em('office@prestadoraexemplo.com'), site: em('prestadoraexemplo.com'),
  licencas: tr('Registro de contractor na cidade de Manchester\nEPA Lead-Safe Certified Firm (RRP)'), seguros: SEGUROS, termosProposta: TERMOS, logo: null,
};
export const ESTRUTURA = {
  id: 'prestadora-estrutura', nome: tr('Ridgeline Concrete & Masonry'), razaoSocial: tr('Ridgeline Concrete & Masonry LLC'), sigla: 'RCM', ein: '00-0000002', atuacao: 'prestadora',
  especialidades: tr('Estrutura de concreto, alvenaria e pisos industriais'), endereco: '75 Gold St', cidade: 'Manchester', estado: 'NH', zip: '03103',
  telefone: '(603) 555-0130', email: em('office@estruturaexemplo.com'), site: em('estruturaexemplo.com'),
  licencas: tr('Registro de contractor na cidade de Manchester'), seguros: SEGUROS, termosProposta: TERMOS, logo: null,
};
/* Os de fora: um diretório só, com marcadores (docs/saas.md §Atores). Cada empresa tem o seu. */
const CONTATOS_COMUNS = [
  ['ct-horizonte', tr('Incorporadora Horizonte'), tr('Renata Alves'), 'cliente', 'Manchester'],
  ['ct-atlantico', tr('Condomínio Atlântico'), tr('Síndico Jorge Prado'), 'cliente', 'Portsmouth'],
  ['ct-logsul', tr('LogSul Armazéns'), tr('Fernanda Rocha'), 'cliente', 'Nashua'],
  ['ct-thompson', tr('Thompson Family'), tr('David Thompson'), 'cliente', 'Manchester'],
  ['ct-mitchell', tr('Sarah Mitchell'), '', 'cliente', 'Concord'],
  ['ct-pinewood', tr('Pinewood Lumber Co.'), tr('Balcão de vendas'), 'fornecedor', 'Manchester', ['06 11 00 · Wood framing', '06 16 00 · Sheathing', '07 25 00 · Weather barriers', '07 21 00 · Thermal insulation', '09 29 00 · Gypsum board']],
  ['ct-clearview', tr('ClearView Windows & Doors'), tr('Kevin Walsh'), 'fornecedor', 'Bedford', ['08 53 00 · Plastic windows', '08 14 00 · Wood doors', '08 71 00 · Door hardware']],
  ['ct-summit', tr('Summit Siding Supply'), tr('Orçamentos'), 'fornecedor', 'Concord', ['07 46 33 · Plastic siding', '07 65 00 · Flexible flashing', '06 22 00 · Millwork']],
  ['ct-readymix', tr('Merrimack Ready-Mix'), tr('Despacho'), 'fornecedor', 'Hooksett', ['03 30 00 · Cast-in-place concrete', '03 21 00 · Reinforcement']],
  ['ct-floor', tr('Floor Center NH'), tr('Vendas'), 'fornecedor', 'Manchester', ['09 65 00 · Resilient flooring']],
];
// só da construtora: as prestadoras que ela contrata
const CONTATOS_CONSTRUTORA = [
  ['ct-ridgeline', tr('Ridgeline Concrete & Masonry'), tr('Sandra Lopes'), 'prestadora', 'Manchester'],
  ['ct-northfield', tr('Northfield Framing & Siding'), tr('Tom Reilly'), 'prestadora', 'Manchester'],
  ['ct-bayside', tr('Bayside Drywall'), tr('Ellen Price'), 'prestadora', 'Manchester'],
  ['ct-pineridge', tr('Pine Ridge Builders'), tr('Dan Foster'), 'prestadora', 'Concord'],
];
// contatos que também são contas no KORbuild (a convidada com conta recebe o convite na plataforma)
const CONTAS_DOS_CONTATOS = { 'ct-ridgeline': 'prestadora-estrutura', 'ct-northfield': 'prestadora-exemplo', 'ct-construtora': 'construtora-exemplo' };
// só da prestadora: as construtoras que a contratam
const CONTATOS_PRESTADORA = [
  ['ct-construtora', tr('Construtora Exemplo'), tr('Ana Ribeiro'), 'construtora', 'Manchester'],
  ['ct-merrimack', tr('Merrimack Valley Builders'), tr('Paul Bennett'), 'construtora', 'Manchester'],
  ['ct-granite', tr('Granite Industrial Construction'), tr('Mark Sullivan'), 'construtora', 'Nashua'],
];
function criarContatos(proprios) {
  return proprios.concat(CONTATOS_COMUNS).map(([id, nome, pessoa, papel, cidade, etapas], i) => ({
    id, nome, pessoa, papeis: [papel], cidade, estado: 'NH', endereco: '', zip: '',
    email: em(id === 'ct-construtora' ? 'ana@construtoraexemplo.com' : id.slice(3) + '@' + papel + '.exemplo.com'),
    telefone: '(603) 555-0' + String(200 + i), etapas: etapas || [], notas: '', criadoEm: Date.now(),
    ...(CONTAS_DOS_CONTATOS[id] ? { contaId: CONTAS_DOS_CONTATOS[id] } : {}),
  }));
}
export const PESSOAS = {
  campo: { nome: tr('Carlos Mendes'), papel: tr('Mestre de obras') },
  escritorio: { nome: tr('Ana Ribeiro'), papel: tr('Engenheira responsável · PE, NH nº 00000') },
};

/* Usuários de cada empresa. perfilId: perfil de acesso do Settings (Administrador, Gestor de obras, Encarregado, Trabalhador).
 * A construtora só tem gestão (não bate ponto nem faz diário); o campo é das prestadoras. */
const USUARIOS = [
  { id: 'u-ana', nome: tr('Ana Ribeiro'), email: em('ana@construtoraexemplo.com'), perfilId: 'administrador', funcionarioId: 'f-ana', cargo: tr('Engenheira responsável'), telefone: '(603) 555-0187' },
  { id: 'u-laura', nome: tr('Laura Pires'), email: em('laura@construtoraexemplo.com'), perfilId: 'gestor', funcionarioId: 'f-laura', cargo: tr('Gerente de projetos'), telefone: '(603) 555-0121' },
];
// Contas da tela de login, por empresa
export const CONTAS_DEMO = ['u-ana'];
const USUARIOS_ESTRUTURA = [
  { id: 'u-carlos', nome: tr('Carlos Mendes'), email: em('carlos@estruturaexemplo.com'), perfilId: 'encarregado', funcionarioId: 'f-carlos', cargo: tr('Mestre de obras'), telefone: '(603) 555-0142' },
  { id: 'u-sandra', nome: tr('Sandra Lopes'), email: em('sandra@estruturaexemplo.com'), perfilId: 'administrador', cargo: tr('Sócia e gerente de obras'), telefone: '(603) 555-0131' },
  { id: 'u-roberto', nome: tr('Roberto Lima'), email: em('roberto@estruturaexemplo.com'), perfilId: 'encarregado', funcionarioId: 'f-roberto', cargo: tr('Encarregado'), telefone: '(603) 555-0163' },
  { id: 'u-marcia', nome: tr('Márcia Souza'), email: em('marcia@estruturaexemplo.com'), perfilId: 'gestor', cargo: tr('Diretora de obras'), telefone: '(603) 555-0119' },
  { id: 'u-diego', nome: tr('Diego Santos'), email: em('diego@estruturaexemplo.com'), perfilId: 'trabalhador', funcionarioId: 'f-diego', cargo: tr('Pedreiro'), telefone: '(603) 555-0175' },
];
const CONTAS_DEMO_ESTRUTURA = ['u-diego', 'u-carlos', 'u-sandra'];
/* Funcionários da construtora: o pessoal de gestão. Entram como usuários e não batem ponto (HS-09). */
const FUNCIONARIOS_CONSTRUTORA = [
  ['f-ana', tr('Ana Ribeiro'), tr('Engenheira responsável'), 58, 'u-ana'],
  ['f-laura', tr('Laura Pires'), tr('Gerente de projetos'), 46, 'u-laura'],
];

const OBRAS = [
  {
    id: 'jardim', nome: tr('Residencial Jardim das Flores'), contratanteId: 'ct-horizonte', donoId: null,
    endereco: '1450 Elm St · North End', cidade: 'Manchester, NH 03104', municipio: 'Manchester', estado: 'NH', zip: '03104',
    lat: 43.0040, lon: -71.4635, etapa: tr('Alvenaria do 3º pavimento'), inicio: -120, prazo: 240,
  },
  {
    id: 'atlantico', nome: tr('Edifício Atlântico'), contratanteId: 'ct-atlantico', donoId: null,
    endereco: '120 Market St · Downtown', cidade: 'Portsmouth, NH 03801', municipio: 'Portsmouth', estado: 'NH', zip: '03801',
    lat: 43.0757, lon: -70.7568, etapa: tr('Estrutura do 7º pavimento'), inicio: -200, prazo: 400,
  },
  {
    id: 'galpao', nome: tr('Galpão Logístico Rodovia'), contratanteId: 'ct-logsul', donoId: null,
    endereco: '45 Northeastern Blvd · Industrial Park', cidade: 'Nashua, NH 03062', municipio: 'Nashua', estado: 'NH', zip: '03062',
    lat: 42.7268, lon: -71.4402, etapa: tr('Piso industrial'), inicio: -60, prazo: 150,
  },
];

const EQUIPES = {
  jardim: [[tr('Mestre de obras'), 1, 0], [tr('Pedreiro'), 6, 1], [tr('Servente'), 5, 0], [tr('Armador'), 2, 0], [tr('Eletricista'), 1, 0]],
  atlantico: [[tr('Mestre de obras'), 1, 0], [tr('Carpinteiro'), 8, 0], [tr('Armador'), 6, 1], [tr('Pedreiro'), 3, 0], [tr('Servente'), 7, 0], [tr('Operador de grua'), 1, 0]],
  galpao: [[tr('Encarregado'), 1, 0], [tr('Pedreiro'), 4, 0], [tr('Servente'), 6, 2], [tr('Operador de máquinas'), 2, 0]],
  'nf-jardim': [[tr('Encarregado'), 1, 0], [tr('Carpinteiro'), 2, 0], [tr('Ajudante'), 1, 0]],
  'nf-thompson': [[tr('Encarregado'), 1, 0], [tr('Carpinteiro'), 1, 0]],
};

const EQUIPAMENTOS = {
  jardim: [[tr('Betoneira 400 L'), 1, 'operando'], [tr('Andaime fachadeiro'), 4, 'operando'], [tr('Guincho de coluna'), 1, 'operando']],
  atlantico: [[tr('Grua'), 1, 'operando'], [tr('Vibrador de concreto'), 3, 'operando'], [tr('Serra circular de bancada'), 1, 'operando']],
  galpao: [[tr('Retroescavadeira'), 1, 'operando'], [tr('Rolo compactador'), 1, 'manutencao'], [tr('Caminhão betoneira'), 2, 'operando']],
  'nf-jardim': [[tr('Pistola de pregos'), 3, 'operando'], [tr('Andaime fachadeiro'), 2, 'operando']],
  'nf-thompson': [[tr('Andaime fachadeiro'), 2, 'operando'], [tr('Serra de esquadria'), 1, 'operando']],
};

const ATIVIDADES = {
  jardim: [
    [tr('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D.'), tr('3º pavimento · Bloco A'), 'andamento'],
    [tr('Chumbamento de caixinhas elétricas e passagem de eletrodutos.'), tr('2º pavimento'), 'andamento'],
    [tr('Limpeza geral e organização do canteiro.'), tr('Canteiro'), 'concluida'],
  ],
  atlantico: [
    [tr('Montagem de fôrmas das vigas e da laje do 7º pavimento.'), tr('7º pavimento'), 'andamento'],
    [tr('Armação dos pilares P12 a P20 conferida pelo engenheiro.'), tr('7º pavimento'), 'concluida'],
    [tr('Desforma das lajes do 5º pavimento e reescoramento.'), tr('5º pavimento'), 'andamento'],
  ],
  galpao: [
    [tr('Compactação da sub-base do piso, quadrantes 3 e 4.'), tr('Área de armazenagem'), 'andamento'],
    [tr('Lançamento de concreto do piso industrial, 180 m².'), tr('Quadrante 2'), 'concluida'],
  ],
  'nf-jardim': [
    [tr('Framing das paredes externas do 2º pavimento, fachada norte.'), tr('2º pavimento'), 'andamento'],
    [tr('Sheathing (OSB) da fachada leste.'), tr('Fachada leste'), 'andamento'],
  ],
  'nf-thompson': [
    [tr('Retirada do siding antigo e conferência do sheathing.'), tr('Fachada frontal'), 'andamento'],
    [tr('Instalação de house wrap e flashing das janelas.'), tr('Fachada frontal'), 'andamento'],
  ],
};

/* Primeira atividade de cada dia, para os RDOs não parecerem cópias na lista. */
const ATIVIDADE_DO_DIA = {
  jardim: [
    tr('Marcação da primeira fiada de alvenaria do 3º pavimento, eixos A a D.'),
    tr('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A e B.'),
    tr('Execução de vergas e contravergas das janelas do 2º pavimento.'),
    tr('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos C e D.'),
    tr('Encunhamento da alvenaria do 2º pavimento e conferência de prumo.'),
    tr('Assentamento de bloco cerâmico nas paredes do 3º pavimento, eixos A a D.'),
  ],
  atlantico: [
    tr('Concretagem dos pilares do 6º pavimento, 18 m³, com caminhão-bomba.'),
    tr('Montagem de fôrmas dos pilares do 7º pavimento.'),
    tr('Armação dos pilares P1 a P11 do 7º pavimento.'),
    tr('Escoramento e montagem de fôrmas das vigas do 7º pavimento.'),
    tr('Montagem de fôrmas das vigas e da laje do 7º pavimento.'),
  ],
  galpao: [
    tr('Regularização e nivelamento da base do piso, quadrantes 1 e 2.'),
    tr('Instalação de barras de transferência nas juntas do quadrante 2.'),
    tr('Armação em tela soldada do quadrante 2 do piso industrial.'),
    tr('Compactação da sub-base do piso, quadrantes 3 e 4.'),
  ],
  'nf-jardim': [
    tr('Framing das paredes internas do 2º pavimento, unidades 201 a 204.'),
    tr('Framing das paredes externas do 2º pavimento, fachada sul.'),
    tr('Blocking e reforços para armários e corrimãos do 2º pavimento.'),
    tr('Framing das paredes externas do 2º pavimento, fachada norte.'),
  ],
  'nf-thompson': [
    tr('Montagem do andaime e proteção do jardim e das janelas.'),
    tr('Retirada do siding antigo da fachada frontal.'),
    tr('Retirada do siding antigo e conferência do sheathing.'),
  ],
};

const OCORRENCIAS = {
  'jardim:-1': [['material', tr('Entrega de cimento atrasou 3 horas; assentamento começou às 10h.')]],
  'atlantico:0': [['visita', tr('Visita do fiscal do cliente às 10h; sem apontamentos.')]],
  'galpao:ajustes': [['equipamento', tr('Rolo compactador parado por vazamento hidráulico; técnico agendado para amanhã.')], ['chuva', tr('Chuva forte das 14h às 16h; lançamento de concreto suspenso.')]],
};

const CLIMA_DIAS = [
  { manha: ['sol', true], tarde: ['sol', true] },
  { manha: ['nublado', true], tarde: ['chuva', false] },
  { manha: ['sol', true], tarde: ['nublado', true] },
  { manha: ['chuva', true], tarde: ['nublado', true] },
];

const CENA = { jardim: 'alvenaria', atlantico: 'estrutura', galpao: 'galpao', 'nf-jardim': 'estrutura', 'nf-thompson': 'alvenaria' };

/* Quais dias cada obra tem RDO, e em que estado. */
const PLANO = {
  jardim: [[-6, 'aprovado'], [-5, 'aprovado'], [-4, 'aprovado'], [-3, 'aprovado'], [-2, 'aprovado'], [-1, 'enviado']],
  atlantico: [[-4, 'aprovado'], [-3, 'aprovado'], [-2, 'aprovado'], [-1, 'aprovado'], [0, 'enviado']],
  galpao: null, // calculado: falta o RDO do último dia de trabalho (para mostrar o atraso)
  // Northfield: framing no Jardim (aprovado pela construtora) e a obra direta com o dono (aprovada pelo Tom)
  'nf-jardim': [[-4, 'aprovado'], [-3, 'aprovado'], [-2, 'aprovado'], [-1, 'enviado']],
  'nf-thompson': [[-3, 'aprovado'], [-2, 'aprovado'], [-1, 'enviado']],
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

/* Diários de exemplo das obras de uma prestadora. autor: quem preenche; aprovador(obra): quem aprova — a
 * construtora, na obra ligada a ela (HS-11), ou a própria prestadora, na obra com o dono (HS-13). */
async function criarRdos(obras, autor, aprovador, semente) {
  const dia0 = hoje();
  const rdos = [];
  for (const obra of obras) {
    const plano = PLANO[obra.id] || planoGalpao(dia0);
    const primeiroNumero = 40 + obras.indexOf(obra) * 37;
    const quemAprova = aprovador(obra);
    for (let i = 0; i < plano.length; i++) {
      const [desloc, status] = plano[i];
      const data = somarDias(dia0, desloc);
      const clima = CLIMA_DIAS[(i + obras.indexOf(obra)) % CLIMA_DIAS.length];
      const recente = desloc >= -2;
      const fotos = [];
      const qtdFotos = recente ? 3 : 2;
      for (let f = 0; f < qtdFotos; f++) {
        const quando = momento(data, 9 + f * 2, 10 + f * 7);
        const { blob, mini, largura, altura } = await fotoDeExemplo({ cena: f === 2 && obra.id === 'atlantico' || f === 2 && obra.id === 'jardim' ? 'concreto' : CENA[obra.id], obra, quando, semente: semente++ });
        const id = novoId('foto');
        await guardarFoto(id, blob, mini);
        fotos.push({
          id, legenda: [tr('Vista geral da frente de serviço'), tr('Detalhe da execução'), tr('Chegada de material')][f],
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
        autor,
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
          { em: momento(data, 7, 40), quem: autor, acao: tr('Começou o RDO') },
          { em: enviadoEm, quem: autor, acao: tr('Enviou para aprovação') },
        ],
      };
      if (status === 'aprovado') {
        r.aprovadoEm = momento(somarDias(data, 1), 8, 15);
        r.aprovadoPor = quemAprova;
        if (obra.vinculo) r.aprovadoPorEmpresa = CONSTRUTORA.nome;
      }
      if (status === 'ajustes') {
        r.motivoAjuste = tr('Faltou a foto da armação do quadrante 2 antes do lançamento do concreto. Inclua e reenvie, por favor.');
        r.historico.push({ em: momento(somarDias(data, 1), 8, 30), quem: quemAprova, acao: (tr('Pediu ajustes:') + ' ') + r.motivoAjuste });
      }
      rdos.push(r);
    }
  }
  // Aprovados ganham o lacre (hash do documento) do mesmo jeito que na aprovação ao vivo.
  const { lacrar } = await import('./lacre.js');
  for (const r of rdos) {
    if (r.status === 'aprovado') {
      await lacrar(r, obras.find((o) => o.id === r.obraId));
      r.historico.push({ em: r.aprovadoEm, quem: r.aprovadoPor, acao: (tr('Aprovou · código') + ' ') + r.codigo });
    }
  }
  return rdos;
}

/* Mude quando o formato dos dados mudar: dados de versão antiga são recriados. */
export const VERSAO_DADOS = 28;

const plano = (dia0, nome, limite) => ({ nome: tr(nome), status: 'teste', testeAte: somarDias(dia0, limite), limiteObras: 5 });

export async function criarDemonstracao() {
  const dia0 = hoje();
  const datas = (o) => ({ inicio: somarDias(dia0, o.inicio), prazo: somarDias(dia0, o.prazo), diasTrabalho: DIAS_TRABALHO, situacao: 'andamento', cerca: { lat: o.lat, lon: o.lon, raio: RAIO_CERCA } });
  const inicioEmpresa = somarDias(dia0, -400);
  const registro = new Date(inicioEmpresa + 'T09:00:00').getTime();

  // Construtora: gerencia as obras. Não faz diário nem ponto (HS-09): acompanha e aprova os das prestadoras.
  const obrasGc = OBRAS.map((o) => ({ ...o, ...datas(o), responsavelId: null }));
  const construtora = {
    criadoEm: Date.now(), offlineSimulado: false,
    empresa: { ...CONSTRUTORA, desde: somarDias(dia0, -2), plano: plano(dia0, 'Profissional', 12), modulos: ['daily'] },
    usuarios: USUARIOS.map((u, i) => ({ ...u, ativo: true, ultimoAcesso: i < 1 ? null : momento(somarDias(dia0, -1), 17, 5) })), contasDemo: CONTAS_DEMO,
    interesses: [], contatos: criarContatos(CONTATOS_CONSTRUTORA), obras: obrasGc, rdos: [],
    funcionarios: FUNCIONARIOS_CONSTRUTORA.map(([id, nome, funcao, valor, usuarioId], n) => {
      const admissao = somarDias(dia0, -(600 + n * 200));
      return {
        id, nome, funcao, equipeId: null, admissao, valores: [{ desde: admissao, valor, motivo: tr('Admissão'), por: tr('Ana Ribeiro'), em: new Date(admissao + 'T09:00:00').getTime() }],
        usuarioId, codigo: 'G-' + String(1 + n), telefone: usuarioId === 'u-ana' ? '(603) 555-0187' : '(603) 555-0121', emergencia: '', classificacao: 'w2', flsa: 'isento', situacao: 'ativo',
        desligamento: '', avisoGps: null, certificacoes: n === 0 ? [{ nome: 'OSHA 30', validade: somarDias(dia0, 500) }] : [],
      };
    }),
    settings: criarSettings(inicioEmpresa, registro),
    crew: { equipes: [], batidas: [], excursoes: [], aprovacoes: [], historico: [], orcamentos: {} },
    modelosCronograma: [], measure: criarDadosMeasure({ projetos: false }),
  };

  // Ridgeline: estrutura e alvenaria nas três obras da construtora, cada uma ligada à obra dela (vinculo).
  const obrasRd = OBRAS.map((o) => ({ ...o, ...datas(o), contratanteId: 'ct-construtora', donoId: o.contratanteId, responsavelId: 'u-carlos', vinculo: { empresaId: CONSTRUTORA.id, obraId: o.id } }));
  const { funcionarios: funcRd, ...crewRd } = criarDadosCrew(obrasRd);
  const estrutura = {
    criadoEm: Date.now(), offlineSimulado: false,
    empresa: { ...ESTRUTURA, desde: somarDias(dia0, -3), plano: plano(dia0, 'Profissional', 11), modulos: ['daily', 'crew'] },
    usuarios: USUARIOS_ESTRUTURA.map((u, i) => ({ ...u, ativo: true, ultimoAcesso: i < 3 ? null : momento(somarDias(dia0, -i), 17, 5) })), contasDemo: CONTAS_DEMO_ESTRUTURA,
    interesses: [], contatos: criarContatos(CONTATOS_PRESTADORA), obras: obrasRd,
    rdos: await criarRdos(obrasRd, PESSOAS.campo.nome, () => PESSOAS.escritorio.nome, 7),
    funcionarios: funcRd, settings: criarSettings(inicioEmpresa, registro, tr('Sandra Lopes')), crew: crewRd,
    cronogramas: {}, modelosCronograma: modelosIniciais('estrutura'), measure: criarDadosMeasure({ projetos: false }),
  };

  // Northfield: framing e siding no Jardim (para a construtora) e uma obra direta com o dono (HS-13).
  const prestadora = criarPrestadora(dia0);
  prestadora.rdos = await criarRdos(prestadora.obras, tr('José Pereira'), (o) => (o.vinculo ? PESSOAS.escritorio.nome : tr('Tom Reilly')), 300);
  // a prestadora já publicou uma versão do cronograma para a construtora (há 2 dias)
  const pub = retrato(prestadora, prestadora.obras[0], tr('Tom Reilly'), new Date(somarDias(dia0, -2) + 'T16:00:00').getTime(), 1);
  prestadora.cronogramas['nf-jardim'].publicacoes.push({ id: pub.id, versao: 1, em: pub.em, por: pub.por });
  prestadora.obras.find((o) => o.id === 'nf-jardim').concorrenciaId = 'co-jardim-siding';
  return {
    versao: VERSAO_DADOS, padrao: CONSTRUTORA.id, empresas: { [CONSTRUTORA.id]: construtora, [ESTRUTURA.id]: estrutura, [PRESTADORA.id]: prestadora },
    compartilhados: [pub], concorrencias: criarConcorrencias(dia0, construtora.contatos),
  };
}

/* Concorrências da construtora (docs/concorrencias.md §9): uma aberta no Edifício Atlântico, com três convidadas
 * (Northfield com conta, Bayside e Pine Ridge pelo link), e a do siding do Jardim, já fechada com a Northfield
 * (é a ligação que a obra nf-jardim já tem). */
function criarConcorrencias(dia0, contatos) {
  const ct = (id) => contatos.find((c) => c.id === id);
  const ano = dia0.slice(0, 4);
  const convite = (id, contatoId, extra) => {
    const c = ct(contatoId);
    return {
      id, contatoId, nome: c.nome, email: c.email, empresaId: c.contaId || null, token: 'lk-' + id,
      situacao: 'enviado', motivo: '', vistoEm: null, respondidoEm: null, projetoId: null, propostas: [], ...extra,
    };
  };
  const proposta = (rev, numero, em, por, porEtapa, prazoExecucaoDias, exclusoes) => ({
    rev, numero, enviadaEm: em, por, porEtapa, total: Object.values(porEtapa).reduce((s, x) => s + x, 0), prazoExecucaoDias, exclusoes, pdf: null,
  });
  const FRAMING = '06 11 00 · Wood framing', DRYWALL = '09 29 00 · Gypsum board', SIDING = '07 46 33 · Plastic siding';
  const enviada = momento(somarDias(dia0, -6), 10, 30);
  const atlantico = {
    id: 'co-atlantico-framing', contratanteId: CONSTRUTORA.id, origem: { tipo: 'obra', id: 'atlantico' }, obraId: 'atlantico',
    servico: tr('Framing e drywall'), etapas: [FRAMING, DRYWALL],
    incluso: [tr('Estrutura de madeira das paredes internas e externas, 2º ao 6º pavimento'), tr('Drywall com acabamento nível 4 nas áreas comuns e nível 3 nas unidades'), tr('Andaimes e equipamentos de acesso')],
    excluso: [tr('Isolamento térmico e acústico'), tr('Pintura')], observacoes: tr('Visita à obra na terça às 9h. Trabalho de segunda a sexta, das 7h às 15h30.'),
    desenhos: [{ nome: 'A-101', arquivoId: null }, { nome: 'A-201', arquivoId: null }, { nome: 'A-301', arquivoId: null }],
    prazo: somarDias(dia0, 5) + 'T18:00', inicio: somarDias(dia0, 30), termino: somarDias(dia0, 120),
    orcamento: { valor: 195000, porEtapa: { [FRAMING]: 125000, [DRYWALL]: 70000 }, mostrar: 'nao' },
    exigencias: { glMinimo: 1000000, wcObrigatorio: true, licenca: '', visita: { obrigatoria: false, data: somarDias(dia0, -2) } },
    quarteirizacao: 'permitida', situacao: 'aberta', criadaPor: tr('Ana Ribeiro'), criadaEm: enviada - 3600000, enviadaEm: enviada,
    historico: [{ em: enviada, por: tr('Ana Ribeiro'), acao: tr('Convites enviados'), detalhe: [ct('ct-northfield'), ct('ct-bayside'), ct('ct-pineridge')].map((c) => c.nome).join(', ') }],
    fechamento: null,
    convites: [
      convite('cv-atl-northfield', 'ct-northfield', {
        situacao: 'proposta', vistoEm: enviada + 7200000, respondidoEm: momento(somarDias(dia0, -5), 8, 40),
        propostas: [proposta(1, 'P-' + ano + '-021', momento(somarDias(dia0, -1), 15, 20), tr('Tom Reilly'), { [FRAMING]: 121900, [DRYWALL]: 64500 }, 75, [tr('Isolamento térmico')])],
      }),
      convite('cv-atl-bayside', 'ct-bayside', {
        situacao: 'proposta', vistoEm: momento(somarDias(dia0, -5), 11, 0), respondidoEm: momento(somarDias(dia0, -5), 11, 5),
        propostas: [proposta(1, null, momento(somarDias(dia0, -2), 17, 45), tr('Ellen Price'), { [DRYWALL]: 61500 }, 50, [tr('Andaimes')])],
      }),
      convite('cv-atl-pineridge', 'ct-pineridge', { situacao: 'nao-vai', motivo: tr('Agenda cheia até dezembro'), vistoEm: momento(somarDias(dia0, -4), 9, 10), respondidoEm: momento(somarDias(dia0, -4), 9, 12) }),
    ],
  };
  const fechada = momento(somarDias(dia0, -45), 14, 0);
  const jardim = {
    id: 'co-jardim-siding', contratanteId: CONSTRUTORA.id, origem: { tipo: 'obra', id: 'jardim' }, obraId: 'jardim',
    servico: tr('Framing e siding'), etapas: [FRAMING, SIDING],
    incluso: [tr('Estrutura de madeira das casas'), tr('Siding vinílico com acabamentos')], excluso: [tr('Janelas e portas')], observacoes: '',
    desenhos: [{ nome: 'A-101', arquivoId: null }, { nome: 'A-201', arquivoId: null }],
    prazo: somarDias(dia0, -50) + 'T18:00', inicio: somarDias(dia0, -40), termino: somarDias(dia0, 60),
    orcamento: { valor: null, porEtapa: {}, mostrar: 'nao' }, exigencias: { glMinimo: 1000000, wcObrigatorio: true, licenca: '', visita: { obrigatoria: false } },
    quarteirizacao: 'permitida', situacao: 'fechada', criadaPor: tr('Ana Ribeiro'), criadaEm: momento(somarDias(dia0, -60), 9, 0), enviadaEm: momento(somarDias(dia0, -60), 9, 30),
    historico: [
      { em: momento(somarDias(dia0, -60), 9, 30), por: tr('Ana Ribeiro'), acao: tr('Convites enviados'), detalhe: [ct('ct-northfield'), ct('ct-pineridge')].map((c) => c.nome).join(', ') },
      { em: fechada, por: tr('Ana Ribeiro'), acao: tr('Concorrência fechada'), detalhe: ct('ct-northfield').nome + ' · rev. 2' },
    ],
    fechamento: { conviteId: 'cv-jar-northfield', rev: 2, valor: 238600, por: tr('Ana Ribeiro'), em: fechada, observacao: '' },
    convites: [
      convite('cv-jar-northfield', 'ct-northfield', {
        situacao: 'vencedora', vistoEm: momento(somarDias(dia0, -60), 11, 0), respondidoEm: momento(somarDias(dia0, -59), 8, 0),
        propostas: [
          proposta(1, 'P-' + ano + '-008', momento(somarDias(dia0, -53), 16, 0), tr('Tom Reilly'), { [FRAMING]: 152000, [SIDING]: 94500 }, 90, []),
          proposta(2, 'P-' + ano + '-009', momento(somarDias(dia0, -51), 10, 0), tr('Tom Reilly'), { [FRAMING]: 147600, [SIDING]: 91000 }, 90, []),
        ],
      }),
      convite('cv-jar-pineridge', 'ct-pineridge', {
        situacao: 'nao-escolhida', vistoEm: momento(somarDias(dia0, -59), 9, 0), respondidoEm: momento(somarDias(dia0, -59), 9, 30),
        propostas: [proposta(1, null, momento(somarDias(dia0, -52), 12, 0), tr('Dan Foster'), { [FRAMING]: 158000, [SIDING]: 99000 }, 100, [])],
      }),
    ],
  };
  return [atlantico, jardim];
}

/* ---------- A prestadora de serviço (subcontractor) ---------- */

const USUARIOS_PRESTADORA = [
  { id: 'u-tom', nome: tr('Tom Reilly'), email: em('tom@prestadoraexemplo.com'), perfilId: 'administrador', cargo: tr('Sócio e estimador'), telefone: '(603) 555-0101' },
  { id: 'u-rita', nome: tr('Rita Gomes'), email: em('rita@prestadoraexemplo.com'), perfilId: 'gestor', cargo: tr('Estimadora'), telefone: '(603) 555-0102' },
  { id: 'u-jose', nome: tr('José Pereira'), email: em('jose@prestadoraexemplo.com'), perfilId: 'encarregado', funcionarioId: 'f-jose', cargo: tr('Encarregado de framing'), telefone: '(603) 555-0103' },
  { id: 'u-luis', nome: tr('Luis Ortega'), email: em('luis@prestadoraexemplo.com'), perfilId: 'trabalhador', funcionarioId: 'f-luis', cargo: tr('Carpinteiro'), telefone: '(603) 555-0104' },
];
const FUNCIONARIOS_PRESTADORA = [
  ['f-jose', tr('José Pereira'), tr('Encarregado'), 34, 'u-jose'],
  ['f-luis', tr('Luis Ortega'), tr('Carpinteiro'), 27, 'u-luis'],
  ['f-kevin', tr('Kevin Dunn'), tr('Carpinteiro'), 26, null],
  ['f-andre', tr('André Lima'), tr('Ajudante'), 19, null],
];

function criarPrestadora(dia0) {
  const inicio = somarDias(dia0, -300);
  const registro = new Date(inicio + 'T09:00:00').getTime();
  const jardim = OBRAS.find((o) => o.id === 'jardim');
  // a mesma obra da construtora, vista pela prestadora: aqui é um serviço (framing e siding) contratado pela construtora
  const obras = [{
    ...jardim, id: 'nf-jardim', nome: tr('Residencial Jardim das Flores · framing e siding'), contratanteId: 'ct-construtora', donoId: 'ct-horizonte',
    etapa: tr('Framing do 2º pavimento'), inicio: somarDias(dia0, -30), prazo: somarDias(dia0, 60), responsavelId: 'u-jose', diasTrabalho: DIAS_TRABALHO,
    cerca: { lat: jardim.lat, lon: jardim.lon, raio: RAIO_CERCA },
    // ligada à obra da construtora: o cronograma publicado aqui aparece para ela (docs/cronograma.md CR-10)
    vinculo: { empresaId: CONSTRUTORA.id, obraId: 'jardim' },
  }, {
    // cliente direto, sem construtora (docs/saas.md HS-13): a própria prestadora aprova o diário
    id: 'nf-thompson', nome: tr('Residência Thompson · troca de siding'), contratanteId: 'ct-thompson', donoId: null,
    endereco: '38 Walnut Hill Rd', cidade: 'Manchester, NH 03104', municipio: 'Manchester', estado: 'NH', zip: '03104',
    lat: 43.0201, lon: -71.4302, etapa: tr('Retirada do siding antigo'), inicio: somarDias(dia0, -6), prazo: somarDias(dia0, 18),
    responsavelId: 'u-jose', diasTrabalho: DIAS_TRABALHO, situacao: 'andamento', cerca: { lat: 43.0201, lon: -71.4302, raio: RAIO_CERCA },
  }];
  const funcionarios = FUNCIONARIOS_PRESTADORA.map(([id, nome, funcao, valor, usuarioId], n) => {
    const admissao = somarDias(dia0, -(120 + n * 35));
    return {
      id, nome, funcao, equipeId: 'eq-nf', admissao, valores: [{ desde: admissao, valor, motivo: tr('Admissão'), por: tr('Tom Reilly'), em: new Date(admissao + 'T09:00:00').getTime() }],
      usuarioId, codigo: 'N-' + String(11 + n), telefone: '(603) 555-02' + String(10 + n), emergencia: '', classificacao: 'w2', flsa: 'nao-isento', situacao: 'ativo',
      desligamento: '', avisoGps: admissao, certificacoes: n === 0 ? [{ nome: 'OSHA 10', validade: somarDias(dia0, 400) }] : [],
    };
  });
  return {
    criadoEm: Date.now(), offlineSimulado: false,
    empresa: { ...PRESTADORA, desde: somarDias(dia0, -5), plano: { nome: tr('Profissional'), status: 'teste', testeAte: somarDias(dia0, 9), limiteObras: 5 }, modulos: ['daily', 'crew', 'measure'] },
    usuarios: USUARIOS_PRESTADORA.map((u) => ({ ...u, ativo: true, ultimoAcesso: null })), contasDemo: USUARIOS_PRESTADORA.map((u) => u.id),
    interesses: [], contatos: criarContatos(CONTATOS_PRESTADORA), obras, rdos: [], funcionarios,
    settings: criarSettings(inicio, registro, tr('Tom Reilly')),
    crew: { equipes: [{ id: 'eq-nf', nome: tr('Equipe do José'), encarregadoUsuarioId: 'u-jose', obraBaseId: 'nf-jardim' }], excursoes: [], ...criarPontoPrestadora(obras, funcionarios) },
    measure: criarDadosMeasure({ projetos: true, estimadores: ['u-tom', 'u-rita'] }),
    cronogramas: { 'nf-jardim': criarCronogramaExemplo(dia0) },
    modelosCronograma: modelosIniciais('prestadora'),
  };
}

/* Cronograma de exemplo do framing e siding (prestadora): uma etapa atrasada, uma em risco, linha de base
 * de antes do início e uma publicação para a construtora. Dias relativos a hoje. */
const ETAPAS_EXEMPLO = [
  // [id, nome, início, fim, %, início na base, fim na base, responsável]
  ['et-mob', tr('Mobilização e marcação'), -30, -27, 100, -30, -27, 'u-jose'],
  ['et-fr1', tr('Framing do 1º pavimento'), -26, -12, 100, -26, -13, 'u-jose'],
  ['et-blk', tr('Blocking e reforços'), -15, -3, 85, -15, -5, 'f-kevin'],
  ['et-fr2', tr('Framing do 2º pavimento'), -11, 4, 65, -12, 0, 'u-jose'],
  ['et-osb', tr('Sheathing (OSB) e house wrap'), -8, 2, 30, -8, 2, 'f-luis'],
  ['et-jan', tr('Janelas e portas externas'), 5, 15, 0, 3, 12, 'f-luis'],
  ['et-sid', tr('Siding vinil'), 14, 42, 0, 12, 38, 'u-jose'],
  ['et-trim', tr('Trim e acabamento externo'), 40, 56, 0, 36, 52, 'f-andre'],
];

function criarCronogramaExemplo(dia0) {
  const quando = (d, h) => new Date(somarDias(dia0, d) + 'T' + String(h).padStart(2, '0') + ':00:00').getTime();
  const etapas = ETAPAS_EXEMPLO.map(([id, nome, ini, fim, pct, , , resp]) => ({
    id, nome, inicio: somarDias(dia0, ini), fim: somarDias(dia0, fim), responsavelId: resp, pct,
    historico: pct ? [{ em: quando(Math.min(-1, fim), 17), data: somarDias(dia0, Math.min(-1, fim)), antes: 0, pct, fonte: 'manual', por: tr('Tom Reilly') }] : [],
  }));
  return {
    etapas,
    bases: [{ id: 'lb-1', em: quando(-33, 10), por: tr('Tom Reilly'), motivo: tr('Cronograma assinado com a construtora'),
      etapas: Object.fromEntries(ETAPAS_EXEMPLO.map(([id, , , , , bi, bf]) => [id, { inicio: somarDias(dia0, bi), fim: somarDias(dia0, bf) }])) }],
    publicacoes: [],
  };
}
