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
import { useTurneds } from '../hooks/useTurnedQueries';
import { TurnedState } from '@/domain/enums';
import { Search, Eye } from 'lucide-react';
import { format, parseISO, isAfter, isBefore } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TurnedWithDetails } from '@/application/use-cases/turned';
import { calculateT1, calculateT2, calculateT3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { TurnedDetailModal } from '../components/TurnedDetailModal';

export default function TurnedPage() {
  const { data: turneds, isLoading, isError } = useTurneds();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [selectedTurnedId, setSelectedTurnedId] = useState<string | null>(null);

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
      cell: (t: TurnedWithDetails) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{t.person.firstName} {t.person.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{t.person.documentNumber || 'Sin Doc'}</p>
        </div>
      )
    },
    { 
      header: 'Servicio Finalizado', 
      cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{t.lead.requestedServiceId}</span>
    },
    { 
      header: 'Fecha Atención', 
      cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{format(new Date(t.reservation.date), 'dd MMM yyyy', { locale: es })}</span>
    },
    { 
      header: 'Próximo Seguimiento', 
      cell: (t: TurnedWithDetails) => <span className="text-slate-700 dark:text-slate-300">{t.nextContactDate ? format(new Date(t.nextContactDate), 'dd MMM yyyy', { locale: es }) : 'No agendado'}</span>
    },
    { 
      header: 'Resultado / Satis.', 
      cell: (t: TurnedWithDetails) => (
        <div>
          <p className="text-slate-900 dark:text-slate-200">{t.finalResult || '-'}</p>
          {t.satisfaction && <p className="text-xs text-slate-500 dark:text-slate-400">{t.satisfaction} / 5</p>}
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
        <Button variant="ghost" size="sm" onClick={() => setSelectedTurnedId(t.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
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

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Buscar</span>
            <Search className="absolute left-2.5 top-8 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Buscar por persona, servicio o profesional..."
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
                <SelectItem value={TurnedState.FOLLOW_UP_PENDING}>Seguimiento Pendiente</SelectItem>
                <SelectItem value={TurnedState.IN_FOLLOW_UP}>En Seguimiento</SelectItem>
                <SelectItem value={TurnedState.CLOSED}>Cerrado</SelectItem>
                <SelectItem value={TurnedState.NEW_REQUEST}>Nueva Solicitud Creada</SelectItem>
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

      {/* Modal Detalle de Postventa y Seguimiento */}
      <TurnedDetailModal 
        turnedId={selectedTurnedId} 
        isOpen={!!selectedTurnedId} 
        onClose={() => setSelectedTurnedId(null)} 
      />
    </div>
  );
}
