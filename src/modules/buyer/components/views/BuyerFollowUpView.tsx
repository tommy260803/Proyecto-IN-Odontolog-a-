import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Clock,
  AlertTriangle,
  CheckCircle2,
  Phone,
  MessageSquare,
  Search,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Loader2,
  Calendar,
  Building2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { buyerService } from '../../services/buyer.service';
import type { FollowUpTask } from '../../types/buyer.types';

export const BuyerFollowUpView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<FollowUpTask[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'TODAS' | 'ALTA' | 'MEDIA' | 'BAJA'>('TODAS');
  const [onlyBreached, setOnlyBreached] = useState(false);

  useEffect(() => {
    loadFollowUps();
  }, []);

  const loadFollowUps = async () => {
    setLoading(true);
    try {
      const res = await buyerService.getFollowUps();
      setTasks(res.data || []);
    } catch (e) {
      console.error('Error cargando seguimiento:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSLA = async () => {
    setScanning(true);
    setScanMessage(null);
    try {
      const res = await buyerService.scanSLAAlerts();
      setScanMessage(`Escaneo finalizado: ${res.createdAlerts || 0} nuevas alertas generadas por SLA excedido.`);
      await loadFollowUps();
    } catch (e: any) {
      setScanMessage(e.message || 'Error al ejecutar escaneo de SLA');
    } finally {
      setScanning(false);
    }
  };

  const handleMarkResponded = async (opId: number) => {
    try {
      await buyerService.updateOpportunityStatus(opId, 'EN_CALIFICACION', 'Primer contacto orientativo realizado por asesor comercial.');
      await loadFollowUps();
    } catch (e: any) {
      alert(e.message || 'Error al registrar contacto');
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== 'TODAS' && t.prioridad !== priorityFilter) return false;
    if (onlyBreached && !t.isSlaBreached) return false;
    return true;
  });

  const totalBreached = tasks.filter((t) => t.isSlaBreached).length;

  return (
    <div className="space-y-5">
      {/* Cabecera operativa con escáner de SLA */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-sky-700" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Bandeja de Primera Respuesta &amp; SLA Comercial
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Garantiza el estándar de respuesta inicial &lt; 15 minutos en horario comercial para no perder intenciones de captación.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleScanSLA}
            disabled={scanning}
            className="h-9 text-xs border-slate-200 gap-1.5 text-slate-700 hover:bg-slate-50"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Escanear SLA Ahora
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadFollowUps}
            className="h-9 text-xs border-slate-200 text-slate-600"
          >
            Refrescar
          </Button>
        </div>
      </div>

      {scanMessage && (
        <div className="rounded-lg bg-sky-50 p-3 text-xs text-sky-800 border border-sky-200">
          {scanMessage}
        </div>
      )}

      {/* Métricas de seguimiento rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Total en Bandeja Activa</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{tasks.length}</div>
          <p className="text-[11px] text-slate-400 mt-0.5">Pendientes de calificación o primer contacto</p>
        </div>

        <div className={`rounded-xl border p-4 ${totalBreached > 0 ? 'border-rose-300 bg-rose-50/50' : 'border-slate-200 bg-white'}`}>
          <span className="text-xs font-medium text-slate-500">SLA Excedido (&gt; 15 min)</span>
          <div className={`text-2xl font-bold mt-1 ${totalBreached > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {totalBreached}
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">Requieren atención inmediata de recepción</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Prioridad Alta</span>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {tasks.filter((t) => t.prioridad === 'ALTA').length}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Alertas activas o retraso crítico</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase">Prioridad:</span>
        {(['TODAS', 'ALTA', 'MEDIA', 'BAJA'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
              priorityFilter === p
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        ))}

        <label className="ml-auto inline-flex items-center gap-1.5 cursor-pointer text-xs text-slate-700">
          <input
            type="checkbox"
            checked={onlyBreached}
            onChange={(e) => setOnlyBreached(e.target.checked)}
            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
          />
          <span>Mostrar solo SLA Vencido</span>
        </label>
      </div>

      {/* Lista de Tareas */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            ✓ No hay tareas pendientes en la bandeja de seguimiento con los filtros seleccionados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((t) => {
              const phoneClean = (t.persona?.numero || '').replace(/\D/g, '');
              const waUrl = phoneClean
                ? `https://wa.me/51${phoneClean}?text=${encodeURIComponent(
                    `Hola ${t.persona?.nombres || ''}, te saluda NexoSalud Dental respecto a tu consulta por ${t.servicioInteres}. ¿En qué podemos orientarte?`
                  )}`
                : null;

              return (
                <div
                  key={t.id_oportunidad}
                  className={`p-4 transition-colors ${
                    t.isSlaBreached ? 'bg-rose-50/30 hover:bg-rose-50/50' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          OP-{String(t.id_oportunidad).padStart(4, '0')}
                        </span>

                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            t.prioridad === 'ALTA'
                              ? 'bg-rose-100 text-rose-700'
                              : t.prioridad === 'MEDIA'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          Prioridad {t.prioridad}
                        </span>

                        {t.isSlaBreached && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            SLA VENCIDO ({t.minutosEspera} min)
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">
                          Canal: {t.canal} · Sede: {t.sedePreferida}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {t.persona ? `${t.persona.nombres} ${t.persona.apellidos}` : 'Sin nombre'}
                        </p>
                        <span className="font-mono text-xs text-slate-500">{t.persona?.numero}</span>
                      </div>

                      <p className="text-xs text-slate-600 line-clamp-2">
                        <strong className="text-slate-800">Interés:</strong> {t.servicioInteres} —{' '}
                        {t.necesidad_declarada || 'Sin detalle adicional'}
                      </p>

                      {t.alertasActivas > 0 && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-amber-700 font-medium">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>Tiene {t.alertasActivas} alerta(s) de captación asociada(s)</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:self-center shrink-0">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 shadow-xs"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          WhatsApp
                        </a>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkResponded(t.id_oportunidad)}
                        className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                        Marcar Atendido
                      </Button>

                      <Link
                        to={`/buyer/${t.id_oportunidad}`}
                        className="p-1.5 text-slate-400 hover:text-slate-700"
                        title="Ver Dossier Completo"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
