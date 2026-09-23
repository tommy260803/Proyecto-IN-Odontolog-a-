import { useState, useMemo } from 'react';
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
import { Search, Eye, AlertTriangle, Trash2, X, RotateCcw, Zap, Bot, Sparkles, CheckCircle2, Clock, Mail, ShieldCheck, RefreshCw } from 'lucide-react';
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

  // Modales
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayerWithDetails | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDunningRunning, setIsDunningRunning] = useState(false);
  const [dunningStats, setDunningStats] = useState<any | null>(null);

  const handleRunDunningCycle = async () => {
    setIsDunningRunning(true);
    try {
      const res = await fetch(`${API_URL}/payer/run-dunning-cycle`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al ejecutar ciclo');
      
      setDunningStats(data.stats);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      toast({
        title: 'Ciclo de Cobranza Ejecutado',
        description: `Se procesaron ${data.stats.evaluatedReservations} reservas. ${data.stats.stage3CancellationsProcessed} citas vencidas canceladas y ${data.stats.freedSlots} sillones liberados.`,
      });
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'No se pudo ejecutar el ciclo de cobranza.',
        variant: 'destructive',
      });
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
          <Button
            type="button"
            onClick={handleRunDunningCycle}
            disabled={isDunningRunning}
            className="bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs h-9.5 px-4 font-semibold shadow-sm hover:shadow transition-all flex items-center gap-2 border border-teal-500/40"
            title="Disparar escaneo y ciclo de cobranza en 3 etapas (T-48h, T-24h y 00:00 hrs)"
          >
            <RefreshCw className={`w-4 h-4 ${isDunningRunning ? 'animate-spin' : ''}`} />
            <span>{isDunningRunning ? 'Ejecutando Cron...' : 'Ejecutar Cron Cobranza (3 Etapas)'}</span>
          </Button>
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

      {/* Modal Estadísticas de Ejecución del Cron de Cobranza */}
      {dunningStats && (
        <Dialog open={!!dunningStats} onOpenChange={(open) => !open && setDunningStats(null)}>
          <DialogContent className="max-w-2xl p-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                <Bot className="w-5 h-5 text-teal-600" />
                Reporte de Ejecución: Cron de Cobranza (3 Etapas)
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {/* Tarjetas de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">{dunningStats.evaluatedReservations}</div>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase">Evaluadas</div>
                </div>
                <div className="bg-teal-50 dark:bg-teal-950/50 p-3 rounded-xl border border-teal-200 dark:border-teal-800 text-center">
                  <div className="text-xl font-bold font-mono text-teal-700 dark:text-teal-300">{dunningStats.stage1RemindersSent}</div>
                  <div className="text-[10px] font-semibold text-teal-600 uppercase">Etapa 1 (T-48h)</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-950/50 p-3 rounded-xl border border-amber-200 dark:border-amber-800 text-center">
                  <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-300">{dunningStats.stage2UrgenciesSent}</div>
                  <div className="text-[10px] font-semibold text-amber-600 uppercase">Etapa 2 (T-24h)</div>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/50 p-3 rounded-xl border border-rose-200 dark:border-rose-800 text-center">
                  <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-300">{dunningStats.stage3CancellationsProcessed}</div>
                  <div className="text-[10px] font-semibold text-rose-600 uppercase">Canceladas (00:00)</div>
                </div>
              </div>

              {/* Registro de Auditoría Detallado */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2 max-h-60 overflow-y-auto">
                <div className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-teal-600" />
                  Trazabilidad de Notificaciones & Acciones:
                </div>
                {dunningStats.logs && dunningStats.logs.length > 0 ? (
                  <div className="space-y-1.5">
                    {dunningStats.logs.map((log: any, i: number) => (
                      <div key={i} className="text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-start justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">{log.patientName}</span>: {log.details}
                        </div>
                        {log.emailSent && (
                          <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200">
                            Correo Enviado ✅
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">No hubo acciones pendientes en este ciclo.</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  type="button"
                  onClick={() => setDunningStats(null)}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs px-4"
                >
                  Cerrar
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

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
