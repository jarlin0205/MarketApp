-- ================================================================
-- LIMPIEZA TOTAL DE PEDIDOS
-- Elimina todo el historial para iniciar de cero.
-- ================================================================

-- Desactivar temporalmente RLS para evitar bloqueos si fuera necesario en algunas políticas
-- (Esto solo afecta a esta transacción de migración)

BEGIN;

-- 1. Eliminar reseñas de pedidos
DELETE FROM public.order_reviews;

-- 2. Eliminar ítems de los pedidos
DELETE FROM public.order_items;

-- 3. Eliminar los pedidos (cabecera)
DELETE FROM public.orders;

COMMIT;
