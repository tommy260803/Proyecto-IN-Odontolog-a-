import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { format, addDays, startOfDay, parseISO } from 'date-fns';
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
  RefreshCw,
  Stethoscope,
  MapPin,
  Clock,
  Activity,
  Download,
  ExternalLink,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { leadService } from '../services/lead.service';
import { configService } from '@/modules/config/services/config.service';
import { LeadState } from '@/domain/enums';
import { QUERY_KEYS } from '@/shared/constants';
import { useToast } from '@/shared/hooks/use-toast';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import {
  predictLeadNegotiationStrategy,
  type LeadNegotiationStrategy,
} from '@/shared/services/groqService';
import { renderLeadStatusBadge } from './LeadListView';

interface LeadDetailViewProps {
  leadId: string;
}

const DEFAULT_SEDES = [
  { id_sede: 1, nombre: 'Sede California', direccion: 'Av. Larco 820, Urb. California, Trujillo' },
  { id_sede: 2, nombre: 'Sede El Golf', direccion: 'Av. El Golf 540, Urb. El Golf, Trujillo' },
  {
    id_sede: 3,
    nombre: 'Sede Centro Historico',
    direccion: 'Jr. Pizarro 456, Centro Histórico, Trujillo',
  },
];

const DEFAULT_SERVICIOS = [
  { id_servicio: 1, nombre: 'Evaluación General', Tarifas: [{ precio: 120 }] },
  { id_servicio: 2, nombre: 'Ortodoncia Inicial', Tarifas: [{ precio: 350 }] },
  { id_servicio: 3, nombre: 'Blanqueamiento Dental', Tarifas: [{ precio: 420 }] },
  { id_servicio: 4, nombre: 'Implante Dental', Tarifas: [{ precio: 1850 }] },
];

const DEFAULT_PROFESIONALES = [
  { id_profesional: 1, nombres: 'Carlos', apellidos: 'Mendoza Ríos' },
  { id_profesional: 2, nombres: 'Lucía', apellidos: 'Vargas Paredes' },
  { id_profesional: 3, nombres: 'Andrés', apellidos: 'Salazar Luna' },
];

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
    profesionales: DEFAULT_PROFESIONALES,
    sedes: DEFAULT_SEDES,
    servicios: DEFAULT_SERVICIOS,
    disponibilidades: [],
  });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
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
  const [selectedFranja, setSelectedFranja] = useState('Turno Mañana (08:00 AM – 01:00 PM)');
  const [companyHorario, setCompanyHorario] = useState('');

  const { openTime, closeTime } = useMemo(
    () => parseCompanyHours(companyHorario),
    [companyHorario]
  );

  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [condiciones, setCondiciones] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Edición rápida de tarifa en las opciones del tablero
  const [editingOptionId, setEditingOptionId] = useState<number | string | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Objeciones, WhatsApp, Canva y Estrategia IA
  const [objectionCategory, setObjectionCategory] = useState<'PRECIO' | 'HORARIO' | 'SEDE'>(
    'PRECIO'
  );
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [copiedPitch, setCopiedPitch] = useState(false);
  const [generatingCanva, setGeneratingCanva] = useState(false);
  const [canvaResult, setCanvaResult] = useState<any>(null);
  const [aiStrategy, setAiStrategy] = useState<LeadNegotiationStrategy | null>(null);
  const [loadingStrategy, setLoadingStrategy] = useState(false);

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
          profesionales: optionsData?.profesionales?.length
            ? optionsData.profesionales
            : DEFAULT_PROFESIONALES,
          sedes: optionsData?.sedes?.length ? optionsData.sedes : DEFAULT_SEDES,
          servicios: optionsData?.servicios?.length ? optionsData.servicios : DEFAULT_SERVICIOS,
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
      fetchLeadData();
    }
  }, [leadId]);

  // Pre-carga inteligente al obtener datos
  useEffect(() => {
    if (!lead || !options?.servicios?.length) return;

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

    const existingOpciones = lead.Solicitudes?.[lead.Solicitudes.length - 1]?.Opciones || [];
    if (existingOpciones.length > 0 && selectedOpcion === null) {
      const preselected =
        existingOpciones.find((o: any) => o.seleccionada) || existingOpciones[0];
      setSelectedOpcion(preselected.id_opcion);
    }
  }, [lead, options]);

  // Diagnóstico Predictivo de Negociación (IA / BI)
  const runNegotiationStrategy = async (l = lead) => {
    if (!l) return;
    setLoadingStrategy(true);
    try {
      const strategy = await predictLeadNegotiationStrategy({
        lead: l,
        catalogs: options,
      });
      setAiStrategy(strategy);
    } catch (err) {
      console.warn('Error calculando estrategia de negociación:', err);
    } finally {
      setLoadingStrategy(false);
    }
  };

  useEffect(() => {
    if (lead) {
      runNegotiationStrategy(lead);
    }
  }, [lead?.id_persona]);

  // Vigencia calculada
  const calculatedExpiry = useMemo(() => {
    const today = startOfDay(new Date());
    if (selectedVigencia === '24h') return addDays(today, 1);
    if (selectedVigencia === '48h') return addDays(today, 2);
    if (selectedVigencia === '72h') return addDays(today, 3);
    if (selectedVigencia === '7d') return addDays(today, 7);
    if (selectedVigencia === 'custom' && selectedVigenciaCustom) {
      try {
        return parseISO(selectedVigenciaCustom);
      } catch {
        return addDays(today, 2);
      }
    }
    return addDays(today, 2);
  }, [selectedVigencia, selectedVigenciaCustom]);

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
    } else if (type === 'REGULAR') {
      setCondiciones('');
    }
    if (offerErrors.precio) setOfferErrors((p) => ({ ...p, precio: '' }));
  };

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    if (!selectedServicioId) errors.servicio = 'Selecciona un servicio odontológico.';
    if (!precioOfrecido || isNaN(Number(precioOfrecido)) || Number(precioOfrecido) <= 0) {
      errors.precio = 'Ingresa una tarifa mayor a 0.';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    setOfferErrors({});
    setAddingAlternative(true);
    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
    const expiryStr = format(calculatedExpiry, 'yyyy-MM-dd');
    const fullCondiciones = `[Vigencia: ${getVigenciaLabel(
      selectedVigencia,
      selectedVigenciaCustom
    )} · Vence: ${format(calculatedExpiry, 'dd/MM/yyyy')}] [${selectedFranja}] ${
      condiciones ? `| ${condiciones}` : ''
    }`.trim();

    try {
      await leadService.addAlternative(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        fecha: expiryStr,
        hora_inicio: selectedFranja.includes('Tarde') ? '14:00' : '09:00',
        hora_fin: selectedFranja.includes('Tarde') ? '19:00' : '13:00',
        id_profesional:
          selectedProfesionalId && selectedProfesionalId !== 'ALL_PROFESSIONALS'
            ? selectedProfesionalId
            : undefined,
        id_sede:
          selectedSedeId && selectedSedeId !== 'ALL_SEDES' ? selectedSedeId : undefined,
        precio_ofrecido: precioOfrecido,
        condiciones: fullCondiciones,
        // Campos adicionales para modo mock/fallback
        service:
          options.servicios?.find((s: any) => String(s.id_servicio) === selectedServicioId)
            ?.nombre || 'Evaluación General',
        professional:
          options.profesionales?.find(
            (p: any) => String(p.id_profesional) === selectedProfesionalId
          )?.apellidos || 'Staff Colegiado',
        branch:
          options.sedes?.find((s: any) => String(s.id_sede) === selectedSedeId)?.nombre ||
          'Sede California',
        date: expiryStr,
        time: '09:00',
        price: Number(precioOfrecido),
        conditions: fullCondiciones,
      });
      fetchLeadData();
      setCondiciones('');
      toast({
        title: 'Propuesta comercial añadida',
        description: 'La oferta fue incorporada a la mesa de negociación.',
      });
    } catch {
      toast({
        title: 'Error al registrar propuesta',
        description: 'No se pudo guardar la alternativa comercial.',
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
    if (!selectedOpcion) {
      toast({
        title: 'Selecciona una propuesta comercial',
        description: 'Elige una de las ofertas activas en la mesa antes de cerrar el trato.',
        variant: 'destructive',
      });
      return;
    }

    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
    setReserving(true);
    try {
      await leadService.reserve(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud || 1,
        id_opcion: selectedOpcion,
      });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      toast({
        title: 'Trato cerrado · Transferido a PAYER',
        description: 'La orden de cobro ha sido generada en el módulo PAYER.',
      });
      navigate('/payer');
    } catch {
      toast({
        title: 'Error al confirmar el cierre',
        description: 'No se pudo procesar el pase a la etapa PAYER.',
        variant: 'destructive',
      });
    } finally {
      setReserving(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!lead) return <ErrorState message="No se encontró el expediente de negociación LEAD." />;

  const fullName =
    `${lead.nombres || ''} ${lead.apellidos || ''}`.trim() || 'Paciente en Negociación';
  const pref = lead.Preferencias?.[0];
  const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
  const opciones: any[] = ultimaSolicitud?.Opciones || [];
  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);

  const generateWhatsAppMessage = () => {
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
      const fechaVigencia = selectedOptData.Disponibilidad?.fecha?.split('T')[0] || 'Vigente';

      return (
        `Hola ${patientFirstName}, te saludamos de NexoSalud Dental.\n\n` +
        `Hemos preparado tu propuesta comercial para ${reqServicio}:\n` +
        `• Tarifa Preferencial: S/ ${precio}\n` +
        `• Vigencia: Hasta el ${fechaVigencia}\n` +
        `• Sede: ${sede}\n` +
        `• Especialista: ${doctor}\n\n` +
        `Puedes confirmar tu pre-reserva en línea aquí:\n` +
        `https://nexosalud.pe/pre-reserva/${leadId}\n\n` +
        `Quedamos atentos para asegurar tu turno.`
      );
    }

    return (
      `Hola ${patientFirstName}, te escribimos de NexoSalud Dental respecto a tu solicitud de ${reqServicio}. ` +
      `Contamos con disponibilidad preferencial en ${pref?.sede_preferida || 'nuestras sedes'} para esta semana. ` +
      `¿En qué turno te gustaría agendar tu cita?`
    );
  };

  const handleSendWhatsApp = () => {
    const rawPhone = String(lead?.numero || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    const message = generateWhatsAppMessage();
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const email = lead?.email || '';
    const subject = encodeURIComponent(
      `Propuesta Comercial Odontológica — NexoSalud (${patientFirstName})`
    );
    const body = encodeURIComponent(generateWhatsAppMessage());
    window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
  };

  const handleCopyWhatsApp = () => {
    navigator.clipboard.writeText(generateWhatsAppMessage());
    setCopiedWhatsApp(true);
    toast({
      title: 'Propuesta copiada',
      description: 'El mensaje fue copiado al portapapeles.',
    });
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  const handleGenerateCanva = async () => {
    setGeneratingCanva(true);
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
        success: true,
        designUrl: canva?.designUrl,
        previewUrl: canva?.previewUrl,
        downloadPngUrl: canva?.downloadPngUrl || canva?.previewUrl,
      });

      toast({
        title: 'Flyer generado con Canva Connect',
        description: 'La pieza gráfica está lista para previsualizar o descargar.',
      });
    } catch {
      toast({
        title: 'Sesión de Canva requerida',
        description: 'Haz clic en "Conectar Canva" en la cabecera para vincular tu cuenta.',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCanva(false);
    }
  };

  const closeProbability = aiStrategy?.leadScore ?? (opciones.length > 0 ? 84 : 68);

  return (
    <div className="w-full max-w-none space-y-6">
      {/* Cabecera Fija de la Mesa de Negociación */}
      <div className="sticky top-0 z-20 -mx-3 sm:-mx-6 lg:-mx-8 px-3 sm:px-6 lg:px-8 py-3.5 sm:py-4 bg-[#f8fafc]/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
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
                selectedOpcion ? LeadState.ALTERNATIVE_SELECTED : LeadState.IN_NEGOTIATION
              )}
              <span className="font-mono text-xs text-slate-400 dark:text-slate-500 tabular-nums">
                LEAD #{lead.id_persona || leadId}
                {lead.dni ? ` · DNI ${lead.dni}` : ''}
              </span>
            </div>
          </div>

          {/* Barra de Acciones Fijas Arriba */}
          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={handleReserveAndConvert}
              disabled={reserving || !selectedOpcion}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-3.5 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] disabled:opacity-50 cursor-pointer"
            >
              {reserving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Procesando...</span>
                </>
              ) : (
                <>
                  <span>Cerrar Trato (Pasar a PAYER)</span>
                  <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
                </>
              )}
            </button>

            <Link
              to={`/pre-reserva/${leadId}`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
              <span>Pre-Reserva</span>
            </Link>

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

      {/* Arquitectura a 2 Columnas (Layout 65/35 -> 8 cols / 4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
        {/* COLUMNA IZQUIERDA (65%): Description List + Mesa de Negociación */}
        <div className="lg:col-span-8 space-y-6">
          {/* Bloque 1: Contexto del Paciente en Description List Limpia */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            <div className="border-b border-slate-200/80 dark:border-slate-800 px-6 py-4">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                Expediente de Solicitud y Contexto del Paciente
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Información consolidada desde la etapa BUYER para estructurar la oferta comercial.
              </p>
            </div>

            <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">Paciente</dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                      {fullName}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Teléfono / WhatsApp
                    </dt>
                    <dd className="mt-1 font-mono font-medium text-slate-900 dark:text-white tabular-nums flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                      <span>{lead.numero ? `+51 ${lead.numero}` : 'No registrado'}</span>
                    </dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Correo Electrónico
                    </dt>
                    <dd className="mt-1 text-slate-900 dark:text-white truncate">
                      {lead.email || 'No registrado'}
                    </dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Canal de Captación
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white">
                      {lead.Interacciones?.[0]?.Canal?.nombre || 'Portal Web'}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="px-6 py-4">
                <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3 text-xs">
                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Tratamiento Solicitado
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Stethoscope className="h-3.5 w-3.5 text-[#0f766e]" strokeWidth={1.75} />
                      <span>
                        {ultimaSolicitud?.Servicio?.nombre || 'Evaluación Odontológica'}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Sede Preferida
                    </dt>
                    <dd className="mt-1 font-medium text-slate-900 dark:text-slate-400 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-400" strokeWidth={1.75} />
                      <span className="text-slate-900 dark:text-white">
                        {pref?.sede_preferida || 'Sede California'}
                      </span>
                    </dd>
                  </div>

                  <div>
                    <dt className="font-medium text-slate-500 dark:text-slate-400">
                      Frecuencia de Consulta
                    </dt>
                    <dd className="mt-1 font-mono text-slate-900 dark:text-white tabular-nums">
                      {(lead.Solicitudes?.length || 1) > 1
                        ? `${lead.Solicitudes.length} consultas registradas`
                        : '1ª solicitud activa'}
                    </dd>
                  </div>

                  {ultimaSolicitud?.motivo && (
                    <div className="sm:col-span-3">
                      <dt className="font-medium text-slate-500 dark:text-slate-400">
                        Motivo Concreto Declarado
                      </dt>
                      <dd className="mt-1.5 border-l-2 border-[#0f766e] bg-slate-50/70 dark:bg-slate-800/50 pl-3 py-2 text-xs text-slate-800 dark:text-slate-200">
                        {ultimaSolicitud.motivo}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </div>
          </div>

          {/* Bloque 2: Configuración de Oferta Comercial y Tablero de Propuestas */}
          <div className="divide-y divide-slate-200/80 dark:divide-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden">
            {/* Sección 1: Configurar Nueva Propuesta Comercial */}
            <section className="p-6 space-y-5">
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
                  Vigencia hasta: {format(calculatedExpiry, 'dd/MM/yyyy')}
                </span>
              </div>

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
                    const active = selectedVigencia === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setSelectedVigencia(v.id as any)}
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
                {selectedVigencia === 'custom' && (
                  <div className="pt-2">
                    <input
                      type="date"
                      value={selectedVigenciaCustom}
                      onChange={(e) => setSelectedVigenciaCustom(e.target.value)}
                      className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs text-slate-800 dark:text-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Grid de Servicio, Sede y Especialista */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Servicio Ofertado
                  </label>
                  <select
                    value={selectedServicioId}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSelectedServicioId(val);
                      const serv = options.servicios?.find(
                        (s: any) => String(s.id_servicio) === val
                      );
                      const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                      setPrecioOfrecido(baseP.toFixed(2));
                    }}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
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
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Sede Clínica
                  </label>
                  <select
                    value={selectedSedeId}
                    onChange={(e) => setSelectedSedeId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
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
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Especialista Sugerido
                  </label>
                  <select
                    value={selectedProfesionalId}
                    onChange={(e) => setSelectedProfesionalId(e.target.value)}
                    className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs text-slate-900 dark:text-white focus:border-[#0f766e] focus:outline-none"
                  >
                    <option value="ALL_PROFESSIONALS">Staff Colegiado Disponible</option>
                    {options.profesionales?.map((p: any) => (
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
                        onClick={() => setSelectedFranja(slot.full)}
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
                      onChange={(e) => setPrecioOfrecido(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 font-mono text-xs font-semibold text-slate-900 dark:text-white tabular-nums focus:border-[#0f766e] focus:outline-none"
                    />
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

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleAddAlternative}
                    disabled={addingAlternative}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    <span>
                      {addingAlternative
                        ? 'Añadiendo propuesta...'
                        : 'Añadir Propuesta a la Mesa'}
                    </span>
                  </button>
                </div>
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
                              Vence: {opt.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
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
            <section className="p-6 space-y-4">
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

              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                {generateWhatsAppMessage()}
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white hover:bg-teal-800 transition-colors cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>Enviar por WhatsApp</span>
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
                  disabled={generatingCanva}
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

              {canvaResult?.previewUrl && (
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
                        Personalizado con tarifa y sede para {fullName}
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
          </div>
        </div>

        {/* COLUMNA DERECHA (35%): Tarjeta de "Diagnóstico Comercial / BI" */}
        <div className="lg:col-span-4 space-y-5">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 p-5 shadow-2xs space-y-5">
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-2 border-b border-slate-200/80 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Inteligencia de Cierre
                </span>
                <h2 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Activity className="h-4 w-4 text-[#0f766e]" strokeWidth={1.75} />
                  <span>Diagnóstico de Negociación / BI</span>
                </h2>
              </div>

              <button
                type="button"
                onClick={() => runNegotiationStrategy(lead)}
                disabled={loadingStrategy}
                className="inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3 w-3 ${loadingStrategy ? 'animate-spin' : ''}`} />
                <span>{loadingStrategy ? 'Calculando' : 'Actualizar'}</span>
              </button>
            </div>

            {/* Probabilidad de Cierre */}
            <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Probabilidad Estimada de Cierre
                </span>
                <span className="font-mono text-2xl font-bold tabular-nums text-slate-900 dark:text-white">
                  {closeProbability}%
                </span>
              </div>

              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-[#0f766e] transition-all duration-300"
                  style={{ width: `${closeProbability}%` }}
                />
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-slate-500">Descuento óptimo sugerido:</span>
                <span className="font-mono font-semibold text-[#0f766e] dark:text-teal-400">
                  {aiStrategy?.suggestedDiscountPct ?? 15}% OFF
                </span>
              </div>
            </div>

            {/* Dictamen Comercial con Borde Lateral de 2px */}
            <div className="space-y-2.5">
              <div className="border-l-2 border-[#0f766e] bg-white dark:bg-slate-900 px-3.5 py-2.5 rounded-r-lg border-y border-r border-slate-200/70 dark:border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    Argumento de Cierre Sugerido
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const pitch =
                        aiStrategy?.persuasiveSalesPitch ||
                        'Ofrecer reserva prioritaria con evaluación digital 3D incluida y tarifa congelada por 48 horas.';
                      navigator.clipboard.writeText(pitch);
                      setCopiedPitch(true);
                      setTimeout(() => setCopiedPitch(false), 1800);
                    }}
                    className="text-[10px] font-medium text-[#0f766e] hover:underline cursor-pointer"
                  >
                    {copiedPitch ? 'Copiado' : 'Copiar pitch'}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                  {aiStrategy?.strategyReason ||
                    aiStrategy?.persuasiveSalesPitch ||
                    'Destaca la evaluación diagnóstica integral en la sede seleccionada y congela la tarifa promocional por 48 horas.'}
                </p>
              </div>

              {/* Manejo de Objeciones por Categoría */}
              <div className="rounded-lg border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    Protocolo de Objeciones
                  </span>
                  <div className="inline-flex rounded-md border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
                    {(['PRECIO', 'HORARIO', 'SEDE'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setObjectionCategory(cat)}
                        className={`rounded px-2 py-0.5 text-[10px] font-semibold transition-colors cursor-pointer ${
                          objectionCategory === cat
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-2xs'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>

                {objectionCategory === 'PRECIO' && (
                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <p>
                      Si el paciente manifiesta restricción presupuestaria, aplica el descuento de campaña (-20%) con vigencia de 24 horas.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        applyQuickDiscount(20, 'CAMPANA');
                        setSelectedVigencia('24h');
                      }}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-[#0f766e] hover:bg-teal-50/50 cursor-pointer"
                    >
                      Aplicar -20% Flash (24h)
                    </button>
                  </div>
                )}

                {objectionCategory === 'HORARIO' && (
                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <p>
                      Habilita flexibilidad de turno para que el paciente confirme la hora exacta al validar su reserva.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedFranja(
                          'Horario Flexible (A elección del paciente al confirmar)'
                        )
                      }
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-[#0f766e] hover:bg-teal-50/50 cursor-pointer"
                    >
                      Asignar Horario Flexible
                    </button>
                  </div>
                )}

                {objectionCategory === 'SEDE' && (
                  <div className="space-y-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <p>
                      Permite que la tarifa promocional sea válida en cualquiera de las 3 sedes clínicas de Trujillo.
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedSedeId('ALL_SEDES')}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-[#0f766e] hover:bg-teal-50/50 cursor-pointer"
                    >
                      Habilitar Multisede
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Acción Directa: Iniciar Chat de WhatsApp Clínico */}
            <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800 space-y-2">
              <button
                type="button"
                onClick={handleSendWhatsApp}
                className="flex h-9.5 w-full items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 text-xs font-semibold text-white shadow-2xs transition-all hover:bg-teal-800 active:scale-[0.99] cursor-pointer"
              >
                <MessageSquare className="h-3.5 w-3.5" strokeWidth={2} />
                <span>Contactar Paciente por WhatsApp</span>
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
              <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
                Incluye enlace de pre-reserva y condiciones vigentes
              </p>
            </div>
          </div>
        </div>
      </div>

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
    </div>
  );
}
