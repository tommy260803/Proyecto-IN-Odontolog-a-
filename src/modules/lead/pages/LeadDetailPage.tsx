import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { useToast } from '@/shared/hooks/use-toast';
import { canTransitionLeadToPayer } from '@/domain/transitions';
import { LeadState } from '@/domain/enums';
import { 
  useLead, useAddAlternative, useSelectAlternative, useConvertLeadToPayer 
} from '../hooks/useLeadQueries';
import { AlternativeForm } from '../components/AlternativeForm';
import type { AlternativeFormValues } from '../schemas/leadSchema';
import { Check } from 'lucide-react';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney } from '@/domain/entities';

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });

  const { data: lead, isLoading, isError } = useLead(id!);
  const addAlt = useAddAlternative();
  const selectAlt = useSelectAlternative();
  const convertPayer = useConvertLeadToPayer();

  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !lead) return <ErrorState message="No se encontró el Lead." />;

  const handleAddAlternative = (data: AlternativeFormValues) => {
    addAlt.mutate({ id: lead.id, data }, {
      onSuccess: () => toast({ title: 'Éxito', description: 'Alternativa agregada.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleSelectAlternative = (altId: string) => {
    selectAlt.mutate({ leadId: lead.id, altId }, {
      onSuccess: () => toast({ title: 'Seleccionada', description: 'Reserva generada con éxito.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleConvert = () => {
    convertPayer.mutate(lead.id, {
      onSuccess: () => {
        toast({ title: 'Éxito', description: 'Solicitud de pago generada. Redirigiendo a Payer...' });
        navigate('/payer');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const transitionCheck = canTransitionLeadToPayer(lead);
  const canConvert = transitionCheck.success && lead.state !== LeadState.CONVERTED;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-4">
        <PageHeader 
          title="Espacio de Negociación" 
          description={`Lead ID: ${lead.id}`}
        />
        <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
          <StatusBadge 
            status={lead.state} 
            variant={lead.state === LeadState.CONVERTED ? 'success' : 'neutral'} 
          />
          <div className="flex flex-col items-end">
            <Button 
              disabled={!canConvert || convertPayer.isPending} 
              onClick={() => setIsConvertDialogOpen(true)}
              variant="secondary"
            >
              Generar solicitud de pago
            </Button>
            {!transitionCheck.success && lead.state !== LeadState.CONVERTED && (
              <span className="text-xs text-destructive mt-1 max-w-[250px] text-right">
                {transitionCheck.error}
              </span>
            )}
          </div>
        </div>
      </div>

      {journeys.find(j => j.leadId === lead.id) && (
        <JourneyStepper journey={journeys.find(j => j.leadId === lead.id)!} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Datos del Interesado (Origen)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-semibold">Persona:</span> {lead.person.firstName} {lead.person.lastName}</p>
            <p><span className="font-semibold">Documento:</span> {lead.person.documentType || 'DNI'} {lead.person.documentNumber || '-'}</p>
            <p><span className="font-semibold">Contacto:</span> {lead.person.phone} | {lead.person.email}</p>
            <p><span className="font-semibold">Canal / Fuente:</span> {lead.buyer.channel} / {lead.buyer.attractionSource}</p>
            <p><span className="font-semibold">Autorización contacto:</span> {lead.buyer.contactAuthorization ? 'Sí' : 'No'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detalles Clínicos y Preferencias</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="font-semibold">Servicio solicitado:</span> {lead.requestedServiceId}</p>
            <p><span className="font-semibold">Solicitud Concreta:</span> {lead.buyer.concreteRequest || '-'}</p>
            <p><span className="font-semibold">Preferencia Inicial:</span> {lead.buyer.preferences || '-'}</p>
            <p><span className="font-semibold">Derivación Clínica:</span> {lead.clinicalDerivationNeeded ? 'Sí' : 'No'}</p>
            <p><span className="font-semibold">Observación Clínica:</span> {lead.clinicalObservation || '-'}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Registrar Alternativa</CardTitle>
        </CardHeader>
        <CardContent>
          <AlternativeForm onSubmit={handleAddAlternative} isLoading={addAlt.isPending} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Alternativas Propuestas</CardTitle>
        </CardHeader>
        <CardContent>
          {(!lead.alternatives || lead.alternatives.length === 0) ? (
            <div className="text-center p-6 text-muted-foreground border rounded-lg border-dashed">
              Aún no se han propuesto alternativas.
            </div>
          ) : (
            <div className="grid gap-4">
              {lead.alternatives.map((alt: any) => {
                const isSelected = lead.selectedAlternativeId === alt.id;
                return (
                  <div key={alt.id} className={`p-4 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 ${isSelected ? 'border-primary bg-primary/5' : ''}`}>
                    <div className="text-sm space-y-1 flex-1">
                      <p><span className="font-semibold text-primary">{alt.service}</span> con {alt.professional}</p>
                      <p className="text-muted-foreground">{alt.date} a las {alt.time} en sede {alt.branch}</p>
                      <p className="font-medium text-foreground">S/ {alt.price.toFixed(2)}</p>
                      {(alt.conditions || alt.observations) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          {alt.conditions && <span>Condiciones: {alt.conditions}. </span>}
                          {alt.observations && <span>Observaciones: {alt.observations}</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      {isSelected ? (
                        <div className="flex items-center text-primary font-medium text-sm">
                          <Check className="w-4 h-4 mr-1" />
                          Seleccionada
                        </div>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm"
                          disabled={!!lead.selectedAlternativeId || selectAlt.isPending}
                          onClick={() => handleSelectAlternative(alt.id)}
                        >
                          Elegir y Reservar
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ConfirmationDialog
        isOpen={isConvertDialogOpen}
        onClose={() => setIsConvertDialogOpen(false)}
        onConfirm={handleConvert}
        title="Generar Solicitud de Pago"
        description="Se creará el PAYER pendiente y se le asignará el monto a cobrar por la alternativa elegida. ¿Continuar?"
        confirmText="Sí, generar pago"
      />
    </div>
  );
}
