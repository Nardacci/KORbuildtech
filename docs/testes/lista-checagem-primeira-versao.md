# Lista de checagem — 1ª versão (Measure Takeoff, Concorrências e Settings)

Senha de todos os logins: a de `KOR_DEMO_SENHA`. Logins: `pv.<empresa>.<papel>@example.com`. Endereço: homologação com `?versao=primeira`.
Marque `[x]` quando passar; se falhar, escreva ao lado o que viu (tela, login, hora). Versão em planilha: `lista-checagem-primeira-versao.csv`.


## 1 Entrada e conta

- [ ] **T01** · `pv.p1.admin` — Abrir o endereço de homologação com ?versao=primeira e entrar  
  _Esperado:_ Entra; o menu mostra Measure Takeoff e Settings; nada de Daily, Crew nem Cronograma
- [ ] **T02** · `pv.p1.admin` — Errar a senha de propósito e depois digitar certo (usar 'Mostrar')  
  _Esperado:_ Mensagem clara no erro; o botão Mostrar revela a senha; entra na segunda tentativa
- [ ] **T03** · `pv.p1.trabalhador` — Entrar  
  _Esperado:_ Só Início, Company e My profile; sem Measure, Users, Access roles nem Jobs
- [ ] **T04** · `pv.p1.contatos` — Entrar e abrir Contacts  
  _Esperado:_ Só a lista de contatos; consegue criar e editar um contato; não vê Measure nem Concorrências
- [ ] **T05** · `pv.p1.admin` — Abrir My profile; trocar o idioma PT/EN  
  _Esperado:_ Os textos mudam sem recarregar errado; volta a entrar sem perder a sessão

## 2 Settings e papéis

- [ ] **T06** · `pv.p1.admin` — Users: abrir a lista  
  _Esperado:_ Vê os 5 logins da Maple Siding com seus perfis (Administrador, Gestor, Estimator, Contacts only, Trabalhador)
- [ ] **T07** · `pv.p1.admin` — Access roles: abrir Estimator e comparar com Gestor de obras  
  _Esperado:_ Estimator tem medir, catálogo e responder convites; Gestor não tem catálogo
- [ ] **T08** · `pv.p1.admin` — Jobs: abrir a lista; criar uma obra nova simples  
  _Esperado:_ Obra criada com contratante e local; sem seção de equipe; aparece na lista
- [ ] **T09** · `pv.p1.admin` — Jobs: editar o nome da obra criada e salvar  
  _Esperado:_ Nome atualizado na lista
- [ ] **T10** · `pv.p1.gestor` — Entrar; abrir Jobs e Concorrências  
  _Esperado:_ Vê e gerencia obras e concorrências; não vê Access roles
- [ ] **T11** · `pv.p1.orcamentista` — Entrar; abrir Measure  
  _Esperado:_ Cria item e assembly no catálogo; NÃO vê enviar concorrência
- [ ] **T12** · `pv.p1.gestor` — Tentar criar item no catálogo  
  _Esperado:_ Não consegue (sem permissão de catálogo)
- [ ] **T13** · `pv.p1.admin` — Company: conferir os dados da empresa  
  _Esperado:_ Nome, endereço e telefone da Maple Siding corretos

## 3 Measure Takeoff

- [ ] **T14** · `pv.p1.admin` — Abrir 'Canal Street Lofts — Siding bid'  
  _Esperado:_ Planta com 3 folhas, medição na fachada, proposta emitida
- [ ] **T15** · `pv.p1.admin` — Abrir 'Larkin Barn — Residing' (só a planta); calibrar a escala; medir uma parede  
  _Esperado:_ Escala conferida; a medição aparece com a quantidade em pés
- [ ] **T16** · `pv.p1.admin` — Aplicar o assembly 'Lap siding with housewrap' à medição  
  _Esperado:_ Quantidades de material calculadas pelas fórmulas
- [ ] **T17** · `pv.p1.admin` — Emitir a proposta e baixar o PDF  
  _Esperado:_ Proposta com número; PDF baixa e abre; valores batem com o catálogo
- [ ] **T18** · `pv.p1.admin` — Itens/Preços: criar um item novo, dar preço, mudar o preço  
  _Esperado:_ Histórico de preço guardado; a proposta antiga não muda
- [ ] **T19** · `pv.p1.admin` — Preços: criar nova versão das margens  
  _Esperado:_ Versão nova aparece; propostas anteriores mantêm a margem antiga
- [ ] **T20** · `pv.c1.admin` — Abrir 'Northgate Tower — Level 5 fit-out'  
  _Esperado:_ Construtora abre o Measure e a proposta emitida (liberado pela migração 0015)
- [ ] **T21** · `pv.c1.orcamentista` — Criar um item e um projeto novo  
  _Esperado:_ Grava normalmente
- [ ] **T22** · `pv.p3.admin` — Tentar abrir um projeto de outra empresa pelo endereço (#/measure/projeto/…)  
  _Esperado:_ Não encontra; nada de outra empresa aparece

## 4 Concorrências — quem pede

- [ ] **T23** · `pv.c1.admin` — Abrir 'Exterior windows and doors' (aberta)  
  _Esperado:_ 3 convidadas (Maple, Cobalt e Birchwood sem conta); 2 propostas; pergunta e resposta
- [ ] **T24** · `pv.c1.admin` — Comparar as 2 propostas por etapa  
  _Esperado:_ Totais e prazos corretos lado a lado
- [ ] **T25** · `pv.c1.admin` — Responder uma nova pergunta para todas as convidadas  
  _Esperado:_ Mensagem registrada e visível a quem foi convidada
- [ ] **T26** · `pv.c1.admin` — Fechar a concorrência escolhendo uma vencedora  
  _Esperado:_ Situação fechada; vencedora e não escolhidas marcadas
- [ ] **T27** · `pv.c1.admin` — Abrir 'Final cleaning' (rascunho); conferir e enviar  
  _Esperado:_ Vira aberta; convidadas passam a ver
- [ ] **T28** · `pv.c1.admin` — Criar uma concorrência nova do zero (obra, etapas, escopo, prazo, 2 convidadas) e enviar  
  _Esperado:_ Enviada sem erro; aparece na lista como aberta
- [ ] **T29** · `pv.c1.admin` — Prorrogar o prazo de uma concorrência aberta  
  _Esperado:_ Novo prazo visível para as convidadas
- [ ] **T30** · `pv.c1.admin` — Convidar mais uma empresa numa aberta  
  _Esperado:_ Convite novo aparece para ela
- [ ] **T31** · `pv.c2.admin` — Cancelar uma concorrência aberta (criada por você)  
  _Esperado:_ Situação cancelada com o motivo; convidadas veem encerrada
- [ ] **T32** · `pv.c1.admin` — Abrir 'Landscaping' (de c2): tentar abrir pelo endereço  
  _Esperado:_ Não vê concorrência de outra construtora

## 5 Concorrências — quem recebe

- [ ] **T33** · `pv.p1.admin` — Measure Takeoff › Convites  
  _Esperado:_ Lista os convites recebidos, com novidades destacadas
- [ ] **T34** · `pv.p1.admin` — Abrir um convite novo e responder 'Vou cotar'  
  _Esperado:_ Situação muda para vai-cotar; quem pediu vê
- [ ] **T35** · `pv.p1.admin` — Enviar proposta com valor por etapa, prazo e exclusões  
  _Esperado:_ Proposta enviada; revisão registrada
- [ ] **T36** · `pv.p1.admin` — Recusar um convite com motivo  
  _Esperado:_ Situação 'não vai'; quem pediu vê o motivo
- [ ] **T37** · `pv.p1.admin` — Fazer uma pergunta ao contratante  
  _Esperado:_ Pergunta chega a quem pediu
- [ ] **T38** · `pv.p3.admin` — Procurar 'Exterior windows and doors'  
  _Esperado:_ Não aparece (Bedrock não foi convidada)
- [ ] **T39** · `pv.p1.trabalhador` — Procurar Convites  
  _Esperado:_ Não tem acesso
- [ ] **T40** · `pv.p1.orcamentista` — Responder a um convite e enviar proposta  
  _Esperado:_ Consegue (concorrencias.responder)

## 6 Pares de empresas

- [ ] **T41** · `pv.c2.admin` — Receber e responder 'Structural steel package' (construtora → construtora)  
  _Esperado:_ Convite chega; consegue recusar ou propor
- [ ] **T42** · `pv.a1.admin` — Responder 'Site concrete and curbs' (construtora → ambas)  
  _Esperado:_ Convite chega; resposta registrada
- [ ] **T43** · `pv.p5.admin` — Responder 'Metal stud framing' (prestadora → prestadora)  
  _Esperado:_ Convite chega; proposta enviada
- [ ] **T44** · `pv.a2.admin` — Receber 'Temporary protection and scaffolding' (prestadora → ambas)  
  _Esperado:_ Convite chega para a ambas
- [ ] **T45** · `pv.p4.admin` — Receber 'Gutters and downspouts' (ambas → prestadora) e ver o prazo prorrogado  
  _Esperado:_ Convite com o prazo novo
- [ ] **T46** · `pv.c1.admin` — Receber 'MEP package' (ambas → construtora)  
  _Esperado:_ Convite chega para a construtora
- [ ] **T47** · `pv.a2.admin` — Abrir 'Storefront glazing' com 3 propostas  
  _Esperado:_ Compara as 3 e fecha com uma vencedora

## 7 Vencedora e obra

- [ ] **T48** · `pv.p6.admin` — Abrir 'Interior drywall and finishing' (ganhou)  
  _Esperado:_ Mostra 'Você venceu'; botão para abrir a obra
- [ ] **T49** · `pv.p6.admin` — Criar a obra a partir da concorrência vencida  
  _Esperado:_ Obra criada em Jobs, ligada à da contratante
- [ ] **T50** · `pv.p2.admin` — Abrir a mesma concorrência (perdeu)  
  _Esperado:_ Vê que não foi escolhida, sem dados de outras propostas
- [ ] **T51** · `pv.c2.admin` — Confirmar a obra da vencedora vinculada à Capitol Plaza  
  _Esperado:_ Vínculo visível no lado de quem contratou

## 8 Link sem conta

- [ ] **T52** · `pv.c1.admin` — Pegar o link da Birchwood Insulation e abrir em janela anônima  
  _Esperado:_ Abre a página do convite sem login
- [ ] **T53** · `(sem login)` — Responder 'Vou cotar' e enviar uma proposta pelo link  
  _Esperado:_ Proposta chega a quem pediu
- [ ] **T54** · `(sem login)` — Tentar alterar o endereço do link  
  _Esperado:_ Mostra link inválido, sem vazar dados

## 9 Avisos e sino

- [ ] **T55** · `pv.p1.admin` — Depois que a c1 enviar um convite novo, olhar o sino  
  _Esperado:_ Aparece aviso do convite; clicar abre o convite certo
- [ ] **T56** · `pv.c1.admin` — Depois da proposta da p1, olhar o sino  
  _Esperado:_ Aviso de proposta recebida
- [ ] **T57** · `pv.p1.admin` — Marcar o aviso como lido  
  _Esperado:_ Contador do sino diminui

## 10 Isolamento e segurança

- [ ] **T58** · `pv.c1.admin / pv.c2.admin` — Conferir Jobs de cada uma  
  _Esperado:_ Cada uma só vê as próprias obras
- [ ] **T59** · `pv.p3.admin` — Conferir Contacts  
  _Esperado:_ Não aparecem contatos de outras empresas (Larkin, Hampton Church)
- [ ] **T60** · `pv.p1.trabalhador` — Colar no navegador o endereço de Convites ou Measure  
  _Esperado:_ Redireciona ou nega; nada vaza
- [ ] **T61** · `qualquer` — Sair da conta e usar o botão voltar do navegador  
  _Esperado:_ Não mostra telas internas; pede login

## 11 Navegador e celular

- [ ] **T62** · `pv.p1.admin` — Repetir o fluxo de Measure no Chrome e no Safari do computador  
  _Esperado:_ Mesmo comportamento
- [ ] **T63** · `pv.p1.admin` — Entrar no iPhone (roteiro do iPhone) e abrir Convites  
  _Esperado:_ Entra; lista legível; responde um convite
- [ ] **T64** · `pv.p1.admin` — Entrar no Android (roteiro do Android) e abrir Convites  
  _Esperado:_ Idem
- [ ] **T65** · `pv.p1.admin` — Com o app instalado, abrir depois de uma atualização  
  _Esperado:_ Pega a versão nova sem reinstalar

## 12 Início: painel e menu lateral

- [ ] **T66** · `pv.c1.admin` — Entrar com ?versao=primeira e olhar o Início  
  _Esperado:_ Painel em tela cheia abaixo do cabeçalho, sem abas nem menu lateral; 'Olá, Helen' e dois botões: Takeoff e Settings
- [ ] **T67** · `pv.c1.admin` — Olhar o bloco 'Precisa de você agora'  
  _Esperado:_ Fundo e borda laranja que se destacam dos demais; 3 propostas recebidas e 1 convite para responder; os cartões sem pendência aparecem apagados com 'Nada pendente'
- [ ] **T68** · `pv.c1.admin` — Clicar em 'Propostas recebidas' e em 'Convite para responder'  
  _Esperado:_ Abre as concorrências (propostas) e a lista de Convites
- [ ] **T69** · `pv.c1.admin` — Conferir 'Projetos por status'  
  _Esperado:_ Rosca com 1 projeto em Proposta emitida; 2 obras em andamento e 0 concluídas
- [ ] **T70** · `pv.c1.admin` — Conferir 'Dinheiro em jogo'  
  _Esperado:_ Propostas abertas com valor em US$; Taxa de acerto e Ticket médio com '—' (nenhum projeto decidido); valor por contratante
- [ ] **T71** · `pv.c1.admin` — Conferir 'Concorrências'  
  _Esperado:_ Enviadas por nós: 3 (2 abertas e 1 rascunho); Recebidas por nós: 1 sem resposta; economia média '—'; tempo médio de resposta em horas ou dias
- [ ] **T72** · `pv.c1.admin` — Conferir 'Prazo das obras'  
  _Esperado:_ Northgate Tower Renovation e Canal Street Lofts com início, prazo, % de tempo decorrido e dias restantes; linha 'Andamento do cronograma: —'
- [ ] **T73** · `pv.c1.admin` — Em Settings › Obras, mudar o prazo de uma obra para uma data passada e voltar ao Início  
  _Esperado:_ A obra aparece com 'atrasada N dias' em vermelho e a barra completa
- [ ] **T74** · `pv.c1.admin` — Conferir 'Minhas parceiras'  
  _Esperado:_ Maple Siding, Cobalt Framing e outras com a obra em comum, propostas e tempo de resposta; Birchwood Insulation com 'só pelo link'
- [ ] **T75** · `pv.c1.admin` — Conferir 'Catálogo e preços'  
  _Esperado:_ Itens sem preço novo há mais de 90 dias (0 na massa nova) e margem vigente 16% (overhead 9% + lucro 7%)
- [ ] **T76** · `pv.c1.admin` — Clicar em 'Ver todos' de cada bloco  
  _Esperado:_ Cada um abre a lista certa (projetos, concorrências, obras, preços)
- [ ] **T77** · `pv.p1.admin` — Entrar e conferir o painel  
  _Esperado:_ 2 projetos (1 proposta emitida e 1 rascunho); recebidas 3 (2 com proposta e 1 recusado); enviadas 1 fechada (Soffit and fascia)
- [ ] **T78** · `pv.p1.admin` — No Measure, gerar a lista de cotação de um projeto e preparar o e-mail de um fornecedor; voltar ao Início  
  _Esperado:_ 'Cotações de material' passa a mostrar 1 lista enviada e 1 fornecedor; o cartão 'Cotações de material' mostra 1 sem retorno
- [ ] **T79** · `pv.p1.admin` — Registrar os preços recebidos desse fornecedor e voltar ao Início  
  _Esperado:_ O fornecedor passa a 'respondeu' e o cartão volta a 'Nada pendente'
- [ ] **T80** · `pv.p1.admin` — Num projeto ganho sem obra, olhar o Início  
  _Esperado:_ Aparece o cartão 'Projeto ganho sem obra' com o link para criar a obra
- [ ] **T81** · `pv.p1.gestor` — Entrar  
  _Esperado:_ Vê o painel com concorrências enviadas e recebidas; vê 'Dinheiro em jogo' (tem crew.custos)
- [ ] **T82** · `pv.p1.orcamentista` — Entrar  
  _Esperado:_ Vê projetos, dinheiro, cotações e preços; NÃO vê 'Enviadas por nós'; vê 'Recebidas por nós'
- [ ] **T83** · `pv.p1.contatos / pv.p1.trabalhador` — Entrar  
  _Esperado:_ Sem painel: Início simples; menu lateral só com Início, Empresa e Meu perfil (o contatos também com Contatos)
- [ ] **T84** · `pv.a2.admin` — Entrar  
  _Esperado:_ Enviadas por nós 2 e recebidas 2 (o aço e o andaime); painel completo
- [ ] **T85** · `pv.c1.admin + pv.p1.admin` — Com a p1, enviar uma proposta a um convite da c1; com a c1, voltar ao Início em até 1 minuto  
  _Esperado:_ Os números de propostas recebidas e de concorrências mudam sozinhos (releitura a cada minuto)
- [ ] **T86** · `pv.c1.admin` — Trocar o idioma para EN  
  _Esperado:_ Todos os títulos e legendas do painel em inglês (Needs you now, Projects by status, Job deadlines, My partners...), sem português solto
- [ ] **T87** · `pv.c1.admin` — Reduzir a janela do navegador  
  _Esperado:_ Blocos empilham, tabelas rolam na horizontal, botões Takeoff e Settings continuam visíveis
- [ ] **T88** · `pv.c1.admin` — Clicar em Takeoff e em Settings no painel  
  _Esperado:_ Takeoff abre o Measure (Projetos); Settings abre Obras
- [ ] **T89** · `pv.c1.admin` — Olhar o menu lateral do Settings  
  _Esperado:_ Itens: Início, Obras, Contatos, Usuários, Perfis de acesso, Empresa e Meu perfil; o item da tela aberta fica marcado
- [ ] **T90** · `pv.c1.admin` — Clicar em cada item do menu lateral do Settings  
  _Esperado:_ Cada um abre a tela certa; 'Início' volta ao painel
- [ ] **T91** · `pv.c1.admin` — No Takeoff, olhar o menu lateral  
  _Esperado:_ Tem Início, Projetos, Assemblies, Itens, Preços, Convites e Concorrências; 'Início' volta ao painel
- [ ] **T92** · `pv.c1.admin` — Abrir o Settings numa janela estreita (celular)  
  _Esperado:_ O menu lateral some e aparecem as abas de antes (Início, Obras, Contatos...)

## 13 Assemblies, listas de materiais e cotações

- [ ] **T93** · `pv.p1.admin` — Settings › Takeoff › Assemblies: abrir a lista  
  _Esperado:_ Lista com 4 assemblies (Lap siding with housewrap, Siding full package, Trim and corners, Exterior paint two coats), cada um com seus materiais
- [ ] **T94** · `pv.p1.admin` — Abrir 'Siding full package'  
  _Esperado:_ 4 linhas de material com fórmula, perda % e unidade; as quantidades de exemplo calculam sem erro
- [ ] **T95** · `pv.p1.admin` — Takeoff › Itens: conferir o catálogo  
  _Esperado:_ 8 itens (2 básicos + 6 novos) por etapa (Siding, Trim, Fasteners, Flashing, Finish, Sealants), com unidade de compra
- [ ] **T96** · `pv.p1.admin` — Takeoff › Preços: abrir o histórico de um item (por exemplo Corner trim)  
  _Esperado:_ Dois preços: o de 120 dias atrás (menor) e o atual; o item 'Exterior sealant tube' só tem preço de 200 dias atrás
- [ ] **T97** · `pv.p1.admin` — Abrir o projeto 'Canal Street Lofts — Siding bid'  
  _Esperado:_ Várias condições medidas, uma por assembly, com áreas diferentes e as quantidades de material de cada uma
- [ ] **T98** · `pv.p1.admin` — No projeto, abrir a lista de materiais / quantidades por item  
  _Esperado:_ Soma das quantidades por item entre as condições, na unidade de compra, com perda e arredondamento
- [ ] **T99** · `pv.p1.admin` — Abrir a Lista para cotação do projeto  
  _Esperado:_ Duas seções de fornecedor (Granite State Lumber e Merrimack Paint Supply), cada uma só com os itens das etapas que ele fornece; nenhum item em 'Sem fornecedor'
- [ ] **T100** · `pv.p1.admin` — Na Lista para cotação: conferir os avisos de envio  
  _Esperado:_ Um fornecedor com 'e-mail preparado em <data>' e outro com 'preços recebidos em <data>'
- [ ] **T101** · `pv.p1.admin` — Baixar o PDF do pedido de cotação de um fornecedor  
  _Esperado:_ Documento A4 com logo e dados da empresa, 'Request for quote', obra, 'Reply by', tabela com colunas em branco para preço unitário e total, subtotal, frete e total
- [ ] **T102** · `pv.p1.admin` — Clicar em 'Enviar por e-mail' de um fornecedor  
  _Esperado:_ Abre o programa de e-mail com o assunto, os itens e o prazo preenchidos (nada é enviado sozinho)
- [ ] **T103** · `pv.p1.admin` — Clicar em 'Registrar preços recebidos' de um fornecedor e lançar preços  
  _Esperado:_ Os preços entram no histórico dos itens com a fonte 'cotação' e o fornecedor; o selo 'preços recebidos' aparece
- [ ] **T104** · `pv.p1.admin` — Abrir a Proposta do projeto e emitir uma nova  
  _Esperado:_ Linhas por etapa com os materiais como detalhe; emitir gera um número novo e o PDF; a anterior continua guardada
- [ ] **T105** · `pv.p1.admin` — Voltar ao Início depois das cotações  
  _Esperado:_ 'Cotações de material' mostra as listas enviadas e os fornecedores; o cartão de cotação sem retorno reflete o que falta
- [ ] **T106** · `pv.c1.admin / pv.a2.admin / pv.p2.admin / pv.p3.admin / pv.p4.admin / pv.a1.admin` — Repetir a Lista para cotação e o PDF em cada empresa  
  _Esperado:_ Cada uma tem a sua família de materiais (partições, framing, concreto, telhado, calhas), seus fornecedores e as quantidades coerentes

## 14 Concorrências — fluxo revisado (envio só depois de salvar, anexos e tela do convite)

- [ ] **T107** · `pv.c1.admin` — Nova concorrência: preencher só o nome e clicar Salvar  
  _Esperado:_ Vai para a página da concorrência como Rascunho; o botão 'Enviar convites' aparece desabilitado e a página diz o que falta; não existe botão de envio no formulário
- [ ] **T108** · `pv.c1.admin` — Salvar com o prazo da proposta numa data que já passou  
  _Esperado:_ O Salvar recusa com 'O prazo da proposta precisa ser no futuro' e nada é gravado
- [ ] **T109** · `pv.c1.admin` — Editar o rascunho e salvar duas vezes seguidas, sem mudar nada  
  _Esperado:_ Continua 1 rascunho só (sem duplicar) e sem erro de chave duplicada; a lista mostra 1 linha
- [ ] **T110** · `pv.c1.admin` — Em Documentos anexos: escolher 3 PDFs de uma vez, preencher Descrição e Observação e clicar Anexar  
  _Esperado:_ Aparecem 3 linhas na tabela (Código, Descrição, Arquivo, Tamanho, Observação); dá para Remover uma linha. A Observação ainda não é gravada no banco real (depende de migração)
- [ ] **T111** · `pv.c1.admin` — Escolher um PDF e clicar Salvar sem clicar em Anexar  
  _Esperado:_ O arquivo entra junto no salvamento; aparece na tabela depois de salvar
- [ ] **T112** · `pv.c1.admin` — Nova concorrência a partir de um projeto do Takeoff com plantas  
  _Esperado:_ As plantas do projeto aparecem marcadas em 'Plantas do projeto' e vão junto no pacote
- [ ] **T113** · `pv.c1.admin` — Completar o rascunho e clicar 'Enviar convites' sem nenhum desenho anexado  
  _Esperado:_ Pede confirmação ('Sem desenhos anexados'); com desenho, não pede; o envio não abre popup de links
- [ ] **T114** · `pv.c1.admin` — Abrir a lista de concorrências, aba Rascunhos  
  _Esperado:_ Coluna Ações: rascunho tem 'Editar'; as demais têm 'Abrir'
- [ ] **T115** · `pv.c1.admin` — Convidada sem conta: copiar o link na tabela de convidados  
  _Esperado:_ 'Copiar o link' funciona e não abre popup
- [ ] **T116** · `(sem login)` — Abrir o link do convite recebido por e-mail  
  _Esperado:_ A tela mostra Escopo, O pacote, 'Documentos do projeto' (tabela com botão Abrir em cada arquivo) e o cartão 'Cote mais rápido com o KORbuild Takeoff'; o botão leva ao login
- [ ] **T117** · `(sem login)` — Clicar Abrir em cada documento do projeto  
  _Esperado:_ O PDF abre; se algum não abrir, aparece 'indisponível' (anote qual)
- [ ] **T118** · `(sem login)` — Responder 'Vou cotar' e olhar o formulário 'Mandar a proposta'  
  _Esperado:_ Total (US$) e Prazo de execução (dias) lado a lado, mesmo tamanho; PDF e exclusões na largura inteira; Enviar a proposta no canto direito
- [ ] **T119** · `(sem login)` — Mandar a proposta com PDF e total, depois uma pergunta  
  _Esperado:_ A proposta e a pergunta chegam para a contratante; a contratante responde e a resposta aparece no link
- [ ] **T120** · `pv.c1.admin` — Abrir a concorrência com proposta recebida, comparar e fechar  
  _Esperado:_ A comparação mostra a proposta; ao fechar, a vencedora e a situação 'Fechada' aparecem

## 15 Projeto — espaço de trabalho (abas, plantas, takeoff, cronograma e resumo)

- [ ] **T121** · `pv.p1.admin` — Projects: abrir a lista de projetos e digitar parte de um nome na busca  
  _Esperado:_ A lista mostra Project, Bid due, Progress, Proposal, Estimator e Status; a busca filtra as linhas na hora; clicar no projeto abre o Overview
- [ ] **T122** · `pv.p1.admin` — New project: abrir e olhar os campos  
  _Esperado:_ Passo 1 pede só o essencial: nome, cliente, prazo da proposta e endereço (rua, cidade, estado, ZIP); botão 'Continuar para as plantas'
- [ ] **T123** · `pv.p1.admin` — New project: salvar sem cliente; depois com ZIP de 4 dígitos  
  _Esperado:_ Avisa que o cliente é obrigatório; avisa que o ZIP precisa de 5 dígitos; nada é salvo com erro
- [ ] **T124** · `pv.p1.admin` — New project: preencher tudo certo e continuar  
  _Esperado:_ Abre o projeto na aba Plans, com o cartão para enviar o PDF das plantas e o texto 'No sheets yet'
- [ ] **T125** · `pv.p1.admin` — Abas do projeto: olhar a faixa de abas  
  _Esperado:_ Seis abas, nesta ordem: Overview · Plans · Takeoff · Materials · Schedule · Project summary
- [ ] **T126** · `pv.p1.admin` — Plans: enviar o PDF do jogo de plantas (com e sem referência no campo do envio)  
  _Esperado:_ Cada página vira uma folha; o contador na aba Plans sobe; a tabela mostra Sheet, File, Scale e Note, sem botão Open nem contagem de medições; a referência digitada vai para as folhas do arquivo novo
- [ ] **T127** · `pv.p1.admin` — Plans: escrever uma observação numa folha e recarregar a página  
  _Esperado:_ Aparece 'Note saved.' (até 500 caracteres) e o texto continua depois de recarregar
- [ ] **T128** · `pv.p1.admin` — Overview: conferir os 4 cartões do topo e o checklist 'Set up this project'  
  _Esperado:_ Bid due (com 'em N dias'), Progress (N de 6 passos e o próximo), Plans and measuring, Proposal; os 6 passos mostram feito/próximo/pendente com o botão certo
- [ ] **T129** · `pv.p1.admin` — Overview: clicar nos botões do checklist (View plans, Set scales, Review, Open takeoff, Open schedule, Open proposal)  
  _Esperado:_ Plans leva a Plans; Set scales, Review e Open takeoff levam a Takeoff; Open schedule, a Schedule; Open proposal, à proposta; ao concluir o passo, a marca verde aparece e o progresso sobe
- [ ] **T130** · `pv.p1.admin` — Edit project: mudar dono da obra, obra vinculada, situação e estimador; salvar  
  _Esperado:_ Os dados aparecem no Overview; o contato novo criado no próprio formulário já fica escolhido sem perder o que foi digitado
- [ ] **T131** · `pv.p1.admin` — Takeoff: clicar em 'Mark all as self-performed'  
  _Esperado:_ Todas as etapas viram Self-perform com takeoff detalhado; o botão fica desabilitado quando não há etapas; não existem mais cartões de padrão (Fazemos tudo / Misto / Subcontratamos tudo) no Takeoff nem no Novo/Editar projeto
- [ ] **T132** · `pv.p1.admin` — Takeoff: adicionar uma etapa (ex.: 07 46 33 · Siding) e usar 'Bring in from takeoff'  
  _Esperado:_ A etapa entra na tabela; 'Bring in from takeoff' traz as etapas dos assemblies já aplicados, sem duplicar
- [ ] **T133** · `pv.p1.admin` — Takeoff: mudar 'Who does it' de uma etapa para Subcontract  
  _Esperado:_ Takeoff da etapa passa a 'None' com a opção 'also measure quantities'; a linha oferece criar a bid request; Decide later fica tracejado
- [ ] **T134** · `pv.p1.admin` — Takeoff: em uma etapa Subcontract, abrir 'New bid' pelo link da linha  
  _Esperado:_ Abre a nova concorrência já ligada ao projeto
- [ ] **T135** · `pv.p1.admin` — Takeoff: cartão 'Measure' — escolher uma planta e clicar em Measure  
  _Esperado:_ Lista as folhas com escala e número de medições; Measure abre a tela de medição daquela folha; nela dá para trocar de folha pela lista no topo; o link de volta leva ao Takeoff
- [ ] **T136** · `pv.p1.admin` — Takeoff: medir algo e voltar  
  _Esperado:_ A tabela Quantities mostra medido, derivadas e número de medições; os typicals, vãos e o rastro do cálculo aparecem como antes
- [ ] **T137** · `pv.p1.admin` — Materials: abrir a aba; clicar 'Lista para cotação'  
  _Esperado:_ Mostra os materiais calculados; a Lista para cotação abre com a faixa de abas no topo (Materials marcada)
- [ ] **T138** · `pv.p1.admin` — Schedule: 'Gerar a partir das etapas' e mudar início e dias de uma tarefa  
  _Esperado:_ Uma tarefa por etapa, com início e duração; o término e a barra de tempo acompanham a mudança
- [ ] **T139** · `pv.p1.admin` — Schedule: adicionar tarefa, adicionar marco, remover cada um  
  _Esperado:_ Linhas novas editáveis; remover tira só a linha escolhida
- [ ] **T140** · `pv.p1.admin` — Schedule: projeto ainda em Estimating  
  _Esperado:_ Não aparece pedido de confirmação do cronograma
- [ ] **T141** · `pv.p1.admin` — Edit project: mudar a situação para Won e abrir Schedule  
  _Esperado:_ Aparece 'Confirm the schedule' com o botão 'Confirm schedule' (desabilitado se não há tarefas)
- [ ] **T142** · `pv.p1.admin` — Schedule (Won): confirmar; depois mudar uma data e confirmar de novo  
  _Esperado:_ Mostra 'Schedule confirmed' com a data e o número de tarefas; o botão vira 'Update baseline' e regrava
- [ ] **T143** · `pv.p1.admin` — Project summary: abrir a última aba  
  _Esperado:_ Quatro cartões (Status, Proposal, Estimated cost, Margin); botão para montar/abrir a proposta; tabela 'Who does each part' com a origem do preço; resumo do cronograma; concorrências do projeto com 'New bid'
- [ ] **T144** · `pv.p1.admin` — Project summary: abrir a proposta e emitir  
  _Esperado:_ A faixa de abas aparece no topo (Project summary marcada); a proposta sai com as linhas e o total; voltar leva ao projeto
- [ ] **T145** · `pv.p1.admin` — Endereços antigos: abrir #/measure/projeto/<id>/scope e /bids  
  _Esperado:_ Caem na aba Takeoff (os links antigos não quebram)
- [ ] **T146** · `pv.p1.admin` — Trocar o idioma para inglês (padrão) e percorrer todas as abas do projeto  
  _Esperado:_ Nenhum texto em português (menus, botões, avisos, tabelas)
- [ ] **T147** · `pv.p1.orcamentista` — Entrar como orçamentista e abrir um projeto  
  _Esperado:_ Consegue ver e editar o projeto conforme o perfil; nada de módulos ocultos na 1ª versão
- [ ] **T148** · `pv.p1.gestor` — Entrar como gestor e abrir um projeto  
  _Esperado:_ Mede e vê quantidades, mas não vê dinheiro (preços e proposta)
- [ ] **T149** · `pv.p1.admin` — Conta real: mudar quem faz uma etapa em Takeoff e recarregar a página  
  _Esperado:_ A escolha continua depois de recarregar; o aviso 'só neste navegador' não aparece
- [ ] **T150** · `pv.p1.admin` — Conta real: criar tarefas no Schedule, recarregar e abrir em outro navegador  
  _Esperado:_ Tarefas, marcos e a confirmação continuam; aparecem no outro navegador
- [ ] **T151** · `pv.p1.admin` — Conta real (só depois da migração 0017): escrever observações em folhas e recarregar  
  _Esperado:_ As observações continuam depois de recarregar (antes da 0017 ficam só neste aparelho)
