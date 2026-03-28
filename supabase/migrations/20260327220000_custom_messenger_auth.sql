-- ================================================================
-- ARQUITECTURA DE AUTENTICACIÓN LOCAL PARA REPARTIDORES (V1)
-- Esta migración elimina los errores 500 y 429 de Supabase Auth
-- al gestionar el acceso de la flota en la tabla 'profiles'.
-- ================================================================

-- 1. Limpieza de intentos fallidos en auth.users
DELETE FROM auth.identities WHERE identity_data->>'email' LIKE '%@repartidor.local';
DELETE FROM auth.users WHERE email LIKE '%@repartidor.local';

-- 2. Extender tabla de perfiles con credenciales locales
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='messenger_password') THEN
        ALTER TABLE public.profiles ADD COLUMN messenger_password TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='username') THEN
        ALTER TABLE public.profiles ADD COLUMN username TEXT UNIQUE;
    END IF;
END $$;

-- 3. Actualizar función RPC de creación de repartidores
-- Ahora NO inserta en auth.users, solo en public.profiles
CREATE OR REPLACE FUNCTION public.create_repartidor(
  p_username TEXT,
  p_password TEXT,
  p_full_name TEXT,
  p_phone TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_user_id uuid := gen_random_uuid();
BEGIN
  -- Verificar si el usuario ya existe
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = LOWER(TRIM(p_username))) THEN
    RETURN json_build_object('error', 'Ese nombre de usuario ya está en uso. Intenta con otro.');
  END IF;

  -- Insertar directamente en perfiles
  INSERT INTO public.profiles (
    id, 
    full_name, 
    role, 
    phone, 
    username, 
    messenger_password, 
    updated_at
  ) VALUES (
    v_user_id, 
    p_full_name, 
    'repartidor', 
    p_phone, 
    LOWER(TRIM(p_username)), 
    p_password, -- Guardamos la clave (el usuario pidió sencillez total)
    NOW()
  );

  RETURN json_build_object('success', true, 'username', p_username, 'user_id', v_user_id);
END;
$$;

-- 4. Función de Verificación de Credenciales (Login)
CREATE OR REPLACE FUNCTION public.verify_messenger_login(
  p_username TEXT,
  p_password TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile json;
BEGIN
  SELECT row_to_json(p) INTO v_profile
  FROM public.profiles p
  WHERE p.username = LOWER(TRIM(p_username)) 
    AND p.messenger_password = p_password
    AND p.role = 'repartidor'
  LIMIT 1;

  IF v_profile IS NULL THEN
    RETURN json_build_object('error', 'Usuario o contraseña incorrectos.');
  END IF;

  RETURN json_build_object('success', true, 'user', v_profile);
END;
$$;

-- 5. Función Maestra para Actualizar Pedidos (Bypass RLS)
-- Permite que un repartidor con sesión local actualice sus pedidos
CREATE OR REPLACE FUNCTION public.update_order_status_messenger(
  p_order_id uuid,
  p_new_status TEXT,
  p_messenger_id uuid,
  p_password TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Validar identidad del repartidor
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_messenger_id AND messenger_password = p_password AND role = 'repartidor'
  ) THEN
    RETURN json_build_object('error', 'No autorizado.');
  END IF;

  -- Actualizar el pedido
  UPDATE public.orders 
  SET status = p_new_status,
      repartidor_id = p_messenger_id, -- Phase 42: Asegurar que se asigna el ID al entregar
      delivered_at = CASE WHEN p_new_status = 'Entregado' THEN NOW() ELSE delivered_at END,
      updated_at = NOW()
  WHERE id = p_order_id AND (repartidor_id = p_messenger_id OR repartidor_id IS NULL);

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'No se pudo actualizar: el pedido ya no está disponible o no tienes permiso.');
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- 6. Función para Obtener Pedidos del Repartidor (Bypass RLS)
CREATE OR REPLACE FUNCTION public.get_messenger_orders(
  p_messenger_id uuid,
  p_password TEXT
) RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_orders json;
BEGIN
  -- Validar identidad
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = p_messenger_id AND messenger_password = p_password AND role = 'repartidor'
  ) THEN
    RETURN json_build_object('error', 'No autorizado.');
  END IF;

  -- Obtener pedidos asignados o disponibles para todos
  -- Un repartidor ve: 
  -- 1. Sus pedidos asignados
  -- 2. Pedidos en estado 'Enviado' que no tienen repartidor asignado aún
  SELECT json_agg(o) INTO v_orders
  FROM (
    SELECT * FROM public.orders 
    WHERE repartidor_id = p_messenger_id 
       OR (status = 'Enviado' AND repartidor_id IS NULL)
    ORDER BY created_at DESC
  ) o;

  RETURN json_build_object('success', true, 'orders', COALESCE(v_orders, '[]'::json));
END;
$$;
