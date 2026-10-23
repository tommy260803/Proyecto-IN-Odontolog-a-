import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  AlertCircle,
  Check,
  Clock,
  Loader2,
  MapPin,
  Phone,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Toaster } from '@/shared/components/ui/toaster';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { useToast } from '@/shared/hooks/use-toast';
import { analyzeIdentityResolutionWithAI } from '@/shared/services/groqService';
import { patientAuthApi, type PatientSession } from '@/shared/services/patientAuthService';
import { staffAuthService, type StaffSession } from '@/shared/services/staffAuthService';
import { buyerService } from '../services/buyer.service';
import { HeroIntakeWidget } from '../components/landing/HeroIntakeWidget';
import { LandingNavbar } from '../components/landing/LandingNavbar';
import { LocationsAndFooter } from '../components/landing/LocationsAndFooter';
import { SocialProofSection } from '../components/landing/SocialProofSection';
import { SpecialtiesTechSection } from '../components/landing/SpecialtiesTechSection';
import { StaffLoginModal } from '../components/landing/StaffLoginModal';
import { InteractiveJourneyFlowSection } from '../components/landing/InteractiveJourneyFlowSection';
import {
  REASON_CHIPS,
  TIME_SLOT_CHIPS,
  normalizeBranchKey,
  type ReasonChipOption,
} from '../components/landing/landingData';

const HERO_CONTAINER_VARIANTS = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const HERO_ITEM_VARIANTS = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export default function BuyerRequestInfoPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [catalogs, setCatalogs] = useState<{
    servicios: any[];
    sedes: any[];
    canales: any[];
    fuentes: any[];
  }>({ servicios: [], sedes: [], canales: [], fuentes: [] });

  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [isRecurringSubmitted, setIsRecurringSubmitted] = useState(false);
  const [isNewSharedSubmitted, setIsNewSharedSubmitted] = useState(false);
  const [consultationCount, setConsultationCount] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sesión de Staff / Sistema Interno
  const [staffSession, setStaffSession] = useState<StaffSession | null>(() =>
    staffAuthService.getSession()
  );
  const [staffLoginOpen, setStaffLoginOpen] = useState(false);

  // Feedback animado cuando se hace clic en "Agendar aquí" o en un tratamiento
  const [highlightTrigger, setHighlightTrigger] = useState(0);
  const [preselectionNotice, setPreselectionNotice] = useState<string | null>(null);

  // Verificación inteligente de identidad con IA
  const [resolvingIdentity, setResolvingIdentity] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identityModalData, setIdentityModalData] = useState<{
    matchedType: 'phone' | 'email';
    registeredPerson?: any;
    aiReason?: string;
  } | null>(null);

  // Estado del evaluador interactivo progresivo (Paso 1 a 4)
  const [step, setStep] = useState<number>(1);
  const [selectedReasonChip, setSelectedReasonChip] = useState<ReasonChipOption['id'] | ''>('ortodoncia');
  const [serviceId, setServiceId] = useState('');
  const [sede, setSede] = useState('Sede California');
  const [timeSlot, setTimeSlot] = useState('1');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [dudaEspecifica, setDudaEspecifica] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modo del widget: 'new' (Primera visita) vs 'registered' (Ya soy paciente)
  const [portalMode, setPortalMode] = useState<'new' | 'registered'>('new');

  // Estados de inicio de sesión de pacientes registrados
  const [loginDni, setLoginDni] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [patientSession, setPatientSession] = useState<PatientSession | null>(null);

  // Estados para Acceso Express con Código OTP por WhatsApp
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('');
  const [otpDebugCode, setOtpDebugCode] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);

  // Estados para Solicitud de Cita Express (Paciente Autenticado)
  const [expressServiceId, setExpressServiceId] = useState('');
  const [expressSede, setExpressSede] = useState('Sede California');
  const [expressTimeSlot, setExpressTimeSlot] = useState('1');
  const [expressDuda, setExpressDuda] = useState('');
  const [expressSubmitting, setExpressSubmitting] = useState(false);
  const [expressSuccess, setExpressSuccess] = useState(false);

  // Enlaza un chip de motivo con el servicio correspondiente del catálogo real
  const matchCatalogServiceId = useCallback(
    (chipId: ReasonChipOption['id'], serviciosList: any[]): string => {
      const chip = REASON_CHIPS.find((c) => c.id === chipId);
      if (!chip || !serviciosList || serviciosList.length === 0) return '';
      const matched = serviciosList.find((s: any) => {
        const name = String(s.nombre || '').toLowerCase();
        return chip.keywords.some((kw) => name.includes(kw.toLowerCase()));
      });
      return matched ? String(matched.id_servicio) : String(serviciosList[0]?.id_servicio ?? '');
    },
    []
  );

  useEffect(() => {
    buyerService
      .getCatalogs()
      .then((data) => {
        setCatalogs(data);
        if (data.servicios?.length > 0) {
          const initialId = matchCatalogServiceId('ortodoncia', data.servicios);
          if (initialId) setServiceId(initialId);
        }
        if (data.sedes?.length > 0 && data.sedes[0]?.nombre) {
          const preferred =
            data.sedes.find((s: any) => normalizeBranchKey(s.nombre).includes('california'))?.nombre ||
            data.sedes[0].nombre;
          setSede(preferred);
          setExpressSede(preferred);
        }
      })
      .catch((err) => console.error('Error cargando catálogos:', err))
      .finally(() => setInitialLoading(false));
  }, [matchCatalogServiceId]);

  const handleSelectReasonChip = useCallback(
    (chipId: ReasonChipOption['id']) => {
      setSelectedReasonChip(chipId);
      const matchedId = matchCatalogServiceId(chipId, catalogs.servicios);
      if (matchedId) setServiceId(matchedId);
    },
    [catalogs.servicios, matchCatalogServiceId]
  );

  const scrollToSection = useCallback((sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (!el) return;
    const headerOffset = 84;
    const rect = el.getBoundingClientRect();
    const offsetTop = rect.top + window.scrollY - headerOffset;
    window.scrollTo({
      top: Math.max(0, offsetTop),
      behavior: 'smooth',
    });
  }, []);

  const triggerWidgetHighlight = useCallback((noticeText: string) => {
    setHighlightTrigger((c) => c + 1);
    setPreselectionNotice(noticeText);
  }, []);

  const focusBookingForm = useCallback(() => {
    setSubmittedSuccess(false);
    scrollToSection('agendar-cita');
    triggerWidgetHighlight('Completa tu motivo de consulta y sede para continuar');
  }, [scrollToSection, triggerWidgetHighlight]);

  const handleSelectTreatmentAndBook = useCallback(
    (reasonId: ReasonChipOption['id'], treatmentTitle?: string) => {
      if (!patientSession) {
        setPortalMode('new');
      }
      setSubmittedSuccess(false);
      handleSelectReasonChip(reasonId);
      const matchedId = matchCatalogServiceId(reasonId, catalogs.servicios);
      if (matchedId) setExpressServiceId(matchedId);
      setStep(1);
      setErrors((prev) => ({ ...prev, reason: '' }));
      scrollToSection('agendar-cita');
      const label =
        treatmentTitle ||
        REASON_CHIPS.find((c) => c.id === reasonId)?.label ||
        'Evaluación especializada';
      triggerWidgetHighlight(`Especialidad seleccionada: ${label}`);
      toast({
        title: 'Especialidad preseleccionada',
        description: `Se seleccionó "${label}" en tu solicitud de cita.`,
      });
    },
    [
      catalogs.servicios,
      handleSelectReasonChip,
      matchCatalogServiceId,
      patientSession,
      scrollToSection,
      toast,
      triggerWidgetHighlight,
    ]
  );

  const handleSelectBranchAndBook = useCallback(
    (branchName: string) => {
      // Resolver el nombre exacto de la sede en `catalogs.sedes` (normalizando tildes y mayúsculas)
      const targetKey = normalizeBranchKey(branchName);
      const matchedCatalogSede = catalogs.sedes?.find(
        (s: any) => normalizeBranchKey(s.nombre) === targetKey
      )?.nombre;

      const resolvedBranchName = matchedCatalogSede || branchName;

      if (!patientSession) {
        setPortalMode('new');
      }
      setSubmittedSuccess(false);
      setSede(resolvedBranchName);
      setExpressSede(resolvedBranchName);
      setErrors((prev) => ({ ...prev, sede: '' }));
      setStep(1);

      scrollToSection('agendar-cita');
      triggerWidgetHighlight(`Sede seleccionada: ${resolvedBranchName}`);
      toast({
        title: `${resolvedBranchName} seleccionada`,
        description: 'Completa tus preferencias clínicas arriba para confirmar tu cita.',
      });
    },
    [catalogs.sedes, patientSession, scrollToSection, toast, triggerWidgetHighlight]
  );

  const handleStaffSuccessLogin = (session: StaffSession, destinationPath: string) => {
    setStaffSession(session);
    setStaffLoginOpen(false);
    toast({
      title: `Bienvenido(a), ${session.nombres}`,
      description: `Accediendo a ${destinationPath.replace('/', '').toUpperCase() || 'BUYER'}…`,
    });
    navigate(destinationPath || '/buyer');
  };

  const handleLoginWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length !== 8) {
      setLoginError('Por favor ingresa un número de DNI válido de 8 dígitos.');
      return;
    }
    if (!loginPassword) {
      setLoginError('Por favor escribe tu contraseña personal.');
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    try {
      const session = await patientAuthApi.loginWithPassword(cleanDni, loginPassword);
      setPatientSession(session);
      setExpressSede(session.sede_preferida || sede || 'Sede California');
      toast({
        title: `Bienvenido(a), ${session.nombres}`,
        description: 'Expediente clínico verificado con éxito.',
      });
    } catch (err: any) {
      setLoginError(
        err.message || 'No se pudo iniciar sesión. Verifica tus datos o usa el código por WhatsApp.'
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length !== 8) {
      setLoginError('Ingresa primero tu DNI de 8 dígitos para enviarte el código por WhatsApp.');
      return;
    }

    setOtpSending(true);
    setOtpError(null);
    try {
      const res = await patientAuthApi.sendOtp(cleanDni);
      setOtpMaskedPhone(res.maskedPhone);
      setOtpDebugCode(res.debugOtp || '');
      setOtpCode('');
      setOtpModalOpen(true);
      toast({
        title: 'Código enviado por WhatsApp',
        description: `Enviamos un código de 4 dígitos al número ${res.maskedPhone}`,
      });
    } catch (err: any) {
      setLoginError(err.message || 'Verifica que el DNI pertenezca a un paciente registrado.');
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    const cleanOtp = otpCode.trim().replace(/\D/g, '');

    if (!cleanOtp || cleanOtp.length !== 4) {
      setOtpError('Ingresa el código completo de 4 dígitos.');
      return;
    }

    setOtpVerifying(true);
    setOtpError(null);
    try {
      const session = await patientAuthApi.verifyOtp(cleanDni, cleanOtp);
      setPatientSession(session);
      setExpressSede(session.sede_preferida || sede || 'Sede California');
      setOtpModalOpen(false);
      toast({
        title: `Bienvenido(a), ${session.nombres}`,
        description: 'Acceso express validado correctamente.',
      });
    } catch (err: any) {
      setOtpError(err.message || 'Código incorrecto o expirado.');
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleExpressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientSession) return;

    const slotLabel =
      TIME_SLOT_CHIPS.find((t) => t.id === expressTimeSlot)?.fullLabel ||
      'Turno Mañana (08:00 AM – 01:00 PM)';

    setExpressSubmitting(true);
    try {
      await patientAuthApi.createExpressAppointment({
        id_persona: patientSession.id_persona,
        id_servicio: expressServiceId ? Number(expressServiceId) : undefined,
        sede_preferida: expressSede || patientSession.sede_preferida || 'Sede California',
        horario_preferido: slotLabel,
        duda_especifica: expressDuda.trim() || undefined,
      });
      setExpressSuccess(true);
      toast({
        title: 'Solicitud prioritaria registrada',
        description: 'Recepción clínica te contactará por WhatsApp en breves minutos.',
      });
    } catch (err: any) {
      toast({
        title: 'No se pudo registrar la solicitud',
        description: err.message || 'Inténtalo nuevamente en unos segundos.',
        variant: 'destructive',
      });
    } finally {
      setExpressSubmitting(false);
    }
  };

  const handleLogout = () => {
    setPatientSession(null);
    setLoginPassword('');
    setExpressSuccess(false);
  };

  const validateStep2Form = () => {
    const newErrors: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = 'Ingresa tus nombres y apellidos completos.';
    }

    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'Ingresa tu número de WhatsApp.';
    } else if (cleanPhone.length !== 9) {
      newErrors.phone = 'El número de WhatsApp debe tener 9 dígitos.';
    }

    if (email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Ingresa un correo electrónico válido.';
      }
    }

    if (!termsAccepted) {
      newErrors.terms = 'Autoriza el contacto clínico para agendar tu evaluación.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const executeRegistration = async (isNewPersonConfirmed: boolean = false) => {
    setLoading(true);
    setSubmitError(null);
    try {
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Prospecto';
      const lastName = nameParts.slice(1).join(' ') || 'Web';

      const foundWebCanal = catalogs.canales.find(
        (c: any) =>
          c.nombre.toLowerCase().includes('web') ||
          c.nombre.toLowerCase().includes('portal') ||
          c.nombre.toLowerCase().includes('online')
      )?.id_canal;

      const foundWebFuente = catalogs.fuentes.find(
        (f: any) =>
          f.nombre.toLowerCase().includes('web') ||
          f.nombre.toLowerCase().includes('formulario') ||
          f.nombre.toLowerCase().includes('meta') ||
          f.nombre.toLowerCase().includes('orgánica')
      )?.id_fuente;

      const slotDescription =
        TIME_SLOT_CHIPS.find((t) => t.id === timeSlot)?.fullLabel || 'Horario flexible';

      const chipLabel = REASON_CHIPS.find((c) => c.id === selectedReasonChip)?.label;

      const res = await buyerService.registerAndConvert({
        nombres: firstName,
        apellidos: lastName,
        email: email.trim() || undefined,
        numero: phone.trim(),
        autoriza_contacto: true,
        id_canal: foundWebCanal,
        id_canal_origen: foundWebCanal,
        id_fuente: foundWebFuente,
        id_servicio: serviceId ? Number(serviceId) : undefined,
        id_servicio_interes: serviceId ? Number(serviceId) : undefined,
        sede_preferida: sede || undefined,
        tipo_persona: 'Adulto General',
        estado_calidad: 'Valido',
        duda_especifica: dudaEspecifica.trim() || undefined,
        concreteRequest: dudaEspecifica.trim()
          ? `[Consulta Web · ${chipLabel || 'Evaluación'}] ${dudaEspecifica.trim()} | Sede: ${sede || 'Por definir'} | ${slotDescription}`
          : `Solicitud de Evaluación Odontológica (${chipLabel || 'General'}). Sede: ${sede || 'Por definir'}. Horario: ${slotDescription}`,
        isNewPersonConfirmed,
      });

      const isRec = Boolean(res?.isRecurring || res?.isDuplicate);
      const isNewShared = Boolean(res?.isNewPersonWithSharedContact || isNewPersonConfirmed);
      const count = res?.consultationCount || (isRec ? 2 : 1);

      setConsultationCount(count);
      setIsRecurringSubmitted(isRec && !isNewShared);
      setIsNewSharedSubmitted(isNewShared);
      setSubmittedSuccess(true);
      setIdentityModalOpen(false);
    } catch (error: any) {
      const errMsg =
        error?.message || 'Hubo un inconveniente al registrar tu solicitud. Inténtalo nuevamente.';
      setSubmitError(errMsg);
    } finally {
      setLoading(false);
      setResolvingIdentity(false);
    }
  };

  const handleSubmitNewPatient = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateStep2Form()) return;

    const cleanDigits = phone.replace(/\D/g, '');
    const cleanMail = email.trim();

    setResolvingIdentity(true);
    setSubmitError(null);

    try {
      const dupRes = await buyerService.checkDuplicate({
        phone: cleanDigits.length >= 9 ? cleanDigits : undefined,
        email: cleanMail.includes('@') ? cleanMail : undefined,
      });

      if (dupRes?.isDuplicate && dupRes?.person) {
        const registeredName = `${dupRes.person.firstName || ''} ${dupRes.person.lastName || ''}`.trim();

        const aiAnalysis = await analyzeIdentityResolutionWithAI({
          enteredFullName: fullName.trim(),
          registeredFullName: registeredName,
        });

        if (aiAnalysis.isSamePerson && aiAnalysis.confidence >= 0.8) {
          await executeRegistration(false);
          return;
        }

        setIdentityModalData({
          matchedType: dupRes.matchedBy === 'email' ? 'email' : 'phone',
          registeredPerson: dupRes.person,
          aiReason: aiAnalysis.reason,
        });
        setResolvingIdentity(false);
        setIdentityModalOpen(true);
        return;
      }

      await executeRegistration(false);
    } catch (err) {
      console.error('Error durante la validación de identidad:', err);
      setSubmitError('No se pudo verificar el contacto. Revisa tus datos e inténtalo nuevamente.');
    } finally {
      setResolvingIdentity(false);
    }
  };

  const handleResetNewPatient = () => {
    setSubmittedSuccess(false);
    setIsRecurringSubmitted(false);
    setIsNewSharedSubmitted(false);
    setConsultationCount(1);
    setFullName('');
    setPhone('');
    setEmail('');
    setDudaEspecifica('');
    setTermsAccepted(false);
    setPreselectionNotice(null);
    setStep(1);
  };

  if (initialLoading) {
    return (
      <div className="flex min-h-[100dvh] w-full flex-col items-center justify-center bg-[#F8FAFC] p-4">
        <LoadingState />
      </div>
    );
  }

  return (
    <div
      id="inicio"
      className="min-h-[100dvh] w-full bg-[#F8FAFC] text-slate-900 selection:bg-[#ECFDF5] selection:text-[#065F46]"
    >
      {/* 1. Navbar Minimalista con Acceso a Inicio de Sesión del Sistema */}
      <LandingNavbar
        onScrollToSection={scrollToSection}
        onFocusBooking={focusBookingForm}
        onOpenStaffLogin={() => setStaffLoginOpen(true)}
        onEnterSystem={() => navigate('/buyer')}
        staffSession={staffSession}
      />

      {/* 2. Hero Section Luminosa y Empática con Formulario Progresivo en 2 Fases */}
      <section className="relative overflow-hidden bg-gradient-to-b from-white via-white to-[#F8FAFC] pt-8 pb-16 sm:pt-12 sm:pb-24">
        {/* Luz ambiental clínica muy sutil */}
        <div
          className="pointer-events-none absolute -top-24 right-1/4 h-96 w-96 rounded-full bg-[#ECFDF5]/80 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute top-1/2 -left-24 h-80 w-80 rounded-full bg-teal-50/70 blur-3xl"
          aria-hidden
        />

        <motion.div
          variants={HERO_CONTAINER_VARIANTS}
          initial="hidden"
          animate="visible"
          className="relative mx-auto grid max-w-7xl grid-cols-1 items-start gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12 lg:px-8"
        >
          {/* Columna Izquierda: Copywriting médico empático y con autoridad */}
          <div className="lg:col-span-7 lg:pt-2 space-y-6">
            <motion.div variants={HERO_ITEM_VARIANTS} className="space-y-4">
              <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-700/15 bg-[#ECFDF5] px-3.5 py-1 text-xs font-medium text-[#065F46]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E] animate-pulse" aria-hidden />
                <span>Odontología de Especialidades · Trujillo</span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-[44px] lg:leading-[1.12]">
                Odontología precisa, humana y pensada para tu tranquilidad.
              </h1>

              <p className="max-w-xl text-sm sm:text-base leading-relaxed text-slate-600 font-normal">
                Combinamos diagnóstico digital 3D, anestesia atraumática y especialistas colegiados para que
                entiendas cada paso de tu tratamiento desde la primera evaluación, con presupuestos claros y
                horarios que se respetan.
              </p>
            </motion.div>

            {/* Pilares clínicos de empatía y certidumbre */}
            <motion.div
              variants={HERO_ITEM_VARIANTS}
              className="grid grid-cols-1 gap-3 sm:grid-cols-2 max-w-xl"
            >
              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-colors hover:border-[#0F766E]/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E]">
                  <ScanLine className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xs font-semibold text-slate-900">
                    Diagnóstico visual en pantalla
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                    Escaneo intraoral 3D y cámara HD para que veas exactamente lo que ve tu especialista.
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-colors hover:border-[#0F766E]/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E]">
                  <Stethoscope className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xs font-semibold text-slate-900">
                    Protocolos sin dolor ni prisa
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                    Sesiones de 45 minutos dedicadas exclusivamente a ti, sin esperas en sala.
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-colors hover:border-[#0F766E]/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E]">
                  <MapPin className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xs font-semibold text-slate-900">
                    3 sedes interconectadas
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                    California, El Golf y Centro Histórico con historia clínica unificada.
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-colors hover:border-[#0F766E]/30"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0F766E]">
                  <Clock className="h-4 w-4" aria-hidden />
                </span>
                <div>
                  <h2 className="text-xs font-semibold text-slate-900">
                    Confirmación en &lt; 15 minutos
                  </h2>
                  <p className="mt-0.5 text-[11.5px] leading-snug text-slate-500">
                    Coordinación directa por WhatsApp con admisión clínica, sin call centers.
                  </p>
                </div>
              </motion.div>
            </motion.div>

            {/* Nota de respaldo médico */}
            <motion.div
              variants={HERO_ITEM_VARIANTS}
              className="flex flex-wrap items-center gap-4 pt-1 text-xs text-slate-500"
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#ECFDF5] text-[#065F46] font-mono text-[11px] font-semibold">
                  COP
                </span>
                <span>Staff 100% colegiado con RNE vigente</span>
              </div>
              <span className="hidden sm:inline text-slate-300">·</span>
              <span>Facilidades de pago sin intereses y convenios</span>
            </motion.div>
          </div>

          {/* Columna Derecha: Formulario Progresivo Integrado en el Hero */}
          <motion.div
            id="agendar-cita"
            variants={HERO_ITEM_VARIANTS}
            className="scroll-mt-24 lg:col-span-5 w-full"
          >
            <HeroIntakeWidget
              catalogs={catalogs}
              portalMode={portalMode}
              setPortalMode={setPortalMode}
              selectedReasonChip={selectedReasonChip}
              onSelectReasonChip={handleSelectReasonChip}
              serviceId={serviceId}
              setServiceId={setServiceId}
              sede={sede}
              setSede={setSede}
              timeSlot={timeSlot}
              setTimeSlot={setTimeSlot}
              fullName={fullName}
              setFullName={setFullName}
              phone={phone}
              setPhone={setPhone}
              email={email}
              setEmail={setEmail}
              dudaEspecifica={dudaEspecifica}
              setDudaEspecifica={setDudaEspecifica}
              termsAccepted={termsAccepted}
              setTermsAccepted={setTermsAccepted}
              errors={errors}
              setErrors={setErrors}
              loading={loading}
              resolvingIdentity={resolvingIdentity}
              submitError={submitError}
              onSubmitNewPatient={handleSubmitNewPatient}
              submittedSuccess={submittedSuccess}
              isRecurringSubmitted={isRecurringSubmitted}
              isNewSharedSubmitted={isNewSharedSubmitted}
              consultationCount={consultationCount}
              onResetNewPatient={handleResetNewPatient}
              onBackToDashboard={() => {
                if (staffSession) {
                  navigate('/buyer');
                } else {
                  setStaffLoginOpen(true);
                }
              }}
              patientSession={patientSession}
              loginDni={loginDni}
              setLoginDni={setLoginDni}
              loginPassword={loginPassword}
              setLoginPassword={setLoginPassword}
              loginLoading={loginLoading}
              loginError={loginError}
              setLoginError={setLoginError}
              onLoginWithPassword={handleLoginWithPassword}
              otpSending={otpSending}
              onSendOtp={handleSendOtp}
              onLogout={handleLogout}
              expressServiceId={expressServiceId}
              setExpressServiceId={setExpressServiceId}
              expressSede={expressSede}
              setExpressSede={setExpressSede}
              expressTimeSlot={expressTimeSlot}
              setExpressTimeSlot={setExpressTimeSlot}
              expressDuda={expressDuda}
              setExpressDuda={setExpressDuda}
              expressSubmitting={expressSubmitting}
              expressSuccess={expressSuccess}
              setExpressSuccess={setExpressSuccess}
              onExpressSubmit={handleExpressSubmit}
              step={step}
              setStep={setStep}
              highlightTrigger={highlightTrigger}
              preselectionNotice={preselectionNotice}
            />
          </motion.div>
        </motion.div>
      </section>

      {/* 2.5 Flujo Clínico Interactivo y Transparente: 4 Fases Orquestadas */}
      <InteractiveJourneyFlowSection onSelectStageAction={() => scrollToSection('agendar-cita')} />

      {/* 3. Sección de Autoridad, Prueba Social y Testimonios */}
      <SocialProofSection />

      {/* 4. Sección de Especialidades y Tecnología 3D */}
      <SpecialtiesTechSection onSelectTreatmentAndBook={handleSelectTreatmentAndBook} />

      {/* 5. Sección de Sedes Físicas y Footer Institucional */}
      <LocationsAndFooter
        catalogSedes={catalogs.sedes}
        selectedSede={portalMode === 'registered' && patientSession ? expressSede : sede}
        onSelectBranchAndBook={handleSelectBranchAndBook}
        onScrollToSection={scrollToSection}
        onOpenStaffLogin={() => setStaffLoginOpen(true)}
      />

      {/* Modal de Inicio de Sesión del Sistema (Staff / Doctores / BI) */}
      <StaffLoginModal
        open={staffLoginOpen}
        onOpenChange={setStaffLoginOpen}
        onSuccessLogin={handleStaffSuccessLogin}
        onSwitchToPatientPortal={() => {
          setPortalMode('registered');
          scrollToSection('agendar-cita');
          triggerWidgetHighlight('Ingresa con tu DNI o recibe un código por WhatsApp');
        }}
      />

      {/* Modal de Confirmación de Identidad y Contacto (Deduplicación inteligente con IA) */}
      <Dialog open={identityModalOpen} onOpenChange={setIdentityModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-slate-200 bg-white p-0 overflow-hidden text-slate-900 shadow-2xl">
          <div className="border-b border-slate-100 bg-[#F8FAFC] px-6 py-5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" />
              Protección de Historia Clínica
            </span>
            <DialogTitle className="mt-2 text-base font-semibold text-slate-900">
              Confirmación de titularidad del contacto
            </DialogTitle>
            <DialogDescription className="mt-1 text-xs text-slate-500 leading-relaxed">
              El {identityModalData?.matchedType === 'email' ? 'correo electrónico' : 'número de WhatsApp'} ingresado ya
              está asociado a un expediente en nuestra clínica.
            </DialogDescription>
          </div>

          <div className="p-6 space-y-4">
            <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-950 flex items-start gap-2.5">
              <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
              <p className="leading-relaxed">
                Para resguardar la confidencialidad médica y no mezclar historiales clínicos, indícanos cómo
                deseas continuar:
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => executeRegistration(false)}
                className="w-full rounded-xl border border-[#0F766E]/40 bg-[#ECFDF5]/40 p-3.5 text-left transition-all hover:border-[#0F766E] hover:bg-[#ECFDF5]/80 active:scale-[0.98] flex items-start gap-3 cursor-pointer"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0F766E] text-white">
                  <UserCheck className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Sí, soy yo (Anexar a mi historia)
                    </span>
                    <span className="rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-semibold text-[#065F46]">
                      Paciente registrado
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                    Ya me he atendido o consultado antes en NexoSalud Dental.
                  </p>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => executeRegistration(true)}
                className="w-full rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-all hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] flex items-start gap-3 cursor-pointer"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-white">
                  <UserPlus className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900">
                      Soy un familiar o paciente distinto
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                      Nuevo expediente
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                    Comparto este número o correo con un familiar y deseo abrir mi propia historia clínica.
                  </p>
                </div>
              </button>
            </div>

            <div className="border-t border-slate-100 pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIdentityModalOpen(false);
                  if (identityModalData?.matchedType === 'email') {
                    setEmail('');
                  } else {
                    setPhone('');
                  }
                }}
                className="w-full h-9 rounded-xl border-slate-200 text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Corregir el {identityModalData?.matchedType === 'email' ? 'correo' : 'número de WhatsApp'} ingresado
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Validación de Código OTP por WhatsApp */}
      <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#ECFDF5] text-[#0F766E]">
              <Phone className="h-5 w-5" />
            </div>
            <DialogTitle className="text-base font-semibold text-slate-900">
              Código de verificación por WhatsApp
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 leading-relaxed">
              Ingresa el código de 4 dígitos enviado al número <strong>{otpMaskedPhone}</strong> (DNI {loginDni}).
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="otpCodeInput" className="block text-center text-xs font-medium text-slate-700">
                Código de seguridad (4 dígitos)
              </Label>
              <div className="flex justify-center">
                <Input
                  id="otpCodeInput"
                  type="text"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="• • • •"
                  value={otpCode}
                  onChange={(e) => {
                    setOtpCode(e.target.value.replace(/\D/g, ''));
                    setOtpError(null);
                  }}
                  autoFocus
                  className="h-12 w-40 rounded-xl border-slate-300 bg-slate-50 text-center font-mono text-xl font-semibold tracking-[0.5em] text-slate-900 focus:border-[#0F766E] focus:ring-2 focus:ring-teal-600/20"
                />
              </div>
            </div>

            {otpDebugCode && (
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-600/20 bg-[#ECFDF5] p-2.5 text-center text-xs text-[#065F46]">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
                <span>
                  Código de simulación: <strong className="font-mono font-semibold">{otpDebugCode}</strong>
                </span>
              </div>
            )}

            {otpError && (
              <div className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-center text-xs text-rose-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{otpError}</span>
              </div>
            )}

            <div className="space-y-2 pt-1">
              <button
                type="submit"
                disabled={otpVerifying || otpCode.length !== 4}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] text-xs font-semibold text-white transition-all hover:bg-[#115E59] active:scale-[0.98] disabled:opacity-50 cursor-pointer"
              >
                {otpVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Verificando…</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    <span>Validar y acceder a mi expediente</span>
                  </>
                )}
              </button>

              <Button
                type="button"
                variant="ghost"
                onClick={handleSendOtp}
                disabled={otpSending}
                className="w-full text-xs text-slate-500 hover:text-slate-800"
              >
                ¿No recibiste el código? Reenviar a mi WhatsApp
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  );
}
