-- ==========================================
-- 🚀 FASE 1: INDEXACIÓN SQL PARA PRODUCCIÓN
-- Optimizando el motor para soportar los 10,000 usuarios gratis 
-- ==========================================

-- 1. Optimizar Búsquedas por Fecha (Pestañas de Hoy, Semana, Mes)
-- Reduces la carga de la BDD cuando busca en todo el historial
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);

-- 2. Optimizar Filtrado por Estado (Ventas Exitosas vs Rechazados)
-- Tu panel agrupa todo basado en el status ('Entregado', etc.)
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders (status);

-- 3. Optimizar "Lupa del Repartidor" (Tus filtros de chips)
-- Acelera inmensamente cuando haces click en un mensajero como Pedro
CREATE INDEX IF NOT EXISTS idx_orders_repartidor_id ON public.orders (repartidor_id);

-- 4. Optimizar las Uniones (Joins) que hacen las tarjetas y modales
-- Esto evita "Escaneos Completos de Tabla" cuando el admin abre el detalle de un pedido
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_order_reviews_order_id ON public.order_reviews (order_id);
