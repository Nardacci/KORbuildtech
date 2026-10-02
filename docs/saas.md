# KORbuild — estrutura SaaS

> **Mercado-alvo: Estados Unidos.** Preços em dólar, cobrança recorrente por cartão (ex.: Stripe), impostos sobre venda de software conforme o estado, contratos e termos de uso em inglês, privacidade conforme as leis estaduais (ex.: CCPA na Califórnia).

Documento de análise de negócio. Descreve como a plataforma se organiza como SaaS: quem é o cliente, o que ele contrata, quem usa e como os dados ficam separados. O protótipo já segue esta estrutura com uma empresa fictícia; o que ainda é simulado está marcado.

## Conceitos

| Conceito | O que é | Exemplo |
| --- | --- | --- |
| **Empresa** (tenant) | O cliente da plataforma: quem assina e paga. Tudo pertence a uma empresa. | Construtora Exemplo |
| **Assinatura** | O plano da empresa, a situação (teste, ativa, em atraso, cancelada) e os limites. | Plano Profissional, teste grátis até 14/10 |
| **Módulo** | Uma parte da plataforma que a empresa contrata. | Daily, Crew, Measure |
| **Usuário** | Uma pessoa da empresa, com login próprio e um papel. | Carlos (campo), Ana (administradora) |
| **Papel** | O que o usuário pode fazer. | Administrador, Campo |
| **Obra** | Cadastro comum a todos os módulos. Unidade de cobrança. | Residencial Jardim das Flores |
| **Convidado externo** | Quem recebe informação sem ter conta: o cliente final da construtora. | Incorporadora Horizonte, pelo link do relatório |

## Regras

1. **Isolamento total entre empresas.** Uma empresa nunca vê dado de outra. Na versão real, cada registro no banco leva o identificador da empresa e as regras de acesso do banco (RLS, no Supabase) garantem o isolamento, não só a tela.
2. **Cadastros comuns.** Obras, pessoas (usuários e funcionários), funções e equipamentos pertencem à empresa, não a um módulo. É isso que permite um módulo alimentar o outro (Crew → equipe do Daily; Measure → meta de avanço do Daily).
3. **Módulo não contratado não abre.** A tela de módulos mostra todos, mas só os contratados entram; os demais levam à página do módulo (conhecer, contratar ou registrar interesse).
4. **Papéis por empresa.** O mesmo e-mail pode ser administrador numa empresa e campo em outra (ex.: um engenheiro que presta serviço para duas construtoras). Ao entrar, ele escolhe a empresa.
5. **Convidados não pagam e não contam como usuário.** O cliente final abre relatórios por link, sem conta.
6. **Teste grátis de 14 dias** com todos os módulos disponíveis; ao fim, a empresa assina ou a conta fica só leitura (os dados não são apagados).

## Papéis

| Papel | Onde trabalha | Pode |
| --- | --- | --- |
| **Administrador** | Escritório | Ver todas as obras, aprovar e pedir ajustes, gerar PDF e link do cliente, gerenciar a conta, o plano e os usuários |
| **Campo** | Canteiro | Preencher e enviar os relatórios das obras em que atua; não vê o painel nem a conta |
| **Cliente (convidado)** | Fora da empresa | Abrir os relatórios aprovados que recebeu por link |

Permissões detalhadas e a configuração da plataforma estão na proposta do Global ([`global.md`](global.md)). Papéis a avaliar depois: *Gestor* (aprova, mas não mexe no plano), *Financeiro* (só assinatura e custos do Crew) e *Fiscal do cliente* com login (para dar "ciente" no RDO).

## Modelo de cobrança (hipóteses a validar)

- **Por módulo contratado**, com preço por **obra ativa** por mês. Obra é o que a construtora já usa para orçar e cobrar; cresce junto com o cliente.
- **Usuários ilimitados.** Cobrar por usuário faz a construtora economizar acessos justamente no canteiro, que é onde o dado nasce.
- **Pacote** com desconto para quem contrata mais de um módulo, o que incentiva a ligação entre eles.
- Planos por faixa de obras ativas (ex.: até 5, até 20, acima de 20), com teste grátis de 14 dias.

Perguntas para a validação: a obra é mesmo a melhor unidade de cobrança? Quanto a construtora paga hoje por RDO, ponto e orçamento (software, planilha, horas de estagiário)? Quem decide a compra: dono, diretor de obras ou engenheiro?

## No protótipo

| Item | Situação |
| --- | --- |
| Login, tela de módulos, papéis e permissões | Funcionando (login é mockup, sem senha de verdade; todos entram na página dos módulos e o papel vale dentro do Daily) |
| Uma empresa com plano em teste, uso de obras e usuários | Funcionando, com dados fictícios |
| Registro de interesse nos módulos em breve | Funcionando; aparece na conta da empresa |
| Várias empresas isoladas | Ainda não: há uma empresa só, no navegador |
| Cadastro da empresa, convite de usuários, assinatura e cobrança | Só na tela (avisam que vêm na próxima etapa) |
| Cadastro de obras | Ainda não: as obras vêm dos dados de exemplo |
