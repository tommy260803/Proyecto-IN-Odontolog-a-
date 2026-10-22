import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Eye,
  EyeOff,
  History,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  MapPin,
  Phone,
  RotateCw,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import type { PatientSession } from '@/shared/services/patientAuthService';
import {
  CLINIC_LOCATIONS,
  REASON_CHIPS,
  TIME_SLOT_CHIPS,
  normalizeBranchKey,
  type ReasonChipOption,
} from './landingData';

export interface HeroIntakeWidgetProps {
  catalogs: {
    servicios: any[];
    sedes: any[];
    canales: any[];
    fuentes: any[];
  };
  portalMode: 'new' | 'registered';
  setPortalMode: (mode: 'new' | 'registered') => void;

  // Estado formulario paciente nuevo
  selectedReasonChip: ReasonChipOption['id'] | '';
  onSelectReasonChip: (chipId: ReasonChipOption['id']) => void;
  serviceId: string;
  setServiceId: (val: string) => void;
  sede: string;
  setSede: (val: string) => void;
  timeSlot: string;
  setTimeSlot: (val: string) => void;
  fullName: string;
  setFullName: (val: string) => void;
  phone: string;
  setPhone: (val: string) => void;
  email: string;
  setEmail: (val: string) => void;
  dudaEspecifica: string;
  setDudaEspecifica: (val: string) => void;
  termsAccepted: boolean;
  setTermsAccepted: React.Dispatch<React.SetStateAction<boolean>>;
  errors: Record<string, string>;
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  loading: boolean;
  resolvingIdentity: boolean;
  submitError: string | null;
  onSubmitNewPatient: (e?: React.FormEvent) => void;

  // Estado de éxito paciente nuevo
  submittedSuccess: boolean;
  isRecurringSubmitted: boolean;
  isNewSharedSubmitted: boolean;
  consultationCount: number;
  onResetNewPatient: () => void;
  onBackToDashboard: () => void;

  // Estado paciente registrado
  patientSession: PatientSession | null;
  loginDni: string;
  setLoginDni: (val: string) => void;
  loginPassword: string;
  setLoginPassword: (val: string) => void;
  loginLoading: boolean;
  loginError: string | null;
  setLoginError: (val: string | null) => void;
  onLoginWithPassword: (e?: React.FormEvent) => void;
  otpSending: boolean;
  onSendOtp: () => void;
  onLogout: () => void;

  // Agendamiento express paciente autenticado
  expressServiceId: string;
  setExpressServiceId: (val: string) => void;
  expressSede: string;
  setExpressSede: (val: string) => void;
  expressTimeSlot: string;
  setExpressTimeSlot: (val: string) => void;
  expressDuda: string;
  setExpressDuda: (val: string) => void;
  expressSubmitting: boolean;
  expressSuccess: boolean;
  setExpressSuccess: (val: boolean) => void;
  onExpressSubmit: (e: React.FormEvent) => void;

  // Control externo de paso y feedback visual de preselección
  step: 1 | 2;
  setStep: (step: 1 | 2) => void;
  highlightTrigger?: number;
  preselectionNotice?: string | null;
}

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 28 : -28,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -28 : 28,
    opacity: 0,
  }),
};

export function HeroIntakeWidget({
  catalogs,
  portalMode,
  setPortalMode,
  selectedReasonChip,
  onSelectReasonChip,
  serviceId,
  setServiceId,
  sede,
  setSede,
  timeSlot,
  setTimeSlot,
  fullName,
  setFullName,
  phone,
  setPhone,
  email,
  setEmail,
  dudaEspecifica,
  setDudaEspecifica,
  termsAccepted,
  setTermsAccepted,
  errors,
  setErrors,
  loading,
  resolvingIdentity,
  submitError,
  onSubmitNewPatient,
  submittedSuccess,
  isRecurringSubmitted,
  isNewSharedSubmitted,
  consultationCount,
  onResetNewPatient,
  onBackToDashboard,
  patientSession,
  loginDni,
  setLoginDni,
  loginPassword,
  setLoginPassword,
  loginLoading,
  loginError,
  setLoginError,
  onLoginWithPassword,
  otpSending,
  onSendOtp,
  onLogout,
  expressServiceId,
  setExpressServiceId,
  expressSede,
  setExpressSede,
  expressTimeSlot,
  setExpressTimeSlot,
  expressDuda,
  setExpressDuda,
  expressSubmitting,
  expressSuccess,
  setExpressSuccess,
  onExpressSubmit,
  step,
  setStep,
  highlightTrigger = 0,
  preselectionNotice = null,
}: HeroIntakeWidgetProps) {
  const [direction, setDirection] = useState<number>(1);
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const availableSedes: Array<{ name: string; subtitle: string }> =
    catalogs.sedes && catalogs.sedes.length > 0
      ? catalogs.sedes.map((s: any) => ({
          name: s.nombre,
          subtitle: s.direccion || 'Trujillo',
        }))
      : CLINIC_LOCATIONS.map((loc) => ({
          name: loc.name,
          subtitle: loc.neighborhood.replace(' · Trujillo', ''),
        }));

  const selectedServiceName =
    catalogs.servicios.find((s: any) => String(s.id_servicio) === String(serviceId))?.nombre ||
    REASON_CHIPS.find((c) => c.id === selectedReasonChip)?.label ||
    'Evaluación integral';

  const selectedTimeSlotObj = TIME_SLOT_CHIPS.find((t) => t.id === timeSlot);

  const goToStep2 = () => {
    const step1Errors: Record<string, string> = {};
    if (!selectedReasonChip && !serviceId) {
      step1Errors.reason = 'Selecciona un motivo de consulta para asignarte al especialista indicado.';
    }
    if (!sede) {
      step1Errors.sede = 'Elige la sede más cercana para verificar disponibilidad.';
    }
    if (Object.keys(step1Errors).length > 0) {
      setErrors((prev) => ({ ...prev, ...step1Errors }));
      return;
    }
    setDirection(1);
    setStep(2);
  };

  const goToStep1 = () => {
    setDirection(-1);
    setStep(1);
  };

  if (submittedSuccess) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        className="w-full rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-[0_20px_50px_-20px_rgba(15,23,42,0.08)]"
      >
        <div className="flex flex-col items-center text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#ECFDF5] text-[#065F46] ring-1 ring-emerald-600/20">
            {isRecurringSubmitted ? (
              <RotateCw className="h-6 w-6 text-[#0F766E]" />
            ) : (
              <CheckCircle2 className="h-7 w-7 text-[#0F766E]" />
            )}
          </div>

          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-3 py-1 text-[11px] font-semibold text-[#065F46]">
            {isRecurringSubmitted
              ? `Consulta anexada a tu historial (#${consultationCount})`
              : isNewSharedSubmitted
                ? 'Nuevo expediente independiente creado'
                : 'Solicitud clínica registrada'}
          </span>

          <h2 className="mt-3 text-xl font-semibold tracking-tight text-slate-900">
            {isRecurringSubmitted
              ? 'Actualizamos tu expediente odontológico'
              : 'Recibimos tu solicitud de evaluación'}
          </h2>

          <p className="mt-1.5 max-w-md text-xs sm:text-sm leading-relaxed text-slate-600">
            Gracias, <strong className="font-semibold text-slate-900">{fullName}</strong>. Nuestra mesa de coordinación
            clínica te contactará por WhatsApp en menos de 15 minutos para confirmar tu horario exacto.
          </p>

          <dl className="mt-5 w-full rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-left text-xs space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-slate-500">WhatsApp de confirmación</dt>
              <dd className="font-mono font-semibold text-slate-900">+51 {phone}</dd>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
              <dt className="text-slate-500">Especialidad / Motivo</dt>
              <dd className="font-medium text-[#0F766E] text-right">{selectedServiceName}</dd>
            </div>
            {sede && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                <dt className="text-slate-500">Sede seleccionada</dt>
                <dd className="font-medium text-slate-800">{sede}</dd>
              </div>
            )}
            {selectedTimeSlotObj && (
              <div className="flex items-center justify-between gap-2 border-t border-slate-200/70 pt-2">
                <dt className="text-slate-500">Turno preferido</dt>
                <dd className="font-medium text-slate-800">
                  {selectedTimeSlotObj.label} ({selectedTimeSlotObj.hours})
                </dd>
              </div>
            )}
            {dudaEspecifica.trim() && (
              <div className="border-t border-slate-200/70 pt-2">
                <dt className="text-slate-500">Nota para el especialista</dt>
                <dd className="mt-0.5 italic text-slate-700">“{dudaEspecifica.trim()}”</dd>
              </div>
            )}
          </dl>

          <div className="mt-6 flex w-full flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={onResetNewPatient}
              className="flex-1 h-10 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-700 transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
            >
              Realizar otra consulta
            </button>
            <button
              type="button"
              onClick={onBackToDashboard}
              className="flex-1 h-10 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-[#115E59] active:scale-[0.98] cursor-pointer"
            >
              Ir al Panel Clínico
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      key={`widget-highlight-${highlightTrigger}`}
      initial={highlightTrigger > 0 ? { scale: 0.985 } : false}
      animate={{ scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`w-full overflow-hidden rounded-2xl border bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.08)] transition-all duration-300 ${
        preselectionNotice
          ? 'border-[#0F766E] ring-4 ring-teal-600/15'
          : 'border-slate-200/90'
      }`}
    >
      {/* Barra de progreso delgada de 2px */}
      <div className="h-[2px] w-full bg-slate-100 overflow-hidden" aria-hidden>
        <motion.div
          className="h-full bg-[#0F766E]"
          initial={false}
          animate={{
            width: portalMode === 'new' ? (step === 1 ? '50%' : '100%') : '100%',
          }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>

      {/* Banner animado de confirmación cuando el usuario hace clic en "Agendar aquí" o en una especialidad */}
      <AnimatePresence>
        {preselectionNotice && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-b border-emerald-700/15 bg-[#ECFDF5] px-5 py-2.5 text-xs font-medium text-[#065F46] flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" />
              <span className="truncate font-semibold">{preselectionNotice}</span>
            </div>
            <span className="shrink-0 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-[#0F766E]">
              Listo para agendar
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cabecera limpia del formulario con selector Primera Visita vs Ya soy Paciente */}
      <div className="border-b border-slate-100 px-5 pt-5 pb-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0F766E]" aria-hidden />
            {portalMode === 'new'
              ? `Paso ${step} de 2 · ${step === 1 ? 'Preferencias clínicas' : 'Datos de contacto'}`
              : patientSession
                ? 'Expediente verificado'
                : 'Acceso rápido de pacientes'}
          </span>

          {patientSession ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800 cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Cerrar sesión</span>
            </button>
          ) : (
            <div
              role="tablist"
              aria-label="Tipo de paciente"
              className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs"
            >
              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'new'}
                onClick={() => setPortalMode('new')}
                className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                  portalMode === 'new'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Primera visita
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={portalMode === 'registered'}
                onClick={() => setPortalMode('registered')}
                className={`rounded-md px-2.5 py-1 font-medium transition-all cursor-pointer ${
                  portalMode === 'registered'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ya soy paciente
              </button>
            </div>
          )}
        </div>

        <h2 className="mt-3 text-lg sm:text-xl font-semibold tracking-tight text-slate-900">
          {portalMode === 'new'
            ? step === 1
              ? 'Agenda tu evaluación odontológica'
              : '¿A dónde enviamos tu confirmación?'
            : patientSession
              ? `Hola, ${patientSession.nombres}`
              : 'Ingresa a tu expediente clínico'}
        </h2>
        <p className="mt-0.5 text-xs sm:text-[13px] text-slate-500">
          {portalMode === 'new'
            ? step === 1
              ? 'Elige tu motivo de consulta y sede para asignarte con el especialista indicado.'
              : 'Solo te pediremos tu nombre y WhatsApp para coordinar la hora exacta sin llamadas invasivas.'
            : patientSession
              ? 'Reserva tu control o consulta prioritaria en un clic.'
              : 'Accede con tu DNI y clave o recibe un código de 4 dígitos por WhatsApp.'}
        </p>
      </div>

      {/* Cuerpo del Widget */}
      <div className="px-5 py-5 sm:px-6">
        {portalMode === 'new' ? (
          <form onSubmit={onSubmitNewPatient} noValidate>
            <AnimatePresence mode="wait" custom={direction}>
              {step === 1 ? (
                <motion.div
                  key="step-1"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-5"
                >
                  {/* 1. Motivo de consulta (Chips seleccionables) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
                        <span>1. ¿Cuál es tu motivo de consulta?</span>
                      </label>
                      {catalogs.servicios.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowAllServices((v) => !v)}
                          className="text-[11px] font-medium text-[#0F766E] hover:underline cursor-pointer"
                        >
                          {showAllServices ? 'Ver opciones principales' : 'Ver catálogo completo'}
                        </button>
                      )}
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Motivo de consulta"
                      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
                    >
                      {REASON_CHIPS.map((chip) => {
                        const isSelected = selectedReasonChip === chip.id;
                        return (
                          <button
                            key={chip.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              onSelectReasonChip(chip.id);
                              if (errors.reason) setErrors((prev) => ({ ...prev, reason: '' }));
                            }}
                            className={`group flex items-start justify-between gap-2 rounded-xl border p-3 text-left transition-all active:scale-[0.98] cursor-pointer ${
                              isSelected
                                ? 'border-[#0F766E] bg-[#ECFDF5]/60 ring-2 ring-teal-600/15'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="min-w-0">
                              <p
                                className={`text-xs font-semibold ${
                                  isSelected ? 'text-[#065F46]' : 'text-slate-900'
                                }`}
                              >
                                {chip.label}
                              </p>
                              <p className="mt-0.5 truncate text-[11px] text-slate-500">
                                {chip.subtitle}
                              </p>
                            </div>
                            <span
                              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                                isSelected
                                  ? 'border-[#0F766E] bg-[#0F766E] text-white'
                                  : 'border-slate-300 bg-white group-hover:border-slate-400'
                              }`}
                              aria-hidden
                            >
                              {isSelected && <Check className="h-2.5 w-2.5 stroke-[3]" />}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Selector de catálogo completo opcional */}
                    {showAllServices && catalogs.servicios.length > 0 && (
                      <div className="mt-2.5">
                        <label htmlFor="catalog-service-select" className="sr-only">
                          Tratamiento específico del catálogo
                        </label>
                        <select
                          id="catalog-service-select"
                          value={serviceId}
                          onChange={(e) => {
                            setServiceId(e.target.value);
                            if (errors.reason) setErrors((prev) => ({ ...prev, reason: '' }));
                          }}
                          className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs font-medium text-slate-800 focus:border-[#0F766E] focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                        >
                          <option value="">Selecciona un tratamiento específico…</option>
                          {catalogs.servicios.map((s: any) => (
                            <option key={s.id_servicio} value={String(s.id_servicio)}>
                              {s.nombre}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {errors.reason && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.reason}</span>
                      </p>
                    )}
                  </div>

                  {/* 2. Selección de sede física */}
                  <div>
                    <label className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                      <MapPin className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
                      <span>2. Elige tu sede en Trujillo</span>
                    </label>

                    <div
                      role="radiogroup"
                      aria-label="Sede física"
                      className="grid grid-cols-1 gap-2 sm:grid-cols-3"
                    >
                      {availableSedes.map((branch) => {
                        const isSelected = normalizeBranchKey(sede) === normalizeBranchKey(branch.name);
                        return (
                          <button
                            key={branch.name}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => {
                              setSede(branch.name);
                              if (errors.sede) setErrors((prev) => ({ ...prev, sede: '' }));
                            }}
                            className={`flex flex-col justify-between rounded-xl border p-2.5 text-left transition-all active:scale-[0.98] cursor-pointer ${
                              isSelected
                                ? 'border-[#0F766E] bg-[#ECFDF5]/60 ring-2 ring-teal-600/15'
                                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className={`text-xs font-semibold truncate ${
                                  isSelected ? 'text-[#065F46]' : 'text-slate-900'
                                }`}
                              >
                                {branch.name.replace('Sede ', '')}
                              </span>
                              {isSelected && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[#0F766E]" aria-hidden />
                              )}
                            </div>
                            <span className="mt-0.5 truncate text-[10.5px] text-slate-500">
                              {branch.subtitle}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {errors.sede && (
                      <p className="mt-1.5 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.sede}</span>
                      </p>
                    )}
                  </div>

                  {/* 3. Turno preferido (Chips horizontales accesibles) */}
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        <Clock className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
                        <span>3. Preferencia de horario</span>
                      </label>
                      <span className="text-[11px] text-slate-400">Opcional</span>
                    </div>

                    <div
                      role="radiogroup"
                      aria-label="Turno preferido"
                      className="grid grid-cols-3 gap-2"
                    >
                      {TIME_SLOT_CHIPS.map((slot) => {
                        const isSelected = timeSlot === slot.id;
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            onClick={() => setTimeSlot(isSelected ? '' : slot.id)}
                            className={`flex flex-col items-center justify-center rounded-xl border py-2 px-2 text-center transition-all active:scale-[0.98] cursor-pointer ${
                              isSelected
                                ? 'border-[#0F766E] bg-[#ECFDF5]/70 text-[#065F46] ring-2 ring-teal-600/15'
                                : 'border-slate-200/90 bg-slate-50/50 text-slate-700 hover:border-slate-300 hover:bg-white'
                            }`}
                          >
                            <span className="text-xs font-semibold">{slot.label}</span>
                            <span className="mt-0.5 font-mono text-[10px] text-slate-500">
                              {slot.hours}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Acción Paso 1 -> Paso 2 */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={goToStep2}
                      className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 active:scale-[0.98] cursor-pointer"
                    >
                      <span>Continuar con mis datos</span>
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="step-2"
                  custom={direction}
                  variants={SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-4"
                >
                  {/* Resumen compacto del Paso 1 con botón volver */}
                  <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-800">
                        {selectedServiceName} · <span className="text-[#0F766E]">{sede || 'Sede por definir'}</span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500">
                        {selectedTimeSlotObj ? `Turno ${selectedTimeSlotObj.label} (${selectedTimeSlotObj.hours})` : 'Horario flexible'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={goToStep1}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 active:scale-[0.98] cursor-pointer"
                    >
                      <ArrowLeft className="h-3 w-3" aria-hidden />
                      <span>Cambiar</span>
                    </button>
                  </div>

                  {/* Input con Floating Label: Nombre y apellidos */}
                  <div>
                    <div className="relative">
                      <input
                        id="fullName"
                        type="text"
                        autoComplete="name"
                        placeholder=" "
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value);
                          if (errors.fullName) setErrors((prev) => ({ ...prev, fullName: '' }));
                        }}
                        aria-invalid={Boolean(errors.fullName)}
                        className={`peer block h-12 w-full rounded-xl border bg-white px-3.5 pt-4 pb-1 text-sm text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                          errors.fullName
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200/90 focus:border-[#0F766E] focus:ring-teal-600/20'
                        }`}
                      />
                      <label
                        htmlFor="fullName"
                        className="pointer-events-none absolute left-3.5 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
                      >
                        Nombres y apellidos completos *
                      </label>
                    </div>
                    {errors.fullName && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.fullName}</span>
                      </p>
                    )}
                  </div>

                  {/* Input con Floating Label: WhatsApp (+51) */}
                  <div>
                    <div className="relative flex items-center">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-600">
                        +51
                      </span>
                      <input
                        id="phone"
                        type="tel"
                        inputMode="numeric"
                        maxLength={9}
                        autoComplete="tel-national"
                        placeholder=" "
                        value={phone}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          setPhone(val);
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: '' }));
                        }}
                        aria-invalid={Boolean(errors.phone)}
                        className={`peer block h-12 w-full rounded-xl border bg-white pl-14 pr-3.5 pt-4 pb-1 font-mono text-sm text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                          errors.phone
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                            : 'border-slate-200/90 focus:border-[#0F766E] focus:ring-teal-600/20'
                        }`}
                      />
                      <label
                        htmlFor="phone"
                        className="pointer-events-none absolute left-14 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
                      >
                        Número de WhatsApp (9 dígitos) *
                      </label>
                    </div>
                    {errors.phone ? (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.phone}</span>
                      </p>
                    ) : (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Te enviaremos la disponibilidad de horarios directamente por WhatsApp.
                      </p>
                    )}
                  </div>

                  {/* Campos opcionales contraídos elegantemente */}
                  <div className="border-t border-slate-100 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowOptionalFields((v) => !v)}
                      aria-expanded={showOptionalFields}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-[#0F766E] cursor-pointer"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          showOptionalFields ? 'rotate-180 text-[#0F766E]' : ''
                        }`}
                        aria-hidden
                      />
                      <span>Añadir correo electrónico o consulta específica (opcional)</span>
                    </button>

                    {showOptionalFields && (
                      <div className="mt-3 space-y-3">
                        {/* Correo opcional */}
                        <div>
                          <div className="relative">
                            <input
                              id="email"
                              type="email"
                              autoComplete="email"
                              placeholder=" "
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (errors.email) setErrors((prev) => ({ ...prev, email: '' }));
                              }}
                              className={`peer block h-11 w-full rounded-xl border bg-white px-3.5 pt-3.5 pb-1 text-xs text-slate-900 transition-all focus:outline-none focus:ring-4 ${
                                errors.email
                                  ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
                                  : 'border-slate-200/90 focus:border-[#0F766E] focus:ring-teal-600/20'
                              }`}
                            />
                            <label
                              htmlFor="email"
                              className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
                            >
                              Correo electrónico (opcional)
                            </label>
                          </div>
                          {errors.email && (
                            <p className="mt-1 text-[11px] font-medium text-rose-600">{errors.email}</p>
                          )}
                        </div>

                        {/* Duda o consulta específica */}
                        <div className="relative">
                          <input
                            id="dudaEspecifica"
                            type="text"
                            maxLength={180}
                            placeholder=" "
                            value={dudaEspecifica}
                            onChange={(e) => setDudaEspecifica(e.target.value)}
                            className="peer block h-11 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pt-3.5 pb-1 text-xs text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
                          />
                          <label
                            htmlFor="dudaEspecifica"
                            className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
                          >
                            ¿Tienes alguna molestia o pregunta para el doctor?
                          </label>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Consentimiento ágil */}
                  <div>
                    <div
                      role="checkbox"
                      aria-checked={termsAccepted}
                      tabIndex={0}
                      onClick={() => {
                        setTermsAccepted((prev) => !prev);
                        if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          setTermsAccepted((prev) => !prev);
                          if (errors.terms) setErrors((prev) => ({ ...prev, terms: '' }));
                        }
                      }}
                      className={`flex items-start gap-2.5 rounded-xl border p-3 transition-all cursor-pointer select-none ${
                        termsAccepted
                          ? 'border-[#0F766E]/40 bg-[#ECFDF5]/40'
                          : errors.terms
                            ? 'border-rose-300 bg-rose-50/50'
                            : 'border-slate-200/90 bg-slate-50/50 hover:border-slate-300'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                          termsAccepted
                            ? 'border-[#0F766E] bg-[#0F766E] text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                        aria-hidden
                      >
                        {termsAccepted && <Check className="h-3 w-3 stroke-[3]" />}
                      </span>
                      <span className="text-[11.5px] leading-snug text-slate-600">
                        Autorizo a <strong className="font-semibold text-slate-800">NexoSalud Dental</strong> a
                        contactarme por WhatsApp o teléfono para coordinar mi cita conforme a la Ley N° 29733.
                      </span>
                    </div>
                    {errors.terms && (
                      <p className="mt-1 text-[11px] font-medium text-rose-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.terms}</span>
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Botón principal de envío con feedback de presión */}
                  <button
                    type="submit"
                    disabled={loading || resolvingIdentity}
                    className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
                  >
                    {resolvingIdentity ? (
                      <>
                        <ShieldCheck className="h-4 w-4 animate-pulse" />
                        <span>Verificando expediente clínico…</span>
                      </>
                    ) : loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Registrando tu solicitud…</span>
                      </>
                    ) : (
                      <>
                        <span>Confirmar solicitud de cita</span>
                        <ArrowRight className="h-4 w-4" aria-hidden />
                      </>
                    )}
                  </button>

                  <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden />
                    <span>Sin pago adelantado en web · Respuesta humana en &lt; 15 min</span>
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        ) : !patientSession ? (
          /* MODO PACIENTE REGISTRADO: Login DNI + Clave o Código WhatsApp OTP */
          <form onSubmit={onLoginWithPassword} className="space-y-4" noValidate>
            <div className="relative">
              <input
                id="loginDni"
                type="text"
                inputMode="numeric"
                maxLength={8}
                placeholder=" "
                value={loginDni}
                onChange={(e) => {
                  setLoginDni(e.target.value.replace(/\D/g, ''));
                  setLoginError(null);
                }}
                className="peer block h-12 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pt-4 pb-1 font-mono text-sm text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
              <label
                htmlFor="loginDni"
                className="pointer-events-none absolute left-3.5 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
              >
                Documento de identidad (DNI 8 dígitos) *
              </label>
            </div>

            <div className="relative">
              <input
                id="loginPassword"
                type={showLoginPassword ? 'text' : 'password'}
                placeholder=" "
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  setLoginError(null);
                }}
                className="peer block h-12 w-full rounded-xl border border-slate-200/90 bg-white px-3.5 pr-10 pt-4 pb-1 text-sm text-slate-900 transition-all focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
              <label
                htmlFor="loginPassword"
                className="pointer-events-none absolute left-3.5 top-2 text-[10.5px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-2 peer-focus:text-[10.5px] peer-focus:text-[#0F766E]"
              >
                Contraseña de tu portal
              </label>
              <button
                type="button"
                onClick={() => setShowLoginPassword((v) => !v)}
                aria-label="Mostrar u ocultar contraseña"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {loginError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{loginError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loginLoading}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-600/20 active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {loginLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verificando expediente…</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Ingresar con mi contraseña</span>
                </>
              )}
            </button>

            <div className="relative py-1 text-center">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-slate-200" />
              </div>
              <span className="relative bg-white px-3 text-[11px] font-medium text-slate-400">
                o accede sin contraseña
              </span>
            </div>

            <button
              type="button"
              onClick={onSendOtp}
              disabled={otpSending}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#0F766E]/30 bg-[#ECFDF5]/60 px-4 text-xs font-semibold text-[#065F46] transition-all hover:bg-[#ECFDF5] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {otpSending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-[#0F766E]" />
                  <span>Enviando código por WhatsApp…</span>
                </>
              ) : (
                <>
                  <Phone className="h-4 w-4 text-[#0F766E]" />
                  <span>Recibir código de 4 dígitos por WhatsApp</span>
                </>
              )}
            </button>
          </form>
        ) : expressSuccess ? (
          /* ÉXITO AGENDAMIENTO EXPRESS PACIENTE REGISTRADO */
          <div className="py-4 text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#ECFDF5] text-[#0F766E]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <span className="inline-flex rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#065F46]">
                Prioridad Paciente Activo
              </span>
              <h3 className="text-base font-semibold text-slate-900">
                Solicitud express vinculada a tu historia
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Asociamos este requerimiento a tu expediente <strong>(DNI {patientSession.dni})</strong>. Te
                confirmaremos la hora por WhatsApp en breves minutos.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setExpressSuccess(false)}
                className="flex-1 h-9 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-[0.98] cursor-pointer"
              >
                Nueva solicitud
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 h-9 rounded-xl bg-slate-900 text-xs font-semibold text-white hover:bg-slate-800 active:scale-[0.98] cursor-pointer"
              >
                Finalizar sesión
              </button>
            </div>
          </div>
        ) : (
          /* DASHBOARD COMPACTO PACIENTE AUTENTICADO */
          <form onSubmit={onExpressSubmit} className="space-y-4">
            <div className="rounded-xl border border-[#0F766E]/20 bg-[#ECFDF5]/40 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{patientSession.fullName}</p>
                  <p className="font-mono text-[11px] text-slate-500">DNI {patientSession.dni}</p>
                </div>
                <span className="rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[10px] font-semibold text-[#065F46] ring-1 ring-emerald-600/20">
                  Historia Activa
                </span>
              </div>

              {patientSession.proxima_cita ? (
                <div className="flex items-start gap-2 rounded-lg bg-white p-2.5 text-xs border border-slate-200/70">
                  <CalendarCheck className="h-4 w-4 shrink-0 text-[#0F766E] mt-0.5" />
                  <div>
                    <p className="font-semibold text-slate-800">
                      Próxima cita: {patientSession.proxima_cita.fecha} ({patientSession.proxima_cita.hora})
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {patientSession.proxima_cita.servicio} · {patientSession.proxima_cita.sede}
                    </p>
                  </div>
                </div>
              ) : patientSession.ultima_atencion ? (
                <div className="flex items-center gap-2 rounded-lg bg-white/90 p-2 text-[11px] text-slate-600 border border-slate-200/60">
                  <History className="h-3.5 w-3.5 text-[#0F766E]" />
                  <span>
                    Última atención: <strong>{patientSession.ultima_atencion.servicio}</strong>
                  </span>
                </div>
              ) : null}
            </div>

            <div>
              <label htmlFor="express-service" className="mb-1.5 block text-xs font-semibold text-slate-800">
                Tratamiento o control requerido
              </label>
              <select
                id="express-service"
                value={expressServiceId}
                onChange={(e) => setExpressServiceId(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium text-slate-800 focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-teal-600/20"
              >
                <option value="">Control general / Evaluación de seguimiento</option>
                {catalogs.servicios.map((s: any) => (
                  <option key={s.id_servicio} value={String(s.id_servicio)}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-800">Sede preferida</label>
              <div className="grid grid-cols-3 gap-2">
                {availableSedes.map((b) => {
                  const active = normalizeBranchKey(expressSede) === normalizeBranchKey(b.name);
                  return (
                    <button
                      key={b.name}
                      type="button"
                      onClick={() => setExpressSede(b.name)}
                      className={`rounded-xl border py-2 px-2 text-center text-xs font-medium transition-all active:scale-[0.98] cursor-pointer ${
                        active
                          ? 'border-[#0F766E] bg-[#ECFDF5]/70 text-[#065F46] font-semibold'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {b.name.replace('Sede ', '')}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-800">Turno preferido</label>
              <div className="grid grid-cols-3 gap-2">
                {TIME_SLOT_CHIPS.map((slot) => {
                  const active = expressTimeSlot === slot.id;
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      onClick={() => setExpressTimeSlot(slot.id)}
                      className={`rounded-xl border py-2 px-2 text-center transition-all active:scale-[0.98] cursor-pointer ${
                        active
                          ? 'border-[#0F766E] bg-[#ECFDF5]/70 text-[#065F46]'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="block text-xs font-semibold">{slot.label}</span>
                      <span className="block font-mono text-[10px] text-slate-500">{slot.hours}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="relative">
              <input
                id="expressDuda"
                type="text"
                placeholder=" "
                value={expressDuda}
                onChange={(e) => setExpressDuda(e.target.value)}
                className="peer block h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 pt-3.5 pb-1 text-xs text-slate-900 focus:border-[#0F766E] focus:outline-none focus:ring-4 focus:ring-teal-600/20"
              />
              <label
                htmlFor="expressDuda"
                className="pointer-events-none absolute left-3.5 top-1.5 text-[10px] font-medium text-slate-500 transition-all peer-placeholder-shown:top-3 peer-placeholder-shown:text-xs peer-placeholder-shown:text-slate-400 peer-focus:top-1.5 peer-focus:text-[10px] peer-focus:text-[#0F766E]"
              >
                Comentario o síntoma para tu doctor (opcional)
              </label>
            </div>

            <button
              type="submit"
              disabled={expressSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F766E] px-5 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:bg-[#115E59] active:scale-[0.98] disabled:opacity-60 cursor-pointer"
            >
              {expressSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Agendando solicitud…</span>
                </>
              ) : (
                <>
                  <span>Solicitar cita prioritaria</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}
      </div>
    </motion.div>
  );
}
