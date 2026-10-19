/* KORbuild — o catálogo da massa de testes da 1ª versão (Measure Takeoff, Concorrências e Settings; tools/massa-primeira-versao.mjs; docs/massa-primeira-versao.md).
 * Tudo fictício (NH, EUA). E-mails em example.com (reservado: nada chega a ninguém). As empresas levam plano.demo = true e plano.massa = 'pv':
 * a limpeza pega só estas (plano.massa = 'pv') e nunca a massa de demonstração do protótipo nem a conta real de ninguém.
 * Dez empresas: 2 construtoras, 2 "ambas" (constroem e também prestam serviço), 6 prestadoras — para cobrir todos os pares de convite para cotar. */

export const SENHA_VARIAVEL = 'KOR_DEMO_SENHA';
export const emailDe = (chave, papel) => `pv.${chave}.${papel}@example.com`;

/* Papéis de cada empresa (5 logins): o administrador, o gestor e o trabalhador usam os perfis padrão; os outros dois são perfis criados só
 * para a massa, para testar quem vê o quê no Measure e no Settings. */
export const PAPEIS = {
  admin: { cargo: 'Owner', perfil: 'administrador' },
  gestor: { cargo: 'Project executive', perfil: 'gestor' },
  orcamentista: { cargo: 'Estimator', perfil: 'Estimator' },
  contatos: { cargo: 'Office assistant', perfil: 'Contacts only' },
  trabalhador: { cargo: 'Crew', perfil: 'trabalhador' },
};
/* Perfis criados só para a massa (não são os padrão; permissões do catálogo do Settings). */
export const PERFIS_EXTRA = {
  'Estimator': { descricao: 'Mede plantas, monta o catálogo e responde convites para cotar', permissoes: ['measure.medir', 'measure.catalogo', 'concorrencias.responder'] },
  'Contacts only': { descricao: 'Só mantém a lista de contatos (sem Measure)', permissoes: ['settings.contatos'] },
};

const o = (nome, municipio, zip, lat, lon, inicio, prazo, extra = {}) => ({ nome, municipio, estado: 'NH', zip, lat, lon, inicio, prazo, ...extra });

export const EMPRESAS = [
  // ---- construtoras ----
  { chave: 'c1', nome: 'Northgate Builders', sigla: 'NB', atuacao: 'construtora', cidade: 'Manchester', zip: '03101', endereco: '200 Elm Street', tel: '(603) 555-0601',
    pessoas: { admin: 'Helen Marsh', gestor: 'Victor Aldana', orcamentista: 'Priya Nair', contatos: 'Tom Becker', trabalhador: 'Lena Ortiz' },
    obras: [o('Northgate Tower Renovation', 'Manchester', '03101', 42.9956, -71.4548, -45, 180), o('Canal Street Lofts', 'Manchester', '03101', 42.9890, -71.4660, -20, 220)] },
  { chave: 'c2', nome: 'Stonebridge Construction', sigla: 'SC', atuacao: 'construtora', cidade: 'Concord', zip: '03301', endereco: '45 Main Street', tel: '(603) 555-0602',
    pessoas: { admin: 'Raymond Pike', gestor: 'Alicia Moreno', orcamentista: 'Dev Kapoor', contatos: 'Nina Wolfe', trabalhador: 'Gus Hartley' },
    obras: [o('Capitol Plaza Offices', 'Concord', '03301', 43.2081, -71.5376, -30, 200), o('Stonebridge Elementary Wing', 'Bow', '03304', 43.1368, -71.5473, -10, 160)] },
  // ---- "ambas": constroem e prestam serviço ----
  { chave: 'a1', nome: 'Harbor & Pine Group', sigla: 'HP', atuacao: 'ambas', cidade: 'Portsmouth', zip: '03801', endereco: '9 Market Square', tel: '(603) 555-0603',
    pessoas: { admin: 'Oscar Whitfield', gestor: 'Carla Benning', orcamentista: 'Ian Fallon', contatos: 'Maya Chen', trabalhador: 'Pete Rowan' },
    obras: [o('Harbor Point Apartments', 'Portsmouth', '03801', 43.0718, -70.7626, -25, 190), o('Pine Street Duplexes', 'Dover', '03820', 43.1979, -70.8737, -5, 150)] },
  { chave: 'a2', nome: 'Granite Peak Contracting', sigla: 'GP', atuacao: 'ambas', cidade: 'Nashua', zip: '03060', endereco: '18 Main Dunstable Road', tel: '(603) 555-0604',
    pessoas: { admin: 'Sylvia Dunn', gestor: 'Marcus Webb', orcamentista: 'Jo Ellison', contatos: 'Ravi Shah', trabalhador: 'Tess Kim' },
    obras: [o('Nashua Medical Annex', 'Nashua', '03060', 42.7654, -71.4676, -35, 210), o('Amherst Street Retail', 'Nashua', '03063', 42.7550, -71.4900, -12, 120)] },
  // ---- prestadoras ----
  { chave: 'p1', nome: 'Maple Siding Co', sigla: 'MS', atuacao: 'prestadora', cidade: 'Manchester', zip: '03102', endereco: '77 Valley Street', tel: '(603) 555-0611',
    pessoas: { admin: 'Carol Brennan', gestor: 'Eddie Sosa', orcamentista: 'Hana Ito', contatos: 'Bill Garner', trabalhador: 'Abe Lowe' },
    obras: [o('Canal Street Lofts — Siding', 'Manchester', '03101', 42.9890, -71.4660, -15, 90, { para: ['c1', 'Canal Street Lofts'] }), o('Direct job — Barn Residing', 'Hooksett', '03106', 43.0968, -71.4651, -8, 30, { cliente: 'The Larkin Family' })],
    clientes: ['The Larkin Family'] },
  { chave: 'p2', nome: 'Cobalt Framing', sigla: 'CF', atuacao: 'prestadora', cidade: 'Nashua', zip: '03063', endereco: '51 Amherst Street', tel: '(603) 555-0612',
    pessoas: { admin: 'Gary Lindqvist', gestor: 'Rita Alonso', orcamentista: 'Sam Tolliver', contatos: 'Irene Fox', trabalhador: 'Hal Dutra' },
    obras: [o('Capitol Plaza Offices — Framing', 'Concord', '03301', 43.2081, -71.5376, -20, 100, { para: ['c2', 'Capitol Plaza Offices'] }), o('Nashua Medical Annex — Framing', 'Nashua', '03060', 42.7654, -71.4676, -18, 90, { para: ['a2', 'Nashua Medical Annex'] })] },
  { chave: 'p3', nome: 'Bedrock Foundations', sigla: 'BF', atuacao: 'prestadora', cidade: 'Londonderry', zip: '03053', endereco: '12 Industrial Drive', tel: '(603) 555-0613',
    pessoas: { admin: 'Frank DiNardo', gestor: 'Ellen Park', orcamentista: 'Noel Baptiste', contatos: 'Zoe Hart', trabalhador: 'Moe Rivas' },
    obras: [o('Harbor Point Apartments — Foundations', 'Portsmouth', '03801', 43.0718, -70.7626, -40, 60, { para: ['a1', 'Harbor Point Apartments'] }), o('Stonebridge Elementary — Footings', 'Bow', '03304', 43.1368, -71.5473, -9, 45, { para: ['c2', 'Stonebridge Elementary Wing'] })] },
  { chave: 'p4', nome: 'Lantern Roofing', sigla: 'LR', atuacao: 'prestadora', cidade: 'Hampton', zip: '03842', endereco: '33 Lafayette Road', tel: '(603) 555-0614',
    pessoas: { admin: 'Beth Calhoun', gestor: 'Kurt Neely', orcamentista: 'Lola Banks', contatos: 'Omar Reid', trabalhador: 'Vic Santos' },
    obras: [o('Pine Street Duplexes — Roofing', 'Dover', '03820', 43.1979, -70.8737, -3, 50, { para: ['a1', 'Pine Street Duplexes'] }), o('Direct job — Church Roof', 'Hampton', '03842', 42.9376, -70.8389, -14, 35, { cliente: 'Hampton Community Church' })],
    clientes: ['Hampton Community Church'] },
  { chave: 'p5', nome: 'Cedar Electric', sigla: 'CE', atuacao: 'prestadora', cidade: 'Dover', zip: '03820', endereco: '5 Central Avenue', tel: '(603) 555-0615',
    pessoas: { admin: 'Walter Pruitt', gestor: 'Dana Voss', orcamentista: 'Kai Mercer', contatos: 'Lucy Frye', trabalhador: 'Ned Oakes' },
    obras: [o('Northgate Tower — Electrical', 'Manchester', '03101', 42.9956, -71.4548, -10, 120, { para: ['c1', 'Northgate Tower Renovation'] })] },
  { chave: 'p6', nome: 'Willow Drywall', sigla: 'WD', atuacao: 'prestadora', cidade: 'Concord', zip: '03301', endereco: '410 Loudon Road', tel: '(603) 555-0616',
    pessoas: { admin: 'Janet Okonkwo', gestor: 'Ben Corrigan', orcamentista: 'Tina Vega', contatos: 'Arlo Finch', trabalhador: 'Cal Moody' },
    obras: [o('Capitol Plaza Offices — Drywall', 'Concord', '03301', 43.2081, -71.5376, -6, 80, { para: ['c2', 'Capitol Plaza Offices'] })] },
];

/* Convidados SEM conta (só recebem o link): aparecem como contato de quem convida; testam o fluxo do link. */
export const EXTERNAS = [
  { chave: 'x1', nome: 'Birchwood Insulation LLC', cidade: 'Salem', estado: 'NH', tel: '(603) 555-0701' },
  { chave: 'x2', nome: 'Redline Excavation Inc.', cidade: 'Derry', estado: 'NH', tel: '(603) 555-0702' },
];

const T = (etapa, valor) => ({ [etapa]: valor });
/* Concorrências: de = quem pede; obra = obra de quem pede; convites = chaves das convidadas (empresas ou externas xN).
 * estado: rascunho | aberta | fechada | cancelada | prorrogada. propostas: { chave: { porEtapa, dias, excl } }; recusa: { de, motivo }.
 * Os pares cobertos estão em "par" (c = construtora, p = prestadora, a = ambas). */
export const CONCORRENCIAS = [
  { par: 'c→p', de: 'c1', obra: 'Northgate Tower Renovation', servico: 'Exterior windows and doors', etapas: ['08 51 13', '08 11 13'], incluso: ['Supply and install aluminum windows', 'Supply and install hollow metal doors', 'Flashing and sealants'], excluso: ['Interior finish trim'], obs: 'Install after the weather barrier inspection.', dias: 6, convites: ['p1', 'p2', 'x1'], mostrar: 'nao', estado: 'aberta',
    propostas: { p1: { porEtapa: { '08 51 13': 31200, '08 11 13': 17300 }, dias: 18, excl: ['Painting of metal doors'] }, p2: { porEtapa: { '08 51 13': 34100, '08 11 13': 18800 }, dias: 21, excl: [] } },
    pergunta: { de: 'p1', texto: 'Are the door frames furnished by the owner or by the contractor?', resposta: 'Frames are furnished by the contractor; hardware is by the owner.' } },
  { par: 'c→p', de: 'c2', obra: 'Capitol Plaza Offices', servico: 'Interior drywall and finishing', etapas: ['09 21 16'], incluso: ['Hang, tape and finish levels 4', 'Corner bead'], excluso: ['Painting'], obs: '', dias: 9, convites: ['p6', 'p2'], mostrar: 'total', estado: 'fechada', vencedora: 'p6',
    propostas: { p6: { porEtapa: { '09 21 16': 88400 }, dias: 35, excl: [] }, p2: { porEtapa: { '09 21 16': 93250 }, dias: 40, excl: ['Scaffold rental'] } } },
  { par: 'c→c', de: 'c1', obra: 'Canal Street Lofts', servico: 'Structural steel package', etapas: ['05 12 00'], incluso: ['Fabricate and erect structural steel', 'Shop drawings'], excluso: ['Metal decking'], obs: 'Union shop not required.', dias: 12, convites: ['c2', 'a2'], mostrar: 'nao', estado: 'aberta',
    propostas: { a2: { porEtapa: { '05 12 00': 212000 }, dias: 60, excl: ['Metal decking'] } } },
  { par: 'c→a', de: 'c2', obra: 'Stonebridge Elementary Wing', servico: 'Site concrete and curbs', etapas: ['03 30 00'], incluso: ['Curbs, walks and pads'], excluso: ['Asphalt'], obs: '', dias: 8, convites: ['a1', 'p3'], mostrar: 'etapa', estado: 'aberta',
    propostas: { p3: { porEtapa: { '03 30 00': 54800 }, dias: 25, excl: [] } }, recusa: { de: 'a1', motivo: 'Booked solid through the fall.' } },
  { par: 'p→p', de: 'p2', obra: 'Capitol Plaza Offices — Framing', servico: 'Metal stud framing — levels 2 and 3', etapas: ['05 40 00'], incluso: ['Layout and installation of cold-formed framing'], excluso: ['Drywall'], obs: 'Subcontract the repetitive floors.', dias: 5, convites: ['p5', 'p6', 'x2'], mostrar: 'nao', estado: 'aberta',
    propostas: { p6: { porEtapa: { '05 40 00': 41500 }, dias: 20, excl: [] } } },
  { par: 'p→p', de: 'p1', obra: 'Canal Street Lofts — Siding', servico: 'Soffit and fascia', etapas: ['07 46 00'], incluso: ['Vented aluminum soffit', 'Fascia wrap'], excluso: [], obs: '', dias: 10, convites: ['p4'], mostrar: 'nao', estado: 'fechada', vencedora: 'p4',
    propostas: { p4: { porEtapa: { '07 46 00': 14900 }, dias: 9, excl: [] } } },
  { par: 'p→a', de: 'p4', obra: 'Direct job — Church Roof', servico: 'Temporary protection and scaffolding', etapas: ['01 54 00'], incluso: ['Scaffold erect and dismantle', 'Roof edge protection'], excluso: ['Permit fees'], obs: '', dias: 4, convites: ['a2'], mostrar: 'nao', estado: 'aberta', propostas: {} },
  { par: 'a→p', de: 'a1', obra: 'Pine Street Duplexes', servico: 'Gutters and downspouts', etapas: ['07 71 23'], incluso: ['Seamless aluminum gutters', 'Downspouts and boots'], excluso: ['Underground drainage'], obs: '', dias: 1, convites: ['p4', 'p1'], mostrar: 'nao', estado: 'aberta', recusa: { de: 'p1', motivo: 'Outside our scope of work.' }, propostas: {}, prorroga: 3 },
  { par: 'a→c', de: 'a2', obra: 'Nashua Medical Annex', servico: 'Mechanical, electrical and plumbing package', etapas: ['23 00 00', '26 00 00'], incluso: ['Design-build MEP rough-in'], excluso: ['Fire alarm'], obs: '', dias: 14, convites: ['c1', 'p5'], mostrar: 'nao', estado: 'aberta',
    propostas: { p5: { porEtapa: { '23 00 00': 70000, '26 00 00': 64000 }, dias: 55, excl: ['Fire alarm'] } } },
  { par: 'c→p', de: 'c1', obra: 'Northgate Tower Renovation', servico: 'Final cleaning', etapas: ['01 74 23'], incluso: ['Construction final clean'], excluso: [], obs: '', dias: 20, convites: ['p5', 'p6'], mostrar: 'nao', estado: 'rascunho', propostas: {} },
  { par: 'c→p', de: 'c2', obra: 'Stonebridge Elementary Wing', servico: 'Landscaping', etapas: ['32 90 00'], incluso: ['Seed, trees and shrubs'], excluso: [], obs: '', dias: 15, convites: ['p4'], mostrar: 'nao', estado: 'cancelada', motivoCancelar: 'Scope moved to the owner.', propostas: {} },
  { par: 'a→p', de: 'a2', obra: 'Amherst Street Retail', servico: 'Storefront glazing', etapas: ['08 41 13'], incluso: ['Aluminum storefront and glass'], excluso: [], obs: '', dias: 7, convites: ['p1', 'p2', 'p3'], mostrar: 'nao', estado: 'aberta',
    propostas: { p1: { porEtapa: { '08 41 13': 38800 }, dias: 28, excl: [] }, p2: { porEtapa: { '08 41 13': 41200 }, dias: 24, excl: [] }, p3: { porEtapa: { '08 41 13': 36950 }, dias: 35, excl: ['Caulking'] } } },
];

/* Measure: o que o tools/massa-measure.mjs --conjunto=pv monta pelas telas (catálogo, preço, margem, projeto com a planta, medição, proposta). */
export const MEASURE = [
  { chave: 'p1', pessoa: 'Carol Brennan', itens: [['Fiber-cement lap siding 8-1/4"', 'FC-825', 'piece', 'Siding', 14.2], ['Housewrap 9\'x150\' roll', 'HW-9150', 'roll', 'Siding', 148]],
    assembly: ['Lap siding with housewrap', [['FC-825', 'MeasuredArea / 5.5'], ['HW-9150', 'MeasuredArea / 1350']]], margens: [12, 10],
    projetos: [{ nome: 'Canal Street Lofts — Siding bid', cliente: 'Northgate Builders', cidade: 'Manchester', estado: 'nh', condicao: 'Front elevation', emitir: true }, { nome: 'Larkin Barn — Residing', cliente: 'The Larkin Family', cidade: 'Hooksett', estado: 'nh' }] },
  { chave: 'p2', pessoa: 'Gary Lindqvist', itens: [['OSB 7/16" 4\'x8\' sheet', 'OSB-716', 'sheet', 'Sheathing', 16.9], ['2x6x92-5/8" precut stud', 'ST-2692', 'piece', 'Framing', 5.45]],
    assembly: ['Wall sheathing and studs', [['OSB-716', 'MeasuredArea / 32'], ['ST-2692', 'MeasuredArea / 1.33']]], margens: [14, 9],
    projetos: [{ nome: 'Capitol Plaza — Framing bid', cliente: 'Stonebridge Construction', cidade: 'Concord', estado: 'nh', condicao: 'Level 2 walls', emitir: true }] },
  { chave: 'p3', pessoa: 'Frank DiNardo', itens: [['Ready-mix concrete 4000 psi', 'RM-4000', 'cubic yard', 'Foundation walls', 178], ['#4 rebar 20\' stick', 'RB-4-20', 'piece', 'Footings', 11.6]],
    assembly: ['Slab on grade', [['RM-4000', 'MeasuredArea * 0.0123'], ['RB-4-20', 'MeasuredArea / 40']]], margens: [11, 8],
    projetos: [{ nome: 'Elementary Wing — Footings', cliente: 'Stonebridge Construction', cidade: 'Bow', estado: 'nh', condicao: 'Garage slab', emitir: false }] },
  { chave: 'p4', pessoa: 'Beth Calhoun', itens: [['Architectural shingle bundle', 'SH-ARCH', 'bundle', 'Roofing', 42], ['Synthetic underlayment roll', 'UL-SYN', 'roll', 'Roofing', 96]],
    assembly: ['Shingle roof, 30-year', [['SH-ARCH', 'MeasuredArea / 33'], ['UL-SYN', 'MeasuredArea / 1000']]], margens: [13, 10],
    projetos: [{ nome: 'Church Roof — Estimate', cliente: 'Hampton Community Church', cidade: 'Hampton', estado: 'nh', condicao: 'Main roof', emitir: true }] },
  { chave: 'a1', pessoa: 'Oscar Whitfield', itens: [['Seamless aluminum gutter 5"', 'GT-5', 'linear ft', 'Gutters', 6.4], ['Downspout 2x3 10\'', 'DS-23', 'piece', 'Gutters', 14.5]],
    assembly: ['Gutter and downspout set', [['GT-5', 'MeasuredArea / 4'], ['DS-23', 'MeasuredArea / 120']]], margens: [10, 8],
    projetos: [{ nome: 'Harbor Point — Takeoff', cliente: 'Harbor Point Apartments Owner LLC', cidade: 'Portsmouth', estado: 'nh', condicao: 'Building A roof', emitir: true }] },
  { chave: 'a2', pessoa: 'Jo Ellison', login: 'orcamentista', itens: [['Steel stud 3-5/8" 20ga', 'SS-358', 'piece', 'Framing', 7.1], ['Gypsum board 5/8" 4\'x12\'', 'GB-58', 'sheet', 'Drywall', 21.5]],
    assembly: ['Interior partition type A', [['SS-358', 'MeasuredArea / 1.33'], ['GB-58', 'MeasuredArea / 24']]], margens: [9, 7],
    projetos: [{ nome: 'Nashua Medical Annex — Level 1 fit-out', cliente: 'Nashua Medical Annex Owner LLC', cidade: 'Nashua', estado: 'nh', condicao: 'Level 1 partitions', emitir: false }] },
];
