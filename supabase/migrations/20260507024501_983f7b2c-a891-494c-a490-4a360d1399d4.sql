
-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  trading_style text,
  experience_level text,
  timezone text default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "Users view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users delete own profile" on public.profiles for delete using (auth.uid() = id);

-- portfolios
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  broker text,
  base_capital numeric(14,2) default 0,
  currency text default 'INR',
  is_default boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.portfolios enable row level security;
create policy "own portfolios select" on public.portfolios for select using (auth.uid() = user_id);
create policy "own portfolios insert" on public.portfolios for insert with check (auth.uid() = user_id);
create policy "own portfolios update" on public.portfolios for update using (auth.uid() = user_id);
create policy "own portfolios delete" on public.portfolios for delete using (auth.uid() = user_id);

-- trades
create table public.trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete set null,
  symbol text not null,
  instrument_type text not null default 'equity',
  side text not null default 'long',
  entry_price numeric(14,4) not null,
  quantity numeric(14,4) not null,
  entry_date timestamptz not null default now(),
  stop_loss numeric(14,4),
  target_price numeric(14,4),
  strategy text,
  setup text,
  notes text,
  emotion_tags text[],
  screenshot_url text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trades enable row level security;
create policy "own trades select" on public.trades for select using (auth.uid() = user_id);
create policy "own trades insert" on public.trades for insert with check (auth.uid() = user_id);
create policy "own trades update" on public.trades for update using (auth.uid() = user_id);
create policy "own trades delete" on public.trades for delete using (auth.uid() = user_id);
create index trades_user_idx on public.trades(user_id, entry_date desc);

-- trade_exits
create table public.trade_exits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id uuid not null references public.trades(id) on delete cascade,
  exit_price numeric(14,4) not null,
  quantity numeric(14,4) not null,
  exit_date timestamptz not null default now(),
  fees numeric(14,4) default 0,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.trade_exits enable row level security;
create policy "own exits select" on public.trade_exits for select using (auth.uid() = user_id);
create policy "own exits insert" on public.trade_exits for insert with check (auth.uid() = user_id);
create policy "own exits update" on public.trade_exits for update using (auth.uid() = user_id);
create policy "own exits delete" on public.trade_exits for delete using (auth.uid() = user_id);

-- daily_journals
create table public.daily_journals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  journal_date date not null default current_date,
  mood int,
  energy int,
  focus int,
  market_view text,
  pre_market_notes text,
  post_market_notes text,
  lessons text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, journal_date)
);
alter table public.daily_journals enable row level security;
create policy "own journals select" on public.daily_journals for select using (auth.uid() = user_id);
create policy "own journals insert" on public.daily_journals for insert with check (auth.uid() = user_id);
create policy "own journals update" on public.daily_journals for update using (auth.uid() = user_id);
create policy "own journals delete" on public.daily_journals for delete using (auth.uid() = user_id);

-- discipline_logs
create table public.discipline_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null default current_date,
  rule text not null,
  followed boolean not null default true,
  notes text,
  created_at timestamptz not null default now()
);
alter table public.discipline_logs enable row level security;
create policy "own discipline select" on public.discipline_logs for select using (auth.uid() = user_id);
create policy "own discipline insert" on public.discipline_logs for insert with check (auth.uid() = user_id);
create policy "own discipline update" on public.discipline_logs for update using (auth.uid() = user_id);
create policy "own discipline delete" on public.discipline_logs for delete using (auth.uid() = user_id);

-- updated_at trigger
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_portfolios_updated before update on public.portfolios for each row execute function public.set_updated_at();
create trigger trg_trades_updated before update on public.trades for each row execute function public.set_updated_at();
create trigger trg_journals_updated before update on public.daily_journals for each row execute function public.set_updated_at();

-- auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
