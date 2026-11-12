import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  X,
  Plus,
  Edit3,
  Trash2,
  Loader2,
  MessageSquare,
  Mail,
  Phone,
  Copy,
  CheckCheck,
  Stethoscope,
  MapPin,
  Clock,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
  HeartPulse,
  GraduationCap,
  Briefcase,
  Target,
  CreditCard,
  ShieldAlert,
  Layers,
  Building2,
  User,
  SlidersHorizontal,
  ChevronRight,
  Eye,
} from 'lucide-react';
import { leadService } from '../services/lead.service';
import { configService } from '@/modules/config/services/config.service';
import { LeadState } from '@/domain/enums';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { LeadInteraction, type LeadInteractionAnalysis, type WhatsAppProposalUpdate } from './LeadInteraction';
import { LeadOperationalFollowUp } from './LeadOperationalFollowUp';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { renderLeadStatusBadge } from './LeadListView';
import { LeadProfileEditModal } from './LeadProfileEditModal';
import { OfferDateCalendar } from './OfferDateCalendar';

interface LeadDetailViewProps {
  leadId: string;
}

const emptySchedule = { date: '', start: '', end: '' };
type UpdatedOfferField = 'branch' | 'professional' | keyof typeof emptySchedule;
const offerFieldClass = 'h-9 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-900 focus:border-[#0f766e] focus:outline-none disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:disabled:text-slate-500 [color-scheme:light] dark:[color-scheme:dark] data-[actualizado=true]:border-sky-600 data-[actualizado=true]:bg-sky-50 data-[actualizado=true]:ring-2 data-[actualizado=true]:ring-sky-600/30 dark:data-[actualizado=true]:border-sky-400 dark:data-[actualizado=true]:bg-sky-950 dark:data-[actualizado=true]:ring-sky-400/35';

function OfferTimeField({ id, label, value, times, disabled, onChange, highlight }: {
  id: string;
  label: string;
  value: string;
  times: string[];
  disabled: boolean;
  onChange: (time: string) => void;
  highlight: { 'data-actualizado'?: true; onFocus: () => void; onPointerDown: () => void };
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <Select value={value} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger id={id} {...highlight} className={`${offerFieldClass} tabular-nums shadow-none dark:data-[placeholder]:text-slate-400`}>
          <SelectValue placeholder="--:--" />
        </SelectTrigger>
        <SelectContent className="border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          {times.map(time => <SelectItem key={time} value={time}>{time}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function slotSchedule(slot: { fecha: string; hora_inicio: string; hora_fin: string }) {
  return {
    date: String(slot.fecha).slice(0, 10),
    start: String(slot.hora_inicio).slice(11, 16),
    end: String(slot.hora_fin).slice(11, 16),
  };
}

function distinctTimes(values: string[]) {
  return [...new Set(values)].sort();
}

function parseCompanyHours(companyHorario: string) {
  if (!companyHorario) return { openTime: '08:00 AM', closeTime: '08:00 PM' };
  const match = companyHorario.match(
    /(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)\s*[-–—a]\s*(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)/i
  );
  let open = '08:00 AM';
  let close = '08:00 PM';
  if (match) {
    open = match[1].trim().toUpperCase();
    close = match[2].trim().toUpperCase();
    if (!open.includes('AM') && !open.includes('PM')) open += ' AM';
    if (!close.includes('AM') && !close.includes('PM')) close += ' PM';
  }
  return { openTime: open, closeTime: close };
}

export function LeadDetailView({ leadId }: LeadDetailViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lead, setLead] = useState<any>(null);
  const [options, setOptions] = useState<any>({
    profesionales: [],
    sedes: [],
    servicios: [],
    disponibilidades: [],
  });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [transferPreview, setTransferPreview] = useState<any>(null);
  const [transferAccepted, setTransferAccepted] = useState(false);
  const [transferAuthorized, setTransferAuthorized] = useState(false);
  const [transferEvidence, setTransferEvidence] = useState('');
  const [transferError, setTransferError] = useState('');
  const [publicLink, setPublicLink] = useState<{option: string; url: string; expiry: string} | null>(null);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [interactionAnalysis, setInteractionAnalysis] = useState<{ requestId: number; result: LeadInteractionAnalysis } | null>(null);
  const [abandonOpen, setAbandonOpen] = useState(false);
  const [abandonReason, setAbandonReason] = useState('');
  const [abandoning, setAbandoning] = useState(false);
  const [abandonError, setAbandonError] = useState('');
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [selectedOpcion, setSelectedOpcion] = useState<number | string | null>(null);

  // Configuración de nueva propuesta comercial
  const [selectedServicioId, setSelectedServicioId] = useState('1');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState('ALL_PROFESSIONALS');
  const [selectedSedeId, setSelectedSedeId] = useState('ALL_SEDES');
  const [selectedVigencia, setSelectedVigencia] = useState<
    '24h' | '48h' | '72h' | '7d' | 'custom'
  >('48h');
  const [selectedVigenciaCustom, setSelectedVigenciaCustom] = useState('');
  const [validityStartedAt, setValidityStartedAt] = useState(() => Date.now());
  const [selectedFranja, setSelectedFranja] = useState('Turno Mañana (08:00 AM – 01:00 PM)');
  const [offerSchedule, setOfferSchedule] = useState(emptySchedule);
  const [activeProposal, setActiveProposal] = useState<{ id: number; terms: string } | null>(null);
  const [whatsAppDraft, setWhatsAppDraft] = useState<{ originalExpiry: string | null } | null>(null);
  const [updatedOfferFields, setUpdatedOfferFields] = useState<UpdatedOfferField[]>([]);
  const [companyHorario, setCompanyHorario] = useState('');

  const { openTime, closeTime } = useMemo(
    () => parseCompanyHours(companyHorario),
    [companyHorario]
  );

  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [condiciones, setCondiciones] = useState('');
  const [promocionAplicada, setPromocionAplicada] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Edición rápida de tarifa en las opciones del tablero
  const [editingOptionId, setEditingOptionId] = useState<number | string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [generatingCanva, setGeneratingCanva] = useState(false);
  const [canvaResult, setCanvaResult] = useState<{
    designUrl?: string;
    previewUrl?: string;
    downloadPngUrl?: string;
    attachmentId?: string;
    offerKey: string | null;
    isPersonalized: boolean;
  } | null>(null);
  const [checkedFlyerId, setCheckedFlyerId] = useState<string>();
  // Estados para Organización del Perfil de Negociación
  const [profileTab, setProfileTab] = useState<'CLINICA' | 'CONVENIOS' | 'CONTACTO'>('CONTACTO');
  const [profileViewMode, setProfileViewMode] = useState<'TABS' | 'ALL'>('TABS');
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);

  const handleProfileUpdated = (updatedLead: any) => {
    if (updatedLead) {
      setLead(updatedLead);
    } else {
      fetchLeadData();
    }
    queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
  };

  const fetchLeadData = () => {
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId),
      leadService.getAvailabilityOptions(),
      configService.getEmpresa().catch(() => null),
    ])
      .then(([leadData, optionsData, empData]) => {
        setLead(leadData);
        setOptions({
          profesionales: optionsData?.profesionales ?? [],
          sedes: optionsData?.sedes ?? [],
          servicios: optionsData?.servicios ?? [],
          disponibilidades: optionsData?.disponibilidades || [],
        });
        if (empData?.horarioAtencion) {
          setCompanyHorario(empData.horarioAtencion);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (leadId) {
      setActiveProposal(null);
      setWhatsAppDraft(null);
      setUpdatedOfferFields([]);
      setOfferSchedule(emptySchedule);
      fetchLeadData();
    }
  }, [leadId]);

  // Pre-carga inteligente al obtener datos
  useEffect(() => {
    if (!lead || !options?.servicios?.length || whatsAppDraft) return;

    const reqServicio = lead.Solicitudes?.[0]?.Servicio;
    const reqServicioId = lead.Solicitudes?.[0]?.id_servicio;
    let initialServicioId = selectedServicioId;

    if (reqServicioId) {
      initialServicioId = String(reqServicioId);
    } else if (reqServicio?.id_servicio) {
      initialServicioId = String(reqServicio.id_servicio);
    } else if (reqServicio?.nombre) {
      const found = options.servicios.find((s: any) =>
        s.nombre.toLowerCase().includes(reqServicio.nombre.toLowerCase())
      );
      if (found) initialServicioId = String(found.id_servicio);
    }

    if (initialServicioId) {
      setSelectedServicioId(initialServicioId);
      const activeServicio = options.servicios.find(
        (s: any) => String(s.id_servicio) === initialServicioId
      );
      const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
      setPrecioOfrecido(officialPrice.toFixed(2));
    }

    const prefSede = lead.Preferencias?.[0]?.sede_preferida;
    if (prefSede) {
      const matchSede = options.sedes?.find(
        (s: any) =>
          s.nombre.toLowerCase().includes(prefSede.toLowerCase()) ||
          prefSede.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (matchSede) setSelectedSedeId(String(matchSede.id_sede));
    }

    const existingOpciones = lead.Solicitudes?.[0]?.Opciones || [];
    if (existingOpciones.length > 0 && selectedOpcion === null) {
      const preselected =
        existingOpciones.find((o: any) => o.seleccionada) || existingOpciones[0];
      setSelectedOpcion(preselected.id_opcion);
    }
  }, [lead, options]);

  // Vigencia calculada
  const calculatedExpiry = useMemo(() => {
    if (whatsAppDraft?.originalExpiry) return new Date(whatsAppDraft.originalExpiry);
    const hoursByTerm = { '24h': 24, '48h': 48, '72h': 72, '7d': 168 } as const;
    if (selectedVigencia in hoursByTerm) {
      return new Date(validityStartedAt + hoursByTerm[selectedVigencia as keyof typeof hoursByTerm] * 60 * 60 * 1000);
    }
    if (selectedVigencia === 'custom' && selectedVigenciaCustom) {
      try {
        const customExpiry = parseISO(`${selectedVigenciaCustom}T23:59:59.999-05:00`);
        if (!Number.isNaN(customExpiry.getTime())) return customExpiry;
      } catch {
        // Use the standard 48-hour term when the custom date is malformed.
      }
    }
    return new Date(Date.now() + 48 * 60 * 60 * 1000);
  }, [selectedVigencia, selectedVigenciaCustom, validityStartedAt, whatsAppDraft?.originalExpiry]);

  const getVigenciaLabel = (vig: string, customVal: string) => {
    if (vig === '24h') return '24 horas (Flash)';
    if (vig === '48h') return '48 horas (Recomendado)';
    if (vig === '72h') return '72 horas (3 días)';
    if (vig === '7d') return '7 días (Semanal)';
    return `Hasta ${customVal || 'Personalizado'}`;
  };

  const currentOfficialPrice = useMemo(() => {
    const s = options.servicios?.find(
      (item: any) => String(item.id_servicio) === selectedServicioId
    );
    return Number(s?.Tarifas?.[0]?.precio || 180);
  }, [options.servicios, selectedServicioId]);

  const numericOfferPrice = useMemo(() => {
    const val = parseFloat(precioOfrecido);
    return isNaN(val) ? 0 : val;
  }, [precioOfrecido]);

  const discountMetrics = useMemo(() => {
    const saving = Math.max(0, currentOfficialPrice - numericOfferPrice);
    const pct =
      currentOfficialPrice > 0 ? Math.round((saving / currentOfficialPrice) * 100) : 0;
    return { saving, pct };
  }, [currentOfficialPrice, numericOfferPrice]);

  const applyQuickDiscount = (pct: number, type?: 'CAMPANA' | 'REGULAR') => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setPrecioOfrecido(discounted.toFixed(2));
    if (type === 'CAMPANA') {
      setCondiciones(`Tarifa promocional autorizada (-${pct}%) con reserva anticipada`);
      setPromocionAplicada(pct === 15 ? 'Promoción (-15%)' : `Campaña (-${pct}%)`);
    } else if (type === 'REGULAR') {
      setCondiciones('');
      setPromocionAplicada('');
    }
    if (offerErrors.precio) setOfferErrors((p) => ({ ...p, precio: '' }));
  };

  const eligibleOfferSlots = (options.disponibilidades ?? []).filter((slot: any) =>
    (selectedSedeId === 'ALL_SEDES' || String(slot.id_sede) === selectedSedeId) &&
    slot.Profesional?.ProfesionalServicio?.some(
      (entry: { id_servicio: number }) => String(entry.id_servicio) === selectedServicioId,
    ),
  );
  const eligibleProfessionalIds = new Set(
    eligibleOfferSlots.map((slot: any) => String(slot.id_profesional)),
  );
  const eligibleProfessionals = (options.profesionales ?? []).filter(
    (professional: any) => eligibleProfessionalIds.has(String(professional.id_profesional)),
  );
  const effectiveProfessionalId = eligibleProfessionalIds.has(selectedProfesionalId)
    ? selectedProfesionalId
    : 'ALL_PROFESSIONALS';

  const matchingOfferSlots = eligibleOfferSlots.filter((slot: any) => {
    const start = String(slot.hora_inicio).slice(11, 16);
    if (start < '08:00' || start >= '20:00') return false;
    const shift = start < '13:00' ? 'Turno Mañana' : start < '18:00' ? 'Turno Tarde' : 'Turno Noche';
    return selectedFranja.startsWith(shift) &&
      (effectiveProfessionalId === 'ALL_PROFESSIONALS' || String(slot.id_profesional) === effectiveProfessionalId);
  });
  const scheduleSlots: Array<{ slot: any } & ReturnType<typeof slotSchedule>> = matchingOfferSlots.map((slot: any) => ({ slot, ...slotSchedule(slot) }));
  const scheduleDates = distinctTimes(scheduleSlots.map(({ date }) => date));
  const slotsOnDate = scheduleSlots.filter(({ date }) => date === offerSchedule.date);
  const scheduleStarts = distinctTimes(slotsOnDate.map(({ start }) => start));
  const slotsAtStart = slotsOnDate.filter(({ start }) => start === offerSchedule.start);
  const scheduleEnds = distinctTimes(slotsAtStart.map(({ end }) => end));
  const selectedSlots = slotsAtStart.filter(({ end }) => end === offerSchedule.end);
  const ambiguousSchedule = selectedSlots.length > 1;
  const offeredSlot = selectedSlots.length === 1 ? selectedSlots[0].slot : null;
  const validDate = scheduleDates.includes(offerSchedule.date);
  const validStart = scheduleStarts.includes(offerSchedule.start);
  const validEnd = scheduleEnds.includes(offerSchedule.end);

  useEffect(() => {
    if (selectedProfesionalId !== effectiveProfessionalId) {
      setSelectedProfesionalId(effectiveProfessionalId);
    }
  }, [selectedProfesionalId, effectiveProfessionalId]);

  useEffect(() => {
    if (offerSchedule.date && !validDate) setOfferSchedule(emptySchedule);
    else if (offerSchedule.start && !validStart) setOfferSchedule({ ...offerSchedule, start: '', end: '' });
    else if (offerSchedule.end && !validEnd) setOfferSchedule({ ...offerSchedule, end: '' });
  }, [offerSchedule, validDate, validStart, validEnd]);

  function updateOfferSchedule(schedule: typeof emptySchedule) {
    setOfferSchedule(schedule);
    setOfferErrors(current => ({ ...current, horario: '' }));
  }

  function highlightProps(field: UpdatedOfferField) {
    const clear = () => setUpdatedOfferFields(current => current.includes(field) ? current.filter(item => item !== field) : current);
    return { 'data-actualizado': updatedOfferFields.includes(field) ? true as const : undefined, onFocus: clear, onPointerDown: clear };
  }
  const requestedServiceId = lead?.Solicitudes?.[0]?.id_servicio == null
    ? ''
    : String(lead.Solicitudes[0].id_servicio);
  const changesRequestedService = Boolean(selectedServicioId && selectedServicioId !== requestedServiceId);

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    if (!ultimaSolicitud || !options.servicios?.some((s: any) => String(s.id_servicio) === selectedServicioId)) {
      errors.servicio = 'Selecciona un servicio activo para esta solicitud.';
    }
    if (!whatsAppDraft?.originalExpiry && selectedVigencia === 'custom' && !selectedVigenciaCustom) {
      errors.vigencia = 'Selecciona la fecha hasta la que será válida la propuesta.';
    } else if (calculatedExpiry.getTime() <= Date.now()) {
      errors.vigencia = 'La vigencia debe terminar en una fecha futura.';
    }
    if (!precioOfrecido || isNaN(Number(precioOfrecido)) || Number(precioOfrecido) <= 0) {
      errors.precio = 'Ingresa una tarifa mayor a 0.';
    }
    if (!offeredSlot) {
      errors.horario = matchingOfferSlots.length
        ? ambiguousSchedule ? 'Selecciona una sede y un especialista para identificar el horario exacto.' : 'Selecciona la fecha, la hora inicial y la hora final.'
        : 'No hay horarios disponibles con estos filtros. Cambia la sede, el especialista o la franja.';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    const serviceName = options.servicios.find((s: any) => String(s.id_servicio) === selectedServicioId)?.nombre;
    if (changesRequestedService && !window.confirm(
      `¿Confirmas que el tratamiento de esta solicitud debe ser ${serviceName}? El cambio se guardará junto con la propuesta.`,
    )) return;

    setOfferErrors({});
    setAddingAlternative(true);
    const validityLabel = whatsAppDraft?.originalExpiry ? 'Vigencia de la propuesta original' : getVigenciaLabel(
      selectedVigencia,
      selectedVigenciaCustom
    );
    const fullCondiciones = `[Vigencia: ${validityLabel} · Vence: ${format(calculatedExpiry, 'dd/MM/yyyy HH:mm')}] [${selectedFranja}] ${
      condiciones ? `| ${condiciones}` : ''
    }`.trim();

    const proposalTerms = JSON.stringify({
      serviceId: Number(selectedServicioId),
      price: Number(precioOfrecido).toFixed(2),
      promotion: promocionAplicada || null,
      validUntil: calculatedExpiry.toISOString(),
    });
    try {
      const response = await leadService.addAlternative(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        id_servicio: Number(selectedServicioId),
        confirmar_cambio_servicio: changesRequestedService,
        id_servicio_anterior: ultimaSolicitud?.id_servicio ?? null,
        id_disponibilidad: offeredSlot.id_disponibilidad,
        fecha_vigencia_hasta_utc_lead: calculatedExpiry.toISOString(),
        promocion_aplicada: promocionAplicada || null,
        id_propuesta_lead: activeProposal?.id,
        crear_version_propuesta: Boolean(activeProposal && activeProposal.terms !== proposalTerms),
        ofr_turno_lead: selectedFranja.split(' (')[0],
        precio_ofrecido: precioOfrecido,
        condiciones: fullCondiciones,
        // Campos adicionales para modo mock/fallback
        service: serviceName,
        professional: offeredSlot.Profesional?.apellidos,
        branch: offeredSlot.Sede?.nombre,
        date: String(offeredSlot.fecha).slice(0, 10),
        time: String(offeredSlot.hora_inicio).slice(11, 16),
        price: Number(precioOfrecido),
        conditions: fullCondiciones,
      });
      const proposalId = Number(response?.data?.id_propuesta_lead);
      if (Number.isInteger(proposalId) && proposalId > 0) {
        setActiveProposal({ id: proposalId, terms: proposalTerms });
      }
      if (whatsAppDraft) {
        const optionId = Number(response?.data?.id_opcion);
        if (Number.isInteger(optionId) && optionId > 0) setSelectedOpcion(optionId);
        setWhatsAppDraft(null);
      }
      setUpdatedOfferFields([]);
      fetchLeadData();
      setOfferSchedule(emptySchedule);
      setCondiciones('');
      setPromocionAplicada('');
      toast({
        title: 'Propuesta comercial añadida',
        description: 'La oferta fue incorporada a la mesa de negociación.',
      });
    } catch (error) {
      setOfferErrors({
        envio: error instanceof Error ? error.message : 'No se pudo guardar la propuesta. Revisa los datos e inténtalo de nuevo.',
      });
      toast({
        title: 'Error al registrar propuesta',
        description: error instanceof Error ? error.message : 'No se pudo guardar la alternativa comercial.',
        variant: 'destructive',
      });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleSaveEdit = async (e: React.MouseEvent, id_opcion: number | string) => {
    e.stopPropagation();
    if (!editingPrice || isNaN(Number(editingPrice)) || Number(editingPrice) <= 0) {
      toast({
        title: 'Tarifa inválida',
        description: 'Ingresa un monto válido mayor a 0.',
        variant: 'destructive',
      });
      return;
    }
    setSavingEdit(true);
    try {
      await leadService.updateAlternative(id_opcion, { precio_ofrecido: editingPrice });
      setEditingOptionId(null);
      fetchLeadData();
      toast({
        title: 'Tarifa actualizada',
        description: `Nuevo monto: S/ ${Number(editingPrice).toFixed(2)}`,
      });
    } catch {
      toast({
        title: 'Error al actualizar tarifa',
        description: 'No se pudo modificar la propuesta.',
        variant: 'destructive',
      });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteOption = async () => {
    if (!deletingOptionTarget) return;
    setIsDeletingOption(true);
    try {
      await leadService.deleteAlternative(deletingOptionTarget.id_opcion);
      if (selectedOpcion === deletingOptionTarget.id_opcion) {
        setSelectedOpcion(null);
      }
      fetchLeadData();
      toast({
        title: 'Propuesta removida',
        description: 'La oferta comercial fue retirada del tablero.',
      });
    } catch {
      toast({
        title: 'Error al eliminar propuesta',
        description: 'No se pudo remover la alternativa.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  const handleReserveAndConvert = async () => {
    if (!selectedOpcion || !lead?.Solicitudes?.[0]?.id_solicitud) {
      toast({title:'Selecciona una propuesta comercial',description:'Se necesita una solicitud y una alternativa concretas.',variant:'destructive'});return;
    }
    setReserving(true);setTransferError('');
    try {
      const preview=await leadService.transferPreview(leadId,lead.Solicitudes[0].id_solicitud,selectedOpcion);
      setTransferAccepted(false);setTransferAuthorized(false);setTransferEvidence('');
      setTransferPreview({...preview,key:crypto.randomUUID()});
    } catch(error) {toast({title:'No se puede cerrar el trato',description:error instanceof Error?error.message:'No se pudo verificar.',variant:'destructive'});}
    finally {setReserving(false);}
  };
  const confirmTransfer = async (event: React.FormEvent) => {
    event.preventDefault();if(!transferPreview||reserving)return;
    setReserving(true);setTransferError('');
    try {
      await leadService.reserve(leadId,{id_solicitud:transferPreview.id_solicitud,id_opcion:transferPreview.id_opcion,
        huella:transferPreview.huella,clave_operacion:transferPreview.key,
        aceptacion_explicita:transferAccepted,autorizacion_reserva:transferAuthorized,evidencia:transferEvidence.trim()});
      await queryClient.invalidateQueries({queryKey:[QUERY_KEYS.LEADS]});
      await queryClient.invalidateQueries({queryKey:[QUERY_KEYS.PAYERS]});
      toast({title:'Traspaso confirmado',description:'Reserva pendiente registrada en PAYER. No se ha generado ni validado un pago.'});
      setTransferPreview(null);navigate('/payer');
    } catch(error) {setTransferError(error instanceof Error?error.message:'No se pudo confirmar. Reintenta la misma operación.');}
    finally {setReserving(false);}
  };
  const preparePublicLink = async () => {
    if(!selectedOpcion||!lead?.Solicitudes?.[0]?.id_solicitud)throw new Error('Selecciona primero una alternativa de la mesa.');
    const access=await leadService.createPreReservationAccess(leadId,lead.Solicitudes[0].id_solicitud,selectedOpcion);
    const url=`${window.location.origin}/pre-reserva/${leadId}#token=${access.token}`;
    setPublicLink({option:String(selectedOpcion),url,expiry:access.vence_utc});return url;
  };
  const openPublicReservation = async () => {
    try { const url=await preparePublicLink();window.location.assign(url); }
    catch(error) {toast({title:'No se pudo abrir Pre-Reserva',description:error instanceof Error?error.message:'Revisa la propuesta.',variant:'destructive'});}
  };

  if (loading) return <LoadingState />;
  if (!lead) return <ErrorState message="No se encontró el expediente de negociación LEAD." />;

  const fullName =
    `${lead.nombres || ''} ${lead.apellidos || ''}`.trim() || 'Paciente en Negociación';
  const pref = lead.Preferencias?.[0];
  const salud = lead.SaludOdontologica?.[0] || lead.saludOdontologica || {};
  const academico = lead.DatosAcademicos?.[0] || lead.datosAcademicos || {};
  const laboral = lead.DatosLaborales?.[0] || lead.datosLaborales || {};
  const ultimaSolicitud = lead.Solicitudes?.[0];
  const isAbandoned = ultimaSolicitud?.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO' ||
    ['Abandonada', 'Perdida', 'Cancelada'].includes(ultimaSolicitud?.estado) ||
    ['Descartado', 'Rechazado'].includes(lead.estado_calidad);
  const isConverted = lead.Etapa?.nombre === 'PAYER' || ultimaSolicitud?.estado === 'Convertida';
  const analysis = interactionAnalysis?.requestId === ultimaSolicitud?.id_solicitud ? interactionAnalysis?.result : null;
  const suggestedSlots = analysis && (analysis.dia || analysis.turno)
    ? eligibleOfferSlots.filter((slot: any) => {
      const weekday = new Intl.DateTimeFormat('es-PE', { weekday: 'long', timeZone: 'UTC' })
        .format(new Date(slot.fecha)).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const time = String(slot.hora_inicio).slice(11, 16);
      const shift = time < '13:00' ? 'mañana' : time < '18:00' ? 'tarde' : 'noche';
      return time >= '08:00' && time < '20:00' &&
        (!analysis.dia || weekday === analysis.dia) && (!analysis.turno || shift === analysis.turno);
    }).slice(0, 5)
    : [];
  const canAbandon = Boolean(ultimaSolicitud?.id_solicitud) && lead.Etapa?.nombre === 'LEAD' &&
    !isAbandoned && !isConverted &&
    (!ultimaSolicitud.resultado_comercial_lead || ultimaSolicitud.resultado_comercial_lead === 'PENDIENTE');

  const handleAbandon = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canAbandon || reserving || abandoning || !abandonReason.trim()) return;
    setAbandoning(true);
    setAbandonError('');
    try {
      const result = await leadService.abandonLead(leadId, abandonReason.trim(), ultimaSolicitud.id_solicitud);
      if (!result) throw new Error('No se pudo registrar el abandono.');
      setAbandonOpen(false);
      void queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      fetchLeadData();
      toast({ title: 'Negociación cerrada sin acuerdo' });
    } catch (error) {
      setAbandonError(error instanceof Error ? error.message : 'No se pudo registrar el abandono.');
    } finally {
      setAbandoning(false);
    }
  };
  const opciones: any[] = ultimaSolicitud?.Opciones || [];
  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);
  const selectedOfferKey = ultimaSolicitud?.id_solicitud && selectedOpcion
    ? `${leadId}:${ultimaSolicitud.id_solicitud}:${selectedOpcion}`
    : null;
  const availableFlyerId = selectedOfferKey && canvaResult?.offerKey === selectedOfferKey
    ? canvaResult.attachmentId
    : undefined;

  async function updateFromWhatsApp(update: WhatsAppProposalUpdate) {
    const slot = update.horario;
    if (!ultimaSolicitud?.id_solicitud || isConverted || isAbandoned) {
      throw new Error('La oportunidad ya no está abierta para negociar.');
    }
    const requestId = ultimaSolicitud.id_solicitud;
    const offer = await leadService.transferPreview(leadId, requestId, update.id_opcion, Boolean(slot));
    if (offer.id_propuesta !== update.id_propuesta || (!slot && update.huella && offer.huella !== update.huella)) {
      throw new Error('La propuesta cambió. Revisa las opciones vigentes de la mesa.');
    }

    if (!slot) {
      const current = await leadService.getLeadDetails(leadId);
      const currentRequest = current?.Solicitudes?.[0];
      if (currentRequest?.id_solicitud !== requestId || !currentRequest.Opciones?.some((option: any) => option.id_opcion === update.id_opcion)) {
        throw new Error('La propuesta ya no aparece entre las opciones vigentes.');
      }
      setLead(current);
      setWhatsAppDraft(null);
      setUpdatedOfferFields([]);
      setActiveProposal(null);
      setOfferSchedule(emptySchedule);
      setSelectedOpcion(update.id_opcion);
      toast({ title: 'Propuesta vigente seleccionada', description: 'Revisa el mensaje antes de enviarlo de nuevo.' });
      document.getElementById('lead-proposal-dispatch')?.scrollIntoView({ block: 'start' });
      return;
    }

    const serviceId = Number(ultimaSolicitud.id_servicio);
    const fresh = await leadService.getAvailabilityOptions();
    const available = fresh.disponibilidades?.some((item: any) => {
      const schedule = slotSchedule(item);
      return item.id_disponibilidad === slot.id_disponibilidad && item.id_sede === slot.id_sede &&
        item.id_profesional === slot.id_profesional && schedule.date === slot.fecha &&
        schedule.start === slot.inicio && schedule.end === slot.fin &&
        item.Profesional?.ProfesionalServicio?.some((entry: { id_servicio: number }) => entry.id_servicio === serviceId);
    });
    if (!available) throw new Error('Ese horario cambió o ya no está disponible. Elige otro horario en la mesa.');

    const expiry = new Date(offer.vence).toISOString();
    const promotion = offer.promocion ?? null;
    const nextSchedule = { date: slot.fecha, start: slot.inicio, end: slot.fin };
    const originalSchedule = { date: offer.fecha, start: offer.inicio, end: offer.fin };
    const changedFields: UpdatedOfferField[] = [];
    if (offer.id_sede != null && Number(offer.id_sede) !== slot.id_sede) changedFields.push('branch');
    if (offer.id_profesional != null && Number(offer.id_profesional) !== slot.id_profesional) changedFields.push('professional');
    for (const field of ['date', 'start', 'end'] as const) {
      if (originalSchedule[field] && originalSchedule[field] !== nextSchedule[field]) changedFields.push(field);
    }
    setUpdatedOfferFields(changedFields);
    setWhatsAppDraft({ originalExpiry: expiry });
    setOptions(fresh);
    setSelectedServicioId(String(serviceId));
    setSelectedSedeId(String(slot.id_sede));
    setSelectedProfesionalId(String(slot.id_profesional));
    setSelectedFranja(slot.inicio < '13:00' ? `Turno Mañana (${openTime} – 01:00 PM)` :
      slot.inicio < '18:00' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : `Turno Noche (06:00 PM – ${closeTime})`);
    setOfferSchedule(nextSchedule);
    setPrecioOfrecido(offer.precio);
    setPromocionAplicada(promotion ?? '');
    setCondiciones('');
    setActiveProposal({ id: update.id_propuesta, terms: JSON.stringify({
      serviceId, price: offer.precio, promotion, validUntil: expiry,
    }) });
    setOfferErrors({});
    document.getElementById('lead-proposal-form')?.scrollIntoView({ block: 'start' });
    toast({ title: 'Horario cargado en la propuesta', description: 'Revisa la sede y las condiciones, y guarda la propuesta antes de enviarla.' });
  }

  const generateWhatsAppMessage = (linkOverride?: string) => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Evaluación Odontológica';

    if (selectedOptData) {
      const precio = Number(selectedOptData.precio_ofrecido).toFixed(2);
      const matchedSede = selectedOptData.Disponibilidad?.Sede;
      const sede = matchedSede
        ? `${matchedSede.nombre}${matchedSede.direccion ? ` (${matchedSede.direccion})` : ''}`
        : 'Sede California';
      const doctor = selectedOptData.Disponibilidad?.Profesional?.apellidos
        ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}`
        : 'Staff Odontológico Colegiado';
      const expiry = selectedOptData.Propuesta?.fecha_vigencia_hasta_utc_lead;
      const fechaVigencia = expiry ? new Date(expiry).toLocaleString('es-PE',{timeZone:'America/Lima'}) : 'por verificar';

      return (
        `Hola ${patientFirstName}, te saludamos de NexoSalud Dental.\n\n` +
        `Hemos preparado tu propuesta comercial para ${reqServicio}:\n` +
        `• Tarifa Preferencial: S/ ${precio}\n` +
        `• Vigencia: Hasta el ${fechaVigencia}\n` +
        `• Sede: ${sede}\n` +
        `• Especialista: ${doctor}\n\n` +
        `Puedes confirmar tu pre-reserva en línea aquí:\n` +
        `${linkOverride || (publicLink?.option===String(selectedOpcion)?publicLink.url:'Solicita el enlace privado mediante Pre-Reserva.')}\n\n` +
        `Quedamos atentos para asegurar tu turno.`
      );
    }

    return (
      `Hola ${patientFirstName}, te escribimos de NexoSalud Dental respecto a tu solicitud de ${reqServicio}. ` +
      `Contamos con disponibilidad preferencial en ${pref?.sede_preferida || 'nuestras sedes'} para esta semana. ` +
      `¿En qué turno te gustaría agendar tu cita?`
    );
  };

  const handleSendWhatsApp = async () => {
    if (whatsAppDraft || sendingWhatsApp || generatingCanva || !selectedOpcion || !ultimaSolicitud?.id_solicitud) return;
    setSendingWhatsApp(true);
    try {
      const result = await leadService.sendProposalWhatsApp(
        leadId, ultimaSolicitud.id_solicitud, selectedOpcion,
        checkedFlyerId === availableFlyerId ? availableFlyerId : undefined,
      );
      toast({
        title: result.reutilizado ? 'Envío anterior confirmado por OpenWA' : 'Envío aceptado por OpenWA',
        description: [
          result.incluye_flyer ? 'Se adjuntó el flyer de Canva.' : undefined,
          result.incluye_enlace ? 'La propuesta incluye el enlace de prerreserva.'
            : 'La propuesta pide al cliente responder para coordinar su prerreserva.',
        ].filter(Boolean).join(' '),
      });
    } catch (error) {
      toast({
        title: 'No se pudo confirmar el envío',
        description: error instanceof Error ? error.message : 'Verifica la conexión a OpenWA.',
        variant: 'destructive',
      });
    } finally {
      setSendingWhatsApp(false);
    }
  };

  const handleOpenWhatsApp = async () => {
    let link: string | undefined;
    try { if(selectedOpcion)link=await preparePublicLink(); }
    catch(error) {toast({title:'Revisa la propuesta',description:error instanceof Error?error.message:'No se pudo generar el enlace.',variant:'destructive'});return;}
    const rawPhone = String(lead?.numero || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    const message = generateWhatsAppMessage(link);
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = async () => {
    let link: string | undefined;
    try { if(selectedOpcion)link=await preparePublicLink(); }
    catch(error) {toast({title:'Revisa la propuesta',description:error instanceof Error?error.message:'No se pudo generar el enlace.',variant:'destructive'});return;}
    const patientFirstName = lead?.nombres || 'Paciente';
    const email = lead?.email || '';
    const subject = encodeURIComponent(
      `Propuesta Comercial Odontológica — NexoSalud (${patientFirstName})`
    );
    const body = encodeURIComponent(generateWhatsAppMessage(link));
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyWhatsApp = async () => {
    try {
      const link=selectedOpcion?await preparePublicLink():undefined;
      await navigator.clipboard.writeText(generateWhatsAppMessage(link));
    } catch(error) {toast({title:'No se pudo copiar',description:error instanceof Error?error.message:'Revisa la propuesta.',variant:'destructive'});return;}
    setCopiedWhatsApp(true);
    toast({
      title: 'Propuesta copiada',
      description: 'El mensaje fue copiado al portapapeles.',
    });
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleGenerateCanva = async () => {
    setGeneratingCanva(true);
    setCheckedFlyerId(undefined);
    setCanvaResult(null);
    try {
      const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';
      const precio = selectedOptData
        ? Number(selectedOptData.precio_ofrecido).toFixed(2)
        : numericOfferPrice.toFixed(2);
      const matchedSedeObj =
        selectedOptData?.Disponibilidad?.Sede ||
        options.sedes?.find((s: any) => String(s.id_sede) === selectedSedeId) ||
        options.sedes?.[0];
      const sede = matchedSedeObj ? matchedSedeObj.nombre : 'Sede California';
      const doctor = selectedOptData?.Disponibilidad?.Profesional?.apellidos
        ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}`
        : 'Staff Colegiado';
      const rawExpDate =
        selectedOptData?.Disponibilidad?.fecha?.split('T')[0] ||
        format(calculatedExpiry, 'yyyy-MM-dd');

      const resData = await leadService.generateCanvaFlyer(leadId, {
        ...(selectedOfferKey ? { id_solicitud: ultimaSolicitud.id_solicitud, id_opcion: selectedOpcion } : {}),
        serviceName: reqServicio,
        sedeName: sede,
        doctorName: doctor,
        offeredPrice: Number(precio),
        originalPrice: currentOfficialPrice || 180,
        discountPct: discountMetrics?.pct || 15,
        expirationDate: rawExpDate,
        fechaLimite: rawExpDate,
        diasFaltantes: 2,
        horarioTexto: selectedFranja,
        conditions: condiciones || `Atención clínica en ${sede}`,
        sendEmail: false,
        leadEmail: lead?.email,
        leadPhone: lead?.numero,
      });

      const canva = resData.canva;
      setCanvaResult({
        designUrl: canva?.designUrl,
        previewUrl: canva?.previewUrl,
        downloadPngUrl: canva?.downloadPngUrl || canva?.previewUrl,
        attachmentId: resData.id_adjunto,
        offerKey: selectedOfferKey,
        isPersonalized: canva.source === 'canva_autofill',
      });

      toast({
        title: canva.source === 'canva_autofill' ? 'Flyer generado con Canva'
          : canva.source === 'canva_template' ? 'Plantilla base exportada de Canva' : 'Flyer generado localmente',
        description: canva.source === 'canva_template'
          ? 'Canva no completó la personalización de la plantilla.'
          : 'La pieza gráfica está lista para previsualizar o descargar.',
      });
    } catch (error) {
      toast({
        title: 'No se pudo generar el flyer',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setGeneratingCanva(false);
    }
  };

  return (
    <div className="w-full max-w-none space-y-6 overflow-x-hidden">
      {/* Cabecera Fija de la Mesa de Negociación */}
      <div className="sticky top-0 z-20 py-3.5 sm:py-4 bg-[#f8fafc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 flex-1 basis-64 space-y-1">
            <Link
              to="/lead"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Volver a Oportunidades (LEAD)</span>
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
                {fullName}
              </h1>
              {renderLeadStatusBadge(
                isConverted ? LeadState.PAYMENT_REQUESTED : isAbandoned ? LeadState.LOST :
                  selectedOpcion ? LeadState.ALTERNATIVE_SELECTED : LeadState.IN_NEGOTIATION
              )}
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                LEAD #{lead.id_persona || leadId}
                {lead.dni ? ` · DNI ${lead.dni}` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Acciones Fijas Arriba */}
          <div className="flex max-w-full flex-wrap items-center gap-2 [&>button]:shrink-0 [&>button]:whitespace-nowrap">
            <button
              type="button"
              onClick={handleReserveAndConvert}
              disabled={reserving || abandoning || isAbandoned || isConverted || !selectedOpcion}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {reserving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Verificar y pasar a PAYER</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>

            {canAbandon && (
              <button
                type="button"
                disabled={reserving || abandoning}
                onClick={() => {
                  setAbandonReason('');
                  setAbandonError('');
                  setAbandonOpen(true);
                }}
                className="h-9 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:text-red-300"
              >
                Registrar abandono
              </button>
            )}

            <button
              type="button" onClick={() => void openPublicReservation()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Pre-Reserva</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/lead')}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Cerrar</span>
            </button>
          </div>
        </div>
      </div>

        <div className="min-w-0 space-y-6">
          {/* Bloque 1: Perfil de la oportunidad Integral del LEAD */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            {/* Cabecera del Perfil con Selector de Vista */}
            <div className="flex flex-col gap-3 border-b border-slate-200/80 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between bg-slate-50/50 dark:bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/60 text-[#0f766e] dark:text-teal-400 border border-teal-200/60 dark:border-teal-800/60 shadow-2xs">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                      Perfil de Negociación Comercial & Expediente
                    </h2>
                    <span className="rounded bg-teal-50 dark:bg-teal-950/60 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-teal-700 dark:text-teal-300 border border-teal-200/50">
                      LEAD · CIERRE
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Datos de contacto, preferencias y antecedentes registrados.
                  </p>
                </div>
              </div>

              {/* Acciones de Cabecera: Completar Perfil Asesor & Selector de Modo */}
              <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                <button
                  type="button"
                  onClick={() => setIsEditProfileModalOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/60 dark:hover:bg-teal-900/80 text-[#0f766e] dark:text-teal-300 border border-teal-200/80 dark:border-teal-800/80 px-3 py-1.5 text-xs font-semibold shadow-2xs transition-all cursor-pointer hover:shadow-xs"
                >
                  <Edit3 className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Completar / Editar Perfil</span>
                </button>

                <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-0.5 text-xs font-medium self-start sm:self-auto shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('TABS')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                      profileViewMode === 'TABS'
                        ? 'bg-[#0f766e] text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <SlidersHorizontal className="h-3 w-3" />
                    <span>Pestañas</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProfileViewMode('ALL')}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                      profileViewMode === 'ALL'
                        ? 'bg-[#0f766e] text-white font-semibold'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    <Eye className="h-3 w-3" />
                    <span>Ver Todo</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pestañas de Navegación Segmentada (Segmented Control Responsive sin Scroll Horizontal) */}
            {profileViewMode === 'TABS' && (
              <div className="border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 p-2 sm:p-2.5">
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {([
                    { id: 'CONTACTO', label: 'Datos de contacto', icon: User },
                    { id: 'CLINICA', label: 'Salud odontológica', icon: HeartPulse },
                    { id: 'CONVENIOS', label: 'Estudio y trabajo', icon: GraduationCap },
                  ] as const).map((tab) => {
                    const Icon = tab.icon;
                    const active = profileTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setProfileTab(tab.id)}
                        className={`flex items-center justify-center sm:justify-start gap-1.5 rounded-lg px-2.5 py-2 text-xs transition-all cursor-pointer ${
                          active
                            ? 'bg-white dark:bg-slate-900 text-[#0f766e] dark:text-teal-400 font-semibold shadow-xs ring-1 ring-slate-200/80 dark:ring-slate-700/80'
                            : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-slate-900/50'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? 'text-[#0f766e] dark:text-teal-400' : 'text-slate-400'}`} />
                        <span className="truncate">{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Contenido Modular de las Secciones */}
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
              {/* SECCIÓN B: Gatilladores Clínicos (Salud Odontológica) */}
              {(profileViewMode === 'ALL' || profileTab === 'CLINICA') && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <HeartPulse className="h-3.5 w-3.5 text-rose-500" />
                      <span>Salud odontológica registrada</span>
                    </h3>
                  </div>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Nivel de Dolor Reportado</dt>
                      <dd className="mt-1">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                          salud.nivel_dolor === 'Severo'
                            ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200'
                            : salud.nivel_dolor === 'Moderado'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {salud.nivel_dolor || 'No registrado'}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sensibilidad Dental</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.presenta_sensibilidad || 'No reportada'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sangrado / Inflamación</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.sangrado_o_inflamacion || 'No reportado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Última Visita Odontológica</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {salud.ultima_visita_odontologica || 'No registrada'}
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Condición Especial de Atención</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {salud.condicion_atencion_especial ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded border border-purple-200/60">
                            {salud.condicion_atencion_especial}
                          </span>
                        ) : (
                          'No registrada'
                        )}
                      </dd>
                    </div>

                    <div className="sm:col-span-2">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Uso de Aparatos o Prótesis</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white">
                        {salud.usa_aparato_o_protesis || 'No registrado'}
                      </dd>
                    </div>

                    {ultimaSolicitud?.motivo && (
                      <div className="sm:col-span-4 border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/50 pl-3.5 pr-4 py-2.5 rounded-r-lg">
                        <dt className="text-[10px] font-semibold uppercase text-[#0f766e] dark:text-teal-400 tracking-wider">
                          Motivo Concreto Declarado por el Paciente
                        </dt>
                        <dd className="mt-1 text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                          “{ultimaSolicitud.motivo}”
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )}

              {/* SECCIÓN C: Perfil Ocupacional, Agenda & Convenios Institucionales */}
              {(profileViewMode === 'ALL' || profileTab === 'CONVENIOS') && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5 text-sky-600" />
                    <span>Datos de estudio, trabajo y disponibilidad</span>
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {/* Perfil académico registrado */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <GraduationCap className="h-4 w-4 text-sky-600" />
                          <span>Perfil Académico (Estudiante)</span>
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Universidad / Instituto:</dt>
                          <dd className="font-semibold text-slate-900 dark:text-white">
                            {academico.universidad || 'No registrada'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Carrera & Ciclo:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {academico.carrera ? `${academico.carrera} (${academico.ciclo || 'Ciclo N/E'})` : '—'}
                          </dd>
                        </div>
                      </dl>

                    </div>

                    {/* Tarjeta Perfil Laboral & Disponibilidad de Agenda */}
                    <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <Briefcase className="h-4 w-4 text-slate-600" />
                          <span>Perfil Laboral & Flexibilidad</span>
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 font-mono">
                          {laboral.modalidadLaboral || 'Modalidad N/E'}
                        </span>
                      </div>

                      <dl className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Ocupación:</dt>
                          <dd className="font-semibold text-slate-900 dark:text-white">
                            {laboral.ocupacion || 'No registrada'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Empresa / Centro:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {laboral.empresa || 'Particular'}
                          </dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-slate-500">Disponibilidad de Horario:</dt>
                          <dd className="font-medium text-slate-800 dark:text-slate-200">
                            {laboral.disponibilidadLaboral || laboral.disponibilidad || 'No registrada'}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )}

              {/* SECCIÓN D: Datos de Contacto & Solicitud de Captación */}
              {(profileViewMode === 'ALL' || profileTab === 'CONTACTO') && (
                <div className="p-6 space-y-4">
                  <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-slate-500" />
                    <span>Datos de Contacto & Trazabilidad de Captación</span>
                  </h3>

                  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Paciente</dt>
                      <dd className="mt-1 font-semibold text-slate-900 dark:text-white">
                        {fullName}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Documento / DNI</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums">
                        {lead.dni || 'No registrado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Teléfono / WhatsApp</dt>
                      <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{lead.numero ? `+51 ${lead.numero}` : 'No registrado'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Correo Electrónico</dt>
                      <dd className="mt-1 text-slate-900 dark:text-white truncate">
                        {lead.email || 'No registrado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Canal de Captación</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                        {lead.Interacciones?.[0]?.Canal?.nombre || lead.CanalOrigen?.nombre || 'No registrado'}
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Tratamiento Solicitado</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <Stethoscope className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                        <span>{ultimaSolicitud?.Servicio?.nombre || 'Evaluación Odontológica'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Sede Preferida</dt>
                      <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                        <span>{pref?.sede_preferida || 'Sin preferencia registrada'}</span>
                      </dd>
                    </div>

                    <div>
                      <dt className="font-medium text-slate-500 dark:text-slate-400">Frecuencia de Consulta</dt>
                      <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                        {(lead.Solicitudes?.length || 1) > 1
                          ? `${lead.Solicitudes.length} consultas registradas`
                          : '1ª solicitud activa'}
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>

          {/* Bloque 2: Configuración de Oferta Comercial y Tablero de Propuestas */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            {/* Sección 1: Configurar Nueva Propuesta Comercial */}
            <section id="lead-proposal-form" className="scroll-mt-28 p-6 space-y-5">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    1. Configurar Propuesta Comercial
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Define servicio, sede, turno y tarifa preferencial con vigencia controlada.
                  </p>
                </div>
                <span className="font-mono text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
                  Vigencia hasta: {format(calculatedExpiry, 'dd/MM/yyyy HH:mm')}
                </span>
              </div>

              {whatsAppDraft && <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200 bg-teal-50 p-3 text-xs text-teal-900 dark:border-teal-800 dark:bg-teal-950/50 dark:text-teal-200">
                <p>Horario cargado desde WhatsApp. Revisa las condiciones y añade la propuesta a la mesa para enviarla.</p>
                <button type="button" className="font-semibold underline" onClick={() => {
                  setWhatsAppDraft(null);
                  setUpdatedOfferFields([]);
                  setActiveProposal(null);
                  setOfferSchedule(emptySchedule);
                  setPromocionAplicada('');
                  setOfferErrors({});
                  fetchLeadData();
                }}>Descartar cambios</button>
              </div>}

              {/* Chips de Vigencia */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Margen de Vigencia de la Propuesta
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: '24h', label: '24 Horas (Flash)' },
                    { id: '48h', label: '48 Horas (Recomendado)' },
                    { id: '72h', label: '72 Horas (3 Días)' },
                    { id: '7d', label: '7 Días (Semanal)' },
                    { id: 'custom', label: 'Personalizado' },
                  ].map((v) => {
                    const active = !whatsAppDraft?.originalExpiry && selectedVigencia === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setSelectedVigencia(v.id as any);
                          setWhatsAppDraft(current => current ? { originalExpiry: null } : null);
                          setValidityStartedAt(Date.now());
                          setOfferErrors((current) => ({ ...current, vigencia: '' }));
                        }}
                        className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0f766e] bg-teal-50/60 dark:bg-teal-950/50 font-semibold text-[#0f766e] dark:text-teal-300'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {v.label}
                      </button>
                    );
                  })}
                </div>
                {selectedVigencia === 'custom' && !whatsAppDraft?.originalExpiry && (
                  <div className="pt-2">
                    <input
                      type="date"
                      value={selectedVigenciaCustom}
                      onChange={(e) => {
                        setSelectedVigenciaCustom(e.target.value);
                        setOfferErrors((current) => ({ ...current, vigencia: '' }));
                      }}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
                {offerErrors.vigencia && <p role="alert" className="text-xs text-rose-600">{offerErrors.vigencia}</p>}
              </div>

              {/* Grid de Servicio, Sede y Especialista */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="lead-offer-service" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Servicio Ofertado
                  </label>
                  <select
                    id="lead-offer-service"
                    value={selectedServicioId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedServicioId(val);
                      setOfferSchedule(emptySchedule);
                      setOfferErrors({});
                      const serv = options.servicios?.find(
                        (s: any) => String(s.id_servicio) === val
                      );
                      const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                      setPrecioOfrecido(baseP.toFixed(2));
                      setPromocionAplicada('');
                    }}
                    className={offerFieldClass}
                  >
                    {options.servicios?.map((s: any) => (
                      <option key={s.id_servicio} value={String(s.id_servicio)}>
                        {s.nombre}{' '}
                        {s.Tarifas?.[0]?.precio
                          ? `(S/ ${Number(s.Tarifas[0].precio).toFixed(2)})`
                          : ''}
                      </option>
                    ))}
                  </select>
                  {changesRequestedService && (
                    <p className="mt-1 text-[11px] text-slate-500">
                      Al añadir la propuesta, se te pedirá confirmar el cambio de tratamiento de la solicitud.
                    </p>
                  )}
                  {offerErrors.servicio && (
                    <p role="alert" className="mt-1 text-xs text-rose-600">{offerErrors.servicio}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="lead-offer-branch" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Sede Clínica
                  </label>
                  <select
                    id="lead-offer-branch"
                    {...highlightProps('branch')}
                    value={selectedSedeId}
                    onChange={(e) => {
                      setSelectedSedeId(e.target.value);
                    }}
                    className={offerFieldClass}
                  >
                    <option value="ALL_SEDES">Todas las sedes (A elección)</option>
                    {options.sedes?.map((s: any) => (
                      <option key={s.id_sede} value={String(s.id_sede)}>
                        {s.nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="lead-offer-professional" className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Especialista Sugerido
                  </label>
                  <select
                    id="lead-offer-professional"
                    {...highlightProps('professional')}
                    value={effectiveProfessionalId}
                    disabled={eligibleProfessionals.length === 0}
                    onChange={(e) => {
                      setSelectedProfesionalId(e.target.value);
                    }}
                    className={offerFieldClass}
                  >
                    <option value="ALL_PROFESSIONALS">
                      {eligibleProfessionals.length ? 'Cualquier especialista disponible' : 'Sin especialistas con horarios para este servicio y sede'}
                    </option>
                    {eligibleProfessionals.map((p: any) => (
                      <option key={p.id_profesional} value={String(p.id_profesional)}>
                        Esp. {p.nombres} {p.apellidos}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Chips de Franja Horaria */}
              <div className="space-y-2">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Franja Horaria de Atención
                </label>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {[
                    {
                      label: 'Turno Mañana',
                      range: `${openTime} – 01:00 PM`,
                      full: `Turno Mañana (${openTime} – 01:00 PM)`,
                    },
                    {
                      label: 'Turno Tarde',
                      range: '01:00 PM – 06:00 PM',
                      full: 'Turno Tarde (01:00 PM – 06:00 PM)',
                    },
                    {
                      label: 'Turno Noche',
                      range: `06:00 PM – ${closeTime}`,
                      full: `Turno Noche (06:00 PM – ${closeTime})`,
                    },
                  ].map((slot) => {
                    const active = selectedFranja === slot.full;
                    return (
                      <button
                        key={slot.label}
                        type="button"
                        onClick={() => {
                          setSelectedFranja(slot.full);
                          setOfferSchedule(emptySchedule);
                        }}
                        className={`flex items-center justify-between rounded-lg border px-3.5 py-2 text-xs transition-colors cursor-pointer ${
                          active
                            ? 'border-[#0f766e] bg-teal-50/50 dark:bg-teal-950/40 font-semibold text-slate-900 dark:text-white'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <span>{slot.label}</span>
                        <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                          {slot.range}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Comparador Financiero Sobrio y Descuentos Rápidos */}
              <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 p-4 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Esquema Tarifario y Descuentos Autorizados
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                    >
                      Promoción (-15%)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 hover:border-[#0f766e] hover:text-[#0f766e] cursor-pointer"
                    >
                      Campaña (-20%)
                    </button>
                    <button
                      type="button"
                      onClick={() => applyQuickDiscount(0, 'REGULAR')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 cursor-pointer"
                    >
                      Tarifa Regular
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Precio de Lista</span>
                    <span className="font-mono text-sm font-semibold text-slate-500 line-through tabular-nums">
                      S/ {currentOfficialPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Tarifa Ofertada</span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white tabular-nums">
                      S/ {numericOfferPrice.toFixed(2)}
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2.5">
                    <span className="block text-[11px] text-slate-500">Beneficio / Ahorro</span>
                    <span className="font-mono text-sm font-semibold text-[#0f766e] dark:text-teal-400 tabular-nums">
                      S/ {discountMetrics.saving.toFixed(2)} ({discountMetrics.pct}% OFF)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Monto Final a Proponer (S/)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={precioOfrecido}
                      onChange={(e) => {
                        setPrecioOfrecido(e.target.value);
                        setPromocionAplicada('');
                      }}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums focus:border-[#0f766e] focus:outline-none"
                    />
                    {offerErrors.precio && <p role="alert" className="mt-1 text-xs text-rose-600">{offerErrors.precio}</p>}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Condición o Beneficio Adicional
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Incluye radiografía panorámica o facilidades de pago"
                      value={condiciones}
                      onChange={(e) => setCondiciones(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:border-[#0f766e] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="text-xs">
                    {analysis && (analysis.dia || analysis.turno) && (
                      <div className="mb-3 space-y-1">
                        <p className="font-semibold">Horarios sugeridos para la interacción</p>
                        {!suggestedSlots.length && <p>No hay coincidencias para la preferencia con este servicio y sede.</p>}
                        {suggestedSlots.map((slot: any) => {
                          const time = String(slot.hora_inicio).slice(11, 16);
                          return <button type="button" key={slot.id_disponibilidad} className="block rounded border px-2 py-1"
                            onClick={() => {
                              setSelectedSedeId(String(slot.id_sede));
                              setSelectedProfesionalId(String(slot.id_profesional));
                              setSelectedFranja(time < '13:00' ? `Turno Mañana (${openTime} – 01:00 PM)` :
                                time < '18:00' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : `Turno Noche (06:00 PM – ${closeTime})`);
                              updateOfferSchedule(slotSchedule(slot));
                            }}>
                            {String(slot.fecha).slice(0, 10)} · {time} · {slot.Sede?.nombre} · {slot.Profesional?.apellidos}
                          </button>;
                        })}
                      </div>
                    )}
                    <fieldset className="min-w-0">
                      <legend className="mb-2 text-xs font-semibold text-slate-900 dark:text-white">Horario</legend>
                      <div className="grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
                        <div className="col-span-2 min-w-0 sm:col-span-1">
                          <OfferDateCalendar dates={scheduleDates} value={validDate ? offerSchedule.date : ''} fieldClass={offerFieldClass}
                            highlight={highlightProps('date')}
                            onChange={date => { if (date !== offerSchedule.date) updateOfferSchedule({ date, start: '', end: '' }); }} />
                        </div>
                        <OfferTimeField id="lead-offer-start" label="Hora inicial" times={scheduleStarts}
                          highlight={highlightProps('start')}
                          value={validStart ? offerSchedule.start : ''} disabled={!validDate}
                          onChange={start => updateOfferSchedule({ ...offerSchedule, start, end: '' })} />
                        <OfferTimeField id="lead-offer-end" label="Hora final" times={scheduleEnds}
                          highlight={highlightProps('end')}
                          value={validEnd ? offerSchedule.end : ''} disabled={!validStart}
                          onChange={end => updateOfferSchedule({ ...offerSchedule, end })} />
                      </div>
                      {offerErrors.horario ? <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-400">{offerErrors.horario}</p>
                        : !scheduleDates.length ? <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">No hay horarios disponibles con estos filtros.</p>
                        : ambiguousSchedule ? <p role="status" className="mt-2 text-xs text-slate-500 dark:text-slate-400">Hay más de una coincidencia. Ajusta la sede o el especialista.</p> : null}
                    </fieldset>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddAlternative}
                    disabled={addingAlternative}
                    className="ml-auto flex min-h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0f766e] px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 disabled:opacity-50 sm:w-auto"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>
                      {addingAlternative
                        ? 'Añadiendo propuesta...'
                        : 'Añadir Propuesta a la Mesa'}
                    </span>
                  </button>
                </div>
                {offerErrors.envio && (
                  <p role="alert" className="text-sm text-rose-600">{offerErrors.envio}</p>
                )}
              </div>
            </section>

            {/* Sección 2: Propuestas Comerciales sobre la Mesa */}
            <section className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    2. Propuestas Comerciales Activas ({opciones.length})
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Selecciona la propuesta aceptada por el paciente para generar la orden de cobro en PAYER.
                  </p>
                </div>
              </div>

              {opciones.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 py-8 text-center">
                  <p className="text-xs text-slate-500">
                    Aún no hay propuestas registradas. Configura y añade una opción en el panel superior.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {opciones.map((opt: any) => {
                    const isSelected = selectedOpcion === opt.id_opcion;
                    return (
                      <div
                        key={opt.id_opcion}
                        onClick={() => setSelectedOpcion(opt.id_opcion)}
                        className={`flex flex-col justify-between gap-3 rounded-xl border p-4 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-[#0f766e] bg-teal-50/40 dark:bg-teal-950/30 ring-1 ring-[#0f766e]'
                            : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2.5">
                          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-slate-600 dark:text-slate-300">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>
                              Fecha del turno ofrecido: {opt.Disponibilidad?.fecha?.split('T')[0] || 'No registrada'}
                            </span>
                          </span>

                          {editingOptionId === opt.id_opcion ? (
                            <div
                              className="flex items-center gap-1"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="number"
                                value={editingPrice}
                                onChange={(e) => setEditingPrice(e.target.value)}
                                className="h-7 w-20 rounded border border-[#0f766e] bg-white dark:bg-slate-900 px-2 font-mono text-xs font-bold text-slate-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={(e) => handleSaveEdit(e, opt.id_opcion)}
                                disabled={savingEdit}
                                className="inline-flex h-7 w-7 items-center justify-center rounded bg-[#0f766e] text-white"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingOptionId(null);
                                }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-200 text-slate-500"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white tabular-nums">
                                S/ {Number(opt.precio_ofrecido).toFixed(2)}
                              </span>
                              <div
                                className="flex items-center gap-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  title="Editar tarifa"
                                  onClick={() => {
                                    setEditingOptionId(opt.id_opcion);
                                    setEditingPrice(String(opt.precio_ofrecido || ''));
                                  }}
                                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  title="Eliminar propuesta"
                                  onClick={() => setDeletingOptionTarget(opt)}
                                  className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                          <p>
                            <span className="font-medium text-slate-500">Sede:</span>{' '}
                            {opt.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}
                          </p>
                          <p>
                            <span className="font-medium text-slate-500">Especialista:</span>{' '}
                            {opt.Disponibilidad?.Profesional?.apellidos
                              ? `Esp. ${opt.Disponibilidad.Profesional.apellidos}`
                              : 'Staff Colegiado'}
                          </p>
                          {opt.Propuesta?.promocion_aplicada && (
                            <p>
                              <span className="font-medium text-slate-500">Promoción:</span>{' '}
                              {opt.Propuesta.promocion_aplicada}
                            </p>
                          )}
                          {opt.Propuesta?.fecha_vigencia_hasta_utc_lead && (
                            <p>
                              <span className="font-medium text-slate-500">Precio vigente hasta:</span>{' '}
                              {format(new Date(opt.Propuesta.fecha_vigencia_hasta_utc_lead), 'dd/MM/yyyy HH:mm')}
                            </p>
                          )}
                          {opt.condiciones && (
                            <p className="pt-1 text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">
                              {opt.condiciones}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px]">
                          <span
                            className={`font-medium ${
                              isSelected ? 'text-[#0f766e] font-semibold' : 'text-slate-400'
                            }`}
                          >
                            {isSelected ? 'Propuesta seleccionada para cierre' : 'Clic para elegir'}
                          </span>
                          {isSelected && (
                            <CheckCircle2 className="h-4 w-4 text-[#0f766e]" strokeWidth={2} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Sección 3: Despacho Omnicanal y Generación de Pieza Gráfica (Canva) */}
            <section id="lead-proposal-dispatch" className="scroll-mt-28 p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    3. Despacho de Propuesta Comercial & Canva Connect
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Envía el resumen de la propuesta por WhatsApp, correo electrónico o adjunta un flyer personalizado.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleCopyWhatsApp}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 cursor-pointer"
                >
                  {copiedWhatsApp ? (
                    <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-slate-400" />
                  )}
                  <span>{copiedWhatsApp ? 'Copiado' : 'Copiar texto'}</span>
                </button>
              </div>

              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed" aria-label="Borrador para copiar o enviar por correo">
                {generateWhatsAppMessage()}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  disabled={Boolean(whatsAppDraft) || sendingWhatsApp || generatingCanva || !selectedOpcion}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>{sendingWhatsApp ? 'Enviando…' : 'Enviar por WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  Abrir WhatsApp manualmente
                </button>

                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} />
                  <span>Enviar por Correo</span>
                </button>

                <button
                  type="button"
                  onClick={handleGenerateCanva}
                  disabled={generatingCanva || sendingWhatsApp}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {generatingCanva ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0f766e]" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                  )}
                  <span>
                    {generatingCanva ? 'Generando Flyer...' : 'Generar Flyer Canva'}
                  </span>
                </button>
              </div>

              <div className="space-y-1 text-xs">
                <label className="flex w-fit items-center gap-2 font-medium text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal-700"
                    disabled={!availableFlyerId || sendingWhatsApp || generatingCanva}
                    checked={Boolean(availableFlyerId && checkedFlyerId === availableFlyerId)}
                    onChange={event => setCheckedFlyerId(event.target.checked ? availableFlyerId : undefined)}
                    aria-describedby="lead-whatsapp-flyer-help"
                  />
                  Adjuntar flyer de Canva al WhatsApp (opcional)
                </label>
                <p id="lead-whatsapp-flyer-help" className="text-slate-500 dark:text-slate-400">
                  {availableFlyerId
                    ? 'Si lo marcas, el flyer se enviará como imagen con el mensaje debajo.'
                    : 'Selecciona una alternativa y genera su flyer personalizado en Canva para adjuntarlo.'}
                </p>
              </div>

              {canvaResult?.offerKey === selectedOfferKey && canvaResult.previewUrl && (
                <div className="mt-3 flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <img
                      src={canvaResult.previewUrl}
                      alt="Flyer promocional generado"
                      className="h-16 w-16 rounded-lg border border-slate-200 object-cover"
                    />
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white">
                        Flyer Promocional Generado
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {canvaResult.isPersonalized ? `Personalizado con tarifa y sede para ${fullName}`
                          : 'Vista previa sin adjunto de Canva disponible'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={canvaResult.downloadPngUrl || canvaResult.previewUrl}
                      download={`Propuesta_NexoSalud_${lead.nombres || 'Lead'}.png`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar PNG</span>
                    </a>
                    {canvaResult.designUrl && (
                      <a
                        href={canvaResult.designUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3 text-xs font-semibold text-white hover:bg-teal-800"
                      >
                        <span>Abrir en Canva</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              )}
            </section>
            {canAbandon && (
              <>
                <details key={'conversation-panel-'+ultimaSolicitud.id_solicitud} className="group border-t border-slate-200 dark:border-slate-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:px-6 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">4. Conversación de negociación</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Mensajes del paciente y del ChatBot, y actividades internas del Agente Negociador.</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90 dark:text-slate-400" />
                  </summary>
                  <LeadInteraction key={ultimaSolicitud.id_solicitud} requestId={ultimaSolicitud.id_solicitud}
                    onUpdateProposal={updateFromWhatsApp}
                    onChooseSlot={(slot) => {
                      setSelectedServicioId(String(ultimaSolicitud.id_servicio));
                      setSelectedSedeId(String(slot.id_sede));
                      setSelectedProfesionalId(String(slot.id_profesional));
                      setSelectedFranja(slot.inicio < '13:00' ? `Turno Mañana (${openTime} – 01:00 PM)` :
                        slot.inicio < '18:00' ? 'Turno Tarde (01:00 PM – 06:00 PM)' : `Turno Noche (06:00 PM – ${closeTime})`);
                      updateOfferSchedule({ date: slot.fecha, start: slot.inicio, end: slot.fin });
                      setOfferErrors({});
                      toast({ title: 'Horario seleccionado', description: 'Revisa la configuración y añade la propuesta a la mesa.' });
                    }}
                    onAnalysis={(result) => setInteractionAnalysis(result ? { requestId: ultimaSolicitud.id_solicitud, result } : null)} />
                </details>
                <details key={'follow-up-panel-'+ultimaSolicitud.id_solicitud} className="group border-t border-slate-200 dark:border-slate-800">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-5 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 sm:px-6 dark:hover:bg-slate-800 [&::-webkit-details-marker]:hidden">
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">5. Prioridad y seguimiento</span>
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Consulta la prioridad operativa y programa el próximo contacto.</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90 dark:text-slate-400" />
                  </summary>
                  <LeadOperationalFollowUp key={'follow-up-'+ultimaSolicitud.id_solicitud} requestId={ultimaSolicitud.id_solicitud}/>
                </details>
              </>
            )}
          </div>
        </div>


      <Dialog open={!!transferPreview} onOpenChange={(open)=>{if(!open&&!reserving)setTransferPreview(null);}}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar traspaso a PAYER</DialogTitle>
            <DialogDescription>Confirma las condiciones comunicadas y autorizadas por el paciente. Se creará una reserva pendiente, sin registrar pagos.</DialogDescription>
          </DialogHeader>
          {transferPreview && <form onSubmit={confirmTransfer} className="space-y-4">
            <div className="rounded-lg border p-3 text-sm space-y-1">
              <p>{transferPreview.servicio} · S/ {transferPreview.precio}</p>
              <p>{transferPreview.sede} · {transferPreview.profesional}</p>
              <p>{transferPreview.fecha} · {transferPreview.inicio}–{transferPreview.fin} (Lima)</p>
              <p>Precio vigente hasta {new Date(transferPreview.vence).toLocaleString('es-PE',{timeZone:'America/Lima'})}</p>
            </div>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={transferAccepted} onChange={e=>setTransferAccepted(e.target.checked)} disabled={reserving}/>El paciente aceptó expresamente esta propuesta y su importe.</label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={transferAuthorized} onChange={e=>setTransferAuthorized(e.target.checked)} disabled={reserving}/>El paciente autorizó reservar este horario con estas condiciones.</label>
            <label className="block text-sm">Referencia de la confirmación (llamada, visita o mensaje)
              <textarea required maxLength={300} value={transferEvidence} onChange={e=>setTransferEvidence(e.target.value)} disabled={reserving} className="mt-1 w-full rounded border bg-background p-2"/>
            </label>
            {transferError&&<p role="alert" className="text-sm text-red-600">{transferError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" disabled={reserving} onClick={()=>setTransferPreview(null)} className="rounded border px-3 py-2">Cancelar</button>
              <button type="submit" disabled={reserving||!transferAccepted||!transferAuthorized||!transferEvidence.trim()} className="rounded bg-teal-700 px-3 py-2 text-white disabled:opacity-50">{reserving?'Confirmando…':'Confirmar reserva y traspaso'}</button>
            </div>
          </form>}
        </DialogContent>
      </Dialog>

      <Dialog open={abandonOpen} onOpenChange={(open) => { if (!abandoning) setAbandonOpen(open); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar abandono</DialogTitle>
            <DialogDescription>
              La negociación de {fullName} quedará cerrada sin acuerdo.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAbandon} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="lead-abandon-reason" className="block text-sm font-medium">Motivo del cierre</label>
              <textarea
                id="lead-abandon-reason"
                className="w-full rounded-md border bg-background p-2 text-sm"
                rows={3}
                required
                maxLength={400}
                value={abandonReason}
                disabled={abandoning}
                onChange={(event) => setAbandonReason(event.target.value)}
              />
              {abandonError && <p role="alert" className="text-sm text-red-600">{abandonError}</p>}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" disabled={abandoning} onClick={() => setAbandonOpen(false)} className="rounded-md border px-3 py-2 text-sm">Cancelar</button>
              <button type="submit" disabled={abandoning || !abandonReason.trim()} className="rounded-md bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
                {abandoning ? 'Registrando…' : 'Confirmar abandono'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmación de Eliminación de Propuesta */}
      <ConfirmationDialog
        isOpen={!!deletingOptionTarget}
        onClose={() => setDeletingOptionTarget(null)}
        onConfirm={handleConfirmDeleteOption}
        isLoading={isDeletingOption}
        title="¿Remover propuesta comercial de la mesa?"
        description={`Se eliminará la oferta seleccionada (S/ ${Number(
          deletingOptionTarget?.precio_ofrecido || 0
        ).toFixed(2)}).`}
        confirmText="Eliminar Propuesta"
        cancelText="Cancelar"
        variant="destructive"
      />

      {/* Modal para que el Asesor Comercial complete / edite el Perfil de Negociación */}
      <LeadProfileEditModal
        isOpen={isEditProfileModalOpen}
        onClose={() => setIsEditProfileModalOpen(false)}
        lead={lead}
        leadId={leadId}
        options={options}
        onProfileUpdated={handleProfileUpdated}
      />
    </div>
  );
}
