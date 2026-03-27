-- Migración para el sistema de Lista Blanca (Pre-autorización)

CREATE TABLE staff_pre_auth (
  email TEXT PRIMARY KEY,
  role TEXT DEFAULT 'repartidor',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE staff_pre_auth ENABLE ROW LEVEL SECURITY;

-- Política para que el administrador gestione la lista
CREATE POLICY "Los administradores pueden gestionar la lista blanca" ON staff_pre_auth
  FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Política para que los usuarios (incluso nuevos) puedan consultar su propia invitación durante el registro
CREATE POLICY "Los usuarios pueden leer para auto-asignarse rol" ON staff_pre_auth
  FOR SELECT
  TO authenticated
  USING (true);
