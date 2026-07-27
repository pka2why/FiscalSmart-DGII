# FiscalSmart DGII — Generador 606/607

Herramienta para procesar facturas con Gemini y generar reportes DGII **606** (compras) y **607** (ventas) en Excel.

## Requisitos

- Node.js 20+
- API key de [Google AI Studio / Gemini](https://aistudio.google.com/apikey)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Edita .env.local y pon GEMINI_API_KEY=...
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo (Express + Vite) |
| `npm run build` | Build frontend + servidor |
| `npm start` | Producción (`dist/server.cjs`) |
| `npm run lint` | Typecheck |

## Deploy en Railway

1. Conecta este repositorio en [Railway](https://railway.app).
2. Railway detectará el `Dockerfile` / `railway.toml`.
3. En **Variables** agrega:
   - `GEMINI_API_KEY` = tu API key
   - `NODE_ENV` = `production` (opcional; el Dockerfile ya lo define)
4. Genera un dominio público (Settings → Networking → Generate Domain).

Railway inyecta `PORT` automáticamente; el servidor lo respeta.

### Variables

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `GEMINI_API_KEY` | Sí | Clave de Gemini para OCR de facturas |
| `PORT` | No | Puerto HTTP (Railway lo asigna) |
| `NODE_ENV` | No | Usa `production` en deploy |

## Stack

- React 19 + Vite + TypeScript
- Express (API `/api/process-invoice`, `/api/config`)
- Google Gemini (`@google/genai`)
- Excel (`xlsx`)
