import { useState } from 'react';
import LeadFollowUpForm from './LeadFollowUpForm';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';
type Session = { token: string; expira_en: string; usuario: { nombres: string; apellidos: string; rol: string } };

export default function LeadStaffAccess({ requestId, currentFollowUp, editable, onToken }: {
  requestId: string; currentFollowUp: string | null; editable: boolean;
  onToken: (token: string | null) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="space-y-2 rounded-lg border bg-white p-4" aria-label="Acceso del personal LEAD">
      <h2 className="font-semibold">Verificar acceso del personal en QA</h2>
      {session ? (
        <>
          <p>{session.usuario.nombres} {session.usuario.apellidos} · {session.usuario.rol}</p>
          <p>Acceso verificado para esta solicitud.</p>
          <button type="button" className="underline" onClick={() => {
            setSession(null);
            onToken(null);
            void fetch(root + '/staff/session', {
              method: 'DELETE', headers: { Authorization: `Bearer ${session.token}` },
            }).catch(() => setError('No se pudo confirmar el cierre en el servidor. La sesión local se eliminó.'));
          }}>Cerrar sesión de QA</button>
          {editable && <LeadFollowUpForm requestId={requestId} token={session.token} current={currentFollowUp} />}
        </>
      ) : (
        <form className="flex flex-wrap items-end gap-3" onSubmit={async event => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          setBusy(true);
          setError('');
          let issued: Session | undefined;
          try {
            const result = await fetch(root + '/staff/session', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: data.get('email'), password: data.get('password') }),
            });
            if (!result.ok) throw new Error(result.status === 429 ? 'Demasiados intentos. Intenta más tarde.' :
              result.status === 401 ? 'Credenciales no válidas para LEAD.' : 'El acceso del personal no está disponible.');
            issued = await result.json() as Session;
            const access = await fetch(root + `/opportunities/${requestId}/staff-access`, {
              headers: { Authorization: `Bearer ${issued.token}` },
            });
            if (!access.ok) throw new Error(access.status === 403 ? 'Esta solicitud no está asignada a tu cuenta.' :
              'No fue posible verificar el acceso a esta solicitud.');
            setSession(issued);
            onToken(issued.token);
            form.reset();
          } catch (failure) {
            if (issued) void fetch(root + '/staff/session', {
              method: 'DELETE', headers: { Authorization: `Bearer ${issued.token}` },
            }).catch(() => undefined);
            setError(failure instanceof Error ? failure.message : 'No fue posible iniciar sesión.');
          } finally {
            setBusy(false);
          }
        }}>
          <label className="grid gap-1">Correo del personal
            <input className="rounded border px-3 py-2" name="email" type="email" autoComplete="username" required />
          </label>
          <label className="grid gap-1">Contraseña
            <input className="rounded border px-3 py-2" name="password" type="password" autoComplete="current-password" required />
          </label>
          <button className="rounded border px-3 py-2" disabled={busy} type="submit">{busy ? 'Verificando…' : 'Verificar acceso'}</button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
