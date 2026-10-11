# Regras de negócio

Cada regra tem um código (`SET-nnn`) para ser citada em reuniões, testes e pedidos de mudança. A coluna **Situação** diz se a regra já funciona no protótipo.

!!! note "Origem"
    Estas regras vêm do código do protótipo e das especificações do Settings, das obras e do cronograma na documentação do projeto. Os pontos em aberto estão marcados como **A confirmar** no fim.

## Princípios

| Código | Regra | Situação |
|---|---|---|
| SET-001 | **Nada que a empresa possa querer mudar fica fixo no código.** Regras, percentuais, perfis e listas ficam no Settings. | Funcionando (veja a Situação do protótipo para o que ainda é fixo) |
| SET-002 | **Vigência, nunca reescrever o passado.** Valor hora, encargos e regras de jornada mudam a partir de uma data; os dias anteriores mantêm os valores da época. | Funcionando |
| SET-003 | **Toda mudança vai para a auditoria**: o que mudou, antes e depois, quem, quando e por quê. | Funcionando |
| SET-004 | **Fixo por decisão de produto:** uma batida de ponto nunca é editada (a correção é uma batida nova), a auditoria é obrigatória, as empresas são isoladas e a cerca sinaliza, mas não bloqueia. | Funcionando |

## Funcionários

| Código | Regra | Situação |
|---|---|---|
| SET-010 | **Cada empresa cadastra e cuida dos seus funcionários.** O cadastro mostra **Empresa (empregador)**, sempre a conta a que o funcionário pertence. | Funcionando |
| SET-011 | O cadastro tem código (matrícula), telefone, contato de emergência, **classificação** (empregado W-2 ou autônomo 1099), **FLSA** (non-exempt recebe hora extra; exempt não), ofício, equipe, datas de admissão e desligamento, situação e a data em que o aviso de localização foi aceito. | Funcionando |
| SET-012 | **SSN e documentos de imigração não ficam no KORbuild**: ficam no sistema da folha; só a matrícula é guardada, para fazer a ligação. | Funcionando |
| SET-013 | **Valor hora com histórico:** a mudança vale a partir de uma data, com motivo, e nunca apaga o valor anterior. As horas de cada dia são pagas e custeadas pelo valor vigente naquele dia. | Funcionando |
| SET-014 | Um valor hora novo não pode começar dentro de uma semana já aprovada (ela já foi para a folha). | Funcionando |
| SET-015 | **Certificações** (OSHA 10/30, licenças…) com data de validade: o KORbuild avisa 30 dias antes, no menu e nas notificações. | Funcionando |
| SET-016 | Funcionários desligados saem das listas ativas, mas mantêm o histórico. | Funcionando |

## Encargos e regras de jornada

| Código | Regra | Situação |
|---|---|---|
| SET-020 | **Encargos** são percentuais sobre os salários (FICA, FUTA, SUTA, workers' comp, benefícios) aplicados a todos os funcionários W-2; os autônomos 1099 não têm. Padrão: 32,05%. | Funcionando |
| SET-021 | Uma nova versão dos encargos vale **a partir de uma data, nunca no passado**: o custo das semanas passadas não muda. | Funcionando |
| SET-022 | **Regras de jornada**: hora extra semanal (padrão: acima de 40 h, de segunda a domingo, 1,5×), hora extra diária e dobrada opcionais, e o intervalo mínimo (padrão de New Hampshire: 30 min depois de 5 horas). | Funcionando |
| SET-023 | As regras de jornada valem para **semanas inteiras**, começando numa segunda-feira. Os **modelos** (FLSA federal, New Hampshire, Califórnia…) só preenchem o formulário; a empresa ajusta. | Funcionando |
| SET-024 | **Sem arredondar o tempo**: todo minuto é pago (princípio do produto). | Funcionando |

## Empresa e contatos

| Código | Regra | Situação |
|---|---|---|
| SET-030 | **Cadastro da empresa:** logo, razão social, EIN, como a empresa atua (prestadora, construtora ou as duas), endereço, telefone, e-mail, licenças, seguros e as condições padrão da proposta. Propostas e diários usam esses dados. | Funcionando |
| SET-031 | **Um só cadastro de contatos, com marcadores:** construtora, cliente (dono), fornecedor, subempreiteiro. Um contato pode ter mais de um marcador (a mesma empresa pode ser a sua construtora numa obra e o seu cliente em outra). | Funcionando |
| SET-032 | Um **fornecedor** lista as etapas (cost codes) que fornece; a lista para cotação do Measure manda para ele só esses itens. | Funcionando |
| SET-033 | Contatos recebem documentos por link ou e-mail e **não são usuários**: não precisam de conta e não contam como usuários. | Funcionando |
| SET-034 | Um contato em uso (num projeto ou numa obra) não pode ser excluído. | Funcionando |

## Obras

| Código | Regra | Situação |
|---|---|---|
| SET-040 | **A obra é da empresa, não de um módulo:** o Daily (diários e cronograma), o Crew (ponto, cerca e custo) e o Measure (projeto ganho) usam o mesmo cadastro. | Funcionando |
| SET-041 | Campos: nome\*, cliente\* (e o dono, se for outro), endereço, cidade\*, estado\*, ZIP, **local no mapa\***, **raio da cerca** (50 a 2.000 m), início\* e término\*, **quem preenche o diário\***, **dias de trabalho\*** e situação. | Funcionando |
| SET-042 | O local vem de um clique no mapa, da localização atual do aparelho (quando se cadastra na obra) ou de coordenadas digitadas. Ele define a cerca, o clima nos diários e o mapa do dia. | Funcionando |
| SET-043 | **Situação:** em andamento, paralisada ou concluída. Só as obras **em andamento** exigem diário e aparecem nos celulares de campo e no ponto. Obras paralisadas ou concluídas ficam no escritório com o histórico; nada é apagado. | Funcionando |
| SET-044 | **Modelos de etapas:** uma lista de etapas com a **parte do prazo** de cada uma (%, somando 100). Ao criar a obra, o modelo distribui as etapas em sequência entre o início e o término e salva a primeira linha de base. | Funcionando |
| SET-045 | **Vindo do Measure:** um projeto ganho ainda sem obra abre o cadastro da obra já preenchido (nome, endereço, cliente, dono); projeto e obra ficam ligados. | Funcionando |
| SET-046 | **A obra da construtora** não tem responsável pelo diário, dias de trabalho nem modelo de cronograma: o diário, o ponto e o cronograma ficam na obra de cada prestadora ligada a ela. | Funcionando |

## Cronograma da obra

| Código | Regra | Situação |
|---|---|---|
| SET-050 | O cronograma **é da obra** e é montado pela empresa que executa. Cada etapa tem nome, início, término, um responsável opcional e o % concluído. | Funcionando |
| SET-051 | **Linha de base:** uma foto das datas, salva com data, autor e motivo. A primeira é salva sozinha; as novas, só por decisão (**Salvar nova linha de base**). O desvio é medido contra a linha de base mais recente. Nada é apagado. | Funcionando |
| SET-052 | **% concluído vindo do Daily:** uma atividade do diário pode apontar para uma etapa do cronograma e o % dela. Quando o diário é **aprovado**, o % vai para a etapa, com histórico (data, % e diário de origem). O escritório também pode atualizar o % à mão. | Funcionando |
| SET-053 | **Situação da etapa:** concluída (100%), atrasada (passou do término sem chegar a 100%), em risco (avanço real 15 pontos ou mais abaixo do previsto para hoje), em andamento, não iniciada. | Funcionando |
| SET-054 | **Avanço da obra** = a média do % das etapas, ponderada pela duração. O **previsto até hoje** usa a mesma conta sobre as datas da linha de base. | Funcionando |
| SET-055 | **Próximas 3 semanas:** etapas em andamento ou que começam/terminam nos próximos 21 dias, na tela da obra do encarregado. | Funcionando |
| SET-056 | **Notificações:** uma por etapa atrasada, para quem acompanha as obras. | Funcionando |
| SET-057 | **Publicar para o contratante:** a prestadora decide quando a construtora vê. Cada publicação é uma foto (versão); a construtora vê a mais recente, só para consulta, com a data, e pode exportar para o Excel. | Funcionando |
| SET-058 | **Exportar Excel:** cabeçalho da empresa, obra e cliente, tabela de etapas (datas, duração, %, situação, desvio) e as barras do Gantt semana a semana. | Funcionando |

## Usuários e acesso

| Código | Regra | Situação |
|---|---|---|
| SET-060 | **A tela inicial segue as permissões:** com um só módulo, a pessoa entra direto nele. | Funcionando |
| SET-061 | **O Administrador é travado**; pelo menos um usuário ativo precisa manter *Usuários e perfis de acesso*; ninguém tira o próprio acesso. | Funcionando |
| SET-062 | As dependências são automáticas: aprovar inclui acompanhar; ver custos inclui acompanhar; o catálogo inclui medir; o cronograma inclui acompanhar todas as obras. | Funcionando |
| SET-063 | **Um usuário que bate o ponto no próprio celular precisa estar ligado a um cadastro de funcionário.** | Funcionando |
| SET-064 | Um perfil em uso não pode ser excluído. | Funcionando |
| SET-065 | Sem permissão, a tela não abre — digitar o endereço leva de volta à tela inicial da pessoa. | Funcionando |

!!! confirm "A confirmar"
    - Permissões **por obra** (um encarregado vê só as obras dele; um gestor de obras só a região dele).
    - Regras de jornada **por obra** (prevailing wage, obra em outro estado) e workers' comp por ofício.
    - Prazos do diário, intervalos do GPS e alertas de custo como configurações da empresa (hoje: valores fixos, veja a Situação do protótipo).
    - Convites de verdade por e-mail para novos usuários.
