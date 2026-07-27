-- FiscalSmart multi-tenant schema (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rnc TEXT NOT NULL DEFAULT '',
  credit_balance INTEGER NOT NULL DEFAULT 0 CHECK (credit_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);

CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rnc TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);

CREATE TABLE IF NOT EXISTS company_members (
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (company_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_company_members_user ON company_members(user_id);

CREATE TABLE IF NOT EXISTS fiscal_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL CHECK (report_type IN ('606', '607')),
  period TEXT NOT NULL,
  rnc_informante TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'exported', 'archived')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Multi-company: company_id + unique per company (idempotent migration)
ALTER TABLE fiscal_batches ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE CASCADE;

-- Backfill: one company per existing tenant from tenant name/rnc
INSERT INTO companies (tenant_id, name, rnc)
SELECT t.id, t.name, t.rnc
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM companies c WHERE c.tenant_id = t.id
);

-- Membership for all existing users on their tenant's first company
INSERT INTO company_members (company_id, user_id, role)
SELECT c.id, u.id, CASE WHEN u.role = 'owner' THEN 'owner' ELSE 'member' END
FROM users u
JOIN LATERAL (
  SELECT id FROM companies WHERE tenant_id = u.tenant_id ORDER BY created_at ASC LIMIT 1
) c ON TRUE
ON CONFLICT (company_id, user_id) DO NOTHING;

-- Backfill batch company_id from tenant's first company
UPDATE fiscal_batches b
SET company_id = c.id
FROM (
  SELECT DISTINCT ON (tenant_id) id, tenant_id
  FROM companies
  ORDER BY tenant_id, created_at ASC
) c
WHERE b.tenant_id = c.tenant_id AND b.company_id IS NULL;

-- Drop legacy unique constraint if present, then enforce company uniqueness
ALTER TABLE fiscal_batches DROP CONSTRAINT IF EXISTS fiscal_batches_tenant_id_report_type_period_key;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'fiscal_batches' AND column_name = 'company_id'
  ) THEN
    ALTER TABLE fiscal_batches ALTER COLUMN company_id SET NOT NULL;
  END IF;
EXCEPTION
  WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS fiscal_batches_company_report_period_key
  ON fiscal_batches (company_id, report_type, period);

CREATE INDEX IF NOT EXISTS idx_batches_tenant ON fiscal_batches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_batches_company ON fiscal_batches(company_id);
CREATE INDEX IF NOT EXISTS idx_batches_period ON fiscal_batches(tenant_id, period);
CREATE INDEX IF NOT EXISTS idx_batches_company_period ON fiscal_batches(company_id, period);

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES fiscal_batches(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
  original_filename TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL DEFAULT '',
  mime_type TEXT NOT NULL DEFAULT 'image/jpeg',
  extracted_data JSONB,
  error TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  credits_charged INTEGER NOT NULL DEFAULT 0,
  file_data BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS file_data BYTEA;

CREATE INDEX IF NOT EXISTS idx_invoices_batch ON invoices(batch_id);

CREATE TABLE IF NOT EXISTS batch_exports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES fiscal_batches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  exported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  exported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  filename TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (batch_id, version)
);

CREATE INDEX IF NOT EXISTS idx_exports_batch ON batch_exports(batch_id);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  delta INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('signup_bonus', 'purchase', 'admin_grant', 'ocr_charge', 'ocr_refund')),
  idempotency_key TEXT NOT NULL UNIQUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_tenant ON credit_ledger(tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'DOP' CHECK (currency IN ('DOP', 'USD')),
  active BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO credit_packages (code, name, credits, price_cents, currency, active)
VALUES
  ('starter_50', 'Paquete Starter', 50, 150000, 'DOP', TRUE),
  ('pro_200', 'Paquete Pro', 200, 500000, 'DOP', TRUE),
  ('business_500', 'Paquete Business', 500, 1100000, 'DOP', TRUE)
ON CONFLICT (code) DO NOTHING;
