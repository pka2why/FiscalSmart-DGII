import { GoogleGenAI, Type } from "@google/genai";
import fs from "fs";

const schema606 = {
  type: Type.OBJECT,
  properties: {
    nombreSuplidor: { type: Type.STRING, description: "Nombre legal o comercial del suplidor" },
    rncCedula: { type: Type.STRING, description: "RNC o Cédula del proveedor" },
    tipoId: { type: Type.STRING, description: "1 para RNC, 2 para Cédula, 3 para Pasaporte" },
    tipoGasto: {
      type: Type.STRING,
      description:
        "Código DGII: 01-Gastos de personal, 02-Gastos de trabajos, suministros y servicios, 03-Arrendamientos, 04-Gastos de activos fijos, 05-Gastos de representación, 06-Gastos deducciones admitidas, 07-Gastos financieros, 08-Gastos extraordinarios, 09-Compras y gastos que forman parte del costo de venta, 10-Adquisiciones de activos, 11-Gastos de Seguros",
    },
    ncf: { type: Type.STRING, description: "Número de Comprobante Fiscal" },
    ncfModificado: { type: Type.STRING, description: "NCF modificado si aplica" },
    fechaComprobante: { type: Type.STRING, description: "Fecha YYYYMMDD" },
    fechaPago: { type: Type.STRING, description: "Fecha de pago YYYYMMDD" },
    montoServicios: { type: Type.NUMBER },
    montoBienes: { type: Type.NUMBER },
    totalFacturado: { type: Type.NUMBER },
    itbisFacturado: { type: Type.NUMBER },
    itbisRetenido: { type: Type.NUMBER },
    itbisSujetoACosto: { type: Type.NUMBER },
    itbisPorAdelantar: { type: Type.NUMBER },
    itbisPercibidoenCompras: { type: Type.NUMBER },
    tipoRetencionISR: { type: Type.STRING },
    montoRetencionISR: { type: Type.NUMBER },
    isrPercibidoenCompras: { type: Type.NUMBER },
    impuestoSelectivoConsumo: { type: Type.NUMBER },
    otrosImpuestos: { type: Type.NUMBER },
    montoPropinaLegal: {
      type: Type.NUMBER,
      description: "Monto de la propina legal (10%) si aplica",
    },
    formaPago: {
      type: Type.STRING,
      description: "01-Efectivo, 02-Cheque/Transf, 03-Tarjeta, 04-Crédito, 05-Bonos, 06-Permuta, 07-Otras",
    },
  },
  required: ["rncCedula", "ncf", "fechaComprobante", "totalFacturado", "nombreSuplidor", "tipoGasto"],
};

const schema607 = {
  type: Type.OBJECT,
  properties: {
    nombreCliente: { type: Type.STRING, description: "Nombre del cliente o razón social" },
    rncCedula: { type: Type.STRING, description: "RNC o Cédula del cliente" },
    tipoId: { type: Type.STRING, description: "1 para RNC, 2 para Cédula" },
    ncf: { type: Type.STRING, description: "Número de Comprobante Fiscal" },
    ncfModificado: { type: Type.STRING, description: "NCF modificado si aplica" },
    tipoIngreso: {
      type: Type.STRING,
      description:
        "01-Ingresos por Operaciones, 02-Ingresos Financieros, 03-Ingresos Extraordinarios, 04-Otros Ingresos",
    },
    fechaComprobante: { type: Type.STRING, description: "Fecha YYYYMMDD" },
    fechaRetencion: { type: Type.STRING, description: "Fecha retención YYYYMMDD" },
    montoFacturado: { type: Type.NUMBER },
    itbisFacturado: { type: Type.NUMBER },
    itbisRetenidoPorTerceros: { type: Type.NUMBER },
    itbisPercibido: { type: Type.NUMBER },
    retencionRentaPorTerceros: { type: Type.NUMBER },
    isrPercibido: { type: Type.NUMBER },
    impuestoSelectivoConsumo: { type: Type.NUMBER },
    otrosImpuestos: { type: Type.NUMBER },
    montoPropinaLegal: {
      type: Type.NUMBER,
      description: "Monto de la propina legal (10%) si aplica",
    },
    montoEfectivo: { type: Type.NUMBER },
    montoChequeTransferencia: { type: Type.NUMBER },
    montoTarjeta: { type: Type.NUMBER },
    montoVentaCredito: { type: Type.NUMBER },
    montoBonos: { type: Type.NUMBER },
    montoPermuta: { type: Type.NUMBER },
    montoOtrasFormas: { type: Type.NUMBER },
  },
  required: ["rncCedula", "ncf", "fechaComprobante", "montoFacturado", "nombreCliente", "tipoIngreso"],
};

export type GeminiInfraErrorCode = "KEY_NOT_FOUND" | "QUOTA_EXCEEDED" | "INFRA_ERROR";

export class GeminiInfraError extends Error {
  code: GeminiInfraErrorCode;
  constructor(code: GeminiInfraErrorCode, message: string) {
    super(message);
    this.name = "GeminiInfraError";
    this.code = code;
  }
}

export function isRefundableGeminiError(err: unknown): boolean {
  return err instanceof GeminiInfraError;
}

export async function extractInvoiceFromFile(opts: {
  absolutePath: string;
  mimeType: string;
  reportType: "606" | "607";
}): Promise<Record<string, unknown>> {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) {
    throw new GeminiInfraError("KEY_NOT_FOUND", "No API key configured");
  }

  const buffer = fs.readFileSync(opts.absolutePath);
  const rawBase64 = buffer.toString("base64");

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const models = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
  let lastError: any = null;

  for (const model of models) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      try {
        console.log(
          `[AI Extraction] model=${model} attempt=${attempts + 1} type=${opts.reportType}`
        );
        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  data: rawBase64,
                  mimeType: opts.mimeType || "image/jpeg",
                },
              },
              {
                text: `Extract the fiscal data from this invoice for a DGII ${opts.reportType} report.

TASK:
1. Extract the legal name of the ${opts.reportType === "606" ? "Supplier" : "Client"}.
2. IMPORTANT: Analyze the contents/items of the invoice to determine the correct ${
                  opts.reportType === "606" ? "Expense Type (tipoGasto)" : "Income Type (tipoIngreso)"
                } code according to DGII regulations.
3. PAY ATTENTION: Look for "Propina Legal" or "10% Propina" and extract its numeric value into 'montoPropinaLegal'.
4. Ensure all numbers are clean and dates are YYYYMMDD.
5. If it is a 606 report, use the 606 schema. If it is 607, use the 607 schema.`,
              },
            ],
          },
          config: {
            responseMimeType: "application/json",
            responseSchema: opts.reportType === "606" ? schema606 : schema607,
          },
        });

        const jsonStr = response.text;
        if (!jsonStr) {
          throw new Error("El modelo Gemini no devolvió texto de respuesta.");
        }
        return JSON.parse(jsonStr.trim());
      } catch (err: any) {
        lastError = err;
        const errMsg = (err.message || err.toString()).toLowerCase();
        const isTransient =
          errMsg.includes("503") ||
          errMsg.includes("unavailable") ||
          errMsg.includes("demand") ||
          errMsg.includes("429") ||
          errMsg.includes("quota") ||
          errMsg.includes("rate limit") ||
          err.status === 503 ||
          err.status === 429;

        if (isTransient) {
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise((r) => setTimeout(r, attempts * 1000));
            continue;
          }
        }
        console.warn(`[AI Extraction] Model ${model} failed: ${err.message || err}`);
        break;
      }
    }
  }

  const msg = lastError?.message || String(lastError || "All models failed");
  if (
    msg.includes("Requested entity was not found") ||
    msg.includes("API key not valid") ||
    msg.includes("INVALID_ARGUMENT") ||
    lastError?.status === 403
  ) {
    throw new GeminiInfraError("KEY_NOT_FOUND", msg);
  }
  if (msg.toLowerCase().includes("quota") || lastError?.status === 429) {
    throw new GeminiInfraError("QUOTA_EXCEEDED", msg);
  }
  if (lastError?.status >= 500) {
    throw new GeminiInfraError("INFRA_ERROR", msg);
  }
  throw lastError || new Error("All extraction models failed");
}
