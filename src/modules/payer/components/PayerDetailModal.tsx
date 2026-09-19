import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import type { PaymentFormValues } from '../schemas/payerSchema';
import { YapePaymentButton } from './YapePaymentButton';
import { 
  AlertCircle, 
  FileText, 
  Bot, 
  ArrowRight, 
  XCircle, 
  CreditCard, 
  CheckCircle2, 
  RefreshCw, 
  MessageSquare, 
  Mail, 
  Eye, 
  Send,
  Zap,
  Sparkles,
  Copy,
  Check,
  ShieldAlert,
  Flame,
  Clock
} from 'lucide-react';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { callGroqAssistant, type PayerContext, type AiCollectionResult } from '@/shared/services/groqService';
import { PaymentNoticePdfModal } from './PaymentNoticePdfModal';

interface PayerDetailModalProps {
  payerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function PayerDetailModal({ payerId, isOpen, onClose }: PayerDetailModalProps) {
  const navigate = useNavigate();
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
  const [aiResult, setAiResult] = useState<AiCollectionResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiCalled, setAiCalled] = useState(false);
  const [isPdfModalOpen, setIsPdfModalOpen] = useState(false);
  const [showCopyPreview, setShowCopyPreview] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<'FRIENDLY' | 'URGENCY' | 'RESCUE_50'>('FRIENDLY');
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

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
        toast({ 
          title: 'Pago Validado', 
          description: 'El pago ha sido aprobado y el paciente fue transferido automáticamente a CUSTOMER.' 
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
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

  // Groq AI Agent — llamada real a la API con generación multicanal
  const handleAskAI = async (p: PayerWithDetails) => {
    setAiLoading(true);
    setAiError('');
    setAiCalled(true);
    try {
      const ctx: PayerContext = {
        patientName: `${p.person.firstName} ${p.person.lastName}`,
        phone: p.person.phone,
        email: p.person.email,
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
      setAiResult(response);
    } catch (err: any) {
      setAiError(err.message || 'Error al conectar con el asistente de IA.');
    } finally {
      setAiLoading(false);
    }
  };

  // Auto-consultar a la IA al abrir el modal para el paciente seleccionado
  useEffect(() => {
    if (isOpen && payer) {
      handleAskAI(payer);
    } else if (!isOpen) {
      setAiResult(null);
      setAiError('');
      setAiCalled(false);
    }
  }, [isOpen, payer?.id]);

  // Copiar texto al portapapeles con feedback
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    toast({ title: '¡Copiado!', description: `Texto de ${label} copiado al portapapeles.` });
    setTimeout(() => setCopiedLabel(null), 2000);
  };

  // Abrir WhatsApp con el mensaje de la estrategia activa
  const handleSendWhatsApp = (p: PayerWithDetails) => {
    const rawPhone = (p.person.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    
    let message = '';
    if (aiResult?.strategies) {
      if (selectedStrategy === 'FRIENDLY') message = aiResult.strategies.friendly.whatsappMessage;
      else if (selectedStrategy === 'URGENCY') message = aiResult.strategies.urgency.whatsappMessage;
      else if (selectedStrategy === 'RESCUE_50') message = aiResult.strategies.rescue.whatsappMessage;
    }
    
    if (!message) {
      message = aiResult?.whatsappMessage || `Hola ${p.person.firstName}, te saludamos de NexoSalud. Te recordamos que tienes una cita pendiente por confirmar con un abono de S/ ${p.amountToPay.toFixed(2)}.`;
    }

    const url = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast({ title: 'WhatsApp Abierto', description: 'Redirigiendo a WhatsApp con la estrategia seleccionada.' });
  };

  // Abrir modal de Proforma PDF con opción directa de envío al correo
  const handleSendEmail = (p: PayerWithDetails) => {
    setIsPdfModalOpen(true);
    toast({ 
      title: 'Proforma Lista', 
      description: `Revisa la proforma oficial de ${p.person.firstName} y haz clic en "Enviar PDF al Correo".` 
    });
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
    const activeStrategy = aiResult?.strategies
      ? (selectedStrategy === 'FRIENDLY' ? aiResult.strategies.friendly : selectedStrategy === 'URGENCY' ? aiResult.strategies.urgency : aiResult.strategies.rescue)
      : null;

    return (
      <div className="bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
        {/* Cabecera del Agente */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-md ring-4 ring-teal-50 dark:ring-teal-950/50">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-slate-100">
                  Agente Inteligente de Cobranzas & Recuperación
                </h4>
                <StatusBadge status="Groq AI · BI Engine" variant="primary" />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Scoring predictivo de impago, segmentación de riesgo y generación de estrategias multicanal
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleAskAI(p)}
            disabled={aiLoading}
            className="flex items-center gap-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 bg-teal-100/70 dark:bg-teal-950/80 hover:bg-teal-200/80 dark:hover:bg-teal-900 px-3.5 py-1.5 rounded-xl transition-all disabled:opacity-50 shadow-sm border border-teal-300/60 dark:border-teal-800/80"
            title="Recalcular scoring y regenerar estrategias con IA"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${aiLoading ? 'animate-spin' : ''}`} />
            {aiCalled ? 'Recalcular Análisis' : 'Consultar IA'}
          </button>
        </div>

        {/* 1. Medidor / Scoring de Riesgo Predictivo (Business Intelligence) */}
        {aiResult?.risk && (
          <div className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
            aiResult.risk.level === 'ALTO'
              ? 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-200/90 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
              : aiResult.risk.level === 'MODERADO'
              ? 'bg-amber-50/80 dark:bg-amber-950/40 border-amber-200/90 dark:border-amber-800/80 text-amber-950 dark:text-amber-100'
              : 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3.5">
                <div className={`flex flex-col items-center justify-center h-12 w-14 shrink-0 rounded-xl font-mono font-black text-base border shadow-sm ${
                  aiResult.risk.level === 'ALTO'
                    ? 'bg-rose-100 dark:bg-rose-900/80 text-rose-700 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                    : aiResult.risk.level === 'MODERADO'
                    ? 'bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-200 border-amber-300 dark:border-amber-700'
                    : 'bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
                }`}>
                  <span>{aiResult.risk.score}%</span>
                  <span className="text-[9px] font-sans font-bold tracking-tight uppercase">Riesgo</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Nivel de Riesgo de Impago: {aiResult.risk.level}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-white/80 dark:bg-slate-900/80 border border-current shadow-2xs">
                      {aiResult.risk.level === 'ALTO' ? 'Prioridad Alta' : aiResult.risk.level === 'MODERADO' ? 'Prioridad Media' : 'Flujo Normal'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 mt-0.5 font-medium">
                    {aiResult.risk.explanation}
                  </p>
                </div>
              </div>

              {/* Factores analizados */}
              {aiResult.risk.factors.length > 0 && (
                <div className="flex flex-wrap gap-1 sm:max-w-xs">
                  {aiResult.risk.factors.map((f, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 font-medium">
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recomendación Interna del Operador */}
        <div className="bg-white/90 dark:bg-slate-900/90 border border-teal-100 dark:border-teal-900/60 rounded-xl p-3 text-xs leading-relaxed">
          {aiLoading && (
            <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-medium animate-pulse py-1">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Groq AI analizando variables del paciente y formulando 3 estrategias de contacto...
            </div>
          )}
          {!aiLoading && aiError && (
            <p className="text-rose-600 dark:text-rose-400 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0" /> {aiError}
            </p>
          )}
          {!aiLoading && !aiError && aiResult?.internalRecommendation && (
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-700 dark:text-teal-400 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-teal-600" />
                Diagnóstico & Recomendación Operativa:
              </span>
              <p className="text-slate-800 dark:text-slate-200 font-medium">
                {aiResult.internalRecommendation}
              </p>
            </div>
          )}
          {!aiLoading && !aiError && !aiResult && (
            <p className="text-slate-400 dark:text-slate-500 italic">
              Haz clic en "Consultar IA" para activar el scoring de riesgo y las estrategias dinámicas de cobranza.
            </p>
          )}
        </div>

        {/* 2. Selector Interactivo de las 3 Estrategias Persuasivas (si no está validado) */}
        {p.state !== PayerState.VALIDATED && aiResult?.strategies && (
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-500" />
                Estrategias de Cobranza con IA (Selecciona el Tono Óptimo):
              </span>
              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                Alterna para previsualizar el mensaje
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {/* Estrategia 1: Friendly */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('FRIENDLY')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedStrategy === 'FRIENDLY'
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 ring-2 ring-teal-500/25 shadow-sm'
                    : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">1. Preventivo</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-teal-100 dark:bg-teal-900/80 text-teal-800 dark:text-teal-300">
                    Cordial
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Confirmación anticipada de rutina
                </p>
              </button>

              {/* Estrategia 2: Urgency */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('URGENCY')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedStrategy === 'URGENCY'
                    ? 'bg-amber-50 dark:bg-amber-950/60 border-amber-500 ring-2 ring-amber-500/25 shadow-sm'
                    : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">2. Urgencia Clínica</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-100 dark:bg-amber-900/80 text-amber-800 dark:text-amber-300">
                    Sillón Temporal
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Liberación inminente de horario
                </p>
              </button>

              {/* Estrategia 3: Rescue 50% */}
              <button
                type="button"
                onClick={() => setSelectedStrategy('RESCUE_50')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  selectedStrategy === 'RESCUE_50'
                    ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-500 ring-2 ring-rose-500/25 shadow-sm'
                    : 'bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">3. Rescate (50%)</span>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-rose-100 dark:bg-rose-900/80 text-rose-800 dark:text-rose-300">
                    Plan de Rescate
                  </span>
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                  Seña fraccionada para no perder cita
                </p>
              </button>
            </div>

            {/* Vista previa en vivo del texto generado */}
            {activeStrategy && (
              <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                    Mensaje de WhatsApp ({activeStrategy.badge}):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(activeStrategy.whatsappMessage, 'WhatsApp')}
                    className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/50"
                  >
                    {copiedLabel === 'WhatsApp' ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    {copiedLabel === 'WhatsApp' ? '¡Copiado!' : 'Copiar texto'}
                  </button>
                </div>
                <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line bg-slate-50/70 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200/70 dark:border-slate-700/70 font-sans leading-relaxed">
                  {activeStrategy.whatsappMessage}
                </p>
              </div>
            )}
          </div>
        )}

        {/* 3. Barra de Acciones con 1 Clic */}
        <div className="pt-1 flex flex-wrap items-center gap-2">
          {p.state === PayerState.VALIDATED ? (
            <div className="flex flex-wrap items-center gap-2 w-full">
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                Pago Validado
              </span>

              <span className="text-xs font-medium text-teal-800 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-sm">
                <Mail className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                Constancia de Pago enviada automáticamente {p.person?.email ? `a ${p.person.email}` : 'al correo'}
              </span>

              {/* Botón Ver PDF de Constancia */}
              <Button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                size="sm"
                className="bg-white hover:bg-teal-600 text-teal-800 hover:text-white border border-teal-300 dark:bg-slate-800 dark:text-teal-300 dark:border-teal-700 dark:hover:bg-teal-600 dark:hover:text-white rounded-xl text-xs h-8.5 px-3 gap-1.5 shadow-sm font-semibold transition-all"
                title="Ver constancia oficial de pago en PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver Constancia PDF
              </Button>

              {/* Botón Reenviar al Correo */}
              <Button
                type="button"
                onClick={() => handleSendEmail(p)}
                size="sm"
                className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-600 dark:hover:text-white rounded-xl text-xs h-8.5 px-3 gap-1.5 shadow-sm font-semibold transition-all"
                title="Reenviar constancia y confirmación de cita por correo al paciente"
              >
                <Mail className="w-3.5 h-3.5" />
                Reenviar al Correo
              </Button>
            </div>
          ) : (
            <>
              {/* Botón WhatsApp con Estrategia Seleccionada */}
              <Button
                type="button"
                onClick={() => handleSendWhatsApp(p)}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 gap-2 shadow-sm font-semibold transition-all"
                title="Enviar mensaje persuasivo seleccionado por WhatsApp"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Contactar por WhatsApp</span>
                <span className="text-[10px] bg-emerald-800/60 px-1.5 py-0.5 rounded font-normal">
                  {selectedStrategy === 'FRIENDLY' ? 'Preventivo' : selectedStrategy === 'URGENCY' ? 'Urgencia' : 'Rescate 50%'}
                </span>
              </Button>

              {/* Botón Correo de Cobro */}
              <Button
                type="button"
                onClick={() => handleSendEmail(p)}
                size="sm"
                className="bg-indigo-50 hover:bg-indigo-600 text-indigo-700 hover:text-white border border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-600 dark:hover:text-white rounded-xl text-xs h-9 px-3.5 gap-1.5 shadow-sm font-semibold transition-all"
                title="Enviar proforma y correo formal de cobranza"
              >
                <Mail className="w-3.5 h-3.5" />
                Enviar Proforma Correo
              </Button>

              {/* Botón Ver PDF Proforma */}
              <Button
                type="button"
                onClick={() => setIsPdfModalOpen(true)}
                size="sm"
                className="bg-teal-50 hover:bg-teal-600 text-teal-800 hover:text-white border border-teal-200 dark:bg-teal-950/50 dark:text-teal-300 dark:border-teal-800 dark:hover:bg-teal-600 dark:hover:text-white rounded-xl text-xs h-9 px-3.5 gap-1.5 shadow-sm font-semibold transition-all"
                title="Abrir visor oficial de proforma en PDF"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver PDF
              </Button>
            </>
          )}
        </div>

        {/* Badges de alerta de estado */}
        {alerts.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {alerts.map((a, i) => (
              <span key={i} className="text-[10px] font-semibold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {a}
              </span>
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!isOpen || !payerId) return null;

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
                  {(payer.state === PayerState.PENDING || payer.state === PayerState.REJECTED || (payer.state as string) === 'REVERTED') && (
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
                              type="button"
                              variant="outline" 
                              className="text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700/80 bg-rose-50/80 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold text-xs rounded-xl h-8 px-3 transition-colors shadow-xs"
                              onClick={() => setIsRevertOpen(true)}
                            >
                              <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
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
                type="button"
                variant="outline" 
                size="sm"
                className="text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-700/80 bg-rose-50/80 dark:bg-rose-950/60 hover:bg-rose-100 dark:hover:bg-rose-900/60 font-semibold text-xs rounded-xl h-9 px-3.5 transition-colors shadow-xs"
                onClick={() => setIsRevertOpen(true)}
              >
                <XCircle className="w-3.5 h-3.5 mr-1.5 text-rose-600 dark:text-rose-400" />
                Revertir
              </Button>
            )}
            {payer?.state === PayerState.IN_REVIEW && (
              <Button 
                type="button"
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
              className="rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700 font-semibold text-xs h-9 px-4 transition-colors shadow-xs"
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
                onClick={() => {
                  onClose();
                  navigate('/customer');
                }}
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

        {payer && (
          <PaymentNoticePdfModal
            payer={payer}
            isOpen={isPdfModalOpen}
            onClose={() => setIsPdfModalOpen(false)}
            customMessage={aiResult?.whatsappMessage}
            emailSubject={aiResult?.emailSubject}
            emailBody={aiResult?.emailBody}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
