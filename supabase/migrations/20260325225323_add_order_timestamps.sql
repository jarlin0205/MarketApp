-- Add timestamp columns for each order phase
ALTER TABLE orders 
ADD COLUMN prepared_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN shipped_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;

-- Update existing orders to have some default timestamps for consistency
UPDATE orders SET prepared_at = created_at WHERE status IN ('Preparación', 'Enviado', 'Entregado') AND prepared_at IS NULL;
UPDATE orders SET shipped_at = created_at WHERE status IN ('Enviado', 'Entregado') AND shipped_at IS NULL;
UPDATE orders SET delivered_at = created_at WHERE status = 'Entregado' AND delivered_at IS NULL;
