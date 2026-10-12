# KORbuild — Banco de dados (Supabase)

> Especificação de outubro de 2026. Projeto Supabase `gbdmtgephszxhaprpiss`. O banco foi limpo do sistema antigo (Match) em 12/10/2026: backup da estrutura em `supabase/backup/`, remoção em `supabase/remocao-match.sql`, ajuste do cadastro em `supabase/ajuste-criar-conta.sql`.
>
> **Situação:** especificação. Nenhuma tabela do KORbuild existe ainda; as migrações vão em fatias (§9). O protótipo (`?demo`) continua no navegador e não muda.

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
| `funcionarios` | `empresa_id`, `nome`, `codigo`, `funcao`, `equipe_id`, `admissao`, `classificacao` (w2 · 1099), `flsa`, `situacao`, `desligamento`, `telefone`, `emergencia`, `aviso_gps_em` | SET-010 a SET-016. SSN e documentos não entram (SET-012). |
| `funcionario_valores` | `funcionario_id`, `desde`, `valor`, `motivo`, `por`, `em` | Só `insert` (SET-013); não começa dentro de semana aprovada (SET-014), checado por função. |
| `certificacoes` | `funcionario_id`, `nome`, `validade` | |
| `encargos_versoes` | `empresa_id`, `desde`, `itens jsonb`, `motivo`, `por`, `em` | Só `insert`, nunca no passado (SET-021). |
| `regras_jornada_versoes` | `empresa_id`, `desde` (segunda-feira), `semanal`, `diaria`, `intervalo` (`jsonb`), `nome`, `nota`, `motivo`, `por`, `em` | SET-022, SET-023. |
| `listas` | `empresa_id`, `tipo` (funcoes · equipamentos · ocorrencias…), `valores text[]` | As listas que hoje estão fixas (BD-07). |
| `contatos` | `empresa_id`, `nome`, `pessoa`, `papeis text[]`, endereço, `email`, `telefone`, `etapas text[]`, `notas`, `conta_empresa_id` | `conta_empresa_id` = a empresa do contato que tem conta no KORbuild (o `contaId` do protótipo). |
| `auditoria` | `empresa_id`, `em`, `por` (user_id e nome), `area`, `descricao`, `antes`, `depois`, `motivo` | Reaproveita a tabela que ficou, com `empresa_id` a mais (§7). |

## 4. Obras, Daily e cronograma

| Tabela | Colunas principais | Regras |
| --- | --- | --- |
| `alocacoes` | `empresa_id`, `obra_id`, `membro_id` ou `funcionario_id`, `papel`, `desde`, `ate` | Quem trabalha em quais obras: uma pessoa em N obras. Base para as permissões por obra (o encarregado vê só as dele). |
| `obras` | `empresa_id`, `nome`, `contratante_id`, `dono_id` (→ `contatos`), endereço, `municipio`, `estado`, `zip`, `cerca` (lat, lon, raio), `inicio`, `prazo`, `responsavel_id` (membro), `dias_trabalho int[]`, `situacao`, `projeto_id`, **`vinculo_empresa_id`, `vinculo_obra_id`**, `concorrencia_id` | O `vinculo` liga a obra da contratada à obra de quem contratou (HS-05, CO-14). |
| `rdos` | `empresa_id`, `obra_id`, `data`, `numero`, `status` (rascunho · enviado · ajuste · aprovado), `autor`, `conteudo jsonb` (clima, equipe, equipamentos, atividades, ocorrências, observações), `enviado_em`, `aprovado_em`, `aprovado_por`, `aprovado_por_empresa`, `hash_documento`, `codigo` | Aprovado = lacrado: o gatilho recusa `update` depois da aprovação. Quem aprova pode ser de outra empresa (HS-11): só pela função `aprovar_rdo(id)`. |
| `rdo_fotos` | `rdo_id`, `path` (Storage), `legenda`, `tirada_em`, `lat`, `lon`, `fonte_gps`, `precisao`, `largura`, `altura`, `tamanho`, `hash_original` | |
| `rdo_historico` | `rdo_id`, `em`, `quem`, `acao` | Só `insert`. |
| `cronograma_etapas` | `empresa_id`, `obra_id`, `nome`, `inicio`, `fim`, `responsavel_id`, `pct`, `ordem` | |
| `etapa_avancos` | `etapa_id`, `em`, `pct`, `fonte` (manual · rdo), `rdo_id`, `por` | Só `insert` (SET-052). |
| `linhas_base` | `empresa_id`, `obra_id`, `em`, `por`, `motivo`, `etapas jsonb` | Só `insert` (SET-051). |
| `publicacoes_cronograma` | `de_empresa_id`, `para_empresa_id`, `para_obra_id`, `versao`, `em`, `por`, `retrato jsonb` | Só `insert`; a contratante lê pela função `cronogramas_recebidos(obra_id)` (SET-057). |
| `modelos_cronograma` | `empresa_id`, `nome`, `etapas jsonb` | |

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
- **Região do projeto Supabase:** conferir na fatia 1; o ideal para clientes nos EUA é uma região dos EUA (se não for, criar outro projeto agora, ainda vazio).
- **Conflito no offline:** o diário é de quem o abriu; se outro aparelho alterou sem sinal, o segundo recebe o aviso e escolhe a versão.
- **Pagamento dos planos** (Stripe) e o fim do teste: **a última coisa do projeto**, junto com o preço.

## 9. Migrações, em fatias

Cada fatia é um arquivo em `supabase/migrations/`, com teste das regras de acesso (um usuário de cada empresa tentando ler o que não pode), e o app passa a usar o banco naquela parte. O protótipo (`?demo`) continua como está.

| Fatia | O que entra | O app passa a |
| --- | --- | --- |
| 1 | `supabase/migrations/20261012_0001_contas_empresas.sql` (só cria): `empresas`, `membros`, `perfis_acesso`, `convites_usuario`, `admins_plataforma`, `criar_empresa()`, `convidar_usuario()`, `aceitar_convite()`, `auditoria` com `empresa_id` e motivo, aviso por e-mail lendo `membros`. Teste: `supabase/testes/0001_acesso.sql` (em transação, termina em rollback). Depois, **com o ok do usuário**, a saída de `perfis`, `contatos` e `criar_conta()` | Criar a conta, entrar (tela oficial), convidar usuários e editar perfis |
| 2 | Settings: funcionários com valores e certificações, encargos, regras de jornada, listas, contatos; obras e modelos de cronograma | Cadastrar tudo no banco |
| 3 | Daily: diários, fotos (Storage), histórico, aprovação entre empresas, link do cliente; sincronização offline | Usar o diário de verdade |
| 4 | Crew: equipes, batidas, localizações, aprovações, orçamentos; presença na obra para a contratante | Bater o ponto de verdade |
| 5 | Cronograma: etapas, avanços, linhas de base, publicações | |
| 6 | Measure: projetos, folhas (Storage), condições, medições, typicals, catálogo, preços, margens, propostas | |
| 7 | Concorrências: tudo do §6, com o link sem conta e o canal | |
| 8 | Notificações por e-mail e a área de administração da plataforma | |
