-- ================================================================
-- Corrección del RPC create_repartidor (Fase 3)
-- Para el provider 'email', Supabase espera que `provider_id` sea 
-- el correo electrónico del usuario, no su UUID. 
-- Esto arregla el "Database error querying schema" (500).
-- ================================================================

-- 1. Actualizar el RPC con el provider_id correcto
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

  -- Insertar el usuario en auth.users
  INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, 
      created_at, updated_at, role, aud, confirmation_token, is_sso_user, confirmed_at
  ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', v_email, v_encrypted_password, NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'repartidor', 'phone', p_phone, 'username', p_username), 
      NOW(), NOW(), 'authenticated', 'authenticated', '', false, NOW()
  );

  -- Insertar la identidad mandatoria en auth.identities
  -- CRITICAL: provider_id DEBE ser el email para el provider 'email'
  INSERT INTO auth.identities (
     id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) VALUES (
     gen_random_uuid(), v_user_id, v_email, 
     jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
     'email', NOW(), NOW()
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'username', p_username);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;

-- 2. Reparar identidades viciadas de @repartidor.local
UPDATE auth.identities
SET provider_id = u.email
FROM auth.users u
WHERE auth.identities.user_id = u.id 
AND u.email LIKE '%@repartidor.local'
AND auth.identities.provider_id <> u.email;
