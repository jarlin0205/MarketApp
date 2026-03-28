-- Reparación Crítica: Desbloqueo de Confirmación de Entregas
-- Refactorizamos la función para validar mediante la identidad segura de la sesión (JWT)

CREATE OR REPLACE FUNCTION update_order_status_messenger(
    p_order_id UUID,
    p_new_status TEXT,
    p_messenger_id UUID,
    p_messenger_password TEXT -- Mantenemos el parámetro para no romper el frontend, pero validamos por auth.uid()
) RETURNS JSON AS $$
DECLARE
    v_order RECORD;
BEGIN
    -- 1. VALIDACIÓN POR IDENTIDAD SEGURA (JWT) 🔐
    -- Verificamos si el que llama es el repartidor asignado de la sesión actual O un admin
    IF (auth.uid() <> p_messenger_id) AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN json_build_object('error', 'Permiso Denegado: No tienes permiso para realizar esta entrega o tu sesión ha expirado.');
    END IF;

    -- 2. Verificar que el repartidor realmente tiene el rol asignado en profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_messenger_id AND role = 'repartidor') THEN
        RETURN json_build_object('error', 'Configuración Inválida: El usuario no tiene rol de repartidor.');
    END IF;

    -- 3. Localizar el pedido
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Error: El pedido solicitado no existe.');
    END IF;

    -- 4. Ejecutar la actualización con timestamps automáticos
    UPDATE public.orders 
    SET 
        status = p_new_status,
        updated_at = NOW(),
        shipped_at = CASE WHEN p_new_status = 'Enviado' THEN NOW() ELSE shipped_at END,
        delivered_at = CASE WHEN p_new_status = 'Entregado' THEN NOW() ELSE delivered_at END
    WHERE id = p_order_id;

    RETURN json_build_object('success', true, 'new_status', p_new_status);
EXCEPTION WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
