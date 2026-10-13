/* KORbuild — o catálogo da massa de demonstração (tools/massa-demo.mjs; docs/massa-demo.md).
 * Tudo fictício: empresas, pessoas, obras e endereços inventados (NH, EUA). E-mails em example.com (reservado: nunca chega a ninguém).
 * Três construtoras; seis prestadoras que trabalham para elas (algumas para mais de uma); três prestadoras independentes, sem construtora. */

const PRIMEIROS = ['James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda', 'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Daniel', 'Karen', 'Matthew', 'Nancy', 'Anthony', 'Lisa', 'Mark', 'Betty', 'Steven', 'Sandra', 'Paul', 'Ashley', 'Andrew', 'Emily', 'Joshua', 'Donna', 'Kenneth', 'Michelle', 'Kevin', 'Carol', 'Brian', 'Amanda', 'George', 'Melissa', 'Edward', 'Deborah', 'Ronald', 'Stephanie', 'Timothy', 'Rebecca', 'Jason', 'Laura', 'Carlos', 'Maria', 'Luis', 'Ana', 'Diego', 'Rosa', 'Miguel', 'Elena', 'Jorge', 'Sofia'];
const SOBRENOMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker', 'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores', 'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell', 'Carter', 'Roberts', 'Gomez', 'Phillips', 'Evans', 'Turner', 'Diaz', 'Parker', 'Cruz', 'Edwards', 'Collins', 'Reyes'];
let proximo = 0;
/* Nomes sem repetir (passo coprimo com o tamanho das listas). */
export function nomeNovo() {
  const i = proximo++;
  return PRIMEIROS[(i * 7) % PRIMEIROS.length] + ' ' + SOBRENOMES[(i * 11 + 3) % SOBRENOMES.length];
}

const cliente = (nome) => ({ nome, papel: 'cliente' });

/* Cada prestadora: o quadro de funcionários [função, quantos, valor hora base] e o que faz no diário. */
const FRAMING = { quadro: [['Foreman', 1, 46], ['Carpenter', 4, 34], ['Laborer', 3, 22]], etapas: ['Framing', 'Sheathing', 'Roof framing'], equip: [['Telehandler', 1, 'operando'], ['Compressor', 2, 'operando'], ['Nail guns', 6, 'operando']],
  atividades: ['Wall framing, second floor', 'Setting roof trusses', 'Sheathing exterior walls', 'Blocking and backing for fixtures'], locais: ['Building A · level 2', 'Building A · roof', 'Building B · level 1', 'Garage'] };
const SIDING = { quadro: [['Foreman', 1, 44], ['Siding installer', 4, 31], ['Laborer', 2, 21]], etapas: ['Siding', 'Trim', 'Flashing'], equip: [['Scaffold', 2, 'operando'], ['Pneumatic nailers', 4, 'operando'], ['Saw station', 1, 'manutencao']],
  atividades: ['Housewrap and flashing, north elevation', 'Fiber-cement siding, east elevation', 'Window and door trim', 'Soffit and fascia'], locais: ['North elevation', 'East elevation', 'West elevation', 'Porch'] };
const CONCRETE = { quadro: [['Foreman', 1, 47], ['Concrete finisher', 4, 33], ['Rebar installer', 2, 30], ['Laborer', 3, 22]], etapas: ['Footings', 'Foundation walls', 'Slab on grade'], equip: [['Concrete pump', 1, 'operando'], ['Vibrators', 3, 'operando'], ['Skid steer', 1, 'operando']],
  atividades: ['Footing forms and rebar', 'Pour foundation walls', 'Strip and backfill forms', 'Slab prep and vapor barrier'], locais: ['Building A', 'Building B', 'Garage slab', 'Site walls'] };
const ROOFING = { quadro: [['Foreman', 1, 43], ['Roofer', 4, 30], ['Laborer', 2, 21]], etapas: ['Roofing', 'Flashing', 'Gutters'], equip: [['Roofing hoist', 1, 'operando'], ['Nailers', 5, 'operando'], ['Safety anchors', 12, 'operando']],
  atividades: ['Ice and water shield', 'Architectural shingles, south slope', 'Ridge vent and flashing', 'Gutters and downspouts'], locais: ['Main roof', 'Garage roof', 'Porch roof', 'Dormers'] };
const ELECTRIC = { quadro: [['Foreman (journeyman)', 1, 58], ['Electrician', 3, 48], ['Apprentice', 2, 28]], etapas: ['Rough electrical', 'Panels', 'Trim-out'], equip: [['Lift', 1, 'operando'], ['Conduit benders', 2, 'operando']],
  atividades: ['Rough-in wiring, level 1', 'Panel and sub-panel set', 'Low-voltage and data rough-in', 'Device trim-out'], locais: ['Level 1', 'Level 2', 'Electrical room', 'Exterior'] };
const DRYWALL = { quadro: [['Foreman', 1, 42], ['Drywall hanger', 4, 30], ['Finisher', 3, 29], ['Laborer', 1, 21]], etapas: ['Hang', 'Tape and finish', 'Sand and prime'], equip: [['Drywall lift', 2, 'operando'], ['Stilts', 4, 'operando'], ['Sanders', 3, 'manutencao']],
  atividades: ['Hang board, level 1', 'First coat tape and mud', 'Second coat and skim', 'Sand and prime'], locais: ['Level 1', 'Level 2', 'Corridors', 'Units 101–104'] };
const PAINTING = { quadro: [['Foreman', 1, 40], ['Painter', 3, 28], ['Laborer', 1, 20]], etapas: ['Prep', 'Prime', 'Finish coats'], equip: [['Airless sprayers', 2, 'operando'], ['Scaffold', 1, 'operando']],
  atividades: ['Prep and caulk, exterior', 'Prime exterior', 'Finish coat, first pass', 'Interior touch-up'], locais: ['Exterior', 'Interior', 'Trim', 'Garage'] };
const MASONRY = { quadro: [['Foreman', 1, 45], ['Mason', 3, 36], ['Mason tender', 2, 23]], etapas: ['Block walls', 'Brick veneer', 'Stone'], equip: [['Mixer', 1, 'operando'], ['Masonry saw', 1, 'operando'], ['Scaffold', 3, 'operando']],
  atividades: ['CMU block, retaining wall', 'Brick veneer, front elevation', 'Stone chimney', 'Point and clean'], locais: ['Retaining wall', 'Front elevation', 'Chimney', 'Patio'] };
const REMODEL = { quadro: [['Foreman', 1, 44], ['Carpenter', 2, 33], ['Laborer', 2, 21]], etapas: ['Demo', 'Framing', 'Finish carpentry'], equip: [['Table saw', 1, 'operando'], ['Dumpster', 1, 'operando']],
  atividades: ['Demo and haul-away', 'Frame new kitchen opening', 'Install window units', 'Trim and casing'], locais: ['Kitchen', 'Second floor', 'Mudroom', 'Exterior'] };
const GESTAO = { quadro: [['Project manager', 1, 62], ['Superintendent', 1, 58], ['Project engineer', 1, 46]], etapas: [], equip: [], atividades: [], locais: [] };

/* Obras das construtoras (a prestadora liga a sua obra a uma destas pelo nome). */
export const EMPRESAS = [
  { chave: 'gc1', nome: 'Northfield Builders', razao: 'Northfield Builders, LLC', sigla: 'NB', atuacao: 'construtora', cidade: 'Manchester', estado: 'NH', zip: '03101', endereco: '214 Elm Street', tel: '(603) 555-0114', plano: { nome: 'Professional', status: 'ativa' }, ...GESTAO,
    pessoas: [['admin', 'Dana Whitfield'], ['gestor', 'Ryan Calloway']],
    clientes: [cliente('Harlow Family Trust'), cliente('Merrimack Health Partners')],
    obras: [
      { nome: 'Elm Street Townhomes', cliente: 'Harlow Family Trust', municipio: 'Manchester', estado: 'NH', zip: '03103', lat: 42.9851, lon: -71.4423, inicio: -140, prazo: 150 },
      { nome: 'Riverside Medical Office', cliente: 'Merrimack Health Partners', municipio: 'Nashua', estado: 'NH', zip: '03060', lat: 42.7654, lon: -71.4676, inicio: -75, prazo: 260 },
    ] },
  { chave: 'gc2', nome: 'Harborview Construction', razao: 'Harborview Construction, Inc.', sigla: 'HC', atuacao: 'construtora', cidade: 'Portsmouth', estado: 'NH', zip: '03801', endereco: '60 Market Street', tel: '(603) 555-0162', plano: { nome: 'Professional', status: 'ativa' }, ...GESTAO,
    pessoas: [['admin', 'Marcus Bellamy'], ['gestor', 'Priya Raman']],
    clientes: [cliente('Harbor Point Partners'), cliente('Town of Rye')],
    obras: [
      { nome: 'Harbor Point Condominiums', cliente: 'Harbor Point Partners', municipio: 'Portsmouth', estado: 'NH', zip: '03801', lat: 43.0718, lon: -70.7626, inicio: -110, prazo: 200 },
      { nome: 'Seacoast Library Addition', cliente: 'Town of Rye', municipio: 'Rye', estado: 'NH', zip: '03870', lat: 42.9806, lon: -70.7681, inicio: -60, prazo: 170 },
    ] },
  { chave: 'gc3', nome: 'Pine Ridge Homes', razao: 'Pine Ridge Homes, LLC', sigla: 'PR', atuacao: 'construtora', cidade: 'Concord', estado: 'NH', zip: '03301', endereco: '9 Main Street', tel: '(603) 555-0188', plano: { nome: 'Professional', status: 'ativa' }, ...GESTAO,
    pessoas: [['admin', 'Helen Ostrowski'], ['gestor', 'Tyrone Banks']],
    clientes: [cliente('Pine Ridge Land Co.'), cliente('Oak Hollow Associates')],
    obras: [
      { nome: 'Pine Ridge Phase 2', cliente: 'Pine Ridge Land Co.', municipio: 'Concord', estado: 'NH', zip: '03301', lat: 43.2081, lon: -71.5376, inicio: -95, prazo: 175 },
      { nome: 'Oak Hollow Residences', cliente: 'Oak Hollow Associates', municipio: 'Bow', estado: 'NH', zip: '03304', lat: 43.1368, lon: -71.5473, inicio: -50, prazo: 230 },
    ] },

  // ---- prestadoras que trabalham para construtoras ----
  { chave: 's1', nome: 'Ridgeline Siding', razao: 'Ridgeline Siding Co.', sigla: 'RS', atuacao: 'prestadora', cidade: 'Manchester', estado: 'NH', zip: '03102', endereco: '1500 Valley Street', tel: '(603) 555-0201', plano: { nome: 'Professional', status: 'ativa' }, ...SIDING,
    pessoas: [['admin', 'Carol Brennan'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Elm Street Townhomes — Siding', para: ['gc1', 'Elm Street Townhomes'], municipio: 'Manchester', estado: 'NH', zip: '03103', lat: 42.9851, lon: -71.4423, inicio: -30, prazo: 90 },
      { nome: 'Pine Ridge Phase 2 — Siding', para: ['gc3', 'Pine Ridge Phase 2'], municipio: 'Concord', estado: 'NH', zip: '03301', lat: 43.2081, lon: -71.5376, inicio: -20, prazo: 100 },
    ] },
  { chave: 's2', nome: 'Summit Framing', razao: 'Summit Framing, LLC', sigla: 'SF', atuacao: 'prestadora', cidade: 'Nashua', estado: 'NH', zip: '03063', endereco: '88 Amherst Street', tel: '(603) 555-0233', plano: { nome: 'Professional', status: 'ativa' }, ...FRAMING,
    pessoas: [['admin', 'Gary Lindqvist'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Riverside Medical Office — Framing', para: ['gc1', 'Riverside Medical Office'], municipio: 'Nashua', estado: 'NH', zip: '03060', lat: 42.7654, lon: -71.4676, inicio: -40, prazo: 70 },
      { nome: 'Harbor Point Condominiums — Framing', para: ['gc2', 'Harbor Point Condominiums'], municipio: 'Portsmouth', estado: 'NH', zip: '03801', lat: 43.0718, lon: -70.7626, inicio: -25, prazo: 85 },
    ] },
  { chave: 's3', nome: 'Granite State Concrete', razao: 'Granite State Concrete, Inc.', sigla: 'GC', atuacao: 'prestadora', cidade: 'Londonderry', estado: 'NH', zip: '03053', endereco: '12 Industrial Drive', tel: '(603) 555-0277', plano: { nome: 'Professional', status: 'ativa' }, ...CONCRETE,
    pessoas: [['admin', 'Frank DiNardo'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Elm Street Townhomes — Foundations', para: ['gc1', 'Elm Street Townhomes'], municipio: 'Manchester', estado: 'NH', zip: '03103', lat: 42.9851, lon: -71.4423, inicio: -60, prazo: 20, concluida: true },
      { nome: 'Oak Hollow Residences — Foundations', para: ['gc3', 'Oak Hollow Residences'], municipio: 'Bow', estado: 'NH', zip: '03304', lat: 43.1368, lon: -71.5473, inicio: -25, prazo: 60 },
    ] },
  { chave: 's4', nome: 'Coastal Roofing', razao: 'Coastal Roofing & Sheet Metal', sigla: 'CR', atuacao: 'prestadora', cidade: 'Hampton', estado: 'NH', zip: '03842', endereco: '33 Lafayette Road', tel: '(603) 555-0319', plano: { nome: 'Trial', status: 'teste', dias: 6 }, ...ROOFING,
    pessoas: [['admin', 'Beth Calhoun'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Harbor Point Condominiums — Roofing', para: ['gc2', 'Harbor Point Condominiums'], municipio: 'Portsmouth', estado: 'NH', zip: '03801', lat: 43.0718, lon: -70.7626, inicio: -15, prazo: 75 },
      { nome: 'Seacoast Library Addition — Roofing', para: ['gc2', 'Seacoast Library Addition'], municipio: 'Rye', estado: 'NH', zip: '03870', lat: 42.9806, lon: -70.7681, inicio: -10, prazo: 60 },
    ] },
  { chave: 's5', nome: 'Beacon Electric', razao: 'Beacon Electric Services, LLC', sigla: 'BE', atuacao: 'prestadora', cidade: 'Dover', estado: 'NH', zip: '03820', endereco: '5 Central Avenue', tel: '(603) 555-0344', plano: { nome: 'Professional', status: 'ativa' }, ...ELECTRIC,
    pessoas: [['admin', 'Walter Pruitt'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Seacoast Library Addition — Electrical', para: ['gc2', 'Seacoast Library Addition'], municipio: 'Rye', estado: 'NH', zip: '03870', lat: 42.9806, lon: -70.7681, inicio: -18, prazo: 90 },
    ] },
  { chave: 's6', nome: 'Evergreen Drywall', razao: 'Evergreen Drywall, Inc.', sigla: 'ED', atuacao: 'prestadora', cidade: 'Concord', estado: 'NH', zip: '03301', endereco: '410 Loudon Road', tel: '(603) 555-0390', plano: { nome: 'Professional', status: 'ativa' }, ...DRYWALL,
    pessoas: [['admin', 'Janet Okonkwo'], ['encarregado', null], ['trabalhador', null]],
    obras: [
      { nome: 'Oak Hollow Residences — Drywall', para: ['gc3', 'Oak Hollow Residences'], municipio: 'Bow', estado: 'NH', zip: '03304', lat: 43.1368, lon: -71.5473, inicio: -12, prazo: 80 },
    ] },

  // ---- prestadoras independentes: sem construtora, obras direto com o dono ----
  { chave: 'i1', nome: 'Lakeside Painting', razao: 'Lakeside Painting, LLC', sigla: 'LP', atuacao: 'prestadora', cidade: 'Laconia', estado: 'NH', zip: '03246', endereco: '27 Union Avenue', tel: '(603) 555-0455', plano: { nome: 'Professional', status: 'ativa' }, ...PAINTING,
    pessoas: [['admin', 'Dorothy Weller'], ['encarregado', null], ['trabalhador', null]],
    clientes: [cliente('The Whitaker Family'), cliente('Lakeview Inn')],
    obras: [
      { nome: 'Whitaker Residence — Exterior Paint', cliente: 'The Whitaker Family', municipio: 'Meredith', estado: 'NH', zip: '03253', lat: 43.6575, lon: -71.5001, inicio: -20, prazo: 25 },
      { nome: 'Lakeview Inn — Interior Refresh', cliente: 'Lakeview Inn', municipio: 'Laconia', estado: 'NH', zip: '03246', lat: 43.5279, lon: -71.4704, inicio: -8, prazo: 40 },
    ] },
  { chave: 'i2', nome: 'Keystone Masonry', razao: 'Keystone Masonry & Stone', sigla: 'KM', atuacao: 'prestadora', cidade: 'Keene', estado: 'NH', zip: '03431', endereco: '101 West Street', tel: '(603) 555-0488', plano: { nome: 'Professional', status: 'suspensa' }, ...MASONRY,
    pessoas: [['admin', 'Leonard Marsh'], ['encarregado', null], ['trabalhador', null]],
    clientes: [cliente('Cheshire Church Council'), cliente('The Abbott Family')],
    obras: [
      { nome: 'St. Anne Parish — Retaining Wall', cliente: 'Cheshire Church Council', municipio: 'Keene', estado: 'NH', zip: '03431', lat: 42.9336, lon: -72.2781, inicio: -35, prazo: 30 },
      { nome: 'Abbott Residence — Stone Chimney', cliente: 'The Abbott Family', municipio: 'Swanzey', estado: 'NH', zip: '03446', lat: 42.8761, lon: -72.2884, inicio: -12, prazo: 30 },
    ] },
  { chave: 'i3', nome: 'Merrimack Remodeling', razao: 'Merrimack Remodeling, LLC', sigla: 'MR', atuacao: 'prestadora', cidade: 'Hooksett', estado: 'NH', zip: '03106', endereco: '700 Hooksett Road', tel: '(603) 555-0511', plano: { nome: 'Trial', status: 'teste', dias: -4 }, ...REMODEL,
    pessoas: [['admin', 'Nora Castellano'], ['encarregado', null], ['trabalhador', null]],
    clientes: [cliente('The Donnelly Family'), cliente('Grace Pellegrino')],
    obras: [
      { nome: 'Donnelly Kitchen Remodel', cliente: 'The Donnelly Family', municipio: 'Hooksett', estado: 'NH', zip: '03106', lat: 43.0968, lon: -71.4651, inicio: -18, prazo: 22 },
      { nome: 'Pellegrino Mudroom Addition', cliente: 'Grace Pellegrino', municipio: 'Bedford', estado: 'NH', zip: '03110', lat: 42.9465, lon: -71.5159, inicio: -6, prazo: 45 },
    ] },
];

export const SENHA_VARIAVEL = 'KOR_DEMO_SENHA';
export const emailDe = (chave, papel, n = '') => `demo.${chave}.${papel}${n}@example.com`;
