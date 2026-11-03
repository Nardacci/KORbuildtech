# F02 · Projeto do zero até "Liberar para obra"

**Objetivo:** provar o caminho inteiro do Takeoff: criar o projeto, subir a planta, definir a escala de cada folha, medir com assembly, ver materiais e mão de obra, montar o cronograma, emitir a proposta e liberar para obra. É o fluxo que coloca o projeto no Daily (F03 continua dele).

**Roda em:** conta real contra o banco local (`bash tools/supabase-local.sh`, servidor em `http://localhost:8123/`), em português. O protótipo (`?demo`) tem as suítes próprias (`measure`, `projeto-espaco`, `daily-primeira-versao`).
**Comando:** `node tests/fluxo-02-projeto-ate-liberar.test.mjs --relatorio` (grava o registro da rodada em `docs/testes/rodadas/`).

**Pré-condições (feitas pelo próprio teste, `tests/_fluxo-dados.mjs`, e apagadas no fim):** empresa "Fluxo QA Prestadora" e o administrador Fábio Fluxo; funções Carpenter US$ 38,00/h e Painter US$ 30,00/h; encargos 22% (10% + 12%); margens overhead 9% e lucro 7% em markup; itens FLX-DW (drywall, US$ 14,50), FLX-PT (tinta, US$ 160), FLX-MO-DW (hora de montador, função Carpenter) e FLX-MO-PT (hora de pintor, função Painter); assemblies "Fluxo drywall" (FLX-DW com 5% de perda + FLX-MO-DW a 50 sq ft/h) e "Fluxo pintura"; cliente "Cliente Fluxo LLC".

**Dados fixos:** projeto **"Garagem Pereira"**, Concord, NH (o tipo fica o padrão: o formulário de projeto novo só pede o essencial); planta `assets/plantas/casa-modelo.pdf` (3 folhas: A-101 planta em 1/4" = 1'-0", A-201 fachadas em 1/4", A-301 corte em 3/8"); condição **"Piso da garagem"** com o assembly "Fluxo drywall", medida no retângulo de 40' × 28' (1.120 sq ft); tarefas **"Instalação de drywall"** (hoje, 3 dias, nós) e **"Pintura"** (hoje + 7 dias, 4 dias, prestadora).

| # | Quem | Onde | O que faz | Esperado |
|---|---|---|---|---|
| 1 | Fábio (admin) | Takeoff › Projetos › Novo projeto | Nome "Garagem Pereira", cliente "Cliente Fluxo LLC", cidade Concord, estado NH; "Continuar para as plantas" | Abre a aba Plantas do projeto. No banco: situação "orcamento", sem liberação e sem obra |
| 2 | Fábio (admin) | Projeto › Visão geral | Só olhar | "0 de 6 passos". Cartão Obra "Em análise" com o botão "Liberar para obra" desabilitado e "Falta terminar:" listando plantas, escala, quem faz cada tarefa, medição e cronograma |
| 3 | Fábio (admin) | Projeto › Plantas | Enviar `casa-modelo.pdf` | 3 folhas no projeto (tela e banco); passo "Enviar as plantas" feito |
| 4 | Fábio (admin) | Projeto › Takeoff › cada folha › Escala | A-101: 1/4" e conferir na cota de 40'-0"; A-201: 1/4" e conferir em 40'; A-301: 3/8" e conferir em 28' | As três folhas com escala, as três "conferidas" no banco; passo "Definir a escala de cada folha" feito |
| 5 | Fábio (admin) | Takeoff › A-101 | Incluir o assembly "Fluxo drywall" como condição "Piso da garagem" e medir o retângulo 40' × 28' | Condição com 1 medição de cerca de 1.120 sq ft (tolerância de 0,5%); no banco, a condição aponta o assembly e guarda a medição |
| 6 | Fábio (admin) | Projeto › Materiais | Só olhar | Material FLX-DW com o rastro do cálculo; "Mão de obra estimada" de 23 h (área ÷ 50 = 22,4 h, arredondadas para cima como as outras quantidades). No motor, a hora do item FLX-MO-DW vale US$ 46,36 (38 × 1,22) e a origem é "Função: Carpenter" |
| 7 | Fábio (admin) | Projeto › Cronograma | Adicionar "Instalação de drywall" (hoje, 3 dias) e "Pintura" (hoje + 7, 4 dias, prestadora) | Duas tarefas com o término calculado (hoje + 2 e hoje + 10); no banco, 2 tarefas em `projetos.cronograma` |
| 8 | Fábio (admin) | Projeto › Visão geral | Só olhar | "5 de 6 passos", próximo "emitir a proposta". Cartão Obra "Tudo pronto" com o botão habilitado, sem a proposta ainda (ela é opcional) |
| 9 | Fábio (admin) | Projeto › Proposta | Conferir a linha da etapa e emitir | Linha "09 29 00 · Gypsum board" com custo = material + mão de obra; total = custo × 1,09 × 1,07; número P-AAAA-NNN; no banco, 1 proposta emitida; Visão geral em "6 de 6 passos" |
| 10 | Fábio (admin) | Projeto › Visão geral › Liberar para obra | Conferir o campo "Início da obra" (vem com hoje), escolher hoje + 2 e clicar em Liberar; depois mudar a data para hoje + 1 | Etiqueta "Liberado para obra" com a data e "Fábio Fluxo"; "Abrir no Daily" e "Voltar para análise". No banco: liberado_em preenchido, obra criada com projeto_id do projeto, e `projetos.obra_id` apontando a obra. A data escolhida vai para `projetos.inicio_obra` e para o início da obra; ao mudar a data depois, a obra acompanha |
| 11 | Fábio (admin) | Daily › Projetos em execução | Abrir | "Garagem Pereira" na lista; na página dela, "Etapa atual: Instalação de drywall" e o endereço do projeto |
| 12 | Fábio (admin) | Projeto › Visão geral › Voltar para análise | Voltar para análise, conferir o Daily e liberar de novo | Some do Daily (e o banco zera a liberação); ao liberar de novo volta com a mesma obra, uma só |
| 13 | Fábio (admin) | Início | Abrir | "Andamento dos projetos" lista "Garagem Pereira"; nenhum erro de JavaScript em todo o fluxo |

**Desfaz:** a empresa dos fluxos e os logins `fluxo.*@example.com` são apagados no fim da rodada (use `--manter` para ficar com os dados e olhar na tela).
