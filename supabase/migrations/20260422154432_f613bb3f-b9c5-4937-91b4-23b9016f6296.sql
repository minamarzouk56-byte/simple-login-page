
-- =========== Enums ===========
DO $$ BEGIN
  CREATE TYPE public.stock_request_type AS ENUM ('add', 'issue', 'sale_return', 'purchase_return');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.stock_request_status AS ENUM ('pending', 'settled', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =========== جدول الطلبات ===========
CREATE TABLE IF NOT EXISTS public.stock_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_number TEXT NOT NULL UNIQUE,
  request_type public.stock_request_type NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  status public.stock_request_status NOT NULL DEFAULT 'pending',
  customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  notes TEXT,
  review_notes TEXT,
  created_by UUID NOT NULL,
  settled_by UUID,
  settled_at TIMESTAMPTZ,
  related_order_id UUID,
  journal_entry_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_requests_creator ON public.stock_requests(created_by);
CREATE INDEX IF NOT EXISTS idx_stock_requests_status ON public.stock_requests(status);
CREATE INDEX IF NOT EXISTS idx_stock_requests_type ON public.stock_requests(request_type);

-- =========== بنود الطلبات ===========
CREATE TABLE IF NOT EXISTS public.stock_request_lines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.stock_requests(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC,
  notes TEXT,
  line_order INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_stock_request_lines_request ON public.stock_request_lines(request_id);

-- =========== تخصيص الدُفعات ===========
CREATE TABLE IF NOT EXISTS public.stock_request_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_line_id UUID NOT NULL REFERENCES public.stock_request_lines(id) ON DELETE CASCADE,
  batch_id UUID NOT NULL REFERENCES public.batches(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC NOT NULL,
  unit_price NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_alloc_line ON public.stock_request_allocations(request_line_id);
CREATE INDEX IF NOT EXISTS idx_stock_alloc_batch ON public.stock_request_allocations(batch_id);

-- =========== Trigger: رقم الطلب التلقائي ===========
CREATE OR REPLACE FUNCTION public.generate_stock_request_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE year_part TEXT; next_seq INT; prefix TEXT;
BEGIN
  IF NEW.request_number IS NOT NULL AND NEW.request_number <> '' THEN RETURN NEW; END IF;
  year_part := TO_CHAR(COALESCE(NEW.request_date, CURRENT_DATE), 'YYYY');
  prefix := CASE NEW.request_type
    WHEN 'add' THEN 'RA'
    WHEN 'issue' THEN 'RI'
    WHEN 'sale_return' THEN 'RSR'
    WHEN 'purchase_return' THEN 'RPR'
  END;
  SELECT COUNT(*) + 1 INTO next_seq FROM public.stock_requests
    WHERE request_number LIKE prefix || '-' || year_part || '-%';
  NEW.request_number := prefix || '-' || year_part || '-' || LPAD(next_seq::text, 5, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_stock_request_number ON public.stock_requests;
CREATE TRIGGER trg_stock_request_number
  BEFORE INSERT ON public.stock_requests
  FOR EACH ROW EXECUTE FUNCTION public.generate_stock_request_number();

DROP TRIGGER IF EXISTS trg_stock_request_updated_at ON public.stock_requests;
CREATE TRIGGER trg_stock_request_updated_at
  BEFORE UPDATE ON public.stock_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========== RLS ===========
ALTER TABLE public.stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_request_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_requests_view" ON public.stock_requests FOR SELECT
USING (
  has_permission(auth.uid(), 'stock_requests.manage'::app_permission)
  OR has_permission(auth.uid(), 'stock_requests.settle'::app_permission)
  OR (created_by = auth.uid() AND has_permission(auth.uid(), 'stock_requests.view_own'::app_permission))
);

CREATE POLICY "stock_requests_insert" ON public.stock_requests FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND has_permission(auth.uid(), 'stock_requests.create'::app_permission)
);

CREATE POLICY "stock_requests_update" ON public.stock_requests FOR UPDATE
USING (
  has_permission(auth.uid(), 'stock_requests.manage'::app_permission)
  OR has_permission(auth.uid(), 'stock_requests.settle'::app_permission)
  OR (created_by = auth.uid() AND status = 'pending')
);

CREATE POLICY "stock_requests_delete" ON public.stock_requests FOR DELETE
USING (created_by = auth.uid() AND status = 'pending');

CREATE POLICY "stock_request_lines_view" ON public.stock_request_lines FOR SELECT
USING (EXISTS (SELECT 1 FROM public.stock_requests sr WHERE sr.id = stock_request_lines.request_id));

CREATE POLICY "stock_request_lines_write" ON public.stock_request_lines FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.stock_requests sr
  WHERE sr.id = stock_request_lines.request_id
    AND ((sr.created_by = auth.uid() AND sr.status = 'pending')
         OR has_permission(auth.uid(), 'stock_requests.manage'::app_permission)
         OR has_permission(auth.uid(), 'stock_requests.settle'::app_permission))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.stock_requests sr
  WHERE sr.id = stock_request_lines.request_id
    AND ((sr.created_by = auth.uid() AND sr.status = 'pending')
         OR has_permission(auth.uid(), 'stock_requests.manage'::app_permission)
         OR has_permission(auth.uid(), 'stock_requests.settle'::app_permission))
));

CREATE POLICY "stock_alloc_view" ON public.stock_request_allocations FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.stock_request_lines srl
  WHERE srl.id = stock_request_allocations.request_line_id
));

CREATE POLICY "stock_alloc_write" ON public.stock_request_allocations FOR ALL
USING (has_permission(auth.uid(), 'stock_requests.settle'::app_permission)
       OR has_permission(auth.uid(), 'stock_requests.manage'::app_permission))
WITH CHECK (has_permission(auth.uid(), 'stock_requests.settle'::app_permission)
            OR has_permission(auth.uid(), 'stock_requests.manage'::app_permission));

-- =========== RPC: إنشاء طلب ===========
CREATE OR REPLACE FUNCTION public.create_stock_request(
  _request_type public.stock_request_type,
  _customer_id UUID,
  _supplier_id UUID,
  _notes TEXT,
  _lines JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id UUID;
  _line JSONB;
  _line_no INT := 0;
BEGIN
  IF NOT has_permission(auth.uid(), 'stock_requests.create'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية إنشاء طلب إذن مخزون';
  END IF;

  -- التحقق من توافق نوع الطلب مع الطرف
  IF _request_type IN ('add', 'purchase_return') AND _supplier_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد المورد';
  END IF;
  IF _request_type IN ('issue', 'sale_return') AND _customer_id IS NULL THEN
    RAISE EXCEPTION 'يجب تحديد العميل';
  END IF;

  INSERT INTO public.stock_requests (request_type, customer_id, supplier_id, notes, created_by)
  VALUES (
    _request_type,
    CASE WHEN _request_type IN ('issue','sale_return') THEN _customer_id ELSE NULL END,
    CASE WHEN _request_type IN ('add','purchase_return') THEN _supplier_id ELSE NULL END,
    _notes,
    auth.uid()
  )
  RETURNING id INTO _request_id;

  FOR _line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    INSERT INTO public.stock_request_lines (request_id, product_id, quantity, unit_price, notes, line_order)
    VALUES (
      _request_id,
      (_line->>'product_id')::UUID,
      (_line->>'quantity')::NUMERIC,
      NULLIF(_line->>'unit_price','')::NUMERIC,
      NULLIF(_line->>'notes',''),
      _line_no
    );
    _line_no := _line_no + 1;
  END LOOP;

  IF _line_no = 0 THEN RAISE EXCEPTION 'يجب إضافة بند واحد على الأقل'; END IF;

  RETURN _request_id;
END; $$;

-- =========== RPC: رفض طلب ===========
CREATE OR REPLACE FUNCTION public.reject_stock_request(_request_id UUID, _review_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (has_permission(auth.uid(),'stock_requests.settle'::app_permission)
       OR has_permission(auth.uid(),'stock_requests.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية';
  END IF;
  UPDATE public.stock_requests
    SET status = 'rejected',
        review_notes = COALESCE(_review_notes, review_notes),
        settled_by = auth.uid(),
        settled_at = now()
    WHERE id = _request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود أو تم البت فيه'; END IF;
END; $$;

-- =========== RPC: تسوية طلب إضافة (شراء) ===========
-- بيخلق فاتورة شراء في orders بحالة pending (للفوترة لاحقا)
-- _line_costs: { request_line_id: unit_cost }, _warehouse_id لازم
CREATE OR REPLACE FUNCTION public.settle_add_request(
  _request_id UUID,
  _warehouse_id UUID,
  _line_costs JSONB,
  _line_prices JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests%ROWTYPE;
  _supplier public.suppliers%ROWTYPE;
  _order_id UUID;
  _line RECORD;
  _cost NUMERIC;
  _price NUMERIC;
  _line_no INT := 0;
  _subtotal NUMERIC := 0;
BEGIN
  IF NOT has_permission(auth.uid(),'stock_requests.settle'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسوية الطلبات';
  END IF;

  SELECT * INTO _req FROM public.stock_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'الطلب تمت تسويته مسبقاً'; END IF;
  IF _req.request_type <> 'add' THEN RAISE EXCEPTION 'هذه الدالة لطلبات الإضافة فقط'; END IF;

  SELECT * INTO _supplier FROM public.suppliers WHERE id = _req.supplier_id;
  IF NOT FOUND OR _supplier.account_id IS NULL THEN
    RAISE EXCEPTION 'المورد غير مرتبط بحساب محاسبي';
  END IF;

  -- إنشاء فاتورة شراء في جدول orders بحالة pending
  INSERT INTO public.orders (order_type, order_date, status, supplier_id, counterparty_account_id, warehouse_id, notes, created_by)
  VALUES ('purchase', _req.request_date, 'pending', _req.supplier_id, _supplier.account_id, _warehouse_id,
          'من طلب إذن: ' || _req.request_number, auth.uid())
  RETURNING id INTO _order_id;

  FOR _line IN SELECT * FROM public.stock_request_lines WHERE request_id = _request_id ORDER BY line_order LOOP
    _cost := COALESCE((_line_costs ->> _line.id::text)::numeric, 0);
    _price := COALESCE((_line_prices ->> _line.id::text)::numeric, _cost);
    IF _cost <= 0 THEN RAISE EXCEPTION 'يجب تحديد تكلفة الوحدة لكل بند'; END IF;
    
    INSERT INTO public.order_lines (order_id, product_id, quantity, unit_price, unit_cost, line_total, line_order)
    VALUES (_order_id, _line.product_id, _line.quantity, _price, _cost, _line.quantity * _cost, _line_no);
    _subtotal := _subtotal + (_line.quantity * _cost);
    _line_no := _line_no + 1;
  END LOOP;

  UPDATE public.orders SET subtotal = _subtotal, total_amount = _subtotal WHERE id = _order_id;

  UPDATE public.stock_requests
    SET status = 'settled', settled_by = auth.uid(), settled_at = now(), related_order_id = _order_id
    WHERE id = _request_id;

  RETURN _order_id;
END; $$;

-- =========== RPC: تسوية طلب صرف (بيع) ===========
-- بيخلق فاتورة بيع في orders بحالة allocated (للفوترة لاحقا)
-- _allocations: [{ line_id, batch_id, quantity }], _line_prices: { line_id: price }
CREATE OR REPLACE FUNCTION public.settle_issue_request(
  _request_id UUID,
  _allocations JSONB,
  _line_prices JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests%ROWTYPE;
  _customer public.customers%ROWTYPE;
  _order_id UUID;
  _line RECORD;
  _alloc JSONB;
  _line_id UUID;
  _batch_id UUID;
  _qty NUMERIC;
  _batch public.batches%ROWTYPE;
  _price NUMERIC;
  _new_line_id UUID;
  _line_no INT := 0;
  _subtotal NUMERIC := 0;
  _wh_id UUID;
BEGIN
  IF NOT has_permission(auth.uid(),'stock_requests.settle'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسوية الطلبات';
  END IF;

  SELECT * INTO _req FROM public.stock_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'الطلب تمت تسويته مسبقاً'; END IF;
  IF _req.request_type <> 'issue' THEN RAISE EXCEPTION 'هذه الدالة لطلبات الصرف فقط'; END IF;

  SELECT * INTO _customer FROM public.customers WHERE id = _req.customer_id;
  IF NOT FOUND OR _customer.account_id IS NULL THEN
    RAISE EXCEPTION 'العميل غير مرتبط بحساب محاسبي';
  END IF;

  -- إنشاء فاتورة بيع
  INSERT INTO public.orders (order_type, order_date, status, customer_id, counterparty_account_id, notes, created_by)
  VALUES ('sale', _req.request_date, 'allocated', _req.customer_id, _customer.account_id,
          'من طلب إذن: ' || _req.request_number, auth.uid())
  RETURNING id INTO _order_id;

  -- إنشاء سطور الفاتورة وتخصيص الدُفعات
  FOR _line IN SELECT * FROM public.stock_request_lines WHERE request_id = _request_id ORDER BY line_order LOOP
    _price := COALESCE((_line_prices ->> _line.id::text)::numeric, 0);
    IF _price <= 0 THEN RAISE EXCEPTION 'يجب تحديد سعر البيع لكل بند'; END IF;

    INSERT INTO public.order_lines (order_id, product_id, quantity, unit_price, unit_cost, line_total, allocated_quantity, line_order)
    VALUES (_order_id, _line.product_id, _line.quantity, _price, 0, _line.quantity * _price, _line.quantity, _line_no)
    RETURNING id INTO _new_line_id;
    _subtotal := _subtotal + (_line.quantity * _price);
    _line_no := _line_no + 1;

    -- تخصيص الدُفعات لهذا البند
    FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
                  WHERE (value->>'line_id')::UUID = _line.id
    LOOP
      _batch_id := (_alloc->>'batch_id')::UUID;
      _qty := (_alloc->>'quantity')::NUMERIC;
      SELECT * INTO _batch FROM public.batches WHERE id = _batch_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'الدُفعة غير موجودة'; END IF;
      IF _batch.product_id <> _line.product_id THEN RAISE EXCEPTION 'الدُفعة لا تطابق الصنف'; END IF;
      IF _qty > _batch.remaining_quantity THEN
        RAISE EXCEPTION 'الكمية تتجاوز المتاح في الدُفعة %', _batch.display_code;
      END IF;

      -- ربط بالـ order_line_batches للفوترة لاحقاً
      INSERT INTO public.order_line_batches (order_line_id, batch_id, quantity, unit_cost)
      VALUES (_new_line_id, _batch_id, _qty, _batch.unit_cost);

      -- ربط في stock_request_allocations للسجل
      INSERT INTO public.stock_request_allocations (request_line_id, batch_id, quantity, unit_cost, unit_price)
      VALUES (_line.id, _batch_id, _qty, _batch.unit_cost, _price);
      _wh_id := _batch.warehouse_id;
    END LOOP;

    -- التحقق إن البند مخصص بالكامل
    IF (SELECT COALESCE(SUM(quantity),0) FROM public.stock_request_allocations WHERE request_line_id = _line.id) <> _line.quantity THEN
      RAISE EXCEPTION 'البند % غير مخصص بالكامل', _line.id;
    END IF;
  END LOOP;

  UPDATE public.orders SET subtotal = _subtotal, total_amount = _subtotal, warehouse_id = _wh_id WHERE id = _order_id;

  UPDATE public.stock_requests
    SET status = 'settled', settled_by = auth.uid(), settled_at = now(), related_order_id = _order_id
    WHERE id = _request_id;

  RETURN _order_id;
END; $$;

-- =========== RPC: تسوية مرتجع مبيعات (بيسمع تلقائي) ===========
-- العميل بيرجع منتج → الكمية بترجع للدُفعة الأصلية + قيد محاسبي
-- _allocations: [{ line_id, batch_id, quantity }] - بنحدد الدُفعة اللي هترجع لها
-- _line_prices: { line_id: refund_price }
CREATE OR REPLACE FUNCTION public.settle_sale_return_request(
  _request_id UUID,
  _allocations JSONB,
  _line_prices JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests%ROWTYPE;
  _customer public.customers%ROWTYPE;
  _entry_id UUID;
  _line RECORD;
  _alloc JSONB;
  _batch_id UUID;
  _qty NUMERIC;
  _batch public.batches%ROWTYPE;
  _price NUMERIC;
  _line_no INT := 0;
  _total NUMERIC := 0;
  _total_cost NUMERIC := 0;
BEGIN
  IF NOT has_permission(auth.uid(),'stock_requests.settle'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسوية الطلبات';
  END IF;

  SELECT * INTO _req FROM public.stock_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'الطلب تمت تسويته مسبقاً'; END IF;
  IF _req.request_type <> 'sale_return' THEN RAISE EXCEPTION 'هذه الدالة لمرتجع المبيعات فقط'; END IF;

  SELECT * INTO _customer FROM public.customers WHERE id = _req.customer_id;
  IF NOT FOUND OR _customer.account_id IS NULL THEN
    RAISE EXCEPTION 'العميل غير مرتبط بحساب محاسبي';
  END IF;

  -- حساب الإجمالي والتأثير على الدفعات
  FOR _line IN SELECT * FROM public.stock_request_lines WHERE request_id = _request_id ORDER BY line_order LOOP
    _price := COALESCE((_line_prices ->> _line.id::text)::numeric, 0);
    IF _price <= 0 THEN RAISE EXCEPTION 'يجب تحديد سعر الإرجاع لكل بند'; END IF;
    _total := _total + (_line.quantity * _price);

    FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
                  WHERE (value->>'line_id')::UUID = _line.id
    LOOP
      _batch_id := (_alloc->>'batch_id')::UUID;
      _qty := (_alloc->>'quantity')::NUMERIC;
      SELECT * INTO _batch FROM public.batches WHERE id = _batch_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'الدُفعة غير موجودة'; END IF;
      IF _batch.product_id <> _line.product_id THEN RAISE EXCEPTION 'الدُفعة لا تطابق الصنف'; END IF;

      -- إرجاع الكمية للدفعة
      UPDATE public.batches
        SET remaining_quantity = remaining_quantity + _qty,
            quantity = quantity + _qty,
            updated_at = now()
        WHERE id = _batch_id;

      INSERT INTO public.stock_movements (product_id, warehouse_id, batch_id, movement_type, quantity, unit_cost, description, created_by)
      VALUES (_line.product_id, _batch.warehouse_id, _batch_id, 'in', _qty, _batch.unit_cost,
              'مرتجع مبيعات - طلب ' || _req.request_number, auth.uid());

      INSERT INTO public.stock_request_allocations (request_line_id, batch_id, quantity, unit_cost, unit_price)
      VALUES (_line.id, _batch_id, _qty, _batch.unit_cost, _price);

      _total_cost := _total_cost + (_qty * _batch.unit_cost);
    END LOOP;

    -- التحقق إن البند مخصص بالكامل
    IF (SELECT COALESCE(SUM(quantity),0) FROM public.stock_request_allocations WHERE request_line_id = _line.id) <> _line.quantity THEN
      RAISE EXCEPTION 'البند غير مخصص بالكامل';
    END IF;
  END LOOP;

  -- قيد محاسبي: مدين مرتجع المبيعات (نستخدم نفس حساب العميل للقيد المقابل)
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _req.request_date, 'مرتجع مبيعات: ' || _req.request_number, _req.request_number, _total, _total, auth.uid())
  RETURNING id INTO _entry_id;

  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order, customer_id)
  VALUES (_entry_id, _customer.account_id, 0, _total, 'دائن العميل (إرجاع)', 0, _customer.id);

  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order, customer_id)
  VALUES (_entry_id, _customer.account_id, _total, 0, 'مدين مرتجع المبيعات', 1, _customer.id);

  UPDATE public.stock_requests
    SET status = 'settled', settled_by = auth.uid(), settled_at = now(), journal_entry_id = _entry_id
    WHERE id = _request_id;

  RETURN _request_id;
END; $$;

-- =========== RPC: تسوية مرتجع مشتريات (بيسمع تلقائي) ===========
-- بنرجع للمورد منتج من دفعة معينة → بنخصم من الدفعة + قيد
CREATE OR REPLACE FUNCTION public.settle_purchase_return_request(
  _request_id UUID,
  _allocations JSONB
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.stock_requests%ROWTYPE;
  _supplier public.suppliers%ROWTYPE;
  _entry_id UUID;
  _line RECORD;
  _alloc JSONB;
  _batch_id UUID;
  _qty NUMERIC;
  _batch public.batches%ROWTYPE;
  _line_no INT := 0;
  _total NUMERIC := 0;
BEGIN
  IF NOT has_permission(auth.uid(),'stock_requests.settle'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تسوية الطلبات';
  END IF;

  SELECT * INTO _req FROM public.stock_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الطلب غير موجود'; END IF;
  IF _req.status <> 'pending' THEN RAISE EXCEPTION 'الطلب تمت تسويته مسبقاً'; END IF;
  IF _req.request_type <> 'purchase_return' THEN RAISE EXCEPTION 'هذه الدالة لمرتجع المشتريات فقط'; END IF;

  SELECT * INTO _supplier FROM public.suppliers WHERE id = _req.supplier_id;
  IF NOT FOUND OR _supplier.account_id IS NULL THEN
    RAISE EXCEPTION 'المورد غير مرتبط بحساب محاسبي';
  END IF;

  FOR _line IN SELECT * FROM public.stock_request_lines WHERE request_id = _request_id ORDER BY line_order LOOP
    FOR _alloc IN SELECT * FROM jsonb_array_elements(_allocations)
                  WHERE (value->>'line_id')::UUID = _line.id
    LOOP
      _batch_id := (_alloc->>'batch_id')::UUID;
      _qty := (_alloc->>'quantity')::NUMERIC;
      SELECT * INTO _batch FROM public.batches WHERE id = _batch_id FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'الدُفعة غير موجودة'; END IF;
      IF _batch.product_id <> _line.product_id THEN RAISE EXCEPTION 'الدُفعة لا تطابق الصنف'; END IF;
      IF _qty > _batch.remaining_quantity THEN
        RAISE EXCEPTION 'الكمية تتجاوز المتاح في الدُفعة %', _batch.display_code;
      END IF;

      UPDATE public.batches
        SET remaining_quantity = remaining_quantity - _qty,
            quantity = quantity - _qty,
            updated_at = now()
        WHERE id = _batch_id;

      INSERT INTO public.stock_movements (product_id, warehouse_id, batch_id, movement_type, quantity, unit_cost, description, created_by)
      VALUES (_line.product_id, _batch.warehouse_id, _batch_id, 'out', _qty, _batch.unit_cost,
              'مرتجع مشتريات - طلب ' || _req.request_number, auth.uid());

      INSERT INTO public.stock_request_allocations (request_line_id, batch_id, quantity, unit_cost)
      VALUES (_line.id, _batch_id, _qty, _batch.unit_cost);

      _total := _total + (_qty * _batch.unit_cost);
    END LOOP;

    IF (SELECT COALESCE(SUM(quantity),0) FROM public.stock_request_allocations WHERE request_line_id = _line.id) <> _line.quantity THEN
      RAISE EXCEPTION 'البند غير مخصص بالكامل';
    END IF;
  END LOOP;

  -- قيد: مدين المورد (دائن لدينا → نخصم منه) ، دائن المخزون
  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _req.request_date, 'مرتجع مشتريات: ' || _req.request_number, _req.request_number, _total, _total, auth.uid())
  RETURNING id INTO _entry_id;

  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order, supplier_id)
  VALUES (_entry_id, _supplier.account_id, _total, 0, 'مدين المورد (إرجاع)', 0, _supplier.id);

  INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order, supplier_id)
  VALUES (_entry_id, _supplier.account_id, 0, _total, 'دائن المخزون', 1, _supplier.id);

  UPDATE public.stock_requests
    SET status = 'settled', settled_by = auth.uid(), settled_at = now(), journal_entry_id = _entry_id
    WHERE id = _request_id;

  RETURN _request_id;
END; $$;
