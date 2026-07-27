import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export const LandingPage: React.FC = () => {
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
      `}</style>

      <div className="fs-grid relative min-h-screen flex flex-col">
        <header className="relative z-10 flex items-center justify-between px-5 sm:px-10 pt-6 fs-rise-1">
          <div className="brand text-2xl sm:text-3xl text-white">FiscalSmart</div>
          <Link
            to="/login"
            className="text-sm font-medium text-[var(--fs-mist)] hover:text-white transition-colors"
          >
            Iniciar sesión
          </Link>
        </header>

        <section className="relative z-10 flex-1 flex flex-col px-5 sm:px-10 pt-10 sm:pt-14 pb-0 max-w-6xl mx-auto w-full">
          <p className="brand text-4xl sm:text-6xl md:text-7xl text-white mb-5 fs-rise-1">
            FiscalSmart
          </p>

          <h1 className="headline text-2xl sm:text-3xl md:text-4xl text-[var(--fs-mist)] max-w-2xl fs-rise-2">
            Facturas a reportes 606/607 listos para la DGII
          </h1>

          <p className="mt-4 text-base sm:text-lg text-[#a8c9b8] max-w-xl leading-relaxed fs-rise-2">
            OCR con Gemini, lotes por periodo y Excel fiscal — sin armar filas a mano.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3 fs-rise-3">
            <Link
              to="/register"
              className="fs-cta-primary inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold shadow-lg shadow-black/25 transition"
            >
              Crear cuenta gratis
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-medium text-[var(--fs-mist)] border border-white/15 hover:bg-white/5 transition"
            >
              Ya tengo cuenta
            </Link>
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

      <section className="bg-[var(--fs-cream)] text-[var(--fs-ink)] px-5 sm:px-10 py-16 sm:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="headline text-2xl sm:text-3xl mb-3">
            Del comprobante al formato DGII
          </h2>
          <p className="text-[#3d5c4e] text-base sm:text-lg leading-relaxed">
            Sube facturas, revisa los datos extraídos y exporta el Excel 606 o 607.
            Empiezas con créditos de bienvenida al registrarte.
          </p>
          <Link
            to="/register"
            className="mt-8 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-base font-semibold bg-[var(--fs-forest)] text-white hover:bg-[var(--fs-moss)] transition"
          >
            Empezar ahora
            <ArrowRight size={18} />
          </Link>
        </div>
      </section>

      <footer className="bg-[var(--fs-ink)] text-[#7a9a8a] text-sm px-5 sm:px-10 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
        <span className="brand text-white/80 text-base">FiscalSmart</span>
        <span>Generador 606 / 607 · República Dominicana</span>
      </footer>
    </div>
  );
};
