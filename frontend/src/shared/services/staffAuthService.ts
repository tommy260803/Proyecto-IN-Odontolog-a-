export interface StaffBearerIdentity {
  token: string;
  expira_en: string;
  usuario: { id_usuario: number; nombres: string; apellidos: string; rol: string };
}
export interface StaffSession extends StaffBearerIdentity {
  id_usuario: number; nombres: string; apellidos: string; email: string; rol: string;
  initials: string; loginAt: string; sessionId: string;
}
const STORAGE_KEY = 'nexosalud_staff_session_v1';
type AuthListener = (session: StaffSession | null) => void;
const listeners = new Set<AuthListener>();
let revision = 0;
let loginController: AbortController | null = null;
const text = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
export function validStaffBearerSession(value: unknown): value is StaffBearerIdentity {
  const s = value as StaffBearerIdentity | null;
  const u = s?.usuario;
  const expires = typeof s?.expira_en === 'string' ? Date.parse(s.expira_en) : NaN;
  const date=typeof s?.expira_en==='string'?s.expira_en.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/):null;
  const calendar=Boolean(date && Number(date[2])>=1 && Number(date[2])<=12 && Number(date[3])>=1 &&
    Number(date[3])<=new Date(Date.UTC(Number(date[1]),Number(date[2]),0)).getUTCDate() &&
    Number(date[4])<24 && Number(date[5])<60 && Number(date[6])<60);
  return Boolean(s && typeof s.token==='string' && /^[A-Za-z0-9_-]{43}$/.test(s.token) && calendar &&
    typeof s.expira_en === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s.expira_en) &&
    Number.isFinite(expires) && expires > Date.now() && u && Number.isSafeInteger(u.id_usuario) && u.id_usuario > 0 &&
    text(u.nombres) && text(u.apellidos) && ['Administrador','Negociador'].includes(u.rol));
}
function validStoredSession(s: unknown): s is StaffSession {
  const v = s as StaffSession | null;
  return validStaffBearerSession(v) && text(v.email) && text(v.sessionId) && Number.isFinite(Date.parse(v.loginAt)) &&
    v.id_usuario === v.usuario.id_usuario && v.nombres === v.usuario.nombres &&
    v.apellidos === v.usuario.apellidos && v.rol === v.usuario.rol;
}
export function staffSessionScope(s: StaffSession | null) { return s ? `${s.id_usuario}:${s.sessionId}` : 'anonymous'; }
export function computeInitials(nombres: string, apellidos: string): string {
  return `${nombres.replace(/^Dr\.\s*/i,'').trim()[0] || ''}${apellidos.trim()[0] || ''}`.toUpperCase();
}
export const staffAuthService = {
  subscribe(listener: AuthListener): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; },
  notify(session: StaffSession | null): void { for (const listener of listeners) { try { listener(session); } catch { /* Notificar también al resto. */ } } },
  getSession(): StaffSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const s: unknown = JSON.parse(raw);
      if (validStoredSession(s)) return s;
      localStorage.removeItem(STORAGE_KEY);
    } catch { /* Una sesión ilegible nunca concede acceso. */ }
    return null;
  },
  saveSession(value: StaffBearerIdentity & {email: string}): void {
    if (!validStaffBearerSession(value) || !text(value.email)) throw new Error('Sesión de personal incompleta o vencida.');
    const u=value.usuario;
    const session: StaffSession={...value,...u,initials:computeInitials(u.nombres,u.apellidos),
      loginAt:new Date().toISOString(),sessionId:crypto.randomUUID()};
    // Si falla el almacenamiento, no se notifica una sesión inexistente.
    localStorage.setItem(STORAGE_KEY,JSON.stringify(session));
    revision++;
    this.notify(session);
  },
  logout(): void {
    const current=this.getSession();
    revision++; loginController?.abort(); loginController=null;
    try { localStorage.removeItem(STORAGE_KEY); } finally { this.notify(null); }
    if (current) {
      const url=(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/,'');
      void fetch(`${url}/lead/commercial/staff/session`, {method:'DELETE',headers:{Authorization:`Bearer ${current.token}`}}).catch(()=>undefined);
    }
  },
  async authenticate(emailInput: string, passwordInput: string): Promise<StaffSession> {
    const email=emailInput.trim().toLowerCase();
    if (!email) throw new Error('Ingresa tu correo institucional o usuario.');
    if (!passwordInput) throw new Error('Ingresa tu contraseña de acceso.');
    loginController?.abort();
    const controller=new AbortController();loginController=controller;
    const ticket=++revision;
    const url=(import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/,'');
    let response: Response;
    try { response=await fetch(`${url}/lead/commercial/staff/session`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email,password:passwordInput}),signal:controller.signal}); }
    catch { throw new Error('El servicio de autenticación no está disponible.'); }
    if (ticket!==revision || controller.signal.aborted) throw new Error('Inicio de sesión cancelado.');
    if (!response.ok) {
      if(response.status===404)throw new Error('El servicio de autenticación no está disponible.');
      if(response.status===429)throw new Error('Demasiados intentos. Intenta más tarde.');
      throw new Error(response.status===401?'Credenciales de personal no válidas.':'Error al autenticar con el servidor.');
    }
    const data=await response.json();
    if (ticket!==revision || controller.signal.aborted) throw new Error('Inicio de sesión cancelado.');
    if(typeof data?.token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.token))throw new Error('El servidor no devolvió un token de autenticación válido.');
    const u=data.usuario;
    if(!u||!Number.isSafeInteger(u.id_usuario)||u.id_usuario<=0||!text(u.nombres)||!text(u.apellidos)||!['Administrador','Negociador'].includes(u.rol))
      throw new Error('La respuesta del servidor no incluye los datos de usuario requeridos.');
    if(!validStaffBearerSession(data))throw new Error('El servidor no devolvió una fecha de vencimiento válida y futura.');
    this.saveSession({...data,email});
    if(loginController===controller)loginController=null;
    return this.getSession()!;
  },
};
