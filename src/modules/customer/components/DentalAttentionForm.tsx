import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { dentalAttentionSchema } from '../schemas/customerSchema';
import { Button } from '@/shared/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form';
import { Input } from '@/shared/components/ui/input';

interface DentalAttentionFormProps {
  initialValues?: Partial<DentalAttentionFormValues>;
  onSubmit: (data: DentalAttentionFormValues) => void;
  isLoading: boolean;
  disabled?: boolean;
  formId?: string;
  hideSubmitButton?: boolean;
}

export function DentalAttentionForm({ initialValues, onSubmit, isLoading, disabled, formId, hideSubmitButton }: DentalAttentionFormProps) {
  const form = useForm<DentalAttentionFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(dentalAttentionSchema) as any,
    defaultValues: {
      reasonForConsultation: initialValues?.reasonForConsultation || '',
      relevantBackground: initialValues?.relevantBackground || '',
      allergies: initialValues?.allergies || '',
      evaluation: initialValues?.evaluation || '',
      procedure: initialValues?.procedure || '',
      instructions: initialValues?.instructions || '',
      observations: initialValues?.observations || '',
    },
  });

  useEffect(() => {
    if (initialValues) {
      form.reset({
        reasonForConsultation: initialValues.reasonForConsultation || '',
        relevantBackground: initialValues.relevantBackground || '',
        allergies: initialValues.allergies || '',
        evaluation: initialValues.evaluation || '',
        procedure: initialValues.procedure || '',
        instructions: initialValues.instructions || '',
        observations: initialValues.observations || '',
      });
    }
  }, [initialValues, form]);

  return (
    <Form {...form}>
      <form id={formId} onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="reasonForConsultation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Motivo de Consulta</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="relevantBackground"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Antecedentes Relevantes</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="allergies"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Alergias</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="evaluation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Evaluación Básico / Diagnóstico</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="procedure"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Procedimiento Realizado</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instructions"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Indicaciones</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="observations"
            render={({ field }) => (
              <FormItem className="md:col-span-2">
                <FormLabel>Observaciones</FormLabel>
                <FormControl><Input {...field} disabled={disabled} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        {!disabled && !hideSubmitButton && (
          <div className="flex justify-end pt-2">
            <Button type="submit" disabled={isLoading}>
              Guardar Registros
            </Button>
          </div>
        )}
      </form>
    </Form>
  );
}
