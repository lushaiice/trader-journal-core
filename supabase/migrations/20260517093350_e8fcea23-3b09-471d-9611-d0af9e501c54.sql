create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('bug', 'idea', 'friction', 'other')),
  message text not null check (char_length(message) >= 10 and char_length(message) <= 2000),
  route_at_time text,
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

create policy "Users can insert own feedback"
  on public.feedback
  for insert
  with check (auth.uid() = user_id);

create policy "Users can view own feedback"
  on public.feedback
  for select
  using (auth.uid() = user_id);