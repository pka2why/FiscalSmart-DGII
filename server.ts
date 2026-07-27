import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { authRouter } from "./server/auth.ts";
import { batchesRouter } from "./server/batches.ts";
import { adminCreditsRouter, creditsRouter } from "./server/creditsRoutes.ts";
import { migrate } from "./server/db.ts";
import { exportsRouter } from "./server/exports.ts";
import { invoicesRouter } from "./server/invoices.ts";
import { ensureDataRoot } from "./server/storage.ts";

async function startServer() {
  ensureDataRoot();

  if (!process.env.DATABASE_URL) {
    console.warn(
      "[boot] DATABASE_URL missing — set it before using auth/batches features"
    );
  } else {
    await migrate();
  }

  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use(cookieParser());

  app.get("/api/config", (_req, res) => {
    res.json({
      hasKey: !!(process.env.GEMINI_API_KEY || process.env.API_KEY),
      hasDatabase: !!process.env.DATABASE_URL,
    });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/credits", creditsRouter);
  app.use("/api/admin/credits", adminCreditsRouter);
  app.use("/api/batches", batchesRouter);
  app.use("/api", invoicesRouter);
  app.use("/api", exportsRouter);

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
    app.use((req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
