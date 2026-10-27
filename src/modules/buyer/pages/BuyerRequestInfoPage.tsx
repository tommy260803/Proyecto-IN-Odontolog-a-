import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ShieldCheck,
  Stethoscope,
  MapPin,
  Clock,
  ArrowRight,
  PhoneCall,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Smile,
  HeartPulse,
  Award,
  ChevronDown,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Toaster } from '@/shared/components/ui/toaster';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { buyerService } from '../services/buyer.service';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { BuyerIntakeForm } from '../components/landing/BuyerIntakeForm';
import { StaffLoginModal } from '../components/landing/StaffLoginModal';
import { LocationsAndFooter } from '../components/landing/LocationsAndFooter';
import type { SedeCatalogItem, ServicioCatalogItem } from '../types/buyer.types';

const POPULAR_TREATMENTS = [
  {
    id: 'ortodoncia',
    title: 'Ortodoncia Invisible & Brackets',
    subtitle: 'Alinea tu sonrisa cómodamente',
    tag: 'Más solicitado',
    color: 'from-sky-500 to-blue-600',
    serviceKeyword: 'ortodoncia',
  },
  {
    id: 'estetica',
    title: 'Diseño de Sonrisa & Carillas',
    subtitle: 'Estética natural de alta precisión',
    tag: 'Estética',
    color: 'from-indigo-500 to-violet-600',
    serviceKeyword: 'diseño',
  },
  {
    id: 'implantes',
    title: 'Implantes Dentales Guiados',
    subtitle: 'Recupera piezas fijas sin dolor',
    tag: 'Especialidad',
    color: 'from-emerald-500 to-teal-600',
    serviceKeyword: 'implante',
  },
  {
    id: 'general',
    title: 'Alivio del Dolor & Limpieza',
    subtitle: 'Atención oportuna y profilaxis',
    tag: 'Cuidado Integral',
    color: 'from-amber-500 to-orange-600',
    serviceKeyword: 'evaluación',
  },
];

export default function BuyerRequestInfoPage() {
  const navigate = useNavigate();

  const [catalogs, setCatalogs] = useState<{
    servicios: ServicioCatalogItem[];
    sedes: SedeCatalogItem[];
    canales: any[];
    fuentes: any[];
  }>({
    servicios: [],
    sedes: [],
    canales: [],
    fuentes: [],
  });

  const [staffSession, setStaffSession] = useState<StaffSession | null>(null);
  const [staffModalOpen, setStaffModalOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(null);

  useEffect(() => {
    setStaffSession(staffAuthService.getSession());

    buyerService
      .getCatalogs()
      .then((data) => {
        setCatalogs({
          servicios: data.servicios || [],
          sedes: data.sedes || [],
          canales: data.canales || [],
          fuentes: data.fuentes || [],
        });
      })
      .catch((err) => {
        console.warn('Catálogos base:', err);
      });
  }, []);

  const handleScrollToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleFocusBooking = () => {
    const el = document.getElementById('formulario-captacion');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = el.querySelector('input') as HTMLInputElement | null;
      if (firstInput) firstInput.focus();
    }
  };

  const handlePickTreatment = (keyword: string) => {
    const matched = catalogs.servicios.find((s) =>
      s.nombre.toLowerCase().includes(keyword.toLowerCase())
    );
    if (matched) {
      setSelectedServiceId(matched.id_servicio);
    }
    handleFocusBooking();
  };

  return (
    <div id="inicio" className="min-h-screen bg-[#FAFCFE] text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Barra de Navegación Pública */}
      <LandingNavbar
        onScrollToSection={handleScrollToSection}
        onFocusBooking={handleFocusBooking}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
        onEnterSystem={() => navigate('/buyer')}
        staffSession={staffSession}
      />

      {/* ── HERO SECTION PRINCIPAL: CLARO, ELEGANTE Y LLAMATIVO ── */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-slate-200/70 bg-gradient-to-b from-white via-sky-50/20 to-[#FAFCFE]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Columna Izquierda: Mensaje Claro y Sin Sobrecarga */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Badge llamativo */}
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50/90 px-3.5 py-1 text-xs font-semibold text-sky-800 shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Odontología Especializada en Trujillo</span>
              </div>

              {/* Título de alto impacto */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                Tu sonrisa en manos expertas.
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700">
                  Cuidado moderno, claro y sin dolor.
                </span>
              </h1>

              {/* Párrafo sintético y tranquilizador */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                Te orientamos con honestidad sobre tratamientos, opciones de cuotas y disponibilidad en Trujillo. Sin términos complicados ni ventas de presión.
              </p>

              {/* 3 Beneficios Clave en Píldoras Visuales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shrink-0">
                    <Stethoscope className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Especialistas RNE</h4>
                    <p className="text-[11px] text-slate-500">Colegiados COP</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                    <Clock className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Respuesta Rápida</h4>
                    <p className="text-[11px] text-slate-500">&lt; 15 min por WhatsApp</p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">3 Sedes Trujillo</h4>
                    <p className="text-[11px] text-slate-500">California · El Golf · Centro</p>
                  </div>
                </div>
              </div>

              {/* Botón rápido para WhatsApp directo */}
              <div className="pt-2 flex items-center gap-3">
                <a
                  href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20quisiera%20recibir%20orientaci%C3%B3n%20sobre%20tratamientos."
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-xs sm:text-sm font-semibold text-white shadow-md shadow-[#25D366]/20 hover:bg-[#20BD5A] transition-all"
                >
                  <MessageSquare className="h-4 w-4 fill-white" />
                  <span>Escribir por WhatsApp directamente</span>
                </a>
                <span className="text-xs text-slate-400 font-medium hidden sm:inline">o completa el formulario</span>
              </div>
            </div>

            {/* Columna Derecha: Formulario Intuitivo y Atractivo */}
            <div id="formulario-captacion" className="lg:col-span-5 scroll-mt-24">
              <BuyerIntakeForm
                sedes={catalogs.sedes}
                servicios={catalogs.servicios}
                preselectedServiceId={selectedServiceId}
              />
            </div>

          </div>
        </div>
      </section>

      {/* ── SECCIÓN DE TRATAMIENTOS DESTACADOS (CLARA Y VISUAL) ── */}
      <section id="tratamientos" className="py-14 sm:py-20 border-b border-slate-200/70 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
              Tratamientos Principales
            </span>
            <h2 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              ¿Qué tratamiento estás buscando?
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Haz clic en cualquier opción para recibir asesoría directa y facilidades de financiamiento.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {POPULAR_TREATMENTS.map((tr) => (
              <div
                key={tr.id}
                onClick={() => handlePickTreatment(tr.serviceKeyword)}
                className="group relative cursor-pointer rounded-3xl border border-slate-200/90 bg-white p-6 shadow-xs hover:shadow-lg hover:border-sky-300 transition-all transform hover:-translate-y-1"
              >
                <span className="inline-block rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold text-slate-600 mb-3 group-hover:bg-sky-50 group-hover:text-sky-700 transition-colors">
                  {tr.tag}
                </span>
                <h3 className="text-base font-bold text-slate-900 group-hover:text-sky-700 transition-colors">
                  {tr.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {tr.subtitle}
                </p>

                <div className="mt-5 flex items-center gap-1 text-xs font-semibold text-sky-600 group-hover:text-sky-700">
                  <span>Consultar sobre este tratamiento</span>
                  <ArrowRight className="h-3.5 w-3.5 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CÓMO ES EL PROCESO (3 PASOS SENCILLOS, SIN RELLENO) ── */}
      <section id="tu-experiencia" className="py-14 sm:py-20 border-b border-slate-200/70 bg-[#F8FAFC]">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-12">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">
              Proceso Transparente
            </span>
            <h2 className="mt-2.5 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              Tu atención en 3 simples pasos
            </h2>
            <p className="mt-1.5 text-xs sm:text-sm text-slate-500">
              Sin trámites burocráticos ni esperas innecesarias en sala.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-xs relative">
              <span className="font-mono text-3xl font-black text-sky-600/30 block mb-2">01</span>
              <h3 className="text-sm font-bold text-slate-900">Cuéntanos tu inquietud</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Envía tu nombre y WhatsApp indicando qué necesitas. Cero cuestionarios médicos extensos en esta etapa.
              </p>
            </div>

            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-xs relative">
              <span className="font-mono text-3xl font-black text-indigo-600/30 block mb-2">02</span>
              <h3 className="text-sm font-bold text-slate-900">Orientación en &lt; 15 min</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Un asesor odontológico se comunica contigo para aclararte rangos de costo, facilidades de pago y especialistas.
              </p>
            </div>

            <div className="rounded-3xl bg-white border border-slate-200/90 p-6 shadow-xs relative">
              <span className="font-mono text-3xl font-black text-emerald-600/30 block mb-2">03</span>
              <h3 className="text-sm font-bold text-slate-900">Tú decides tu visita</h3>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Si decides evaluarte en sede, coordinamos el turno que mejor se adapte a tu horario y conveniencia.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PREGUNTAS FRECUENTES DIRECTAS ── */}
      <section className="py-14 sm:py-20 bg-white border-b border-slate-200/70">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-sky-700 bg-sky-50 px-3 py-1 rounded-full border border-sky-100">
              Claridad Total
            </span>
            <h2 className="mt-2.5 text-2xl font-extrabold tracking-tight text-slate-900">
              Preguntas Frecuentes
            </h2>
          </div>

          <div className="space-y-3.5">
            <div className="rounded-2xl border border-slate-200/90 p-5 bg-slate-50/40">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                ¿Tiene algún costo enviar mi consulta?
              </h4>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                No. Esta solicitud es 100% gratuita y sin compromiso. Te explicaremos opciones, costos y modalidades antes de que decidas acudir a una cita.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 p-5 bg-slate-50/40">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                ¿Ofrecen planes en cuotas para tratamientos?
              </h4>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Sí. Para tratamientos como ortodoncia o implantes dentales, contamos con financiamiento directo en cuotas mensuales sin intereses, además de pagos con tarjeta de crédito.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 p-5 bg-slate-50/40">
              <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                ¿Qué hacen con mis datos personales?
              </h4>
              <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                Bajo la Ley N° 29733, tus datos están protegidos y solo se usan para responder tu consulta. Nunca enviamos spam ni compartimos tu número con terceros.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SEDES VERIFICADAS EN TRUJILLO Y FOOTER ── */}
      <LocationsAndFooter
        catalogSedes={catalogs.sedes}
        onSelectBranchAndBook={() => handleFocusBooking()}
        onScrollToSection={handleScrollToSection}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
      />

      {/* Botón Flotante de WhatsApp para Contacto Inmediato */}
      <a
        href="https://wa.me/51944612840?text=Hola%20NexoSalud%2C%20quisiera%20hacer%20una%20consulta%20directa."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-xs font-bold text-white shadow-xl shadow-[#25D366]/30 hover:bg-[#20BD5A] transition-all transform hover:scale-105"
        title="Consultar por WhatsApp ahora"
      >
        <MessageSquare className="h-4 w-4 fill-white" />
        <span className="hidden sm:inline">¿Dudas? Escríbenos por WhatsApp</span>
      </a>

      {/* Modal de Acceso para Personal de la Clínica */}
      <StaffLoginModal
        open={staffModalOpen}
        onOpenChange={setStaffModalOpen}
        onSuccessLogin={(_session, dest) => {
          setStaffSession(staffAuthService.getSession());
          setStaffModalOpen(false);
          navigate(dest || '/buyer');
        }}
      />

      <Toaster />
    </div>
  );
}
