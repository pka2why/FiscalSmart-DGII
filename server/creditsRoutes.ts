import { Router } from "express";
import {
  adminGrant,
  findTenantIdByEmail,
  getBalance,
  listLedger,
  listPackages,
  listTenantLedgerAdmin,
  listTenantsAdmin,
  usageReport,
} from "./credits.ts";
import { AuthedRequest, requireAdminSecret, requireAuth } from "./middleware.ts";
import { paramId } from "./params.ts";

export const creditsRouter = Router();

creditsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const [balance, packages] = await Promise.all([
      getBalance(req.user!.tenantId),
      listPackages(),
    ]);
    res.json({ balance, packages });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

creditsRouter.get("/ledger", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;
    const entries = await listLedger(req.user!.tenantId, limit, offset);
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

export const adminCreditsRouter = Router();

adminCreditsRouter.get("/tenants", requireAdminSecret, async (_req, res) => {
  try {
    const tenants = await listTenantsAdmin();
    res.json({ tenants });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

adminCreditsRouter.get("/tenants/:id/ledger", requireAdminSecret, async (req, res) => {
  try {
    const entries = await listTenantLedgerAdmin(paramId(req.params.id), 40);
    res.json({ entries });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

adminCreditsRouter.post("/grant", requireAdminSecret, async (req, res) => {
  try {
    const { tenantId, email, credits, note } = req.body || {};
    let targetTenantId = tenantId as string | undefined;
    if (!targetTenantId && email) {
      targetTenantId = (await findTenantIdByEmail(email)) || undefined;
    }
    if (!targetTenantId) {
      return res.status(400).json({ error: "tenantId o email requerido" });
    }
    const amount = Number(credits);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: "credits debe ser positivo" });
    }
    const balance = await adminGrant({
      tenantId: targetTenantId,
      credits: amount,
      note,
    });
    res.json({ tenantId: targetTenantId, balance });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

adminCreditsRouter.get("/usage", requireAdminSecret, async (req, res) => {
  try {
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const to = typeof req.query.to === "string" ? req.query.to : undefined;
    const rows = await usageReport(from, to);
    res.json({ rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});
