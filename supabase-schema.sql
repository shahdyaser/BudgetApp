-- Create transactions table with required columns
-- Run this SQL in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_number TEXT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  merchant_name TEXT NOT NULL,
  category TEXT NOT NULL,
  include_in_insights BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on merchant_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_name ON transactions(merchant_name);

-- Create an index on created_at for date-based queries
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at);
