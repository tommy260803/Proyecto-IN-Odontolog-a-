import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';
import { CustomerState } from '@/domain/enums';
import { canTransitionCustomerToTurned } from '@/domain/transitions';
import { 
  useCustomer, 
  useChangeCustomerState, 
  useStartAttention, 
  useFinishAttention, 
  useRegisterAttentionDetails,
  useRegisterCustomerIncident,
  useConvertCustomerToTurned
} from '../hooks/useCustomerQueries';
import { DentalAttentionForm } from '../components/DentalAttentionForm';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { Play, CheckSquare, XCircle, UserX, ArrowRight, AlertTriangle } from 'lucide-react';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney } from '@/domain/entities';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });

  const { data: customer, isLoading, isError } = useCustomer(id!);
  const changeState = useChangeCustomerState();
  const startAttention = useStartAttention();
  const finishAttention = useFinishAttention();
  const registerDetails = useRegisterAttentionDetails();
  const registerIncident = useRegisterCustomerIncident();
  const convertTurned = useConvertCustomerToTurned();

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);

  if (isLoading) return <LoadingState />;
  if (isError || !customer) return <ErrorState message="No se encontró el paciente (Customer)." />;

  const handleStateChange = (state: CustomerState, successMsg: string) => {
    changeState.mutate({ id: customer.id, state }, {
      onSuccess: () => toast({ title: 'Actualizado', description: successMsg }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleStartAttention = () => {
    const time = new Date().toLocaleTimeString();
    startAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => toast({ title: 'Iniciada', description: 'Atención odontológica iniciada.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleFinishAttention = () => {
    const time = new Date().toLocaleTimeString();
    finishAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => toast({ title: 'Finalizada', description: 'Atención odontológica terminada.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleSaveAttentionDetails = (data: DentalAttentionFormValues) => {
    registerDetails.mutate({ id: customer.id, data }, {
      onSuccess: () => toast({ title: 'Guardado', description: 'Registros clínicos actualizados.' }),
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleRegisterIncident = () => {
    if (incidentReason.length < 10) return;
    registerIncident.mutate({ id: customer.id, reason: incidentReason }, {
      onSuccess: () => {
        toast({ title: 'Incidencia Registrada', description: 'Se guardó el reporte de soporte.' });
        setIsIncidentOpen(false);
        setIncidentReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleConvert = () => {
    convertTurned.mutate(customer.id, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'Paciente transferido a TURNED.' });
        navigate('/turned');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const transitionCheck = canTransitionCustomerToTurned(customer, customer.attention);
  const isAttentionDisabled = customer.state !== CustomerState.IN_ATTENTION;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-2">
        <PageHeader title="Atención del Paciente" description={`Customer ID: ${customer.id}`} />
        <div className="flex flex-col items-end gap-2 mt-4 md:mt-0">
          <div className="flex items-center gap-4">
            <StatusBadge status={customer.state} />
            <Button 
              disabled={!transitionCheck.success || convertTurned.isPending} 
              onClick={() => setIsConvertOpen(true)}
              className="gap-2"
            >
              Pasar a TURNED <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
          {!transitionCheck.success && customer.state === CustomerState.ATTENDED && (
            <span className="text-xs text-destructive text-right">
              Faltan datos clínicos o tiempos (inicio/fin)
            </span>
          )}
        </div>
      </div>

      {journeys.find(j => j.customerId === customer.id) && (
        <JourneyStepper journey={journeys.find(j => j.customerId === customer.id)!} />
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Registro de Atención Odontológica</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6 p-4 bg-muted rounded-lg border">
              <Button 
                variant="outline" size="sm" 
                disabled={customer.state !== CustomerState.SCHEDULED}
                onClick={() => handleStateChange(CustomerState.ATTENDANCE_CONFIRMED, 'Asistencia confirmada')}
              >
                <CheckSquare className="w-4 h-4 mr-2 text-green-600" /> Confirmar Asistencia
              </Button>
              <Button 
                variant="outline" size="sm"
                disabled={customer.state !== CustomerState.ATTENDANCE_CONFIRMED}
                onClick={handleStartAttention}
              >
                <Play className="w-4 h-4 mr-2 text-blue-600" /> Iniciar Atención
              </Button>
              <Button 
                variant="outline" size="sm"
                disabled={customer.state !== CustomerState.IN_ATTENTION}
                onClick={handleFinishAttention}
              >
                <CheckSquare className="w-4 h-4 mr-2" /> Finalizar Atención
              </Button>
              <div className="w-full h-0 md:hidden" />
              <Button 
                variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                disabled={customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                onClick={() => handleStateChange(CustomerState.NO_SHOW, 'Marcado como No Asistió')}
              >
                <UserX className="w-4 h-4 mr-2" /> No Asistió
              </Button>
              <Button 
                variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10"
                disabled={customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                onClick={() => handleStateChange(CustomerState.CANCELED, 'Cita cancelada')}
              >
                <XCircle className="w-4 h-4 mr-2" /> Cancelar
              </Button>
            </div>

            <DentalAttentionForm 
              initialValues={customer.attention} 
              onSubmit={handleSaveAttentionDetails}
              isLoading={registerDetails.isPending}
              disabled={isAttentionDisabled && customer.state !== CustomerState.ATTENDED}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Datos de la Cita</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="font-semibold text-muted-foreground">Paciente</p>
                <p>{customer.person.firstName} {customer.person.lastName}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Servicio y Profesional</p>
                <p>{customer.lead.requestedServiceId}</p>
                <p>{customer.reservation.professionalId}</p>
              </div>
              <div>
                <p className="font-semibold text-muted-foreground">Sede, Fecha y Hora</p>
                <p>{customer.reservation.branchId}</p>
                <p>{customer.reservation.date} - {customer.reservation.time}</p>
              </div>
              <div className="pt-2 border-t">
                <p className="font-semibold text-muted-foreground">Tiempos de Atención</p>
                <p>Inicio: {customer.attention?.startTime || '-'}</p>
                <p>Fin: {customer.attention?.endTime || '-'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Soporte de Plataforma</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setIsIncidentOpen(true)}>
                <AlertTriangle className="w-4 h-4 text-warning" />
              </Button>
            </CardHeader>
            <CardContent>
              {customer.incidents.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin incidencias de soporte registradas.</p>
              ) : (
                <div className="space-y-3">
                  {customer.incidents.map(inc => (
                    <div key={inc.id} className="text-xs border-b pb-2 last:border-0">
                      <p className="text-muted-foreground">{new Date(inc.createdAt).toLocaleDateString()}</p>
                      <p>{inc.reason}</p>
                      <span className="bg-muted px-1.5 py-0.5 rounded mt-1 inline-block text-muted-foreground">
                        {inc.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <ConfirmationDialog
        isOpen={isConvertOpen}
        onClose={() => setIsConvertOpen(false)}
        onConfirm={handleConvert}
        title="Finalizar flujo CUSTOMER"
        description="La atención ha terminado. Se transferirá este registro al módulo TURNED para seguimiento post-atención."
        confirmText="Transferir a TURNED"
      />

      <ConfirmationDialog
        isOpen={isIncidentOpen}
        onClose={() => setIsIncidentOpen(false)}
        onConfirm={handleRegisterIncident}
        title="Registrar Incidencia de Soporte"
        description="Estas incidencias son para problemas de plataforma u operativos, ajenos a la atención clínica."
        confirmText="Registrar"
      >
        <div className="pt-4">
          <Input 
            placeholder="Motivo (mín. 10 caracteres)" 
            value={incidentReason}
            onChange={(e) => setIncidentReason(e.target.value)}
          />
        </div>
      </ConfirmationDialog>
    </div>
  );
}
