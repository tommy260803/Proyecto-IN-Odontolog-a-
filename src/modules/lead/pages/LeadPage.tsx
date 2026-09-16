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
import { useLeads } from '../hooks/useLeadQueries';
import { LeadState } from '@/domain/enums';
import { Search, Eye } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LeadWithDetails } from '@/application/use-cases/lead';
import { useQuery } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney } from '@/domain/entities';
import { calculateL1, calculateL2, calculateL3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';

export default function LeadPage() {
  const navigate = useNavigate();
  const { data: leads, isLoading, isError } = useLeads();
  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredLeads = useMemo(() => {
    return leads?.filter(l => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        l.person.firstName.toLowerCase().includes(term) ||
        l.person.lastName.toLowerCase().includes(term) ||
        (l.person.documentNumber && l.person.documentNumber.includes(term)) ||
        (l.person.phone && l.person.phone.includes(term));
      const matchStatus = statusFilter === 'ALL' || l.state === statusFilter;
      
      let matchDate = true;
      if (startDate) matchDate = matchDate && isAfter(parseISO(l.createdAt), parseISO(startDate));
      if (endDate) matchDate = matchDate && isBefore(parseISO(l.createdAt), parseISO(endDate));
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [leads, searchTerm, statusFilter, startDate, endDate]);

  const indicators = useMemo(() => {
    return [
      calculateL1(filteredLeads, journeys),
      calculateL2(filteredLeads),
      calculateL3(filteredLeads)
    ];
  }, [filteredLeads, journeys]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (l: LeadWithDetails) => <span className="font-medium">{l.person.firstName} {l.person.lastName}</span> 
    },
    { 
      header: 'Servicio Solicitado', 
      cell: (l: LeadWithDetails) => l.requestedServiceId || '-' 
    },
    { 
      header: 'Preferencia', 
      cell: (l: LeadWithDetails) => l.declaredPreferences || l.buyer.preferences || '-' 
    },
    { 
      header: 'F. Solicitud', 
      cell: (l: LeadWithDetails) => format(new Date(l.createdAt), 'dd MMM yyyy', { locale: es }) 
    },
    { 
      header: 'Reserva', 
      cell: (l: LeadWithDetails) => l.reservationId ? 'Sí' : 'No'
    },
    { 
      header: 'Estado', 
      cell: (l: LeadWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (l.state === LeadState.CONVERTED) variant = 'success';
        if (l.state === LeadState.LOST) variant = 'error';
        if (l.state === LeadState.IN_NEGOTIATION) variant = 'warning';
        return <StatusBadge status={l.state} variant={variant} />;
      }
    },
    { 
      header: 'Acciones', 
      cell: (l: LeadWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/lead/${l.id}`)}>
          <Eye className="w-4 h-4 mr-2" />
          Negociar
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo LEAD" 
        description="Gestión de solicitudes concretas y negociación de alternativas."
      />

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs text-muted-foreground mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-7 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento o teléfono..."
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
                <SelectItem value={LeadState.IN_NEGOTIATION}>En negociación</SelectItem>
                <SelectItem value={LeadState.ALTERNATIVE_SELECTED}>Alternativa select.</SelectItem>
                <SelectItem value={LeadState.PAYMENT_REQUESTED}>Pago solicitado</SelectItem>
                <SelectItem value={LeadState.CONVERTED}>Convertido</SelectItem>
                <SelectItem value={LeadState.LOST}>Perdido</SelectItem>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} indicator={ind} period={startDate || endDate ? `${startDate || 'Inicio'} al ${endDate || 'Hoy'}` : 'Histórico Completo'} />
        ))}
      </div>

      {filteredLeads.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron LEADS en la búsqueda." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredLeads} 
          keyExtractor={(item) => item.id} 
        />
      )}
    </div>
  );
}
