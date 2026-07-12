-- Groups: book clubs / film nights (F9), group chat (F10), group AI picks (E3)
-- Run with: psql "$SUPABASE_DB_URL" -f migrations/001_groups.sql
-- (or paste into the Supabase SQL Editor)

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid references auth.users not null,
  created_at timestamptz default now()
);

create table if not exists public.group_members (
  group_id uuid references public.groups on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  added_by uuid references auth.users,
  created_at timestamptz default now(),
  primary key (group_id, user_id)
);

create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups on delete cascade not null,
  author_id uuid references auth.users not null,
  body text not null,
  created_at timestamptz default now()
);

create table if not exists public.group_picks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references public.groups on delete cascade not null,
  requested_by uuid references auth.users not null,
  constraints_text text default '',
  recommendation jsonb,
  created_at timestamptz default now()
);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_messages enable row level security;
alter table public.group_picks enable row level security;

-- Membership check as SECURITY DEFINER to avoid RLS self-recursion on
-- group_members (a policy on group_members can't subquery group_members)
create or replace function public.is_group_member(gid uuid, uid uuid)
returns boolean
language sql security definer stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members where group_id = gid and user_id = uid
  );
$$;

-- Groups: members see them; anyone can create their own; creator deletes
create policy "Members can view their groups" on public.groups
  for select using (public.is_group_member(id, auth.uid()));
create policy "Users can create groups" on public.groups
  for insert with check (auth.uid() = created_by);
create policy "Creator can delete group" on public.groups
  for delete using (auth.uid() = created_by);

-- Members: members see the roster; any member (or the creator seeding a new
-- group) can add; users can remove themselves
create policy "Members can view roster" on public.group_members
  for select using (public.is_group_member(group_id, auth.uid()));
create policy "Members can add members" on public.group_members
  for insert with check (
    public.is_group_member(group_id, auth.uid())
    or exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );
create policy "Users can leave" on public.group_members
  for delete using (auth.uid() = user_id);

-- Messages: members read and write; authors own their words
create policy "Members can read messages" on public.group_messages
  for select using (public.is_group_member(group_id, auth.uid()));
create policy "Members can send messages" on public.group_messages
  for insert with check (auth.uid() = author_id and public.is_group_member(group_id, auth.uid()));

-- Picks: members read and create
create policy "Members can read picks" on public.group_picks
  for select using (public.is_group_member(group_id, auth.uid()));
create policy "Members can create picks" on public.group_picks
  for insert with check (auth.uid() = requested_by and public.is_group_member(group_id, auth.uid()));
