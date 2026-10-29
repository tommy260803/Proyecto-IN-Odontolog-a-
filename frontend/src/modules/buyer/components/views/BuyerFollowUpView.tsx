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
  Flame,
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
      setScanMessage(`Escaneo finalizado: ${res.createdAlerts || 0} nuevas alertas generadas por demora SLA.`);
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
    <div className="space-y-6">
      {/* Cabecera operativa con acento formal Crimson/Rose */}
      <div className="rounded-2xl border-l-4 border-rose-600 border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
              <Clock className="h-5 w-5" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Bandeja de Primera Respuesta &amp; Control de SLAs
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Monitorea el estándar estricto de primera respuesta (&lt; 15 min) para evitar pérdida de interés en prospectos recién captados.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            onClick={handleScanSLA}
            disabled={scanning}
            className="h-9 text-xs bg-rose-600 text-white hover:bg-rose-700 gap-1.5 rounded-xl shadow-xs"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flame className="h-3.5 w-3.5" />}
            Escanear SLA en Base de Datos
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={loadFollowUps}
            className="h-9 text-xs border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
          >
            Refrescar
          </Button>
        </div>
      </div>

      {scanMessage && (
        <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-900 border border-rose-200 font-medium">
          {scanMessage}
        </div>
      )}

      {/* Métricas de seguimiento rápido */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total en Bandeja Activa</span>
          <div className="text-3xl font-extrabold text-slate-900 mt-2">{tasks.length}</div>
          <p className="text-xs text-slate-400 mt-1">Pendientes de calificación o llamada inicial</p>
        </div>

        <div className={`rounded-2xl border p-5 shadow-xs ${totalBreached > 0 ? 'border-rose-300 bg-rose-50/60' : 'border-slate-200/90 bg-white'}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700">SLA Vencido (&gt; 15 min)</span>
            {totalBreached > 0 && <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 animate-ping" />}
          </div>
          <div className={`text-3xl font-extrabold mt-2 ${totalBreached > 0 ? 'text-rose-600 font-mono' : 'text-slate-900'}`}>
            {totalBreached}
          </div>
          <p className="text-xs text-rose-800 font-medium mt-1">Requieren contacto urgente por WhatsApp o llamada</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Prioridad Alta</span>
          <div className="text-3xl font-extrabold text-amber-600 mt-2">
            {tasks.filter((t) => t.prioridad === 'ALTA').length}
          </div>
          <p className="text-xs text-slate-400 mt-1">Con alertas activas o tiempo prolongado</p>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2 text-xs bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Prioridad:</span>
        {(['TODAS', 'ALTA', 'MEDIA', 'BAJA'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPriorityFilter(p)}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition-colors ${
              priorityFilter === p
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {p}
          </button>
        ))}

        <label className="ml-auto inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pr-1">
          <input
            type="checkbox"
            checked={onlyBreached}
            onChange={(e) => setOnlyBreached(e.target.checked)}
            className="rounded-md border-slate-300 text-rose-600 focus:ring-rose-600 h-4 w-4 cursor-pointer"
          />
          <span>Mostrar únicamente SLA Vencido (&gt; 15 min)</span>
        </label>
      </div>

      {/* Lista de Tareas */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500">
            ✓ No hay tareas pendientes en la cola con los filtros seleccionados.
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
                  className={`p-5 transition-colors ${
                    t.isSlaBreached ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50/70'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5 max-w-xl">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                          OP-{String(t.id_oportunidad).padStart(4, '0')}
                        </span>

                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.prioridad === 'ALTA'
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : t.prioridad === 'MEDIA'
                              ? 'bg-amber-100 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          Prioridad {t.prioridad}
                        </span>

                        {t.isSlaBreached && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-600 text-white shadow-xs animate-pulse">
                            <Clock className="h-3 w-3" />
                            SLA VENCIDO ({t.minutosEspera} min de espera)
                          </span>
                        )}

                        <span className="text-[11px] text-slate-400">
                          {t.canal} · {t.sedePreferida}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">
                          {t.persona ? `${t.persona.nombres} ${t.persona.apellidos}` : 'Sin nombre'}
                        </p>
                        <span className="font-mono text-xs text-slate-500 font-medium">{t.persona?.numero}</span>
                      </div>

                      <p className="text-xs text-slate-600 leading-snug">
                        <strong className="text-slate-800">Interés:</strong> {t.servicioInteres} —{' '}
                        {t.necesidad_declarada || 'Sin detalle adicional'}
                      </p>

                      {t.alertasActivas > 0 && (
                        <div className="pt-1 flex items-center gap-1.5 text-[11px] text-amber-800 font-bold">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                          <span>{t.alertasActivas} alerta(s) de captación activa(s)</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2.5 sm:self-center shrink-0">
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#25D366] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#20BD5A] shadow-xs transition-colors"
                        >
                          <MessageSquare className="h-3.5 w-3.5 fill-white" />
                          WhatsApp
                        </a>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMarkResponded(t.id_oportunidad)}
                        className="text-xs border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mr-1" />
                        Marcar Atendido
                      </Button>

                      <Link
                        to={`/buyer/${t.id_oportunidad}`}
                        className="p-2 text-slate-400 hover:text-slate-800"
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
