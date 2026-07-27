import { Router } from "express";
import { ReportType } from "../types.ts";
import { buildExcelBuffer } from "../excelService.ts";
import { assertBatchAccess, mapBatch } from "./batches.ts";
import { pool } from "./db.ts";
import { AuthedRequest, requireAuth } from "./middleware.ts";
import { paramId } from "./params.ts";

export const exportsRouter = Router();

exportsRouter.post(
  "/batches/:id/export",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const batch = await assertBatchAccess(paramId(req.params.id), req.user!.id);
      if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

      const invoices = await pool.query(
        `SELECT extracted_data FROM invoices
         WHERE batch_id = $1 AND status = 'completed' AND extracted_data IS NOT NULL
         ORDER BY sort_order ASC, created_at ASC`,
        [batch.id]
      );

      const snapshot = invoices.rows.map((r) => r.extracted_data);
      if (snapshot.length === 0) {
        return res.status(400).json({ error: "No hay facturas completadas para exportar" });
      }

      const versionRes = await pool.query(
        `SELECT COALESCE(MAX(version), 0)::int AS v FROM batch_exports WHERE batch_id = $1`,
        [batch.id]
      );
      const version = versionRes.rows[0].v + 1;

      const reportType =
        batch.report_type === "607" ? ReportType.REPORT_607 : ReportType.REPORT_606;
      const { buffer, filename } = buildExcelBuffer(
        snapshot,
        reportType,
        batch.rnc_informante,
        batch.period
      );

      const versionedName = filename.replace(".xlsx", `_v${version}.xlsx`);

      await pool.query(
        `INSERT INTO batch_exports
          (batch_id, version, exported_by, filename, record_count, snapshot)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          batch.id,
          version,
          req.user!.id,
          versionedName,
          snapshot.length,
          JSON.stringify(snapshot),
        ]
      );

      await pool.query(
        `UPDATE fiscal_batches SET status = 'exported', updated_at = NOW() WHERE id = $1`,
        [batch.id]
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${versionedName}"`
      );
      res.setHeader("X-Export-Version", String(version));
      res.send(buffer);
    } catch (err: any) {
      console.error("[export]", err);
      res.status(500).json({ error: err.message || "Error al exportar" });
    }
  }
);

exportsRouter.get(
  "/batches/:id/exports",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const batch = await assertBatchAccess(paramId(req.params.id), req.user!.id);
      if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

      const result = await pool.query(
        `SELECT id, batch_id, version, exported_by, exported_at, filename, record_count
         FROM batch_exports WHERE batch_id = $1 ORDER BY version DESC`,
        [batch.id]
      );

      res.json({
        batch: mapBatch(batch),
        exports: result.rows.map((row) => ({
          id: row.id,
          batchId: row.batch_id,
          version: row.version,
          exportedBy: row.exported_by,
          exportedAt: row.exported_at,
          filename: row.filename,
          recordCount: row.record_count,
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Error" });
    }
  }
);

exportsRouter.get(
  "/exports/:id/download",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const result = await pool.query(
        `SELECT e.*, b.id AS batch_id_ref, b.company_id, b.report_type, b.period, b.rnc_informante
         FROM batch_exports e
         JOIN fiscal_batches b ON b.id = e.batch_id
         WHERE e.id = $1`,
        [paramId(req.params.id)]
      );
      const row = result.rows[0];
      if (!row) {
        return res.status(404).json({ error: "Exportación no encontrada" });
      }
      const batch = await assertBatchAccess(row.batch_id, req.user!.id);
      if (!batch) {
        return res.status(404).json({ error: "Exportación no encontrada" });
      }

      const reportType =
        row.report_type === "607" ? ReportType.REPORT_607 : ReportType.REPORT_606;
      const { buffer } = buildExcelBuffer(
        row.snapshot,
        reportType,
        row.rnc_informante,
        row.period
      );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${row.filename}"`
      );
      res.send(buffer);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Error" });
    }
  }
);
