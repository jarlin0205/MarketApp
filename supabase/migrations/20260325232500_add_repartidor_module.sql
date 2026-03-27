-- Migración para Fase 22: Módulo Repartidor y Ecosistema de 3 Roles (Corregida)

-- 1. Asegurar que el admin actual tenga el rol correcto (vía auth.users)
UPDATE profiles SET role = 'admin' WHERE id IN (SELECT id FROM auth.users WHERE email = 'admin@market.com');

-- 2. Añadir columnas a la tabla orders para el seguimiento extendido
-- repartidor_id: Quién entrega el pedido
-- client_confirmed_at: Confirmación digital final del cliente
ALTER TABLE orders ADD COLUMN IF NOT EXISTS repartidor_id UUID REFERENCES profiles(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_confirmed_at TIMESTAMPTZ;

-- 3. Políticas RLS para repartidores
-- Los repartidores pueden leer pedidos en estado 'Enviado' (para tomarlos) o los que ya tienen asignados
DROP POLICY IF EXISTS "Repartidores can view assignable orders" ON orders;
CREATE POLICY "Repartidores can view assignable orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor') AND 
    (status = 'Enviado' OR repartidor_id = auth.uid())
  );

-- Los repartidores pueden actualizar pedidos para marcarlos como entregados
DROP POLICY IF EXISTS "Repartidores can update their orders" ON orders;
CREATE POLICY "Repartidores can update their orders" ON orders
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'repartidor')
  );

-- 4. Permitir al cliente confirmar su pedido (update client_confirmed_at)
DROP POLICY IF EXISTS "Users can confirm receipt" ON orders;
CREATE POLICY "Users can confirm receipt" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- 5. Actualizar RLS de reviews para permitir al repartidor ver feedback de sus entregas
DROP POLICY IF EXISTS "Repartidores can view reviews of their deliveries" ON order_reviews;
CREATE POLICY "Repartidores can view reviews of their deliveries" ON order_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders WHERE id = order_reviews.order_id AND repartidor_id = auth.uid()
    )
  );
