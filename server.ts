import express from "express";
import path from "path";
import { GoogleGenAI, Type } from "@google/genai";

const schema606 = {
  type: Type.OBJECT,
  properties: {
    nombreSuplidor: { type: Type.STRING, description: "Nombre legal o comercial del suplidor" },
    rncCedula: { type: Type.STRING, description: "RNC o Cédula del proveedor" },
    tipoId: { type: Type.STRING, description: "1 para RNC, 2 para Cédula, 3 para Pasaporte" },
    tipoGasto: { 
      type: Type.STRING, 
      description: "Código DGII: 01-Gastos de personal, 02-Gastos de trabajos, suministros y servicios, 03-Arrendamientos, 04-Gastos de activos fijos, 05-Gastos de representación, 06-Gastos deducciones admitidas, 07-Gastos financieros, 08-Gastos extraordinarios, 09-Compras y gastos que forman parte del costo de venta, 10-Adquisiciones de activos, 11-Gastos de Seguros" 
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
    montoPropinaLegal: { type: Type.NUMBER, description: "Monto de la propina legal (10%) si aplica" },
    formaPago: { type: Type.STRING, description: "01-Efectivo, 02-Cheque/Transf, 03-Tarjeta, 04-Crédito, 05-Bonos, 06-Permuta, 07-Otras" },
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
      description: "01-Ingresos por Operaciones, 02-Ingresos Financieros, 03-Ingresos Extraordinarios, 04-Otros Ingresos" 
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
    montoPropinaLegal: { type: Type.NUMBER, description: "Monto de la propina legal (10%) si aplica" },
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

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Support large base64 file payloads for invoice uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // Check backend configuration
  app.get("/api/config", (req, res) => {
    res.json({
      hasKey: !!(process.env.GEMINI_API_KEY || process.env.API_KEY)
    });
  });

  // API route to process invoices with Gemini
  app.post("/api/process-invoice", async (req, res) => {
    try {
      const { base64Data, mimeType, reportType, userApiKey } = req.body;

      if (!base64Data) {
        return res.status(400).json({ error: "No se proporcionaron los datos del archivo." });
      }

      // Use userApiKey if provided from client-side dynamic selection, or fall back to server environments
      const apiKey = userApiKey || process.env.GEMINI_API_KEY || process.env.API_KEY;

      if (!apiKey) {
        return res.status(401).json({ error: "No API key configured. Please configure an API key." });
      }

      const ai = new GoogleGenAI({ 
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });
      const rawBase64 = base64Data.includes(",") ? base64Data.split(",")[1] : base64Data;

      // Helper function to try multiple models sequentially and retry transient errors
      const runExtraction = async () => {
        // Models list to try in order of preference
        const models = ["gemini-flash-latest", "gemini-3.1-flash-lite", "gemini-3.5-flash"];
        let lastError: any = null;

        for (const model of models) {
          let attempts = 0;
          const maxAttempts = 2; // Retry on transient failures

          while (attempts < maxAttempts) {
            try {
              console.log(`[AI Extraction] Attempting to process with model: ${model} (attempt ${attempts + 1})`);
              const response = await ai.models.generateContent({
                model: model,
                contents: {
                  parts: [
                    {
                      inlineData: {
                        data: rawBase64,
                        mimeType: mimeType || "image/jpeg",
                      },
                    },
                    {
                      text: `Extract the fiscal data from this invoice for a DGII ${reportType} report.
                      
                      TASK:
                      1. Extract the legal name of the ${reportType === "606" ? "Supplier" : "Client"}.
                      2. IMPORTANT: Analyze the contents/items of the invoice to determine the correct ${reportType === "606" ? "Expense Type (tipoGasto)" : "Income Type (tipoIngreso)"} code according to DGII regulations.
                      3. PAY ATTENTION: Look for "Propina Legal" or "10% Propina" and extract its numeric value into 'montoPropinaLegal'.
                      4. Ensure all numbers are clean and dates are YYYYMMDD.
                      5. If it is a 606 report, use the 606 schema. If it is 607, use the 607 schema.`,
                    },
                  ],
                },
                config: {
                  responseMimeType: "application/json",
                  responseSchema: reportType === "606" ? schema606 : schema607,
                },
              });
              return response;
            } catch (err: any) {
              lastError = err;
              const errMsg = (err.message || err.toString()).toLowerCase();
              const isTransient = errMsg.includes("503") || errMsg.includes("unavailable") || errMsg.includes("demand") || errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("rate limit") || err.status === 503 || err.status === 429;

              if (isTransient) {
                attempts++;
                if (attempts < maxAttempts) {
                  const delay = attempts * 1000;
                  console.log(`[AI Extraction] Transient error on model ${model} (${err.message || err}). Retrying in ${delay}ms...`);
                  await new Promise(resolve => setTimeout(resolve, delay));
                  continue;
                }
              }
              // If not transient or exhausted retries, break loop to try next model
              console.warn(`[AI Extraction] Model ${model} failed: ${err.message || err}. Trying next fallback model...`);
              break;
            }
          }
        }
        throw lastError || new Error("All extraction models failed to process the invoice");
      };

      const response = await runExtraction();
      const jsonStr = response.text;
      if (!jsonStr) {
        return res.status(500).json({ error: "El modelo Gemini no devolvió texto de respuesta." });
      }

      res.json(JSON.parse(jsonStr.trim()));
    } catch (error: any) {
      console.error("Error processing invoice through Gemini:", error);
      let errorMsg = error.message || error.toString();
      let status = 500;

      if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("API key not valid") || errorMsg.includes("INVALID_ARGUMENT") || error.status === 403) {
        status = 401;
        errorMsg = "KEY_NOT_FOUND";
      } else if (errorMsg.includes("quota") || error.status === 429) {
        status = 429;
        errorMsg = "QUOTA_EXCEEDED";
      }

      res.status(status).json({ error: errorMsg });
    }
  });

  // Vite only in development — avoid requiring it at runtime in production images
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
