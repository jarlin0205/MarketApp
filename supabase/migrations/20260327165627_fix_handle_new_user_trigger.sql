-- ================================================================
-- Fase 39: Reparación del Trigger handle_new_user
-- Problema: El trigger no crea perfiles automáticamente al
-- registrarse un usuario nuevo, dejando todos los campos NULL.
-- ================================================================

-- 1. Recrear la función que se ejecuta al crear un usuario
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, phone, updated_at)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
    NEW.raw_user_meta_data->>'phone',
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- 2. Eliminar el trigger antiguo si existía
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 3. Recrear el trigger correctamente
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Backfill: Insertar perfiles para usuarios que ya existen
-- pero no tienen fila en profiles (el problema actual)
INSERT INTO public.profiles (id, full_name, role, phone, updated_at)
SELECT
  u.id,
  u.raw_user_meta_data->>'full_name',
  COALESCE(u.raw_user_meta_data->>'role', 'client'),
  u.raw_user_meta_data->>'phone',
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 5. Asignar el administrador específico
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'sestudiantesena@gmail.com'
);

-- 6. Asignar repartidor (si aplica)
UPDATE public.profiles
SET role = 'repartidor'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'repartidor@gmail.com'
);
