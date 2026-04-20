-- =====================================================
-- FinHub: Complete Database Schema
-- =====================================================

-- ========== ENUMS ==========
CREATE TYPE public.account_type AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');
CREATE TYPE public.partner_type AS ENUM ('customer', 'supplier', 'both');
CREATE TYPE public.journal_status AS ENUM ('posted');
CREATE TYPE public.app_permission AS ENUM (
  'accounts.view', 'accounts.create', 'accounts.edit', 'accounts.delete',
  'journal.view', 'journal.create', 'journal.edit', 'journal.delete',
  'partners.view', 'partners.create', 'partners.edit', 'partners.delete',
  'reports.view',
  'users.manage',
  'settings.manage'
);
CREATE TYPE public.inventory_request_status AS ENUM ('pending', 'approved', 'rejected', 'fulfilled');
CREATE TYPE public.custody_status AS ENUM ('active', 'settled', 'cancelled');

-- ========== TIMESTAMP TRIGGER FN ==========
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ========== PROFILES ==========
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  job_title TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_admin BOOLEAN NOT NULL DEFAULT false,
  force_password_change BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Security definer helper to check admin without recursion
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE user_id = _user_id), false)
$$;

CREATE POLICY "profiles_self_select" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_self_update" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "profiles_admin_delete" ON public.profiles
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ========== AUTO PROFILE ON SIGNUP (first user = admin) ==========
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_first BOOLEAN;
BEGIN
  SELECT NOT EXISTS (SELECT 1 FROM public.profiles) INTO is_first;
  INSERT INTO public.profiles (user_id, full_name, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    is_first
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========== USER PERMISSIONS ==========
CREATE TABLE public.user_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.app_permission NOT NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (user_id, permission)
);
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_permission(_user_id UUID, _permission public.app_permission)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.user_permissions
      WHERE user_id = _user_id AND permission = _permission
    )
$$;

CREATE POLICY "perms_self_view" ON public.user_permissions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin(auth.uid()));
CREATE POLICY "perms_admin_manage" ON public.user_permissions
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ========== CURRENCIES ==========
CREATE TABLE public.currencies (
  code TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_base BOOLEAN NOT NULL DEFAULT false,
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "currencies_authenticated_read" ON public.currencies
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "currencies_admin_manage" ON public.currencies
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.currencies (code, name_ar, symbol, is_base, exchange_rate) VALUES
  ('EGP', 'جنيه مصري', 'ج.م', true, 1),
  ('USD', 'دولار أمريكي', '$', false, 50),
  ('EUR', 'يورو', '€', false, 54),
  ('SAR', 'ريال سعودي', 'ر.س', false, 13);

-- ========== ACCOUNTS (hierarchical chart of accounts) ==========
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type public.account_type NOT NULL,
  parent_id UUID REFERENCES public.accounts(id) ON DELETE RESTRICT,
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  currency TEXT NOT NULL DEFAULT 'EGP' REFERENCES public.currencies(code),
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  opening_balance NUMERIC(18, 2) NOT NULL DEFAULT 0,
  opening_balance_debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  opening_balance_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_accounts_parent ON public.accounts(parent_id);
CREATE INDEX idx_accounts_type ON public.accounts(type);

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate account code & set level/type from parent
CREATE OR REPLACE FUNCTION public.generate_account_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_code TEXT;
  parent_level INTEGER;
  parent_type public.account_type;
  next_seq INTEGER;
  type_prefix TEXT;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
    -- Root account: prefix by type (1=asset, 2=liability, 3=equity, 4=revenue, 5=expense)
    type_prefix := CASE NEW.type
      WHEN 'asset' THEN '1'
      WHEN 'liability' THEN '2'
      WHEN 'equity' THEN '3'
      WHEN 'revenue' THEN '4'
      WHEN 'expense' THEN '5'
    END;
    SELECT COALESCE(MAX(CAST(code AS INTEGER)), CAST(type_prefix || '000' AS INTEGER)) + 1
      INTO next_seq
      FROM public.accounts
      WHERE parent_id IS NULL AND type = NEW.type;
    IF next_seq IS NULL OR next_seq::TEXT NOT LIKE type_prefix || '%' THEN
      next_seq := CAST(type_prefix || '000' AS INTEGER) + 1;
    END IF;
    NEW.code := next_seq::TEXT;
    NEW.level := 1;
  ELSE
    SELECT code, level, type INTO parent_code, parent_level, parent_type
      FROM public.accounts WHERE id = NEW.parent_id;
    NEW.level := parent_level + 1;
    NEW.type := parent_type;
    SELECT COUNT(*) + 1 INTO next_seq
      FROM public.accounts WHERE parent_id = NEW.parent_id;
    NEW.code := parent_code || '.' || LPAD(next_seq::TEXT, 2, '0');
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_generate_code
  BEFORE INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.generate_account_code();

CREATE POLICY "accounts_view" ON public.accounts
  FOR SELECT USING (public.has_permission(auth.uid(), 'accounts.view'));
CREATE POLICY "accounts_create" ON public.accounts
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'accounts.create'));
CREATE POLICY "accounts_edit" ON public.accounts
  FOR UPDATE USING (public.has_permission(auth.uid(), 'accounts.edit'));
CREATE POLICY "accounts_delete" ON public.accounts
  FOR DELETE USING (public.has_permission(auth.uid(), 'accounts.delete'));

-- ========== PARTNERS ==========
CREATE TABLE public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_ar TEXT NOT NULL,
  partner_type public.partner_type NOT NULL DEFAULT 'customer',
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_partners_type ON public.partners(partner_type);

CREATE OR REPLACE FUNCTION public.generate_partner_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;
  prefix := CASE NEW.partner_type
    WHEN 'customer' THEN 'C'
    WHEN 'supplier' THEN 'S'
    ELSE 'P'
  END;
  SELECT COUNT(*) + 1 INTO next_seq FROM public.partners WHERE partner_type = NEW.partner_type;
  NEW.code := prefix || LPAD(next_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_partners_generate_code
  BEFORE INSERT ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.generate_partner_code();

CREATE POLICY "partners_view" ON public.partners
  FOR SELECT USING (public.has_permission(auth.uid(), 'partners.view'));
CREATE POLICY "partners_create" ON public.partners
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'partners.create'));
CREATE POLICY "partners_edit" ON public.partners
  FOR UPDATE USING (public.has_permission(auth.uid(), 'partners.edit'));
CREATE POLICY "partners_delete" ON public.partners
  FOR DELETE USING (public.has_permission(auth.uid(), 'partners.delete'));

-- ========== JOURNAL ENTRIES ==========
CREATE TABLE public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  reference TEXT,
  status public.journal_status NOT NULL DEFAULT 'posted',
  total_debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  total_credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'EGP' REFERENCES public.currencies(code),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_journal_date ON public.journal_entries(entry_date DESC);

CREATE OR REPLACE FUNCTION public.generate_journal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  next_seq INTEGER;
BEGIN
  IF NEW.entry_number IS NOT NULL AND NEW.entry_number <> '' THEN
    RETURN NEW;
  END IF;
  year_part := TO_CHAR(COALESCE(NEW.entry_date, CURRENT_DATE), 'YYYY');
  SELECT COUNT(*) + 1 INTO next_seq
    FROM public.journal_entries
    WHERE entry_number LIKE 'JV-' || year_part || '-%';
  NEW.entry_number := 'JV-' || year_part || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_journal_generate_number
  BEFORE INSERT ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.generate_journal_number();

CREATE POLICY "journal_view" ON public.journal_entries
  FOR SELECT USING (public.has_permission(auth.uid(), 'journal.view'));
CREATE POLICY "journal_create" ON public.journal_entries
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'journal.create'));
CREATE POLICY "journal_edit" ON public.journal_entries
  FOR UPDATE USING (public.has_permission(auth.uid(), 'journal.edit'));
CREATE POLICY "journal_delete" ON public.journal_entries
  FOR DELETE USING (public.has_permission(auth.uid(), 'journal.delete'));

-- ========== JOURNAL ENTRY LINES ==========
CREATE TABLE public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  partner_id UUID REFERENCES public.partners(id) ON DELETE SET NULL,
  description TEXT,
  debit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'EGP' REFERENCES public.currencies(code),
  exchange_rate NUMERIC(18, 6) NOT NULL DEFAULT 1,
  line_order INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT chk_debit_or_credit CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_lines_entry ON public.journal_entry_lines(entry_id);
CREATE INDEX idx_lines_account ON public.journal_entry_lines(account_id);

CREATE POLICY "lines_view" ON public.journal_entry_lines
  FOR SELECT USING (public.has_permission(auth.uid(), 'journal.view'));
CREATE POLICY "lines_create" ON public.journal_entry_lines
  FOR INSERT WITH CHECK (public.has_permission(auth.uid(), 'journal.create'));
CREATE POLICY "lines_edit" ON public.journal_entry_lines
  FOR UPDATE USING (public.has_permission(auth.uid(), 'journal.edit'));
CREATE POLICY "lines_delete" ON public.journal_entry_lines
  FOR DELETE USING (public.has_permission(auth.uid(), 'journal.delete'));

-- ========== ACTION LOGS ==========
CREATE TABLE public.action_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_logs_user ON public.action_logs(user_id);
CREATE INDEX idx_logs_created ON public.action_logs(created_at DESC);

CREATE POLICY "logs_admin_view" ON public.action_logs
  FOR SELECT USING (public.is_admin(auth.uid()));
CREATE POLICY "logs_authenticated_insert" ON public.action_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ========== INVENTORY REQUESTS ==========
CREATE TABLE public.inventory_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  item_name TEXT NOT NULL,
  quantity NUMERIC(18, 2) NOT NULL DEFAULT 1,
  unit TEXT,
  reason TEXT,
  status public.inventory_request_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_requests ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_inv_status ON public.inventory_requests(status);
CREATE INDEX idx_inv_requester ON public.inventory_requests(requested_by);

CREATE TRIGGER trg_inv_updated_at
  BEFORE UPDATE ON public.inventory_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_inventory_request_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  next_seq INTEGER;
BEGIN
  IF NEW.request_number IS NOT NULL AND NEW.request_number <> '' THEN
    RETURN NEW;
  END IF;
  year_part := TO_CHAR(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO next_seq
    FROM public.inventory_requests
    WHERE request_number LIKE 'IR-' || year_part || '-%';
  NEW.request_number := 'IR-' || year_part || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inv_generate_number
  BEFORE INSERT ON public.inventory_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_inventory_request_number();

CREATE POLICY "inv_self_view" ON public.inventory_requests
  FOR SELECT USING (auth.uid() = requested_by OR public.is_admin(auth.uid()));
CREATE POLICY "inv_self_create" ON public.inventory_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requested_by);
CREATE POLICY "inv_admin_review" ON public.inventory_requests
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "inv_admin_delete" ON public.inventory_requests
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ========== CUSTODIES ==========
CREATE TABLE public.custodies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custody_number TEXT NOT NULL UNIQUE,
  holder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount NUMERIC(18, 2) NOT NULL DEFAULT 0,
  currency_code TEXT NOT NULL DEFAULT 'EGP' REFERENCES public.currencies(code),
  purpose TEXT,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.custody_status NOT NULL DEFAULT 'active',
  settled_at TIMESTAMPTZ,
  settled_amount NUMERIC(18, 2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.custodies ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_custody_holder ON public.custodies(holder_id);
CREATE INDEX idx_custody_status ON public.custodies(status);

CREATE TRIGGER trg_custody_updated_at
  BEFORE UPDATE ON public.custodies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_custody_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  year_part TEXT;
  next_seq INTEGER;
BEGIN
  IF NEW.custody_number IS NOT NULL AND NEW.custody_number <> '' THEN
    RETURN NEW;
  END IF;
  year_part := TO_CHAR(now(), 'YYYY');
  SELECT COUNT(*) + 1 INTO next_seq
    FROM public.custodies
    WHERE custody_number LIKE 'CU-' || year_part || '-%';
  NEW.custody_number := 'CU-' || year_part || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_custody_generate_number
  BEFORE INSERT ON public.custodies
  FOR EACH ROW EXECUTE FUNCTION public.generate_custody_number();

CREATE POLICY "custody_self_view" ON public.custodies
  FOR SELECT USING (auth.uid() = holder_id OR public.is_admin(auth.uid()));
CREATE POLICY "custody_admin_create" ON public.custodies
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "custody_admin_update" ON public.custodies
  FOR UPDATE USING (public.is_admin(auth.uid()));
CREATE POLICY "custody_admin_delete" ON public.custodies
  FOR DELETE USING (public.is_admin(auth.uid()));

-- ========== STORAGE: AVATARS BUCKET ==========
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "avatars_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "avatars_user_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "avatars_user_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
CREATE POLICY "avatars_user_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );