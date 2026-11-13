import React, { useState, useRef, useEffect } from 'react';
import {
  Bot,
  X,
  Send,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Loader2,
  UserCheck,
  MapPin,
  Phone,
  ShieldCheck,
  Clock,
  IdCard,
  Mail,
} from 'lucide-react';
import { buyerService } from '../../services/buyer.service';
import type { SedeCatalogItem, ServicioCatalogItem } from '../../types/buyer.types';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

interface CollectedData {
  nombre?: string | null;
  telefono?: string | null;
  dni?: string | null;
  email?: string | null;
  sede_nombre?: string | null;
  servicio_nombre?: string | null;
  horario_nombre?: string | null;
  motivo_consulta?: string | null;
  autoriza_contacto?: boolean | null;
}

interface BuyerChatbotWidgetProps {
  servicios: ServicioCatalogItem[];
  sedes: SedeCatalogItem[];
}

const INITIAL_SUGGESTIONS = [
  'Me duele una muela al tomar frío',
  '¿Qué especialidades ofrecen?',
  '¿Cuáles son sus sedes y horarios?',
  'Quiero que me contacten',
];

const INITIAL_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: '¡Hola! Soy el asistente de orientación de NexoSalud. Puedo ayudarte si tienes alguna molestia dental, resolver dudas sobre nuestros servicios o sedes, y ayudarte a registrar tus datos para que un asesor te oriente.',
};

function findBestMatchId<T extends { id_sede?: number; id_servicio?: number; nombre: string }>(
  items: T[],
  query: string | null | undefined,
  key: 'id_sede' | 'id_servicio'
): number | null {
  if (!query || !items.length) return null;
  const q = query.trim().toLowerCase();
  const exact = items.find((i) => i.nombre.toLowerCase() === q);
  if (exact) return (exact[key] as number) ?? null;

  const partial = items.find(
    (i) => i.nombre.toLowerCase().includes(q) || q.includes(i.nombre.toLowerCase())
  );
  if (partial) return (partial[key] as number) ?? null;

  const words = q.split(/\s+/).filter((w) => w.length > 3);
  for (const w of words) {
    const wordMatch = items.find((i) => i.nombre.toLowerCase().includes(w));
    if (wordMatch) return (wordMatch[key] as number) ?? null;
  }
  return null;
}

export const BuyerChatbotWidget: React.FC<BuyerChatbotWidgetProps> = ({
  servicios,
  sedes,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [collectedData, setCollectedData] = useState<CollectedData>({});
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registeredInfo, setRegisteredInfo] = useState<{
    id_persona?: number;
    nombre: string;
    sede?: string | null;
    servicio?: string | null;
    etapa?: string;
  } | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading, registeredInfo, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 120);
    }
  }, [isOpen]);

  const handleReset = () => {
    setMessages([INITIAL_MESSAGE]);
    setCollectedData({});
    setSuggestions(INITIAL_SUGGESTIONS);
    setRegisteredInfo(null);
    setRegisterError(null);
    setInput('');
  };

  const registerBuyerFromChat = async (
    finalData: CollectedData,
    conversationMessages: ChatMessage[]
  ) => {
    if (registeredInfo || isRegistering) return;
    if (!finalData.nombre || !finalData.telefono || finalData.autoriza_contacto !== true) return;

    setIsRegistering(true);
    setRegisterError(null);
    try {
      const matchedSedeId = findBestMatchId(sedes, finalData.sede_nombre, 'id_sede');
      const matchedServicioId = findBestMatchId(servicios, finalData.servicio_nombre, 'id_servicio');

      const userSummary = conversationMessages
        .filter((m) => m.role === 'user')
        .map((m) => m.text)
        .slice(-3)
        .join(' | ');

      const res = await buyerService.registerOpportunity({
        nombre: finalData.nombre,
        telefono: finalData.telefono,
        dni: finalData.dni || null,
        email: finalData.email || null,
        id_sede: matchedSedeId,
        sede_preferida: finalData.sede_nombre || null,
        horario_preferido: finalData.horario_nombre || null,
        id_servicio: matchedServicioId,
        motivo_consulta:
          finalData.motivo_consulta || userSummary || 'Consulta desde Chatbot de Orientación',
        consentimiento_atencion: true,
        utm_source: 'chatbot_buyer',
        utm_campaign: 'orientacion_buyer',
      });

      const data = res?.data ?? res;
      setRegisteredInfo({
        id_persona: data?.id_persona,
        nombre: finalData.nombre,
        sede: finalData.sede_nombre || sedes.find((s) => s.id_sede === matchedSedeId)?.nombre || null,
        servicio:
          finalData.servicio_nombre ||
          servicios.find((s) => s.id_servicio === matchedServicioId)?.nombre ||
          null,
        etapa: data?.etapa || 'BUYER',
      });
    } catch (err) {
      setRegisterError(
        err instanceof Error ? err.message : 'No se pudo completar el registro automático.'
      );
    } finally {
      setIsRegistering(false);
    }
  };

  const sendMessage = async (rawText: string) => {
    const text = rawText.trim();
    if (!text || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text,
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput('');
    setSuggestions([]);
    setIsLoading(true);

    try {
      const apiMessages = nextMessages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({ role: m.role, text: m.text }));

      const response = await buyerService.chatWithBuyerAssistant({
        messages: apiMessages,
        collectedData,
      });

      const botMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text: response.reply,
      };

      const updatedMessages = [...nextMessages, botMsg];
      setMessages(updatedMessages);
      setCollectedData(response.extracted || {});
      setSuggestions(response.suggestedActions || []);

      if (response.readyToRegister && !registeredInfo) {
        await registerBuyerFromChat(response.extracted, updatedMessages);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Tuve un inconveniente momentáneo para responder. Por favor, intenta nuevamente en unos segundos o usa el formulario de contacto.',
        },
      ]);
      setSuggestions(INITIAL_SUGGESTIONS.slice(0, 2));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const hasCapturedSomething = Boolean(
    collectedData.nombre ||
      collectedData.telefono ||
      collectedData.dni ||
      collectedData.email ||
      collectedData.sede_nombre ||
      collectedData.horario_nombre ||
      collectedData.autoriza_contacto
  );

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-3 flex h-[540px] max-h-[82vh] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-[#d7e3da] bg-white shadow-2xl shadow-[#1d3b2e]/20 sm:w-[395px]">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#23644e] px-4 py-3.5 text-white">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur-sm">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold tracking-tight">Asistente NexoSalud</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-100">
                    <Sparkles className="h-2.5 w-2.5" />
                    IA
                  </span>
                </div>
                <p className="text-[11px] text-emerald-100/85">
                  Orientación dental y admisión
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleReset}
                title="Reiniciar conversación"
                className="rounded-lg p-1.5 text-emerald-100 transition hover:bg-white/15 hover:text-white"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Cerrar chat"
                className="rounded-lg p-1.5 text-emerald-100 transition hover:bg-white/15 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Barra discreta de datos capturados */}
          {hasCapturedSomething && !registeredInfo && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-[#e5ede7] bg-[#f6faf7] px-3.5 py-2 text-[11px] text-[#355947]">
              {collectedData.nombre && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <UserCheck className="h-3 w-3 text-[#23644e]" />
                  {collectedData.nombre}
                </span>
              )}
              {collectedData.telefono && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <Phone className="h-3 w-3 text-[#23644e]" />
                  {collectedData.telefono}
                </span>
              )}
              {collectedData.dni && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <IdCard className="h-3 w-3 text-[#23644e]" />
                  DNI: {collectedData.dni}
                </span>
              )}
              {collectedData.email && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <Mail className="h-3 w-3 text-[#23644e]" />
                  {collectedData.email}
                </span>
              )}
              {collectedData.sede_nombre && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <MapPin className="h-3 w-3 text-[#23644e]" />
                  {collectedData.sede_nombre}
                </span>
              )}
              {collectedData.horario_nombre && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-0.5 shadow-sm ring-1 ring-[#dce7df]">
                  <Clock className="h-3 w-3 text-[#23644e]" />
                  {collectedData.horario_nombre}
                </span>
              )}
              {collectedData.autoriza_contacto && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#e6f4ec] px-2 py-0.5 font-medium text-[#1e5c45]">
                  <ShieldCheck className="h-3 w-3" />
                  Autorizado
                </span>
              )}
            </div>
          )}

          {/* Historial de mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-3 overflow-y-auto bg-[#fbfdfb] px-4 py-4"
          >
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[84%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                      isUser
                        ? 'rounded-br-sm bg-[#23644e] text-white shadow-sm'
                        : 'rounded-bl-sm border border-[#e3ece5] bg-white text-[#24382d] shadow-sm'
                    }`}
                  >
                    {msg.text}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm border border-[#e3ece5] bg-white px-3.5 py-2.5 text-xs text-[#5d7366] shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#23644e]" />
                  Analizando tu consulta...
                </div>
              </div>
            )}

            {isRegistering && (
              <div className="flex items-center gap-2 rounded-xl border border-[#cce3d4] bg-[#eef7f1] px-3.5 py-2.5 text-xs font-medium text-[#23644e]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Registrando tu solicitud como Buyer en NexoSalud...
              </div>
            )}

            {registeredInfo && (
              <div className="rounded-xl border border-[#b9dec6] bg-[#edf7f0] p-3.5 text-xs text-[#1f4e3b] shadow-sm">
                <div className="flex items-center gap-2 font-semibold text-[#18523a]">
                  <CheckCircle2 className="h-4 w-4 text-[#23644e]" />
                  <span>¡Registrado como {registeredInfo.etapa || 'BUYER'}!</span>
                </div>
                <p className="mt-1.5 leading-relaxed text-[#2e5d49]">
                  Gracias, <strong>{registeredInfo.nombre}</strong>. Guardamos tu solicitud
                  {registeredInfo.id_persona ? ` (Ficha #${registeredInfo.id_persona})` : ''}
                  {registeredInfo.sede ? ` para ${registeredInfo.sede}` : ''}
                  {registeredInfo.servicio ? ` en ${registeredInfo.servicio}` : ''}. Un asesor se pondrá en contacto contigo pronto.
                </p>
              </div>
            )}

            {registerError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                {registerError}
              </div>
            )}
          </div>

          {/* Botones rápidos contextuales */}
          {suggestions.length > 0 && !isLoading && !registeredInfo && (
            <div className="flex flex-wrap gap-1.5 border-t border-[#ebf1ec] bg-[#f8fbf9] px-3.5 py-2.5">
              {suggestions.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => sendMessage(sug)}
                  className="rounded-full border border-[#cbe0d2] bg-white px-2.5 py-1 text-[11px] font-medium text-[#23644e] transition hover:border-[#23644e] hover:bg-[#eef6f0]"
                >
                  {sug}
                </button>
              ))}
            </div>
          )}

          {/* Input de texto (soporta Shift + Enter para salto de línea) */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2 border-t border-[#e3ece5] bg-white px-3 py-2.5"
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={
                registeredInfo
                  ? '¿Tienes alguna otra consulta?'
                  : 'Cuéntanos tu molestia o duda... (Shift+Enter para salto)'
              }
              disabled={isLoading}
              className="max-h-24 min-h-[36px] flex-1 resize-none overflow-y-auto rounded-xl border border-[#dce6df] bg-[#f8fbf9] px-3 py-2 text-xs text-[#213329] placeholder:text-[#7c9084] focus:border-[#23644e] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#23644e] text-white transition hover:bg-[#1a4d3c] disabled:cursor-not-allowed disabled:opacity-45"
              title="Enviar mensaje"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* Botón flotante para abrir/cerrar */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="group flex items-center gap-2.5 rounded-full bg-[#23644e] px-4 py-3 text-xs font-semibold text-white shadow-xl shadow-[#1d4939]/30 transition-all hover:scale-[1.03] hover:bg-[#1b503e] active:scale-[0.98]"
        title="Abrir Asistente Virtual Dental"
      >
        <span className="relative flex h-5 w-5 items-center justify-center">
          {isOpen ? (
            <X className="h-4 w-4" />
          ) : (
            <>
              <Bot className="h-4 w-4" />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-300 ring-2 ring-[#23644e]" />
            </>
          )}
        </span>
        <span>{isOpen ? 'Cerrar asistente' : 'Asistente Dental IA'}</span>
      </button>
    </div>
  );
};
