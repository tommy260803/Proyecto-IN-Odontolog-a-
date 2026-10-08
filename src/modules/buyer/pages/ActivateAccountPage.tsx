import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { Toaster } from '@/shared/components/ui/toaster';
import { LoadingState } from '@/shared/components/feedback/LoadingState';
import { patientAuthApi } from '@/shared/services/patientAuthService';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  KeyRound,
  ArrowRight,
  User,
  Sparkles
} from 'lucide-react';

export default function ActivateAccountPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token') || '';

  const [checkingToken, setCheckingToken] = useState(true);
  const [tokenValid, setTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [patientData, setPatientData] = useState<any>(null);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) {
      setCheckingToken(false);
      setTokenValid(false);
      setTokenError('No se proporcionó ningún token de activación en el enlace.');
      return;
    }

    patientAuthApi.validateToken(token)
      .then((res) => {
        if (res.valid && res.patient) {
          setTokenValid(true);
          setPatientData(res.patient);
        } else {
          setTokenValid(false);
          setTokenError(res.message || 'El enlace de activación no es válido o ya caducó.');
        }
      })
      .catch((err) => {
        setTokenValid(false);
        setTokenError(err.message || 'Error al validar el enlace de activación.');
      })
      .finally(() => {
        setCheckingToken(false);
      });
  }, [token]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || password.length < 6) {
      toast({
        title: 'Contraseña muy corta',
        description: 'La contraseña debe tener al menos 6 caracteres para tu seguridad médica.',
        variant: 'destructive',
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: 'Las contraseñas no coinciden',
        description: 'Verifica que ambas contraseñas sean idénticas.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      await patientAuthApi.activatePassword(token, password);
      setSuccess(true);
      toast({
        title: '¡Cuenta Activada con Éxito!',
        description: 'Tu contraseña personal ha sido configurada. Ya puedes ingresar a tu Portal del Paciente.',
      });
    } catch (err: any) {
      toast({
        title: 'Error de activación',
        description: err.message || 'No se pudo guardar la contraseña. Inténtalo nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingToken) {
    return (
      <div className="min-h-screen w-full bg-slate-950 flex flex-col items-center justify-center p-4">
        <LoadingState />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* Background Decor */}
      <div className="absolute inset-0 pointer-events-none -z-10">
        <img 
          src="/Fondo_NexoSalud.png" 
          alt="Fondo NexoSalud" 
          className="absolute inset-0 w-full h-full object-cover object-center opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950" />
      </div>

      <div className="w-full max-w-md space-y-6 z-10 animate-in fade-in zoom-in-95 duration-400">
        
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 rounded-2xl bg-white shadow-xl ring-1 ring-slate-800 mb-1">
            <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="h-10 w-10 object-contain" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            NexoSalud <span className="text-teal-400 font-bold">Dental</span>
          </h1>
          <p className="text-xs text-slate-400 font-medium">
            Activación Segura de Cuenta de Paciente · Primer Acceso
          </p>
        </div>

        {!tokenValid ? (
          /* Error en Token */
          <Card className="bg-slate-900/90 border border-slate-800 text-white rounded-3xl p-6 shadow-2xl backdrop-blur text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-lg font-bold text-white">Enlace No Válido o Expirado</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                {tokenError || 'Este enlace de activación ya fue utilizado o caducó por límite de tiempo (24h).'}
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => navigate('/solicitar-informacion')}
                className="w-full h-10 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs gap-2 cursor-pointer shadow-md shadow-teal-700/20"
              >
                <span>Ir al Portal del Paciente</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : success ? (
          /* Éxito */
          <Card className="bg-slate-900/90 border border-teal-500/30 text-white rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur text-center space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/10">
              <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
            </div>

            <div className="space-y-2">
              <Badge className="bg-teal-500/20 text-teal-300 border border-teal-500/30 text-[10px] px-2.5 py-0.5 rounded-full">
                <Sparkles className="w-2.5 h-2.5 mr-1" /> Expediente Protegido
              </Badge>
              <h2 className="text-xl font-black text-white">¡Contraseña Guardada con Éxito!</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Tu cuenta de paciente ha quedado activada. A partir de ahora podrás iniciar sesión con tu <strong>DNI ({patientData?.dni})</strong> y tu nueva contraseña.
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => navigate('/solicitar-informacion')}
                className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs gap-2 cursor-pointer shadow-lg shadow-teal-700/30"
              >
                <span>Iniciar Sesión en el Portal</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ) : (
          /* Formulario de Activación */
          <Card className="bg-slate-900/90 border border-slate-800 text-white rounded-3xl overflow-hidden shadow-2xl backdrop-blur">
            
            {/* Header Card */}
            <div className="px-6 py-4 bg-gradient-to-r from-teal-600 to-emerald-700 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-semibold text-teal-100 uppercase tracking-wider block">
                  Paso Final de Seguridad
                </span>
                <h2 className="text-sm sm:text-base font-black text-white">
                  Crea tu Contraseña Personal
                </h2>
              </div>
              <KeyRound className="h-6 w-6 text-teal-200" />
            </div>

            {/* Ficha Resumen del Paciente */}
            <div className="px-6 pt-5 pb-2">
              <div className="p-3.5 rounded-2xl bg-slate-800/80 border border-slate-700/60 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <User className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{patientData?.fullName}</p>
                  <p className="text-[11px] text-slate-400 font-mono">DNI: {patientData?.dni}</p>
                </div>
              </div>
            </div>

            {/* Inputs de Contraseña */}
            <form onSubmit={handleActivate} className="p-6 space-y-4">
              
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5 text-teal-400" />
                  Nueva Contraseña
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-10 rounded-xl text-xs bg-slate-950/80 border border-slate-700 text-white placeholder:text-slate-500 pr-10 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
                  Confirmar Contraseña
                </Label>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repite tu nueva contraseña"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="h-10 rounded-xl text-xs bg-slate-950/80 border border-slate-700 text-white placeholder:text-slate-500 focus:border-teal-500 focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <p className="text-[10px] text-slate-400 leading-tight">
                💡 Esta contraseña te servirá para ingresar siempre que desees consultar tus citas o pedir atenciones rápidas.
              </p>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold rounded-xl text-xs gap-2 shadow-lg shadow-teal-700/25 cursor-pointer"
                >
                  {submitting ? (
                    <span>Guardando contraseña...</span>
                  ) : (
                    <>
                      <span>Activar y Guardar Contraseña</span>
                      <CheckCircle2 className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

            </form>
          </Card>
        )}

      </div>

      <Toaster />
    </div>
  );
}

