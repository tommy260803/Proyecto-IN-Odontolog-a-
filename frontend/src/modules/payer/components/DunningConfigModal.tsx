import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { useToast } from '@/shared/hooks/use-toast';
import {
  Clock,
  ShieldAlert,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Save,
  MessageSquare,
  Mail,
  Zap,
  Info,
} from 'lucide-react';

interface DunningRulesData {
  id_regla?: number;
  clave?: string;
  etapa1_preventivo_horas: number;
  etapa2_urgencia_horas: number;
  prorroga_express_horas: number;
  anticipacion_minima_horas: number;
  frecuencia_cron_minutos: number;
  auto_cancelar_medianoche: boolean;
  whatsapp_activo: boolean;
  email_activo: boolean;
  fecha_actualizacion?: string;
  actualizado_por?: string;
  motivo_calibracion?: string;
}

interface DunningConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const DEFAULT_RULES: DunningRulesData = {
  etapa1_preventivo_horas: 48,
  etapa2_urgencia_horas: 24,
  prorroga_express_horas: 24,
  anticipacion_minima_horas: 72,
  frecuencia_cron_minutos: 60,
  auto_cancelar_medianoche: true,
  whatsapp_activo: true,
  email_activo: true,
  motivo_calibracion: 'Calibración estándar de producción',
  actualizado_por: 'Administrador Clínico',
};

export const DunningConfigModal: React.FC<DunningConfigModalProps> = ({
  isOpen,
  onClose,
  onSaved,
}) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState<DunningRulesData>(DEFAULT_RULES);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<DunningRulesData | null>(null);

  // Cargar reglas vigentes de la base de datos al abrir el modal
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setIsLoading(true);

    fetch(`${API_URL}/payer/dunning-rules`)
      .then((res) => {
        if (!res.ok) throw new Error('Error al consultar reglas');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data.success && data.rules) {
          setFormData({
            ...data.rules,
            motivo_calibracion: data.rules.motivo_calibracion || '',
            actualizado_por: data.rules.actualizado_por || 'Administrador Clínico',
          });
          setLastSaved(data.rules);
        }
      })
      .catch((err) => {
        console.warn('Usando valores por defecto ante falla de red:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Validaciones de negocio
  const validationError = (() => {
    if (formData.etapa1_preventivo_horas <= formData.etapa2_urgencia_horas) {
      return 'La Etapa 1 Preventiva debe ocurrir más horas antes de la cita que la Etapa 2 de Urgencia (Etapa 1 > Etapa 2).';
    }
    if (formData.etapa1_preventivo_horas <= 0 || formData.etapa2_urgencia_horas <= 0) {
      return 'Las horas de las etapas preventivas deben ser mayores a cero.';
    }
    if (formData.prorroga_express_horas <= 0) {
      return 'La prórroga express debe ser de al menos 1 hora.';
    }
    if (formData.frecuencia_cron_minutos < 5) {
      return 'La frecuencia mínima del cron no puede ser inferior a 5 minutos.';
    }
    return null;
  })();

  const handleResetDefaults = () => {
    setFormData({
      ...DEFAULT_RULES,
      motivo_calibracion: 'Restablecimiento a valores de fábrica',
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validationError) {
      toast({
        title: 'Validación de Regla Inválida',
        description: validationError,
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        etapa1_preventivo_horas: Number(formData.etapa1_preventivo_horas),
        etapa2_urgencia_horas: Number(formData.etapa2_urgencia_horas),
        prorroga_express_horas: Number(formData.prorroga_express_horas),
        anticipacion_minima_horas: Number(formData.anticipacion_minima_horas),
        frecuencia_cron_minutos: Number(formData.frecuencia_cron_minutos),
        auto_cancelar_medianoche: Boolean(formData.auto_cancelar_medianoche),
        whatsapp_activo: Boolean(formData.whatsapp_activo),
        email_activo: Boolean(formData.email_activo),
        actualizado_por: formData.actualizado_por?.trim() || 'Administrador Clínico',
        motivo_calibracion: formData.motivo_calibracion?.trim() || 'Ajuste manual desde consola UI',
      };

      const res = await fetch(`${API_URL}/payer/dunning-rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al persistir en base de datos');
      }

      toast({
        title: 'Reglas de Cobranza Actualizadas',
        description: 'La configuración se guardó en SQL Server y el Agente Orquestador la aplicará de inmediato.',
      });

      setLastSaved(data.rules);
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error al guardar reglas',
        description: err.message || 'No se pudo conectar con el servidor',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900/90 dark:to-slate-900">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
                  Calibración de Reglas del Agente Orquestador
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
                  Control en tiempo real de la cadencia de cobranza, prórroga express y blindaje de sillón en Base de Datos.
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="p-10 flex flex-col items-center justify-center gap-3 text-slate-500">
            <div className="w-7 h-7 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-medium">Cargando parámetros desde NexoSaludDB...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            {/* Visualizador de Cadencia Temporal Resultante */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200/80 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-teal-600" />
                  Cadencia resultante del ciclo de blindaje:
                </span>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 font-bold">
                  {formData.frecuencia_cron_minutos} min / barrido
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-teal-200/80 dark:border-teal-900 text-xs">
                  <div className="font-bold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-teal-500" />
                    T-{formData.etapa1_preventivo_horas}h Preventivo
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Recordatorio formal con orden de pago adjunta.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-200/80 dark:border-amber-900 text-xs">
                  <div className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    T-{formData.etapa2_urgencia_horas}h Urgencia
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Aviso crítico de riesgo con prórroga de +{formData.prorroga_express_horas}h.
                  </p>
                </div>

                <div className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-rose-200/80 dark:border-rose-900 text-xs">
                  <div className="font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    {formData.auto_cancelar_medianoche ? '00:00h Liberación' : 'Modo Manual'}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {formData.auto_cancelar_medianoche
                      ? 'Cancela reserva y libera sillón para sobrecupos.'
                      : 'Requiere cancelación manual por recepción.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Error de validación visible */}
            {validationError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{validationError}</span>
              </div>
            )}

            {/* Sección 1: Parámetros de Tiempos (Horas) */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                1. Ventanas de Tiempo y Cadencia
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="etapa1" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Etapa 1: Recordatorio Preventivo (horas antes)
                  </Label>
                  <div className="relative">
                    <Input
                      id="etapa1"
                      type="number"
                      min="1"
                      max="168"
                      value={formData.etapa1_preventivo_horas}
                      onChange={(e) =>
                        setFormData({ ...formData, etapa1_preventivo_horas: parseInt(e.target.value) || 0 })
                      }
                      className="text-xs pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">horas</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Valor de fábrica recomendado: 48h (2 días antes).</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="etapa2" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Etapa 2: Alerta de Urgencia (horas antes)
                  </Label>
                  <div className="relative">
                    <Input
                      id="etapa2"
                      type="number"
                      min="1"
                      max="72"
                      value={formData.etapa2_urgencia_horas}
                      onChange={(e) =>
                        setFormData({ ...formData, etapa2_urgencia_horas: parseInt(e.target.value) || 0 })
                      }
                      className="text-xs pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">horas</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Valor de fábrica recomendado: 24h (1 día antes).</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prorroga" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Extensión de Prórroga Express (horas concedidas)
                  </Label>
                  <div className="relative">
                    <Input
                      id="prorroga"
                      type="number"
                      min="1"
                      max="72"
                      value={formData.prorroga_express_horas}
                      onChange={(e) =>
                        setFormData({ ...formData, prorroga_express_horas: parseInt(e.target.value) || 0 })
                      }
                      className="text-xs pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">horas</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Plazo que se añade cuando el paciente pulsa el botón de WhatsApp.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="cronFreq" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Frecuencia de Evaluación del Worker Cron (minutos)
                  </Label>
                  <div className="relative">
                    <Input
                      id="cronFreq"
                      type="number"
                      min="5"
                      max="360"
                      value={formData.frecuencia_cron_minutos}
                      onChange={(e) =>
                        setFormData({ ...formData, frecuencia_cron_minutos: parseInt(e.target.value) || 0 })
                      }
                      className="text-xs pr-12"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">min</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Intervalo de barrido de la base de datos (por defecto: 60 min).</p>
                </div>
              </div>
            </div>

            {/* Sección 2: Canales y Políticas Automáticas */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                2. Canales de Despacho y Políticas de Blindaje
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.whatsapp_activo}
                    onChange={(e) => setFormData({ ...formData, whatsapp_activo: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      Canal WhatsApp
                    </span>
                    <p className="text-[10px] text-slate-500">Envío de alertas interactivas de cadencia con botones de acción.</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.email_activo}
                    onChange={(e) => setFormData({ ...formData, email_activo: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      Canal Correo (PDF)
                    </span>
                    <p className="text-[10px] text-slate-500">Despacho de órdenes de pago con comprobantes oficiales adjuntos.</p>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all">
                  <input
                    type="checkbox"
                    checked={formData.auto_cancelar_medianoche}
                    onChange={(e) => setFormData({ ...formData, auto_cancelar_medianoche: e.target.checked })}
                    className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                  />
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-rose-600" />
                      Liberación 00:00h
                    </span>
                    <p className="text-[10px] text-slate-500">Cancela citas sin pago el día asignado y desasigna el sillón.</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Sección 3: Justificación de Auditoría */}
            <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                3. Trazabilidad de Auditoría
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="motivo" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Motivo de la calibración
                  </Label>
                  <Input
                    id="motivo"
                    placeholder="Ej: Ajuste por temporada alta o campaña especial"
                    value={formData.motivo_calibracion || ''}
                    onChange={(e) => setFormData({ ...formData, motivo_calibracion: e.target.value })}
                    className="text-xs"
                    maxLength={250}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="usuario" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    Operador / Responsable
                  </Label>
                  <Input
                    id="usuario"
                    placeholder="Nombre del usuario o cargo"
                    value={formData.actualizado_por || ''}
                    onChange={(e) => setFormData({ ...formData, actualizado_por: e.target.value })}
                    className="text-xs"
                    maxLength={100}
                  />
                </div>
              </div>

              {lastSaved?.fecha_actualizacion && (
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Última modificación guardada:{' '}
                    <strong>{new Date(lastSaved.fecha_actualizacion).toLocaleString('es-PE')}</strong> por{' '}
                    <strong>{lastSaved.actualizado_por || 'Sistema'}</strong>.
                  </span>
                </div>
              )}
            </div>

            <DialogFooter className="p-0 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetDefaults}
                className="text-xs text-slate-600 hover:text-slate-900 border-slate-200 gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restablecer Valores de Fábrica</span>
              </Button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs"
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  size="sm"
                  disabled={isSaving || Boolean(validationError)}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 gap-1.5 shadow-sm cursor-pointer"
                >
                  {isSaving ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Guardar </span>
                    </>
                  )}
                </Button>
              </div>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
