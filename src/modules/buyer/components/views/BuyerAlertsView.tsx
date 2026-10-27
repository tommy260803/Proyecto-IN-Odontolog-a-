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
      {/* Cabecera del Centro de Alertas */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Centro de Resolución de Impulse Alerts (Fase BUYER)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monitoreo preventivo de fricciones: demoras SLA (&gt;15m), datos no utilizables, fugas de contacto y anomalías de CPL publicitario.
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
            Escanear Violaciones SLA
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={loadAlerts}
            className="h-9 text-xs border-slate-200 text-slate-600"
          >
            Refrescar
          </Button>
        </div>
      </div>

      {/* Filtros de estado */}
      <div className="flex items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-slate-400 uppercase">Estado:</span>
        {(['ACTIVA', 'RESUELTA', 'TODAS'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              statusFilter === st
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {st === 'ACTIVA' ? `Activas (${activeCount})` : st}
          </button>
        ))}
      </div>

      {/* Lista de Alertas */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : alerts.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            ✓ No hay alertas en este estado. Todo el flujo de captación se encuentra conforme a los protocolos.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {alerts.map((al) => (
              <div
                key={al.id_alerta}
                className={`p-4.5 transition-colors ${
                  al.estado === 'ACTIVA' ? 'bg-amber-50/20 hover:bg-amber-50/40' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {al.codigo_alerta}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          al.prioridad === 'CRITICA' || al.prioridad === 'ALTA'
                            ? 'bg-rose-100 text-rose-700'
                            : al.prioridad === 'MEDIA'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {al.prioridad}
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          al.estado === 'ACTIVA'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}
                      >
                        {al.estado}
                      </span>

                      <span className="text-[11px] text-slate-400">
                        {new Date(al.fecha_creacion).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs font-medium text-slate-800 leading-snug">
                      {al.mensaje}
                    </p>

                    {al.motivo_resolucion && (
                      <p className="text-[11px] text-emerald-800 bg-emerald-50/80 p-1.5 rounded border border-emerald-100">
                        <strong>Resolución:</strong> {al.motivo_resolucion} (
                        {al.fecha_resolucion ? new Date(al.fecha_resolucion).toLocaleDateString() : ''})
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {al.id_oportunidad && (
                      <Link
                        to={`/buyer/${al.id_oportunidad}`}
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                      >
                        Ver Caso OP-{al.id_oportunidad}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}

                    {al.estado === 'ACTIVA' && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenResolve(al)}
                        className="h-8 text-xs bg-slate-900 text-white hover:bg-slate-800"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Resolver
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
            <DialogTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Resolver Alerta {selectedAlert?.codigo_alerta}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Registra la acción correctiva realizada para subsanar este evento.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResolveAlert} className="space-y-3.5 py-2">
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 border border-slate-200">
              <span className="font-semibold block mb-0.5">Mensaje de alerta:</span>
              {selectedAlert?.mensaje}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-700">
                Motivo / Justificación de la resolución *
              </label>
              <textarea
                rows={3}
                required
                placeholder="Ej. Se llamó al paciente a las 10:15 am, confirmó interés y se coordinó pre-reserva de cita para Sede California..."
                value={motivoResolucion}
                onChange={(e) => setMotivoResolucion(e.target.value)}
                className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResolveModalOpen(false)}
                className="text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={resolving || !motivoResolucion.trim()}
                className="text-xs bg-emerald-600 text-white hover:bg-emerald-700"
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
