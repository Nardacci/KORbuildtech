# Situação do protótipo

O que é simulado no protótipo hoje, e o que vem depois.

O protótipo (a demonstração com dados de exemplo) mostra o produto funcionando. Ao lado dele, a **conta de verdade** já roda o Measure no banco de dados na nuvem e está em homologação. Esta página diz o que é real hoje e o que ainda é simulado na demonstração.

## Já funciona no banco de dados (conta de verdade)

| Item | Como funciona hoje |
|---|---|
| Projetos, plantas e medição | Projetos, plantas em PDF (no armazenamento da empresa na nuvem), escala, condições com as medições e typicals são gravados enquanto você trabalha, no computador com internet; abrir em outro computador mostra a mesma medição. Duas pessoas na mesma condição: a segunda é avisada e vê a versão do banco. |
| Catálogo, preços e margens | Itens e assemblies da própria empresa; preços e margens são versões com data de vigência que nunca mudam nem somem, com o autor registrado. Dinheiro só para quem tem a permissão do catálogo ou vê custos. |
| Proposta | As propostas emitidas são numeradas pelo banco (P-AAAA-NNN, por empresa e ano) e congeladas; ficam guardadas mesmo que o projeto seja excluído. |

## Simulado hoje (na demonstração)

| Item | No protótipo | No produto |
|---|---|---|
| Onde ficam os dados e os PDFs | No navegador (os PDFs no armazenamento do navegador). | O armazenamento na nuvem da empresa, compartilhado pelos orçamentistas — **já funciona** na conta de verdade. |
| Envio de e-mail (cotações, propostas) | O seu programa de e-mail abre com a mensagem pronta; você anexa o PDF. | Enviado pelo KORbuild, com o PDF anexo e o registro do que foi enviado. |
| PDF do pedido de cotação e da proposta | Impresso pelo navegador (**Salvar como PDF**). | Gerado no servidor, pronto para baixar. |
| Catálogo, preços e margens | Itens, preços e margens de exemplo para a demonstração — **não são referência de mercado**. | O catálogo e os preços de fornecedor de cada empresa. |
| Precisão do clique | Cada clique cai num pixel inteiro da tela; no zoom normal, cerca de 3/4" por ponto. A conferência da escala mostra o erro, e um zoom maior o reduz. | Atração para as linhas dos PDFs vetoriais. |

## O que vem depois

| Item | Observações |
|---|---|
| Orçamento de mão de obra para o Crew | As horas estimadas por etapa viram o orçamento de mão de obra da obra. |
| Avanço para o Daily | As quantidades medidas como referência do avanço físico. |
| Measure no celular | Só consulta: projetos, quantidades, materiais, listas para cotação e propostas emitidas, com PDF e e-mail. Desenhar continua no computador. |
| Mais assemblies e serviços | Telhado, drywall, concreto e outros, com as fórmulas de cada serviço. |
