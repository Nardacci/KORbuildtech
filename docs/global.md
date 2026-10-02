# KORbuild Global — configuração e parametrização da plataforma

> **Status: proposta para validação.** É a análise de negócio, escrita antes de construir. Nome provisório: **Global**.
>
> **Mercado-alvo:** Estados Unidos. **Relacionados:** [`saas.md`](saas.md) (empresa, papéis, cobrança), [`crew.md`](crew.md) (módulo Crew).

---

## 1. A ideia, em uma frase

Um lugar único, com acesso controlado, onde a empresa define **seus dados, suas pessoas, seus cadastros e suas regras**, e todos os módulos (Daily, Crew, Measure) leem dali. **Nenhuma regra de negócio fixa no código.**

## 2. Por que faz sentido (e onde estão as armadilhas)

**A favor:**
- **Uma fonte da verdade.** Hoje cada módulo tem a sua lista. As funções do Daily estão em `app.js`, as etapas do Crew em `crew.js`, os prazos do RDO em `prazos.js`. Se o cliente cria a função "Gesseiro", ela tem de aparecer no RDO **e** no ponto.
- **Cada cliente é diferente.** Prazo do RDO, raio da cerca, encargos, regras de hora extra do estado e etapas de obra mudam de empresa para empresa. O SaaS só escala se o cliente se configurar sozinho, sem pedir mudança no código.
- **Pessoas são da empresa, não de um módulo.** O funcionário aparece no ponto (Crew), na equipe do RDO (Daily) e, no futuro, na produtividade (Measure).
- **Venda e implantação.** Uma tela de configuração com padrões prontos encurta a implantação de semanas para horas.

**Os cuidados (o que diferencia uma boa parametrização de uma "tela de 200 campos"):**

1. **Parametrizar o que varia, não tudo.** Um valor vira parâmetro quando muda **entre clientes**, **entre estados ou obras** ou **com o tempo**. Princípios do produto **não** viram parâmetro. Exemplo: "batida nunca é apagada" é garantia legal e de confiança. Se fosse opção, o produto perderia o valor como prova.
2. **Padrões prontos.** Toda configuração nasce preenchida com um padrão sensato (modelo "EUA – federal", modelo "Califórnia"…). O cliente só mexe no que é diferente.
3. **Parâmetro que afeta dinheiro tem vigência.** Mudar os encargos, a regra de hora extra ou um valor hora vale **a partir de uma data** e não reescreve o passado. É o mesmo princípio que já usamos no valor hora.
   > ⚠ **Achado:** no protótipo atual, mudar os encargos em Custos **recalcula o custo de semanas passadas**. Com o Global, os encargos passam a ter vigência e esse problema acaba.
4. **Toda mudança fica auditada:** quem mudou, quando, valor antes e depois, e motivo. Configuração errada em ponto e folha vira processo trabalhista.
5. **Mostrar o impacto antes de salvar.** Por exemplo: "esta mudança altera o custo de 3 obras a partir de 13/10".
6. **Herança com exceções.** Há padrão da plataforma, a empresa ajusta, e a obra ou a pessoa sobrepõe quando precisa (seção 4).

## 3. O que entra no Global

| Seção | O que tem | Quem usa |
| --- | --- | --- |
| **Empresa** | Razão social, logo, endereço, **estado(s) onde opera**, fuso horário, moeda, idioma, **início da semana de pagamento**, formato de data | Todos (PDF, CSV, cálculos) |
| **Usuários e permissões** | Usuários, papéis e permissões por módulo (seção 5), convites, desativação | Plataforma |
| **Pessoas** (cadastro de funcionário) | Ver a seção 3.1 | Crew, Daily, Measure |
| **Obras** | Nome, cliente, endereço, **estado** (define a regra trabalhista), cerca (centro e raio), calendário de dias de trabalho, início e prazo, orçamento, responsável pelo RDO | Todos |
| **Cadastros (tabelas)** | **Funções** (com a classe de workers' comp), **etapas / cost codes** (com hierarquia), **equipes**, **equipamentos**, **feriados**, **clientes**, **tipos de ocorrência** do RDO | Todos |
| **Regras de jornada** | Ver a seção 3.2 | Crew |
| **Encargos sobre a folha** | Itens (FICA, FUTA, SUTA, workers' comp, benefícios), com **vigência**, valendo **para todos os funcionários**, com exceção por função quando necessário | Crew (custos) |
| **Ponto e GPS** | Raio padrão da cerca, frequência dos registros de localização, retenção (ex.: 90 dias), foto obrigatória ou não, ponto pela equipe e/ou pessoal, texto do aviso de localização | Crew |
| **Diário de obra** | Horário-limite do RDO (18h), lembrete (16h), escalada para o escritório (8h), quantos dias para trás cobrar, quem aprova | Daily |
| **Custos e projeção** | Faixa de "Atenção" (ex.: até 5% acima), janela do ritmo (ex.: 4 semanas), método de projeção, rateio da hora extra (pelas horas ou pela obra que causou) | Crew |
| **Notificações** | Quais alertas ficam ligados, para quem e em que horário | Todos |
| **Integrações** (futuro) | QuickBooks, Gusto, ADP, contabilidade | Crew |
| **Auditoria** | Histórico de todas as mudanças de configuração | Administrador |

### 3.1 Cadastro de funcionário (vai bem além do valor hora)

**Funcionário não é usuário.** A maioria dos trabalhadores não tem login, e o encarregado bate o ponto por eles. Quando a pessoa tem login, os dois cadastros ficam ligados.

| Grupo | Campos | Por quê |
| --- | --- | --- |
| Identificação | Nome, apelido, foto, código interno (employee ID), telefone, contato de emergência | A foto ajuda o encarregado a confirmar quem é no ponto da equipe |
| Contrato | **Classificação W-2 (empregado) ou 1099 (autônomo)**, **FLSA não isento ou isento**, admissão, desligamento, situação (ativo, afastado, desligado) | Autônomo (1099) não tem hora extra nem encargos. Classificar errado é risco legal sério nos EUA |
| Trabalho | Função (e a **classe de workers' comp** dela), equipe, obra base, encarregado | Custo correto e equipe do RDO |
| Remuneração | **Valor hora com histórico e vigência** (já existe), exceções por obra (prevailing wage, fase 2) | Folha e custo |
| Qualificações | Certificações com validade (OSHA 10/30, licença de eletricista, operador de máquina), com aviso de vencimento | Segurança e exigência do cliente da obra |
| Privacidade | Aceite do aviso de localização (data e versão do texto) | Leis estaduais de monitoramento |
| Documentos | **Não guardar SSN nem documentos de imigração.** Isso fica no sistema de folha; aqui fica só o ID para o cruzamento | Menos risco de vazamento de dado sensível |

### 3.2 Regras de jornada por estado (o "não é hardcode" mais importante)

Nos EUA, a regra que vale é a **do estado onde o trabalho foi feito**. Por isso a regra fica ligada à **obra**, não à empresa.

| Parâmetro | EUA – federal (FLSA) | Califórnia (exemplo) |
| --- | --- | --- |
| Hora extra semanal | > 40 h → 1,5× | > 40 h → 1,5× |
| Hora extra diária | — | > 8 h → 1,5×; > 12 h → 2× |
| 7º dia seguido | — | 1,5× nas primeiras 8 h; 2× depois |
| Intervalo de refeição | Não exigido | 30 min antes do fim da 5ª hora |
| Arredondamento | Permitido se neutro | Restrito |

O produto traz **modelos prontos** ("Federal", "Califórnia" e outros estados conforme a demanda). A empresa escolhe o modelo da obra e só ajusta exceções, como um acordo sindical. Os modelos são mantidos pelo KORbuild, porque o cliente não deveria precisar saber de lei para configurar.

## 4. Níveis de configuração (herança)

```
Plataforma (padrões e modelos por estado, mantidos pelo KORbuild)
  └─ Empresa (ajusta para o seu jeito)
       └─ Obra (exceções: estado, raio da cerca, calendário, prevailing wage)
            └─ Pessoa (exceções: valor hora, função, equipe)
```

Exemplos:
- **Raio da cerca:** empresa = 150 m; Galpão (terreno grande) = 300 m.
- **Regra de jornada:** empresa = Federal; obra em Los Angeles = Califórnia.
- **Encargos:** empresa = 32%; funções de maior risco (ex.: montador de estrutura) têm workers' comp maior.

A tela sempre mostra **de onde vem o valor** ("padrão da empresa" ou "definido nesta obra"), para ninguém se perder.

## 5. Permissões

O Global só abre para quem tem permissão. Proposta: papéis prontos, cada um com permissões que podem ser ajustadas.

| Permissão | Admin da conta | Gestor de obras | RH / Financeiro | Encarregado | Campo |
| --- | :-: | :-: | :-: | :-: | :-: |
| Configurar empresa, plano e usuários | ✓ | | | | |
| Configurar regras (jornada, encargos, prazos, GPS) | ✓ | | ✓ | | |
| Cadastrar obras e tabelas | ✓ | ✓ | | | |
| Cadastrar pessoas | ✓ | ✓ | ✓ | | |
| **Ver valores em dinheiro** (valor hora, custos) | ✓ | opcional | ✓ | | |
| Alterar valor hora | ✓ | | ✓ | | |
| Aprovar timesheet / RDO | ✓ | ✓ | ✓ | | |
| Bater ponto da equipe | | | | ✓ | |
| Preencher RDO | ✓ | ✓ | | ✓ | ✓ |
| Ver auditoria | ✓ | | ✓ | | |

"**Ver valores em dinheiro**" é uma permissão separada de propósito: um engenheiro pode aprovar horas sem ver o salário de cada um.

## 6. Inventário: o que hoje está fixo no código

| Hoje (arquivo) | Valor fixo | Vai para |
| --- | --- | --- |
| `crew.js` `REGRAS` | 40 h/semana, 1,5×, intervalo de 30 min após 5 h | Global › Regras de jornada (por modelo de estado, ligado à obra) |
| `crew.js` `RAIO_CERCA` | 150 m | Global › Ponto e GPS (padrão) + exceção na obra |
| `crew.js` `ETAPAS` | Fundação… Limpeza e apoio | Global › Cadastros › Etapas / cost codes |
| `crew.js` `ENCARGOS_PADRAO` | FICA 7,65; desemprego 3,4; WC 14; benefícios 7 | Global › Encargos (com vigência) |
| `crew.js` `resumoDaObra` | Atenção até 5%; ritmo de 4 semanas | Global › Custos e projeção |
| `crew-telas.js` `REGISTRO_GPS_MIN` | 15 min (5 min em deslocamento) | Global › Ponto e GPS |
| `prazos.js` | RDO até 18h, lembrete 16h, escalada 8h, 3 dias para trás, seg–sáb | Global › Diário de obra (padrão) + calendário da obra |
| `app.js` `FUNCOES`, `EQUIPAMENTOS` | Listas do RDO | Global › Cadastros (as mesmas do Crew) |
| `relatorio.js` `TIPOS_OCORRENCIA`, `SITUACOES` | Listas do RDO | Global › Cadastros |
| `plataforma.js` `PAPEIS` | Administrador e Campo | Global › Usuários e permissões |
| `exemplo.js` `CONSTRUTORA` | Nome, sigla | Global › Empresa |
| `util.js` formatação | US$, data dd/mm | Global › Empresa (moeda, idioma, formato) |

**Ficam no código, por decisão de produto:** batida imutável, ajuste como nova batida, auditoria obrigatória, isolamento entre empresas e o princípio "a cerca sinaliza, não bloqueia".

## 7. Proposta de construção, em fases

**Fase A: protótipo (próximo passo)**
1. Bloco **Global** na tela de módulos (incluído em todo plano, sem cobrança), visível só para quem tem permissão.
2. **Empresa:** dados, estado, fuso, semana de pagamento, moeda e formato.
3. **Pessoas:** cadastro completo de funcionário (3.1). A aba "Funcionários" do Crew passa a ler daqui, e o valor hora continua com histórico.
4. **Encargos com vigência**, para todos os funcionários (corrige o achado do item 2.3).
5. **Regras de jornada:** modelo "EUA – federal" editável, mais a Califórnia como exemplo, ligado à obra.
6. **Ponto e GPS**, **Diário de obra** e **Custos e projeção**: os parâmetros do inventário, lidos pelos módulos em vez das constantes.
7. **Cadastros:** funções, etapas, equipes, equipamentos e feriados.
8. **Obras:** cadastro e edição (hoje elas só existem nos dados de exemplo).
9. **Usuários e permissões:** papéis prontos e a matriz da seção 5, com "ver valores em dinheiro".
10. **Auditoria:** lista das mudanças com antes e depois.

**Fase B:** exceções por obra (prevailing wage, raio, calendário), workers' comp por classe de função, mais estados, integrações com a folha e configuração de notificações por usuário.

## 8. Decisões para validar

1. **Nome:** "Global", "Configurações" ou "Administração"? (Para o cliente americano, *Settings* ou *Admin* são os nomes usuais.)
2. **Pessoas no Global:** confirmar que o cadastro de funcionário sai do Crew e vai para o Global, e que o Crew só usa esse cadastro.
3. **Quem acessa:** começar com Admin da conta e RH/Financeiro, como na matriz da seção 5?
4. **Modelos de estado:** começar só com "Federal" e "Califórnia"? Em quais estados estão os primeiros clientes?
5. **Prioridade:** construir a Fase A inteira de uma vez, ou começar por Pessoas + Encargos + Regras de jornada, que são o que o Crew precisa agora?
