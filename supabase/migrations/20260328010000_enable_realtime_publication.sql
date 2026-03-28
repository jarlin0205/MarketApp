-- Habilitar la publicación de tiempo real para las tablas necesarias
-- Esto asegura que Supabase transmita los cambios de estado al cliente sin necesidad de recargar

-- 1. Intentar crear la publicación si no existe (normalmente ya existe en Supabase)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
    END IF;
END $$;

-- 2. Asegurar que las tablas estén incluidas en la publicación de forma robusta
DO $$
BEGIN
    -- Añadir orders si no está
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'orders'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;

    -- Añadir order_items si no está
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND schemaname = 'public' 
        AND tablename = 'order_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
    END IF;
END $$;

-- 3. Reforzamos la identidad de réplica para garantizar datos completos (user_id)
ALTER TABLE public.orders REPLICA IDENTITY FULL;
