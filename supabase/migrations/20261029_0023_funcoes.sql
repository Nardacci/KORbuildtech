-- KORbuild · migração 0023: cadastro de Funções com valor hora padrão (docs/funcoes.md).
-- A função (Carpinteiro, Eletricista…) tem um valor hora padrão com vigência: o orçamento (Takeoff) usa o valor da função;
-- o custo real (Crew) continua usando o valor hora de cada funcionário. O item de mão de obra do catálogo pode apontar a função
-- (itens.funcao_id): o preço da hora passa a vir dela. Não apaga nem altera dado existente; cada empresa já existente recebe
-- as dez funções padrão (sem valor), e toda empresa nova também.

begin;

create table public.funcoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 80),
  ativa boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, id)
);
create unique index funcoes_nome_unico on public.funcoes (empresa_id, lower(btrim(nome)));

create table public.funcao_valores (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null default public.minha_empresa() references public.empresas (id) on delete cascade,
  funcao_id uuid not null,
  desde date not null,
  valor numeric(12,2) not null check (valor > 0),
  motivo text not null check (btrim(motivo) <> ''),
  por uuid, em timestamptz not null default now(),
  foreign key (empresa_id, funcao_id) references public.funcoes (empresa_id, id) on delete cascade,
  unique (funcao_id, desde)
);
create index funcao_valores_funcao on public.funcao_valores (funcao_id, desde);

alter table public.itens add column if not exists funcao_id uuid;
alter table public.itens add constraint itens_funcao_fk foreign key (empresa_id, funcao_id) references public.funcoes (empresa_id, id) on delete set null (funcao_id);
create index itens_funcao on public.itens (funcao_id);

create or replace function public.carimbar_atualizado() returns trigger
language plpgsql as $f$ begin new.atualizado_em := now(); return new; end $f$;
revoke all on function public.carimbar_atualizado() from public, anon, authenticated;
create trigger funcoes_atualizado before update on public.funcoes for each row execute function public.carimbar_atualizado();
create trigger funcao_valores_autor before insert on public.funcao_valores for each row execute function public.carimbar_autor();

alter table public.funcoes enable row level security;
alter table public.funcao_valores enable row level security;

-- Todos da empresa leem os nomes; escrever é de quem cuida dos funcionários ou do catálogo.
create policy funcoes_ler on public.funcoes for select to authenticated using (empresa_id = public.minha_empresa());
create policy funcoes_criar on public.funcoes for insert to authenticated
  with check (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.funcionarios') or public.tenho_permissao('measure.catalogo')));
create policy funcoes_editar on public.funcoes for update to authenticated
  using (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.funcionarios') or public.tenho_permissao('measure.catalogo'))) with check (empresa_id = public.minha_empresa());
-- Dinheiro: quem cuida dos funcionários, vê custos ou monta orçamento.
create policy funcao_valores_ler on public.funcao_valores for select to authenticated
  using (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.funcionarios') or public.tenho_permissao('crew.custos') or public.tenho_permissao('measure.medir') or public.tenho_permissao('measure.catalogo')));
create policy funcao_valores_criar on public.funcao_valores for insert to authenticated
  with check (empresa_id = public.minha_empresa() and (public.tenho_permissao('settings.funcionarios') or public.tenho_permissao('measure.catalogo')));

revoke all on public.funcoes, public.funcao_valores from anon, authenticated;
grant select, insert, update on public.funcoes to authenticated;
grant select, insert on public.funcao_valores to authenticated;

-- As dez funções padrão: nas empresas que já existem e em toda empresa nova.
create or replace function public.semear_funcoes(p_empresa uuid) returns void
language sql security definer set search_path to 'public' as $f$
  insert into public.funcoes (empresa_id, nome)
  select p_empresa, x from unnest(array['Carpenter', 'Laborer', 'Mason', 'Rebar worker', 'Electrician', 'Plumber', 'Painter', 'Superintendent', 'Foreman', 'Equipment operator']) x
  on conflict do nothing
$f$;
revoke all on function public.semear_funcoes(uuid) from public, anon, authenticated;
create or replace function public.semear_funcoes_da_empresa() returns trigger
language plpgsql security definer set search_path to 'public' as $f$
begin perform public.semear_funcoes(new.id); return new; end $f$;
revoke all on function public.semear_funcoes_da_empresa() from public, anon, authenticated;
create trigger empresas_semear_funcoes after insert on public.empresas for each row execute function public.semear_funcoes_da_empresa();
select public.semear_funcoes(id) from public.empresas;

-- auditoria (depois da semente das empresas existentes, que roda sem usuário)
create trigger funcoes_auditar after insert or update on public.funcoes for each row execute function public.auditar();
create trigger funcao_valores_auditar after insert on public.funcao_valores for each row execute function public.auditar();

commit;
