import type pg from "pg";
import { pool, withTransaction } from "./db.ts";

export class InsufficientCreditsError extends Error {
  balance: number;
  constructor(balance: number) {
    super("INSUFFICIENT_CREDITS");
    this.name = "InsufficientCreditsError";
    this.balance = balance;
  }
}

export async function getBalance(tenantId: string): Promise<number> {
  const result = await pool.query(
    `SELECT credit_balance FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return result.rows[0]?.credit_balance ?? 0;
}

export async function listPackages() {
  const result = await pool.query(
    `SELECT id, code, name, credits, price_cents, currency, active
     FROM credit_packages WHERE active = TRUE ORDER BY credits ASC`
  );
  return result.rows.map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    credits: row.credits,
    priceCents: row.price_cents,
    currency: row.currency,
    active: row.active,
  }));
}

export async function listLedger(
  tenantId: string,
  limit = 50,
  offset = 0
) {
  const result = await pool.query(
    `SELECT id, delta, balance_after, reason, invoice_id, meta, created_at
     FROM credit_ledger
     WHERE tenant_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [tenantId, limit, offset]
  );
  return result.rows.map((row) => ({
    id: row.id,
    delta: row.delta,
    balanceAfter: row.balance_after,
    reason: row.reason,
    invoiceId: row.invoice_id,
    meta: row.meta,
    createdAt: row.created_at,
  }));
}

async function applyCreditChange(
  client: pg.PoolClient,
  opts: {
    tenantId: string;
    userId?: string | null;
    invoiceId?: string | null;
    delta: number;
    reason: string;
    idempotencyKey: string;
    meta?: Record<string, unknown>;
  }
): Promise<number> {
  const existing = await client.query(
    `SELECT balance_after FROM credit_ledger WHERE idempotency_key = $1`,
    [opts.idempotencyKey]
  );
  if (existing.rows[0]) {
    return existing.rows[0].balance_after;
  }

  const locked = await client.query(
    `SELECT credit_balance FROM tenants WHERE id = $1 FOR UPDATE`,
    [opts.tenantId]
  );
  if (!locked.rows[0]) {
    throw new Error("Tenant not found");
  }

  const current = locked.rows[0].credit_balance as number;
  const next = current + opts.delta;
  if (next < 0) {
    throw new InsufficientCreditsError(current);
  }

  await client.query(
    `UPDATE tenants SET credit_balance = $1 WHERE id = $2`,
    [next, opts.tenantId]
  );

  await client.query(
    `INSERT INTO credit_ledger
      (tenant_id, user_id, invoice_id, delta, balance_after, reason, idempotency_key, meta)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      opts.tenantId,
      opts.userId ?? null,
      opts.invoiceId ?? null,
      opts.delta,
      next,
      opts.reason,
      opts.idempotencyKey,
      JSON.stringify(opts.meta ?? {}),
    ]
  );

  return next;
}

export async function grantSignupBonus(
  tenantId: string,
  userId: string
): Promise<number> {
  const bonus = Number(process.env.SIGNUP_BONUS_CREDITS || 10);
  if (bonus <= 0) return 0;

  return withTransaction((client) =>
    applyCreditChange(client, {
      tenantId,
      userId,
      delta: bonus,
      reason: "signup_bonus",
      idempotencyKey: `signup_bonus:${tenantId}`,
      meta: { bonus },
    })
  );
}

export async function debitForOcr(opts: {
  tenantId: string;
  userId: string;
  invoiceId: string;
  attempt: number;
}): Promise<number> {
  return withTransaction(async (client) => {
    const balance = await applyCreditChange(client, {
      tenantId: opts.tenantId,
      userId: opts.userId,
      invoiceId: opts.invoiceId,
      delta: -1,
      reason: "ocr_charge",
      idempotencyKey: `ocr_charge:${opts.invoiceId}:${opts.attempt}`,
    });

    await client.query(
      `UPDATE invoices
       SET credits_charged = credits_charged + 1, updated_at = NOW()
       WHERE id = $1`,
      [opts.invoiceId]
    );

    return balance;
  });
}

export async function refundOcr(opts: {
  tenantId: string;
  userId: string;
  invoiceId: string;
  attempt: number;
  reasonDetail: string;
}): Promise<number> {
  return withTransaction((client) =>
    applyCreditChange(client, {
      tenantId: opts.tenantId,
      userId: opts.userId,
      invoiceId: opts.invoiceId,
      delta: 1,
      reason: "ocr_refund",
      idempotencyKey: `ocr_refund:${opts.invoiceId}:${opts.attempt}`,
      meta: { detail: opts.reasonDetail },
    })
  );
}

export async function adminGrant(opts: {
  tenantId: string;
  credits: number;
  note?: string;
}): Promise<number> {
  if (opts.credits <= 0) {
    throw new Error("credits must be positive");
  }
  const key = `admin_grant:${opts.tenantId}:${Date.now()}:${opts.credits}`;
  return withTransaction((client) =>
    applyCreditChange(client, {
      tenantId: opts.tenantId,
      delta: opts.credits,
      reason: "admin_grant",
      idempotencyKey: key,
      meta: { note: opts.note || "" },
    })
  );
}

export async function usageReport(from?: string, to?: string) {
  const result = await pool.query(
    `SELECT t.id AS tenant_id, t.name, t.rnc,
            COALESCE(SUM(CASE WHEN l.reason = 'ocr_charge' THEN -l.delta ELSE 0 END), 0)::int AS credits_used,
            COALESCE(SUM(CASE WHEN l.reason IN ('admin_grant','purchase','signup_bonus') THEN l.delta ELSE 0 END), 0)::int AS credits_added
     FROM tenants t
     LEFT JOIN credit_ledger l ON l.tenant_id = t.id
       AND ($1::timestamptz IS NULL OR l.created_at >= $1::timestamptz)
       AND ($2::timestamptz IS NULL OR l.created_at <= $2::timestamptz)
     GROUP BY t.id, t.name, t.rnc
     ORDER BY credits_used DESC`,
    [from || null, to || null]
  );
  return result.rows.map((row) => ({
    tenantId: row.tenant_id,
    name: row.name,
    rnc: row.rnc,
    creditsUsed: row.credits_used,
    creditsAdded: row.credits_added,
  }));
}

export async function findTenantIdByEmail(email: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT tenant_id FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return result.rows[0]?.tenant_id ?? null;
}
