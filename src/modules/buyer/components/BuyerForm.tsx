import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { buyerSchema } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/shared/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { buyerService } from '../services/buyer.service';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  CreditCard, 
  Target, 
  Radio, 
  Sparkles, 
  Compass, 
  Clock, 
  MapPin, 
  Stethoscope, 
  GraduationCap, 
  Briefcase, 
  HeartPulse, 
  Activity, 
  ShieldCheck, 
  ChevronDown 
} from 'lucide-react';

export interface BuyerFormRef {
  submit: () => void;
}

export interface BuyerFormProps {
  initialValues?: Partial<BuyerFormValues>;
  onSubmit: (data: BuyerFormValues) => void;
  isLoading: boolean;
  isEdit?: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
}

export const BuyerForm = forwardRef<BuyerFormRef, BuyerFormProps>(({
  initialValues,
  onSubmit,
  isLoading,
  isEdit,
  formId = 'buyer-form',
  hideSubmitButton = false
}, ref) => {
  const { toast } = useToast();
  const [catalogs, setCatalogs] = useState<{
    canales: any[];
    fuentes: any[];
    servicios: any[];
    sedes: any[];
    modalidades?: any[];
    horarios?: any[];
  }>({ canales: [], fuentes: [], servicios: [], sedes: [], modalidades: [], horarios: [] });

  useEffect(() => {
    buyerService.getCatalogs()
      .then(setCatalogs)
      .catch((err) => console.error('Error loading buyer catalogs:', err));
  }, []);

  const form = useForm<BuyerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(buyerSchema) as any,
    mode: 'onChange',
    values: {
      firstName: initialValues?.firstName || '',
      lastName: initialValues?.lastName || '',
      documentType: initialValues?.documentType || 'DNI',
      documentNumber: initialValues?.documentNumber || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      channel: initialValues?.channel || '',
      attractionSource: initialValues?.attractionSource || '',
      serviceOfInterestId: initialValues?.serviceOfInterestId || '',
      pref_id_canal: initialValues?.pref_id_canal || '',
      pref_id_horario: initialValues?.pref_id_horario || '',
      pref_id_modalidad: initialValues?.pref_id_modalidad || '',
      pref_sede_preferida: initialValues?.pref_sede_preferida || '',
      pref_profesional_preferido: initialValues?.pref_profesional_preferido || '',
      concreteRequest: initialValues?.concreteRequest || '',
      estudianteAplica: initialValues?.estudianteAplica || false,
      universidad: initialValues?.universidad || '',
      carrera: initialValues?.carrera || '',
      ciclo: initialValues?.ciclo || '',
      laboralAplica: initialValues?.laboralAplica || false,
      ocupacion: initialValues?.ocupacion || '',
      empresa: initialValues?.empresa || '',
      modalidadLaboral: initialValues?.modalidadLaboral || '',
      disponibilidadLaboral: initialValues?.disponibilidadLaboral || '',
      ultima_visita_odontologica: initialValues?.ultima_visita_odontologica || '',
      motivo_consulta_odonto: initialValues?.motivo_consulta_odonto || '',
      tratamiento_previo: initialValues?.tratamiento_previo || '',
      nivel_dolor: initialValues?.nivel_dolor || '',
      presenta_sensibilidad: initialValues?.presenta_sensibilidad || '',
      sangrado_o_inflamacion: initialValues?.sangrado_o_inflamacion || '',
      usa_aparato_o_protesis: initialValues?.usa_aparato_o_protesis || '',
      condicion_atencion_especial: initialValues?.condicion_atencion_especial || '',
      contactAuthorization: initialValues?.contactAuthorization ?? true,
    },
  });

  useImperativeHandle(ref, () => ({
    submit: () => {
      form.handleSubmit(
        (data) => {
          onSubmit(data);
        },
        (errors) => {
          console.warn('Errores de validación en BuyerForm:', errors);
          const firstErrorMsg = Object.values(errors)[0]?.message as string;
          toast({
            title: 'Faltan datos obligatorios',
            description: firstErrorMsg || 'Por favor verifica los campos resaltados en rojo.',
            variant: 'destructive',
          });
        }
      )();
    }
  }));

  const watchIsEstudiante = form.watch('estudianteAplica');
  const watchIsLaboral = form.watch('laboralAplica');

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        
        {/* 1. Identificación y Contacto */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="py-3.5 px-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200/60 dark:border-teal-800/60">
                <User className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  1. Identificación & Datos de Contacto
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400">
                  Información personal básica del prospecto
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nombres <span className="text-rose-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Juan Carlos" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Apellidos <span className="text-rose-500">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Pérez Gómez" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tipo de Documento
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-xl">
                        <SelectValue placeholder="Seleccionar tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="DNI" className="text-xs text-slate-900 dark:text-slate-100">DNI (8 dígitos)</SelectItem>
                      <SelectItem value="CE" className="text-xs text-slate-900 dark:text-slate-100">Carné de Extranjería (CE)</SelectItem>
                      <SelectItem value="PASAPORTE" className="text-xs text-slate-900 dark:text-slate-100">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-slate-400" />
                    Nº de Documento
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. 74839201"
                      maxLength={form.watch('documentType') === 'DNI' ? 8 : 20}
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                      onChange={(e) => {
                        if (form.watch('documentType') === 'DNI') {
                          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                        }
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Phone className="h-3 w-3 text-slate-400" />
                    Teléfono / WhatsApp
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="Ej. +51 987 654 321" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Mail className="h-3 w-3 text-slate-400" />
                    Correo Electrónico
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="Ej. paciente@ejemplo.com" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* 2. Canal de Captación & Servicio de Interés */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm rounded-xl overflow-hidden">
          <CardHeader className="py-3.5 px-4 bg-slate-50/80 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  2. Canal de Captación & Interés Clínico
                </CardTitle>
                <CardDescription className="text-[11px] text-slate-500 dark:text-slate-400">
                  Origen de la prospección y requerimiento dental
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Radio className="h-3 w-3 text-slate-400" />
                    Canal de Contacto <span className="text-rose-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-xl">
                        <SelectValue placeholder="Seleccionar canal..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.canales.length > 0 ? (
                        catalogs.canales.map((c: any) => (
                          <SelectItem key={c.id_canal} value={c.id_canal.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                            {c.nombre}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="WhatsApp" className="text-xs text-slate-900 dark:text-slate-100">WhatsApp</SelectItem>
                          <SelectItem value="Facebook" className="text-xs text-slate-900 dark:text-slate-100">Facebook</SelectItem>
                          <SelectItem value="Instagram" className="text-xs text-slate-900 dark:text-slate-100">Instagram</SelectItem>
                          <SelectItem value="Web" className="text-xs text-slate-900 dark:text-slate-100">Web</SelectItem>
                          <SelectItem value="Presencial" className="text-xs text-slate-900 dark:text-slate-100">Presencial</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="attractionSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-slate-400" />
                    Fuente de Atracción <span className="text-rose-500">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-xl">
                        <SelectValue placeholder="Seleccionar fuente..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.fuentes.length > 0 ? (
                        catalogs.fuentes.map((f: any) => (
                          <SelectItem key={f.id_fuente} value={f.id_fuente.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                            {f.nombre}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Google" className="text-xs text-slate-900 dark:text-slate-100">Google Ads</SelectItem>
                          <SelectItem value="FacebookAds" className="text-xs text-slate-900 dark:text-slate-100">Facebook Ads</SelectItem>
                          <SelectItem value="Recomendacion" className="text-xs text-slate-900 dark:text-slate-100">Recomendación</SelectItem>
                          <SelectItem value="Organico" className="text-xs text-slate-900 dark:text-slate-100">Orgánico</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="serviceOfInterestId"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3 text-slate-400" />
                    Servicio Odontológico de Interés
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium rounded-xl">
                        <SelectValue placeholder="Seleccionar servicio de interés..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.servicios.map((s: any) => (
                        <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            {isEdit && (
              <FormField
                control={form.control}
                name="concreteRequest"
                render={({ field }) => (
                  <FormItem className="col-span-1 sm:col-span-2">
                    <FormLabel className="text-xs font-semibold text-teal-700 dark:text-teal-300">
                      Solicitud Concreta (Requerido para convertir a LEAD)
                    </FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Ej. Paciente solicita presupuesto y cita de evaluación para ortodoncia" 
                        className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-teal-200 dark:border-teal-800/60 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                        {...field} 
                      />
                    </FormControl>
                    <FormDescription className="text-[10px] text-slate-500 dark:text-slate-400">
                      Describe brevemente el pedido puntual del paciente para habilitar el paso a LEAD.
                    </FormDescription>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* 3. Gustos y Preferencias de Atención (Acordeón) */}
        <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
          <summary className="flex items-center justify-between p-3.5 sm:p-4 font-semibold cursor-pointer select-none bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60">
                <Compass className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  3. Gustos & Preferencias de Atención
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  Horarios, modalidad y sede preferida del paciente
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="pref_id_canal"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Canal de Comunicación Preferido
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar canal..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.canales.map((c: any) => (
                        <SelectItem key={c.id_canal} value={c.id_canal.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_id_horario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    Franja Horaria Preferida
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar franja..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="1" className="text-xs text-slate-900 dark:text-slate-100">Mañana (08:00 - 12:00)</SelectItem>
                      <SelectItem value="2" className="text-xs text-slate-900 dark:text-slate-100">Tarde (13:00 - 18:00)</SelectItem>
                      <SelectItem value="3" className="text-xs text-slate-900 dark:text-slate-100">Noche (18:00 - 21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_id_modalidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Modalidad de Atención
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar modalidad..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.modalidades && catalogs.modalidades.length > 0 ? (
                        catalogs.modalidades.map((m: any) => (
                          <SelectItem key={m.id_modalidad} value={m.id_modalidad.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                            {m.nombre}
                          </SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="1" className="text-xs text-slate-900 dark:text-slate-100">Presencial</SelectItem>
                          <SelectItem value="2" className="text-xs text-slate-900 dark:text-slate-100">Virtual</SelectItem>
                          <SelectItem value="3" className="text-xs text-slate-900 dark:text-slate-100">Teleconsulta</SelectItem>
                          <SelectItem value="4" className="text-xs text-slate-900 dark:text-slate-100">Domiciliaria</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_sede_preferida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    Sede Preferida
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar sede..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      {catalogs.sedes.map((s: any) => (
                        <SelectItem key={s.id_sede} value={s.nombre} className="text-xs text-slate-900 dark:text-slate-100">
                          {s.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_profesional_preferido"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Stethoscope className="h-3 w-3 text-slate-400" />
                    Especialista Preferido
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Esp. Fernando Torres" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:ring-teal-500 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </details>

        {/* 4. Perfil de Salud Odontológica (Acordeón) */}
        <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
          <summary className="flex items-center justify-between p-3.5 sm:p-4 font-semibold cursor-pointer select-none bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200/60 dark:border-rose-800/60">
                <HeartPulse className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  4. Perfil de Salud Odontológica
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  Antecedentes, sintomatología y nivel de dolor
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="ultima_visita_odontologica"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Última Visita Odontológica
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar período..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="Menos de 6 meses" className="text-xs text-slate-900 dark:text-slate-100">Menos de 6 meses</SelectItem>
                      <SelectItem value="6-12 meses" className="text-xs text-slate-900 dark:text-slate-100">6 a 12 meses</SelectItem>
                      <SelectItem value="Más de 1 año" className="text-xs text-slate-900 dark:text-slate-100">Más de 1 año</SelectItem>
                      <SelectItem value="Nunca" className="text-xs text-slate-900 dark:text-slate-100">Nunca</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nivel_dolor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-slate-400" />
                    Nivel de Dolor Actual
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar nivel..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="Ninguno" className="text-xs text-slate-900 dark:text-slate-100">Ninguno</SelectItem>
                      <SelectItem value="Leve" className="text-xs text-slate-900 dark:text-slate-100">Leve</SelectItem>
                      <SelectItem value="Moderado" className="text-xs text-slate-900 dark:text-slate-100">Moderado</SelectItem>
                      <SelectItem value="Intenso" className="text-xs text-rose-600 font-semibold dark:text-rose-400">Intenso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="presenta_sensibilidad"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ¿Presenta Sensibilidad?
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="Sí" className="text-xs text-slate-900 dark:text-slate-100">Sí</SelectItem>
                      <SelectItem value="No" className="text-xs text-slate-900 dark:text-slate-100">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sangrado_o_inflamacion"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Sangrado o Inflamación de Encías
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                      <SelectItem value="Ninguno" className="text-xs text-slate-900 dark:text-slate-100">Ninguno</SelectItem>
                      <SelectItem value="Sangrado" className="text-xs text-slate-900 dark:text-slate-100">Sangrado</SelectItem>
                      <SelectItem value="Inflamación" className="text-xs text-slate-900 dark:text-slate-100">Inflamación</SelectItem>
                      <SelectItem value="Ambos" className="text-xs text-slate-900 dark:text-slate-100">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="motivo_consulta_odonto"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Motivo General de Consulta
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Chequeo preventivo, molestia al masticar, diseño de sonrisa" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tratamiento_previo"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Tratamiento Previo Relevante
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Ortodoncia previa, endodoncia, prótesis" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="usa_aparato_o_protesis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Uso de Aparatos o Prótesis
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Férula nocturna, placa fija, ninguno" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="condicion_atencion_especial"
              render={({ field }) => (
                <FormItem className="col-span-1 sm:col-span-2">
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Condición Especial / Antecedentes Médicos
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej. Alergia a la penicilina, hipertensión, diabetes, fobia dental" 
                      className="h-9 text-xs bg-slate-50/50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </div>
        </details>

        {/* 5. Perfil Académico & Laboral (Acordeón) */}
        <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden shadow-sm">
          <summary className="flex items-center justify-between p-3.5 sm:p-4 font-semibold cursor-pointer select-none bg-slate-50/80 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                <GraduationCap className="h-4 w-4" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  5. Perfil Académico & Laboral
                </span>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-normal">
                  Datos de estudios, ocupación y disponibilidad horaria
                </p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" />
          </summary>
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 space-y-5">
            {/* Sub-bloque Estudiante */}
            <div className="space-y-3 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <FormField
                control={form.control}
                name="estudianteAplica"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2.5 space-y-0 cursor-pointer">
                    <FormControl>
                      <input 
                        type="checkbox" 
                        id="buyer-check-student"
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        checked={field.value} 
                        onChange={field.onChange} 
                      />
                    </FormControl>
                    <label htmlFor="buyer-check-student" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                      ¿El paciente es estudiante actualmente?
                    </label>
                  </FormItem>
                )}
              />

              {watchIsEstudiante && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <FormField
                    control={form.control}
                    name="universidad"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Universidad / Instituto</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. UNMSM, PUCP, UPC" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="carrera"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Carrera / Especialidad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Ing. de Sistemas" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="ciclo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Ciclo / Semestre</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. 8° Ciclo" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            {/* Sub-bloque Laboral */}
            <div className="space-y-3 p-3.5 rounded-xl border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40">
              <FormField
                control={form.control}
                name="laboralAplica"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2.5 space-y-0 cursor-pointer">
                    <FormControl>
                      <input 
                        type="checkbox" 
                        id="buyer-check-laboral"
                        className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                        checked={field.value} 
                        onChange={field.onChange} 
                      />
                    </FormControl>
                    <label htmlFor="buyer-check-laboral" className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-emerald-500" />
                      ¿El paciente labora actualmente?
                    </label>
                  </FormItem>
                )}
              />

              {watchIsLaboral && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <FormField
                    control={form.control}
                    name="ocupacion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Ocupación / Cargo</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Analista de Sistemas" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="empresa"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Empresa</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. BCP, Tech Corp" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="modalidadLaboral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Modalidad</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl">
                              <SelectValue placeholder="Seleccionar..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="Presencial" className="text-xs text-slate-900 dark:text-slate-100">Presencial</SelectItem>
                            <SelectItem value="Remoto" className="text-xs text-slate-900 dark:text-slate-100">Remoto</SelectItem>
                            <SelectItem value="Híbrido" className="text-xs text-slate-900 dark:text-slate-100">Híbrido</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="disponibilidadLaboral"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-semibold text-slate-700 dark:text-slate-300">Disponibilidad</FormLabel>
                        <FormControl>
                          <Input placeholder="Ej. Tardes a partir 17:00" className="h-8.5 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl" {...field} />
                        </FormControl>
                        <FormMessage className="text-[10px]" />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          </div>
        </details>

        {/* 6. Consentimiento de Contacto */}
        <Card className="border border-teal-200/70 dark:border-teal-900/60 bg-teal-50/30 dark:bg-teal-950/20 shadow-sm rounded-xl overflow-hidden">
          <CardContent className="p-4">
            <FormField
              control={form.control}
              name="contactAuthorization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between gap-3 space-y-0 cursor-pointer">
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-100/70 dark:bg-teal-900/50 text-teal-700 dark:text-teal-300 mt-0.5">
                      <ShieldCheck className="h-4.5 w-4.5" />
                    </div>
                    <div className="space-y-0.5">
                      <FormLabel className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                        Autorización de Contacto y Tratamiento de Datos
                      </FormLabel>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300">
                        El prospecto autoriza formalmente ser contactado por los canales seleccionados conforme a ley de protección de datos personales.
                      </p>
                    </div>
                  </div>
                  <FormControl>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 rounded border-teal-400 text-teal-600 focus:ring-teal-500 cursor-pointer shrink-0" 
                      checked={field.value} 
                      onChange={field.onChange} 
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {!hideSubmitButton && (
          <div className="flex justify-end gap-3 pt-2">
            <Button 
              type="submit" 
              disabled={isLoading} 
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold px-5 py-2 shadow-sm"
            >
              {isLoading ? 'Guardando...' : (isEdit ? 'Actualizar Ficha BUYER' : 'Registrar Prospecto (BUYER)')}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
});

BuyerForm.displayName = 'BuyerForm';
