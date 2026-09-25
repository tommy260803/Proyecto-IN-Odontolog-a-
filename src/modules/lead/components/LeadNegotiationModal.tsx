import React, { useEffect, useMemo, useState } from 'react';
import {
  format,
  addDays,
  startOfDay,
  parseISO,
  differenceInYears,
} from 'date-fns';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import {
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  Plus,
  ArrowRight,
  Stethoscope,
  Mail,
  Phone,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  DollarSign,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Sparkles,
  Zap,
  Tag,
  TrendingDown,
  Award,
  Copy,
  ChevronDown,
  ChevronRight,
  Building2,
  Activity,
  MessageCircle,
  CheckCheck,
  Timer,
  Settings2,
} from 'lucide-react';

interface LeadNegotiationModalProps {
  leadId: string | number | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  try {
    return differenceInYears(new Date(), parseISO(birthDate));
  } catch {
    return null;
  }
}

// ── Estado de carga ──────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-400">
      <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      <p className="text-xs font-medium">Cargando mesa de negociación inteligente...</p>
    </div>
  );
}

// ── Estado de error ──────────────────────────────────────────────────────────
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2 text-rose-500">
      <p className="text-xs font-medium">{message}</p>
    </div>
  );
}

// ── Fila de dato con icono ───────────────────────────────────────────────────
function DataRow({ label, value, icon }: { label: string; value: React.ReactNode; icon?: React.ReactNode }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
        {label}
      </span>
      <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800 dark:text-slate-200">
        {icon && <span className="text-slate-400 dark:text-slate-500 shrink-0">{icon}</span>}
        <span>{value}</span>
      </div>
    </div>
  );
}

// ── Chip para condiciones booleanas (Sí/No) ──────────────────────────────────
function CondChip({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  const isYes = value.toLowerCase().startsWith('sí') || value.toLowerCase().startsWith('si');
  return (
    <div className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs border ${isYes
      ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200/70 dark:border-rose-800/50 text-rose-700 dark:text-rose-400'
      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200/70 dark:border-slate-700/60 text-slate-600 dark:text-slate-400'
      }`}>
      <span className="font-medium">{label}</span>
      <span className={`font-bold ${isYes ? 'text-rose-600 dark:text-rose-300' : 'text-slate-500 dark:text-slate-400'}`}>{value}</span>
    </div>
  );
}

// ── Sección Acordeón ─────────────────────────────────────────────────────────
function AccordionSection({ title, subtitle, icon, children, defaultOpen = false }: {
  title: string; subtitle: string; icon: React.ReactNode;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full text-left"
      >
        <CardHeader className="pb-3 pt-4 px-4 bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-start gap-2">
              <span className="text-slate-500 dark:text-slate-400 mt-0.5 shrink-0">{icon}</span>
              <div>
                <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</CardTitle>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">{subtitle}</p>
              </div>
            </div>
            <span className="text-slate-400 dark:text-slate-500 shrink-0 ml-2">
              {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </span>
          </div>
        </CardHeader>
      </button>
      {open && (
        <CardContent className="p-4 bg-white dark:bg-slate-900/80 space-y-3 border-t border-slate-200/70 dark:border-slate-700/80 animate-in slide-in-from-top-1 duration-150">
          {children}
        </CardContent>
      )}
    </Card>
  );
}

// ── Sección siempre abierta (Datos Personales) ───────────────────────────────
function StaticSection({ title, subtitle, icon, children }: {
  title: string; subtitle: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
      <CardHeader className="pb-3 pt-4 px-4 bg-white dark:bg-slate-800/60 border-b border-slate-200/70 dark:border-slate-700/80">
        <div className="flex items-start gap-2">
          <span className="text-slate-500 dark:text-slate-400 mt-0.5 shrink-0">{icon}</span>
          <div>
            <CardTitle className="text-xs font-bold text-slate-800 dark:text-slate-100">{title}</CardTitle>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-normal">{subtitle}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 bg-white dark:bg-slate-900/80 space-y-3">{children}</CardContent>
    </Card>
  );
}

export function LeadNegotiationModal({ leadId, isOpen, onClose }: LeadNegotiationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [lead, setLead] = useState<any>(null);
  const [catalogs, setCatalogs] = useState<any>({ profesionales: [], sedes: [], servicios: [], disponibilidades: [] });
  const [loading, setLoading] = useState(true);

  // Form oferta comercial / promoción
  const [altServicioId, setAltServicioId] = useState('');
  const [altProfesionalId, setAltProfesionalId] = useState('');
  const [altSedeId, setAltSedeId] = useState('');
  const [altVigencia, setAltVigencia] = useState<'24h' | '48h' | '72h' | '7d' | 'custom'>('48h');
  const [altVigenciaCustom, setAltVigenciaCustom] = useState('');
  const [altFranja, setAltFranja] = useState('Horario Flexible (A elección del paciente al confirmar)');
  const [altPrecio, setAltPrecio] = useState('150.00');
  const [altCondiciones, setAltCondiciones] = useState('');
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  // Opciones del tablero
  const [selectedOpcion, setSelectedOpcion] = useState<number | null>(null);
  const [reserving, setReserving] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Estados para Copiloto de Objeciones y Seguimiento WhatsApp (Actividades 3 y 4)
  const [objectionCategory, setObjectionCategory] = useState<'PRECIO' | 'HORARIO' | 'SEDE'>('PRECIO');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);

  const fetchData = () => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId.toString()),
      leadService.getAvailabilityOptions(),
    ])
      .then(([leadData, catData]) => {
        setLead(leadData);
        setCatalogs(catData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && leadId) fetchData();
  }, [isOpen, leadId]);

  // Pre-carga inteligente al obtener datos del lead y catálogos
  useEffect(() => {
    if (!lead || !catalogs || !catalogs.servicios?.length) return;

    // 1. Pre-seleccionar servicio solicitado
    let initialServicioId = altServicioId;
    const reqServicio = lead.Solicitudes?.[0]?.Servicio;
    const reqServicioId = lead.Solicitudes?.[0]?.id_servicio;
    if (!initialServicioId) {
      if (reqServicioId) {
        initialServicioId = reqServicioId.toString();
      } else if (reqServicio?.id_servicio) {
        initialServicioId = reqServicio.id_servicio.toString();
      } else if (reqServicio?.nombre) {
        const found = catalogs.servicios.find((s: any) =>
          s.nombre.toLowerCase().includes(reqServicio.nombre.toLowerCase())
        );
        if (found) initialServicioId = found.id_servicio.toString();
      }
      if (!initialServicioId && catalogs.servicios.length > 0) {
        initialServicioId = catalogs.servicios[0].id_servicio.toString();
      }
      if (initialServicioId) setAltServicioId(initialServicioId);
    }

    // 2. Pre-seleccionar sede preferida
    const prefSede = lead.Preferencias?.[0]?.sede_preferida;
    if (prefSede && !altSedeId) {
      const matchSede = catalogs.sedes?.find((s: any) =>
        s.nombre.toLowerCase().includes(prefSede.toLowerCase()) ||
        prefSede.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (matchSede) setAltSedeId(matchSede.id_sede.toString());
    }

    // 3. Pre-seleccionar profesional preferido
    const prefProf = lead.Preferencias?.[0]?.profesional_preferido;
    if (prefProf && !altProfesionalId) {
      const matchProf = catalogs.profesionales?.find((p: any) =>
        p.apellidos.toLowerCase().includes(prefProf.toLowerCase()) ||
        prefProf.toLowerCase().includes(p.apellidos.toLowerCase()) ||
        p.nombres.toLowerCase().includes(prefProf.toLowerCase())
      );
      if (matchProf) setAltProfesionalId(matchProf.id_profesional.toString());
    }

    // 4. Determinar precio de lista oficial y descuento inteligente
    const activeServicio = catalogs.servicios?.find((s: any) => s.id_servicio.toString() === initialServicioId);
    const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
    if (altPrecio === '150.00' || !altPrecio) {
      setAltPrecio(officialPrice.toFixed(2));
    }
  }, [lead, catalogs]);

  // Cálculo en vivo de la fecha límite de vigencia de la oferta comercial
  const calculatedExpiry = useMemo(() => {
    const today = startOfDay(new Date());
    if (altVigencia === '24h') return addDays(today, 1);
    if (altVigencia === '48h') return addDays(today, 2);
    if (altVigencia === '72h') return addDays(today, 3);
    if (altVigencia === '7d') return addDays(today, 7);
    if (altVigencia === 'custom' && altVigenciaCustom) {
      try {
        return parseISO(altVigenciaCustom);
      } catch {
        return addDays(today, 2);
      }
    }
    return addDays(today, 2);
  }, [altVigencia, altVigenciaCustom]);

  const getVigenciaLabel = (vig: string, customVal: string) => {
    if (vig === '24h') return '24 horas (Oferta Flash)';
    if (vig === '48h') return '48 horas (Recomendado)';
    if (vig === '72h') return '72 horas (3 días)';
    if (vig === '7d') return '7 días (Semanal)';
    return `Hasta ${customVal || 'Personalizado'}`;
  };

  // Precio de lista oficial del servicio actualmente seleccionado
  const currentOfficialPrice = useMemo(() => {
    const s = catalogs.servicios?.find((item: any) => item.id_servicio.toString() === altServicioId);
    return Number(s?.Tarifas?.[0]?.precio || 180);
  }, [catalogs.servicios, altServicioId]);

  const numericOfferPrice = useMemo(() => {
    const val = parseFloat(altPrecio);
    return isNaN(val) ? 0 : val;
  }, [altPrecio]);

  const discountMetrics = useMemo(() => {
    const saving = Math.max(0, currentOfficialPrice - numericOfferPrice);
    const pct = currentOfficialPrice > 0 ? Math.round((saving / currentOfficialPrice) * 100) : 0;
    return { saving, pct };
  }, [currentOfficialPrice, numericOfferPrice]);

  const applyQuickDiscount = (pct: number, type?: 'CAMPANA' | 'REGULAR') => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setAltPrecio(discounted.toFixed(2));
    if (type === 'CAMPANA') {
      setAltCondiciones('Campaña Promocional Especial por tiempo limitado');
    } else if (type === 'REGULAR') {
      setAltCondiciones('');
    }
    if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
  };

  const resetAltForm = () => {
    setAltServicioId('');
    setAltProfesionalId('');
    setAltSedeId('');
    setAltVigencia('48h');
    setAltVigenciaCustom('');
    setAltFranja('Horario Flexible (A elección del paciente al confirmar)');
    setAltPrecio('150.00');
    setAltCondiciones('');
    setOfferErrors({});
  };

  const handleAddAlternative = async () => {
    if (!leadId) return;
    const errors: Record<string, string> = {};
    if (!altServicioId) {
      errors.servicio = 'Selecciona un servicio para la promoción.';
    }
    if (!altPrecio || isNaN(Number(altPrecio)) || Number(altPrecio) <= 0) {
      errors.precio = 'Ingresa una tarifa válida mayor a 0';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    setOfferErrors({});
    setAddingAlternative(true);
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    const expiryStr = format(calculatedExpiry, 'yyyy-MM-dd');
    const fullCondiciones = `[Vigencia: ${getVigenciaLabel(altVigencia, altVigenciaCustom)} - Vence: ${format(calculatedExpiry, 'dd/MM/yyyy')}] [Franja: ${altFranja}] ${altCondiciones ? `| ${altCondiciones}` : ''}`.trim();

    try {
      await leadService.addAlternative(leadId.toString(), {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        fecha: expiryStr,
        hora_inicio: altFranja.includes('Tarde') ? '14:00' : '09:00',
        hora_fin: altFranja.includes('Tarde') ? '19:00' : '13:00',
        id_profesional: (altProfesionalId && altProfesionalId !== 'ALL_PROFESSIONALS') ? altProfesionalId : undefined,
        id_sede: (altSedeId && altSedeId !== 'ALL_SEDES') ? altSedeId : undefined,
        precio_ofrecido: altPrecio,
        condiciones: fullCondiciones,
      });
      fetchData();
      resetAltForm();
      toast({ title: '¡Promoción Registrada! 🎉', description: 'La oferta comercial con vigencia activa ha sido añadida al tablero.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo añadir la oferta comercial.', variant: 'destructive' });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion || !leadId) {
      toast({ title: 'Atención', description: 'Selecciona una alternativa del tablero.' });
      return;
    }
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    setReserving(true);
    try {
      await leadService.reserve(leadId.toString(), { id_solicitud: ultimaSolicitud?.id_solicitud || 1, id_opcion: selectedOpcion });
      toast({ title: '¡Trato Cerrado! 🎉', description: 'El paciente pasa a la etapa PAYER.' });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally {
      setReserving(false);
    }
  };

  const handleSaveEdit = async (e: React.MouseEvent, id_opcion: number) => {
    e.stopPropagation();
    if (!editingPrice || isNaN(Number(editingPrice)) || Number(editingPrice) <= 0) {
      toast({ title: 'Precio Inválido', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      await leadService.updateAlternative(id_opcion, { precio_ofrecido: editingPrice });
      setEditingOptionId(null);
      fetchData();
      toast({ title: 'Tarifa Actualizada', description: `S/ ${Number(editingPrice).toFixed(2)}` });
    } catch {
      toast({ title: 'Error', description: 'Error al actualizar.', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDeleteOption = async () => {
    if (!deletingOptionTarget) return;
    setIsDeletingOption(true);
    try {
      await leadService.deleteAlternative(deletingOptionTarget.id_opcion);
      if (selectedOpcion === deletingOptionTarget.id_opcion) setSelectedOpcion(null);
      fetchData();
      toast({ title: 'Alternativa Removida' });
    } catch {
      toast({ title: 'Error', variant: 'destructive' });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  if (!isOpen || !leadId) return null;

  const pref = lead?.Preferencias?.[0];
  const datAcad = lead?.DatosAcademicos?.[0];
  const datLab = lead?.DatosLaborales?.[0];
  const saludOdonto = lead?.SaludOdontologica?.[0];
  const interaccionReciente = lead?.Interacciones?.[0];
  const ultimaSolicitud = lead?.Solicitudes?.[0];
  const edad = calcAge(lead?.fecha_nacimiento);
  const opciones = ultimaSolicitud?.Opciones || [];

  // Variables de inteligencia comercial
  const isStudent = datAcad?.aplica === true || Boolean(datAcad?.universidad);
  const dolorLevel = saludOdonto?.nivel_dolor?.toLowerCase() || '';
  const hasUrgentPain = dolorLevel.includes('intenso') || dolorLevel.includes('moderado');

  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);

  const generateWhatsAppMessage = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';

    if (selectedOptData) {
      const precio = Number(selectedOptData.precio_ofrecido).toFixed(2);
      const sede = selectedOptData.Disponibilidad?.Sede?.nombre || 'Sede Principal';
      const doctor = selectedOptData.Disponibilidad?.Profesional?.apellidos ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}` : 'Especialistas colegiados';
      const fechaVigencia = selectedOptData.Disponibilidad?.fecha?.split('T')[0] || '';
      const cond = selectedOptData.condiciones ? `\n📌 *Detalles de la oferta:* ${selectedOptData.condiciones}` : '';

      return `¡Hola ${patientFirstName}! 👋 Te saludamos de NexoSalud Dental.\n\n` +
        `Diseñamos una *Oferta Comercial Exclusiva* para tu atención de *${reqServicio}*:\n\n` +
        `💰 *Tarifa Promocional:* S/ ${precio}\n` +
        `⏳ *Margen de Vigencia:* Válido hasta el ${fechaVigencia}\n` +
        `📍 *Sede:* ${sede}\n` +
        `👨‍⚕️ *Atención:* ${doctor}\n` +
        `${cond}\n\n` +
        `Para asegurar este precio con descuento, puedes separar tu turno en el siguiente enlace:\n` +
        `🔗 *https://nexosalud.pe/pre-reserva/${leadId}*\n\n` +
        `¡Quedamos atentos a tu confirmación para brindarte la mejor atención! ✨`;
    }

    if (opciones.length > 0) {
      const resumenOpciones = opciones.map((o: any, idx: number) => {
        const p = Number(o.precio_ofrecido).toFixed(2);
        const f = o.Disponibilidad?.fecha?.split('T')[0] || '';
        return `• *Propuesta ${idx + 1}:* S/ ${p} (Válido hasta ${f}) — Sede ${o.Disponibilidad?.Sede?.nombre || 'Principal'}${o.condiciones ? ` [${o.condiciones}]` : ''}`;
      }).join('\n');

      return `¡Hola ${patientFirstName}! 👋 De NexoSalud Dental.\n\n` +
        `Tenemos disponibles las siguientes promociones personalizadas para tu servicio de *${reqServicio}*:\n\n` +
        `${resumenOpciones}\n\n` +
        `\n` +
        `¿Cuál de estas alternativas se acomoda mejor a ti? Indícanos tu DNI para formalizar tu pre-reserva. 😊`;
    }

    return `¡Hola ${patientFirstName}! 👋 Te saludamos de NexoSalud Dental. Vemos tu interés en el servicio de *${reqServicio}*. Tenemos promociones activas con descuentos preferenciales para esta semana.\n\n¿Te gustaría conocer la propuesta comercial? Quedamos atentos a tus comentarios. ✨`;
  };

  const handleSendWhatsApp = () => {
    const rawPhone = (lead?.numero || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 9 ? `51${rawPhone}` : rawPhone;
    const message = generateWhatsAppMessage();
    const url = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    toast({ title: 'WhatsApp Abierto', description: 'Redirigiendo a WhatsApp con la propuesta comercial.' });
  };

  const handleSendEmail = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const email = lead?.email || '';
    const subject = encodeURIComponent(`Propuesta Comercial Exclusiva - NexoSalud Dental para ${patientFirstName}`);
    const body = encodeURIComponent(generateWhatsAppMessage().replace(/\*/g, ''));
    const mailtoUrl = email ? `mailto:${email}?subject=${subject}&body=${body}` : `mailto:?subject=${subject}&body=${body}`;
    window.open(mailtoUrl, '_blank');
    toast({ title: 'Correo Preparado', description: 'Se abrió tu cliente de correo con la propuesta comercial.' });
  };

  const handleCopyWhatsApp = () => {
    const message = generateWhatsAppMessage();
    navigator.clipboard.writeText(message);
    setCopiedWhatsApp(true);
    toast({ title: '¡Mensaje Copiado!', description: 'Texto copiado al portapapeles para enviar por chat o correo.' });
    setTimeout(() => setCopiedWhatsApp(false), 2000);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[92vh] sm:max-h-[95vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">

        {/* ── Header ─────────────────────────────────────────── */}
        <div className="p-5 pb-4 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 ring-4 ring-teal-50/70 dark:ring-teal-950/40 border border-teal-200/60 dark:border-teal-800/60">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Mesa de Negociación (LEAD)
                </DialogTitle>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-normal">
                  Configura ofertas comerciales con margen de vigencia activo y cierra el trato con el paciente.
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {loading ? (
            <div className="p-6"><LoadingState /></div>
          ) : !lead ? (
            <div className="p-6"><ErrorState message="No se encontró la oportunidad (LEAD)." /></div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-slate-200/80 dark:divide-slate-800 min-h-full">

              {/* ══ COLUMNA IZQUIERDA: Información del paciente ══ */}
              <div className="p-4 space-y-3 overflow-y-auto no-scrollbar">

                {/* 1. Datos personales — siempre abierto */}
                <StaticSection
                  title="Datos Personales"
                  subtitle="Identificación general del individuo"
                  icon={<User className="h-3.5 w-3.5" />}
                >
                  <DataRow label="Nombre completo" value={`${lead.nombres} ${lead.apellidos}`} />
                  <div className="grid grid-cols-2 gap-3">
                    {edad && <DataRow label="Edad" icon={<Activity className="h-3.5 w-3.5" />} value={`${edad} años`} />}
                    {lead.zona && <DataRow label="Ciudad" icon={<MapPin className="h-3.5 w-3.5" />} value={lead.zona} />}
                  </div>
                  {lead.numero && <DataRow label="Teléfono" icon={<Phone className="h-3.5 w-3.5" />} value={lead.numero} />}
                  {lead.email && <DataRow label="Correo electrónico" icon={<Mail className="h-3.5 w-3.5" />} value={lead.email} />}
                </StaticSection>

                {/* 2. Gustos y preferencias — acordeón */}
                <AccordionSection
                  title="Gustos y Preferencias"
                  subtitle="Condiciones preferidas para comunicación y acuerdos"
                  icon={<Settings2 className="h-3.5 w-3.5" />}
                  defaultOpen={true}
                >
                  {!pref ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin preferencias registradas</p>
                  ) : (
                    <>
                      {pref.Horario && (
                        <DataRow
                          label="Horario preferido"
                          icon={<Clock className="h-3.5 w-3.5" />}
                          value={`${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][pref.Horario.dia_semana] || `Día ${pref.Horario.dia_semana}`} (${String(pref.Horario.hora_inicio).substring(11, 16)} – ${String(pref.Horario.hora_fin).substring(11, 16)})`}
                        />
                      )}
                      {pref.Canal && <DataRow label="Medio de comunicación preferido" icon={<MessageSquare className="h-3.5 w-3.5" />} value={pref.Canal.nombre} />}
                      {pref.Modalidad && <DataRow label="Modalidad preferida" icon={<Building2 className="h-3.5 w-3.5" />} value={pref.Modalidad.nombre} />}
                      {pref.sede_preferida && <DataRow label="Sede preferida" icon={<MapPin className="h-3.5 w-3.5" />} value={pref.sede_preferida} />}
                      {pref.profesional_preferido && <DataRow label="Profesional preferido" icon={<Stethoscope className="h-3.5 w-3.5" />} value={`Esp. ${pref.profesional_preferido}`} />}
                    </>
                  )}
                </AccordionSection>

                {/* 3. Datos de estudiante — acordeón */}
                <AccordionSection
                  title="Datos de Estudiante"
                  subtitle="Historial académico actual"
                  icon={<GraduationCap className="h-3.5 w-3.5" />}
                  defaultOpen={isStudent}
                >
                  {!datAcad ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin datos registrados</p>
                  ) : datAcad.aplica === false ? (
                    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                      <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                        <X className="w-3 h-3 text-slate-500" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Condición de estudiante: <span className="font-bold">No aplica</span></p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">La persona no se encuentra matriculada actualmente en programas universitarios.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 flex items-center gap-1 font-semibold">
                          <Award className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                          Estudiante Activo
                        </Badge>
                      </div>
                      <DataRow label="Universidad" value={datAcad.universidad} />
                      <DataRow label="Carrera" value={datAcad.carrera} />
                      <DataRow label="Ciclo" value={datAcad.ciclo} />
                    </div>
                  )}
                </AccordionSection>

                {/* 4. Datos laborales — acordeón */}
                <AccordionSection
                  title="Datos Laborales"
                  subtitle="Ocupación y régimen laboral"
                  icon={<Briefcase className="h-3.5 w-3.5" />}
                >
                  {!datLab ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin datos laborales registrados</p>
                  ) : (
                    <>
                      {datLab.ocupacion && <DataRow label="Ocupación" icon={<Activity className="h-3.5 w-3.5" />} value={datLab.ocupacion} />}
                      {datLab.empresa && <DataRow label="Tipo o lugar de trabajo" icon={<Building2 className="h-3.5 w-3.5" />} value={datLab.empresa} />}
                      {datLab.modalidad && <DataRow label="Horario laboral" icon={<Clock className="h-3.5 w-3.5" />} value={datLab.modalidad} />}
                      {datLab.disponibilidad && <DataRow label="Disponibilidad para coordinaciones" value={datLab.disponibilidad} />}
                    </>
                  )}
                </AccordionSection>

                {/* 5. Salud Odontológica — acordeón */}
                <AccordionSection
                  title="Salud Odontológica"
                  subtitle="Antecedentes clínicos y contexto bucal del paciente"
                  icon={<HeartPulse className="h-3.5 w-3.5" />}
                  defaultOpen={hasUrgentPain}
                >
                  {!saludOdonto ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin historial odontológico registrado</p>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Última visita" icon={<Calendar className="h-3.5 w-3.5" />} value={saludOdonto.ultima_visita_odontologica} />
                        <DataRow label="Motivo de consulta" value={saludOdonto.motivo_consulta} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Tratamiento previo" value={saludOdonto.tratamiento_previo} />
                        <DataRow label="Nivel de dolor" value={saludOdonto.nivel_dolor} />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <CondChip label="Sensibilidad" value={saludOdonto.presenta_sensibilidad} />
                        <CondChip label="Sangrado / Inflamación" value={saludOdonto.sangrado_o_inflamacion} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Aparato / Prótesis" value={saludOdonto.usa_aparato_o_protesis} />
                        <DataRow label="Cond. especial de atención" value={saludOdonto.condicion_atencion_especial} />
                      </div>
                    </div>
                  )}
                </AccordionSection>

                {/* 6. Otros datos administrativos — acordeón */}
                <AccordionSection
                  title="Otros Datos Administrativos"
                  subtitle="Parámetros de negociación y seguimiento de contacto"
                  icon={<Settings2 className="h-3.5 w-3.5" />}
                >
                  <div className="grid grid-cols-2 gap-3">
                    {lead.CanalOrigen && <DataRow label="Canal de captación" value={lead.CanalOrigen.nombre} />}
                    {ultimaSolicitud && <DataRow label="Nivel de interés" value={ultimaSolicitud.tipo_consulta || 'Consulta general'} />}
                  </div>
                  {interaccionReciente?.mensaje && (
                    <div>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Observaciones administrativas</span>
                      <p className="text-xs text-slate-700 dark:text-slate-300 mt-1 leading-relaxed bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-lg border border-slate-200/70 dark:border-slate-700/60">
                        {interaccionReciente.mensaje}
                      </p>
                    </div>
                  )}
                </AccordionSection>

              </div>

              {/* ══ COLUMNA DERECHA: Negociación ══ */}
              <div className="p-5 space-y-5 overflow-y-auto no-scrollbar">

                {/* ── Tarjeta de Inteligencia & Scoring Comercial (Estrategia Recomendada) ── */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 shadow-sm relative overflow-hidden transition-all">
                  <div className="relative z-10 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-100/80 dark:border-teal-900/60 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300 border border-teal-200 dark:border-teal-400/30">
                          <Zap className="h-3.5 w-3.5" />
                        </span>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                          Estrategia Comercial Recomendada & Matching
                        </h4>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-teal-100/80 dark:bg-teal-950/80 text-teal-700 dark:text-teal-300 border border-teal-300/60 dark:border-teal-800/80 shadow-2xs select-none">
                        <Sparkles className="w-3 h-3 text-teal-600 dark:text-teal-300" />
                        <span>Inteligencia BUYER → LEAD</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      {/* Factor 1: Perfil del paciente */}
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                          <GraduationCap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          <span>Perfil Universitario</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                          {isStudent
                            ? `Perfil universitario identificado (${datAcad?.universidad || 'Universidad'}).`
                            : 'Tarifa regular sugerida.'}
                        </p>
                      </div>

                      {/* Factor 2: Urgencia / Salud */}
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                          <HeartPulse className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          <span>Prioridad Clínica</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                          {hasUrgentPain
                            ? `Dolor ${saludOdonto?.nivel_dolor}. Priorizar turno cercano.`
                            : 'Chequeo preventivo o estético estándar.'}
                        </p>
                      </div>

                      {/* Factor 3: Preferencias */}
                      <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 hover:border-teal-400/80 transition-colors space-y-1 shadow-2xs">
                        <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                          <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                          <span>Preferencias de Atención</span>
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                          {pref?.sede_preferida || pref?.profesional_preferido
                            ? `Prefiere Sede ${pref?.sede_preferida || 'Indiferente'} / Esp. ${pref?.profesional_preferido || 'Indiferente'}.`
                            : 'Sin restricciones de sede o especialista.'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Banner solicitud original del paciente */}
                {ultimaSolicitud && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 shrink-0">
                        <Stethoscope className="h-4 w-4" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                          Servicio Solicitado en BUYER
                        </span>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                          {ultimaSolicitud.Servicio?.nombre || 'Servicio Odontológico Integral'}
                        </p>
                        {ultimaSolicitud.motivo && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 italic">
                            "{ultimaSolicitud.motivo}"
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Diseñar oferta comercial / promoción */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">1</span>
                      Diseñar Oferta Comercial / Promoción
                    </h3>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 flex items-center gap-1">
                      <Timer className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                      Válida hasta: {format(calculatedExpiry, 'dd/MM/yyyy')}
                    </span>
                  </div>

                  <div className="space-y-4 p-4 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-2xl shadow-sm">

                    {/* A. Margen de Vigencia Activo de la Promoción */}
                    <div className="p-3 rounded-xl bg-slate-50/90 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <Timer className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                          Margen de Vigencia Activo de la Oferta:
                        </Label>
                        <span className="text-[11px] font-bold text-teal-700 dark:text-teal-300">
                          {getVigenciaLabel(altVigencia, altVigenciaCustom)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setAltVigencia('24h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '24h'
                              ? 'bg-amber-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Zap className="w-3 h-3 text-amber-400" />
                          24 Horas (Flash)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('48h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '48h'
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Sparkles className="w-3 h-3 text-teal-300" />
                          48 Horas (Recomendado)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('72h')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '72h'
                              ? 'bg-teal-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Calendar className="w-3 h-3" />
                          72 Horas (3 Días)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('7d')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === '7d'
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          <Tag className="w-3 h-3" />
                          7 Días (Campaña Semanal)
                        </button>

                        <button
                          type="button"
                          onClick={() => setAltVigencia('custom')}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${altVigencia === 'custom'
                              ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                            }`}
                        >
                          Personalizado
                        </button>
                      </div>

                      {altVigencia === 'custom' && (
                        <div className="pt-1.5 flex items-center gap-2">
                          <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Fecha límite de la oferta:</Label>
                          <input
                            type="date"
                            className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            value={altVigenciaCustom}
                            onChange={(e) => setAltVigenciaCustom(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* B. Servicio, Sede y Especialista de Referencia */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Servicio Ofertado</Label>
                        <Select
                          onValueChange={(v) => {
                            setAltServicioId(v);
                            const serv = catalogs.servicios?.find((s: any) => s.id_servicio.toString() === v);
                            const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                            if (isStudent) {
                              setAltPrecio(Math.round(baseP * 0.85).toFixed(2));
                            } else {
                              setAltPrecio(baseP.toFixed(2));
                            }
                          }}
                          value={altServicioId}
                        >
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Seleccionar servicio..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {catalogs.servicios?.map((s: any) => (
                              <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                                {s.nombre} {s.Tarifas?.[0]?.precio ? `(S/ ${Number(s.Tarifas[0].precio).toFixed(2)})` : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {offerErrors.servicio && <p className="text-[10px] text-rose-500">{offerErrors.servicio}</p>}
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Sede Preferencial</Label>
                        <Select onValueChange={(v) => setAltSedeId(v)} value={altSedeId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Todas las sedes..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_SEDES" className="font-semibold text-slate-900 dark:text-slate-100">Todas las sedes (A elección)</SelectItem>
                            {catalogs.sedes?.map((s: any) => (
                              <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100">
                                {s.nombre}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Especialista Sugerido</Label>
                        <Select onValueChange={(v) => setAltProfesionalId(v)} value={altProfesionalId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Cualquier especialista..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_PROFESSIONALS" className="font-semibold text-slate-900 dark:text-slate-100">Cualquier especialista colegiado</SelectItem>
                            {catalogs.profesionales?.map((p: any) => (
                              <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-slate-900 dark:text-slate-100">
                                Esp. {p.nombres} {p.apellidos}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* C. Franja Horaria Sugerida para la Promoción */}
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                        Franja Horaria Sugerida para la Promoción
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {[
                          'Horario Flexible (A elección del paciente al confirmar)',
                          'Turno Mañana (09:00 - 13:00)',
                          'Turno Tarde (14:00 - 18:00)',
                          'Turno Noche (18:00 - 21:00)',
                          'Sábados Exclusivo',
                        ].map((franja) => (
                          <button
                            key={franja}
                            type="button"
                            onClick={() => setAltFranja(franja)}
                            className={`p-2 rounded-xl text-[11px] font-semibold text-left border transition-all ${altFranja === franja
                                ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-600 dark:border-teal-500 text-teal-900 dark:text-teal-200 shadow-2xs'
                                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-300'
                              }`}
                          >
                            {franja}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* D. Comparador Financiero en Vivo & Descuentos Rápidos */}
                    <div className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            Tarifa de Negociación y Descuentos Rápidos
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mr-1">Aplicar:</span>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                            title="Descuento promocional (-15%)"
                          >
                            <GraduationCap className="w-3 h-3" />
                            Promoción (-15%)
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
                            title="Descuento especial por pronto pago o campaña (-20%)"
                          >
                            <Zap className="w-3 h-3" />
                            Campaña (-20%)
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickDiscount(0, 'REGULAR')}
                            className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition-colors"
                            title="Precio de lista oficial 100%"
                          >
                            Tarifa Regular
                          </button>
                        </div>
                      </div>

                      {/* Resumen Comparativo de Precio */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                        <div className="p-2.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 flex flex-col">
                          <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Precio de Lista Oficial</span>
                          <span className="text-sm font-bold text-slate-600 dark:text-slate-400 line-through">
                            S/ {currentOfficialPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 flex flex-col">
                          <span className="text-[10px] font-bold text-teal-700 dark:text-teal-300 uppercase">Precio Ofertado al Paciente</span>
                          <span className="text-sm font-extrabold text-teal-700 dark:text-teal-300 font-mono">
                            S/ {numericOfferPrice.toFixed(2)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex flex-col">
                          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">Ahorro para el Paciente</span>
                          <div className="flex items-center gap-1">
                            <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                              S/ {discountMetrics.saving.toFixed(2)} ({discountMetrics.pct}% OFF)
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* E. Precio editable y condiciones */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <Label className={`text-[11px] font-medium ${offerErrors.precio ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>Precio ofrecido editable (S/)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input
                            type="number"
                            step="0.5"
                            className={`flex h-9 w-full rounded-xl border pl-7 pr-3 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 font-semibold ${offerErrors.precio ? '!border-rose-500 !ring-1 !ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'}`}
                            value={altPrecio}
                            onChange={(e) => {
                              setAltPrecio(e.target.value);
                              if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
                            }}
                          />
                        </div>
                        {offerErrors.precio && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{offerErrors.precio}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Condición / Beneficio adicional</Label>
                        <input
                          type="text"
                          className="flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
                          placeholder="Ej. Pago en cuotas, vigencia especial..."
                          value={altCondiciones}
                          onChange={(e) => setAltCondiciones(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleAddAlternative} disabled={addingAlternative} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-5 shadow-sm font-semibold">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {addingAlternative ? 'Registrando...' : 'Añadir Oferta al Tablero'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. Tablero de ofertas comerciales activas */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">2</span>
                    Ofertas Comerciales sobre la Mesa (Selecciona una para enviar o cerrar trato)
                  </h3>

                  {opciones.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han generado ofertas comerciales para este paciente.</p>
                      <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">Usa el formulario superior para construir una propuesta atractiva con vigencia.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {opciones.map((opt: any) => (
                        <div
                          key={opt.id_opcion}
                          onClick={() => setSelectedOpcion(opt.id_opcion)}
                          className={`relative p-3.5 border-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${selectedOpcion === opt.id_opcion
                            ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-md'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                            }`}
                        >
                          {selectedOpcion === opt.id_opcion && (
                            <div className="absolute -top-2.5 -right-2.5 bg-teal-600 text-white rounded-full p-1 shadow-md z-10">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                          )}

                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2">
                            <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200 text-xs bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2.5 py-0.5 rounded-lg">
                              <Clock className="h-3 w-3 text-amber-500" />
                              Válido hasta: {opt.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                            </span>

                            {editingOptionId === opt.id_opcion ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] font-semibold text-slate-400">S/</span>
                                <input
                                  type="number"
                                  className="w-16 px-1.5 py-0.5 text-xs font-bold border border-teal-500 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                                  value={editingPrice}
                                  onChange={(e) => setEditingPrice(e.target.value)}
                                  autoFocus
                                />
                                <button
                                  onClick={(e) => handleSaveEdit(e, opt.id_opcion)}
                                  disabled={savingEdit}
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                                >
                                  <Check className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setEditingOptionId(null); }}
                                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className={`font-mono font-bold text-sm ${selectedOpcion === opt.id_opcion ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                                  S/ {Number(opt.precio_ofrecido).toFixed(2)}
                                </p>
                                <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                                  <button
                                    title="Editar precio"
                                    onClick={(e) => { e.stopPropagation(); setEditingOptionId(opt.id_opcion); setEditingPrice(opt.precio_ofrecido?.toString() || ''); }}
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950 transition"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button
                                    title="Eliminar alternativa"
                                    onClick={(e) => { e.stopPropagation(); setDeletingOptionTarget(opt); }}
                                    className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>Sede: {opt.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-400 shrink-0" />
                              <span>Especialista: {opt.Disponibilidad?.Profesional?.apellidos ? `Esp. ${opt.Disponibilidad?.Profesional?.apellidos}` : 'Por asignar'}</span>
                            </div>
                            {opt.condiciones && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 leading-tight">
                                {opt.condiciones}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ── 3. Copiloto de Detección y Apoyo ante Objeciones (Actividad 3) ── */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-sm space-y-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">
                        3
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Copiloto de Apoyo ante Objeciones
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 rounded-md border border-teal-200/60 dark:border-teal-800/60">
                      Asistente en Vivo
                    </span>
                  </div>

                  {/* Selector de tipo de objeción */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setObjectionCategory('PRECIO')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'PRECIO'
                          ? 'bg-teal-600 text-white border-teal-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span>Objeción: "Está caro"</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjectionCategory('HORARIO')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'HORARIO'
                          ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Objeción: "No puedo a esa hora"</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setObjectionCategory('SEDE')}
                      className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${objectionCategory === 'SEDE'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Objeción: "Me queda lejos"</span>
                    </button>
                  </div>

                  {/* Contenido contextual de la objeción seleccionada */}
                  {objectionCategory === 'PRECIO' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-teal-600" />
                        Argumento & Solución Comercial:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        Explica la garantía clínica de NexoSalud, instrumentación esterilizada y especialista colegiado. Si el paciente aún duda, aplica un descuento rápido sobre el precio oficial:
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1"
                        >
                          <GraduationCap className="w-3 h-3" />
                          Aplicar promoción (-15%)
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(15, 'CAMPANA')}
                          className="bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1"
                        >
                          <Briefcase className="w-3 h-3" />
                          Aplicar promoción (-15%)
                        </Button>
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                          className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1"
                        >
                          <Zap className="w-3 h-3" />
                          Campaña (-20%)
                        </Button>
                        <span className="text-[10px] text-slate-400">
                          (Recuerda presionar "Añadir Oferta al Tablero" para crear la propuesta)
                        </span>
                      </div>
                    </div>
                  )}

                  {objectionCategory === 'HORARIO' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        Flexibilidad Horaria & Turnos Alternos:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        La promoción no exige una cita fija inmediata. El paciente puede elegir <strong>Horario Flexible</strong> o convenir atención en Sábados según su disponibilidad.
                      </p>
                      <Button
                        size="sm"
                        type="button"
                        onClick={() => setAltFranja('Horario Flexible (A elección del paciente al confirmar)')}
                        className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium"
                      >
                        Pactar Horario Flexible
                      </Button>
                    </div>
                  )}

                  {objectionCategory === 'SEDE' && (
                    <div className="p-3 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-700/70 rounded-xl space-y-2 text-xs">
                      <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                        Red de Sedes & Cobertura:
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                        NexoSalud cuenta con sedes en puntos estratégicos. Cambia la sede en el selector superior para que la oferta sea válida en la sede más cercana a {lead?.zona || 'Trujillo/Lima'}.
                      </p>
                    </div>
                  )}
                </div>

                {/* ── 4. Envío y Seguimiento Omnicanal (Actividad 4) ── */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 shadow-sm space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">
                        4
                      </span>
                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        Envío de Oferta Omnicanal (WhatsApp & Correo)
                      </h3>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200/60 dark:border-emerald-800/60">
                      Mensaje Dinámico
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <MessageSquare className="w-3 h-3 text-emerald-500" />
                        Vista Previa del Mensaje para el Paciente:
                      </span>
                      <button
                        type="button"
                        onClick={handleCopyWhatsApp}
                        className="text-[10px] font-semibold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-teal-50 dark:hover:bg-teal-950/50"
                      >
                        {copiedWhatsApp ? <CheckCheck className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedWhatsApp ? '¡Copiado!' : 'Copiar texto'}
                      </button>
                    </div>

                    <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line bg-slate-50/80 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200/80 dark:border-slate-700/70 font-sans leading-relaxed">
                      {generateWhatsAppMessage()}
                    </p>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        onClick={handleSendWhatsApp}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-sm flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>Enviar por WhatsApp</span>
                      </Button>
                      <Button
                        type="button"
                        onClick={handleSendEmail}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-sm flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        <span>Enviar por Correo</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCopyWhatsApp}
                        className="rounded-xl text-xs h-9 px-3 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copiar Mensaje
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ── 5. Preparación y Resumen del Paso a PAYER (Actividad 5) ── */}
                {selectedOptData && (
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-50/90 to-emerald-50/80 dark:from-teal-950/40 dark:to-emerald-950/30 border border-teal-200/90 dark:border-teal-800/80 shadow-sm space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between border-b border-teal-100 dark:border-teal-900/60 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          5
                        </span>
                        <h4 className="text-xs font-bold text-teal-950 dark:text-teal-200 uppercase tracking-wider">
                          Resumen del Trato Comercial (Paso a PAYER)
                        </h4>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/80 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-700">
                        Opción Seleccionada
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Vigencia Promoción</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          Hasta {selectedOptData.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Sede</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {selectedOptData.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}
                        </span>
                      </div>

                      <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
                        <span className="text-[10px] text-slate-400 font-semibold block">Especialista</span>
                        <span className="font-bold text-slate-900 dark:text-white truncate block">
                          {selectedOptData.Disponibilidad?.Profesional?.apellidos ? `Esp. ${selectedOptData.Disponibilidad?.Profesional?.apellidos}` : 'Por asignar'}
                        </span>
                      </div>

                      <div className="bg-teal-100/80 dark:bg-teal-900/60 p-2.5 rounded-xl border border-teal-300/80 dark:border-teal-700 flex flex-col justify-center">
                        <span className="text-[10px] text-teal-800 dark:text-teal-300 font-semibold block">Monto a Cobrar (PAYER)</span>
                        <span className="font-black font-mono text-base text-teal-900 dark:text-teal-100">
                          S/ {Number(selectedOptData.precio_ofrecido).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={onClose}>
            Pausar negociación
          </Button>
          <Button
            onClick={handleReserve}
            disabled={reserving || !selectedOpcion || !lead}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-5 py-2 h-9"
          >
            {reserving ? 'Cerrando trato...' : 'Cerrar Trato (Pasar a PAYER)'}
            {!reserving && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
        </div>

        <ConfirmationDialog
          isOpen={!!deletingOptionTarget}
          onClose={() => setDeletingOptionTarget(null)}
          onConfirm={handleConfirmDeleteOption}
          isLoading={isDeletingOption}
          title="¿Remover oferta comercial del tablero?"
          description={`Se descartará la propuesta comercial seleccionada (Tarifa S/ ${Number(deletingOptionTarget?.precio_ofrecido || 0).toFixed(2)}).`}
          confirmText="Sí, Remover Oferta"
          cancelText="Conservar"
          variant="destructive"
        />
      </DialogContent>
    </Dialog>
  );
}
