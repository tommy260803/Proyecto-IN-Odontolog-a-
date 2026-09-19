import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';
import {
  CheckCircle2, Calendar, Clock, MapPin, User, Plus, ArrowRight,
  Stethoscope, Mail, Phone, MessageSquare, Edit2, Trash2,
  Check, X, Briefcase, GraduationCap, Settings2, Activity,
  Building2, DollarSign, ChevronDown, ChevronRight, HeartPulse,
} from 'lucide-react';

import { InteractiveAvailabilityPicker } from './InteractiveAvailabilityPicker';

interface LeadNegotiationModalProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

// ── Helper: calcular edad ────────────────────────────────────────────────────
function calcAge(dob: string | null | undefined): string | null {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)).toString();
}

// ── Sub-componente: Fila de dato ─────────────────────────────────────────────
function DataRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
      <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
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

  // Form alternativa
  const [altServicioId, setAltServicioId] = useState('');
  const [altProfesionalId, setAltProfesionalId] = useState('');
  const [altSedeId, setAltSedeId] = useState('');
  const [altFecha, setAltFecha] = useState('');
  const [altDisponibilidadId, setAltDisponibilidadId] = useState('');
  const [altCustomTime, setAltCustomTime] = useState({ startTime: '09:00', endTime: '10:00' });
  const [isCustomMode, setIsCustomMode] = useState(false);
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

  const fetchData = () => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId),
      leadService.getAvailabilityOptions(),
    ])
      .then(([leadData, catData]) => { setLead(leadData); setCatalogs(catData); })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { if (isOpen && leadId) fetchData(); }, [isOpen, leadId]);

  const resetAltForm = () => {
    setAltServicioId(''); 
    setAltProfesionalId(''); 
    setAltSedeId('');
    setAltFecha(''); 
    setAltDisponibilidadId(''); 
    setAltCustomTime({ startTime: '09:00', endTime: '10:00' });
    setIsCustomMode(false);
    setAltPrecio('150.00');
    setAltCondiciones(''); 
    setOfferErrors({});
  };

  const handleAddAlternative = async () => {
    const errors: Record<string, string> = {};
    if (!isCustomMode && !altDisponibilidadId) {
      errors.disp = 'Por favor selecciona un horario disponible en el calendario interactivo.';
    }
    if (isCustomMode && !altFecha) {
      errors.disp = 'Selecciona una fecha en el calendario para el horario personalizado.';
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
    try {
      await leadService.addAlternative(leadId!, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        id_disponibilidad: (!isCustomMode && altDisponibilidadId) ? altDisponibilidadId : undefined,
        fecha: altFecha,
        hora_inicio: altCustomTime.startTime,
        hora_fin: altCustomTime.endTime,
        id_profesional: altProfesionalId || undefined,
        id_sede: altSedeId || undefined,
        precio_ofrecido: altPrecio,
        condiciones: altCondiciones,
      });
      fetchData();
      resetAltForm();
      toast({ title: 'Alternativa Agregada 🎉', description: 'La propuesta horaria ha sido añadida al tablero de negociación.' });
    } catch {
      toast({ title: 'Error', description: 'No se pudo añadir la alternativa.', variant: 'destructive' });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion || !leadId) { toast({ title: 'Atención', description: 'Selecciona una alternativa del tablero.' }); return; }
    const ultimaSolicitud = lead?.Solicitudes?.[0];
    setReserving(true);
    try {
      await leadService.reserve(leadId, { id_solicitud: ultimaSolicitud?.id_solicitud || 1, id_opcion: selectedOpcion });
      toast({ title: '¡Trato Cerrado! 🎉', description: 'El paciente pasa a la etapa PAYER.' });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally { setReserving(false); }
  };

  const handleSaveEdit = async (e: React.MouseEvent, id_opcion: number) => {
    e.stopPropagation();
    if (!editingPrice || isNaN(Number(editingPrice)) || Number(editingPrice) <= 0) {
      toast({ title: 'Precio Inválido', variant: 'destructive' }); return;
    }
    setSavingEdit(true);
    try {
      await leadService.updateAlternative(id_opcion, { precio_ofrecido: editingPrice });
      setEditingOptionId(null); fetchData();
      toast({ title: 'Tarifa Actualizada', description: `S/ ${Number(editingPrice).toFixed(2)}` });
    } catch {
      toast({ title: 'Error', description: 'Error al actualizar.', variant: 'destructive' });
    } finally { setSavingEdit(false); }
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
    } finally { setIsDeletingOption(false); setDeletingOptionTarget(null); }
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
                  Configura alternativas y cierra el trato comercial con el paciente.
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
                >
                  {!pref ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin preferencias registradas</p>
                  ) : (
                    <>
                      {pref.Horario && (
                        <DataRow
                          label="Horario preferido"
                          icon={<Clock className="h-3.5 w-3.5" />}
                          value={`${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][pref.Horario.dia_semana] || `Día ${pref.Horario.dia_semana}`} (${String(pref.Horario.hora_inicio).substring(11,16)} – ${String(pref.Horario.hora_fin).substring(11,16)})`}
                        />
                      )}
                      {pref.Canal && <DataRow label="Medio de comunicación preferido" icon={<MessageSquare className="h-3.5 w-3.5" />} value={pref.Canal.nombre} />}
                      {pref.Modalidad && <DataRow label="Modalidad preferida" icon={<Building2 className="h-3.5 w-3.5" />} value={pref.Modalidad.nombre} />}
                      {pref.sede_preferida && <DataRow label="Sede preferida" icon={<MapPin className="h-3.5 w-3.5" />} value={pref.sede_preferida} />}
                      {pref.profesional_preferido && <DataRow label="Profesional preferido" icon={<Stethoscope className="h-3.5 w-3.5" />} value={pref.profesional_preferido} />}
                    </>
                  )}
                </AccordionSection>

                {/* 3. Datos de estudiante — acordeón */}
                <AccordionSection
                  title="Datos de Estudiante"
                  subtitle="Historial académico actual"
                  icon={<GraduationCap className="h-3.5 w-3.5" />}
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
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">La persona no se encuentra matriculada actualmente en programas universitarios o de pregrado.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50">Estudiante activo</Badge>
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
                >
                  {!saludOdonto ? (
                    <p className="text-xs text-slate-400 dark:text-slate-500 italic">Sin historial odontológico registrado</p>
                  ) : (
                    <div className="space-y-2">
                      {/* Fila 1: Última visita + Motivo */}
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Última visita" icon={<Calendar className="h-3.5 w-3.5" />} value={saludOdonto.ultima_visita_odontologica} />
                        <DataRow label="Motivo de consulta" value={saludOdonto.motivo_consulta} />
                      </div>
                      {/* Fila 2: Tratamiento previo + Nivel dolor */}
                      <div className="grid grid-cols-2 gap-2">
                        <DataRow label="Tratamiento previo" value={saludOdonto.tratamiento_previo} />
                        <DataRow label="Nivel de dolor" value={saludOdonto.nivel_dolor} />
                      </div>
                      {/* Chips Sí/No */}
                      <div className="grid grid-cols-2 gap-1.5 pt-1">
                        <CondChip label="Sensibilidad" value={saludOdonto.presenta_sensibilidad} />
                        <CondChip label="Sangrado / Inflamación" value={saludOdonto.sangrado_o_inflamacion} />
                      </div>
                      {/* Fila 3: Aparato + Condición especial */}
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
              <div className="p-5 space-y-6 overflow-y-auto no-scrollbar">

                {/* Banner solicitud */}
                {ultimaSolicitud && (
                  <div className="p-4 rounded-xl bg-teal-50/80 dark:bg-teal-950/40 border border-teal-200/70 dark:border-teal-800/60">
                    <div className="flex items-center gap-2 mb-1">
                      <Stethoscope className="h-4 w-4 text-teal-600 dark:text-teal-400 shrink-0" />
                      <span className="text-xs font-bold text-teal-700 dark:text-teal-300 uppercase tracking-wide">Solicitud del Paciente</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{ultimaSolicitud.Servicio?.nombre || 'Servicio por definir'}</p>
                    {ultimaSolicitud.motivo && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">"{ultimaSolicitud.motivo}"</p>
                    )}
                  </div>
                )}

                {/* 1. Diseñar oferta */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] font-bold">1</span>
                    Diseñar Oferta
                  </h3>

                  <div className="space-y-4 p-4 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 rounded-xl shadow-sm">
                    {/* Servicio, Profesional, Sede */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Servicio</Label>
                        <Select onValueChange={(v) => { setAltServicioId(v); }} value={altServicioId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Seleccionar servicio..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            {catalogs.servicios?.map((s: any) => <SelectItem key={s.id_servicio} value={s.id_servicio.toString()} className="text-xs text-slate-900 dark:text-slate-100">{s.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Profesional</Label>
                        <Select onValueChange={(v) => { setAltProfesionalId(v); setAltDisponibilidadId(''); }} value={altProfesionalId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Todos los especialistas..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_PROFESSIONALS" className="font-semibold text-slate-900 dark:text-slate-100">Todos los especialistas</SelectItem>
                            {catalogs.profesionales?.map((p: any) => <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-slate-900 dark:text-slate-100">Esp. {p.nombres} {p.apellidos}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Sede</Label>
                        <Select onValueChange={(v) => { setAltSedeId(v); setAltDisponibilidadId(''); }} value={altSedeId}>
                          <SelectTrigger className="h-9 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                            <SelectValue placeholder="Todas las sedes..." />
                          </SelectTrigger>
                          <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                            <SelectItem value="ALL_SEDES" className="font-semibold text-slate-900 dark:text-slate-100">Todas las sedes</SelectItem>
                            {catalogs.sedes?.map((s: any) => <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-slate-900 dark:text-slate-100">{s.nombre}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Selector interactivo de calendario y horarios */}
                    <div className="pt-1">
                      <InteractiveAvailabilityPicker
                        disponibilidades={catalogs.disponibilidades || []}
                        profesionales={catalogs.profesionales || []}
                        sedes={catalogs.sedes || []}
                        selectedProfesionalId={altProfesionalId === 'ALL_PROFESSIONALS' ? '' : altProfesionalId}
                        selectedSedeId={altSedeId === 'ALL_SEDES' ? '' : altSedeId}
                        selectedDate={altFecha}
                        selectedDisponibilidadId={altDisponibilidadId}
                        customTime={altCustomTime}
                        isCustomMode={isCustomMode}
                        onSelectDate={(d) => { setAltFecha(d); setAltDisponibilidadId(''); }}
                        onSelectDisponibilidad={(id, disp) => {
                          setAltDisponibilidadId(id);
                          if (disp?.id_profesional && !altProfesionalId) setAltProfesionalId(disp.id_profesional.toString());
                          if (disp?.id_sede && !altSedeId) setAltSedeId(disp.id_sede.toString());
                          if (offerErrors.disp) setOfferErrors(p => ({ ...p, disp: '' }));
                        }}
                        onCustomTimeChange={(ct) => setAltCustomTime(ct)}
                        onToggleCustomMode={(mode) => {
                          setIsCustomMode(mode);
                          if (mode) setAltDisponibilidadId('');
                          if (offerErrors.disp) setOfferErrors(p => ({ ...p, disp: '' }));
                        }}
                        errorMessage={offerErrors.disp}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div className="space-y-1">
                        <Label className={`text-[11px] font-medium ${offerErrors.precio ? 'text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-400'}`}>Precio ofrecido (S/)</Label>
                        <div className="relative">
                          <DollarSign className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                          <input type="number" className={`flex h-9 w-full rounded-xl border pl-7 pr-3 text-xs text-slate-900 dark:text-white bg-slate-50 dark:bg-slate-800 focus:outline-none focus:ring-1 font-semibold ${offerErrors.precio ? '!border-rose-500 !ring-1 !ring-rose-500' : 'border-slate-200 dark:border-slate-700 focus:ring-teal-500'}`} value={altPrecio} onChange={(e) => { setAltPrecio(e.target.value); if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' })); }} />
                        </div>
                        {offerErrors.precio && <p className="text-[11px] text-rose-600 dark:text-rose-400 font-medium">{offerErrors.precio}</p>}
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Modalidad / Condiciones</Label>
                        <input type="text" className="flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500" placeholder="Ej. Presencial, pago en cuotas..." value={altCondiciones} onChange={(e) => setAltCondiciones(e.target.value)} />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <Button onClick={handleAddAlternative} disabled={addingAlternative} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-5 shadow-sm">
                        <Plus className="h-3.5 w-3.5 mr-1.5" />
                        {addingAlternative ? 'Registrando...' : 'Añadir al Tablero'}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* 2. Tablero de alternativas */}
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] font-bold">2</span>
                    Alternativas sobre la Mesa
                  </h3>

                  {opciones.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han ofrecido turnos al paciente.</p>
                      <p className="text-[11px] text-slate-300 dark:text-slate-600 mt-1">Usa el formulario de arriba para añadir una propuesta.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {opciones.map((opt: any) => (
                        <div
                          key={opt.id_opcion}
                          onClick={() => setSelectedOpcion(opt.id_opcion)}
                          className={`relative p-3.5 border-2 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${selectedOpcion === opt.id_opcion
                            ? 'bg-teal-50/50 dark:bg-teal-950/40 border-teal-600 dark:border-teal-500 shadow-sm'
                            : 'bg-white dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 hover:border-teal-300 dark:hover:border-teal-600'
                          }`}
                        >
                          {selectedOpcion === opt.id_opcion && (
                            <div className="absolute -top-2.5 -right-2.5 bg-teal-600 text-white rounded-full p-1 shadow-md z-10">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </div>
                          )}

                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/80 pb-2">
                            <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 dark:text-slate-200 text-xs bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                              <Calendar className="h-3 w-3 text-slate-400" />
                              {opt.Disponibilidad?.fecha.split('T')[0]}
                            </span>

                            {editingOptionId === opt.id_opcion ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <span className="text-[10px] font-semibold text-slate-400">S/</span>
                                <input type="number" className="w-16 px-1.5 py-0.5 text-xs font-bold border border-teal-500 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-white" value={editingPrice} onChange={(e) => setEditingPrice(e.target.value)} autoFocus />
                                <button onClick={(e) => handleSaveEdit(e, opt.id_opcion)} disabled={savingEdit} className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition"><Check className="h-3 w-3" /></button>
                                <button onClick={(e) => { e.stopPropagation(); setEditingOptionId(null); }} className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition"><X className="h-3 w-3" /></button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className={`font-mono font-bold text-sm ${selectedOpcion === opt.id_opcion ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                                  S/ {opt.precio_ofrecido}
                                </p>
                                <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                                  <button title="Editar precio" onClick={(e) => { e.stopPropagation(); setEditingOptionId(opt.id_opcion); setEditingPrice(opt.precio_ofrecido?.toString() || ''); }} className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950 transition"><Edit2 className="h-3 w-3" /></button>
                                  <button title="Eliminar alternativa" onClick={(e) => { e.stopPropagation(); setDeletingOptionTarget(opt); }} className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 transition"><Trash2 className="h-3 w-3" /></button>
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
                            <div className="flex items-center gap-1.5"><Clock className="h-3 w-3 text-slate-400" /><span>{String(opt.Disponibilidad?.hora_inicio).substring(11,16)} – {String(opt.Disponibilidad?.hora_fin).substring(11,16)}</span></div>
                            <div className="flex items-center gap-1.5"><MapPin className="h-3 w-3 text-slate-400" /><span>{opt.Disponibilidad?.Sede?.nombre}</span></div>
                            <div className="flex items-center gap-1.5"><User className="h-3 w-3 text-slate-400" /><span>Esp. {opt.Disponibilidad?.Profesional?.apellidos}</span></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
          <Button variant="ghost" className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300" onClick={onClose}>
            Pausar negociación
          </Button>
          <Button onClick={handleReserve} disabled={reserving || !selectedOpcion || !lead} className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl shadow-sm text-xs font-semibold px-5 py-2 h-9">
            {reserving ? 'Cerrando trato...' : 'Cerrar Trato (Pasar a PAYER)'}
            {!reserving && <ArrowRight className="h-3.5 w-3.5 ml-1.5" />}
          </Button>
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
      </DialogContent>
    </Dialog>
  );
}
