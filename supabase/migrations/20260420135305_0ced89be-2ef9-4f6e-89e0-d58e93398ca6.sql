-- Add currency column to customers and suppliers (must match linked account currency)
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EGP';
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EGP';

-- Convert account_id from text -> uuid with FK to accounts
ALTER TABLE public.customers
  ALTER COLUMN account_id TYPE UUID USING NULLIF(account_id, '')::uuid;

ALTER TABLE public.suppliers
  ALTER COLUMN account_id TYPE UUID USING NULLIF(account_id, '')::uuid;

-- Add FK constraints to accounts
ALTER TABLE public.customers
  ADD CONSTRAINT customers_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_account_id_fkey
  FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- Add FK for currency
ALTER TABLE public.customers
  ADD CONSTRAINT customers_currency_fkey
  FOREIGN KEY (currency) REFERENCES public.currencies(code);

ALTER TABLE public.suppliers
  ADD CONSTRAINT suppliers_currency_fkey
  FOREIGN KEY (currency) REFERENCES public.currencies(code);

-- Validation trigger: ensure account_id is set, is a leaf account, and currency matches
CREATE OR REPLACE FUNCTION public.validate_partner_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc_currency TEXT;
  has_children BOOLEAN;
BEGIN
  IF NEW.account_id IS NULL THEN
    RAISE EXCEPTION 'يجب ربط الحساب بحساب من شجرة الحسابات';
  END IF;

  SELECT currency INTO acc_currency FROM public.accounts WHERE id = NEW.account_id;
  IF acc_currency IS NULL THEN
    RAISE EXCEPTION 'الحساب المختار غير موجود';
  END IF;

  IF acc_currency <> NEW.currency THEN
    RAISE EXCEPTION 'عملة العميل/المورد (%) لا تطابق عملة الحساب المرتبط (%)', NEW.currency, acc_currency;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.accounts WHERE parent_id = NEW.account_id) INTO has_children;
  IF has_children THEN
    RAISE EXCEPTION 'لا يمكن الربط بحساب رئيسي. اختر حساباً فرعياً (آخر مستوى)';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_customer_account ON public.customers;
CREATE TRIGGER validate_customer_account
  BEFORE INSERT OR UPDATE OF account_id, currency ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.validate_partner_account();

DROP TRIGGER IF EXISTS validate_supplier_account ON public.suppliers;
CREATE TRIGGER validate_supplier_account
  BEFORE INSERT OR UPDATE OF account_id, currency ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.validate_partner_account();