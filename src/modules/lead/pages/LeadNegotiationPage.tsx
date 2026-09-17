import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { leadService } from '../services/lead.service';

import { CheckCircle2 } from 'lucide-react';

export default function LeadNegotiationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState<any>(null);
  const [options, setOptions] = useState<any>({ profesionales: [], sedes: [], disponibilidades: [] });
  const [loading, setLoading] = useState(true);
  const [reserving, setReserving] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [addingAlternative, setAddingAlternative] = useState(false);
  const [selectedOpcion, setSelectedOpcion] = useState<number | null>(null);
  const [selectedDisponibilidad, setSelectedDisponibilidad] = useState('');
  const [precioOfrecido, setPrecioOfrecido] = useState('150.00'); // Precio mockeado por ahora

  useEffect(() => {
    if (id) {
      fetchLeadData();
    }
  }, [id]);

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

  const handleAddAlternative = async () => {
    if (!selectedDisponibilidad) return;
    setAddingAlternative(true);
    const ultimaSolicitud = lead.Solicitudes[lead.Solicitudes.length - 1];
    try {
      await leadService.addAlternative(id!, {
        id_solicitud: ultimaSolicitud?.id_solicitud,
        id_disponibilidad: selectedDisponibilidad,
        precio_ofrecido: precioOfrecido
      });
      // Refrescar para ver la nueva opción
      fetchLeadData();
      setSelectedDisponibilidad('');
    } catch (error) {
      alert('Error al añadir la alternativa.');
    } finally {
      setAddingAlternative(false);
    }
  };

  const handleReserve = async () => {
    if (!selectedOpcion) return alert('Selecciona una opción ofrecida primero');
    
    const ultimaSolicitud = lead.Solicitudes[lead.Solicitudes.length - 1];

    setReserving(true);
    try {
      await leadService.reserve(id!, {
        id_solicitud: ultimaSolicitud?.id_solicitud || 1, 
        id_opcion: selectedOpcion
      });
      setIsSuccess(true);
    } catch (error) {
      alert('Error al confirmar la reserva.');
    } finally {
      setReserving(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-lg text-center border-t-4 border-t-emerald-500 animate-in fade-in zoom-in duration-300">
          <CardContent className="pt-10 pb-8 px-8 flex flex-col items-center">
            <div className="h-24 w-24 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle2 className="h-12 w-12 text-emerald-600" />
            </div>
            <h2 className="text-3xl font-bold text-slate-800 mb-3">¡Reserva Confirmada!</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              La alternativa de disponibilidad ha sido seleccionada con éxito y el paciente ha sido transferido a la etapa <span className="font-semibold text-emerald-700">PAYER</span>.
            </p>
            <Button 
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-6 text-lg font-medium shadow-md transition-all hover:shadow-lg"
              onClick={() => navigate(`/payer/${id}`)}
            >
              Ir a Pasarela de Pagos
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">Cargando datos de negociación...</div>;
  if (!lead) return <div className="p-8 text-center text-red-500">LEAD no encontrado.</div>;

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
      {/* Información del LEAD */}
      <div className="lg:col-span-1 space-y-6">
        <Card className="border-t-4 border-t-amber-500 shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Información del LEAD</CardTitle>
            <CardDescription>Datos capturados durante la fase BUYER</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs text-slate-500 uppercase">Nombre Completo</Label>
              <p className="font-medium text-slate-800">{lead.nombres} {lead.apellidos}</p>
            </div>
            <div>
              <Label className="text-xs text-slate-500 uppercase">Contacto</Label>
              <p className="text-sm text-slate-600">{lead.email || 'Sin email'}</p>
              <p className="text-sm text-slate-600">{lead.numero || 'Sin número'}</p>
            </div>
            {lead.Interacciones?.length > 0 && lead.Interacciones[0].Canal && (
              <div>
                <Label className="text-xs text-slate-500 uppercase">Canal de Origen</Label>
                <p className="text-sm text-slate-600">{lead.Interacciones[0].Canal.nombre}</p>
              </div>
            )}
            {lead.Preferencias?.length > 0 && (
              <div>
                <Label className="text-xs text-slate-500 uppercase">Preferencias Declaradas</Label>
                <ul className="text-sm text-slate-600 list-disc pl-4 mt-1">
                  {lead.Preferencias[0].sede_preferida && <li>Sede: {lead.Preferencias[0].sede_preferida}</li>}
                </ul>
              </div>
            )}
            {lead.Solicitudes?.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-md border border-amber-100">
                <Label className="text-xs text-amber-700 uppercase font-bold">Servicio Solicitado</Label>
                <p className="text-sm font-medium text-amber-900 mt-1">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Servicio?.nombre || 'Servicio no especificado'}
                </p>
                {lead.Solicitudes[lead.Solicitudes.length - 1].motivo && (
                  <>
                    <Label className="text-xs text-amber-700 uppercase font-bold mt-3 block">Observaciones / Motivo</Label>
                    <p className="text-xs text-amber-700 mt-1">{lead.Solicitudes[lead.Solicitudes.length - 1].motivo}</p>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Panel de Negociación */}
      <div className="lg:col-span-2">
        <Card className="h-full shadow-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Panel de Negociación</CardTitle>
            <CardDescription>Presenta alternativas y registra la reserva para convertir a PAYER.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            
            {/* 1. Ofrecer Nueva Alternativa */}
            <div className="p-4 bg-slate-50 border rounded-lg space-y-4">
              <h3 className="font-semibold text-slate-800">1. Ofrecer Nueva Alternativa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Disponibilidad</Label>
                  <Select onValueChange={setSelectedDisponibilidad} value={selectedDisponibilidad}>
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue placeholder="Elige un turno..." />
                    </SelectTrigger>
                    <SelectContent>
                      {options.disponibilidades.map((disp: any) => (
                        <SelectItem key={disp.id_disponibilidad} value={disp.id_disponibilidad.toString()}>
                          {disp.fecha.split('T')[0]} | {disp.hora_inicio.substring(11, 16)} - {disp.hora_fin.substring(11, 16)} | {disp.Sede?.nombre} | Dr. {disp.Profesional?.apellidos}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Precio Ofrecido (S/)</Label>
                  <input 
                    type="number" 
                    className="flex h-10 w-full rounded-md border border-input bg-white px-3 py-2 text-sm ring-offset-background" 
                    value={precioOfrecido} 
                    onChange={(e) => setPrecioOfrecido(e.target.value)} 
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={handleAddAlternative} 
                  disabled={addingAlternative || !selectedDisponibilidad} 
                  variant="secondary"
                  className="bg-slate-200 text-slate-800 hover:bg-slate-300"
                >
                  {addingAlternative ? 'Añadiendo...' : 'Añadir a las Opciones'}
                </Button>
              </div>
            </div>

            {/* 2. Alternativas Ofrecidas */}
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">2. Alternativas Ofrecidas</h3>
              {(!lead.Solicitudes || lead.Solicitudes.length === 0 || !lead.Solicitudes[lead.Solicitudes.length - 1].Opciones || lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.length === 0) ? (
                <p className="text-sm text-slate-500 italic">No se han ofrecido alternativas aún.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {lead.Solicitudes[lead.Solicitudes.length - 1].Opciones.map((opt: any) => (
                    <div 
                      key={opt.id_opcion} 
                      onClick={() => setSelectedOpcion(opt.id_opcion)} 
                      className={`p-4 border rounded-lg cursor-pointer transition-all flex items-center justify-between ${
                        selectedOpcion === opt.id_opcion 
                          ? 'bg-amber-50 border-amber-500 shadow-sm ring-1 ring-amber-500' 
                          : 'bg-white hover:border-amber-300 hover:shadow-sm'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-800">
                            {opt.Disponibilidad?.fecha.split('T')[0]}
                          </span>
                          <span className="text-sm text-slate-500">
                            ({opt.Disponibilidad?.hora_inicio.substring(11, 16)} - {opt.Disponibilidad?.hora_fin.substring(11, 16)})
                          </span>
                        </div>
                        <p className="text-sm text-slate-600">
                          {opt.Disponibilidad?.Sede?.nombre} • Dr. {opt.Disponibilidad?.Profesional?.apellidos}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-700 text-lg">S/ {opt.precio_ofrecido}</p>
                        {selectedOpcion === opt.id_opcion && (
                          <span className="text-xs font-semibold text-amber-600 uppercase">Seleccionada</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Confirmar Reserva */}
            <div className="pt-6 flex justify-end space-x-3 border-t">
              <Button variant="outline" onClick={() => navigate('/lead')}>Cancelar</Button>
              <Button 
                onClick={handleReserve} 
                disabled={reserving || !selectedOpcion}
                className="bg-amber-600 hover:bg-amber-700 text-white"
              >
                {reserving ? 'Registrando...' : 'Confirmar Reserva (Pasar a PAYER)'}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
