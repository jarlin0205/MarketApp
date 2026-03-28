-- ALTER TABLE public.orders REPLICA IDENTITY FULL;

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivered_at') THEN
        ALTER TABLE public.orders ADD COLUMN delivered_at TIMESTAMPTZ;
    END IF;
END $$;

-- Borrar la función anterior para evitar conflictos de parámetros
DROP FUNCTION IF EXISTS public.update_order_status_messenger(UUID, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION update_order_status_messenger(
    p_order_id UUID,
    p_new_status TEXT,
    p_messenger_id UUID,
    p_messenger_password TEXT
) RETURNS JSON AS $$
DECLARE
    v_order RECORD;
    v_messenger RECORD;
BEGIN
    SELECT * INTO v_messenger FROM public.profiles 
    WHERE id = p_messenger_id AND password = p_messenger_password AND role = 'repartidor';
    
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Credenciales de repartidor inválidas.');
    END IF;

    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
    IF NOT FOUND THEN
        RETURN json_build_object('error', 'Pedido no encontrado.');
    END IF;

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
