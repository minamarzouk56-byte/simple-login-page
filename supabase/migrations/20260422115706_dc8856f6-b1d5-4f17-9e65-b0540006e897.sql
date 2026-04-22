ALTER TYPE public.permit_type ADD VALUE IF NOT EXISTS 'sales_return';
ALTER TYPE public.permit_type ADD VALUE IF NOT EXISTS 'purchase_return';
ALTER TYPE public.permit_status ADD VALUE IF NOT EXISTS 'on_hold';
ALTER TYPE public.permit_status ADD VALUE IF NOT EXISTS 'invoiced';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'invoices.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'invoices.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'invoices.approve';