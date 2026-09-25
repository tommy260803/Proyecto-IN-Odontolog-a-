import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  format,
  addDays,
  startOfDay,
  parseISO,
} from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';

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
  MessageCircle,
  CheckCheck,
  Timer,
  Palette,
  ExternalLink,
  Download,
  Image as ImageIcon,
} from 'lucide-react';

// ── Logo oficial de Canva (Icon-Icons / Simple Icons) ───────────────────────
function CanvaIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Canva"
    >
      <title>Canva</title>
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zM6.962 7.68c.754 0 1.337.549 1.405 1.2.069.583-.171 1.097-.822 1.406-.343.171-.48.172-.549.069-.034-.069 0-.137.069-.206.617-.514.617-.926.548-1.508-.034-.378-.308-.618-.583-.618-1.2 0-2.914 2.674-2.674 4.629.103.754.549 1.646 1.509 1.646.308 0 .65-.103.96-.24.5-.264.799-.47 1.097-.8-.073-.885.704-2.046 1.851-2.046.515 0 .926.205.96.583.068.514-.377.582-.514.582s-.378-.034-.378-.17c-.034-.138.309-.07.275-.378-.035-.206-.24-.274-.446-.274-.72 0-1.131.994-1.029 1.611.035.275.172.549.447.549.205 0 .514-.31.617-.755.068-.308.343-.514.583-.514.102 0 .17.034.205.171v.138c-.034.137-.137.548-.102.651 0 .069.034.171.17.171.092 0 .436-.18.777-.459.117-.59.253-1.298.253-1.357.034-.24.137-.48.617-.48.103 0 .171.034.205.171v.138l-.136.617c.445-.583 1.097-.994 1.508-.994.172 0 .309.102.309.274 0 .103 0 .274-.069.446-.137.377-.309.96-.412 1.474 0 .137.035.274.207.274.171 0 .685-.206 1.096-.754l.007-.004c-.002-.068-.007-.134-.007-.202 0-.411.035-.754.104-.994.068-.274.411-.514.617-.514.103 0 .205.069.205.171 0 .035 0 .103-.034.137-.137.446-.24.857-.24 1.269 0 .24.034.582.102.788 0 .034.035.069.07.069.068 0 .548-.445.89-1.028-.308-.206-.48-.549-.48-.96 0-.72.446-1.097.858-1.097.343 0 .617.24.617.72 0 .308-.103.65-.274.96h.102a.77.77 0 0 0 .584-.24.293.293 0 0 1 .134-.117c.335-.425.83-.74 1.41-.74.48 0 .924.205.959.582.068.515-.378.618-.515.618l-.002-.002c-.138 0-.377-.035-.377-.172 0-.137.309-.068.274-.376-.034-.206-.24-.275-.446-.275-.686 0-1.13.891-1.028 1.611.034.275.171.583.445.583.206 0 .515-.308.652-.754.068-.274.343-.514.583-.514.103 0 .17.034.205.171 0 .069 0 .206-.137.652-.17.308-.171.48-.137.617.034.274.171.48.309.583.034.034.068.102.068.102 0 .069-.034.138-.137.138-.034 0-.068 0-.103-.035-.514-.205-.72-.548-.789-.891-.205.24-.445.377-.72.377-.445 0-.89-.411-.96-.926a1.609 1.609 0 0 1 .075-.649c-.203.13-.422.203-.623.203h-.17c-.447.652-.927 1.098-1.27 1.303a.896.896 0 0 1-.377.104c-.068 0-.171-.035-.205-.104-.095-.152-.156-.392-.193-.667-.481.527-1.145.805-1.453.805-.343 0-.548-.206-.582-.55v-.376c.102-.754.377-1.2.377-1.337a.074.074 0 0 0-.069-.07c-.24 0-1.028.824-1.166 1.373l-.103.445c-.068.309-.377.515-.582.515-.103 0-.172-.035-.206-.172v-.137l.046-.233c-.435.31-.87.508-1.075.508-.308 0-.48-.172-.514-.412-.206.274-.445.412-.754.412-.352 0-.696-.24-.862-.593-.244.275-.523.553-.852.764-.48.309-1.028.549-1.68.549-.582 0-1.097-.309-1.371-.583-.412-.377-.651-.96-.686-1.509-.205-1.68.823-3.84 2.4-4.8.378-.205.755-.343 1.132-.343zm9.77 3.291c-.104 0-.172.172-.172.343 0 .274.137.583.309.755a1.74 1.74 0 0 0 .102-.583c0-.343-.137-.515-.24-.515z" />
    </svg>
  );
}

export default function LeadNegotiationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [lead, setLead] = useState<any>(null);
  const [options, setOptions] = useState<any>({ profesionales: [], sedes: [], servicios: [], disponibilidades: [] });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [selectedOpcion, setSelectedOpcion] = useState<number | null>(null);

  // Form states for commercial offer / promotion
  const [selectedServicioId, setSelectedServicioId] = useState('');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [selectedVigencia, setSelectedVigencia] = useState<'24h' | '48h' | '72h' | '7d' | 'custom'>('48h');
  const [selectedVigenciaCustom, setSelectedVigenciaCustom] = useState('');
  const [selectedFranja, setSelectedFranja] = useState('Horario Flexible (A elección del paciente al confirmar)');
  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [condiciones, setCondiciones] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  // Estados para Copiloto de Objeciones y Seguimiento WhatsApp (Actividades 3 y 4)
  const [objectionCategory, setObjectionCategory] = useState<'PRECIO' | 'HORARIO' | 'SEDE'>('PRECIO');
  const [copiedWhatsApp, setCopiedWhatsApp] = useState(false);
  const [generatingCanva, setGeneratingCanva] = useState(false);
  const [canvaResult, setCanvaResult] = useState<any>(null);

  const fetchLeadData = () => {
    Promise.all([
      leadService.getLeadDetails(id!),
      leadService.getAvailabilityOptions()
    ])
      .then(([leadData, optionsData]) => {
        setLead(leadData);
        setOptions(optionsData);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (id) {
      fetchLeadData();
    }
  }, [id]);

  // Pre-carga inteligente al obtener datos
  useEffect(() => {
    if (!lead || !options || !options.servicios?.length) return;

    // 1. Servicio pre-seleccionado
    let initialServicioId = selectedServicioId;
    const reqServicio = lead.Solicitudes?.[0]?.Servicio;
    const reqServicioId = lead.Solicitudes?.[0]?.id_servicio;
    if (!initialServicioId) {
      if (reqServicioId) {
        initialServicioId = reqServicioId.toString();
      } else if (reqServicio?.id_servicio) {
        initialServicioId = reqServicio.id_servicio.toString();
      } else if (reqServicio?.nombre) {
        const found = options.servicios.find((s: any) =>
          s.nombre.toLowerCase().includes(reqServicio.nombre.toLowerCase())
        );
        if (found) initialServicioId = found.id_servicio.toString();
      }
      if (!initialServicioId && options.servicios.length > 0) {
        initialServicioId = options.servicios[0].id_servicio.toString();
      }
      if (initialServicioId) setSelectedServicioId(initialServicioId);
    }

    // 2. Sede pre-seleccionada
    const prefSede = lead.Preferencias?.[0]?.sede_preferida;
    if (prefSede && !selectedSedeId) {
      const matchSede = options.sedes?.find((s: any) =>
        s.nombre.toLowerCase().includes(prefSede.toLowerCase()) ||
        prefSede.toLowerCase().includes(s.nombre.toLowerCase())
      );
      if (matchSede) setSelectedSedeId(matchSede.id_sede.toString());
    }

    // 3. Profesional pre-seleccionado
    const prefProf = lead.Preferencias?.[0]?.profesional_preferido;
    if (prefProf && !selectedProfesionalId) {
      const matchProf = options.profesionales?.find((p: any) =>
        p.apellidos.toLowerCase().includes(prefProf.toLowerCase()) ||
        prefProf.toLowerCase().includes(p.apellidos.toLowerCase()) ||
        p.nombres.toLowerCase().includes(prefProf.toLowerCase())
      );
      if (matchProf) setSelectedProfesionalId(matchProf.id_profesional.toString());
    }

    // 4. Precio oficial de lista & Descuento inteligente
    const activeServicio = options.servicios?.find((s: any) => s.id_servicio.toString() === initialServicioId);
    const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
    if (precioOfrecido === '150.00' || !precioOfrecido) {
      setPrecioOfrecido(officialPrice.toFixed(2));
    }
  }, [lead, options]);

  // Cálculo en vivo de la fecha límite de vigencia de la oferta comercial
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
    if (vig === '24h') return '24 horas (Oferta Flash)';
    if (vig === '48h') return '48 horas (Recomendado)';
    if (vig === '72h') return '72 horas (3 días)';
    if (vig === '7d') return '7 días (Semanal)';
    return `Hasta ${customVal || 'Personalizado'}`;
  };

  // Precio de lista oficial del servicio
  const currentOfficialPrice = useMemo(() => {
    const s = options.servicios?.find((item: any) => item.id_servicio.toString() === selectedServicioId);
    return Number(s?.Tarifas?.[0]?.precio || 180);
  }, [options.servicios, selectedServicioId]);

  const numericOfferPrice = useMemo(() => {
    const val = parseFloat(precioOfrecido);
    return isNaN(val) ? 0 : val;
  }, [precioOfrecido]);

  const discountMetrics = useMemo(() => {
    const saving = Math.max(0, currentOfficialPrice - numericOfferPrice);
    const pct = currentOfficialPrice > 0 ? Math.round((saving / currentOfficialPrice) * 100) : 0;
    return { saving, pct };
  }, [currentOfficialPrice, numericOfferPrice]);

  const applyQuickDiscount = (pct: number, type?: 'CAMPANA' | 'REGULAR') => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setPrecioOfrecido(discounted.toFixed(2));
    if (type === 'CAMPANA') {
      setCondiciones('Campaña Promocional Especial por tiempo limitado');
    } else if (type === 'REGULAR') {
      setCondiciones('');
    }
    if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
  };

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    if (!selectedServicioId) {
      errors.servicio = 'Selecciona un servicio para la promoción.';
    }
    if (!precioOfrecido || isNaN(Number(precioOfrecido)) || Number(precioOfrecido) <= 0) {
      errors.precio = 'Ingresa una tarifa válida mayor a 0.';
    }
    if (Object.keys(errors).length > 0) {
      setOfferErrors(errors);
      return;
    }

    setOfferErrors({});
    setAddingAlternative(true);
    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
    const expiryStr = format(calculatedExpiry, 'yyyy-MM-dd');
    const fullCondiciones = `[Vigencia: ${getVigenciaLabel(selectedVigencia, selectedVigenciaCustom)} - Vence: ${format(calculatedExpiry, 'dd/MM/yyyy')}] [Franja: ${selectedFranja}] ${condiciones ? `| ${condiciones}` : ''}`.trim();

    try {
      await leadService.addAlternative(id!, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        fecha: expiryStr,
        hora_inicio: selectedFranja.includes('Tarde') ? '14:00' : '09:00',
        hora_fin: selectedFranja.includes('Tarde') ? '19:00' : '13:00',
        id_profesional: (selectedProfesionalId && selectedProfesionalId !== 'ALL_PROFESSIONALS') ? selectedProfesionalId : undefined,
        id_sede: (selectedSedeId && selectedSedeId !== 'ALL_SEDES') ? selectedSedeId : undefined,
        precio_ofrecido: precioOfrecido,
        condiciones: fullCondiciones,
      });
      fetchLeadData();
      setCondiciones('');
      toast({ title: '¡Promoción Registrada! 🎉', description: 'La oferta comercial con vigencia activa ha sido añadida al tablero.' });
    } catch {
      toast({ title: 'Error', description: 'Error al añadir la oferta comercial.', variant: 'destructive' });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleSaveEdit = async (e: React.MouseEvent, id_opcion: number) => {
    e.stopPropagation();
    if (!editingPrice || isNaN(Number(editingPrice)) || Number(editingPrice) <= 0) {
      toast({ title: 'Precio Inválido', description: 'Por favor ingresa una tarifa válida mayor a 0.', variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      await leadService.updateAlternative(id_opcion, { precio_ofrecido: editingPrice });
      setEditingOptionId(null);
      fetchLeadData();
      toast({ title: 'Tarifa Actualizada', description: `Nueva tarifa: S/ ${Number(editingPrice).toFixed(2)}` });
    } catch {
      toast({ title: 'Error', description: 'Error al actualizar el precio.', variant: 'destructive' });
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
      toast({ title: 'Oferta Comercial Removida', description: 'La propuesta ha sido eliminada del tablero.' });
    } catch {
      toast({ title: 'Error', description: 'Error al eliminar la alternativa.', variant: 'destructive' });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion) {
      toast({ title: 'Atención', description: 'Selecciona una de las ofertas del tablero antes de cerrar el trato.' });
      return;
    }

    const ultimaSolicitud = lead.Solicitudes[lead.Solicitudes.length - 1];

    setReserving(true);
    try {
      await leadService.reserve(id!, {
        id_solicitud: ultimaSolicitud?.id_solicitud || 1,
        id_opcion: selectedOpcion
      });
      setIsSuccess(true);
    } catch {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally {
      setReserving(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-2xl text-center border-t-4 border-t-emerald-500 animate-in fade-in zoom-in duration-300 rounded-2xl">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center">
            <div className="h-24 w-24 bg-emerald-100 dark:bg-emerald-950/60 rounded-full flex items-center justify-center mb-6 shadow-inner ring-8 ring-emerald-50 dark:ring-emerald-950/30">
              <CheckCircle2 className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-3 tracking-tight">¡Trato Cerrado! 🎉</h2>
            <p className="text-slate-600 dark:text-slate-300 mb-8 leading-relaxed text-sm">
              La reserva ha sido confirmada exitosamente. El paciente ahora se encuentra en la etapa <span className="font-semibold text-emerald-700 dark:text-emerald-400">PAYER</span> esperando la conciliación de su pago.
            </p>
            <Button
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-base font-bold shadow-md rounded-xl transition-all hover:shadow-lg hover:-translate-y-0.5"
              onClick={() => navigate(`/payer`)}
            >
              Ir al Módulo PAYER (Cobranzas)
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="p-12 text-center text-slate-500 animate-pulse font-medium">Preparando mesa de negociación inteligente...</div>;
  if (!lead) return <div className="p-12 text-center text-rose-500 font-medium">LEAD no encontrado.</div>;

  const pref = lead.Preferencias?.[0];
  const datAcad = lead.DatosAcademicos?.[0];
  const datLab = lead.DatosLaborales?.[0];
  const saludOdonto = lead.SaludOdontologica?.[0];
  const isStudent = datAcad?.aplica === true || Boolean(datAcad?.universidad);
  const dolorLevel = saludOdonto?.nivel_dolor?.toLowerCase() || '';
  const hasUrgentPain = dolorLevel.includes('intenso') || dolorLevel.includes('moderado');
  const opciones = lead.Solicitudes?.[lead.Solicitudes.length - 1]?.Opciones || [];

  const selectedOptData = opciones.find((o: any) => o.id_opcion === selectedOpcion);

  const generateWhatsAppMessage = () => {
    const patientFirstName = lead?.nombres || 'Paciente';
    const ultimaSolicitud = lead.Solicitudes?.[lead.Solicitudes.length - 1];
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
        `🔗 *https://nexosalud.pe/pre-reserva/${id}*\n\n` +
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

  const handleGenerateCanvaAndDispatch = async (autoDispatch = false) => {
    setGeneratingCanva(true);
    try {
      const ultimaSolicitud = lead?.Solicitudes?.[lead?.Solicitudes?.length - 1];
      const reqServicio = ultimaSolicitud?.Servicio?.nombre || 'Consulta Odontológica';
      const precio = selectedOptData ? Number(selectedOptData.precio_ofrecido).toFixed(2) : (numericOfferPrice ? numericOfferPrice.toFixed(2) : '150.00');
      const sede = selectedOptData?.Disponibilidad?.Sede?.nombre || (selectedSedeId && selectedSedeId !== 'ALL_SEDES' ? options.sedes?.find((s: any) => s.id_sede.toString() === selectedSedeId)?.nombre : 'Sede Miraflores - Av. Larco 123');
      const doctor = selectedOptData?.Disponibilidad?.Profesional?.apellidos ? `Esp. ${selectedOptData.Disponibilidad.Profesional.apellidos}` : 'Especialistas colegiados';

      const resData = await leadService.generateCanvaFlyer(id!, {
        serviceName: reqServicio,
        sedeName: sede,
        doctorName: doctor,
        offeredPrice: Number(precio),
        originalPrice: currentOfficialPrice || 180,
        discountPct: discountMetrics?.pct || 15,
        expirationDate: selectedOptData?.Disponibilidad?.fecha?.split('T')[0] || (selectedVigencia === 'custom' ? selectedVigenciaCustom : '7 días'),
        conditions: condiciones || `Atención personalizada con ${doctor}. Cierre de tratamiento asegurado.`,
        sendEmail: false,
        leadEmail: lead?.email,
        leadPhone: lead?.numero,
      });

      const canva = resData.canva;

      setCanvaResult({
        success: true,
        templateId: canva?.designId || 'EAHWLEXZ1lo',
        designUrl: canva?.designUrl,
        previewUrl: canva?.previewUrl,
        downloadPngUrl: canva?.downloadPngUrl || canva?.previewUrl,
        dataset: canva?.filledDataset,
      });

      toast({
        title: '🎨 ¡Flyer Canva Generado!',
        description: 'Imagen del flyer publicitario generada y lista para previsualizar o descargar.',
      });

      if (autoDispatch) {
        handleSendWhatsApp();
      }
    } catch (err: any) {
      console.warn('⚠️ Error llamando a Canva endpoint:', err);
      toast({
        title: 'Atención con Canva Connect',
        description: 'No se pudo conectar con Canva API. Si expiró la sesión, pulsa en "Conectar Canva".',
        variant: 'destructive',
      });
    } finally {
      setGeneratingCanva(false);
    }
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">

      {/* ══ COLUMNA 1: Perfil del Paciente ══ */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="h-full shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 dark:bg-slate-800/60 border-b dark:border-slate-800 pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-900 dark:text-white">
              <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              Perfil del Paciente (LEAD)
            </CardTitle>
            <CardDescription className="text-xs">Contexto integral capturado en fase BUYER</CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
            <div className="p-5 space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nombre Completo</Label>
              <p className="font-bold text-slate-900 dark:text-white text-base">{lead.nombres} {lead.apellidos}</p>
            </div>

            <div className="p-5 space-y-3">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Contacto</Label>
              <div className="space-y-2 text-slate-700 dark:text-slate-300">
                {lead.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.numero && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>{lead.numero}</span>
                  </div>
                )}
                {lead.Interacciones?.length > 0 && lead.Interacciones[0].Canal && (
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-slate-400 shrink-0" />
                    <span>Canal: {lead.Interacciones[0].Canal.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Datos Académicos */}
            <div className="p-5 space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Condición Académica</Label>
              {datAcad?.aplica ? (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 flex items-center gap-1 font-semibold w-fit">
                    <Award className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    Estudiante Activo
                  </Badge>
                  <p className="text-slate-800 dark:text-slate-200"><span className="font-semibold">Universidad:</span> {datAcad.universidad}</p>
                  <p className="text-slate-800 dark:text-slate-200"><span className="font-semibold">Carrera:</span> {datAcad.carrera} ({datAcad.ciclo})</p>
                </div>
              ) : (
                <p className="text-slate-500 italic">No registrado como estudiante universitario</p>
              )}
            </div>

            {/* Preferencias */}
            <div className="p-5 space-y-2">
              <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preferencias de Atención</Label>
              <div className="space-y-1.5 text-slate-700 dark:text-slate-300">
                <p><span className="font-semibold">Sede:</span> {pref?.sede_preferida || 'Indiferente'}</p>
                <p><span className="font-semibold">Especialista:</span> {pref?.profesional_preferido || 'Indiferente'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ══ COLUMNA 2 y 3: Negociación Inteligente ══ */}
      <div className="lg:col-span-2 space-y-6">

        {/* ── Tarjeta de Estrategia Comercial ── */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-teal-50/90 via-white to-slate-50 dark:from-teal-950/40 dark:via-slate-900 dark:to-slate-950 border border-teal-200/90 dark:border-teal-800/80 shadow-sm relative overflow-hidden">
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
              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                  <GraduationCap className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Perfil Universitario</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  {isStudent ? `Perfil universitario identificado (${datAcad?.universidad || 'Universidad'}).` : 'Tarifa regular sugerida.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                  <HeartPulse className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Prioridad Clínica</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  {hasUrgentPain ? `Dolor ${saludOdonto?.nivel_dolor}. Priorizar turno cercano.` : 'Chequeo preventivo o estético estándar.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/90 dark:border-teal-800/50 space-y-1 shadow-2xs">
                <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-[11px]">
                  <MapPin className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
                  <span>Preferencias</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                  {pref?.sede_preferida || pref?.profesional_preferido ? `Sede ${pref?.sede_preferida || 'Indiferente'} / Esp. ${pref?.profesional_preferido || 'Indiferente'}.` : 'Sin restricciones.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Card Principal de Trabajo ── */}
        <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="bg-slate-50/70 dark:bg-slate-800/60 border-b dark:border-slate-800 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg text-slate-900 dark:text-white">Mesa de Negociación Comercial</CardTitle>
                <CardDescription className="text-xs">Formula propuestas comerciales con vigencia activa y cierra el trato</CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6 text-xs">

            {/* 1. Diseñar Oferta Comercial */}
            <section>
              <div className="flex items-center justify-between mb-4">
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
                      {getVigenciaLabel(selectedVigencia, selectedVigenciaCustom)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setSelectedVigencia('24h')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${selectedVigencia === '24h'
                          ? 'bg-amber-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Zap className="w-3 h-3 text-amber-400" />
                      24 Horas (Flash)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVigencia('48h')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${selectedVigencia === '48h'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Sparkles className="w-3 h-3 text-teal-300" />
                      48 Horas (Recomendado)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVigencia('72h')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${selectedVigencia === '72h'
                          ? 'bg-teal-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Calendar className="w-3 h-3" />
                      72 Horas (3 Días)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVigencia('7d')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${selectedVigencia === '7d'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      <Tag className="w-3 h-3" />
                      7 Días (Campaña Semanal)
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedVigencia('custom')}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1 ${selectedVigencia === 'custom'
                          ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-2xs'
                          : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                        }`}
                    >
                      Personalizado
                    </button>
                  </div>

                  {selectedVigencia === 'custom' && (
                    <div className="pt-1.5 flex items-center gap-2">
                      <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Fecha límite de la oferta:</Label>
                      <input
                        type="date"
                        className="h-8 rounded-lg border border-slate-200 dark:border-slate-700 px-2 text-xs bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                        value={selectedVigenciaCustom}
                        onChange={(e) => setSelectedVigenciaCustom(e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* B. Servicio, Sede y Especialista */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Servicio Ofertado</Label>
                    <Select
                      onValueChange={(v) => {
                        setSelectedServicioId(v);
                        const serv = options.servicios?.find((s: any) => s.id_servicio.toString() === v);
                        const baseP = Number(serv?.Tarifas?.[0]?.precio || 180);
                        if (isStudent) {
                          setPrecioOfrecido(Math.round(baseP * 0.85).toFixed(2));
                        } else {
                          setPrecioOfrecido(baseP.toFixed(2));
                        }
                      }}
                      value={selectedServicioId}
                    >
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Seleccionar servicio..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        {options.servicios?.map((s: any) => (
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
                    <Select onValueChange={(v) => setSelectedSedeId(v)} value={selectedSedeId}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Todas las sedes..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_SEDES" className="font-semibold text-slate-900 dark:text-slate-100">Todas las sedes (A elección)</SelectItem>
                        {options.sedes?.map((s: any) => (
                          <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100">
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Especialista Sugerido</Label>
                    <Select onValueChange={(v) => setSelectedProfesionalId(v)} value={selectedProfesionalId}>
                      <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Cualquier especialista..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_PROFESSIONALS" className="font-semibold text-slate-900 dark:text-slate-100">Cualquier especialista colegiado</SelectItem>
                        {options.profesionales?.map((p: any) => (
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
                        onClick={() => setSelectedFranja(franja)}
                        className={`p-2 rounded-xl text-[11px] font-semibold text-left border transition-all ${selectedFranja === franja
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

                {/* E. Precio y Condiciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <Label className={`text-xs font-medium ${offerErrors.precio ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>Tarifa Ofrecida Editable (S/)</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        step="0.5"
                        className={`flex h-9 w-full rounded-xl border bg-slate-50 dark:bg-slate-800 pl-9 pr-3 text-xs font-semibold focus:outline-none focus:ring-2 ${offerErrors.precio ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500/20 focus:border-teal-500'}`}
                        value={precioOfrecido}
                        onChange={(e) => {
                          setPrecioOfrecido(e.target.value);
                          if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
                        }}
                      />
                    </div>
                    {offerErrors.precio && <p className="text-[11px] text-rose-600 font-medium">{offerErrors.precio}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Condición / Beneficio adicional</Label>
                    <input
                      type="text"
                      placeholder="Ej. Válido con carnet de estudiante, pago en cuotas..."
                      className="flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-slate-900 dark:text-white"
                      value={condiciones}
                      onChange={(e) => setCondiciones(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    onClick={handleAddAlternative}
                    disabled={addingAlternative}
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-5 shadow-sm font-semibold transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {addingAlternative ? 'Registrando...' : 'Añadir Oferta al Tablero'}
                  </Button>
                </div>
              </div>
            </section>

            {/* 2. Alternativas Ofrecidas */}
            <section>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">2</span>
                Ofertas Comerciales sobre la Mesa (Selecciona una propuesta)
              </h3>
              {(!lead.Solicitudes || lead.Solicitudes.length === 0 || !lead.Solicitudes[lead.Solicitudes.length - 1].Opciones || lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.length === 0) ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han generado ofertas comerciales para este paciente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.map((opt: any) => (
                    <div
                      key={opt.id_opcion}
                      onClick={() => setSelectedOpcion(opt.id_opcion)}
                      className={`relative p-4 border-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-3 ${selectedOpcion === opt.id_opcion
                          ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-md'
                          : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                        }`}
                    >
                      {selectedOpcion === opt.id_opcion && (
                        <div className="absolute -top-3 -right-3 bg-teal-600 rounded-full p-1 shadow-md z-10">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      )}

                      <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-200 text-xs bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/60 px-2.5 py-1 rounded-lg">
                          <Clock className="h-3.5 w-3.5 text-amber-500" />
                          Válido hasta: {opt.Disponibilidad?.fecha?.split('T')[0] || 'Vigente'}
                        </span>

                        {editingOptionId === opt.id_opcion ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-semibold text-slate-400">S/</span>
                            <input
                              type="number"
                              className="w-20 px-2 py-0.5 text-xs font-bold border border-teal-500 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                              value={editingPrice}
                              onChange={(e) => setEditingPrice(e.target.value)}
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveEdit(e, opt.id_opcion)}
                              disabled={savingEdit}
                              className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingOptionId(null); }}
                              className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className={`font-mono font-bold text-sm ${selectedOpcion === opt.id_opcion ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                              S/ {Number(opt.precio_ofrecido).toFixed(2)}
                            </span>
                            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                title="Editar tarifa"
                                onClick={(e) => { e.stopPropagation(); setEditingOptionId(opt.id_opcion); setEditingPrice(opt.precio_ofrecido?.toString() || ''); }}
                                className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950 transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                title="Eliminar alternativa"
                                onClick={(e) => { e.stopPropagation(); setDeletingOptionTarget(opt); }}
                                className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Sede: {opt.Disponibilidad?.Sede?.nombre || 'Todas las sedes'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Especialista: {opt.Disponibilidad?.Profesional?.apellidos ? `Esp. ${opt.Disponibilidad?.Profesional?.apellidos}` : 'Por asignar'}</span>
                        </div>
                      </div>

                      {opt.condiciones && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800 leading-tight">
                          {opt.condiciones}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* ── 3. Envío de Oferta Omnicanal & Generador Gráfico Canva (Actividad 3) ── */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-purple-200/80 dark:border-purple-900/60 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-purple-100 dark:border-purple-900/60 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[10px] font-bold">
                    3
                  </span>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    Envío de Oferta Omnicanal & Generador Canva
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 rounded-md border border-purple-200/60 dark:border-purple-800/60 flex items-center gap-1">
                  <CanvaIcon className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                  Canva Connect Autofill
                </span>
              </div>

              <div className="space-y-2.5">
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

                {/* Botones de acción planos sin shadow ni botón Copiar duplicado */}
                <div className="flex items-center gap-2 pt-1 flex-wrap">
                  <Button
                    type="button"
                    onClick={() => handleGenerateCanvaAndDispatch(false)}
                    disabled={generatingCanva}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs h-9 px-4 font-semibold flex items-center gap-2 cursor-pointer transition-all border-0 shadow-none"
                  >
                    <CanvaIcon className="w-4 h-4 shrink-0 text-white" />
                    <span>{generatingCanva ? 'Generando en Canva...' : 'Generar Flyer con Canva & Despachar'}</span>
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      const url = await leadService.getCanvaAuthUrl();
                      window.location.href = url;
                    }}
                    className="border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/50 rounded-xl text-xs h-9 px-3 font-semibold flex items-center gap-1.5 shadow-none"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                    <span>Conectar Canva</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 border-0 shadow-none"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>Enviar WhatsApp</span>
                  </Button>

                  <Button
                    type="button"
                    onClick={handleSendEmail}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs h-9 px-3.5 font-semibold flex items-center gap-1.5 border-0 shadow-none"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Enviar Correo</span>
                  </Button>
                </div>

                {/* ── Tarjeta de Visualización y Descarga del Flyer Oficial Canva ── */}
                <div className="mt-3 p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-slate-50/70 dark:from-purple-950/40 dark:via-indigo-950/20 dark:to-slate-900/60 border border-purple-200/80 dark:border-purple-800/60 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <CanvaIcon className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Flyer Publicitario Oficial Canva
                      </span>
                      {canvaResult ? (
                        <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-300 dark:border-emerald-800">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          Imagen Generada
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                          Pendiente de generación
                        </span>
                      )}
                    </div>

                    {canvaResult && (
                      <div className="flex items-center gap-2">
                        <a
                          href={canvaResult.downloadPngUrl || canvaResult.previewUrl}
                          download={`Flyer_NexoSalud_${lead?.nombres || 'Oferta'}.png`}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/50 flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Descargar Imagen</span>
                        </a>

                        {canvaResult.designUrl && canvaResult.designUrl !== 'https://www.canva.com/' && (
                          <a
                            href={canvaResult.designUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1.5 transition-colors shadow-2xs"
                          >
                            <span>Abrir en Canva</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Contenedor Visual de la Imagen del Flyer */}
                  {canvaResult?.previewUrl ? (
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-white/90 dark:bg-slate-900/90 p-3.5 rounded-xl border border-purple-100 dark:border-purple-900/40">
                      {/* Vista previa de la Imagen del Flyer */}
                      <div className="relative group shrink-0 max-w-[240px] sm:max-w-[270px] w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shadow-md bg-slate-950 flex items-center justify-center">
                        <img
                          src={canvaResult.previewUrl}
                          alt="Flyer Oficial Canva"
                          className="w-full h-auto max-h-[340px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                        />
                        <div className="absolute inset-0 bg-slate-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                          <span className="text-[11px] font-bold text-white bg-slate-900/80 px-2.5 py-1 rounded-lg backdrop-blur-xs flex items-center gap-1">
                            <ImageIcon className="w-3.5 h-3.5" /> Vista Previa
                          </span>
                        </div>
                      </div>

                      {/* Resumen de Datos Clave mapeados en el Flyer */}
                      <div className="flex-1 w-full space-y-2.5">
                        <div className="text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
                          <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                            Estructura Publicitaria Lista para Enviar:
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                              <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px]">Paciente:</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{lead?.nombres} {lead?.apellidos}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/60">
                              <span className="font-semibold text-slate-500 dark:text-slate-400 block text-[10px]">Tratamiento Ofertado:</span>
                              <span className="font-medium text-slate-800 dark:text-slate-200">{selectedOptData?.Disponibilidad?.Servicio?.nombre || 'Consulta Odontológica'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-teal-50/70 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/50">
                              <span className="font-semibold text-teal-600 dark:text-teal-400 block text-[10px]">Tarifa Promocional:</span>
                              <span className="font-bold text-teal-800 dark:text-teal-200 font-mono">S/ {selectedOptData ? Number(selectedOptData.precio_ofrecido).toFixed(2) : '150.00'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-purple-50/70 dark:bg-purple-950/40 border border-purple-200/70 dark:border-purple-800/50">
                              <span className="font-semibold text-purple-600 dark:text-purple-400 block text-[10px]">Sede de Atención:</span>
                              <span className="font-medium text-purple-800 dark:text-purple-200">{selectedOptData?.Disponibilidad?.Sede?.nombre || 'Sede Miraflores'}</span>
                            </div>
                          </div>
                        </div>

                        <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-center justify-between gap-2">
                          <span>Esta imagen se adjunta automáticamente al enviar por correo y puedes compartirla directamente por WhatsApp.</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6 px-4 rounded-xl border border-dashed border-purple-200 dark:border-purple-900/60 bg-white/50 dark:bg-slate-900/40 space-y-2">
                      <div className="flex justify-center">
                        <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-950/60 flex items-center justify-center text-purple-600 dark:text-purple-400">
                          <CanvaIcon className="w-5 h-5" />
                        </div>
                      </div>
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                        Aún no has generado el Flyer para este paciente
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                        Presiona el botón superior <strong className="text-purple-700 dark:text-purple-300">"Generar Flyer con Canva &amp; Despachar"</strong> para crear la imagen oficial con los datos del paciente y la oferta activa.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── 4. Copiloto de Detección y Apoyo ante Objeciones (Actividad 4) ── */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/90 border border-slate-200/90 dark:border-slate-700/80 space-y-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">
                    4
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
                      ? 'bg-teal-600 text-white border-teal-600'
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
                      ? 'bg-amber-600 text-white border-amber-600'
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
                      ? 'bg-indigo-600 text-white border-indigo-600'
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
                      className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1 border-0 shadow-none"
                    >
                      <GraduationCap className="w-3 h-3" />
                      Aplicar promoción (-15%)
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => applyQuickDiscount(20, 'CAMPANA')}
                      className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium flex items-center gap-1 border-0 shadow-none"
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
                    onClick={() => setSelectedFranja('Horario Flexible (A elección del paciente al confirmar)')}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs h-7 px-2.5 font-medium border-0 shadow-none"
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

            {/* Acción de Cierre */}
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <Button
                onClick={handleReserve}
                disabled={reserving || !selectedOpcion}
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-6 py-2.5 h-10"
              >
                {reserving ? 'Cerrando trato...' : 'Cerrar Trato (Pasar a PAYER)'}
                {!reserving && <ArrowRight className="h-4 w-4 ml-2" />}
              </Button>
            </div>
          </CardContent>
        </Card>
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
    </div>
  );
}
