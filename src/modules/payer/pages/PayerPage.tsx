import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Search, Eye, AlertTriangle } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { PayerWithDetails } from '@/application/use-cases/payer';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney, Payment } from '@/domain/entities';
import { calculateP1, calculateP2, calculateP3, calculateP4 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';

export default function PayerPage() {
  const navigate = useNavigate();
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
      cell: (p: PayerWithDetails) => <span className="font-medium">{p.person.firstName} {p.person.lastName}</span> 
    },
    { 
      header: 'Reserva ID', 
      cell: (p: PayerWithDetails) => p.reservationId.substring(0, 8) 
    },
    { 
      header: 'Monto', 
      cell: (p: PayerWithDetails) => `S/ ${p.amountToPay.toFixed(2)}`
    },
    { 
      header: 'Canal', 
      cell: (p: PayerWithDetails) => p.payment?.channel || '-'
    },
    { 
      header: 'Fecha Pago', 
      cell: (p: PayerWithDetails) => p.payment ? format(new Date(p.payment.operationDate), 'dd MMM yy', { locale: es }) : '-' 
    },
    { 
      header: 'Comprobante', 
      cell: (p: PayerWithDetails) => p.payment?.receiptMetadata ? 'Sí' : 'No' 
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
        <Button variant="ghost" size="sm" onClick={() => navigate(`/payer/${p.id}`)}>
          <Eye className="w-4 h-4 mr-2" />
          Revisar
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo PAYER" 
        description="Gestión de pagos, validaciones e incidencias de recaudación."
      />

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs text-muted-foreground mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-7 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por persona, documento o reserva..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[170px]">
            <span className="text-xs text-muted-foreground mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos los estados</SelectItem>
                <SelectItem value={PayerState.PENDING}>Pendiente</SelectItem>
                <SelectItem value={PayerState.IN_REVIEW}>En revisión</SelectItem>
                <SelectItem value={PayerState.VALIDATED}>Validado</SelectItem>
                <SelectItem value={PayerState.REJECTED}>Rechazado</SelectItem>
                <SelectItem value={PayerState.REVERTED}>Revertido</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full sm:w-[130px]">
            <span className="text-xs text-muted-foreground mb-1 block">Desde</span>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          </div>
          <div className="w-full sm:w-[130px]">
            <span className="text-xs text-muted-foreground mb-1 block">Hasta</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
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
    </div>
  );
}
