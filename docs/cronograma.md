# KORbuild — Cronograma da obra

> Decidido em outubro de 2026. **A prestadora monta** o cronograma do serviço dela (framing, siding…) dentro da obra; **a construtora visualiza** a versão publicada. Sem dependências entre etapas nesta versão. Exporta para Excel com layout profissional.

## 1. Por que existe

Hoje a obra só tem início, prazo e uma "etapa atual" em texto. O cronograma liga os módulos:

| Hoje | Com o cronograma |
| --- | --- |
| Avanço físico digitado à mão no Crew (Custos › Obras) | O % sai das etapas, informado no Daily |
| "Etapa atual" em texto solto | A etapa atual sai do cronograma (as que estão em andamento) |
| Ninguém avisa que uma etapa atrasou | Sininho avisa quando uma etapa passa do fim sem estar concluída |
| A construtora pergunta por telefone "como está?" | A construtora vê o cronograma publicado pela prestadora |

**Não é** um MS Project: sem caminho crítico, dependências ou nivelamento de recursos.

## 2. Regras

| # | Regra |
| --- | --- |
| CR-01 | Cada **etapa** tem nome, início, fim (datas), responsável (opcional) e % concluído (0 a 100). A ordem das etapas é a da lista. |
| CR-02 | Quem monta é quem tem a permissão **"Montar o cronograma da obra"** (Administrador e Gestor de obras). Quem preenche o RDO vê as próximas 3 semanas. |
| CR-03 | **Linha de base**: um retrato das datas, salvo com data, quem e motivo. A primeira é salva na primeira vez; as próximas só por decisão ("Salvar nova linha de base"). O desvio de cada etapa é medido contra a última linha de base. Nada é apagado. |
| CR-04 | **% concluído pelo Daily**: cada atividade do RDO pode apontar uma etapa do cronograma e o % concluído. Quando o RDO é **aprovado**, o % vai para a etapa (com histórico: data, % e o RDO de origem). O escritório também pode ajustar o % à mão (fica no histórico). |
| CR-05 | **Situação** da etapa: *concluída* (100%), *atrasada* (passou do fim e não chegou a 100%), *em risco* (andamento real 15 pontos ou mais abaixo do planejado para hoje), *em andamento*, *não iniciada*. |
| CR-06 | **Avanço da obra** = média do % das etapas, ponderada pela duração. O **planejado para hoje** usa a mesma conta com as datas da linha de base. |
| CR-07 | **Próximas 3 semanas** (look-ahead): etapas em andamento ou que começam/terminam nos próximos 21 dias. Aparece na tela da obra no celular do encarregado. |
| CR-08 | **Sininho**: para quem acompanha, uma notificação por etapa atrasada. |
| CR-09 | **Publicar para o contratante**: a prestadora decide quando a construtora vê. A publicação é um retrato (versão) do cronograma naquele momento. A construtora vê a última versão publicada, com a data, e não edita nada. |
| CR-10 | A obra da prestadora fica **ligada** à obra da construtora (na versão real, a construtora convida a prestadora para a obra; no protótipo, a ligação vem nos dados de exemplo). |
| CR-11 | **Exportar Excel** (.xlsx de verdade): logo e dados da empresa no cabeçalho, obra e contratante, data de emissão, tabela das etapas (datas, duração, %, situação, desvio) e as barras do Gantt nas células, semana a semana, com legenda. Funciona sem internet. |

## 3. Telas

| Tela | Rota | Quem |
| --- | --- | --- |
| Cronograma da obra (lista + Gantt + linha de base + publicar + Excel) | `#/daily/obras/<id>/cronograma` | Prestadora (escritório) |
| Próximas 3 semanas | dentro de `#/daily/campo/obra/<id>` | Encarregado |
| Atividade do RDO → etapa e % | editor do RDO | Encarregado |
| Cronograma publicado pela prestadora (só leitura + Excel) | `#/daily/obras/<id>/cronograma/recebido/<publicação>` | Construtora |

## 4. Dados de exemplo

A Northfield (prestadora) tem o cronograma do framing e siding do Residencial Jardim das Flores, com 7 etapas, linha de base salva e uma publicação. Uma etapa está atrasada e outra está em risco, para mostrar os alertas. A Ana (construtora) vê a versão publicada na obra dela.

## 5. Próximos passos (fora desta versão)

- Ligação simples "começa depois de" entre etapas.
- Quantidades do Measure como meta da etapa ("45 de 180 cu yd").
- Comparar horas do Crew por etapa com o % concluído.
- Importar de MS Project / Excel.
- Na versão real (banco de dados), a publicação vai para o servidor e a construtora recebe aviso no sininho.
