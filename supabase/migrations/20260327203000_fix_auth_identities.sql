-- ================================================================
-- Corrección del RPC create_repartidor (Fase 2)
-- GoTrue (Auth) requiere que cada usuario tenga una identidad
-- registrada en la tabla `auth.identities`. Si no existe, el login 
-- lanza un "Error 500: Database error querying schema".
-- ================================================================

-- 1. Actualizar el RPC para incluir la identidad
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
      created_at, updated_at, role, aud, confirmation_token
  ) VALUES (
      v_user_id, '00000000-0000-0000-0000-000000000000', v_email, v_encrypted_password, NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', p_full_name, 'role', 'repartidor', 'phone', p_phone, 'username', p_username), 
      NOW(), NOW(), 'authenticated', 'authenticated', ''
  );

  -- Insertar la identidad mandatoria en auth.identities
  INSERT INTO auth.identities (
     id, user_id, provider_id, identity_data, provider, created_at, updated_at
  ) VALUES (
     gen_random_uuid(), v_user_id, v_user_id::text, 
     jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
     'email', NOW(), NOW()
  );

  RETURN json_build_object('success', true, 'user_id', v_user_id, 'username', p_username);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('error', SQLERRM);
END;
$$;

-- 2. Reparar carlosb insertando sus identidades faltantes
INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
SELECT gen_random_uuid(), id, id::text, 
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true, 'phone_verified', false),
       'email', NOW(), NOW()
FROM auth.users
WHERE email LIKE '%@repartidor.local' 
AND NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE auth.identities.user_id = auth.users.id
);
