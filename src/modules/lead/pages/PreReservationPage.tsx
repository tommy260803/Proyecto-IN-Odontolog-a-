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
  Tag,
  Clock3,
  Banknote,
  Smartphone,
  ChevronDown,
  X,
  Minimize2,
  TrendingDown,
  Activity,
  ShieldAlert,
  FileCheck2,
  MessageCircle,
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

  // Chatbot flotante states
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [userInput, setUserInput] = useState('');
  const [isAiTyping, setIsAiTyping] = useState(false);
  const [unreadCount, setUnreadCount] = useState(1);
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

        // Mensaje inicial del Asistente NexoSalud
        setChatMessages([
          {
            id: '1',
            sender: 'agent',
            text: `¡Hola ${data.firstName || data.patientName}! Te doy la bienvenida a NexoSalud. Hemos congelado para ti una tarifa promocional de S/ ${Number(data.offeredPrice).toFixed(2)} con ${data.discountPct}% de descuento para tu atención de ${data.serviceName}. ¿Tienes alguna duda antes de confirmar tu turno?`,
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

  // Auto-scroll chat al recibir mensajes
  useEffect(() => {
    if (chatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiTyping, chatOpen]);

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
      if (!chatOpen) setUnreadCount((c) => c + 1);
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
        title: '¡Pre-Reserva Confirmada!',
        description: `Código: ${result.data?.codigoReserva || 'NEXO-CONFIRMADO'}. Tarifa congelada por 48 horas.`,
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
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-teal-200 border-t-teal-600 animate-spin" />
          <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-8 h-8 object-contain absolute inset-0 m-auto" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Cargando tu Propuesta Personalizada...</h2>
        <p className="text-xs text-slate-500 mt-1 font-medium">Conectando con la plataforma oficial de NexoSalud</p>
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">Propuesta no disponible</h2>
        <p className="text-slate-600 text-sm max-w-md mb-6 leading-relaxed">
          {error || 'No pudimos localizar la propuesta comercial con este enlace. Es posible que haya expirado o ya fue atendida.'}
        </p>
        <Button
          onClick={() => window.open('https://wa.me/51970292710?text=Hola%20NexoSalud,%20deseo%20consultar%20sobre%20mi%20cita%20odontológica', '_blank')}
          className="bg-teal-600 hover:bg-teal-700 text-white gap-2 font-semibold h-11 px-5 rounded-xl shadow-sm"
        >
          <Phone className="w-4 h-4" /> Consultar por WhatsApp (+51 970 292 710)
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 font-sans antialiased selection:bg-teal-500 selection:text-white pb-20">
      <Toaster />

      {/* ── HEADER SUPERIOR DE LA CLÍNICA ── */}
      <header className="bg-white border-b border-slate-200/80 sticky top-0 z-40 shadow-xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/Logo_NexoSalud.png" alt="Logo NexoSalud" className="h-9 w-auto object-contain" />
            <div className="hidden sm:block border-l border-slate-200 pl-3">
              <span className="text-xs font-bold text-slate-800 tracking-tight block">Portal de Pre-Reserva</span>
              <span className="text-[10px] text-teal-600 font-semibold uppercase tracking-wider block">Atención Odontológica Oficial</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200/80 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              Tarifa Congelada
            </span>
          </div>
        </div>
      </header>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* SI YA CONFIRMÓ: VOUCHER DE ÉXITO */}
        {preReserveSuccess ? (
          <Card className="border border-emerald-500/80 shadow-xl overflow-hidden bg-white max-w-2xl mx-auto rounded-3xl animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-6 text-white text-center">
              <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-3 backdrop-blur-sm shadow-inner">
                <CheckCircle2 className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-black tracking-tight">¡Tu Pre-Reserva Está Confirmada!</h2>
              <p className="text-emerald-100 text-xs mt-1 font-medium">
                Tu turno y tarifa promocional han quedado formalizados en el sistema clínico.
              </p>
            </div>

            <CardContent className="p-6 space-y-5">
              {/* Código Destacado */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Código Oficial de Atención</span>
                <div className="flex items-center justify-center gap-2 mt-1">
                  <span className="text-3xl font-mono font-black text-teal-700 tracking-wider">
                    {preReserveSuccess.codigoReserva}
                  </span>
                  <button
                    onClick={copyCodeToClipboard}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                    title="Copiar Código"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1 font-medium">Presenta este código al momento de tu llegada a recepción</p>
              </div>

              {/* Ficha Resumen de la Cita */}
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Paciente Titular:</span>
                  <span className="font-bold text-slate-800">
                    {nombres} {apellidos} {dni ? `(DNI: ${dni})` : ''}
                  </span>
                </div>
                {esParaFamiliar && nombreFamiliar && (
                  <div className="flex justify-between py-2 border-b border-slate-100 bg-sky-50/70 px-2.5 rounded-lg text-sky-950">
                    <span className="font-semibold">Atención para familiar:</span>
                    <span className="font-bold">{nombreFamiliar} ({parentesco})</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Tratamiento Clínico:</span>
                  <span className="font-bold text-teal-700">{offerData.serviceName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Sede:</span>
                  <span className="font-semibold text-slate-800">
                    {offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId))?.nombre || offerData.sede}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Fecha y Turno:</span>
                  <span className="font-semibold text-slate-800">
                    {fechaCita} a las {horaCita} hrs
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Modalidad de Pago:</span>
                  <span className="inline-flex items-center gap-1 font-bold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-md">
                    {canalPago}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-slate-900">Total a abonar en clínica:</span>
                  <div className="text-right">
                    <span className="text-2xl font-mono font-black text-emerald-600 block">S/ {Number(offerData.offeredPrice).toFixed(2)}</span>
                    <span className="text-[11px] font-mono text-slate-400 line-through">S/ {Number(offerData.originalPrice).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Botones de acción final */}
              <div className="space-y-2.5 pt-3">
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-sm shadow-md shadow-emerald-600/20 gap-2"
                >
                  <MessageSquare className="w-4 h-4" /> Enviar Voucher al WhatsApp de la Clínica
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full border-slate-300 text-slate-700 font-semibold gap-2 h-10 rounded-xl"
                >
                  <Download className="w-4 h-4" /> Imprimir o Guardar Comprobante PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* VISTA NORMAL: CARD DE OFERTA COMERCIAL + FORMULARIO COMPLETO */
          <div className="space-y-6">

            {/* ── CARD DESTACADO DE LA OFERTA COMERCIAL ── */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm relative overflow-hidden space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-emerald-50 text-emerald-800 border border-emerald-200">
                    <Tag className="w-3.5 h-3.5 inline mr-1 text-emerald-600" />
                    ¡{offerData.discountPct}% DSCTO. EXCLUSIVO!
                  </span>
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Clock3 className="w-3.5 h-3.5 text-amber-500" />
                    Vigencia de 48 horas
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[11px] font-semibold text-slate-400 block uppercase tracking-wider">Propuesta para</span>
                  <span className="text-sm font-bold text-slate-800">{offerData.firstName || offerData.patientName}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                <div className="md:col-span-7 space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
                    {offerData.serviceName}
                  </h1>
                  <p className="text-xs text-slate-600 leading-relaxed font-normal">
                    {offerData.serviceDescription || 'Atención odontológica integral con evaluación clínica completa, equipos digitales modernos y garantía NexoSalud.'}
                  </p>
                  <div className="flex flex-wrap gap-4 pt-2 text-xs text-slate-600">
                    <div className="flex items-center gap-1.5 font-medium">
                      <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{offerData.sede}</span>
                    </div>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                      <span>{offerData.doctor}</span>
                    </div>
                  </div>
                </div>

                <div className="md:col-span-5 bg-slate-50/80 rounded-2xl p-4 border border-slate-200/80 flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Tarifa Promocional Congelada</span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-mono font-black text-teal-700">
                      S/ {Number(offerData.offeredPrice).toFixed(2)}
                    </span>
                    <span className="text-sm font-mono text-slate-400 line-through">
                      S/ {Number(offerData.originalPrice).toFixed(2)}
                    </span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <TrendingDown className="w-3.5 h-3.5 text-emerald-600" />
                    Ahorras S/ {(Number(offerData.originalPrice) - Number(offerData.offeredPrice)).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* ── FORMULARIO PRINCIPAL DE PRE-RESERVA ── */}
            <Card className="border border-slate-200 shadow-sm bg-white rounded-3xl overflow-hidden">
              <div className="bg-slate-900 p-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                    <FileCheck2 className="w-5 h-5 text-teal-400" />
                    Formalización de Pre-Reserva Online
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Completa tus datos para emitir tu código de atención sin cobro obligatorio por adelantado.
                  </p>
                </div>
                <div className="shrink-0">
                  <Badge variant="outline" className="border-teal-500/60 text-teal-300 bg-teal-950/40 text-xs py-1">
                    Paso único de confirmación
                  </Badge>
                </div>
              </div>

              <form onSubmit={handlePreReserveSubmit} className="p-6 sm:p-8 space-y-6">

                {/* 1. Datos Personales */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <User className="w-4 h-4 text-teal-600" /> 1. Datos del Paciente Titular
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Nombres *</Label>
                      <Input
                        required
                        value={nombres}
                        onChange={(e) => setNombres(e.target.value)}
                        placeholder="Ingresa tus nombres"
                        className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 focus-visible:!border-teal-500 font-medium rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Apellidos *</Label>
                      <Input
                        required
                        value={apellidos}
                        onChange={(e) => setApellidos(e.target.value)}
                        placeholder="Ingresa tus apellidos"
                        className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 focus-visible:!border-teal-500 font-medium rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <div className="flex justify-between items-center">
                        <Label className="text-xs font-semibold text-slate-800">DNI / Carné Extranjería *</Label>
                        <span className="text-[10px] text-teal-700 font-bold">Obligatorio</span>
                      </div>
                      <Input
                        required
                        maxLength={8}
                        value={dni}
                        onChange={(e) => setDni(e.target.value.replace(/\D/g, ''))}
                        placeholder="8 dígitos para historia clínica"
                        className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 focus-visible:!border-teal-500 font-mono font-bold tracking-wider rounded-xl text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">WhatsApp de Confirmación *</Label>
                      <Input
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+51 970..."
                        className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 focus-visible:!border-teal-500 font-medium rounded-xl text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-800">Correo Electrónico (para comprobante digital)</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ejemplo@correo.com"
                      className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 focus-visible:!border-teal-500 font-medium rounded-xl text-xs"
                    />
                  </div>

                  {/* Atención para familiar */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2.5">
                      <Checkbox
                        id="familiar"
                        checked={esParaFamiliar}
                        onCheckedChange={(checked) => setEsParaFamiliar(Boolean(checked))}
                        className="rounded border-slate-300 data-[state=checked]:bg-teal-600"
                      />
                      <Label htmlFor="familiar" className="text-xs font-semibold text-slate-800 cursor-pointer">
                        ¿La atención odontológica es para un familiar / hijo / cónyuge?
                      </Label>
                    </div>

                    {esParaFamiliar && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 animate-in fade-in-50">
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-700">Nombre del Familiar</Label>
                          <Input
                            value={nombreFamiliar}
                            onChange={(e) => setNombreFamiliar(e.target.value)}
                            placeholder="Ej: Mateo Castillo"
                            className="h-9 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 font-medium text-xs rounded-xl"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] font-semibold text-slate-700">Parentesco</Label>
                          <Select value={parentesco} onValueChange={setParentesco}>
                            <SelectTrigger className="h-9 mt-1 !bg-white !text-slate-900 border-slate-300 hover:!bg-sky-50 hover:!border-sky-400 transition-colors text-xs rounded-xl font-medium">
                              <SelectValue placeholder="Parentesco" />
                            </SelectTrigger>
                            <SelectContent className="!bg-white border-slate-200">
                              <SelectItem value="Hijo/a" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs">Hijo/a</SelectItem>
                              <SelectItem value="Cónyuge / Pareja" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs">Cónyuge / Pareja</SelectItem>
                              <SelectItem value="Padre / Madre" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs">Padre / Madre</SelectItem>
                              <SelectItem value="Hermano/a" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs">Hermano/a</SelectItem>
                              <SelectItem value="Otro" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs">Otro familiar</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Coordinación de Cita y Sede */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <Calendar className="w-4 h-4 text-teal-600" /> 2. Coordinación de Cita & Sede
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-800">Sede Preferencial</Label>
                    <Select
                      value={String(selectedSedeId)}
                      onValueChange={(val) => setSelectedSedeId(val)}
                    >
                      <SelectTrigger className="h-10 mt-1 !bg-white !text-slate-900 border-slate-300 hover:!bg-sky-50 hover:!border-sky-400 transition-colors text-xs rounded-xl font-medium">
                        <SelectValue placeholder="Selecciona la sede más cercana" />
                      </SelectTrigger>
                      <SelectContent className="!bg-white border-slate-200">
                        {offerData.sedes && offerData.sedes.length > 0 ? (
                          offerData.sedes.map((s: any) => (
                            <SelectItem key={s.id_sede} value={String(s.id_sede)} className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">
                              {s.nombre} - {s.direccion || 'Atención integral'}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value={String(offerData.sedeId || 1)} className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">
                            {offerData.sede || 'Sede Principal NexoSalud'}
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Fecha Estimada</Label>
                      <Input
                        type="date"
                        value={fechaCita}
                        onChange={(e) => setFechaCita(e.target.value)}
                        className="h-10 mt-1 !bg-white !text-slate-900 !border-slate-300 font-medium text-xs rounded-xl"
                      />
                    </div>
                    <div>
                      <Label className="text-xs font-semibold text-slate-800">Turno Sugerido</Label>
                      <Select value={horaCita} onValueChange={setHoraCita}>
                        <SelectTrigger className="h-10 mt-1 !bg-white !text-slate-900 border-slate-300 hover:!bg-sky-50 hover:!border-sky-400 transition-colors text-xs rounded-xl font-medium">
                          <SelectValue placeholder="Turno" />
                        </SelectTrigger>
                        <SelectContent className="!bg-white border-slate-200">
                          <SelectItem value="09:00" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">Mañana (09:00 AM)</SelectItem>
                          <SelectItem value="11:00" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">Mañana (11:00 AM)</SelectItem>
                          <SelectItem value="15:00" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">Tarde (03:00 PM)</SelectItem>
                          <SelectItem value="17:00" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">Tarde (05:00 PM)</SelectItem>
                          <SelectItem value="19:00" className="hover:!bg-sky-50 hover:!text-sky-950 text-slate-800 text-xs font-medium">Noche (07:00 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Nivel de dolor en botones interactivos con hover celeste */}
                  <div>
                    <Label className="text-xs font-semibold text-slate-800 block mb-1.5">
                      ¿Presentas dolor o molestia dental actualmente?
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {[
                        { label: 'Ninguno (Preventivo)', val: 'Ninguno' },
                        { label: 'Leve (Sensibilidad)', val: 'Leve' },
                        { label: 'Moderado', val: 'Moderado' },
                        { label: 'Intenso (Agudo)', val: 'Intenso' },
                      ].map((item) => (
                        <button
                          key={item.val}
                          type="button"
                          onClick={() => setNivelDolor(item.val)}
                          className={`p-2.5 rounded-xl border text-xs font-medium text-center transition-all ${
                            nivelDolor === item.val
                              ? '!bg-sky-50/90 !border-sky-500 !text-sky-950 font-bold shadow-xs'
                              : '!bg-white !text-slate-700 !border-slate-200 hover:!bg-sky-50 hover:!border-sky-400 hover:!text-sky-900'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-800">Alergias o Condiciones Especiales (Opcional)</Label>
                    <Input
                      value={alergias}
                      onChange={(e) => setAlergias(e.target.value)}
                      placeholder="Ej: Penicilina, anestesia, ninguna..."
                      className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 font-medium text-xs rounded-xl"
                    />
                  </div>
                </div>

                {/* 3. Modalidad de Pago Preferida */}
                <div className="space-y-4 pt-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider border-b border-slate-100 pb-2">
                    <CreditCard className="w-4 h-4 text-teal-600" /> 3. Modalidad de Pago Preferida
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setCanalPago('Efectivo en clínica')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        canalPago === 'Efectivo en clínica'
                          ? '!bg-sky-50/90 !border-sky-500 !text-sky-950 font-bold shadow-xs'
                          : '!bg-white !text-slate-700 !border-slate-200 hover:!bg-sky-50 hover:!border-sky-400 hover:!text-sky-900'
                      }`}
                    >
                      <Banknote className="w-5 h-5 text-teal-600 mb-2" />
                      <span className="block font-bold text-xs">Efectivo en Clínica</span>
                      <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                        Abonas en recepción el día de tu cita
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCanalPago('Yape / Plin')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        canalPago === 'Yape / Plin'
                          ? '!bg-sky-50/90 !border-sky-500 !text-sky-950 font-bold shadow-xs'
                          : '!bg-white !text-slate-700 !border-slate-200 hover:!bg-sky-50 hover:!border-sky-400 hover:!text-sky-900'
                      }`}
                    >
                      <Smartphone className="w-5 h-5 text-purple-600 mb-2" />
                      <span className="block font-bold text-xs">Yape / Plin</span>
                      <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                        Transferencia digital sin comisiones
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCanalPago('Tarjeta')}
                      className={`p-4 rounded-2xl border text-left transition-all ${
                        canalPago === 'Tarjeta'
                          ? '!bg-sky-50/90 !border-sky-500 !text-sky-950 font-bold shadow-xs'
                          : '!bg-white !text-slate-700 !border-slate-200 hover:!bg-sky-50 hover:!border-sky-400 hover:!text-sky-900'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 text-sky-600 mb-2" />
                      <span className="block font-bold text-xs">Tarjeta Débito / Crédito</span>
                      <span className="text-[11px] text-slate-500 block font-normal mt-0.5">
                        POS físico en clínica sin recargo
                      </span>
                    </button>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold text-slate-800">Duda o Comentario para el Odontólogo (Opcional)</Label>
                    <Input
                      value={comentarios}
                      onChange={(e) => setComentarios(e.target.value)}
                      placeholder="Ej: Deseo consultar por brackets o tengo sensibilidad en molares..."
                      className="h-10 mt-1 !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 font-medium text-xs rounded-xl"
                    />
                  </div>

                  <div className="flex items-start gap-2.5 pt-2">
                    <Checkbox
                      id="consent"
                      checked={consentimiento}
                      onCheckedChange={(c) => setConsentimiento(Boolean(c))}
                      className="mt-0.5 rounded border-slate-300 data-[state=checked]:bg-teal-600"
                    />
                    <Label htmlFor="consent" className="text-xs text-slate-600 leading-snug cursor-pointer font-medium">
                      Autorizo a Clínica NexoSalud a contactarme por WhatsApp/Email para coordinar mi cita y confirmo que deseo congelar mi tarifa promocional.
                    </Label>
                  </div>
                </div>

                {/* BOTÓN SUBMIT */}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold h-12 rounded-xl text-sm shadow-md shadow-teal-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Emitiendo tu Pre-Reserva en el Sistema...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      Confirmar Pre-Reserva & Congelar Tarifa (S/ {Number(offerData.offeredPrice).toFixed(2)})
                    </>
                  )}
                </Button>

                <p className="text-[11px] text-center text-slate-400 font-medium">
                  🔒 Tus datos están protegidos por el secreto médico y la Ley de Protección de Datos Personales N° 29733.
                </p>
              </form>
            </Card>
          </div>
        )}
      </main>

      {/* ── ASISTENTE NEXOSALUD FLOTANTE (WIDGET MODERNO) ── */}
      <div className="fixed bottom-6 right-6 z-50">
        {chatOpen ? (
          /* Ventana del Chat Flotante Abierta */
          <div className="w-[360px] sm:w-[400px] h-[520px] max-h-[82vh] bg-white rounded-3xl border border-slate-200/90 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 zoom-in-95 duration-200 font-sans">
            {/* Header del Chat */}
            <div className="bg-gradient-to-r from-teal-700 to-teal-800 p-4 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 rounded-xl bg-white p-1 shadow flex items-center justify-center">
                    <img src="/Logo_NexoSalud.png" alt="Asistente NexoSalud" className="w-full h-full object-contain" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-teal-800 rounded-full"></span>
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-tight">Asistente NexoSalud</h3>
                  <p className="text-[11px] text-teal-200 font-medium">En línea • Asesor Virtual Oficial</p>
                </div>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1.5 rounded-lg text-teal-200 hover:text-white hover:bg-white/10 transition-colors"
                title="Minimizar Asistente"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensajes del Chat */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs bg-slate-50/50">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'agent' && (
                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 p-0.5 shadow-2xs shrink-0 flex items-center justify-center">
                      <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                    </div>
                  )}
                  <div
                    className={`max-w-[85%] rounded-2xl p-3 leading-relaxed shadow-xs ${
                      msg.sender === 'user'
                        ? 'bg-teal-600 text-white rounded-tr-none'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none font-medium'
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
                <div className="flex items-center gap-2 text-slate-500 text-xs pl-2">
                  <div className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center p-0.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  </div>
                  <span className="italic font-medium">Asistente NexoSalud está respondiendo...</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chips de Preguntas Frecuentes con hover celeste */}
            <div className="px-3 py-2 bg-slate-100/80 border-t border-slate-200/70 flex items-center gap-1.5 overflow-x-auto text-[11px] scrollbar-none">
              <span className="text-slate-400 font-semibold shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
              </span>
              <button
                onClick={() => handleSendMessage('¿El tratamiento causa dolor o molestias?')}
                className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 hover:border-sky-300 px-2.5 py-1 rounded-full border border-slate-200 font-medium transition-colors"
              >
                ¿Causa dolor?
              </button>
              <button
                onClick={() => handleSendMessage('¿Qué formas de pago aceptan en la clínica?')}
                className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 hover:border-sky-300 px-2.5 py-1 rounded-full border border-slate-200 font-medium transition-colors"
              >
                ¿Formas de pago?
              </button>
              <button
                onClick={() => handleSendMessage('¿Puedo transferir esta promoción a un familiar?')}
                className="shrink-0 bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-900 hover:border-sky-300 px-2.5 py-1 rounded-full border border-slate-200 font-medium transition-colors"
              >
                ¿Para familiar?
              </button>
            </div>

            {/* Input del Chat */}
            <div className="p-3 border-t border-slate-200 bg-white flex gap-2">
              <Input
                placeholder="Escribe tu consulta al Asistente..."
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSendMessage();
                }}
                className="h-10 text-xs !bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus-visible:!ring-teal-500 font-medium rounded-xl"
              />
              <Button
                onClick={() => handleSendMessage()}
                disabled={isAiTyping || !userInput.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white h-10 px-4 rounded-xl shrink-0 shadow-xs"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        ) : (
          /* Botón Flotante Cerrado (FAB) */
          <button
            onClick={() => {
              setChatOpen(true);
              setUnreadCount(0);
            }}
            className="flex items-center gap-3 bg-white hover:bg-slate-50 text-slate-900 pl-2.5 pr-4 py-2 rounded-full border border-slate-300 shadow-xl hover:shadow-2xl transition-all duration-200 group active:scale-[0.98]"
            title="Abrir Asistente NexoSalud"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-xs p-1 flex items-center justify-center">
                <img src="/Logo_NexoSalud.png" alt="Logo NexoSalud" className="w-full h-full object-contain" />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 tracking-tight">Asistente NexoSalud</span>
                {unreadCount > 0 && (
                  <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
                )}
              </div>
              <span className="text-[10px] text-teal-600 font-semibold block">¿Dudas? Chatea aquí</span>
            </div>
          </button>
        )}
      </div>
    </div>
  );
}
