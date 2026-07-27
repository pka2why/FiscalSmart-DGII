import { Router } from "express";
import { pool } from "./db.ts";
import { AuthedRequest, requireAuth } from "./middleware.ts";
import { paramId } from "./params.ts";

export const batchesRouter = Router();

async function assertBatchAccess(batchId: string, tenantId: string) {
  const result = await pool.query(
    `SELECT * FROM fiscal_batches WHERE id = $1 AND tenant_id = $2`,
    [batchId, tenantId]
  );
  return result.rows[0] || null;
}

batchesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { period, reportType } = req.query;
    const params: unknown[] = [req.user!.tenantId];
    let sql = `
      SELECT b.*,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.batch_id = b.id) AS invoice_count,
        (SELECT COUNT(*)::int FROM invoices i WHERE i.batch_id = b.id AND i.status = 'completed') AS completed_count,
        (SELECT MAX(e.version) FROM batch_exports e WHERE e.batch_id = b.id) AS latest_export_version
      FROM fiscal_batches b
      WHERE b.tenant_id = $1 AND b.status <> 'archived'`;

    if (period) {
      params.push(period);
      sql += ` AND b.period = $${params.length}`;
    }
    if (reportType) {
      params.push(reportType);
      sql += ` AND b.report_type = $${params.length}`;
    }
    sql += ` ORDER BY b.period DESC, b.report_type ASC`;

    const result = await pool.query(sql, params);
    res.json({
      batches: result.rows.map(mapBatch),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

batchesRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const { reportType, period, rncInformante } = req.body || {};
    if (!reportType || !period || !/^\d{6}$/.test(String(period))) {
      return res.status(400).json({ error: "reportType y period (YYYYMM) requeridos" });
    }
    if (!["606", "607"].includes(String(reportType))) {
      return res.status(400).json({ error: "reportType inválido" });
    }

    const tenant = await pool.query(`SELECT rnc FROM tenants WHERE id = $1`, [
      req.user!.tenantId,
    ]);
    const defaultRnc = tenant.rows[0]?.rnc || "";

    const result = await pool.query(
      `INSERT INTO fiscal_batches (tenant_id, report_type, period, rnc_informante, created_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, report_type, period)
       DO UPDATE SET updated_at = NOW()
       RETURNING *`,
      [
        req.user!.tenantId,
        reportType,
        period,
        rncInformante || defaultRnc,
        req.user!.id,
      ]
    );

    res.status(201).json({ batch: mapBatch(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

batchesRouter.get("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const batch = await assertBatchAccess(paramId(req.params.id), req.user!.tenantId);
    if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

    const invoices = await pool.query(
      `SELECT id, batch_id, status, original_filename, mime_type, extracted_data, error,
              sort_order, credits_charged, created_at, updated_at
       FROM invoices WHERE batch_id = $1 ORDER BY sort_order ASC, created_at ASC`,
      [batch.id]
    );

    res.json({
      batch: mapBatch(batch),
      invoices: invoices.rows.map(mapInvoice),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

batchesRouter.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const batch = await assertBatchAccess(paramId(req.params.id), req.user!.tenantId);
    if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

    const { rncInformante, status } = req.body || {};
    const result = await pool.query(
      `UPDATE fiscal_batches SET
         rnc_informante = COALESCE($1, rnc_informante),
         status = COALESCE($2, status),
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [rncInformante ?? null, status ?? null, batch.id]
    );
    res.json({ batch: mapBatch(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

batchesRouter.post("/:id/archive", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const batch = await assertBatchAccess(paramId(req.params.id), req.user!.tenantId);
    if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

    const result = await pool.query(
      `UPDATE fiscal_batches SET status = 'archived', updated_at = NOW()
       WHERE id = $1 RETURNING *`,
      [batch.id]
    );
    res.json({ batch: mapBatch(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

export function mapBatch(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    reportType: row.report_type,
    period: row.period,
    rncInformante: row.rnc_informante,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    invoiceCount: row.invoice_count,
    completedCount: row.completed_count,
    latestExportVersion: row.latest_export_version,
  };
}

export function mapInvoice(row: any) {
  return {
    id: row.id,
    batchId: row.batch_id,
    status: row.status,
    originalFilename: row.original_filename,
    mimeType: row.mime_type,
    extractedData: row.extracted_data,
    error: row.error,
    sortOrder: row.sort_order,
    creditsCharged: row.credits_charged,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    previewUrl: `/api/invoices/${row.id}/file`,
  };
}

export { assertBatchAccess };
