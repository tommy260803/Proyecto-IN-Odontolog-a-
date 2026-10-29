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
  Building2,
  Calendar,
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

  const countByStatus = (st: string) => opportunities.filter((o) => o.estado_oportunidad === st).length;

  return (
    <div className="space-y-6">
      {/* Barra de Búsqueda y Filtros con acento Ocean Blue */}
      <div className="rounded-2xl border-l-4 border-blue-600 border border-slate-200/90 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="h-4.5 w-4.5 text-blue-600" />
              Pipeline de Oportunidades &amp; Captación
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {opportunities.length} contactos registrados · {filteredOpportunities.length} resultados filtrados
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Buscar por nombre, celular u OP-XXXX..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs rounded-xl border-slate-200 bg-slate-50/50"
              />
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="h-9 text-xs border-slate-200 text-slate-600 gap-1.5 rounded-xl hover:bg-slate-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>

            <Link to="/buyer/nuevo">
              <Button size="sm" className="h-9 text-xs bg-blue-700 text-white gap-1.5 hover:bg-blue-800 rounded-xl shadow-xs">
                <Plus className="h-3.5 w-3.5" />
                Nueva Captación
              </Button>
            </Link>
          </div>
        </div>

        {/* Filtros por chips con contadores numéricos */}
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100 text-xs">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            Estado:
          </span>
          {[
            { id: 'TODOS', label: 'Todos', count: opportunities.length },
            { id: 'NUEVO', label: 'Nuevo', count: countByStatus('NUEVO') },
            { id: 'EN_CALIFICACION', label: 'En Calificación', count: countByStatus('EN_CALIFICACION') },
            { id: 'CALIFICADO', label: 'Calificado', count: countByStatus('CALIFICADO') },
            { id: 'CONVERTIDO', label: 'Convertido LEAD', count: countByStatus('CONVERTIDO') },
            { id: 'DESCARTADO', label: 'Descartado', count: countByStatus('DESCARTADO') },
          ].map((st) => (
            <button
              key={st.id}
              onClick={() => setStatusFilter(st.id)}
              className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === st.id
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>{st.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${statusFilter === st.id ? 'bg-blue-900/50 text-white' : 'bg-slate-200 text-slate-700'}`}>
                {st.count}
              </span>
            </button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <select
              value={sedeFilter}
              onChange={(e) => setSedeFilter(e.target.value)}
              className="h-8 text-xs rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
              className="h-8 text-xs rounded-xl border border-slate-200 bg-white px-2.5 text-slate-700 font-medium"
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
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredOpportunities.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500">
            No se encontraron oportunidades con los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="py-3.5 px-5">ID / Registro</th>
                  <th className="py-3.5 px-5">Contacto / Paciente</th>
                  <th className="py-3.5 px-5">Interés &amp; Consulta</th>
                  <th className="py-3.5 px-5">Canal / Sede</th>
                  <th className="py-3.5 px-5">Estado</th>
                  <th className="py-3.5 px-5 text-right">Acciones</th>
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
                    <tr key={op.id_oportunidad} className="hover:bg-blue-50/20 transition-colors">
                      <td className="py-3.5 px-5">
                        <span className="font-mono font-bold text-slate-900 block">
                          OP-{String(op.id_oportunidad).padStart(4, '0')}
                        </span>
                        <span className="text-[11px] text-slate-400">
                          {new Date(op.fecha_registro).toLocaleString('es-PE', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-900">
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
                              className="text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1 font-semibold text-[11px] bg-emerald-50 px-1.5 py-0.5 rounded"
                              title="Escribir por WhatsApp"
                            >
                              <MessageSquare className="h-3 w-3" />
                              <span>WhatsApp</span>
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-5 max-w-xs">
                        <div className="text-slate-900 font-bold truncate">
                          {op.ServicioInteres?.nombre || op.servicio || 'Orientación General'}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mt-0.5">
                          {op.necesidad_declarada || 'Consulta comercial'}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <div className="text-slate-800 font-medium truncate">
                          {op.SedePreferida?.nombre || op.sede || 'No asignada'}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {op.Canal?.nombre || op.canal || 'Web'}
                        </div>
                      </td>

                      <td className="py-3.5 px-5">
                        <button
                          onClick={() => handleOpenStatusModal(op)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold hover:opacity-85 transition-opacity ${
                            op.estado_oportunidad === 'CONVERTIDO'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                              : op.estado_oportunidad === 'EN_CALIFICACION'
                              ? 'bg-sky-100 text-sky-800 border border-sky-300'
                              : op.estado_oportunidad === 'CALIFICADO'
                              ? 'bg-indigo-100 text-indigo-800 border border-indigo-300'
                              : op.estado_oportunidad === 'DESCARTADO'
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-amber-100 text-amber-800 border border-amber-300'
                          }`}
                        >
                          <span>{op.estado_oportunidad}</span>
                        </button>
                      </td>

                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/buyer/${op.id_oportunidad}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                        >
                          Dossier 360°
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
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
            <DialogTitle className="text-sm font-bold text-slate-900">
              Actualizar Estado — OP-{selectedOp?.id_oportunidad}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Contacto: {selectedOp?.Persona?.nombres} {selectedOp?.Persona?.apellidos}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Nuevo Estado Comercial:</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-medium"
              >
                <option value="NUEVO">NUEVO (Recién captado)</option>
                <option value="EN_CALIFICACION">EN_CALIFICACION (En conversación inicial)</option>
                <option value="CALIFICADO">CALIFICADO (Interés confirmado)</option>
                <option value="DESCARTADO">DESCARTADO (No interesado / Contacto no utilizable)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Observación o motivo del cambio:
              </label>
              <textarea
                rows={3}
                placeholder="Indica la razón de la actualización comercial..."
                value={statusMotivo}
                onChange={(e) => setStatusMotivo(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setStatusModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSaveStatus}
              disabled={statusSubmitting}
              className="text-xs bg-blue-700 text-white hover:bg-blue-800 rounded-xl"
            >
              {statusSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Guardar Estado'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
