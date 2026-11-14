import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ToastAction } from '@/shared/components/ui/toast';
import { toast } from '@/shared/hooks/use-toast';
import { whatsappAlertRoute, type WhatsAppAlert } from '../services/leadWhatsAppAlerts';

function ringBell(audio: AudioContext) {
  const start = audio.currentTime;
  for (const [offset, frequency] of [[0, 880], [0.16, 1174]]) {
    const chime = audio.createOscillator();
    const volume = audio.createGain();
    const time = start + offset;
    chime.type = 'sine';
    chime.frequency.setValueAtTime(frequency, time);
    volume.gain.setValueAtTime(0.001, time);
    volume.gain.exponentialRampToValueAtTime(0.14, time + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.001, time + 0.36);
    chime.connect(volume).connect(audio.destination);
    chime.start(time);
    chime.stop(time + 0.38);
  }
}

export function useLeadUrgentNotifications(alerts: WhatsAppAlert[], scope: string, openTray: () => void) {
  const navigate = useNavigate();
  const audio = useRef<AudioContext | null>(null);
  const soundUntil = useRef(0);
  const seen = useRef(new Set<string>());
  const active = useRef<{ ids: Set<string>; dismiss: () => void } | null>(null);

  useEffect(() => {
    const unlockSound = () => {
      if (!window.AudioContext) return;
      try {
        const context = audio.current ??= new AudioContext();
        const playPending = () => {
          if (context.state !== 'running' || document.hidden || Date.now() >= soundUntil.current) return;
          soundUntil.current = 0;
          ringBell(context);
        };
        if (context.state === 'suspended') void context.resume().then(playPending).catch(() => undefined);
        else playPending();
      } catch { /* The visual alert is available if audio is blocked. */ }
    };
    window.addEventListener('pointerdown', unlockSound);
    window.addEventListener('keydown', unlockSound);
    return () => {
      window.removeEventListener('pointerdown', unlockSound);
      window.removeEventListener('keydown', unlockSound);
      if (audio.current) void audio.current.close().catch(() => undefined);
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    seen.current.clear();
    return () => {
      active.current?.dismiss();
      active.current = null;
      soundUntil.current = 0;
    };
  }, [scope]);

  useEffect(() => {
    const ids = new Set(alerts.map(alert => alert.id));
    if (active.current && ![...active.current.ids].some(id => ids.has(id))) {
      active.current.dismiss();
      active.current = null;
      soundUntil.current = 0;
    }
    const fresh = alerts.filter(alert => !seen.current.has(alert.id));
    seen.current = ids;
    if (!fresh.length) return;

    const single = fresh.length === 1 ? fresh[0] : null;
    const action = single ? 'Abrir conversación' : 'Ver notificaciones';
    active.current?.dismiss();
    const notice = toast({
      title: 'URGENTE · WhatsApp LEAD',
      description: single ? `La solicitud #${single.requestId} requiere atención del asesor.`
        : `${fresh.length} conversaciones requieren atención del asesor.`,
      variant: 'warning',
      belowHeader: true,
      duration: 10_000,
      action: <ToastAction altText={action} onClick={() => single ? navigate(whatsappAlertRoute(single)) : openTray()}>{action}</ToastAction>,
    });
    active.current = { ids: new Set(fresh.map(alert => alert.id)), dismiss: notice.dismiss };
    if (!document.hidden && audio.current?.state === 'running') {
      soundUntil.current = 0;
      ringBell(audio.current);
    } else {
      soundUntil.current = Date.now() + 10_000;
    }
  }, [alerts, scope, navigate, openTray]);
}
