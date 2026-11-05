# Estresse do Takeoff: muitos desenhos antes de liberar

**Objetivo:** provar que o Takeoff aguenta projetos grandes (centenas ou milhares de medições) sem perder dado, sem errar conta e sem travar, antes de liberar para o parceiro e para o domínio de produção.

**Teste:** `tests/estresse-takeoff.test.mjs`. Cria, pela tela, a empresa de teste e o projeto com a planta de 3 folhas (escalas conferidas) e, em volume, N condições de área com M medições cada (retângulos de áreas conhecidas, alternando os dois assemblies), mais condições de linha e de contagem. As medições são criadas pelas funções do app (`measure.js`), que as levam ao banco pelo mesmo caminho do uso real.

## O que ele confere
1. Tudo chegou ao banco (condições e medições, contagem exata) e as escalas das folhas também.
2. **Conta independente:** a área medida, o custo (material + mão de obra), as horas e o preço de venda (overhead e lucro das margens) que o app calcula batem com a conta feita no próprio teste a partir dos retângulos (precisão de centavos, arredondamento por condição como na compra).
3. Recarregar a página traz tudo do banco idêntico (mesmas condições, medições, custo, venda e área).
4. O desenho da folha, a lista de materiais (com as horas), a proposta e o Gantt abrem em tempo razoável com tudo desenhado.
5. "Gerar a partir das etapas" cria as tarefas com a etapa de cada uma, e o valor total do Gantt bate com a conta independente; nenhuma etapa medida fica fora do cronograma.
6. **Custo de cada clique** com o projeto cheio (média dos últimos 200 cliques; limite 100 ms local e 150 ms no Supabase real).
7. Nenhum erro de JavaScript.

## Como rodar
```
python3 -m http.server 8123 &
bash tools/supabase-local.sh
node tests/estresse-takeoff.test.mjs --condicoes=40 --medicoes=30 --relatorio     # ~1.700 medições
node tests/estresse-takeoff.test.mjs --condicoes=120 --medicoes=60 --relatorio    # ~10.000 medições (leva uns 2 minutos)
```
No Supabase de verdade (apaga tudo no fim; `--manter` guarda):
```
$env:SUPABASE_ACCESS_TOKEN = "sbp_…"
node tests/estresse-takeoff.test.mjs --real --condicoes=40 --medicoes=30 --relatorio
Remove-Item Env:SUPABASE_ACCESS_TOKEN
```
Comece pelo volume de 40 × 30 no banco real; o de 120 × 60 leva vários minutos pela rede.

## Resultados (banco local, 05/11/2026)
| Volume | Medições | Resultado | Clique médio (fim) | Abrir o projeto cheio | Desenho da folha |
|---|---|---|---|---|---|
| 6 × 5 | 50 | 27/27 | – | 0,7 s | 1,1 s |
| 40 × 30 | 1.680 | 27/27 | – | 1,2 s | 1,1 s |
| 120 × 60 | 10.080 | 28/28 | 11,7 ms | 1,4 s | 1,4 s |

## Limites conhecidos
- **Rajada sem pausa:** criar milhares de medições num único bloco de script, sem ceder o controle ao navegador, derrubou a aba (memória). Isso não acontece no uso normal (uma medição por clique); o teste cede o controle entre as condições. Se um dia houver "importar medições" ou "copiar condição com tudo", esse caminho precisa de lote e pausa.
- **O tempo total cresce mais que o número de medições** (10.080 medições levaram 100 s para criar, contra 4 s para 1.680): cada gravação serializa o projeto inteiro. O custo de cada clique continua baixo (12 ms), mas projetos de dezenas de milhares de medições merecem outra estratégia (gravar só o que mudou).
- Não cobre: exportar a proposta em PDF com volume, vários usuários medindo o mesmo projeto ao mesmo tempo, e planta de muitas páginas (a de teste tem 3).
- O banco local não tem latência de rede; os limites do `--real` são mais folgados por isso.
