-- Override approve_inventory_permit (no stock/journal here)
CREATE OR REPLACE FUNCTION public.approve_inventory_permit(_permit_id uuid, _review_notes text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _permit public.inventory_permits%ROWTYPE;
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventory.approve'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية الموافقة على أذونات المخزون';
  END IF;
  SELECT * INTO _permit FROM public.inventory_permits WHERE id = _permit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود'; END IF;
  IF _permit.status NOT IN ('pending','on_hold') THEN
    RAISE EXCEPTION 'الإذن تم البت فيه مسبقاً';
  END IF;
  UPDATE public.inventory_permits
    SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = COALESCE(_review_notes, review_notes), updated_at = now()
    WHERE id = _permit_id;
  RETURN _permit_id;
END; $$;

CREATE OR REPLACE FUNCTION public.hold_inventory_permit(_permit_id uuid, _review_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_permission(auth.uid(), 'inventory.approve'::app_permission) THEN
    RAISE EXCEPTION 'لا تملك صلاحية';
  END IF;
  UPDATE public.inventory_permits
    SET status = 'on_hold', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = COALESCE(_review_notes, review_notes), updated_at = now()
    WHERE id = _permit_id AND status IN ('pending','on_hold');
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود'; END IF;
END; $$;

-- Create invoice request from approved permit
CREATE OR REPLACE FUNCTION public.create_invoice_request_from_permit(
  _permit_id uuid,
  _tax_percent numeric DEFAULT 0,
  _discount_amount numeric DEFAULT 0,
  _line_prices jsonb DEFAULT '{}'::jsonb,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _permit public.inventory_permits%ROWTYPE;
  _request_id uuid;
  _line RECORD;
  _price numeric;
  _subtotal numeric := 0;
  _tax_amt numeric;
  _total numeric;
  _inv_type public.invoice_type;
  _line_no int := 0;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'invoices.manage'::app_permission)
       OR public.has_permission(auth.uid(), 'inventory.approve'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية إنشاء طلب فاتورة';
  END IF;

  SELECT * INTO _permit FROM public.inventory_permits WHERE id = _permit_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'الإذن غير موجود'; END IF;
  IF _permit.status <> 'approved' THEN RAISE EXCEPTION 'يجب الموافقة على الإذن أولاً'; END IF;

  _inv_type := CASE _permit.permit_type
    WHEN 'issue' THEN 'sale'::invoice_type
    WHEN 'receive' THEN 'purchase'::invoice_type
    WHEN 'sales_return' THEN 'sale_return'::invoice_type
    WHEN 'purchase_return' THEN 'purchase_return'::invoice_type
  END;

  FOR _line IN
    SELECT pl.item_id, pl.quantity FROM public.inventory_permit_lines pl
    WHERE pl.permit_id = _permit_id
  LOOP
    _price := COALESCE((_line_prices ->> _line.item_id::text)::numeric, 0);
    _subtotal := _subtotal + (_line.quantity * _price);
  END LOOP;

  _tax_amt := ROUND(_subtotal * COALESCE(_tax_percent,0) / 100.0, 2);
  _total := _subtotal + _tax_amt - COALESCE(_discount_amount,0);

  INSERT INTO public.invoice_requests (
    request_number, invoice_type, request_date, permit_id, warehouse_id,
    customer_id, supplier_id, counterparty_account_id,
    subtotal, tax_percent, tax_amount, discount_amount, total_amount,
    status, notes, created_by
  ) VALUES (
    '', _inv_type, _permit.permit_date, _permit_id, _permit.warehouse_id,
    _permit.customer_id, _permit.supplier_id, _permit.counterparty_account_id,
    _subtotal, COALESCE(_tax_percent,0), _tax_amt, COALESCE(_discount_amount,0), _total,
    'pending', _notes, auth.uid()
  ) RETURNING id INTO _request_id;

  FOR _line IN
    SELECT pl.item_id, pl.quantity, pl.notes, pl.line_order
    FROM public.inventory_permit_lines pl WHERE pl.permit_id = _permit_id ORDER BY pl.line_order
  LOOP
    _price := COALESCE((_line_prices ->> _line.item_id::text)::numeric, 0);
    INSERT INTO public.invoice_request_lines (request_id, item_id, quantity, unit_price, line_total, notes, line_order)
    VALUES (_request_id, _line.item_id, _line.quantity, _price, _line.quantity * _price, _line.notes, _line_no);
    _line_no := _line_no + 1;
  END LOOP;

  UPDATE public.inventory_permits SET status = 'invoiced', updated_at = now() WHERE id = _permit_id;

  RETURN _request_id;
END; $$;

-- Confirm invoice request -> create invoice + journal + stock movements
CREATE OR REPLACE FUNCTION public.confirm_invoice_request(
  _request_id uuid,
  _tax_percent numeric DEFAULT NULL,
  _discount_amount numeric DEFAULT NULL,
  _notes text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _req public.invoice_requests%ROWTYPE;
  _line RECORD;
  _invoice_id uuid;
  _entry_id uuid;
  _qty_signed numeric;
  _mv_type public.movement_type;
  _inventory_account uuid;
  _line_order int := 0;
  _final_subtotal numeric := 0;
  _final_tax_pct numeric;
  _final_discount numeric;
  _final_tax_amt numeric;
  _final_total numeric;
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'invoices.approve'::app_permission)
       OR public.has_permission(auth.uid(), 'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية تأكيد الفواتير';
  END IF;

  SELECT * INTO _req FROM public.invoice_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب الفاتورة غير موجود'; END IF;
  IF _req.status NOT IN ('pending','on_hold') THEN
    RAISE EXCEPTION 'طلب الفاتورة تم البت فيه مسبقاً';
  END IF;

  _final_tax_pct := COALESCE(_tax_percent, _req.tax_percent);
  _final_discount := COALESCE(_discount_amount, _req.discount_amount);

  SELECT COALESCE(SUM(line_total),0) INTO _final_subtotal
    FROM public.invoice_request_lines WHERE request_id = _request_id;

  _final_tax_amt := ROUND(_final_subtotal * _final_tax_pct / 100.0, 2);
  _final_total := _final_subtotal + _final_tax_amt - _final_discount;

  -- Stock check for outflows
  IF _req.invoice_type IN ('sale','purchase_return') THEN
    FOR _line IN
      SELECT rl.item_id, rl.quantity, COALESCE(s.quantity,0) AS available
      FROM public.invoice_request_lines rl
      LEFT JOIN public.item_stock s ON s.item_id = rl.item_id AND s.warehouse_id = _req.warehouse_id
      WHERE rl.request_id = _request_id
    LOOP
      IF _line.quantity > _line.available THEN
        RAISE EXCEPTION 'الكمية المطلوبة للصنف تتجاوز الرصيد المتاح في المخزن';
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.journal_entries (entry_number, entry_date, description, reference, total_debit, total_credit, created_by)
  VALUES ('', _req.request_date,
    CASE _req.invoice_type
      WHEN 'sale' THEN 'فاتورة بيع: '
      WHEN 'purchase' THEN 'فاتورة شراء: '
      WHEN 'sale_return' THEN 'إرجاع مبيعات: '
      WHEN 'purchase_return' THEN 'إرجاع مشتريات: '
    END || _req.request_number, _req.request_number, _final_total, _final_total, auth.uid())
  RETURNING id INTO _entry_id;

  INSERT INTO public.invoices (
    invoice_number, invoice_type, invoice_date, request_id, permit_id, warehouse_id,
    customer_id, supplier_id, counterparty_account_id,
    subtotal, tax_percent, tax_amount, discount_amount, total_amount,
    status, notes, journal_entry_id, created_by
  ) VALUES (
    '', _req.invoice_type, CURRENT_DATE, _request_id, _req.permit_id, _req.warehouse_id,
    _req.customer_id, _req.supplier_id, _req.counterparty_account_id,
    _final_subtotal, _final_tax_pct, _final_tax_amt, _final_discount, _final_total,
    'confirmed', COALESCE(_notes, _req.notes), _entry_id, auth.uid()
  ) RETURNING id INTO _invoice_id;

  FOR _line IN
    SELECT rl.*, i.account_id AS item_account
    FROM public.invoice_request_lines rl
    JOIN public.items i ON i.id = rl.item_id
    WHERE rl.request_id = _request_id ORDER BY rl.line_order
  LOOP
    INSERT INTO public.invoice_lines (invoice_id, item_id, quantity, unit_price, line_total, notes, line_order)
    VALUES (_invoice_id, _line.item_id, _line.quantity, _line.unit_price, _line.line_total, _line.notes, _line_order);

    _inventory_account := COALESCE(_line.item_account, _req.counterparty_account_id);

    IF _req.invoice_type IN ('sale','purchase_return') THEN
      _qty_signed := -_line.quantity; _mv_type := 'out';
    ELSE
      _qty_signed := _line.quantity; _mv_type := 'in';
    END IF;

    INSERT INTO public.item_stock (item_id, warehouse_id, quantity)
    VALUES (_line.item_id, _req.warehouse_id, _qty_signed)
    ON CONFLICT (item_id, warehouse_id)
    DO UPDATE SET quantity = public.item_stock.quantity + EXCLUDED.quantity, updated_at = now();

    INSERT INTO public.stock_movements (item_id, warehouse_id, movement_type, quantity, unit_price, permit_id, description, created_by)
    VALUES (_line.item_id, _req.warehouse_id, _mv_type, _line.quantity, _line.unit_price, _req.permit_id,
            'فاتورة ' || COALESCE(_line.notes,''), auth.uid());

    IF _req.invoice_type IN ('purchase','sale_return') THEN
      INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
      VALUES (_entry_id, _inventory_account, _line.line_total, 0, COALESCE(_line.notes,''), _line_order);
    ELSE
      INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
      VALUES (_entry_id, _inventory_account, 0, _line.line_total, COALESCE(_line.notes,''), _line_order);
    END IF;
    _line_order := _line_order + 1;
  END LOOP;

  IF _req.invoice_type IN ('purchase','sale_return') THEN
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _req.counterparty_account_id, 0, _final_total, 'مقابل فاتورة', _line_order);
  ELSE
    INSERT INTO public.journal_entry_lines (entry_id, account_id, debit, credit, description, line_order)
    VALUES (_entry_id, _req.counterparty_account_id, _final_total, 0, 'مقابل فاتورة', _line_order);
  END IF;

  UPDATE public.invoice_requests
    SET status = 'confirmed', reviewed_by = auth.uid(), reviewed_at = now(),
        invoice_id = _invoice_id, tax_percent = _final_tax_pct,
        discount_amount = _final_discount, tax_amount = _final_tax_amt,
        subtotal = _final_subtotal, total_amount = _final_total,
        review_notes = COALESCE(_notes, review_notes), updated_at = now()
    WHERE id = _request_id;

  RETURN _invoice_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reject_invoice_request(_request_id uuid, _review_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'invoices.approve'::app_permission)
       OR public.has_permission(auth.uid(), 'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية';
  END IF;
  UPDATE public.invoice_requests
    SET status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = COALESCE(_review_notes, review_notes), updated_at = now()
    WHERE id = _request_id AND status IN ('pending','on_hold');
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب غير موجود أو تم البت فيه'; END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.hold_invoice_request(_request_id uuid, _review_notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_permission(auth.uid(), 'invoices.approve'::app_permission)
       OR public.has_permission(auth.uid(), 'invoices.manage'::app_permission)) THEN
    RAISE EXCEPTION 'لا تملك صلاحية';
  END IF;
  UPDATE public.invoice_requests
    SET status = 'on_hold', reviewed_by = auth.uid(), reviewed_at = now(),
        review_notes = COALESCE(_review_notes, review_notes), updated_at = now()
    WHERE id = _request_id AND status IN ('pending','on_hold');
  IF NOT FOUND THEN RAISE EXCEPTION 'طلب غير موجود'; END IF;
END; $$;