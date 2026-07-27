import { Router } from "express";
import {
  FORMA_PAGO_LABELS,
  GASTO_LABELS,
  INGRESO_LABELS,
  labelOrCode,
} from "../dgiiLabels.ts";
import type {
  It1BreakdownRow,
  It1Compras606,
  It1Stats,
  It1Ventas607,
} from "../types.ts";
import { pool } from "./db.ts";
import { AuthedRequest, requireAuth } from "./middleware.ts";

export const statsRouter = Router();

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function emptyCompras(): It1Compras606 {
  return {
    montoBienes: 0,
    montoServicios: 0,
    totalFacturado: 0,
    itbisFacturado: 0,
    itbisRetenido: 0,
    itbisSujetoACosto: 0,
    itbisPorAdelantar: 0,
    itbisPercibidoenCompras: 0,
    montoRetencionISR: 0,
    isrPercibidoenCompras: 0,
    impuestoSelectivoConsumo: 0,
    otrosImpuestos: 0,
    montoPropinaLegal: 0,
  };
}

function emptyVentas(): It1Ventas607 {
  return {
    montoFacturado: 0,
    itbisFacturado: 0,
    itbisRetenidoPorTerceros: 0,
    itbisPercibido: 0,
    retencionRentaPorTerceros: 0,
    isrPercibido: 0,
    impuestoSelectivoConsumo: 0,
    otrosImpuestos: 0,
    montoPropinaLegal: 0,
    montoEfectivo: 0,
    montoChequeTransferencia: 0,
    montoTarjeta: 0,
    montoVentaCredito: 0,
    montoBonos: 0,
    montoPermuta: 0,
    montoOtrasFormas: 0,
  };
}

type Bucket = { count: number; total: number; itbis: number };

function bump(
  map: Map<string, Bucket>,
  code: string,
  total: number,
  itbis: number
): void {
  const key = code || "";
  const cur = map.get(key) || { count: 0, total: 0, itbis: 0 };
  cur.count += 1;
  cur.total += total;
  cur.itbis += itbis;
  map.set(key, cur);
}

function toRows(
  map: Map<string, Bucket>,
  labels: Record<string, string>
): It1BreakdownRow[] {
  return [...map.entries()]
    .map(([code, b]) => ({
      code: code || "—",
      label: labelOrCode(labels, code),
      count: b.count,
      total: round2(b.total),
      itbis: round2(b.itbis),
    }))
    .sort((a, b) => a.code.localeCompare(b.code));
}

function ncfRows(map: Map<string, Bucket>): It1BreakdownRow[] {
  return [...map.entries()]
    .map(([code, b]) => ({
      code: code || "—",
      label: code ? `NCF ${code}` : "Sin NCF",
      count: b.count,
      total: round2(b.total),
      itbis: round2(b.itbis),
    }))
    .sort((a, b) => b.total - a.total);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function ncfPrefix(ncf: unknown): string {
  const s = String(ncf || "")
    .trim()
    .toUpperCase();
  if (s.length < 3) return s || "";
  return s.slice(0, 3);
}

statsRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const period = String(req.query.period || "");
    if (!/^\d{6}$/.test(period)) {
      return res.status(400).json({ error: "period (YYYYMM) requerido" });
    }

    const companyId = req.user!.companyId;

    const batches = await pool.query(
      `SELECT id, report_type, rnc_informante
       FROM fiscal_batches
       WHERE company_id = $1 AND period = $2 AND status <> 'archived'`,
      [companyId, period]
    );

    const rncInformante =
      batches.rows.find((b) => b.rnc_informante)?.rnc_informante ||
      (
        await pool.query(`SELECT rnc FROM companies WHERE id = $1`, [companyId])
      ).rows[0]?.rnc ||
      "";

    if (batches.rows.length === 0) {
      const empty: It1Stats = {
        period,
        rncInformante,
        ops: {
          count606: 0,
          count607: 0,
          pending: 0,
          error: 0,
          completed: 0,
        },
        kpis: {
          totalCompras: 0,
          totalVentas: 0,
          itbisCredito: 0,
          itbisGenerado: 0,
          itbisRetenido606: 0,
          itbisAPagar: 0,
        },
        compras606: emptyCompras(),
        ventas607: emptyVentas(),
        byTipoGasto: [],
        byTipoIngreso: [],
        byNcfPrefix606: [],
        byNcfPrefix607: [],
        byFormaPago606: [],
      };
      return res.json(empty);
    }

    const statusCounts = await pool.query(
      `SELECT i.status, COUNT(*)::int AS n
       FROM invoices i
       INNER JOIN fiscal_batches b ON b.id = i.batch_id
       WHERE b.company_id = $1 AND b.period = $2 AND b.status <> 'archived'
       GROUP BY i.status`,
      [companyId, period]
    );

    let pending = 0;
    let error = 0;
    let completed = 0;
    for (const row of statusCounts.rows) {
      if (row.status === "pending" || row.status === "processing") {
        pending += row.n;
      } else if (row.status === "error") {
        error += row.n;
      } else if (row.status === "completed") {
        completed += row.n;
      }
    }

    const invoices = await pool.query(
      `SELECT b.report_type, i.extracted_data
       FROM invoices i
       INNER JOIN fiscal_batches b ON b.id = i.batch_id
       WHERE b.company_id = $1
         AND b.period = $2
         AND b.status <> 'archived'
         AND i.status = 'completed'
         AND i.extracted_data IS NOT NULL`,
      [companyId, period]
    );

    const compras = emptyCompras();
    const ventas = emptyVentas();
    let count606 = 0;
    let count607 = 0;

    const byTipoGasto = new Map<string, Bucket>();
    const byTipoIngreso = new Map<string, Bucket>();
    const byNcf606 = new Map<string, Bucket>();
    const byNcf607 = new Map<string, Bucket>();
    const byFormaPago = new Map<string, Bucket>();

    for (const row of invoices.rows) {
      const d = row.extracted_data || {};
      const reportType = String(row.report_type);

      if (reportType === "606") {
        count606 += 1;
        const total = num(d.totalFacturado);
        const itbis = num(d.itbisFacturado);
        compras.montoBienes += num(d.montoBienes);
        compras.montoServicios += num(d.montoServicios);
        compras.totalFacturado += total;
        compras.itbisFacturado += itbis;
        compras.itbisRetenido += num(d.itbisRetenido);
        compras.itbisSujetoACosto += num(d.itbisSujetoACosto);
        compras.itbisPorAdelantar += num(d.itbisPorAdelantar);
        compras.itbisPercibidoenCompras += num(d.itbisPercibidoenCompras);
        compras.montoRetencionISR += num(d.montoRetencionISR);
        compras.isrPercibidoenCompras += num(d.isrPercibidoenCompras);
        compras.impuestoSelectivoConsumo += num(d.impuestoSelectivoConsumo);
        compras.otrosImpuestos += num(d.otrosImpuestos);
        compras.montoPropinaLegal += num(d.montoPropinaLegal);

        bump(byTipoGasto, String(d.tipoGasto || ""), total, itbis);
        bump(byNcf606, ncfPrefix(d.ncf), total, itbis);
        bump(byFormaPago, String(d.formaPago || ""), total, itbis);
      } else if (reportType === "607") {
        count607 += 1;
        const total = num(d.montoFacturado);
        const itbis = num(d.itbisFacturado);
        ventas.montoFacturado += total;
        ventas.itbisFacturado += itbis;
        ventas.itbisRetenidoPorTerceros += num(d.itbisRetenidoPorTerceros);
        ventas.itbisPercibido += num(d.itbisPercibido);
        ventas.retencionRentaPorTerceros += num(d.retencionRentaPorTerceros);
        ventas.isrPercibido += num(d.isrPercibido);
        ventas.impuestoSelectivoConsumo += num(d.impuestoSelectivoConsumo);
        ventas.otrosImpuestos += num(d.otrosImpuestos);
        ventas.montoPropinaLegal += num(d.montoPropinaLegal);
        ventas.montoEfectivo += num(d.montoEfectivo);
        ventas.montoChequeTransferencia += num(d.montoChequeTransferencia);
        ventas.montoTarjeta += num(d.montoTarjeta);
        ventas.montoVentaCredito += num(d.montoVentaCredito);
        ventas.montoBonos += num(d.montoBonos);
        ventas.montoPermuta += num(d.montoPermuta);
        ventas.montoOtrasFormas += num(d.montoOtrasFormas);

        bump(byTipoIngreso, String(d.tipoIngreso || ""), total, itbis);
        bump(byNcf607, ncfPrefix(d.ncf), total, itbis);
      }
    }

    const roundCompras = (c: It1Compras606): It1Compras606 => {
      const out = { ...c };
      for (const k of Object.keys(out) as (keyof It1Compras606)[]) {
        out[k] = round2(out[k]);
      }
      return out;
    };
    const roundVentas = (v: It1Ventas607): It1Ventas607 => {
      const out = { ...v };
      for (const k of Object.keys(out) as (keyof It1Ventas607)[]) {
        out[k] = round2(out[k]);
      }
      return out;
    };

    const comprasR = roundCompras(compras);
    const ventasR = roundVentas(ventas);
    const itbisCredito = comprasR.itbisFacturado;
    const itbisGenerado = ventasR.itbisFacturado;
    const itbisRetenido606 = comprasR.itbisRetenido;
    const itbisAPagar = round2(itbisGenerado - itbisCredito - itbisRetenido606);

    const stats: It1Stats = {
      period,
      rncInformante,
      ops: {
        count606,
        count607,
        pending,
        error,
        completed,
      },
      kpis: {
        totalCompras: comprasR.totalFacturado,
        totalVentas: ventasR.montoFacturado,
        itbisCredito,
        itbisGenerado,
        itbisRetenido606,
        itbisAPagar,
      },
      compras606: comprasR,
      ventas607: ventasR,
      byTipoGasto: toRows(byTipoGasto, GASTO_LABELS),
      byTipoIngreso: toRows(byTipoIngreso, INGRESO_LABELS),
      byNcfPrefix606: ncfRows(byNcf606),
      byNcfPrefix607: ncfRows(byNcf607),
      byFormaPago606: toRows(byFormaPago, FORMA_PAGO_LABELS),
    };

    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});
