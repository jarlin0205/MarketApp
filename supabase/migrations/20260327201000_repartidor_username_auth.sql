-- ================================================================
-- Fase 41: Autenticación por Nombre de Usuario para Repartidores
-- Problema: Los repartidores requerían correos reales y sufrían de 
-- validaciones o límites de SMTP ('Confirm Email', Rate Limits).
-- Solución: RPC Security Definer que crea el usuario internamente
-- asociando el username a un correo fantasma (@repartidor.local).
-- ================================================================

-- 1. Eliminar el usuario de prueba si se creó
DELETE FROM auth.users WHERE email = 'mensajero.final@gmail.com';

-- 2. Habilitar pgcrypto si no estuviera
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 3. Crear función maestra para registrar repartidores limpiamente
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

  -- Insertar el usuario saltándose todas las validaciones externas de Gotrue (y correos)
  INSERT INTO auth.users (
      id, 
      instance_id, 
      email, 
      encrypted_password, 
      email_confirmed_at, 
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
