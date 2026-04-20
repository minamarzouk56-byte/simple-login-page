-- 1) Add "General" currency
INSERT INTO public.currencies (code, name_ar, symbol, is_base, exchange_rate)
VALUES ('GEN', 'عام', '*', false, 1)
ON CONFLICT (code) DO NOTHING;

-- 2) Set all existing accounts to GEN currency (temporarily, user will adjust later)
UPDATE public.accounts SET currency = 'GEN';

-- 3) Trigger on accounts: child currency must match parent currency unless parent is GEN
CREATE OR REPLACE FUNCTION public.validate_account_currency()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_currency TEXT;
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT currency INTO parent_currency FROM public.accounts WHERE id = NEW.parent_id;

  -- Parent "عام" allows any child currency
  IF parent_currency = 'GEN' THEN
    RETURN NEW;
  END IF;

  IF parent_currency <> NEW.currency THEN
    RAISE EXCEPTION 'عملة الحساب الفرعي (%) يجب أن تطابق عملة الحساب الأب (%)', NEW.currency, parent_currency;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_account_currency_trg ON public.accounts;
CREATE TRIGGER validate_account_currency_trg
  BEFORE INSERT OR UPDATE OF currency, parent_id ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.validate_account_currency();

-- 4) Update partner validation: leaf account requirement stays, but allow if account currency is GEN
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

  -- GEN account accepts any partner currency
  IF acc_currency <> 'GEN' AND acc_currency <> NEW.currency THEN
    RAISE EXCEPTION 'عملة العميل/المورد (%) لا تطابق عملة الحساب المرتبط (%)', NEW.currency, acc_currency;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.accounts WHERE parent_id = NEW.account_id) INTO has_children;
  IF has_children THEN
    RAISE EXCEPTION 'لا يمكن الربط بحساب رئيسي. اختر حساباً فرعياً (آخر مستوى)';
  END IF;

  RETURN NEW;
END;
$$;