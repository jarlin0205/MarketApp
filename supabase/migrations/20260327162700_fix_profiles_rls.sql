-- ==============================================================
-- Fix Fase 38: Políticas RLS para tabla profiles
-- Problema: El admin no puede leer perfiles de otros usuarios,
-- solo ve el suyo propio. Esto impide listar los repartidores.
-- ==============================================================

-- 1. Primero eliminamos políticas antiguas que puedan entrar en conflicto
DROP POLICY IF EXISTS "Los usuarios pueden ver su propio perfil" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin puede ver todos los perfiles" ON profiles;

-- 2. Política: Cada usuario puede leer y editar su PROPIO perfil
CREATE POLICY "Usuarios ven su propio perfil" ON profiles
  FOR SELECT
  TO authenticated
  USING ( id = auth.uid() );

-- 3. Política: Los ADMIN pueden leer TODOS los perfiles (para listar repartidores)
CREATE POLICY "Admin ve todos los perfiles" ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 4. Política: Cada usuario puede actualizar su propio perfil
CREATE POLICY "Usuarios actualizan su propio perfil" ON profiles
  FOR UPDATE
  TO authenticated
  USING ( id = auth.uid() )
  WITH CHECK ( id = auth.uid() );

-- 5. Política: Los ADMIN pueden actualizar cualquier perfil (para asignar roles)
CREATE POLICY "Admin actualiza cualquier perfil" ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
  );

-- 6. Política de inserción: El trigger del sistema inserta perfiles automáticamente
CREATE POLICY "Trigger puede insertar perfiles" ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK ( id = auth.uid() );
