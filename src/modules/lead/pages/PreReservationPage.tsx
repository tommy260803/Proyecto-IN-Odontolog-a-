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
  MessageSquare,
  Copy,
  Download,
  Users,
  Smile,
  Tag,
  Clock3,
  X,
  Banknote,
  QrCode,
  Check,
  FileText,
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
  const [horaCita, setHoraCita] = useState('09:00 - 13:00 (Mañana)');
  const [nivelDolor, setNivelDolor] = useState('Ninguno (Preventivo)');
  const [alergias, setAlergias] = useState('');
  const [canalPago, setCanalPago] = useState('Efectivo en clínica');
  const [comentarios, setComentarios] = useState('');
  const [consentimiento, setConsentimiento] = useState(true);

  // Submitting state
  const [submitting, setSubmitting] = useState(false);
  const [preReserveSuccess, setPreReserveSuccess] = useState<any>(null);

  // Floating Chatbot states
  const [isChatOpen, setIsChatOpen] = useState(false);
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

        // Mensaje de bienvenida inicial del Asistente NexoSalud
        const patientGreeting = data.firstName ? `¡Hola ${data.firstName}!` : '¡Hola!';
        setChatMessages([
          {
            id: 'welcome',
            sender: 'agent',
            text: `${patientGreeting} Soy tu Asistente de NexoSalud. Estoy aquí para acompañarte en tu reserva del tratamiento de ${data.serviceName || 'odontología'}. ¿Tienes alguna consulta sobre la cobertura, las sedes o las formas de pago?`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          },
        ]);
      } catch (err: any) {
        console.error('Error loading public offer:', err);
        setError('No pudimos cargar la oferta médica. El enlace puede haber vencido o ser inválido.');
      } finally {
        setLoading(false);
      }
    };
    fetchOffer();
  }, [id]);

  useEffect(() => {
    if (isChatOpen) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAiTyping, isChatOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || userInput).trim();
    if (!text || isAiTyping || !offerData) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setUserInput('');
    setIsAiTyping(true);

    try {
      const chatContext: NegotiatorChatContext = {
        patientName: nombres || offerData.firstName || offerData.patientName,
        serviceName: offerData.serviceName,
        offeredPrice: Number(offerData.offeredPrice),
        originalPrice: Number(offerData.originalPrice),
        discountPct: offerData.discountPct,
        doctor: offerData.doctor,
        sede: offerData.sede,
        expirationDate: offerData.expirationDate,
      };

      const history = chatMessages.map((m) => ({
        role: m.sender === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.text,
      }));

      const aiReply = await chatWithNegotiatorAgent(text, history, chatContext);

      const agentMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setChatMessages((prev) => [...prev, agentMsg]);
    } catch (err) {
      console.error('Error communicating with AI negotiator:', err);
      const fallbackMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'agent',
        text: 'Nuestra tarifa promocional incluye diagnóstico completo y esterilización garantizada. Puedes completar el formulario para congelar tu precio ahora.',
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
        description: 'Por favor ingresa un DNI o documento válido de al menos 8 dígitos.',
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-md flex items-center justify-center p-2 mb-4 animate-bounce">
          <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
        </div>
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin mb-3" />
        <p className="text-slate-800 font-semibold text-sm">Cargando tu propuesta personalizada...</p>
        <p className="text-slate-400 text-xs mt-1">Conectando con NexoSalud Dental</p>
      </div>
    );
  }

  if (error || !offerData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-lg bg-white">
          <CardHeader className="text-center pb-2">
            <div className="w-14 h-14 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-2 border border-red-100">
              <AlertCircle className="w-7 h-7" />
            </div>
            <CardTitle className="text-xl font-bold text-slate-800">Oferta no disponible</CardTitle>
            <CardDescription className="text-slate-500 text-xs">
              {error || 'El enlace que seguiste no es válido o ha expirado.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              Si recibiste esta oferta por correo o WhatsApp, puedes solicitar que nuestro equipo comercial te envíe una propuesta actualizada.
            </p>
            <Button
              onClick={() => window.open('https://wa.me/51970292710?text=Hola,%20deseo%20consultar%20por%20una%20oferta%20odontológica', '_blank')}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-11 rounded-xl gap-2 shadow"
            >
              <MessageSquare className="w-4 h-4" /> Contactar por WhatsApp
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900 antialiased pb-24">
      <Toaster />

      {/* Barra de Navegación Clínica Superior */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-100 shadow-xs flex items-center justify-center p-1 overflow-hidden">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900 block leading-tight">
                NexoSalud <span className="text-teal-600 font-bold">Dental</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium block leading-tight">
                Portal Oficial de Pre-Reserva
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold text-xs py-1 px-3 gap-1.5 shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Tarifa Oficial Garantizada</span>
              <span className="sm:hidden">Tarifa Congelada</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Contenedor Principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-6 space-y-6">

        {/* Vista de Éxito / Comprobante Oficial si ya pre-reservó */}
        {preReserveSuccess ? (
          <Card className="border border-emerald-200 shadow-xl overflow-hidden bg-white animate-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 p-6 sm:p-8 text-white text-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <Badge className="bg-emerald-400 text-slate-950 font-black px-3 py-1 mb-2 hover:bg-emerald-400 shadow-sm text-xs uppercase tracking-wider">
                Pre-Reserva Registrada Exitosamente
              </Badge>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight mt-1">¡Felicitaciones, {nombres}!</h2>
              <p className="text-teal-100 text-xs sm:text-sm mt-1 max-w-lg mx-auto">
                Tu cupo y descuento promocional para <span className="font-bold text-white underline">{offerData.serviceName}</span> han quedado congelados por 48 horas en nuestra central clínica.
              </p>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Código de Pre-Reserva */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                <div>
                  <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider block">Código Único de Atención</span>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-wider">
                    {preReserveSuccess.codigoReserva || 'NEXO-PROMO'}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyCodeToClipboard}
                  className="bg-white border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 gap-1.5 shadow-2xs"
                >
                  <Copy className="w-4 h-4" /> Copiar Código
                </Button>
              </div>

              {/* Resumen del Comprobante */}
              <div className="space-y-2 text-xs sm:text-sm bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Paciente Titular:</span>
                  <span className="font-bold text-slate-900">
                    {nombres} {apellidos} {dni ? `(DNI: ${dni})` : ''}
                  </span>
                </div>
                {esParaFamiliar && nombreFamiliar && (
                  <div className="flex justify-between py-2 border-b border-slate-100 bg-teal-50/60 px-2 rounded-lg">
                    <span className="text-teal-800 font-semibold">Atención para familiar:</span>
                    <span className="font-bold text-teal-950">{nombreFamiliar} ({parentesco})</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Tratamiento Asignado:</span>
                  <span className="font-bold text-teal-700">{offerData.serviceName}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Sede Odontológica:</span>
                  <span className="font-semibold text-slate-800">
                    {offerData.sedes?.find((s: any) => String(s.id_sede) === String(selectedSedeId))?.nombre || offerData.sede}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Fecha y Turno:</span>
                  <span className="font-semibold text-slate-800">
                    {fechaCita} — {horaCita}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-500 font-medium">Modalidad de Pago:</span>
                  <Badge variant="outline" className="bg-slate-100 text-slate-800 border-slate-300 font-semibold text-xs">
                    {canalPago}
                  </Badge>
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-slate-800">Total Promocional a abonar:</span>
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
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-12 rounded-xl text-sm shadow-md gap-2"
                >
                  <MessageSquare className="w-5 h-5" /> Enviar Voucher a WhatsApp de la Clínica
                </Button>
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="w-full !bg-white border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold gap-2"
                >
                  <Download className="w-4 h-4" /> Imprimir o Guardar Comprobante PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Vista Principal: Banner Promocional + Formulario Completo */
          <div className="space-y-6">

            {/* Tarjeta Visual de la Oferta */}
            <Card className="border border-teal-200 shadow-md overflow-hidden !bg-white">
              <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 p-5 sm:p-6 text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge className="bg-amber-400 text-slate-950 font-black hover:bg-amber-400 px-3 py-1 shadow-sm text-xs">
                    <Tag className="w-3.5 h-3.5 mr-1 inline" /> ¡{offerData.discountPct}% DSCTO. EXCLUSIVO!
                  </Badge>
                  <div className="flex items-center gap-1.5 text-xs text-teal-100 font-medium bg-white/10 px-3 py-1 rounded-full backdrop-blur-xs">
                    <Clock3 className="w-3.5 h-3.5" /> Vigencia Garantizada 48h
                  </div>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black mt-3 tracking-tight text-white">{offerData.serviceName}</h1>
                <p className="text-teal-100 text-xs sm:text-sm mt-1 line-clamp-2 max-w-2xl">
                  {offerData.serviceDescription || 'Tratamiento odontológico integral con equipos de última tecnología y garantía NexoSalud.'}
                </p>
              </div>

              <CardContent className="p-5 sm:p-6 space-y-4 !bg-white">
                {/* Comparativa de Precios */}
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between bg-teal-50/70 p-4 rounded-xl border border-teal-100 gap-3">
                  <div>
                    <span className="text-xs text-slate-500 font-semibold block">Precio Regular sin Descuento:</span>
                    <span className="text-sm text-slate-400 line-through font-bold">
                      S/ {Number(offerData.originalPrice).toFixed(2)}
                    </span>
                    <div className="text-xs font-black text-emerald-700 mt-0.5 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                      Ahorras en esta cita: S/ {(Number(offerData.originalPrice) - Number(offerData.offeredPrice)).toFixed(2)}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-xs font-bold uppercase tracking-wider text-teal-800 block">Tarifa Promocional Final</span>
                    <span className="text-3xl sm:text-4xl font-black text-teal-900 tracking-tight block">
                      S/ {Number(offerData.offeredPrice).toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Detalles de la Oferta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <MapPin className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Sede Principal Asignada</span>
                      <span className="font-bold text-slate-800 truncate block">{offerData.sede}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200">
                    <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                    <div>
                      <span className="text-slate-500 block font-medium">Especialista Asignado</span>
                      <span className="font-bold text-slate-800 truncate block">{offerData.doctor}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Formulario Principal de Pre-Reserva */}
            <Card className="border border-slate-200 shadow-md !bg-white">
              <CardHeader className="p-5 sm:p-6 border-b border-slate-100 !bg-white">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-900">
                      Formulario Oficial de Pre-Reserva
                    </CardTitle>
                    <CardDescription className="text-xs text-slate-500">
                      Completa tus datos para emitir tu orden clínica y congelar la tarifa con garantía.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-5 sm:p-6 !bg-white">
                <form onSubmit={handlePreReserveSubmit} className="space-y-6">

                  {/* Sección 1: Datos Personales */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <User className="w-4 h-4 text-teal-600" /> 1. Datos del Paciente Titular
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Nombres *</Label>
                        <Input
                          required
                          value={nombres}
                          onChange={(e) => setNombres(e.target.value)}
                          placeholder="Tus nombres"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Apellidos *</Label>
                        <Input
                          required
                          value={apellidos}
                          onChange={(e) => setApellidos(e.target.value)}
                          placeholder="Tus apellidos"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <div className="flex justify-between items-center">
                          <Label className="text-xs font-semibold text-slate-700">DNI / Carné Extranjería *</Label>
                          <span className="text-[10px] text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-full border border-teal-100">Requerido</span>
                        </div>
                        <Input
                          required
                          maxLength={12}
                          value={dni}
                          onChange={(e) => setDni(e.target.value.replace(/[^0-9a-zA-Z]/g, ''))}
                          placeholder="Número de DNI"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">WhatsApp de Confirmación *</Label>
                        <Input
                          required
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="999 888 777"
                          className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Correo Electrónico (Para comprobante digital)</Label>
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="tu-correo@ejemplo.com"
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                      />
                    </div>

                    {/* Checkbox para familiar con fondo blanco y borde slate */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          id="familiar"
                          checked={esParaFamiliar}
                          onCheckedChange={(checked) => setEsParaFamiliar(Boolean(checked))}
                          className={!esParaFamiliar ? '!bg-white !border-slate-300 hover:!border-teal-500' : '!bg-teal-600 !border-teal-600 text-white'}
                        />
                        <Label htmlFor="familiar" className="text-xs font-semibold text-slate-800 cursor-pointer select-none">
                          ¿La atención odontológica es para un familiar / hijo / cónyuge?
                        </Label>
                      </div>

                      {esParaFamiliar && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 animate-in fade-in-50 duration-200">
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Nombre del Familiar *</Label>
                            <Input
                              required={esParaFamiliar}
                              value={nombreFamiliar}
                              onChange={(e) => setNombreFamiliar(e.target.value)}
                              placeholder="Ej: Mateo Castillo"
                              className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 focus:!border-teal-500 focus:!ring-teal-500/20 text-xs h-10 mt-1 rounded-xl font-medium"
                            />
                          </div>
                          <div>
                            <Label className="text-xs font-semibold text-slate-700">Parentesco</Label>
                            <Select value={parentesco} onValueChange={setParentesco}>
                              <SelectTrigger className="!bg-white !text-slate-900 !border-slate-300 text-xs h-10 mt-1 rounded-xl font-medium shadow-2xs">
                                <SelectValue placeholder="Selecciona parentesco" />
                              </SelectTrigger>
                              <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
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

                  {/* Sección 2: Sede, Horario y Cuestionario Clínico */}
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <Calendar className="w-4 h-4 text-teal-600" /> 2. Coordinación de Cita & Sede
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Sede Preferencial</Label>
                        <Select
                          value={String(selectedSedeId)}
                          onValueChange={(val) => setSelectedSedeId(val)}
                        >
                          <SelectTrigger className="!bg-white !text-slate-900 !border-slate-300 text-xs h-10 mt-1 rounded-xl font-medium shadow-2xs">
                            <SelectValue placeholder="Selecciona sede" />
                          </SelectTrigger>
                          <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
                            {offerData.sedes && offerData.sedes.length > 0 ? (
                              offerData.sedes.map((s: any) => (
                                <SelectItem key={s.id_sede} value={String(s.id_sede)}>
                                  {s.nombre} - {s.direccion || ''}
                                </SelectItem>
                              ))
                            ) : (
                              <>
                                <SelectItem value="1">Sede Norte - Av. Las Palmas 123</SelectItem>
                                <SelectItem value="2">Sede Sur - Av. El Sol 456</SelectItem>
                                <SelectItem value="3">Sede Centro - Jr. Lima 789</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-slate-700">Fecha Tentativa</Label>
                        <Input
                          type="date"
                          value={fechaCita}
                          min={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setFechaCita(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-300 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Turno Preferido de Atención</Label>
                      <Select value={horaCita} onValueChange={setHoraCita}>
                        <SelectTrigger className="!bg-white !text-slate-900 !border-slate-300 text-xs h-10 mt-1 rounded-xl font-medium shadow-2xs">
                          <SelectValue placeholder="Selecciona turno preferido" />
                        </SelectTrigger>
                        <SelectContent className="!bg-white !border-slate-200 text-slate-900 shadow-xl">
                          <SelectItem value="09:00 - 13:00 (Mañana)">Mañana (09:00 AM - 01:00 PM)</SelectItem>
                          <SelectItem value="14:00 - 18:00 (Tarde)">Tarde (02:00 PM - 06:00 PM)</SelectItem>
                          <SelectItem value="18:00 - 21:00 (Noche)">Noche (06:00 PM - 09:00 PM)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Nivel de dolor con opciones blancas y hover celeste */}
                    <div>
                      <Label className="text-xs font-semibold text-slate-700 block mb-1.5">
                        ¿Presentas dolor o molestia dental actualmente?
                      </Label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {[
                          'Ninguno (Preventivo)',
                          'Leve (Sensibilidad)',
                          'Moderado',
                          'Intenso (Agudo)',
                        ].map((nivel) => {
                          const isSelected = nivelDolor === nivel;
                          return (
                            <button
                              key={nivel}
                              type="button"
                              onClick={() => setNivelDolor(nivel)}
                              className={`py-2.5 px-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                                isSelected
                                  ? '!bg-teal-600 !border-teal-600 text-white shadow-sm ring-2 ring-teal-500/20'
                                  : '!bg-white !border-slate-200 text-slate-700 hover:!bg-teal-50/50 hover:!border-teal-400 hover:!text-teal-950 shadow-2xs'
                              }`}
                            >
                              {nivel}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Alergias o Condiciones Especiales (Opcional)</Label>
                      <Input
                        value={alergias}
                        onChange={(e) => setAlergias(e.target.value)}
                        placeholder="Ej: Penicilina, látex, hipertensión, ninguna..."
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Sección 3: Modalidad de Pago y Confirmación */}
                  <div className="space-y-4 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider">
                      <CreditCard className="w-4 h-4 text-teal-600" /> 3. Modalidad de Pago Preferida
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                      <button
                        type="button"
                        onClick={() => setCanalPago('Efectivo en clínica')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Efectivo en clínica'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-2 ring-teal-500/20 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <Banknote className="w-5 h-5 text-teal-600" />
                          {canalPago === 'Efectivo en clínica' && <Check className="w-4 h-4 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">En Clínica</span>
                          <span className="text-[11px] text-slate-500 font-normal">Pagas el día de tu cita</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Yape / Plin')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Yape / Plin'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-2 ring-teal-500/20 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <QrCode className="w-5 h-5 text-teal-600" />
                          {canalPago === 'Yape / Plin' && <Check className="w-4 h-4 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">Yape / Plin</span>
                          <span className="text-[11px] text-slate-500 font-normal">Coordinado al llegar</span>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCanalPago('Tarjeta')}
                        className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          canalPago === 'Tarjeta'
                            ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-2 ring-teal-500/20 shadow-xs'
                            : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <CreditCard className="w-5 h-5 text-teal-600" />
                          {canalPago === 'Tarjeta' && <Check className="w-4 h-4 text-teal-600" />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 text-xs">Tarjeta Déb/Cré</span>
                          <span className="text-[11px] text-slate-500 font-normal">POS sin recargo extra</span>
                        </div>
                      </button>
                    </div>

                    <div>
                      <Label className="text-xs font-semibold text-slate-700">Duda o Comentario para el Odontólogo (Opcional)</Label>
                      <Input
                        value={comentarios}
                        onChange={(e) => setComentarios(e.target.value)}
                        placeholder="Ej: Deseo consultar también por ortodoncia o blanqueamiento..."
                        className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 text-xs h-10 mt-1 rounded-xl shadow-2xs font-medium"
                      />
                    </div>

                    {/* Checkbox de consentimiento con fondo blanco */}
                    <div className="flex items-start gap-2.5 pt-1">
                      <Checkbox
                        id="consent"
                        checked={consentimiento}
                        onCheckedChange={(c) => setConsentimiento(Boolean(c))}
                        className={!consentimiento ? '!bg-white !border-slate-300 hover:!border-teal-500 mt-0.5' : '!bg-teal-600 !border-teal-600 text-white mt-0.5'}
                      />
                      <Label htmlFor="consent" className="text-xs text-slate-700 leading-snug cursor-pointer select-none">
                        Autorizo a Clínica NexoSalud a contactarme por WhatsApp/Email para coordinar mi cita y confirmo que deseo congelar mi tarifa promocional.
                      </Label>
                    </div>
                  </div>

                  {/* Botón de Envío Final */}
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-gradient-to-r from-teal-600 via-teal-700 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold h-12 rounded-xl text-sm sm:text-base shadow-lg shadow-teal-700/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
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

                  {/* Texto inferior de protección de datos con ícono de framework (SIN emoji) */}
                  <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-1 text-center">
                    <ShieldCheck className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Tus datos están protegidos por el secreto médico y la Ley de Protección de Datos Personales N° 29733.</span>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* ============================================================ */}
      {/* WIDGET FLOTANTE: ASISTENTE NEXOSALUD (Chat IA Flotante)     */}
      {/* ============================================================ */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
        {/* Ventana de Chat Flotante con Animación Elegante de Entrada y Salida */}
        <div
          className={`mb-3 w-[calc(100vw-2rem)] sm:w-[385px] h-[525px] max-h-[82vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden origin-bottom-right transition-all duration-300 ease-out ${
            isChatOpen
              ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto'
              : 'opacity-0 scale-75 translate-y-6 pointer-events-none'
          }`}
        >
          {/* Header del Chat */}
          <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-4 py-3.5 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-xs">
                <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-bold text-sm leading-tight text-white">
                  Asistente NexoSalud
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <div className="text-[11px] text-teal-100 font-medium leading-tight">
                  En línea para responder tus dudas
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsChatOpen(false)}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Cerrar chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mensajes del Chat */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/60 text-xs">
            {chatMessages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.sender === 'agent' && (
                  <div className="w-6 h-6 rounded-full bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                    <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-teal-600 text-white rounded-br-xs font-medium'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-bl-xs leading-relaxed font-normal'
                  }`}
                >
                  <p className="whitespace-pre-line text-xs">{msg.text}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      msg.sender === 'user' ? 'text-teal-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            ))}

            {isAiTyping && (
              <div className="flex gap-2 items-center">
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 p-0.5 flex items-center justify-center shrink-0 shadow-2xs">
                  <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-2 text-slate-500 text-xs flex items-center gap-1.5 shadow-2xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                  <span>Asistente NexoSalud está escribiendo...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Sugerencias Rápidas */}
          <div className="px-3 py-2 bg-white border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-[11px]">
            <button
              type="button"
              onClick={() => handleSendMessage('¿Qué incluye exactamente este precio?')}
              className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
            >
              ¿Qué incluye?
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('¿Cuáles son los medios de pago aceptados?')}
              className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
            >
              Formas de pago
            </button>
            <button
              type="button"
              onClick={() => handleSendMessage('¿Puedo transferir esta promoción a un familiar?')}
              className="shrink-0 bg-slate-50 hover:bg-teal-50 hover:text-teal-950 hover:border-teal-300 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200 transition-colors font-medium"
            >
              Para familiar
            </button>
          </div>

          {/* Input del Chat */}
          <div className="p-3 bg-white border-t border-slate-100">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <Input
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Pregúntale al Asistente..."
                disabled={isAiTyping}
                className="!bg-white !text-slate-900 placeholder:!text-slate-400 !border-slate-300 text-xs h-9 rounded-xl focus:!border-teal-500 focus:!ring-teal-500/20"
              />
              <Button
                type="submit"
                size="sm"
                disabled={isAiTyping || !userInput.trim()}
                className="bg-teal-600 hover:bg-teal-700 text-white h-9 px-3 rounded-xl shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </Button>
            </form>
          </div>
        </div>

        {/* Botón Flotante Circular (FAB) */}
        <button
          type="button"
          onClick={() => setIsChatOpen((prev) => !prev)}
          className="w-14 h-14 rounded-full bg-white border-2 border-teal-600 shadow-2xl flex items-center justify-center p-2.5 transition-all duration-300 hover:scale-110 active:scale-95 group ring-4 ring-teal-500/10 cursor-pointer relative focus:outline-none"
          aria-label={isChatOpen ? 'Cerrar Asistente NexoSalud' : 'Abrir Asistente NexoSalud'}
          title="Asistente NexoSalud"
        >
          {/* Indicador en línea (punto verde) */}
          <span className="absolute top-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-xs"></span>

          {isChatOpen ? (
            <X className="w-6 h-6 text-slate-700 transition-transform duration-200 rotate-0 group-hover:rotate-90" />
          ) : (
            <img
              src="/Logo_NexoSalud.png"
              alt="Asistente NexoSalud"
              className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-110"
            />
          )}
        </button>
      </div>
    </div>
  );
}
