import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowRight, Calendar, Lock, Menu, PhoneCall, ShieldCheck, X } from 'lucide-react';
import type { StaffSession } from '@/shared/services/staffAuthService';
import { MagneticButton } from './MagneticButton';

interface LandingNavbarProps {
  onScrollToSection: (sectionId: string) => void;
  onFocusBooking: () => void;
  onOpenStaffLogin: () => void;
  onEnterSystem: () => void;
  staffSession: StaffSession | null;
}

const NAV_LINKS = [
  { id: 'tu-experiencia', label: 'Cómo Atendemos' },
  { id: 'tratamientos', label: 'Tratamientos' },
  { id: 'tecnologia', label: 'Tecnología' },
  { id: 'sedes', label: 'Sedes' },
  { id: 'testimonios', label: 'Testimonios' },
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
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/90 backdrop-blur-md"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        {/* Marca NexoSalud Dental */}
        <div className="flex items-center gap-3">
          <a
            href="#inicio"
            onClick={(e) => {
              e.preventDefault();
              handleNav('inicio');
            }}
            className="group flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/30 rounded-lg"
          >
            <img
              src="/Logo_NexoSalud.png"
              alt="NexoSalud Dental"
              className="h-9 w-9 rounded-lg border border-slate-200/80 bg-white object-contain p-0.5 shadow-xs transition-transform duration-200 group-hover:scale-[1.03]"
            />
            <div className="flex flex-col">
              <span className="text-[15px] font-semibold tracking-tight text-slate-900 leading-none">
                NexoSalud <span className="text-[#0F766E] font-medium">Dental</span>
              </span>
              <span className="mt-1 text-[11px] font-normal text-slate-500 leading-none">
                Clínica de Especialidades
              </span>
            </div>
          </a>
        </div>

        {/* Enlaces de navegación suave (Desktop) */}
        <nav aria-label="Navegación principal" className="hidden md:flex items-center gap-1 lg:gap-2">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/20 cursor-pointer"
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Acciones de derecha: Urgencias / WhatsApp + Agendar Cita + Iniciar Sesión / Sistema */}
        <div className="hidden sm:flex items-center gap-2.5">
          <a
            href="https://wa.me/51944612840?text=Hola%20NexoSalud%20Dental,%20requiero%20atenci%C3%B3n%20odontol%C3%B3gica%20prioritaria"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/70 px-3 text-xs font-medium text-slate-700 transition-all hover:border-teal-700/30 hover:bg-[#ECFDF5]/60 hover:text-[#065F46] active:scale-[0.98]"
            title="Atención inmediata de urgencias odontológicas"
          >
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" />
            </span>
            <PhoneCall className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
            <span className="hidden xl:inline">Urgencias:</span>
            <span className="font-mono font-semibold">(044) 612-840</span>
          </a>

          <MagneticButton
            onClick={handleBook}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0F766E] px-4 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/30"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            <span>Agendar Cita</span>
          </MagneticButton>

          {staffSession ? (
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onEnterSystem}
              title={`Conectado como ${staffSession.nombres} ${staffSession.apellidos} (${staffSession.rol})`}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#0F766E]/30 bg-[#ECFDF5]/70 px-3 text-xs font-semibold text-[#065F46] transition-colors hover:bg-[#ECFDF5] cursor-pointer"
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#0F766E] text-[10px] font-bold text-white">
                {staffSession.initials}
              </span>
              <span>Ir al Sistema</span>
              <ArrowRight className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={onOpenStaffLogin}
              title="Iniciar sesión para acceder al sistema de gestión clínica y BI"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 text-xs font-semibold text-slate-700 shadow-2xs transition-colors hover:border-[#0F766E]/40 hover:bg-slate-50 hover:text-[#0F766E] cursor-pointer"
            >
              <Lock className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
              <span>Iniciar Sesión</span>
            </motion.button>
          )}
        </div>

        {/* Botón menú móvil */}
        <div className="flex items-center gap-2 sm:hidden">
          <button
            type="button"
            onClick={handleBook}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0F766E] px-3 text-xs font-semibold text-white active:scale-[0.98]"
          >
            <Calendar className="h-3.5 w-3.5" aria-hidden />
            <span>Agendar</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Abrir menú de navegación"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98]"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Menú desplegable Mobile animado */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-slate-200/80 bg-white px-4 py-3 shadow-lg sm:hidden"
          >
            <div className="flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <span>{link.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
              <a
                href="https://wa.me/51944612840?text=Hola%20NexoSalud%20Dental,%20requiero%20atenci%C3%B3n%20odontol%C3%B3gica%20prioritaria"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-medium text-slate-700"
              >
                <PhoneCall className="h-3.5 w-3.5 text-[#0F766E]" />
                <span>Urgencias / WhatsApp: (044) 612-840</span>
              </a>
              {staffSession ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onEnterSystem();
                  }}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#0F766E]/30 bg-[#ECFDF5] text-xs font-semibold text-[#065F46]"
                >
                  <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
                  <span>Ir al Sistema ({staffSession.nombres})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileOpen(false);
                    onOpenStaffLogin();
                  }}
                  className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700"
                >
                  <Lock className="h-3.5 w-3.5 text-[#0F766E]" />
                  <span>Iniciar Sesión (Sistema Clínico)</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
