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

```sql
begin;
delete from public.notificacoes where categoria = 'concorrencia';
delete from public.fila_email where modelo in ('convite-concorrencia', 'aviso-link');
delete from public.concorrencias;   -- convites, desenhos, propostas, mensagens e histórico saem em cascata
delete from storage.objects where bucket_id = 'concorrencias';
commit;
```

Se o dono escolher só a conta dele, troque por `where empresa_id = '<id>'` (e filtre os avisos e arquivos pela pasta `<id>/`).

Depois: repita a prévia (tudo deve estar em 0) e informe as contagens. Não toque em projetos, obras, catálogo, usuários ou empresas.
