import { Router } from "express";

export const contactRouter = Router();

const CONTACT_TO = () =>
  process.env.CONTACT_EMAIL?.trim() || "info@bayonetrobles.com";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sendWithResend(opts: {
  to: string;
  replyTo: string;
  subject: string;
  text: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY missing");

  const from =
    process.env.CONTACT_FROM?.trim() || "FiscalSmart <onboarding@resend.dev>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      reply_to: opts.replyTo,
      subject: opts.subject,
      text: opts.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

async function sendWithFormSubmit(opts: {
  to: string;
  name: string;
  email: string;
  company: string;
  message: string;
}): Promise<void> {
  const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(opts.to)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name: opts.name,
      email: opts.email,
      company: opts.company || "(sin empresa)",
      message: opts.message,
      _subject: `Contacto FiscalSmart — ${opts.name}`,
      _replyto: opts.email,
      _template: "table",
      _captcha: "false",
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    success?: string | boolean;
    message?: string;
    error?: string;
  };

  if (!res.ok || data.error || data.success === false) {
    throw new Error(data.message || data.error || `FormSubmit ${res.status}`);
  }
}

contactRouter.post("/", async (req, res) => {
  try {
    const name = String(req.body?.name || "").trim();
    const email = String(req.body?.email || "").trim().toLowerCase();
    const company = String(req.body?.company || "").trim();
    const message = String(req.body?.message || "").trim();

    if (!name || !email || !message) {
      return res.status(400).json({ error: "Nombre, email y mensaje son requeridos" });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Email inválido" });
    }
    if (message.length > 5000) {
      return res.status(400).json({ error: "Mensaje demasiado largo" });
    }

    const to = CONTACT_TO();
    const subject = `Contacto FiscalSmart — ${name}`;
    const text = [
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Empresa: ${company || "(sin empresa)"}`,
      "",
      message,
    ].join("\n");

    if (process.env.RESEND_API_KEY) {
      await sendWithResend({ to, replyTo: email, subject, text });
    } else {
      await sendWithFormSubmit({ to, name, email, company, message });
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error("[contact]", err);
    res.status(500).json({
      error: "No se pudo enviar el mensaje. Intenta más tarde o escribe a info@bayonetrobles.com",
    });
  }
});
