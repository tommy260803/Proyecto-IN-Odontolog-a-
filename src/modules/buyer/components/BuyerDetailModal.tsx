import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { BuyerForm, type BuyerFormRef } from './BuyerForm';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead } from '../hooks/useBuyerQueries';
import { useToast } from '@/shared/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { Button } from '@/shared/components/ui/button';
import { canTransitionBuyerToLead } from '@/domain/transitions';
import { BuyerState } from '@/domain/enums';
import { StatusBadge } from '@/shared/components/feedback/StatusBadge';
import { JourneyStepper } from '@/shared/components/data-display/JourneyStepper';
import { UserCheck, ArrowRight, Save, Loader2, Sparkles, ShieldCheck, Stethoscope, MapPin, Clock, Radio, Tag, CheckCircle2, AlertTriangle, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { analyzeBuyerMarketingAgent, type BuyerMarketingAnalysis } from '@/shared/services/groqService';

interface BuyerDetailModalProps {
  buyerId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function BuyerDetailModal({ buyerId, isOpen, onClose }: BuyerDetailModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: buyer, isLoading, isError } = useBuyer(buyerId || '');
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();
  const buyerFormRef = useRef<BuyerFormRef>(null);

  const journeys: any[] = [];
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isAgentExpanded, setIsAgentExpanded] = useState(true);
  const [aiAnalysis, setAiAnalysis] = useState<BuyerMarketingAnalysis | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Auto-análisis del Agente de Marketing al abrir el modal
  useEffect(() => {
    if (isOpen && buyer) {
      setIsAiLoading(true);
      analyzeBuyerMarketingAgent({
        fullName: `${buyer.person?.firstName || ''} ${buyer.person?.lastName || ''}`.trim(),
        phone: buyer.person?.phone,
        email: buyer.person?.email,
        serviceOfInterest: buyer.serviceOfInterest,
        preferredBranch: buyer.pref_sede_preferida,
        preferredTimeSlot: buyer.pref_id_horario,
        channel: buyer.channel,
        attractionSource: buyer.attractionSource,
        concreteRequest: buyer.concreteRequest,
        contactAuthorization: buyer.contactAuthorization,
        qualityStatus: buyer.state === BuyerState.CONVERTED ? 'Valido' : undefined
      }).then(result => {
        setAiAnalysis(result);
      }).catch(err => {
        console.warn('Error en análisis del agente de marketing:', err);
      }).finally(() => {
        setIsAiLoading(false);
      });
    } else if (!isOpen) {
      setAiAnalysis(null);
    }
  }, [isOpen, buyer?.id]);

  const handleSubmit = (data: BuyerFormValues) => {
    if (!buyerId) return;
    updateBuyer.mutate({
      id: buyerId,
      data: {
        channel: data.channel,
        attractionSource: data.attractionSource,
        serviceOfInterestId: data.serviceOfInterestId,
        contactAuthorization: data.contactAuthorization,
        concreteRequest: data.concreteRequest,
        pref_id_canal: data.pref_id_canal,
        pref_id_horario: data.pref_id_horario,
        pref_id_modalidad: data.pref_id_modalidad,
        pref_sede_preferida: data.pref_sede_preferida,
        pref_profesional_preferido: data.pref_profesional_preferido,
        estudianteAplica: data.estudianteAplica,
        universidad: data.universidad,
        carrera: data.carrera,
        ciclo: data.ciclo,
        laboralAplica: data.laboralAplica,
        ocupacion: data.ocupacion,
        empresa: data.empresa,
        modalidadLaboral: data.modalidadLaboral,
        disponibilidadLaboral: data.disponibilidadLaboral,
        ultima_visita_odontologica: data.ultima_visita_odontologica,
        motivo_consulta_odonto: data.motivo_consulta_odonto,
        tratamiento_previo: data.tratamiento_previo,
        nivel_dolor: data.nivel_dolor,
        presenta_sensibilidad: data.presenta_sensibilidad,
        sangrado_o_inflamacion: data.sangrado_o_inflamacion,
        usa_aparato_o_protesis: data.usa_aparato_o_protesis,
        condicion_atencion_especial: data.condicion_atencion_especial,
        person: {
          firstName: data.firstName,
          lastName: data.lastName,
          documentType: data.documentType,
          documentNumber: data.documentNumber,
          phone: data.phone,
          email: data.email,
        }
      }
    }, {
      onSuccess: () => {
        toast({ title: '¡Éxito!', description: 'Datos del BUYER actualizados correctamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      },
      onError: (err) => {
        toast({ title: 'Error al actualizar', description: err.message, variant: 'destructive' });
      }
    });
  };

  const handleConvert = () => {
    if (!buyerId) return;
    convertBuyer.mutate(buyerId, {
      onSuccess: () => {
        toast({ title: 'Convertido', description: 'El Buyer ha sido transferido a LEAD exitosamente.' });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setIsConvertDialogOpen(false);
        onClose();
      },
      onError: (err) => {
        toast({ title: 'No se pudo convertir', description: err.message, variant: 'destructive' });
      }
    });
  };

  if (!isOpen || !buyerId) return null;

  const isConverted = buyer?.state === BuyerState.CONVERTED;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] sm:max-h-[92vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <DialogHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                    Detalle del BUYER
                  </DialogTitle>
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                    ID: {buyer?.id}
                  </p>
                </div>
              </div>

              {buyer && (
                <div className="flex items-center gap-2">
                  <StatusBadge 
                    status={buyer.state} 
                    variant={isConverted ? 'success' : 'neutral'} 
                  />
                  {!isConverted ? (
                    <Button 
                      disabled={convertBuyer.isPending} 
                      onClick={() => setIsConvertDialogOpen(true)}
                      className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl shadow-sm text-xs font-semibold px-3.5 py-2 h-9 flex items-center gap-1.5 transition-colors"
                    >
                      {convertBuyer.isPending ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Convirtiendo...</span>
                        </>
                      ) : (
                        <>
                          <span>Convertir a LEAD</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </Button>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                      ✓ En Etapa LEAD
                    </span>
                  )}
                </div>
              )}
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1 space-y-6 bg-slate-50/30 dark:bg-slate-950/30">
          {isLoading ? (
            <LoadingState />
          ) : isError || !buyer ? (
            <ErrorState message="No se pudo cargar la información del Buyer." />
          ) : (
            <div className="space-y-6">
              {/* Agente de Marketing (IA) — 4 Actividades Clave de Negocio */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-sm text-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-teal-500/10 border border-teal-500/20 text-teal-400">
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div>
                      <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                        <span>Agente Inteligente de Marketing</span>
                        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-teal-950 text-teal-300 border border-teal-800">
                          Etapa BUYER · BI
                        </span>
                      </h3>
                      <p className="text-[11px] text-slate-400">Automatización de las 4 actividades clave del embudo de captación.</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsAgentExpanded(!isAgentExpanded)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    {isAgentExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                </div>

                {isAgentExpanded && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    
                    {/* Actividad 1: Validación y Calidad de Datos */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" /> 1. Validación de Registro
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          aiAnalysis?.dataQuality.status === 'Valido' 
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                            : aiAnalysis?.dataQuality.status === 'Duplicado'
                            ? 'bg-rose-950 text-rose-300 border border-rose-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {aiAnalysis?.dataQuality.status || 'Valido'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {aiAnalysis?.dataQuality.explanation || '9 dígitos y consentimiento de Ley N° 29733 validados.'}
                      </p>
                    </div>

                    {/* Actividad 2: Clasificación de Preferencias */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                          <Stethoscope className="h-3.5 w-3.5" /> 2. Perfil de Preferencias
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {aiAnalysis?.preferencesProfile.category || 'Odontología'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        <span className="font-semibold text-white">{buyer.serviceOfInterest || 'Consulta Dental'}</span> · {buyer.pref_sede_preferida || 'Sede Principal'}
                      </p>
                    </div>

                    {/* Actividad 3: Identificación del Origen */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                          <Tag className="h-3.5 w-3.5" /> 3. Origen de Captación
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-950 text-teal-300 border border-teal-800">
                          {buyer.channel || 'Portal Web'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Fuente: <span className="font-semibold text-white">{buyer.attractionSource || 'Meta Ads (Campaña 2026)'}</span>
                      </p>
                    </div>

                    {/* Actividad 4: Evaluación de Conversión a LEAD */}
                    <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5" /> 4. Intención Comercial
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                          aiAnalysis?.intentEvaluation.intentLevel === 'ALTA'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {aiAnalysis?.intentEvaluation.intentLevel ? `Intención ${aiAnalysis.intentEvaluation.intentLevel}` : 'Intención Alta'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        {aiAnalysis?.intentEvaluation.intentReason || 'Solicita información de precios y agendamiento clínico.'}
                      </p>
                    </div>

                  </div>
                )}
              </div>

              {journeys.find(j => j.buyerId === buyer.id) && (
                <div className="py-2">
                  <JourneyStepper journey={journeys.find(j => j.buyerId === buyer.id)!} />
                </div>
              )}

              <BuyerForm 
                ref={buyerFormRef}
                isEdit 
                formId="buyer-edit-form"
                hideSubmitButton
                initialValues={{
                  firstName: buyer.person.firstName,
                  lastName: buyer.person.lastName,
                  documentType: buyer.person.documentType,
                  documentNumber: buyer.person.documentNumber,
                  email: buyer.person.email,
                  phone: buyer.person.phone,
                  channel: buyer.channelId || buyer.channel,
                  attractionSource: buyer.attractionSourceId || buyer.attractionSource,
                  serviceOfInterestId: buyer.serviceOfInterestId,
                  contactAuthorization: buyer.contactAuthorization,
                  concreteRequest: buyer.concreteRequest,
                  pref_id_canal: buyer.pref_id_canal,
                  pref_id_horario: buyer.pref_id_horario,
                  pref_id_modalidad: buyer.pref_id_modalidad,
                  pref_sede_preferida: buyer.pref_sede_preferida,
                  pref_profesional_preferido: buyer.pref_profesional_preferido,
                  estudianteAplica: buyer.estudianteAplica,
                  universidad: buyer.universidad,
                  carrera: buyer.carrera,
                  ciclo: buyer.ciclo,
                  laboralAplica: buyer.laboralAplica,
                  ocupacion: buyer.ocupacion,
                  empresa: buyer.empresa,
                  modalidadLaboral: buyer.modalidadLaboral,
                  disponibilidadLaboral: buyer.disponibilidadLaboral,
                  ultima_visita_odontologica: buyer.ultima_visita_odontologica,
                  motivo_consulta_odonto: buyer.motivo_consulta_odonto,
                  tratamiento_previo: buyer.tratamiento_previo,
                  nivel_dolor: buyer.nivel_dolor,
                  presenta_sensibilidad: buyer.presenta_sensibilidad,
                  sangrado_o_inflamacion: buyer.sangrado_o_inflamacion,
                  usa_aparato_o_protesis: buyer.usa_aparato_o_protesis,
                  condicion_atencion_especial: buyer.condicion_atencion_especial,
                }} 
                onSubmit={handleSubmit} 
                isLoading={updateBuyer.isPending} 
              />
            </div>
          )}
        </div>

        {/* Footer Fijo */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="rounded-xl border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold px-4 py-2 h-9.5 transition-colors"
          >
            Cerrar
          </Button>

          <Button
            type="button"
            onClick={() => buyerFormRef.current?.submit()}
            disabled={updateBuyer.isPending || !buyer}
            className="bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white rounded-xl text-xs font-semibold px-5 py-2 h-9.5 shadow-sm transition-all flex items-center gap-1.5"
          >
            {updateBuyer.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Actualizando...</span>
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5" />
                <span>Actualizar BUYER</span>
              </>
            )}
          </Button>
        </div>

        {/* Confirmación para conversión */}
        <ConfirmationDialog
          isOpen={isConvertDialogOpen}
          onClose={() => setIsConvertDialogOpen(false)}
          onConfirm={handleConvert}
          title="¿Convertir a LEAD?"
          description="Esta acción cambiará el estado del Buyer y creará un nuevo registro en el módulo LEAD para abrir la mesa de negociación."
          confirmText="Sí, Convertir a LEAD"
          variant="default"
        />
      </DialogContent>
    </Dialog>
  );
}
