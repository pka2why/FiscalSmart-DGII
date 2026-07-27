import { Router } from "express";
import bcrypt from "bcryptjs";
import { pool } from "./db.ts";
import {
  AuthUser,
  AuthedRequest,
  requireAuth,
  setAuthCookie,
  signToken,
} from "./middleware.ts";
import { paramId } from "./params.ts";

export interface CompanyRow {
  id: string;
  tenant_id: string;
  name: string;
  rnc: string;
  created_at: string;
  member_role?: string;
}

export function mapCompany(row: CompanyRow & { member_role?: string }) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    rnc: row.rnc,
    role: row.member_role || "member",
    createdAt: row.created_at,
  };
}

export async function listUserCompanies(userId: string) {
  const result = await pool.query(
    `SELECT c.id, c.tenant_id, c.name, c.rnc, c.created_at, cm.role AS member_role
     FROM companies c
     JOIN company_members cm ON cm.company_id = c.id
     WHERE cm.user_id = $1
     ORDER BY c.created_at ASC`,
    [userId]
  );
  return result.rows as CompanyRow[];
}

export async function getCompanyMembership(userId: string, companyId: string) {
  const result = await pool.query(
    `SELECT c.id, c.tenant_id, c.name, c.rnc, c.created_at, cm.role AS member_role
     FROM companies c
     JOIN company_members cm ON cm.company_id = c.id
     WHERE cm.user_id = $1 AND c.id = $2`,
    [userId, companyId]
  );
  return (result.rows[0] as CompanyRow | undefined) || null;
}

/** Returns company if user is a member; otherwise null. */
export async function assertCompanyAccess(userId: string, companyId: string) {
  return getCompanyMembership(userId, companyId);
}

export async function resolveActiveCompany(
  userId: string,
  preferredCompanyId?: string | null
): Promise<CompanyRow | null> {
  if (preferredCompanyId) {
    const preferred = await getCompanyMembership(userId, preferredCompanyId);
    if (preferred) return preferred;
  }
  const companies = await listUserCompanies(userId);
  return companies[0] || null;
}

export function buildAuthUser(opts: {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  tenantRole: string;
  companyId: string;
  companyRole: string;
}): AuthUser {
  return {
    id: opts.id,
    tenantId: opts.tenantId,
    companyId: opts.companyId,
    email: opts.email,
    name: opts.name,
    role: opts.companyRole,
    tenantRole: opts.tenantRole,
  };
}

export async function sessionPayload(
  userId: string,
  preferredCompanyId?: string | null
) {
  const userRes = await pool.query(
    `SELECT u.id, u.email, u.name, u.role AS tenant_role, u.tenant_id,
            t.name AS tenant_name, t.rnc AS tenant_rnc, t.credit_balance
     FROM users u
     JOIN tenants t ON t.id = u.tenant_id
     WHERE u.id = $1`,
    [userId]
  );
  const row = userRes.rows[0];
  if (!row) return null;

  const companies = await listUserCompanies(userId);
  const active = await resolveActiveCompany(userId, preferredCompanyId);
  if (!active) {
    return {
      user: null as AuthUser | null,
      tenant: {
        id: row.tenant_id,
        name: row.tenant_name,
        rnc: row.tenant_rnc,
        creditBalance: row.credit_balance,
      },
      company: null,
      companies: [] as ReturnType<typeof mapCompany>[],
      error: "Sin empresas asignadas",
    };
  }

  const authUser = buildAuthUser({
    id: row.id,
    tenantId: row.tenant_id,
    email: row.email,
    name: row.name,
    tenantRole: row.tenant_role,
    companyId: active.id,
    companyRole: active.member_role || "member",
  });

  return {
    user: authUser,
    tenant: {
      id: row.tenant_id,
      name: row.tenant_name,
      rnc: row.tenant_rnc,
      creditBalance: row.credit_balance,
    },
    company: mapCompany(active),
    companies: companies.map(mapCompany),
    error: null as string | null,
  };
}

export const companiesRouter = Router();

companiesRouter.get("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const companies = await listUserCompanies(req.user!.id);
    res.json({
      companies: companies.map(mapCompany),
      activeCompanyId: req.user!.companyId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

companiesRouter.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    if (req.user!.tenantRole !== "owner") {
      return res.status(403).json({ error: "Solo el owner del tenant puede crear empresas" });
    }

    const { name, rnc } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: "Nombre de empresa requerido" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const companyRes = await client.query(
        `INSERT INTO companies (tenant_id, name, rnc)
         VALUES ($1, $2, $3)
         RETURNING id, tenant_id, name, rnc, created_at`,
        [req.user!.tenantId, String(name).trim(), rnc || ""]
      );
      const company = companyRes.rows[0];
      await client.query(
        `INSERT INTO company_members (company_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [company.id, req.user!.id]
      );
      await client.query("COMMIT");

      res.status(201).json({
        company: mapCompany({ ...company, member_role: "owner" }),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error("[companies/create]", err);
    res.status(500).json({ error: err.message || "Error al crear empresa" });
  }
});

companiesRouter.patch("/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const companyId = paramId(req.params.id);
    const membership = await getCompanyMembership(req.user!.id, companyId);
    if (!membership) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    if (membership.member_role !== "owner") {
      return res.status(403).json({ error: "Solo el owner de la empresa puede editarla" });
    }

    const { name, rnc } = req.body || {};
    const result = await pool.query(
      `UPDATE companies SET
         name = COALESCE($1, name),
         rnc = COALESCE($2, rnc)
       WHERE id = $3
       RETURNING id, tenant_id, name, rnc, created_at`,
      [
        name !== undefined ? String(name).trim() : null,
        rnc !== undefined ? String(rnc) : null,
        companyId,
      ]
    );

    res.json({
      company: mapCompany({
        ...result.rows[0],
        member_role: membership.member_role,
      }),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

companiesRouter.post("/:id/switch", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const companyId = paramId(req.params.id);
    const session = await sessionPayload(req.user!.id, companyId);
    if (!session || !session.user) {
      return res.status(403).json({
        error: session?.error || "No tienes acceso a esta empresa",
      });
    }
    if (session.user.companyId !== companyId) {
      return res.status(403).json({ error: "No tienes acceso a esta empresa" });
    }

    setAuthCookie(res, signToken(session.user));
    res.json({
      user: session.user,
      tenant: session.tenant,
      company: session.company,
      companies: session.companies,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

companiesRouter.get("/:id/members", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const companyId = paramId(req.params.id);
    const membership = await getCompanyMembership(req.user!.id, companyId);
    if (!membership) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }

    const result = await pool.query(
      `SELECT u.id, u.email, u.name, cm.role, cm.created_at
       FROM company_members cm
       JOIN users u ON u.id = cm.user_id
       WHERE cm.company_id = $1
       ORDER BY cm.created_at ASC`,
      [companyId]
    );

    res.json({
      members: result.rows.map((row) => ({
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        createdAt: row.created_at,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Error" });
  }
});

companiesRouter.post("/:id/members", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const companyId = paramId(req.params.id);
    const membership = await getCompanyMembership(req.user!.id, companyId);
    if (!membership) {
      return res.status(404).json({ error: "Empresa no encontrada" });
    }
    if (membership.member_role !== "owner") {
      return res.status(403).json({ error: "Solo el owner puede agregar miembros" });
    }

    const { email, name, password, role } = req.body || {};
    if (!email || !String(email).trim()) {
      return res.status(400).json({ error: "Email requerido" });
    }
    const memberRole = role === "owner" ? "owner" : "member";
    const normalizedEmail = String(email).toLowerCase().trim();

    const existing = await pool.query(
      `SELECT id, tenant_id, email, name FROM users WHERE LOWER(email) = $1`,
      [normalizedEmail]
    );
    let userId: string;
    let userName: string;
    let userEmail: string;

    if (existing.rows[0]) {
      if (existing.rows[0].tenant_id !== req.user!.tenantId) {
        return res.status(409).json({
          error: "Ese email pertenece a otro tenant",
        });
      }
      userId = existing.rows[0].id;
      userName = existing.rows[0].name;
      userEmail = existing.rows[0].email;
    } else {
      if (!name || !password) {
        return res.status(400).json({
          error: "Para usuarios nuevos se requiere name y password",
        });
      }
      if (String(password).length < 6) {
        return res.status(400).json({
          error: "La contraseña debe tener al menos 6 caracteres",
        });
      }
      const passwordHash = await bcrypt.hash(String(password), 10);
      const created = await pool.query(
        `INSERT INTO users (tenant_id, email, password_hash, name, role)
         VALUES ($1, $2, $3, $4, 'member')
         RETURNING id, email, name`,
        [req.user!.tenantId, normalizedEmail, passwordHash, String(name).trim()]
      );
      userId = created.rows[0].id;
      userName = created.rows[0].name;
      userEmail = created.rows[0].email;
    }

    await pool.query(
      `INSERT INTO company_members (company_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id, user_id)
       DO UPDATE SET role = EXCLUDED.role`,
      [companyId, userId, memberRole]
    );

    res.status(201).json({
      member: {
        id: userId,
        email: userEmail,
        name: userName,
        role: memberRole,
      },
    });
  } catch (err: any) {
    console.error("[companies/members]", err);
    res.status(500).json({ error: err.message || "Error" });
  }
});

companiesRouter.delete(
  "/:id/members/:userId",
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const companyId = paramId(req.params.id);
      const targetUserId = paramId(req.params.userId);
      const membership = await getCompanyMembership(req.user!.id, companyId);
      if (!membership) {
        return res.status(404).json({ error: "Empresa no encontrada" });
      }
      if (membership.member_role !== "owner") {
        return res.status(403).json({ error: "Solo el owner puede quitar miembros" });
      }

      const target = await pool.query(
        `SELECT role FROM company_members WHERE company_id = $1 AND user_id = $2`,
        [companyId, targetUserId]
      );
      if (!target.rows[0]) {
        return res.status(404).json({ error: "Miembro no encontrado" });
      }

      if (target.rows[0].role === "owner") {
        const owners = await pool.query(
          `SELECT COUNT(*)::int AS c FROM company_members
           WHERE company_id = $1 AND role = 'owner'`,
          [companyId]
        );
        if (owners.rows[0].c <= 1) {
          return res.status(400).json({
            error: "No se puede eliminar al último owner de la empresa",
          });
        }
      }

      await pool.query(
        `DELETE FROM company_members WHERE company_id = $1 AND user_id = $2`,
        [companyId, targetUserId]
      );
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Error" });
    }
  }
);
