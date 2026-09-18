import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BuyerForm } from '../components/BuyerForm';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { useState } from 'react';
import { canTransitionBuyerToLead } from '@/domain/transitions';
import { BuyerState } from '@/domain/enums';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';

export default function BuyerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { data: buyer, isLoading, isError } = useBuyer(id!);
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();

  const journeys: any[] = [];

  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !buyer) return <ErrorState message="No se encontró el Buyer." />;

  const handleSubmit = (data: BuyerFormValues) => {
    updateBuyer.mutate({
      id: id!,
      data: {
        channel: data.channel,
        attractionSource: data.attractionSource,
        serviceOfInterestId: data.serviceOfInterestId,
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
        toast({ title: '¡Éxito!', description: 'Datos actualizados correctamente.' });
      },
      onError: (err) => {
        toast({ title: 'Error', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleConvert = () => {
    convertBuyer.mutate(id!, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'El Buyer ha sido convertido a Lead.' });
        navigate(`/lead`);
      },
      onError: (err) => {
        toast({ title: 'No se pudo convertir', description: err.message, variant: 'destructive' });
      }
    });
  };

  const transitionCheck = canTransitionBuyerToLead(buyer);
  const canConvert = transitionCheck.success && buyer.state !== BuyerState.CONVERTED;

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
        <PageHeader 
          title="Detalle del BUYER" 
          description={`ID: ${buyer.id}`}
        />
        <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
          <StatusBadge 
            status={buyer.state} 
            variant={buyer.state === BuyerState.CONVERTED ? 'success' : 'neutral'} 
          />
          <div className="flex flex-col items-end">
            <Button 
              disabled={!canConvert || convertBuyer.isPending} 
              onClick={() => setIsConvertDialogOpen(true)}
              variant="secondary"
            >
              Convertir a LEAD
            </Button>
            {!transitionCheck.success && buyer.state !== BuyerState.CONVERTED && (
              <span className="text-xs text-destructive mt-1 max-w-[250px] text-right">
                {transitionCheck.error}
              </span>
            )}
          </div>
        </div>
      </div>

      {journeys.find(j => j.buyerId === buyer.id) && (
        <JourneyStepper journey={journeys.find(j => j.buyerId === buyer.id)!} />
      )}

      <BuyerForm 
        isEdit 
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
          contactAuthorization: buyer.contactAuthorization,
          concreteRequest: buyer.concreteRequest,
        }} 
        onSubmit={handleSubmit} 
        isLoading={updateBuyer.isPending} 
      />

      <ConfirmationDialog
        isOpen={isConvertDialogOpen}
        onClose={() => setIsConvertDialogOpen(false)}
        onConfirm={handleConvert}
        title="¿Convertir a LEAD?"
        description="Esta acción cambiará el estado del Buyer y creará un nuevo registro en el módulo LEAD. ¿Deseas continuar?"
        confirmText="Sí, convertir"
      />
    </div>
  );
}
