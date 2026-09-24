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
  Zap
  Zap,
  Check
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

    // 4. Términos y Condiciones
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

      await buyerService.registerAndConvert({
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
        concreteRequest: `Solicitud de Información y Evaluación Odontológica (Portal Web). Sede: ${sede || 'No especificada'}. Franja Horaria: ${timeSlot || 'Flexible'}`,
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
              <h2 className="text-xs font-bold text-white">3 Sedes en Lima</h2>
              <p className="text-[10.5px] text-slate-400 leading-tight">
                San Isidro, Surco y Los Olivos.
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
              
              {/* Header Fijo (Estático) */}
              <div className="px-5 py-4 bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-700 text-white shrink-0 relative overflow-hidden">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-28 h-28 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-0 text-[9px] px-2 py-0.5 rounded-full font-semibold backdrop-blur">
                    <Sparkles className="h-2.5 w-2.5 mr-1 text-teal-200" /> Campaña 2026
                  </Badge>
                  <span className="text-[10px] text-teal-100 font-medium flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-teal-300" /> Cupos Disponibles
                  </span>
                </div>

                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  Solicita tu Evaluación Odontológica
                </h2>
                <p className="text-teal-100 text-[11px] mt-0.5 leading-tight font-normal">
                  Completa tus datos y un especialista coordinará tu cita preferencial.
                </p>
              </div>

              {/* Cuerpo del Formulario Plano en Blanco con Scroll Interno Invisible */}
              <div 
                className="flex-1 lg:overflow-y-auto px-5 py-4 space-y-3 bg-white lg:[&::-webkit-scrollbar]:hidden lg:[-ms-overflow-style:none] lg:[scrollbar-width:none]"
              >
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
                                {s.nombre}
                              </SelectItem>
                            ))
                          ) : (
                            <>
                              <SelectItem value="Sede San Isidro" className="text-xs">Sede San Isidro (Principal)</SelectItem>
                              <SelectItem value="Sede Surco" className="text-xs">Sede Surco</SelectItem>
                              <SelectItem value="Sede Los Olivos" className="text-xs">Sede Los Olivos</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
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
                          hours: '08:00 - 13:00', 
                          icon: Sunrise,
                          iconColor: 'text-amber-500'
                        },
                        { 
                          id: '2', 
                          label: 'Tarde', 
                          hours: '13:00 - 18:00', 
                          icon: Sun,
                          iconColor: 'text-orange-500'
                        },
                        { 
                          id: '3', 
                          label: 'Noche', 
                          hours: '18:00 - 21:00', 
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
                          ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/20' 
                          ? 'bg-teal-50/70 border-teal-300 ring-1 ring-teal-400/20 shadow-xs' 
                          : errors.terms 
                            ? 'bg-rose-50/60 border-rose-300 ring-1 ring-rose-400/20' 
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                      }`}
                    >
                      <Checkbox
                        id="terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked: boolean) => {
                          setTermsAccepted(Boolean(checked));
                          if (errors.terms) setErrors(prev => ({ ...prev, terms: '' }));
                        }}
                        className="mt-0.5 cursor-pointer !bg-white !border-slate-300 data-[state=checked]:!bg-teal-600 data-[state=checked]:!border-teal-600"
                      />
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
                        <label htmlFor="terms" className="text-[11px] font-bold text-slate-800 cursor-pointer">
                        <div className="text-[11px] font-bold text-slate-800 cursor-pointer">
                          Autorizo contacto por WhatsApp / Teléfono <span className="text-rose-500">*</span>
                        </label>
                        </div>
                        <p className="text-[10px] text-slate-600 leading-tight">
                          Acepto los Términos y Política de Privacidad (Ley N° 29733) para agendamiento clínico.
                        </p>
                      </div>
                    </div>
                    {errors.terms && <p className="text-[10px] text-rose-500 font-medium mt-0.5 pl-1">{errors.terms}</p>}
                  </div>
                </form>
              </div>

              {/* Footer Fijo (Estático) con Botón de Enviar */}
              <div className="px-5 py-3.5 bg-slate-50/95 shrink-0 flex items-center justify-between gap-3 border-t border-slate-100">
                <div className="hidden sm:flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Datos 100% seguros</span>
                </div>

                <Button
                  type="button"
                  onClick={() => handleSubmit()}
                  disabled={loading}
                  className="w-full sm:w-auto sm:min-w-[240px] h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-teal-700/20 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {loading ? (
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

            </div>
          ) : (
            /* Estado de Éxito */
            <Card className="border border-slate-200/80 shadow-none bg-white rounded-3xl overflow-hidden p-6 sm:p-8 text-center space-y-5 animate-in fade-in zoom-in-95 duration-300 max-w-md w-full">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 mx-auto flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-100">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">
                  ¡Solicitud Registrada Exitosamente!
                </h2>
                <p className="text-xs text-slate-600 max-w-xs mx-auto leading-relaxed">
                  Gracias <span className="font-bold text-teal-600">{fullName}</span>. Tus datos fueron transferidos a la etapa <span className="font-bold uppercase text-teal-700">LEAD</span> para atención prioritaria.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left text-xs space-y-1.5 max-w-xs mx-auto">
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Teléfono:</span>
                  <span className="font-mono font-bold text-slate-900">+51 {phone}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Sede preferida:</span>
                  <span className="font-semibold text-slate-900">{sede}</span>
                </div>
                <div className="flex items-center justify-between text-slate-600 text-[11px]">
                  <span>Canal asignado:</span>
                  <span className="font-semibold text-teal-700">Portal Web (Meta Ads)</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-1">
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
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-4 h-9 border-slate-200 text-slate-700 bg-slate-50 hover:bg-slate-100 cursor-pointer"
                >
                  Enviar otra solicitud
                </Button>

                <Button
                  onClick={() => navigate('/buyer')}
                  className="w-full sm:w-auto rounded-xl text-xs font-semibold px-5 h-9 bg-teal-600 hover:bg-teal-700 text-white shadow-sm cursor-pointer"
                >
                  Ir al Dashboard
                </Button>
              </div>
            </Card>
          )}
        </div>

      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full text-center py-1 text-[10px] text-slate-500 shrink-0">
        <p>© 2026 NexoSalud Odontología Especializada · Sistema de Inteligencia de Negocios · Privacidad Protegida</p>
      </footer>
    </div>
  );
}
