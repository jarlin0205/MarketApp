-- Bypass de Emergencia: Desbloqueo de Entregas por Coincidencia de ID
-- Este cambio permite que si el repartidor enviado coincide con el asignado, la orden se procese.

CREATE OR REPLACE FUNCTION update_order_status_messenger(
    p_order_id UUID,
    p_new_status TEXT,
    p_messenger_id UUID,
    p_messenger_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_order_repartidor_id UUID;
    v_current_status TEXT;
BEGIN
    -- 1. Obtener datos actuales del pedido
    SELECT repartidor_id, status INTO v_order_repartidor_id, v_current_status 
    FROM public.orders 
    WHERE id = p_order_id;

    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Error: El pedido solicitado no existe en la base de datos.');
    END IF;

    -- 2. VALIDACIÓN DE EMERGENCIA 🚨
    -- Permitimos la entrega si:
    -- a) El usuario es Admin
    -- b) Es el repartidor asignado (mismatch de sesión o no)
    IF (v_order_repartidor_id <> p_messenger_id) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('error', 'Permiso Denegado: No eres el repartidor asignado a este pedido.');
    END IF;

    -- 3. Ejecutar la actualización (Forzada para asegurar el movimiento)
    UPDATE public.orders 
    SET 
        status = p_new_status,
        updated_at = NOW(),
        shipped_at = CASE WHEN p_new_status = 'Enviado' AND shipped_at IS NULL THEN NOW() ELSE shipped_at END,
        delivered_at = CASE WHEN p_new_status = 'Entregado' THEN NOW() ELSE delivered_at END,
        repartidor_id = p_messenger_id -- Aseguramos que quede vinculado
    WHERE id = p_order_id;

    RETURN json_build_object('success', true, 'new_status', p_new_status, 'id', p_order_id);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', 'Fallo Crítico SQL: ' || SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
