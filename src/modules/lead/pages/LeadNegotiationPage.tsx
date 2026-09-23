import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  format,
  addDays,
  startOfDay,
  parseISO,
  isBefore,
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
} from 'lucide-react';
import { InteractiveAvailabilityPicker } from '../components/InteractiveAvailabilityPicker';

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

  // Form states for alternative offer
  const [selectedServicioId, setSelectedServicioId] = useState('');
  const [selectedProfesionalId, setSelectedProfesionalId] = useState('');
  const [selectedSedeId, setSelectedSedeId] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDisponibilidad, setSelectedDisponibilidad] = useState('');
  const [customTime, setCustomTime] = useState({ startTime: '09:00', endTime: '10:00' });
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [condiciones, setCondiciones] = useState('');
  const [offerErrors, setOfferErrors] = useState<Record<string, string>>({});

  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

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

    const minAllowedDate = addDays(startOfDay(new Date()), 3);
    const minAllowedDateStr = format(minAllowedDate, 'yyyy-MM-dd');

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

    // 4. Fecha pre-seleccionada (mínimo 72h)
    if (!selectedDate) {
      const validDisps = (options.disponibilidades || []).filter((d: any) => {
        const dDate = (d.fecha || '').split('T')[0];
        if (!dDate) return false;
        try {
          return !isBefore(startOfDay(parseISO(dDate)), minAllowedDate);
        } catch {
          return false;
        }
      });
      if (validDisps.length > 0) {
        setSelectedDate(validDisps[0].fecha.split('T')[0]);
      } else {
        setSelectedDate(minAllowedDateStr);
      }
    }

    // 5. Precio oficial de lista & Descuento inteligente
    const activeServicio = options.servicios?.find((s: any) => s.id_servicio.toString() === initialServicioId);
    const officialPrice = Number(activeServicio?.Tarifas?.[0]?.precio || 180);
    const isStudent = lead.DatosAcademicos?.[0]?.aplica === true || Boolean(lead.DatosAcademicos?.[0]?.universidad);

    if (precioOfrecido === '150.00' || !precioOfrecido) {
      if (isStudent) {
        setPrecioOfrecido(Math.round(officialPrice * 0.85).toFixed(2));
      } else {
        setPrecioOfrecido(officialPrice.toFixed(2));
      }
    }
  }, [lead, options]);

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

  const applyQuickDiscount = (pct: number) => {
    const discounted = currentOfficialPrice * (1 - pct / 100);
    setPrecioOfrecido(discounted.toFixed(2));
    if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
  };

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    if (!isCustomMode && !selectedDisponibilidad) {
      errors.disp = 'Por favor selecciona un turno disponible en el calendario interactivo.';
    }
    if (isCustomMode && !selectedDate) {
      errors.disp = 'Selecciona una fecha en el calendario para el horario personalizado.';
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
    try {
      await leadService.addAlternative(id!, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        id_disponibilidad: (!isCustomMode && selectedDisponibilidad) ? selectedDisponibilidad : undefined,
        fecha: selectedDate,
        hora_inicio: customTime.startTime,
        hora_fin: customTime.endTime,
        id_profesional: (selectedProfesionalId && selectedProfesionalId !== 'ALL_PROFESSIONALS') ? selectedProfesionalId : undefined,
        id_sede: (selectedSedeId && selectedSedeId !== 'ALL_SEDES') ? selectedSedeId : undefined,
        precio_ofrecido: precioOfrecido,
        condiciones: condiciones,
      });
      fetchLeadData();
      setSelectedDisponibilidad('');
      setIsCustomMode(false);
      setCondiciones('');
      toast({ title: 'Alternativa Agregada 🎉', description: 'La propuesta horaria ha sido añadida al tablero de negociación.' });
    } catch {
      toast({ title: 'Error', description: 'Error al añadir la alternativa.', variant: 'destructive' });
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
      toast({ title: 'Alternativa Removida', description: 'La opción ha sido eliminada del tablero.' });
    } catch {
      toast({ title: 'Error', description: 'Error al eliminar la alternativa.', variant: 'destructive' });
    } finally {
      setIsDeletingOption(false);
      setDeletingOptionTarget(null);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion) {
      toast({ title: 'Atención', description: 'Selecciona una de las alternativas del tablero antes de cerrar el trato.' });
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
              {isStudent ? (
                <div className="space-y-1">
                  <Badge variant="outline" className="text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 flex items-center gap-1 font-bold w-fit">
                    <Award className="w-3 h-3" />
                    Estudiante Activo (-15% Convenio)
                  </Badge>
                  <p className="text-slate-700 dark:text-slate-300 pt-1 font-medium">{datAcad.universidad} - {datAcad.carrera} (Ciclo {datAcad.ciclo})</p>
                </div>
              ) : (
                <p className="text-slate-500 italic">No aplica convenio universitario.</p>
              )}
            </div>

            {/* Salud Odontológica */}
            {saludOdonto && (
              <div className="p-5 space-y-2 bg-slate-50/50 dark:bg-slate-900/40">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  Salud Odontológica & Urgencia
                </Label>
                <div className="grid grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Nivel de dolor:</span>
                    <span className={`font-bold ${hasUrgentPain ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
                      {saludOdonto.nivel_dolor || 'Ninguno'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Motivo:</span>
                    <span className="font-medium">{saludOdonto.motivo_consulta || 'Evaluación'}</span>
                  </div>
                </div>
              </div>
            )}

            {lead.Solicitudes?.length > 0 && (
              <div className="p-5 bg-teal-50/50 dark:bg-teal-950/30">
                <Label className="text-[10px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Servicio Solicitado en BUYER
                </Label>
                <p className="font-bold text-slate-900 dark:text-white text-sm">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Servicio?.nombre || 'Servicio Integral'}
                </p>
                {lead.Solicitudes[lead.Solicitudes.length - 1].motivo && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                    "{lead.Solicitudes[lead.Solicitudes.length - 1].motivo}"
                  </p>
                )}
              </div>
            )}
            
            {pref && (
              <div className="p-5 space-y-1.5">
                <Label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Preferencias Capturadas</Label>
                {pref.sede_preferida && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>Sede: {pref.sede_preferida}</span>
                  </div>
                )}
                {pref.profesional_preferido && (
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                    <Stethoscope className="h-3.5 w-3.5 text-slate-400" />
                    <span>Especialista: Esp. {pref.profesional_preferido}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ══ COLUMNA 2-3: Mesa de Negociación y Cierre ══ */}
      <div className="lg:col-span-2 space-y-6">

        {/* Tarjeta de Inteligencia Comercial & Scoring */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/95 via-slate-900 to-teal-950/95 text-white shadow-lg border border-teal-500/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Sparkles className="w-28 h-28 text-white" />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-800/60 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-teal-500/20 text-teal-300 border border-teal-400/30">
                  <Zap className="h-3.5 w-3.5" />
                </span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-teal-200">
                  Estrategia Comercial Recomendada & Matching
                </h4>
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold tracking-wide bg-teal-900/80 text-teal-200 border border-teal-500/40 shadow-sm select-none">
                <Sparkles className="w-3 h-3 text-teal-300" />
                <span>Inteligencia BUYER → LEAD</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-teal-800/50 hover:border-teal-500/60 transition-colors space-y-1">
                <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
                  <GraduationCap className="h-3.5 w-3.5 text-teal-400" />
                  <span>Perfil Académico</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-tight">
                  {isStudent
                    ? `Convenio activo (${datAcad?.universidad || 'Univ.'}). Descuento sugerido -15%.`
                    : 'Tarifa regular aplicable (No estudiante).'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-teal-800/50 hover:border-teal-500/60 transition-colors space-y-1">
                <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
                  <HeartPulse className="h-3.5 w-3.5 text-teal-400" />
                  <span>Prioridad Clínica</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-tight">
                  {hasUrgentPain
                    ? `Dolor ${saludOdonto?.nivel_dolor}. Priorizar agendamiento (mín. 72h).`
                    : 'Evaluación de rutina estándar.'}
                </p>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-teal-800/50 hover:border-teal-500/60 transition-colors space-y-1">
                <div className="flex items-center gap-1.5 text-teal-300 font-bold text-[11px]">
                  <MapPin className="h-3.5 w-3.5 text-teal-400" />
                  <span>Matching de Preferencias</span>
                </div>
                <p className="text-[11px] text-slate-200 leading-tight">
                  {pref?.sede_preferida || pref?.profesional_preferido
                    ? `Preferencia: Sede ${pref?.sede_preferida || 'Indif.'} / Esp. ${pref?.profesional_preferido || 'Indif.'}.`
                    : 'Disponibilidad libre de sede/médico.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-sm border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
          <CardHeader className="border-b dark:border-slate-800 bg-white dark:bg-slate-900 pb-5">
            <CardTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">Mesa de Negociación</CardTitle>
            <CardDescription className="text-xs">Diseña alternativas de oferta y cierra el trato comercial para enviar a cobranza.</CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-6">
            
            {/* 1. Ofrecer Nueva Alternativa */}
            <section>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">1</span>
                Diseñar Oferta
              </h3>
              <div className="p-5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-sm rounded-2xl space-y-4">
                {/* Servicio, Profesional y Sede */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Servicio</Label>
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
                      <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
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
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Profesional</Label>
                    <Select onValueChange={(v) => { setSelectedProfesionalId(v); setSelectedDisponibilidad(''); }} value={selectedProfesionalId}>
                      <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Todos los especialistas..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_PROFESSIONALS" className="font-semibold text-slate-900 dark:text-slate-100">Todos los especialistas</SelectItem>
                        {options.profesionales?.map((p: any) => (
                          <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-slate-900 dark:text-slate-100">
                            Esp. {p.nombres} {p.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Sede</Label>
                    <Select onValueChange={(v) => { setSelectedSedeId(v); setSelectedDisponibilidad(''); }} value={selectedSedeId}>
                      <SelectTrigger className="h-9 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Todas las sedes..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_SEDES" className="font-semibold text-slate-900 dark:text-slate-100">Todas las sedes</SelectItem>
                        {options.sedes?.map((s: any) => (
                          <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100">
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Calendario y Horarios Interactivos con Match Scoring */}
                <div className="pt-1">
                  <InteractiveAvailabilityPicker
                    disponibilidades={options.disponibilidades || []}
                    profesionales={options.profesionales || []}
                    sedes={options.sedes || []}
                    selectedProfesionalId={selectedProfesionalId === 'ALL_PROFESSIONALS' ? '' : selectedProfesionalId}
                    selectedSedeId={selectedSedeId === 'ALL_SEDES' ? '' : selectedSedeId}
                    selectedDate={selectedDate}
                    selectedDisponibilidadId={selectedDisponibilidad}
                    customTime={customTime}
                    isCustomMode={isCustomMode}
                    patientPreferences={{
                      sede: pref?.sede_preferida,
                      profesional: pref?.profesional_preferido,
                      horario: pref?.Horario ? {
                        dia_semana: pref.Horario.dia_semana,
                        hora_inicio: typeof pref.Horario.hora_inicio === 'string'
                          ? (pref.Horario.hora_inicio.includes('T') ? pref.Horario.hora_inicio.substring(11, 16) : pref.Horario.hora_inicio.substring(0, 5))
                          : undefined,
                        hora_fin: typeof pref.Horario.hora_fin === 'string'
                          ? (pref.Horario.hora_fin.includes('T') ? pref.Horario.hora_fin.substring(11, 16) : pref.Horario.hora_fin.substring(0, 5))
                          : undefined,
                      } : undefined,
                      horarioNombre: pref?.Horario ? `${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][pref.Horario.dia_semana]} (${String(pref.Horario.hora_inicio).substring(11,16)} - ${String(pref.Horario.hora_fin).substring(11,16)})` : undefined
                    }}
                    onSelectDate={(d) => { setSelectedDate(d); setSelectedDisponibilidad(''); }}
                    onSelectDisponibilidad={(idVal, disp) => {
                      setSelectedDisponibilidad(idVal);
                      if (disp?.id_profesional && (!selectedProfesionalId || selectedProfesionalId === 'ALL_PROFESSIONALS')) {
                        setSelectedProfesionalId(disp.id_profesional.toString());
                      }
                      if (disp?.id_sede && (!selectedSedeId || selectedSedeId === 'ALL_SEDES')) {
                        setSelectedSedeId(disp.id_sede.toString());
                      }
                      if (offerErrors.disp) setOfferErrors(p => ({ ...p, disp: '' }));
                    }}
                    onCustomTimeChange={(ct) => setCustomTime(ct)}
                    onToggleCustomMode={(mode) => {
                      setIsCustomMode(mode);
                      if (mode) setSelectedDisponibilidad('');
                      if (offerErrors.disp) setOfferErrors(p => ({ ...p, disp: '' }));
                    }}
                    errorMessage={offerErrors.disp}
                  />
                </div>

                {/* Comparador Financiero en Vivo & Descuentos Rápidos */}
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
                        onClick={() => applyQuickDiscount(15)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-200 transition-colors flex items-center gap-1"
                        title="Descuento de Convenio Estudiantil (-15%)"
                      >
                        <GraduationCap className="w-3 h-3" />
                        Estudiante (-15%)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickDiscount(20)}
                        className="px-2 py-1 rounded-lg text-[11px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 hover:bg-amber-200 transition-colors flex items-center gap-1"
                        title="Descuento especial por pronto pago (-20%)"
                      >
                        <Zap className="w-3 h-3" />
                        Campaña (-20%)
                      </button>
                      <button
                        type="button"
                        onClick={() => applyQuickDiscount(0)}
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

                {/* Tarifa y Condiciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="space-y-1">
                    <Label className={`text-xs font-medium ${offerErrors.precio ? 'text-rose-600' : 'text-slate-600 dark:text-slate-300'}`}>Tarifa Ofrecida Editable</Label>
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
                    <Label className="text-xs font-medium text-slate-600 dark:text-slate-300">Modalidad / Condiciones</Label>
                    <input 
                      type="text" 
                      placeholder="Ej. Convenio estudiante, pago en cuotas, presencial..." 
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
                    {addingAlternative ? 'Registrando...' : 'Añadir al Tablero'}
                  </Button>
                </div>
              </div>
            </section>

            {/* 2. Alternativas Ofrecidas */}
            <section>
              <h3 className="text-xs font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-600 text-white text-[10px] font-bold">2</span>
                Alternativas sobre la Mesa (Selecciona una propuesta)
              </h3>
              {(!lead.Solicitudes || lead.Solicitudes.length === 0 || !lead.Solicitudes[lead.Solicitudes.length - 1].Opciones || lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.length === 0) ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                  <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han ofrecido turnos al paciente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.map((opt: any) => (
                    <div 
                      key={opt.id_opcion} 
                      onClick={() => setSelectedOpcion(opt.id_opcion)} 
                      className={`relative p-4 border-2 rounded-2xl cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                        selectedOpcion === opt.id_opcion 
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
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-700 px-2.5 py-1 rounded-lg">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {opt.Disponibilidad?.fecha?.split('T')[0]}
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
                          <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{String(opt.Disponibilidad?.hora_inicio).substring(11, 16)} – {String(opt.Disponibilidad?.hora_fin).substring(11, 16)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>{opt.Disponibilidad?.Sede?.nombre}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Esp. {opt.Disponibilidad?.Profesional?.nombres} {opt.Disponibilidad?.Profesional?.apellidos}</span>
                        </div>
                      </div>

                      {opt.condiciones && (
                        <div className="text-[11px] text-slate-400 dark:text-slate-500 italic pt-1 border-t border-slate-100 dark:border-slate-800">
                          Condición: {opt.condiciones}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Acciones Finales de Mesa */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-3">
              <Button 
                variant="outline" 
                onClick={() => navigate('/lead')}
                className="rounded-xl text-xs font-semibold"
              >
                Volver al Listado
              </Button>
              <Button 
                onClick={handleReserve} 
                disabled={reserving || !selectedOpcion} 
                className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold px-6 shadow-md transition-all hover:shadow-lg"
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
        title="¿Remover alternativa del tablero?"
        description={`Se descartará la propuesta del turno ${deletingOptionTarget?.Disponibilidad?.fecha?.split('T')[0]} (Esp. ${deletingOptionTarget?.Disponibilidad?.Profesional?.apellidos}).`}
        confirmText="Sí, Remover Alternativa"
        cancelText="Conservar"
        variant="destructive"
      />
    </div>
  );
}
