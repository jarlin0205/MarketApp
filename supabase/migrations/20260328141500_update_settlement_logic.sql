-- Update Settlement Logic to include Rejected (Returns) orders
-- Migration: 20260328141500_update_settlement_logic.sql

-- Update request_shift_closure to include 'No Recibido' status
CREATE OR REPLACE FUNCTION public.request_shift_closure(p_messenger_id UUID, p_total_amount DECIMAL, p_orders_count INTEGER)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_settlement_id UUID;
BEGIN
  -- Create the settlement record
  INSERT INTO public.shift_settlements (messenger_id, total_amount, orders_count, status, requested_at)
  VALUES (p_messenger_id, p_total_amount, p_orders_count, 'pending', NOW())
  RETURNING id INTO v_settlement_id;

  -- Update profile status
  UPDATE public.profiles
  SET shift_status = 'pending_closure'
  WHERE id = p_messenger_id;

  -- Link orders to this settlement
  -- IMPORTANT: Include 'No Recibido' as they are returns that must be accounted for during settlement
  UPDATE public.orders
  SET settlement_id = v_settlement_id
  WHERE repartidor_id = p_messenger_id 
    AND (status = 'Entregado' OR status = 'Confirmado' OR status = 'No Recibido')
    AND is_settled = FALSE;

  RETURN jsonb_build_object('success', true, 'settlement_id', v_settlement_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
