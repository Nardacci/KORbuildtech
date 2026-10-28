# F02 · Projeto do zero até "Liberar para obra"

**Objetivo:** provar o caminho inteiro do Takeoff: criar o projeto, subir a planta, definir a escala, medir, aplicar assembly, ver materiais e preço, montar o cronograma, emitir a proposta e liberar para obra. É o fluxo que coloca o projeto no Daily (F03 continua dele).
**Roda em:** protótipo (`?demo`, usuário Tom Reilly, Northfield) e conta real local (`pv.p1.admin`).
**Pré-condições:** massa da 1ª versão carregada; catálogo com pelo menos um item de material, um de mão de obra ligado a uma função com valor hora (F01) e um assembly que use os dois; a planta de exemplo `assets/plantas/casa-modelo.pdf` (1/4" = 1'-0").
**Dados fixos:** projeto **"Garagem Pereira"**, contratante o primeiro cliente da lista, Bow, NH; tarefa **"Demolição"** começando hoje, 3 dias, nós; tarefa **"Pintura"** em 7 dias, 4 dias, prestadora.

| # | Quem | Onde | O que faz | Esperado |
|---|---|---|---|---|
| 1 | admin | Takeoff › Projetos › Novo projeto | Nome, contratante, cidade/estado, tipo; salvar | Abre a aba Plantas do projeto; na lista, situação "Em orçamento" |
| 2 | admin | Projeto › Visão geral | — | "0 de 6 passos"; cartão Obra "Em análise", botão "Liberar para obra" desabilitado e "Falta terminar: enviar as plantas, definir a escala…, decidir quem faz…, medir…, montar o cronograma" |
| 3 | admin | Projeto › Plantas | Enviar `casa-modelo.pdf` | 1 folha "A-101" sem escala; passo 1 feito |
| 4 | admin | Projeto › Takeoff › folha › Escala | Escolher 1/4" = 1'-0" e conferir uma cota conhecida (40'-0") | Etiqueta "conferida"; passo 2 feito |
| 5 | admin | Projeto › Takeoff | Condição de área "Piso da garagem" com o assembly da massa; medir o retângulo da planta | A condição mostra a área medida; passo 4 feito |
| 6 | admin | Projeto › Materiais | — | Lista com material e mão de obra; a hora de mão de obra com o preço vindo da função (valor + encargos); custo e preço de venda com as margens vigentes |
| 7 | admin | Projeto › Cronograma | "Gerar a partir das etapas" e ajustar: Demolição (hoje, 3 d, nós), Pintura (+7 d, 4 d, prestadora) | 2 tarefas com término calculado; passos 3 e 5 feitos |
| 8 | admin | Projeto › Visão geral | — | "5 de 6 passos"; cartão Obra "Tudo pronto…", botão habilitado (a proposta é opcional) |
| 9 | admin | Projeto › Proposta | Emitir | Número P-AAAA-NNN, total = preço de venda dos materiais; passo 6 feito, "6 de 6 passos" |
| 10 | admin | Projeto › Visão geral › Liberar para obra | Clicar | Etiqueta "Liberado para obra" com data e quem; "Abrir no Daily" e "Voltar para análise"; conta real: `projetos.liberado_em` preenchido e `obra_id` apontando a obra criada |
| 11 | admin | Daily › Projetos em execução | — | "Garagem Pereira" na lista, "Etapa atual: Demolição" |
| 12 | admin | Projeto › Visão geral › Voltar para análise | Clicar | Some do Daily; liberar de novo traz a mesma obra (uma só) |
| 13 | admin | Início | — | "Andamento dos projetos" lista Garagem Pereira em dia (0% feito, 0% previsto no 1º dia) |

**Desfaz (conta real):** apagar o projeto criado e a obra dele (`delete from obras where projeto_id = …; delete from projetos where id = …`).
