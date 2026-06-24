ALTER TABLE public.trade_exits ADD COLUMN broker_trade_id text;
CREATE UNIQUE INDEX trade_exits_user_broker_trade_unique
  ON public.trade_exits (user_id, broker_trade_id)
  WHERE broker_trade_id IS NOT NULL;