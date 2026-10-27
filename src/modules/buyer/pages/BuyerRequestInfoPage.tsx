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
  Calendar,
  Sparkles,
  HelpCircle,
  ChevronDown,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Toaster } from '@/shared/components/ui/toaster';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { buyerService } from '../services/buyer.service';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { BuyerIntakeForm } from '../components/landing/BuyerIntakeForm';
import { SocialProofSection } from '../components/landing/SocialProofSection';
import { SpecialtiesTechSection } from '../components/landing/SpecialtiesTechSection';
import { InteractiveJourneyFlowSection } from '../components/landing/InteractiveJourneyFlowSection';
import { LocationsAndFooter } from '../components/landing/LocationsAndFooter';
import { StaffLoginModal } from '../components/landing/StaffLoginModal';
import type { SedeCatalogItem, ServicioCatalogItem } from '../types/buyer.types';

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

  // Carga inicial de catálogos y sesión staff
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
        console.warn('Usando catálogos de respaldo:', err);
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

  const handleSelectTreatmentFromSpecialties = (reasonId: string, label?: string) => {
    // Si coincide con algún servicio del catálogo, lo seleccionamos
    if (catalogs.servicios.length > 0) {
      const match = catalogs.servicios.find((s) =>
        s.nombre.toLowerCase().includes(reasonId.toLowerCase()) ||
        (label && s.nombre.toLowerCase().includes(label.toLowerCase()))
      );
      if (match) {
        setSelectedServiceId(match.id_servicio);
      }
    }
    handleFocusBooking();
  };

  return (
    <div id="inicio" className="min-h-screen bg-slate-50/50 text-slate-900 font-sans selection:bg-sky-100 selection:text-sky-900">
      {/* Barra de Navegación Pública */}
      <LandingNavbar
        onScrollToSection={handleScrollToSection}
        onFocusBooking={handleFocusBooking}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
        onEnterSystem={() => navigate('/buyer')}
        staffSession={staffSession}
      />

      {/* ── HERO SECTION: CUIDADO HUMANO CONTEMPORÁNEO (PANTALLA DIVIDIDA ASIMÉTRICA) ── */}
      <section className="relative overflow-hidden pt-8 pb-16 lg:pt-14 lg:pb-24 border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            
            {/* Columna Izquierda (7 cols): Mensaje Editorial & Propuesta de Valor */}
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/80 px-3 py-1 text-xs font-medium text-sky-800">
                <span className="flex h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <span>Atención Odontológica Personalizada en Trujillo</span>
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.15]">
                Una odontología pensada en las personas, no solo en los dientes.
              </h1>

              <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-2xl">
                Te orientamos con total honestidad sobre tratamientos, costos y facilidades de pago. Sin ventas agresivas ni términos confusos: un odontólogo y un asesor resolverán tus dudas antes de que decidas acudir a consulta.
              </p>

              {/* Los 3 pasos del contacto inicial */}
              <div className="space-y-3 pt-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  ¿Qué ocurre cuando nos escribes?
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3">
                    <span className="font-mono text-xs font-bold text-sky-600 block mb-1">01</span>
                    <h4 className="text-xs font-semibold text-slate-900">Escuchamos tu caso</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Revisamos tu inquietud o molestia sin pedirte cuestionarios pesados.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3">
                    <span className="font-mono text-xs font-bold text-sky-600 block mb-1">02</span>
                    <h4 className="text-xs font-semibold text-slate-900">Orientación clara</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Te explicamos alternativas reales, rangos de costo y tiempos.
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-200/70 bg-slate-50/50 p-3">
                    <span className="font-mono text-xs font-bold text-sky-600 block mb-1">03</span>
                    <h4 className="text-xs font-semibold text-slate-900">Tú tienes el control</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                      Decides libremente si agendar una evaluación clínica en sede.
                    </p>
                  </div>
                </div>
              </div>

              {/* Insignias de confianza verificables */}
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-medium">
                  <Stethoscope className="h-4 w-4 text-emerald-600" />
                  <span>Especialistas Colegiados (COP / RNE)</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <Clock className="h-4 w-4 text-sky-600" />
                  <span>Respuesta estimada &lt; 15 min</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium">
                  <MapPin className="h-4 w-4 text-slate-600" />
                  <span>California · Primavera · Centro</span>
                </div>
              </div>
            </div>

            {/* Columna Derecha (5 cols): Formulario de Captación Limpio y Honesto */}
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

      {/* ── SECCIÓN 2: PILARES DE CONFIANZA CLÍNICA (REEMPLAZO DE MÉTRICAS FICTICIAS) ── */}
      <SocialProofSection />

      {/* ── SECCIÓN 3: CÓMO ES LA EXPERIENCIA CLÍNICA (JOURNEY) ── */}
      <section id="tu-experiencia" className="scroll-mt-16">
        <InteractiveJourneyFlowSection onSelectStageAction={() => handleFocusBooking()} />
      </section>

      {/* ── SECCIÓN 4: ESPECIALIDADES ODONTOLÓGICAS REALES ── */}
      <SpecialtiesTechSection onSelectTreatmentAndBook={handleSelectTreatmentFromSpecialties} />

      {/* ── SECCIÓN 5: PREGUNTAS FRECUENTES TRANSPARENTES ── */}
      <section className="py-16 bg-white border-t border-slate-200/80">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-sky-700 bg-sky-50 px-2.5 py-1 rounded-full border border-sky-100">
              Claridad Total
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
              Preguntas Frecuentes
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-slate-500">
              Respuestas directas a las dudas más comunes sobre el primer contacto.
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200/90 p-4.5 bg-slate-50/40">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Tiene algún costo o compromiso enviar este formulario?
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Ninguno. Este formulario es exclusivamente para orientación informativa y administrativa. Te explicaremos opciones y resolveremos tus dudas sin ninguna obligación de compra ni pago previo.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 p-4.5 bg-slate-50/40">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Qué hacen con mi número de WhatsApp y datos de contacto?
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Bajo la Ley N° 29733 de Protección de Datos Personales, tu información es estrictamente confidencial. Solo la usamos para responder a tu solicitud y coordinar tu atención. No compartimos datos con terceros ni enviamos spam.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 p-4.5 bg-slate-50/40">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Cómo son las facilidades de pago o cuotas?
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Para tratamientos como ortodoncia o implantes, contamos con planes de cuotas directas sin intereses durante el tiempo de tratamiento, además de aceptar tarjetas de crédito y transferencias bancarias.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 p-4.5 bg-slate-50/40">
              <h3 className="text-sm font-semibold text-slate-900">
                ¿Puedo elegir en qué sede atenderme?
              </h3>
              <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
                Sí. Contamos con 3 sedes en Trujillo: Sede California, Sede Primavera y Sede Centro Histórico. Puedes indicar tu preferencia en el formulario o coordinarlo directamente con tu asesor por WhatsApp.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN 6: SEDES VERIFICADAS EN TRUJILLO Y FOOTER ── */}
      <LocationsAndFooter
        catalogSedes={catalogs.sedes}
        onSelectBranchAndBook={() => handleFocusBooking()}
        onScrollToSection={handleScrollToSection}
        onOpenStaffLogin={() => setStaffModalOpen(true)}
      />

      {/* Modal de Acceso para Personal Clínico / Administrativo */}
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
