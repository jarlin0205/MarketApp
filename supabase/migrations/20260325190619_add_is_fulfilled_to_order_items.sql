-- Migration to add is_fulfilled to order_items
ALTER TABLE order_items ADD COLUMN is_fulfilled BOOLEAN DEFAULT TRUE;

-- Update existing items to be fulfilled by default (safety)
UPDATE order_items SET is_fulfilled = TRUE WHERE is_fulfilled IS NULL;
