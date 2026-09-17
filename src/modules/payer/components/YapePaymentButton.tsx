import { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/shared/components/ui/dialog';
import { useToast } from '@/shared/hooks/use-toast';
import { CreditCard, QrCode, Smartphone, Sparkles, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react';
import { QUERY_KEYS } from '@/shared/constants';

// Inicializar Mercado Pago Checkout API con la Public Key
const MP_PUBLIC_KEY = import.meta.env.VITE_MERCADOPAGO_PUBLIC_KEY || 'TEST-2057dc67-b4dd-4efa-972d-5ce965d7ab15';
if (typeof window !== 'undefined' && MP_PUBLIC_KEY) {
  try {
    initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
  } catch (err) {
    console.error('Error inicializando Mercado Pago SDK:', err);
  }
}

interface YapePaymentButtonProps {
  payerId: string;
  personName: string;
  email?: string;
  amount?: number;
  serviceName?: string;
  onSuccess?: () => void;
}

export function YapePaymentButton({
  payerId,
  personName,
  email = 'paciente@nexosalud.com',
  amount = 2.00,
  serviceName = 'Servicio Odontológico',
  onSuccess
}: YapePaymentButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'yape' | 'card'>('yape');
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('970292710');
  const [otpCode, setOtpCode] = useState('');
  const [isApproved, setIsApproved] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const finalAmount = Math.max(Number(amount) || 2, 2);

  useEffect(() => {
    if (MP_PUBLIC_KEY) {
      try {
        initMercadoPago(MP_PUBLIC_KEY, { locale: 'es-PE' });
      } catch (e) {
        // Already initialized
      }
    }
  }, []);

  // 1. Procesar Pago Directo con YAPE
  const handleDirectYapePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.length < 6) {
      toast({
        title: 'Código Incompleto',
        description: 'Ingresa los 6 dígitos del código de aprobación que genera tu app de Yape (o código de prueba 123456).',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/payments/process-yape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          amount: finalAmount,
          phone,
          otpCode,
          email
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo procesar el pago con Yape.');
      }

      // Validar en el backend de SQL Server
      await fetch(`http://localhost:3001/api/payer/${payerId}/validate`, { method: 'POST' });

      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });

      toast({
        title: '¡Pago Exitoso con Yape! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} procesado correctamente. Cita VALIDADA en SQL Server.`,
      });

      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error en el Pago con Yape',
        description: error.message || 'Verifica el código de aprobación de Yape o tu saldo.',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // 2. Procesar Pago con Tarjeta (Checkout API)
  const handleProcessCheckoutApi = async (param: any) => {
    const { formData } = param;
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3001/api/payments/process-checkout-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payerId,
          formData,
          amount: Math.max(Number(amount) || 1, 1),
          serviceName,
          email: formData?.payer?.email || email || 'paciente@nexosalud.com'
        })
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'No se pudo procesar el pago con la pasarela.');
      }

      // Validar en el backend de SQL Server
      await fetch(`http://localhost:3001/api/payer/${payerId}/validate`, { method: 'POST' });

      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });

      toast({
        title: '¡Pago Exitoso con Checkout API! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} procesado correctamente. Cita VALIDADA en SQL Server.`,
      });

      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1500);

    } catch (error: any) {
      console.error('Error Checkout API:', error);
      toast({
        title: 'Error al procesar pago',
        description: error.message || 'Verifica los datos de la tarjeta o medio de pago.',
        variant: 'destructive'
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleSimulate = async () => {
    setLoading(true);
    try {
      await fetch(`http://localhost:3001/api/payer/${payerId}/validate`, { method: 'POST' });
      setIsApproved(true);
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      toast({
        title: '¡Pago Aprobado (Modo Demo)! 🎉',
        description: `Cobro de S/ ${amount.toFixed(2)} registrado exitosamente en SQL Server. Cita VALIDADA.`,
      });
      setTimeout(() => {
        setIsOpen(false);
        if (onSuccess) onSuccess();
        window.location.reload();
      }, 1200);
    } catch (e) {
      toast({ title: 'Error', description: 'Error al simular pago', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="p-4 rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-sky-50 to-indigo-50 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="bg-purple-600 text-white p-2 rounded-lg font-bold text-xs flex items-center gap-1 shadow">
              <QrCode className="w-4 h-4" /> YAPE / TARJETA
            </div>
            <div>
              <h4 className="font-semibold text-slate-900 text-sm flex items-center gap-1">
                Pasarela Oficial Integrada (Yape & Checkout API)
                <Sparkles className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              </h4>
              <p className="text-xs text-slate-600">
                Paga <span className="font-bold text-purple-900">S/ {amount.toFixed(2)}</span> con Yape o Tarjeta de forma directa
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setIsOpen(true)}
          className="w-full bg-purple-700 hover:bg-purple-800 text-white font-medium text-sm flex items-center justify-center gap-2 py-5 shadow-md transition-all transform active:scale-95"
        >
          <Smartphone className="w-4 h-4" />
          Pagar S/ {amount.toFixed(2)} con Yape o Tarjeta
        </Button>
      </div>

      {/* Modal Interactivo de Pago */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-purple-700 font-bold text-lg mb-1">
              <div className="bg-purple-600 text-white p-1.5 rounded-lg">
                <QrCode className="w-5 h-5" />
              </div>
              Pasarela de Pago Segura
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Elige tu método de pago preferido. 100% integrado sin salir de la plataforma.
            </DialogDescription>
          </DialogHeader>

          {isApproved ? (
            <div className="py-8 text-center space-y-3 animate-in fade-in zoom-in">
              <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-10 h-10" />
              </div>
              <h3 className="text-lg font-bold text-emerald-800">¡Pago Confirmado y Validado!</h3>
              <p className="text-xs text-emerald-600">Cobro procesado con éxito. Actualizando sistema...</p>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              {/* Selector de Método: YAPE vs TARJETA */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('yape')}
                  className={`py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'yape'
                      ? 'bg-purple-700 text-white shadow'
                      : 'text-slate-600 hover:text-purple-700'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  Yape (Directo OTP)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('card')}
                  className={`py-2 text-xs font-semibold rounded-md flex items-center justify-center gap-1.5 transition-all ${
                    activeTab === 'card'
                      ? 'bg-sky-600 text-white shadow'
                      : 'text-slate-600 hover:text-sky-700'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  Tarjeta Débito / Crédito
                </button>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-800 flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Paciente: <strong>{personName}</strong></p>
                  <p className="text-muted-foreground">Servicio: <strong>{serviceName}</strong></p>
                </div>
                <div className="text-right">
                  <span className="text-xs text-muted-foreground">Monto:</span>
                  <p className="text-base font-bold text-purple-900">S/ {amount.toFixed(2)}</p>
                </div>
              </div>

              {/* Pestaña 1: YAPE DIRECTO */}
              {activeTab === 'yape' && (
                <form onSubmit={handleDirectYapePay} className="space-y-4 pt-1 animate-in fade-in">
                  <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-xs text-purple-900 space-y-1">
                    <p className="font-semibold flex items-center gap-1.5 text-purple-950">
                      <ShieldCheck className="w-4 h-4 text-purple-600" />
                      ¿Cómo pagar con Yape?
                    </p>
                    <p className="text-purple-800">
                      Abre tu app <strong>Yape</strong>, ve a <strong>"Código de aprobación"</strong> e ingresa el código de 6 dígitos.
                      <em> (En modo prueba puedes usar: <strong>123456</strong>)</em>.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="yape-phone" className="text-xs font-semibold">Número de Celular Yape</Label>
                    <Input
                      id="yape-phone"
                      type="tel"
                      placeholder="987654321"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="text-sm font-medium"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="yape-otp" className="text-xs font-semibold">Código de Aprobación de Yape (6 dígitos)</Label>
                    <Input
                      id="yape-otp"
                      type="text"
                      maxLength={6}
                      placeholder="Ej: 123456"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      className="text-lg tracking-widest text-center font-bold text-purple-900 border-purple-300 focus:ring-purple-500"
                      required
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || otpCode.length < 6}
                    className="w-full bg-purple-700 hover:bg-purple-800 text-white font-medium py-5 shadow flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Procesando pago con Yape...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Confirmar Pago Yape (S/ {amount.toFixed(2)})
                      </>
                    )}
                  </Button>
                </form>
              )}

              {/* Pestaña 2: TARJETA CHECKOUT API */}
              {activeTab === 'card' && (
                <div className="min-h-[200px] relative animate-in fade-in">
                  {loading && (
                    <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-10">
                      <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                    </div>
                  )}
                  
                  <CardPayment
                    initialization={{
                      amount: Math.max(Number(amount) || 1, 1),
                      payer: {
                        email: (email && email.includes('@')) ? email : 'paciente@nexosalud.com',
                      },
                    }}
                    onSubmit={async (formData) => {
                      await handleProcessCheckoutApi({ formData });
                    }}
                    onError={(error) => {
                      console.error('Error CardPayment Mercado Pago:', error);
                    }}
                    onReady={() => {
                      console.log('CardPayment Brick cargado correctamente.');
                    }}
                  />
                </div>
              )}

              {/* Botón de Simulación Rápida para Exposición */}
              <div className="pt-2 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleSimulate}
                  disabled={loading}
                  className="w-full border-amber-200 text-amber-800 bg-amber-50 hover:bg-amber-100 text-xs py-2.5 flex items-center gap-1.5 justify-center"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  ⚡ Simular Aprobación Instantánea (Para Demo / Exposición en Clase)
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
