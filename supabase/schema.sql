-- =====================================================================
-- Ouvidoria Municipal · esquema do banco de dados (Supabase / PostgreSQL)
--
-- Como usar: no painel do Supabase, abra "SQL Editor", cole este arquivo
-- inteiro e clique em "Run". Pode ser executado de novo sem perder dados.
--
-- ANTES DE RODAR: troque o e-mail e o nome do(a) Ouvidor(a) no final
-- deste arquivo (seção 9).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- 1. Equipe que acessa o painel
-- ---------------------------------------------------------------------
create table if not exists public.equipe (
  email       text primary key check (email = lower(email)),
  nome        text not null,
  perfil      text not null check (perfil in ('ouvidor','secretaria','consulta')),
  secretaria  text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  criado_por  text,
  constraint secretaria_obrigatoria check (perfil <> 'secretaria' or secretaria is not null)
);

-- ---------------------------------------------------------------------
-- 2. Manifestações (sem dados pessoais)
-- ---------------------------------------------------------------------
create sequence if not exists public.protocolo_seq;

create table if not exists public.manifestacoes (
  id           uuid primary key default gen_random_uuid(),
  protocolo    text not null unique,
  codigo_hash  text not null,
  tipo         text not null check (tipo in ('Reclamação','Denúncia','Solicitação','Sugestão','Elogio')),
  assunto      text not null,
  secretaria   text not null,
  unidade      text,
  endereco     text,
  bairro       text,
  descricao    text not null check (char_length(descricao) between 20 and 2000),
  modo         text not null check (modo in ('identificada','sigilo','anonima')),
  status       text not null default 'Nova' check (status in ('Nova','Em análise','Encaminhada','Respondida','Arquivada')),
  criada       timestamptz not null default now(),
  prazo        timestamptz not null default (now() + interval '30 days'),
  midias       jsonb not null default '[]'::jsonb,
  eventos      jsonb not null default '[]'::jsonb,
  ciencia      jsonb,
  sinalizada   boolean not null default false
);
create index if not exists manifestacoes_criada_idx on public.manifestacoes (criada desc);
create index if not exists manifestacoes_secretaria_idx on public.manifestacoes (secretaria);

-- ---------------------------------------------------------------------
-- 3. Dados pessoais, separados (LGPD: acesso mais restrito)
-- ---------------------------------------------------------------------
create table if not exists public.manifestacao_contato (
  manifestacao_id uuid primary key references public.manifestacoes(id) on delete cascade,
  nome    text not null,
  whats   text,
  email   text,
  avisos  text[] not null default '{}'
);

-- ---------------------------------------------------------------------
-- 4. Funções auxiliares de perfil (quem está logado e o que pode ver)
-- ---------------------------------------------------------------------
create or replace function public.meu_perfil()
returns jsonb language sql stable security definer set search_path = public as $$
  select to_jsonb(e) from public.equipe e
  where e.email = lower(coalesce(auth.jwt() ->> 'email', '')) and e.ativo
  limit 1
$$;

create or replace function public.perfil_atual()
returns text language sql stable security definer set search_path = public as $$
  select e.perfil from public.equipe e
  where e.email = lower(coalesce(auth.jwt() ->> 'email', '')) and e.ativo
  limit 1
$$;

create or replace function public.secretaria_atual()
returns text language sql stable security definer set search_path = public as $$
  select e.secretaria from public.equipe e
  where e.email = lower(coalesce(auth.jwt() ->> 'email', '')) and e.ativo
  limit 1
$$;

-- A secretaria é definida no servidor a partir do assunto (o navegador não decide)
create or replace function public.secretaria_do_assunto(p_assunto text)
returns text language sql immutable as $$
  select case p_assunto
    when 'Iluminação pública'              then 'Obras e Serviços Públicos'
    when 'Buraco ou pavimentação'          then 'Obras e Serviços Públicos'
    when 'Coleta de lixo e limpeza'        then 'Meio Ambiente e Limpeza Urbana'
    when 'Saúde · unidade ou atendimento'  then 'Saúde'
    when 'Educação · escola ou creche'     then 'Educação'
    when 'Transporte coletivo'             then 'Trânsito e Transporte'
    when 'Assistência social'              then 'Assistência Social'
    when 'Atendimento de servidor'         then 'Administração'
    else 'Ouvidoria (triagem)'
  end
$$;

-- ---------------------------------------------------------------------
-- 5. Regras de acesso (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.equipe               enable row level security;
alter table public.manifestacoes        enable row level security;
alter table public.manifestacao_contato enable row level security;

-- O público (anon) não lê nem escreve tabelas diretamente: só usa as funções da seção 6.
revoke all on public.equipe, public.manifestacoes, public.manifestacao_contato from anon;
revoke all on public.manifestacoes from authenticated;
revoke all on public.manifestacao_contato from authenticated;
revoke all on public.equipe from authenticated;

-- A equipe nunca lê o código de acesso do cidadão (codigo_hash fica de fora)
grant select (id, protocolo, tipo, assunto, secretaria, unidade, endereco, bairro, descricao, modo,
              status, criada, prazo, midias, eventos, ciencia, sinalizada)
  on public.manifestacoes to authenticated;
grant update (status, secretaria, eventos, sinalizada) on public.manifestacoes to authenticated;
grant select on public.manifestacao_contato to authenticated;
grant select, insert, update on public.equipe to authenticated;

drop policy if exists equipe_ler on public.equipe;
create policy equipe_ler on public.equipe for select to authenticated
  using (public.perfil_atual() is not null);

drop policy if exists equipe_incluir on public.equipe;
create policy equipe_incluir on public.equipe for insert to authenticated
  with check (public.perfil_atual() = 'ouvidor');

drop policy if exists equipe_alterar on public.equipe;
create policy equipe_alterar on public.equipe for update to authenticated
  using (public.perfil_atual() = 'ouvidor') with check (public.perfil_atual() = 'ouvidor');

drop policy if exists manif_ler on public.manifestacoes;
create policy manif_ler on public.manifestacoes for select to authenticated
  using (
    public.perfil_atual() in ('ouvidor','consulta')
    or (public.perfil_atual() = 'secretaria' and secretaria = public.secretaria_atual())
  );

drop policy if exists manif_alterar on public.manifestacoes;
create policy manif_alterar on public.manifestacoes for update to authenticated
  using (
    public.perfil_atual() = 'ouvidor'
    or (public.perfil_atual() = 'secretaria' and secretaria = public.secretaria_atual())
  )
  with check (
    public.perfil_atual() = 'ouvidor'
    or (public.perfil_atual() = 'secretaria' and secretaria = public.secretaria_atual())
  );

-- Dados pessoais: Ouvidoria sempre; Secretaria só nas identificadas da própria secretaria;
-- Consulta nunca. Manifestações com sigilo ficam visíveis apenas para a Ouvidoria
-- (Lei 13.460/2017, art. 10, §7º; Lei 13.608/2018, art. 4º-B).
drop policy if exists contato_ler on public.manifestacao_contato;
create policy contato_ler on public.manifestacao_contato for select to authenticated
  using (
    public.perfil_atual() = 'ouvidor'
    or (
      public.perfil_atual() = 'secretaria'
      and exists (
        select 1 from public.manifestacoes m
        where m.id = manifestacao_id and m.modo = 'identificada'
          and m.secretaria = public.secretaria_atual()
      )
    )
  );

-- ---------------------------------------------------------------------
-- 6. Funções públicas usadas pelo portal do cidadão
-- ---------------------------------------------------------------------

-- Registra a manifestação e devolve protocolo + código de acesso (mostrado uma única vez)
create or replace function public.registrar_manifestacao(p jsonb)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid;
  v_prot   text;
  v_cod    text;
  v_modo   text  := coalesce(p ->> 'modo', '');
  v_midias jsonb := coalesce(p -> 'midias', '[]'::jsonb);
  v_prazo  timestamptz := now() + interval '30 days';
  m        jsonb;
begin
  if coalesce((p -> 'ciencia' ->> 'avisoLegal')::boolean, false) is not true then
    raise exception 'É preciso confirmar a ciência do aviso legal.';
  end if;
  if jsonb_typeof(v_midias) <> 'array' or jsonb_array_length(v_midias) > 5 then
    raise exception 'Lista de arquivos inválida.';
  end if;
  for m in select * from jsonb_array_elements(v_midias) loop
    if coalesce(m ->> 'path', '') !~ '^envios/[0-9a-f-]{36}/[^/]{1,200}$' then
      raise exception 'Caminho de arquivo inválido.';
    end if;
  end loop;
  if v_modo <> 'anonima' and char_length(coalesce(trim(p ->> 'nome'), '')) < 3 then
    raise exception 'Informe o nome.';
  end if;

  v_prot := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY') || '.' || lpad(nextval('public.protocolo_seq')::text, 6, '0');
  v_cod  := upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 4) || '-' || substr(encode(gen_random_bytes(4), 'hex'), 1, 4));

  insert into public.manifestacoes
    (protocolo, codigo_hash, tipo, assunto, secretaria, unidade, endereco, bairro, descricao, modo,
     midias, eventos, ciencia, prazo)
  values
    (v_prot, crypt(v_cod, gen_salt('bf')), p ->> 'tipo', p ->> 'assunto',
     public.secretaria_do_assunto(p ->> 'assunto'),
     nullif(trim(p ->> 'unidade'), ''), nullif(trim(p ->> 'endereco'), ''), nullif(trim(p ->> 'bairro'), ''),
     trim(p ->> 'descricao'), v_modo, v_midias,
     jsonb_build_array(jsonb_build_object('t', 'Recebida', 'd', now())),
     jsonb_build_object('avisoLegal', true,
                        'privacidade', coalesce((p -> 'ciencia' ->> 'privacidade')::boolean, false),
                        'em', now(), 'versao', p -> 'ciencia' ->> 'versao'),
     v_prazo)
  returning id into v_id;

  if v_modo <> 'anonima' then
    insert into public.manifestacao_contato (manifestacao_id, nome, whats, email, avisos)
    values (v_id, trim(p ->> 'nome'), nullif(p ->> 'whats', ''), nullif(lower(trim(p ->> 'email')), ''),
            coalesce(array(select jsonb_array_elements_text(coalesce(p -> 'avisos', '[]'::jsonb))), '{}'));
  end if;

  return jsonb_build_object('protocolo', v_prot, 'codigo', v_cod, 'prazo', v_prazo, 'criada', now(),
                            'secretaria', public.secretaria_do_assunto(p ->> 'assunto'));
end $$;

-- Consulta pública: exige protocolo + código; nunca devolve dados pessoais nem registros internos
create or replace function public.consultar_manifestacao(p_protocolo text, p_codigo text)
returns jsonb language plpgsql stable security definer set search_path = public, extensions as $$
declare r public.manifestacoes;
begin
  select * into r from public.manifestacoes where protocolo = trim(p_protocolo);
  if not found or r.codigo_hash <> crypt(upper(trim(coalesce(p_codigo, ''))), r.codigo_hash) then
    return null;
  end if;
  return jsonb_build_object(
    'protocolo', r.protocolo, 'tipo', r.tipo, 'assunto', r.assunto, 'secretaria', r.secretaria,
    'unidade', r.unidade, 'endereco', r.endereco, 'bairro', r.bairro, 'status', r.status,
    'criada', r.criada, 'prazo', r.prazo,
    'eventos', (select coalesce(jsonb_agg(e - 'autor' order by ord), '[]'::jsonb)
                from jsonb_array_elements(r.eventos) with ordinality as x(e, ord)
                where coalesce(e ->> 'por', '') <> 'interno'));
end $$;

-- Complemento enviado pelo cidadão
create or replace function public.complementar_manifestacao(p_protocolo text, p_codigo text, p_texto text)
returns boolean language plpgsql security definer set search_path = public, extensions as $$
declare r public.manifestacoes;
begin
  if char_length(coalesce(trim(p_texto), '')) < 3 or char_length(p_texto) > 2000 then
    raise exception 'Escreva entre 3 e 2.000 caracteres.';
  end if;
  select * into r from public.manifestacoes where protocolo = trim(p_protocolo) for update;
  if not found or r.codigo_hash <> crypt(upper(trim(coalesce(p_codigo, ''))), r.codigo_hash) then
    return false;
  end if;
  if r.status in ('Respondida','Arquivada') then return false; end if;
  update public.manifestacoes
     set eventos = eventos || jsonb_build_array(jsonb_build_object(
           't', 'Complemento enviado pelo cidadão', 'd', now(), 'msg', trim(p_texto), 'por', 'cidadao'))
   where id = r.id;
  return true;
end $$;

revoke all on function public.registrar_manifestacao(jsonb) from public;
revoke all on function public.consultar_manifestacao(text, text) from public;
revoke all on function public.complementar_manifestacao(text, text, text) from public;
grant execute on function public.registrar_manifestacao(jsonb) to anon, authenticated;
grant execute on function public.consultar_manifestacao(text, text) to anon, authenticated;
grant execute on function public.complementar_manifestacao(text, text, text) to anon, authenticated;
grant execute on function public.meu_perfil() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Armazenamento de fotos, vídeos e áudios (bucket privado)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('midias', 'midias', false, 20971520, array[
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','video/quicktime',
  'audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/opus','audio/wav','audio/webm',
  'application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Qualquer pessoa pode ENVIAR arquivo para a pasta envios/, mas ninguém de fora pode LER
drop policy if exists midias_enviar on storage.objects;
create policy midias_enviar on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'midias' and (storage.foldername(name))[1] = 'envios');

-- Só Ouvidoria e Secretarias abrem os arquivos (por link temporário gerado no painel)
drop policy if exists midias_ver on storage.objects;
create policy midias_ver on storage.objects for select to authenticated
  using (bucket_id = 'midias' and public.perfil_atual() in ('ouvidor','secretaria'));

-- ---------------------------------------------------------------------
-- 8. (opcional) Ver o tamanho do banco: select pg_size_pretty(pg_database_size(current_database()));
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 9. PRIMEIRO(A) OUVIDOR(A) — troque o e-mail e o nome abaixo antes de rodar
-- ---------------------------------------------------------------------
insert into public.equipe (email, nome, perfil, criado_por)
values (lower('seu-email@prefeitura.gov.br'), 'Seu nome completo', 'ouvidor', 'instalação')
on conflict (email) do nothing;
