
create table public.market_prices (
  id uuid primary key default gen_random_uuid(),
  isin text,
  symbol text not null,
  yahoo_ticker text not null,
  price_date date not null,
  close numeric not null,
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  unique (symbol, price_date)
);

grant select on public.market_prices to authenticated;
grant all on public.market_prices to service_role;
alter table public.market_prices enable row level security;
create policy "market_prices readable by authenticated"
  on public.market_prices for select to authenticated using (true);

create index market_prices_symbol_date_idx on public.market_prices (symbol, price_date desc);

create table public.index_history (
  id uuid primary key default gen_random_uuid(),
  index_code text not null,
  yahoo_ticker text not null,
  price_date date not null,
  close numeric not null,
  source text not null default 'yahoo',
  fetched_at timestamptz not null default now(),
  unique (index_code, price_date)
);

grant select on public.index_history to authenticated;
grant all on public.index_history to service_role;
alter table public.index_history enable row level security;
create policy "index_history readable by authenticated"
  on public.index_history for select to authenticated using (true);

create index index_history_code_date_idx on public.index_history (index_code, price_date);
