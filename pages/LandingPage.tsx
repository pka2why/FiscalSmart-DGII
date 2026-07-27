import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ArrowDown,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  ScanText,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { api } from '../api';

export const LandingPage: React.FC = () => {
  const location = useLocation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    company: '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.hash) {
      const id = location.hash.replace('#', '');
      const el = document.getElementById(id);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api('/api/contact', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSent(true);
      setForm({ name: '', email: '', company: '', message: '' });
    } catch (err: any) {
      setError(err.message || 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fs-landing min-h-screen text-[#e8f0ea] overflow-x-hidden">
      <style>{`
        .fs-landing {
          --fs-ink: #061a14;
          --fs-forest: #0d3b2e;
          --fs-moss: #1f6b4f;
          --fs-leaf: #3d9b6e;
          --fs-mist: #d7ebe0;
          --fs-cream: #f3f7f2;
          --fs-paper: #e8f2ec;
          font-family: 'Figtree', sans-serif;
          background:
            radial-gradient(ellipse 90% 70% at 12% -10%, rgba(61, 155, 110, 0.35), transparent 55%),
            radial-gradient(ellipse 70% 50% at 95% 15%, rgba(15, 80, 55, 0.45), transparent 50%),
            linear-gradient(165deg, var(--fs-ink) 0%, var(--fs-forest) 48%, #082820 100%);
        }

        .fs-landing .brand {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 800;
          letter-spacing: -0.03em;
        }

        .fs-landing .headline {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 700;
          letter-spacing: -0.04em;
          line-height: 1.05;
        }

        @keyframes fs-rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes fs-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }

        @keyframes fs-sheen {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }

        .fs-rise-1 { animation: fs-rise 0.7s ease-out both; }
        .fs-rise-2 { animation: fs-rise 0.7s ease-out 0.12s both; }
        .fs-rise-3 { animation: fs-rise 0.7s ease-out 0.24s both; }
        .fs-rise-4 { animation: fs-rise 0.85s ease-out 0.32s both; }

        .fs-float {
          animation: fs-float 6s ease-in-out infinite;
        }

        .fs-cta-primary {
          background: linear-gradient(120deg, var(--fs-leaf), #5ecf8a, var(--fs-moss));
          background-size: 200% 200%;
          animation: fs-sheen 4s ease infinite alternate;
          color: var(--fs-ink);
        }

        .fs-cta-primary:hover {
          filter: brightness(1.06);
        }

        .fs-hero-shot {
          mask-image: linear-gradient(to bottom, black 78%, transparent 100%);
          -webkit-mask-image: linear-gradient(to bottom, black 78%, transparent 100%);
        }

        .fs-grid {
          background-image:
            linear-gradient(rgba(215, 235, 224, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(215, 235, 224, 0.04) 1px, transparent 1px);
          background-size: 48px 48px;
        }

        .fs-field {
          width: 100%;
          border: 1px solid rgba(13, 59, 46, 0.15);
          border-radius: 0.75rem;
          padding: 0.7rem 0.9rem;
          background: #fff;
          color: var(--fs-ink);
          outline: none;
        }

        .fs-field:focus {
          border-color: var(--fs-moss);
          box-shadow: 0 0 0 3px rgba(31, 107, 79, 0.15);
        }

        .fs-step-num {
          font-family: 'Bricolage Grotesque', sans-serif;
          font-weight: 800;
          font-size: 2.75rem;
          line-height: 1;
          color: var(--fs-leaf);
          opacity: 0.9;
        }
      `}</style>

      {/* —— Hero —— */}
      <div className="fs-grid relative min-h-screen flex flex-col">
        <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-6 fs-rise-1">
          <div className="brand text-2xl sm:text-3xl text-white">FiscalSmart</div>
          <nav className="flex items-center gap-4 sm:gap-6 text-sm font-medium text-[var(--fs-mist)]">
            <a href="#problema" className="hidden md:inline hover:text-white transition-colors">
              Problema
            </a>
            <a href="#como" className="hidden md:inline hover:text-white transition-colors">
              Cómo funciona
            </a>
            <a href="#formatos" className="hidden sm:inline hover:text-white transition-colors">
              606 / 607
            </a>
            <a href="#contacto" className="hover:text-white transition-colors">
              Contacto
            </a>
            <Link to="/login" className="hover:text-white transition-colors">
              Iniciar sesión
            </Link>
          </nav>
        </header>

        <section className="relative z-10 flex-1 flex flex-col px-5 sm:px-10 pt-10 sm:pt-14 pb-0 max-w-6xl mx-auto w-full">
          <p className="brand text-4xl sm:text-6xl md:text-7xl text-white mb-5 fs-rise-1">
            FiscalSmart
          </p>

          <h1 className="headline text-2xl sm:text-3xl md:text-4xl text-[var(--fs-mist)] max-w-2xl fs-rise-2">
            Facturas a reportes 606/607 listos para la DGII
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#a8c9b8] max-w-xl leading-relaxed fs-rise-2">
            Sube comprobantes, deja que la IA extraiga RNC, NCF e ITBIS, revisa el lote
            y exporta el Excel fiscal del periodo.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 fs-rise-3">
            <a
              href="#contacto"
              className="fs-cta-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold shadow-lg shadow-black/25 transition"
            >
              Solicitar acceso
              <ArrowDown size={18} />
            </a>
            <a
              href="#como"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-medium text-[var(--fs-mist)] border border-white/15 hover:bg-white/5 transition"
            >
              Ver cómo funciona
            </a>
          </div>

          <div className="mt-12 sm:mt-16 fs-rise-4 fs-float">
            <img
              src="/landing-product.png"
              alt="Vista de FiscalSmart: lotes fiscales 606 y 607"
              className="fs-hero-shot w-full max-w-5xl mx-auto rounded-t-xl border border-white/10 shadow-2xl shadow-black/40"
              width={1280}
              height={720}
            />
          </div>
        </section>
      </div>

      {/* —— Problema —— */}
      <section
        id="problema"
        className="bg-[var(--fs-cream)] text-[var(--fs-ink)] px-5 sm:px-10 py-16 sm:py-24 scroll-mt-6"
      >
        <div className="max-w-3xl mx-auto">
          <h2 className="headline text-3xl sm:text-4xl mb-4">
            El cierre fiscal no debería ser copiar celdas una por una
          </h2>
          <p className="text-[#3d5c4e] text-lg leading-relaxed mb-6">
            Contadores y equipos administrativos en República Dominicana pierden horas
            transcribiendo facturas a los formatos 606 (compras) y 607 (ventas): RNC, NCF,
            fechas, ITBIS, retenciones y tipificación DGII. Un error de tipeo se convierte
            en rechazo o trabajo doble.
          </p>
          <p className="text-[#3d5c4e] text-lg leading-relaxed">
            FiscalSmart concentra ese trabajo en un solo flujo: captura con IA, revisión
            humana y exportación al Excel que la DGII espera.
          </p>
        </div>
      </section>

      {/* —— Cómo funciona —— */}
      <section
        id="como"
        className="bg-[var(--fs-paper)] text-[var(--fs-ink)] px-5 sm:px-10 py-16 sm:py-24 scroll-mt-6"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="headline text-3xl sm:text-4xl mb-3 text-center">
            Tres pasos por periodo
          </h2>
          <p className="text-[#3d5c4e] text-center text-lg max-w-2xl mx-auto mb-14">
            Organiza un lote 606 o 607 por mes, procesa las facturas y descarga el archivo listo.
          </p>

          <ol className="grid md:grid-cols-3 gap-10 md:gap-8">
            <li>
              <div className="fs-step-num mb-3">01</div>
              <h3 className="font-semibold text-xl mb-2 flex items-center gap-2">
                <ScanText size={20} className="text-[var(--fs-moss)]" />
                Sube facturas
              </h3>
              <p className="text-[#3d5c4e] leading-relaxed">
                PDF o imagen del comprobante. Gemini lee el documento y propone RNC/cédula,
                NCF, montos, ITBIS, propina legal y categoría de gasto o ingreso.
              </p>
            </li>
            <li>
              <div className="fs-step-num mb-3">02</div>
              <h3 className="font-semibold text-xl mb-2 flex items-center gap-2">
                <ShieldCheck size={20} className="text-[var(--fs-moss)]" />
                Revisa y corrige
              </h3>
              <p className="text-[#3d5c4e] leading-relaxed">
                Edita campos en pantalla, valida RNC y NCF, marca pendientes y deja el lote
                listo antes de exportar. Tú decides qué se envía a la DGII.
              </p>
            </li>
            <li>
              <div className="fs-step-num mb-3">03</div>
              <h3 className="font-semibold text-xl mb-2 flex items-center gap-2">
                <FileSpreadsheet size={20} className="text-[var(--fs-moss)]" />
                Exporta Excel
              </h3>
              <p className="text-[#3d5c4e] leading-relaxed">
                Descarga el formato 606 o 607 del periodo. Cada exportación queda versionada
                en el historial del lote para auditoría interna.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* —— Formatos —— */}
      <section
        id="formatos"
        className="bg-[var(--fs-forest)] text-[var(--fs-mist)] px-5 sm:px-10 py-16 sm:py-24 scroll-mt-6"
      >
        <div className="max-w-5xl mx-auto">
          <h2 className="headline text-3xl sm:text-4xl text-white mb-3 text-center">
            Cubierto para compras y ventas
          </h2>
          <p className="text-[#9fbfb0] text-center text-lg max-w-2xl mx-auto mb-14">
            Un espacio de trabajo por tipo de reporte y periodo fiscal (YYYYMM).
          </p>

          <div className="grid md:grid-cols-2 gap-12 md:gap-16">
            <div>
              <p className="brand text-5xl text-[var(--fs-leaf)] mb-3">606</p>
              <h3 className="text-xl font-semibold text-white mb-3">Compras y gastos</h3>
              <p className="text-[#b7d0c4] leading-relaxed mb-4">
                Extrae datos del suplidor, tipifica el gasto según códigos DGII (personal,
                servicios, arrendamientos, financieros, etc.), montos de bienes/servicios,
                ITBIS retenido y forma de pago.
              </p>
              <ul className="space-y-2 text-[#d7ebe0]/
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  RNC, NCF y fechas en formato YYYYMMDD
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  Categoría de gasto sugerida por el contenido de la factura
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  Propina legal e impuestos detectados cuando aplican
                </li>
              </ul>
            </div>
            <div>
              <p className="brand text-5xl text-[var(--fs-leaf)] mb-3">607</p>
              <h3 className="text-xl font-semibold text-white mb-3">Ventas e ingresos</h3>
              <p className="text-[#b7d0c4] leading-relaxed mb-4">
                Captura cliente, tipo de ingreso, monto facturado, ITBIS y desglose de formas
                de pago (efectivo, transferencia, tarjeta, crédito y más) para el formato de ventas.
              </p>
              <ul className="space-y-2 text-[#d7ebe0]">
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  Tipificación 01–04 de ingresos DGII
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  Retenciones e ITBIS cuando aparecen en el comprobante
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 size={18} className="text-[var(--fs-leaf)] flex-shrink-0 mt-0.5" />
                  Excel alineado a columnas del formato 607
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* —— Qué incluye —— */}
      <section className="bg-[var(--fs-cream)] text-[var(--fs-ink)] px-5 sm:px-10 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="headline text-3xl sm:text-4xl mb-4">
            Hecho para el día a día del contador
          </h2>
          <p className="text-[#3d5c4e] text-lg leading-relaxed mb-10">
            No es solo OCR: es un workspace fiscal con control de uso y trazabilidad.
          </p>

          <dl className="space-y-8">
            <div className="border-t border-[var(--fs-ink)]/10 pt-6">
              <dt className="font-semibold text-lg mb-1">Lotes por periodo</dt>
              <dd className="text-[#3d5c4e] leading-relaxed">
                Separa julio de agosto, 606 de 607. Cada lote guarda sus facturas, estado
                de procesamiento y exportaciones.
              </dd>
            </div>
            <div className="border-t border-[var(--fs-ink)]/10 pt-6">
              <dt className="font-semibold text-lg mb-1">Créditos por factura OCR</dt>
              <dd className="text-[#3d5c4e] leading-relaxed">
                Solo consume crédito cuando envías un comprobante a Gemini. Subir, editar y
                exportar Excel no descuentan saldo. Tú controlas el gasto de IA.
              </dd>
            </div>
            <div className="border-t border-[var(--fs-ink)]/10 pt-6">
              <dt className="font-semibold text-lg mb-1">Cuentas por empresa</dt>
              <dd className="text-[#3d5c4e] leading-relaxed">
                Cada cliente trabaja en su propio espacio (tenant): usuarios, lotes y créditos
                aislados. Ideal para firmas contables o empresas con varios responsables.
              </dd>
            </div>
            <div className="border-t border-[var(--fs-ink)]/10 pt-6 border-b pb-6">
              <dt className="font-semibold text-lg mb-1">Historial de exportaciones</dt>
              <dd className="text-[#3d5c4e] leading-relaxed">
                Vuelve a descargar versiones anteriores del Excel si necesitas comparar o
                reenviar un archivo ya generado.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* —— Para quién —— */}
      <section className="bg-[var(--fs-ink)] text-[var(--fs-mist)] px-5 sm:px-10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="headline text-3xl sm:text-4xl text-white mb-4">
            ¿Para quién es FiscalSmart?
          </h2>
          <p className="text-[#9fbfb0] text-lg leading-relaxed mb-8">
            Firmas de contabilidad, departamentos de cuentas por pagar/cobrar y negocios
            formales en RD que declaran ITBIS y remiten formatos 606/607 cada mes.
          </p>
          <a
            href="#contacto"
            className="fs-cta-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold shadow-lg shadow-black/25 transition"
          >
            Hablar con el equipo
            <ArrowDown size={18} />
          </a>
        </div>
      </section>

      {/* —— Contacto —— */}
      <section
        id="contacto"
        className="bg-[var(--fs-cream)] text-[var(--fs-ink)] px-5 sm:px-10 py-16 sm:py-20 scroll-mt-6"
      >
        <div className="max-w-xl mx-auto">
          <h2 className="headline text-2xl sm:text-3xl mb-2 text-center">
            Solicita acceso
          </h2>
          <p className="text-[#3d5c4e] text-base leading-relaxed text-center mb-8">
            Cuéntanos volumen de facturas, si usas 606, 607 o ambos, y te habilitamos la
            cuenta. Escribimos a{' '}
            <a
              href="mailto:info@bayonetrobles.com"
              className="font-medium text-[var(--fs-forest)] underline underline-offset-2"
            >
              info@bayonetrobles.com
            </a>
            .
          </p>

          {sent ? (
            <div className="bg-white border border-[var(--fs-moss)]/20 rounded-2xl p-8 text-center">
              <CheckCircle2 className="mx-auto text-[var(--fs-moss)] mb-3" size={36} />
              <p className="font-semibold text-lg">Mensaje enviado</p>
              <p className="text-[#3d5c4e] text-sm mt-2">
                Te responderemos pronto a tu correo.
              </p>
              <button
                type="button"
                onClick={() => setSent(false)}
                className="mt-6 text-sm font-medium text-[var(--fs-forest)] underline underline-offset-2"
              >
                Enviar otro mensaje
              </button>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="bg-white border border-[var(--fs-ink)]/8 rounded-2xl p-6 sm:p-8 space-y-4 shadow-sm"
            >
              <div>
                <label className="block text-sm font-medium text-[#3d5c4e] mb-1">
                  Nombre
                </label>
                <input
                  required
                  className="fs-field"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  autoComplete="name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d5c4e] mb-1">
                  Email
                </label>
                <input
                  type="email"
                  required
                  className="fs-field"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d5c4e] mb-1">
                  Empresa <span className="font-normal opacity-60">(opcional)</span>
                </label>
                <input
                  className="fs-field"
                  value={form.company}
                  onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
                  autoComplete="organization"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#3d5c4e] mb-1">
                  Mensaje
                </label>
                <textarea
                  required
                  rows={5}
                  className="fs-field resize-y min-h-[120px]"
                  value={form.message}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                  placeholder="Ej.: Firmamos ~200 facturas/mes de compras (606). ¿Cómo empezamos?"
                />
              </div>
              {error && <p className="text-sm text-red-700">{error}</p>}
              <button
                type="submit"
                disabled={sending}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-6 py-3 text-base font-semibold bg-[var(--fs-forest)] text-white hover:bg-[var(--fs-moss)] transition disabled:opacity-60"
              >
                {sending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Send size={18} />
                )}
                Enviar mensaje
              </button>
            </form>
          )}
        </div>
      </section>

      <footer className="bg-[var(--fs-ink)] text-[#7a9a8a] text-sm px-5 sm:px-10 py-8 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          <span className="brand text-white/80 text-base block">FiscalSmart</span>
          <span className="text-xs">Bayonet Robles · Generador 606 / 607</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="mailto:info@bayonetrobles.com" className="hover:text-white transition-colors">
            info@bayonetrobles.com
          </a>
          <Link to="/login" className="hover:text-white transition-colors">
            Iniciar sesión
          </Link>
        </div>
      </footer>
    </div>
  );
};
