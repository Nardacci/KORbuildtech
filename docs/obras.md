# KORbuild — Cadastro de obras

> Decidido em outubro de 2026. A **obra é da empresa**, não de um módulo: Daily (diário e cronograma), Crew (ponto, cerca e custos) e Measure (projeto ganho) usam o mesmo cadastro. O **cronograma pertence à obra** (docs/cronograma.md).

## 1. Onde

| Onde | O quê |
| --- | --- |
| Daily › Obras | Botão **Nova obra** e **Editar** na tela da obra (atalhos para o cadastro) |
| Settings › Obras | A lista completa (em andamento, paralisadas, concluídas), criar e editar |
| Settings › Modelos de etapas | Os modelos de cronograma da empresa |
| Measure › projeto **Ganha** | Botão **Criar obra a partir deste projeto** |

## 2. Regras

| # | Regra |
| --- | --- |
| OB-01 | Quem cadastra e edita: a permissão **"Cadastrar e editar obras"** (Administrador e Gestor de obras; ajustável nos perfis). |
| OB-02 | Campos: nome\*, contratante\* (e dono, se for outro), endereço, cidade\*, estado\*, ZIP, **local no mapa\*** (latitude/longitude), **raio da cerca** do ponto (50 a 2.000 m), início\* e prazo\*, **responsável pelo diário**\*, **dias de trabalho**\*, situação. |
| OB-03 | O local vem do mapa (clique), da localização atual do aparelho (cadastro feito no canteiro) ou digitado. Ele serve para a cerca do ponto (Crew), o clima do diário e o mapa do dia. |
| OB-04 | **Situação**: *em andamento*, *paralisada* ou *concluída*. Só obra **em andamento** cobra diário, aparece no celular do campo e no ponto. Paralisada e concluída continuam no escritório, com o histórico. Nada é apagado. |
| OB-05 | Toda criação e alteração vai para a **auditoria** (quem, quando, o quê). |
| OB-06 | **Modelo de etapas**: lista de etapas com a **parte do prazo** (%) de cada uma. Ao criar a obra, escolhe-se um modelo (ou nenhum): as etapas entram em sequência, dividindo o período entre o início e o prazo, e a primeira linha de base é salva. Depois tudo se ajusta no cronograma. Obra sem etapas também pode aplicar um modelo pela tela do cronograma. |
| OB-07 | **Do Measure**: em projeto *Ganha* sem obra ligada, o botão leva ao cadastro já preenchido (nome, endereço, contratante, dono). Ao salvar, projeto e obra ficam ligados (o projeto mostra a obra; a obra mostra o projeto). |
| OB-08 | Obra recebida de uma construtora (ligada por convite, docs/cronograma.md CR-10) continua vindo pronta: o cadastro é para as obras da própria empresa. |

## 3. Dados (por empresa)

```
obras[]: { id, nome, contratanteId, donoId, endereco, municipio, estado, zip,
           cidade,                // texto pronto "Manchester, NH 03104" (telas antigas)
           lat, lon, cerca: { lat, lon, raio },
           inicio, prazo, responsavelId, diasTrabalho: [1..6], situacao,
           projetoId?, vinculo?, criadoEm, alteradoEm }
modelosCronograma[]: { id, nome, etapas: [{ nome, pct }] }   // pct somam 100
```

## 4. Próximos passos (fora desta versão)

- Busca do endereço no mapa (geocodificação) — hoje: clique no mapa ou localização atual.
- Orçamento de mão de obra da obra direto no cadastro (hoje fica em Crew › Custos).
- Convite da construtora para a prestadora (obra ligada) — vem com o banco de dados.
