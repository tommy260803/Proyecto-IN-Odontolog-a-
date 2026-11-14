import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { useToast } from '@/shared/hooks/use-toast';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Calendar,
  CalendarDays,
  MapPin,
  UserCheck,
  Sparkles,
  Check,
  ArrowLeft,
  Phone,
  CreditCard,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const formatDateIso = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ProrrogaExpressPage() {
  const { reservaId, id } = useParams<{ reservaId?: string; id?: string }>();
  const targetId = reservaId || id;
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'SELECTING' | 'SUCCESS' | 'ALREADY_GRANTED' | 'ERROR'>('SELECTING');

  const [reservaInfo, setReservaInfo] = useState<any>(null);
  const [rules, setRules] = useState<any>({ prorroga_express_horas: 24, maxDiasProrroga: 3 });
  const [errorMessage, setErrorMessage] = useState('');

  // Estados del formulario interactivo de prórroga
  const [nuevaFechaCita, setNuevaFechaCita] = useState('');
  const [nuevoTurno, setNuevoTurno] = useState('09:00 - 13:00 (Mañana)');
  const [showCalendarInput, setShowCalendarInput] = useState(false);
  const [confirmResult, setConfirmResult] = useState<any>(null);

  // Cargar datos de la reserva y reglas vigentes SIN confirmar nada automáticamente
  useEffect(() => {
    if (!targetId) {
      setStatus('ERROR');
      setErrorMessage('No se proporcionó un ID de reserva válido.');
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetch(`${API_URL}/whatsapp/prorroga-info/${targetId}`)
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!isMounted) return;

        if (res.ok && json.success && json.reserva) {
          setReservaInfo(json.reserva);
          setRules(json.rules || { prorroga_express_horas: 24, maxDiasProrroga: 3 });

          if (json.reserva.yaTieneProrroga) {
            setStatus('ALREADY_GRANTED');
          } else if (!['Pendiente', 'Pre-reservada', 'PENDIENTE'].includes(json.reserva.estado)) {
            setStatus('ALREADY_GRANTED');
          } else {
            setStatus('SELECTING');

            // Calcular fecha por defecto según la hora de prórroga configurada en el sistema
            const extHours = Number(json.rules?.prorroga_express_horas || 24);
            const defaultDaysOffset = Math.max(1, Math.min(3, Math.round(extHours / 24)));

            // Tomar como base la fecha prometida o la fecha de la cita actual
            const baseDate = json.reserva.fechaPrometidaPago
              ? new Date(json.reserva.fechaPrometidaPago)
              : (json.reserva.fechaCitaActual ? new Date(`${json.reserva.fechaCitaActual}T12:00:00`) : new Date());

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // Si la base era anterior a hoy, arrancar desde hoy
            const startingPoint = baseDate > today ? baseDate : today;
            const defaultDate = new Date(startingPoint);
            defaultDate.setDate(defaultDate.getDate() + defaultDaysOffset);

            setNuevaFechaCita(formatDateIso(defaultDate));
            if (json.reserva.horaCitaActual) {
              setNuevoTurno(json.reserva.horaCitaActual);
            }
          }
        } else {
          setStatus('ERROR');
          setErrorMessage(json.message || 'No se encontró la reserva indicada o no está disponible.');
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setStatus('ERROR');
        setErrorMessage(err.message || 'Error de conexión al consultar los datos de la reserva.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [targetId]);

  // Cálculo de los días elegibles (hasta máximo 3 días después de la fecha prometida)
  const availableDays = useMemo(() => {
    if (!reservaInfo) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const baseDate = reservaInfo.fechaPrometidaPago
      ? new Date(reservaInfo.fechaPrometidaPago)
      : (reservaInfo.fechaCitaActual ? new Date(`${reservaInfo.fechaCitaActual}T12:00:00`) : new Date());

    const startingDate = baseDate > today ? baseDate : today;

    const daysOfWeek = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Dic'];

    const extHours = Number(rules?.prorroga_express_horas || 24);
    const defaultOffset = Math.max(1, Math.min(3, Math.round(extHours / 24)));

    const list: Array<{
      iso: string;
      dayName: string;
      dayNum: number;
      month: string;
      badgeText?: string;
      isDefault: boolean;
      offset: number;
    }> = [];

    // Generar opciones: Hoy, +1 día, +2 días, +3 días (máximo 3 días)
    for (let i = 0; i <= 3; i++) {
      const d = new Date(startingDate);
      d.setDate(startingDate.getDate() + i);

      // No permitir fechas en el pasado
      if (d < today) continue;

      const iso = formatDateIso(d);
      const isDefault = i === defaultOffset || (i === 1 && defaultOffset === 0);

      let badgeText: string | undefined;
      if (isDefault) {
        badgeText = `Por Defecto (+${extHours}h)`;
      } else if (i === 0) {
        badgeText = 'Hoy Mismo';
      } else if (i === 3) {
        badgeText = 'Límite (+72h)';
      } else {
        badgeText = 'Opción Sugerida';
      }

      list.push({
        iso,
        dayName: i === 0 ? 'Hoy' : i === 1 ? 'Mañana' : daysOfWeek[d.getDay()],
        dayNum: d.getDate(),
        month: months[d.getMonth()],
        badgeText,
        isDefault,
        offset: i,
      });
    }

    return list;
  }, [reservaInfo, rules]);

  // Límite mínimo y máximo para input type="date"
  const minDateStr = formatDateIso(new Date());
  const maxDateStr = useMemo(() => {
    if (availableDays.length > 0) {
      return availableDays[availableDays.length - 1].iso;
    }
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return formatDateIso(d);
  }, [availableDays]);

  // Acción de Confirmación EXPLÍCITA: sólo aquí se ejecuta el reagendamiento y prórroga
  const handleConfirmProrroga = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nuevaFechaCita) {
      toast({
        title: 'Seleccione una fecha',
        description: 'Por favor seleccione el día en que desea ser atendido.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/whatsapp/confirmar-prorroga`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservaId: Number(targetId),
          nuevaFechaCita,
          nuevoTurno,
          motivo: 'Prórroga autogestionada y confirmada desde el portal web',
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        setConfirmResult(json);
        setStatus('SUCCESS');
        toast({
          title: '¡Prórroga Confirmada!',
          description: `Tu cita ha sido reagendada para el ${nuevaFechaCita} (${nuevoTurno}). Tu sillón odontológico queda asegurado.`,
        });
      } else if (res.status === 409 || json.message?.includes('previamente') || json.message?.includes('concedió')) {
        setStatus('ALREADY_GRANTED');
      } else {
        toast({
          title: 'Error al confirmar prórroga',
          description: json.message || 'No se pudo procesar la prórroga.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error de conexión',
        description: err.message || 'No se pudo conectar con el servidor central.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-3 sm:p-6 text-slate-100">
      <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glows de ambientación médica */}
        <div className="absolute -top-24 -left-24 w-52 h-52 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-52 h-52 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Cabecera NexoSalud */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white p-1 flex items-center justify-center shadow-sm">
              <img src="/Logo_NexoSalud.png" alt="NexoSalud" className="w-full h-full object-contain" />
            </div>
            <div>
              <div className="text-xs font-bold text-white tracking-wide">Clínica Odontológica NexoSalud</div>
              <div className="text-[10px] text-teal-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-teal-400" />
                Blindaje de Sillón Odontológico · Agente Payer
              </div>
            </div>
          </div>

          <span className="text-[10px] uppercase font-mono px-2.5 py-1 rounded-full bg-teal-950 border border-teal-800/60 text-teal-300 font-bold">
            Portal Paciente
          </span>
        </div>

        {/* 1. Estado: CARGANDO */}
        {loading && (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
            <RefreshCw className="w-10 h-10 text-teal-400 animate-spin" />
            <h2 className="text-base font-bold text-white">Consultando reserva en NexoSaludDB...</h2>
            <p className="text-xs text-slate-400">Verificando disponibilidad de sillón y políticas de prórroga...</p>
          </div>
        )}

        {/* 2. Estado: SELECCIONANDO FECHA Y TURNO (No confirmado aún) */}
        {!loading && status === 'SELECTING' && reservaInfo && (
          <form onSubmit={handleConfirmProrroga} className="space-y-5 animate-in fade-in duration-300">
            {/* Banner Informativo Superior */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 via-slate-900 to-slate-900 border border-teal-800/60 space-y-2">
              <div className="flex items-center gap-2 text-teal-300 font-bold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4 text-teal-400" />
                <span>Solicitud de Prórroga y Reagendamiento</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Estimado(a) <strong className="text-white">{reservaInfo.pacienteNombre}</strong>, puedes extender tu plazo de pago y reagendar tu cita médica hasta un{' '}
                <strong className="text-amber-300">máximo de 3 días</strong> posteriores a tu fecha prometida. Tu prórroga sólo se aplicará cuando presiones el botón de confirmación.
              </p>
            </div>

            {/* Ficha Resumen de la Cita Original */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950/60 border border-slate-800/80 text-xs">
              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">Tratamiento / Servicio</span>
                <p className="font-bold text-white truncate">{reservaInfo.servicioNombre}</p>
                <p className="text-[11px] text-teal-400 font-bold">S/ {reservaInfo.monto?.toFixed(2)} PEN</p>
              </div>

              <div className="space-y-0.5">
                <span className="text-[10px] uppercase font-bold text-slate-500">Sede Asignada</span>
                <p className="font-semibold text-slate-200 truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                  {reservaInfo.sedeNombre}
                </p>
                <p className="text-[10px] text-slate-400 truncate">{reservaInfo.profesionalNombre}</p>
              </div>

              <div className="col-span-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">
                  Cita programada actualmente:{' '}
                  <strong className="text-slate-200">
                    {reservaInfo.fechaCitaActual} · {reservaInfo.horaCitaActual}
                  </strong>
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-800/60 text-[10px] font-bold">
                  {reservaInfo.codigoReserva}
                </span>
              </div>
            </div>

            {/* Selector de Días Interactivo (Idéntico a PreReservationPage) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-teal-400" />
                  <span>Elige el nuevo día de tu cita (Máximo 3 días):</span>
                </Label>
                <span className="text-[11px] text-teal-300 font-bold font-mono">
                  {nuevaFechaCita || 'Sin elegir'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {availableDays.map((day) => {
                  const isSelected = nuevaFechaCita === day.iso;
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      onClick={() => {
                        setNuevaFechaCita(day.iso);
                        setShowCalendarInput(false);
                      }}
                      className={`py-3 px-2 rounded-2xl border flex flex-col items-center justify-center transition-all cursor-pointer relative ${
                        isSelected
                          ? 'bg-teal-600 border-teal-400 text-white shadow-lg shadow-teal-950 ring-2 ring-teal-400/50'
                          : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-teal-500/50'
                      }`}
                    >
                      {day.badgeText && (
                        <span
                          className={`absolute -top-2 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tight shadow-xs ${
                            isSelected
                              ? 'bg-amber-400 text-slate-950 font-extrabold'
                              : 'bg-teal-950 border border-teal-800 text-teal-300'
                          }`}
                        >
                          {day.badgeText}
                        </span>
                      )}

                      <span className={`text-[10px] font-bold ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
                        {day.dayName}
                      </span>
                      <span className="text-base sm:text-lg font-black tracking-tight leading-tight my-0.5">
                        {day.dayNum}
                      </span>
                      <span className={`text-[9px] uppercase font-semibold ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                        {day.month}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Botón para alternar a selector de fecha directo */}
              <div className="pt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowCalendarInput(!showCalendarInput)}
                  className="text-[11px] font-medium text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>{showCalendarInput ? 'Ocultar calendario manual' : '¿Prefieres seleccionar con calendario manual?'}</span>
                </button>
              </div>

              {showCalendarInput && (
                <div className="pt-1 animate-in fade-in-50 duration-200">
                  <Input
                    type="date"
                    min={minDateStr}
                    max={maxDateStr}
                    value={nuevaFechaCita}
                    onChange={(e) => setNuevaFechaCita(e.target.value)}
                    className="bg-slate-900 text-white border-slate-700 text-xs h-9 rounded-xl focus:border-teal-500 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Rango permitido: desde {minDateStr} hasta {maxDateStr} (máximo 3 días adicionales).
                  </p>
                </div>
              )}
            </div>

            {/* Selector de Turno de Atención */}
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-teal-400" />
                <span>Turno preferido para tu cita:</span>
              </Label>
              <Select value={nuevoTurno} onValueChange={setNuevoTurno}>
                <SelectTrigger className="bg-slate-900 border-slate-800 text-white text-xs h-10 rounded-xl focus:border-teal-500">
                  <SelectValue placeholder="Selecciona el turno preferido" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-800 text-white">
                  <SelectItem value="09:00 - 13:00 (Mañana)">Mañana (09:00 AM - 01:00 PM)</SelectItem>
                  <SelectItem value="14:00 - 18:00 (Tarde)">Tarde (02:00 PM - 06:00 PM)</SelectItem>
                  <SelectItem value="18:00 - 21:00 (Noche)">Noche (06:00 PM - 09:00 PM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Tarjeta de Confirmación de Impacto */}
            <div className="p-3.5 rounded-2xl bg-teal-950/40 border border-teal-800/60 text-xs space-y-1.5">
              <div className="font-bold text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>Resumen de tu Reagendamiento:</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Fecha elegida:</span>
                  <strong className="text-white">{nuevaFechaCita}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Turno de atención:</span>
                  <strong className="text-white">{nuevoTurno}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sillón odontológico:</span>
                  <strong className="text-emerald-400">Blindado y asegurado</strong>
                </div>
              </div>
            </div>

            {/* Botón de Confirmación Principal */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting || !nuevaFechaCita}
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold h-12 rounded-2xl shadow-xl shadow-teal-950 flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50 text-xs sm:text-sm"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-white" />
                    <span>Actualizando fecha de cita en base de datos...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Confirmar Prórroga y Reagendar Cita</span>
                  </>
                )}
              </Button>
              <p className="text-[10px] text-slate-500 text-center mt-2">
                Al confirmar, el sistema de admisiones reprogramará automáticamente tu turno en SQL Server.
              </p>
            </div>
          </form>
        )}

        {/* 3. Estado: ÉXITO (Confirmada la Prórroga y Reagendada la Cita) */}
        {!loading && status === 'SUCCESS' && (
          <div className="space-y-5 animate-in fade-in duration-300 text-center">
            <div className="w-16 h-16 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-8 h-8 text-teal-400" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                ¡Prórroga Confirmada y Cita Reagendada!
              </h1>
              <p className="text-xs text-slate-400 mt-1.5">
                Estimado(a) <strong className="text-slate-200">{confirmResult?.pacienteNombre || reservaInfo?.pacienteNombre}</strong>, tu cita médica y tu sillón odontológico han sido actualizados en la base de datos oficial.
              </p>
            </div>

            <div className="bg-slate-950/80 border border-teal-800/60 rounded-2xl p-4 text-left space-y-2">
              <span className="text-[11px] font-bold text-teal-400 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-teal-400" /> Nueva Cita Médica Confirmada
              </span>
              <div className="space-y-1 text-xs">
                <p className="text-base font-extrabold text-white">
                  {confirmResult?.nuevaFechaCita || nuevaFechaCita} — {confirmResult?.nuevoTurno || nuevoTurno}
                </p>
                <p className="text-slate-400">
                  Sede: <strong className="text-slate-200">{reservaInfo?.sedeNombre}</strong>
                </p>
                {confirmResult?.nuevoVencimiento && (
                  <p className="text-[11px] text-amber-300 pt-1 border-t border-slate-800">
                    Nuevo límite de pago:{' '}
                    <strong>
                      {new Date(confirmResult.nuevoVencimiento).toLocaleString('es-PE', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </strong>
                  </p>
                )}
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={() =>
                  navigate(
                    reservaInfo?.codigoReserva
                      ? `/pasarela-pago/${reservaInfo.codigoReserva}`
                      : targetId
                      ? `/pasarela-pago/ORD-${String(targetId).padStart(5, '0')}-2026`
                      : '/pasarela-pago'
                  )
                }
                className="w-full bg-teal-600 hover:bg-teal-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-teal-950 flex items-center justify-center gap-2 cursor-pointer"
              >
                <CreditCard className="w-4 h-4" />
                <span>Completar Pago en Pasarela Segura</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 4. Estado: PRÓRROGA YA OTORGADA PREVIAMENTE (Regla Anti-Abuso) */}
        {!loading && status === 'ALREADY_GRANTED' && (
          <div className="space-y-5 animate-in fade-in duration-300 text-center">
            <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 text-amber-400" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                Prórroga Ya Concedida
              </h1>
              <p className="text-xs text-slate-300 mt-2 leading-relaxed">
                Ya se concedió previamente una prórroga para esta reserva médica. Para asegurar tu sillón odontológico y evitar la liberación automática a medianoche, por favor regulariza tu pago.
              </p>
            </div>

            {reservaInfo && (
              <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 text-left text-xs space-y-1">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Paciente:</span>
                  <strong className="text-white">{reservaInfo.pacienteNombre}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Tratamiento:</span>
                  <strong className="text-white">{reservaInfo.servicioNombre}</strong>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Cita programada:</span>
                  <strong className="text-teal-400">{reservaInfo.fechaCitaActual} ({reservaInfo.horaCitaActual})</strong>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                onClick={() =>
                  navigate(
                    reservaInfo?.codigoReserva
                      ? `/pasarela-pago/${reservaInfo.codigoReserva}`
                      : targetId
                      ? `/pasarela-pago/ORD-${String(targetId).padStart(5, '0')}-2026`
                      : '/pasarela-pago'
                  )
                }
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold h-11 rounded-xl shadow-lg shadow-amber-950 flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Ir a la Pasarela de Pago Oficial</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* 5. Estado: ERROR */}
        {!loading && status === 'ERROR' && (
          <div className="space-y-5 animate-in fade-in duration-300 text-center">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <AlertTriangle className="w-8 h-8 text-rose-400" />
            </div>

            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                No se pudo procesar la solicitud
              </h1>
              <p className="text-xs text-slate-400 mt-2">
                {errorMessage || 'La reserva indicada no fue encontrada o ya no está en estado pendiente.'}
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                onClick={() => navigate('/payer')}
                className="w-full border-slate-700 text-slate-200 hover:bg-slate-800 h-11 rounded-xl"
              >
                Volver al Sistema de Cobranzas
              </Button>
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t border-slate-800/80 flex items-center justify-center gap-2 text-[11px] text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
          <span>Atención Odontológica Personalizada • NexoSalud</span>
        </div>
      </div>
    </div>
  );
}
