
-- Step 2: Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_customers_code ON public.customers(code);
CREATE INDEX idx_customers_name ON public.customers(name);

ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY customers_view ON public.customers FOR SELECT
  USING (public.has_permission(auth.uid(), 'customers.view'));
CREATE POLICY customers_create ON public.customers FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'customers.create'));
CREATE POLICY customers_edit ON public.customers FOR UPDATE
  USING (public.has_permission(auth.uid(), 'customers.edit'));
CREATE POLICY customers_delete ON public.customers FOR DELETE
  USING (public.has_permission(auth.uid(), 'customers.delete'));

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate customer code if not provided (C0001, C0002, ...)
CREATE OR REPLACE FUNCTION public.generate_customer_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO next_seq FROM public.customers;
  NEW.code := 'C' || LPAD(next_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_customers_code
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.generate_customer_code();

-- Step 3: Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  credit_limit NUMERIC NOT NULL DEFAULT 0,
  opening_balance NUMERIC NOT NULL DEFAULT 0,
  account_id TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_code ON public.suppliers(code);
CREATE INDEX idx_suppliers_name ON public.suppliers(name);

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY suppliers_view ON public.suppliers FOR SELECT
  USING (public.has_permission(auth.uid(), 'suppliers.view'));
CREATE POLICY suppliers_create ON public.suppliers FOR INSERT
  WITH CHECK (public.has_permission(auth.uid(), 'suppliers.create'));
CREATE POLICY suppliers_edit ON public.suppliers FOR UPDATE
  USING (public.has_permission(auth.uid(), 'suppliers.edit'));
CREATE POLICY suppliers_delete ON public.suppliers FOR DELETE
  USING (public.has_permission(auth.uid(), 'suppliers.delete'));

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.generate_supplier_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO next_seq FROM public.suppliers;
  NEW.code := 'S' || LPAD(next_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_suppliers_code
  BEFORE INSERT ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.generate_supplier_code();

-- Step 4: Update journal_entry_lines: replace partner_id with customer_id + supplier_id
ALTER TABLE public.journal_entry_lines ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entry_lines ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL;
ALTER TABLE public.journal_entry_lines DROP COLUMN IF EXISTS partner_id;

CREATE INDEX idx_jel_customer_id ON public.journal_entry_lines(customer_id);
CREATE INDEX idx_jel_supplier_id ON public.journal_entry_lines(supplier_id);

-- Step 5: Drop old partners table & related code-gen function
DROP FUNCTION IF EXISTS public.generate_partner_code() CASCADE;
DROP TABLE IF EXISTS public.partners CASCADE;
DROP TYPE IF EXISTS public.partner_type;
