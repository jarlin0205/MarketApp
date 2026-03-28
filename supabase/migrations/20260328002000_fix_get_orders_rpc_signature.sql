-- Fix get_messenger_orders RPC signature to match frontend
-- Phase 44: Eliminar funciones antiguas para poder cambiar nombres de parámetros
DROP FUNCTION IF EXISTS public.get_messenger_orders(uuid, text);
DROP FUNCTION IF EXISTS public.update_order_status_messenger(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.get_messenger_orders(
  p_messenger_id UUID,
  p_messenger_password TEXT
) RETURNS JSON AS $$
DECLARE
  v_orders JSON;
BEGIN
  -- Validar identidad
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_messenger_id AND messenger_password = p_messenger_password AND role = 'repartidor'
  ) THEN
    RETURN json_build_object('error', 'No autorizado.');
  END IF;

  -- Obtener pedidos asignados o disponibles para todos
  SELECT json_agg(o) INTO v_orders
  FROM (
    SELECT * FROM public.orders 
    WHERE repartidor_id = p_messenger_id 
       OR (status = 'Enviado' AND repartidor_id IS NULL)
    ORDER BY created_at DESC
  ) o;

  RETURN json_build_object('success', true, 'orders', COALESCE(v_orders, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Final sync of update_order_status_messenger just in case
CREATE OR REPLACE FUNCTION public.update_order_status_messenger(
  p_order_id UUID,
  p_messenger_id UUID,
  p_messenger_password TEXT,
  p_new_status TEXT
) RETURNS JSON AS $$
DECLARE
  v_count INT;
BEGIN
  -- 1. Validar credenciales locales
  SELECT COUNT(*) INTO v_count FROM public.profiles 
  WHERE id = p_messenger_id AND messenger_password = p_messenger_password AND role = 'repartidor';

  IF v_count = 0 THEN
    RETURN json_build_object('error', 'Credenciales inválidas');
  END IF;

  -- 2. Actualizar el pedido
  UPDATE public.orders 
  SET status = p_new_status,
      repartidor_id = p_messenger_id,
      delivered_at = CASE WHEN p_new_status = 'Entregado' THEN NOW() ELSE delivered_at END,
      updated_at = NOW()
  WHERE id = p_order_id AND (repartidor_id = p_messenger_id OR repartidor_id IS NULL);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No se pudo actualizar: el pedido ya no está disponible o no tienes permiso.');
  END IF;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force PostgREST cache reload
NOTIFY pgrst, 'reload schema';
