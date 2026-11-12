export type LeadWhatsAppTracking = {
  id: string;
  enviada_utc: string;
  entrega_detectada_utc: string | null;
  lectura_detectada_utc: string | null;
  primera_respuesta_utc: string | null;
};

const limaTime = new Intl.DateTimeFormat('es-PE', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima' });

function elapsedSince(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 60000));
  if (minutes < 1) return 'recién';
  if (minutes < 60) return `hace ${minutes} min`;
  if (minutes < 1440) return `hace ${Math.floor(minutes / 60)} h`;
  const days = Math.floor(minutes / 1440);
  return `hace ${days} ${days === 1 ? 'día' : 'días'}`;
}

export function LeadWhatsAppStatus({ tracking }: { tracking: LeadWhatsAppTracking }) {
  const read = tracking.lectura_detectada_utc;
  const delivered = tracking.entrega_detectada_utc;
  const reply = tracking.primera_respuesta_utc;
  const deliveryLabel = read ? 'Leído' : delivered ? 'Entregado · sin confirmación de lectura' : 'Enviado · sin confirmación de entrega';
  return (
    <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
      <p className="font-semibold text-teal-800 dark:text-teal-300">
        {deliveryLabel}{read && ` ${elapsedSince(read)}`} · {reply ? 'Con respuesta' : 'Sin respuesta vinculada'}
      </p>
      <p>Envío {limaTime.format(new Date(tracking.enviada_utc))}
        {delivered && ` · Entrega detectada ${limaTime.format(new Date(delivered))}`}
        {read && ` · Lectura detectada ${limaTime.format(new Date(read))}`}
        {reply && ` · Primera respuesta ${limaTime.format(new Date(reply))}`}
        {' (Lima)'}
      </p>
    </div>
  );
}
