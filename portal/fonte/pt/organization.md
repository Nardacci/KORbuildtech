# Como o KORbuild se organiza

O KORbuild é vendido como assinatura (SaaS). Cada cliente é uma **empresa**, com a própria conta, as próprias pessoas e os próprios dados. Esta página explica quem são os clientes, quem cadastra o quê e o que cada empresa vê das outras. Leia antes do guia do apresentador: todas as telas da demonstração seguem estas regras.

## Dois tipos de cliente

| Cliente | No mercado americano | O que faz no KORbuild |
|---|---|---|
| **Construtora** | *General contractor* (GC) | **Gerencia** as obras. Cadastra as obras, liga as prestadoras a elas e acompanha tudo o que fazem. Não faz diário nem bate ponto de ninguém. |
| **Prestadora de serviço** | *Subcontractor* / *trade contractor* (estrutura, framing, siding, drywall…) | **Executa.** Faz o diário de obra, o ponto da equipe e o cronograma do próprio serviço, mede plantas e envia propostas. |

Uma prestadora pode ser cliente **sozinha**, sem construtora nenhuma: por exemplo, uma empresa de siding contratada direto pelo dono da casa, ou que trabalha para uma construtora que não usa o KORbuild.

## Quem cadastra o quê

```
Construtora
├── Funcionários próprios ....... cadastrados e gerenciados pela construtora
└── Prestadoras (quantas forem)
    └── Funcionários delas ...... cadastrados e gerenciados por cada prestadora
```

| A construtora cadastra | A prestadora cadastra |
|---|---|
| As prestadoras | O cronograma do serviço dela em cada obra |
| Os próprios funcionários (gestão: engenheiros, gerentes, escritório) | Os próprios funcionários e equipes (valor hora, encargos, certificações) |
| As obras, e quais prestadoras trabalham em cada uma | O diário de obra (**Daily**) |
| Os perfis de acesso do seu pessoal | O ponto e o custo de mão de obra (**Crew**) |
| O Settings: empresa, obras, contatos, usuários | A medição e as propostas (**Measure**) |
| | O Settings: empresa, usuários, encargos, regras de jornada, contatos |
| | As obras próprias, quando trabalha direto com o dono |

!!! note "Cada empresa cuida do próprio pessoal"
    A construtora nunca vê nem edita o cadastro dos funcionários de uma prestadora, e uma prestadora nunca vê os de outra empresa. Em cada cadastro de funcionário, **Empresa (empregador)** mostra a conta a que ele pertence.

## O que cada empresa vê da outra

Quando a prestadora é contratada, ela liga a obra dela à obra da construtora. A partir daí:

| O quê | A prestadora | A construtora |
|---|---|---|
| Diário de obra | Preenche e envia | **Aprova** (ou pede ajustes) e compartilha com o dono |
| Pessoas na obra | Bate o ponto de entrada e saída | Vê **nomes, função, horário de entrada, quem está na obra agora e as horas** |
| Salários, encargos, custo de mão de obra | Vê tudo | **Nunca vê** |
| Cronograma | Monta e publica versões | Vê as versões publicadas, só leitura |

Numa obra que a prestadora tem **direto com o dono** (sem construtora), a própria prestadora aprova os diários.

!!! say "O que dizer"
    "Cada empresa cuida da própria casa — o seu pessoal, os seus salários, os seus custos. A construtora vê o que importa para tocar a obra: quem está no canteiro, quantas horas, o que foi feito em cada dia — e aprova os diários. O que a prestadora paga ao seu pessoal fica com a prestadora."

## As empresas da demonstração

| Empresa | Tipo | Com quem entrar |
|---|---|---|
| **Construtora Exemplo** | Construtora (gerencia, não executa) | Ana Ribeiro (administradora) |
| **Ridgeline Concrete & Masonry** | Prestadora: estrutura, alvenaria e pisos nas três obras da Construtora Exemplo | Sandra Lopes (administradora), Carlos Mendes (encarregado), Diego Santos (trabalhador) |
| **Northfield Framing & Siding** | Prestadora: framing e siding no Residencial Jardim das Flores, e uma obra própria com o dono (Residência Thompson) | Tom Reilly (administrador), Rita Gomes (gestora de obras), José Pereira (encarregado), Luis Ortega (trabalhador) |

![A visão da construtora numa obra: cada prestadora com as pessoas no canteiro e as horas, sem valores em dinheiro](img/daily-job-subcontractors.png)

!!! simulated "No protótipo"
    As três empresas ficam no mesmo navegador, para você entrar como cada uma, uma de cada vez. No produto, cada empresa tem a própria conta no servidor, e a construtora recebe só o que as regras acima permitem.

!!! confirm "A confirmar"
    - Se a prestadora pode escolher compartilhar menos (por exemplo, horas sem os nomes).
