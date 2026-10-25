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
