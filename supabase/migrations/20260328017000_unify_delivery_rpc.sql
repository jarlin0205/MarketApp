-- 1. Eliminamos todas las versiones conflictivas de raíz
DROP FUNCTION IF EXISTS public.update_order_status_messenger(uuid, uuid, text, text);
DROP FUNCTION IF EXISTS public.update_order_status_messenger(uuid, text, uuid, text);

-- 2. Creamos la versión ÚNICA, DEFINITIVA y ESTABLE
CREATE OR REPLACE FUNCTION public.update_order_status_messenger(
  p_order_id uuid,
  p_new_status text,
  p_messenger_id uuid,
  p_messenger_password text DEFAULT 'bypass'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_status text;
  v_repartidor_id uuid;
BEGIN
  -- 1. Buscamos el pedido y su repartidor asignado
  SELECT status, repartidor_id INTO v_current_status, v_repartidor_id
  FROM public.orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Pedido no encontrado');
  END IF;

  -- 2. VALIDACIÓN DE SEGURIDAD v6.3: 
  -- Si el ID del que envía coincide con el repartidor_id del pedido, permitimos bypass de contraseña.
  IF v_repartidor_id != p_messenger_id THEN
     RETURN json_build_object('success', false, 'error', 'No tienes permiso para entregar este pedido');
  END IF;

  -- 3. Actualizamos el estado y la fecha de entrega
  UPDATE public.orders
  SET 
    status = p_new_status,
    delivered_at = CASE WHEN p_new_status = 'Entregado' THEN now() ELSE delivered_at END,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object('success', true, 'message', 'Estado actualizado a ' || p_new_status);
END;
$$;
