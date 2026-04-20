-- Enums
DO $$ BEGIN CREATE TYPE public.permit_type AS ENUM ('issue', 'receive');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE public.permit_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN CREATE TYPE public.movement_type AS ENUM ('in', 'out', 'adjust', 'transfer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Warehouses
CREATE TABLE IF NOT EXISTS public.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  location text,
  is_active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Categories
CREATE TABLE IF NOT EXISTS public.item_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  parent_id uuid REFERENCES public.item_categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Items
CREATE TABLE IF NOT EXISTS public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'قطعة',
  category_id uuid REFERENCES public.item_categories(id) ON DELETE SET NULL,
  default_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  sale_price numeric NOT NULL DEFAULT 0,
  min_stock numeric NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Stock per (item, warehouse)
CREATE TABLE IF NOT EXISTS public.item_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (item_id, warehouse_id)
);

-- Permits
CREATE TABLE IF NOT EXISTS public.inventory_permits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_number text NOT NULL UNIQUE,
  permit_type public.permit_type NOT NULL,
  permit_date date NOT NULL DEFAULT CURRENT_DATE,
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  counterparty_account_id uuid REFERENCES public.accounts(id),
  description text,
  notes text,
  status public.permit_status NOT NULL DEFAULT 'pending',
  total_amount numeric NOT NULL DEFAULT 0,
  requested_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_notes text,
  journal_entry_id uuid REFERENCES public.journal_entries(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Permit lines
CREATE TABLE IF NOT EXISTS public.inventory_permit_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  permit_id uuid NOT NULL REFERENCES public.inventory_permits(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  notes text,
  line_order integer NOT NULL DEFAULT 0
);

-- Stock movements
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id),
  warehouse_id uuid NOT NULL REFERENCES public.warehouses(id),
  movement_type public.movement_type NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  permit_id uuid REFERENCES public.inventory_permits(id) ON DELETE SET NULL,
  description text,
  movement_date timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Auto code triggers
CREATE OR REPLACE FUNCTION public.generate_warehouse_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO next_seq FROM public.warehouses;
  NEW.code := 'W' || LPAD(next_seq::TEXT, 3, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_warehouse_code ON public.warehouses;
CREATE TRIGGER trg_warehouse_code BEFORE INSERT ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.generate_warehouse_code();

CREATE OR REPLACE FUNCTION public.generate_category_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO next_seq FROM public.item_categories;
  NEW.code := 'CAT' || LPAD(next_seq::TEXT, 3, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_category_code ON public.item_categories;
CREATE TRIGGER trg_category_code BEFORE INSERT ON public.item_categories
  FOR EACH ROW EXECUTE FUNCTION public.generate_category_code();

CREATE OR REPLACE FUNCTION public.generate_item_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE next_seq INTEGER;
BEGIN
  IF NEW.code IS NOT NULL AND NEW.code <> '' THEN RETURN NEW; END IF;
  SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '\D', '', 'g'), '')::INTEGER), 0) + 1
    INTO next_seq FROM public.items;
  NEW.code := 'I' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_item_code ON public.items;
CREATE TRIGGER trg_item_code BEFORE INSERT ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.generate_item_code();

CREATE OR REPLACE FUNCTION public.generate_permit_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE year_part TEXT; next_seq INTEGER; prefix TEXT;
BEGIN
  IF NEW.permit_number IS NOT NULL AND NEW.permit_number <> '' THEN RETURN NEW; END IF;
  year_part := TO_CHAR(COALESCE(NEW.permit_date, CURRENT_DATE), 'YYYY');
  prefix := CASE NEW.permit_type WHEN 'issue' THEN 'OUT' ELSE 'IN' END;
  SELECT COUNT(*) + 1 INTO next_seq FROM public.inventory_permits
    WHERE permit_number LIKE prefix || '-' || year_part || '-%';
  NEW.permit_number := prefix || '-' || year_part || '-' || LPAD(next_seq::TEXT, 5, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_permit_number ON public.inventory_permits;
CREATE TRIGGER trg_permit_number BEFORE INSERT ON public.inventory_permits
  FOR EACH ROW EXECUTE FUNCTION public.generate_permit_number();

DROP TRIGGER IF EXISTS trg_warehouses_updated ON public.warehouses;
CREATE TRIGGER trg_warehouses_updated BEFORE UPDATE ON public.warehouses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_categories_updated ON public.item_categories;
CREATE TRIGGER trg_categories_updated BEFORE UPDATE ON public.item_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_items_updated ON public.items;
CREATE TRIGGER trg_items_updated BEFORE UPDATE ON public.items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_permits_updated ON public.inventory_permits;
CREATE TRIGGER trg_permits_updated BEFORE UPDATE ON public.inventory_permits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approval function
CREATE OR REPLACE FUNCTION public.approve_inventory_permit(_permit_id uuid, _review_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _permit public.inventory_permits%ROWTYPE;
  _line RECORD;
  _entry_id uuid;
  _qty_signed numeric;
  _mv_type public.movement_type;
  _inventory_account uuid;
  _line_order int := 0;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventory.approve'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية الموافقة على أذونات المخزون';
  END IF;

  SELECT * INTO _permit FROM public.inventory_permits WHERE id = _permit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود'; END IF;
  IF _permit.status <> 'pending' THEN RAISE EXCEPTION 'الإذن تم البت فيه مسبقاً'; END IF;
  IF _permit.counterparty_account_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد الحساب المقابل قبل الموافقة';
  END IF;

  IF _permit.permit_type = 'issue' THEN
    FOR _line IN
      SELECT pl.item_id, pl.quantity, COALESCE(s.quantity, 0) AS available
      FROM public.inventory_permit_lines pl
      LEFT JOIN public.item_stock s ON s.item_id = pl.item_id AND s.warehouse_id = _permit.warehouse_id
      WHERE pl.permit_id = _permit_id
    LOOP
      IF _line.quantity > _line.available THEN
        RAISE EXCEPTION 'الكمية المطلوبة للصنف تتجاوز الرصيد المتاح في المخزن';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _permit.permit_date,
    CASE _permit.permit_type WHEN 'issue' THEN 'إذن صرف مخزون: ' ELSE 'إذن وارد مخزون: ' END || COALESCE(_permit.description, _permit.permit_number),
    _permit.permit_number, _permit.total_amount, _permit.total_amount, auth.uid())
  RETURNING id INTO _entry_id;

  FOR _line IN
    SELECT pl.*, i.account_id AS item_account
    FROM public.inventory_permit_lines pl
    JOIN public.items i ON i.id = pl.item_id
    WHERE pl.permit_id = _permit_id
    ORDER BY pl.line_order
  LOOP
    _inventory_account := COALESCE(_line.item_account, _permit.counterparty_account_id);

    IF _permit.permit_type = 'receive' THEN
      INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
      VALUES (_entry_id, _inventory_account, _line.line_total, 0, COALESCE(_line.notes, 'وارد مخزون'), _line_order);
      _line_order := _line_order + 1;
      _qty_signed := _line.quantity;
      _mv_type := 'in';
    ELSE
      INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
      VALUES (_entry_id, _inventory_account, 0, _line.line_total, COALESCE(_line.notes, 'صرف مخزون'), _line_order);
      _line_order := _line_order + 1;
      _qty_signed := -_line.quantity;
      _mv_type := 'out';
    END IF;

    INSERT INTO public.item_stock (item_id, warehouse_id, quantity)
    VALUES (_line.item_id, _permit.warehouse_id, _qty_signed)
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET quantity = public.item_stock.quantity + EXCLUDED.quantity, updated_at = now();

    INSERT INTO public.stock_movements (item_id, warehouse_id, movement_type, quantity, unit_price, permit_id, description, created_by)
    VALUES (_line.item_id, _permit.warehouse_id, _mv_type, _line.quantity, _line.unit_price, _permit_id,
            _permit.permit_number || ' - ' || COALESCE(_line.notes, ''), auth.uid());
  END LOOP;

  IF _permit.permit_type = 'receive' THEN
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _permit.counterparty_account_id, 0, _permit.total_amount, 'مقابل ' || _permit.permit_number, _line_order);
  ELSE
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _permit.counterparty_account_id, _permit.total_amount, 0, 'مقابل ' || _permit.permit_number, _line_order);
  END IF;

  UPDATE public.inventory_permits
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
      review_notes = COALESCE(_review_notes, review_notes), journal_entry_id = _entry_id, updated_at = now()
  WHERE id = _permit_id;

  RETURN _entry_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_inventory_permit(_permit_id uuid, _review_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventory.approve'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية رفض الأذونات';
  END IF;
  UPDATE public.inventory_permits
  SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
      review_notes = COALESCE(_review_notes, review_notes), updated_at = now()
  WHERE id = _permit_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود أو تم البت فيه'; END IF;
END; $$;

-- RLS
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_permit_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "warehouses_view" ON public.warehouses FOR SELECT
  USING (has_permission(auth.uid(), 'inventory.view'::app_permission) OR has_permission(auth.uid(), 'inventory.request'::app_permission));
CREATE POLICY "warehouses_manage" ON public.warehouses FOR ALL
  USING (has_permission(auth.uid(), 'inventory.manage'::app_permission))
  WITH CHECK (has_permission(auth.uid(), 'inventory.manage'::app_permission));

CREATE POLICY "categories_view" ON public.item_categories FOR SELECT
  USING (has_permission(auth.uid(), 'inventory.view'::app_permission) OR has_permission(auth.uid(), 'inventory.request'::app_permission));
CREATE POLICY "categories_manage" ON public.item_categories FOR ALL
  USING (has_permission(auth.uid(), 'inventory.manage'::app_permission))
  WITH CHECK (has_permission(auth.uid(), 'inventory.manage'::app_permission));

CREATE POLICY "items_view" ON public.items FOR SELECT
  USING (has_permission(auth.uid(), 'inventory.view'::app_permission) OR has_permission(auth.uid(), 'inventory.request'::app_permission));
CREATE POLICY "items_manage" ON public.items FOR ALL
  USING (has_permission(auth.uid(), 'inventory.manage'::app_permission))
  WITH CHECK (has_permission(auth.uid(), 'inventory.manage'::app_permission));

CREATE POLICY "stock_view" ON public.item_stock FOR SELECT
  USING (has_permission(auth.uid(), 'inventory.view'::app_permission) OR has_permission(auth.uid(), 'inventory.request'::app_permission));
CREATE POLICY "stock_admin_write" ON public.item_stock FOR ALL
  USING (is_admin(auth.uid())) WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "permits_view" ON public.inventory_permits FOR SELECT
  USING (
    requested_by = auth.uid()
    OR has_permission(auth.uid(), 'inventory.approve'::app_permission)
    OR has_permission(auth.uid(), 'inventory.view'::app_permission)
  );
CREATE POLICY "permits_create" ON public.inventory_permits FOR INSERT
  WITH CHECK (has_permission(auth.uid(), 'inventory.request'::app_permission) AND requested_by = auth.uid());
CREATE POLICY "permits_update" ON public.inventory_permits FOR UPDATE
  USING (
    (requested_by = auth.uid() AND status = 'pending')
    OR has_permission(auth.uid(), 'inventory.approve'::app_permission)
  );
CREATE POLICY "permits_delete" ON public.inventory_permits FOR DELETE
  USING (requested_by = auth.uid() AND status = 'pending');

CREATE POLICY "permit_lines_view" ON public.inventory_permit_lines FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.inventory_permits p WHERE p.id = permit_id AND (
    p.requested_by = auth.uid()
    OR has_permission(auth.uid(), 'inventory.approve'::app_permission)
    OR has_permission(auth.uid(), 'inventory.view'::app_permission)
  )));
CREATE POLICY "permit_lines_write" ON public.inventory_permit_lines FOR ALL
  USING (EXISTS (SELECT 1 FROM public.inventory_permits p WHERE p.id = permit_id AND p.requested_by = auth.uid() AND p.status = 'pending'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.inventory_permits p WHERE p.id = permit_id AND p.requested_by = auth.uid() AND p.status = 'pending'));

CREATE POLICY "movements_view" ON public.stock_movements FOR SELECT
  USING (has_permission(auth.uid(), 'inventory.view'::app_permission));

CREATE INDEX IF NOT EXISTS idx_items_category ON public.items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_warehouse ON public.items(default_warehouse_id);
CREATE INDEX IF NOT EXISTS idx_stock_item ON public.item_stock(item_id);
CREATE INDEX IF NOT EXISTS idx_permits_status ON public.inventory_permits(status);
CREATE INDEX IF NOT EXISTS idx_permits_requester ON public.inventory_permits(requested_by);
CREATE INDEX IF NOT EXISTS idx_movements_item ON public.stock_movements(item_id);
CREATE INDEX IF NOT EXISTS idx_movements_warehouse ON public.stock_movements(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON public.stock_movements(movement_date DESC);