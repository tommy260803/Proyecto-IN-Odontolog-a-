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
      {/* Cabecera Analítica */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Analítica de Data Mart &amp; KPIs Oficiales (Fase BUYER)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Métricas dimensionales calculadas desde <code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded text-slate-700">Fact_OportunidadCaptacion</code> y consolidadas para la metodología IMPULSE.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
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
            className="h-9 text-xs border-slate-200 text-slate-600"
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
        <div className="p-12 text-center text-xs text-slate-500 rounded-xl bg-white border border-slate-200">
          No se pudieron cargar los datos analíticos del Data Mart.
        </div>
      ) : (
        <>
          {/* Los 3 KPIs Oficiales de BUYER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* KPI B1: Conversión a Lead en <= 14 días */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                  KPI B1
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    b1Ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {b1Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b1Ok ? 'Cumple Meta' : 'Bajo Meta'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Conversión a Lead (&le; 14 días)
                </h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {b1.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">/ Meta &ge; {b1Target}%</span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b1Ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (b1 / b1Target) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{kpiData.conv_14d} en &le;14d</span>
                  <span>{kpiData.total_registrados} captados</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 leading-snug">
                Mide la velocidad y eficacia del triaje comercial inicial para transformar contactos fríos en leads cualificados.
              </p>
            </div>

            {/* KPI B2: Tasa de Contactos Utilizables */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                  KPI B2
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    b2Ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}
                >
                  {b2Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b2Ok ? 'Calidad Óptima' : 'Requiere Filtro'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Contactos Utilizables
                </h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight text-slate-900">
                    {b2.toFixed(1)}%
                  </span>
                  <span className="text-xs text-slate-400">/ Meta &ge; {b2Target}%</span>
                </div>
              </div>

              {/* Barra de progreso */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b2Ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.min(100, (b2 / b2Target) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>{kpiData.total_utilizables} válidos</span>
                  <span>{kpiData.total_registrados} totales</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 leading-snug">
                Valida que el número tenga 9 dígitos, consentimiento Ley N° 29733 y sea alcanzable sin rechazo.
              </p>
            </div>

            {/* KPI B3: Costo por Lead / Adquisición (CPL) */}
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                  KPI B3
                </span>
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                    b3Ok ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                  }`}
                >
                  {b3Ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                  {b3Ok ? 'Eficiente' : 'Elevado'}
                </span>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Costo por Lead (CPL)
                </h3>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold tracking-tight font-mono text-slate-900">
                    S/ {b3.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400">/ Meta &le; S/ {b3Target.toFixed(2)}</span>
                </div>
              </div>

              {/* Barra de progreso inverso */}
              <div className="space-y-1">
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${b3Ok ? 'bg-emerald-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, (b3Target / Math.max(b3, 1)) * 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 font-mono">
                  <span>Gasto: S/ {Number(kpiData.total_costo || 0).toFixed(2)}</span>
                  <span>{kpiData.total_conversiones} leads</span>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100 leading-snug">
                Inversión publicitaria atribuida (GastosCampana) dividida entre los leads calificados generados.
              </p>
            </div>
          </div>

          {/* Fila secundaria: Tiempos y Detalle Dimensional */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tiempo Promedio de Conversión (Días)
              </span>
              <div className="text-3xl font-extrabold font-mono text-slate-900">
                {kpiData.avg_tiempo_dias ? `${kpiData.avg_tiempo_dias} días` : '—'}
              </div>
              <p className="text-xs text-slate-500">
                Tiempo transcurrido desde el registro en el formulario web hasta el pase formal a LEAD.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200/90 bg-white p-5 space-y-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Total Conversiones Generadas
              </span>
              <div className="text-3xl font-extrabold font-mono text-emerald-700">
                {kpiData.total_conversiones} pacientes
              </div>
              <p className="text-xs text-slate-500">
                Oportunidades con interés confirmado y cita orientativa en coordinación.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
