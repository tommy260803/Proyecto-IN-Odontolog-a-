import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { 
  BarChart3, 
  Database, 
  Users, 
  UserPlus, 
  CreditCard, 
  Stethoscope, 
  RefreshCw, 
  AlertTriangle, 
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { reportService } from '@/shared/services/report.service';
import type { 
  AllExecutiveReports, 
  ExecutiveReportData, 
  MartStatus 
} from '@/shared/services/report.service';
import { ExecutiveMatrixTable } from '../components/ExecutiveMatrixTable';

type ActiveTab = 'buyer' | 'lead' | 'payer' | 'customer' | 'all';

export default function ReportsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab') as ActiveTab | null;
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    tabFromUrl && ['buyer', 'lead', 'payer', 'customer', 'all'].includes(tabFromUrl)
      ? tabFromUrl
      : 'buyer'
  );

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<MartStatus | null>(null);
  const [reports, setReports] = useState<AllExecutiveReports | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTabChange = (newTab: ActiveTab) => {
    setActiveTab(newTab);
    setSearchParams({ tab: newTab });
  };

  const loadExecutiveReports = async () => {
    try {
      setLoading(true);
      setError(null);
      const [st, rep] = await Promise.all([
        reportService.getStatus(),
        reportService.getAllExecutiveReports(),
      ]);
      setStatus(st);
      setReports(rep);
    } catch (err: any) {
      console.error('Error cargando reportes ejecutivos de NexoSalud_Mart:', err);
      setError(err.message || 'Error al conectar con el DataMart NexoSalud_Mart');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExecutiveReports();
  }, []);

  const renderSummaryCard = (report: ExecutiveReportData, icon: any) => {
    const Icon = icon;
    return (
      <div 
        onClick={() => handleTabChange(report.stage.toLowerCase() as ActiveTab)}
        className={`cursor-pointer transition-all p-4 rounded-2xl border ${
          activeTab === report.stage.toLowerCase()
            ? 'bg-teal-50/70 dark:bg-teal-950/30 border-teal-500 shadow-sm'
            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        }`}
      >
        <div className="flex items-center justify-between text-xs font-mono text-slate-400 mb-1">
          <span className="font-bold text-teal-600 dark:text-teal-400">ETAPA {report.stage}</span>
          <Icon className="h-4 w-4 text-slate-400" />
        </div>
        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 truncate">
          {report.metric}
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-2xl font-black text-slate-900 dark:text-white">
            {report.isCurrency ? 'S/ ' : ''}
            {report.isCurrency
              ? report.grandTotal.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : report.grandTotal.toLocaleString('es-PE')}
          </span>
          <span className="text-[11px] font-medium text-slate-400">
            {report.categories.length} categorías
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 -mb-12 w-48 h-48 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-500/30">
                <BarChart3 className="h-5 w-5" />
              </span>
              <span className="text-xs font-bold uppercase tracking-wider text-teal-400 font-mono">
                Inteligencia de Negocios • DataMart Dimensional NexoSalud_Mart
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Reportes Ejecutivos Matriciales
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Matrices ejecutivas de corte tabular para las 4 etapas del paciente ({' '}
              <strong className="text-teal-300">BUYER</strong>, <strong className="text-teal-300">LEAD</strong>,{' '}
              <strong className="text-teal-300">PAYER</strong>, <strong className="text-teal-300">CUSTOMER</strong>
              ). Todas las dimensiones y métricas son calculadas dinámicamente desde el DataMart con exportación a PDF.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <Database className="h-3.5 w-3.5 text-teal-400" />
              <span className="text-slate-200">NexoSalud_Mart (Sin Prisma)</span>
            </div>
            <button
              onClick={loadExecutiveReports}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar DataMart
            </button>
          </div>
        </div>

        {/* Database Status Pills */}
        {status && (
          <div className="mt-6 pt-5 border-t border-slate-800/80 flex flex-wrap items-center gap-3 text-xs">
            <span className="text-slate-400 text-[11px]">Conexión Activa:</span>
            <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[11px]">
              {status.database} ({status.driver})
            </span>
            <span className="text-slate-400 text-[11px]">•</span>
            {status.tables.map((t) => (
              <span key={t.tabla} className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-mono text-[10px]">
                {t.tabla}: <strong className="text-white">{t.registros}</strong>
              </span>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {/* Summary KPI Cards for the 4 Stages */}
      {reports && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderSummaryCard(reports.buyer, Users)}
          {renderSummaryCard(reports.lead, UserPlus)}
          {renderSummaryCard(reports.payer, CreditCard)}
          {renderSummaryCard(reports.customer, Stethoscope)}
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 overflow-x-auto no-scrollbar">
        {[
          { id: 'buyer', label: '01. BUYER (Captación)', icon: Users },
          { id: 'lead', label: '02. LEAD (Negociación)', icon: UserPlus },
          { id: 'payer', label: '03. PAYER (Recaudación)', icon: CreditCard },
          { id: 'customer', label: '04. CUSTOMER (Prestación Clínica)', icon: Stethoscope },
          { id: 'all', label: 'Consolidado (Todas las Etapas)', icon: Layers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as ActiveTab)}
              className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                isActive
                  ? 'border-teal-500 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/20'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
          <RefreshCw className="h-8 w-8 animate-spin text-teal-500" />
          <p className="text-sm font-medium">Consultando matrices dimensionales desde NexoSalud_Mart...</p>
        </div>
      ) : reports ? (
        <div className="space-y-10">
          {/* TAB: BUYER */}
          {(activeTab === 'buyer' || activeTab === 'all') && (
            <section className="space-y-4">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                  <span>ETAPA 01: CAPTACIÓN (BUYER)</span>
                </div>
              )}
              <ExecutiveMatrixTable data={reports.buyer} containerId="report-matrix-buyer" />
            </section>
          )}

          {/* TAB: LEAD */}
          {(activeTab === 'lead' || activeTab === 'all') && (
            <section className="space-y-4">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                  <span>ETAPA 02: NEGOCIACIÓN (LEAD)</span>
                </div>
              )}
              <ExecutiveMatrixTable data={reports.lead} containerId="report-matrix-lead" />
            </section>
          )}

          {/* TAB: PAYER */}
          {(activeTab === 'payer' || activeTab === 'all') && (
            <section className="space-y-4">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  <span>ETAPA 03: RECAUDACIÓN (PAYER)</span>
                </div>
              )}
              <ExecutiveMatrixTable data={reports.payer} containerId="report-matrix-payer" />
            </section>
          )}

          {/* TAB: CUSTOMER */}
          {(activeTab === 'customer' || activeTab === 'all') && (
            <section className="space-y-4">
              {activeTab === 'all' && (
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                  <span>ETAPA 04: PRESTACIÓN CLÍNICA (CUSTOMER)</span>
                </div>
              )}
              <ExecutiveMatrixTable data={reports.customer} containerId="report-matrix-customer" />
            </section>
          )}
        </div>
      ) : null}
    </div>
  );
}
