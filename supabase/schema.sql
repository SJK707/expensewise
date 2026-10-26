-- TRANSACTIONS
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  type text not null check (type in ('income', 'expense')),
  category text not null,
  description text,
  date date not null default current_date,
  payment_method text,
  created_at timestamptz not null default now()
);

-- BUDGETS (one limit per category per month)
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  category text not null,
  monthly_limit numeric(12,2) not null check (monthly_limit > 0),
  month date not null,  -- store the first day of the month, e.g. 2026-10-01
  unique (user_id, category, month)
);

-- SAVINGS GOALS
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  target_amount numeric(12,2) not null check (target_amount > 0),
  current_amount numeric(12,2) not null default 0,
  deadline date,
  created_at timestamptz not null default now()
);

-- RECURRING PAYMENTS (EMI, SIP, rent, subscriptions)
create table recurring_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  amount numeric(12,2) not null check (amount > 0),
  kind text not null check (kind in ('emi', 'sip', 'rent', 'subscription', 'insurance', 'other')),
  category text,
  frequency text not null default 'monthly' check (frequency in ('weekly', 'monthly', 'yearly')),
  next_due_date date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- INDEXES (speed up the queries we'll run most)
create index idx_transactions_user_date on transactions (user_id, date desc);
create index idx_budgets_user_month on budgets (user_id, month);



alter table transactions enable row level security;
alter table budgets enable row level security;
alter table savings_goals enable row level security;
alter table recurring_payments enable row level security;

create policy "Own transactions" on transactions
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own budgets" on budgets
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own goals" on savings_goals
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Own recurring" on recurring_payments
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);