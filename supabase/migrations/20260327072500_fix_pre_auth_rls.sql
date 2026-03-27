-- Reparación de políticas RLS para la tabla staff_pre_auth

DROP POLICY IF EXISTS "Los administradores pueden gestionar la lista blanca" ON staff_pre_auth;
DROP POLICY IF EXISTS "Los usuarios pueden leer para auto-asignarse rol" ON staff_pre_auth;

-- Política completa para Administradores (vía subconsulta directa)
CREATE POLICY "Admin gestiona lista blanca" ON staff_pre_auth
  FOR ALL 
  TO authenticated
  USING ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' );

-- Política para que usuarios nuevos (client) puedan ver su invitación al registrarse o loguearse
CREATE POLICY "Usuarios consultan su propia invitacion" ON staff_pre_auth
  FOR SELECT
  TO authenticated
  USING ( true );
