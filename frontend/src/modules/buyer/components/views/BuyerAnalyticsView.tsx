import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Target,
  DollarSign,
  Clock,
  ShieldCheck,
  Calendar,
  Loader2,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Building2,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { buyerService } from '../../services/buyer.service';
import type { BuyerMartKpiData } from '../../types/buyer.types';

export const BuyerAnalyticsView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>('all');
  const [kpiData, setKpiData] = useState<BuyerMartKpiData | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const res = await buyerService.getMartKPIs(period === 'all' ? undefined : period);
      setKpiData(res.data);
    } catch (e) {
      console.error('Error cargando analítica BI de Buyer:', e);
    } finally {
      setLoading(false);
    }
  };

  const b1 = kpiData?.b1_tasa_conversion_14d ?? 0;
  const b1Target = kpiData?.benchmark_b1_objetivo ?? 20;
  const b1Ok = b1 >= b1Target;

  const b2 = kpiData?.b2_tasa_contactos_utilizables ?? 0;
  const b2Target = kpiData?.benchmark_b2_objetivo ?? 80;
  const b2Ok = b2 >= b2Target;

  const b3 = kpiData?.b3_costo_por_lead_cpl ?? 0;
  const b3Target = kpiData?.benchmark_b3_objetivo ?? 25;
  const b3Ok = b3 > 0 && b3 <= b3Target;

  return (
    <div className="space-y-6">
      {/* Cabecera con acento formal Deep Teal */}
      <div className="rounded-2xl border-l-4 border-teal-600 border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-100 text-teal-800">
              <BarChart3 className="h-5 w-5" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Business Intelligence &amp; Data Mart Oficial (Fase BUYER)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Métricas calculadas directamente desde <code className="bg-teal-50 text-teal-900 px-1 py-0.5 rounded font-mono text-[11px]">Fact_OportunidadCaptacion</code> para contrastar contra los benchmarks oficiales de IMPULSE.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-600"
          >
            <option value="all">Todo el Histórico</option>
            <option value="2026-Q1">2026 - Q1</option>
            <option value="2026-03">2026 - Marzo</option>
            <option value="2026-02">2026 - Febrero</option>
            <option value="2026-01">2026 - Enero</option>
            <option value="2025-12">2025 - Diciembre</option>
          </select>

          <Button
            size="sm"
            variant="outline"
            onClick={loadAnalytics}
            className="h-9 text-xs border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !kpiData ? (
        <div className="p-14 text-center text-xs text-slate-500 rounded-2xl bg-white border border-slate-200">
          No se pudieron calcular los indicadores dimensionales del Data Mart.
        </div>
      ) : (
        <>
          {/* Los 3 KPIs Oficiales con diseño de gauges y barras de meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* KPI B1 */}
            <div className="rounded-2xl border-t-4 border-sky-600 border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-800 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-200">
                  KPI B1 OFICIAL
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    b1Ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {b1Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b1Ok ? 'Cumple Meta' : 'Bajo Meta'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Conversión a Lead (&le; 14 días)
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {b1.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ Meta &ge; {b1Target}%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${b1Ok ? 'bg-sky-600' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (b1 / b1Target) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>{kpiData.conv_14d} en &le; 14d</span>
                  <span>{kpiData.total_registrados} captados</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 leading-snug">
                Capacidad del equipo para clasificar y confirmar intención antes de que el prospecto se enfríe.
              </p>
            </div>

            {/* KPI B2 */}
            <div className="rounded-2xl border-t-4 border-emerald-600 border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                  KPI B2 OFICIAL
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    b2Ok ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {b2Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b2Ok ? 'Calidad Óptima' : 'Requiere Filtro'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Contactos Utilizables
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-slate-900 font-mono">
                    {b2.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ Meta &ge; {b2Target}%</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${b2Ok ? 'bg-emerald-600' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (b2 / b2Target) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>{kpiData.total_utilizables} válidos</span>
                  <span>{kpiData.total_registrados} captados</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 leading-snug">
                Porcentaje de prospectos con teléfono de 9 dígitos alcanzable y consentimiento informado otorgado.
              </p>
            </div>

            {/* KPI B3 */}
            <div className="rounded-2xl border-t-4 border-teal-600 border border-slate-200/90 bg-white p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-teal-800 bg-teal-50 px-2.5 py-1 rounded-lg border border-teal-200">
                  KPI B3 OFICIAL
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full ${
                    b3Ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {b3Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b3Ok ? 'Eficiente' : 'Elevado'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Costo por Lead (CPL)
                </h3>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-4xl font-black tracking-tight text-teal-950 font-mono">
                    S/ {b3.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">/ Meta &le; S/ {b3Target.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${b3Ok ? 'bg-teal-600' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, (b3Target / Math.max(b3, 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Gasto: S/ {Number(kpiData.total_costo || 0).toFixed(2)}</span>
                  <span>{kpiData.total_conversiones} conversiones</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 leading-snug">
                Eficiencia de la inversión en captación publicitaria dividida entre prospectos cualificados.
              </p>
            </div>
          </div>

          {/* Métricas secundarias en paneles formales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-2xl border-l-4 border-slate-800 border border-slate-200/90 bg-white p-5 shadow-xs space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Tiempo Promedio de Conversión (Días)
              </span>
              <div className="text-3xl font-black font-mono text-slate-900 mt-1">
                {kpiData.avg_tiempo_dias ? `${kpiData.avg_tiempo_dias} días` : '—'}
              </div>
              <p className="text-xs text-slate-500">
                Días promedio que toma calificar un contacto desde su registro hasta la entrega a LEAD.
              </p>
            </div>

            <div className="rounded-2xl border-l-4 border-emerald-600 border border-slate-200/90 bg-white p-5 shadow-xs space-y-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Total Conversiones Concretadas
              </span>
              <div className="text-3xl font-black font-mono text-emerald-700 mt-1">
                {kpiData.total_conversiones} pacientes
              </div>
              <p className="text-xs text-slate-500">
                Prospectos que aceptaron evaluación presencial y pasaron exitosamente al embudo clínico.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
