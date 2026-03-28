-- ================================================================
-- CORRECCIÓN SUPREMA: Clonación de Estructura (Fase 8)
-- Este método copia la fila de un usuario "sano" (admin) para 
-- asegurar que todas las columnas (invisibles o nuevas) se hereden 
-- correctamente, evitando el Error 500 de GoTrue.
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
  v_new_id uuid := gen_random_uuid();
  v_email text := LOWER(TRIM(p_username)) || '@repartidor.local';
  v_pass text := crypt(p_password, gen_salt('bf'));
  v_admin_email text := 'sestudiantesena@gmail.com';
BEGIN
  -- 1. Eliminar rastro anterior (perfil e identidad primero)
  DELETE FROM public.profiles WHERE email = v_email;
  DELETE FROM auth.identities WHERE identity_data->>'email' = v_email;
  DELETE FROM auth.users WHERE email = v_email;

  -- 2. INSERTAR USANDO CLONACIÓN DE COLUMNAS (Dinámico)
  -- Copiamos instance_id, aud, role y metadatos base del admin
  INSERT INTO auth.users (
    id, instance_id, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
    role, aud, is_sso_user, last_sign_in_at
  ) 
  SELECT 
    v_new_id, instance_id, v_email, v_pass, NOW(),
    raw_app_meta_data, 
    jsonb_build_object('full_name', p_full_name, 'role', 'repartidor', 'phone', p_phone, 'username', p_username),
    NOW(), NOW(), 
    role, aud, FALSE, NOW()
  FROM auth.users 
  WHERE email = v_admin_email 
  LIMIT 1;

  -- 3. Crear Identidad perfecta
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at) 
  VALUES (
     gen_random_uuid(), v_new_id, v_email, 
     jsonb_build_object('sub', v_new_id::text, 'email', v_email, 'email_verified', true), 
     'email', NOW(), NOW()
  );

  -- 4. Perfil público
  INSERT INTO public.profiles (id, full_name, email, role, phone, updated_at)
  VALUES (v_new_id, p_full_name, v_email, 'repartidor', p_phone, NOW())
  ON CONFLICT (id) DO UPDATE SET role = 'repartidor', full_name = EXCLUDED.full_name, phone = EXCLUDED.phone;

  RETURN json_build_object('success', true, 'username', p_username);
END;
$$;
