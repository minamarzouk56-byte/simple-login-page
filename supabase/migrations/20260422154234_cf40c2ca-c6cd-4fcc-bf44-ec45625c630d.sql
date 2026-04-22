
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'stock_requests.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'stock_requests.view_own';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'stock_requests.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'stock_requests.settle';
