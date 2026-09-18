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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { useToast } from '@/shared/hooks/use-toast';
import { PayerState } from '@/domain/enums';
import { 
  usePayer, 
  useRegisterPayment, 
  useValidatePayment, 
  useRejectPayment, 
  useRevertPayment,
  useConvertPayerToCustomer 
} from '../hooks/usePayerQueries';
import { PaymentForm } from './PaymentForm';
import { YapePaymentButton } from './YapePaymentButton';
import type { PaymentFormValues } from '../schemas/payerSchema';
import { AlertCircle, FileText, Bot, ArrowRight, XCircle, CreditCard, CheckCircle2, RefreshCw } from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { callGroqAssistant, type PayerContext } from '@/shared/services/groqService';

interface PayerDetailModalProps {
  payerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PayerDetailModal({ payerId, isOpen, onClose }: PayerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const journeys: any[] = [];

  const { data: payer, isLoading, isError } = usePayer(payerId || '');
  const registerPayment = useRegisterPayment();
  const validatePayment = useValidatePayment();
  const rejectPayment = useRejectPayment();
  const revertPayment = useRevertPayment();
  const convertToCustomer = useConvertPayerToCustomer();

  const [isConvertOpen, setIsConvertOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [revertReason, setRevertReason] = useState('');
  const [revertError, setRevertError] = useState('');
  const [isRevertOpen, setIsRevertOpen] = useState(false);

  // Groq AI Agent state
  const [aiMessage, setAiMessage] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCalled, setAiCalled] = useState(false);

  if (!isOpen || !payerId) return null;


  const handleRegisterPayment = (data: PaymentFormValues) => {
    if (!payer) return;
    registerPayment.mutate({ id: payer.id, data }, {
      onSuccess: () => {
        toast({ title: 'Éxito', description: 'Comprobante de pago enviado a revisión.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleValidate = () => {
    if (!payer) return;
    validatePayment.mutate(payer.id, {
      onSuccess: () => {
        toast({ title: 'Validado', description: 'El pago ha sido validado correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleReject = () => {
    if (!payer) return;
    if (rejectReason.trim().length < 10) {
      setRejectError('El motivo del rechazo debe tener al menos 10 caracteres');
      return;
    }
    setRejectError('');
    rejectPayment.mutate({ id: payer.id, reason: rejectReason }, {
      onSuccess: () => {
        toast({ title: 'Rechazado', description: 'Pago rechazado e incidencia registrada.', variant: 'destructive' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
        setIsRejectOpen(false);
        setRejectReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleRevert = () => {
    if (!payer) return;
    if (revertReason.trim().length < 10) {
      setRevertError('El motivo de la reversión debe tener al menos 10 caracteres');
      return;
    }
    setRevertError('');
    revertPayment.mutate({ id: payer.id, reason: revertReason }, {
      onSuccess: () => {
        toast({ title: 'Revertido', description: 'Pago revertido exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
        setIsRevertOpen(false);
        setRevertReason('');
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  const handleConvert = () => {
    if (!payer) return;
    convertToCustomer.mutate(payer.id, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'Paciente transferido a CUSTOMER exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
        setIsConvertOpen(false);
        onClose();
      },
      onError: (err) => toast({ title: 'Error', description: err.message, variant: 'destructive' })
    });
  };

  // Groq AI Agent — llamada real a la API
  const handleAskAI = async (p: PayerWithDetails) => {
    setAiLoading(true);
    setAiError('');
    setAiCalled(true);
    try {
      const ctx: PayerContext = {
        patientName: `${p.person.firstName} ${p.person.lastName}`,
        state: p.state,
        amountToPay: p.amountToPay,
        reservationDate: p.reservation?.date,
        reservationTime: p.reservation?.time,
        branch: p.reservation?.branchId,
        professional: p.reservation?.professionalId,
        channel: p.payment?.channel,
        operationNumber: p.payment?.operationNumber,
        declaredAmount: p.payment?.amount,
        hasReceipt: !!p.payment?.receiptMetadata,
        incidentsCount: p.incidents?.length || 0,
        lastIncidentReason: p.incidents?.[p.incidents.length - 1]?.reason,
      };
      const response = await callGroqAssistant(ctx);
      setAiMessage(response);
    } catch (err: any) {
      setAiError(err.message || 'Error al conectar con el asistente de IA.');
    } finally {
      setAiLoading(false);
    }
  };

  // Alertas estáticas según estado (complementan la IA)
  const getStaticAlerts = (p: PayerWithDetails) => {
    const alerts: string[] = [];
    if (p.state === PayerState.PENDING) alerts.push('Pago pendiente de registro');
    if (p.state === PayerState.IN_REVIEW && !p.payment?.receiptMetadata) alerts.push('Comprobante sin adjunto');
    if (p.state === PayerState.IN_REVIEW && p.payment?.receiptMetadata) alerts.push(`Comprobante: ${p.payment.receiptMetadata.name}`);
    if (p.state === PayerState.REJECTED) alerts.push('Incidencia de cobro abierta');
    if (p.state === PayerState.REVERTED) alerts.push('Reversión manual registrada');
    return alerts;
  };

  const renderAgentPanel = (p: PayerWithDetails) => {
    const alerts = getStaticAlerts(p);
    return (
      <div className="bg-teal-50/60 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/80 rounded-2xl p-4 flex gap-3.5 items-start">
        <Bot className="text-teal-600 dark:text-teal-400 w-8 h-8 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h4 className="font-bold text-xs text-teal-900 dark:text-teal-200 flex items-center gap-2">
              Asistente de Recaudación IA
              <StatusBadge status="Groq AI" variant="primary" />
            </h4>
            <button
              type="button"
              onClick={() => handleAskAI(p)}
              disabled={aiLoading}
              className="flex items-center gap-1 text-[10px] font-semibold text-teal-700 dark:text-teal-300 hover:text-teal-900 dark:hover:text-teal-100 transition-colors disabled:opacity-50"
              title="Consultar al asistente de IA"
            >
              <RefreshCw className={`w-3 h-3 ${aiLoading ? 'animate-spin' : ''}`} />
              {aiCalled ? 'Regenerar' : 'Consultar IA'}
            </button>
          </div>

          <div className="mt-2 min-h-[2rem]">
            {aiLoading && (
              <div className="flex items-center gap-2 text-xs text-teal-700 dark:text-teal-400 animate-pulse">
                <RefreshCw className="w-3 h-3 animate-spin" />
                Analizando el caso con Groq AI...
              </div>
            )}
            {!aiLoading && aiError && (
              <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" /> {aiError}
              </p>
            )}
            {!aiLoading && !aiError && aiMessage && (
              <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed animate-in fade-in duration-300">
                {aiMessage}
              </p>
            )}
            {!aiLoading && !aiError && !aiMessage && (
              <p className="text-xs text-slate-400 dark:text-slate-500 italic">
                Presiona "Consultar IA" para obtener un análisis personalizado de este caso.
              </p>
            )}
          </div>

          {alerts.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {alerts.map((a, i) => (
                <span key={i} className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {a}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Fixed Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Gestión de Cobro y Validación (PAYER)
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {payer?.id}
                  </p>
                </div>
              </div>

              {payer && (
                <div className="flex items-center gap-2">
                  <StatusBadge status={payer.state} />
                  {payer.state === PayerState.VALIDATED && (
                    <Button 
                      onClick={() => setIsConvertOpen(true)} 
                      className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-3 py-2 h-8"
                    >
                      Pasar a CUSTOMER <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body without visible scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6">
          {isLoading ? (
            <LoadingState />
          ) : isError || !payer ? (
            <ErrorState message="No se encontró la información del registro de cobro." />
          ) : (
            <div className="space-y-6">
              {journeys.find(j => j.payerId === payer.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.payerId === payer.id)!} />
                </div>
              )}

              {renderAgentPanel(payer)}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Izquierda: Datos del Paciente y Reserva */}
                <div className="space-y-4">
                  <Card className="shadow-sm border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                    <CardHeader className="border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                      <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Datos de la Reserva</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3 text-xs">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Paciente</p>
                        <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{payer.person.firstName} {payer.person.lastName}</p>
                        <p className="text-slate-500 dark:text-slate-400">{payer.person.phone} | {payer.person.email}</p>
                      </div>
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cita Asignada</p>
                        <p className="text-slate-700 dark:text-slate-300 mt-0.5">Fecha: {payer.reservation.date} - {payer.reservation.time}</p>
                        <p className="text-slate-500 dark:text-slate-400">Sede: {payer.reservation.branchId}</p>
                        <p className="text-slate-500 dark:text-slate-400">Especialista: {payer.reservation.professionalId}</p>
                      </div>
                      <div className="pt-3 border-t border-slate-200/80 dark:border-slate-700/80">
                        <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Monto por Recaudar</p>
                        <p className="font-mono text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
                          S/ {payer.amountToPay.toFixed(2)}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  {payer.incidents.length > 0 && (
                    <Card className="border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 rounded-xl">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" /> Incidencias Registradas
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 text-xs">
                        {payer.incidents.map(inc => (
                          <div key={inc.id} className="border-b border-rose-200/60 dark:border-rose-800/40 pb-2 last:border-0">
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{new Date(inc.createdAt).toLocaleDateString()}</p>
                            <p className="text-slate-600 dark:text-slate-300 mt-0.5">{inc.reason}</p>
                            <span className="text-[10px] bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 font-semibold px-2 py-0.5 rounded mt-1 inline-block">
                              {inc.status}
                            </span>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Columna Derecha: Pagos Yape y Comprobantes */}
                <div className="lg:col-span-2 space-y-4">
                  {(payer.state === PayerState.PENDING || payer.state === PayerState.REJECTED || payer.state === PayerState.IN_REVIEW) && (
                    <YapePaymentButton
                      payerId={payer.id}
                      personName={`${payer.person.firstName} ${payer.person.lastName}`}
                      email={payer.person.email}
                      amount={(payer as any).amountToPay ? Number((payer as any).amountToPay) : (payer.payment?.amount || 1.00)}
                      serviceName="Atención Odontológica"
                    />
                  )}

                  {payer.state === PayerState.PENDING || payer.state === PayerState.REJECTED ? (
                    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Registrar Comprobante Manual (Voucher / Transferencia)</CardTitle>
                        <CardDescription className="text-xs dark:text-slate-400">
                          Si el paciente pagó mediante transferencia bancaria o en efectivo, registra aquí los datos.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <PaymentForm onSubmit={handleRegisterPayment} isLoading={registerPayment.isPending} />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card className="rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm bg-white dark:bg-slate-800/70">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-bold text-slate-900 dark:text-white">Revisión y Conciliación del Pago</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200/80 dark:border-slate-700/80 mb-4 text-xs grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">Canal:</span> 
                            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{payer.payment?.channel}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">Nº Operación:</span> 
                            <p className="font-semibold font-mono text-slate-900 dark:text-white mt-0.5">{payer.payment?.operationNumber || '-'}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">Fecha Operación:</span> 
                            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{payer.payment?.operationDate}</p>
                          </div>
                          <div>
                            <span className="text-slate-400 dark:text-slate-500">Monto Declarado:</span> 
                            <p className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-sm mt-0.5">S/ {payer.payment?.amount.toFixed(2)}</p>
                          </div>
                          {payer.payment?.observations && (
                            <div className="col-span-2">
                              <span className="text-slate-400 dark:text-slate-500">Observaciones:</span> 
                              <p className="text-slate-700 dark:text-slate-300 mt-0.5">{payer.payment.observations}</p>
                            </div>
                          )}
                          {payer.payment?.receiptMetadata && (
                            <div className="col-span-2 flex items-center gap-2 mt-1 p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                              <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                              <div>
                                <p className="font-medium text-slate-900 dark:text-white">{payer.payment.receiptMetadata.name}</p>
                                <p className="text-[10px] text-slate-400">
                                  {(payer.payment.receiptMetadata.size / 1024).toFixed(1)} KB - {payer.payment.receiptMetadata.type}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        {payer.state === PayerState.IN_REVIEW && (
                          <div className="flex gap-3 pt-2">
                            <Button 
                              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-9 shadow-sm"
                              disabled={validatePayment.isPending}
                              onClick={handleValidate}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                              Validar y Aprobar Pago
                            </Button>
                            <Button 
                              className="flex-1 rounded-xl text-xs font-semibold h-9"
                              variant="destructive"
                              onClick={() => setIsRejectOpen(true)}
                            >
                              Rechazar Pago
                            </Button>
                          </div>
                        )}

                        {payer.state === PayerState.VALIDATED && (
                          <div className="flex justify-end pt-2">
                            <Button 
                              variant="outline" 
                              className="text-rose-600 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs rounded-xl"
                              onClick={() => setIsRevertOpen(true)}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1.5" />
                              Revertir Validación
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Fixed Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <div className="flex items-center gap-2">
            {payer?.state === PayerState.VALIDATED && (
              <Button 
                variant="outline" 
                size="sm"
                className="text-rose-600 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950 text-xs rounded-xl h-9"
                onClick={() => setIsRevertOpen(true)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5" />
                Revertir
              </Button>
            )}
            {payer?.state === PayerState.IN_REVIEW && (
              <Button 
                variant="destructive"
                size="sm"
                className="rounded-xl text-xs font-semibold h-9"
                onClick={() => setIsRejectOpen(true)}
              >
                Rechazar Pago
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="rounded-xl border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-4"
            >
              Cerrar
            </Button>
            {payer?.state === PayerState.IN_REVIEW && (
              <Button
                type="button"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
                disabled={validatePayment.isPending}
                onClick={handleValidate}
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                Validar y Aprobar
              </Button>
            )}
            {payer?.state === PayerState.VALIDATED && (
              <Button
                type="button"
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold h-9 px-4 shadow-sm"
                onClick={() => setIsConvertOpen(true)}
              >
                Pasar a CUSTOMER <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>

        {/* Modales de Confirmación y Acciones */}
        <ConfirmationDialog
          isOpen={isConvertOpen}
          onClose={() => setIsConvertOpen(false)}
          onConfirm={handleConvert}
          title="Crear Registro CUSTOMER"
          description="El pago está validado exitosamente. ¿Desea convertir a esta persona en CUSTOMER (paciente oficial) y dejar su cita confirmada en agenda?"
          confirmText="Sí, Crear Paciente CUSTOMER"
          variant="default"
        />

        <ConfirmationDialog
          isOpen={isRejectOpen}
          onClose={() => {
            setIsRejectOpen(false);
            setRejectError('');
          }}
          onConfirm={handleReject}
          title="Rechazar Pago"
          description="Esta acción marcará el comprobante como inválido y registrará una incidencia. El paciente deberá abonar nuevamente."
          confirmText="Rechazar Pago"
          variant="destructive"
        >
          <div className="pt-3 space-y-1.5">
            <Input 
              placeholder="Motivo del rechazo (mín. 10 caracteres)" 
              value={rejectReason}
              onChange={(e) => {
                setRejectReason(e.target.value);
                if (rejectError) setRejectError('');
              }}
              className={`rounded-xl bg-slate-50 dark:bg-slate-800 text-xs ${
                rejectError ? '!border-rose-500 !ring-1 !ring-rose-500 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {rejectError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5 animate-in fade-in-50">
                <span className="inline-block w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                {rejectError}
              </p>
            )}
          </div>
        </ConfirmationDialog>

        <ConfirmationDialog
          isOpen={isRevertOpen}
          onClose={() => {
            setIsRevertOpen(false);
            setRevertError('');
          }}
          onConfirm={handleRevert}
          title="Revertir Pago Validado"
          description="Advertencia: Revertirá una validación bancaria previa. Esto reabrirá una incidencia para revisión."
          confirmText="Revertir Pago"
          variant="destructive"
        >
          <div className="pt-3 space-y-1.5">
            <Input 
              placeholder="Motivo de la reversión (mín. 10 caracteres)" 
              value={revertReason}
              onChange={(e) => {
                setRevertReason(e.target.value);
                if (revertError) setRevertError('');
              }}
              className={`rounded-xl bg-slate-50 dark:bg-slate-800 text-xs ${
                revertError ? '!border-rose-500 !ring-1 !ring-rose-500 text-rose-900 dark:text-rose-100' : 'border-slate-200 dark:border-slate-700'
              }`}
            />
            {revertError && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1 flex items-center gap-1.5 animate-in fade-in-50">
                <span className="inline-block w-1 h-1 rounded-full bg-rose-500 shrink-0" />
                {revertError}
              </p>
            )}
          </div>
        </ConfirmationDialog>
      </DialogContent>
    </Dialog>
  );
}
