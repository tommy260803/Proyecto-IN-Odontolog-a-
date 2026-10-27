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
  ChevronDown
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
  { id: 'tratamientos', label: 'Conocer tratamientos y opciones', icon: MessageSquare },
  { id: 'precios', label: 'Precios y facilidades de pago', icon: HelpCircle },
  { id: 'horarios', label: 'Horarios y disponibilidad', icon: Clock },
  { id: 'molestia', label: 'Consulta o molestia dental', icon: ShieldCheck },
  { id: 'duda', label: 'Aún no estoy seguro/a de qué necesito', icon: HelpCircle },
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
  const [email, setEmail] = useState('');
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
      // Chequeo en vivo de duplicidad
      try {
        const res = await buyerService.checkDuplicate({ phone: rawDigits });
        if (res.isDuplicate) {
          setDuplicateWarning('Este número ya tiene una solicitud previa registrada. Tu nueva consulta será asociada para darte seguimiento prioritario.');
        }
      } catch (e) {
        // Silencioso
      }
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!nombre.trim() || nombre.trim().length < 2) {
      newErrors.nombre = 'Por favor ingresa tu nombre (mínimo 2 letras)';
    }

    const cleanPhone = telefono.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length !== 9 || !cleanPhone.startsWith('9')) {
      newErrors.telefono = 'Ingresa un número de celular de 9 dígitos que inicie con 9 (ej. 987654321)';
    }

    if (email && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'El formato del correo electrónico no es válido';
    }

    if (!consentimiento) {
      newErrors.consentimiento = 'Debes aceptar ser contactado/a para que podamos responder tu consulta';
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
        : `[${reasonLabel}] Solicitud de información y orientación inicial`;

      const result = await buyerService.registerOpportunity({
        nombre: nombre.trim(),
        telefono: telefono.trim(),
        email: email.trim() || null,
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
      setErrors({ form: err.message || 'Ocurrió un error al enviar tu consulta. Por favor inténtalo nuevamente.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setSubmittedRef(null);
    setNombre('');
    setTelefono('');
    setEmail('');
    setIdSede('');
    setIdServicio('');
    setConsultaBreve('');
    setConsentimiento(false);
    setDuplicateWarning(null);
  };

  if (submittedRef) {
    const waUrl = `https://wa.me/51944612840?text=${encodeURIComponent(
      `Hola NexoSalud, envié mi solicitud ${submittedRef} y quisiera comunicarme directamente.`
    )}`;

    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50">
            <CheckCircle2 className="h-7 w-7" />
          </div>

          <div className="space-y-1">
            <span className="inline-block rounded-full bg-slate-100 px-3 py-1 font-mono text-xs font-semibold text-slate-700">
              Solicitud #{submittedRef}
            </span>
            <h3 className="text-xl font-semibold tracking-tight text-slate-900">
              ¡Gracias por escribirnos, {nombre.split(' ')[0]}!
            </h3>
            <p className="text-sm text-slate-600 max-w-sm mx-auto">
              Hemos recibido tus datos correctamente. Nuestro equipo de orientación te contactará vía WhatsApp o llamada en menos de <strong className="text-slate-900 font-medium">15 minutos</strong> durante nuestro horario de atención (Lun – Sáb 8:00 AM – 8:00 PM).
            </p>
          </div>

          <div className="pt-2 pb-2 border-y border-slate-100 my-4 text-xs text-slate-500 space-y-1">
            <p>✓ Asesor asignado con dedicación personalizada</p>
            <p>✓ Información sin compromiso de contratación ni cargos ocultos</p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row justify-center">
            <a
              href={waUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-emerald-700 transition-colors"
            >
              <MessageSquare className="h-4 w-4" />
              Escribir por WhatsApp ahora
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </a>

            <Button
              variant="outline"
              onClick={handleReset}
              className="rounded-xl border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              Enviar otra consulta
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-sm">
      <div className="mb-5 space-y-1">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
          <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
            Orientación Odontológica Inicial
          </span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-slate-900">
          ¿En qué podemos orientarte hoy?
        </h3>
        <p className="text-xs text-slate-500">
          Sin compromiso. Te explicamos opciones, costos y disponibilidad con total honestidad.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Motivo de consulta (Chips de bajo esfuerzo) */}
        <div>
          <Label className="text-xs font-medium text-slate-700 mb-2 block">
            Selecciona tu principal inquietud:
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {ORIENTATION_REASONS.map((reason) => {
              const isSelected = selectedReason === reason.id;
              return (
                <button
                  key={reason.id}
                  type="button"
                  onClick={() => setSelectedReason(reason.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                  }`}
                >
                  {reason.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nombre y Teléfono */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="buyer-nombre" className="text-xs font-medium text-slate-700">
              ¿Cómo te llamas? <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="buyer-nombre"
              type="text"
              placeholder="Ej. Carmen Flores"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className={`h-9 text-xs rounded-lg ${errors.nombre ? 'border-rose-400 focus-visible:ring-rose-400' : 'border-slate-200'}`}
              disabled={submitting}
            />
            {errors.nombre && <p className="text-[11px] text-rose-600">{errors.nombre}</p>}
          </div>

          <div className="space-y-1">
            <Label htmlFor="buyer-phone" className="text-xs font-medium text-slate-700">
              WhatsApp / Celular <span className="text-rose-500">*</span>
            </Label>
            <div className="relative">
              <span className="absolute left-2.5 top-2 text-xs font-medium text-slate-400 select-none">
                +51
              </span>
              <Input
                id="buyer-phone"
                type="tel"
                placeholder="987 654 321"
                value={telefono}
                onChange={(e) => handlePhoneChange(e.target.value)}
                maxLength={9}
                className={`h-9 pl-11 text-xs rounded-lg font-mono ${errors.telefono ? 'border-rose-400 focus-visible:ring-rose-400' : 'border-slate-200'}`}
                disabled={submitting}
              />
            </div>
            {errors.telefono && <p className="text-[11px] text-rose-600">{errors.telefono}</p>}
          </div>
        </div>

        {duplicateWarning && (
          <div className="rounded-lg bg-amber-50 p-2.5 text-xs text-amber-800 border border-amber-200/70 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <span>{duplicateWarning}</span>
          </div>
        )}

        {/* Sede y Servicio de Interés (Opcionales) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="buyer-sede" className="text-xs font-medium text-slate-700">
              Sede preferida en Trujillo <span className="text-slate-400 font-normal">(Opcional)</span>
            </Label>
            <div className="relative">
              <select
                id="buyer-sede"
                value={idSede}
                onChange={(e) => setIdSede(e.target.value ? Number(e.target.value) : '')}
                className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
                disabled={submitting}
              >
                <option value="">Cualquier sede disponible</option>
                {sedes.map((s) => (
                  <option key={s.id_sede} value={s.id_sede}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="buyer-servicio" className="text-xs font-medium text-slate-700">
              Tratamiento de interés <span className="text-slate-400 font-normal">(Opcional)</span>
            </Label>
            <select
              id="buyer-servicio"
              value={idServicio}
              onChange={(e) => setIdServicio(e.target.value ? Number(e.target.value) : '')}
              className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900"
              disabled={submitting}
            >
              <option value="">No lo sé aún / Consulta general</option>
              {servicios.map((srv) => (
                <option key={srv.id_servicio} value={srv.id_servicio}>
                  {srv.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Correo y Consulta breve */}
        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <Label htmlFor="buyer-consulta" className="text-xs font-medium text-slate-700">
                ¿Deseas agregar algún detalle adicional? <span className="text-slate-400 font-normal">(Opcional)</span>
              </Label>
              <span className="text-[10px] text-slate-400 font-mono">{consultaBreve.length}/250</span>
            </div>
            <textarea
              id="buyer-consulta"
              rows={2}
              maxLength={250}
              placeholder="Ej. Me duele al tomar agua fría, o quisiera saber facilidades de cuotas para brackets..."
              value={consultaBreve}
              onChange={(e) => setConsultaBreve(e.target.value)}
              className="w-full rounded-lg border border-slate-200 p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-900 resize-none"
              disabled={submitting}
            />
          </div>
        </div>

        {/* Consentimiento Ley N° 29733 (NO pre-marcada) */}
        <div className="space-y-1 pt-1">
          <div className="flex items-start gap-2">
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
              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
              disabled={submitting}
            />
            <label htmlFor="buyer-consentimiento" className="text-xs text-slate-600 leading-snug cursor-pointer select-none">
              Autorizo expresamente a NexoSalud a contactarme vía WhatsApp o teléfono para responder mi consulta y brindarme orientación odontológica, conforme a la{' '}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setPrivacyModalOpen(true);
                }}
                className="font-medium text-slate-900 underline hover:text-sky-700"
              >
                Ley N° 29733 de Protección de Datos Personales
              </button>
              .
            </label>
          </div>
          {errors.consentimiento && (
            <p className="text-[11px] text-rose-600 pl-6">{errors.consentimiento}</p>
          )}
        </div>

        {errors.form && (
          <div className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 border border-rose-200">
            {errors.form}
          </div>
        )}

        <Button
          type="submit"
          disabled={submitting}
          className="w-full h-10 rounded-xl bg-slate-900 text-white font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 text-xs sm:text-sm"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Procesando solicitud...
            </>
          ) : (
            <>
              Recibir orientación sin compromiso
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-[11px] text-slate-400">
          Respuesta estimada en menos de 15 minutos en horario comercial. Sin ventas de presión.
        </p>
      </form>

      {/* Modal accesible de Política de Privacidad (Ley N° 29733) */}
      <Dialog open={privacyModalOpen} onOpenChange={setPrivacyModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Protección de Datos Personales (Ley N° 29733)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              NexoSalud Odontología Especializada · Trujillo, Perú
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs text-slate-600 max-h-[60vh] overflow-y-auto pr-1">
            <p>
              En cumplimiento de la <strong>Ley N° 29733</strong> (Ley de Protección de Datos Personales) y su Reglamento, le informamos que los datos proporcionados a través de este formulario serán tratados por NexoSalud con las siguientes finalidades:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>
                <strong>Finalidad exclusiva:</strong> Atender su consulta, responder inquietudes sobre tratamientos dentales, presupuestos y coordinar citas de orientación.
              </li>
              <li>
                <strong>No cesión a terceros:</strong> Sus datos no serán transferidos, vendidos ni cedidos a ninguna empresa externa con fines comerciales ajenos a su atención odontológica.
              </li>
              <li>
                <strong>Seguridad y confidencialidad:</strong> Toda la información se almacena en bases de datos con cifrado y medidas de seguridad técnicas y organizativas para evitar accesos no autorizados.
              </li>
              <li>
                <strong>Derechos ARCO:</strong> Usted puede revocar su consentimiento o ejercer sus derechos de Acceso, Rectificación, Cancelación y Oposición en cualquier momento escribiendo a <span className="font-mono text-slate-800">privacidad@nexosalud.pe</span> o contactando a recepción en nuestras sedes de Trujillo.
              </li>
            </ul>
            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-100">
              Titular del banco de datos: NexoSalud Odontología Integral S.A.C. · Trujillo, La Libertad.
            </p>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPrivacyModalOpen(false)}
              className="text-xs"
            >
              Entendido y cerrar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
