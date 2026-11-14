import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { 
  Clock, 
  Calendar, 
  Mail, 
  Send, 
  FileText, 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  RotateCw, 
  X,
  Play,
  Zap,
  Check,
  History
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface ScheduledNotice {
  id_notificacion: number;
  id_reserva: number;
  id_persona: number;
  fecha_hora_programada: string;
  estado: 'PROGRAMADO' | 'ENVIADO' | 'CANCELADO' | 'FALLIDO';
  tipo_aviso: string;
  email_destinatario: string;
  monto_cobro: number;
  asunto: string;
  mensaje_personalizado?: string | null;
  fecha_envio_real?: string | null;
  creado_por: string;
  fecha_creacion: string;
}

interface ScheduledNoticeModalProps {
  payer: PayerWithDetails | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ScheduledNoticeModal({ payer, isOpen, onClose }: ScheduledNoticeModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Campos del formulario
  const [targetDate, setTargetDate] = useState('');
  const [targetTime, setTargetTime] = useState('10:00');
  const [targetEmail, setTargetEmail] = useState('');
  const [noticeType, setNoticeType] = useState('AVISO_COBRO');
  const [subject, setSubject] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  
  // Estados de carga y lista
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFiringId, setIsFiringId] = useState<number | null>(null);
  const [isCancellingId, setIsCancellingId] = useState<number | null>(null);
  const [history, setHistory] = useState<ScheduledNotice[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Inicializar campos cuando se abre el modal con el paciente seleccionado
  useEffect(() => {
    if (isOpen && payer) {
      setTargetEmail(payer.person.email || '');

      // Sugerir fecha por defecto: mañana a las 10:00 hrs
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yyyy = tomorrow.getFullYear();
      const mm = String(tomorrow.getMonth() + 1).padStart(2, '0');
      const dd = String(tomorrow.getDate()).padStart(2, '0');
      setTargetDate(`${yyyy}-${mm}-${dd}`);
      setTargetTime('10:00');

      const constCode = `CONST-${String(payer.id).padStart(5, '0')}-${new Date().getFullYear()}`;
      const amountStr = Number(payer.amountToPay || 150).toFixed(2);
      setSubject(`✅ Confirmación Oficial de Cobro y Cita Odontológica - NexoSalud (${constCode})`);
      setCustomMessage(`Estimado(a) ${payer.person.firstName}, le confirmamos que el cobro por S/ ${amountStr} correspondiente a su atención odontológica ha sido efectuado y validado exitosamente. Adjuntamos su Constancia Oficial de Pago en PDF y su sillón clínico se encuentra 100% confirmado en nuestra agenda médica.`);

      loadHistory(Number(payer.id));
    }
  }, [isOpen, payer?.id]);

  // Cargar historial de notificaciones programadas
  const loadHistory = async (reservaId: number) => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(`${API_URL}/payer/notificaciones-cobro/${reservaId}`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data.notificaciones || []);
      }
    } catch (err) {
      console.error('Error al cargar historial de notificaciones programadas:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Programar notificación a fecha y hora específica
  const handleProgramar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!payer) return;

    if (!targetDate || !targetTime) {
      toast({
        title: 'Fecha u hora incompleta',
        description: 'Por favor seleccione la fecha y hora para programar el envío.',
        variant: 'destructive',
      });
      return;
    }

    if (!targetEmail) {
      toast({
        title: 'Correo requerido',
        description: 'Por favor ingrese la dirección de correo destinatario.',
        variant: 'destructive',
      });
      return;
    }

    const scheduledDateTime = new Date(`${targetDate}T${targetTime}:00`);
    if (isNaN(scheduledDateTime.getTime())) {
      toast({
        title: 'Fecha inválida',
        description: 'La combinación de fecha y hora no es válida.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/payer/notificaciones-cobro/programar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: Number(payer.id),
          fechaHoraProgramada: scheduledDateTime.toISOString(),
          emailDestinatario: targetEmail,
          tipoAviso: noticeType,
          asunto: subject,
          mensajePersonalizado: customMessage,
          creadoPor: 'Operador / Agente IA',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo programar la notificación.');
      }

      toast({
        title: '⏰ Cobro Directo Programado',
        description: `El Agente ejecutará el cobro, validará el pago en SQL Server y enviará la Constancia Oficial de Pago a ${targetEmail} el día ${scheduledDateTime.toLocaleDateString('es-PE')} a las ${targetTime} hrs.`,
      });

      loadHistory(Number(payer.id));
    } catch (err: any) {
      toast({
        title: 'Error al programar',
        description: err.message || 'Error al comunicarse con el servidor.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Disparar inmediatamente una notificación (prueba en vivo a Gmail)
  const handleDispararInmediato = async (notificacionId?: number) => {
    if (!payer) return;

    setIsSubmitting(true);
    try {
      let idToFire = notificacionId;

      // Si no hay id específico, primero programamos con fecha actual y disparamos
      if (!idToFire) {
        const createRes = await fetch(`${API_URL}/payer/notificaciones-cobro/programar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reservaId: Number(payer.id),
            fechaHoraProgramada: new Date().toISOString(),
            emailDestinatario: targetEmail,
            tipoAviso: noticeType,
            asunto: subject,
            mensajePersonalizado: customMessage,
            creadoPor: 'Prueba en Vivo',
          }),
        });
        const createData = await createRes.json();
        if (!createRes.ok) throw new Error(createData.error || 'Error al crear notificación.');
        idToFire = createData.notificacion.id_notificacion;
      }

      if (idToFire) setIsFiringId(idToFire);

      const res = await fetch(`${API_URL}/payer/notificaciones-cobro/disparar/${idToFire}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al despachar notificación.');
      }

      toast({
        title: '🎉 ¡Cobro Directo Efectuado y Constancia Enviada a Gmail!',
        description: `El pago fue validado en el sistema, la cita confirmada y la Constancia Oficial de Pago en PDF enviada exitosamente a ${targetEmail}.`,
      });

      // Refrescar caché global para reflejar que la orden pasó a VALIDADO
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });

      loadHistory(Number(payer.id));
    } catch (err: any) {
      toast({
        title: 'Error en cobro directo',
        description: err.message || 'Error al ejecutar el cobro.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
      setIsFiringId(null);
    }
  };

  // Cancelar una notificación programada
  const handleCancelar = async (notificacionId: number) => {
    setIsCancellingId(notificacionId);
    try {
      const res = await fetch(`${API_URL}/payer/notificaciones-cobro/cancelar/${notificacionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al cancelar.');

      toast({
        title: 'Notificación Cancelada',
        description: 'La notificación programada fue cancelada correctamente.',
      });

      if (payer) loadHistory(Number(payer.id));
    } catch (err: any) {
      toast({
        title: 'Error al cancelar',
        description: err.message || 'No se pudo cancelar la notificación.',
        variant: 'destructive',
      });
    } finally {
      setIsCancellingId(null);
    }
  };

  if (!isOpen || !payer) return null;

  const orderCode = (payer.payment as any)?.preReservationCode || `ORD-${String(payer.id).padStart(5, '0')}-2026`;
  const amountFormatted = Number(payer.amountToPay || 150).toFixed(2);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl">
        {/* Cabecera elegante */}
        <div className="bg-gradient-to-r from-teal-900 via-teal-800 to-slate-900 text-white p-5 sm:p-6 rounded-t-2xl border-b border-teal-700/50">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">
                  Cobro Directo Automático y Constancia a Gmail
                </DialogTitle>
                <p className="text-xs text-teal-200/90 mt-0.5">
                  El sistema cobra directamente en la fecha/hora seleccionada (valida el pago en BD, confirma la cita médica y promueve a CUSTOMER) y despacha la Constancia Oficial en PDF.
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-block bg-teal-500/20 text-teal-200 border border-teal-400/40 text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg">
                {orderCode}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Banner de Garantía y Buenas Prácticas */}
          <div className="bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800/80 rounded-xl p-3.5 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-teal-700 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="text-xs text-teal-900 dark:text-teal-200 space-y-0.5">
              <p className="font-semibold text-teal-950 dark:text-teal-100">
                Cobro Directo en Sistema y Emisión de Constancia Oficial de Pago
              </p>
              <p className="text-teal-800/90 dark:text-teal-300">
                No se envía una orden de cobro pendiente. Al ejecutarse, el agente <strong>efectúa el cobro directamente</strong> (valida el pago en SQL Server, asegura el sillón en agenda y promueve a CUSTOMER) y despacha la <strong>Constancia Oficial de Pago y Confirmación de Cita en PDF</strong> al buzón Gmail del paciente.
              </p>
            </div>
          </div>

          {/* Resumen del Paciente y Cita */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-800 text-xs">
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Paciente</span>
              <span className="font-bold text-slate-800 dark:text-slate-100 truncate block">
                {payer.person.firstName} {payer.person.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Cita Odontológica</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 block">
                {payer.reservation?.date || 'Fecha'} - {payer.reservation?.time || '15:00'} hrs
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Sede / Doctor</span>
              <span className="font-medium text-slate-800 dark:text-slate-200 truncate block">
                {payer.reservation?.branchId || 'Principal'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Monto de la Orden</span>
              <span className="font-bold text-teal-700 dark:text-teal-400 block text-sm">
                S/ {amountFormatted}
              </span>
            </div>
          </div>

          {/* Formulario de Configuración de Fecha y Hora */}
          <form onSubmit={handleProgramar} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Fecha de Envío */}
              <div className="space-y-1.5">
                <Label htmlFor="targetDate" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Fecha de Envío Programado
                </Label>
                <Input
                  id="targetDate"
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="h-9.5 text-xs rounded-xl"
                  required
                />
              </div>

              {/* Hora de Envío */}
              <div className="space-y-1.5">
                <Label htmlFor="targetTime" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Hora Exacta de Envío
                </Label>
                <Input
                  id="targetTime"
                  type="time"
                  value={targetTime}
                  onChange={(e) => setTargetTime(e.target.value)}
                  className="h-9.5 text-xs rounded-xl"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Correo Electrónico (Gmail) */}
              <div className="space-y-1.5">
                <Label htmlFor="targetEmail" className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  Correo Destinatario (Gmail)
                </Label>
                <Input
                  id="targetEmail"
                  type="email"
                  value={targetEmail}
                  onChange={(e) => setTargetEmail(e.target.value)}
                  placeholder="ejemplo@gmail.com"
                  className="h-9.5 text-xs rounded-xl"
                  required
                />
              </div>

              {/* Tipo de Aviso */}
              <div className="space-y-1.5">
                <Label htmlFor="noticeType" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Tipo de Notificación
                </Label>
                <Select value={noticeType} onValueChange={setNoticeType}>
                  <SelectTrigger id="noticeType" className="h-9.5 text-xs rounded-xl">
                    <SelectValue placeholder="Seleccione tipo de aviso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="AVISO_COBRO">Aviso Preventivo de Cobro (T-48h)</SelectItem>
                    <SelectItem value="RECORDATORIO_24H">Alerta de Urgencia Clínica (T-24h)</SelectItem>
                    <SelectItem value="COMPROMISO_PAGO">Compromiso y Separación de Sillón</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Asunto */}
            <div className="space-y-1.5">
              <Label htmlFor="subject" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Asunto del Correo Electrónico
              </Label>
              <Input
                id="subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="h-9.5 text-xs rounded-xl"
                required
              />
            </div>

            {/* Mensaje Personalizado */}
            <div className="space-y-1.5">
              <Label htmlFor="customMessage" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Cuerpo del Mensaje Explicativo
              </Label>
              <Textarea
                id="customMessage"
                rows={3}
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="text-xs rounded-xl resize-none"
              />
            </div>

            {/* Botones de Acción */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleDispararInmediato()}
                disabled={isSubmitting}
                className="w-full sm:w-auto h-9.5 text-xs px-4 rounded-xl text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 gap-2 font-semibold"
                title="Ejecuta el cobro directo en SQL Server y despacha la Constancia Oficial de Pago a Gmail"
              >
                <Zap className="w-3.5 h-3.5 text-teal-600" />
                <span>{isSubmitting ? 'Cobrando...' : '⚡ Cobrar Directamente Ahora y Enviar Constancia a Gmail'}</span>
              </Button>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={onClose}
                  className="h-9.5 text-xs px-4 rounded-xl text-slate-600 dark:text-slate-400"
                >
                  Cerrar
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="h-9.5 text-xs px-5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold shadow-sm hover:shadow gap-2"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Programando...' : 'Guardar y Programar Cobro Directo'}</span>
                </Button>
              </div>
            </div>
          </form>

          {/* Historial de Notificaciones Programadas para esta Cita */}
          <div className="border-t border-slate-200 dark:border-slate-800 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                  Historial de Notificaciones de Cobro para esta Cita
                </h4>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => payer && loadHistory(Number(payer.id))}
                disabled={isLoadingHistory}
                className="h-7 text-[11px] px-2 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 gap-1"
              >
                <RotateCw className={`w-3 h-3 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                Actualizar
              </Button>
            </div>

            {history.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-xs text-slate-500 dark:text-slate-400">
                No hay notificaciones de cobro programadas ni enviadas para esta orden.
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((notif) => {
                  const targetDt = new Date(notif.fecha_hora_programada);
                  const isSent = notif.estado === 'ENVIADO';
                  const isScheduled = notif.estado === 'PROGRAMADO';
                  const isCancelled = notif.estado === 'CANCELADO';
                  const isFailed = notif.estado === 'FALLIDO';

                  return (
                    <div
                      key={notif.id_notificacion}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                              isSent
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : isScheduled
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                                : isCancelled
                                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                            }`}
                          >
                            {notif.estado}
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-100">
                            {notif.tipo_aviso}
                          </span>
                          <span className="text-slate-400">|</span>
                          <span className="text-slate-600 dark:text-slate-300">
                            Hacia: <strong>{notif.email_destinatario}</strong>
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Programado para:{' '}
                          <strong>
                            {targetDt.toLocaleDateString('es-PE')} a las{' '}
                            {targetDt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
                          </strong>
                          {notif.fecha_envio_real && (
                            <span className="text-emerald-600 dark:text-emerald-400 ml-2">
                              (Despachado a Gmail el {new Date(notif.fecha_envio_real).toLocaleTimeString('es-PE')})
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isScheduled && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleDispararInmediato(notif.id_notificacion)}
                              disabled={isFiringId === notif.id_notificacion}
                              className="h-7 text-[11px] px-2.5 rounded-lg text-teal-700 hover:text-teal-800 bg-teal-50 hover:bg-teal-100 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800 gap-1 font-semibold"
                              title="Despachar inmediatamente a Gmail"
                            >
                              <Play className="w-3 h-3" />
                              <span>{isFiringId === notif.id_notificacion ? 'Enviando...' : 'Disparar Ahora'}</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelar(notif.id_notificacion)}
                              disabled={isCancellingId === notif.id_notificacion}
                              className="h-7 text-[11px] px-2 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                              title="Cancelar este envío programado"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </>
                        )}
                        {isSent && (
                          <span className="flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold px-2 py-1 bg-emerald-50 dark:bg-emerald-950/40 rounded-lg">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Cobrado con Constancia PDF
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
