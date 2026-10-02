# KORbuild Crew — análise do controle de ponto e horas em campo

Documento de análise de negócio, feito antes de desenhar telas. A lista de funcionalidades que veio da pesquisa rápida (clock-in, GPS, geofence, quilometragem, escalas…) serviu de ponto de partida, **não de roteiro**: cada item foi avaliado pelo valor para o cliente, pelo risco legal e pelo custo técnico.

> **Mercado-alvo: Estados Unidos.** As regras, integrações e decisões abaixo seguem os EUA. A seção 7.2 (Brasil) fica só como referência; o Brasil não é mercado-alvo neste momento.

> **Tese:** o Crew não vende "ponto eletrônico". Vende **saber quanto custou cada obra, com prova**, sem que o mestre de obras perca tempo, e alimenta o Daily com a equipe do dia.

---

## 1. O problema que o Crew resolve

| Quem sofre | Dor de hoje | O que muda com o Crew |
| --- | --- | --- |
| Dono / diretor | Não sabe o custo real de mão de obra por obra até o fim do mês; descobre o estouro tarde | Custo de mão de obra por obra e por etapa, dia a dia |
| Escritório / folha | Cartão de papel, foto de caderno no WhatsApp, planilha. Digita tudo de novo; erro e retrabalho toda semana | Horas chegam prontas, conferidas, e saem para a folha |
| Mestre / encarregado | Anota quem veio, liga para cobrar, responde "quantas horas o fulano fez na terça?" | Bate o ponto da equipe em segundos, inclusive de quem não tem celular |
| Trabalhador | Perde hora extra por anotação errada; desconfia do registro | Vê as próprias horas e o comprovante de cada batida |
| Engenheiro / gerente de obra | Não sabe quem está em qual obra agora | "Quem está trabalhando" em tempo real, por obra |

**Perdas típicas que o cliente reconhece** (argumento de venda, a validar em entrevista):
- Horas "arredondadas para cima" no cartão manual (15 a 30 minutos por pessoa por dia somam muito numa equipe).
- "Buddy punching": um colega bate o ponto pelo outro.
- Hora apontada na obra errada, o que distorce o custo e o orçamento das próximas obras.
- Horas extras que só aparecem no fechamento da folha.
- Multas e ações trabalhistas por registro mal feito. Exemplo nos EUA: uma investigação federal de 2025 numa construtora da Flórida terminou com quase US$ 600 mil em salários atrasados e indenizações para 419 trabalhadores, por práticas de registro de horas inadequadas.

---

## 2. Atores

| Ator | Onde está | Observações importantes |
| --- | --- | --- |
| **Trabalhador** (pedreiro, servente, armador…) | Na obra | Pode **não ter smartphone**, ou não querer usar o próprio. Baixa familiaridade com app. Nos EUA, boa parte da mão de obra fala **espanhol**: o app do trabalhador precisa ter espanhol. |
| **Encarregado / mestre de obras** (foreman) | Na obra | É quem de fato controla a equipe. Precisa bater o ponto **da equipe inteira** num só aparelho. É o mesmo usuário que faz o RDO no Daily. |
| **Escritório / folha** (payroll) | Escritório | Aprova horas, corrige, exporta para a folha. Quer zero digitação. |
| **Gerente / engenheiro de obra** | Escritório e obra | Acompanha custo e quem está onde. |
| **Dono / diretor** | Escritório | Quer o número: custo por obra, horas extras, produtividade. |

Consequência de produto: o Crew tem **três jeitos de bater ponto** (seção 4), não um.

---

## 3. Conceitos (modelo de dados em linguagem de negócio)

```
Empresa ─┬─ Funcionário (função, valor/hora, equipe padrão, idioma)
         ├─ Obra / Job (endereço, cerca virtual, etapas/cost codes)
         └─ Equipe (encarregado + membros)

Funcionário ── Jornada do dia ──┬── Segmento: trabalho na Obra A · etapa Alvenaria · 07:02–11:58
                                ├── Segmento: intervalo · 12:00–13:00
                                ├── Segmento: deslocamento · 13:00–13:25
                                └── Segmento: trabalho na Obra B · etapa Elétrica · 13:25–17:04
              (cada mudança nasce de uma BATIDA)

Batida = { tipo, hora do aparelho, hora do servidor, GPS + precisão, dentro/fora da cerca,
           foto (opcional), quem registrou (o próprio, o encarregado, quiosque), aparelho }

Semana do funcionário = Timesheet → enviado → aprovado/devolvido → exportado para a folha
```

**Regras de ouro do modelo:**
1. **Batida nunca é editada nem apagada.** Correção é um **ajuste** novo (quem, quando, por quê), e o original continua visível. Isso dá defesa em fiscalização e processo, e é a mesma lógica do lacre do Daily.
2. **Hora do servidor manda**, quando houver internet. A hora do aparelho é guardada para batidas offline e comparada com a do servidor na sincronização (detecta relógio adulterado).
3. **Toda hora pertence a uma obra e a uma etapa.** Sem isso não há custo por obra, que é a razão de existir do módulo.
4. **Tudo funciona offline** e sincroniza depois. Canteiro sem sinal é regra, não exceção.

---

## 4. Como o ponto é batido: três modos

| Modo | Para quem | Como funciona | Prova de presença |
| --- | --- | --- | --- |
| **Pessoal** | Quem tem smartphone | O trabalhador bate no próprio celular, escolhendo a obra (sugerida pelo GPS) | GPS + foto opcional |
| **Pela equipe** (crew clock) | Equipe sem celular, ou empresa que não quer o celular pessoal no ponto | O encarregado marca a equipe toda num toque ("bater entrada de 8 pessoas"), e pode ajustar quem chegou atrasado | GPS do encarregado + foto do grupo ou individual |
| **Quiosque** | Canteiro grande, com container/escritório de obra | Tablet fixo na obra; cada um digita um PIN de 4 dígitos | Foto em cada batida |

A pesquisa confirma que os líderes do mercado (ClockShark, busybusy, Workyard) oferecem os três. **O modo "pela equipe" é o mais importante para o nosso público** e conversa direto com o Daily: o mesmo encarregado que bate o ponto da equipe faz o RDO, e a equipe do RDO já vem preenchida.

**Contra o "colega bate pelo outro":** usar **foto na batida** (o escritório confere por amostragem). **Não usar reconhecimento facial** no começo: nos EUA, leis de biometria como a BIPA (Illinois) exigem consentimento por escrito e política de retenção, e geraram uma onda de ações coletivas contra empresas de ponto com leitura de rosto e digital. Foto simples, sem extrair "modelo do rosto", é muito menos arriscada (confirmar com advogado antes do lançamento).

---

## 5. GPS: o que dá para fazer, o que vale a pena

### 5.1 Quatro níveis de localização

| Nível | O que registra | Valor | Custo e risco |
| --- | --- | --- | --- |
| **1. Na batida** | Posição no momento de cada batida (entrada, saída, intervalo, troca de obra) | Prova de que estava na obra. Resolve a maioria dos casos. | Baixo. Funciona até num app web. |
| **2. Na batida + cerca virtual** | O nível 1 + "dentro/fora da cerca" de cada obra | Marca automaticamente as batidas fora da obra para o escritório conferir | Baixo |
| **3. Trilha durante a jornada** (breadcrumbs) | Um ponto a cada N minutos enquanto o ponto está aberto. Gera o **mapa do dia** e a quilometragem | Descobre saídas no meio do expediente, separa deslocamento de trabalho, calcula km | **Alto**: exige app nativo, consome bateria, precisa de aviso/consentimento, é sensível para o trabalhador |
| **4. Cerca automática** | O celular percebe que entrou/saiu da obra e **lembra** de bater o ponto | Menos esquecimento de entrada e saída | **Alto**: só app nativo; limites do sistema (iOS monitora até 20 áreas por app; Android, até 100) |

### 5.2 O "mapa do dia"

É o nível 3. Para o escritório, mostra a jornada como uma linha do tempo sobre o mapa:

| Hora | Evento | Local | Situação |
| --- | --- | --- | --- |
| 06:58 | Entrada | Obra Jardim das Flores | Dentro da cerca ✓ |
| 09:40–10:05 | (trilha) saiu da cerca | Posto na Av. X, a 1,2 km | **Fora da obra com o ponto aberto** ⚠ |
| 12:00 | Intervalo | Obra Jardim das Flores | Dentro ✓ |
| 13:00 | Troca de obra | Saindo do Jardim | Deslocamento: 18 km, 25 min |
| 13:25 | Chegada | Galpão Logístico | Dentro ✓ |
| 17:04 | Saída | Galpão Logístico | Dentro ✓ |

**Valor real:** separar **deslocamento** de **trabalho** (custo correto por obra) e defender a empresa em disputa de horas. **Risco real:** parecer vigilância. A ferramenta precisa deixar claro que **só rastreia com o ponto aberto**. Rastrear fora do expediente é vedado nos EUA na prática (leis estaduais) e no Brasil (a jurisprudência trabalhista e a LGPD só admitem localização durante a jornada).

### 5.3 Limites técnicos (decisão de arquitetura)

- **Um app web (PWA), como o protótipo atual, NÃO consegue** rastrear em segundo plano nem monitorar cerca com o app fechado. Isso vale principalmente para o iPhone. Os níveis 1 e 2 funcionam em PWA. Os níveis 3 e 4 **exigem app nativo** (React Native ou Flutter).
- No Android, rastrear com o app em segundo plano exige "serviço em primeiro plano" (notificação fixa "KORbuild está registrando sua jornada") e passa por revisão da Google Play.
- **GPS dentro da obra é impreciso**: estrutura de concreto, subsolo e prédio alto erram de 20 a 100 m. Por isso a cerca deve ter margem, e "fora da cerca" deve **sinalizar, não bloquear**.
- **Polígono, não só círculo.** Obra é terreno irregular e às vezes fica ao lado de outra. O Workyard usa polígono justamente para reduzir batidas falsas.
- **GPS falsificado** (apps de "fake GPS") existe. Defesa: comparar precisão, saltos impossíveis, rede e foto, e sinalizar para conferência.

### 5.4 Recomendação

1. **Lançar com os níveis 1 e 2** (GPS na batida + cerca com sinalização), que funcionam no app web atual e cobrem a maior parte do valor.
2. **Nível 3 (trilha e mapa do dia) como opção da empresa**, ligado obra a obra ou funcionário a funcionário, com aviso aceito pelo trabalhador, **só com o ponto aberto**, retenção limitada (ex.: 90 dias) e visível também para o trabalhador. Exige app nativo: é a decisão de arquitetura mais importante do Crew.
3. **Nível 4: a cerca lembra, nunca bate sozinha.** "Você chegou ao Galpão Logístico. Bater a entrada?" Bater automaticamente gera horas erradas (passou em frente à obra, estacionou no vizinho) e passa a responsabilidade do registro para o sistema.

### 5.5 Referência: rastreamento GPS no QuickBooks Workforce (Intuit)

> **Status: em estudo.** O requisito abaixo é **provisório**. Antes de virar requisito do produto, precisamos documentar exatamente como o Workforce faz, quais são as limitações dele e o que queremos fazer diferente.

**O que a documentação atual da Intuit diz** (levantamento feito em out/2026; conferir na fonte antes de citar externamente):

| Tema | Como o Workforce faz |
| --- | --- |
| Quando grava um ponto GPS | No clock-in, no clock-out, quando o funcionário abre o app, na troca de job code (obra/etapa) e periodicamente enquanto está trabalhando |
| O que cada ponto mostra | Horário e precisão |
| Mapa | Mostra os pontos de localização e o percurso no período em que o funcionário estava com o ponto aberto, incluindo deslocamentos |
| Playback | Reproduz o movimento do funcionário em ordem cronológica, durante o período com o ponto aberto |
| Quando NÃO grava | Em intervalo (break), com o ponto fechado (clocked out) e sem conexão/desconectado. A localização fica associada só ao período "no relógio" |

**Requisito provisório: PONTO-GPS-01. Rastreamento GPS durante a jornada.** O sistema deve permitir visualizar os pontos de localização registrados durante o período de trabalho, associados à jornada do funcionário, incluindo deslocamentos entre obras e reprodução cronológica do percurso.

**O que o protótipo já demonstra** (Crew › Timesheets › dia de um funcionário, simulado):
- pontos na entrada, na saída, na troca de obra, na abertura do app e a cada 15 min (a cada 5 min em deslocamento);
- nenhum ponto no intervalo nem com o ponto fechado;
- mapa com entrada (E) e saída (S) marcadas, os pontos na ordem, setas com o sentido do percurso e deslocamento pelas ruas;
- lista "Registros de localização" com horário, local, precisão do GPS e distância desde o ponto anterior (tocar mostra o ponto no mapa);
- botão **Reproduzir** (playback): um marcador percorre o dia com o relógio na tela.

**Perguntas em aberto (para fechar antes de virar requisito):**
1. **Sem conexão:** o Workforce não grava. Nós podemos guardar os pontos no aparelho e enviar depois, como já fazemos com o RDO offline. Obra costuma ter sinal ruim, então isso pode ser um diferencial. Custo: app nativo e regras contra pontos "atrasados" adulterados.
2. **Frequência:** qual intervalo o Workforce usa e se o cliente configura? Nossa proposta: 15 min parado e mais frequente em movimento, para economizar bateria.
3. **Ponto pela equipe** (o encarregado bate para quem não tem celular): o percurso é o do celular do encarregado, não de cada trabalhador. Como mostrar isso sem enganar quem lê o mapa?
4. **Retenção e acesso:** por quanto tempo guardar e quem vê (o próprio trabalhador também vê o seu mapa?).
5. **Quilometragem:** usar o percurso para reembolso de km (mileage), como alguns concorrentes fazem?
6. **Aviso e consentimento** por estado americano (ver 7.1) e o texto da notificação fixa no Android.

---

## 6. As outras funcionalidades da lista, avaliadas

| Funcionalidade | Avaliação | Prioridade |
| --- | --- | --- |
| Entrada / saída | Núcleo | **MVP** |
| Registro pelo celular | Núcleo; mais os modos equipe e quiosque | **MVP** |
| Hora associada à obra e à etapa (job / cost code) | É o que diferencia ponto de **custo de obra** | **MVP** |
| Equipe (crew) | O encarregado bate pela equipe | **MVP** |
| Troca de obra no meio do dia | Comum em empreiteiras pequenas; gera deslocamento | **MVP** |
| Intervalos | Obrigatório por lei (Brasil; Califórnia e outros estados nos EUA) | **MVP** |
| GPS na batida + cerca com sinalização | Prova de presença com custo baixo | **MVP** |
| Timesheet semanal + aprovação/devolução | O escritório só paga o que aprovou | **MVP** |
| Exportar para a folha (CSV) | Sem isso o escritório redigita | **MVP** |
| "Quem está trabalhando agora" | Barato depois que o resto existe; o dono adora | **MVP** |
| Integração QuickBooks / Gusto / ADP | Nos EUA, é o que fecha a venda para empresas pequenas | Fase 2 |
| Trilha GPS e mapa do dia | Valioso, mas exige app nativo e cuidado com privacidade | Fase 2 (opcional por empresa) |
| Cerca que lembra de bater ponto | Exige app nativo | Fase 2 |
| Escalas / turnos planejados | Útil para equipes grandes; obra trabalha mais com "equipe na obra" do que com escala | Fase 2 |
| Relatório de folha certificada (WH-347, Davis-Bacon) | Obrigatório em obra pública federal nos EUA; poucos fazem bem. **Diferencial forte** | Fase 2 |
| Quilometragem (mileage) | Reembolso de km com carro próprio (taxa padrão do IRS em 2026: US$ 0,725/milha). Útil, mas secundário para obra | Fase 3 |
| Reconhecimento facial | Risco legal alto (biometria) | Não fazer agora |

---

## 7. Regras de jornada e pagamento que o Crew precisa calcular

### 7.1 Estados Unidos (mercado-alvo)

- **FLSA (lei federal):** hora extra (1,5×) acima de **40 horas na semana**. Arredondamento de minutos (ex.: "regra dos 7 minutos", para o quarto de hora mais próximo) é permitido **só se for neutro**, sem favorecer o empregador ao longo do tempo. Mais simples e mais seguro: **não arredondar** e pagar o minuto.
- **Deslocamento:** casa → primeira obra **não conta**; obra → obra durante o dia **conta como hora trabalhada**. Por isso a troca de obra precisa registrar o deslocamento.
- **Estados mudam muito.** Califórnia: hora extra diária (1,5× acima de 8 h no dia, 2× acima de 12 h); intervalo de 30 min para refeição acima de 5 h, um segundo acima de 10 h; pausa de 10 min a cada 4 h; multa por intervalo não concedido. Oregon proíbe arredondamento automático. Michigan e Maine têm regras próprias.
- **Localização:** não há lei federal. Vários estados exigem **aviso** (Nova York, Connecticut, Delaware e Maine têm leis de aviso de monitoramento; Nova Jersey exige aviso para rastreador em veículo) e alguns, **consentimento**. Fora do expediente, rastrear é restrito em praticamente todo o país.
- **Obra pública federal:** folha certificada semanal (formulário WH-347) com horas por dia e por classificação de função, assinada sob pena de lei.

**Implicação de produto:** as regras de hora extra e intervalo devem ser **configuráveis por estado/empresa** ("perfil de regras"), não fixas no código.

### 7.2 Brasil (só referência: fora do mercado-alvo)

- **Ponto eletrônico tem regulamentação própria (Portaria MTP 671/2021).** Um app de ponto é um **REP-P** e precisa, entre outros: registro do programa no **INPI**, hora sincronizada com a Hora Legal Brasileira (variação máxima de 30 s), relógio digital com segundos na tela da batida, **comprovante** para o trabalhador e os arquivos fiscais **AFD** e **AEJ**. A alternativa (REP-A) exige acordo ou convenção coletiva.
- Controle de jornada é obrigatório para empresas com mais de 20 empregados (CLT, art. 74). Intervalo de refeição obrigatório (1 h para jornadas acima de 6 h). Desde a reforma de 2017, o trajeto casa–obra não conta como jornada.
- Localização: a Justiça do Trabalho aceita GPS como prova de jornada, **desde que restrito ao horário de trabalho**. A LGPD exige base legal, finalidade e segurança.

**Implicação de produto (importante):** no Brasil há dois produtos possíveis:
1. **Apontamento de horas por obra** (gestão de custo, não é o ponto oficial). Sem as exigências da Portaria 671. Rápido de lançar e suficiente para o custo da obra.
2. **Ponto oficial (REP-P).** Certificação, arquivos fiscais e comprovante. Mais caro e demorado.

**Decisão:** o mercado-alvo é o dos EUA. O Crew é projetado pelas regras americanas; esta seção fica só como referência, caso o Brasil volte a ser considerado (aí, começar pelo apontamento, opção 1).

---

## 8. Como o Crew se liga ao Daily (e ao Measure)

| De → Para | O que acontece |
| --- | --- |
| Crew → Daily | Quem bateu ponto na obra hoje entra sozinho na **equipe do RDO** (função, presentes, faltas). O mestre de obras para de digitar a equipe. |
| Crew → Daily | O RDO passa a mostrar **horas trabalhadas por função** no dia, não só "6 pedreiros". |
| Daily → Crew | Dia registrado como "sem atividade" (chuva, feriado) explica a ausência de horas. |
| Crew + Measure | Horas por etapa ÷ quantidade executada = **produtividade real** (ex.: m² de alvenaria por pedreiro por dia), que melhora o próximo orçamento. |

Nenhum dos concorrentes pesquisados fecha esse ciclo **ponto → RDO → orçamento** num produto só. É o argumento principal da plataforma.

---

## 9. Mercado e concorrência

| Produto | Destaque | Preço de referência (EUA, 2026) |
| --- | --- | --- |
| **busybusy** | Plano gratuito com usuários ilimitados; GPS + equipamentos | Grátis; pago a partir de US$ 11,99/usuário + US$ 40/mês |
| **ClockShark** | Feito para empreiteira com várias obras; crew clock, quiosque, QuickBooks | US$ 9,50/usuário + US$ 42/mês |
| **Workyard** | GPS contínuo com trilha, cerca em polígono, sinaliza batida fora da obra, separa deslocamento | Não pesquisado |
| QuickBooks Time, HCSS, Procore e outros | Ponto dentro de suítes maiores | Variável |

**Leituras do mercado:**
- Os três líderes têm offline, ponto pela equipe e etapas (cost codes). Isso é **requisito básico**, não diferencial.
- O mercado cobra **por usuário**. No Daily propusemos cobrar **por obra ativa, com usuários ilimitados**. No Crew, isso é ainda mais forte: cobrar por trabalhador faz a construtora "economizar" justamente quem deveria bater ponto.
- Diferenciais possíveis para o KORbuild: **integração com o RDO**, **espanhol para o trabalhador**, **folha certificada (WH-347)** e **preço por obra**.

---

## 10. Riscos

| Risco | Mitigação |
| --- | --- |
| Rejeição dos trabalhadores ("vigilância") | Rastreio só com ponto aberto; o trabalhador vê as próprias batidas e a trilha; aviso claro; trilha opcional por empresa |
| Celular pessoal do trabalhador | Modo pela equipe e quiosque, sem exigir celular pessoal; nos EUA, avaliar reembolso de uso do celular (alguns estados exigem) |
| Erro de GPS dentro da obra | Margem na cerca, sinalizar em vez de bloquear, conferência humana |
| Regras trabalhistas variam por estado | Perfil de regras configurável; não arredondar; registrar tudo |
| Biometria | Foto sem reconhecimento facial |
| Exigir app nativo cedo demais | Lançar níveis 1 e 2 no app web; nativo só quando a trilha for validada como necessária |

---

## 11. Perguntas para validar com construtoras (entrevistas)

1. Como vocês registram as horas hoje? Quem digita, quanto tempo leva por semana?
2. Os trabalhadores têm smartphone? Aceitariam bater ponto no próprio celular?
3. Quem bate o ponto: cada um ou o encarregado pela equipe?
4. Vocês precisam saber as horas **por etapa** da obra, ou só por obra?
5. A equipe troca de obra no mesmo dia? Com que frequência?
6. Já tiveram problema de colega batendo pelo outro, ou de horas infladas?
7. Ver o mapa do dia do trabalhador seria útil ou geraria problema com a equipe?
8. Qual sistema de folha usam (QuickBooks, Gusto, ADP, outro)?
9. Fazem obra pública com folha certificada?
10. Quanto pagariam por obra/mês por ponto + RDO integrados?

---

## 12. Proposta de MVP do Crew

**Dentro:**
- Ponto pessoal, pela equipe (encarregado) e quiosque com PIN.
- Obra + etapa em toda batida; troca de obra com deslocamento.
- Intervalos.
- GPS na batida, cerca (círculo ou polígono) com sinalização de "fora da obra".
- Foto opcional na batida.
- Offline com sincronização.
- "Quem está trabalhando agora", por obra.
- Timesheet semanal, aprovação/devolução, ajustes com motivo e trilha de auditoria.
- Hora extra semanal (perfil de regras simples) e exportação CSV para a folha.
- Equipe do RDO preenchida pelo ponto.
- **App do trabalhador em inglês e espanhol** (mercado americano).

**Fora do MVP** (fase 2 em diante): trilha contínua e mapa do dia, cerca que lembra de bater ponto, integrações diretas com a folha, escalas, folha certificada, quilometragem.

**No protótipo (feito):** ponto pela equipe com GPS e cerca, troca de obra com deslocamento, intervalo, "Agora", timesheets com aprovação, devolução, ajustes e CSV, custos por obra e etapa, equipe do RDO preenchida pelo ponto, mapa do dia simulado e notificações no sininho. Ficaram para depois: ponto pessoal, quiosque com PIN, foto real na batida, espanhol e perfil de regras por estado.

---

## Fontes

- Comparativos de mercado: [FitSmallBusiness](https://fitsmallbusiness.com/human-resources/best-construction-time-tracking-apps/), [Workyard vs ClockShark](https://www.workyard.com/blog-articles/workyard-vs-clockshark), [Workyard: geofencing](https://www.workyard.com/compare/top-geofencing-time-tracking-for-construction-projects), [Workyard: quilometragem e horas](https://www.workyard.com/employee-time-tracking/construction-employee-mileage-expense-time-tracking), [ClockShark: crew clock](https://mktg.clockshark.com/tour/crew-timesheet-app), [ClockShark: quiosque](https://mktg.clockshark.com/tour/kiosk-time-clock), [Lumberfi: foreman mode](https://www.lumberfi.com/product/productivity/foreman-mode)
- Limites técnicos: [PWA no iOS](https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide), [Limites de geofencing Android/iOS](https://docs.mapp.com/limitations), [Limite de 100 cercas no Android](https://nextbillion.ai/feeds/blog/android-geofencing-api-geofence-limit-per-app), [Política de localização em segundo plano da Google Play](https://support.google.com/googleplay/android-developer/answer/17033915?hl=en)
- EUA: [Leis de GPS por estado](https://www.clockspot.com/articles/gps-time-tracking-laws-by-state), [Regra dos 7 minutos](https://ontheclock.com/blog/7-minute-rule-time-clock), [Deslocamento entre obras (29 CFR 785.38)](https://www.dol.gov/sites/dolgov/files/WHD/opinion-letters/FLSA/2020_11_03_16_FLSA.pdf), [Intervalos na Califórnia](https://ogletree.com/app/uploads/noindex/California-Break-Book.pdf), [WH-347](https://www.dol.gov/agencies/whd/forms/wh347), [Folha certificada](https://www.corpay.com/resources/blog/certified-payroll), [BIPA](https://en.wikipedia.org/wiki/Biometric_Information_Privacy_Act), [Ação BIPA contra ponto com leitura facial](https://news.bloomberglaw.com/litigation/anviz-hit-with-biometric-suit-over-face-scan-timekeeping-system)
- Brasil: [Requisitos do REP-P (Anexo IX)](https://tdn.totvs.com.br/download/attachments/809504336/ANEXO-IX-REQUISITOS-DO-REGISTRADOR-ELETRONICO-DE-PONTO-VIA-PROGRAMA-REP-P.pdf?api=v2), [Portaria 671 (FIESC)](https://www.fiesc.com.br/sites/default/files/inline-files/Informe%20Trabalhista%2019%20-%2019.11.2021.pdf), [REP-A e acordo coletivo](https://www.senior.com.br/?p=62939), [Geolocalização como prova (Lopes Castelo)](https://lopescastelo.adv.br/geolocalizacao-e-prova-digital-no-direito-do-trabalho/)

*Pesquisa feita em outubro de 2026. Regras trabalhistas e de privacidade mudam: confirmar com advogado trabalhista (EUA e Brasil) antes do lançamento.*
