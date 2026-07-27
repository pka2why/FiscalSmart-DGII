import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.ts";
import { grantSignupBonus, getBalance } from "./credits.ts";
import {
  AuthedRequest,
  clearAuthCookie,
  requireAuth,
  setAuthCookie,
  signToken,
} from "./middleware.ts";

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  try {
    const { name, email, password, companyName, rnc } = req.body || {};
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({ error: "Faltan campos requeridos" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }

    const existing = await pool.query(
      `SELECT id FROM users WHERE LOWER(email) = LOWER($1)`,
      [email]
    );
    if (existing.rows[0]) {
      return res.status(409).json({ error: "El email ya está registrado" });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tenantRes = await client.query(
        `INSERT INTO tenants (name, rnc) VALUES ($1, $2) RETURNING id, name, rnc, credit_balance`,
        [companyName, rnc || ""]
      );
      const tenant = tenantRes.rows[0];
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING id, email, name, role, tenant_id`,
        [tenant.id, String(email).toLowerCase().trim(), passwordHash, name]
      );
      const user = userRes.rows[0];
      await client.query("COMMIT");

      await grantSignupBonus(tenant.id, user.id);
      const balance = await getBalance(tenant.id);

      const authUser = {
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
        role: user.role,
      };
      const token = signToken(authUser);
      setAuthCookie(res, token);

      res.status(201).json({
        user: authUser,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          rnc: tenant.rnc,
          creditBalance: balance,
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[auth/register]", err);
    res.status(500).json({ error: err.message || "Error al registrar" });
  }
});

authRouter.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contraseña requeridos" });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.password_hash,
              t.name AS tenant_name, t.rnc, t.credit_balance
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = LOWER($1)`,
      [email]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const ok = await bcrypt.compare(String(password), row.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const authUser = {
      id: row.id,
      tenantId: row.tenant_id,
      email: row.email,
      name: row.name,
      role: row.role,
    };
    setAuthCookie(res, signToken(authUser));

    res.json({
      user: authUser,
      tenant: {
        id: row.tenant_id,
        name: row.tenant_name,
        rnc: row.rnc,
        creditBalance: row.credit_balance,
      },
    });
  } catch (err: any) {
    console.error("[auth/login]", err);
    res.status(500).json({ error: err.message || "Error al iniciar sesión" });
  }
});

authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id,
              t.name AS tenant_name, t.rnc, t.credit_balance
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [req.user!.id]
    );
    const row = result.rows[0];
    if (!row) {
      return res.status(401).json({ error: "Usuario no encontrado" });
    }
    res.json({
      user: {
        id: row.id,
        tenantId: row.tenant_id,
        email: row.email,
        name: row.name,
        role: row.role,
      },
      tenant: {
        id: row.tenant_id,
        name: row.tenant_name,
        rnc: row.rnc,
        creditBalance: row.credit_balance,
      },
    });
  } catch (err: any) {
    console.error("[auth/me]", err);
    res.status(500).json({ error: err.message || "Error" });
  }
});
