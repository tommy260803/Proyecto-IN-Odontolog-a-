import React, { useState, useEffect } from 'react';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Badge } from '@/shared/components/ui/badge';
import { buyerService } from '../services/buyer.service';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/shared/hooks/use-toast';
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
  Award,
  Zap,
  Check,
  CalendarCheck,
  HeartPulse
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

  const [loading, setLoading] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  // Form State
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [sede, setSede] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Error State
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    buyerService.getCatalogs()
      .then((data) => setCatalogs(data))
      .catch((err) => console.error('Error cargando catálogos:', err));
  }, []);

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

    // 4. Servicio de Interés
    if (!serviceId) {
      newErrors.serviceId = 'Por favor selecciona el servicio de tu interés.';
    }

    // 5. Sede de Interés
    if (!sede) {
      newErrors.sede = 'Por favor selecciona la sede de tu preferencia.';
    }

    // 6. Términos y Condiciones
    if (!termsAccepted) {
      newErrors.terms = 'Debes aceptar los términos y el consentimiento de datos.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
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

    setLoading(true);
    try {
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] || 'Prospecto';
      const lastName = nameParts.slice(1).join(' ') || 'Web';

      const webCanal = catalogs.canales.find((c: any) => c.nombre.toLowerCase().includes('web') || c.nombre.toLowerCase().includes('formulario'))?.id_canal || 1;
      const metaFuente = catalogs.fuentes.find((f: any) => f.nombre.toLowerCase().includes('redes') || f.nombre.toLowerCase().includes('ads') || f.nombre.toLowerCase().includes('meta'))?.id_fuente || 1;

      await buyerService.registerAndConvert({
        nombres: firstName,
        apellidos: lastName,
        email: email.trim() || undefined,
        numero: phone.trim(),
        autoriza_contacto: true,
        id_canal: webCanal,
        id_canal_origen: webCanal,
        id_fuente: metaFuente,
        id_campana_origen: metaFuente,
        id_servicio: Number(serviceId),
        id_servicio_interes: Number(serviceId),
        sede_preferida: sede,
        tipo_persona: 'Adulto General',
        estado_calidad: 'Valido',
        concreteRequest: `Solicitud Web: Servicio ID ${serviceId} - Horario: ${timeSlot || 'Cualquiera'}`,
      });

      setSubmittedSuccess(true);
      toast({
        title: '¡Solicitud Recibida con Éxito!',
        description: 'Un asesor comercial odontológico se pondrá en contacto contigo en breve.',
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error al enviar la solicitud',
        description: error.message || 'Hubo un inconveniente. Inténtalo nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-3 sm:p-6 lg:p-8 selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Top Bar / Header */}
      <header className="max-w-7xl mx-auto w-full flex items-center justify-between py-2 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <img 
            src="/Logo_NexoSalud.png" 
            alt="NexoSalud Dental" 
            className="h-10 w-10 object-contain rounded-xl shadow-md ring-1 ring-slate-800 bg-white p-1"
          />
          <div>
            <span className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              NexoSalud <span className="text-teal-400 font-bold">Dental</span>
            </span>
            <p className="text-[11px] text-slate-400 font-medium">Clínica Odontológica Especializada · Portal Web</p>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={() => navigate('/buyer')}
          className="rounded-xl border-slate-800 bg-slate-900/80 hover:bg-slate-800 text-slate-200 text-xs font-semibold gap-1.5 shadow-sm cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Volver al Dashboard</span>
        </Button>
      </header>

      {/* Main Content Split Screen (Left: Clinic Information | Right: Flat Form) */}
      <main className="max-w-7xl mx-auto w-full my-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10 items-center py-2">
        
        {/* Left Column: Información de NexoSalud Odontología */}
        <div className="lg:col-span-6 xl:col-span-6 space-y-6 animate-in fade-in slide-in-from-left duration-400">
          
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-400 text-xs font-semibold backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-teal-300" />
              <span>Red Odontológica Integral de Alta Complejidad</span>
            </div>

            <h1 className="text-3xl sm:text-4xl xl:text-5xl font-black text-white tracking-tight leading-[1.15]">
              Transformamos tu sonrisa con <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 via-emerald-400 to-teal-200">tecnología de vanguardia</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-xl font-normal">
              Accede a una atención odontológica moderna, indolora y personalizada. Nuestros especialistas certificados te acompañan en cada paso con diagnósticos digitales 3D y facilidades de pago.
            </p>
          </div>

          {/* Grid de Beneficios Clave */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1.5 hover:border-teal-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Stethoscope className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-bold text-white">Especialistas Certificados</h2>
              <p className="text-[11px] text-slate-400 leading-normal">
                Ortodoncia, Implantes, Estética Dental y Odontopediatría.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1.5 hover:border-teal-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Zap className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-bold text-white">Diagnóstico Digital 3D</h2>
              <p className="text-[11px] text-slate-400 leading-normal">
                Escaneo intraoral de alta precisión y procedimientos sin dolor.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1.5 hover:border-teal-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Building2 className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-bold text-white">3 Sedes en Lima</h2>
              <p className="text-[11px] text-slate-400 leading-normal">
                San Isidro, Surco y Los Olivos con infraestructura moderna.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 backdrop-blur space-y-1.5 hover:border-teal-500/30 transition-all">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
                <Clock className="h-4 w-4" />
              </div>
              <h2 className="text-xs font-bold text-white">Respuesta Inmediata</h2>
              <p className="text-[11px] text-slate-400 leading-normal">
                Confirmación de cupo y cotizaciones en menos de 15 minutos.
              </p>
            </div>
          </div>

          {/* KPI Stats / Social Proof */}
          <div className="flex items-center gap-6 pt-2 border-t border-slate-800/80">
            <div>
              <p className="text-xl sm:text-2xl font-black text-white font-mono">+12,000</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Pacientes Atendidos</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div>
              <p className="text-xl sm:text-2xl font-black text-teal-400 font-mono">98.9%</p>
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Satisfacción Clínica</p>
            </div>
            <div className="h-8 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-3.5 w-3.5 fill-amber-400" />
                ))}
              </div>
              <span className="text-xs font-bold text-white font-mono">4.9/5</span>
            </div>
          </div>

        </div>

        {/* Right Column: Formulario Plano con Header & Footer Fijo y Scroll Invisible */}
        <div className="lg:col-span-6 xl:col-span-6 w-full flex justify-center lg:justify-end animate-in fade-in slide-in-from-right duration-400">
          {!submittedSuccess ? (
            <div className="w-full max-w-xl bg-slate-900/90 rounded-3xl overflow-hidden flex flex-col h-[680px] max-h-[85vh] shadow-2xl relative border border-slate-800/60 backdrop-blur-xl">
              
              {/* Header Fijo (Estático) */}
              <div className="p-5 sm:p-6 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[10px] px-2.5 py-0.5 rounded-full font-semibold backdrop-blur">
                    <Sparkles className="h-3 w-3 mr-1 text-teal-200" /> Campaña Preventiva 2026
                  </Badge>
                  <span className="text-[11px] text-teal-100 font-medium flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5 text-teal-300" /> Cupos Limitados
                  </span>
                </div>

                <h2 className="text-lg sm:text-xl font-black text-white tracking-tight">
                  Solicita tu Evaluación Odontológica
                </h2>
                <p className="text-teal-100 text-xs mt-1 leading-relaxed font-normal">
                  Completa el formulario y un especialista coordinará tu cita preferencial en minutos.
                </p>
              </div>

              {/* Cuerpo del Formulario con Scroll Interno Invisible (Sin Scrollbar) */}
              <div 
                className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
              >
                <form id="buyerWebForm" onSubmit={handleSubmit} className="space-y-4">
                  
                  {/* 1. Nombres y Apellidos */}
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-teal-400" />
                        Nombres y Apellidos <span className="text-rose-400 font-bold">*</span>
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
                      className={`rounded-xl h-10 text-xs bg-slate-950 border-slate-800 text-white focus-visible:ring-teal-500 ${errors.fullName ? 'border-rose-500 focus-visible:ring-rose-500' : ''}`}
                    />
                    {errors.fullName && <p className="text-[11px] text-rose-400 font-medium">{errors.fullName}</p>}
                  </div>

                  {/* 2 & 3: Teléfono y Correo */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Teléfono WhatsApp */}
                    <div className="space-y-1.5">
                      <Label htmlFor="phone" className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-teal-400" />
                        Teléfono / WhatsApp <span className="text-rose-400 font-bold">*</span>
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
                          className={`pl-11 rounded-xl h-10 text-xs font-mono bg-slate-950 border-slate-800 text-white focus-visible:ring-teal-500 ${errors.phone ? 'border-rose-500 focus-visible:ring-rose-500' : ''}`}
                        />
                      </div>
                      {errors.phone ? (
                        <p className="text-[11px] text-rose-400 font-medium">{errors.phone}</p>
                      ) : (
                        <p className="text-[10px] text-slate-500">Exactamente 9 dígitos para Perú</p>
                      )}
                    </div>

                    {/* Correo Electrónico */}
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-xs font-bold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-slate-400" /> Correo Electrónico
                        </span>
                        <span className="text-[10px] text-slate-500 font-normal">Opcional</span>
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
                        className={`rounded-xl h-10 text-xs bg-slate-950 border-slate-800 text-white focus-visible:ring-teal-500 ${errors.email ? 'border-rose-500 focus-visible:ring-rose-500' : ''}`}
                      />
                      {errors.email && <p className="text-[11px] text-rose-400 font-medium">{errors.email}</p>}
                    </div>
                  </div>

                  {/* 4 & 5: Servicio de Interés y Sede */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Servicio de Interés */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-teal-400" />
                        Servicio de Interés <span className="text-rose-400 font-bold">*</span>
                      </Label>
                      <Select 
                        value={serviceId} 
                        onValueChange={(val) => {
                          setServiceId(val);
                          if (errors.serviceId) setErrors(prev => ({ ...prev, serviceId: '' }));
                        }}
                      >
                        <SelectTrigger className={`rounded-xl h-10 text-xs bg-slate-950 border-slate-800 text-white focus:ring-teal-500 ${errors.serviceId ? 'border-rose-500' : ''}`}>
                          <SelectValue placeholder="Selecciona tratamiento" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {catalogs.servicios.map((s: any) => (
                            <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs focus:bg-slate-800 focus:text-white">
                              {s.nombre}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.serviceId && <p className="text-[11px] text-rose-400 font-medium">{errors.serviceId}</p>}
                    </div>

                    {/* Sede de Interés */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-teal-400" />
                        Sede de Interés <span className="text-rose-400 font-bold">*</span>
                      </Label>
                      <Select 
                        value={sede} 
                        onValueChange={(val) => {
                          setSede(val);
                          if (errors.sede) setErrors(prev => ({ ...prev, sede: '' }));
                        }}
                      >
                        <SelectTrigger className={`rounded-xl h-10 text-xs bg-slate-950 border-slate-800 text-white focus:ring-teal-500 ${errors.sede ? 'border-rose-500' : ''}`}>
                          <SelectValue placeholder="Selecciona sede" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-900 border-slate-800 text-white">
                          {catalogs.sedes && catalogs.sedes.length > 0 ? (
                            catalogs.sedes.map((s: any) => (
                              <SelectItem key={s.id_sede || s.nombre} value={s.nombre} className="text-xs focus:bg-slate-800 focus:text-white">
                                {s.nombre}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="Sede San Isidro" className="text-xs focus:bg-slate-800 focus:text-white">Sede San Isidro (Principal)</SelectItem>
                              <SelectItem value="Sede Surco" className="text-xs focus:bg-slate-800 focus:text-white">Sede Surco</SelectItem>
                              <SelectItem value="Sede Los Olivos" className="text-xs focus:bg-slate-800 focus:text-white">Sede Los Olivos</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                      {errors.sede && <p className="text-[11px] text-rose-400 font-medium">{errors.sede}</p>}
                    </div>
                  </div>

                  {/* 6: Franja Horaria Preferida (Botones con Íconos Lucide Framework) */}
                  <div className="space-y-2 pt-1">
                    <Label className="text-xs font-bold text-slate-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" /> Franja Horaria Preferida
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">Opcional</span>
                    </Label>
                    
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { 
                          id: '1', 
                          label: 'Mañana', 
                          hours: '08:00 - 13:00', 
                          icon: Sunrise,
                          iconColor: 'text-amber-400'
                        },
                        { 
                          id: '2', 
                          label: 'Tarde', 
                          hours: '13:00 - 18:00', 
                          icon: Sun,
                          iconColor: 'text-orange-400'
                        },
                        { 
                          id: '3', 
                          label: 'Noche', 
                          hours: '18:00 - 21:00', 
                          icon: Moon,
                          iconColor: 'text-indigo-400'
                        },
                      ].map((slot) => {
                        const isSelected = timeSlot === slot.id;
                        const IconComponent = slot.icon;

                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => setTimeSlot(isSelected ? '' : slot.id)}
                            className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                              isSelected
                                ? 'border-teal-500 bg-teal-950/70 text-teal-300 ring-1 ring-teal-500/40 shadow-xs'
                                : 'border-slate-800 bg-slate-950/70 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <div className={`p-1.5 rounded-xl mb-1 ${isSelected ? 'bg-teal-900/60' : 'bg-slate-900 shadow-2xs'}`}>
                              <IconComponent className={`h-4 w-4 ${slot.iconColor}`} />
                            </div>
                            <span className="text-xs font-bold leading-tight">{slot.label}</span>
                            <span className="text-[10px] text-slate-500 mt-0.5 font-mono">{slot.hours}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 7: Checkbox de Términos y Consentimiento */}
                  <div className="pt-1">
                    <div className={`flex items-start space-x-3 rounded-2xl border p-3.5 transition-all ${
                      termsAccepted 
                        ? 'border-teal-800/80 bg-teal-950/30' 
                        : errors.terms 
                          ? 'border-rose-900/80 bg-rose-950/30' 
                          : 'border-slate-800 bg-slate-950/50'
                    }`}>
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked: boolean) => {
                          setTermsAccepted(Boolean(checked));
                          if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
                        }}
                        className="mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-1 leading-none">
                        <label htmlFor="terms" className="text-xs font-bold text-slate-200 cursor-pointer">
                          Autorizo el tratamiento de mis datos y contacto por WhatsApp / Teléfono <span className="text-rose-400">*</span>
                        </label>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Acepto los Términos y Condiciones y la Política de Privacidad de Datos Personales (Ley N° 29733) para agendamiento y cotizaciones clínicas.
                        </p>
                      </div>
                    </div>
                    {errors.terms && <p className="text-[11px] text-rose-400 font-medium mt-1 pl-1">{errors.terms}</p>}
                  </div>
                </form>
              </div>

              {/* Footer Fijo (Estático) con Botón de Enviar */}
              <div className="p-4 sm:p-5 border-t border-slate-800 bg-slate-950 shrink-0 flex items-center justify-between gap-3">
                <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" />
                  <span>Datos 100% seguros y protegidos</span>
                </div>

                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="w-full sm:w-auto sm:min-w-[260px] h-11 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-teal-900/30 text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enviando solicitud...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Solicitar Información y Agendar</span>
                    </>
                  )}
                </Button>
              </div>

            </div>
          ) : (
            /* Estado de Éxito */
            <Card className="border border-emerald-800/60 shadow-2xl bg-slate-900 rounded-3xl overflow-hidden p-8 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300 max-w-lg w-full">
              <div className="w-16 h-16 rounded-3xl bg-emerald-950/70 border border-emerald-700/60 text-emerald-400 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tight">
                  ¡Solicitud Registrada Exitosamente!
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                  Gracias <span className="font-bold text-teal-400">{fullName}</span>. Tus datos han sido capturados y transferidos a la etapa <span className="font-bold uppercase text-teal-300">LEAD</span> para atención prioritaria.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-left text-xs space-y-2 max-w-sm mx-auto">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Teléfono de contacto:</span>
                  <span className="font-mono font-bold text-white">+51 {phone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Sede preferida:</span>
                  <span className="font-semibold text-white">{sede}</span>
                </div>
                <div className="flex items-center justify-between text-slate-400">
                  <span>Canal asignado:</span>
                  <span className="font-semibold text-teal-400">Portal Web (Meta Ads)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSubmittedSuccess(false);
                    setFullName('');
                    setPhone('');
                    setEmail('');
                    setServiceId('');
                    setTimeSlot('');
                    setTermsAccepted(false);
                  }}
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-5 h-10 border-slate-700 text-slate-200 bg-slate-800/80 hover:bg-slate-700 cursor-pointer"
                >
                  Enviar otra solicitud
                </Button>

                <Button
                  onClick={() => navigate('/buyer')}
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-6 h-10 bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer"
                >
                  Ir al Dashboard (Ver en Lista)
                </Button>
              </div>
            </Card>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center py-2 text-[11px] text-slate-500 shrink-0">
        <p>© 2026 NexoSalud Odontología Especializada · Sistema de Inteligencia de Negocios · Privacidad y Datos Protegidos</p>
      </footer>
    </div>
  );
}
