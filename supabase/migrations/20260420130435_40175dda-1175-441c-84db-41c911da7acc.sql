
-- Step 1: Add new permission enum values for separate customer/supplier perms
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.edit';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'customers.delete';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'suppliers.view';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'suppliers.create';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'suppliers.edit';
ALTER TYPE public.app_permission ADD VALUE IF NOT EXISTS 'suppliers.delete';
