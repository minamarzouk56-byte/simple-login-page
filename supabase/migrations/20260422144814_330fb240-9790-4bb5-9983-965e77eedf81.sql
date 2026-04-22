ALTER TABLE public.batches
  ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_batches_supplier_id ON public.batches(supplier_id);
CREATE INDEX IF NOT EXISTS idx_batches_account_id ON public.batches(account_id);