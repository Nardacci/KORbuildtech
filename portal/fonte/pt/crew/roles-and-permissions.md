# Perfis e permissões

O que cada pessoa pode fazer no Crew vem do seu **perfil de acesso** (Settings › Perfis). A empresa ajusta os perfis prontos ou cria novos.

## Permissões do Crew

| Permissão | O que libera |
|---|---|
| **Bater o próprio ponto** | **Meu ponto**: entrada, intervalo e saída no próprio celular, com GPS. |
| **Bater o ponto da equipe** | **Ponto da equipe** e **Horas**: bater o ponto da equipe e ver as horas dela. |
| **Acompanhar ponto e timesheets** | **Agora**, **Timesheets** e o **Mapa do dia** (só leitura). |
| **Aprovar e ajustar timesheets** | Aprovar, devolver, ajustar e exportar para a folha. Inclui **Acompanhar ponto e timesheets**. |
| **Ver custos e valores em dinheiro** | **Custos**, orçamentos e salários nos timesheets. Inclui **Acompanhar ponto e timesheets**. |

## Perfis prontos

| Perfil | Próprio | Equipe | Acompanhar | Aprovar | Custos | Onde o Crew abre |
|---|:---:|:---:|:---:|:---:|:---:|---|
| **Administrador** | — | — | ✓ | ✓ | ✓ | Agora |
| **Gestor de obras** | — | — | ✓ | ✓ | ✓ | Agora |
| **Encarregado** | ✓ | ✓ | — | — | — | Ponto da equipe |
| **Trabalhador** | ✓ | — | — | — | — | Meu ponto (direto, sem tela de módulos) |

!!! note "Bom saber"
    - O **trabalhador** só bate o ponto: o KORbuild abre direto no **Meu ponto** e não abre nenhuma outra tela, nem digitando o endereço.
    - **Usuário** é quem entra no sistema; **funcionário** é quem trabalha nas obras (Settings › Funcionários). O trabalhador que bate o ponto no próprio celular precisa dos dois, ligados. Quem tem o ponto batido pelo encarregado não precisa de login.
    - Trabalhadores e encarregados veem horas, nunca valores em dinheiro.

## No protótipo

O Crew é das empresas que executam (as prestadoras). A construtora não tem Crew: ela vê as pessoas e as horas das prestadoras nas obras dela, no Daily, sem valores (veja [Como o KORbuild se organiza](@/organization.html)).

| Usuário de exemplo | Empresa | Perfil | Use para mostrar |
|---|---|---|---|
| Diego Santos | Ridgeline (prestadora) | Trabalhador | **Meu ponto** |
| Carlos Mendes | Ridgeline (prestadora) | Encarregado | **Ponto da equipe** e **Horas** (a equipe do Carlos) |
| Sandra Lopes | Ridgeline (prestadora) | Administradora | **Agora**, **Timesheets**, **Custos** |
| Márcia Souza | Ridgeline (prestadora) | Gestora de obras | O escritório sem o Settings (não está na lista de entrada) |
| Tom Reilly | Northfield (prestadora) | Administrador | Uma segunda prestadora, com a própria equipe, timesheets e custos |
