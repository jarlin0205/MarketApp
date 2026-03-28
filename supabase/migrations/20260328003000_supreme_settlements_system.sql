-- Supreme Settlements System Migration
-- 1. Create shift_settlements table
CREATE TABLE IF NOT EXISTS public.shift_settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  messenger_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0,
  orders_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved'
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Update orders table to track settlement
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settled_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS settlement_id UUID REFERENCES public.shift_settlements(id) ON DELETE SET NULL;

-- 3. Update profiles table to track shift status
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS shift_status TEXT DEFAULT 'active'; -- 'active', 'pending_closure'

-- 4. RPC to request shift closure (Messenger side)
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

  -- Link orders to this settlement (temporarily pending)
  -- This ensures we know which orders are being settled even before approval
  UPDATE public.orders
  SET settlement_id = v_settlement_id
  WHERE repartidor_id = p_messenger_id 
    AND (status = 'Entregado' OR status = 'Confirmado')
    AND is_settled = FALSE;

  RETURN jsonb_build_object('success', true, 'settlement_id', v_settlement_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. RPC to approve shift closure (Admin side)
CREATE OR REPLACE FUNCTION public.approve_shift_closure(p_settlement_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_messenger_id UUID;
BEGIN
  -- Get messenger ID
  SELECT messenger_id INTO v_messenger_id FROM public.shift_settlements WHERE id = p_settlement_id;
  
  IF v_messenger_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Liquidación no encontrada.');
  END IF;

  -- Update settlement status
  UPDATE public.shift_settlements
  SET status = 'approved',
      approved_at = NOW()
  WHERE id = p_settlement_id;

  -- Finalize orders
  UPDATE public.orders
  SET is_settled = TRUE,
      settled_at = NOW()
  WHERE settlement_id = p_settlement_id;

  -- Reset messenger status
  UPDATE public.profiles
  SET shift_status = 'active'
  WHERE id = v_messenger_id;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
