import { Router } from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { pool } from "./db.ts";
import { assertBatchAccess, mapInvoice } from "./batches.ts";
import {
  debitForOcr,
  getBalance,
  InsufficientCreditsError,
  refundOcr,
} from "./credits.ts";
import {
  extractInvoiceFromFile,
  isRefundableGeminiError,
} from "./gemini.ts";
import { AuthedRequest, requireAuth } from "./middleware.ts";
import { paramId } from "./params.ts";
import { getDataRoot, resolveStoragePath, saveUpload } from "./storage.ts";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 40 },
});

export const invoicesRouter = Router();

invoicesRouter.post(
  "/batches/:id/invoices",
  requireAuth,
  upload.array("files", 40),
  async (req: AuthedRequest, res) => {
    try {
      const batch = await assertBatchAccess(paramId(req.params.id), req.user!.id);
      if (!batch) return res.status(404).json({ error: "Lote no encontrado" });
      if (batch.status === "archived") {
        return res.status(400).json({ error: "Lote archivado" });
      }

      const files = (req.files as Express.Multer.File[]) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: "No se enviaron archivos" });
      }

      const maxOrder = await pool.query(
        `SELECT COALESCE(MAX(sort_order), 0)::int AS m FROM invoices WHERE batch_id = $1`,
        [batch.id]
      );
      let sortOrder = maxOrder.rows[0].m;

      const created = [];
      for (const file of files) {
        sortOrder += 1;
        const saved = saveUpload({
          tenantId: req.user!.tenantId,
          batchId: batch.id,
          originalName: file.originalname,
          buffer: file.buffer,
        });
        const result = await pool.query(
          `INSERT INTO invoices
            (batch_id, status, original_filename, storage_path, mime_type, sort_order, file_data)
           VALUES ($1, 'pending', $2, $3, $4, $5, $6)
           RETURNING id, batch_id, status, original_filename, mime_type, extracted_data, error,
                     sort_order, credits_charged, created_at, updated_at`,
          [
            batch.id,
            file.originalname,
            saved.storagePath,
            file.mimetype || "image/jpeg",
            sortOrder,
            file.buffer,
          ]
        );
        created.push(mapInvoice(result.rows[0]));
      }

      await pool.query(
        `UPDATE fiscal_batches SET status = 'draft', updated_at = NOW() WHERE id = $1`,
        [batch.id]
      );

      res.status(201).json({ invoices: created });
    } catch (err: any) {
      console.error("[upload]", err);
      res.status(500).json({ error: err.message || "Error al subir" });
    }
  }
);

invoicesRouter.post(
  "/batches/:id/invoices/process",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const batch = await assertBatchAccess(paramId(req.params.id), req.user!.id);
      if (!batch) return res.status(404).json({ error: "Lote no encontrado" });

      const pending = await pool.query(
        `SELECT * FROM invoices
         WHERE batch_id = $1 AND status IN ('pending', 'error')
         ORDER BY sort_order ASC, created_at ASC`,
        [batch.id]
      );

      let processed = 0;
      let failed = 0;
      let skippedInsufficientCredits = 0;
      let balance = await getBalance(req.user!.tenantId);

      for (const invoice of pending.rows) {
        const attempt = (invoice.credits_charged || 0) + 1;

        try {
          balance = await debitForOcr({
            tenantId: req.user!.tenantId,
            userId: req.user!.id,
            invoiceId: invoice.id,
            attempt,
          });
        } catch (err) {
          if (err instanceof InsufficientCreditsError) {
            skippedInsufficientCredits += pending.rows.length - processed - failed;
            balance = err.balance;
            break;
          }
          throw err;
        }

        await pool.query(
          `UPDATE invoices SET status = 'processing', error = NULL, updated_at = NOW() WHERE id = $1`,
          [invoice.id]
        );

        try {
          let absolutePath: string | null = null;
          try {
            absolutePath = resolveStoragePath(invoice.storage_path);
            if (!fs.existsSync(absolutePath)) absolutePath = null;
          } catch {
            absolutePath = null;
          }

          // Fallback: materialize from Postgres if disk file is gone
          if (!absolutePath && invoice.file_data) {
            const tmpDir = path.join(getDataRoot(), "tmp");
            fs.mkdirSync(tmpDir, { recursive: true });
            absolutePath = path.join(tmpDir, `${invoice.id}.bin`);
            const buf = Buffer.isBuffer(invoice.file_data)
              ? invoice.file_data
              : Buffer.from(invoice.file_data);
            fs.writeFileSync(absolutePath, buf);
          }

          if (!absolutePath) {
            throw new Error(
              "Archivo de factura no disponible en disco ni en base de datos. Vuelve a subirla."
            );
          }

          const extracted = await extractInvoiceFromFile({
            absolutePath,
            mimeType: invoice.mime_type,
            reportType: batch.report_type,
          });

          await pool.query(
            `UPDATE invoices
             SET status = 'completed', extracted_data = $1, error = NULL, updated_at = NOW()
             WHERE id = $2`,
            [JSON.stringify(extracted), invoice.id]
          );
          processed += 1;
        } catch (err: any) {
          failed += 1;
          const message = err.message || String(err);

          if (isRefundableGeminiError(err)) {
            balance = await refundOcr({
              tenantId: req.user!.tenantId,
              userId: req.user!.id,
              invoiceId: invoice.id,
              attempt,
              reasonDetail: err.code || message,
            });
          }

          await pool.query(
            `UPDATE invoices
             SET status = 'error', error = $1, updated_at = NOW()
             WHERE id = $2`,
            [message, invoice.id]
          );
        }
      }

      const completedCount = await pool.query(
        `SELECT COUNT(*)::int AS c FROM invoices WHERE batch_id = $1 AND status = 'completed'`,
        [batch.id]
      );
      if (completedCount.rows[0].c > 0) {
        await pool.query(
          `UPDATE fiscal_batches SET status = 'ready', updated_at = NOW() WHERE id = $1`,
          [batch.id]
        );
      }

      balance = await getBalance(req.user!.tenantId);

      res.json({
        processed,
        failed,
        skippedInsufficientCredits,
        balance,
      });
    } catch (err: any) {
      console.error("[process]", err);
      res.status(500).json({ error: err.message || "Error al procesar" });
    }
  }
);

invoicesRouter.patch("/invoices/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const found = await pool.query(
      `SELECT i.*, b.company_id
       FROM invoices i
       JOIN fiscal_batches b ON b.id = i.batch_id
       WHERE i.id = $1`,
      [paramId(req.params.id)]
    );
    const invoice = found.rows[0];
    if (!invoice) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }
    const batch = await assertBatchAccess(invoice.batch_id, req.user!.id);
    if (!batch) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    const { extractedData, status } = req.body || {};
    const result = await pool.query(
      `UPDATE invoices SET
         extracted_data = COALESCE($1, extracted_data),
         status = COALESCE($2, status),
         updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [
        extractedData !== undefined ? JSON.stringify(extractedData) : null,
        status ?? null,
        invoice.id,
      ]
    );
    res.json({ invoice: mapInvoice(result.rows[0]) });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

invoicesRouter.delete("/invoices/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const found = await pool.query(
      `SELECT i.*, b.company_id
       FROM invoices i
       JOIN fiscal_batches b ON b.id = i.batch_id
       WHERE i.id = $1`,
      [paramId(req.params.id)]
    );
    const invoice = found.rows[0];
    if (!invoice) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }
    const batch = await assertBatchAccess(invoice.batch_id, req.user!.id);
    if (!batch) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    await pool.query(`DELETE FROM invoices WHERE id = $1`, [invoice.id]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

invoicesRouter.get("/invoices/:id/file", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const found = await pool.query(
      `SELECT i.id, i.batch_id, i.storage_path, i.mime_type, i.original_filename, i.file_data, b.company_id
       FROM invoices i
       JOIN fiscal_batches b ON b.id = i.batch_id
       WHERE i.id = $1`,
      [paramId(req.params.id)]
    );
    const invoice = found.rows[0];
    if (!invoice) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }
    const batch = await assertBatchAccess(invoice.batch_id, req.user!.id);
    if (!batch) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    const mime = invoice.mime_type || "application/octet-stream";
    res.setHeader("Content-Type", mime);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${String(invoice.original_filename || "factura").replace(/"/g, "")}"`
    );
    res.setHeader("Cache-Control", "private, max-age=60");

    // Prefer disk, fallback to Postgres (survives Railway redeploys without a volume)
    if (invoice.storage_path) {
      try {
        const absolute = resolveStoragePath(invoice.storage_path);
        if (fs.existsSync(absolute)) {
          const stream = fs.createReadStream(absolute);
          stream.on("error", (err) => {
            console.error("[file] stream error", err);
            if (!res.headersSent) {
              res.status(500).json({ error: "Error leyendo archivo" });
            } else {
              res.destroy(err);
            }
          });
          stream.pipe(res);
          return;
        }
      } catch (err) {
        console.warn("[file] disk read failed, trying DB fallback:", err);
      }
    }

    if (invoice.file_data) {
      const buf = Buffer.isBuffer(invoice.file_data)
        ? invoice.file_data
        : Buffer.from(invoice.file_data);
      res.send(buf);
      return;
    }

    return res.status(404).json({
      error: "FILE_NOT_FOUND",
      message:
        "El archivo ya no está disponible (p. ej. se perdió tras un redeploy). Vuelve a subir la factura.",
    });
  } catch (err: any) {
    console.error("[file]", err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || "Error" });
    }
  }
});
