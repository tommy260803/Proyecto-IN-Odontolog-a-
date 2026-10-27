import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  Phone,
  ArrowRight,
  MessageSquare,
  HelpCircle,
  Building2,
  AlertCircle,
  Loader2,
  ExternalLink,
  Sparkles,
  Lock,
  ChevronRight,
  Check,
} from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { buyerService } from '../../services/buyer.service';
import type { SedeCatalogItem, ServicioCatalogItem } from '../../types/buyer.types';

const ORIENTATION_REASONS = [
  { id: 'tratamientos', label: 'Conocer tratamientos', icon: Sparkles, desc: 'Alineadores, implantes o estética' },
  { id: 'precios', label: 'Precios y cuotas', icon: HelpCircle, desc: 'Facilidades de pago y cotizaciones' },
  { id: 'horarios', label: 'Horarios y citas', icon: Clock, desc: 'Disponibilidad en sedes' },
  { id: 'molestia', label: 'Consulta o molestia', icon: ShieldCheck, desc: 'Dolor o revisión general' },
];

interface BuyerIntakeFormProps {
  sedes?: SedeCatalogItem[];
  servicios?: ServicioCatalogItem[];
  onSuccess?: (refCode: string) => void;
  preselectedServiceId?: number | null;
}

export const BuyerIntakeForm: React.FC<BuyerIntakeFormProps> = ({
  sedes = [],
  servicios = [],
  onSuccess,
  preselectedServiceId,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('tratamientos');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [idSede, setIdSede] = useState<number | ''>('');
  const [idServicio, setIdServicio] = useState<number | ''>(preselectedServiceId || '');
  const [consultaBreve, setConsultaBreve] = useState('');
  const [consentimiento, setConsentimiento] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);

  useEffect(() => {
    if (preselectedServiceId) {
      setIdServicio(preselectedServiceId);
    }
  }, [preselectedServiceId]);

  // Validación de teléfono (9 dígitos Perú)
  const handlePhoneChange = async (val: string) => {
    const rawDigits = val.replace(/\D/g, '').slice(0, 9);
    setTelefono(rawDigits);
    setDuplicateWarning(null);

    if (errors.telefono && rawDigits.length === 9) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.telefono;
        return next;
      });
    }

    if (rawDigits.length === 9) {
      try {
        const res = await buyerService.checkDuplicate({ phone: rawDigits });
        if (res.isDuplicate) {
          setDuplicateWarning('¡Hola de nuevo! Ya tenemos registro de tu contacto. Tu nueva consulta será priorizada.');
        }
      } catch (e) {
        // Silencioso
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!nombre.trim() || nombre.trim().length < 2) {
      newErrors.nombre = 'Ingresa tu nombre para saber cómo llamarte';
    }

    const cleanPhone = telefono.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
      newErrors.telefono = 'Ingresa un celular de 9 dígitos que inicie con 9';
    }

    if (!consentimiento) {
      newErrors.consentimiento = 'Acepta la autorización de contacto para poder responderte';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const reasonLabel = ORIENTATION_REASONS.find((r) => r.id === selectedReason)?.label || 'Orientación';
      const declaredNeed = consultaBreve.trim()
        ? `[${reasonLabel}] ${consultaBreve.trim()}`
        : `[${reasonLabel}] Solicitud de información inicial`;

      const result = await buyerService.registerOpportunity({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        id_sede: idSede ? Number(idSede) : null,
        id_servicio: idServicio ? Number(idServicio) : null,
        motivo_consulta: declaredNeed,
        consentimiento_atencion: true,
      });

      const refCode = result.oportunidad?.id_oportunidad
        ? `OP-${String(result.oportunidad.id_oportunidad).padStart(4, '0')}`
        : `OP-${Math.floor(1000 + Math.random() * 9000)}`;

      setSubmittedRef(refCode);
      if (onSuccess) onSuccess(refCode);
    } catch (err: any) {
      setErrors({ form: err.message || 'Error al procesar la solicitud. Intenta nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedRef(null);
    setNombre('');
    setTelefono('');
    setIdSede('');
    setIdServicio('');
    setConsultaBreve('');
    setConsentimiento(false);
    setDuplicateWarning(null);
  };

  if (submittedRef) {
    const waUrl = `https://wa.me/51944612840?text=${encodeURIComponent(
      `Hola NexoSalud, envié mi solicitud ${submittedRef} (${nombre}) y quisiera recibir orientación directa.`
    )}`;

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-3xl border border-emerald-100 bg-gradient-to-b from-emerald-50/40 via-white to-white p-7 sm:p-9 shadow-xl shadow-slate-200/50"
      >
        <div className="text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <Check className="h-8 w-8 stroke-[2.5]" />
          </div>

          <div className="space-y-1.5">
            <span className="inline-block rounded-full bg-emerald-100/80 px-3 py-1 font-mono text-xs font-bold text-emerald-800">
              Solicitud #{submittedRef}
            </span>
            <h3 className="text-2xl font-bold tracking-tight text-slate-900">
              ¡Mensaje recibido, {nombre.split(' ')[0]}!
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto leading-relaxed">
              Un asesor de NexoSalud revisará tu consulta y te responderá por WhatsApp en menos de <strong className="text-slate-900 font-semibold">15 minutos</strong>.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-600 space-y-1.5 text-left max-w-sm mx-auto">
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <Clock className="h-4 w-4 text-sky-600 shrink-0" />
              <span>Horario de atención: Lun a Sáb 8:00 AM – 8:00 PM</span>
            </div>
            <div className="flex items-center gap-2 text-slate-800 font-medium">
              <Lock className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Tus datos están protegidos bajo la Ley N° 29733</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-[#25D366]/20 hover:bg-[#20BD5A] transition-all transform active:scale-98"
            >
              <MessageSquare className="h-4 w-4 fill-white" />
              <span>Escribir ahora por WhatsApp con mi código</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-80" />
            </a>

            <Button
              variant="ghost"
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-800"
            >
              Enviar otra consulta
            </Button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xl shadow-slate-200/50 backdrop-blur-sm">
      {/* Badge superior */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-50" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Orientación Odontológica Inmediata
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
          <Clock className="h-3 w-3" />
          <span>&lt; 15 min</span>
        </div>
      </div>

      <div className="mb-5">
        <h3 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">
          ¿En qué podemos orientarte?
        </h3>
        <p className="text-xs text-slate-500 mt-1">
          Sin formularios largos. Cuéntanos qué necesitas y te responderemos con claridad.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Chips de motivo visuales */}
        <div>
          <Label className="text-xs font-semibold text-slate-700 mb-2 block">
            Selecciona tu consulta principal:
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {ORIENTATION_REASONS.map((reason) => {
              const isSelected = selectedReason === reason.id;
              const Icon = reason.icon;
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedReason(reason.id)}
                  className={`flex items-start gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                    isSelected
                      ? 'border-sky-600 bg-sky-50/70 text-sky-950 shadow-xs ring-1 ring-sky-600'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className={`p-1 rounded-lg ${isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold leading-tight">{reason.label}</span>
                    <span className="block text-[10px] text-slate-400 leading-tight mt-0.5">{reason.desc}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Nombre y WhatsApp en 2 columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1">
            <Label htmlFor="buyer-nombre" className="text-xs font-semibold text-slate-700">
              ¿Cómo te llamas? <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="buyer-nombre"
              type="text"
              placeholder="Ej. Ana Morales"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`h-10 text-xs rounded-xl ${errors.nombre ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/30'}`}
              disabled={submitting}
            />
            {errors.nombre && <p className="text-[11px] text-rose-600 font-medium">{errors.nombre}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="buyer-phone" className="text-xs font-semibold text-slate-700">
              WhatsApp / Celular <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400 select-none">
                +51
              </span>
              <Input
                id="buyer-phone"
                type="tel"
                placeholder="987 654 321"
                value={telefono}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={9}
                className={`h-10 pl-11 text-xs rounded-xl font-mono ${errors.telefono ? 'border-rose-400 focus-visible:ring-rose-400 bg-rose-50/30' : 'border-slate-200 bg-slate-50/30'}`}
                disabled={submitting}
              />
            </div>
            {errors.telefono && <p className="text-[11px] text-rose-600 font-medium">{errors.telefono}</p>}
          </div>
        </div>

        {duplicateWarning && (
          <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{duplicateWarning}</span>
          </div>
        )}

        {/* Sede preferida & Tratamiento */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="buyer-sede" className="text-xs font-semibold text-slate-700">
              Sede preferida en Trujillo <span className="text-slate-400 font-normal">(Opcional)</span>
            </Label>
            <select
              id="buyer-sede"
              value={idSede}
              onChange={(e) => setIdSede(e.target.value ? Number(e.target.value) : '')}
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/30 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-600"
              disabled={submitting}
            >
              <option value="">Cualquiera en Trujillo</option>
              {sedes.map((s) => (
                <option key={s.id_sede} value={s.id_sede}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="buyer-servicio" className="text-xs font-semibold text-slate-700">
              Tratamiento de interés <span className="text-slate-400 font-normal">(Opcional)</span>
            </Label>
            <select
              id="buyer-servicio"
              value={idServicio}
              onChange={(e) => setIdServicio(e.target.value ? Number(e.target.value) : '')}
              className="w-full h-10 rounded-xl border border-slate-200 bg-slate-50/30 px-3 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-600"
              disabled={submitting}
            >
              <option value="">No lo sé aún / Orientación</option>
              {servicios.map((srv) => (
                <option key={srv.id_servicio} value={srv.id_servicio}>
                  {srv.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Consulta breve */}
        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <Label htmlFor="buyer-consulta" className="text-xs font-semibold text-slate-700">
              ¿Quieres añadir algún detalle? <span className="text-slate-400 font-normal">(Opcional)</span>
            </Label>
            <span className="text-[10px] text-slate-400 font-mono">{consultaBreve.length}/200</span>
          </div>
          <Input
            id="buyer-consulta"
            maxLength={200}
            placeholder="Ej. Quiero saber de brackets invisibles o costos..."
            value={consultaBreve}
            onChange={(e) => setConsultaBreve(e.target.value)}
            className="h-10 text-xs rounded-xl border-slate-200 bg-slate-50/30"
            disabled={submitting}
          />
        </div>

        {/* Consentimiento Ley N° 29733 */}
        <div className="pt-1 space-y-1">
          <div className="flex items-start gap-2.5">
            <input
              id="buyer-consentimiento"
              type="checkbox"
              checked={consentimiento}
              onChange={(e) => {
                setConsentimiento(e.target.checked);
                if (e.target.checked && errors.consentimiento) {
                  setErrors((prev) => {
                    const next = { ...prev };
                    delete next.consentimiento;
                    return next;
                  });
                }
              }}
              className="mt-0.5 h-4 w-4 rounded-md border-slate-300 text-sky-600 focus:ring-sky-600 cursor-pointer"
              disabled={submitting}
            />
            <label htmlFor="buyer-consentimiento" className="text-[11px] text-slate-600 leading-snug cursor-pointer select-none">
              Autorizo a NexoSalud a responder mi consulta por WhatsApp o llamada, respetando mi privacidad bajo la{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setPrivacyModalOpen(true);
                }}
                className="font-medium text-sky-700 underline hover:text-sky-900"
              >
                Ley N° 29733 de Protección de Datos Personales
              </button>
              .
            </label>
          </div>
          {errors.consentimiento && (
            <p className="text-[11px] text-rose-600 font-medium pl-6">{errors.consentimiento}</p>
          )}
        </div>

        {errors.form && (
          <div className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            {errors.form}
          </div>
        )}

        {/* Botón principal */}
        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-11 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-700 text-white font-semibold hover:from-sky-700 hover:to-indigo-800 shadow-md shadow-sky-600/20 transition-all text-xs sm:text-sm flex items-center justify-center gap-2 transform active:scale-98"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Enviando consulta...</span>
            </>
          ) : (
            <>
              <span>Recibir orientación sin compromiso</span>
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <Lock className="h-3 w-3" /> Cero spam
          </span>
          <span>·</span>
          <span>Sin costos ocultos</span>
          <span>·</span>
          <span>Respuesta &lt; 15 min</span>
        </div>
      </form>

      {/* Modal accesible de Política de Privacidad */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Protección de Datos Personales (Ley N° 29733)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              NexoSalud Odontología Especializada · Trujillo, Perú
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-600 max-h-[60vh] overflow-y-auto pr-1 leading-relaxed">
            <p>
              En cumplimiento de la <strong>Ley N° 29733</strong>, le informamos que sus datos serán tratados con las siguientes garantías:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Finalidad exclusiva:</strong> Responder sus dudas sobre tratamientos odontológicos, presupuestos y coordinación de turnos.
              </li>
              <li>
                <strong>Cero cesión:</strong> Jamás venderemos ni transferiremos sus datos a empresas terceras o publicidad ajena a su salud dental.
              </li>
              <li>
                <strong>Seguridad y confidencialidad:</strong> Almacenamiento seguro bajo estricto secreto profesional médico.
              </li>
              <li>
                <strong>Derechos ARCO:</strong> Puede solicitar la eliminación o actualización de sus datos en cualquier momento escribiendo a <span className="font-mono text-slate-800">privacidad@nexosalud.pe</span>.
              </li>
            </ul>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrivacyModalOpen(false)}
              className="text-xs rounded-xl"
            >
              Cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
