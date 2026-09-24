import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { buyerSchema } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/shared/components/ui/form';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { buyerService } from '../services/buyer.service';
import { useToast } from '@/shared/hooks/use-toast';
import { 
  User, 
  Mail, 
  Phone, 
  Clock, 
  MapPin, 
  Stethoscope, 
  ShieldCheck, 
  FileText,
  Radio,
  Tag
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
    horarios?: any[];
  }>({ canales: [], fuentes: [], servicios: [], sedes: [], horarios: [] });

  useEffect(() => {
    buyerService.getCatalogs()
      .then((data) => {
        setCatalogs(data);
      })
      .catch((err) => console.error('Error loading buyer catalogs:', err));
  }, []);

  const form = useForm<BuyerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(buyerSchema) as any,
    mode: 'onChange',
    defaultValues: {
      firstName: initialValues?.firstName || '',
      lastName: initialValues?.lastName || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      channel: initialValues?.channel || '1',
      attractionSource: initialValues?.attractionSource || '1',
      serviceOfInterestId: initialValues?.serviceOfInterestId || '',
      pref_sede_preferida: initialValues?.pref_sede_preferida || '',
      pref_id_horario: initialValues?.pref_id_horario || '',
      concreteRequest: initialValues?.concreteRequest || 'Consultar precio y disponibilidad',
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
            title: 'Campos requeridos incompletos',
            description: firstErrorMsg || 'Por favor completa todos los campos obligatorios.',
            variant: 'destructive',
          });
        }
      )();
    }
  }));

  const handleFormSubmit = (data: BuyerFormValues) => {
    onSubmit(data);
  };

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-6">
        
        {/* Bloque 1: Identificación y Contacto */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Identificación y Contacto</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Datos esenciales para el primer contacto comercial y respuesta rápida.</p>
            </div>
          </div>

          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    Nombres <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Lucía" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
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
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    Apellidos <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Mendoza Rojas" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
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
                    <Phone className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                    Teléfono / WhatsApp <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="tel"
                      placeholder="987654321" 
                      maxLength={9}
                      className="rounded-lg h-9.5 text-xs font-mono bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription className="text-[10px] text-slate-400">9 dígitos exactos (Perú)</FormDescription>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5 text-slate-400 inline" /> Correo Electrónico
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="lucia.mendoza@ejemplo.com" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Bloque 2: Interés Clínico y Preferencias */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <Stethoscope className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Interés Odontológico y Preferencias</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Servicio solicitado, motivo y condiciones preferidas de atención.</p>
            </div>
          </div>

          <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="serviceOfInterestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    Servicio de Interés <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Selecciona el servicio inicial" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.servicios.map((s) => (
                        <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs">
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
              name="pref_sede_preferida"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                    Sede de Interés <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Selecciona la sede" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.sedes && catalogs.sedes.length > 0 ? (
                        catalogs.sedes.map((sede) => (
                          <SelectItem key={sede.id_sede || sede.nombre} value={sede.nombre} className="text-xs">
                            {sede.nombre} {sede.direccion ? `(${sede.direccion})` : ''}
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
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pref_id_horario"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-slate-400 inline" /> Franja Horaria Preferida
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                  </FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <FormControl>
                      <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Cualquier horario / Sin preferencia" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="1" className="text-xs">🌅 Mañana (08:00 - 13:00)</SelectItem>
                      <SelectItem value="2" className="text-xs">☀️ Tarde (13:00 - 18:00)</SelectItem>
                      <SelectItem value="3" className="text-xs">🌙 Noche (18:00 - 21:00)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="concreteRequest"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                    Motivo de Consulta / Necesidad <span className="text-rose-500 font-bold">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Ej: Consultar precio y disponibilidad de cita" 
                      className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 focus:bg-white dark:focus:bg-slate-900" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage className="text-[11px]" />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Bloque 3: Trazabilidad & Consentimiento Legal */}
        <Card className="border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-b border-slate-200/80 dark:border-slate-800 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-teal-50 dark:bg-teal-950/60 text-teal-600 dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trazabilidad Comercial y Consentimiento</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">Atribución de captación y consentimiento regulatorio.</p>
            </div>
          </div>

          <CardContent className="p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="channel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Radio className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                      Canal de Origen
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                          <SelectValue placeholder="Selecciona el canal" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {catalogs.canales.map((c) => (
                          <SelectItem key={c.id_canal} value={c.id_canal.toString()} className="text-xs">
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
                name="attractionSource"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 inline" />
                      Fuente de Atracción
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-lg h-9.5 text-xs bg-slate-50/40 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800">
                          <SelectValue placeholder="Selecciona la fuente" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {catalogs.fuentes.map((f) => (
                          <SelectItem key={f.id_fuente} value={f.id_fuente.toString()} className="text-xs">
                            {f.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage className="text-[11px]" />
                  </FormItem>
                )}
              />
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <FormField
                control={form.control}
                name="contactAuthorization"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-xl border border-teal-200/60 dark:border-teal-800/60 bg-teal-50/40 dark:bg-teal-950/20 p-3.5">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="mt-0.5 border-teal-500 text-teal-600 data-[state=checked]:bg-teal-600 data-[state=checked]:text-white"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-xs font-bold text-slate-900 dark:text-white cursor-pointer">
                        Autorización de Contacto y Tratamiento de Datos <span className="text-rose-500">*</span>
                      </FormLabel>
                      <FormDescription className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        El prospecto autoriza expresamente el envío de presupuestos, recordatorios y ofertas comerciales por WhatsApp y Correo (Ley N° 29733).
                      </FormDescription>
                      <FormMessage className="text-[11px] text-rose-500" />
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        {!hideSubmitButton && (
          <div className="flex justify-end pt-2">
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold px-6 py-2.5 shadow-sm"
            >
              {isLoading ? 'Registrando...' : 'Registrar Prospecto (BUYER)'}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
});

BuyerForm.displayName = 'BuyerForm';
