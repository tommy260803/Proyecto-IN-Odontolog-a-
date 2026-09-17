import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { BuyerForm } from './BuyerForm';
import { useCreateBuyer } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { Button } from '@/shared/components/ui/button';
import { UserPlus } from 'lucide-react';

interface BuyerCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BuyerCreateModal({ isOpen, onClose }: BuyerCreateModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBuyer = useCreateBuyer();

  const handleSubmit = (data: BuyerFormValues) => {
    createBuyer.mutate(data, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: 'Buyer registrado correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        onClose();
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      },
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Registrar Nuevo BUYER
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Ingresa los datos de contacto y requerimiento del nuevo interesado.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
          <BuyerForm 
            formId="buyer-create-form" 
            hideSubmitButton 
            onSubmit={handleSubmit} 
            isLoading={createBuyer.isPending} 
          />
        </div>

        {/* Footer Fijo con Botones */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={createBuyer.isPending}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="buyer-create-form"
            disabled={createBuyer.isPending}
            className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold px-5 py-2 shadow-sm"
          >
            {createBuyer.isPending ? 'Registrando...' : 'Registrar BUYER'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

