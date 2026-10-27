import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  Filter,
  Users,
  Clock,
  Phone,
  MessageSquare,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../../services/buyer.service';
import type { OpportunityItem, BuyerCatalogs } from '../../types/buyer.types';

export const BuyerOpportunitiesView: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [opportunities, setOpportunities] = useState<OpportunityItem[]>([]);
  const [catalogs, setCatalogs] = useState<BuyerCatalogs | null>(null);

  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODOS');
  const [sedeFilter, setSedeFilter] = useState<string>('TODAS');
  const [channelFilter, setChannelFilter] = useState<string>('TODOS');

  // Modal de cambio rápido de estado
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [selectedOp, setSelectedOp] = useState<OpportunityItem | null>(null);
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusMotivo, setStatusMotivo] = useState<string>('');
  const [statusSubmitting, setStatusSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [oppsRes, cats] = await Promise.all([
        buyerService.getOpportunities(),
        buyerService.getCatalogs(),
      ]);
      setOpportunities(oppsRes.data || []);
      setCatalogs(cats);
    } catch (e) {
      console.error('Error cargando oportunidades:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenStatusModal = (op: OpportunityItem) => {
    setSelectedOp(op);
    setNewStatus(op.estado_oportunidad);
    setStatusMotivo('');
    setStatusModalOpen(true);
  };

  const handleSaveStatus = async () => {
    if (!selectedOp || !newStatus) return;
    setStatusSubmitting(true);
    try {
      await buyerService.updateOpportunityStatus(selectedOp.id_oportunidad, newStatus, statusMotivo);
      setStatusModalOpen(false);
      await loadData();
    } catch (e: any) {
      alert(e.message || 'Error al actualizar estado');
    } finally {
      setStatusSubmitting(false);
    }
  };

  // Filtrado en memoria
  const filteredOpportunities = opportunities.filter((op) => {
    const term = searchTerm.toLowerCase().trim();
    const fullName = `${op.Persona?.nombres || ''} ${op.Persona?.apellidos || ''}`.toLowerCase();
    const phone = (op.Persona?.numero || '').toLowerCase();
    const idStr = `op-${op.id_oportunidad}`.toLowerCase();

    const matchesSearch = !term || fullName.includes(term) || phone.includes(term) || idStr.includes(term);
    const matchesStatus = statusFilter === 'TODOS' || op.estado_oportunidad === statusFilter;
    const matchesSede = sedeFilter === 'TODAS' || String(op.SedePreferida?.id_sede) === sedeFilter || op.sede === sedeFilter;
    const matchesChannel = channelFilter === 'TODOS' || String(op.Canal?.id_canal) === channelFilter || op.canal === channelFilter;

    return matchesSearch && matchesStatus && matchesSede && matchesChannel;
  });

  return (
    <div className="space-y-5">
      {/* Barra de Búsqueda y Filtros */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          {/* Input de Búsqueda */}
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Buscar por nombre, WhatsApp o OP-ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-xs rounded-lg border-slate-200"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-9 text-xs border-slate-200 text-slate-600 gap-1.5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </Button>

            <Link to="/buyer/nuevo">
              <Button size="sm" className="h-9 text-xs bg-slate-900 text-white gap-1.5 hover:bg-slate-800">
                <Plus className="h-3.5 w-3.5" />
                Nueva Captación
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros por chips / selectores */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Estado:
          </span>
          {['TODOS', 'NUEVO', 'EN_CALIFICACION', 'CALIFICADO', 'CONVERTIDO', 'DESCARTADO'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                statusFilter === st
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="h-7 text-[11px] rounded border border-slate-200 bg-white px-2 text-slate-700"
            >
              <option value="TODAS">Todas las Sedes</option>
              {catalogs?.sedes.map((s) => (
                <option key={s.id_sede} value={String(s.id_sede)}>
                  {s.nombre}
                </option>
              ))}
            </select>

            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              className="h-7 text-[11px] rounded border border-slate-200 bg-white px-2 text-slate-700"
            >
              <option value="TODOS">Todos los Canales</option>
              {catalogs?.canales.map((c) => (
                <option key={c.id_canal} value={String(c.id_canal)}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabla de Oportunidades */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No se encontraron oportunidades que coincidan con los criterios de búsqueda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3 px-4">ID / Registro</th>
                  <th className="py-3 px-4">Contacto / Paciente</th>
                  <th className="py-3 px-4">Interés / Declarado</th>
                  <th className="py-3 px-4">Canal / Sede</th>
                  <th className="py-3 px-4">Estado</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOpportunities.map((op) => {
                  const phoneClean = (op.Persona?.numero || '').replace(/\D/g, '');
                  const waUrl = phoneClean
                    ? `https://wa.me/51${phoneClean}?text=${encodeURIComponent(
                        `Hola ${op.Persona?.nombres}, te saludamos de NexoSalud Dental respecto a tu consulta.`
                      )}`
                    : null;

                  return (
                    <tr key={op.id_oportunidad} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3.5 px-4">
                        <span className="font-mono font-semibold text-slate-900 block">
                          OP-{String(op.id_oportunidad).padStart(4, '0')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(op.fecha_registro).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="font-medium text-slate-900">
                          {op.Persona ? `${op.Persona.nombres} ${op.Persona.apellidos}` : 'Sin nombre'}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[11px] text-slate-600">
                            {op.Persona?.numero || 'Sin teléfono'}
                          </span>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-emerald-600 hover:text-emerald-700 inline-flex items-center"
                              title="Contactar vía WhatsApp"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="text-slate-800 font-medium truncate">
                          {op.ServicioInteres?.nombre || op.servicio || 'Orientación General'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {op.necesidad_declarada || 'Consulta comercial'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <div className="text-slate-800 truncate">
                          {op.SedePreferida?.nombre || op.sede || 'No asignada'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {op.Canal?.nombre || op.canal || 'Web'}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => handleOpenStatusModal(op)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold hover:opacity-80 transition-opacity ${
                            op.estado_oportunidad === 'CONVERTIDO'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : op.estado_oportunidad === 'EN_CALIFICACION'
                              ? 'bg-sky-50 text-sky-700 border border-sky-200'
                              : op.estado_oportunidad === 'CALIFICADO'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : op.estado_oportunidad === 'DESCARTADO'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span>{op.estado_oportunidad}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/buyer/${op.id_oportunidad}`}
                            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            Dossier 360°
                            <ChevronRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Actualización de Estado */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-slate-900">
              Actualizar Estado de Oportunidad OP-{selectedOp?.id_oportunidad}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Contacto: {selectedOp?.Persona?.nombres} {selectedOp?.Persona?.apellidos}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">Nuevo Estado:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800"
              >
                <option value="NUEVO">NUEVO (Recién captado)</option>
                <option value="EN_CALIFICACION">EN_CALIFICACION (En conversación inicial)</option>
                <option value="CALIFICADO">CALIFICADO (Interés confirmado)</option>
                <option value="DESCARTADO">DESCARTADO (No interesado / Número erróneo)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Motivo u observación del cambio:
              </label>
              <textarea
                rows={3}
                placeholder="Indica la razón de la actualización..."
                value={statusMotivo}
                onChange={(e) => setStatusMotivo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveStatus}
              disabled={statusSubmitting}
              className="text-xs bg-slate-900 text-white hover:bg-slate-800"
            >
              {statusSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar Estado'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
