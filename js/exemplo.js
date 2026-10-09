/* KORbuild — dados fictícios da demonstração: a empresa (cliente da plataforma), os usuários e o Daily.
 * As datas são relativas a hoje, para o painel sempre mostrar os três faróis:
 *  - Residencial Jardim das Flores: último RDO ontem (amarelo) — o RDO de hoje é feito ao vivo.
 *  - Edifício Atlântico: RDO de hoje já enviado (verde), aguardando aprovação.
 *  - Galpão Logístico Rodovia: último RDO há 2 dias, com ajustes pedidos (vermelho). */

import { hoje, somarDias, diasEntre, novoId, sha256 } from './util.js';
import { tr, emIngles } from './i18n.js';
import { DIAS_TRABALHO, ehDiaDeTrabalho } from './prazos.js';
import { criarDadosCrew, RAIO_CERCA } from './crew.js';
import { criarSettings } from './settings.js';
import { criarDadosMeasure } from './measure.js';
import { retrato } from './cronograma.js';
import { modelosIniciais } from './obras.js';
import { guardarFoto } from './armazem.js';
import { fotoDeExemplo } from './fotos.js';

/* Domínios dos e-mails de exemplo no idioma da demonstração (o login aceita os dois: ver plataforma.js). */
export const DOMINIOS_EN = {
  'construtoraexemplo.com': 'examplebuilders.com', 'prestadoraexemplo.com': 'northfieldframing.com',
  'cliente.exemplo.com': 'client.example.com', 'fornecedor.exemplo.com': 'supplier.example.com',
  'construtora.exemplo.com': 'gc.example.com', 'prestadora.exemplo.com': 'sub.example.com',
};
const em = (texto) => emIngles() ? texto.replace(/[a-z.]*exemplo\.com/g, (d) => DOMINIOS_EN[d] || d) : texto;

/* Duas empresas assinam o KORbuild na demonstração, cada uma com os seus dados (docs/saas.md §Atores):
 *  - a CONSTRUTORA (general contractor que também executa): Ana é a administradora;
 *  - a PRESTADORA (subcontractor de framing e siding): mede e orça no Measure e trabalha para a construtora. */
const TERMOS = tr('Proposta válida por 30 dias.\nPagamento: 30% na assinatura, 40% na metade do serviço e 30% na conclusão.\nNão inclui licenças, caçamba e reparos ocultos, salvo quando listados no escopo.\nAlterações de escopo só por escrito (change order), com preço e prazo combinados antes.');
const SEGUROS = tr('General liability: US$ 1.000.000 por ocorrência / US$ 2.000.000 agregado\nWorkers\' compensation\nCommercial auto');
export const CONSTRUTORA = {
  id: 'construtora-exemplo', nome: tr('Construtora Exemplo'), razaoSocial: tr('Construtora Exemplo LLC'), sigla: 'CE', ein: '00-0000000', atuacao: 'construtora',
  especialidades: tr('Obras residenciais, comerciais e industriais: estrutura, alvenaria e gestão de obra'), endereco: '900 Elm St', cidade: 'Manchester', estado: 'NH', zip: '03101',
  telefone: '(603) 555-0180', email: em('office@construtoraexemplo.com'), site: em('construtoraexemplo.com'),
  licencas: tr('Registro de contractor na cidade de Manchester'), seguros: SEGUROS, termosProposta: TERMOS, logo: null,
};
export const PRESTADORA = {
  id: 'prestadora-exemplo', nome: tr('Northfield Framing & Siding'), razaoSocial: tr('Northfield Framing & Siding LLC'), sigla: 'NFS', ein: '00-0000001', atuacao: 'prestadora',
  especialidades: tr('Framing, siding, janelas e acabamento externo'), endereco: '210 Canal St', cidade: 'Manchester', estado: 'NH', zip: '03101',
  telefone: '(603) 555-0100', email: em('office@prestadoraexemplo.com'), site: em('prestadoraexemplo.com'),
  licencas: tr('Registro de contractor na cidade de Manchester\nEPA Lead-Safe Certified Firm (RRP)'), seguros: SEGUROS, termosProposta: TERMOS, logo: null,
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
  ['ct-northfield', tr('Northfield Framing & Siding'), tr('Tom Reilly'), 'prestadora', 'Manchester'],
  ['ct-bayside', tr('Bayside Drywall'), tr('Ellen Price'), 'prestadora', 'Manchester'],
];
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
  }));
}
export const PESSOAS = {
  campo: { nome: tr('Carlos Mendes'), papel: tr('Mestre de obras') },
  escritorio: { nome: tr('Ana Ribeiro'), papel: tr('Engenheira responsável · PE, NH nº 00000') },
};

/* Usuários da empresa. Os dois primeiros são as contas de demonstração da tela de login. */
// perfilId: perfil de acesso do Settings (Administrador, Gestor de obras, Encarregado, Trabalhador)
const USUARIOS = [
  { id: 'u-carlos', nome: tr('Carlos Mendes'), email: em('carlos@construtoraexemplo.com'), perfilId: 'encarregado', funcionarioId: 'f-carlos', cargo: tr('Mestre de obras'), telefone: '(603) 555-0142' },
  { id: 'u-ana', nome: tr('Ana Ribeiro'), email: em('ana@construtoraexemplo.com'), perfilId: 'administrador', cargo: tr('Engenheira responsável'), telefone: '(603) 555-0187' },
  { id: 'u-roberto', nome: tr('Roberto Lima'), email: em('roberto@construtoraexemplo.com'), perfilId: 'encarregado', funcionarioId: 'f-roberto', cargo: tr('Encarregado'), telefone: '(603) 555-0163' },
  { id: 'u-marcia', nome: tr('Márcia Souza'), email: em('marcia@construtoraexemplo.com'), perfilId: 'gestor', cargo: tr('Diretora de obras'), telefone: '(603) 555-0119' },
  { id: 'u-diego', nome: tr('Diego Santos'), email: em('diego@construtoraexemplo.com'), perfilId: 'trabalhador', funcionarioId: 'f-diego', cargo: tr('Pedreiro'), telefone: '(603) 555-0175' },
];
// Contas da tela de login: uma de cada jeito de usar (só ponto, campo, escritório)
export const CONTAS_DEMO = ['u-diego', 'u-carlos', 'u-ana'];

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
};

const EQUIPAMENTOS = {
  jardim: [[tr('Betoneira 400 L'), 1, 'operando'], [tr('Andaime fachadeiro'), 4, 'operando'], [tr('Guincho de coluna'), 1, 'operando']],
  atlantico: [[tr('Grua'), 1, 'operando'], [tr('Vibrador de concreto'), 3, 'operando'], [tr('Serra circular de bancada'), 1, 'operando']],
  galpao: [[tr('Retroescavadeira'), 1, 'operando'], [tr('Rolo compactador'), 1, 'manutencao'], [tr('Caminhão betoneira'), 2, 'operando']],
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
export const VERSAO_DADOS = 25;

export async function criarDemonstracao() {
  const dia0 = hoje();
  // Cada obra tem um responsável pelo RDO e um calendário de dias de trabalho (prazo diário: 18h).
  const obras = OBRAS.map((o) => ({ ...o, inicio: somarDias(dia0, o.inicio), prazo: somarDias(dia0, o.prazo), responsavelId: 'u-carlos', diasTrabalho: DIAS_TRABALHO, situacao: 'andamento', cerca: { lat: o.lat, lon: o.lon, raio: RAIO_CERCA } }));
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
          { em: momento(data, 7, 40), quem: PESSOAS.campo.nome, acao: tr('Começou o RDO') },
          { em: enviadoEm, quem: PESSOAS.campo.nome, acao: tr('Enviou para aprovação') },
        ],
      };
      if (status === 'aprovado') {
        r.aprovadoEm = momento(somarDias(data, 1), 8, 15);
        r.aprovadoPor = PESSOAS.escritorio.nome;
      }
      if (status === 'ajustes') {
        r.motivoAjuste = tr('Faltou a foto da armação do quadrante 2 antes do lançamento do concreto. Inclua e reenvie, por favor.');
        r.historico.push({ em: momento(somarDias(data, 1), 8, 30), quem: PESSOAS.escritorio.nome, acao: (tr('Pediu ajustes:') + ' ') + r.motivoAjuste });
      }
      rdos.push(r);
    }
  }

  // Aprovados ganham o lacre (hash do documento) do mesmo jeito que na aprovação ao vivo.
  const { lacrar } = await import('./lacre.js');
  for (const r of rdos) {
    if (r.status === 'aprovado') {
      await lacrar(r, obras.find((o) => o.id === r.obraId));
      r.historico.push({ em: r.aprovadoEm, quem: PESSOAS.escritorio.nome, acao: (tr('Aprovou · código') + ' ') + r.codigo });
    }
  }

  const empresa = {
    ...CONSTRUTORA, desde: somarDias(dia0, -2),
    plano: { nome: tr('Profissional'), status: 'teste', testeAte: somarDias(dia0, 12), limiteObras: 5 },
    modulos: ['daily', 'crew'], // o Measure é das prestadoras
  };
  const usuarios = USUARIOS.map((u, i) => ({ ...u, ativo: true, ultimoAcesso: i < 2 ? null : momento(somarDias(dia0, -i), 17, 5) }));
  // Settings: regra de jornada e encargos da empresa desde antes da primeira admissão
  const inicioEmpresa = somarDias(dia0, -400);
  const settings = criarSettings(inicioEmpresa, new Date(inicioEmpresa + 'T09:00:00').getTime());
  const { funcionarios, ...crew } = criarDadosCrew(obras);
  const construtora = { criadoEm: Date.now(), offlineSimulado: false, empresa, usuarios, contasDemo: CONTAS_DEMO, interesses: [], contatos: criarContatos(CONTATOS_CONSTRUTORA), obras, rdos, funcionarios, settings, crew, modelosCronograma: modelosIniciais('construtora'), measure: criarDadosMeasure({ projetos: false }) };
  const prestadora = criarPrestadora(dia0);
  // a prestadora já publicou uma versão do cronograma para a construtora (há 2 dias)
  const pub = retrato(prestadora, prestadora.obras[0], tr('Tom Reilly'), new Date(somarDias(dia0, -2) + 'T16:00:00').getTime(), 1);
  prestadora.cronogramas['nf-jardim'].publicacoes.push({ id: pub.id, versao: 1, em: pub.em, por: pub.por });
  return { versao: VERSAO_DADOS, padrao: CONSTRUTORA.id, empresas: { [CONSTRUTORA.id]: construtora, [PRESTADORA.id]: prestadora }, compartilhados: [pub] };
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
    crew: { equipes: [{ id: 'eq-nf', nome: tr('Equipe do José'), encarregadoUsuarioId: 'u-jose', obraBaseId: 'nf-jardim' }], batidas: [], excursoes: [], aprovacoes: [], historico: [], orcamentos: {} },
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
