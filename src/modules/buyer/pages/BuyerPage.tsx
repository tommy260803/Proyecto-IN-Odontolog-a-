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
import { useBuyers } from '../hooks/useBuyerQueries';
import { BuyerState } from '@/domain/enums';
import { Plus, Search, Eye } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { leadUseCases } from '@/application/use-cases/lead';
import { QUERY_KEYS } from '@/shared/constants';
import { LocalRepository } from '@/infrastructure/repositories';
import type { CustomerJourney } from '@/domain/entities';
import { calculateB1, calculateB2, calculateB3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';

import type { BuyerWithPerson } from '@/application/use-cases/buyer';

export default function BuyerPage() {
  const navigate = useNavigate();
  const { data: buyers, isLoading, isError } = useBuyers();
  const { data: leads = [] } = useQuery({ queryKey: [QUERY_KEYS.LEADS], queryFn: () => leadUseCases.getAllLeads() });
  const { data: journeys = [] } = useQuery({ 
    queryKey: [QUERY_KEYS.JOURNEYS], 
    queryFn: () => new LocalRepository<CustomerJourney>(QUERY_KEYS.JOURNEYS).getAll() 
  });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  
  // Filtros de fecha (opcional UI minimalista)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredBuyers = useMemo(() => {
    return buyers?.filter(b => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        b.person.firstName.toLowerCase().includes(term) ||
        b.person.lastName.toLowerCase().includes(term) ||
        (b.person.documentNumber && b.person.documentNumber.includes(term)) ||
        b.person.phone?.includes(term) ||
        b.person.email?.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' || b.state === statusFilter;
      
      let matchDate = true;
      if (startDate) matchDate = matchDate && isAfter(parseISO(b.createdAt), parseISO(startDate));
      if (endDate) matchDate = matchDate && isBefore(parseISO(b.createdAt), parseISO(endDate));
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [buyers, searchTerm, statusFilter, startDate, endDate]);

  const indicators = useMemo(() => {
    const filteredLeads = leads.filter(l => filteredBuyers.some(b => b.id === l.buyerId));
    
    return [
      calculateB1(filteredBuyers, journeys),
      calculateB2(filteredBuyers),
      calculateB3(filteredBuyers, filteredLeads)
    ];
  }, [filteredBuyers, leads, journeys]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Nombre', 
      cell: (b: BuyerWithPerson) => <span className="font-medium">{b.person.firstName} {b.person.lastName}</span> 
    },
    { 
      header: 'Contacto', 
      cell: (b: BuyerWithPerson) => (
        <div className="text-sm">
          {b.person.phone && <div>{b.person.phone}</div>}
          {b.person.email && <div className="text-muted-foreground">{b.person.email}</div>}
        </div>
      )
    },
    { header: 'Canal', cell: (b: BuyerWithPerson) => b.channel },
    { header: 'Servicio', cell: (b: BuyerWithPerson) => b.serviceOfInterestId || '-' },
    { 
      header: 'Fecha', 
      cell: (b: BuyerWithPerson) => format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm', { locale: es }) 
    },
    { 
      header: 'Estado', 
      cell: (b: BuyerWithPerson) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (b.state === BuyerState.CONVERTED) variant = 'success';
        if (b.state === BuyerState.DISCARDED) variant = 'error';
        if (b.state === BuyerState.NEW) variant = 'warning';
        return <StatusBadge status={b.state} variant={variant} />;
      }
    },
    { 
      header: 'Acciones', 
      cell: (b: BuyerWithPerson) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/buyer/${b.id}`)}>
          <Eye className="w-4 h-4 mr-2" />
          Ver
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo BUYER" 
        description="Gestión de interesados iniciales y captación de potenciales leads."
        actions={
          <Button onClick={() => navigate('/buyer/new')}>
            <Plus className="w-4 h-4 mr-2" />
            Registrar BUYER
          </Button>
        }
      />

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs text-muted-foreground mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-7 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, documento, correo..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-[150px]">
            <span className="text-xs text-muted-foreground mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value={BuyerState.NEW}>Nuevo</SelectItem>
                <SelectItem value={BuyerState.CONTACTED}>Contactado</SelectItem>
                <SelectItem value={BuyerState.CONVERTED}>Convertido</SelectItem>
                <SelectItem value={BuyerState.DISCARDED}>Descartado</SelectItem>
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

      {filteredBuyers.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron registros que coincidan con la búsqueda." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredBuyers} 
          keyExtractor={(item) => item.id} 
        />
      )}
    </div>
  );
}
