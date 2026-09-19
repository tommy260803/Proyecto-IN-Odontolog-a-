import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
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
  DollarSign
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
        id_profesional: selectedProfesionalId || undefined,
        id_sede: selectedSedeId || undefined,
        precio_ofrecido: precioOfrecido,
        condiciones: condiciones,
      });
      fetchLeadData();
      setSelectedDisponibilidad('');
      setSelectedDate('');
      setIsCustomMode(false);
      setCondiciones('');
      toast({ title: 'Alternativa Agregada 🎉', description: 'La propuesta horaria ha sido añadida al tablero de negociación.' });
    } catch (error) {
      toast({ title: 'Error', description: 'Error al añadir la alternativa.', variant: 'destructive' });
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleStartEdit = (e: React.MouseEvent, opt: any) => {
    e.stopPropagation();
    setEditingOptionId(opt.id_opcion);
    setEditingPrice(opt.precio_ofrecido?.toString() || '150.00');
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
      toast({ title: 'Tarifa Actualizada', description: `Nueva tarifa establecida: S/ ${Number(editingPrice).toFixed(2)}` });
    } catch (error) {
      toast({ title: 'Error', description: 'Error al actualizar el precio de la alternativa.', variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingOptionId(null);
    setEditingPrice('');
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
      toast({ title: 'Alternativa Removida', description: 'La opción ha sido eliminada del tablero de negociación.' });
    } catch (error) {
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
    } catch (error) {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally {
      setReserving(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl text-center border-t-4 border-t-emerald-500 animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center">
            <div className="h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner ring-4 ring-emerald-50">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-3 tracking-tight">¡Trato Cerrado!</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              La reserva ha sido bloqueada exitosamente. El paciente ahora se encuentra en la etapa <span className="font-semibold text-emerald-700">PAYER</span> esperando la conciliación de su pago.
            </p>
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg font-medium shadow-md transition-all hover:shadow-lg hover:-translate-y-0.5"
              onClick={() => navigate(`/payer/${id}`)}
            >
              Ir a Pasarela de Pagos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center text-slate-500 animate-pulse">Preparando mesa de negociación...</div>;
  if (!lead) return <div className="p-8 text-center text-red-500">LEAD no encontrado.</div>;

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
      
      {/* Información del LEAD */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="h-full shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b pb-4">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-800">
              <User className="h-5 w-5 text-slate-500" />
              Perfil del Paciente
            </CardTitle>
            <CardDescription>Contexto capturado en fase BUYER</CardDescription>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100">
            <div className="p-5 space-y-1">
              <Label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Nombre Completo</Label>
              <p className="font-semibold text-slate-900 text-base">{lead.nombres} {lead.apellidos}</p>
            </div>
            
            <div className="p-5 space-y-3">
              <Label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Contacto y Origen</Label>
              <div className="space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span>{lead.email}</span>
                  </div>
                )}
                {lead.numero && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{lead.numero}</span>
                  </div>
                )}
                {lead.Interacciones?.length > 0 && lead.Interacciones[0].Canal && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MessageSquare className="h-4 w-4 text-slate-400" />
                    <span>{lead.Interacciones[0].Canal.nombre}</span>
                  </div>
                )}
              </div>
            </div>

            {lead.Solicitudes?.length > 0 && (
              <div className="p-5 bg-indigo-50/50">
                <Label className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5 mb-2">
                  <Stethoscope className="h-3.5 w-3.5" />
                  Servicio Solicitado
                </Label>
                <p className="font-medium text-indigo-950 text-sm">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Servicio?.nombre || 'Servicio no especificado'}
                </p>
                {lead.Solicitudes[lead.Solicitudes.length - 1].motivo && (
                  <p className="text-xs text-indigo-800/80 mt-2 leading-relaxed italic">
                    "{lead.Solicitudes[lead.Solicitudes.length - 1].motivo}"
                  </p>
                )}
              </div>
            )}
            
            {lead.Preferencias?.length > 0 && lead.Preferencias[0].sede_preferida && (
              <div className="p-5 space-y-1">
                <Label className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Preferencias</Label>
                <div className="flex items-center gap-2 text-sm text-slate-700 mt-1">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span>Sede preferida: {lead.Preferencias[0].sede_preferida}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panel de Negociación */}
      <div className="lg:col-span-2">
        <Card className="h-full shadow-sm border-slate-200 flex flex-col">
          <CardHeader className="border-b bg-white pb-5">
            <CardTitle className="text-2xl text-slate-800 tracking-tight">Mesa de Negociación</CardTitle>
            <CardDescription>Configura y ofrece alternativas para concretar la reserva.</CardDescription>
          </CardHeader>
          
          <CardContent className="p-6 space-y-8 flex-1">
            
            {/* 1. Ofrecer Nueva Alternativa */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-100 text-teal-700 text-xs font-bold">1</span>
                Diseñar Oferta
              </h3>
              <div className="p-5 bg-white border border-slate-200 shadow-sm rounded-xl space-y-4">
                {/* Filtro Profesional y Sede */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Profesional</Label>
                    <Select onValueChange={(v) => { setSelectedProfesionalId(v); setSelectedDisponibilidad(''); }} value={selectedProfesionalId}>
                      <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Todos los doctores..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_PROFESSIONALS" className="text-xs font-semibold text-teal-600 dark:text-teal-400">Todos los doctores</SelectItem>
                        {options.profesionales?.map((p: any) => (
                          <SelectItem key={p.id_profesional} value={p.id_profesional.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                            Dr/a. {p.nombres} {p.apellidos}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Sede</Label>
                    <Select onValueChange={(v) => { setSelectedSedeId(v); setSelectedDisponibilidad(''); }} value={selectedSedeId}>
                      <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-slate-100 font-medium [&>span]:text-slate-900 dark:[&>span]:text-slate-100">
                        <SelectValue placeholder="Todas las sedes..." />
                      </SelectTrigger>
                      <SelectContent className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <SelectItem value="ALL_SEDES" className="text-xs font-semibold text-teal-600 dark:text-teal-400">Todas las sedes</SelectItem>
                        {options.sedes?.map((s: any) => (
                          <SelectItem key={s.id_sede} value={s.id_sede.toString()} className="text-xs text-slate-900 dark:text-slate-100">
                            {s.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Mini-calendario y Horarios Interactivos */}
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
                    onSelectDate={(d) => { setSelectedDate(d); setSelectedDisponibilidad(''); }}
                    onSelectDisponibilidad={(id, disp) => {
                      setSelectedDisponibilidad(id);
                      if (disp?.id_profesional && !selectedProfesionalId) setSelectedProfesionalId(disp.id_profesional.toString());
                      if (disp?.id_sede && !selectedSedeId) setSelectedSedeId(disp.id_sede.toString());
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

                {/* Tarifa y Condiciones */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <Label className={`text-xs font-medium ${offerErrors.precio ? 'text-rose-600' : 'text-slate-600'}`}>Tarifa Ofrecida</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                      <input 
                        type="number" 
                        className={`flex h-10 w-full rounded-xl border bg-slate-50 pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 ${offerErrors.precio ? 'border-rose-500 ring-rose-500/20' : 'border-slate-200 focus:ring-teal-500/20 focus:border-teal-500'}`} 
                        value={precioOfrecido} 
                        onChange={(e) => {
                          setPrecioOfrecido(e.target.value);
                          if (offerErrors.precio) setOfferErrors(p => ({ ...p, precio: '' }));
                        }} 
                      />
                    </div>
                    {offerErrors.precio && <p className="text-[11px] text-rose-600 font-medium">{offerErrors.precio}</p>}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-600">Modalidad / Condiciones</Label>
                    <input 
                      type="text" 
                      placeholder="Ej. Presencial, pago en cuotas..." 
                      className="flex h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                      value={condiciones} 
                      onChange={(e) => setCondiciones(e.target.value)} 
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button 
                    onClick={handleAddAlternative} 
                    disabled={addingAlternative} 
                    className="bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs h-9 px-5 shadow-sm transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1.5" />
                    {addingAlternative ? 'Registrando...' : 'Añadir al tablero'}
                  </Button>
                </div>
              </div>
            </section>

            {/* 2. Alternativas Ofrecidas */}
            <section>
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs">2</span>
                Alternativas sobre la Mesa
              </h3>
              {(!lead.Solicitudes || lead.Solicitudes.length === 0 || !lead.Solicitudes[lead.Solicitudes.length - 1].Opciones || lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.length === 0) ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <p className="text-sm text-slate-500">Aún no se han ofrecido turnos al paciente.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.map((opt: any) => (
                    <div 
                      key={opt.id_opcion} 
                      onClick={() => setSelectedOpcion(opt.id_opcion)} 
                      className={`relative p-4 border-2 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-3 ${
                        selectedOpcion === opt.id_opcion 
                          ? 'bg-indigo-50/50 border-indigo-600 shadow-sm' 
                          : 'bg-white border-slate-200 hover:border-indigo-300 hover:shadow-sm'
                      }`}
                    >
                      {selectedOpcion === opt.id_opcion && (
                        <div className="absolute -top-3 -right-3 bg-indigo-600 rounded-full p-1 shadow-md z-10">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                        <span className="inline-flex items-center gap-1.5 font-bold text-slate-800 text-sm bg-slate-100 px-2.5 py-1 rounded-md">
                          <Calendar className="h-4 w-4 text-slate-500" />
                          {opt.Disponibilidad?.fecha.split('T')[0]}
                        </span>
                        
                        {editingOptionId === opt.id_opcion ? (
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <span className="text-xs font-semibold text-slate-500">S/</span>
                            <input 
                              type="number" 
                              step="1"
                              className="w-20 px-2 py-1 text-sm font-bold border border-indigo-400 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" 
                              value={editingPrice} 
                              onChange={(e) => setEditingPrice(e.target.value)} 
                              autoFocus 
                            />
                            <button 
                              title="Guardar precio" 
                              onClick={(e) => handleSaveEdit(e, opt.id_opcion)} 
                              disabled={savingEdit} 
                              className="p-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button 
                              title="Cancelar edición" 
                              onClick={handleCancelEdit} 
                              className="p-1.5 rounded-md bg-slate-200 text-slate-700 hover:bg-slate-300 transition"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <p className={`font-bold text-xl ${selectedOpcion === opt.id_opcion ? 'text-indigo-700' : 'text-slate-700'}`}>
                              S/ {opt.precio_ofrecido}
                            </p>
                            <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
                              <button 
                                title="Editar precio" 
                                onClick={(e) => handleStartEdit(e, opt)} 
                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </button>
                              <button 
                                title="Eliminar del tablero" 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingOptionTarget(opt);
                                }} 
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <span className="flex items-center gap-2 font-medium text-slate-600 text-sm">
                          <Clock className="h-4 w-4 text-slate-400" />
                          {opt.Disponibilidad?.hora_inicio.substring(11, 16)} - {opt.Disponibilidad?.hora_fin.substring(11, 16)}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-slate-500">
                          <MapPin className="h-4 w-4 text-slate-400" />
                          {opt.Disponibilidad?.Sede?.nombre}
                        </span>
                        <span className="flex items-center gap-2 text-sm text-slate-500">
                          <User className="h-4 w-4 text-slate-400" />
                          Dr. {opt.Disponibilidad?.Profesional?.apellidos}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </CardContent>

          {/* Confirmar Reserva */}
          <div className="p-6 bg-slate-50 border-t flex justify-end items-center gap-3 rounded-b-xl mt-auto">
            <Button variant="ghost" className="text-slate-500 hover:text-slate-700" onClick={() => navigate('/lead')}>
              Pausar negociación
            </Button>
            <Button 
              onClick={handleReserve} 
              disabled={reserving || !selectedOpcion}
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center gap-2 pl-5 pr-4"
            >
              {reserving ? 'Cerrando trato...' : 'Cerrar Trato (Pasar a PAYER)'}
              {!reserving && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </Card>
      </div>

      {/* Modal Confirmación Eliminación de Alternativa */}
      <ConfirmationDialog
        isOpen={!!deletingOptionTarget}
        onClose={() => setDeletingOptionTarget(null)}
        onConfirm={handleConfirmDeleteOption}
        isLoading={isDeletingOption}
        title="¿Remover alternativa del tablero?"
        description={`Se descartará la propuesta del turno ${deletingOptionTarget?.Disponibilidad?.fecha?.split('T')[0]} (Dr. ${deletingOptionTarget?.Disponibilidad?.Profesional?.apellidos}) de la mesa de negociación.`}
        confirmText="Sí, Remover Alternativa"
        cancelText="Conservar"
        variant="destructive"
      />
    </div>
  );
}
