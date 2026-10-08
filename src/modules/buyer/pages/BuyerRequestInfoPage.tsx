import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../services/buyer.service';
import { patientAuthApi, type PatientSession } from '@/shared/services/patientAuthService';
import { analyzeIdentityResolutionWithAI } from '@/shared/services/groqService';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { 
  Sparkles, 
  Phone, 
  Mail, 
  MapPin, 
  Clock, 
  Stethoscope, 
  ArrowLeft, 
  CheckCircle2, 
  Send, 
  Loader2, 
  Sunrise, 
  Sun, 
  Moon, 
  ShieldCheck, 
  Building2, 
  User, 
  Star, 
  Zap, 
  Check, 
  AlertCircle, 
  AlertTriangle, 
  HelpCircle, 
  History, 
  RotateCw, 
  Bot, 
  UserCheck, 
  UserPlus, 
  ShieldAlert, 
  Lock, 
  KeyRound, 
  Eye, 
  EyeOff, 
  LogOut, 
  CalendarCheck, 
  ExternalLink
} from 'lucide-react';

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
  const [isDuplicateSubmitted, setIsDuplicateSubmitted] = useState(false);
  const [isRecurringSubmitted, setIsRecurringSubmitted] = useState(false);
  const [isNewSharedSubmitted, setIsNewSharedSubmitted] = useState(false);
  const [consultationCount, setConsultationCount] = useState<number>(1);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Estados para Verificación de Identidad con IA (Agente de Marketing)
  const [resolvingIdentity, setResolvingIdentity] = useState(false);
  const [identityModalOpen, setIdentityModalOpen] = useState(false);
  const [identityModalData, setIdentityModalData] = useState<{
    matchedType: 'phone' | 'email';
    registeredPerson?: any;
    aiReason?: string;
  } | null>(null);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [dudaEspecifica, setDudaEspecifica] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [sede, setSede] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Modo de Portal: 'new' (Paciente Nuevo) vs 'registered' (Ya soy Paciente con DNI/Clave)
  const [portalMode, setPortalMode] = useState<'new' | 'registered'>('new');

  // Estados de Inicio de Sesión de Pacientes Registrados
  const [loginDni, setLoginDni] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
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
  const [expressSede, setExpressSede] = useState('');
  const [expressTimeSlot, setExpressTimeSlot] = useState('1');
  const [expressDuda, setExpressDuda] = useState('');
  const [expressSubmitting, setExpressSubmitting] = useState(false);
  const [expressSuccess, setExpressSuccess] = useState(false);

  useEffect(() => {
    buyerService.getCatalogs()
      .then((data) => setCatalogs(data))
      .catch((err) => console.error('Error cargando catálogos:', err))
      .finally(() => setInitialLoading(false));
  }, []);

  const handleLoginWithPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length !== 8) {
      toast({
        title: 'DNI Inválido',
        description: 'Por favor ingresa un número de DNI válido de 8 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (!loginPassword) {
      toast({
        title: 'Ingresa tu contraseña',
        description: 'Por favor escribe tu contraseña personal.',
        variant: 'destructive',
      });
      return;
    }

    setLoginLoading(true);
    setLoginError(null);
    try {
      const session = await patientAuthApi.loginWithPassword(cleanDni, loginPassword);
      setPatientSession(session);
      setExpressSede(session.sede_preferida || 'Sede California');
      toast({
        title: `¡Bienvenido(a), ${session.nombres}!`,
        description: 'Expediente clínico verificado con éxito.',
      });
    } catch (err: any) {
      setLoginError(err.message || 'Error al iniciar sesión.');
      toast({
        title: 'Error de Autenticación',
        description: err.message || 'No se pudo iniciar sesión. Verifica tus datos o usa el código express por WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length !== 8) {
      toast({
        title: 'Ingresa tu DNI primero',
        description: 'Ingresa tu DNI de 8 dígitos para enviarte el código de seguridad a tu WhatsApp.',
        variant: 'destructive',
      });
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
        title: 'Código WhatsApp Enviado',
        description: `Enviamos tu código de 4 dígitos a tu número registrado: ${res.maskedPhone}`,
      });
    } catch (err: any) {
      toast({
        title: 'No se pudo enviar el código',
        description: err.message || 'Verifica que el DNI pertenezca a un paciente registrado.',
        variant: 'destructive',
      });
    } finally {
      setOtpSending(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDni = loginDni.trim().replace(/\D/g, '');
    const cleanOtp = otpCode.trim().replace(/\D/g, '');

    if (!cleanOtp || cleanOtp.length !== 4) {
      setOtpError('Ingresa el código de 4 dígitos completo.');
      return;
    }

    setOtpVerifying(true);
    setOtpError(null);
    try {
      const session = await patientAuthApi.verifyOtp(cleanDni, cleanOtp);
      setPatientSession(session);
      setExpressSede(session.sede_preferida || 'Sede California');
      setOtpModalOpen(false);
      toast({
        title: `¡Bienvenido(a), ${session.nombres}!`,
        description: 'Acceso express validado exitosamente.',
      });
    } catch (err: any) {
      setOtpError(err.message || 'Código incorrecto o expirado.');
      toast({
        title: 'Código Inválido',
        description: err.message || 'El código no es correcto. Inténtalo de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setOtpVerifying(false);
    }
  };

  const handleExpressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientSession) return;

    setExpressSubmitting(true);
    try {
      await patientAuthApi.createExpressAppointment({
        id_persona: patientSession.id_persona,
        id_servicio: expressServiceId ? Number(expressServiceId) : undefined,
        sede_preferida: expressSede || patientSession.sede_preferida || 'Sede California',
        horario_preferido: expressTimeSlot === '1' ? 'Turno Mañana (08:00 AM – 01:00 PM)' : expressTimeSlot === '2' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : 'Turno Noche (06:00 PM – 09:00 PM)',
        duda_especifica: expressDuda.trim() || undefined
      });
      setExpressSuccess(true);
      toast({
        title: '¡Solicitud Express Recibida!',
        description: 'Tu solicitud de cita ha sido ingresada con prioridad alta. Recepción te contactará en breve.',
      });
    } catch (err: any) {
      toast({
        title: 'Error al solicitar cita express',
        description: err.message || 'Hubo un problema al registrar la solicitud.',
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
    toast({
      title: 'Sesión Cerrada',
      description: 'Has salido de tu Portal del Paciente de forma segura.',
    });
  };

  if (initialLoading) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4">
        <LoadingState />
      </div>
    );
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // 1. Nombres y Apellidos
    if (!fullName.trim() || fullName.trim().length < 3) {
      newErrors.fullName = 'Por favor ingresa tus nombres y apellidos completos.';
    }

    // 2. Teléfono / WhatsApp (9 dígitos Perú)
    const cleanPhone = phone.trim().replace(/\D/g, '');
    if (!cleanPhone) {
      newErrors.phone = 'El número de WhatsApp es obligatorio.';
    } else if (cleanPhone.length !== 9) {
      newErrors.phone = 'El número debe tener exactamente 9 dígitos.';
    }

    // 3. Correo Electrónico (Opcional, pero si escribe validar formato)
    if (email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        newErrors.email = 'Ingresa un correo electrónico válido (ej: nombre@correo.com).';
      }
    }

    // 4. Términos y Condiciones
    if (!termsAccepted) {
      newErrors.terms = 'Debes aceptar los términos y el consentimiento de datos.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const executeRegistration = async (isNewPersonConfirmed: boolean = false) => {
    setLoading(true);
    setSubmitError(null);
    try {
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || 'Prospecto';
      const lastName = nameParts.slice(1).join(' ') || 'Web';

      const foundWebCanal = catalogs.canales.find((c: any) => 
        c.nombre.toLowerCase().includes('web') || 
        c.nombre.toLowerCase().includes('portal') || 
        c.nombre.toLowerCase().includes('online')
      )?.id_canal;

      const foundWebFuente = catalogs.fuentes.find((f: any) => 
        f.nombre.toLowerCase().includes('web') || 
        f.nombre.toLowerCase().includes('formulario') || 
        f.nombre.toLowerCase().includes('meta') || 
        f.nombre.toLowerCase().includes('orgánica')
      )?.id_fuente;

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
          ? `[Duda/Consulta Web] ${dudaEspecifica.trim()}${timeSlot ? ` | Horario: ${timeSlot === '1' ? 'Turno Mañana (08:00 AM – 01:00 PM)' : timeSlot === '2' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : 'Turno Noche (06:00 PM – 09:00 PM)'}` : ''}`
          : `Solicitud de Información Odontológica (Portal Web). Sede: ${sede || 'No especificada'}. Horario: ${timeSlot === '1' ? 'Turno Mañana (08:00 AM – 01:00 PM)' : timeSlot === '2' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : timeSlot === '3' ? 'Turno Noche (06:00 PM – 09:00 PM)' : 'Flexible'}`,
        isNewPersonConfirmed,
      });

      const isRec = Boolean(res?.isRecurring || res?.isDuplicate);
      const isNewShared = Boolean(res?.isNewPersonWithSharedContact || isNewPersonConfirmed);
      const count = res?.consultationCount || (isRec ? 2 : 1);

      setConsultationCount(count);
      setIsRecurringSubmitted(isRec && !isNewShared);
      setIsDuplicateSubmitted(isRec && !isNewShared);
      setIsNewSharedSubmitted(isNewShared);
      setSubmittedSuccess(true);
      setIdentityModalOpen(false);

      if (isRec && !isNewShared) {
        toast({
          title: `¡Consulta Odontológica Recibida! (#${count})`,
          description: `¡Hola de nuevo! Anexamos tu nueva consulta a tu expediente odontológico. Nos comunicaremos contigo en breve para coordinar tu atención.`,
        });
      } else if (isNewShared) {
        toast({
          title: '¡Expediente de Nuevo Paciente Creado!',
          description: 'Registramos tus datos como un nuevo paciente independiente. Nos comunicaremos contigo en breve.',
        });
      } else {
        toast({
          title: '¡Solicitud Recibida con Éxito!',
          description: 'Un asesor comercial odontológico se pondrá en contacto contigo en breve para coordinar tu cita.',
        });
      }
    } catch (error: any) {
      console.error(error);
      const errMsg = error?.message || 'Hubo un inconveniente al procesar tu solicitud. Inténtalo nuevamente.';
      setSubmitError(errMsg);
      toast({
        title: 'Error al enviar la solicitud',
        description: errMsg,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
      setResolvingIdentity(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!validateForm()) {
      toast({
        title: 'Verifica los campos',
        description: 'Por favor completa todos los campos requeridos correctamente.',
        variant: 'destructive',
      });
      return;
    }

    const cleanDigits = phone.replace(/\D/g, '');
    const cleanMail = email.trim();

    // Verificación inteligente al hacer clic en el botón
    setResolvingIdentity(true);
    setSubmitError(null);

    try {
      const dupRes = await buyerService.checkDuplicate({
        phone: cleanDigits.length >= 9 ? cleanDigits : undefined,
        email: cleanMail.includes('@') ? cleanMail : undefined,
      });

      if (dupRes?.isDuplicate && dupRes?.person) {
        const registeredName = `${dupRes.person.firstName || ''} ${dupRes.person.lastName || ''}`.trim();
        
        // Agente de Marketing: Análisis con IA para resolución de identidad
        const aiAnalysis = await analyzeIdentityResolutionWithAI({
          enteredFullName: fullName.trim(),
          registeredFullName: registeredName,
        });

        // Si la IA reconoce con alta certidumbre que es la misma persona (variación u ortografía)
        if (aiAnalysis.isSamePerson && aiAnalysis.confidence >= 0.8) {
          await executeRegistration(false);
          return;
        }

        // Si son personas diferentes (o duda): abrir Modal de Confirmación de Identidad
        setIdentityModalData({
          matchedType: dupRes.matchedBy === 'email' ? 'email' : 'phone',
          registeredPerson: dupRes.person,
          aiReason: aiAnalysis.reason,
        });
        setResolvingIdentity(false);
        setIdentityModalOpen(true);
        return;
      }

      // Si no hay duplicado, registrar directamente
      await executeRegistration(false);
    } catch (err: any) {
      console.error('Error durante la validación de identidad:', err);
      toast({
        title: 'Error de verificación',
        description: 'No se pudo verificar el contacto. Por favor revisa tus datos o inténtalo nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setResolvingIdentity(false);
    }
  };

  return (
    <div className="min-h-screen h-auto lg:h-screen lg:max-h-screen w-full overflow-y-auto lg:overflow-hidden relative flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Capa de Fondo Dividido en 2 Colores (Dual Two-Tone Split Screen con Fondo Dental) */}
      <div className="fixed inset-0 lg:absolute grid grid-cols-1 lg:grid-cols-2 pointer-events-none -z-10">
        {/* Mitad Izquierda: Foto de Odontología / NexoSalud con fondo oscuro y overlay equilibrado (Opción B) */}
        <div className="relative bg-slate-950 w-full h-full overflow-hidden">
          <img 
            src="/Fondo_NexoSalud.png" 
            alt="Fondo NexoSalud Dental" 
            className="absolute inset-0 w-full h-full object-cover object-center opacity-70 scale-100"
          />
          {/* Overlay suave para mantener excelente legibilidad en textos */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-950/65 via-slate-950/40 to-slate-950/75" />
        </div>
        {/* Mitad Derecha: Blanco Puro Plano */}
        <div className="hidden lg:block bg-slate-50/90 lg:bg-white w-full h-full border-l border-slate-200" />
      </div>

      {/* Línea Central con Desvanecimiento Suave (Fading Divider) */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-slate-300 via-50% to-transparent pointer-events-none z-10" />

      {/* Top Bar / Header */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-3 lg:py-2 px-4 sm:px-6 lg:px-8 shrink-0 z-20">
        <div className="flex items-center gap-2.5">
          <img 
            src="/Logo_NexoSalud.png" 
            alt="NexoSalud Dental" 
            className="h-9 w-9 object-contain rounded-xl shadow-md ring-1 ring-slate-800 bg-white p-1"
          />
          <div>
            <span className="text-sm sm:text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              NexoSalud <span className="text-teal-400 font-bold">Dental</span>
            </span>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">Clínica Odontológica Especializada · Portal Web</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate('/buyer')}
          className="rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 hover:text-slate-950 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer h-8 sm:h-9 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al Dashboard</span>
        </Button>
      </header>

      {/* Main Content Split Screen */}
      <main className="relative max-w-7xl mx-auto w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center min-h-0 py-4 lg:py-1 px-4 sm:px-6 lg:px-8 z-20">
        
        {/* Left Column: Información de NexoSalud Odontología */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-left duration-300">
          
          <div className="space-y-2 sm:space-y-2.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-[11px] font-semibold backdrop-blur">
              <Sparkles className="h-3 w-3 text-teal-300" />
              <span>Red Odontológica Integral de Alta Complejidad</span>
            </div>

            <h1 className="text-2xl sm:text-3xl xl:text-4xl font-black text-white tracking-tight leading-tight">
              Transformamos tu sonrisa con <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-200">tecnología de vanguardia</span>
            </h1>

            <p className="text-slate-300 text-xs sm:text-sm leading-relaxed max-w-lg font-normal">
              Accede a una atención odontológica moderna, indolora y personalizada. Especialistas certificados, diagnósticos digitales 3D y facilidades de pago.
            </p>
          </div>

          {/* Grid de Beneficios Clave */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-0.5">
            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Stethoscope className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-bold text-white">Especialistas Top</h2>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Ortodoncia, Implantes y Estética.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Zap className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-bold text-white">Diagnóstico 3D</h2>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Escaneo intraoral sin dolor.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Building2 className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-bold text-white">3 Sedes en Trujillo</h2>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                California, Primavera y Centro Histórico.
              </p>
            </div>

            <div className="p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1">
              <div className="w-7 h-7 rounded-lg bg-teal-500/10 flex items-center justify-center text-teal-400">
                <Clock className="h-3.5 w-3.5" />
              </div>
              <h2 className="text-xs font-bold text-white">Respuesta Rápida</h2>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                Atención en menos de 15 min.
              </p>
            </div>
          </div>

          {/* KPI Stats / Social Proof */}
          {/* KPI Stats / Social Proof */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-4 sm:gap-5 pt-1.5 border-t border-slate-800/60">
            <div>
              <p className="text-lg sm:text-xl font-black text-white font-mono">+12,000</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Pacientes Atendidos</p>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div>
              <p className="text-lg sm:text-xl font-black text-teal-400 font-mono">98.9%</p>
              <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold">Satisfacción</p>
            </div>
            <div className="h-6 w-px bg-slate-800 hidden sm:block" />
            <div className="flex items-center gap-1">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-amber-400" />
                ))}
              </div>
              <span className="text-[11px] font-bold text-white font-mono">4.9/5</span>
            </div>
          </div>

        </div>

        {/* Right Column: Formulario Plano con Fondo Blanco */}
        <div className="lg:col-span-6 xl:col-span-6 w-full flex justify-center lg:justify-end min-h-0 animate-in fade-in slide-in-from-right duration-300 pb-6 lg:pb-0">
          {!submittedSuccess ? (
            <div className="w-full max-w-lg bg-white rounded-3xl overflow-hidden flex flex-col h-auto lg:max-h-[78vh] shadow-xl lg:shadow-none border border-slate-200/80 relative">
              
              {/* Header Fijo con Pestañas de Modo (Paciente Nuevo vs Registrado) */}
              <div className="px-5 pt-4 pb-3 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 text-white shrink-0 relative overflow-hidden space-y-3">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[9px] px-2 py-0.5 rounded-full font-semibold backdrop-blur">
                      <Sparkles className="h-2.5 w-2.5 mr-1 text-teal-200" /> Portal Odontológico 2026
                    </Badge>
                    <span className="text-[10px] text-teal-100 font-medium flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-teal-300" /> Atención Segura
                    </span>
                  </div>

                  {patientSession && (
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="text-[10.5px] font-semibold text-teal-100 hover:text-white flex items-center gap-1 bg-white/10 hover:bg-white/20 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                    >
                      <LogOut className="h-3 w-3" /> Salir
                    </button>
                  )}
                </div>

                <div>
                  <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                    {portalMode === 'new' 
                      ? 'Solicita tu Evaluación Odontológica' 
                      : patientSession 
                        ? `Bienvenido(a), ${patientSession.nombres}` 
                        : 'Portal de Pacientes Registrados'}
                  </h2>
                  <p className="text-teal-100 text-[11px] mt-0.5 leading-tight font-normal">
                    {portalMode === 'new'
                      ? 'Completa tus datos y un especialista coordinará tu cita preferencial.'
                      : patientSession
                        ? 'Gestiona tus controles periódicos o solicita una nueva atención express.'
                        : 'Ingresa con tu DNI y contraseña o solicita tu código express a WhatsApp.'}
                  </p>
                </div>

                {/* Switcher de Pestañas: Paciente Nuevo vs Registrado (Oculto si ya inició sesión) */}
                {!patientSession && (
                  <div className="p-1 bg-black/20 rounded-2xl flex items-center gap-1 border border-white/10 backdrop-blur">
                    <button
                      type="button"
                      onClick={() => setPortalMode('new')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        portalMode === 'new'
                          ? 'bg-white text-teal-900 shadow-sm'
                          : 'text-teal-100 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      <span>Soy Paciente Nuevo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalMode('registered')}
                      className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        portalMode === 'registered'
                          ? 'bg-white text-teal-900 shadow-sm'
                          : 'text-teal-100 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                      <span>Ya soy Paciente</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Contenido Dinámico según Modo Seleccionado */}
              {portalMode === 'new' ? (
                /* MODO 1: PACIENTE NUEVO (Formulario Regular) */
                <>
                  <div className="flex-1 lg:overflow-y-auto px-5 py-4 space-y-3 bg-white lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]">
                    <form id="buyerWebForm" onSubmit={handleSubmit} className="space-y-3">
                      
                      {/* 1. Nombres y Apellidos */}
                      <div className="space-y-1">
                        <Label htmlFor="fullName" className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-teal-600" />
                            Nombres y Apellidos <span className="text-rose-500 font-bold">*</span>
                          </span>
                        </Label>
                        <Input
                          id="fullName"
                          placeholder="Ej: Lucía Mendoza Rojas"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (errors.fullName) setErrors(prev => ({ ...prev, fullName: '' }));
                          }}
                          className={`rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm ${errors.fullName ? 'ring-1 ring-rose-500' : ''}`}
                        />
                        {errors.fullName && <p className="text-[10px] text-rose-500 font-medium">{errors.fullName}</p>}
                      </div>

                      {/* 2 & 3: Teléfono y Correo */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Teléfono WhatsApp */}
                        <div className="space-y-1">
                          <Label htmlFor="phone" className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                            <Phone className="h-3 w-3 text-teal-600" />
                            Teléfono / WhatsApp <span className="text-rose-500 font-bold">*</span>
                          </Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                              +51
                            </span>
                            <Input
                              id="phone"
                              type="tel"
                              maxLength={9}
                              placeholder="987654321"
                              value={phone}
                              onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '');
                                setPhone(val);
                                if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                              }}
                              className={`pl-11 rounded-xl h-9 text-xs font-mono bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm ${errors.phone ? 'ring-1 ring-rose-500' : ''}`}
                            />
                          </div>
                          {errors.phone ? (
                            <p className="text-[10px] text-rose-500 font-medium">{errors.phone}</p>
                          ) : (
                            <p className="text-[9.5px] text-slate-500">9 dígitos para Perú</p>
                          )}
                        </div>

                        {/* Correo Electrónico */}
                        <div className="space-y-1">
                          <Label htmlFor="email" className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-slate-500" /> Correo Electrónico
                            </span>
                            <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                          </Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="nombre@correo.com"
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                            }}
                            className={`rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm ${errors.email ? 'ring-1 ring-rose-500' : ''}`}
                          />
                          {errors.email && <p className="text-[10px] text-rose-500 font-medium">{errors.email}</p>}
                        </div>
                      </div>

                      {/* 4 & 5: Servicio de Interés y Sede */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Servicio de Interés */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Stethoscope className="h-3 w-3 text-teal-600" />
                              Servicio de Interés
                            </span>
                            <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                          </Label>
                          <Select 
                            value={serviceId} 
                            onValueChange={(val) => {
                              setServiceId(val);
                              if (errors.serviceId) setErrors(prev => ({ ...prev, serviceId: '' }));
                            }}
                          >
                            <SelectTrigger className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-teal-500 shadow-sm">
                              <SelectValue placeholder="Selecciona tratamiento" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl">
                              {catalogs.servicios.map((s: any) => (
                                <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs">
                                  {s.nombre}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Sede de Interés */}
                        <div className="space-y-1">
                          <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-teal-600" />
                              Sede de Interés
                            </span>
                            <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                          </Label>
                          <Select 
                            value={sede} 
                            onValueChange={(val) => {
                              setSede(val);
                              if (errors.sede) setErrors(prev => ({ ...prev, sede: '' }));
                            }}
                          >
                            <SelectTrigger className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-teal-500 shadow-sm">
                              <SelectValue placeholder="Selecciona sede" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl">
                              {catalogs.sedes && catalogs.sedes.length > 0 ? (
                                catalogs.sedes.map((s: any) => (
                                  <SelectItem key={s.id_sede || s.nombre} value={s.nombre} className="text-xs">
                                    {s.nombre} {s.direccion ? `- ${s.direccion}` : ''}
                                  </SelectItem>
                                ))
                              ) : (
                                <>
                                  <SelectItem value="Sede California" className="text-xs">Sede California - Av. Larco 820, Urb. California, Trujillo</SelectItem>
                                  <SelectItem value="Sede Primavera" className="text-xs">Sede Primavera - Av. Teodoro Valcárcel 345, Urb. Primavera, Trujillo</SelectItem>
                                  <SelectItem value="Sede Centro Histórico" className="text-xs">Sede Centro Histórico - Jr. Pizarro 456, Centro Histórico, Trujillo</SelectItem>
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      {/* Duda o Consulta Específica (Historial de Preguntas) */}
                      <div className="space-y-1">
                        <Label htmlFor="dudaEspecifica" className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <HelpCircle className="h-3 w-3 text-teal-600" />
                            ¿Tienes alguna duda o consulta específica?
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                        </Label>
                        <Input
                          id="dudaEspecifica"
                          placeholder="Ej: ¿Tienen pago en cuotas?, ¿atienden emergencias?, ¿costo aproximado?"
                          value={dudaEspecifica}
                          onChange={(e) => setDudaEspecifica(e.target.value)}
                          maxLength={180}
                          className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm"
                        />
                        <p className="text-[9.5px] text-slate-500">
                          Tus dudas se registran en tu historial para que tu asesor responda cada una al contactarte.
                        </p>
                      </div>

                      {/* 6: Franja Horaria Preferida */}
                      <div className="space-y-1.5 pt-0.5">
                        <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" /> Franja Horaria Preferida
                          </span>
                          <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                        </Label>
                        
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { 
                              id: '1', 
                              label: 'Mañana', 
                              hours: '08:00 AM – 01:00 PM', 
                              icon: Sunrise,
                              iconColor: 'text-amber-500'
                            },
                            { 
                              id: '2', 
                              label: 'Tarde', 
                              hours: '01:00 PM – 06:00 PM', 
                              icon: Sun,
                              iconColor: 'text-orange-500'
                            },
                            { 
                              id: '3', 
                              label: 'Noche', 
                              hours: '06:00 PM – 09:00 PM', 
                              icon: Moon,
                              iconColor: 'text-indigo-500'
                            },
                          ].map((slot) => {
                            const isSelected = timeSlot === slot.id;
                            const IconComponent = slot.icon;

                            return (
                              <button
                                key={slot.id}
                                type="button"
                                onClick={() => setTimeSlot(isSelected ? '' : slot.id)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-teal-50 text-teal-900 border-2 border-teal-600 shadow-sm'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                                }`}
                              >
                                <div className={`p-1 rounded-lg mb-0.5 ${isSelected ? 'bg-teal-100/80' : 'bg-white shadow-xs'}`}>
                                  <IconComponent className={`h-3.5 w-3.5 ${slot.iconColor}`} />
                                </div>
                                <span className="text-[11px] font-bold leading-tight">{slot.label}</span>
                                <span className="text-[9px] text-slate-500 mt-0.5 font-mono">{slot.hours}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 7: Checkbox de Términos y Consentimiento */}
                      <div className="pt-0.5">
                        <div 
                          role="checkbox"
                          aria-checked={termsAccepted}
                          tabIndex={0}
                          onClick={() => {
                            setTermsAccepted(prev => !prev);
                            if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
                          }}
                          onKeyDown={(e) => {
                            if (e.key === ' ' || e.key === 'Enter') {
                              e.preventDefault();
                              setTermsAccepted(prev => !prev);
                              if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
                            }
                          }}
                          className={`flex items-start space-x-3 rounded-xl p-2.5 transition-all border cursor-pointer select-none ${
                            termsAccepted 
                              ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/20 shadow-xs' 
                              : errors.terms 
                                ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-400/20' 
                                : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            <div
                              className={`h-5 w-5 rounded-md border-2 transition-all flex items-center justify-center shadow-xs ${
                                termsAccepted
                                  ? 'bg-teal-600 border-teal-600 text-white'
                                  : 'border-slate-300 bg-white hover:border-teal-500'
                              }`}
                            >
                              {termsAccepted && (
                                <Check className="h-3.5 w-3.5 text-white stroke-[3.5]" stroke="#ffffff" />
                              )}
                            </div>
                          </div>
                          <div className="space-y-0.5 leading-none">
                            <div className="text-[11px] font-bold text-slate-800 cursor-pointer">
                              Autorizo contacto por WhatsApp / Teléfono <span className="text-rose-500">*</span>
                            </div>
                            <p className="text-[10px] text-slate-600 leading-tight">
                              Acepto los Términos y Política de Privacidad (Ley N° 29733) para agendamiento clínico.
                            </p>
                          </div>
                        </div>
                        {errors.terms && <p className="text-[10px] text-rose-500 font-medium mt-0.5 pl-1">{errors.terms}</p>}
                      </div>

                      {/* Banner de Error al Enviar */}
                      {submitError && (
                        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-1">
                          <div className="p-1 rounded-lg bg-rose-100 text-rose-600 shrink-0 mt-0.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </div>
                          <div className="space-y-0.5">
                            <p className="font-bold text-[11.5px] text-rose-900">
                              No se pudo registrar la solicitud
                            </p>
                            <p className="text-[10.5px] text-rose-700 leading-relaxed">
                              {submitError}
                            </p>
                          </div>
                        </div>
                      )}
                    </form>
                  </div>

                  {/* Footer Fijo (Estático) con Botón de Enviar */}
                  <div className="px-5 py-3.5 bg-slate-50/95 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
                      {submitError ? (
                        <span className="text-rose-600 font-semibold flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          Revisa el error indicado arriba
                        </span>
                      ) : (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Datos 100% seguros</span>
                        </>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={() => handleSubmit()}
                      disabled={loading || resolvingIdentity}
                      className="w-full sm:w-auto sm:min-w-[240px] h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-teal-700/20 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                    >
                      {resolvingIdentity ? (
                        <>
                          <ShieldCheck className="h-3.5 w-3.5 animate-pulse text-teal-200" />
                          <span>Verificando seguridad...</span>
                        </>
                      ) : loading ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Enviando solicitud...</span>
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5" />
                          <span>Solicitar Información y Agendar</span>
                        </>
                      )}
                    </Button>
                  </div>
                </>
              ) : !patientSession ? (
                /* MODO 2: LOGIN PACIENTE REGISTRADO (DNI + Contraseña / OTP) */
                <div className="flex-1 lg:overflow-y-auto px-5 py-5 space-y-4 bg-white">
                  <form onSubmit={handleLoginWithPassword} className="space-y-4">
                    
                    {/* Input DNI */}
                    <div className="space-y-1.5">
                      <Label htmlFor="loginDni" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-teal-600" />
                        DNI del Paciente <span className="text-rose-500">*</span>
                      </Label>
                      <Input
                        id="loginDni"
                        type="text"
                        maxLength={8}
                        placeholder="Ingresa tu DNI (8 dígitos)"
                        value={loginDni}
                        onChange={(e) => {
                          setLoginDni(e.target.value.replace(/\D/g, ''));
                          setLoginError(null);
                        }}
                        required
                        className="rounded-xl h-10 text-xs font-mono bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm"
                      />
                    </div>

                    {/* Input Contraseña */}
                    <div className="space-y-1.5">
                      <Label htmlFor="loginPassword" className="text-xs font-bold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Lock className="h-3.5 w-3.5 text-teal-600" />
                          Contraseña Personal <span className="text-rose-500">*</span>
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">Definida en tu activación</span>
                      </Label>
                      <div className="relative">
                        <Input
                          id="loginPassword"
                          type={showLoginPassword ? 'text' : 'password'}
                          placeholder="••••••••••••"
                          value={loginPassword}
                          onChange={(e) => {
                            setLoginPassword(e.target.value);
                            setLoginError(null);
                          }}
                          required
                          className="rounded-xl h-10 text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 pr-10 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword(!showLoginPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {loginError && (
                      <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2 animate-in fade-in">
                        <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] leading-relaxed">{loginError}</p>
                      </div>
                    )}

                    {/* Botón Principal de Iniciar Sesión con Contraseña */}
                    <Button
                      type="submit"
                      disabled={loginLoading}
                      className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-2 shadow-md shadow-teal-700/20 cursor-pointer transition-all"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Verificando credenciales...</span>
                        </>
                      ) : (
                        <>
                          <Lock className="h-4 w-4" />
                          <span>Iniciar Sesión con Contraseña</span>
                        </>
                      )}
                    </Button>

                    {/* Separador de Acceso Express */}
                    <div className="relative py-2 text-center">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-200" />
                      </div>
                      <span className="relative bg-white px-3 text-[10.5px] font-semibold text-slate-400 uppercase tracking-wider">
                        ¿Olvidaste tu clave o es tu primer acceso?
                      </span>
                    </div>

                    {/* Botón de Código Express por WhatsApp */}
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={otpSending}
                      className="w-full h-11 border-2 border-teal-300 hover:border-teal-600 bg-teal-50/70 hover:bg-teal-100/90 text-teal-900 hover:text-teal-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs disabled:opacity-50"
                    >
                      {otpSending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                          <span>Enviando código WhatsApp...</span>
                        </>
                      ) : (
                        <>
                          <Phone className="h-4 w-4 text-emerald-600 shrink-0" />
                          <span>Recibir Código de Acceso Express a mi WhatsApp</span>
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-slate-500 text-center leading-relaxed">
                      🔒 Tu información médica está protegida bajo estándares de confidencialidad clínica.
                    </p>

                  </form>
                </div>
              ) : expressSuccess ? (
                /* MODO 3: ÉXITO EN CITA EXPRESS */
                <div className="flex-1 px-6 py-8 text-center space-y-4 bg-white flex flex-col items-center justify-center animate-in fade-in">
                  <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-600 flex items-center justify-center shadow-lg shadow-teal-500/10">
                    <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
                  </div>
                  <div className="space-y-1.5">
                    <Badge className="bg-teal-100 text-teal-800 border-teal-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                      Prioridad Alta · Paciente Frecuente
                    </Badge>
                    <h3 className="text-lg font-black text-slate-900">¡Solicitud Express Recibida!</h3>
                    <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                      Hemos anexado tu solicitud a tu expediente clínico <strong>(DNI: {patientSession.dni})</strong>. Tu asesor asignado te contactará a tu WhatsApp en los próximos minutos para confirmar tu hora exacta.
                    </p>
                  </div>

                  <div className="pt-3 flex gap-2 w-full max-w-xs">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setExpressSuccess(false)}
                      className="flex-1 h-9 rounded-xl text-xs font-bold border-slate-200 cursor-pointer"
                    >
                      Nueva Consulta
                    </Button>
                    <Button
                      type="button"
                      onClick={handleLogout}
                      className="flex-1 h-9 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold cursor-pointer"
                    >
                      Cerrar Sesión
                    </Button>
                  </div>
                </div>
              ) : (
                /* MODO 4: DASHBOARD DEL PACIENTE & AGENDAMIENTO EXPRESS */
                <div className="flex-1 lg:overflow-y-auto px-5 py-4 space-y-3.5 bg-white lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]">
                  
                  {/* Tarjeta de Ficha y Estado del Paciente */}
                  <div className="p-3 rounded-2xl bg-teal-50/80 border border-teal-200 text-teal-950 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold text-xs">
                          {patientSession.nombres.charAt(0)}
                        </div>
                        <div>
                          <p className="text-xs font-black text-teal-950 leading-tight">{patientSession.fullName}</p>
                          <p className="text-[10px] text-teal-700 font-mono">DNI: {patientSession.dni} · Celular: {patientSession.numero ? `••• ••• ${patientSession.numero.slice(-3)}` : 'Registrado'}</p>
                        </div>
                      </div>
                      <Badge className="bg-teal-600 text-white border-0 text-[9px] px-2 py-0.5 rounded-full font-bold">
                        Expediente Activo
                      </Badge>
                    </div>

                    {/* Resumen de Próxima Cita si existe */}
                    {patientSession.proxima_cita ? (
                      <div className="p-2.5 rounded-xl bg-white border border-teal-100 flex items-start gap-2.5 text-xs">
                        <CalendarCheck className="w-4 h-4 text-teal-600 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold text-[11px] text-slate-800">
                            Próxima Cita: {patientSession.proxima_cita.fecha} ({patientSession.proxima_cita.hora} hrs)
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {patientSession.proxima_cita.servicio} · {patientSession.proxima_cita.doctor} ({patientSession.proxima_cita.sede})
                          </p>
                        </div>
                      </div>
                    ) : patientSession.ultima_atencion ? (
                      <div className="p-2 rounded-xl bg-white/80 border border-teal-100 flex items-center gap-2 text-[10.5px] text-slate-600">
                        <History className="w-3.5 h-3.5 text-teal-600" />
                        <span>Última Atención: <strong>{patientSession.ultima_atencion.servicio}</strong> ({patientSession.ultima_atencion.doctor})</span>
                      </div>
                    ) : null}
                  </div>

                  {/* Formulario de Agendamiento Express en 3 Clics */}
                  <form onSubmit={handleExpressSubmit} className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Stethoscope className="h-3 w-3 text-teal-600" />
                          ¿Qué atención o control necesitas hoy? <span className="text-rose-500">*</span>
                        </span>
                      </Label>
                      <Select 
                        value={expressServiceId} 
                        onValueChange={setExpressServiceId}
                      >
                        <SelectTrigger className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-teal-500 shadow-sm">
                          <SelectValue placeholder="Selecciona servicio / motivo" />
                        </SelectTrigger>
                        <SelectContent className="bg-white border-slate-200 text-slate-800 shadow-xl">
                          {catalogs.servicios.map((s: any) => (
                            <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs font-medium">
                              {s.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-teal-600" />
                          Sede de Preferencia
                        </Label>
                        <Select value={expressSede} onValueChange={setExpressSede}>
                          <SelectTrigger className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-teal-500">
                            <SelectValue placeholder="Sede" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200 text-slate-800">
                            {catalogs.sedes && catalogs.sedes.length > 0 ? (
                              catalogs.sedes.map((s: any) => (
                                <SelectItem key={s.id_sede || s.nombre} value={s.nombre} className="text-xs">
                                  {s.nombre}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="Sede California" className="text-xs">Sede California</SelectItem>
                                <SelectItem value="Sede Primavera" className="text-xs">Sede Primavera</SelectItem>
                                <SelectItem value="Sede Centro Histórico" className="text-xs">Sede Centro Histórico</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                          <Clock className="h-3 w-3 text-teal-600" />
                          Turno Preferido
                        </Label>
                        <Select value={expressTimeSlot} onValueChange={setExpressTimeSlot}>
                          <SelectTrigger className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 focus:ring-1 focus:ring-teal-500">
                            <SelectValue placeholder="Turno" />
                          </SelectTrigger>
                          <SelectContent className="bg-white border-slate-200 text-slate-800">
                            <SelectItem value="1" className="text-xs">Mañana (08:00 – 01:00)</SelectItem>
                            <SelectItem value="2" className="text-xs">Tarde (01:00 – 06:00)</SelectItem>
                            <SelectItem value="3" className="text-xs">Noche (06:00 – 09:00)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="expressDuda" className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="h-3 w-3 text-teal-600" />
                          Consulta, molestia o requerimiento especial
                        </span>
                        <span className="text-[9.5px] text-slate-500 font-normal">Opcional</span>
                      </Label>
                      <Input
                        id="expressDuda"
                        placeholder="Ej: Tengo una molestia leve en un molar / Deseo ajuste de brackets"
                        value={expressDuda}
                        onChange={(e) => setExpressDuda(e.target.value)}
                        className="rounded-xl h-9 text-xs bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-teal-500 focus:bg-white shadow-sm"
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        disabled={expressSubmitting}
                        className="w-full h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-teal-700/20 text-xs flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {expressSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Procesando solicitud express...</span>
                          </>
                        ) : (
                          <>
                            <Zap className="h-4 w-4" />
                            <span>Solicitar Cita Express con 1 Clic</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

            </div>
          ) : (
            /* Estado de Éxito */
            /* Estado de Resultado (Consulta Recurrente vs Registro Nuevo vs Nuevo Compartido) */
            <Card className={`border shadow-xl lg:shadow-none bg-white rounded-3xl overflow-hidden p-6 sm:p-8 text-center space-y-5 animate-in fade-in duration-400 max-w-md w-full relative ${
              isRecurringSubmitted ? 'border-teal-300 ring-2 ring-teal-400/20' : 'border-slate-200/90'
            }`}>
              
              {/* Contenedor del Ícono con animación moderna y orgánica */}
              <div className="flex justify-center items-center pt-2">
                {isRecurringSubmitted ? (
                  <div className="relative flex items-center justify-center">
                    {/* Halo de ripple suave */}
                    <div className="absolute w-20 h-20 rounded-full bg-teal-400/25 animate-checkmark-ripple" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 ring-4 ring-teal-50 dark:ring-teal-950/50 animate-checkmark-pop">
                      <RotateCw className="w-8 h-8 stroke-[2.4]" />
                    </div>
                  </div>
                ) : (
                  <div className="relative flex items-center justify-center">
                    {/* Halo de confirmación expansivo */}
                    <div className="absolute w-20 h-20 rounded-full bg-teal-400/25 animate-checkmark-ripple" />
                    {/* Badge circular con gradiente profesional */}
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 text-white flex items-center justify-center shadow-lg shadow-teal-600/30 ring-4 ring-teal-50 dark:ring-teal-950/50 animate-checkmark-pop">
                      <svg className="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" className="animate-checkmark-draw" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-center">
                  {isRecurringSubmitted ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1.5 shadow-xs">
                      <RotateCw className="w-3 h-3 text-teal-700 shrink-0" />
                      NUEVA CONSULTA REGISTRADA (#{consultationCount})
                    </span>
                  ) : isNewSharedSubmitted ? (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1.5 shadow-xs">
                      <UserPlus className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      NUEVO EXPEDIENTE CREADO
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1.5 shadow-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      SOLICITUD DE CITA REGISTRADA
                    </span>
                  )}
                </div>

                <h2 className="text-xl font-black tracking-tight text-slate-900">
                  {isRecurringSubmitted 
                    ? '¡Nueva Consulta Registrada con Éxito!' 
                    : isNewSharedSubmitted
                      ? '¡Bienvenido(a)! Tu Expediente ha sido Creado'
                      : '¡Hemos Recibido tu Solicitud!'}
                </h2>
                
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  {isRecurringSubmitted ? (
                    <>
                      ¡Hola de nuevo, <strong className="text-slate-900 font-bold">{fullName}</strong>! Registramos esta nueva consulta en tu expediente odontológico. Nuestro equipo se comunicará contigo muy pronto para responder tus dudas y coordinar tu atención.
                    </>
                  ) : isNewSharedSubmitted ? (
                    <>
                      ¡Te damos la bienvenida, <strong className="text-slate-900 font-bold">{fullName}</strong>! Registramos tus datos como nuevo paciente independiente. Nuestro equipo odontológico se comunicará contigo para coordinar tu primera evaluación.
                    </>
                  ) : (
                    <>
                      Muchas gracias, <strong className="text-slate-900 font-bold">{fullName}</strong>. Tus datos han sido recibidos para coordinar tu cita odontológica. Un asesor de nuestra clínica se comunicará contigo vía WhatsApp o llamada telefónica.
                    </>
                  )}
                </p>
              </div>

              <div className="p-3.5 rounded-2xl text-left text-xs space-y-2 max-w-xs mx-auto animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200 border bg-slate-50 border-slate-200 text-slate-600">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Teléfono de contacto:</span>
                  <span className="font-mono font-bold text-slate-900">+51 {phone}</span>
                </div>
                {catalogs.servicios?.find(s => String(s.id_servicio) === String(serviceId))?.nombre && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                    <span className="text-slate-600">Tratamiento de interés:</span>
                    <span className="font-semibold text-teal-800 text-right">
                      {catalogs.servicios.find(s => String(s.id_servicio) === String(serviceId))?.nombre}
                    </span>
                  </div>
                )}
                {sede && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                    <span className="text-slate-600">Sede preferida:</span>
                    <span className="font-semibold text-slate-800">{sede}</span>
                  </div>
                )}
                {timeSlot && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                    <span className="text-slate-600">Horario preferido:</span>
                    <span className="font-semibold text-slate-800">{timeSlot}</span>
                  </div>
                )}
                {isRecurringSubmitted && (
                  <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                    <span className="text-slate-600">Historial de consultas:</span>
                    <span className="font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 border border-teal-200 inline-flex items-center gap-1">
                      <RotateCw className="w-2.5 h-2.5 text-teal-700 shrink-0" />
                      <span>Intento #{consultationCount}</span>
                    </span>
                  </div>
                )}
                {dudaEspecifica.trim() && (
                  <div className="text-[10.5px] pt-1 border-t border-slate-200/80">
                    <span className="font-semibold text-slate-700 block">Duda o consulta registrada:</span>
                    <p className="text-slate-600 italic mt-0.5 line-clamp-2">"{dudaEspecifica.trim()}"</p>
                  </div>
                )}
                <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-200/80">
                  <span className="text-slate-600">Estado de tu atención:</span>
                  <span className="font-bold text-[10.5px] text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200 inline-flex items-center gap-1">
                    <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                    En espera de confirmación de cita
                  </span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmittedSuccess(false);
                    setIsRecurringSubmitted(false);
                    setIsDuplicateSubmitted(false);
                    setIsNewSharedSubmitted(false);
                    setConsultationCount(1);
                    setFullName('');
                    setPhone('');
                    setEmail('');
                    setServiceId('');
                    setDudaEspecifica('');
                    setTimeSlot('');
                    setTermsAccepted(false);
                  }}
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-4 h-9 border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer transition-all"
                >
                  Enviar otra consulta
                </Button>

                <Button
                  onClick={() => navigate('/buyer')}
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-5 h-9 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white shadow-md shadow-teal-700/20 cursor-pointer transition-all"
                >
                  Volver al inicio
                </Button>
              </div>
            </Card>
          )}
        </div>

        {/* Modal de Confirmación de Identidad y Contacto */}
        <Dialog open={identityModalOpen} onOpenChange={setIdentityModalOpen}>
          <DialogContent className="sm:max-w-md bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden rounded-3xl shadow-2xl">
            {/* Header con gradiente elegante */}
            <div className="bg-gradient-to-r from-teal-700 via-teal-800 to-emerald-800 px-6 py-5 text-white relative">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10.5px] font-semibold bg-white/20 text-white backdrop-blur border border-white/25 shadow-2xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-200" />
                  Verificación de Seguridad
                </span>
              </div>
              <DialogTitle className="text-lg font-bold text-white tracking-tight">
                Confirmación de Identidad y Contacto
              </DialogTitle>
              <DialogDescription className="text-xs text-teal-100/90 mt-1 leading-relaxed">
                Detectamos que el {identityModalData?.matchedType === 'email' ? 'correo electrónico' : 'número de WhatsApp'} ingresado ya se encuentra registrado en nuestra base clínica.
              </DialogDescription>
            </div>

            <div className="p-6 space-y-4">
              {/* Mensaje de Seguridad */}
              <div className="p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/90 text-amber-950 text-xs flex items-start gap-3">
                <div className="p-1.5 rounded-xl bg-amber-100 text-amber-800 shrink-0 mt-0.5">
                  <ShieldAlert className="w-4 h-4 text-amber-700" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-[11.5px] text-amber-950">
                    ¿Eres tú o compartes este número con otra persona?
                  </p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Para proteger la confidencialidad médica y evitar mezclar expedientes clínicos de pacientes distintos, por favor confirma tu caso:
                  </p>
                </div>
              </div>

              {/* Opciones de Acción */}
              <div className="space-y-2.5">
                {/* Opción 1: Sí soy yo */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeRegistration(false)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 border-teal-500/40 bg-teal-50/50 hover:bg-teal-50 hover:border-teal-600 transition-all cursor-pointer group flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-teal-500 shadow-xs"
                >
                  <div className="p-2 rounded-xl bg-teal-600 text-white shrink-0 group-hover:scale-105 transition-transform mt-0.5 shadow-sm shadow-teal-600/30">
                    <UserCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="font-bold text-xs sm:text-[13px] text-teal-950 group-hover:text-teal-900 leading-tight">
                        Sí, soy yo (Continuar con mi solicitud)
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-teal-800 bg-teal-100/90 border border-teal-300/80 px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap shadow-2xs">
                        Expediente existente
                      </span>
                    </div>
                    <p className="text-[11px] text-teal-900/80 mt-1.5 leading-relaxed">
                      He modificado la escritura de mi nombre o ya me he atendido antes. Deseo anexar esta consulta a mi historial.
                    </p>
                  </div>
                </button>

                {/* Opción 2: No soy yo (Crear nuevo paciente) */}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => executeRegistration(true)}
                  className="w-full text-left p-3.5 sm:p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 hover:bg-white hover:border-slate-400 transition-all cursor-pointer group flex items-start gap-3 focus:outline-none focus:ring-2 focus:ring-slate-400 shadow-xs"
                >
                  <div className="p-2 rounded-xl bg-slate-800 text-white shrink-0 group-hover:scale-105 transition-transform mt-0.5 shadow-sm shadow-slate-800/30">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2.5">
                      <span className="font-bold text-xs sm:text-[13px] text-slate-900 group-hover:text-slate-950 leading-tight">
                        No soy yo (Crear nuevo paciente)
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-200/90 border border-slate-300/80 px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap shadow-2xs">
                        Nuevo paciente
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1.5 leading-relaxed">
                      Comparto este contacto con un familiar o soy un paciente nuevo. Deseo crear mi propio expediente clínico independiente.
                    </p>
                  </div>
                </button>
              </div>

              {/* Opción para Corregir Teléfono o Correo sin Registrar */}
              <div className="pt-2 border-t border-slate-100 flex flex-col items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIdentityModalOpen(false);
                    if (identityModalData?.matchedType === 'email') {
                      setEmail('');
                      setTimeout(() => {
                        const emailInput = document.getElementById('email');
                        if (emailInput) {
                          emailInput.focus();
                        }
                      }, 120);
                      toast({
                        title: 'Modifica tu correo',
                        description: 'Hemos limpiado el campo para que ingreses tu correo correcto.',
                      });
                    } else {
                      setPhone('');
                      setTimeout(() => {
                        const phoneInput = document.getElementById('phone');
                        if (phoneInput) {
                          phoneInput.focus();
                        }
                      }, 120);
                      toast({
                        title: 'Modifica tu teléfono',
                        description: 'Hemos limpiado el campo para que ingreses tu número de WhatsApp correcto.',
                      });
                    }
                  }}
                  className="w-full text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border-slate-200 rounded-xl h-10 flex items-center justify-center gap-2 cursor-pointer transition-all shadow-2xs"
                >
                  <Phone className="w-3.5 h-3.5 text-teal-600" />
                  <span>
                    {identityModalData?.matchedType === 'email'
                      ? 'Deseo cambiar el correo ingresado'
                      : 'Deseo cambiar el número de teléfono'}
                  </span>
                </Button>
                <p className="text-[10px] text-slate-400 text-center">
                  Cierra esta ventana y limpia el campo para que ingreses tus datos correctos sin registrar nada.
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal de Validación de Código OTP por WhatsApp */}
        <Dialog open={otpModalOpen} onOpenChange={setOtpModalOpen}>
          <DialogContent className="sm:max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-2xl">
            <DialogHeader className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <Phone className="w-6 h-6" />
              </div>
              <DialogTitle className="text-base font-black text-slate-900">
                Código de Verificación WhatsApp
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 leading-relaxed">
                Ingresa el código de 4 dígitos que enviamos a tu número registrado: <strong>{otpMaskedPhone}</strong> (DNI: {loginDni}).
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleVerifyOtp} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label htmlFor="otpCodeInput" className="text-xs font-bold text-slate-700 text-center block">
                  Código de 4 Dígitos
                </Label>
                <div className="flex justify-center">
                  <Input
                    id="otpCodeInput"
                    type="text"
                    maxLength={4}
                    placeholder="• • • •"
                    value={otpCode}
                    onChange={(e) => {
                      setOtpCode(e.target.value.replace(/\D/g, ''));
                      setOtpError(null);
                    }}
                    autoFocus
                    className="w-40 h-12 text-center text-xl tracking-[0.5em] font-mono font-black bg-slate-50 border-2 border-teal-500/50 rounded-2xl text-slate-900 focus:border-teal-600 focus:ring-2 focus:ring-teal-500/20 shadow-inner"
                  />
                </div>
              </div>

              {/* Banner de código de prueba en desarrollo/demo */}
              {otpDebugCode && (
                <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-center text-[11px] text-teal-900 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>Código de Simulación: <strong className="font-mono font-bold">{otpDebugCode}</strong></span>
                </div>
              )}

              {otpError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-center text-[11px] text-rose-700 flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{otpError}</span>
                </div>
              )}

              <div className="pt-1 space-y-2">
                <Button
                  type="submit"
                  disabled={otpVerifying || otpCode.length !== 4}
                  className="w-full h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs gap-2 shadow-md shadow-teal-700/20 cursor-pointer"
                >
                  {otpVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verificando código...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Validar Código y Acceder</span>
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSendOtp}
                  disabled={otpSending}
                  className="w-full text-xs text-slate-500 hover:text-slate-800"
                >
                  ¿No recibiste el código? Reenviar por WhatsApp
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center py-1 text-[10px] text-slate-500 shrink-0">
        <p>© 2026 NexoSalud Odontología Especializada · Sistema de Inteligencia de Negocios · Privacidad Protegida</p>
      </footer>
      <Toaster />
    </div>
  );
}
