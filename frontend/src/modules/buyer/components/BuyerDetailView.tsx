import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Edit3,
  X,
  Save,
  Loader2,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Clock,
  CheckCircle2,
  FileText,
  Radio,
  Stethoscope,
  MapPin,
  UserCheck,
  Phone,
  Mail,
  Activity,
  Bot,
  Flame,
  Zap,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import { useBuyer, useUpdateBuyer, useConvertBuyerToLead, useEvaluateBuyer } from '../hooks/useBuyerQueries';
import { buyerService } from '../services/buyer.service';
import { BuyerState } from '@/domain/enums';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { renderBuyerStatusBadge } from './BuyerListView';

interface BuyerDetailViewProps {
  buyerId: string;
}

const HORARIO_LABELS: Record<string, string> = {
  '1': 'Mañana (08:00 - 13:00)',
  '2': 'Tarde (13:00 - 18:00)',
  '3': 'Noche (18:00 - 21:00)',
};

export function BuyerDetailView({ buyerId }: BuyerDetailViewProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: buyer, isLoading, isError } = useBuyer(buyerId);
  const updateBuyer = useUpdateBuyer();
  const convertBuyer = useConvertBuyerToLead();
  const evaluateBuyer = useEvaluateBuyer();

  const [isEditing, setIsEditing] = useState(() => searchParams.get('mode') === 'edit');
  const [isConvertDialogOpen, setIsConvertDialogOpen] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isGeneratingPersuasion, setIsGeneratingPersuasion] = useState(false);
  const [persuasionStrategy, setPersuasionStrategy] = useState<{
    angulo_principal: string;
    argumentos: string[];
    reglas_aplicadas: string[];
    objecion_probable: string;
    guion_whatsapp: string;
    source: 'gemini' | 'reglas_locales';
    descuento_recomendado?: {
      activo: boolean;
      porcentaje: number;
      datos_completados: string[];
      datos_faltantes: string[];
      total_datos: number;
      urgencia_texto: string;
      frases_gancho: string[];
    };
  } | null>(null);

  const handleGeneratePersuasion = async () => {
    setIsGeneratingPersuasion(true);
    try {
      const result = await buyerService.generatePersuasionStrategy(buyerId);
      setPersuasionStrategy(result);
    } catch (err) {
      toast({
        title: 'Error al generar estrategia',
        description: err instanceof Error ? err.message : 'Intente nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPersuasion(false);
    }
  };

  // Catálogos para edición
  const [catalogs, setCatalogs] = useState<{
    canales: any[];
    fuentes: any[];
    servicios: any[];
    sedes: any[];
  }>({ canales: [], fuentes: [], servicios: [], sedes: [] });

  // Estado del formulario de edición in-place
  const [editForm, setEditForm] = useState({
    firstName: '',
    lastName: '',
    documentNumber: '',
    phone: '',
    email: '',
    serviceOfInterestId: '',
    pref_sede_preferida: '',
    pref_id_horario: '',
    concreteRequest: '',
    channel: '1',
    attractionSource: '1',
    contactAuthorization: true,
  });

  // La evaluación se recupera directamente de la entidad persistida cargada desde el backend
  const evaluacion = (buyer as any)?.latestEvaluation;
  const isEvaluationCurrent = Boolean(
    evaluacion &&
      evaluacion.es_mensaje_vigente !== false &&
      evaluacion.es_contexto_vigente !== false &&
      evaluacion.estado !== 'DESACTUALIZADA' &&
      (!evaluacion.mensaje_evaluado ||
        !buyer?.concreteRequest ||
        evaluacion.mensaje_evaluado.trim() === buyer.concreteRequest.trim())
  );
  const isEvaluationOutdated = Boolean(
    evaluacion &&
      (evaluacion.es_contexto_vigente === false || evaluacion.estado === 'DESACTUALIZADA')
  );
  const hasUnevaluatedNewMessage = Boolean(
    evaluacion &&
      (evaluacion.es_mensaje_vigente === false ||
        (evaluacion.mensaje_evaluado &&
          buyer?.concreteRequest &&
          evaluacion.mensaje_evaluado.trim() !== buyer.concreteRequest.trim()))
  );

  useEffect(() => {
    if (!isEditing) return;

    buyerService
      .getCatalogs()
      .then((data) => setCatalogs(data))
      .catch((err) => console.error('Error loading catalogs:', err));
  }, [isEditing]);

  useEffect(() => {
    if (searchParams.get('mode') === 'edit') {
      setIsEditing(true);
    }
  }, [searchParams]);

  useEffect(() => {
    if (buyer) {
      setEditForm({
        firstName: buyer.person?.firstName || '',
        lastName: buyer.person?.lastName || '',
        documentNumber: buyer.person?.documentNumber || '',
        phone: buyer.person?.phone || '',
        email: buyer.person?.email || '',
        serviceOfInterestId: String(buyer.serviceOfInterestId || ''),
        pref_sede_preferida: buyer.pref_sede_preferida || 'Sede California',
        pref_id_horario: String(buyer.pref_id_horario || '1'),
        concreteRequest: buyer.concreteRequest || 'Consultar presupuesto y disponibilidad',
        channel: String(buyer.channelId || buyer.channel || '1'),
        attractionSource: String(buyer.attractionSourceId || buyer.attractionSource || '1'),
        contactAuthorization: buyer.contactAuthorization ?? true,
      });
    }
  }, [buyer]);

  // Actualizar: evalúa el mensaje vigente con Gemini en el backend y persiste el resultado
  const handleRefreshAI = () => {
    if (!buyer || evaluateBuyer.isPending || isRetrying) return;
    evaluateBuyer.mutate(
      { id: buyerId, message: buyer.concreteRequest },
      {
        onSuccess: (data: any) => {
          toast({
            title: 'Evaluación Gemini actualizada',
            description: `Intención: ${data?.latestEvaluation?.intencion || 'Evaluada'} · Persistida en base de datos.`,
          });
        },
        onError: (err: any) => {
          toast({
            title: 'Error al evaluar',
            description: err?.message || 'Error al conectar con el evaluador Gemini',
            variant: 'destructive',
          });
        },
      }
    );
  };

  // Reintentar evaluación fallida reutilizando el mismo id_interaccion
  const handleRetryEvaluation = (interactionId?: number) => {
    if (!interactionId || isRetrying) return;
    setIsRetrying(true);
    buyerService
      .retryEvaluation(interactionId)
      .then(() => {
        toast({
          title: 'Reintento completado',
          description: 'La evaluación pendiente fue procesada nuevamente con el mismo ID.',
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, buyerId] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      })
      .catch((err) => {
        toast({
          title: 'Fallo al reintentar',
          description: err?.message || 'No se pudo completar el reintento',
          variant: 'destructive',
        });
      })
      .finally(() => setIsRetrying(false));
  };

  // Construcción del Activity Timeline (Historial de Interacciones)
  const timelineEvents = useMemo(() => {
    if (!buyer) return [];
    const events: Array<{
      id: string;
      title: string;
      subtitle: string;
      detail?: string;
      timestamp: string;
      type: 'conversion' | 'inquiry' | 'consent' | 'created';
    }> = [];

    if (buyer.state === BuyerState.CONVERTED) {
      events.push({
        id: 'evt-converted',
        title: 'Prospecto transferido a etapa LEAD',
        subtitle: 'Calificación comercial completada · Pasa a Mesa de Negociación',
        detail: `Servicio priorizado: ${buyer.serviceOfInterest || 'Evaluación Odontológica'}`,
        timestamp: buyer.updatedAt || buyer.createdAt,
        type: 'conversion',
      });
    }

    if (buyer.solicitudesHistory && buyer.solicitudesHistory.length > 0) {
      buyer.solicitudesHistory.forEach((sol: any, idx: number) => {
        events.push({
          id: `evt-sol-${sol.id || idx}`,
          title: `Formulario / Consulta registrada #${buyer.solicitudesHistory.length - idx}`,
          subtitle: `Tratamiento: ${sol.servicio || buyer.serviceOfInterest || 'Evaluación General'} · Canal: ${buyer.channel || 'Portal Web'}`,
          detail: sol.motivo || buyer.concreteRequest || 'Solicitud de información y presupuesto clínico.',
          timestamp: sol.fecha || buyer.createdAt,
          type: 'inquiry',
        });
      });
    } else {
      events.push({
        id: 'evt-initial-inquiry',
        title: 'Solicitud de información registrada',
        subtitle: `Tratamiento: ${buyer.serviceOfInterest || 'Evaluación Odontológica'} · Sede: ${buyer.pref_sede_preferida || 'Sede California'}`,
        detail: buyer.concreteRequest || 'Consulta de costos y disponibilidad de cita odontológica.',
        timestamp: buyer.createdAt,
        type: 'inquiry',
      });
    }

    events.push({
      id: 'evt-consent',
      title: 'Validación de Protección de Datos (Ley N° 29733)',
      subtitle: buyer.contactAuthorization
        ? 'Consentimiento informado otorgado para contacto comercial vía WhatsApp y correo'
        : 'Pendiente de confirmación de consentimiento comercial',
      timestamp: buyer.createdAt,
      type: 'consent',
    });

    events.push({
      id: 'evt-created',
      title: 'Creación de Ficha de Prospecto (BUYER)',
      subtitle: `Origen atribuido: ${buyer.channel || 'Portal Web'} · Fuente: ${buyer.attractionSource || 'Captación Directa'}`,
      timestamp: buyer.createdAt,
      type: 'created',
    });

    return events;
  }, [buyer]);

  if (isLoading) return <LoadingState />;
  if (isError || !buyer) return <ErrorState message="No se encontró la ficha del prospecto solicitado." />;

  const fullName =
    `${buyer.person?.firstName || ''} ${buyer.person?.lastName || ''}`.trim() ||
    'Prospecto Sin Nombre';
  const isConverted = buyer.state === BuyerState.CONVERTED;

  const cleanPhone = String(buyer.person?.phone || '').replace(/\D/g, '');
  const whatsappText = encodeURIComponent(
    `Hola ${buyer.person?.firstName || ''}, te escribimos de la clínica dental NexoSalud respecto a tu consulta sobre ${
      buyer.serviceOfInterest || 'evaluación odontológica'
    } en ${buyer.pref_sede_preferida || 'nuestra sede'}. ¿En qué horario te gustaría agendar tu turno?`
  );
  const whatsappUrl = cleanPhone
    ? `https://wa.me/51${cleanPhone.slice(-9)}?text=${whatsappText}`
    : undefined;

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim() || !editForm.lastName.trim() || editForm.phone.trim().length < 9) {
      toast({
        title: 'Datos incompletos',
        description: 'Verifica nombres, apellidos y un teléfono válido de 9 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    updateBuyer.mutate(
      {
        id: buyerId,
        data: {
          channel: editForm.channel,
          attractionSource: editForm.attractionSource,
          serviceOfInterestId: editForm.serviceOfInterestId,
          pref_sede_preferida: editForm.pref_sede_preferida,
          pref_id_horario: editForm.pref_id_horario,
          concreteRequest: editForm.concreteRequest,
          contactAuthorization: editForm.contactAuthorization,
          person: {
            firstName: editForm.firstName.trim(),
            lastName: editForm.lastName.trim(),
            documentNumber: editForm.documentNumber.trim(),
            phone: editForm.phone.trim(),
            email: editForm.email.trim(),
          },
        },
      },
      {
        onSuccess: () => {
          toast({
            title: 'Ficha actualizada',
            description: 'Los datos del prospecto fueron guardados correctamente.',
          });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
          queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, buyerId] });
          setIsEditing(false);
          setSearchParams({}, { replace: true });
        },
        onError: (err) => {
          toast({
            title: 'Error al guardar cambios',
            description: err.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleConvert = () => {
    convertBuyer.mutate(buyerId, {
      onSuccess: () => {
        toast({
          title: 'Prospecto convertido a LEAD',
          description: `${fullName} fue transferido al módulo LEAD.`,
        });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
        queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
        setIsConvertDialogOpen(false);
        navigate('/lead');
      },
      onError: (err) => {
        toast({
          title: 'No se pudo convertir',
          description: err.message,
          variant: 'destructive',
        });
      },
    });
  };

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Cabecera Fija de la Ficha del Prospecto */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3.5 sm:py-4 bg-[#f8fafc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <Link
              to="/buyer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Volver a Prospectos</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {fullName}
              </h1>
              {renderBuyerStatusBadge(buyer.state)}
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                ID #{buyer.id}
                {buyer.person?.documentNumber ? ` · DNI ${buyer.person.documentNumber}` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Acciones Fijas Arriba: "Convertir a LEAD", "Editar", "Cerrar" */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {!isConverted && (
              <button
                type="button"
                onClick={() => setIsConvertDialogOpen(true)}
                disabled={convertBuyer.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] cursor-pointer"
              >
                {convertBuyer.isPending ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Convirtiendo...</span>
                  </>
                ) : (
                  <>
                    <span>Convertir a LEAD</span>
                    <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                const next = !isEditing;
                setIsEditing(next);
                if (!next) setSearchParams({}, { replace: true });
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors cursor-pointer ${
                isEditing
                  ? 'border-[#0f766e] bg-teal-50/60 text-[#0f766e] dark:border-teal-600 dark:bg-teal-950/50 dark:text-teal-300'
                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Edit3 className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>{isEditing ? 'Modo Lectura' : 'Editar'}</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/buyer')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>

      {/* Arquitectura a 2 Columnas (Layout 65/35 -> 8 cols / 4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* COLUMNA IZQUIERDA (65%): Description List + Activity Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bloque 1: Ficha de Datos en Description List o Modo Edición In-Place */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Información de Contacto y Preferencias Clínicas
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Expediente comercial estructurado sin duplicación de contenedores.
                </p>
              </div>
              {isEditing && (
                <span className="rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  Edición activa
                </span>
              )}
            </div>

            {!isEditing ? (
              /* Description List limpia (dl / dt / dd) dividida por bordes de 1px */
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {/* Sección A: Datos de Contacto */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    1. Datos Personales & Contacto
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Nombre Completo
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {fullName}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Documento / DNI
                      </dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {buyer.person?.documentNumber || 'No especificado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Teléfono / WhatsApp
                      </dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>
                          {buyer.person?.phone ? `+51 ${buyer.person.phone}` : 'Sin teléfono'}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Correo Electrónico
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" strokeWidth={1.75} />
                        <span className="truncate">
                          {buyer.person?.email || 'No registrado'}
                        </span>
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Consentimiento de Datos (Ley N° 29733)
                      </dt>
                      <dd className="mt-1 flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                        <ShieldCheck
                          className={`h-3.5 w-3.5 ${
                            buyer.contactAuthorization ? 'text-[#0f766e]' : 'text-slate-400'
                          }`}
                          strokeWidth={1.75}
                        />
                        <span>
                          {buyer.contactAuthorization
                            ? 'Autorizado para envío de presupuestos y recordatorios clínicos'
                            : 'Sin autorización registrada'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Sección B: Interés Clínico y Preferencias */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    2. Interés Clínico y Preferencias
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Tratamiento Solicitado
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                        <span>{buyer.serviceOfInterest || 'Evaluación Odontológica General'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Sede de Preferencia
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{buyer.pref_sede_preferida || 'No especificada'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Disponibilidad Horaria
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>
                          {HORARIO_LABELS[String(buyer.pref_id_horario)] ||
                            buyer.pref_id_horario ||
                            'No especificado'}
                        </span>
                      </dd>
                    </div>

                    <div className="sm:col-span-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400 flex items-center justify-between">
                        <span>Motivo Concreto de Consulta (Mensaje Vigente)</span>
                        {buyer.interaccionesHistory && buyer.interaccionesHistory.length > 1 && (
                          <span className="text-[10px] text-slate-400 font-normal">
                            Historial: {buyer.interaccionesHistory.length} interacciones
                          </span>
                        )}
                      </dt>
                      <dd className="mt-1.5 border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/50 pl-3 py-2 text-xs text-slate-800 dark:text-slate-200 leading-relaxed">
                        {buyer.concreteRequest ||
                          'Solicita información sobre costos de tratamiento y disponibilidad de cita inicial.'}
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* Sección C: Origen y Trazabilidad */}
                <div className="px-6 py-4">
                  <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    3. Origen y Trazabilidad
                  </h3>
                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Canal de Captura
                      </dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {buyer.channel || 'Página Web / Portal Online'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Fuente de Atracción
                      </dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {buyer.attractionSource || 'Campaña Digital / Orgánico'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Fecha de Captación
                      </dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {buyer.createdAt
                          ? format(new Date(buyer.createdAt), 'dd MMM yyyy, HH:mm', {
                              locale: es,
                            })
                          : '—'}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              /* Formulario de Edición Limpio separado por divisores de 1px */
              <form onSubmit={handleSaveEdit} className="divide-y divide-slate-200/70 dark:divide-slate-800">
                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    1. Datos Personales & Contacto
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Nombres *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.firstName}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, firstName: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Apellidos *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.lastName}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, lastName: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Teléfono / WhatsApp (9 dígitos) *
                      </label>
                      <input
                        type="tel"
                        required
                        maxLength={9}
                        value={editForm.phone}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            phone: e.target.value.replace(/\D/g, ''),
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Correo Electrónico
                      </label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, email: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    2. Interés Clínico y Preferencias
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Sede Preferida
                      </label>
                      <select
                        value={editForm.pref_sede_preferida}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            pref_sede_preferida: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
                      >
                        {(catalogs.sedes.length > 0
                          ? catalogs.sedes
                          : [
                              { nombre: 'Sede California' },
                              { nombre: 'Sede El Golf' },
                              { nombre: 'Sede Centro Historico' },
                            ]
                        ).map((s: any) => (
                          <option key={s.nombre} value={s.nombre}>
                            {s.nombre}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Horario de Preferencia
                      </label>
                      <select
                        value={editForm.pref_id_horario}
                        onChange={(e) =>
                          setEditForm((prev) => ({
                            ...prev,
                            pref_id_horario: e.target.value,
                          }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white"
                      >
                        <option value="1">Mañana (08:00 - 13:00)</option>
                        <option value="2">Tarde (13:00 - 18:00)</option>
                        <option value="3">Noche (18:00 - 21:00)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Motivo de Consulta / Solicitud Concreta *
                      </label>
                      <input
                        type="text"
                        required
                        value={editForm.concreteRequest}
                        onChange={(e) =>
                          setEditForm((prev) => ({ ...prev, concreteRequest: e.target.value }))
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 bg-slate-50/70 dark:bg-slate-900/80 px-6 py-3.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setSearchParams({}, { replace: true });
                    }}
                    className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={updateBuyer.isPending}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    {updateBuyer.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Guardando...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Guardar Cambios</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Bloque 2: Historial de Interacciones y Línea de Tiempo (Activity Timeline) */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Historial de Interacciones (Activity Timeline)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Registro cronológico de formularios web, consultas clínicas y eventos de admisión.
                </p>
              </div>
              <span className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-0.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                {timelineEvents.length} {timelineEvents.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>

            <div className="p-6">
              {buyer.consultasCount && buyer.consultasCount > 1 && (
                <div className="mb-5 border-l-2 border-[#0f766e] bg-slate-50/80 dark:bg-slate-800/50 pl-3.5 pr-4 py-2.5 text-xs text-slate-700 dark:text-slate-300">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    Interés recurrente detectado ({buyer.consultasCount} consultas):
                  </span>{' '}
                  Este prospecto ha interactuado en múltiples ocasiones. Prioriza la resolución de dudas sobre financiamiento y disponibilidad de agenda.
                </div>
              )}

              <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-800 space-y-6">
                {timelineEvents.map((evt) => (
                  <li key={evt.id} className="ml-5">
                    <span
                      className={`absolute -left-2 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${
                        evt.type === 'conversion'
                          ? 'bg-emerald-500'
                          : evt.type === 'inquiry'
                          ? 'bg-[#0f766e]'
                          : evt.type === 'consent'
                          ? buyer.contactAuthorization
                            ? 'bg-emerald-500'
                            : 'bg-amber-400'
                          : evt.type === 'created'
                          ? 'bg-[#0f766e]'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                      aria-label={
                        evt.type === 'consent'
                          ? buyer.contactAuthorization
                            ? 'Consentimiento registrado'
                            : 'Consentimiento pendiente'
                          : evt.type === 'created'
                          ? 'Ficha Buyer creada'
                          : undefined
                      }
                    />
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                      <h3 className="text-xs font-semibold text-slate-900 dark:text-white">
                        {evt.title}
                      </h3>
                      <time className="font-mono text-[11px] text-slate-400 dark:text-slate-500 tabular-nums">
                        {evt.timestamp
                          ? format(new Date(evt.timestamp), 'dd MMM yyyy, HH:mm', { locale: es })
                          : '—'}
                      </time>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {evt.subtitle}
                    </p>
                    {evt.detail && (
                      <div className="mt-2 rounded-lg border border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
                        {evt.detail}
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA (35%): Tarjeta del Agente Inteligente de Admisión (Gemini) */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-5 shadow-2xs space-y-5">
            {/* Cabecera del Agente de Admisión Gemini */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0f766e] dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-[#0f766e] dark:text-teal-400">
                      Agente Buyer (Gemini)
                    </span>
                    <span className="rounded bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-200/50">
                      FUENTE ÚNICA IA
                    </span>
                  </div>
                  <h2 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={2} />
                    <span>Inteligencia de Admisión</span>
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRefreshAI}
                disabled={evaluateBuyer.isPending || isRetrying}
                aria-busy={evaluateBuyer.isPending}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 transition-[transform,background-color,color] duration-200 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] disabled:cursor-wait disabled:opacity-70 cursor-pointer"
                title="Evaluar mensaje actual con Gemini en el backend y persistir resultado"
              >
                <RefreshCw className={`h-3 w-3 ${evaluateBuyer.isPending ? 'animate-spin' : ''}`} aria-hidden />
                <span>{evaluateBuyer.isPending ? 'Evaluando…' : 'Actualizar'}</span>
              </button>
            </div>

            <div className="flex min-h-4 items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400" aria-live="polite">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  evaluateBuyer.isPending
                    ? 'animate-pulse bg-amber-500'
                    : isEvaluationOutdated
                    ? 'bg-amber-400'
                    : hasUnevaluatedNewMessage
                    ? 'bg-amber-400'
                    : evaluacion?.estado === 'COMPLETADA'
                    ? 'bg-emerald-500'
                    : evaluacion?.estado === 'PENDIENTE'
                    ? 'bg-amber-400'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
                aria-hidden
              />
              <span>
                {evaluateBuyer.isPending
                  ? 'Evaluando mensaje con Gemini en backend…'
                  : isEvaluationOutdated
                  ? 'Preferencias modificadas · Evaluación desactualizada · Pulsa Actualizar'
                  : hasUnevaluatedNewMessage
                  ? 'Mensaje vigente pendiente de evaluación · Pulsa Actualizar'
                  : evaluacion?.fecha_hora
                  ? `Evaluación persistida · ${format(new Date(evaluacion.fecha_hora), 'dd/MM/yyyy HH:mm')}`
                  : evaluacion?.estado === 'PENDIENTE'
                  ? 'Evaluación pendiente de procesamiento · Reintento disponible'
                  : 'Sin evaluación registrada · Pulsa Actualizar'}
              </span>
            </div>

            {/* Bloque de Diagnóstico Semántico (Sustituye la puntuación fija 92/100 por Intención, Estado y Motivo) */}
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Intención Detectada:
                </span>
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold text-[11px] border ${
                    isEvaluationOutdated
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                      : hasUnevaluatedNewMessage
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                      : isEvaluationCurrent && evaluacion?.intencion === 'SOLICITA_RESERVA'
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60'
                      : isEvaluationCurrent && evaluacion?.intencion === 'SOLO_CONSULTA'
                      ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200/60 dark:border-sky-800/60'
                      : isEvaluationCurrent && evaluacion?.intencion === 'AMBIGUA'
                      ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {isEvaluationOutdated ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>EVALUACIÓN DESACTUALIZADA · PREFERENCIAS MODIFICADAS</span>
                    </>
                  ) : hasUnevaluatedNewMessage ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>MENSAJE VIGENTE PENDIENTE DE EVALUAR</span>
                    </>
                  ) : isEvaluationCurrent && evaluacion?.intencion === 'SOLICITA_RESERVA' ? (
                    <>
                      <Flame className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>SOLICITA_RESERVA · Concreta</span>
                    </>
                  ) : isEvaluationCurrent && evaluacion?.intencion === 'SOLO_CONSULTA' ? (
                    <>
                      <MessageSquare className="h-3 w-3 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>SOLO_CONSULTA · Informativa</span>
                    </>
                  ) : isEvaluationCurrent && evaluacion?.intencion === 'AMBIGUA' ? (
                    <>
                      <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>AMBIGUA · Requiere Aclaración</span>
                    </>
                  ) : (
                    <>
                      <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                      <span>{evaluacion?.estado === 'PENDIENTE' ? 'PENDIENTE DE EVALUACIÓN' : 'SIN EVALUACIÓN'}</span>
                    </>
                  )}
                </span>
              </div>

              {isEvaluationOutdated && (
                <div className="rounded-md border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Evaluación desactualizada por cambio de preferencias</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    El horario de preferencia o el servicio declarado fueron modificados después de la última evaluación. Pulsa <strong>Actualizar</strong> para reevaluar con el contexto vigente.
                  </p>
                </div>
              )}

              {hasUnevaluatedNewMessage && !isEvaluationOutdated && (
                <div className="rounded-md border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/70 dark:bg-amber-950/30 p-2.5 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>Nuevo mensaje vigente sin evaluar</span>
                  </div>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11px]">
                    El contacto cuenta con un mensaje vigente que aún no ha sido clasificado por el agente. Pulsa <strong>Actualizar</strong> para evaluarlo con Gemini en el backend.
                  </p>
                  {evaluacion?.mensaje_evaluado && (
                    <div className="pt-1.5 mt-1 border-t border-amber-200/60 dark:border-amber-800/40 text-[10px] text-slate-500 dark:text-slate-400">
                      <span className="font-semibold text-slate-700 dark:text-slate-300">Evaluación anterior persistida:</span>{' '}
                      Intención: <strong>{evaluacion.intencion || 'N/A'}</strong> · Acción: <strong>{evaluacion.accion}</strong>
                      <div className="italic mt-0.5 text-slate-500">Fundamentada en mensaje previo: "{evaluacion.mensaje_evaluado}"</div>
                    </div>
                  )}
                </div>
              )}

              {isEvaluationCurrent && evaluacion?.mensaje_evaluado && (
                <div className="text-[10px] text-slate-500 dark:text-slate-400 px-1 flex items-start gap-1">
                  <span className="font-medium text-slate-600 dark:text-slate-300 shrink-0">Mensaje evaluado:</span>
                  <span className="italic truncate">"{evaluacion.mensaje_evaluado}"</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                <div>
                  <span className="text-slate-400">Estado del Agente:</span>
                  <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">
                    {isEvaluationOutdated
                      ? 'Desactualizada (preferencias modificadas)'
                      : hasUnevaluatedNewMessage
                      ? 'Mensaje nuevo pendiente'
                      : evaluacion?.estado === 'COMPLETADA'
                      ? 'Completada (Gemini)'
                      : evaluacion?.estado === 'PENDIENTE'
                      ? 'Pendiente / Fallo'
                      : 'No evaluada'}
                  </div>
                </div>
                <div>
                  <span className="text-slate-400">Servicio Identificado:</span>
                  <div className="font-medium text-slate-800 dark:text-slate-200 mt-0.5 truncate">
                    {evaluacion?.servicio_nombre ||
                      (evaluacion?.id_servicio ? `Servicio #${evaluacion.id_servicio}` : 'Ninguno')}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">Motivo / Explicación de la Evaluación:</span>
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-950/50 p-2.5 rounded-md border border-slate-200/60 dark:border-slate-800/60">
                  {isEvaluationOutdated
                    ? 'Las preferencias del contacto cambiaron tras la última evaluación. Pulsa Actualizar para evaluar con el horario y servicio vigente.'
                    : hasUnevaluatedNewMessage
                    ? 'El mensaje vigente difiere del mensaje evaluado anteriormente. Pulsa Actualizar para clasificar la intención del nuevo mensaje con Gemini.'
                    : evaluacion?.explicacion ||
                      evaluacion?.error ||
                      (evaluacion
                        ? 'Evaluación persistida en el expediente comercial.'
                        : 'Pulsa Actualizar para clasificar la intención del mensaje mediante Gemini en backend.')}
                </p>
              </div>

              {(evaluacion?.estado === 'PENDIENTE' || evaluacion?.accion === 'REINTENTO_PENDIENTE') && evaluacion?.id_interaccion && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => handleRetryEvaluation(evaluacion.id_interaccion)}
                    disabled={isRetrying}
                    className="w-full inline-flex h-8 items-center justify-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isRetrying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3.5 w-3.5" />
                    )}
                    <span>Reintentar evaluación fallida (#{evaluacion.id_interaccion})</span>
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-200/80 dark:border-slate-800 pt-3">
              <Bot className="h-3.5 w-3.5 text-[#0f766e]" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Actividades del Agente Buyer
              </span>
            </div>

            <div className="space-y-2.5">
              {/* Actividad 1: Perfilamiento inteligente de la necesidad */}
              <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    1. Perfilamiento de Necesidad Clínica
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-teal-700 dark:text-teal-300">
                    {evaluacion?.servicio_nombre ||
                      (evaluacion?.id_servicio ? `Servicio #${evaluacion.id_servicio}` : 'Sin servicio')}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                  El agente interpreta el mensaje vigente y lo contrasta con el perfil registrado.
                </p>
                <dl className="mt-2 grid grid-cols-1 gap-1.5 text-[11px] sm:grid-cols-3">
                  <div className="rounded-md bg-slate-50 dark:bg-slate-950/50 px-2 py-1.5">
                    <dt className="text-slate-400">Servicio:</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">
                      {buyer.serviceOfInterest || 'No especificado'}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 dark:bg-slate-950/50 px-2 py-1.5">
                    <dt className="text-slate-400">Sede:</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">
                      {buyer.pref_sede_preferida || 'No especificada'}
                    </dd>
                  </div>
                  <div className="rounded-md bg-slate-50 dark:bg-slate-950/50 px-2 py-1.5">
                    <dt className="text-slate-400">Horario:</dt>
                    <dd className="font-medium text-slate-700 dark:text-slate-200">
                      {HORARIO_LABELS[String(buyer.pref_id_horario)] || buyer.pref_id_horario || 'No especificado'}
                    </dd>
                  </div>
                </dl>
                {evaluacion?.discrepancia_horario?.detectada && (
                  <div className="mt-2.5 rounded-md border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 p-2.5 text-[11px] text-amber-900 dark:text-amber-200">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>Discrepancia detectada entre mensaje y preferencias</span>
                    </div>
                    <p className="mt-1 leading-relaxed">
                      El mensaje solicita turno <strong>{evaluacion.discrepancia_horario.mensajeIndica}</strong>, pero el registro tiene asignado <strong>{evaluacion.discrepancia_horario.preferenciaRegistrada}</strong>. Se conservan ambos datos registrados y se solicita confirmación al paciente sin modificar sus preferencias.
                    </p>
                  </div>
                )}
              </div>

              {/* Actividad 2: Clasificación de Intención y Recomendación */}
              <div className="border-l-2 border-emerald-500 bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    2. Clasificación de Intención y Recomendación
                  </span>
                  <span className="font-mono text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                    {evaluacion?.intencion || 'SIN_EVALUAR'}
                  </span>
                </div>
                <div className="mt-1.5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {evaluacion?.intencion === 'SOLICITA_RESERVA'
                    ? <p><strong>Intención:</strong> Comercial concreta. Solicita avanzar hacia una reserva o atención.</p>
                    : evaluacion?.intencion === 'SOLO_CONSULTA'
                    ? <p><strong>Intención:</strong> Consulta informativa. Todavía no expresa una solicitud concreta de adquisición.</p>
                    : evaluacion?.intencion === 'AMBIGUA'
                    ? <p><strong>Intención:</strong> Ambigua. No permite confirmar qué servicio o acción desea el paciente.</p>
                    : <p><strong>Intención:</strong> Sin evaluar.</p>}

                  {evaluacion?.accion === 'CONVERSION_LEAD'
                    ? isConverted
                      ? <p><strong>Recomendación:</strong> Conversión a LEAD ejecutada. Continuar negociación y agendamiento desde LEAD.</p>
                      : <p><strong>Recomendación:</strong> Proceder con la conversión a LEAD para asignar un asesor de agenda.</p>
                    : evaluacion?.accion === 'SOLO_CONSULTA'
                    ? <p><strong>Recomendación:</strong> Brindar información y costos. No convertir de inmediato.</p>
                    : evaluacion?.accion === 'ACLARACION'
                    ? <p><strong>Recomendación:</strong> {evaluacion.explicacion || 'Solicitar que confirme el servicio o turno antes de transferir.'}</p>
                    : evaluacion?.accion === 'CONSERVA_ETAPA_POSTERIOR'
                    ? <p><strong>Recomendación:</strong> El contacto ya está en una etapa avanzada; se conservó su etapa actual.</p>
                    : evaluacion?.accion === 'SOLICITUD_PENDIENTE_APERTURA'
                    ? <p><strong>Recomendación:</strong> La etapa se conservó y la solicitud quedó pendiente de apertura.</p>
                    : evaluacion?.accion === 'REQUISITOS_INCOMPLETOS'
                    ? <p><strong>Recomendación:</strong> Completar los requisitos del expediente antes de convertir.</p>
                    : evaluacion?.accion === 'REINTENTO_PENDIENTE' || evaluacion?.estado === 'PENDIENTE'
                    ? <p><strong>Recomendación:</strong> Evaluación pendiente de procesamiento o reintento.</p>
                    : <p><strong>Recomendación:</strong> Pulsa Actualizar para evaluar el mensaje con Gemini.</p>}
                </div>
              </div>
            </div>

            {/* Acción Directa: Iniciar Chat de WhatsApp Clínico */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              {whatsappUrl ? (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99]"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Iniciar Chat de WhatsApp Clínico</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </a>
              ) : (
                <button
                  type="button"
                  disabled
                  className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 text-xs font-medium text-slate-400"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Sin teléfono válido para WhatsApp</span>
                </button>
              )}
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                Abre plantilla clínica personalizada con sede y tratamiento
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Sección Amplia Inferior: Agente de Persuasión Buyer (¿Cómo convencer al cliente?) */}
      <div className="rounded-xl border border-violet-200/90 dark:border-violet-900/60 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-violet-100 dark:border-violet-900/50 bg-gradient-to-r from-violet-50/70 via-white to-teal-50/40 dark:from-violet-950/30 dark:via-slate-900 dark:to-slate-900 px-6 py-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm">
              <Sparkles className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Agente de Persuasión Buyer — ¿Cómo convencer a este cliente?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cruza los datos reales del prospecto con las reglas comerciales configuradas por el administrador para proponer el abordaje ideal.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGeneratePersuasion}
            disabled={isGeneratingPersuasion}
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-violet-600 px-4 text-xs font-semibold text-white shadow-2xs transition hover:bg-violet-700 disabled:opacity-50 cursor-pointer"
          >
            {isGeneratingPersuasion ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            <span>{persuasionStrategy ? 'Recalcular estrategia' : 'Generar estrategia de persuasión'}</span>
          </button>
        </div>

        <div className="p-6">
          {persuasionStrategy ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Columna Izquierda: Ángulo, Argumentos y Objeción */}
              <div className="lg:col-span-7 space-y-4">
                <div className="rounded-lg border border-violet-100 dark:border-violet-900/40 bg-violet-50/40 dark:bg-violet-950/20 p-4">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-300">
                    Ángulo de Persuasión Principal
                  </span>
                  <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                    {persuasionStrategy.angulo_principal}
                  </p>
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Argumentos clave recomendados
                  </h3>
                  <ul className="space-y-2">
                    {persuasionStrategy.argumentos.map((arg, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 leading-relaxed"
                      >
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-teal-600 mt-0.5" />
                        <span>{arg}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3 text-xs text-amber-900 dark:text-amber-200">
                  <div>
                    <strong className="block text-[11px] uppercase tracking-wider text-amber-700 dark:text-amber-400">
                      Objeción probable a anticipar
                    </strong>
                    <span className="mt-0.5 block">{persuasionStrategy.objecion_probable}</span>
                  </div>
                </div>

                {persuasionStrategy.descuento_recomendado?.activo && (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/60 dark:from-emerald-950/30 dark:via-slate-900 dark:to-teal-950/20 p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <Flame className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                            Sección de Descuentos para este Buyer
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          Completó{' '}
                          <strong className="text-emerald-700 dark:text-emerald-300">
                            {persuasionStrategy.descuento_recomendado.datos_completados.length} de{' '}
                            {persuasionStrategy.descuento_recomendado.total_datos}
                          </strong>{' '}
                          datos clave del perfil •{' '}
                          <span className="font-medium text-amber-700 dark:text-amber-300">
                            {persuasionStrategy.descuento_recomendado.urgencia_texto}
                          </span>
                        </p>
                      </div>
                      <div className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-white shadow-sm shrink-0">
                        <span className="text-lg font-extrabold leading-none">
                          {persuasionStrategy.descuento_recomendado.porcentaje}% OFF
                        </span>
                        <span className="text-[10px] uppercase tracking-wider opacity-90">
                          en consulta
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {persuasionStrategy.descuento_recomendado.datos_completados.map((dato) => (
                        <span
                          key={dato}
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-100/90 dark:bg-emerald-900/40 px-2.5 py-0.5 text-[11px] font-medium text-emerald-800 dark:text-emerald-200"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {dato}
                        </span>
                      ))}
                      {persuasionStrategy.descuento_recomendado.datos_faltantes.map((dato) => (
                        <span
                          key={dato}
                          className="inline-flex items-center rounded-full border border-dashed border-slate-300 dark:border-slate-700 px-2.5 py-0.5 text-[11px] text-slate-500 dark:text-slate-400"
                        >
                          Falta: {dato}
                        </span>
                      ))}
                    </div>

                    {persuasionStrategy.descuento_recomendado.frases_gancho.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                          Frases gancho sugeridas para cerrar la cita (clic para copiar)
                        </span>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {persuasionStrategy.descuento_recomendado.frases_gancho.map((frase, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(frase);
                                toast({
                                  title: 'Frase copiada',
                                  description: 'Lista para enviar por WhatsApp o llamada.',
                                });
                              }}
                              className="text-left rounded-lg border border-emerald-200/80 dark:border-emerald-800/50 bg-white/90 dark:bg-slate-900/70 px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:border-emerald-400 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition-colors"
                            >
                              “{frase}”
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {persuasionStrategy.reglas_aplicadas.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[11px] font-medium text-slate-500 mr-1">Reglas activadas:</span>
                    {persuasionStrategy.reglas_aplicadas.map((r) => (
                      <span
                        key={r}
                        className="rounded-full bg-violet-50 dark:bg-violet-950/60 px-2.5 py-0.5 text-[11px] font-medium text-violet-700 dark:text-violet-300 border border-violet-200/80 dark:border-violet-800"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Columna Derecha: Guion listo para WhatsApp */}
              <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-5 space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5 text-[#0f766e]" />
                      Guion Persuasivo para WhatsApp
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {persuasionStrategy.source === 'gemini' ? 'IA Gemini' : 'Reglas locales'}
                    </span>
                  </div>
                  <p className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 text-xs italic leading-relaxed text-slate-700 dark:text-slate-200 shadow-2xs">
                    "{persuasionStrategy.guion_whatsapp}"
                  </p>
                </div>

                {buyer.person.phone ? (
                  <a
                    href={`https://wa.me/51${buyer.person.phone.replace(/\D/g, '').slice(-9)}?text=${encodeURIComponent(persuasionStrategy.guion_whatsapp)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99]"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span>Enviar este guion por WhatsApp</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                ) : (
                  <p className="text-[11px] text-slate-400 text-center">
                    Este contacto no tiene un teléfono válido registrado para abrir WhatsApp.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="max-w-lg text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Haz clic en <strong>Generar estrategia de persuasión</strong> para que el agente analice el servicio de interés, motivo de consulta, sede, horario y reglas activas de este prospecto y te sugiera exactamente cómo convencerlo.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmación de Conversión a LEAD */}
      <ConfirmationDialog
        isOpen={isConvertDialogOpen}
        onClose={() => setIsConvertDialogOpen(false)}
        onConfirm={handleConvert}
        isLoading={convertBuyer.isPending}
        title="¿Convertir prospecto a etapa LEAD?"
        description={`El prospecto ${fullName} pasará a la Mesa de Negociación en el módulo LEAD conservando su trazabilidad comercial.`}
        confirmText="Sí, Convertir a LEAD"
        cancelText="Cancelar"
      />
    </div>
  );
}
