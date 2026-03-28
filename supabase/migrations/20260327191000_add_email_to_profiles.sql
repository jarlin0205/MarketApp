-- ================================================================
-- Fase 40: Agregar columna de email a Profiles
-- Problema: La App Administrativa no puede ver los correos de los 
-- repartidores porque la tabla `profiles` no contenía la columna `email`.
-- Solución: Añadir la columna, rellenar los datos existentes y
-- actualizar el trigger para mantenerlo sincronizado.
-- ================================================================

-- 1. Añadir columna email a profiles (unique constraint opcional pero recomendado)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_email_key;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_email_key UNIQUE (email);

-- 2. Backfill (Rellenar): Sincronizar los correos existentes desde auth.users a profiles
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id AND p.email IS NULL;

-- 3. Actualizar el trigger de creación para que capture el email automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insertamos en profiles usando los metadatos o los valores por defecto
  INSERT INTO public.profiles (id, full_name, email, role, phone, avatar_url, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuario nuevo'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url',
    NOW()
  )
  -- En caso de que el perfil ya exista por algún error de carrera, no fallamos
  ON CONFLICT (id) DO UPDATE SET 
    email = EXCLUDED.email,
    role = EXCLUDED.role,
    phone = EXCLUDED.phone;

  RETURN NEW;
END;
$$;
