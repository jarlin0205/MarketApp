-- ================================================================
-- Corrección del RPC create_repartidor
-- Para evitar que GoTrue (el motor de Auth de Supabase) de un 
-- Error 500 al iniciar sesión, es MANDATORIO que el raw_app_meta_data
-- sea un JSON válido con el provider de email.
-- ================================================================

-- 1. Actualizar el RPC para incluir raw_app_meta_data
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
  v_email text := LOWER(TRIM(p_username)) || '@repartidor.local';
  v_encrypted_password text := crypt(p_password, gen_salt('bf'));
BEGIN
  -- Validar si el nombre de usuario ya fue tomado
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RETURN json_build_object('error', 'Ese usuario ya existe. Agrega un número o apellido (ej: carlos123).');
  END IF;

  -- Insertar el usuario incluyendo raw_app_meta_data para no quebrar GoTrue
  INSERT INTO auth.users (
      id, 
      instance_id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
      raw_app_meta_data,
      raw_user_meta_data, 
      created_at, 
      updated_at, 
      role, 
      aud, 
      confirmation_token
  ) VALUES (
      v_user_id, 
      '00000000-0000-0000-0000-000000000000', 
      v_email, 
      v_encrypted_password, 
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'repartidor', 'phone', p_phone, 'username', p_username), 
      NOW(), 
      NOW(), 
      'authenticated', 
      'authenticated', 
      ''
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'username', p_username);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;

-- 2. Reparar a carlosb y a cualquier otro usuario que haya quedado huérfano de metadatos de app
UPDATE auth.users 
SET raw_app_meta_data = '{"provider": "email", "providers": ["email"]}'::jsonb 
WHERE raw_app_meta_data IS NULL;
