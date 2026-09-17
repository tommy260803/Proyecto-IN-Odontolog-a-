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

interface BuyerFormProps {
  initialValues?: Partial<BuyerFormValues>;
  onSubmit: (data: BuyerFormValues) => void;
  isLoading: boolean;
  isEdit?: boolean;
}

export function BuyerForm({ initialValues, onSubmit, isLoading, isEdit }: BuyerFormProps) {
  const [catalogs, setCatalogs] = useState<any>({ canales: [], fuentes: [], servicios: [], sedes: [] });

  useEffect(() => {
    buyerService.getCatalogs().then(setCatalogs).catch(console.error);
  }, []);

  const form = useForm<BuyerFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(buyerSchema) as any,
    defaultValues: {
      firstName: initialValues?.firstName || '',
      lastName: initialValues?.lastName || '',
      documentType: initialValues?.documentType || 'DNI',
      documentNumber: initialValues?.documentNumber || '',
      email: initialValues?.email || '',
      phone: initialValues?.phone || '',
      channel: initialValues?.channel || '',
      attractionSource: initialValues?.attractionSource || '',
      serviceOfInterestId: initialValues?.serviceOfInterestId || '',
      preferences: initialValues?.preferences || '',
      concreteRequest: initialValues?.concreteRequest || '',
      contactAuthorization: initialValues?.contactAuthorization || false,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <FormControl><Input {...field} /></FormControl>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            <FormField
              control={form.control}
              name="preferences"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferencias</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="contactAuthorization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4 col-span-1 md:col-span-2">
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

        <div className="flex justify-end gap-4">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : (isEdit ? 'Actualizar' : 'Guardar')}
          </Button>
        </div>
      </form>
    </Form>
  );
}
