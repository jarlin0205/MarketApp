-- ================================================================
-- CORRECCIÓN DE MOTOR DE ENTREGA (Phase 43)
-- Asegura que el RPC de entrega coincida con los parámetros de la App
-- y recargue el caché del esquema.
-- ================================================================

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

-- Forzar recarga del caché de esquemas (Cache Schema)
NOTIFY pgrst, 'reload schema';
