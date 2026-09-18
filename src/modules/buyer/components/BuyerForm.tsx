import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { buyerSchema } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Card, CardContent } from '@/shared/components/ui/card';
import { buyerService } from '../services/buyer.service';
import { ChevronDown } from 'lucide-react';

interface BuyerFormProps {
  initialValues?: Partial<BuyerFormValues>;
  onSubmit: (data: BuyerFormValues) => void;
  isLoading: boolean;
  isEdit?: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
}

export function BuyerForm({ initialValues, onSubmit, isLoading, isEdit, formId = 'buyer-form', hideSubmitButton = false }: BuyerFormProps) {
  const [catalogs, setCatalogs] = useState<any>({ canales: [], fuentes: [], servicios: [], sedes: [] });

  useEffect(() => {
    buyerService.getCatalogs().then(setCatalogs).catch(console.error);
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
      contactAuthorization: initialValues?.contactAuthorization || false,
    },
  });

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombres</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Apellidos</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo Documento</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="DNI">DNI</SelectItem>
                      <SelectItem value="CE">CE</SelectItem>
                      <SelectItem value="PASAPORTE">Pasaporte</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="documentNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nº Documento</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      maxLength={form.watch('documentType') === 'DNI' ? 8 : undefined}
                      onChange={(e) => {
                        // Si es DNI, forzar a que solo se puedan ingresar números en tiempo real si se desea, 
                        // pero al menos limitamos la longitud
                        if (form.watch('documentType') === 'DNI') {
                          e.target.value = e.target.value.replace(/[^0-9]/g, '').slice(0, 8);
                        }
                        field.onChange(e);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl><Input type="tel" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Correo electrónico</FormLabel>
                  <FormControl><Input type="email" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Canal de contacto</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar canal" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.canales.length > 0 ? (
                        catalogs.canales.map((c: any) => (
                          <SelectItem key={c.id_canal} value={c.id_canal.toString()}>{c.nombre}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                          <SelectItem value="Facebook">Facebook</SelectItem>
                          <SelectItem value="Instagram">Instagram</SelectItem>
                          <SelectItem value="Web">Web</SelectItem>
                          <SelectItem value="Presencial">Presencial</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="attractionSource"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fuente de atracción</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar fuente" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.fuentes.length > 0 ? (
                        catalogs.fuentes.map((f: any) => (
                          <SelectItem key={f.id_fuente} value={f.id_fuente.toString()}>{f.nombre}</SelectItem>
                        ))
                      ) : (
                        <>
                          <SelectItem value="Google">Google Ads</SelectItem>
                          <SelectItem value="FacebookAds">Facebook Ads</SelectItem>
                          <SelectItem value="Recomendacion">Recomendación</SelectItem>
                          <SelectItem value="Organico">Orgánico</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="serviceOfInterestId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Servicio de interés</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Seleccionar servicio" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {catalogs.servicios.map((s: any) => (
                        <SelectItem key={s.id_servicio} value={s.id_servicio.toString()}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isEdit && (
              <FormField
                control={form.control}
                name="concreteRequest"
                render={({ field }) => (
                  <FormItem className="col-span-1 md:col-span-2">
                    <FormLabel>Solicitud concreta (Requerido para convertir a LEAD)</FormLabel>
                    <FormControl><Input {...field} placeholder="Ej. Solicita cita para limpieza dental el sábado" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </CardContent>
        </Card>

        {/* Acordeones de Información Opcional Extendida */}
        <div className="space-y-4">
          
          <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between p-4 font-semibold cursor-pointer select-none bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="text-slate-900 dark:text-slate-100">Gustos y Preferencias</span>
              <ChevronDown className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pref_id_canal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Canal Preferido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {catalogs.canales.map((c: any) => (
                          <SelectItem key={c.id_canal} value={c.id_canal.toString()}>{c.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pref_id_horario"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Horario Preferido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="1">Mañana (08:00 - 12:00)</SelectItem>
                        <SelectItem value="2">Tarde (13:00 - 18:00)</SelectItem>
                        <SelectItem value="3">Noche (18:00 - 21:00)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pref_id_modalidad"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modalidad Preferida</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="1">Presencial</SelectItem>
                        <SelectItem value="3">Teleconsulta</SelectItem>
                        <SelectItem value="4">Domiciliaria</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="pref_sede_preferida" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sede Preferida</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {catalogs.sedes.map((s: any) => (
                        <SelectItem key={s.id_sede} value={s.nombre}>{s.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="pref_profesional_preferido" render={({ field }) => (
                <FormItem className="col-span-1 md:col-span-2">
                  <FormLabel>Profesional Preferido</FormLabel>
                  <FormControl><Input {...field} placeholder="Ej. Dr. Martínez" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
          </details>

          <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between p-4 font-semibold cursor-pointer select-none bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="text-slate-900 dark:text-slate-100">Datos de Estudiante</span>
              <ChevronDown className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="estudianteAplica"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 col-span-1 md:col-span-2">
                    <FormControl>
                      <input type="checkbox" className="w-4 h-4" checked={field.value} onChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>¿Es estudiante?</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="universidad" render={({ field }) => (
                <FormItem><FormLabel>Universidad/Institución</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="carrera" render={({ field }) => (
                <FormItem><FormLabel>Carrera</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="ciclo" render={({ field }) => (
                <FormItem><FormLabel>Ciclo/Año</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </details>

          <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between p-4 font-semibold cursor-pointer select-none bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="text-slate-900 dark:text-slate-100">Datos Laborales</span>
              <ChevronDown className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="laboralAplica"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-4 col-span-1 md:col-span-2">
                    <FormControl>
                      <input type="checkbox" className="w-4 h-4" checked={field.value} onChange={field.onChange} />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel>¿Trabaja actualmente?</FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField control={form.control} name="ocupacion" render={({ field }) => (
                <FormItem><FormLabel>Ocupación</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="empresa" render={({ field }) => (
                <FormItem><FormLabel>Empresa</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="modalidadLaboral" render={({ field }) => (
                <FormItem>
                  <FormLabel>Modalidad</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Presencial">Presencial</SelectItem>
                      <SelectItem value="Remoto">Remoto</SelectItem>
                      <SelectItem value="Híbrido">Híbrido</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="disponibilidadLaboral" render={({ field }) => (
                <FormItem><FormLabel>Disponibilidad</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </details>

          <details className="group border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 overflow-hidden [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex items-center justify-between p-4 font-semibold cursor-pointer select-none bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <span className="text-slate-900 dark:text-slate-100">Perfil de Salud Odontológica</span>
              <ChevronDown className="w-5 h-5 text-slate-500 transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4 border-t border-slate-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField control={form.control} name="ultima_visita_odontologica" render={({ field }) => (
                <FormItem>
                  <FormLabel>Última visita al odontólogo</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Menos de 6 meses">Menos de 6 meses</SelectItem>
                      <SelectItem value="6-12 meses">6 a 12 meses</SelectItem>
                      <SelectItem value="Más de 1 año">Más de 1 año</SelectItem>
                      <SelectItem value="Nunca">Nunca</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="motivo_consulta_odonto" render={({ field }) => (
                <FormItem><FormLabel>Motivo general</FormLabel><FormControl><Input {...field} placeholder="Prevención, dolor, estética..." /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="tratamiento_previo" render={({ field }) => (
                <FormItem><FormLabel>Tratamiento previo</FormLabel><FormControl><Input {...field} placeholder="Ortodoncia, extracción..." /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nivel_dolor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nivel de dolor actual</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno</SelectItem>
                      <SelectItem value="Leve">Leve</SelectItem>
                      <SelectItem value="Moderado">Moderado</SelectItem>
                      <SelectItem value="Intenso">Intenso</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="presenta_sensibilidad" render={({ field }) => (
                <FormItem>
                  <FormLabel>¿Presenta sensibilidad?</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Sí">Sí</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="sangrado_o_inflamacion" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sangrado / Inflamación</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="Ninguno">Ninguno</SelectItem>
                      <SelectItem value="Sangrado">Sangrado</SelectItem>
                      <SelectItem value="Inflamación">Inflamación</SelectItem>
                      <SelectItem value="Ambos">Ambos</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="usa_aparato_o_protesis" render={({ field }) => (
                <FormItem><FormLabel>Aparato o Prótesis</FormLabel><FormControl><Input {...field} placeholder="Ortodoncia, prótesis, ninguno" /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="condicion_atencion_especial" render={({ field }) => (
                <FormItem><FormLabel>Condición especial</FormLabel><FormControl><Input {...field} placeholder="Diabetes, embarazo, ansiedad..." /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
          </details>

        </div>

        <Card>
          <CardContent className="pt-6">
            <FormField
              control={form.control}
              name="contactAuthorization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Autorización de contacto</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      El paciente autoriza ser contactado para recibir información.
                    </div>
                  </div>
                  <FormControl>
                    <input 
                      type="checkbox" 
                      className="w-5 h-5 accent-primary" 
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
          <div className="flex justify-end gap-4">
            <Button type="submit" disabled={isLoading} className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl">
              {isLoading ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Guardar')}
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
