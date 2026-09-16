-- Run this script once in Supabase SQL Editor.
create table if not exists public.priority_tasks (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  titulo text not null,
  prioridade text not null check (prioridade in ('P1', 'P2', 'P3')),
  acao text not null default '',
  data_criacao timestamptz not null default now(),
  status text not null default 'pendente' check (status in ('pendente', 'concluido'))
);

create table if not exists public.priority_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  openrouter_api_key text,
  updated_at timestamptz not null default now()
);

alter table public.priority_tasks enable row level security;
alter table public.priority_settings enable row level security;

drop policy if exists "Users manage their priority tasks" on public.priority_tasks;
create policy "Users manage their priority tasks"
  on public.priority_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage their priority settings" on public.priority_settings;
create policy "Users manage their priority settings"
  on public.priority_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
