-- Migration to add client_viewed_status to orders
ALTER TABLE orders ADD COLUMN client_viewed_status BOOLEAN DEFAULT TRUE;

-- Update existing orders
UPDATE orders SET client_viewed_status = TRUE WHERE client_viewed_status IS NULL;
