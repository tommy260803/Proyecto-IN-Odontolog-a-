import { useState, useMemo, useEffect } from 'react';
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
import { useLeads } from '../hooks/useLeadQueries';
import { LeadState } from '@/domain/enums';
import { Search, Eye, Trash2, X, RotateCcw, Zap, Flame, Clock, Sparkles, UserX, BarChart3 } from 'lucide-react';
import { format, parseISO, isAfter, isBefore, startOfDay, endOfDay, differenceInMinutes } from 'date-fns';
import { es } from 'date-fns/locale';
import type { LeadWithDetails } from '@/application/use-cases/lead';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { calculateL1, calculateL2, calculateL3 } from '@/domain/indicators';
import { IndicatorCard } from '@/shared/components/data-display/IndicatorCard';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LeadNegotiationModal } from '../components/LeadNegotiationModal';
import { leadService } from '../services/lead.service';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

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
  const [abandonTarget, setAbandonTarget] = useState<LeadWithDetails | null>(null);
  const [abandonReason, setAbandonReason] = useState('Precio / Presupuesto elevado');
  const [isAbandoning, setIsAbandoning] = useState(false);

  // Escuchar si Canva nos redirigió con ?code= para autorizar OAuth de inmediato
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      toast({
        title: '🔄 Conectando con Canva Connect...',
        description: 'Intercambiando código de autorización oficial.',
      });
      leadService.exchangeCanvaCode(code)
        .then(() => {
          toast({
            title: '🎉 ¡Canva Oficial Conectado!',
            description: 'Las credenciales de diseño y autofill están listas en el servidor.',
          });
          window.history.replaceState({}, document.title, window.location.pathname);
        })
        .catch((err: any) => {
          console.error('Error al intercambiar código:', err);
          toast({
            title: 'Error de Autorización en Canva',
            description: 'El código expiró o no se pudo intercambiar. Puedes volver a hacer clic en Conectar Canva.',
            variant: 'destructive',
          });
        });
    }
  }, []);

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
      header: 'Prioridad IA', 
      cell: (l: LeadWithDetails) => {
        if (l.state === LeadState.CONVERTED) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center gap-1 w-fit">
              ✓ Trato Cerrado
            </span>
          );
        }
        if (l.state === LeadState.LOST) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 flex items-center gap-1 w-fit">
              Descartado
            </span>
          );
        }

        const createdAtDate = l.createdAt ? parseISO(l.createdAt) : new Date();
        const minsElapsed = Math.abs(differenceInMinutes(new Date(), createdAtDate));
        const isUrgentResponse = minsElapsed <= 15;
        const painPref = (l.declaredPreferences || l.buyer?.preferences || '').toLowerCase();
        const hasUrgentPain = painPref.includes('dolor') || painPref.includes('urgente') || painPref.includes('emergencia');

        if (isUrgentResponse || hasUrgentPain) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center gap-1 w-fit" title={`Tiempo de espera: ${minsElapsed} min. KPI L2 <= 15m`}>
              <Flame className="w-2.5 h-2.5 text-rose-500" />
              {hasUrgentPain ? '⚡ Urgencia Clínica' : '🔥 <15m Respuesta'}
            </span>
          );
        }

        if (l.reservationId || l.selectedAlternativeId) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center gap-1 w-fit">
              <Zap className="w-2.5 h-2.5 text-teal-600" />
              Oferta Aceptada
            </span>
          );
        }

        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center gap-1 w-fit">
            <Clock className="w-2.5 h-2.5 text-sky-500" />
            En Negociación
          </span>
        );
      }
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
          {l.state !== LeadState.LOST && l.state !== LeadState.CONVERTED && (
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-lg text-xs"
              title="Registrar Abandono / Cierre sin éxito (L3)"
              onClick={() => {
                setAbandonReason('Precio / Presupuesto elevado');
                setAbandonTarget(l);
              }}
            >
              <UserX className="w-4 h-4 text-amber-500 mr-1" />
              Abandonar
            </Button>
          )}
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

  const handleConfirmAbandon = async () => {
    if (!abandonTarget) return;
    setIsAbandoning(true);
    try {
      await leadService.abandonLead(abandonTarget.id, abandonReason);
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      await queryClient.refetchQueries({ queryKey: [QUERY_KEYS.LEADS] });
      toast({
        title: 'Negociación Finalizada: Abandonado',
        description: `Se registró el abandono de ${abandonTarget.person.firstName} ${abandonTarget.person.lastName}. Motivo: ${abandonReason}.`,
      });
    } catch (e) {
      console.error(e);
      toast({
        title: 'Error',
        description: 'No se pudo registrar el abandono del lead.',
        variant: 'destructive',
      });
    } finally {
      setIsAbandoning(false);
      setAbandonTarget(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    try {
      await fetch(`${API_URL}/lead/${deleteTarget.id}`, { method: 'DELETE' });
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
        actions={
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                const url = await leadService.getCanvaAuthUrl();
                window.location.href = url;
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/80 text-purple-700 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100 border border-purple-200 dark:border-purple-800 text-xs font-bold transition-all shadow-none"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Conectar Canva</span>
            </Button>
            <Link
              to="/reportes?tab=lead"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-all shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5" />
              Reporte DataMart
            </Link>
          </div>
        }
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

      {/* Modal de Registro de Abandono (L3) */}
      {abandonTarget && (
        <Dialog open={!!abandonTarget} onOpenChange={(open) => !open && setAbandonTarget(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <UserX className="w-5 h-5 text-amber-600" />
                Registrar Abandono de Negociación (L3)
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2 text-sm text-slate-600 dark:text-slate-300">
              <p>
                ¿Deseas finalizar la negociación con el paciente{' '}
                <strong className="text-slate-900 dark:text-white">
                  {abandonTarget.person.firstName} {abandonTarget.person.lastName}
                </strong>{' '}
                como <strong>Abandonado</strong>?
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Motivo de Cierre / Pérdida:
                </label>
                <Select value={abandonReason} onValueChange={setAbandonReason}>
                  <SelectTrigger className="w-full text-xs">
                    <SelectValue placeholder="Selecciona un motivo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Precio / Presupuesto elevado">Precio / Presupuesto elevado</SelectItem>
                    <SelectItem value="Incompatibilidad de horario o turnos">Incompatibilidad de horario o turnos</SelectItem>
                    <SelectItem value="Distancia o preferencia de otra sede">Distancia o preferencia de otra sede</SelectItem>
                    <SelectItem value="Sin respuesta tras múltiples contactos">Sin respuesta tras múltiples contactos</SelectItem>
                    <SelectItem value="Optó por otra clínica dental">Optó por otra clínica dental</SelectItem>
                    <SelectItem value="Desistimiento voluntario del paciente">Desistimiento voluntario del paciente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 rounded-xl border border-amber-200/80 dark:border-amber-900/50 space-y-1">
                <p className="font-semibold">Impacto en Indicadores:</p>
                <p>
                  Esta acción conmutará el resultado final a <strong>Abandonado</strong> e impactará directamente en la fórmula de <strong>L3. Tasa de abandono de LEADs</strong>:
                </p>
                <p className="font-mono text-[10px] text-amber-700 dark:text-amber-400 bg-amber-100/60 dark:bg-amber-900/40 p-1 rounded">
                  (LEADs Abandonados / Total LEADs con resultado final) × 100
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setAbandonTarget(null)} disabled={isAbandoning}>
                Cancelar
              </Button>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleConfirmAbandon}
                disabled={isAbandoning}
              >
                {isAbandoning ? 'Registrando...' : 'Confirmar Abandono'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
