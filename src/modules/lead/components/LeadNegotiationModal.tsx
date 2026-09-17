import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';
import { useToast } from '@/shared/hooks/use-toast';
import { ConfirmationDialog } from '@/shared/components/feedback/ConfirmationDialog';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { ErrorState } from '@/shared/components/feedback/ErrorState';

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
  Briefcase
} from 'lucide-react';

interface LeadNegotiationModalProps {
  leadId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LeadNegotiationModal({ leadId, isOpen, onClose }: LeadNegotiationModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [lead, setLead] = useState<any>(null);
  const [options, setOptions] = useState<any>({ profesionales: [], sedes: [], disponibilidades: [] });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [selectedOpcion, setSelectedOpcion] = useState<number | null>(null);
  const [selectedDisponibilidad, setSelectedDisponibilidad] = useState('');
  const [precioOfrecido, setPrecioOfrecido] = useState('150.00');
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [editingPrice, setEditingPrice] = useState<string>('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingOptionTarget, setDeletingOptionTarget] = useState<any | null>(null);
  const [isDeletingOption, setIsDeletingOption] = useState(false);

  useEffect(() => {
    if (isOpen && leadId) {
      fetchLeadData();
    }
  }, [isOpen, leadId]);

  const fetchLeadData = () => {
    if (!leadId) return;
    setLoading(true);
    Promise.all([
      leadService.getLeadDetails(leadId),
      leadService.getAvailabilityOptions()
    ])
    .then(([leadData, optionsData]) => {
      setLead(leadData);
      setOptions(optionsData);
    })
    .catch(console.error)
    .finally(() => setLoading(false));
  };

  const handleAddAlternative = async () => {
    if (!selectedDisponibilidad || !leadId) return;
    setAddingAlternative(true);
    const ultimaSolicitud = lead?.Solicitudes?.[lead.Solicitudes.length - 1];
    try {
      await leadService.addAlternative(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        id_disponibilidad: selectedDisponibilidad,
        precio_ofrecido: precioOfrecido
      });
      fetchLeadData();
      setSelectedDisponibilidad('');
      toast({ title: 'Alternativa Agregada', description: 'La opción de turno ha sido añadida al tablero.' });
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
    if (!selectedOpcion || !leadId) {
      toast({ title: 'Atención', description: 'Selecciona una de las alternativas del tablero antes de cerrar el trato.' });
      return;
    }
    
    const ultimaSolicitud = lead?.Solicitudes?.[lead.Solicitudes.length - 1];

    setReserving(true);
    try {
      await leadService.reserve(leadId, {
        id_solicitud: ultimaSolicitud?.id_solicitud || 1, 
        id_opcion: selectedOpcion
      });
      toast({ 
        title: '¡Trato Cerrado con Éxito! 🎉', 
        description: 'La reserva ha sido confirmada. El paciente pasa a la etapa PAYER para conciliación de pago.' 
      });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      onClose();
    } catch (error) {
      toast({ title: 'Error', description: 'Error al confirmar la reserva.', variant: 'destructive' });
    } finally {
      setReserving(false);
    }
  };

  if (!isOpen || !leadId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Fijo */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
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
                  Configura alternativas de horarios, tarifas y cierra el trato comercial.
                </p>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Cuerpo Scrolleable sin Scrollbar */}
        <div className="p-5 sm:p-6 overflow-y-auto no-scrollbar flex-1">
          {loading ? (
            <LoadingState />
          ) : !lead ? (
            <ErrorState message="No se encontró la oportunidad (LEAD)." />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Información del LEAD */}
              <div className="lg:col-span-1 space-y-4">
                <Card className="shadow-sm border-slate-200/90 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 rounded-xl">
                  <CardHeader className="border-b border-slate-200/80 dark:border-slate-700/80 pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                      <User className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      Perfil del Paciente
                    </CardTitle>
                    <CardDescription className="text-xs dark:text-slate-400">Contexto capturado en fase BUYER</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-slate-200/80 dark:divide-slate-700/80">
                    <div className="p-4 space-y-1">
                      <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Nombre Completo</Label>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{lead.nombres} {lead.apellidos}</p>
                    </div>
                    
                    <div className="p-4 space-y-2">
                      <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Contacto y Origen</Label>
                      <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                        {lead.email && (
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{lead.email}</span>
                          </div>
                        )}
                        {lead.numero && (
                          <div className="flex items-center gap-2">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            <span>{lead.numero}</span>
                          </div>
                        )}
                        {lead.Interacciones?.length > 0 && lead.Interacciones[0].Canal && (
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                            <span>Canal: {lead.Interacciones[0].Canal.nombre}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {lead.Solicitudes?.length > 0 && (
                      <div className="p-4 bg-teal-50/50 dark:bg-teal-950/30">
                        <Label className="text-[10px] font-bold text-teal-600 dark:text-teal-400 tracking-wider uppercase flex items-center gap-1.5 mb-1">
                          <Stethoscope className="h-3.5 w-3.5" />
                          Servicio Solicitado
                        </Label>
                        <p className="font-semibold text-slate-900 dark:text-white text-xs">
                          {lead.Solicitudes[lead.Solicitudes.length - 1].Servicio?.nombre || 'Servicio no especificado'}
                        </p>
                        {lead.Solicitudes[lead.Solicitudes.length - 1].motivo && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 italic">
                            "{lead.Solicitudes[lead.Solicitudes.length - 1].motivo}"
                          </p>
                        )}
                      </div>
                    )}
                    
                    {lead.Preferencias?.length > 0 && lead.Preferencias[0].sede_preferida && (
                      <div className="p-4 space-y-1">
                        <Label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-wider uppercase">Preferencias</Label>
                        <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 mt-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          <span>Sede preferida: {lead.Preferencias[0].sede_preferida}</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Panel de Alternativas y Cierre */}
              <div className="lg:col-span-2 space-y-6">
                {/* 1. Ofrecer Nueva Alternativa */}
                <div className="p-4 bg-white dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700/90 shadow-sm rounded-xl space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] font-bold">1</span>
                    Diseñar Oferta
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Disponibilidad en Agenda</Label>
                      <Select onValueChange={setSelectedDisponibilidad} value={selectedDisponibilidad}>
                        <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs h-9 rounded-xl">
                          <SelectValue placeholder="Selecciona un turno libre..." />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white">
                          {options.disponibilidades.map((disp: any) => (
                            <SelectItem key={disp.id_disponibilidad} value={disp.id_disponibilidad.toString()} className="text-xs">
                              {disp.fecha.split('T')[0]} | {disp.hora_inicio.substring(11, 16)} - {disp.hora_fin.substring(11, 16)} | {disp.Sede?.nombre} | Dr. {disp.Profesional?.apellidos}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-medium text-slate-600 dark:text-slate-400">Tarifa Ofrecida</Label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-2 text-slate-400 text-xs font-semibold">S/</span>
                        <input 
                          type="number" 
                          className="flex h-9 w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-7 pr-2 py-1 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-teal-500 font-semibold" 
                          value={precioOfrecido} 
                          onChange={(e) => setPrecioOfrecido(e.target.value)} 
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end pt-1">
                    <Button 
                      onClick={handleAddAlternative} 
                      disabled={addingAlternative || !selectedDisponibilidad} 
                      className="bg-slate-900 dark:bg-teal-600 hover:bg-slate-800 dark:hover:bg-teal-500 text-white rounded-xl text-xs h-8 px-3"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1.5" />
                      {addingAlternative ? 'Registrando...' : 'Añadir al Tablero'}
                    </Button>
                  </div>
                </div>

                {/* 2. Alternativas en Tablero */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-[10px] font-bold">2</span>
                    Alternativas sobre la Mesa
                  </h3>

                  {(!lead.Solicitudes || lead.Solicitudes.length === 0 || !lead.Solicitudes[lead.Solicitudes.length - 1].Opciones || lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.length === 0) ? (
                    <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
                      <p className="text-xs text-slate-400 dark:text-slate-500">Aún no se han ofrecido turnos al paciente.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.map((opt: any) => (
                        <div 
                          key={opt.id_opcion} 
                          onClick={() => setSelectedOpcion(opt.id_opcion)} 
                          className={`relative p-3.5 border-2 rounded-xl cursor-pointer transition-all flex flex-col justify-between gap-2.5 ${
                            selectedOpcion === opt.id_opcion 
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
                                  onClick={handleCancelEdit} 
                                  className="p-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 transition"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <p className={`font-mono font-bold text-sm ${selectedOpcion === opt.id_opcion ? 'text-teal-700 dark:text-teal-300' : 'text-slate-900 dark:text-white'}`}>
                                  S/ {opt.precio_ofrecido}
                                </p>
                                <div className="flex items-center gap-0.5 ml-1" onClick={(e) => e.stopPropagation()}>
                                  <button 
                                    title="Editar precio" 
                                    onClick={(e) => handleStartEdit(e, opt)} 
                                    className="p-1 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 dark:hover:bg-teal-950 transition"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                  <button 
                                    title="Eliminar alternativa" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeletingOptionTarget(opt);
                                    }} 
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
                              <Clock className="h-3 w-3 text-slate-400" />
                              <span>{opt.Disponibilidad?.hora_inicio.substring(11, 16)} - {opt.Disponibilidad?.hora_fin.substring(11, 16)}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              <span>{opt.Disponibilidad?.Sede?.nombre}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <User className="h-3 w-3 text-slate-400" />
                              <span>Dr. {opt.Disponibilidad?.Profesional?.apellidos}</span>
                            </div>
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

        {/* Footer Fijo con Botones */}
        <div className="p-4 sm:p-5 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-950/80 shrink-0 flex items-center justify-between gap-3 rounded-b-2xl">
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
      </DialogContent>
    </Dialog>
  );
}

