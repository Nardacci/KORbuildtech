# KORbuild — Banco de dados (Supabase)

> Especificação de outubro de 2026. Projeto Supabase `gbdmtgephszxhaprpiss`. O banco foi limpo do sistema antigo (Match) em 12/10/2026: backup da estrutura em `supabase/backup/`, remoção em `supabase/remocao-match.sql`, ajuste do cadastro em `supabase/ajuste-criar-conta.sql`.
>
> **Situação:** fatias 1 a 6 no banco. Fatia 1 (`0001`–`0003`): a conta, a empresa, usuários, perfis e convites. Fatia 2 (`0004`): Meu perfil e os cadastros do Settings (obras, funcionários, contatos, regras), em `js/cadastros.js` e `js/cadastros-telas.js`. Fatia 3 (`0005` e a função `diario-publico`): o Daily, com as telas do protótipo funcionando sobre um espelho do banco no aparelho (`js/espelho.js`) e a sincronização (`js/sincronizacao.js`), com e sem internet; aprovação entre empresas, lacre no banco e link do cliente. Testes: `tests/conta.test.mjs` e `tests/daily.test.mjs --real` (contra o Supabase), `tests/daily.test.mjs` (contra o Supabase local: `tools/supabase-local.sh`), `tests/oficial-simulado.test.mjs` e `supabase/testes/` (regras de acesso; `tools/banco-local.sh`). Fatia 4 (`0006`): o Crew — equipes, batidas (só `insert`), localizações com o app aberto, aprovação da semana, orçamento e a presença das prestadoras para a construtora; as telas do protótipo sobre o espelho (`js/espelho-crew.js`, `js/crew-oficial.js`, `js/localizacao.js`), com e sem internet; teste `tests/crew-oficial.test.mjs`. Fatia 5 (`0007`): o cronograma — etapas, avanços, linhas de base e publicações por versão; o RDO aprovado leva o andamento ao cronograma; telas do protótipo sobre o espelho (`js/cronograma-oficial.js`); teste `tests/cronograma-oficial.test.mjs`. Fatia 6 (`0008`): o Measure — projetos, plantas no Storage, condições com as medições, typicals, catálogo, preços, margens e propostas emitidas; as telas do protótipo gravam no espelho e `js/measure-oficial.js` leva cada mudança ao banco; teste `tests/measure-oficial.test.mjs`. Faltam as concorrências (7) e as notificações (8) (§9). O protótipo (`?demo`) continua no navegador e não muda.

## 1. Princípios

| # | Princípio |
| --- | --- |
| BD-01 | **Uma empresa = uma conta (tenant).** Toda tabela de negócio tem `empresa_id` e só é lida por quem é membro daquela empresa. Uma empresa nunca lê a tabela de outra diretamente. |
| BD-02 | **RLS em todas as tabelas, sem exceção.** O app usa só a chave pública (anon) e o login do usuário; a chave de serviço fica no servidor (funções de borda e jobs). |
| BD-03 | **Entre empresas, só pelo que as liga** (`vinculo` de obra, convite de concorrência, publicação de cronograma) e sempre por **funções do banco** (`security definer`) que devolvem só o combinado: presença e horas sem valores (HS-10), o diário para aprovar (HS-11), o cronograma publicado (SET-057), o convite sem os outros convidados (CO-04). Nada de política RLS que abra a tabela de uma empresa para outra. |
| BD-04 | **O passado não se reescreve.** Valor hora, encargos, regras de jornada, margens e preços são tabelas de **versões com vigência** (`desde`); batidas de ponto, propostas emitidas, diários aprovados, mensagens e publicações só recebem `insert`. Corrigir é inserir de novo. |
| BD-05 | **Auditoria no banco.** Toda mudança de cadastro, valor, regra, perfil ou acesso vai para `auditoria` (antes, depois, quem, quando, motivo), por gatilho, sem depender do app. |
| BD-06 | **Tipos:** `uuid` em toda chave; datas de calendário em `date` e instantes em `timestamptz`; dinheiro em `numeric(12,2)`; medidas do Measure em polegadas (`numeric`), como no protótipo (MSR-001). Listas configuráveis e retratos congelados (diário lacrado, proposta emitida, linha de base, publicação) em `jsonb`; o que se filtra ou soma vira coluna. |
| BD-07 | **Nada fixo no código** (SET-001): prazos do diário, raio padrão da cerca, intervalos do GPS e alertas de custo viram colunas de `empresas.configuracao` (`jsonb` com valores padrão). |
| BD-08 | **Offline primeiro, como hoje.** O celular continua gravando no aparelho (IndexedDB) e sobe quando há sinal. Cada registro criado no campo leva um `id` gerado no aparelho e um `criado_no_aparelho_em`; subir de novo o mesmo `id` não duplica (`on conflict do nothing`). |
| BD-09 | **Arquivos no Storage**, nunca no banco: logos, fotos do diário, plantas (PDF), desenhos e PDFs de concorrência, propostas. O caminho começa sempre pelo `empresa_id` e a política do bucket segue a da tabela. |

## 2. Contas, empresas e acesso

| Tabela | Colunas principais | Observações |
| --- | --- | --- |
| `empresas` | `id`, `nome`, `razao_social`, `sigla`, `ein`, `atuacao` (prestadora · construtora · ambas), `especialidades`, endereço, `telefone`, `email`, `site`, `licencas`, `seguros`, `termos_proposta`, `logo_path`, `plano` (`jsonb`: nome, status, teste_ate, limite_obras), `modulos text[]`, `configuracao jsonb` (BD-07), `criada_em` | Uma linha por cliente. `atuacao` decide o que aparece (HS-09). |
| `membros` | `empresa_id`, `user_id` (→ `auth.users`, **único**), `perfil_id`, `funcionario_id`, `nome`, `cargo`, `telefone`, `ativo`, `ultimo_acesso` | O "usuário" do protótipo. **Uma pessoa pertence a uma empresa** (decisão de outubro de 2026) e pode estar em várias obras dela (`alocacoes`, §4). |
| `perfis_acesso` | `empresa_id`, `id`, `nome`, `descricao`, `sistema`, `permissoes text[]` | Os perfis da empresa (Administrador travado, Gestor, Encarregado, Trabalhador + os criados). O **catálogo** de permissões fica no código, como hoje. |
| `convites_usuario` | `empresa_id`, `email`, `perfil_id`, `funcionario_id`, `token_hash`, `expira_em`, `aceito_em` | O convite por e-mail para entrar na empresa (hoje: "Novo usuário" sem e-mail). |
| `admins_plataforma` | `user_id` | Quem administra o KORbuild (planos, empresas, valores padrão). É a área de administração que fica num endereço à parte, **por último** (decisão de outubro de 2026). |

**Entrar e criar a conta:** `auth.users` guarda só o login. Quem se cadastra cria a empresa por uma função `criar_empresa(dados)`, que grava a empresa, os quatro perfis padrão e o primeiro membro como Administrador, numa transação. Quem chega por convite entra em `membros` ao aceitar.

## 3. Cadastros da empresa (Settings)

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `funcionarios` | `empresa_id`, `nome`, `codigo`, `funcao`, `admissao`, `classificacao` (w2 · 1099), `flsa`, `situacao`, `desligamento`, `telefone`, `emergencia`, `aviso_gps_em`, `certificacoes jsonb` ([{nome, validade}]); `equipe_id` entra com as equipes (fatia 4) | SET-010 a SET-016. SSN e documentos não entram (SET-012). 1099 é sempre isento. Cadastro com o valor da admissão por `criar_funcionario(dados, valor)`. |
| `funcionario_valores` | `empresa_id`, `funcionario_id`, `desde`, `valor`, `motivo`, `por`, `em` | Só `insert` (SET-013); lido só por quem tem `settings.funcionarios` ou `crew.custos`. Não começar dentro de semana aprovada (SET-014) entra na fatia 4, com `aprovacoes_semana`. |
| `encargos_versoes` | `empresa_id`, `desde`, `itens jsonb`, `motivo`, `por`, `em` | Só `insert`, da semana atual em diante, no fuso da empresa (`configuracao.fuso`, padrão Nova York) (SET-021). Lido só com `settings.regras` ou `crew.custos`. |
| `regras_jornada_versoes` | `empresa_id`, `desde` (segunda-feira), `semanal`, `diaria`, `intervalo` (`jsonb`), `nome`, `nota`, `motivo`, `por`, `em` | SET-022, SET-023. |
| `contatos` | `empresa_id`, `nome`, `pessoa`, `papeis text[]`, endereço, `email`, `telefone`, `etapas text[]`, `notas`, `conta_empresa_id` | `conta_empresa_id` = a empresa do contato que tem conta no KORbuild (o `contaId` do protótipo). Nome único na empresa; `etapas` só no fornecedor. |

As listas configuráveis (funções, equipamentos, ocorrências) entram quando o módulo que as usa for para o banco. **Referências entre cadastros ficam na mesma empresa** por chaves estrangeiras compostas (`empresa_id`, `id`). **Meu perfil:** cada um muda o próprio nome e telefone por `atualizar_meu_perfil(nome, telefone)`; idioma, e-mail e senha ficam no Auth.
| `auditoria` | `empresa_id`, `em`, `por` (user_id e nome), `area`, `descricao`, `antes`, `depois`, `motivo` | Reaproveita a tabela que ficou, com `empresa_id` a mais (§7). |

## 4. Obras, Daily e cronograma

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `alocacoes` | `empresa_id`, `obra_id`, `membro_id` ou `funcionario_id`, `papel`, `desde`, `ate` | Quem trabalha em quais obras: uma pessoa em N obras. Base para as permissões por obra (o encarregado vê só as dele). Fatia 2. |
| `obras` | `empresa_id`, `nome`, `contratante_id`, `dono_id` (→ `contatos`), endereço, `municipio`, `estado`, `zip`, `cerca` (lat, lon, raio), `inicio`, `prazo`, `responsavel_id` (membro), `dias_trabalho int[]`, `situacao`, `projeto_id`, **`vinculo_empresa_id`, `vinculo_obra_id`**, `concorrencia_id` | O `vinculo` liga a obra da contratada à obra de quem contratou (HS-05, CO-14). |
| `rdos` | `empresa_id`, `obra_id`, `data`, `numero`, `status` (rascunho · enviado · ajuste · aprovado), `autor`, `conteudo jsonb` (clima, equipe, equipamentos, atividades, ocorrências, observações), `enviado_em`, `aprovado_em`, `aprovado_por`, `aprovado_por_empresa`, `hash_documento`, `codigo` | Aprovado = lacrado: o gatilho recusa `update` depois da aprovação. Quem aprova pode ser de outra empresa (HS-11): só pela função `aprovar_rdo(id)`. |
| `rdo_fotos` | `rdo_id`, `path` (Storage), `legenda`, `tirada_em`, `lat`, `lon`, `fonte_gps`, `precisao`, `largura`, `altura`, `tamanho`, `hash_original` | |
| `rdo_historico` | `rdo_id`, `em`, `quem`, `acao` | Só `insert`. |
| `cronograma_etapas` | `empresa_id`, `obra_id`, `nome`, `inicio`, `fim`, `responsavel_id`, `pct`, `ordem` | |
| `etapa_avancos` | `etapa_id`, `em`, `pct`, `fonte` (manual · rdo), `rdo_id`, `por` | Só `insert` (SET-052). |
| `linhas_base` | `empresa_id`, `obra_id`, `em`, `por`, `motivo`, `etapas jsonb` | Só `insert` (SET-051). |
| `publicacoes_cronograma` | `de_empresa_id`, `para_empresa_id`, `para_obra_id`, `versao`, `em`, `por`, `retrato jsonb` | Só `insert`; a contratante lê pela função `cronogramas_recebidos(obra_id)` (SET-057). |
| `modelos_cronograma` | `empresa_id`, `nome`, `etapas jsonb` | Fatia 2. Etapas `[{nome, pct}]` somando 100%. |

**Link do cliente:** o código do diário aprovado abre o PDF sem login pela função `diario_por_codigo(codigo)`, que devolve só aquele diário lacrado.

## 5. Crew

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `equipes` | `empresa_id`, `nome`, `encarregado_id`, `obra_base_id` | |
| `batidas` | `empresa_id`, `funcionario_id`, `tipo`, `obra_id`, `etapa`, `em`, `lat`, `lon`, `precisao`, `dentro_cerca`, `fonte_gps`, `registrado_por`, `modo`, `foto_path`, `ajuste_de` (a batida corrigida), `conferida`, `criado_no_aparelho_em` | **Nunca editada** (SET-004): a correção é uma batida nova com `ajuste_de`. |
| `localizacoes` | `empresa_id`, `funcionario_id`, `em`, `lat`, `lon`, `precisao` | Só com o ponto aberto (aviso de localização aceito). |
| `aprovacoes_semana` | `empresa_id`, `funcionario_id`, `semana`, `status`, `por`, `motivo`, `em` | |
| `localizacoes` | `id` (do aparelho), `empresa_id`, `funcionario_id`, `em`, `lat`, `lon`, `precisao`, `gatilho` (batida · app-aberto · periodico), `obra_id` (a obra da jornada naquele momento), `criado_no_aparelho_em` | PONTO-GPS-01 (requisito confirmado em outubro de 2026). Só `insert`. O banco recusa o registro fora de jornada aberta ou no intervalo (RN-17). Lido por quem tem `crew.acompanhar` e pelo próprio trabalhador; **nunca** pela contratante. |
| `orcamentos_obra` | `empresa_id`, `obra_id`, `valor`, `avanco`, `por_etapa jsonb`, `por`, `em` | |

**Para a contratante:** `presenca_na_obra(obra_id, dia)` devolve, de cada empresa ligada (e de toda a cadeia, CO-21), nomes, função, entrada, situação e horas — **sem valor hora, encargos nem custo** (HS-10).

## 6. Measure e concorrências

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `projetos` | `empresa_id`, `nome`, `contratante_id`, `dono_id`, endereço, `tipo`, `situacao`, `descricao`, `obra_id`, `estimador_id`, `prazo_proposta`, `proposta_rascunho jsonb`, `concorrencia jsonb` | |
| `folhas` | `projeto_id`, `nome`, `arquivo_path`, `pagina`, `escala jsonb` | |
| `condicoes` | `projeto_id`, `nome`, `tipo`, `cor`, `propriedades jsonb`, `assemblies uuid[]`, `folhas uuid[]`, `visivel` | |
| `medicoes` | `condicao_id`, `folha_id`, `pontos jsonb` (coordenadas da página, MSR-002), `desconto`, `vao jsonb` | |
| `typicais` | `projeto_id`, `folha_id`, `nome`, `regiao jsonb`, `ocorrencias jsonb` | |
| `itens`, `item_precos` | `empresa_id`, `codigo`, `nome`, `categoria`, `unidade`, `etapa`, `nota` · `item_id`, `desde`, `valor`, `origem` | Preço com vigência (MSR-053). |
| `assemblies` | `empresa_id`, `nome`, `tipo`, `descricao`, `linhas jsonb` | |
| `margens_versoes` | `empresa_id`, `desde`, `overhead_pct`, `lucro_pct`, `modo`, `imposto_material_pct`, `motivo`, `por`, `em` | |
| `propostas_emitidas` | `empresa_id`, `projeto_id`, `numero` (P-AAAA-NNN, sequência por empresa), `emitida_em`, `por`, `total`, `retrato jsonb`, `pdf_path` | Só `insert` (MSR-057). |
| `concorrencias` | `contratante_id` (empresa), `origem jsonb`, `obra_id`, `pai_id`, `servico`, `etapas text[]`, `incluso`, `excluso`, `observacoes`, `prazo timestamptz`, `inicio`, `termino`, `orcamento jsonb`, `exigencias jsonb`, `quarteirizacao`, `situacao`, `fechamento jsonb`, `aprovacao jsonb`, `cancelamento jsonb` | Da contratante; a convidada lê pela função `concorrencias_recebidas()` (CO-04). |
| `concorrencia_desenhos` | `concorrencia_id`, `nome`, `path` | |
| `concorrencia_convites` | `concorrencia_id`, `contato_id`, `nome`, `email`, `empresa_id` (convidada com conta), `token_hash`, `situacao`, `motivo`, `visto_em`, `respondido_em`, `projeto_id` | O link guarda só o **hash** do token; a página do link usa `convite_por_token(token)` sem login (CO-07). |
| `concorrencia_propostas` | `convite_id`, `rev`, `numero`, `enviada_em`, `por`, `total`, `por_etapa jsonb`, `outros`, `prazo_execucao_dias`, `exclusoes text[]`, `pdf_path` | Só `insert` (CO-05); recusa depois do prazo (CO-10). |
| `concorrencia_mensagens` | `concorrencia_id`, `convite_id` (null = aviso a todos), `de`, `autor`, `texto`, `publica`, `resposta_de`, `em` | Só `insert`. |
| `concorrencia_historico` | `concorrencia_id`, `em`, `por`, `acao`, `detalhe` | |

Enviar, responder, mandar proposta, fechar, aprovar quarteirização e escrever no canal passam por **funções do banco** com as regras CO-xx, como hoje passam por `js/concorrencias.js`.

## 7. O que ficou do banco antigo

| Item | Destino |
| --- | --- |
| `perfis` (id, tipo empresa/profissional, nome) | **Sai.** O KORbuild usa `membros` + `perfis_acesso`; o nome da pessoa fica em `auth.users` (metadados) e em `membros`. |
| `contatos` (canal, telefone, e-mail do usuário) | **Sai.** O nome colide com os contatos da empresa (§3), que são outra coisa. O telefone do usuário vai para `membros`. |
| `criar_conta()` + gatilho `ao_criar_usuario` | **Sai** junto com `perfis` e `contatos`: a empresa e o membro nascem em `criar_empresa()` ou em `aceitar_convite()` (§2). |
| `notificacoes`, `notificacao_prefs`, `notificar()`, `avisos_pendentes_email()` (já lê o nome em `membros` desde a fatia 1), `marcar_avisos_enviados()`, a função de borda `enviar-avisos` e o job `kor-enviar-avisos` | **Ficam e ganham `empresa_id`.** No protótipo, o sininho é calculado; no produto, os avisos que viram e-mail (convite, aprovação pedida, prazo vencido) são gravados aqui. O e-mail troca o nome "KORbuild Match" pelo do KORbuild. |
| `auditoria`, `auditar()` | **Ficam**, com `empresa_id` (§3). |
| `tocar_atualizado_em()`, `eh_sistema()`, `ligar_sistema()`, `guarda_notificacao()` | Ficam enquanto servirem; revisadas na fatia em que forem usadas. |
| A sua conta (`nardaccicoach@gmail.com`) | Fica. Vira o primeiro membro da primeira empresa e o primeiro `admins_plataforma`. |

## 8. Decisões (outubro de 2026)

- **Uma pessoa, uma empresa.** Cada login pertence a uma empresa só (`membros.user_id` único); dentro dela, a pessoa pode estar em N obras (`alocacoes`).
- **Uma empresa, uma conta, com 1 ou N funcionários.** O preço por número de funcionários é discutido no fim do projeto.
- **Região do projeto Supabase:** us-west-2 (EUA), conferida na fatia 1.
- **Conflito no offline:** o diário é de quem o abriu; se outro aparelho alterou sem sinal, o segundo recebe o aviso e escolhe a versão.
- **Pagamento dos planos** (Stripe) e o fim do teste: **a última coisa do projeto**, junto com o preço.
- **Endereço oficial: https://korbuildtech.com/**, mas só **no fim da primeira versão**, testada e homologada com o banco. Até lá, a **homologação** é no GitHub Pages, `https://nardacci.github.io/KORbuildtech/` (Site URL do Auth), com `http://localhost:8123` também liberado para desenvolvimento; o korbuildtech.com vira a Site URL no lançamento. O app navega por `#/…`, então o login usa o fluxo **PKCE** do Supabase (volta com `?code=`, sem mexer no `#`).

## 9. Migrações, em fatias

Cada fatia é um arquivo em `supabase/migrations/`, com teste das regras de acesso (um usuário de cada empresa tentando ler o que não pode), e o app passa a usar o banco naquela parte. O protótipo (`?demo`) continua como está.

**Antes de ir para o Supabase**, `tools/banco-local.sh` roda a estrutura, todas as migrações e todos os testes num Postgres local que imita o Supabase (`supabase/local/supabase-simulado.sql`: papéis, `auth.uid()` e as permissões padrão do `public`, que liberam toda tabela nova para o app e deixam a proteção com o RLS).

| Fatia | O que entra | O app passa a |
| --- | --- | --- |
| 1 | `supabase/migrations/20261012_0001_contas_empresas.sql` (só cria): `empresas`, `membros`, `perfis_acesso`, `convites_usuario`, `admins_plataforma`, `criar_empresa()`, `convidar_usuario()`, `aceitar_convite()`, `auditoria` com `empresa_id` e motivo, aviso por e-mail lendo `membros`. Teste: `supabase/testes/0001_acesso.sql` (em transação, termina em rollback). Depois, a saída de `perfis`, `contatos` e `criar_conta()` em `20261012_0001b_remover_perfis_antigos.sql` (aprovada); `0002` (quem foi desativado lê o próprio cadastro) e `0003` (excluir a empresa em cascata, sem esbarrar nas travas nem na auditoria). Teste do app contra o banco: `tests/conta.test.mjs` (23/23) ✓ | Criar a conta, entrar (tela oficial), convidar usuários e editar perfis |
| 2 | `supabase/migrations/20261013_0004_settings.sql` (só cria): `funcionarios` (com certificações), `funcionario_valores`, `encargos_versoes`, `regras_jornada_versoes`, `contatos`, `obras` (sem apagar; a ligação entre obras só pelas funções do banco), `alocacoes`, `modelos_cronograma`, `criar_funcionario()`, `atualizar_meu_perfil()`. Teste: `supabase/testes/0002_settings.sql` | Cadastrar tudo no banco; meu perfil (nome, idioma, e-mail, senha) |
| 3 | `supabase/migrations/20261014_0005_daily.sql` (só cria): `rdos`, `rdo_fotos`, `rdo_historico`, bucket `diarios` com as políticas das fotos, `salvar_rdo()`, `enviar_rdo()`, `dia_sem_atividade()`, `aprovar_rdo()` (lacre no banco), `pedir_ajustes()`, `diarios_recebidos()`, `diario_por_codigo()`; função de borda `supabase/functions/diario-publico` (link do cliente, fotos por links temporários). Teste: `supabase/testes/0003_daily.sql` (desenho no §10) | Usar o diário de verdade, com e sem internet |
| 4 | `supabase/migrations/20261015_0006_crew.sql` (só cria; acrescenta `funcionarios.equipe_id`). Teste: `supabase/testes/0004_crew.sql`. Crew: equipes, batidas (só `insert`), localizações, conferências, aprovações da semana, orçamentos, bucket `ponto`; presença na obra para a contratante (desenho no §11) | Bater o ponto de verdade, com e sem internet |
| 5 | `supabase/migrations/20261016_0007_cronograma.sql` (só cria; reescreve `aprovar_rdo`). Teste: `supabase/testes/0005_cronograma.sql`. Cronograma: etapas, avanços (só `insert`), linhas de base, publicações para a contratante; o andamento do RDO aprovado entra no cronograma (desenho no §12) | Montar o cronograma, publicar e receber de verdade |
| 6 | `supabase/migrations/20261017_0008_measure.sql` (só cria). Teste: `supabase/testes/0006_measure.sql`. Depois, `20261018_0009_cascata_auditoria.sql` (só reescreve funções): excluir empresas ligadas na mesma instrução não esbarra na auditoria nem nas travas "só insert" (teste `0007_cascata.sql`). Measure: projetos, folhas (Storage `plantas`), condições com as medições, typicals, catálogo, preços e margens (só `insert`), propostas emitidas (desenho no §13) | Medir, cotar e emitir propostas de verdade; consulta no celular |
| 7 | Concorrências: tudo do §6, com o link sem conta e o canal | |
| 8 | Notificações por e-mail e a área de administração da plataforma | |

## 10. Fatia 3 — o Daily no banco (desenho aprovado em outubro de 2026)

O protótipo já funciona sem internet: o diário é gravado no aparelho e sobe quando há sinal. A fatia 3 mantém esse
jeito de usar e troca o "escritório simulado" pelo Supabase.

### 10.1 Tabelas

| Tabela | Colunas | Regras |
| --- | --- | --- |
| `rdos` | `id` (gerado **no aparelho**), `empresa_id`, `obra_id`, `data`, `numero` (sequência por obra, dada pelo banco), `status` (rascunho · enviado · ajustes · aprovado), `autor_id` (membro), `conteudo jsonb` (clima, equipe, equipamentos, atividades, ocorrências, observações), `sem_atividade jsonb`, `motivo_ajuste`, `versao`, `criado_no_aparelho_em`, `enviado_em`, `primeiro_envio_em`, `aprovado_em`, `aprovado_por` (nome), `aprovado_por_empresa` (nome), `hash_documento`, `codigo` | **Um diário por obra por dia** (único `obra_id + data`). O app **não** muda `status` direto: só pelas funções do §10.2. Aprovado = lacrado: o gatilho recusa qualquer `update`/`delete` depois. |
| `rdo_fotos` | `id` (do aparelho), `empresa_id`, `rdo_id`, `path` e `path_mini` (Storage), `legenda`, `tirada_em`, `lat`, `lon`, `fonte_gps`, `precisao`, `largura`, `altura`, `tamanho`, `hash_original`, `ordem` | Só entra e sai enquanto o diário está em rascunho ou ajustes. |
| `rdo_historico` | `id` (do aparelho), `empresa_id`, `rdo_id`, `em`, `quem`, `acao` | Só `insert` (BD-04). |

**Storage:** bucket privado `diarios`, caminho `{empresa_id}/{obra_id}/{rdo_id}/{foto_id}.jpg` (e `-mini.jpg`). A foto
já sai do aparelho reduzida e carimbada, como hoje.

### 10.2 Quem faz o quê (funções do banco)

| Ação | Função | Quem pode |
| --- | --- | --- |
| Criar e editar o rascunho | `salvar_rdo(dados)` (grava o diário, as fotos e o histórico; repetir não duplica) | Quem tem `daily.preencher`, em **qualquer obra da empresa** (decisão de outubro de 2026) |
| Enviar / reenviar com ajustes | `enviar_rdo(id, versao)` | Os mesmos; confere as pendências (equipe, atividade…) e o prazo |
| Dia sem atividade | `dia_sem_atividade(obra, data, motivo, obs)` | Os mesmos |
| Aprovar e lacrar | `aprovar_rdo(id)` | Obra **sem** vínculo: a própria empresa, com `daily.aprovar` (HS-13). Obra **com** vínculo: só a contratante, com `daily.aprovar` (HS-11) |
| Pedir ajustes | `pedir_ajustes(id, motivo)` | Os mesmos de aprovar |
| Diários recebidos | `diarios_recebidos(obra_id)` | A contratante lê os diários **enviados** das prestadoras nas obras ligadas à dela (BD-03: nada de abrir a tabela de uma empresa para a outra) |
| Link do cliente | `diario_por_codigo(codigo)` | Qualquer um com o código (sem login): devolve só aquele diário aprovado, e as fotos por links temporários |

**O lacre passa para o banco.** Na aprovação, o próprio banco monta o texto canônico (o mesmo conteúdo de
`js/lacre.js`), calcula o SHA-256 e grava `hash_documento` e `codigo`. Assim ninguém consegue lacrar um conteúdo
diferente do que está gravado, e o link do cliente confere o lacre no servidor.

### 10.3 Sem internet (BD-08)

- Cada diário, foto e linha do histórico nasce com um **id gerado no aparelho**. Subir de novo o mesmo id **não
  duplica** (o envio repetido por sinal ruim fica sem efeito).
- A fila do aparelho guarda: o diário (o rascunho inteiro), as fotos ainda não enviadas e as ações (enviar, sem
  atividade). Quando o sinal volta, sobem **primeiro as fotos**, depois o diário, depois a ação.
- **Conflito** (decisão de outubro de 2026): o diário é de quem o abriu. Cada gravação leva a `versao` que o
  aparelho conhecia; se o banco já tiver outra (outro aparelho mexeu sem sinal), o banco recusa e o app mostra as
  duas versões para a pessoa escolher.
- Depois de aprovado, o diário volta para o aparelho só para leitura.

### 10.4 No app

O caminho recomendado é **reaproveitar as telas do Daily do protótipo** (campo, escritório, relatório, PDF, fila de
aprovação, link do cliente): o armazenamento do aparelho passa a ser um espelho do Supabase, preenchido ao entrar
e atualizado pela sincronização. Isso preserva o modo sem internet que já funciona e o visual que já foi aprovado,
em vez de reescrever as telas. As obras e os usuários vêm dos cadastros da fatia 2.

### 10.5 Fica para depois

- A **equipe vinda do ponto** (Crew) entra na fatia 4; até lá, a equipe do diário é lançada à mão.
- O **andamento no cronograma** ao aprovar entra na fatia 5 (o cronograma ainda está só no protótipo).
- Os **lembretes por e-mail** (16h, 18h, manhã seguinte) entram na fatia 8; o sininho continua no app.

## 11. Fatia 4 — o Crew no banco (desenho aprovado em outubro de 2026)

Mesmo caminho da fatia 3: as telas do Crew do protótipo (Meu ponto, Ponto da equipe, Horas, Agora, Timesheets,
Semana e Dia do funcionário, Custos) passam a funcionar sobre o espelho do banco no aparelho, com e sem internet.
O cálculo das horas (jornada, hora extra, deslocamento, alertas, custo e projeção) **continua no app**, em
`js/crew.js`, que já está testado; o banco guarda os fatos (batidas, decisões, orçamentos) e garante as regras que
não podem depender do aparelho.

### 11.1 Tabelas

| Tabela | Colunas | Regras |
| --- | --- | --- |
| `equipes` | `id`, `empresa_id`, `nome`, `encarregado_id` (membro), `obra_base_id`, `ativa` | Nome único na empresa. Cadastro no Settings, com `settings.funcionarios`. `funcionarios.equipe_id` passa a apontar para cá (a coluna prometida no §3). |
| `batidas` | `id` (gerado **no aparelho**), `empresa_id`, `funcionario_id`, `tipo` (entrada · intervalo-inicio · intervalo-fim · troca · chegada · etapa · saida), `obra_id`, `etapa`, `em`, `lat`, `lon`, `precisao`, `dentro_cerca`, `fonte_gps`, `modo` (proprio · equipe · ajuste), `registrado_por` (membro), `foto_path`, `nota` (até 280), `ajuste_motivo`, `criado_no_aparelho_em`, `recebida_em` | **Só `insert`** (RN-01, BD-04): o gatilho recusa `update` e `delete`. Correção = batida nova com `modo = ajuste` e motivo. Subir de novo o mesmo `id` não duplica. Fora da cerca é aceita e marcada (RN-09). |
| `batidas_conferidas` | `batida_id`, `empresa_id`, `por`, `em` | "Conferido" do painel Agora: fica numa tabela à parte para a batida continuar intocada. Só `insert`. |
| `aprovacoes_semana` | `id`, `empresa_id`, `funcionario_id`, `semana` (segunda-feira), `status` (aprovado · devolvido), `motivo`, `por`, `em` | Só `insert`; vale a última decisão (como no protótipo). |
| `localizacoes` | `id` (do aparelho), `empresa_id`, `funcionario_id`, `em`, `lat`, `lon`, `precisao`, `gatilho` (batida · app-aberto · periodico), `obra_id` (a obra da jornada naquele momento), `criado_no_aparelho_em` | PONTO-GPS-01 (requisito confirmado em outubro de 2026). Só `insert`. O banco recusa o registro fora de jornada aberta ou no intervalo (RN-17). Lido por quem tem `crew.acompanhar` e pelo próprio trabalhador; **nunca** pela contratante. |
| `orcamentos_obra` | `id`, `empresa_id`, `obra_id`, `valor`, `avanco`, `por_etapa jsonb`, `por`, `em` | Só `insert` (versões); vale a última. Lido só com `crew.custos`. |

**Storage:** bucket privado `ponto`, caminho `{empresa_id}/{funcionario_id}/{batida_id}.jpg`, com as mesmas
políticas do bucket `diarios` (só a própria empresa, só quem pode ver o ponto).

### 11.2 Quem faz o quê

| Ação | Como | Quem pode |
| --- | --- | --- |
| Bater o próprio ponto | `registrar_batidas(lista)` | `crew.ponto.proprio`, só para o funcionário ligado ao próprio usuário (`membros.funcionario_id`) |
| Bater o ponto da equipe (RN-10) | `registrar_batidas(lista)` | `crew.ponto.equipe`, para **qualquer funcionário ativo da empresa** (a equipe é só a lista que aparece primeiro; mesma decisão do Daily) |
| Ajustar um dia (CREW-04) | `ajustar_batida(dados, motivo)` | `crew.aprovar`; recusa em semana aprovada |
| Conferir batida fora da cerca | `conferir_batida(id)` | `crew.acompanhar` |
| Aprovar / devolver a semana (RN-11) | `decidir_semana(funcionarios, semana, status, motivo)` | `crew.aprovar`. O banco recusa aprovar dia passado **sem saída** (RN-08) e devolver sem motivo |
| Ler batidas, equipes, aprovações | RLS | Quem tem `crew.acompanhar` lê a empresa toda; o encarregado (`crew.ponto.equipe`) lê as de toda a empresa sem dinheiro; o trabalhador lê só as próprias |
| Registros de localização | `registrar_localizacoes(lista)` | Só a própria pessoa, do próprio celular, com o ponto dela aberto (o encarregado grava a dele; quem não usa o app fica só com as posições das batidas) |
| Orçamento da obra | `insert` direto | `crew.custos` |
| Presença para a contratante (HS-10) | `presenca_na_obra(obra_id, de, ate)` | A contratante, nas obras ligadas à dela (e na cadeia, até 3 níveis, CO-21), com `crew.acompanhar` ou `daily.acompanhar` |

**Valor hora × semana aprovada (RN-13 / SET-014):** um gatilho em `funcionario_valores` recusa um `desde` que caia
numa semana já aprovada daquele funcionário, **ou antes dela** (o valor novo reescreveria a folha já enviada). É a
regra que ficou pendente da fatia 2. A semana aprovada também não recebe batida atrasada nem ajuste.

**Aviso de localização:** a própria pessoa aceita no app (`aceitar_aviso_gps()`, grava `funcionarios.aviso_gps_em`);
sem o aviso aceito, o banco recusa os registros de localização dela.

**Envio do aparelho:** `registrar_batidas` e `registrar_localizacoes` devolvem `{gravadas, recusadas}`; cada recusada
vem com o motivo (`semana-aprovada`, `obra`, `permissao`, `ponto-fechado`, `intervalo`, `sem-aviso`…) e não derruba
as outras do mesmo envio.

**Presença para a contratante:** a função devolve, de cada prestadora ligada, nome, função e as batidas daquelas
pessoas **naquela obra** (tipo, hora, dentro/fora da cerca); a batida em outra obra da prestadora vem só como
"outra obra", sem o nome. Nada de valor hora, encargos, custo nem orçamento. As horas são somadas no app pela mesma
`jornada()`, como no protótipo. Nada de política RLS abrindo `batidas` para outra empresa (BD-03).

### 11.3 Sem internet (BD-08)

- A batida nasce no aparelho com o **id e a hora da batida** (`em`) gravados ali; o banco grava também quando
  recebeu (`recebida_em`). Assim, o ponto batido sem sinal às 7h continua às 7h quando sobe às 10h.
- A fila do aparelho guarda as batidas e as fotos; quando o sinal volta, sobem **primeiro as fotos**, depois as
  batidas, na ordem. Como a batida nunca é editada, **não há conflito** entre aparelhos: dois encarregados que
  baterem a mesma pessoa geram duas batidas, e o escritório vê e ajusta (como hoje).
- Aprovar, devolver, ajustar e conferir são do escritório e pedem internet (a tela avisa).
- A sincronização reaproveita `js/sincronizacao.js` e o espelho (`js/espelho.js`), que passa a montar também o
  `crew` do protótipo a partir do banco (funcionários, valores, encargos e regras já vêm da fatia 2).

### 11.4 Ligações

- **Equipe do diário vinda do ponto (CREW-12):** com o `crew` no espelho, o Daily volta a preencher a equipe do dia
  com a presença do ponto, como no protótipo. É o item que ficou da fatia 3 (§10.5).
- **Custos:** o app calcula com o valor hora vigente em cada dia, os encargos e a regra de jornada da semana
  (fatia 2). Quem não tem `crew.custos` não recebe `funcionario_valores` nem `encargos_versoes` (já é assim no RLS).

### 11.5 Registros de localização (PONTO-GPS-01)

O requisito está confirmado. Nesta fatia, no app atual (o do navegador, instalado no celular):

- grava a posição **em cada batida**, **ao abrir o app** durante a jornada e **a cada 15 min na obra e 5 min em
  deslocamento enquanto o app estiver aberto** (os intervalos ficam em `empresas.configuracao`, BD-07);
- nunca no intervalo, com o ponto fechado ou fora do expediente (RN-17, conferido também no banco);
- sem sinal, os registros ficam na fila do aparelho e sobem depois, como as batidas;
- o mapa do dia, o percurso e a reprodução passam a usar os registros reais, em vez dos simulados.

### 11.6 Limite do app do navegador

Com o app fechado, minimizado ou com a tela bloqueada, o navegador **não grava** a localização. No computador isso
não importa (o ponto é batido no celular); no celular, o registro contínuo em segundo plano depende do **app
nativo** (iOS e Android), que usa as mesmas tabelas e funções desta fatia, sem mudar o banco. Até lá, a tela do dia
mostra os trechos sem registro como "sem registro (app fechado)", para ninguém confundir falta de dado com parada.

### 11.7 Fica para depois

- **Localização em segundo plano** (com o app fechado ou o celular bloqueado): só com o app nativo, porque o
  navegador não grava em segundo plano (§11.6). A tabela e as regras já ficam prontas nesta fatia.
- **Avisos do sininho** (sem saída, timesheets pendentes, batida fora da cerca) continuam calculados no app; o
  e-mail fica para a fatia 8.
- **CSV para a folha:** continua gerado no app, só com semanas aprovadas. Integrações (QuickBooks, Gusto, ADP) ficam
  para depois do lançamento.

### 11.8 No app (fatia 4 pronta)

- **Espelho:** ao entrar no Crew, `js/espelho-crew.js` lê equipes, funcionários, valores, regras, encargos, batidas, conferências, aprovações,
  orçamentos e localizações (de mil em mil linhas, o limite do servidor) e monta o mesmo formato do protótipo. Sem encargos cadastrados, o custo
  sai sem encargos (a empresa ainda não definiu); sem regra de jornada, vale a padrão (FLSA federal). A construtora recebe a presença das
  prestadoras ligadas às obras dela (`presenca_na_obra`) como empresas vizinhas, sem valores e sem localização.
- **Ponto no aparelho:** bater o ponto grava no espelho e sobe sozinho (`registrar_batidas`), com a hora da batida; sem internet, fica na
  fila e o aviso de conexão mostra "N no aparelho". Recusada pelo banco (semana aprovada, obra de fora…) = sai da fila com um aviso.
- **Escritório:** conferir, ajustar, aprovar, devolver, orçamento e valor hora vão direto ao banco e pedem internet; depois o espelho é lido de novo.
- **Localização:** `js/localizacao.js` grava a posição com o app aberto e o ponto aberto (ao abrir, a cada 15 min na obra e 5 min em
  deslocamento; `empresas.configuracao.localizacao` muda os minutos), só depois que a própria pessoa aceita o aviso. O mapa do dia usa os
  registros reais e avisa dos trechos sem registro (app fechado).
- **Foto da batida:** o protótipo só marca "com foto"; a captura real da foto fica para depois (o bucket `ponto` já existe).
- **Fuso:** o app agrupa as batidas por dia no fuso do celular e o banco, no da empresa (`configuracao.fuso`, padrão Nova York); para quem
  trabalha no mesmo fuso da empresa é igual.
- **Quarteirização:** a presença de empresas abaixo da prestadora (nível 2 em diante) chega com a fatia 7 (ligação entre obras).

## 12. Fatia 5 — o cronograma no banco (desenho aprovado em outubro de 2026)

O cronograma é trabalho de escritório, com internet: montar as etapas, salvar a linha de base, ajustar o % à mão e
publicar. O que chega ao campo (as próximas 3 semanas e a lista de etapas para o RDO apontar) vem pelo espelho e
funciona sem internet, como o resto do Daily. As telas são as do protótipo (`js/cronograma-telas.js`); o cálculo de
situação, avanço e desvio continua em `js/cronograma.js`, sobre o espelho.

### 12.1 Tabelas

| Tabela | Colunas | Regras |
| --- | --- | --- |
| `cronograma_etapas` | `id`, `empresa_id`, `obra_id`, `nome`, `inicio`, `fim`, `responsavel_id` (membro), `pct` (0–100), `ordem`, `criado_em`, `atualizado_em` | CR-01. Nome, datas, responsável e ordem mudam pelas funções; `pct` **só** pelos avanços (gatilho recusa `update` direto). Uma etapa que já recebeu avanço de RDO aprovado **não pode ser excluída** e **só quem aprovou esse RDO** pode alterá-la (nome, datas, responsável, % à mão) — decisão de outubro de 2026. |
| `etapa_avancos` | `id`, `empresa_id`, `etapa_id`, `data`, `antes`, `pct`, `fonte` (rdo · manual), `rdo_id`, `por`, `por_nome`, `em` | Só `insert` (SET-052, CR-04). O gatilho leva o `pct` para a etapa. |
| `linhas_base` | `id`, `empresa_id`, `obra_id`, `motivo`, `etapas jsonb` ({etapa_id: {inicio, fim}}), `por`, `por_nome`, `em` | Só `insert` (CR-03). A primeira é gravada pela função ao entrar a primeira etapa; as outras, por decisão, com motivo. |
| `publicacoes_cronograma` | `id`, `de_empresa_id`, `obra_id` (da prestadora), `para_empresa_id`, `para_obra_id`, `versao` (sequência por obra), `retrato jsonb` (etapas sem histórico, última linha de base, responsáveis por nome, dados da empresa), `por_nome`, `em` | Só `insert` (CR-09). A contratante lê pela função, nunca pela tabela (BD-03). |

### 12.2 Quem faz o quê

| Ação | Função | Quem pode |
| --- | --- | --- |
| Criar, editar, excluir e reordenar etapas | `salvar_etapa(p)`, `excluir_etapa(id)`, `ordenar_etapas(obra, ids[])` | Quem tem `daily.cronograma` ("Montar o cronograma da obra", CR-02), em qualquer perfil que a receba, na própria empresa. Etapa com andamento de RDO aprovado: só quem aprovou (ver 12.1); se foi a construtora, a etapa fica travada para a prestadora e o % continua entrando pelos próximos RDOs |
| Começar com um modelo | `aplicar_modelo(obra, modelo_id)`: o banco distribui as etapas do modelo (`modelos_cronograma`, fatia 2) no período da obra, na proporção do modelo, e grava a primeira linha de base | Os mesmos; só numa obra sem etapas |
| Ajustar o % à mão | `registrar_avanco(etapa, pct, data)` (fonte `manual`) | Os mesmos |
| Nova linha de base | `nova_linha_base(obra, motivo)` | Os mesmos; motivo obrigatório |
| Publicar para o contratante | `publicar_cronograma(obra)`: monta o retrato no banco, versão N+1 | Os mesmos; só obra com vínculo (CR-10) |
| Ler o cronograma da própria empresa | RLS | Quem tem qualquer permissão do Daily (o encarregado vê as próximas 3 semanas e aponta a etapa no RDO) |
| Cronogramas recebidos | `cronogramas_recebidos(obra)` | A contratante, com `daily.acompanhar`, nas obras ligadas à dela: a última versão de cada prestadora (e as anteriores, pela versão) |
| **Andamento pelo RDO aprovado (CR-04)** | dentro de `aprovar_rdo(id)` (fatia 3) | Cada atividade do RDO que aponta `cronoEtapaId` + `cronoPct` vira um avanço com fonte `rdo`, na empresa que fez o diário — mesmo quando quem aprova é a construtora (a função roda com os direitos do banco, sem abrir a tabela de uma empresa para a outra). É o item que ficou da fatia 3 (§10.5). |

**Publicações:** todas as versões ficam guardadas; nenhuma é apagada ou "despublicada" — para corrigir, publica-se outra (decisão de outubro de 2026).

**Auditoria:** etapas (criar, alterar, excluir), avanço manual, linha de base e publicação vão para `auditoria` pelo gatilho.

### 12.3 Sem internet

- O espelho traz etapas, avanços e linhas de base da própria empresa; as próximas 3 semanas e o seletor de etapa no
  RDO funcionam sem sinal. A obra da construtora recebe os retratos publicados como empresas vizinhas, como hoje.
- Montar, ajustar, publicar e a linha de base pedem internet (a tela avisa), como as ações do escritório no Crew.
- O % que vem do RDO entra quando o diário é **aprovado**, no banco; a atividade apontando a etapa sobe com o diário.

### 12.4 Fica como está

- **Excel:** continua gerado no app (`js/cronograma-excel.js`), do espelho ou do retrato recebido.
- **Sininho** de etapa atrasada e de publicação recebida: calculado no app; e-mail na fatia 8.
- **Ligação entre obras** (`vinculo_*`): continua gravada à mão pela equipe do KORbuild até a fatia 7.

### 12.5 No app (fatia 5 pronta)

- **Espelho:** `js/espelho-crew.js` lê etapas, avanços, linhas de base, publicações próprias e modelos, e monta `cronogramas` e
  `modelosCronograma` no formato do protótipo; os cronogramas recebidos (`cronogramas_recebidos`) entram em `compartilhados`,
  como a construtora já esperava. A **Etapa atual** da obra, as **próximas 3 semanas** e o seletor de etapa no RDO saem daí,
  com e sem internet.
- **Escritório:** `js/cronograma-oficial.js` liga `salvar_etapa`, `excluir_etapa`, `ordenar_etapas`, `aplicar_modelo`,
  `registrar_avanco`, `nova_linha_base` e `publicar_cronograma`; cada uma pede internet e relê o espelho. A tela repete
  as mensagens do banco (etapa travada, obra sem vínculo…).
- **Responsável da etapa:** na conta de verdade é sempre um usuário (o banco aponta para `membros`); no protótipo um
  funcionário sem login também podia ser.
- **Aprovação:** o aviso "RDO aprovado" diz quantas etapas receberam andamento (`aprovar_rdo` devolve `etapas`).

### 12.6 Fica para depois

- Dependência "começa depois de" entre etapas, metas vindas do Measure e horas do Crew por etapa (docs/cronograma.md §5).

## 13. Fatia 6 — o Measure no banco (desenho aprovado em outubro de 2026)

O Measure é trabalho de escritório, **no computador e com internet** (docs/measure.md §3e: desenhar e medir é só no
computador; o celular consulta). Por isso esta fatia não tem fila sem internet: cada mudança vai ao banco na hora
(as medições, agrupadas a cada segundo, para não ir clique a clique). O motor de cálculo (unidades, geometria,
fórmulas, custo e preço de venda) **continua no app**, `js/measure.js`, `js/formulas.js` e `js/precos.js`, que já
estão testados; o banco guarda os dados, garante quem pode e congela o que não muda.

### 13.1 Tabelas

| Tabela | Colunas | Regras |
| --- | --- | --- |
| `projetos` | `id`, `empresa_id`, `nome`, `contratante_id`, `dono_id` (→ `contatos`), `endereco`, `cidade`, `estado`, `zip`, `tipo`, `situacao` (orcamento · enviada · ganha · perdida · cancelada), `descricao`, `obra_id`, `estimador_id` (membro), `prazo_proposta`, `proposta_rascunho jsonb`, `cotacao jsonb` (envios aos fornecedores), `criado_em`, `atualizado_em` | Contratante obrigatório; cidade e estado; `obra_id` liga ao cadastro de obras (`obras.projeto_id`, fatia 2). Excluir o projeto leva folhas, condições e typicals (cascata) e o app apaga as plantas do Storage antes. |
| `folhas` | `id`, `empresa_id`, `projeto_id`, `nome`, `arquivo_path` (Storage), `arquivo_nome`, `pagina`, `escala jsonb` (ppp, origem, conferência), `criada_em` | Uma linha por página do PDF enviado. A escala é da folha (MZ-03). |
| `condicoes` | `id`, `empresa_id`, `projeto_id`, `nome`, `tipo` (linear · area · contagem), `cor`, `props jsonb`, `assemblies uuid[]`, `folhas uuid[]`, `oculta`, **`medicoes jsonb`**, `versao`, `atualizado_em` | As medições ficam **dentro da condição** (MZ-05: condição ≠ medições, mas elas só existem nela): `[{id, folhaId, pontos, desconto, vao, vaoDe, em}]` em points do PDF (MZ-02). `versao` detecta dois computadores na mesma condição. |
| `typicais` | `id`, `empresa_id`, `projeto_id`, `folha_id`, `nome`, `regiao jsonb` (null = folha inteira), `ocorrencias jsonb`, `por_nome`, `em` | TY-01 a TY-04 conferidos no banco (sem sobreposição; folha inteira não convive com região). |
| `itens` | `id`, `empresa_id`, `codigo`, `nome`, `categoria` (material · mao-de-obra · equipamento · subempreiteiro), `unidade`, `etapa`, `nota` | Código único na empresa. Não sai enquanto um assembly o usa (gatilho); sem assembly, sai e leva os preços dele (o histórico fica na auditoria). |
| `item_precos` | `id`, `empresa_id`, `item_id`, `desde`, `valor`, `fonte`, `fornecedor_id` (→ `contatos`), `por`, `por_nome`, `em` | Só `insert` (PR-01). O app usa o preço que vale no dia. |
| `assemblies` | `id`, `empresa_id`, `nome`, `tipo`, `descricao`, `linhas jsonb` ([{id, itemId, formula, perda, passo}]) | A fórmula é validada no app (mathjs restrito) **e** o banco recusa linha sem item da empresa ou com caracteres fora do alfabeto das fórmulas (defesa em profundidade). |
| `margens_versoes` | `id`, `empresa_id`, `desde`, `overhead_pct`, `lucro_pct`, `modo` (markup · margem), `imposto_material_pct`, `motivo`, `por`, `por_nome`, `em` | Só `insert`, com motivo (PR-03), na auditoria. |
| `propostas_emitidas` | `id`, `empresa_id`, `projeto_id`, `numero` (`P-AAAA-NNN`), `emitida_em`, `por`, `por_nome`, `total`, `retrato jsonb`, `pdf_path` | Só `insert` (RL-02). O número é dado pelo banco: sequência **por empresa e por ano**. |

**Storage:** bucket privado `plantas`, caminho `{empresa_id}/{projeto_id}/{arquivo_id}.pdf`, só PDF, até 50 MB por
arquivo; políticas: a própria empresa, com `measure.medir`. O PDF continua aberto no navegador (PDF.js); o app pede
um link temporário ao abrir a folha e guarda o arquivo no aparelho (IndexedDB) para não baixar de novo.

### 13.2 Quem faz o quê

| Ação | Como | Quem pode |
| --- | --- | --- |
| Projetos, folhas (enviar PDF, escala, conferência), condições, medições, typicals | gravação direta nas tabelas, com RLS | `measure.medir`, na própria empresa (só prestadora ou ambas: a construtora não tem Measure, HS-09) |
| Catálogo (itens, assemblies), preços e margens | direta (itens, assemblies) e só `insert` (preços, margens) | `measure.catalogo` |
| Preços recebidos do fornecedor (na lista de cotação) | `insert` em `item_precos` com `fonte = cotacao` e o fornecedor | `measure.catalogo` |
| Emitir a proposta | `emitir_proposta(projeto, retrato, total)`: numera, carimba quem e quando, congela o retrato e muda a situação do projeto para "enviada" | `measure.medir`; o banco confere contratante, pelo menos uma linha e preço em todas as incluídas (RL-01) e que o total bate com as linhas |
| Ler tudo do Measure | RLS | Quem tem `measure.medir`; os preços e as margens (dinheiro) só para quem tem `measure.catalogo` **ou** `crew.custos` |
| Consulta no celular (§3e) | o espelho | Os mesmos; o celular mostra os números sem abrir o desenho |

**O que o banco não faz:** não recalcula fórmulas nem preços (isso é do app, com o mathjs). O retrato da proposta
emitida chega pronto do app; o banco o numera e congela. O custo e a margem ficam dentro do retrato, para consulta
interna, e nunca saem para o contratante (PR-06): a função que o link ou a concorrência usarem (fatia 7) devolve
só as linhas e o total.

**Auditoria:** projetos (criar, alterar, excluir), itens, assemblies, preços, margens e propostas pelo gatilho.
Condições e medições não vão para a auditoria (são centenas de gravações por sessão de medição).

### 13.3 Ligações

- **Obras (fatia 2):** "Criar obra a partir do projeto ganho" continua no app: cria a obra e grava `projetos.obra_id`.
- **Crew (fatia 4):** o custo da hora sugerido (PR-02) vem do espelho — média do valor hora dos ativos + encargos —, só para
  quem lê dinheiro.
- **Cronograma (fatia 5) e Daily:** as quantidades como meta da etapa ficam para depois (docs/cronograma.md §5).
- **Concorrências (fatia 7):** o projeto ganha `concorrencia jsonb` e as propostas enviadas pela plataforma apontam
  `propostas_emitidas`. Nada disso entra agora.

### 13.4 Fica como está no app

- PDF do pedido de cotação e da proposta: impressos pelo navegador, como hoje; `pdf_path` fica para quando houver
  geração no servidor.
- E-mail ao fornecedor e ao contratante: abre no programa de e-mail (RL-04); o envio pelo sistema vem com a fatia 8.
- CSV das quantidades: no app.

### 13.5 No app (fatia 6 pronta)

- **Gravação direta, agrupada:** as telas do Measure continuam gravando no espelho (`salvar()`); `js/measure-oficial.js`
  escuta cada gravação, compara com o que o banco já tem e sobe só o que mudou (projetos, folhas, condições, typicals,
  itens, assemblies), 800 ms depois da última mudança; o que sumiu é apagado. Preços e margens só entram. Antes de o
  espelho ser relido, o que está na fila sobe.
- **Condição com versão:** cada gravação leva a versão que o computador conhecia; outra versão no banco (outro
  computador na mesma condição) avisa e recarrega a tela com a versão do banco.
- **Plantas:** o PDF vai ao Storage (`plantas/{empresa}/{projeto}/{arquivo}.pdf`) e fica no aparelho como cópia; ao
  abrir uma folha sem cópia, o app baixa por link temporário. Excluir o projeto apaga as plantas antes das linhas.
- **Proposta:** `emitir_proposta` recebe o retrato pronto do app; o número e a data voltam do banco.
- **Dinheiro:** quem não lê preços nem margens recebe o espelho sem eles (o RLS não entrega), e a tela mostra "sem preço".
- **Responsável/estimador:** um usuário (membro), como no cronograma.

### 13.6 Fica para depois

- Plantas de exemplo (`assets/plantas`) na conta de verdade: ficam só na demonstração.
- Atrair o clique às linhas do desenho (docs/measure.md §5).

