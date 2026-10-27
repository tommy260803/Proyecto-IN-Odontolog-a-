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
  Zap,
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
      {/* Cabecera con acento formal Violeta */}
      <div className="rounded-2xl border-l-4 border-violet-600 border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-violet-100 text-violet-800">
              <Bot className="h-5 w-5" />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900">
              Supervisión del Agente de Marketing IA (Groq Llama 3)
            </h2>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Trazabilidad auditada en <code className="bg-violet-50 text-violet-800 px-1 py-0.5 rounded font-mono text-[11px]">DecisionesIA</code>: clasificación de intención, score de captación y fallback determinista local.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAgentData}
            className="h-9 text-xs border-violet-200 text-violet-900 hover:bg-violet-50 rounded-xl gap-1.5 font-semibold"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar Métricas
          </Button>
        </div>
      </div>

      {/* Métricas del Agente IA */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Decisiones Procesadas</span>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2">
            {stats?.totalProcessed ?? 0}
          </div>
          <p className="text-xs text-slate-400 mt-1">Registradas en Fase BUYER</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-violet-700">Ejecución LLM Groq</span>
          <div className="text-3xl font-extrabold font-mono text-violet-700 mt-2">
            {stats?.llmExecuted ?? 0}
          </div>
          <p className="text-xs text-violet-800 font-semibold mt-1">
            {stats?.totalProcessed ? Math.round(((stats.llmExecuted) / stats.totalProcessed) * 100) : 0}% de cobertura inteligente
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fallback Determinista</span>
          <div className="text-3xl font-extrabold font-mono text-slate-700 mt-2">
            {stats?.rulesFallback ?? 0}
          </div>
          <p className="text-xs text-slate-400 mt-1">Reglas locales de contingencia</p>
        </div>

        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Revisión Humana</span>
          <div className="text-3xl font-extrabold font-mono text-amber-600 mt-2">
            {stats?.requiresHumanReview ?? 0}
          </div>
          <p className="text-xs text-amber-800 font-semibold mt-1">Casos con baja confianza o ambiguos</p>
        </div>
      </div>

      {/* Simulador Interactivo de Triaje */}
      <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50/50 via-white to-white p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1 rounded-lg bg-violet-600 text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <h3 className="text-sm font-bold text-slate-900">
            Sandbox de Triaje Comercial en Tiempo Real
          </h3>
        </div>
        <p className="text-xs text-slate-600 mb-4 max-w-2xl leading-relaxed">
          Ingresa cualquier consulta enviada por un paciente para probar la inferencia de intención, score de captación y la recomendación generada por el agente.
        </p>

        <form onSubmit={handleTestAI} className="space-y-3.5">
          <div className="relative">
            <textarea
              rows={2}
              placeholder="Ej. Hola, quiero ponerme frenillos pero no sé cuánto cuesta la cuota mensual, ¿atienden en la sede de California?"
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              className="w-full rounded-2xl border border-violet-200 bg-white p-3.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-600 resize-none shadow-xs"
            />
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
              <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Proveedor: {stats?.providerActive || 'Groq Llama 3'}</span>
            </div>

            <Button
              type="submit"
              disabled={analyzing || !testText.trim()}
              className="h-9 text-xs bg-violet-700 text-white hover:bg-violet-800 gap-1.5 rounded-xl shadow-xs font-semibold"
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Evaluar con IA</span>
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Resultado del simulador */}
        {testResult && (
          <div className="mt-5 rounded-2xl border border-violet-200 bg-white p-5 space-y-4 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-violet-950 uppercase tracking-wider">
                  Evaluación de Captación Completada
                </span>
              </div>
              <span className="text-xs font-bold font-mono bg-violet-100 text-violet-900 px-2.5 py-0.5 rounded-full">
                Score: {testResult.score_captacion ?? 'N/A'}/100
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                <span className="text-[10px] text-violet-700 uppercase font-bold block">Intención Detectada</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">{testResult.intencion_detectada || 'General'}</span>
              </div>
              <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                <span className="text-[10px] text-violet-700 uppercase font-bold block">Servicio Recomendado</span>
                <span className="font-bold text-slate-900 text-xs mt-0.5 block">{testResult.servicio_recomendado || 'Consulta General'}</span>
              </div>
              <div className="p-3 rounded-xl bg-violet-50/50 border border-violet-100">
                <span className="text-[10px] text-violet-700 uppercase font-bold block">Acción Sugerida</span>
                <span className="font-bold text-violet-800 text-xs mt-0.5 block">{testResult.accion_sugerida || 'CONTACTAR_WHATSAPP'}</span>
              </div>
            </div>

            <div className="text-xs text-slate-700 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
              <strong className="text-slate-900 block mb-1">Respuesta sugerida para el asesor humano:</strong>
              <p className="italic text-slate-700 leading-relaxed">"{testResult.mensaje_sugerido || testResult.justificacion}"</p>
            </div>
          </div>
        )}
      </div>

      {/* Historial de Auditoría de Decisiones IA */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Registro Histórico de Decisiones (DecisionesIA)
          </h3>
          <span className="text-xs text-slate-500 font-medium">Últimos {history.length} eventos auditados</span>
        </div>

        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        ) : history.length === 0 ? (
          <div className="p-14 text-center text-xs text-slate-500">
            No hay registros de decisiones de IA en el historial.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.map((dec) => (
              <div key={dec.id_decision} className="p-5 hover:bg-violet-50/20 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        DEC-#{dec.id_decision}
                      </span>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-violet-100 text-violet-800 border border-violet-200">
                        {dec.accion || dec.decision}
                      </span>
                      {dec.requiere_revision_humana && (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Revisión Humana
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(dec.fecha_hora).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-800">
                      <strong>Contacto:</strong> {dec.Persona ? `${dec.Persona.nombres} ${dec.Persona.apellidos} (${dec.Persona.numero})` : 'Anónimo'}{' '}
                      — <strong>Motivo:</strong> {dec.justificacion || dec.decision}
                    </p>

                    <p className="text-[11px] text-slate-400">
                      Método: <strong className="text-slate-600 font-mono">{dec.metodo || 'GROQ_LLAMA3'}</strong> · Regla: <span className="font-mono">{dec.regla_aplicada || 'EVALUACION_PROGRESIVA'}</span>
                    </p>
                  </div>

                  {dec.Oportunidad && (
                    <Link
                      to={`/buyer/${dec.Oportunidad.id_oportunidad}`}
                      className="inline-flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-900 bg-violet-50 px-3 py-1.5 rounded-xl border border-violet-200 shrink-0"
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
