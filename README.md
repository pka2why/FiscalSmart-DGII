# FiscalSmart DGII — Generador 606/607 multi-tenant

Herramienta para procesar facturas con Gemini, organizar lotes 606/607 por periodo fiscal, persistir en Postgres y controlar uso con créditos.

## Requisitos

- Node.js 20+
- PostgreSQL (`DATABASE_URL`)
- API key de [Gemini](https://aistudio.google.com/apikey)

## Desarrollo local

```bash
npm install
cp .env.example .env.local
# Completa DATABASE_URL (usa DATABASE_PUBLIC_URL de Railway), GEMINI_API_KEY, JWT_SECRET
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Desarrollo (Express + Vite) |
| `npm run build` | Build frontend + servidor |
| `npm start` | Producción |
| `npm run lint` | Typecheck |

## Railway

El proyecto ya tiene Postgres. En el servicio de la **app**:

1. Variable `DATABASE_URL=${{Postgres.DATABASE_URL}}` (red privada)
2. `GEMINI_API_KEY`, `JWT_SECRET`, `ADMIN_SECRET`, `SIGNUP_BONUS_CREDITS=10`
3. Volume montado en `/data` (uploads de facturas)
4. `NODE_ENV=production`

Healthcheck: `/api/health`

### Créditos

- 1 crédito = 1 factura enviada a Gemini OCR
- Bonus al registrarse (`SIGNUP_BONUS_CREDITS`, default 10)
- Upload / edición / Excel no consumen créditos

Otorgar créditos (facturación offline):

```bash
curl -X POST https://TU_DOMINIO/api/admin/credits/grant \
  -H "Content-Type: application/json" \
  -H "x-admin-secret: TU_ADMIN_SECRET" \
  -d '{"email":"cliente@empresa.com","credits":100,"note":"Factura 001"}'
```

Uso agregado para facturar:

```bash
curl "https://TU_DOMINIO/api/admin/credits/usage?from=2026-07-01&to=2026-07-31" \
  -H "x-admin-secret: TU_ADMIN_SECRET"
```

## Stack

- React 19 + Vite + React Router
- Express + Postgres (`pg`)
- Gemini OCR + créditos por tenant
- Excel (`xlsx`) con historial versionado de exportaciones
