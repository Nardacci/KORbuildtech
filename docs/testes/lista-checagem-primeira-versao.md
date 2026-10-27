# Lista de checagem — 1ª versão (Measure Takeoff, Concorrências e Settings)

Senha de todos os logins: a de `KOR_DEMO_SENHA`. Logins: `pv.<empresa>.<papel>@example.com`. Endereço: homologação com `?versao=primeira`.
Marque `[x]` quando passar; se falhar, escreva ao lado o que viu (tela, login, hora). Versão em planilha: `lista-checagem-primeira-versao.csv`.


## 1 Entrada e conta

- [ ] **T1** · `pv.p1.admin` — Abrir o endereço de homologação com ?versao=primeira e entrar  
  _Esperado:_ Entra; o menu mostra Measure Takeoff e Settings; nada de Daily, Crew nem Cronograma
- [ ] **T2** · `pv.p1.admin` — Errar a senha de propósito e depois digitar certo (usar 'Mostrar')  
  _Esperado:_ Mensagem clara no erro; o botão Mostrar revela a senha; entra na segunda tentativa
- [ ] **T3** · `pv.p1.trabalhador` — Entrar  
  _Esperado:_ Só Início, Company e My profile; sem Measure, Users, Access roles nem Jobs
- [ ] **T4** · `pv.p1.contatos` — Entrar e abrir Contacts  
  _Esperado:_ Só a lista de contatos; consegue criar e editar um contato; não vê Measure nem Concorrências
- [ ] **T5** · `pv.p1.admin` — Abrir My profile; trocar o idioma PT/EN  
  _Esperado:_ Os textos mudam sem recarregar errado; volta a entrar sem perder a sessão

## 2 Settings e papéis

- [ ] **T6** · `pv.p1.admin` — Users: abrir a lista  
  _Esperado:_ Vê os 5 logins da Maple Siding com seus perfis (Administrador, Gestor, Estimator, Contacts only, Trabalhador)
- [ ] **T7** · `pv.p1.admin` — Access roles: abrir Estimator e comparar com Gestor de obras  
  _Esperado:_ Estimator tem medir, catálogo e responder convites; Gestor não tem catálogo
- [ ] **T8** · `pv.p1.admin` — Settings: procurar a tela Jobs/Obras  
  _Esperado:_ Não existe na 1ª versão (o projeto ganho é a obra); #/conta/obras volta para a conta
- [ ] **T9** · `pv.p1.admin` — Início › botão Settings  
  _Esperado:_ Abre Settings › Contatos
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
- [ ] **T18** · `pv.p1.admin` — Itens: criar um item novo (com preço inicial), depois mudar o preço na aba Preços do item  
  _Esperado:_ Histórico de preço guardado; a proposta antiga não muda
- [ ] **T19** · `pv.p1.admin` — Itens › Markups: criar nova versão das markups  
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
  _Esperado:_ Mostra 'Você venceu' (sem botão de obra na 1ª versão)
- [ ] **T49** · `pv.p6.admin` — Criar a obra a partir da concorrência vencida  
  _Esperado:_ Não se aplica na 1ª versão: não há cadastro de obra (o projeto ganho é a obra)
- [ ] **T50** · `pv.p2.admin` — Abrir a mesma concorrência (perdeu)  
  _Esperado:_ Vê que não foi escolhida, sem dados de outras propostas
- [ ] **T51** · `pv.c2.admin` — Confirmar a obra da vencedora vinculada à Capitol Plaza  
  _Esperado:_ Não se aplica na 1ª versão (sem obra)

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
  _Esperado:_ Rosca com 1 projeto em Proposta emitida; sem contagem de obras (1ª versão)
- [ ] **T70** · `pv.c1.admin` — Conferir 'Dinheiro em jogo'  
  _Esperado:_ Propostas abertas com valor em US$; Taxa de acerto e Ticket médio com '—' (nenhum projeto decidido); valor por contratante
- [ ] **T71** · `pv.c1.admin` — Conferir 'Concorrências'  
  _Esperado:_ Enviadas por nós: 3 (2 abertas e 1 rascunho); Recebidas por nós: 1 sem resposta; economia média '—'; tempo médio de resposta em horas ou dias
- [ ] **T72** · `pv.c1.admin` — Conferir 'Prazo das obras'  
  _Esperado:_ O bloco 'Prazo das obras' não existe na 1ª versão: o andamento está em 'Andamento dos projetos'
- [ ] **T73** · `pv.c1.admin` — Em Settings › Obras, mudar o prazo de uma obra para uma data passada e voltar ao Início  
  _Esperado:_ Não se aplica (sem Settings › Obras); use o % feito do Schedule para ver atraso no Início
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
  _Esperado:_ Não aparece cartão de 'Projeto ganho sem obra'; o projeto ganho entra em Andamento dos projetos quando tem cronograma
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
  _Esperado:_ Takeoff abre o Measure (Projetos); Settings abre Contatos
- [ ] **T89** · `pv.c1.admin` — Olhar o menu lateral do Settings  
  _Esperado:_ Itens: Início, Contatos, Usuários, Perfis de acesso, Empresa e Meu perfil (sem Obras); o item da tela aberta fica marcado
- [ ] **T90** · `pv.c1.admin` — Clicar em cada item do menu lateral do Settings  
  _Esperado:_ Cada um abre a tela certa; 'Início' volta ao painel
- [ ] **T91** · `pv.c1.admin` — No Takeoff, olhar o menu lateral  
  _Esperado:_ Tem Início, Projetos, Assemblies, Itens (os preços ficam dentro de Itens), Convites e Concorrências; 'Início' volta ao painel
- [ ] **T92** · `pv.c1.admin` — Abrir o Settings numa janela estreita (celular)  
  _Esperado:_ O menu lateral some e aparecem as abas de antes (Início, Contatos...)

## 13 Assemblies, listas de materiais e cotações

- [ ] **T93** · `pv.p1.admin` — Settings › Takeoff › Assemblies: abrir a lista  
  _Esperado:_ Lista com 4 assemblies (Lap siding with housewrap, Siding full package, Trim and corners, Exterior paint two coats), cada um com seus materiais
- [ ] **T94** · `pv.p1.admin` — Abrir 'Siding full package'  
  _Esperado:_ 4 linhas de material com fórmula, perda % e unidade; as quantidades de exemplo calculam sem erro
- [ ] **T95** · `pv.p1.admin` — Takeoff › Itens: conferir o catálogo  
  _Esperado:_ 8 itens (2 básicos + 6 novos) por etapa (Siding, Trim, Fasteners, Flashing, Finish, Sealants), com unidade de compra
- [ ] **T96** · `pv.p1.admin` — Takeoff › Itens: abrir o item Corner trim e a aba Preços  
  _Esperado:_ Histórico com dois preços: o de 120 dias atrás (menor) e o atual, com a variação em %; o item 'Exterior sealant tube' só tem preço de 200 dias atrás
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
  _Esperado:_ Plans leva a Plans; Set scales e Open takeoff levam a Takeoff; Review e Open schedule levam a Schedule; Open proposal, à proposta; ao concluir o passo, a marca verde aparece e o progresso sobe
- [ ] **T130** · `pv.p1.admin` — Edit project: mudar dono da obra, situação e estimador; salvar (não há 'Obra vinculada' na 1ª versão)  
  _Esperado:_ Os dados aparecem no Overview; o contato novo criado no próprio formulário já fica escolhido sem perder o que foi digitado
- [ ] **T131** · `pv.p1.admin` — Takeoff: cartão 'Measure' — escolher uma planta e clicar em Measure  
  _Esperado:_ Lista as folhas com escala e número de medições; Measure abre a tela de medição daquela folha; nela dá para trocar de folha pela lista no topo; o link de volta leva ao Takeoff
- [ ] **T132** · `pv.p1.admin` — Takeoff: medir algo e voltar  
  _Esperado:_ A tabela Quantities mostra medido, derivadas e número de medições; os typicals, vãos e o rastro do cálculo aparecem como antes
- [ ] **T133** · `pv.p1.admin` — Materials: abrir a aba; clicar 'Lista para cotação'  
  _Esperado:_ Mostra os materiais calculados; a Lista para cotação abre com a faixa de abas no topo (Materials marcada)
- [ ] **T134** · `pv.p1.admin` — Schedule: cadastrar tarefas (Add task) e, se houver medições com assemblies, usar 'Generate from cost codes'  
  _Esperado:_ As tarefas são cadastradas só aqui (o Takeoff não tem mais tabela de etapas); cada uma tem início e duração; o término e as barras da Timeline acompanham
- [ ] **T135** · `pv.p1.admin` — Schedule: adicionar tarefa, adicionar marco, remover cada um  
  _Esperado:_ Linhas novas editáveis; remover tira só a linha escolhida
- [ ] **T136** · `pv.p1.admin` — Schedule: projeto ainda em Estimating  
  _Esperado:_ Não aparece pedido de confirmação do cronograma
- [ ] **T137** · `pv.p1.admin` — Edit project: mudar a situação para Won e abrir Schedule  
  _Esperado:_ Aparece 'Confirm the schedule' com o botão 'Confirm schedule' (desabilitado se não há tarefas)
- [ ] **T138** · `pv.p1.admin` — Schedule (Won): confirmar; depois mudar uma data e confirmar de novo  
  _Esperado:_ Mostra 'Schedule confirmed' com a data e o número de tarefas; o botão vira 'Update baseline' e regrava
- [ ] **T139** · `pv.p1.admin` — Project summary: abrir a última aba  
  _Esperado:_ Só leitura (nenhum campo para editar): quatro cartões (Status, Proposal, Estimated cost, Margin); dados do projeto (cliente, local, tipo, estimador, plantas, medições); escopo formatado; quem faz cada tarefa e de onde vem o preço; resumo do cronograma; concorrências do projeto (só a lista, sem botão de criar); botão para abrir a proposta
- [ ] **T140** · `pv.p1.admin` — Project summary: abrir a proposta e emitir  
  _Esperado:_ A faixa de abas aparece no topo (Project summary marcada); a proposta sai com as linhas e o total; voltar leva ao projeto
- [ ] **T141** · `pv.p1.admin` — Endereços antigos: abrir #/measure/projeto/<id>/scope e /bids  
  _Esperado:_ Caem na aba Takeoff (os links antigos não quebram)
- [ ] **T142** · `pv.p1.admin` — Trocar o idioma para inglês (padrão) e percorrer todas as abas do projeto  
  _Esperado:_ Nenhum texto em português (menus, botões, avisos, tabelas)
- [ ] **T143** · `pv.p1.orcamentista` — Entrar como orçamentista e abrir um projeto  
  _Esperado:_ Consegue ver e editar o projeto conforme o perfil; nada de módulos ocultos na 1ª versão
- [ ] **T144** · `pv.p1.gestor` — Entrar como gestor e abrir um projeto  
  _Esperado:_ Mede e vê quantidades, mas não vê dinheiro (preços e proposta)
- [ ] **T145** · `pv.p1.admin` — Conta real: mudar quem faz uma etapa em Takeoff e recarregar a página  
  _Esperado:_ A escolha continua depois de recarregar; o aviso 'só neste navegador' não aparece
- [ ] **T146** · `pv.p1.admin` — Conta real: criar tarefas no Schedule, recarregar e abrir em outro navegador  
  _Esperado:_ Tarefas, marcos e a confirmação continuam; aparecem no outro navegador
- [ ] **T147** · `pv.p1.admin` — Conta real (só depois da migração 0017): escrever observações em folhas e recarregar  
  _Esperado:_ As observações continuam depois de recarregar (antes da 0017 ficam só neste aparelho)
- [ ] **T148** · `pv.p1.admin` — Schedule: olhar a Timeline no topo da aba, com tarefas e marcos preenchidos  
  _Esperado:_ Uma linha por tarefa e por marco; eixo de meses e dias; barras verdes (nós), âmbar (prestadora) e cinza (a decidir); losangos para os marcos; linha tracejada marca hoje (se estiver no período); ao passar o mouse na barra aparecem nome, datas, duração e quem faz; mudar início ou dias na tabela move a barra
- [ ] **T149** · `pv.p1.admin` — Schedule: mudar 'Who' de uma tarefa (Us, Subcontractor, To decide) e voltar a mudar depois  
  _Esperado:_ A escolha vale na hora e pode ser editada a qualquer momento; a barra da Timeline muda de cor (verde, âmbar, cinza); uma tarefa de Subcontractor mostra, na coluna Bids, o resumo das propostas quando já existe concorrência (o cronograma não cria concorrência: isso é no menu Bids)
- [ ] **T150** · `pv.p1.admin` — Takeoff: conferir que não há mais tabela de etapas nem pergunta 'quem faz'  
  _Esperado:_ Só o cartão Measure (plantas), as quantidades e os typicals
- [ ] **T151** · `pv.p1.admin` — New project e Edit project: olhar as abas Project e Scope no topo do formulário  
  _Esperado:_ Duas abas; Project tem os campos de sempre (sem a caixa de texto simples do escopo); Scope tem só o editor de texto com barra de formatação; um único botão Save/Continue grava as duas
- [ ] **T152** · `pv.p1.admin` — Scope: escrever com título (H1/H2), negrito, itálico, sublinhado, lista com marcadores e numerada, recuo, alinhamento, link, desfazer/refazer e limpar formatação  
  _Esperado:_ Cada botão age no texto selecionado; o texto fica formatado no editor
- [ ] **T153** · `pv.p1.admin` — Scope: colar um trecho do Word (ou de uma página da web)  
  _Esperado:_ Entram título, negrito, listas e links; fontes, cores e estilos do Word não entram; nada de imagem
- [ ] **T154** · `pv.p1.admin` — Scope: salvar, reabrir o projeto e olhar a Overview  
  _Esperado:_ O escopo volta formatado no editor; a Overview mostra um resumo em texto
- [ ] **T155** · `pv.p1.admin` — Project summary › Proposal: abrir a proposta; clicar 'Load the project scope'  
  _Esperado:_ Não há caixa para editar o escopo; o botão traz o texto formatado do projeto; o primeiro acesso já vem com ele
- [ ] **T156** · `pv.p1.admin` — Proposal: emitir e abrir o documento  
  _Esperado:_ O escopo sai formatado (título, negrito, listas) no documento da proposta
- [ ] **T157** · `pv.p1.admin` — Escopos antigos (texto simples)  
  _Esperado:_ Aparecem no editor como parágrafos normais e continuam indo para a proposta

## 16 Concorrência a partir do projeto (tarefas, plantas e escopo)

- [ ] **T158** · `pv.c1.admin` — Bids › New bid (sem escolher projeto antes)  
  _Esperado:_ Primeiro passo: lista para escolher UM projeto; ao escolher, abre o formulário já ligado ao projeto (empresas sem projetos continuam com o formulário da obra)
- [ ] **T159** · `pv.c1.admin` — New bid: escolher tarefas em 'Tasks to bid' (lista + botão Add + grade)  
  _Esperado:_ A lista traz só as tarefas do Schedule marcadas como Subcontractor; Add põe a tarefa na grade (com início e dias) e ela sai da lista; Remove devolve para a lista; dá para adicionar várias; o 'Bid title' sugere o nome das tarefas enquanto você não digita o seu; sem tarefas de prestadora, aparece o aviso com o link para o cronograma
- [ ] **T160** · `pv.c1.admin` — New bid: uma tarefa que já tem concorrência aberta  
  _Esperado:_ Pode ser escolhida de novo (segunda rodada de preços)
- [ ] **T161** · `pv.c1.admin` — New bid: olhar o campo Scope  
  _Esperado:_ Editor de texto formatado já preenchido com o escopo do projeto; editar aqui não muda o escopo do projeto; há também o campo Notes (observações)
- [ ] **T162** · `pv.c1.admin` — New bid › Documents: olhar 'Project drawings'  
  _Esperado:_ Os arquivos de plantas do projeto aparecem marcados, com a lista de folhas e a observação da aba Plans em campo editável; ajustar a observação vale só para esta concorrência
- [ ] **T163** · `pv.c1.admin` — New bid: salvar e enviar para uma prestadora com conta e outra por link  
  _Esperado:_ As plantas vão com as observações; o escopo formatado aparece para quem recebe (convite e link) e na página da concorrência (Details)
- [ ] **T164** · `pv.c1.admin` — Concorrência antiga (escopo em listas Incluso/Excluso): abrir para editar  
  _Esperado:_ As listas aparecem dentro do editor de Scope e continuam sendo mostradas normalmente

## 17 Itens e preços (tela única)

- [ ] **T165** · `pv.p1.admin` — Itens: olhar a lista  
  _Esperado:_ Uma tela só com itens e preços: código, item, categoria, cost code, unidade, preço atual, desde quando e situação (Em dia, Desatualizado, Sem preço, Inativo); no topo, o cartão Markups; não existe mais o menu Preços
- [ ] **T166** · `pv.p1.admin` — Itens: usar a busca, o filtro de categoria, o de cost code e o de situação  
  _Esperado:_ A lista filtra na hora; os contadores da situação (Sem preço, Desatualizado, Inativos) batem com o que aparece; 'Ativos' é o padrão
- [ ] **T167** · `pv.p1.admin` — Itens › Novo item: criar com e sem preço inicial  
  _Esperado:_ Com preço, abre a aba Preços já com ele; sem preço, avisa que falta e o item aparece em 'Sem preço'
- [ ] **T168** · `pv.p1.admin` — Itens › abrir um item › aba Preços: registrar dois preços com datas diferentes  
  _Esperado:_ O histórico lista todos, com a variação em % sobre o anterior, a origem, o fornecedor e quem registrou; o mais recente vira o atual; nenhum preço é apagado
- [ ] **T169** · `pv.p1.admin` — Itens: item cujo preço vale desde mais de 12 meses  
  _Esperado:_ Aparece como Desatualizado e no filtro Desatualizado
- [ ] **T170** · `pv.p1.admin` — Itens › abrir um item › Deixar inativo (e depois Reativar)  
  _Esperado:_ Não existe botão de excluir; o inativo some da lista padrão, aparece em Inativos e não é oferecido em assemblies novos; o histórico de preços continua; reativar devolve o item
- [ ] **T171** · `pv.p1.admin` — Itens › aba Usado em  
  _Esperado:_ Lista os assemblies que usam o item
- [ ] **T172** · `pv.p1.admin` — Conta real: deixar um item inativo  
  _Esperado:_ Deixar inativo funciona na conta real (migração 0018 aplicada): o item some da lista padrão e continua inativo depois de recarregar
- [ ] **T173** · `pv.p1.admin` — Itens › Exportar › Excel  
  _Esperado:_ Baixa um .xlsx com a aba Items (preço atual) e a aba Price history (histórico completo)
- [ ] **T174** · `pv.p1.admin` — Itens › Exportar › CSV  
  _Esperado:_ Baixa um .csv com os itens e o preço atual, que abre no Excel com acentos corretos
- [ ] **T175** · `pv.p1.admin` — Itens › Importar › Baixar o modelo; preencher 1 item novo com preço, 1 item existente com preço diferente e 1 linha sem unidade; Conferir a planilha  
  _Esperado:_ A conferência mostra 1 novo, 1 preço novo e 1 erro com o número da linha; só grava ao clicar Importar; o preço antigo continua no histórico
- [ ] **T176** · `pv.p1.admin` — Itens › Exportar em Excel e Importar o mesmo arquivo  
  _Esperado:_ Diz 'Nada para importar': a planilha é igual ao catálogo

### 18 · Andamento e Gantt
- [ ] **T177** · `pv.p1.admin` — Projeto › Schedule › coluna % feito  
  _Esperado:_ Cada tarefa tem o % feito (0 a 100); fica salvo ao sair do campo; a barra da linha do tempo preenche o %
- [ ] **T178** · `pv.p1.admin` — Projeto › Schedule › tarefa com término já passado e % abaixo de 100  
  _Esperado:_ A tarefa aparece atrasada: nome e barra em vermelho; em 100% deixa de estar atrasada
- [ ] **T179** · `pv.p1.admin` — Menu › Gantt  
  _Esperado:_ Abre a página do Gantt no projeto mais urgente (atrasados primeiro), com a lista de projetos e o gráfico no tamanho da página
- [ ] **T180** · `pv.p1.admin` — Gantt › trocar o projeto na lista  
  _Esperado:_ O endereço muda (#/measure/gantt/<projeto>) e o gráfico passa a ser do projeto escolhido; a lista marca quem está Atrasado
- [ ] **T181** · `pv.p1.admin` — Gantt › Editar o cronograma / Linha do tempo › Tela inteira  
  _Esperado:_ Vai e volta entre a aba Schedule do projeto e a página do Gantt
- [ ] **T182** · `pv.p1.admin` — Início › Andamento dos projetos  
  _Esperado:_ Primeiro bloco do painel: uma linha por projeto com cronograma (atrasados primeiro) com a situação, a barra do feito e o tracejado do previsto para hoje, e a tarefa mais atrasada; o resumo conta atrasados/em dia/não iniciados/concluídos; cada linha abre o Gantt do projeto

### 19 · Daily por projeto
- [ ] **T183** · `pv.p1.admin` — Início (depois do login)  
  _Esperado:_ Três módulos: Daily, Takeoff e Settings; o Settings abre com o cabeçalho 'KORbuild / Settings', fora do Takeoff
- [ ] **T184** · `pv.p1.admin` — Takeoff › Novo projeto › seção Execução  
  _Esperado:_ Mapa com cerca (latitude, longitude, raio), 'Usar a localização atual' e dias de trabalho; tudo opcional; fica salvo e aparece em Editar projeto
- [ ] **T185** · `pv.p1.admin` — Takeoff › Editar projeto › situação Ganha › salvar  
  _Esperado:_ O projeto aparece no Daily em Projetos (menu) e em 'Projetos em execução'; ninguém cadastra obra
- [ ] **T186** · `pv.p1.admin` — Daily › Projetos › abrir o projeto  
  _Esperado:_ Resumo do projeto (contratante, endereço), link 'Abrir o projeto' para o Takeoff; sem 'Editar a obra' nem 'Nova obra'
- [ ] **T187** · `pv.p1.admin` — Daily › Hoje › projeto › Adicionar nova RDO › preencher e enviar  
  _Esperado:_ O diário é criado e enviado como antes; sem local no mapa, o clima avisa para marcar à mão
- [ ] **T188** · `pv.p1.admin` — Daily › Painel  
  _Esperado:_ RDOs de hoje, aguardando aprovação, 'Projetos com RDO atrasado' e 'Farol dos projetos' com os projetos em execução
- [ ] **T189** · `pv.p1.admin` — Bids › fechar uma concorrência de projeto ganho (vencedora com conta)  
  _Esperado:_ Na vencedora, o projeto fica Ganha e a obra dela nasce sozinha, ligada à obra da contratante; o convite mostra 'Você venceu' e 'Abrir a obra'; o diário dela chega para a contratante aprovar
- [ ] **T190** · `pv.p1.admin` — Conta real (depois da migração 0020): Editar projeto › Ganha  
  _Esperado:_ A obra aparece no banco (projetos.obra_id preenchido) e no Daily
- [ ] **T191** · `pv.p1.encarregado` — Daily › projeto ganho › Nova RDO › Atividades  
  _Esperado:_ A atividade tem 'Tarefa do cronograma' com as tarefas do projeto (Takeoff › Schedule) abaixo de 100% e, ao escolher uma, o campo '% feito da tarefa (hoje: n%)'
- [ ] **T192** · `pv.p1.admin` — Daily › Painel › RDO recebido › Aprovar e lacrar  
  _Esperado:_ O relatório mostra 'Cronograma: <tarefa> → n%'; depois de aprovar, a aba Schedule e o Gantt do projeto mostram o % feito informado, e o Início atualiza 'Andamento dos projetos'
- [ ] **T193** · `pv.p1.admin` — Daily › projeto ganho (página do projeto)  
  _Esperado:_ 'Etapa atual' traz as tarefas do cronograma em andamento hoje; o sininho avisa 'Tarefa atrasada' com atalho para o Gantt quando uma tarefa passou do fim sem 100%
- [ ] **T194** · `pv.p1.admin` — Conta real (depois da migração 0021): aprovar um diário que aponta uma tarefa  
  _Esperado:_ projetos.cronograma recebe o pct e o avanço (data, antes, pct, rdoNumero, por); o Gantt reflete depois de recarregar
