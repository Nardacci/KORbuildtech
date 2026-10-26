# Projeto como espaço de trabalho (Takeoff)

> Decidido em 25–26/10/2026 com o dono do produto. Mockups: canvas "Projeto — espaço de trabalho". Código: `js/projeto-espaco.js`, `js/measure-telas.js`.

**Ideia:** o projeto é um conjunto de informações que a empresa controla, gerencia e informa. Tudo dele fica na mesma tela, separado por abas.

## Criar
1. **Novo projeto** pede só o essencial: nome, cliente (quem pediu a proposta), prazo da proposta e local. Tipo de obra, estimador, dono da obra e obra vinculada ficam para "Editar projeto".
2. Ao criar, abre a aba **Plans** (enviar os PDFs).

## Abas
| Aba | O que mostra |
|---|---|
| Overview | Resumo (prazo, andamento, folhas e condições, proposta), o checklist "Set up this project" com 6 passos, detalhes e próximos marcos |
| Plans | Envio de PDF, folhas com escala, typicals |
| Scope & delivery | Padrão de execução do projeto e, por etapa (cost code), **quem faz**: Self-perform, Subcontract ou Decide later |
| Takeoff | Quantidades por condição |
| Materials | Materiais e mão de obra (e a lista para cotação) |
| Schedule | Cronograma preliminar (tarefas com início, duração e término) e marcos |
| Bids | Licitações que nasceram do projeto |
| Proposal | A proposta (tela própria) |

## Regras
- **EP-01** Etapa própria (Self-perform): tem medição detalhada, materiais e cotação de fornecedores. O custo é da empresa.
- **EP-02** Etapa subcontratada: sem takeoff por padrão ("measure quantities" opcional); gera pedido de propostas (Bids); o preço da prestadora entra na proposta.
- **EP-03** O padrão do projeto (We do it all / Mixed / We subcontract it all) ajusta todas as etapas de uma vez; mudar uma etapa à mão volta o padrão para o que combina.
- **EP-04** As etapas nascem dos assemblies aplicados nas condições, ou são adicionadas à mão.
- **EP-05** O cronograma preliminar faz parte do projeto e da proposta. "Generate from cost codes" cria uma tarefa por etapa. No ganho, é confirmado ou ajustado e vira a base da obra (fase seguinte).
- **EP-06** O checklist tem 6 passos: plantas, escala, quem faz, medição, cronograma, proposta. O cronograma é opcional.

## Banco de dados
Os campos `entrega` e `cronograma` dependem da migração 0016 (`supabase/pendentes/`). **Enquanto não for aplicada**, na conta de verdade eles ficam só no aparelho (a tela avisa). No protótipo (`?demo`) funcionam normalmente.

## Falta
- Confirmar o cronograma no ganho e levá-lo para a obra.
- Prazo de execução por etapa nas respostas das prestadoras (alimenta o cronograma).
- As telas "Lista para cotação" e "Proposta" ainda não têm a faixa de abas.

## Cronograma na 1ª versão (decisão do dono: opção A)

- O **cronograma do projeto** (aba Schedule: tarefas, marcos e a confirmação ao ganhar) existe na 1ª versão.
- O **cronograma da obra** (Gantt, avanço pelo Daily, linha de base da obra) é outro módulo e fica oculto na 1ª versão, com Daily e Crew.
- Ao ganhar, o dono confirma o cronograma no projeto; a base fica guardada no projeto (`cronograma.confirmado`). O cadastro da obra da 1ª versão não tem cronograma, então a base **não** passa para a obra por ora.
- Na versão completa, ao criar a obra a partir do projeto ganho, a opção "Cronograma confirmado no projeto" já vem escolhida e cria as etapas e as datas da obra. Na conta com banco, isso depende de uma função nova no servidor (não feita).
- Quando o módulo de obras for liberado, a base confirmada passa para a obra sem refazer nada.

## Estrutura das abas (revisão do dono, 26/10)

Overview · Plans · Takeoff · Materials · Schedule · Project summary.

- **Plans:** só o arquivo e as especificações de cada desenho (nome da folha, arquivo, escala, observação) e o envio do PDF (com referência opcional do arquivo). Sem botão de abrir/medir.
- **Takeoff:** "quem faz cada parte" (antes Scope & delivery) no topo, o cartão **Measure** (escolhe a planta e abre a tela de medição, onde se troca de planta), as quantidades e os typicals.
- **Materials** e **Schedule:** como antes.
- **Project summary** (última): situação, proposta, custo, margem, quem faz cada parte e de onde vem o preço, resumo do cronograma, concorrências do projeto e a saída para a proposta.
- **Bids:** não há aba; as concorrências ficam no menu **Bids** e, em cada etapa subcontratada, o link New bid / Open bid. Os endereços antigos `/scope` e `/bids` abrem o Takeoff.

## Padrão de execução (decisão do dono, 26/10)

Os três cartões "Como este projeto será executado?" (Fazemos tudo / Misto / Subcontratamos tudo) foram **retirados**: não ajudam a decidir, só pedem uma escolha cedo. Vale a decisão por etapa, na tabela "Quem faz cada etapa?" do Takeoff. Para quem faz tudo sozinho, o botão **Mark all as self-performed** marca todas de uma vez. O campo interno `entrega.padrao` continua existindo, mas é calculado a partir das etapas.

## Linha do tempo (Schedule)

A aba Schedule abre com uma **Timeline** (estilo Gantt, sem dependências): uma linha por tarefa e por marco, eixo de meses e dias, linha tracejada de hoje, barras por quem faz (verde = nós, âmbar = prestadora, cinza = a decidir), losangos nos marcos e detalhe ao passar o mouse. A tabela de edição fica logo abaixo. O Gantt completo da obra (linha de base, avanço pelo Daily) continua sendo o módulo de cronograma da versão completa.

## Tarefas num só lugar (decisão do dono, 26/10)

As **tarefas** (antes "etapas"/cost codes) são cadastradas **só no Schedule**, na hora de montar o cronograma, e podem ser editadas a qualquer momento. Cada tarefa tem **Who** (Us, Subcontractor, To decide), início e duração. O Takeoff não cadastra etapas nem pergunta quem faz: tem só o cartão Measure, as quantidades e os typicals. Tarefa de Subcontractor mostra **Request bids** (ou o resumo das propostas) e a Timeline pinta a barra de âmbar. "Generate from cost codes" cria as tarefas a partir dos assemblies das medições. O Project summary lê as mesmas tarefas. O campo antigo `entrega` fica sem uso.
