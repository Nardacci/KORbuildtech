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
