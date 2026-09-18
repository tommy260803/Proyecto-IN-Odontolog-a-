import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { BuyerForm } from './BuyerForm';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { canTransitionBuyerToLead } from '@/domain/transitions';
import { BuyerState } from '@/domain/enums';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { UserCheck, ArrowRight } from 'lucide-react';

interface BuyerDetailModalProps {
  buyerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BuyerDetailModal({ buyerId, isOpen, onClose }: BuyerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: buyer, isLoading, isError } = useBuyer(buyerId || '');
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();

  const journeys: any[] = [];

  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  const handleSubmit = (data: BuyerFormValues) => {
    if (!buyerId) return;
    updateBuyer.mutate({
      id: buyerId,
      data: {
        channel: data.channel,
        attractionSource: data.attractionSource,
        serviceOfInterestId: data.serviceOfInterestId,
        preferences: data.preferences,
        contactAuthorization: data.contactAuthorization,
        concreteRequest: data.concreteRequest,
        person: {
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          phone: data.phone,
          email: data.email,
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: 'Datos del BUYER actualizados correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleConvert = () => {
    if (!buyerId) return;
    convertBuyer.mutate(buyerId, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'El Buyer ha sido transferido a LEAD exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setIsConvertDialogOpen(false);
        onClose();
      },
      onError: (err) => {
        toast({ title: 'No se pudo convertir', description: err.message, variant: 'destructive' });
      }
    });
  };

  if (!isOpen || !buyerId) return null;

  const transitionCheck = buyer ? canTransitionBuyerToLead(buyer) : { success: false, error: '' };
  const canConvert = buyer && transitionCheck.success && buyer.state !== BuyerState.CONVERTED;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Detalle del BUYER
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {buyer?.id}
                  </p>
                </div>
              </div>

              {buyer && (
                <div className="flex items-center gap-2">
                  <StatusBadge 
                    status={buyer.state} 
                    variant={buyer.state === BuyerState.CONVERTED ? 'success' : 'neutral'} 
                  />
                  <Button 
                    disabled={!canConvert || convertBuyer.isPending} 
                    onClick={() => setIsConvertDialogOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-3.5 py-2 h-8.5"
                  >
                    Convertir a LEAD <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
          {isLoading ? (
            <LoadingState />
          ) : isError || !buyer ? (
            <ErrorState message="No se pudo cargar la información del Buyer." />
          ) : (
            <div className="space-y-6">
              {!transitionCheck.success && buyer.state !== BuyerState.CONVERTED && (
                <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/80">
                  <strong>Requisito para convertir a LEAD:</strong> {transitionCheck.error}
                </div>
              )}

              {journeys.find(j => j.buyerId === buyer.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.buyerId === buyer.id)!} />
                </div>
              )}

              <BuyerForm 
                isEdit 
                formId="buyer-edit-form"
                hideSubmitButton
                initialValues={{
                  firstName: buyer.person.firstName,
                  lastName: buyer.person.lastName,
                  documentType: buyer.person.documentType,
                  documentNumber: buyer.person.documentNumber,
                  email: buyer.person.email,
                  phone: buyer.person.phone,
                  channel: buyer.channel,
                  attractionSource: buyer.attractionSource,
                  serviceOfInterestId: buyer.serviceOfInterestId,
                  preferences: buyer.preferences,
                  contactAuthorization: buyer.contactAuthorization,
                  concreteRequest: buyer.concreteRequest,
                }} 
                onSubmit={handleSubmit} 
                isLoading={updateBuyer.isPending} 
              />
            </div>
          )}
        </div>

        {/* Footer Fijo */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-end gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2"
          >
            Cerrar
          </Button>
          <Button
            type="submit"
            form="buyer-edit-form"
            disabled={updateBuyer.isPending || !buyer}
            className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold px-5 py-2 shadow-sm"
          >
            {updateBuyer.isPending ? 'Actualizando...' : 'Actualizar BUYER'}
          </Button>
        </div>

        {/* Confirmación para conversión */}
        <ConfirmationDialog
          isOpen={isConvertDialogOpen}
          onClose={() => setIsConvertDialogOpen(false)}
          onConfirm={handleConvert}
          title="¿Convertir a LEAD?"
          description="Esta acción cambiará el estado del Buyer y creará un nuevo registro en el módulo LEAD para abrir la mesa de negociación."
          confirmText="Sí, Convertir a LEAD"
          variant="default"
        />
      </DialogContent>
    </Dialog>
  );
}

