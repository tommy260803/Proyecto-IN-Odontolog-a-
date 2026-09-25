import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/shared/components/data-display/PageHeader';
import { BaseTable } from '@/shared/components/data-display/BaseTable';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useBuyers, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { BuyerState } from '@/domain/enums';
import { Plus, Search, Eye, Trash2, X, RotateCcw, ArrowRight, Loader2, BarChart3 } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leadUseCases } from '@/application/use-cases/lead';
import { QUERY_KEYS } from '@/shared/constants';
import { calculateB1, calculateB2, calculateB3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { BuyerCreateModal } from '../components/BuyerCreateModal';
import { BuyerDetailModal } from '../components/BuyerDetailModal';

import type { BuyerWithPerson } from '@/application/use-cases/buyer';

export default function BuyerPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: buyers, isLoading, isError } = useBuyers();
  const convertBuyer = useConvertBuyerToLead();
  const { data: leads = [] } = useQuery({ queryKey: [QUERY_KEYS.LEADS], queryFn: () => leadUseCases.getAllLeads() });
  const journeys: any[] = [];

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Modales
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedBuyerId, setSelectedBuyerId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuyerWithPerson | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [convertTarget, setConvertTarget] = useState<BuyerWithPerson | null>(null);

  const filteredBuyers = useMemo(() => {
    return buyers?.filter((b: any) => {
      const term = searchTerm.trim().toLowerCase();
      
      let matchSearch = true;
      if (term) {
        const firstName = b.person?.firstName || '';
        const lastName = b.person?.lastName || '';
        const fullName = `${firstName} ${lastName}`.toLowerCase();
        const doc = (b.person?.documentNumber || '').toLowerCase();
        const email = (b.person?.email || '').toLowerCase();
        const phone = (b.person?.phone || '').toLowerCase();
        const channel = (b.channel || '').toLowerCase();
        const source = (b.attractionSource || '').toLowerCase();
        const service = (b.serviceOfInterestId || '').toLowerCase();
        const id = (b.id || '').toLowerCase();
        const state = (b.state || '').toLowerCase();

        matchSearch = 
          fullName.includes(term) ||
          firstName.toLowerCase().includes(term) ||
          lastName.toLowerCase().includes(term) ||
          doc.includes(term) ||
          email.includes(term) ||
          phone.includes(term) ||
          channel.includes(term) ||
          source.includes(term) ||
          service.includes(term) ||
          id.includes(term) ||
          state.includes(term);
      }

      const matchStatus = statusFilter === 'ALL' || b.state === statusFilter;
      
      let matchDate = true;
      if (startDate && b.createdAt) {
        const start = startOfDay(parseISO(startDate));
        matchDate = matchDate && !isBefore(parseISO(b.createdAt), start);
      }
      if (endDate && b.createdAt) {
        const end = endOfDay(parseISO(endDate));
        matchDate = matchDate && !isAfter(parseISO(b.createdAt), end);
      }
      
      return matchSearch && matchStatus && matchDate;
    }) || [];
  }, [buyers, searchTerm, statusFilter, startDate, endDate]);

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'ALL' || startDate || endDate);

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setStartDate('');
    setEndDate('');
  };

  const indicators = useMemo(() => {
    return [
      calculateB1(filteredBuyers, journeys),
      calculateB2(filteredBuyers),
      calculateB3(filteredBuyers, leads)
    ];
  }, [filteredBuyers, journeys, leads]);

  if (isLoading) return <LoadingState />;
  if (isError) return <ErrorState />;

  const columns = [
    { 
      header: 'Persona', 
      cell: (b: BuyerWithPerson) => (
        <div>
          <p className="font-semibold text-slate-900 dark:text-white">{b.person.firstName} {b.person.lastName}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{b.person.documentNumber || 'Sin Doc'}</p>
        </div>
      ) 
    },
    { header: 'Canal', cell: (b: BuyerWithPerson) => <span className="text-slate-700 dark:text-slate-300">{b.channel}</span> },
    { header: 'Fuente', cell: (b: BuyerWithPerson) => <span className="text-slate-700 dark:text-slate-300">{b.attractionSource}</span> },
    { header: 'Servicio', cell: (b: BuyerWithPerson) => <span className="text-slate-700 dark:text-slate-300">{b.serviceOfInterest || '-'}</span> },
    { 
      header: 'Fecha', 
      cell: (b: BuyerWithPerson) => <span className="text-slate-700 dark:text-slate-300">{format(new Date(b.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}</span>
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
        <div className="flex items-center gap-1">
          {b.state !== BuyerState.CONVERTED && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setConvertTarget(b)}
              disabled={convertBuyer.isPending}
              className="text-teal-700 dark:text-teal-400 hover:text-teal-800 hover:bg-teal-50 dark:hover:bg-teal-950/40 rounded-lg text-xs font-semibold px-2 py-1 h-8 flex items-center gap-1"
              title="Convertir a LEAD"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">A LEAD</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setSelectedBuyerId(b.id)} className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800">
            <Eye className="w-4 h-4 mr-1" />
            Ver
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg"
            onClick={() => setDeleteTarget(b)}
          >
            <Trash2 className="w-4 h-4 text-rose-500" />
          </Button>
        </div>
      )
    },
  ];

  const handleConfirmConvert = () => {
    if (!convertTarget) return;
    convertBuyer.mutate(convertTarget.id, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: `El paciente ${convertTarget.person.firstName} ha sido transferido a la etapa LEAD.` });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setConvertTarget(null);
      },
      onError: (err) => {
        toast({ title: 'Error al convertir', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    try {
      await fetch(`${API_URL}/buyer/${deleteTarget.id}`, { method: 'DELETE' });
    } catch (e) {
      console.error(e);
    }
    await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    toast({ title: 'Eliminado con éxito', description: `El paciente ${deleteTarget.person.firstName} ha sido removido del sistema.` });
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader 
        title="Módulo BUYER" 
        description="Gestión de interesados iniciales y captación de potenciales leads."
        actions={
          <div className="flex items-center gap-2">
            <Link
              to="/reportes?tab=buyer"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reporte DataMart
            </Link>
            <Button onClick={() => setIsCreateOpen(true)} className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl shadow-sm text-xs">
              <Plus className="w-4 h-4 mr-1.5" />
              Registrar BUYER
            </Button>
          </div>
        }
      />

      <div className="flex flex-col gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200/90 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="relative flex-1 w-full">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Búsqueda en Tiempo Real</span>
              <span className="text-[11px] font-medium text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                {filteredBuyers.length} {filteredBuyers.length === 1 ? 'coincidencia' : 'coincidencias'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
              <Input
                placeholder="Buscar por nombre, documento, correo, teléfono, canal, ID..."
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
          <div className="w-full sm:w-[150px]">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1 block">Estado</span>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="rounded-xl bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white text-xs">
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value={BuyerState.NEW}>Nuevo</SelectItem>
                <SelectItem value={BuyerState.CONTACTED}>Contactado</SelectItem>
                <SelectItem value={BuyerState.CONVERTED}>Convertido</SelectItem>
                <SelectItem value={BuyerState.DISCARDED}>Descartado</SelectItem>
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

      {/* Modal de Creación */}
      <BuyerCreateModal 
        isOpen={isCreateOpen} 
        onClose={() => setIsCreateOpen(false)} 
      />

      {/* Modal de Detalle / Edición / Conversión */}
      <BuyerDetailModal 
        buyerId={selectedBuyerId} 
        isOpen={!!selectedBuyerId} 
        onClose={() => setSelectedBuyerId(null)} 
      />

      {/* Modal Elegante de Confirmación de Conversión Rápida */}
      <ConfirmationDialog
        isOpen={!!convertTarget}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConfirmConvert}
        isLoading={convertBuyer.isPending}
        title="¿Convertir Prospecto a LEAD?"
        description={`Esta acción transferirá a ${convertTarget?.person.firstName} ${convertTarget?.person.lastName} al módulo de LEAD para abrir la mesa de negociación.`}
        confirmText="Sí, Convertir a LEAD"
        cancelText="Cancelar"
        variant="default"
      />

      {/* Modal Elegante de Confirmación de Eliminación */}
      <ConfirmationDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        isLoading={isDeleting}
        title="¿Eliminar registro de paciente?"
        description={`Esta acción eliminará de forma permanente el registro de ${deleteTarget?.person.firstName} ${deleteTarget?.person.lastName} de la etapa BUYER y su historial asociado.`}
        confirmText="Sí, Eliminar Paciente"
        cancelText="Conservar Registro"
        variant="destructive"
      />
    </div>
  );
}
