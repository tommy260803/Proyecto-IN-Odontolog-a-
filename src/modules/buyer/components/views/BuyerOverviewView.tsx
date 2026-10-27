import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  UserCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  PhoneCall,
  Sparkles,
  ShieldCheck,
  ExternalLink,
  Loader2,
  Calendar,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { buyerService } from '../../services/buyer.service';
import type { BuyerOperationalKpis, OpportunityItem, FollowUpTask, ImpulseAlertItem } from '../../types/buyer.types';

export const BuyerOverviewView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<BuyerOperationalKpis | null>(null);
  const [recentOpportunities, setRecentOpportunities] = useState<OpportunityItem[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<FollowUpTask[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<ImpulseAlertItem[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [kpisRes, oppsRes, followRes, alertsRes] = await Promise.all([
        buyerService.getOperationalKPIs().catch(() => null),
        buyerService.getOpportunities({ limit: 5 }).catch(() => ({ data: [] })),
        buyerService.getFollowUps().catch(() => ({ data: [] })),
        buyerService.getAlerts({ estado: 'ACTIVA' }).catch(() => ({ data: [] })),
      ]);

      setKpis(kpisRes);
      setRecentOpportunities(oppsRes.data || []);
      setUrgentTasks((followRes.data || []).filter((t: FollowUpTask) => t.prioridad === 'ALTA' || t.isSlaBreached).slice(0, 5));
      setActiveAlerts((alertsRes.data || []).slice(0, 5));
    } catch (e) {
      console.error('Error cargando overview de buyer:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de alertas críticas SLA si existen */}
      {urgentTasks.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-rose-100 p-2 text-rose-700">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-rose-900">
                  {urgentTasks.length} {urgentTasks.length === 1 ? 'contacto requiere' : 'contactos requieren'} respuesta inmediata (&gt; 15 min de espera)
                </h4>
                <p className="text-xs text-rose-700 mt-0.5">
                  El protocolo SLA de NexoSalud exige contacto inicial orientativo en menos de 15 minutos en horario hábil.
                </p>
              </div>
            </div>
            <Link
              to="/buyer/seguimiento"
              className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:text-rose-900 underline whitespace-nowrap"
            >
              Ver bandeja SLA
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas Operativas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Captados */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Contactos Registrados</span>
            <Users className="h-4 w-4 text-sky-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {kpis?.totalRegistros ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {kpis?.registradosSinConvertir ?? 0} en evaluación de fase
          </p>
        </div>

        {/* Tasa Utilizables */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Calidad de Contacto</span>
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {kpis?.tasaUtilizables ?? 0}%
          </div>
          <p className="mt-1 text-[11px] text-emerald-700 font-medium">
            {kpis?.contactosUtilizables ?? 0} contactos utilizables (B2)
          </p>
        </div>

        {/* Conversión a LEAD */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Conversión a LEAD</span>
            <UserCheck className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {kpis?.convertidosLead ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            {kpis?.tasaConversionDirecta ?? 0}% tasa de avance calificado
          </p>
        </div>

        {/* Impulse Alerts Activas */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Impulse Alerts Activas</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
            {kpis?.alertasActivas ?? 0}
          </div>
          <p className="mt-1 text-[11px] text-amber-700 font-medium">
            {kpis?.alertasSla ?? 0} SLA · {kpis?.alertasNoContacto ?? 0} contacto
          </p>
        </div>
      </div>

      {/* Grid de 2 columnas: Tareas Urgentes y Últimas Oportunidades */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda (7 cols): Oportunidades Recientes */}
        <div className="lg:col-span-7 rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Últimas Oportunidades Captadas</h3>
              <p className="text-xs text-slate-500">Contactos ingresados por canal web y recepción</p>
            </div>
            <Link
              to="/buyer/oportunidades"
              className="text-xs font-medium text-sky-700 hover:text-sky-900 flex items-center gap-1"
            >
              Ver todas ({kpis?.totalRegistros ?? 0})
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOpportunities.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">No hay oportunidades registradas recientemente.</p>
            ) : (
              recentOpportunities.map((op) => (
                <div key={op.id_oportunidad} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-900">
                        OP-{String(op.id_oportunidad).padStart(4, '0')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          op.estado_oportunidad === 'CONVERTIDO'
                            ? 'bg-emerald-50 text-emerald-700'
                            : op.estado_oportunidad === 'EN_CALIFICACION'
                            ? 'bg-sky-50 text-sky-700'
                            : op.estado_oportunidad === 'CALIFICADO'
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {op.estado_oportunidad}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 truncate mt-0.5">
                      {op.Persona ? `${op.Persona.nombres} ${op.Persona.apellidos}` : 'Contacto sin nombre'}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {op.necesidad_declarada || 'Consulta general'}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-400 block font-mono">
                      {new Date(op.fecha_registro).toLocaleDateString()}
                    </span>
                    <Link
                      to={`/buyer/${op.id_oportunidad}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 mt-1"
                    >
                      Dossier
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna Derecha (5 cols): Alertas y Accesos Directos */}
        <div className="lg:col-span-5 space-y-6">
          {/* Impulse Alerts */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-semibold text-slate-900">Alertas Activas</h3>
              </div>
              <Link to="/buyer/alertas" className="text-xs font-medium text-sky-700 hover:text-sky-900">
                Gestionar ({activeAlerts.length})
              </Link>
            </div>

            <div className="space-y-2.5">
              {activeAlerts.length === 0 ? (
                <div className="rounded-lg bg-emerald-50/60 p-3 text-center text-xs text-emerald-800 border border-emerald-100">
                  ✓ Todos los SLAs y condiciones están bajo control.
                </div>
              ) : (
                activeAlerts.map((alt) => (
                  <div
                    key={alt.id_alerta}
                    className="rounded-lg border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                        {alt.codigo_alerta}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">
                        {alt.prioridad}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px] leading-snug">{alt.mensaje}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Accesos directos a herramientas Buyer */}
          <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Módulos Especializados
            </h4>

            <Link
              to="/buyer/campanas"
              className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-slate-300 text-xs text-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-sky-600 font-semibold">Campañas &amp; Gastos</span>
                <span className="text-slate-400 text-[11px]">Atribución CAC</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>

            <Link
              to="/buyer/agente-ia"
              className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-slate-300 text-xs text-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-indigo-600 font-semibold">Agente Marketing IA</span>
                <span className="text-slate-400 text-[11px]">DecisionesIA Groq</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>

            <Link
              to="/buyer/analitica"
              className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200/70 hover:border-slate-300 text-xs text-slate-800 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-emerald-600 font-semibold">Dashboard BI (B1, B2, B3)</span>
                <span className="text-slate-400 text-[11px]">Data Mart Oficial</span>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
