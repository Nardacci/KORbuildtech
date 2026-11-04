# F01 · Empresa nova: da primeira entrada ao catálogo pronto

**Objetivo:** provar o que uma empresa nova precisa para começar: a pessoa entra pela primeira vez, cria a empresa, confere perfis e funções, cadastra o valor hora, um cliente, itens (material e mão de obra ligada à função) e um assembly. Ao fim, o catálogo está pronto para o F02 (projeto até liberar).

**Roda em:** conta real. Em `--real` (Supabase do `js/config.js`) o passo 1 entra pela tela de login de verdade. Sem `--real` (banco local de teste, que não tem o serviço de login), o passo 1 entra com a sessão já gravada e só confere a tela "Sua empresa"; os passos 2 a 9 são iguais nos dois modos. O cadastro por e-mail (que manda mensagem de confirmação) fica no teste `conta` e não entra aqui, para os testes não enviarem e-mail de verdade.
**Comando:** `node tests/fluxo-01-empresa-nova.test.mjs --relatorio` (banco local) ou `… --real --relatorio` (Supabase de verdade; precisa de `SUPABASE_ACCESS_TOKEN`).

**Pré-condições (feitas pelo teste, `tests/_fluxo-dados.mjs`, apagadas no fim):** só a pessoa, **Nora Nova** (`fluxo.nova@example.com`), com login confirmado e **sem empresa**. A empresa nasce no passo 2.

**Dados fixos:** empresa **"Fluxo Nova Construtora"** (atuação construtora); valor hora **Carpenter US$ 38,00** (desde hoje − 30 dias); cliente **"Cliente Nova LLC"**; itens **NV-DW** (Drywall sheet, material, US$ 14,50) e **NV-MO** (Hora de montador, mão de obra, função Carpenter); assembly **"Parede Nova"** (NV-DW `MeasuredArea / 32` com 5% de perda e NV-MO `MeasuredArea / 50`).

| # | Quem | Onde | O que faz | Esperado |
|---|---|---|---|---|
| 1 | Nora (nova, sem empresa) | Entrar | Entrar com e-mail e senha | Sem empresa, a pessoa cai em "Sua empresa", com o nome dela já preenchido |
| 2 | Nora | Sua empresa | Nome "Fluxo Nova Construtora", atuação construtora, criar | Aviso "Empresa criada. Você é o Administrador."; a área da conta mostra a empresa e "Administrador". No banco: 1 empresa e 1 membro com o perfil Administrador |
| 3 | Nora | Settings › Perfis de acesso | Só olhar | Os quatro perfis padrão; o Administrador é travado |
| 4 | Nora | Settings › Funções | Só olhar | As dez funções padrão, todas "sem valor" |
| 5 | Nora | Settings › Funções › Carpenter › Novo valor hora | Valor 38,00, desde hoje − 30 dias, motivo "Valor inicial" | O histórico mostra o valor como vigente; o valor hora padrão da função é US$ 38,00. No banco: 1 valor da função |
| 6 | Nora | Settings › Contatos › Novo | Nome "Cliente Nova LLC", papel cliente | O contato aparece na lista e no banco |
| 7 | Nora | Takeoff › Itens › Novo item | Material NV-DW (preço 14,50) e mão de obra NV-MO com a função Carpenter | Os dois itens salvos; o de mão de obra mostra o preço vindo da função (US$ 38,00) e não aceita preço digitado |
| 8 | Nora | Takeoff › Assemblies › Novo assembly | "Parede Nova" com as duas linhas (material com 5% de perda e mão de obra) | O assembly aparece na lista com "2 linhas"; no banco, 2 linhas apontando para os itens |
| 9 | Nora | Takeoff › Projetos › Novo projeto | Abrir o formulário e olhar a lista de clientes | "Cliente Nova LLC" está na lista de clientes (porta para o F02); nenhum erro de JavaScript em todo o fluxo |

**Desfaz:** a empresa dos fluxos e o login `fluxo.nova@example.com` são apagados no fim (`--manter` guarda os dados).
