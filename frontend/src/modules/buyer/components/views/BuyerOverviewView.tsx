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
  Megaphone,
  Bot,
  BarChart3,
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
        buyerService.getOpportunities({ limit: 6 }).catch(() => ({ data: [] })),
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
        <div className="rounded-2xl border-l-4 border-rose-600 bg-rose-50/80 p-4 border border-rose-200/80 shadow-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-rose-600 p-2 text-white shadow-xs">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-rose-950">
                  {urgentTasks.length} {urgentTasks.length === 1 ? 'contacto requiere' : 'contactos requieren'} respuesta inmediata (&gt; 15 min de espera)
                </h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  El protocolo SLA de NexoSalud exige contacto orientativo en menos de 15 minutos en horario comercial para garantizar la conversión.
                </p>
              </div>
            </div>
            <Link
              to="/buyer/seguimiento"
              className="inline-flex items-center gap-1 text-xs font-bold text-rose-700 hover:text-rose-900 bg-white px-3 py-1.5 rounded-xl border border-rose-200 shadow-xs whitespace-nowrap"
            >
              Atender en Bandeja SLA
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas Operativas con acentos formales */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Captados - Slate/Navy */}
        <div className="rounded-2xl border-t-4 border-slate-900 border border-slate-200/90 bg-gradient-to-b from-slate-50/60 to-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Contactos Registrados</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-800">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900">
            {kpis?.totalRegistros ?? 0}
          </div>
          <p className="mt-1 text-xs text-slate-500 font-medium">
            {kpis?.registradosSinConvertir ?? 0} en evaluación de fase
          </p>
        </div>

        {/* Calidad Utilizables - Emerald */}
        <div className="rounded-2xl border-t-4 border-emerald-600 border border-slate-200/90 bg-gradient-to-b from-emerald-50/30 to-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">Calidad de Contacto (B2)</span>
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-800">
              <ShieldCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-emerald-950 font-mono">
            {kpis?.tasaUtilizables ?? 0}%
          </div>
          <p className="mt-1 text-xs text-emerald-700 font-semibold">
            {kpis?.contactosUtilizables ?? 0} números válidos
          </p>
        </div>

        {/* Conversión a LEAD - Ocean Blue */}
        <div className="rounded-2xl border-t-4 border-blue-600 border border-slate-200/90 bg-gradient-to-b from-blue-50/30 to-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-800">Conversión a LEAD</span>
            <div className="p-1.5 rounded-lg bg-blue-100 text-blue-800">
              <UserCheck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-blue-950 font-mono">
            {kpis?.convertidosLead ?? 0}
          </div>
          <p className="mt-1 text-xs text-blue-700 font-semibold">
            {kpis?.tasaConversionDirecta ?? 0}% tasa de avance calificado
          </p>
        </div>

        {/* Impulse Alerts Activas - Warm Amber */}
        <div className="rounded-2xl border-t-4 border-amber-500 border border-slate-200/90 bg-gradient-to-b from-amber-50/30 to-white p-5 shadow-xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-900">Impulse Alerts</span>
            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-800">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold tracking-tight text-amber-950 font-mono">
            {kpis?.alertasActivas ?? 0}
          </div>
          <p className="mt-1 text-xs text-amber-800 font-semibold">
            {kpis?.alertasSla ?? 0} SLA · {kpis?.alertasNoContacto ?? 0} datos
          </p>
        </div>
      </div>

      {/* Grid de 2 columnas: Oportunidades Recientes y Accesos Formales */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Columna Izquierda (7 cols): Oportunidades Recientes */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Últimas Oportunidades Captadas</h3>
              <p className="text-xs text-slate-500">Ingresos recientes por canal web y recepción física</p>
            </div>
            <Link
              to="/buyer/oportunidades"
              className="text-xs font-bold text-blue-700 hover:text-blue-900 flex items-center gap-1 bg-blue-50 px-2.5 py-1 rounded-lg"
            >
              Ver todas ({kpis?.totalRegistros ?? 0})
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentOpportunities.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">No hay oportunidades registradas recientemente.</p>
            ) : (
              recentOpportunities.map((op) => (
                <div key={op.id_oportunidad} className="py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors rounded-xl px-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        OP-{String(op.id_oportunidad).padStart(4, '0')}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          op.estado_oportunidad === 'CONVERTIDO'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : op.estado_oportunidad === 'EN_CALIFICACION'
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : op.estado_oportunidad === 'CALIFICADO'
                            ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {op.estado_oportunidad}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-900 truncate mt-1">
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
                      className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 mt-1"
                    >
                      Dossier 360°
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Columna Derecha (5 cols): Alertas y Módulos Especializados */}
        <div className="lg:col-span-5 space-y-6">
          {/* Impulse Alerts */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-900">Alertas Operativas Activas</h3>
              </div>
              <Link to="/buyer/alertas" className="text-xs font-bold text-amber-700 hover:text-amber-900 bg-amber-50 px-2 py-0.5 rounded">
                Ver ({activeAlerts.length})
              </Link>
            </div>

            <div className="space-y-2.5">
              {activeAlerts.length === 0 ? (
                <div className="rounded-xl bg-emerald-50/70 p-3.5 text-center text-xs text-emerald-900 border border-emerald-100 font-medium">
                  ✓ Todos los SLAs y condiciones están bajo control.
                </div>
              ) : (
                activeAlerts.map((alt) => (
                  <div
                    key={alt.id_alerta}
                    className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded">
                        {alt.codigo_alerta}
                      </span>
                      <span className="text-[10px] font-bold text-amber-800">
                        {alt.prioridad}
                      </span>
                    </div>
                    <p className="text-slate-800 text-[11px] font-medium leading-snug">{alt.mensaje}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Accesos con distinción cromática formal */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Subsistemas Especializados de BUYER
            </h4>

            {/* Campañas & Gastos - Verde Esmeralda */}
            <Link
              to="/buyer/campanas"
              className="flex items-center justify-between p-3 rounded-xl border-l-4 border-emerald-600 bg-emerald-50/30 hover:bg-emerald-50/60 border border-slate-200/80 text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-600 text-white">
                  <Megaphone className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-emerald-950 font-bold block">Campañas &amp; Gastos</span>
                  <span className="text-emerald-800 text-[11px]">Control de CPL y presupuesto</span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-emerald-700" />
            </Link>

            {/* Agente IA - Violeta */}
            <Link
              to="/buyer/agente-ia"
              className="flex items-center justify-between p-3 rounded-xl border-l-4 border-violet-600 bg-violet-50/30 hover:bg-violet-50/60 border border-slate-200/80 text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-violet-600 text-white">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-violet-950 font-bold block">Agente Marketing IA</span>
                  <span className="text-violet-800 text-[11px]">DecisionesIA Groq Llama 3</span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-violet-700" />
            </Link>

            {/* Data Mart - Teal */}
            <Link
              to="/buyer/analitica"
              className="flex items-center justify-between p-3 rounded-xl border-l-4 border-teal-600 bg-teal-50/30 hover:bg-teal-50/60 border border-slate-200/80 text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-teal-600 text-white">
                  <BarChart3 className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-teal-950 font-bold block">Data Mart &amp; BI Oficial</span>
                  <span className="text-teal-800 text-[11px]">KPIs B1 (Conv), B2 (Utilizables), B3 (CPL)</span>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-teal-700" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
