import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { leadWhatsAppAlertsKey, watchLeadWhatsAppAlerts } from '../services/leadWhatsAppAlerts';

export function useLeadWhatsAppAlertStream(enabled: boolean, scope: string, token?: string) {
  const client = useQueryClient();
  const [liveScope, setLiveScope] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const lifetime = new AbortController();
    const filters = { queryKey: [...leadWhatsAppAlertsKey, scope], exact: true };
    let reconnect: number | undefined;
    const refresh = async () => {
      await client.cancelQueries(filters);
      if (!lifetime.signal.aborted) void client.invalidateQueries(filters);
    };

    async function connect() {
      let connected = false;
      try {
        await watchLeadWhatsAppAlerts(lifetime.signal, () => {
          if (lifetime.signal.aborted) return;
          connected = true;
          setLiveScope(scope);
          void refresh();
        }, token);
      } catch {
        // The query falls back to its regular interval while the stream reconnects.
      }
      if (lifetime.signal.aborted) return;
      setLiveScope(null);
      if (connected) void refresh();
      reconnect = window.setTimeout(() => void connect(), connected ? 1500 : 10_000);
    }

    void connect();
    return () => {
      lifetime.abort();
      window.clearTimeout(reconnect);
    };
  }, [client, enabled, scope, token]);

  return enabled && liveScope === scope;
}
