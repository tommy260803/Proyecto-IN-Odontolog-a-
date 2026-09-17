import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
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
import { DentalAttentionForm } from './DentalAttentionForm';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { Play, CheckSquare, XCircle, UserX, ArrowRight, AlertTriangle, Stethoscope } from 'lucide-react';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney } from '@/domain/entities';

interface CustomerDetailModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerDetailModal({ customerId, isOpen, onClose }: CustomerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll(),
    enabled: isOpen && !!customerId,
  });

  const { data: customer, isLoading, isError } = useCustomer(customerId || '');
  const changeState = useChangeCustomerState();
  const startAttention = useStartAttention();
  const finishAttention = useFinishAttention();
  const registerDetails = useRegisterAttentionDetails();
  const registerIncident = useRegisterCustomerIncident();
  const convertTurned = useConvertCustomerToTurned();

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [incidentReason, setIncidentReason] = useState('');
  const [incidentError, setIncidentError] = useState('');
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);

  if (!isOpen || !customerId) return null;

  const handleStateChange = (state: CustomerState, successMsg: string) => {
    if (!customer) return;
    changeState.mutate({ id: customer.id, state }, {
      onSuccess: () => {
        toast({ title: 'Actualizado', description: successMsg });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleStartAttention = () => {
    if (!customer) return;
    const time = new Date().toLocaleTimeString();
    startAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => {
        toast({ title: 'Iniciada', description: 'Atención odontológica iniciada.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleFinishAttention = () => {
    if (!customer) return;
    const time = new Date().toLocaleTimeString();
    finishAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => {
        toast({ title: 'Finalizada', description: 'Atención odontológica terminada con éxito.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleSaveAttentionDetails = (data: DentalAttentionFormValues) => {
    if (!customer) return;
    registerDetails.mutate({ id: customer.id, data }, {
      onSuccess: () => {
        toast({ title: 'Guardado', description: 'Registros clínicos actualizados.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleRegisterIncident = () => {
    if (!customer) return;
    if (incidentReason.trim().length < 10) {
      setIncidentError('El motivo de la incidencia debe contener al menos 10 caracteres');
      return;
    }
    setIncidentError('');
    registerIncident.mutate({ id: customer.id, reason: incidentReason }, {
      onSuccess: () => {
        toast({ title: 'Incidencia Registrada', description: 'Se guardó el reporte de soporte.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        setIsIncidentOpen(false);
        setIncidentReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleConvert = () => {
    if (!customer) return;
    convertTurned.mutate(customer.id, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'Paciente transferido al módulo TURNED para seguimiento.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
        setIsConvertOpen(false);
        onClose();
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const transitionCheck = customer ? canTransitionCustomerToTurned(customer, customer.attention) : { success: false, error: '' };
  const isAttentionDisabled = customer?.state !== CustomerState.IN_ATTENTION;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Fixed Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <Stethoscope className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Atención Odontológica (CUSTOMER)
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {customer?.id}
                  </p>
                </div>
              </div>

              {customer && (
                <div className="flex items-center gap-2">
                  <StatusBadge status={customer.state} />
                  <Button 
                    disabled={!transitionCheck.success || convertTurned.isPending} 
                    onClick={() => setIsConvertOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-3 py-2 h-8"
                  >
                    Pasar a TURNED <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body without visible scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
          {isLoading ? (
            <LoadingState />
          ) : isError || !customer ? (
            <ErrorState message="No se encontró la información del paciente en atención." />
          ) : (
            <div className="space-y-6">
              {!transitionCheck.success && customer.state === CustomerState.ATTENDED && (
                <div className="text-xs text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200/80 dark:border-amber-800/80">
                  <strong>Para transferir a TURNED:</strong> Ingrese el procedimiento realizado y registre las horas de inicio/fin de la atención.
                </div>
              )}

              {journeys.find(j => j.customerId === customer.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.customerId === customer.id)!} />
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Formulario y Botones de Flujo */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800/70">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Flujo y Registro Clínico</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {/* Botones de Acción de Estado */}
                      <div className="flex flex-wrap gap-2 mb-5 p-3.5 bg-slate-50 dark:bg-slate-900/60 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <Button 
                          variant="outline" size="sm" 
                          disabled={customer.state !== CustomerState.SCHEDULED}
                          onClick={() => handleStateChange(CustomerState.ATTENDANCE_CONFIRMED, 'Asistencia confirmada')}
                          className="rounded-xl text-xs font-semibold bg-white dark:bg-slate-800"
                        >
                          <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Confirmar Asistencia
                        </Button>
                        <Button 
                          variant="outline" size="sm" 
                          disabled={customer.state !== CustomerState.ATTENDANCE_CONFIRMED}
                          onClick={handleStartAttention}
                          className="rounded-xl text-xs font-semibold bg-white dark:bg-slate-800"
                        >
                          <Play className="w-3.5 h-3.5 mr-1.5 text-teal-600 dark:text-teal-400" /> Iniciar Atención
                        </Button>
                        <Button 
                          variant="outline" size="sm" 
                          disabled={customer.state !== CustomerState.IN_ATTENTION}
                          onClick={handleFinishAttention}
                          className="rounded-xl text-xs font-semibold bg-white dark:bg-slate-800"
                        >
                          <CheckSquare className="w-3.5 h-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" /> Finalizar Atención
                        </Button>
                        <Button 
                          variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs ml-auto"
                          disabled={customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                          onClick={() => handleStateChange(CustomerState.NO_SHOW, 'Marcado como No Asistió')}
                        >
                          <UserX className="w-3.5 h-3.5 mr-1 text-rose-500" /> No Asistió
                        </Button>
                        <Button 
                          variant="ghost" size="sm" className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs"
                          disabled={customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                          onClick={() => handleStateChange(CustomerState.CANCELED, 'Cita cancelada')}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1 text-rose-500" /> Cancelar
                        </Button>
                      </div>

                      <DentalAttentionForm 
                        formId="customer-dental-form"
                        initialValues={customer.attention} 
                        onSubmit={handleSaveAttentionDetails}
                        isLoading={registerDetails.isPending}
                        disabled={isAttentionDisabled && customer.state !== CustomerState.ATTENDED}
                        hideSubmitButton={true}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Columna Derecha: Datos de Cita y Soporte */}
                <div className="space-y-4">
                  <Card className="shadow-sm border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                    <CardHeader className="border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Datos de la Cita</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Paciente</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{customer.person.firstName} {customer.person.lastName}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Servicio & Especialista</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{customer.lead.requestedServiceId}</p>
                        <p className="text-slate-500 dark:text-slate-400">{customer.reservation.professionalId}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Sede & Horario</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">{customer.reservation.branchId}</p>
                        <p className="text-slate-500 dark:text-slate-400">{customer.reservation.date} - {customer.reservation.time}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tiempos de Atención</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">Inicio: {customer.attention?.startTime || '-'}</p>
                        <p className="text-slate-700 dark:text-slate-300">Fin: {customer.attention?.endTime || '-'}</p>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Soporte e Incidencias */}
                  <Card className="rounded-xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-800/70">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-xs font-bold text-slate-900 dark:text-white">Incidencias de Soporte</CardTitle>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsIncidentOpen(true)}>
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      </Button>
                    </CardHeader>
                    <CardContent className="text-xs">
                      {customer.incidents.length === 0 ? (
                        <p className="text-[11px] text-slate-400">Sin incidencias de soporte.</p>
                      ) : (
                        <div className="space-y-2">
                          {customer.incidents.map(inc => (
                            <div key={inc.id} className="border-b border-slate-100 dark:border-slate-700 pb-1.5 last:border-0">
                              <p className="text-[10px] text-slate-400">{new Date(inc.createdAt).toLocaleDateString()}</p>
                              <p className="text-slate-700 dark:text-slate-300">{inc.reason}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button 
            variant="outline" 
            size="sm"
            className="text-amber-600 border-amber-200 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950 text-xs rounded-xl h-9"
            onClick={() => setIsIncidentOpen(true)}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
            Reportar Incidencia
          </Button>

          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-4"
            >
              Cerrar
            </Button>
            {(!isAttentionDisabled || customer?.state === CustomerState.ATTENDED) && (
              <Button
                form="customer-dental-form"
                type="submit"
                disabled={registerDetails.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
              >
                {registerDetails.isPending ? 'Guardando...' : 'Guardar Registros'}
              </Button>
            )}
            {transitionCheck.success && (
              <Button
                type="button"
                className="bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
                onClick={() => setIsConvertOpen(true)}
              >
                Pasar a TURNED <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Modales de Confirmación */}
        <ConfirmationDialog
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConfirm={handleConvert}
          title="Finalizar Flujo y Pasar a TURNED"
          description="La atención ha terminado exitosamente. El paciente será transferido al módulo TURNED para seguimiento postventa y fidelización."
          confirmText="Sí, Transferir a TURNED"
          variant="default"
        />

        <ConfirmationDialog
          isOpen={isIncidentOpen}
          onClose={() => {
            setIsIncidentOpen(false);
            setIncidentError('');
          }}
          onConfirm={handleRegisterIncident}
          title="Registrar Incidencia de Soporte"
          description="Reporta cualquier eventualidad técnica u operativa ocurrida durante la atención."
          confirmText="Registrar Incidencia"
          variant="destructive"
        >
          <div className="pt-3 space-y-1.5">
            <Input 
              placeholder="Motivo de la incidencia (mín. 10 caracteres)" 
              value={incidentReason}
              onChange={(e) => {
                setIncidentReason(e.target.value);
                if (incidentError) setIncidentError('');
              }}
              className={`rounded-xl bg-slate-50 dark:bg-slate-800 text-xs ${
                incidentError ? '!border-rose-500 !ring-1 !ring-rose-500 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {incidentError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5 animate-in fade-in-50">
                <span className="inline-block w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                {incidentError}
              </p>
            )}
          </div>
        </ConfirmationDialog>
      </DialogContent>
    </Dialog>
  );
}
