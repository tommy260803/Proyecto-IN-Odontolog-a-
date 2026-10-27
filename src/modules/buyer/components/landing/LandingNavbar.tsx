import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Calendar, Lock, Menu, PhoneCall, ShieldCheck, X, MessageSquare, Stethoscope } from 'lucide-react';
import type { StaffSession } from '@/shared/services/staffAuthService';

interface LandingNavbarProps {
  onScrollToSection: (sectionId: string) => void;
  onFocusBooking: () => void;
  onOpenStaffLogin: () => void;
  onEnterSystem: () => void;
  staffSession: StaffSession | null;
}

const NAV_LINKS = [
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'tu-experiencia', label: 'Cómo Atendemos' },
  { id: 'sedes', label: 'Sedes en Trujillo' },
  { id: 'inicio', label: 'Orientación Online' },
];

export function LandingNavbar({
  onScrollToSection,
  onFocusBooking,
  onOpenStaffLogin,
  onEnterSystem,
  staffSession,
}: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id: string) => {
    setMobileOpen(false);
    onScrollToSection(id);
  };

  const handleBook = () => {
    setMobileOpen(false);
    onFocusBooking();
  };

  return (
    <motion.header
      initial={{ y: -16, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs"
    >
      <div className="mx-auto flex h-17 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        
        {/* Marca NexoSalud Dental */}
        <div className="flex items-center gap-3">
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              handleNav('inicio');
            }}
            className="group flex items-center gap-3 focus-visible:outline-none rounded-xl"
          >
            <div className="h-10 w-10 rounded-xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-1 shadow-xs flex items-center justify-center transition-transform group-hover:scale-105">
              <img
                src="/Logo_NexoSalud.png"
                alt="NexoSalud Odontología"
                className="h-full w-full object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-base font-extrabold tracking-tight text-slate-900 leading-none">
                NexoSalud <span className="text-sky-600 font-bold">Dental</span>
              </span>
              <span className="mt-1 text-[11px] font-medium text-slate-500 leading-none">
                Clínica de Especialidades · Trujillo
              </span>
            </div>
          </a>
        </div>

        {/* Enlaces de navegación rápida (Desktop) */}
        <nav aria-label="Navegación principal" className="hidden lg:flex items-center gap-1.5">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="rounded-xl px-3.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Acciones principales de la derecha */}
        <div className="hidden sm:flex items-center gap-2.5">
          {/* Teléfono / WhatsApp Urgencias */}
          <a
            href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20requiero%20orientaci%C3%B3n%20odontol%C3%B3gica"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9.5 items-center gap-2 rounded-xl border border-slate-200/90 bg-slate-50/80 px-3.5 text-xs font-semibold text-slate-700 transition-all hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 active:scale-98"
            title="Atención directa de consultas por WhatsApp"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden xl:inline text-slate-500 font-normal">WhatsApp:</span>
            <span className="font-mono font-bold text-slate-900">944 612 840</span>
          </a>

          {/* Botón CTA: Orientación / Agendar */}
          <button
            type="button"
            onClick={handleBook}
            className="inline-flex h-9.5 items-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-indigo-600 px-4 text-xs font-bold text-white shadow-sm shadow-sky-600/20 hover:from-sky-700 hover:to-indigo-700 transition-all cursor-pointer active:scale-98"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Orientación Gratuita</span>
          </button>

          {/* Acceso para personal clínico / administrativo */}
          {staffSession ? (
            <button
              type="button"
              onClick={onEnterSystem}
              title={`Conectado como ${staffSession.nombres} (${staffSession.rol})`}
              className="inline-flex h-9.5 items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 text-xs font-bold text-sky-800 hover:bg-sky-100 transition-colors cursor-pointer"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-600 text-[10px] font-bold text-white">
                {staffSession.initials}
              </span>
              <span>Ir al Sistema</span>
              <ArrowRight className="h-3.5 w-3.5 text-sky-700" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenStaffLogin}
              title="Acceso exclusivo para el personal de la clínica"
              className="inline-flex h-9.5 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 shadow-2xs transition-colors cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Acceso Staff</span>
            </button>
          )}
        </div>

        {/* Botón menú móvil */}
        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={handleBook}
            className="inline-flex h-8.5 items-center gap-1.5 rounded-xl bg-sky-600 px-3 text-xs font-bold text-white"
          >
            <Calendar className="h-3.5 w-3.5" />
            <span>Consultar</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Abrir menú"
            className="inline-flex h-8.5 w-8.5 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

      </div>

      {/* Menú Móvil Desplegable */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-200 bg-white px-4 py-4 lg:hidden"
          >
            <div className="flex flex-col gap-2">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className="rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {link.label}
                </button>
              ))}

              <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col gap-2">
                <a
                  href="https://wa.me/51944612840?text=Hola%20NexoSalud%20Dental,%20requiero%20orientaci%C3%B3n"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-50 text-emerald-800 p-2.5 text-xs font-bold border border-emerald-200"
                >
                  <PhoneCall className="h-4 w-4 text-emerald-600" />
                  <span>WhatsApp: (044) 612-840</span>
                </a>

                {staffSession ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onEnterSystem();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-sky-600 p-2.5 text-xs font-bold text-white"
                  >
                    <span>Ir al Sistema ({staffSession.nombres})</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      onOpenStaffLogin();
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-700"
                  >
                    <Lock className="h-4 w-4 text-slate-500" />
                    <span>Acceso para Personal</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
