
const express = require('express');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const OAuthClient = require('intuit-oauth');
const esbuild = require('esbuild');

const app = express();

// Middleware para parsear JSON
app.use(express.json({ limit: '10mb' }));

// 1. Transpilador robusto para .ts y .tsx
app.get(/\.(ts|tsx)$/, async (req, res, next) => {
  const filePath = path.join(__dirname, req.path.split('?')[0]);
  
  if (!fs.existsSync(filePath)) {
    return next();
  }

  try {
    const source = fs.readFileSync(filePath, 'utf8');
    const result = await esbuild.transform(source, {
      loader: req.path.endsWith('tsx') ? 'tsx' : 'ts',
      format: 'esm',
      target: 'es2020',
      jsx: 'transform',
      jsxFactory: 'React.createElement',
      jsxFragment: 'React.Fragment',
      sourcemap: 'inline'
    });

    res.type('application/javascript').send(result.code);
  } catch (err) {
    console.error(`Error transpilando ${req.path}:`, err);
    res.status(500).send(`console.error("Error en servidor al transpilar ${req.path}: ${err.message}");`);
  }
});

const PORT = process.env.PORT || 3000;

// Configuración de PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') 
    ? false 
    : { rejectUnauthorized: false }
});

// Configuración de QBO
let oauthClient = null;
// Intentar usar RAILWAY_PUBLIC_DOMAIN o similar si está disponible, si no caer a la URL estática
const domain = process.env.RAILWAY_PUBLIC_DOMAIN || process.env.RAILWAY_STATIC_URL || 'localhost:' + PORT;
const protocol = domain.includes('localhost') ? 'http' : 'https';
const redirectUri = process.env.QBO_REDIRECT_URI || `${protocol}://${domain}/api/qbo/callback`;

try {
  if (process.env.QBO_CLIENT_ID && process.env.QBO_CLIENT_SECRET) {
    oauthClient = new OAuthClient({
      clientId: process.env.QBO_CLIENT_ID,
      clientSecret: process.env.QBO_CLIENT_SECRET,
      environment: process.env.QBO_ENVIRONMENT || 'sandbox',
      redirectUri: redirectUri
    });
    console.log(`[QBO] Configurado con Redirect URI: ${redirectUri}`);
  } else {
    console.warn('[QBO] Faltan QBO_CLIENT_ID o QBO_CLIENT_SECRET en las variables de entorno.');
  }
} catch (e) {
  console.error('[QBO] Error inicializando cliente:', e);
}

// Inicialización de DB
const initDb = async () => {
  if (!process.env.DATABASE_URL) {
    console.warn('[DB] DATABASE_URL no definida. La persistencia no funcionará.');
    return;
  }
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS reports (
          id SERIAL PRIMARY KEY,
          report_type VARCHAR(10) NOT NULL,
          data JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE IF NOT EXISTS qbo_tokens (
          id INTEGER PRIMARY KEY DEFAULT 1,
          realm_id TEXT,
          access_token TEXT,
          refresh_token TEXT,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT one_row CHECK (id = 1)
        );
      `);
      console.log('[DB] Base de datos inicializada correctamente.');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[DB] Error inicializando base de datos:', err.message);
  }
};
initDb();

// Rutas API
app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/api/qbo/auth', (req, res) => {
  if (!oauthClient) return res.status(500).json({ error: 'Configuración de QuickBooks incompleta (Faltan IDs)' });
  try {
    const authUri = oauthClient.authorizeUri({
      scope: [OAuthClient.scopes.Accounting, OAuthClient.scopes.OpenId],
      state: 'fiscalsmart_state',
    });
    res.json({ authUri });
  } catch (e) {
    res.status(500).json({ error: 'Error al generar URI de autorización: ' + e.message });
  }
});

app.get('/api/qbo/callback', async (req, res) => {
  if (!oauthClient) return res.status(500).send('Servidor no configurado para QBO');
  try {
    const authResponse = await oauthClient.createToken(req.url);
    const { access_token, refresh_token } = authResponse.getJson();
    const realmId = req.query.realmId;
    await pool.query(`
      INSERT INTO qbo_tokens (id, realm_id, access_token, refresh_token, updated_at)
      VALUES (1, $1, $2, $3, NOW())
      ON CONFLICT (id) DO UPDATE SET realm_id = EXCLUDED.realm_id, access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, updated_at = NOW();
    `, [realmId, access_token, refresh_token]);
    res.send('<html><body style="font-family:sans-serif;text-align:center;padding-top:50px;"><h1>Conexión Exitosa</h1><p>Puedes cerrar esta ventana para volver a la aplicación.</p><script>setTimeout(() => window.close(), 2000);</script></body></html>');
  } catch (e) {
    console.error('[QBO] Callback Error:', e);
    res.status(500).send('Error de autenticación: ' + e.message);
  }
});

app.get('/api/qbo/transactions', async (req, res) => {
  if (!oauthClient) return res.status(500).json({ error: 'QuickBooks no ha sido configurado en el servidor (faltan Client ID/Secret)' });
  
  try {
    const tokenResult = await pool.query('SELECT * FROM qbo_tokens WHERE id = 1');
    if (tokenResult.rows.length === 0) return res.status(401).json({ error: 'No se ha establecido conexión con QuickBooks. Por favor, conéctate primero.' });
    
    const { access_token, refresh_token, realm_id } = tokenResult.rows[0];
    oauthClient.setToken({ access_token, refresh_token });
    
    if (!oauthClient.isAccessTokenValid()) {
      try {
        const authResponse = await oauthClient.refresh();
        const newTokens = authResponse.getJson();
        await pool.query('UPDATE qbo_tokens SET access_token = $1, refresh_token = $2, updated_at = NOW() WHERE id = 1', [newTokens.access_token, newTokens.refresh_token]);
      } catch (refreshErr) {
        console.error('[QBO] Error refrescando token:', refreshErr);
        return res.status(401).json({ error: 'La sesión de QuickBooks ha expirado. Por favor, vuelve a conectarte.' });
      }
    }
    
    const query = "SELECT * FROM Invoice WHERE Balance > 0";
    const baseUrl = oauthClient.environment === 'sandbox' ? 'https://sandbox-quickbooks.api.intuit.com/' : 'https://quickbooks.api.intuit.com/';
    
    const response = await oauthClient.makeApiCall({
      url: `${baseUrl}v3/company/${realm_id}/query?query=${encodeURIComponent(query)}`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }
    });

    if (response.status >= 400) {
      const qboError = response.getJson();
      console.error('[QBO] API Error:', qboError);
      return res.status(response.status).json({ error: `Error de API de QuickBooks: ${response.status}`, details: qboError });
    }

    const invoices = response.getJson().QueryResponse.Invoice || [];
    res.json(invoices.map(inv => ({ 
      id: inv.Id, 
      vendorName: inv.CustomerRef.name, 
      amount: inv.TotalAmt, 
      date: inv.TxnDate, 
      memo: inv.CustomerMemo?.value || '', 
      referenceNo: inv.DocNumber || '', 
      taxAmount: inv.TxnTaxDetail?.TotalTax || 0 
    })));
  } catch (e) {
    console.error('[QBO] Transactions Error:', e);
    res.status(500).json({ error: 'Error interno al procesar transacciones: ' + e.message });
  }
});

app.post('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('INSERT INTO reports (report_type, data) VALUES ($1, $2) RETURNING *', [req.body.type, JSON.stringify(req.body.items)]);
    res.json({ success: true, report: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/reports', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM reports WHERE report_type = $1 ORDER BY created_at DESC', [req.query.type]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Servir index.html
app.get(['/', '/index.html'], (req, res) => {
  try {
    let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const envInjection = `
      <script>
        window.process = { env: { API_KEY: ${JSON.stringify(process.env.API_KEY)} } };
      </script>
    `;
    html = html.replace('<head>', '<head>' + envInjection);
    res.send(html);
  } catch (e) {
    res.status(500).send('Error cargando index.html: ' + e.message);
  }
});

// Estáticos después del transpilador
app.use(express.static(__dirname));

// SPA Fallback
app.get('*', (req, res) => {
    try {
      let html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
      const envInjection = `<script>window.process = { env: { API_KEY: ${JSON.stringify(process.env.API_KEY)} } };</script>`;
      html = html.replace('<head>', '<head>' + envInjection);
      res.send(html);
    } catch (e) {
      res.status(500).send('Error en fallback SPA: ' + e.message);
    }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor activo en puerto ${PORT}`);
});
