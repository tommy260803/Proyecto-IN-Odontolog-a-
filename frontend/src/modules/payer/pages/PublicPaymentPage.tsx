import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { PaymentNoticePdfModal } from '../components/PaymentNoticePdfModal';
import { PayerState, normalizePayerState } from '@/domain/enums';
import {
  ShieldCheck,
  Lock,
  CreditCard,
  Smartphone,
  Building2,
  CheckCircle2,
  Copy,
  Check,
  FileText,
  Sparkles,
  Loader2,
  Calendar,
  Clock,
  User,
  Zap,
  MapPin,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  AlertTriangle,
  QrCode,
  Banknote,
  Tag,
  Clock3,
  Stethoscope,
  Smile,
  Award,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function PublicPaymentPage() {
  const { orderCode: paramCode, id: paramId } = useParams<{ orderCode?: string; id?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const rawCode = paramCode || paramId || searchParams.get('orderCode') || searchParams.get('reservaId') || '';

  // Extraer el ID numérico de la reserva (ej: de ORD-00759-2026 -> 759)
  const extractId = (code: string): string => {
    if (!code) return '';
    const match = code.match(/ORD-(\d+)/i) || code.match(/(\d+)/);
    return match ? String(parseInt(match[1], 10)) : code;
  };

  const payerId = extractId(rawCode);

  const [loading, setLoading] = useState(true);
  const [payer, setPayer] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isApproved, setIsApproved] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date | null>(null);
  const [countdownText, setCountdownText] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  // Selector de Canal de Pago (Estilo Pre-Reserva)
  const [canalPago, setCanalPago] = useState<'Yape / Plin' | 'Tarjeta' | 'Transferencia'>('Yape / Plin');
  const [processingPayment, setProcessingPayment] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPdfOpen, setIsPdfOpen] = useState(false);

  // Form States
  const [yapePhone, setYapePhone] = useState('');
  const [yapeOtp, setYapeOtp] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardDni, setCardDni] = useState('');
  const [transferBank, setTransferBank] = useState('BCP');
  const [transferOpNumber, setTransferOpNumber] = useState('');

  // 1. Cargar datos de la orden médica
  const fetchOrder = async () => {
    if (!payerId) {
      setError('Código de orden no proporcionado.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_URL}/payer/${payerId}`);
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error(`La orden de pago #${rawCode || payerId} no fue encontrada o ya no está disponible.`);
        }
        throw new Error('Error al conectar con la pasarela de pagos.');
      }

      const data = await res.json();
      setPayer(data);

      // Pre-llenar campos
      if (data.person?.phone) setYapePhone(data.person.phone);
      if (data.person?.documentNumber) setCardDni(data.person.documentNumber);
      if (data.person?.firstName) setCardHolder(`${data.person.firstName} ${data.person.lastName}`);

      // Verificar si ya está validado/pagado
      if (normalizePayerState(data.state) === PayerState.VALIDADO || data.state === 'VALIDADO' || data.state === 'Confirmada') {
        setIsApproved(true);
      }

      // 2. Calcular vencimiento del enlace expirable
      let exp: Date | null = null;

      // Buscar si tiene prórroga activa en incidentes
      if (data.incidents && Array.isArray(data.incidents)) {
        for (const inc of data.incidents) {
          const m = (inc.reason || '').match(/Nuevo vencimiento:\s*([0-9T:.Z-]+)/i);
          if (m && m[1]) {
            const parsed = new Date(m[1]);
            if (!isNaN(parsed.getTime())) {
              exp = parsed;
              break;
            }
          }
        }
      }

      // Si no hay fecha explícita de prórroga, usar tolerancia del día de la cita
      if (!exp) {
        if (data.reservation?.date) {
          const apptMidnight = new Date(`${data.reservation.date}T00:00:00`);
          if (!isNaN(apptMidnight.getTime())) {
            exp = apptMidnight;
          }
        }
      }

      // Fallback: 48 horas desde la creación
      if (!exp) {
        const created = data.createdAt ? new Date(data.createdAt) : new Date();
        exp = new Date(created.getTime() + 48 * 60 * 60 * 1000);
      }

      setExpirationDate(exp);

      // Verificar si está cancelada o expirada
      const isCancelled =
        data.state === 'REJECTED' ||
        data.state === 'REVERTED' ||
        data.reservationHistory?.[0]?.statusRaw === 'Cancelada';

      const now = new Date();
      if (isCancelled || now > exp) {
        if (normalizePayerState(data.state) !== PayerState.VALIDADO) {
          setIsExpired(true);
        }
      }
    } catch (err: any) {
      setError(err.message || 'No se pudo cargar la pasarela de pago.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [payerId]);

  // 3. Reloj en tiempo real para el countdown del enlace expirable
  useEffect(() => {
    if (!expirationDate || isApproved || isExpired) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const distance = expirationDate.getTime() - now;

      if (distance <= 0) {
        setIsExpired(true);
        setCountdownText('00h 00m 00s (Expirado)');
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(minutes).padStart(2, '0');
      const sStr = String(seconds).padStart(2, '0');

      setCountdownText(`${hStr}h ${mStr}m ${sStr}s`);

      if (hours < 6) {
        setIsUrgent(true);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [expirationDate, isApproved, isExpired]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast({
      title: '¡Copiado al portapapeles!',
      description: text,
    });
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const amountToPay = payer?.amountToPay ? Number(payer.amountToPay) : 200.0;
  const originalPrice = Number(payer?.originalPrice || (amountToPay > 200 ? amountToPay * 1.4 : 350.0));
  const discountAmount = originalPrice > amountToPay ? originalPrice - amountToPay : 0;
  const discountPct = originalPrice > 0 ? Math.round(((originalPrice - amountToPay) / originalPrice) * 100) : 0;
  const displayCode = rawCode || (payer?.payment as any)?.preReservationCode || (payerId ? `ORD-${String(payerId).padStart(5, '0')}-2026` : 'ORD-NEXOSALUD');

  // 4. Procesar y Validar el Pago en SQL Server
  const handleFinalizePayment = async (channel: string, refText?: string) => {
    if (!payerId) return;
    setProcessingPayment(true);
    try {
      // 4.1 Registrar comprobante en backend
      await fetch(`${API_URL}/payer/${payerId}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          operationNumber: refText || `OP-${Date.now().toString().slice(-6)}`,
          operationDate: new Date().toISOString().split('T')[0],
          amount: amountToPay,
          observations: `Abono exitoso vía Pasarela Oficial Pública NexoSalud (${channel}).`,
        }),
      }).catch(() => {});

      // 4.2 Validar y confirmar reserva en SQL Server
      const resVal = await fetch(`${API_URL}/payer/${payerId}/validate`, {
        method: 'POST',
      });
      const dataVal = await resVal.json().catch(() => ({}));

      if (!resVal.ok && !dataVal.success) {
        throw new Error(dataVal.error || 'Error al validar el pago en el servidor.');
      }

      setIsApproved(true);
      setIsExpired(false);
      toast({
        title: '¡Pago Confirmado y Validado! 🎉',
        description: `Cobro de S/ ${amountToPay.toFixed(2)} registrado con éxito. Su cita y sillón odontológico han sido confirmados.`,
      });
      fetchOrder();
    } catch (err: any) {
      toast({
        title: 'Error al procesar pago',
        description: err.message || 'No se pudo completar el cobro en la pasarela.',
        variant: 'destructive',
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Handlers
  const handlePayYape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!yapeOtp || yapeOtp.trim().length < 6) {
      toast({
        title: 'Código de Aprobación Incompleto',
        description: 'Ingresa los 6 dígitos del código de aprobación de tu app Yape (o código de prueba 123456).',
        variant: 'destructive',
      });
      return;
    }
    await handleFinalizePayment('Yape', `YAPE-${yapePhone}-${yapeOtp}`);
  };

  const handlePayCard = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = cardNumber.replace(/\s+/g, '');
    if (cleanNum.length < 13) {
      toast({
        title: 'Número de tarjeta incompleto',
        description: 'Ingresa un número de tarjeta de 16 dígitos válido.',
        variant: 'destructive',
      });
      return;
    }
    await handleFinalizePayment('Tarjeta Débito/Crédito', `CARD-****${cleanNum.slice(-4)}`);
  };

  const handlePayTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferOpNumber || transferOpNumber.trim().length < 4) {
      toast({
        title: 'N° de Operación requerido',
        description: 'Ingresa el número de constancia o comprobante de tu transferencia.',
        variant: 'destructive',
      });
      return;
    }
    await handleFinalizePayment(`Transferencia ${transferBank}`, `${transferBank}-${transferOpNumber}`);
  };

  return (
    <div className="min-h-screen h-auto lg:h-screen lg:max-h-screen w-full overflow-y-auto lg:overflow-hidden relative flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-900 font-sans antialiased text-slate-900">
      <Toaster />

      {/* ========================================================================= */}
      {/* CAPA DE FONDO DIVIDIDO 50% / 50% (MITAD IZQ BLANCA, MITAD DER FOTO)       */}
      {/* ========================================================================= */}
      <div className="fixed inset-0 lg:absolute grid grid-cols-1 lg:grid-cols-2 pointer-events-none -z-10">
        {/* Mitad Izquierda (50%): Blanco puro plano */}
        <div className="bg-slate-50/90 lg:bg-white w-full h-full" />

        {/* Mitad Derecha (50%): Foto Fondo_NexoSalud_2.jpg con overlay clínico */}
        <div className="hidden lg:block relative bg-slate-950 w-full h-full overflow-hidden border-l border-slate-200">
          <img
            src="/Fondo_NexoSalud_2.jpg"
            alt="Atención Odontológica Especializada NexoSalud"
            className="absolute inset-0 w-full h-full object-cover object-center opacity-80 scale-100"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-950/60 to-slate-950/80" />
        </div>
      </div>

      {/* Línea Central con Desvanecimiento Suave (Fading Divider en 50%) */}
      <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1.5px] bg-gradient-to-b from-transparent via-slate-300 via-50% to-transparent pointer-events-none z-10" />

      {/* ========================================================================= */}
      {/* HEADER SUPERIOR (EN PANTALLA COMPLETA 50% / 50%)                         */}
      {/* ========================================================================= */}
      <header className="w-full grid grid-cols-1 lg:grid-cols-2 z-20 shrink-0">
        {/* Mitad Izquierda (En móvil muestra el logo, en desktop queda libre) */}
        <div className="flex lg:hidden items-center justify-between py-3 px-4 bg-white/95 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center p-1 overflow-hidden">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight text-slate-900 block leading-tight">
                NexoSalud <span className="text-teal-600 font-bold">Dental</span>
              </span>
              <span className="text-[10px] text-slate-500 font-medium block leading-tight">
                Pasarela Oficial de Pago
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>SSL Seguro</span>
          </div>
        </div>

        {/* Mitad Izquierda en Desktop (vacía para mantener limpio el lado del formulario) */}
        <div className="hidden lg:block" />

        {/* Mitad Derecha en Desktop: Branding NexoSalud en el LADO DERECHO */}
        <div className="hidden lg:flex items-center justify-between pt-4 pb-1 px-6 xl:px-12">
          <div className="flex items-center gap-2 text-xs text-slate-300 bg-slate-900/80 border border-slate-700 px-3 py-1 rounded-full backdrop-blur-md">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Pasarela Oficial Encriptada SSL 256-bit</span>
          </div>

          <div className="flex items-center justify-end gap-3">
            <div className="w-10 h-10 rounded-xl bg-white shadow-md flex items-center justify-center p-1.5 overflow-hidden border border-slate-100">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div className="text-left">
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                NexoSalud <span className="text-teal-400 font-bold">Dental</span>
              </span>
              <span className="text-[11px] text-slate-300 font-medium block leading-tight">
                Pasarela Oficial de Pago
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* CONTENIDO PRINCIPAL: 50% / 50% (IZQ: FORMULARIO, DER: FOTO & OFERTA)      */}
      {/* ========================================================================= */}
      <main className="relative w-full flex-1 grid grid-cols-1 lg:grid-cols-2 min-h-0 z-20 pb-20 lg:pb-0">
        
        {/* ======================================================================= */}
        {/* COLUMNA IZQUIERDA (50%): FORMULARIO PLANO SIN SHADOW Y BOTÓN FIJO       */}
        {/* ======================================================================= */}
        <div className="w-full h-full flex justify-center items-center min-h-0 animate-in fade-in slide-in-from-left duration-300 p-4 sm:p-6 lg:p-8 xl:p-12">
          {loading ? (
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-3">
              <RefreshCw className="w-10 h-10 text-teal-600 animate-spin mx-auto" />
              <h2 className="text-base font-bold text-slate-900">Cargando Pasarela de Pago Segura...</h2>
              <p className="text-xs text-slate-500">Conectando con la base de datos clínica de NexoSalud...</p>
            </div>
          ) : error ? (
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 p-8 text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto border border-rose-200">
                <AlertCircle className="w-7 h-7" />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Orden no encontrada</h2>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">{error}</p>
              <Button onClick={() => navigate('/')} className="bg-slate-900 text-white rounded-xl text-xs h-9 font-semibold">
                Volver al Inicio
              </Button>
            </div>
          ) : isExpired ? (
            /* =================================================================== */
            /* PANTALLA: ENLACE EXPIRADO (EN TARJETA BLANCA LIMPIA)               */
            /* =================================================================== */
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-none overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-r from-rose-700 via-rose-600 to-amber-600 px-5 py-4 text-white text-center">
                <div className="relative flex items-center justify-center mb-2">
                  <div className="w-14 h-14 rounded-full bg-white/20 text-white flex items-center justify-center shadow-lg ring-4 ring-white/20">
                    <Clock className="w-7 h-7" />
                  </div>
                </div>

                <Badge className="bg-amber-300 text-slate-950 font-black px-3 py-0.5 mb-1 hover:bg-amber-300 shadow-xs text-[10.5px] uppercase tracking-wider">
                  ⚠️ Plazo de Tolerancia Vencido
                </Badge>
                <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">Enlace de Pago Expirado</h2>
                <p className="text-rose-100 text-xs mt-0.5 max-w-md mx-auto">
                  El tiempo límite para realizar el abono de la orden <span className="font-mono font-bold text-white underline">{displayCode}</span> ha finalizado.
                </p>
              </div>

              <div className="p-4 sm:p-5 space-y-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-1.5">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Paciente:</span>
                    <span className="font-bold text-slate-900">{payer?.person?.firstName} {payer?.person?.lastName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Tratamiento Solicitado:</span>
                    <span className="font-bold text-teal-700">{payer?.serviceName || 'Tratamiento Odontológico'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500 font-medium">Cita Reservada:</span>
                    <span className="font-semibold text-slate-800">{payer?.reservation?.date || '-'} {payer?.reservation?.time || ''}</span>
                  </div>
                  <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Debido a la alta demanda clínica, el sillón odontológico fue liberado para pacientes en lista de espera.
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <a
                    href="https://wa.me/51952000621?text=Hola,%20mi%20enlace%20de%20pago%20ha%20expirado%20y%20deseo%20reprogramar%20mi%20cita%20odontológica."
                    target="_blank"
                    rel="noreferrer"
                    className="w-full sm:flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-10 rounded-xl shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>Reactivar Cupo por WhatsApp</span>
                  </a>

                  <Button
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-10 rounded-xl"
                  >
                    Solicitar Nueva Cita
                  </Button>
                </div>
              </div>
            </div>
          ) : isApproved ? (
            /* =================================================================== */
            /* PANTALLA: PAGO EXITOSO / CITA VALIDADA (ESTILO PRE-RESERVA ÉXITO)    */
            /* =================================================================== */
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-none overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="bg-gradient-to-r from-teal-700 via-teal-600 to-emerald-600 px-5 py-4 text-white text-center">
                {/* Check animado idéntico a PreReservationPage */}
                <div className="relative flex items-center justify-center mb-2">
                  <div className="absolute w-16 h-16 rounded-full bg-teal-300/30 animate-checkmark-ripple" />
                  <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-500 to-teal-400 text-white flex items-center justify-center shadow-lg shadow-teal-900/30 ring-4 ring-white/20 animate-checkmark-pop">
                    <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" className="animate-checkmark-draw" />
                    </svg>
                  </div>
                </div>

                <Badge className="bg-emerald-400 text-slate-950 font-black px-3 py-0.5 mb-1 hover:bg-emerald-400 shadow-xs text-[10.5px] uppercase tracking-wider">
                  ✓ Abono Validado en SQL Server
                </Badge>
                <h2 className="text-lg sm:text-xl font-black tracking-tight mt-0.5">
                  ¡Pago Confirmado, {payer?.person?.firstName}!
                </h2>
                <p className="text-teal-100 text-xs mt-0.5 max-w-md mx-auto">
                  Tu cita para <span className="font-bold text-white underline">{payer?.serviceName || 'Tratamiento Odontológico'}</span> y tu sillón médico están 100% garantizados.
                </p>
              </div>

              <div className="p-4 sm:p-5 space-y-3">
                {/* Código de la orden */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-2.5 text-center sm:text-left">
                  <div>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider block">Código Único de Atención</span>
                    <span className="text-xl sm:text-2xl font-black text-slate-900 tracking-wider font-mono">
                      {displayCode}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(displayCode, 'orderCodeSuccess')}
                    className="bg-white border-slate-300 text-slate-700 font-semibold hover:bg-slate-100 gap-1.5 shadow-2xs h-8 text-xs cursor-pointer"
                  >
                    {copiedKey === 'orderCodeSuccess' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'orderCodeSuccess' ? '¡Copiado!' : 'Copiar Código'}</span>
                  </Button>
                </div>

                {/* Resumen de cita */}
                <div className="space-y-1.5 text-xs bg-white p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Paciente Titular:</span>
                    <span className="font-bold text-slate-900">{payer?.person?.firstName} {payer?.person?.lastName}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Tratamiento Asignado:</span>
                    <span className="font-bold text-teal-700">{payer?.serviceName || 'Atención Odontológica'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Fecha y Turno:</span>
                    <span className="font-semibold text-slate-800">
                      {payer?.reservation?.date || '-'} — {payer?.reservation?.time || '09:00 AM'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-medium">Sede Odontológica:</span>
                    <span className="font-semibold text-slate-800 text-right">{payer?.reservation?.branchId || 'Sede Principal'}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-xs font-bold text-slate-800">Monto Total Abonado:</span>
                    <span className="text-xl font-black text-emerald-600 font-mono">
                      S/ {amountToPay.toFixed(2)}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <Button
                    onClick={() => setIsPdfOpen(true)}
                    className="w-full sm:flex-1 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold h-10 rounded-xl shadow-md text-xs flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <FileText className="w-4 h-4" />
                    <span>Descargar Constancia Oficial PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => navigate('/')}
                    className="w-full sm:w-auto border-slate-300 text-slate-700 hover:bg-slate-100 text-xs h-10 rounded-xl"
                  >
                    Finalizar
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* =================================================================== */
            /* FORMULARIO ACTIVO DE PASARELA EN TARJETA BLANCA (ESTILO PRE-RESERVA)*/
            /* =================================================================== */
            <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200 shadow-none overflow-hidden max-h-full flex flex-col">
              
              {/* Header Fijo de la Tarjeta */}
              <div className="px-5 py-4 bg-slate-50/90 border-b border-slate-100 shrink-0">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-teal-600 text-white font-bold px-2.5 py-0.5 text-[10px] uppercase tracking-wider">
                      Pasarela Oficial NexoSalud
                    </Badge>
                    <span className="text-[11px] font-mono text-slate-500 font-bold">
                      #{displayCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <Lock className="w-3 h-3 text-emerald-600" />
                    <span>SSL 256-bit</span>
                  </div>
                </div>

                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-1.5">
                  Completar Pago de Pre-Reserva
                </h2>
                <p className="text-slate-500 text-xs mt-0.5">
                  Elige tu canal preferido para validar tu abono y asegurar tu sillón odontológico en agenda clínica.
                </p>
              </div>

              {/* Cuerpo del Formulario Scrolleable sin scrollbar */}
              <div className="overflow-y-auto no-scrollbar flex-1 p-4 sm:p-5 space-y-4">
                
                {/* Resumen del Paciente Titular */}
                <div className="p-3 bg-slate-50/80 border border-slate-100 rounded-2xl flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider block">Paciente Titular</span>
                    <strong className="text-slate-900 font-bold text-sm block">
                      {payer.person?.firstName} {payer.person?.lastName}
                    </strong>
                    <span className="text-slate-500 text-[11px]">
                      DNI: {payer.person?.documentNumber || 'N/D'} · Tel: {payer.person?.phone || 'N/D'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">Total a Pagar</span>
                    <span className="text-lg font-black text-emerald-600 font-mono">
                      S/ {amountToPay.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 1. Selección de Modalidad de Pago (Diseño idéntico a PreReservationPage) */}
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800 uppercase tracking-wider">
                    <CreditCard className="w-3.5 h-3.5 text-teal-600" />
                    <span>Selecciona tu Modalidad de Pago:</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {/* Botón Yape / Plin */}
                    <button
                      type="button"
                      onClick={() => setCanalPago('Yape / Plin')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        canalPago === 'Yape / Plin'
                          ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                          : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <QrCode className="w-4 h-4 text-teal-600" />
                        {canalPago === 'Yape / Plin' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-900 text-xs">Yape / Plin</span>
                        <span className="text-[10px] text-slate-500 font-normal">QR o celular</span>
                      </div>
                    </button>

                    {/* Botón Tarjeta */}
                    <button
                      type="button"
                      onClick={() => setCanalPago('Tarjeta')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        canalPago === 'Tarjeta'
                          ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                          : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <CreditCard className="w-4 h-4 text-teal-600" />
                        {canalPago === 'Tarjeta' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-900 text-xs">Tarjeta</span>
                        <span className="text-[10px] text-slate-500 font-normal">Déb/Cré online</span>
                      </div>
                    </button>

                    {/* Botón Transferencia */}
                    <button
                      type="button"
                      onClick={() => setCanalPago('Transferencia')}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                        canalPago === 'Transferencia'
                          ? '!bg-teal-50/90 !border-2 !border-teal-600 text-teal-950 ring-1 ring-teal-500 shadow-xs'
                          : '!bg-white !border-slate-200 text-slate-700 hover:!border-teal-400 hover:!bg-teal-50/40 hover:!text-teal-950 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <Building2 className="w-4 h-4 text-teal-600" />
                        {canalPago === 'Transferencia' && <Check className="w-3.5 h-3.5 text-teal-600" />}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-900 text-xs">Transferencia</span>
                        <span className="text-[10px] text-slate-500 font-normal">BCP / BBVA</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* DETALLE SEGÚN EL MÉTODO SELECCIONADO */}
                {canalPago === 'Yape / Plin' && (
                  <div className="space-y-3.5 p-3.5 bg-purple-50/60 rounded-2xl border border-purple-200/80 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      {/* QR de Yape */}
                      <div className="w-24 h-24 bg-white p-1.5 rounded-xl shadow-xs border border-purple-200 shrink-0 flex flex-col items-center justify-between text-center">
                        <div className="w-full h-full bg-[#742284] rounded-lg p-1.5 flex flex-col items-center justify-between text-white">
                          <span className="text-[9px] font-black">YAPE QR</span>
                          <div className="w-8 h-8 bg-white rounded-md p-0.5 flex items-center justify-center">
                            <span className="text-[#742284] text-lg font-black leading-none">Y</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-teal-300">952 000 621</span>
                        </div>
                      </div>

                      <div className="space-y-1 text-center sm:text-left flex-1 text-xs">
                        <div className="flex items-center justify-center sm:justify-start gap-1.5">
                          <span className="font-black bg-[#742284] text-white rounded-md text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
                            <span className="text-[#00d4a1]">●</span> yape
                          </span>
                          <span className="text-purple-900 font-bold">Número Oficial de Clínica NexoSalud:</span>
                        </div>
                        <div className="flex items-center justify-center sm:justify-start gap-2 pt-0.5">
                          <span className="text-base font-mono font-black text-slate-900">
                            952 000 621
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('952000621', 'yapeNum')}
                            className="text-[11px] text-purple-700 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            {copiedKey === 'yapeNum' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'yapeNum' ? '¡Copiado!' : 'Copiar'}</span>
                          </button>
                        </div>
                        <p className="text-[10.5px] text-purple-800">
                          Titular: <strong>Clínica Odontológica NexoSalud S.A.C.</strong>
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Celular que emite el Yape</Label>
                        <Input
                          placeholder="Ej: 952 000 621"
                          value={yapePhone}
                          onChange={(e) => setYapePhone(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs font-medium focus:!border-teal-500"
                        />
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <Label className="text-[11px] font-semibold text-slate-700">Código de Aprobación (6 dígitos)</Label>
                          <button
                            type="button"
                            onClick={() => setYapeOtp('123456')}
                            className="text-[10px] text-purple-700 font-bold hover:underline"
                          >
                            Auto-test (123456)
                          </button>
                        </div>
                        <Input
                          placeholder="Ej: 849201"
                          value={yapeOtp}
                          onChange={(e) => setYapeOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono font-bold tracking-widest text-center h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                          maxLength={6}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {canalPago === 'Tarjeta' && (
                  <div className="space-y-3 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between pb-1 border-b border-slate-200 text-xs">
                      <span className="font-semibold text-slate-700">Tarjetas Aceptadas (Débito y Crédito):</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[10px] italic text-[#1A1F71] bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">VISA</span>
                        <span className="font-bold text-[10px] text-rose-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">Mastercard</span>
                        <span className="font-bold text-[10px] text-sky-600 bg-white border border-slate-200 px-1.5 py-0.5 rounded shadow-2xs">AMEX</span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-[11px] font-semibold text-slate-700">Número de Tarjeta</Label>
                      <div className="relative">
                        <Input
                          placeholder="4242 •••• •••• 4242"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono h-9 rounded-xl shadow-2xs pl-8 focus:!border-teal-500"
                          maxLength={19}
                        />
                        <CreditCard className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-3" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Vencimiento (MM/AA)</Label>
                        <Input
                          placeholder="MM/AA"
                          value={cardExpiry}
                          onChange={(e) => setCardExpiry(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono text-center h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                          maxLength={5}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">CVV (3-4 dígitos)</Label>
                        <Input
                          placeholder="•••"
                          type="password"
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono text-center h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                          maxLength={4}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Titular de la Tarjeta</Label>
                        <Input
                          placeholder="Como figura en la tarjeta"
                          value={cardHolder}
                          onChange={(e) => setCardHolder(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">DNI del Titular</Label>
                        <Input
                          placeholder="Número de documento"
                          value={cardDni}
                          onChange={(e) => setCardDni(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                          maxLength={12}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {canalPago === 'Transferencia' && (
                  <div className="space-y-3 p-3.5 bg-teal-50/50 rounded-2xl border border-teal-200/80 animate-in fade-in duration-200 text-xs">
                    <div className="space-y-2">
                      <div className="p-2.5 bg-white rounded-xl border border-teal-200 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-teal-950">🏦 BCP (Banco de Crédito)</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('191-94827104-0-32', 'bcp')}
                            className="text-[10px] text-teal-700 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            {copiedKey === 'bcp' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <p className="font-mono text-slate-800 text-[11px]">Cta: 191-94827104-0-32</p>
                        <p className="font-mono text-slate-500 text-[10px]">CCI: 002-191-009482710403-24</p>
                      </div>

                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">🏦 BBVA Perú</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('0011-0284-0100049281', 'bbva')}
                            className="text-[10px] text-slate-600 hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                          >
                            {copiedKey === 'bbva' ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copiar</span>
                          </button>
                        </div>
                        <p className="font-mono text-slate-800 text-[11px]">Cta: 0011-0284-0100049281</p>
                        <p className="font-mono text-slate-500 text-[10px]">CCI: 011-284-000100049281-67</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">Banco de Origen</Label>
                        <Input
                          placeholder="BCP, BBVA, Interbank..."
                          value={transferBank}
                          onChange={(e) => setTransferBank(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-slate-700">N° de Operación</Label>
                        <Input
                          placeholder="Ej: 9482019"
                          value={transferOpNumber}
                          onChange={(e) => setTransferOpNumber(e.target.value)}
                          className="!bg-white !text-slate-900 !border-slate-200 text-xs font-mono h-9 rounded-xl shadow-2xs focus:!border-teal-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Caja de Modo Prueba Inmediata (Testing Express) */}
                <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                      <Zap className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="font-bold text-amber-900 block leading-tight">Modo Prueba Express (Testing)</span>
                      <span className="text-[10px] text-amber-800">Valida la cita en SQL Server en 1 segundo.</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => handleFinalizePayment('Yape (Test Express)', `TEST-${Date.now().toString().slice(-6)}`)}
                    disabled={processingPayment}
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] h-8 px-3 rounded-xl shrink-0 cursor-pointer shadow-2xs"
                  >
                    ⚡ Aprobar Test
                  </Button>
                </div>

              </div>

              {/* Footer Fijo con el Botón Principal (Idéntico a PreReservationPage) */}
              <div className="px-5 py-3.5 bg-slate-50/95 shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5 text-[10.5px] text-slate-500 font-medium">
                  <ShieldCheck className="h-4 w-4 text-teal-600 shrink-0" />
                  <span>Transacción 100% protegida y encriptada</span>
                </div>

                <Button
                  type="button"
                  onClick={(e) => {
                    if (canalPago === 'Yape / Plin') handlePayYape(e);
                    else if (canalPago === 'Tarjeta') handlePayCard(e);
                    else handlePayTransfer(e);
                  }}
                  disabled={processingPayment}
                  className="w-full sm:w-auto sm:min-w-[270px] h-10 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl shadow-md shadow-teal-700/20 text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  {processingPayment ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validando Transacción...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Pagar S/ {amountToPay.toFixed(2)} con {canalPago}</span>
                    </>
                  )}
                </Button>
              </div>

            </div>
          )}
        </div>

        {/* ======================================================================= */}
        {/* COLUMNA DERECHA (50%): FOTO Fondo_NexoSalud_2.jpg + RESUMEN CLÍNICO     */}
        {/* ======================================================================= */}
        <div className="hidden lg:flex flex-col justify-center items-center h-full text-white p-4 sm:p-6 lg:p-8 xl:p-12">
          <div className="w-full max-w-lg space-y-4 flex flex-col items-center justify-center animate-in fade-in slide-in-from-right duration-300">
            
            {/* Header de la Oferta Visual */}
            <div className="w-full space-y-2 text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-300 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-teal-300" />
                <span>Orden Médica Confirmada • NexoSalud</span>
              </div>

              <h1 className="text-2xl xl:text-3xl font-black text-white tracking-tight leading-tight">
                {payer?.serviceName || 'Tratamiento Odontológico'}
              </h1>

              <p className="text-slate-300 text-xs leading-relaxed max-w-md font-normal text-center">
                Atención clínica personalizada con sillón odontológico reservado, insumos esterilizados y garantía médica profesional.
              </p>
            </div>

            {/* BANNER DE TIEMPO LÍMITE EXPIRABLE */}
            {!isApproved && !isExpired && (
              <div className={`w-full p-3.5 rounded-2xl border backdrop-blur-md transition-all ${
                isUrgent
                  ? 'bg-rose-950/70 border-rose-600/80 text-rose-200 shadow-lg shadow-rose-950/50'
                  : 'bg-slate-900/80 border-slate-700/80 text-slate-200 shadow-xl'
              }`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Clock className={`w-4 h-4 ${isUrgent ? 'text-rose-400 animate-pulse' : 'text-teal-400'}`} />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      {isUrgent ? '¡Plazo por Vencer Hoy!' : 'Tiempo Límite para Abonar:'}
                    </span>
                  </div>
                  <span className="font-mono text-sm font-black text-teal-300 tracking-wider">
                    {countdownText || 'Calculando...'}
                  </span>
                </div>
                <p className="text-[10.5px] text-slate-300 mt-1">
                  Tu cupo y tarifa especial quedan congelados hasta las 23:59 hrs. Posterior a esta hora, el sillón se libera automáticamente.
                </p>
              </div>
            )}

            {/* Tarjeta Visual de Precios & Ahorro (Exactamente como en PreReservationPage) */}
            <div className="w-full bg-slate-900/80 border border-slate-700/80 backdrop-blur-md p-4 rounded-2xl space-y-3 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    ¡{discountPct}% de Descuento Aplicado!
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[11px] text-teal-200 bg-teal-500/20 px-2 py-0.5 rounded-full border border-teal-500/30">
                  <Clock3 className="w-3 h-3" />
                  <span>Orden #{displayCode}</span>
                </div>
              </div>

              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <span className="text-[11px] text-slate-400 block">Tarifa regular de clínica:</span>
                  <span className="text-sm line-through text-slate-500 font-bold font-mono">
                    S/ {originalPrice.toFixed(2)}
                  </span>
                  {discountAmount > 0 && (
                    <div className="text-xs font-bold text-emerald-400 mt-0.5 font-mono">
                      Ahorras: S/ {discountAmount.toFixed(2)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-teal-300 tracking-wider block">Total Promocional</span>
                  <span className="text-3xl font-black text-white tracking-tight font-mono">
                    S/ {amountToPay.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Grid de Resumen de Cita & Credenciales Médicas (Como en PreReservationPage) */}
            <div className="w-full grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-200 block truncate">
                  {payer?.reservation?.date || 'Fecha programada'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  Hora: {payer?.reservation?.time || '09:00 AM'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800/80 backdrop-blur-sm space-y-1">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-300">
                  <Stethoscope className="w-3.5 h-3.5" />
                </div>
                <span className="text-[11px] font-bold text-slate-200 block truncate">
                  {payer?.reservation?.professionalId || 'Especialista Odontólogo'}
                </span>
                <span className="text-[10px] text-slate-400 block truncate">
                  {payer?.reservation?.branchId || 'Sede Principal'}
                </span>
              </div>
            </div>

            {/* Botón de Ver Orden en PDF */}
            <div className="w-full pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsPdfOpen(true)}
                className="w-full bg-slate-900/70 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:text-white text-xs h-9 rounded-xl gap-2 backdrop-blur-md cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5 text-teal-400" />
                <span>Previsualizar Orden de Pago Oficial (PDF)</span>
              </Button>
            </div>

          </div>
        </div>

      </main>

      {/* Modal PDF de la Orden / Constancia */}
      {payer && (
        <PaymentNoticePdfModal
          isOpen={isPdfOpen}
          onClose={() => setIsPdfOpen(false)}
          payer={payer}
        />
      )}
    </div>
  );
}
