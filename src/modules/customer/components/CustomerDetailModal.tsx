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
import { 
  Play, 
  CheckSquare, 
  XCircle, 
  UserX, 
  ArrowRight, 
  AlertTriangle, 
  Stethoscope, 
  User, 
  Calendar, 
  Clock, 
  MapPin, 
  ShieldAlert,
  Save,
  CheckCircle2,
  Phone,
  Mail,
  FileCheck,
  Lock,
  FileEdit,
  UserCheck
} from 'lucide-react';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';

interface CustomerDetailModalProps {
  customerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const formatPeruTime = (isoString?: string) => {
  if (!isoString || isoString === '-') return '-';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleString('es-PE', {
      timeZone: 'America/Lima',
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  } catch {
    return isoString;
  }
};

export function CustomerDetailModal({ customerId, isOpen, onClose }: CustomerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const journeys: any[] = [];

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
        toast({ title: 'Estado Actualizado', description: successMsg });
        queryClient.setQueryData([QUERY_KEYS.CUSTOMERS, customer.id], (old: any) => old ? { ...old, state } : old);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleStartAttention = () => {
    if (!customer) return;
    const time = new Date().toLocaleTimeString();
    startAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => {
        toast({ title: 'Atención Iniciada', description: 'La consulta odontológica ha comenzado.' });
        queryClient.setQueryData([QUERY_KEYS.CUSTOMERS, customer.id], (old: any) => old ? { 
          ...old, 
          state: CustomerState.IN_ATTENTION,
          attention: { ...(old.attention || {}), startTime: new Date().toISOString() } 
        } : old);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleFinishAttention = () => {
    if (!customer) return;
    const time = new Date().toLocaleTimeString();
    finishAttention.mutate({ id: customer.id, time }, {
      onSuccess: () => {
        toast({ title: 'Atención Finalizada', description: 'Atención odontológica concluida con éxito.' });
        queryClient.setQueryData([QUERY_KEYS.CUSTOMERS, customer.id], (old: any) => old ? { 
          ...old, 
          state: CustomerState.ATTENDED,
          attention: { ...(old.attention || {}), endTime: new Date().toISOString() } 
        } : old);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleSaveAttentionDetails = (data: DentalAttentionFormValues) => {
    if (!customer) return;
    registerDetails.mutate({ id: customer.id, data }, {
      onSuccess: () => {
        toast({ title: 'Ficha Guardada', description: 'Registros clínicos actualizados en la base de datos.' });
        queryClient.setQueryData([QUERY_KEYS.CUSTOMERS, customer.id], (old: any) => old ? { 
          ...old, 
          attention: { ...(old.attention || {}), ...data } 
        } : old);
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.refetchQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, customer.id] });
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
        toast({ title: 'Incidencia Registrada', description: 'Se guardó el reporte de soporte correctamente.' });
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
        toast({ title: 'Paciente Transferido', description: 'El paciente fue promovido al módulo TURNED para fidelización.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
        setIsConvertOpen(false);
        onClose();
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const transitionCheck = customer ? canTransitionCustomerToTurned(customer, customer.attention) : { success: false, error: '' };
  const isTurned = Boolean(customer?.isTurned);
  const isAttentionDisabled = customer?.state !== CustomerState.IN_ATTENTION;
  const canEditForm = !isTurned && (!isAttentionDisabled || customer?.state === CustomerState.ATTENDED);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        
        {/* Encabezado Superior */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/70 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/70 dark:border-teal-800/70 shadow-sm">
                  <Stethoscope className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                      Atención Odontológica (CUSTOMER)
                    </DialogTitle>
                    <span className="text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      ID: #{customer?.id}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Registro clínico, diagnóstico, procedimiento y evolución odontológica
                  </p>
                </div>
              </div>

              {customer && (
                <div className="flex items-center gap-2.5">
                  <StatusBadge status={customer.state} />
                  <Button 
                    disabled={isTurned || !transitionCheck.success || convertTurned.isPending} 
                    onClick={() => setIsConvertOpen(true)}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-3.5 py-2 h-8 transition-all disabled:opacity-40"
                  >
                    Pasar a TURNED <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo con Scroll Suave */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-5 bg-slate-50/40 dark:bg-slate-950/20">
          {isLoading ? (
            <LoadingState />
          ) : isError || !customer ? (
            <ErrorState message="No se encontró la información del paciente en atención odontológica." />
          ) : (
            <div className="space-y-5">
              
              {!transitionCheck.success && customer.state === CustomerState.ATTENDED && (
                <div className="flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/60 p-3.5 rounded-xl border border-amber-200/90 dark:border-amber-800/80 shadow-sm">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-semibold">Requisito para transferir a TURNED:</strong> Ingrese el procedimiento odontológico realizado y asegúrese de que estén registrados los tiempos de atención.
                  </div>
                </div>
              )}

              {journeys.find(j => j.customerId === customer.id) && (
                <div className="py-1">
                  <JourneyStepper journey={journeys.find(j => j.customerId === customer.id)!} />
                </div>
              )}

              {/* Barra de Acciones del Flujo Clínico */}
              <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
                <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                    Flujo de Atención Odontológica
                  </span>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Estado Actual: <strong className="text-slate-800 dark:text-slate-200">{customer.state}</strong>
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Confirmar Asistencia */}
                  <Button 
                    type="button"
                    disabled={isTurned || customer.state !== CustomerState.SCHEDULED}
                    onClick={() => handleStateChange(CustomerState.ATTENDANCE_CONFIRMED, 'Asistencia confirmada exitosamente')}
                    className="group bg-emerald-50 hover:bg-emerald-600 text-emerald-800 hover:text-white border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 dark:hover:bg-emerald-600 dark:hover:text-white font-semibold rounded-xl text-xs h-9 px-3.5 gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Confirmar que el paciente se presentó en la clínica"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors" /> Confirmar Asistencia
                  </Button>

                  {/* Iniciar Atención */}
                  <Button 
                    type="button"
                    disabled={isTurned || customer.state !== CustomerState.ATTENDANCE_CONFIRMED}
                    onClick={handleStartAttention}
                    className="group bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white border border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-700 dark:hover:bg-teal-600 dark:hover:text-white font-semibold rounded-xl text-xs h-9 px-3.5 gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Iniciar la consulta odontológica en consultorio"
                  >
                    <Play className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 group-hover:text-white transition-colors" /> Iniciar Atención
                  </Button>

                  {/* Finalizar Atención */}
                  <Button 
                    type="button"
                    disabled={isTurned || customer.state !== CustomerState.IN_ATTENTION}
                    onClick={handleFinishAttention}
                    className="group bg-indigo-50 hover:bg-indigo-600 text-indigo-800 hover:text-white border border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-700 dark:hover:bg-indigo-600 dark:hover:text-white font-semibold rounded-xl text-xs h-9 px-3.5 gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                    title="Terminar la consulta odontológica"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 group-hover:text-white transition-colors" /> Finalizar Atención
                  </Button>

                  <div className="ml-auto flex items-center gap-2">
                    {/* No Asistió */}
                    <Button 
                      type="button"
                      disabled={isTurned || customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                      onClick={() => handleStateChange(CustomerState.NO_SHOW, 'Paciente marcado como No Asistió')}
                      className="group bg-rose-50/80 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-700 dark:hover:bg-rose-600 dark:hover:text-white font-semibold rounded-xl text-xs h-9 px-3 gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                      title="Registrar inasistencia del paciente"
                    >
                      <UserX className="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-white transition-colors" /> No Asistió
                    </Button>

                    {/* Cancelar */}
                    <Button 
                      type="button"
                      disabled={isTurned || customer.state === CustomerState.ATTENDED || customer.state === CustomerState.IN_ATTENTION}
                      onClick={() => handleStateChange(CustomerState.CANCELED, 'Cita odontológica cancelada')}
                      className="group bg-slate-100 hover:bg-slate-700 text-slate-700 hover:text-white border border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 dark:hover:bg-slate-700 dark:hover:text-white font-semibold rounded-xl text-xs h-9 px-3 gap-1.5 shadow-sm transition-all disabled:opacity-40 disabled:pointer-events-none"
                      title="Cancelar cita odontológica"
                    >
                      <XCircle className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400 group-hover:text-white transition-colors" /> Cancelar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Disposición Principal: Ficha Clínica y Resumen Lateral */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                
                {/* Columna Izquierda: Formulario Clínico Odontológico */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-900">
                    <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <Stethoscope className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          Ficha y Evolución Odontológica
                        </CardTitle>
                        {canEditForm ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-lg border border-teal-200/80 dark:border-teal-800/80">
                            <FileEdit className="w-3.5 h-3.5" />
                            Modo Edición Habilitado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                            <Lock className="w-3.5 h-3.5" />
                            Ficha en Solo Lectura
                          </span>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-4">
                      <DentalAttentionForm 
                        formId="customer-dental-form"
                        initialValues={customer.attention} 
                        onSubmit={handleSaveAttentionDetails}
                        isLoading={registerDetails.isPending}
                        disabled={!canEditForm}
                        hideSubmitButton={true}
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Columna Derecha: Resumen del Paciente & Incidencias */}
                <div className="space-y-4">
                  
                  {/* Tarjeta de Datos de Cita & Paciente */}
                  <Card className="shadow-sm border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-slate-100 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-800/40">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        Datos del Paciente & Cita
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3.5 text-xs">
                      
                      {/* Paciente */}
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Paciente
                        </span>
                        <p className="font-bold text-slate-900 dark:text-white text-sm mt-0.5">
                          {customer.person.firstName} {customer.person.lastName}
                        </p>
                        <div className="flex flex-col gap-1 mt-1 text-[11px] text-slate-600 dark:text-slate-300">
                          <span className="flex items-center gap-1">
                            <span className="font-semibold text-slate-400 dark:text-slate-500">DNI:</span> 
                            {customer.person.documentNumber || 'No registrado'}
                          </span>
                          {customer.person.phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" /> {customer.person.phone}
                            </span>
                          )}
                          {customer.person.email && (
                            <span className="flex items-center gap-1">
                              <Mail className="w-3 h-3 text-slate-400" /> {customer.person.email}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Servicio y Doctor */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Servicio & Especialista
                        </span>
                        <p className="font-semibold text-teal-700 dark:text-teal-300 mt-0.5">
                          {customer.lead?.requestedServiceId || 'Consulta Odontológica'}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-700 dark:text-slate-300 font-medium">
                          <UserCheck className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>
                            {customer.reservation?.professionalId ? (
                              customer.reservation.professionalId.toLowerCase().startsWith('esp.') || customer.reservation.professionalId.toLowerCase().startsWith('dr.')
                                ? `Esp. ${customer.reservation.professionalId.replace(/^(dr\.|esp\.)\s*/i, '')}`
                                : `Esp. ${customer.reservation.professionalId}`
                            ) : 'Esp. Especialista de Turno'}
                          </span>
                        </div>
                      </div>

                      {/* Sede y Horario */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                          Sede & Fecha Programada
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-slate-800 dark:text-slate-200 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span>{customer.reservation?.branchId || 'Sede Principal'}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1 text-slate-600 dark:text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                          <span>{formatPeruTime(customer.reservation?.date)}</span>
                        </div>
                      </div>

                      {/* Tiempos de Atención */}
                      <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Cronómetro de Consulta
                        </span>
                        <div className="bg-slate-50 dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-teal-600 dark:text-teal-400" /> Hora Inicio:
                            </span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {formatPeruTime(customer.attention?.startTime)}
                            </strong>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Hora Fin:
                            </span>
                            <strong className="text-slate-800 dark:text-slate-200 font-mono">
                              {formatPeruTime(customer.attention?.endTime)}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tarjeta de Incidencias de Soporte */}
                  <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                      <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Incidencias de Soporte
                      </CardTitle>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 px-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg"
                        onClick={() => setIsIncidentOpen(true)}
                        title="Registrar nueva incidencia"
                      >
                        + Reportar
                      </Button>
                    </CardHeader>
                    <CardContent className="p-4 text-xs">
                      {customer.incidents.length === 0 ? (
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                          Sin incidencias reportadas en esta atención.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {customer.incidents.map((inc: any) => (
                            <div key={inc.id} className="border-b border-slate-100 dark:border-slate-800 pb-2 last:border-0">
                              <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500">
                                <span>{new Date(inc.createdAt).toLocaleDateString()}</span>
                                <span className="bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                                  {inc.status || 'OPEN'}
                                </span>
                              </div>
                              <p className="text-slate-700 dark:text-slate-300 font-medium text-xs mt-1">
                                {inc.reason}
                              </p>
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

        {/* Barra Inferior (Footer Fijo) */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button 
            variant="outline" 
            size="sm"
            className="text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 hover:bg-amber-600 hover:text-white text-xs rounded-xl h-9 px-3.5 font-semibold transition-all shadow-sm"
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
              className="rounded-xl bg-white hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 text-xs font-semibold h-9 px-4 shadow-sm transition-all"
            >
              Cerrar
            </Button>
            
            {canEditForm && (
              <Button
                form="customer-dental-form"
                type="submit"
                disabled={registerDetails.isPending}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4.5 gap-1.5 shadow-sm transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                {registerDetails.isPending ? 'Guardando...' : 'Guardar Ficha Clínica'}
              </Button>
            )}

            {(!isTurned && transitionCheck.success) && (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-9 px-4.5 gap-1.5 shadow-sm transition-all"
                onClick={() => setIsConvertOpen(true)}
              >
                Pasar a TURNED <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* Modal de Confirmación para pasar a TURNED */}
        <ConfirmationDialog
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConfirm={handleConvert}
          title="Finalizar Atención y Pasar a TURNED"
          description="La atención odontológica ha finalizado exitosamente. El paciente será transferido al módulo TURNED para su seguimiento y fidelización."
          confirmText="Sí, Transferir a TURNED"
          variant="default"
        />

        {/* Modal para Registrar Incidencia */}
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
              className={`rounded-xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-900 dark:text-white ${
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
