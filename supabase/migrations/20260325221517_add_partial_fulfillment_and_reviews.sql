-- Migration to add partial fulfillment and review system
ALTER TABLE order_items ADD COLUMN fulfilled_quantity INTEGER;

-- Update existing items to have fulfilled_quantity = quantity by default
UPDATE order_items SET fulfilled_quantity = quantity WHERE fulfilled_quantity IS NULL;

-- Create order_reviews table
CREATE TABLE IF NOT EXISTS order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(order_id)
);

-- RLS for reviews
ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own reviews" ON order_reviews
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reviews" ON order_reviews
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reviews" ON order_reviews
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
