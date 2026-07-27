import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.ts";
import { grantSignupBonus, getBalance } from "./credits.ts";
import {
  buildAuthUser,
  sessionPayload,
} from "./companies.ts";
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
      const companyRes = await client.query(
        `INSERT INTO companies (tenant_id, name, rnc)
         VALUES ($1, $2, $3)
         RETURNING id, tenant_id, name, rnc, created_at`,
        [tenant.id, companyName, rnc || ""]
      );
      const company = companyRes.rows[0];
      const userRes = await client.query(
        `INSERT INTO users (tenant_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, 'owner')
         RETURNING id, email, name, role, tenant_id`,
        [tenant.id, String(email).toLowerCase().trim(), passwordHash, name]
      );
      const user = userRes.rows[0];
      await client.query(
        `INSERT INTO company_members (company_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [company.id, user.id]
      );
      await client.query("COMMIT");

      await grantSignupBonus(tenant.id, user.id);
      const balance = await getBalance(tenant.id);

      const authUser = buildAuthUser({
        id: user.id,
        tenantId: user.tenant_id,
        email: user.email,
        name: user.name,
        tenantRole: user.role,
        companyId: company.id,
        companyRole: "owner",
      });
      setAuthCookie(res, signToken(authUser));

      res.status(201).json({
        user: authUser,
        tenant: {
          id: tenant.id,
          name: tenant.name,
          rnc: tenant.rnc,
          creditBalance: balance,
        },
        company: {
          id: company.id,
          tenantId: company.tenant_id,
          name: company.name,
          rnc: company.rnc,
          role: "owner",
          createdAt: company.created_at,
        },
        companies: [
          {
            id: company.id,
            tenantId: company.tenant_id,
            name: company.name,
            rnc: company.rnc,
            role: "owner",
            createdAt: company.created_at,
          },
        ],
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
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id, u.password_hash
       FROM users u
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

    const session = await sessionPayload(row.id);
    if (!session || !session.user) {
      return res.status(403).json({
        error: session?.error || "Usuario sin empresas asignadas",
      });
    }

    setAuthCookie(res, signToken(session.user));
    res.json({
      user: session.user,
      tenant: session.tenant,
      company: session.company,
      companies: session.companies,
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
    const session = await sessionPayload(req.user!.id, req.user!.companyId);
    if (!session || !session.user) {
      return res.status(401).json({
        error: session?.error || "Usuario no encontrado",
      });
    }

    // Re-issue cookie if active company was corrected
    if (session.user.companyId !== req.user!.companyId) {
      setAuthCookie(res, signToken(session.user));
    }

    res.json({
      user: session.user,
      tenant: session.tenant,
      company: session.company,
      companies: session.companies,
    });
  } catch (err: any) {
    console.error("[auth/me]", err);
    res.status(500).json({ error: err.message || "Error" });
  }
});
