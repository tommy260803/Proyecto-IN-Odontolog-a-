import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Bot,
  BrainCircuit,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  UserCheck,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { buyerService } from '../../services/buyer.service';
import type { AIDecisionItem, AgentStatsData } from '../../types/buyer.types';

export const BuyerAgentView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<AgentStatsData | null>(null);
  const [history, setHistory] = useState<AIDecisionItem[]>([]);

  // Simulador interactivo en vivo
  const [testText, setTestText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    loadAgentData();
  }, []);

  const loadAgentData = async () => {
    setLoading(true);
    try {
      const [statsRes, histRes] = await Promise.all([
        buyerService.getAgentStats(),
        buyerService.getAgentHistory(50),
      ]);
      setStats(statsRes.data);
      setHistory(histRes.data || []);
    } catch (e) {
      console.error('Error cargando agente IA:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleTestAI = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testText.trim()) return;

    setAnalyzing(true);
    setTestResult(null);
    try {
      const res = await buyerService.analyzeTextWithAI(testText.trim(), 4);
      setTestResult(res.analysis);
      await loadAgentData(); // Refrescar historial
    } catch (err: any) {
      alert(err.message || 'Error al procesar con IA');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabecera del Centro de IA */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4.5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm sm:text-base font-semibold text-slate-900">
              Supervisión del Agente Inteligente de Marketing &amp; Captación
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Auditoría de decisiones automatizadas, triaje de intención comercial y fallbacks a reglas deterministas bajo trazabilidad estricta.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAgentData}
            className="h-9 text-xs border-slate-200 gap-1.5 text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Métricas
          </Button>
        </div>
      </div>

      {/* Métricas del Agente IA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Decisiones Procesadas</span>
          <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
            {stats?.totalProcessed ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">En la fase BUYER</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Ejecución LLM Groq</span>
          <div className="text-2xl font-bold font-mono text-indigo-600 mt-1">
            {stats?.llmExecuted ?? 0}
          </div>
          <p className="text-[11px] text-indigo-700 font-medium mt-0.5">
            {stats?.totalProcessed ? Math.round(((stats.llmExecuted) / stats.totalProcessed) * 100) : 0}% de cobertura
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Fallback Reglas Locales</span>
          <div className="text-2xl font-bold font-mono text-slate-700 mt-1">
            {stats?.rulesFallback ?? 0}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">Garantía de alta disponibilidad</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <span className="text-xs font-medium text-slate-500">Revisión Humana Requerida</span>
          <div className="text-2xl font-bold font-mono text-amber-600 mt-1">
            {stats?.requiresHumanReview ?? 0}
          </div>
          <p className="text-[11px] text-amber-700 font-medium mt-0.5">Casos con baja confianza o ambiguos</p>
        </div>
      </div>

      {/* Simulador Interactivo de Triaje */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Simulador de Triaje de Captación en Tiempo Real
          </h3>
        </div>
        <p className="text-xs text-slate-600 mb-4 max-w-2xl">
          Escribe o pega cualquier consulta de un paciente para probar cómo el agente clasifica la intención, detecta la urgencia, estima el score comercial y asigna la recomendación.
        </p>

        <form onSubmit={handleTestAI} className="space-y-3">
          <div className="relative">
            <textarea
              rows={2}
              placeholder="Ej. Hola, quiero ponerme frenillos pero no sé cuánto cuesta la inicial, ¿tienen cuotas sin intereses?"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-600 resize-none shadow-xs"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Modelo activo: {stats?.providerActive || 'Groq Llama 3'}</span>
            </div>

            <Button
              type="submit"
              disabled={analyzing || !testText.trim()}
              className="h-8 text-xs bg-indigo-600 text-white hover:bg-indigo-700 gap-1.5"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Analizando...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3" />
                  Evaluar con IA
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Resultado del simulador */}
        {testResult && (
          <div className="mt-4 rounded-xl border border-indigo-200 bg-white p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <span className="text-xs font-semibold text-indigo-900">
                Resultado de Calificación Automatizada
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Score: {testResult.score_captacion ?? 'N/A'}/100
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Intención</span>
                <span className="font-semibold text-slate-800">{testResult.intencion_detectada || 'General'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Servicio Sugerido</span>
                <span className="font-semibold text-slate-800">{testResult.servicio_recomendado || 'Consulta General'}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-slate-50">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Acción Recomendada</span>
                <span className="font-semibold text-indigo-700">{testResult.accion_sugerida || 'CONTACTAR_WHATSAPP'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">
              <strong className="text-slate-800">Mensaje sugerido para el asesor:</strong>
              <p className="mt-1 italic text-slate-700">"{testResult.mensaje_sugerido || testResult.justificacion}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Auditoría de Decisiones IA */}
      <div className="rounded-xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Registro Histórico de Decisiones (DecisionesIA)
          </h3>
          <span className="text-xs text-slate-400">Últimos {history.length} eventos auditados</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-xs text-slate-500">
            No hay registros de decisiones de IA en el historial.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((dec) => (
              <div key={dec.id_decision} className="p-4 hover:bg-slate-50 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">
                        DEC-#{dec.id_decision}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                        {dec.accion || dec.decision}
                      </span>
                      {dec.requiere_revision_humana && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Revisión Humana
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(dec.fecha_hora).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700">
                      <strong>Contacto:</strong> {dec.Persona ? `${dec.Persona.nombres} ${dec.Persona.apellidos} (${dec.Persona.numero})` : 'Anónimo'}{' '}
                      — <strong>Motivo:</strong> {dec.justificacion || dec.decision}
                    </p>

                    <p className="text-[11px] text-slate-400">
                      Método: {dec.metodo || 'GROQ_LLAMA3'} · Regla: {dec.regla_aplicada || 'EVALUACION_PROGRESIVA'}
                    </p>
                  </div>

                  {dec.Oportunidad && (
                    <Link
                      to={`/buyer/${dec.Oportunidad.id_oportunidad}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 shrink-0"
                    >
                      Ver OP-{dec.Oportunidad.id_oportunidad}
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
