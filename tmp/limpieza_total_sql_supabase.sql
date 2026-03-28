-- 1. Borramos las reseñas (order_reviews) vinculadas a los pedidos viejos o falsos
DELETE FROM order_reviews 
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE created_at < '2026-03-28T05:00:00Z' -- Todo lo anterior a hoy a la medianoche (Hora local)
       OR (customer_name = 'LUCA MODRI' AND CAST(REGEXP_REPLACE(total::text, '[^0-9.]', '', 'g') AS NUMERIC) > 100000)
);

-- 2. Borramos los ítems (order_items) vinculadas a los pedidos viejos o falsos
DELETE FROM order_items 
WHERE order_id IN (
    SELECT id FROM orders 
    WHERE created_at < '2026-03-28T05:00:00Z' 
       OR (customer_name = 'LUCA MODRI' AND CAST(REGEXP_REPLACE(total::text, '[^0-9.]', '', 'g') AS NUMERIC) > 100000)
);

-- 3. Finalmente, borramos la orden principal (orders) de los pedidos viejos o falsos
DELETE FROM orders 
WHERE created_at < '2026-03-28T05:00:00Z' 
   OR (customer_name = 'LUCA MODRI' AND CAST(REGEXP_REPLACE(total::text, '[^0-9.]', '', 'g') AS NUMERIC) > 100000);
