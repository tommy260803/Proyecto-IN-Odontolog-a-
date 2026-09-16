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
import { useTurneds } from '../hooks/useTurnedQueries';
import { TurnedState } from '@/domain/enums';
import { Search, Eye } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TurnedWithDetails } from '@/application/use-cases/turned';
import { calculateT1, calculateT2, calculateT3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';

export default function TurnedPage() {
  const navigate = useNavigate();
  const { data: turneds, isLoading, isError } = useTurneds();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredTurneds = useMemo(() => {
    return turneds?.filter(t => {
      const term = searchTerm.toLowerCase();
      const matchSearch = 
        t.person.firstName.toLowerCase().includes(term) ||
        t.person.lastName.toLowerCase().includes(term) ||
        (t.reservation.professionalId && t.reservation.professionalId.toLowerCase().includes(term)) ||
        t.lead.requestedServiceId.toLowerCase().includes(term);
      const matchStatus = statusFilter === 'ALL' || t.state === statusFilter;
      
      let matchDate = true;
      if (startDate) matchDate = matchDate && isAfter(parseISO(t.createdAt), parseISO(startDate));
      if (endDate) matchDate = matchDate && isBefore(parseISO(t.createdAt), parseISO(endDate));
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [turneds, searchTerm, statusFilter, startDate, endDate]);

  const indicators = useMemo(() => {
    return [
      calculateT1(filteredTurneds),
      calculateT2(filteredTurneds),
      calculateT3(filteredTurneds)
    ];
  }, [filteredTurneds]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (t: TurnedWithDetails) => <span className="font-medium">{t.person.firstName} {t.person.lastName}</span> 
    },
    { 
      header: 'Servicio Finalizado', 
      cell: (t: TurnedWithDetails) => t.lead.requestedServiceId
    },
    { 
      header: 'Fecha Atención', 
      cell: (t: TurnedWithDetails) => format(new Date(t.reservation.date), 'dd MMM yyyy', { locale: es })
    },
    { 
      header: 'Próximo Seguimiento', 
      cell: (t: TurnedWithDetails) => t.nextContactDate ? format(new Date(t.nextContactDate), 'dd MMM yyyy', { locale: es }) : 'No agendado'
    },
    { 
      header: 'Resultado / Satis.', 
      cell: (t: TurnedWithDetails) => (
        <div>
          <p>{t.finalResult || '-'}</p>
          {t.satisfaction && <p className="text-xs text-muted-foreground">{t.satisfaction} / 5</p>}
        </div>
      )
    },
    { 
      header: 'Estado', 
      cell: (t: TurnedWithDetails) => {
        let variant: 'neutral' | 'success' | 'warning' | 'error' = 'neutral';
        if (t.state === TurnedState.CLOSED) variant = 'success';
        if (t.state === TurnedState.NEW_REQUEST) variant = 'success';
        if (t.state === TurnedState.FOLLOW_UP_PENDING) variant = 'error';
        if (t.state === TurnedState.IN_FOLLOW_UP) variant = 'warning';
        return <StatusBadge status={t.state} variant={variant} />;
      }
    },
    { 
      header: 'Acciones', 
      cell: (t: TurnedWithDetails) => (
        <Button variant="ghost" size="sm" onClick={() => navigate(`/turned/${t.id}`)}>
          <Eye className="w-4 h-4 mr-2" />
          Revisar
        </Button>
      )
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo TURNED" 
        description="Gestión de postventa, fidelización y reenganche de clientes atendidos."
      />

      <div className="flex flex-col gap-4 bg-card p-4 rounded-lg border">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs text-muted-foreground mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-7 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por persona, servicio o profesional..."
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
                <SelectItem value={TurnedState.FOLLOW_UP_PENDING}>Seguimiento Pendiente</SelectItem>
                <SelectItem value={TurnedState.IN_FOLLOW_UP}>En Seguimiento</SelectItem>
                <SelectItem value={TurnedState.CLOSED}>Cerrado</SelectItem>
                <SelectItem value={TurnedState.NEW_REQUEST}>Nueva Solicitud Creada</SelectItem>
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

      {filteredTurneds.length === 0 ? (
        <EmptyState 
          title="Sin resultados" 
          message="No se encontraron registros de postventa." 
        />
      ) : (
        <BaseTable 
          columns={columns} 
          data={filteredTurneds} 
          keyExtractor={(item) => item.id} 
        />
      )}
    </div>
  );
}
