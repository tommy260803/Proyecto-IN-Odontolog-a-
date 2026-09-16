import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { NewRequestFormValues } from '../schemas/turnedSchema';
import { newRequestSchema } from '../schemas/turnedSchema';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';

interface NewRequestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: NewRequestFormValues) => void;
  isLoading: boolean;
}

export function NewRequestDialog({ isOpen, onClose, onSubmit, isLoading }: NewRequestDialogProps) {
  const form = useForm<NewRequestFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(newRequestSchema) as any,
    defaultValues: { serviceOfInterestId: '', channel: 'Teléfono', contactAuthorization: true, concreteRequest: '' },
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar Nueva Solicitud (Reactivación)</DialogTitle>
          <DialogDescription>
            Esto creará un nuevo recorrido (BUYER) para el paciente conservando su historial previo intacto.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
            <FormField
              control={form.control}
              name="serviceOfInterestId"
              render={({ field }) => (
                <FormItem><FormLabel>Nuevo Servicio de Interés</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="channel"
              render={({ field }) => (
                <FormItem><FormLabel>Canal de Contacto</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="concreteRequest"
              render={({ field }) => (
                <FormItem><FormLabel>Observación / Motivo</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contactAuthorization"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                  <FormControl>
                    <input type="checkbox" checked={field.value} onChange={field.onChange} className="w-4 h-4 mt-1" />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Autoriza contacto posterior</FormLabel>
                  </div>
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={isLoading}>Crear Reactivación</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
