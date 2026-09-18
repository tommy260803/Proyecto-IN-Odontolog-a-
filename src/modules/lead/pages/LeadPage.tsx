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
import { useLeads } from '../hooks/useLeadQueries';
import { LeadState } from '@/domain/enums';
import { Search, Eye, Trash2, X, RotateCcw } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LeadWithDetails } from '@/application/use-cases/lead';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { calculateL1, calculateL2, calculateL3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LeadNegotiationModal } from '../components/LeadNegotiationModal';

export default function LeadPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: leads, isLoading, isError } = useLeads();
  const journeys: any[] = [];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeadWithDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredLeads = useMemo(() => {
    return leads?.filter((l: any) => {
      const term = searchTerm.trim().toLowerCase();
      let matchSearch = true;
      if (term) {
        const firstName = l.person?.firstName || '';
        const lastName = l.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (l.person?.documentNumber || '').toLowerCase();
        const email = (l.person?.email || '').toLowerCase();
        const phone = (l.person?.phone || '').toLowerCase();
        const service = (l.requestedServiceId || '').toLowerCase();
        const pref = (l.declaredPreferences || l.buyer?.preferences || '').toLowerCase();
        const id = (l.id || '').toLowerCase();
        const buyerId = (l.buyerId || '').toLowerCase();
        const state = (l.state || '').toLowerCase();

        matchSearch = 
          fullName.includes(term) ||
          firstName.toLowerCase().includes(term) ||
          lastName.toLowerCase().includes(term) ||
          doc.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          service.includes(term) ||
          pref.includes(term) ||
          id.includes(term) ||
          buyerId.includes(term) ||
          state.includes(term);
      }

      const matchStatus = statusFilter === 'ALL' || l.state === statusFilter;
      
      let matchDate = true;
      if (startDate && l.createdAt) {
        const start = startOfDay(parseISO(l.createdAt));
        matchDate = matchDate && !isBefore(parseISO(l.createdAt), start);
      }
      if (endDate && l.createdAt) {
        const end = endOfDay(parseISO(endDate));
        matchDate = matchDate && !isAfter(parseISO(l.createdAt), end);
      }
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [leads, searchTerm, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL' || startDate || endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

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
      cell: (l: LeadWithDetails) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{l.person.firstName} {l.person.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{l.person.documentNumber || l.person.phone || 'Sin Doc'}</p>
        </div>
      )
    },
    { 
      header: 'Servicio Solicitado', 
      cell: (l: LeadWithDetails) => <span className="text-slate-700 dark:text-slate-300">{l.requestedServiceId || '-'}</span> 
    },
    { 
      header: 'Preferencia', 
      cell: (l: LeadWithDetails) => <span className="text-slate-700 dark:text-slate-300">{l.declaredPreferences || l.buyer.preferences || '-'}</span> 
    },
    { 
      header: 'F. Solicitud', 
      cell: (l: LeadWithDetails) => <span className="text-slate-700 dark:text-slate-300">{format(new Date(l.createdAt), 'dd MMM yyyy', { locale: es })}</span> 
    },
    { 
      header: 'Reserva', 
      cell: (l: LeadWithDetails) => <span className="text-slate-700 dark:text-slate-300">{l.reservationId ? 'Sí' : 'No'}</span>
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => setSelectedLeadId(l.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            <Eye className="w-4 h-4 mr-1" />
            Negociar
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
            onClick={() => setDeleteTarget(l)}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </Button>
        </div>
      )
    },
  ];

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await fetch(`http://localhost:3001/api/lead/${deleteTarget.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
    await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LEADS] });
    toast({ title: 'Lead Eliminado', description: `La oportunidad de ${deleteTarget.person.firstName} ${deleteTarget.person.lastName} ha sido eliminada.` });
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo LEAD" 
        description="Gestión de solicitudes concretas y negociación de alternativas."
      />

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Búsqueda en Tiempo Real</span>
              <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                {filteredLeads.length} {filteredLeads.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por paciente, documento, teléfono, servicio, ID..."
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
                <SelectItem value={LeadState.IN_NEGOTIATION}>En negociación</SelectItem>
                <SelectItem value={LeadState.ALTERNATIVE_SELECTED}>Alternativa select.</SelectItem>
                <SelectItem value={LeadState.PAYMENT_REQUESTED}>Pago solicitado</SelectItem>
                <SelectItem value={LeadState.CONVERTED}>Convertido</SelectItem>
                <SelectItem value={LeadState.LOST}>Perdido</SelectItem>
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

      {/* Modal Mesa de Negociación */}
      <LeadNegotiationModal 
        leadId={selectedLeadId} 
        isOpen={!!selectedLeadId} 
        onClose={() => setSelectedLeadId(null)} 
      />

      {/* Modal Elegante de Confirmación de Eliminación */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="¿Eliminar oportunidad (LEAD)?"
        description={`Esta acción eliminará el registro de negociación y solicitudes del paciente ${deleteTarget?.person.firstName} ${deleteTarget?.person.lastName}.`}
        confirmText="Sí, Eliminar LEAD"
        cancelText="Cancelar"
        variant="destructive"
      />
    </div>
  );
}
