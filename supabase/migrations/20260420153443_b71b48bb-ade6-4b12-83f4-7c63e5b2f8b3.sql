ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.manage';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.request';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'inventory.approve';