-- New enums for invoices
DO $$ BEGIN
  CREATE TYPE public.invoice_request_status AS ENUM ('pending','confirmed','rejected','on_hold');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_type AS ENUM ('sale','purchase','sale_return','purchase_return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invoice_status AS ENUM ('confirmed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add partner refs to permits
ALTER TABLE public.inventory_permits
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id);

-- Invoice Requests
CREATE TABLE IF NOT EXISTS public.invoice_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number text NOT NULL UNIQUE,
  invoice_type public.invoice_type NOT NULL,
  request_date date NOT NULL DEFAULT CURRENT_DATE,
  permit_id uuid REFERENCES public.inventory_permits(id) ON DELETE SET NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  customer_id uuid REFERENCES public.customers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  counterparty_account_id uuid NOT NULL REFERENCES public.accounts(id),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status public.invoice_request_status NOT NULL DEFAULT 'pending',
  notes text,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  invoice_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_request_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.invoice_requests(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  line_order int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  invoice_type public.invoice_type NOT NULL,
  invoice_date date NOT NULL DEFAULT CURRENT_DATE,
  request_id uuid REFERENCES public.invoice_requests(id) ON DELETE SET NULL,
  permit_id uuid REFERENCES public.inventory_permits(id) ON DELETE SET NULL,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  customer_id uuid REFERENCES public.customers(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  counterparty_account_id uuid NOT NULL REFERENCES public.accounts(id),
  subtotal numeric NOT NULL DEFAULT 0,
  tax_percent numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  status public.invoice_status NOT NULL DEFAULT 'confirmed',
  notes text,
  journal_entry_id uuid REFERENCES public.journal_entries(id),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  line_order int NOT NULL DEFAULT 0
);

CREATE TRIGGER trg_invoice_requests_updated_at BEFORE UPDATE ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_invoices_updated_at BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Number generators
CREATE OR REPLACE FUNCTION public.generate_invoice_request_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE year_part text; next_seq int; prefix text;
BEGIN
  IF NEW.request_number IS NOT NULL AND NEW.request_number <> '' THEN RETURN NEW; END IF;
  year_part := TO_CHAR(COALESCE(NEW.request_date, CURRENT_DATE), 'YYYY');
  prefix := CASE NEW.invoice_type
    WHEN 'sale' THEN 'SIR'
    WHEN 'purchase' THEN 'PIR'
    WHEN 'sale_return' THEN 'SRR'
    WHEN 'purchase_return' THEN 'PRR'
  END;
  SELECT COUNT(*)+1 INTO next_seq FROM public.invoice_requests
    WHERE request_number LIKE prefix || '-' || year_part || '-%';
  NEW.request_number := prefix || '-' || year_part || '-' || LPAD(next_seq::text, 5, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_invoice_request_number BEFORE INSERT ON public.invoice_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_request_number();

CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE year_part text; next_seq int; prefix text;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND NEW.invoice_number <> '' THEN RETURN NEW; END IF;
  year_part := TO_CHAR(COALESCE(NEW.invoice_date, CURRENT_DATE), 'YYYY');
  prefix := CASE NEW.invoice_type
    WHEN 'sale' THEN 'SI'
    WHEN 'purchase' THEN 'PI'
    WHEN 'sale_return' THEN 'SR'
    WHEN 'purchase_return' THEN 'PR'
  END;
  SELECT COUNT(*)+1 INTO next_seq FROM public.invoices
    WHERE invoice_number LIKE prefix || '-' || year_part || '-%';
  NEW.invoice_number := prefix || '-' || year_part || '-' || LPAD(next_seq::text, 5, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.generate_invoice_number();

-- RLS
ALTER TABLE public.invoice_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY ir_view ON public.invoice_requests FOR SELECT
  USING (created_by = auth.uid()
      OR has_permission(auth.uid(), 'invoices.view'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'invoices.approve'::app_permission));

CREATE POLICY ir_insert ON public.invoice_requests FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'invoices.manage'::app_permission)
           OR has_permission(auth.uid(), 'inventory.approve'::app_permission));

CREATE POLICY ir_update ON public.invoice_requests FOR UPDATE
  USING (has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'invoices.approve'::app_permission));

CREATE POLICY ir_delete ON public.invoice_requests FOR DELETE
  USING (created_by = auth.uid() AND status = 'pending');

CREATE POLICY irl_view ON public.invoice_request_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoice_requests r WHERE r.id = invoice_request_lines.request_id AND
    (r.created_by = auth.uid()
      OR has_permission(auth.uid(), 'invoices.view'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'invoices.approve'::app_permission))));

CREATE POLICY irl_write ON public.invoice_request_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoice_requests r WHERE r.id = invoice_request_lines.request_id AND
    (has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'inventory.approve'::app_permission))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoice_requests r WHERE r.id = invoice_request_lines.request_id AND
    (has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'inventory.approve'::app_permission))));

CREATE POLICY inv_view ON public.invoices FOR SELECT
  USING (has_permission(auth.uid(), 'invoices.view'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'invoices.approve'::app_permission));

CREATE POLICY inv_insert ON public.invoices FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'invoices.approve'::app_permission)
           OR has_permission(auth.uid(), 'invoices.manage'::app_permission));

CREATE POLICY invl_view ON public.invoice_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id AND
    (has_permission(auth.uid(), 'invoices.view'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission)
      OR has_permission(auth.uid(), 'invoices.approve'::app_permission))));

CREATE POLICY invl_write ON public.invoice_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id AND
    (has_permission(auth.uid(), 'invoices.approve'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id AND
    (has_permission(auth.uid(), 'invoices.approve'::app_permission)
      OR has_permission(auth.uid(), 'invoices.manage'::app_permission))));