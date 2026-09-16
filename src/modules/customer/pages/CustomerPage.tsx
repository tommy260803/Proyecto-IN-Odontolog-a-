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
import { useCustomers } from '../hooks/useCustomerQueries';
import { CustomerState } from '@/domain/enums';
import { Search, Eye } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { CustomerWithDetails } from '@/application/use-cases/customer';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney, DentalAttention } from '@/domain/entities';
import { calculateC1, calculateC2, calculateC3, calculateC4 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';

export default function CustomerPage() {
  const navigate = useNavigate();
  const { data: customers, isLoading, isError } = useCustomers();
  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredCustomers = useMemo(() => {
    return customers?.filter(c => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        c.person.firstName.toLowerCase().includes(term) ||
        c.person.lastName.toLowerCase().includes(term) ||
        c.reservation.id.toLowerCase().includes(term) ||
        c.lead.requestedServiceId.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' || c.state === statusFilter;
      
      let matchDate = true;
      if (startDate) matchDate = matchDate && isAfter(parseISO(c.createdAt), parseISO(startDate));
      if (endDate) matchDate = matchDate && isBefore(parseISO(c.createdAt), parseISO(endDate));
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [customers, searchTerm, statusFilter, startDate, endDate]);

  const indicators = useMemo(() => {
    const attentions = filteredCustomers.map(c => c.attention).filter(Boolean) as DentalAttention[];
    return [
      calculateC1(filteredCustomers),
      calculateC2(filteredCustomers),
      calculateC3(attentions),
      calculateC4(filteredCustomers, journeys)
    ];
  }, [filteredCustomers, journeys]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (c: CustomerWithDetails) => <span className="font-medium">{c.person.firstName} {c.person.lastName}</span> 
    },
    { 
      header: 'Servicio / Reserva', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p>{c.lead.requestedServiceId}</p>
          <p className="text-xs text-muted-foreground">ID: {c.reservation.id.substring(0, 8)}</p>
        </div>
      )
    },
    { 
      header: 'Horario', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p>{format(new Date(c.reservation.date), 'dd MMM yyyy', { locale: es })}</p>
          <p className="text-xs text-muted-foreground">{c.reservation.time}</p>
        </div>
      )
    },
    { 
      header: 'Profesional / Sede', 
      cell: (c: CustomerWithDetails) => (
        <div>
          <p>{c.reservation.professionalId || '-'}</p>
          <p className="text-xs text-muted-foreground">{c.reservation.branchId || '-'}</p>
        </div>
      )
    },
    { 
      header: 'Estado', 
      cell: (c: CustomerWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (c.state === CustomerState.ATTENDED) variant = 'success';
        if (c.state === CustomerState.NO_SHOW || c.state === CustomerState.CANCELED) variant = 'error';
        if (c.state === CustomerState.SCHEDULED || c.state === CustomerState.IN_ATTENTION) variant = 'warning';
        return <StatusBadge status={c.state} variant={variant} />;
      }
    },
    { 
      header: 'Acciones', 
      cell: (c: CustomerWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/customer/${c.id}`)}>
          <Eye className="w-4 h-4 mr-2" />
          Ver Cita
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo CUSTOMER" 
        description="Gestión de citas confirmadas y flujo de atención clínica básica."
      />

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs text-muted-foreground mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-7 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por persona, reserva o servicio..."
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
                <SelectItem value={CustomerState.SCHEDULED}>Programado</SelectItem>
                <SelectItem value={CustomerState.ATTENDANCE_CONFIRMED}>Asist. Confirmada</SelectItem>
                <SelectItem value={CustomerState.IN_ATTENTION}>En Atención</SelectItem>
                <SelectItem value={CustomerState.ATTENDED}>Atendido</SelectItem>
                <SelectItem value={CustomerState.NO_SHOW}>No Asistió</SelectItem>
                <SelectItem value={CustomerState.CANCELED}>Cancelado</SelectItem>
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

      {filteredCustomers.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron pacientes para la atención." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredCustomers} 
          keyExtractor={(item) => item.id} 
        />
      )}
    </div>
  );
}
