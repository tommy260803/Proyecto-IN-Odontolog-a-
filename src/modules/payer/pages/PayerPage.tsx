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
import { Search, Eye, AlertTriangle, Trash2 } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney, Payment } from '@/domain/entities';
import { calculateP1, calculateP2, calculateP3, calculateP4 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { PayerDetailModal } from '../components/PayerDetailModal';

export default function PayerPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: payers, isLoading, isError } = usePayers();
  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });
  const { data: payments = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.PAYMENTS], 
    queryFn: () => new LocalRepository<Payment>(QUERY_KEYS.PAYMENTS).getAll() 
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [selectedPayerId, setSelectedPayerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PayerWithDetails | null>(null);
  const [isClearAllOpen, setIsClearAllOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirmClearAll = async () => {
    setIsProcessing(true);
    try {
      await fetch('http://localhost:3001/api/payer/clear-all', { method: 'POST' });
      localStorage.removeItem('in_odontologia_payers');
      localStorage.removeItem('in_odontologia_payments');
      localStorage.removeItem('payers');
      localStorage.removeItem('payments');
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYMENTS] });
      toast({ title: 'Limpieza Completada', description: 'Todos los registros de cobranza han sido eliminados.' });
      setTimeout(() => window.location.reload(), 500);
    } catch (e) {
      toast({ title: 'Error', description: 'No se pudo limpiar la base de datos.', variant: 'destructive' });
    } finally {
      setIsProcessing(false);
      setIsClearAllOpen(false);
    }
  };

  const filteredPayers = useMemo(() => {
    return payers?.filter(p => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        p.person.firstName.toLowerCase().includes(term) ||
        p.person.lastName.toLowerCase().includes(term) ||
        (p.person.documentNumber && p.person.documentNumber.includes(term)) ||
        p.reservation.id.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' || p.state === statusFilter;
      
      let matchDate = true;
      if (startDate) matchDate = matchDate && isAfter(parseISO(p.createdAt), parseISO(startDate));
      if (endDate) matchDate = matchDate && isBefore(parseISO(p.createdAt), parseISO(endDate));
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [payers, searchTerm, statusFilter, startDate, endDate]);

  const indicators = useMemo(() => {
    return [
      calculateP1(filteredPayers),
      calculateP2(filteredPayers, payments),
      calculateP3(filteredPayers),
      calculateP4(filteredPayers, journeys)
    ];
  }, [filteredPayers, payments, journeys]);

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
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
            onClick={() => setDeleteTarget(p)}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </Button>
        </div>
      )
    },
  ];

  const handleConfirmSingleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      await fetch(`http://localhost:3001/api/payer/${deleteTarget.id}`, { method: 'DELETE' });
      const payersRepo = new LocalRepository<any>(QUERY_KEYS.PAYERS);
      await payersRepo.delete(deleteTarget.id);
      const paymentsRepo = new LocalRepository<any>(QUERY_KEYS.PAYMENTS);
      if (deleteTarget.payment?.id) await paymentsRepo.delete(deleteTarget.payment.id);
    } catch (e) {}
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
    await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.PAYERS] });
    toast({ title: 'Cobro Eliminado', description: `El registro de cobro de ${deleteTarget.person.firstName} ${deleteTarget.person.lastName} ha sido eliminado.` });
    setIsProcessing(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo PAYER" 
        description="Gestión de pagos, validaciones e incidencias de recaudación."
        actions={
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsClearAllOpen(true)} 
            className="text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold rounded-xl"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Limpiar Base de Pruebas
          </Button>
        }
      />

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-8 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Buscar por persona, documento o reserva..."
              className="pl-8 rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value={PayerState.PENDING}>Pendiente</SelectItem>
                <SelectItem value={PayerState.IN_REVIEW}>En revisión</SelectItem>
                <SelectItem value={PayerState.VALIDATED}>Validado</SelectItem>
                <SelectItem value={PayerState.REJECTED}>Rechazado</SelectItem>
                <SelectItem value={PayerState.REVERTED}>Revertido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[160px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Desde</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 font-medium cursor-pointer" />
          </div>
          <div className="w-full sm:w-[160px]">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Hasta</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white px-3 font-medium cursor-pointer" />
          </div>
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

      {/* Modal Confirmación Limpieza Total */}
      <ConfirmationDialog
        isOpen={isClearAllOpen}
        onClose={() => setIsClearAllOpen(false)}
        onConfirm={handleConfirmClearAll}
        isLoading={isProcessing}
        title="¿Limpiar toda la base de pruebas de PAYER?"
        description="Esta acción eliminará todos los registros de cobro, pagos y transacciones de prueba en la base de datos SQL Server y local. Esta acción es irreversible."
        confirmText="Sí, Limpiar Todo"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
