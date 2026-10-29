import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  ExternalLink,
  Loader2,
  FileText,
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
import type { ImpulseAlertItem } from '../../types/buyer.types';

export const BuyerAlertsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<ImpulseAlertItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<'TODAS' | 'ACTIVA' | 'RESUELTA'>('ACTIVA');
  const [scanning, setScanning] = useState(false);

  // Modal de resolución
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<ImpulseAlertItem | null>(null);
  const [motivoResolucion, setMotivoResolucion] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = {};
      if (statusFilter !== 'TODAS') {
        params.estado = statusFilter;
      }
      const res = await buyerService.getAlerts(params);
      setAlerts(res.data || []);
    } catch (e) {
      console.error('Error cargando alertas:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleScanSLA = async () => {
    setScanning(true);
    try {
      await buyerService.scanSLAAlerts();
      await loadAlerts();
    } catch (e: any) {
      alert(e.message || 'Error al escanear SLA');
    } finally {
      setScanning(false);
    }
  };

  const handleOpenResolve = (alertItem: ImpulseAlertItem) => {
    setSelectedAlert(alertItem);
    setMotivoResolucion('');
    setResolveModalOpen(true);
  };

  const handleResolveAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAlert || !motivoResolucion.trim()) return;

    setResolving(true);
    try {
      await buyerService.resolveAlert(selectedAlert.id_alerta, motivoResolucion.trim());
      setResolveModalOpen(false);
      await loadAlerts();
    } catch (e: any) {
      alert(e.message || 'Error al resolver alerta');
    } finally {
      setResolving(false);
    }
  };

  const activeCount = alerts.filter((a) => a.estado === 'ACTIVA').length;

  return (
    <div className="space-y-6">
      {/* Cabecera con acento formal Ámbar */}
      <div className="rounded-2xl border-l-4 border-amber-500 border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Centro de Resolución de Impulse Alerts (Fase BUYER)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Protocolo de contingencias comerciales: <code className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded font-mono text-[11px]">ALT-BUY-01</code> a <code className="bg-amber-50 text-amber-900 px-1 py-0.5 rounded font-mono text-[11px]">ALT-BUY-05</code> para auditoría y resolución justificada.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleScanSLA}
            disabled={scanning}
            className="h-9 text-xs border-amber-300 bg-amber-50/60 text-amber-900 hover:bg-amber-100/70 gap-1.5 rounded-xl font-semibold"
          >
            {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Escanear Violaciones SLA
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={loadAlerts}
            className="h-9 text-xs border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
          >
            Refrescar
          </Button>
        </div>
      </div>

      {/* Filtros de estado con pills */}
      <div className="flex items-center gap-2 text-xs bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1">Filtrar Estado:</span>
        {(['ACTIVA', 'RESUELTA', 'TODAS'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              statusFilter === st
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {st === 'ACTIVA' ? `Activas (${activeCount})` : st}
          </button>
        ))}
      </div>

      {/* Lista de Alertas */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Registro de Anomalías Comerciales ({alerts.length})
          </h3>
          <span className="text-xs text-slate-400">Historial de alertas de captación</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500 font-medium">
            ✓ Cero alertas en este estado. Todo el flujo de admisión se encuentra dentro de los parámetros esperados.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((al) => (
              <div
                key={al.id_alerta}
                className={`p-5 transition-colors ${
                  al.estado === 'ACTIVA' ? 'bg-amber-50/25 hover:bg-amber-50/50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-950 bg-amber-100 px-2 py-0.5 rounded">
                        {al.codigo_alerta}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          al.prioridad === 'CRITICA' || al.prioridad === 'ALTA'
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : al.prioridad === 'MEDIA'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {al.prioridad}
                      </span>

                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          al.estado === 'ACTIVA'
                            ? 'bg-amber-100 text-amber-900 border border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {al.estado}
                      </span>

                      <span className="text-[11px] text-slate-400">
                        {new Date(al.fecha_creacion).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 leading-snug">
                      {al.mensaje}
                    </p>

                    {al.motivo_resolucion && (
                      <p className="text-[11px] text-emerald-900 bg-emerald-50/90 p-2 rounded-xl border border-emerald-200 leading-relaxed font-medium">
                        <strong>Resolución auditada:</strong> {al.motivo_resolucion} (
                        {al.fecha_resolucion ? new Date(al.fecha_resolucion).toLocaleDateString() : ''})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    {al.id_oportunidad && (
                      <Link
                        to={`/buyer/${al.id_oportunidad}`}
                        className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs"
                      >
                        Ver Dossier OP-{al.id_oportunidad}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}

                    {al.estado === 'ACTIVA' && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenResolve(al)}
                        className="h-8 text-xs bg-amber-600 text-white hover:bg-amber-700 rounded-xl font-semibold shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Resolver Alerta
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Resolver Alerta */}
      <Dialog open={resolveModalOpen} onOpenChange={setResolveModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Resolver Alerta — {selectedAlert?.codigo_alerta}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra la acción correctiva ejecutada para subsanar esta incidencia.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResolveAlert} className="space-y-3.5 py-2">
            <div className="rounded-xl bg-amber-50/70 p-3 text-xs text-amber-900 border border-amber-200">
              <span className="font-bold block mb-1">Evento reportado:</span>
              <p className="leading-relaxed">{selectedAlert?.mensaje}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Justificación de la resolución *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ej. Se contactó al prospecto vía WhatsApp a las 11:45 AM, confirmó interés en ortodoncia y se coordinó turno en Sede California..."
                value={motivoResolucion}
                onChange={(e) => setMotivoResolucion(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResolveModalOpen(false)}
                className="text-xs rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={resolving || !motivoResolucion.trim()}
                className="text-xs bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl"
              >
                {resolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Confirmar Resolución'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
