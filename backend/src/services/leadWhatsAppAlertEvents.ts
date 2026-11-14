const subscribers = new Map<string, Set<() => void>>();

export function subscribeWhatsAppAlertChanges(sessionId: string, listener: () => void) {
  const listeners = subscribers.get(sessionId) ?? new Set<() => void>();
  subscribers.set(sessionId, listeners);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) subscribers.delete(sessionId);
  };
}

export function publishWhatsAppAlertChange(sessionId: string) {
  for (const listener of subscribers.get(sessionId) ?? []) listener();
}
