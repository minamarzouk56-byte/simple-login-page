
-- ========================================================================
-- PHASE 1: تنظيف النظام القديم
-- ========================================================================

-- حذف الـ functions القديمة
DROP FUNCTION IF EXISTS public.confirm_invoice_request CASCADE;
DROP FUNCTION IF EXISTS public.create_invoice_request_from_permit CASCADE;
DROP FUNCTION IF EXISTS public.approve_inventory_permit CASCADE;
DROP FUNCTION IF EXISTS public.reject_inventory_permit CASCADE;
DROP FUNCTION IF EXISTS public.hold_inventory_permit CASCADE;
DROP FUNCTION IF EXISTS public.reject_invoice_request CASCADE;
DROP FUNCTION IF EXISTS public.hold_invoice_request CASCADE;
DROP FUNCTION IF EXISTS public.generate_permit_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_invoice_request_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_invoice_number CASCADE;
DROP FUNCTION IF EXISTS public.generate_inventory_request_number CASCADE;

-- حذف الجداول القديمة
DROP TABLE IF EXISTS public.invoice_lines CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_request_lines CASCADE;
DROP TABLE IF EXISTS public.invoice_requests CASCADE;
DROP TABLE IF EXISTS public.inventory_permit_lines CASCADE;
DROP TABLE IF EXISTS public.inventory_permits CASCADE;
DROP TABLE IF EXISTS public.inventory_requests CASCADE;
DROP TABLE IF EXISTS public.stock_movements CASCADE;
DROP TABLE IF EXISTS public.item_stock CASCADE;

-- حذف الـ enums القديمة
DROP TYPE IF EXISTS public.permit_status CASCADE;
DROP TYPE IF EXISTS public.permit_type CASCADE;
DROP TYPE IF EXISTS public.invoice_status CASCADE;
DROP TYPE IF EXISTS public.invoice_type CASCADE;
DROP TYPE IF EXISTS public.invoice_request_status CASCADE;
DROP TYPE IF EXISTS public.inventory_request_status CASCADE;
DROP TYPE IF EXISTS public.movement_type CASCADE;

-- تنظيف items من الأعمدة القديمة (سنحتفظ بالجدول كـ Products)
ALTER TABLE public.items DROP COLUMN IF EXISTS cost_price;
ALTER TABLE public.items DROP COLUMN IF EXISTS default_warehouse_id;
ALTER TABLE public.items DROP COLUMN IF EXISTS account_id;

-- ========================================================================
-- PHASE 2: إنشاء الـ Enums الجديدة
-- ========================================================================

CREATE TYPE public.order_type AS ENUM ('purchase','sale','sale_return','purchase_return');
CREATE TYPE public.order_status AS ENUM ('draft','pending','approved','allocated','completed','rejected','cancelled');
CREATE TYPE public.movement_type AS ENUM ('in','out','adjust','transfer');

-- ========================================================================
-- PHASE 3: جدول Batches (الدُفعات)
-- ========================================================================

CREATE TABLE public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE RESTRICT,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  quantity NUMERIC NOT NULL DEFAULT 0,
  remaining_quantity NUMERIC NOT NULL DEFAULT 0,
  display_code TEXT,
  source_order_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id, unit_cost)
);

CREATE INDEX idx_batches_product ON public.batches(product_id);
CREATE INDEX idx_batches_warehouse ON public.batches(warehouse_id);
CREATE INDEX idx_batches_remaining ON public.batches(remaining_quantity) WHERE remaining_quantity > 0;

ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "batches_view" ON public.batches FOR SELECT
USING (has_permission(auth.uid(),'inventory.view'::app_permission)
   OR has_permission(auth.uid(),'inventory.manage'::app_permission)
   OR has_permission(auth.uid(),'invoices.view'::app_permission)
   OR has_permission(auth.uid(),'invoices.manage'::app_permission));

CREATE POLICY "batches_manage" ON public.batches FOR ALL
USING (has_permission(auth.uid(),'inventory.manage'::app_permission))
WITH CHECK (has_permission(auth.uid(),'inventory.manage'::app_permission));

CREATE TRIGGER set_batches_updated_at BEFORE UPDATE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ========================================================================
-- PHASE 4: جدول Orders (الطلبات الموحد)
-- ========================================================================

CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  order_type public.order_type NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.order_status NOT NULL DEFAULT 'pending',
  
  -- الأطراف
  customer_id UUID REFERENCES public.customers(id),
  supplier_id UUID REFERENCES public.suppliers(id),
  counterparty_account_id UUID REFERENCES public.accounts(id),
  
  -- معلومات الشراء (تُملأ في مرحلة الموافقة للشراء)
  warehouse_id UUID REFERENCES public.warehouses(id),
  
  -- المالية
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_percent NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- المراجعة
  notes TEXT,
  review_notes TEXT,
  created_by UUID NOT NULL,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  allocated_by UUID,
  allocated_at TIMESTAMPTZ,
  completed_by UUID,
  completed_at TIMESTAMPTZ,
  
  -- المراجع المحاسبية
  journal_entry_id UUID REFERENCES public.journal_entries(id),
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_type ON public.orders(order_type);
CREATE INDEX idx_orders_date ON public.orders(order_date);

-- ========================================================================
-- PHASE 5: سطور الـ Orders
-- ========================================================================

CREATE TABLE public.order_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.items(id),
  quantity NUMERIC NOT NULL DEFAULT 1,
  
  -- تتُملأ عند الشراء أو عند البيع بناءً على FIFO
  unit_price NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0, -- متوسط التكلفة بعد التخصيص
  line_total NUMERIC NOT NULL DEFAULT 0,
  
  -- حالة التخصيص
  allocated_quantity NUMERIC NOT NULL DEFAULT 0,
  
  notes TEXT,
  line_order INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_order_lines_order ON public.order_lines(order_id);
CREATE INDEX idx_order_lines_product ON public.order_lines(product_id);

-- ========================================================================
-- PHASE 6: جدول ربط Sale Lines بالـ Batches
-- ========================================================================

CREATE TABLE public.order_line_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_line_id UUID NOT NULL REFERENCES public.order_lines(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_olb_line ON public.order_line_batches(order_line_id);
CREATE INDEX idx_olb_batch ON public.order_line_batches(batch_id);

-- ========================================================================
-- PHASE 7: حركات المخزون (للتاريخ)
-- ========================================================================

CREATE TABLE public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.items(id),
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id),
  batch_id UUID REFERENCES public.batches(id),
  movement_type public.movement_type NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  order_id UUID REFERENCES public.orders(id),
  description TEXT,
  movement_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movements_product ON public.stock_movements(product_id);
CREATE INDEX idx_movements_warehouse ON public.stock_movements(warehouse_id);
CREATE INDEX idx_movements_date ON public.stock_movements(movement_date DESC);

-- ========================================================================
-- PHASE 8: RLS Policies
-- ========================================================================

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_line_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- Orders
CREATE POLICY "orders_view" ON public.orders FOR SELECT
USING (created_by = auth.uid()
   OR has_permission(auth.uid(),'invoices.view'::app_permission)
   OR has_permission(auth.uid(),'invoices.manage'::app_permission)
   OR has_permission(auth.uid(),'invoices.approve'::app_permission));

CREATE POLICY "orders_create" ON public.orders FOR INSERT
WITH CHECK (has_permission(auth.uid(),'invoices.manage'::app_permission)
        OR has_permission(auth.uid(),'inventory.request'::app_permission));

CREATE POLICY "orders_update" ON public.orders FOR UPDATE
USING (has_permission(auth.uid(),'invoices.manage'::app_permission)
   OR has_permission(auth.uid(),'invoices.approve'::app_permission));

CREATE POLICY "orders_delete" ON public.orders FOR DELETE
USING (created_by = auth.uid() AND status IN ('draft','pending'));

-- Order lines
CREATE POLICY "order_lines_view" ON public.order_lines FOR SELECT
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_lines.order_id
  AND (o.created_by = auth.uid()
       OR has_permission(auth.uid(),'invoices.view'::app_permission)
       OR has_permission(auth.uid(),'invoices.manage'::app_permission)
       OR has_permission(auth.uid(),'invoices.approve'::app_permission))));

CREATE POLICY "order_lines_write" ON public.order_lines FOR ALL
USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_lines.order_id
  AND (has_permission(auth.uid(),'invoices.manage'::app_permission)
       OR has_permission(auth.uid(),'invoices.approve'::app_permission))))
WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_lines.order_id
  AND (has_permission(auth.uid(),'invoices.manage'::app_permission)
       OR has_permission(auth.uid(),'invoices.approve'::app_permission))));

-- Order line batches
CREATE POLICY "olb_view" ON public.order_line_batches FOR SELECT
USING (has_permission(auth.uid(),'invoices.view'::app_permission)
   OR has_permission(auth.uid(),'invoices.manage'::app_permission)
   OR has_permission(auth.uid(),'invoices.approve'::app_permission));

CREATE POLICY "olb_write" ON public.order_line_batches FOR ALL
USING (has_permission(auth.uid(),'invoices.approve'::app_permission)
   OR has_permission(auth.uid(),'invoices.manage'::app_permission))
WITH CHECK (has_permission(auth.uid(),'invoices.approve'::app_permission)
   OR has_permission(auth.uid(),'invoices.manage'::app_permission));

-- Stock movements
CREATE POLICY "movements_view" ON public.stock_movements FOR SELECT
USING (has_permission(auth.uid(),'inventory.view'::app_permission));

-- ========================================================================
-- PHASE 9: Triggers - الترقيم التلقائي
-- ========================================================================

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE year_part TEXT; next_seq INT; prefix TEXT;
BEGIN
  IF NEW.order_number IS NOT NULL AND NEW.order_number <> '' THEN RETURN NEW; END IF;
  year_part := TO_CHAR(COALESCE(NEW.order_date, CURRENT_DATE), 'YYYY');
  prefix := CASE NEW.order_type
    WHEN 'purchase' THEN 'PO'
    WHEN 'sale' THEN 'SO'
    WHEN 'purchase_return' THEN 'PR'
    WHEN 'sale_return' THEN 'SR'
  END;
  SELECT COUNT(*)+1 INTO next_seq FROM public.orders
    WHERE order_number LIKE prefix || '-' || year_part || '-%';
  NEW.order_number := prefix || '-' || year_part || '-' || LPAD(next_seq::text, 5, '0');
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_orders_number BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

CREATE TRIGGER set_orders_updated_at BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- توليد display_code للـ batch تلقائياً
CREATE OR REPLACE FUNCTION public.generate_batch_display_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p_code TEXT; w_code TEXT;
BEGIN
  IF NEW.display_code IS NOT NULL AND NEW.display_code <> '' THEN RETURN NEW; END IF;
  SELECT code INTO p_code FROM public.items WHERE id = NEW.product_id;
  SELECT code INTO w_code FROM public.warehouses WHERE id = NEW.warehouse_id;
  NEW.display_code := COALESCE(p_code,'?') || '-' || COALESCE(w_code,'?') || '-' || NEW.unit_cost::text;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_batch_code BEFORE INSERT ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.generate_batch_display_code();

-- ========================================================================
-- PHASE 10: RPC - تأكيد طلب الشراء (يخلق batch + يضيف stock)
-- ========================================================================

CREATE OR REPLACE FUNCTION public.approve_purchase_order(
  _order_id UUID,
  _warehouse_id UUID,
  _line_costs JSONB DEFAULT '{}'::jsonb,
  _tax_percent NUMERIC DEFAULT NULL,
  _discount_amount NUMERIC DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order public.orders%ROWTYPE;
  _line RECORD;
  _batch_id UUID;
  _entry_id UUID;
  _cost NUMERIC;
  _subtotal NUMERIC := 0;
  _tax_pct NUMERIC;
  _discount NUMERIC;
  _tax_amt NUMERIC;
  _total NUMERIC;
  _line_no INT := 0;
  _item_account UUID;
BEGIN
  IF NOT (has_permission(auth.uid(),'invoices.approve'::app_permission)
       OR has_permission(auth.uid(),'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية اعتماد طلبات الشراء';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _order.order_type NOT IN ('purchase','sale_return') THEN
    RAISE EXCEPTION 'هذه الدالة لطلبات الشراء/إرجاع المبيعات فقط';
  END IF;
  IF _order.status NOT IN ('pending','draft') THEN
    RAISE EXCEPTION 'الطلب تم اعتماده مسبقاً';
  END IF;

  _tax_pct := COALESCE(_tax_percent, _order.tax_percent);
  _discount := COALESCE(_discount_amount, _order.discount_amount);

  -- تحديث التكاليف على السطور وحساب الإجمالي
  FOR _line IN SELECT * FROM public.order_lines WHERE order_id = _order_id ORDER BY line_order LOOP
    _cost := COALESCE((_line_costs ->> _line.id::text)::numeric, _line.unit_cost, 0);
    UPDATE public.order_lines
      SET unit_cost = _cost, unit_price = _cost,
          line_total = _line.quantity * _cost,
          allocated_quantity = _line.quantity
      WHERE id = _line.id;
    _subtotal := _subtotal + (_line.quantity * _cost);
  END LOOP;

  _tax_amt := ROUND(_subtotal * _tax_pct / 100.0, 2);
  _total := _subtotal + _tax_amt - _discount;

  -- قيد محاسبي
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _order.order_date,
    CASE _order.order_type WHEN 'purchase' THEN 'فاتورة شراء: ' ELSE 'إرجاع مبيعات: ' END || _order.order_number,
    _order.order_number, _total, _total, auth.uid())
  RETURNING id INTO _entry_id;

  -- معالجة كل سطر: batch + stock + قيد
  FOR _line IN
    SELECT ol.*, i.code AS p_code FROM public.order_lines ol
    JOIN public.items i ON i.id = ol.product_id
    WHERE ol.order_id = _order_id ORDER BY ol.line_order
  LOOP
    -- batch موجود بنفس (product, warehouse, cost)?
    SELECT id INTO _batch_id FROM public.batches
      WHERE product_id = _line.product_id
        AND warehouse_id = _warehouse_id
        AND unit_cost = _line.unit_cost
      FOR UPDATE;
    
    IF _batch_id IS NULL THEN
      INSERT INTO public.batches (product_id, warehouse_id, unit_cost, quantity, remaining_quantity, source_order_id, created_by)
      VALUES (_line.product_id, _warehouse_id, _line.unit_cost, _line.quantity, _line.quantity, _order_id, auth.uid())
      RETURNING id INTO _batch_id;
    ELSE
      UPDATE public.batches
        SET quantity = quantity + _line.quantity,
            remaining_quantity = remaining_quantity + _line.quantity,
            updated_at = now()
        WHERE id = _batch_id;
    END IF;

    -- حركة مخزون
    INSERT INTO public.stock_movements (product_id, warehouse_id, batch_id, movement_type, quantity, unit_cost, order_id, description, created_by)
    VALUES (_line.product_id, _warehouse_id, _batch_id, 'in', _line.quantity, _line.unit_cost, _order_id,
            'شراء - طلب ' || _order.order_number, auth.uid());

    -- ربط السطر بالـ batch
    INSERT INTO public.order_line_batches (order_line_id, batch_id, quantity, unit_cost)
    VALUES (_line.id, _batch_id, _line.quantity, _line.unit_cost);

    -- قيد: مدين المخزون
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _order.counterparty_account_id, _line.line_total, 0,
            'مخزون: ' || _line.p_code, _line_no);
    _line_no := _line_no + 1;
  END LOOP;

  -- قيد: دائن المورد
  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
  VALUES (_entry_id, _order.counterparty_account_id, 0, _total, 'مقابل الفاتورة', _line_no);

  UPDATE public.orders
    SET status = 'completed', warehouse_id = _warehouse_id,
        subtotal = _subtotal, tax_percent = _tax_pct, tax_amount = _tax_amt,
        discount_amount = _discount, total_amount = _total,
        approved_by = auth.uid(), approved_at = now(),
        completed_by = auth.uid(), completed_at = now(),
        journal_entry_id = _entry_id,
        review_notes = COALESCE(_notes, review_notes)
    WHERE id = _order_id;

  RETURN _order_id;
END; $$;

-- ========================================================================
-- PHASE 11: RPC - تخصيص batches لطلب بيع (allocation)
-- ========================================================================

CREATE OR REPLACE FUNCTION public.allocate_sale_order(
  _order_id UUID,
  _allocations JSONB  -- [{line_id, batch_id, quantity}]
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order public.orders%ROWTYPE;
  _alloc JSONB;
  _line_id UUID;
  _batch_id UUID;
  _qty NUMERIC;
  _batch public.batches%ROWTYPE;
  _line public.order_lines%ROWTYPE;
BEGIN
  IF NOT (has_permission(auth.uid(),'invoices.approve'::app_permission)
       OR has_permission(auth.uid(),'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تخصيص الدُفعات';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _order.order_type NOT IN ('sale','purchase_return') THEN
    RAISE EXCEPTION 'التخصيص لطلبات البيع فقط';
  END IF;
  IF _order.status NOT IN ('pending','approved','allocated') THEN
    RAISE EXCEPTION 'حالة الطلب لا تسمح بالتخصيص';
  END IF;

  -- مسح التخصيص السابق
  DELETE FROM public.order_line_batches
    WHERE order_line_id IN (SELECT id FROM public.order_lines WHERE order_id = _order_id);
  UPDATE public.order_lines SET allocated_quantity = 0 WHERE order_id = _order_id;

  -- إضافة التخصيص الجديد
  FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations) LOOP
    _line_id := (_alloc->>'line_id')::UUID;
    _batch_id := (_alloc->>'batch_id')::UUID;
    _qty := (_alloc->>'quantity')::NUMERIC;

    SELECT * INTO _line FROM public.order_lines WHERE id = _line_id AND order_id = _order_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'سطر غير موجود'; END IF;

    SELECT * INTO _batch FROM public.batches WHERE id = _batch_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'الدُفعة غير موجودة'; END IF;
    IF _batch.product_id <> _line.product_id THEN
      RAISE EXCEPTION 'الدُفعة لا تطابق الصنف';
    END IF;
    IF _qty > _batch.remaining_quantity THEN
      RAISE EXCEPTION 'الكمية تتجاوز المتاح في الدُفعة %', _batch.display_code;
    END IF;

    INSERT INTO public.order_line_batches (order_line_id, batch_id, quantity, unit_cost)
    VALUES (_line_id, _batch_id, _qty, _batch.unit_cost);

    UPDATE public.order_lines SET allocated_quantity = allocated_quantity + _qty WHERE id = _line_id;
  END LOOP;

  -- التحقق: كل سطر مخصص بالكامل
  IF EXISTS (SELECT 1 FROM public.order_lines WHERE order_id = _order_id AND allocated_quantity <> quantity) THEN
    RAISE EXCEPTION 'بعض السطور غير مخصصة بالكامل';
  END IF;

  UPDATE public.orders
    SET status = 'allocated', allocated_by = auth.uid(), allocated_at = now()
    WHERE id = _order_id;
END; $$;

-- ========================================================================
-- PHASE 12: RPC - تأكيد طلب البيع (يخصم من batches + يخلق قيد)
-- ========================================================================

CREATE OR REPLACE FUNCTION public.complete_sale_order(
  _order_id UUID,
  _tax_percent NUMERIC DEFAULT NULL,
  _discount_amount NUMERIC DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _order public.orders%ROWTYPE;
  _entry_id UUID;
  _line RECORD;
  _alloc RECORD;
  _subtotal NUMERIC := 0;
  _tax_pct NUMERIC;
  _discount NUMERIC;
  _tax_amt NUMERIC;
  _total NUMERIC;
  _line_no INT := 0;
  _total_cost NUMERIC := 0;
  _wh_id UUID;
BEGIN
  IF NOT (has_permission(auth.uid(),'invoices.approve'::app_permission)
       OR has_permission(auth.uid(),'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تأكيد الطلب';
  END IF;

  SELECT * INTO _order FROM public.orders WHERE id = _order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _order.status <> 'allocated' THEN
    RAISE EXCEPTION 'يجب تخصيص الدُفعات أولاً';
  END IF;

  _tax_pct := COALESCE(_tax_percent, _order.tax_percent);
  _discount := COALESCE(_discount_amount, _order.discount_amount);

  SELECT COALESCE(SUM(line_total),0) INTO _subtotal FROM public.order_lines WHERE order_id = _order_id;
  _tax_amt := ROUND(_subtotal * _tax_pct / 100.0, 2);
  _total := _subtotal + _tax_amt - _discount;

  -- قيد
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _order.order_date,
    CASE _order.order_type WHEN 'sale' THEN 'فاتورة بيع: ' ELSE 'إرجاع مشتريات: ' END || _order.order_number,
    _order.order_number, _total, _total, auth.uid())
  RETURNING id INTO _entry_id;

  -- خصم من الـ batches وحساب التكلفة
  FOR _alloc IN
    SELECT olb.*, ol.product_id, b.warehouse_id
    FROM public.order_line_batches olb
    JOIN public.order_lines ol ON ol.id = olb.order_line_id
    JOIN public.batches b ON b.id = olb.batch_id
    WHERE ol.order_id = _order_id
  LOOP
    UPDATE public.batches
      SET remaining_quantity = remaining_quantity - _alloc.quantity, updated_at = now()
      WHERE id = _alloc.batch_id;

    INSERT INTO public.stock_movements (product_id, warehouse_id, batch_id, movement_type, quantity, unit_cost, order_id, description, created_by)
    VALUES (_alloc.product_id, _alloc.warehouse_id, _alloc.batch_id, 'out', _alloc.quantity, _alloc.unit_cost, _order_id,
            'بيع - طلب ' || _order.order_number, auth.uid());

    _total_cost := _total_cost + (_alloc.quantity * _alloc.unit_cost);
    _wh_id := _alloc.warehouse_id;
  END LOOP;

  -- قيد البيع: مدين العميل، دائن المبيعات
  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
  VALUES (_entry_id, _order.counterparty_account_id, _total, 0, 'مدين الطرف', _line_no);
  _line_no := _line_no + 1;

  -- نخصم تكلفة المبيعات من المخزون: نحتاج account من first product
  FOR _line IN
    SELECT ol.*, i.code AS p_code FROM public.order_lines ol
    JOIN public.items i ON i.id = ol.product_id
    WHERE ol.order_id = _order_id ORDER BY ol.line_order
  LOOP
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _order.counterparty_account_id, 0, _line.line_total,
            'إيراد: ' || _line.p_code, _line_no);
    _line_no := _line_no + 1;
  END LOOP;

  UPDATE public.orders
    SET status = 'completed', warehouse_id = COALESCE(_wh_id, warehouse_id),
        subtotal = _subtotal, tax_percent = _tax_pct, tax_amount = _tax_amt,
        discount_amount = _discount, total_amount = _total,
        completed_by = auth.uid(), completed_at = now(),
        journal_entry_id = _entry_id,
        review_notes = COALESCE(_notes, review_notes)
    WHERE id = _order_id;

  RETURN _order_id;
END; $$;

-- ========================================================================
-- PHASE 13: RPC - رفض / إلغاء الطلب
-- ========================================================================

CREATE OR REPLACE FUNCTION public.reject_order(_order_id UUID, _review_notes TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (has_permission(auth.uid(),'invoices.approve'::app_permission)
       OR has_permission(auth.uid(),'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية';
  END IF;
  UPDATE public.orders
    SET status = 'rejected', review_notes = COALESCE(_review_notes, review_notes),
        approved_by = auth.uid(), approved_at = now()
    WHERE id = _order_id AND status IN ('pending','draft','approved','allocated');
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب غير موجود أو تم البت فيه'; END IF;
END; $$;
