import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Textarea } from '@/shared/components/ui/textarea';
import { useToast } from '@/shared/hooks/use-toast';
import { buyerService } from '../services/buyer.service';
import { Bot, Plus, Save, Sparkles, Trash2, Loader2, SlidersHorizontal } from 'lucide-react';

interface PersuasionRule {
  id: string;
  nombre: string;
  activa: boolean;
  criterio_campo: 'servicio' | 'motivo' | 'sede' | 'horario' | 'recurrencia' | 'general';
  criterio_valor: string;
  angulo_persuasion: string;
  argumento_clave: string;
  prioridad: number;
}

interface ChatbotRule {
  id: string;
  nombre: string;
  activa: boolean;
  tema: string;
  instruccion: string;
}

interface DescuentoPorDatosRule {
  activo: boolean;
  porcentaje_base: number;
  porcentaje_por_dato_extra: number;
  porcentaje_maximo: number;
  urgencia_texto: string;
}

const DEFAULT_DESCUENTO_POR_DATOS: DescuentoPorDatosRule = {
  activo: true,
  porcentaje_base: 5,
  porcentaje_por_dato_extra: 3,
  porcentaje_maximo: 20,
  urgencia_texto: 'Oferta válida por los últimos 3 días',
};

interface AgentRulesState {
  persuasion: {
    tono: 'consultivo' | 'empatico' | 'directo';
    objetivo_campana: string;
    descuento_por_datos: DescuentoPorDatosRule;
    reglas: PersuasionRule[];
  };
  chatbot: {
    tono: 'calido' | 'profesional' | 'breve';
    beneficios_permitidos: string[];
    reglas: ChatbotRule[];
  };
}

interface BuyerAgentRulesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BuyerAgentRulesModal: React.FC<BuyerAgentRulesModalProps> = ({
  open,
  onOpenChange,
}) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'persuasion' | 'chatbot'>('persuasion');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState<AgentRulesState | null>(null);
  const [newBenefit, setNewBenefit] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    buyerService
      .getAgentRules()
      .then((data) =>
        setRules({
          ...data,
          persuasion: {
            ...data.persuasion,
            descuento_por_datos: {
              ...DEFAULT_DESCUENTO_POR_DATOS,
              ...(data.persuasion?.descuento_por_datos || {}),
            },
          },
        }),
      )
      .catch((err) => {
        toast({
          title: 'Error al cargar reglas',
          description: err instanceof Error ? err.message : 'Intente nuevamente.',
          variant: 'destructive',
        });
      })
      .finally(() => setLoading(false));
  }, [open, toast]);

  const handleSave = async () => {
    if (!rules) return;
    setSaving(true);
    try {
      const saved = await buyerService.saveAgentRules(rules);
      setRules(saved);
      toast({
        title: 'Reglas actualizadas',
        description:
          'Los cambios ya están activos para el Agente de Persuasión y el Chatbot.',
      });
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'No se pudieron guardar las reglas',
        description: err instanceof Error ? err.message : 'Error de servidor.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const addPersuasionRule = () => {
    if (!rules) return;
    const item: PersuasionRule = {
      id: `pers-${Date.now()}`,
      nombre: 'Nueva regla de persuasión',
      activa: true,
      criterio_campo: 'motivo',
      criterio_valor: '',
      angulo_persuasion: '',
      argumento_clave: '',
      prioridad: rules.persuasion.reglas.length + 1,
    };
    setRules({
      ...rules,
      persuasion: {
        ...rules.persuasion,
        reglas: [item, ...rules.persuasion.reglas],
      },
    });
  };

  const addChatbotRule = () => {
    if (!rules) return;
    const item: ChatbotRule = {
      id: `chat-${Date.now()}`,
      nombre: 'Nueva regla del chatbot',
      activa: true,
      tema: 'Orientación general',
      instruccion: '',
    };
    setRules({
      ...rules,
      chatbot: {
        ...rules.chatbot,
        reglas: [item, ...rules.chatbot.reglas],
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3 border-b border-slate-200 dark:border-slate-800">
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-white">
            <SlidersHorizontal className="h-4 w-4 text-teal-600" />
            Configuración de Reglas del Agente Buyer
          </DialogTitle>
          <DialogDescription className="text-xs">
            Personaliza por separado las reglas internas de persuasión (para asesores) y las reglas del chatbot público (para pacientes).
          </DialogDescription>

          <div className="flex gap-2 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('persuasion')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'persuasion'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Agente de Persuasión (Interno)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chatbot')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                activeTab === 'chatbot'
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              <Bot className="h-3.5 w-3.5" />
              Chatbot de Landing (Paciente)
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4 bg-slate-50/50 dark:bg-slate-950/30">
          {loading || !rules ? (
            <div className="flex items-center justify-center py-12 text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
              Cargando reglas...
            </div>
          ) : activeTab === 'persuasion' ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tono de persuasión
                  </label>
                  <select
                    value={rules.persuasion.tono}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        persuasion: {
                          ...rules.persuasion,
                          tono: e.target.value as AgentRulesState['persuasion']['tono'],
                        },
                      })
                    }
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                  >
                    <option value="consultivo">Consultivo</option>
                    <option value="empatico">Empático</option>
                    <option value="directo">Directo</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Objetivo comercial activo
                  </label>
                  <Input
                    value={rules.persuasion.objetivo_campana}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        persuasion: {
                          ...rules.persuasion,
                          objetivo_campana: e.target.value,
                        },
                      })
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/10 p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                      Descuento progresivo según datos dejados
                    </h4>
                    <p className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80">
                      A mayor cantidad de datos completados por el Buyer, mayor descuento sugerido en su consulta.
                    </p>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={rules.persuasion.descuento_por_datos.activo}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          persuasion: {
                            ...rules.persuasion,
                            descuento_por_datos: {
                              ...rules.persuasion.descuento_por_datos,
                              activo: e.target.checked,
                            },
                          },
                        })
                      }
                      className="rounded border-slate-300 text-emerald-600"
                    />
                    Activo
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                      Base (% mínimo)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.persuasion.descuento_por_datos.porcentaje_base}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          persuasion: {
                            ...rules.persuasion,
                            descuento_por_datos: {
                              ...rules.persuasion.descuento_por_datos,
                              porcentaje_base: Math.max(0, Number(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                      Extra por dato (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={50}
                      value={rules.persuasion.descuento_por_datos.porcentaje_por_dato_extra}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          persuasion: {
                            ...rules.persuasion,
                            descuento_por_datos: {
                              ...rules.persuasion.descuento_por_datos,
                              porcentaje_por_dato_extra: Math.max(0, Number(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                      Tope máximo (%)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={rules.persuasion.descuento_por_datos.porcentaje_maximo}
                      onChange={(e) =>
                        setRules({
                          ...rules,
                          persuasion: {
                            ...rules.persuasion,
                            descuento_por_datos: {
                              ...rules.persuasion.descuento_por_datos,
                              porcentaje_maximo: Math.max(0, Number(e.target.value) || 0),
                            },
                          },
                        })
                      }
                      className="h-8 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-semibold uppercase text-slate-500 block mb-1">
                    Frase de urgencia / vigencia
                  </label>
                  <Input
                    value={rules.persuasion.descuento_por_datos.urgencia_texto}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        persuasion: {
                          ...rules.persuasion,
                          descuento_por_datos: {
                            ...rules.persuasion.descuento_por_datos,
                            urgencia_texto: e.target.value,
                          },
                        },
                      })
                    }
                    placeholder="Ej. Oferta válida por los últimos 3 días"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Reglas para convencer al cliente ({rules.persuasion.reglas.length})
                </h4>
                <Button type="button" size="sm" variant="outline" onClick={addPersuasionRule} className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Nueva regla
                </Button>
              </div>

              <div className="space-y-3">
                {rules.persuasion.reglas.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-3.5 space-y-2.5 bg-white dark:bg-slate-900 ${
                      rule.activa ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200/60 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={rule.activa}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = { ...rule, activa: e.target.checked };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-teal-600"
                        />
                        <Input
                          value={rule.nombre}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = { ...rule, nombre: e.target.value };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          placeholder="Nombre de la regla"
                          className="h-7 text-xs font-semibold"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-700"
                        onClick={() => {
                          const updated = rules.persuasion.reglas.filter((r) => r.id !== rule.id);
                          setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Evaluar campo</label>
                        <select
                          value={rule.criterio_campo}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = {
                              ...rule,
                              criterio_campo: e.target.value as PersuasionRule['criterio_campo'],
                            };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-xs"
                        >
                          <option value="motivo">Motivo / Síntoma</option>
                          <option value="servicio">Servicio de interés</option>
                          <option value="sede">Sede preferida</option>
                          <option value="horario">Horario</option>
                          <option value="recurrencia">Recurrencia</option>
                          <option value="general">General (siempre aplica)</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-[10px] text-slate-500 block mb-0.5">
                          Palabras clave (separadas por coma)
                        </label>
                        <Input
                          value={rule.criterio_valor}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = { ...rule, criterio_valor: e.target.value };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          placeholder="Ej: ortodoncia, brackets, estética"
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Ángulo de persuasión</label>
                        <Input
                          value={rule.angulo_persuasion}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = { ...rule, angulo_persuasion: e.target.value };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          placeholder="Ej: Financiamiento sin intereses y evaluación digital"
                          className="h-7 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Argumento clave para el asesor</label>
                        <Textarea
                          rows={2}
                          value={rule.argumento_clave}
                          onChange={(e) => {
                            const updated = [...rules.persuasion.reglas];
                            updated[idx] = { ...rule, argumento_clave: e.target.value };
                            setRules({ ...rules, persuasion: { ...rules.persuasion, reglas: updated } });
                          }}
                          placeholder="Qué debe enfatizar el agente para convencer al cliente..."
                          className="text-xs min-h-[52px]"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Tono del Chatbot en la Landing
                  </label>
                  <select
                    value={rules.chatbot.tono}
                    onChange={(e) =>
                      setRules({
                        ...rules,
                        chatbot: {
                          ...rules.chatbot,
                          tono: e.target.value as AgentRulesState['chatbot']['tono'],
                        },
                      })
                    }
                    className="w-full sm:w-56 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1.5 text-xs"
                  >
                    <option value="calido">Cálido y empático</option>
                    <option value="profesional">Profesional</option>
                    <option value="breve">Breve y directo</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 block mb-1">
                    Beneficios generales que el Chatbot puede mencionar
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {rules.chatbot.beneficios_permitidos.map((ben, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800"
                      >
                        {ben}
                        <button
                          type="button"
                          onClick={() =>
                            setRules({
                              ...rules,
                              chatbot: {
                                ...rules.chatbot,
                                beneficios_permitidos: rules.chatbot.beneficios_permitidos.filter(
                                  (_, idx) => idx !== i
                                ),
                              },
                            })
                          }
                          className="ml-1 text-emerald-600 hover:text-rose-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newBenefit}
                      onChange={(e) => setNewBenefit(e.target.value)}
                      placeholder="Agregar beneficio permitido..."
                      className="h-7 text-xs"
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (!newBenefit.trim()) return;
                        setRules({
                          ...rules,
                          chatbot: {
                            ...rules.chatbot,
                            beneficios_permitidos: [
                              ...rules.chatbot.beneficios_permitidos,
                              newBenefit.trim(),
                            ],
                          },
                        });
                        setNewBenefit('');
                      }}
                    >
                      Agregar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Reglas de comportamiento del Chatbot ({rules.chatbot.reglas.length})
                </h4>
                <Button type="button" size="sm" variant="outline" onClick={addChatbotRule} className="h-7 text-xs gap-1">
                  <Plus className="h-3.5 w-3.5" /> Nueva regla
                </Button>
              </div>

              <div className="space-y-3">
                {rules.chatbot.reglas.map((rule, idx) => (
                  <div
                    key={rule.id}
                    className={`rounded-xl border p-3.5 space-y-2 bg-white dark:bg-slate-900 ${
                      rule.activa ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200/60 opacity-65'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="checkbox"
                          checked={rule.activa}
                          onChange={(e) => {
                            const updated = [...rules.chatbot.reglas];
                            updated[idx] = { ...rule, activa: e.target.checked };
                            setRules({ ...rules, chatbot: { ...rules.chatbot, reglas: updated } });
                          }}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                        />
                        <Input
                          value={rule.nombre}
                          onChange={(e) => {
                            const updated = [...rules.chatbot.reglas];
                            updated[idx] = { ...rule, nombre: e.target.value };
                            setRules({ ...rules, chatbot: { ...rules.chatbot, reglas: updated } });
                          }}
                          className="h-7 text-xs font-semibold"
                        />
                        <Input
                          value={rule.tema}
                          onChange={(e) => {
                            const updated = [...rules.chatbot.reglas];
                            updated[idx] = { ...rule, tema: e.target.value };
                            setRules({ ...rules, chatbot: { ...rules.chatbot, reglas: updated } });
                          }}
                          placeholder="Tema"
                          className="h-7 text-xs w-40"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-rose-500 hover:text-rose-700"
                        onClick={() => {
                          const updated = rules.chatbot.reglas.filter((r) => r.id !== rule.id);
                          setRules({ ...rules, chatbot: { ...rules.chatbot, reglas: updated } });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Textarea
                      rows={2}
                      value={rule.instruccion}
                      onChange={(e) => {
                        const updated = [...rules.chatbot.reglas];
                        updated[idx] = { ...rule, instruccion: e.target.value };
                        setRules({ ...rules, chatbot: { ...rules.chatbot, reglas: updated } });
                      }}
                      placeholder="Instrucción para el chatbot..."
                      className="text-xs min-h-[52px]"
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={saving || loading || !rules}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Guardar reglas
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
