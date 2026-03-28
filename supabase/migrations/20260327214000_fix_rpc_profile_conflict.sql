-- ================================================================
-- CORRECCIÓN FINAL: ON CONFLICT en Profiles (Fase 7)
-- Evita el error "duplicate key value violates unique constraint" 
-- causado por la competencia entre el Trigger y el RPC.
-- ================================================================

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
  v_instance_id uuid;
  v_email text := LOWER(TRIM(p_username)) || '@repartidor.local';
  v_encrypted_password text := crypt(p_password, gen_salt('bf'));
BEGIN
  -- 1. Capturar ID de instancia real
  SELECT instance_id INTO v_instance_id FROM auth.users WHERE email = 'sestudiantesena@gmail.com' LIMIT 1;
  IF v_instance_id IS NULL THEN SELECT instance_id INTO v_instance_id FROM auth.users LIMIT 1; END IF;

  -- 2. Insertar usuario (GoTrue generará confirmed_at)
  INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      role, aud, is_sso_user, last_sign_in_at
  ) VALUES (
      v_user_id, v_instance_id, v_email, v_encrypted_password, NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'repartidor', 'phone', p_phone, 'username', p_username), 
      NOW(), NOW(), 'authenticated', 'authenticated', FALSE, NOW()
  );

  -- 3. Insertar Identidad mandatoria
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) 
  VALUES (
     gen_random_uuid(), v_user_id, v_email, 
     jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true), 
     'email', NOW(), NOW()
  );

  -- 4. Sincronizar perfil público (Blindaje contra duplicados)
  INSERT INTO public.profiles (id, full_name, email, role, phone, updated_at)
  VALUES (v_user_id, p_full_name, v_email, 'repartidor', p_phone, NOW())
  ON CONFLICT (id) DO UPDATE SET 
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    phone = EXCLUDED.phone,
    updated_at = NOW();

  RETURN json_build_object('success', true, 'username', p_username);
END;
$$;
