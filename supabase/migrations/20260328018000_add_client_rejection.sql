-- Migración v6.6: Soporte para Rechazo de Pedido por Cliente 📦❌

-- 1. Añadir columnas de trazabilidad de rechazo
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS client_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS client_rejected_at TIMESTAMPTZ;

-- Nota: No es necesario alterar el tipo enum de status si se está usando texto plano, 
-- pero nos aseguramos de que la lógica de la aplicación soporte el valor 'No Recibido'.

COMMENT ON COLUMN public.orders.client_rejection_reason IS 'Motivo detallado por el cual el cliente rechazó el pedido en la entrega.';
COMMENT ON COLUMN public.orders.client_rejected_at IS 'Fecha y hora exacta del rechazo por parte del cliente.';
