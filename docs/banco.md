# KORbuild — Banco de dados (Supabase)

> Especificação de outubro de 2026. Projeto Supabase `gbdmtgephszxhaprpiss`. O banco foi limpo do sistema antigo (Match) em 12/10/2026: backup da estrutura em `supabase/backup/`, remoção em `supabase/remocao-match.sql`, ajuste do cadastro em `supabase/ajuste-criar-conta.sql`.
>
> **Situação:** fatias 1, 2 e 3 no banco. Fatia 1 (`0001`–`0003`): a conta, a empresa, usuários, perfis e convites. Fatia 2 (`0004`): Meu perfil e os cadastros do Settings (obras, funcionários, contatos, regras), em `js/cadastros.js` e `js/cadastros-telas.js`. Fatia 3 (`0005` e a função `diario-publico`): o Daily, com as telas do protótipo funcionando sobre um espelho do banco no aparelho (`js/espelho.js`) e a sincronização (`js/sincronizacao.js`), com e sem internet; aprovação entre empresas, lacre no banco e link do cliente. Testes: `tests/conta.test.mjs` e `tests/daily.test.mjs --real` (contra o Supabase), `tests/daily.test.mjs` (contra o Supabase local: `tools/supabase-local.sh`), `tests/oficial-simulado.test.mjs` e `supabase/testes/` (regras de acesso; `tools/banco-local.sh`). As outras fatias seguem (§9). O protótipo (`?demo`) continua no navegador e não muda.

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
| 4 | Crew: equipes, batidas, localizações, aprovações, orçamentos; presença na obra para a contratante | Bater o ponto de verdade |
| 5 | Cronograma: etapas, avanços, linhas de base, publicações | |
| 6 | Measure: projetos, folhas (Storage), condições, medições, typicals, catálogo, preços, margens, propostas | |
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
