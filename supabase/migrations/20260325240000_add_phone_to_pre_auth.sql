-- Migración para añadir teléfono a la lista blanca de staff

ALTER TABLE staff_pre_auth ADD COLUMN phone TEXT;

-- También nos aseguramos que la tabla profiles tenga el campo phone (por si acaso no existe)
-- Ya debería existir por migraciones previas de clientes, pero lo garantizamos.
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='profiles' AND COLUMN_NAME='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;
END $$;
