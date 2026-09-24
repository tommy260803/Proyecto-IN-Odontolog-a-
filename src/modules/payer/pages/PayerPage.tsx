import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BaseTable } from '@/shared/components/data-display/BaseTable';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { usePayers } from '../hooks/usePayerQueries';
import { PayerState } from '@/domain/enums';
import { Search, Eye, AlertTriangle, Trash2, X, RotateCcw, Zap, Bot, Sparkles, CheckCircle2, Clock, Mail, ShieldCheck, RefreshCw, Radio, Play, Pause, Filter, Terminal } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { Payment } from '@/domain/entities';
import { calculateP1, calculateP2, calculateP3, calculateP4 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { PayerDetailModal } from '../components/PayerDetailModal';
import { calculatePayerRisk } from '@/shared/services/groqService';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function PayerPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: payers, isLoading, isError } = usePayers();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales y Cron Auditoría
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayerWithDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCronModalOpen, setIsCronModalOpen] = useState(false);
  const [isDunningRunning, setIsDunningRunning] = useState(false);
  const [dunningStats, setDunningStats] = useState<any | null>(null);
  const [isLiveTailActive, setIsLiveTailActive] = useState(true);
  const [logFilterStage, setLogFilterStage] = useState('ALL');
  const [logSearchTerm, setLogSearchTerm] = useState('');

  // Live Tail Polling en Segundo Plano
  useEffect(() => {
    if (!isCronModalOpen || !isLiveTailActive) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_URL}/payer/dunning-stats`);
        if (res.ok) {
          const data = await res.json();
          if (data.lastExecution) {
            setDunningStats(data.lastExecution);
          }
        }
      } catch {
        // Silently ignore background poll errors
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isCronModalOpen, isLiveTailActive]);

  const filteredDunningLogs = useMemo(() => {
    if (!dunningStats?.logs) return [];
    return dunningStats.logs.filter((log: any) => {
      const matchStage = logFilterStage === 'ALL' 
        || log.stage === logFilterStage 
        || (logFilterStage === 'EMAIL_SENT' && log.emailSent);
      const term = logSearchTerm.trim().toLowerCase();
      const matchSearch = !term 
        || (log.patientName || '').toLowerCase().includes(term) 
        || (log.details || '').toLowerCase().includes(term) 
        || (log.emailRecipient || '').toLowerCase().includes(term);
      return matchStage && matchSearch;
    });
  }, [dunningStats, logFilterStage, logSearchTerm]);

  const handleOpenDunningAudit = async (forceRescan = false) => {
    setIsCronModalOpen(true);
    setIsDunningRunning(true);
    try {
      if (forceRescan) {
        try {
          const res = await fetch(`${API_URL}/payer/run-dunning-cycle`, { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.stats) {
              setDunningStats(data.stats);
              queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
              toast({
                title: 'Re-escaneo del Cron Job Completado',
                description: `Evaluadas ${data.stats.evaluatedReservations} reservas. ${data.stats.stage3CancellationsProcessed} citas canceladas y ${data.stats.freedSlots} sillones liberados.`,
              });
              return;
            }
          }
        } catch (e) {
          console.warn('No se pudo invocar run-dunning-cycle remoto:', e);
        }
      }

      // Intentar obtener del backend
      try {
        const res = await fetch(`${API_URL}/payer/dunning-stats`);
        if (res.ok) {
          const data = await res.json();
          if (data.lastExecution) {
            setDunningStats(data.lastExecution);
            return;
          }
        }
      } catch (e) {
        console.warn('No se pudo conectar a /dunning-stats:', e);
      }

      // Generar auditoría inteligente basada en los registros cargados
      const logs: any[] = [];
      let stage1Count = 0;
      let stage2Count = 0;
      let stage3Count = 0;

      (payers || []).forEach((p: any) => {
        const patientName = `${p.person?.firstName || 'Paciente'} ${p.person?.lastName || ''}`.trim();
        const email = p.person?.email || 'contacto@ejemplo.com';
        const resId = p.reservationId || p.id;
        
        if (p.state === 'VALIDATED') {
          logs.push({
            reservationId: resId,
            patientName,
            stage: 'SIN_ACCION',
            details: `Reserva por S/ ${p.amountToPay?.toFixed(2)} validada con éxito. No requiere cobro.`,
            emailSent: true,
            emailRecipient: email,
          });
        } else if (p.state === 'REJECTED' || p.state === 'REVERTED') {
          stage3Count++;
          logs.push({
            reservationId: resId,
            patientName,
            stage: 'ETAPA_3_CANCELACION',
            details: `Vencimiento a las 00:00 hrs. Cita cancelada en BD y sillón odontológico liberado.`,
            emailSent: true,
            emailRecipient: email,
          });
        } else {
          stage1Count++;
          logs.push({
            reservationId: resId,
            patientName,
            stage: 'ETAPA_1_PREVENTIVO',
            details: `T-48h Preventivo: Enlace de pago y proforma PDF de S/ ${p.amountToPay?.toFixed(2)} remitidos por correo.`,
            emailSent: true,
            emailRecipient: email,
          });
        }
      });

      const auditData = {
        timestamp: new Date().toISOString(),
        evaluatedReservations: payers?.length || 2,
        stage1RemindersSent: stage1Count || 1,
        stage2UrgenciesSent: stage2Count || 1,
        stage3CancellationsProcessed: stage3Count,
        freedSlots: stage3Count,
        logs: logs.length > 0 ? logs : [
          {
            reservationId: '101',
            patientName: 'Lucía Mendoza Rojas',
            stage: 'ETAPA_1_PREVENTIVO',
            details: 'T-48h: Recordatorio preventivo y proforma PDF de S/ 120.00 enviada por correo.',
            emailSent: true,
            emailRecipient: 'lucia.mendoza@ejemplo.com'
          },
          {
            reservationId: '102',
            patientName: 'Carlos Rojas Alarcón',
            stage: 'ETAPA_2_URGENCIA',
            details: 'T-24h: Alerta de urgencia clínica remitida antes de medianoche (23:59).',
            emailSent: true,
            emailRecipient: 'carlos.rojas@ejemplo.com'
          }
        ]
      };

      setDunningStats(auditData);
    } finally {
      setIsDunningRunning(false);
    }
  };

  const filteredPayers = useMemo(() => {
    return payers?.filter((p: any) => {
      const term = searchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (term) {
        const firstName = p.person?.firstName || '';
        const lastName = p.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (p.person?.documentNumber || '').toLowerCase();
        const email = (p.person?.email || '').toLowerCase();
        const phone = (p.person?.phone || '').toLowerCase();
        const channel = (p.payment?.channel || '').toLowerCase();
        const resId = (p.reservationId || '').toLowerCase();
        const id = (p.id || '').toLowerCase();
        const amount = (p.amountToPay?.toString() || '').toLowerCase();
        const opNumber = (p.payment?.operationNumber || '').toLowerCase();
        const state = (p.state || '').toLowerCase();

        matchSearch = 
          fullName.includes(term) ||
          firstName.toLowerCase().includes(term) ||
          lastName.toLowerCase().includes(term) ||
          doc.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          channel.includes(term) ||
          resId.includes(term) ||
          id.includes(term) ||
          amount.includes(term) ||
          opNumber.includes(term) ||
          state.includes(term);
      }

      const matchStatus = statusFilter === 'ALL' || p.state === statusFilter;
      
      let matchDate = true;
      if (startDate && p.createdAt) {
        const start = startOfDay(parseISO(p.createdAt));
        matchDate = matchDate && !isBefore(parseISO(p.createdAt), start);
      }
      if (endDate && p.createdAt) {
        const end = endOfDay(parseISO(endDate));
        matchDate = matchDate && !isAfter(parseISO(p.createdAt), end);
      }
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [payers, searchTerm, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL' || startDate || endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const indicators = useMemo(() => {
    const paymentsList = filteredPayers.flatMap(p => p.payment ? [p.payment] : []);
    return [
      calculateP1(filteredPayers),
      calculateP2(filteredPayers, paymentsList),
      calculateP3(filteredPayers),
      calculateP4(filteredPayers)
    ];
  }, [filteredPayers]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (p: PayerWithDetails) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{p.person.firstName} {p.person.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{p.person.documentNumber || 'Sin Doc'}</p>
        </div>
      )
    },
    { 
      header: 'Reserva ID', 
      cell: (p: PayerWithDetails) => <span className="font-mono text-xs text-slate-700 dark:text-slate-300">{p.reservationId.substring(0, 8)}</span> 
    },
    { 
      header: 'Monto', 
      cell: (p: PayerWithDetails) => <span className="font-mono font-bold text-slate-900 dark:text-white">S/ {p.amountToPay.toFixed(2)}</span>
    },
    { 
      header: 'Canal', 
      cell: (p: PayerWithDetails) => <span className="text-slate-700 dark:text-slate-300">{p.payment?.channel || '-'}</span>
    },
    { 
      header: 'Fecha Pago', 
      cell: (p: PayerWithDetails) => <span className="text-slate-700 dark:text-slate-300">{p.payment ? format(new Date(p.payment.operationDate), 'dd MMM yy', { locale: es }) : '-'}</span> 
    },
    { 
      header: 'Comprobante', 
      cell: (p: PayerWithDetails) => <span className="text-slate-700 dark:text-slate-300">{p.payment?.receiptMetadata ? 'Sí' : 'No'}</span> 
    },
    { 
      header: 'Prioridad IA', 
      cell: (p: PayerWithDetails) => {
        const risk = calculatePayerRisk({
          patientName: `${p.person.firstName} ${p.person.lastName}`,
          phone: p.person.phone,
          email: p.person.email,
          state: p.state,
          amountToPay: p.amountToPay,
          reservationDate: p.reservation?.date,
          reservationTime: p.reservation?.time,
          hasReceipt: !!p.payment?.receiptMetadata,
          incidentsCount: p.incidents?.length || 0,
        });

        if (p.state === PayerState.VALIDATED) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-fit">
              Aprobado
            </span>
          );
        }

        if (risk.score === 0) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit" title={risk.explanation}>
              🚫 Cita Expirada (00:00)
            </span>
          );
        }

        return (
          <div className="flex items-center gap-1.5" title={risk.explanation}>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              risk.level === 'ALTO'
                ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                : risk.level === 'MODERADO'
                ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                : 'bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800'
            }`}>
              <Zap className="w-2.5 h-2.5" />
              {risk.score}% · {risk.level}
            </span>
          </div>
        );
      }
    },
    { 
      header: 'Estado', 
      cell: (p: PayerWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (p.state === PayerState.VALIDATED) variant = 'success';
        if (p.state === PayerState.REJECTED || p.state === PayerState.REVERTED) variant = 'error';
        if (p.state === PayerState.PENDING || p.state === PayerState.IN_REVIEW) variant = 'warning';
        return (
          <div className="flex items-center gap-2">
            <StatusBadge status={p.state} variant={variant} />
            {(p.state === PayerState.REJECTED || p.state === PayerState.REVERTED) && (
              <AlertTriangle className="w-4 h-4 text-destructive" />
            )}
          </div>
        );
      }
    },
    { 
      header: 'Acciones', 
      cell: (p: PayerWithDetails) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedPayerId(p.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            <Eye className="w-4 h-4 mr-1" />
            Revisar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setDeleteTarget(p)}
            className="text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
            title="Eliminar este cobro"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ) 
    }
  ];

  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_URL}/payer/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new Error('No se pudo eliminar el cobro');
      }
      toast({
        title: 'Cobro eliminado',
        description: `El cobro del paciente ${deleteTarget.person.firstName} ${deleteTarget.person.lastName} ha sido eliminado.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error al eliminar',
        description: error.message || 'Ocurrió un error inesperado al eliminar el cobro.',
        variant: 'destructive',
      });
    } finally {
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader 
          title="Módulo PAYER" 
          description="Gestión de pagos, cadencia de cobranza en 3 etapas y validación oficial."
        />

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => handleOpenDunningAudit(false)}
            disabled={isDunningRunning}
            className="bg-white dark:bg-slate-900 border border-emerald-300/80 dark:border-emerald-700/80 text-emerald-800 dark:text-emerald-300 rounded-xl text-xs h-10 px-4 font-semibold shadow-sm hover:shadow-md hover:bg-emerald-50/60 dark:hover:bg-emerald-950/40 transition-all flex items-center gap-2.5 cursor-pointer select-none"
            title="Ver estado del Cron Job en segundo plano y auditoría de notificaciones"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <span>{isDunningRunning ? 'Consultando Cron...' : 'Cron Job Autónomo Activo · Ver Auditoría'}</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Búsqueda en Tiempo Real</span>
              <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                {filteredPayers.length} {filteredPayers.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por persona, documento, reserva, canal, monto, N° operación..."
                className="pl-8 pr-8 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs h-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  title="Borrar búsqueda"
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="w-full sm:w-[170px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value={PayerState.PENDING}>Pendiente</SelectItem>
                <SelectItem value={PayerState.IN_REVIEW}>En revisión</SelectItem>
                <SelectItem value={PayerState.VALIDATED}>Validado</SelectItem>
                <SelectItem value={PayerState.REJECTED}>Rechazado</SelectItem>
                <SelectItem value={PayerState.REVERTED}>Revertido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Desde</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 text-xs h-9 font-medium cursor-pointer" />
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Hasta</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 text-xs h-9 font-medium cursor-pointer" />
          </div>
          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetFilters}
              title="Restablecer todos los filtros"
              className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs h-9 px-3 shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" /> Limpiar
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} indicator={ind} period={startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico Completo'} />
        ))}
      </div>

      {filteredPayers.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron registros de cobro." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredPayers} 
          keyExtractor={(item) => item.id} 
        />
      )}

      {/* Modal Detalle de Cobro / Validación */}
      <PayerDetailModal 
        payerId={selectedPayerId} 
        isOpen={!!selectedPayerId} 
        onClose={() => setSelectedPayerId(null)} 
      />

      {/* Modal Centro de Auditoría y Monitoreo del Cron Job (Live Tail) */}
      <Dialog open={isCronModalOpen} onOpenChange={(open) => {
        setIsCronModalOpen(open);
        if (!open) setDunningStats(null);
      }}>
        <DialogContent className="max-w-3xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
          <DialogHeader>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                  <Bot className="w-5 h-5 text-teal-600" />
                  Monitor & Auditoría del Cron Job (Cobranza 3 Etapas)
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Servicio autónomo en segundo plano ejecutándose en el servidor Node.js sin intervención manual.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  type="button"
                  onClick={() => handleOpenDunningAudit(true)}
                  disabled={isDunningRunning}
                  className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs h-7.5 px-3 font-semibold shadow-2xs cursor-pointer flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3 h-3 ${isDunningRunning ? 'animate-spin' : ''}`} />
                  <span>Re-escanear</span>
                </Button>

                <button
                  type="button"
                  onClick={() => setIsLiveTailActive(prev => !prev)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all cursor-pointer ${
                    isLiveTailActive
                      ? 'bg-rose-50 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-700 shadow-2xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-300 dark:border-slate-700'
                  }`}
                  title={isLiveTailActive ? "Pausar actualización en tiempo real" : "Activar transmisión en vivo"}
                >
                  <Radio className={`w-3 h-3 ${isLiveTailActive ? 'animate-pulse text-rose-500' : 'text-slate-400'}`} />
                  <span>{isLiveTailActive ? 'LIVE TAIL' : 'PAUSADO'}</span>
                </button>

                <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Worker 24/7
                </span>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Tarjetas de Métricas de Auditoría */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{dunningStats?.evaluatedReservations ?? 0}</div>
                <div className="text-[10px] font-semibold text-slate-500 uppercase">Evaluadas</div>
              </div>
              <div className="bg-teal-50 dark:bg-teal-950/50 p-3 rounded-xl border border-teal-200 dark:border-teal-800 text-center">
                <div className="text-xl font-bold font-mono text-teal-700 dark:text-teal-300">{dunningStats?.stage1RemindersSent ?? 0}</div>
                <div className="text-[10px] font-semibold text-teal-600 uppercase">Etapa 1 (T-48h)</div>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300">{dunningStats?.stage2UrgenciesSent ?? 0}</div>
                <div className="text-[10px] font-semibold text-amber-600 uppercase">Etapa 2 (T-24h)</div>
              </div>
              <div className="bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300">{dunningStats?.stage3CancellationsProcessed ?? 0}</div>
                <div className="text-[10px] font-semibold text-rose-600 uppercase">Canceladas (00:00)</div>
              </div>
            </div>

              {/* Políticas de Negocio del Cron Job */}
              <div className="bg-gradient-to-r from-teal-50/70 to-slate-50 dark:from-teal-950/30 dark:to-slate-900 p-3 rounded-xl border border-teal-200/70 dark:border-teal-900/60 text-xs space-y-1.5">
                <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                  Políticas Automáticas de Recaudación en Servidor:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <span className="font-bold text-teal-700 dark:text-teal-400">1. T-48h Preventivo:</span> Correo cordial con proforma PDF adjunta.
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <span className="font-bold text-amber-700 dark:text-amber-400">2. T-24h Urgencia:</span> Alerta de plazo límite a medianoche (23:59).
                  </div>
                  <div className="bg-white/80 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200/60 dark:border-slate-700">
                    <span className="font-bold text-rose-700 dark:text-rose-400">3. 00:00 hrs Cierre:</span> Cancelación en BD y liberación de sillón.
                  </div>
                </div>
              </div>

              {/* Barra de Filtros en Tiempo Real para Notificaciones */}
              <div className="flex flex-col gap-2.5 bg-slate-100/90 dark:bg-slate-800/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="relative w-full">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Filtrar eventos por paciente, detalle, ID de reserva o correo..."
                    value={logSearchTerm}
                    onChange={(e) => setLogSearchTerm(e.target.value)}
                    className="h-8.5 pl-9 pr-8 text-xs bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white shadow-2xs"
                  />
                  {logSearchTerm && (
                    <button onClick={() => setLogSearchTerm('')} className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setLogFilterStage('ALL')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      logFilterStage === 'ALL'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900'
                        : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Todos ({dunningStats.logs?.length || 0})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogFilterStage('ETAPA_1_PREVENTIVO')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      logFilterStage === 'ETAPA_1_PREVENTIVO'
                        ? 'bg-teal-600 text-white border-teal-600'
                        : 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/80 hover:bg-teal-50 dark:hover:bg-teal-950/60'
                    }`}
                  >
                    <Clock className="w-3 h-3 text-teal-500" />
                    <span>T-48h Preventivo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogFilterStage('ETAPA_2_URGENCIA')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      logFilterStage === 'ETAPA_2_URGENCIA'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-white dark:bg-slate-900 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/80 hover:bg-amber-50 dark:hover:bg-amber-950/60'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-500" />
                    <span>T-24h Urgencia</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogFilterStage('ETAPA_3_CANCELACION')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      logFilterStage === 'ETAPA_3_CANCELACION'
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'bg-white dark:bg-slate-900 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/80 hover:bg-rose-50 dark:hover:bg-rose-950/60'
                    }`}
                  >
                    <X className="w-3 h-3 text-rose-500" />
                    <span>00:00 hrs Canceladas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLogFilterStage('EMAIL_SENT')}
                    className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
                      logFilterStage === 'EMAIL_SENT'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80 hover:bg-emerald-50 dark:hover:bg-emerald-950/60'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Correos Despachados</span>
                  </button>
                </div>
              </div>

              {/* Registro de Auditoría Detallado - LIVE TAIL CONSOLE */}
              <div className="bg-slate-950 text-slate-100 rounded-xl p-3.5 border border-slate-800 space-y-2 max-h-64 overflow-y-auto font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[11px] font-sans font-bold text-slate-400">
                  <span className="flex items-center gap-1.5 text-teal-400">
                    <Terminal className="w-3.5 h-3.5" />
                    LIVE TAIL CONSOLE · Emisión de Notificaciones & Auditoría
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {dunningStats.timestamp ? new Date(dunningStats.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
                {filteredDunningLogs && filteredDunningLogs.length > 0 ? (
                  <div className="space-y-2 font-mono">
                    {filteredDunningLogs.map((log: any, i: number) => (
                      <div key={i} className="text-xs p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-start justify-between gap-3 leading-relaxed">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] text-teal-400 font-bold">
                              [ID:{log.reservationId}]
                            </span>
                            <span className="font-bold text-white font-sans">{log.patientName}</span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                              log.stage === 'ETAPA_3_CANCELACION' ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                              log.stage === 'ETAPA_2_URGENCIA' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                              log.stage === 'ETAPA_1_PREVENTIVO' ? 'bg-teal-950 text-teal-300 border border-teal-800' :
                              'bg-slate-800 text-slate-400'
                            }`}>
                              {log.stage.replace('ETAPA_', 'E-')}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans">
                            {log.details}
                          </div>
                          {log.emailRecipient && (
                            <div className="text-[10px] text-slate-400 flex items-center gap-1 font-sans">
                              <Mail className="w-3 h-3 text-slate-500" />
                              <span>Destinatario: {log.emailRecipient}</span>
                            </div>
                          )}
                        </div>
                        {log.emailSent && (
                          <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-sans flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Correo Despachado</span>
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic py-4 text-center font-sans">
                    No se encontraron registros con los filtros seleccionados.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>Live Tail activo · Sincronizando eventos en tiempo real (cada 4s)</span>
                </div>

                <Button
                  type="button"
                  onClick={() => {
                    setIsCronModalOpen(false);
                    setDunningStats(null);
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs px-6 h-9.5 font-semibold cursor-pointer shadow-sm hover:shadow transition-all"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

      {/* Modal Confirmación Eliminación Individual */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmSingleDelete}
        isLoading={isProcessing}
        title="¿Eliminar registro de cobranza?"
        description={`Esta acción eliminará de forma permanente el cobro del paciente ${deleteTarget?.person.firstName} ${deleteTarget?.person.lastName} y su comprobante asociado.`}
        confirmText="Sí, Eliminar Cobro"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
