# Limpar os dados de Concorrências (para homologar do zero)

**Só execute depois que o dono digitar exatamente: `pode apagar as concorrencias`** (guarde em `KOR_APROVACAO`).
Sem essa frase, rode apenas a PRÉVIA (somente leitura) e pare.

Regras: sem `session_replication_role = replica`; nada fora do que está listado; a conta real do dono só entra se ele escolheu o escopo "todas".

## 1. Prévia (somente leitura) — mostre a saída ao dono

```sql
select 'concorrencias' t, count(*) from public.concorrencias
union all select 'convites', count(*) from public.concorrencia_convites
union all select 'desenhos', count(*) from public.concorrencia_desenhos
union all select 'propostas', count(*) from public.concorrencia_propostas
union all select 'mensagens', count(*) from public.concorrencia_mensagens
union all select 'historico', count(*) from public.concorrencia_historico
union all select 'avisos (notificacoes)', count(*) from public.notificacoes where categoria = 'concorrencia'
union all select 'arquivos no Storage', count(*) from storage.objects where bucket_id = 'concorrencias';
-- por empresa
select e.nome, (e.plano ->> 'massa') as massa, count(*) from public.concorrencias c join public.empresas e on e.id = c.empresa_id group by 1, 2 order by 3 desc;
```

## 2. Apagar (escopo "todas as empresas") — só com a frase digitada

**Passo A — arquivos do Storage, pela API (não por SQL).** Apagar linhas de `storage.objects` por SQL pode deixar os arquivos físicos. Remova pela API (`storage.from('concorrencias').remove([...])`, em lotes, com a service role só no terminal local), listando por pasta de empresa (`<empresa_id>/<concorrencia_id>/...`). Depois confira com `list` que não sobrou nada no escopo escolhido.

**Passo B — linhas do banco, escopo A (todas as empresas):**

```sql
begin;
delete from public.notificacoes where categoria = 'concorrencia';
delete from public.fila_email where modelo in ('convite-concorrencia', 'aviso-link');
delete from public.concorrencias;   -- convites, desenhos, propostas, mensagens e histórico saem em cascata
commit;
```

**Passo B — escopo B (só a massa `pv`):**

```sql
begin;
delete from public.notificacoes where categoria = 'concorrencia' and empresa_id in (select id from public.empresas where plano ->> 'massa' = 'pv');
delete from public.concorrencias where empresa_id in (select id from public.empresas where plano ->> 'massa' = 'pv');
commit;
```

No escopo B, os arquivos do Storage seguem o mesmo escopo (só as pastas das empresas `pv`).

Depois: repita a prévia (tudo deve estar em 0) e informe as contagens. Não toque em projetos, obras, catálogo, usuários ou empresas.
