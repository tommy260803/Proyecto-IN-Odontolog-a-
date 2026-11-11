import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { CheckCircle2, Clock, AlertTriangle, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function ProrrogaExpressPage() {
  const { reservaId, id } = useParams<{ reservaId?: string; id?: string }>();
  const targetId = reservaId || id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'SUCCESS' | 'ALREADY_GRANTED' | 'ERROR'>('LOADING' as any);
  const [data, setData] = useState<{
    message?: string;
    nuevoVencimiento?: string;
    pacienteNombre?: string;
  }>({});

  useEffect(() => {
    if (!targetId) {
      setStatus('ERROR');
      setLoading(false);
      return;
    }

    const applyExtension = async () => {
      try {
        const res = await fetch(`${API_URL}/whatsapp/request-extension`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reservaId: Number(targetId) }),
        });

        const json = await res.json().catch(() => ({}));

        if (res.ok && json.success) {
          setStatus('SUCCESS');
          setData(json);
        } else if (res.status === 409 || json.message?.includes('previamente') || json.message?.includes('concedió')) {
          setStatus('ALREADY_GRANTED');
          setData(json);
        } else {
          setStatus('ERROR');
          setData(json);
        }
      } catch (err: any) {
        setStatus('ERROR');
        setData({ message: err.message || 'Error de conexión con el servidor.' });
      } finally {
        setLoading(false);
      }
    };

    applyExtension();
  }, [targetId]);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden">
        {/* Glow de fondo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo NexoSalud */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/60 px-4 py-1.5 rounded-full">
            <div className="w-5 h-5 rounded-md bg-white p-0.5 flex items-center justify-center">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide">Clínica NexoSalud</span>
          </div>
        </div>

        {/* Estado: CARGANDO */}
        {loading && (
          <div className="py-12 flex flex-col items-center">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
            <h2 className="text-lg font-bold text-white">Procesando solicitud de prórroga...</h2>
            <p className="text-xs text-slate-400 mt-2">Validando reserva médica en el sistema...</p>
          </div>
        )}

        {/* Estado: ÉXITO (+24 Horas Concedidas) */}
        {!loading && status === 'SUCCESS' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ¡Prórroga de 24h Concedida!
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                Estimado(a) <strong className="text-slate-200">{data.pacienteNombre || 'Paciente'}</strong>, su sillón odontológico ha sido reservado por 24 horas adicionales.
              </p>
            </div>

            {data.nuevoVencimiento && (
              <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl p-4 text-left space-y-1">
                <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" /> Nuevo Límite de Tolerancia
                </span>
                <p className="text-base font-extrabold text-white">
                  {new Date(data.nuevoVencimiento).toLocaleString('es-PE', {
                    dateStyle: 'full',
                    timeStyle: 'short',
                  })}
                </p>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() => navigate(targetId ? `/pasarela-pago/ORD-${String(targetId).padStart(5, '0')}-2026` : '/pasarela-pago')}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Completar Pago en Pasarela Segura</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Estado: YA SOLICITADA PREVIAMENTE (Regla Anti-Abuso) */}
        {!loading && status === 'ALREADY_GRANTED' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Prórroga Ya Otorgada
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                {data.message || 'Ya se concedió previamente una prórroga de 24 horas para esta reserva. Debe regularizar su abono para asegurar su sillón odontológico.'}
              </p>
            </div>

            <div className="pt-2">
              <Button
                onClick={() => navigate(targetId ? `/pasarela-pago/ORD-${String(targetId).padStart(5, '0')}-2026` : '/pasarela-pago')}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ir a la Pasarela de Pago Oficial</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Estado: ERROR */}
        {!loading && status === 'ERROR' && (
          <div className="space-y-5 animate-in fade-in duration-300">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                No se pudo procesar la prórroga
              </h1>
              <p className="text-xs text-slate-400 mt-2">
                {data.message || 'La reserva indicada no fue encontrada o ya no está en estado pendiente.'}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/payer')}
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 h-11 rounded-xl"
              >
                Volver al Sistema
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Atención Odontológica Personalizada • NexoSalud</span>
        </div>
      </div>
    </div>
  );
}

