-- =====================================================================
-- Atualização 1 · Cadastro de locais (unidades de saúde, escolas/CEINFs,
-- linhas de ônibus, bairros e outros locais)
--
-- Rode este arquivo UMA VEZ no SQL Editor do Supabase (projeto já criado
-- com o schema.sql). Pode rodar de novo sem perder dados.
-- =====================================================================

create table if not exists public.catalogo (
  categoria  text not null check (categoria in ('saude','educacao','onibus','bairro','outros')),
  nome       text not null check (char_length(nome) between 2 and 120),
  ativo      boolean not null default true,
  criado_em  timestamptz not null default now(),
  primary key (categoria, nome)
);

alter table public.catalogo enable row level security;
revoke all on public.catalogo from anon, authenticated;
grant select on public.catalogo to anon, authenticated;
grant insert, update, delete on public.catalogo to authenticated;

-- Qualquer pessoa vê os nomes ativos (são informação pública);
-- só o(a) Ouvidor(a) inclui, desativa ou remove.
drop policy if exists catalogo_ler on public.catalogo;
create policy catalogo_ler on public.catalogo for select to anon, authenticated
  using (ativo or public.perfil_atual() = 'ouvidor');

drop policy if exists catalogo_incluir on public.catalogo;
create policy catalogo_incluir on public.catalogo for insert to authenticated
  with check (public.perfil_atual() = 'ouvidor');

drop policy if exists catalogo_alterar on public.catalogo;
create policy catalogo_alterar on public.catalogo for update to authenticated
  using (public.perfil_atual() = 'ouvidor') with check (public.perfil_atual() = 'ouvidor');

drop policy if exists catalogo_remover on public.catalogo;
create policy catalogo_remover on public.catalogo for delete to authenticated
  using (public.perfil_atual() = 'ouvidor');
