-- ================================================================
-- Fase 39: Reparación de RLS "Infinite Recursion"
-- Problema: Las políticas previas de `profiles` hacían un SELECT 
-- a la misma tabla `profiles` para verificar si el usuario era 'admin',
-- creando un ciclo infinito que bloqueaba el inicio de sesión.
-- Solución: Función de bypass SECURITY DEFINER para chequear el rol.
-- ================================================================

-- 1. Crear una función con SECURITY DEFINER que lee el rol saltándose el RLS.
-- Esto permite consultar profiles de forma segura sin disparar las políticas de nuevo.
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = user_id;
$$;

-- 2. Eliminar las políticas defectuosas que causan recursión infinita
DROP POLICY IF EXISTS "Admin ve todos los perfiles" ON profiles;
DROP POLICY IF EXISTS "Admin actualiza cualquier perfil" ON profiles;

-- 3. Crear las nuevas políticas usando la función segura
CREATE POLICY "Admin ve todos los perfiles" ON profiles
  FOR SELECT TO authenticated
  USING ( public.get_user_role(auth.uid()) = 'admin' );

CREATE POLICY "Admin actualiza cualquier perfil" ON profiles
  FOR UPDATE TO authenticated
  USING ( public.get_user_role(auth.uid()) = 'admin' )
  WITH CHECK ( public.get_user_role(auth.uid()) = 'admin' );
