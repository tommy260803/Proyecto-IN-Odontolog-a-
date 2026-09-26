import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { chatWithNegotiatorAgent, type NegotiatorChatContext } from '@/shared/services/groqService';
import { leadService } from '../services/lead.service';
import {
  Sparkles,
  Bot,
  User,
  Phone,
  Mail,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  CreditCard,
  Send,
  Loader2,
  AlertCircle,
  Stethoscope,
  ArrowRight,
  HeartHandshake,
  MessageSquare,
  Copy,
  Download,
  Users,
  Smile,
  Tag,
  Clock3,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  timestamp: string;
}

export default function PreReservationPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [offerData, setOfferData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [dni, setDni] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [esParaFamiliar, setEsParaFamiliar] = useState(false);
  const [nombreFamiliar, setNombreFamiliar] = useState('');
  const [parentesco, setParentesco] = useState('Hijo/a');
  const [selectedSedeId, setSelectedSedeId] = useState<number | string>('');
  const [fechaCita, setFechaCita] = useState('');
  const [horaCita, setHoraCita] = useState('');
  const [nivelDolor, setNivelDolor] = useState('Ninguno');
  const [alergias, setAlergias] = useState('');
  const [canalPago, setCanalPago] = useState('Efectivo en clínica');
  const [comentarios, setComentarios] = useState('');
  const [consentimiento, setConsentimiento] = useState(true);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [preReserveSuccess, setPreReserveSuccess] = useState<any>(null);

  // Chatbot states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Cargar datos de la oferta pública
  useEffect(() => {
    if (!id) return;
    const fetchOffer = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await leadService.getPublicOffer(id);
        setOfferData(data);
        setNombres(data.firstName || data.patientName || '');
        setApellidos(data.lastName || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        setDni(data.dni || '');
        setSelectedSedeId(data.sedeId || (data.sedes?.[0]?.id_sede || 1));
        setFechaCita(data.expirationDate || new Date().toISOString().split('T')[0]);
        setHoraCita(data.horaSugerida || '10:00');
        setNivelDolor(data.nivelDolor || 'Ninguno');
        setAlergias(data.alergias || '');

        // Mensaje inicial de la IA
        setChatMessages([
          {
            id: '1',
            sender: 'agent',
            text: `¡Hola ${data.firstName || data.patientName}! 👋 Soy la Dra. Sofía, asesora de NexoSalud. Hemos reservado para ti un beneficio exclusivo del ${data.discountPct}% de descuento en tu tratamiento de ${data.serviceName} a S/ ${Number(data.offeredPrice).toFixed(2)}. ¿Tienes alguna duda antes de confirmar tu turno?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (err: any) {
        console.error('Error fetching public offer:', err);
        setError(err.message || 'No se pudo cargar la información de la propuesta comercial.');
      } finally {
        setLoading(false);
      }
    };
    fetchOffer();
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, isAiTyping]);

  const handleSendMessage = async (customText?: string) => {
    const textToSend = (customText || userInput).trim();
    if (!textToSend || !offerData) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!customText) setUserInput('');
    setIsAiTyping(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const chatCtx: NegotiatorChatContext = {
        patientName: offerData.firstName || offerData.patientName,
        serviceName: offerData.serviceName,
        originalPrice: offerData.originalPrice,
        offeredPrice: offerData.offeredPrice,
        discountPct: offerData.discountPct,
        doctor: offerData.doctor,
        sede: offerData.sede,
        expirationDate: offerData.expirationDate,
      };

      const reply = await chatWithNegotiatorAgent(textToSend, history, chatCtx);

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: `¡Hola ${offerData.firstName || 'estimado paciente'}! Tu precio promocional de S/ ${Number(offerData.offeredPrice).toFixed(2)} está asegurado. Puedes completar los datos del formulario a continuación para formalizar tu turno.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsAiTyping(false);
    }
  };

  const handlePreReserveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offerData || !id) return;

    if (!dni || dni.trim().length < 8) {
      toast({
        title: 'DNI Requerido',
        description: 'Por favor ingresa un DNI válido de 8 dígitos para emitir tu reserva formal.',
        variant: 'destructive',
      });
      return;
    }

    if (!consentimiento) {
      toast({
        title: 'Consentimiento Requerido',
        description: 'Debes autorizar el contacto clínico para formalizar la reserva.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        dni: dni.trim(),
        nombres: nombres.trim(),
        apellidos: apellidos.trim(),
        numero: phone.trim(),
        email: email.trim(),
        esParaFamiliar,
        nombreFamiliar: esParaFamiliar ? nombreFamiliar.trim() : undefined,
        parentesco: esParaFamiliar ? parentesco : undefined,
        id_opcion: offerData.id_opcion,
        id_solicitud: offerData.id_solicitud,
        id_sede: Number(selectedSedeId) || offerData.sedeId,
        fecha: fechaCita,
        hora: horaCita,
        nivelDolor,
        alergias,
        canal_pago: canalPago,
        dudaOComentario: comentarios.trim(),
      };

      const result = await leadService.submitPublicPreReserve(id, payload);
      setPreReserveSuccess(result.data);
      toast({
        title: '¡Pre-Reserva Confirmada! 🎉',
        description: `Código: ${result.data?.codigoReserva || 'NEXO-CONFIRMADO'}. Hemos bloqueado tu tarifa por 48 horas.`,
      });
    } catch (err: any) {
      console.error('Error in pre-reserve submit:', err);
      toast({
        title: 'Error al procesar reserva',
        description: err.message || 'Ocurrió un inconveniente. Intenta nuevamente o contáctanos por WhatsApp.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const copyCodeToClipboard = () => {
    if (preReserveSuccess?.codigoReserva) {
      navigator.clipboard.writeText(preReserveSuccess.codigoReserva);
      toast({ title: '¡Código Copiado!', description: 'Se copió el código de reserva al portapapeles.' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          <Bot className="w-8 h-8 text-teal-600 absolute inset-0 m-auto" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Cargando tu Propuesta Personalizada...</h2>
        <p className="text-sm text-slate-500 mt-1">Conectando con el Agente Negociador de NexoSalud</p>
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Propuesta no disponible</h2>
        <p className="text-slate-600 max-w-md mb-6">
          {error || 'No pudimos localizar la propuesta comercial con este enlace. Es posible que haya expirado o ya fue atendida.'}
        </p>
        <Button
          onClick={() => window.open('https://wa.me/51970292710?text=Hola%20NexoSalud,%20deseo%20consultar%20sobre%20mi%20cita%20odontológica', '_blank')}
          className="bg-teal-600 hover:bg-teal-700 text-white gap-2 font-medium"
        >
          <Phone className="w-4 h-4" /> Consultar por WhatsApp (+51 970 292 710)
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-50/60 via-slate-50 to-slate-100 py-8 px-4 sm:px-6 lg:px-8 font-sans">
      <Toaster />
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Brand Header */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-emerald-500 text-white flex items-center justify-center shadow-md shadow-teal-500/20">
              <Stethoscope className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-black text-slate-900 tracking-tight">NexoSalud</span>
                <Badge variant="outline" className="border-teal-500 text-teal-700 bg-teal-50 text-[11px] font-semibold">
                  Clínica Dental Oficial
                </Badge>
              </div>
              <p className="text-xs text-slate-500">Portal Seguro de Negociación y Pre-Reserva Online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Oferta Verificada & Congelada
            </span>
          </div>
        </header>

        {/* Si ya se completó la pre-reserva, mostrar Voucher de Éxito */}
        {preReserveSuccess ? (
          <Card className="border-2 border-emerald-500 shadow-xl overflow-hidden bg-white max-w-2xl mx-auto animate-in fade-in-50 zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3 backdrop-blur-sm">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">¡Tu Pre-Reserva Está Confirmada! 🎉</h2>
              <p className="text-emerald-100 text-sm mt-1">
                Tu turno y tarifa congelada han quedado asegurados en nuestro sistema clínico.
              </p>
            </div>

            <CardContent className="p-6 space-y-6">
              {/* Código Destacado */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Código Oficial de Reserva</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-2xl font-mono font-black text-teal-700 tracking-wider">
                    {preReserveSuccess.codigoReserva}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyCodeToClipboard}
                    className="h-8 w-8 p-0 text-slate-500 hover:text-teal-700"
                    title="Copiar Código"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">Muestra este código al llegar a la clínica</p>
              </div>

              {/* Ficha Resumen de la Cita */}
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Paciente:</span>
                  <span className="font-semibold text-slate-800">
                    {nombres} {apellidos} {dni ? `(DNI: ${dni})` : ''}
                  </span>
                </div>
                {esParaFamiliar && nombreFamiliar && (
                  <div className="flex justify-between py-2 border-b border-slate-100 bg-amber-50/50 px-2 rounded">
                    <span className="text-amber-800 font-medium">Atención para familiar:</span>
                    <span className="font-semibold text-amber-900">{nombreFamiliar} ({parentesco})</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Tratamiento:</span>
                  <span className="font-semibold text-teal-700">{offerData.serviceName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Sede:</span>
                  <span className="font-medium text-slate-800">
                    {offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId))?.nombre || offerData.sede}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Fecha y Turno:</span>
                  <span className="font-medium text-slate-800">
                    {fechaCita} a las {horaCita} hrs
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500">Modalidad de Pago:</span>
                  <Badge variant="secondary" className="bg-slate-200 text-slate-800 font-medium">
                    {canalPago}
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-base font-bold text-slate-800">Total a abonar:</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-emerald-600">S/ {Number(offerData.offeredPrice).toFixed(2)}</span>
                    <span className="block text-[11px] text-slate-400 line-through">S/ {Number(offerData.originalPrice).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción final */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={() => {
                    const text = encodeURIComponent(
                      `¡Hola NexoSalud! Confirmé mi pre-reserva online.\n\n` +
                      `📋 *Código:* ${preReserveSuccess.codigoReserva}\n` +
                      `👤 *Paciente:* ${nombres} ${apellidos}\n` +
                      `🦷 *Tratamiento:* ${offerData.serviceName}\n` +
                      `💰 *Monto Promocional:* S/ ${Number(offerData.offeredPrice).toFixed(2)}\n` +
                      `💳 *Pago:* ${canalPago}\n` +
                      `📍 *Sede:* ${offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId))?.nombre || offerData.sede}`
                    );
                    window.open(`https://wa.me/51970292710?text=${text}`, '_blank');
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-base shadow-lg shadow-emerald-600/20 gap-2"
                >
                  <MessageSquare className="w-5 h-5" /> Enviar Voucher a WhatsApp de la Clínica
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full border-slate-300 text-slate-700 font-medium gap-2"
                >
                  <Download className="w-4 h-4" /> Imprimir o Guardar Comprobante PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Vista Principal: Banner Promocional + Chat Asesor + Formulario Wizard */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Columna Izquierda: Tarjeta de la Oferta + Chat con el Agente Negociador */}
            <div className="lg:col-span-6 space-y-6">
              {/* Tarjeta Visual de la Oferta */}
              <Card className="border border-teal-200 shadow-lg overflow-hidden bg-white">
                <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 p-5 text-white">
                  <div className="flex items-center justify-between gap-2">
                    <Badge className="bg-amber-400 text-slate-950 font-black hover:bg-amber-400 px-3 py-1 shadow-sm">
                      <Tag className="w-3.5 h-3.5 mr-1 inline" /> ¡{offerData.discountPct}% DSCTO. EXCLUSIVO!
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs text-teal-100 font-medium bg-white/10 px-2.5 py-1 rounded-full backdrop-blur-sm">
                      <Clock3 className="w-3.5 h-3.5" /> Vigencia 48h
                    </div>
                  </div>
                  <h1 className="text-2xl font-black mt-3 tracking-tight">{offerData.serviceName}</h1>
                  <p className="text-teal-100 text-xs mt-1 line-clamp-2">
                    {offerData.serviceDescription || 'Tratamiento odontológico integral con equipos de última tecnología y garantía NexoSalud.'}
                  </p>
                </div>

                <CardContent className="p-5 space-y-4">
                  {/* Comparativa de Precios */}
                  <div className="flex items-end justify-between bg-teal-50/60 p-4 rounded-xl border border-teal-100">
                    <div>
                      <span className="text-xs text-slate-500 font-medium block">Precio Regular:</span>
                      <span className="text-sm text-slate-400 line-through font-semibold">
                        S/ {Number(offerData.originalPrice).toFixed(2)}
                      </span>
                      <div className="text-xs font-bold text-emerald-700 mt-0.5">
                        Ahorras: S/ {(Number(offerData.originalPrice) - Number(offerData.offeredPrice)).toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold uppercase tracking-wider text-teal-800 block">Tarifa Promocional</span>
                      <span className="text-3xl font-black text-teal-900 tracking-tight">
                        S/ {Number(offerData.offeredPrice).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Detalles de la Oferta */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span className="text-slate-400 block font-medium">Sede</span>
                        <span className="font-semibold text-slate-700 truncate block">{offerData.sede}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                      <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                      <div>
                        <span className="text-slate-400 block font-medium">Atención por</span>
                        <span className="font-semibold text-slate-700 truncate block">{offerData.doctor}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chat Interactivo con el Agente Negociador (Dra. Sofía) */}
              <Card className="border border-slate-200 shadow-md bg-white flex flex-col h-[480px]">
                <CardHeader className="p-4 border-b border-slate-100 bg-slate-50/80 flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-full bg-teal-600 text-white flex items-center justify-center font-bold text-sm shadow">
                        👩‍⚕️
                      </div>
                      <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
                    </div>
                    <div>
                      <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        Dra. Sofía <Badge className="bg-teal-100 text-teal-800 text-[10px] font-semibold border-teal-200">Asesora IA</Badge>
                      </CardTitle>
                      <CardDescription className="text-[11px] text-slate-500">
                        En línea para resolver tus dudas sobre la oferta
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>

                {/* Área de Mensajes */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-slate-50/30">
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.sender === 'agent' && (
                        <div className="w-7 h-7 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 text-xs font-bold">
                          👩‍⚕️
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl p-3 leading-relaxed shadow-sm ${
                          msg.sender === 'user'
                            ? 'bg-teal-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-line">{msg.text}</p>
                        <span
                          className={`block text-[10px] mt-1 text-right ${
                            msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'
                          }`}
                        >
                          {msg.timestamp}
                        </span>
                      </div>
                    </div>
                  ))}

                  {isAiTyping && (
                    <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
                      <div className="w-6 h-6 rounded-full bg-teal-100 flex items-center justify-center">
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                      </div>
                      <span className="italic">Dra. Sofía está escribiendo...</span>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Preguntas Frecuentes Rápidas */}
                <div className="px-3 py-2 bg-slate-100/70 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
                  <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" /> Preguntas rápidas:
                  </span>
                  <button
                    onClick={() => handleSendMessage('¿El tratamiento causa dolor o molestias?')}
                    className="shrink-0 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
                  >
                    ¿Causa dolor?
                  </button>
                  <button
                    onClick={() => handleSendMessage('¿Qué formas de pago aceptan en la clínica?')}
                    className="shrink-0 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
                  >
                    ¿Formas de pago?
                  </button>
                  <button
                    onClick={() => handleSendMessage('¿Puedo transferir esta promoción a un familiar?')}
                    className="shrink-0 bg-white hover:bg-teal-50 text-slate-700 hover:text-teal-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors"
                  >
                    ¿Para familiar?
                  </button>
                </div>

                {/* Input para Escribir al Agente */}
                <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
                  <Input
                    placeholder="Hazle una consulta a la Dra. Sofía..."
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSendMessage();
                    }}
                    className="text-xs h-10 border-slate-300 focus-visible:ring-teal-500"
                  />
                  <Button
                    onClick={() => handleSendMessage()}
                    disabled={isAiTyping || !userInput.trim()}
                    className="bg-teal-600 hover:bg-teal-700 text-white h-10 px-4 shrink-0"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            </div>

            {/* Columna Derecha: Formulario Completo de Pre-Reserva */}
            <div className="lg:col-span-6">
              <Card className="border border-slate-200 shadow-xl bg-white overflow-hidden">
                <div className="bg-slate-900 p-5 text-white">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-teal-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                      1
                    </span>
                    <h2 className="text-lg font-black tracking-tight">Formulario de Pre-Reserva</h2>
                  </div>
                  <p className="text-slate-400 text-xs mt-1">
                    Completa tus datos para emitir tu código de atención y congelar tu tarifa sin cobro obligatorio por adelantado.
                  </p>
                </div>

                <form onSubmit={handlePreReserveSubmit} className="p-6 space-y-5">
                  {/* Sección 1: Datos Personales */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <User className="w-4 h-4 text-teal-600" /> Datos del Paciente Titular
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Nombres</Label>
                        <Input
                          required
                          value={nombres}
                          onChange={(e) => setNombres(e.target.value)}
                          placeholder="Tus nombres"
                          className="text-xs h-9 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Apellidos</Label>
                        <Input
                          required
                          value={apellidos}
                          onChange={(e) => setApellidos(e.target.value)}
                          placeholder="Tus apellidos"
                          className="text-xs h-9 mt-1"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                          <span>DNI / Carné Extranjería *</span>
                          <span className="text-[10px] text-teal-600 font-normal">Obligatorio</span>
                        </Label>
                        <Input
                          required
                          maxLength={8}
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                          placeholder="8 dígitos para ficha médica"
                          className="text-xs h-9 mt-1 font-mono tracking-wider"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">WhatsApp de Confirmación</Label>
                        <Input
                          required
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+51 970..."
                          className="text-xs h-9 mt-1"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Correo Electrónico (para voucher)</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className="text-xs h-9 mt-1"
                      />
                    </div>

                    {/* Checkbox para familiar */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="familiar"
                          checked={esParaFamiliar}
                          onCheckedChange={(checked) => setEsParaFamiliar(Boolean(checked))}
                        />
                        <Label htmlFor="familiar" className="text-xs font-medium text-slate-700 cursor-pointer">
                          ¿La cita médica es para un familiar / hijo / acompañante?
                        </Label>
                      </div>

                      {esParaFamiliar && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in-50">
                          <div>
                            <Label className="text-[11px] font-semibold text-slate-600">Nombre del Familiar</Label>
                            <Input
                              value={nombreFamiliar}
                              onChange={(e) => setNombreFamiliar(e.target.value)}
                              placeholder="Ej: Mateo Castillo"
                              className="text-xs h-8 mt-0.5"
                            />
                          </div>
                          <div>
                            <Label className="text-[11px] font-semibold text-slate-600">Parentesco</Label>
                            <Select value={parentesco} onValueChange={setParentesco}>
                              <SelectTrigger className="text-xs h-8 mt-0.5">
                                <SelectValue placeholder="Parentesco" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Hijo/a">Hijo/a</SelectItem>
                                <SelectItem value="Cónyuge / Pareja">Cónyuge / Pareja</SelectItem>
                                <SelectItem value="Padre / Madre">Padre / Madre</SelectItem>
                                <SelectItem value="Hermano/a">Hermano/a</SelectItem>
                                <SelectItem value="Otro">Otro familiar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sección 2: Cita, Sede y Antecedentes Odontológicos */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-teal-600" /> Coordinación de Cita & Sede
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Sede de Preferencia</Label>
                      <Select
                        value={String(selectedSedeId)}
                        onValueChange={(val) => setSelectedSedeId(val)}
                      >
                        <SelectTrigger className="text-xs h-9 mt-1">
                          <SelectValue placeholder="Selecciona la sede más cercana" />
                        </SelectTrigger>
                        <SelectContent>
                          {offerData.sedes && offerData.sedes.length > 0 ? (
                            offerData.sedes.map((s: any) => (
                              <SelectItem key={s.id_sede} value={String(s.id_sede)}>
                                {s.nombre} - {s.direccion || 'Atención integral'}
                              </SelectItem>
                            ))
                          ) : (
                            <SelectItem value={String(offerData.sedeId || 1)}>
                              {offerData.sede || 'Sede Principal NexoSalud'}
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Fecha Estimada</Label>
                        <Input
                          type="date"
                          value={fechaCita}
                          onChange={(e) => setFechaCita(e.target.value)}
                          className="text-xs h-9 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Turno Sugerido</Label>
                        <Select value={horaCita} onValueChange={setHoraCita}>
                          <SelectTrigger className="text-xs h-9 mt-1">
                            <SelectValue placeholder="Turno" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="09:00">Mañana (09:00 AM)</SelectItem>
                            <SelectItem value="11:00">Mañana (11:00 AM)</SelectItem>
                            <SelectItem value="15:00">Tarde (03:00 PM)</SelectItem>
                            <SelectItem value="17:00">Tarde (05:00 PM)</SelectItem>
                            <SelectItem value="19:00">Noche (07:00 PM)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Nivel de Molestia o Dolor</Label>
                        <Select value={nivelDolor} onValueChange={setNivelDolor}>
                          <SelectTrigger className="text-xs h-9 mt-1">
                            <SelectValue placeholder="Dolor actual" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Ninguno">Ninguno (Estética / Preventivo)</SelectItem>
                            <SelectItem value="Leve">Leve (Molestia al masticar)</SelectItem>
                            <SelectItem value="Moderado">Moderado</SelectItem>
                            <SelectItem value="Intenso">Intenso (Dolor agudo)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Alergias o Condiciones</Label>
                        <Input
                          value={alergias}
                          onChange={(e) => setAlergias(e.target.value)}
                          placeholder="Ej: Penicilina, ninguna..."
                          className="text-xs h-9 mt-1"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Sección 3: Modalidad de Pago y Confirmación */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <CreditCard className="w-4 h-4 text-teal-600" /> Modalidad de Pago Preferida
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setCanalPago('Efectivo en clínica')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          canalPago === 'Efectivo en clínica'
                            ? 'border-teal-600 bg-teal-50/70 text-teal-900 font-bold shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm mb-1">💵</span>
                        <span className="block font-semibold">En Clínica</span>
                        <span className="text-[10px] text-slate-500 font-normal">Pagas el día de tu cita</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Yape / Plin')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          canalPago === 'Yape / Plin'
                            ? 'border-teal-600 bg-teal-50/70 text-teal-900 font-bold shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm mb-1">📱</span>
                        <span className="block font-semibold">Yape / Plin</span>
                        <span className="text-[10px] text-slate-500 font-normal">Coordinado al llegar</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Tarjeta')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          canalPago === 'Tarjeta'
                            ? 'border-teal-600 bg-teal-50/70 text-teal-900 font-bold shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span className="block text-sm mb-1">💳</span>
                        <span className="block font-semibold">Tarjeta Déb/Cré</span>
                        <span className="text-[10px] text-slate-500 font-normal">POS sin recargo</span>
                      </button>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Duda o Comentario para el Odontólogo (Opcional)</Label>
                      <Input
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                        placeholder="Ej: Tengo sensibilidad dental o deseo consulta de brackets..."
                        className="text-xs h-9 mt-1"
                      />
                    </div>

                    <div className="flex items-start gap-2 pt-1">
                      <Checkbox
                        id="consent"
                        checked={consentimiento}
                        onCheckedChange={(c) => setConsentimiento(Boolean(c))}
                        className="mt-0.5"
                      />
                      <Label htmlFor="consent" className="text-[11px] text-slate-600 leading-snug cursor-pointer">
                        Autorizo a Clínica NexoSalud a contactarme por WhatsApp/Email para coordinar mi cita y confirmo que deseo congelar mi tarifa promocional.
                      </Label>
                    </div>
                  </div>

                  {/* Botón de Envío Final */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold h-12 rounded-xl text-sm shadow-lg shadow-teal-600/25 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Formalizando Pre-Reserva en el Sistema...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-5 h-5" />
                        Confirmar Pre-Reserva & Congelar Tarifa (S/ {Number(offerData.offeredPrice).toFixed(2)})
                      </>
                    )}
                  </Button>

                  <p className="text-[11px] text-center text-slate-400">
                    🔒 Tus datos están protegidos por el secreto médico y la Ley de Protección de Datos Personales N° 29733.
                  </p>
                </form>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
