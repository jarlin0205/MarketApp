-- ================================================================
-- LIBERACIÓN DE RESTRICCIONES (Fase Final)
-- Permite que existan perfiles en 'public.profiles' que no tengan
-- un usuario correspondiente en 'auth.users' (Staff Local).
-- ================================================================

DO $$ 
BEGIN 
    -- Eliminar la restricción de clave foránea si existe
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_id_fkey'
    ) THEN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    END IF;
END $$;
