-- 1. Atomic invoice number generation function
CREATE OR REPLACE FUNCTION generate_invoice_number(p_lawyer_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_num INTEGER;
BEGIN
  -- Advisory lock to prevent concurrent reads for same lawyer
  PERFORM pg_advisory_xact_lock(hashtext(p_lawyer_id::text || '_invoice'));
  
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)
  ), 0) + 1
  INTO next_num
  FROM invoices
  WHERE lawyer_id = p_lawyer_id;
  
  RETURN 'INV-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- 2. Unique constraint on invoice numbers per lawyer (safety net)
ALTER TABLE invoices ADD CONSTRAINT invoices_lawyer_number_unique 
  UNIQUE (lawyer_id, invoice_number);

-- 3. Vault credentials table for WebAuthn
CREATE TABLE vault_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  sign_count INTEGER DEFAULT 0,
  device_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(credential_id)
);

-- RLS for vault_credentials
ALTER TABLE vault_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own credentials" ON vault_credentials
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Add security_level to documents
ALTER TABLE documents ADD COLUMN IF NOT EXISTS security_level TEXT 
  DEFAULT 'standard' CHECK (security_level IN ('standard', 'protected'));

-- Auto-protect client_evidence and filed_plaints
CREATE OR REPLACE FUNCTION set_document_security()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.category IN ('client_evidence', 'filed_plaints') THEN
    NEW.security_level := 'protected';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER documents_auto_security
  BEFORE INSERT ON documents
  FOR EACH ROW EXECUTE FUNCTION set_document_security();
