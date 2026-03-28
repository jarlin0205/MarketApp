-- Asegurar que Supabase envíe el payload completo (incluyendo user_id) en cada cambio de estado
-- Esto es fundamental para que el Modal de Notificación en App.tsx filtre correctamente
ALTER TABLE public.orders REPLICA IDENTITY FULL;
