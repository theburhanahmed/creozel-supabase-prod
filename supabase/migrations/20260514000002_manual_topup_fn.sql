-- Migration: manual_credit_topup DB function
-- Implements a SECURITY DEFINER function callable only by service-role callers
-- to manually add credits to a wallet (admin/support use cases).
-- Requirements: 5.1, 5.2, 5.3, 5.4

create or replace function public.manual_credit_topup(
  wallet_id     uuid,
  amount        integer,
  description   text,
  admin_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  new_balance integer;
begin
  -- Requirement 5.2: validate amount range
  if amount < 1 or amount > 1000000 then
    raise exception 'amount must be between 1 and 1000000';
  end if;

  -- Requirement 5.1b: atomically increment wallet balance
  update wallets
  set balance = balance + amount
  where id = wallet_id
  returning balance into new_balance;

  -- Requirement 5.3: raise if wallet not found
  if not found then
    raise exception 'wallet not found';
  end if;

  -- Requirement 5.1c: insert credit_transactions row with type 'bonus'
  insert into credit_transactions (wallet_id, type, amount, description)
  values (wallet_id, 'bonus', amount, description);

  -- Requirement 5.1d: return updated balance
  return new_balance;
end;
$$;

-- Requirement 5.4: revoke execute from public; only service role can call
revoke execute on function public.manual_credit_topup(uuid, integer, text, uuid) from public;
