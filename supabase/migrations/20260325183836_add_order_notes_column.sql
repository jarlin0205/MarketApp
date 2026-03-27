-- 20260325183836_add_order_notes_column.sql
ALTER TABLE IF EXISTS public.orders 
ADD COLUMN IF NOT EXISTS notes TEXT;
