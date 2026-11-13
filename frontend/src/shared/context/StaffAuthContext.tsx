import React, { createContext, useContext, useEffect, useState } from 'react';
import { staffAuthService, type StaffSession } from '../services/staffAuthService';

interface StaffAuthContextType {
  session: StaffSession | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<StaffSession>;
  logout: () => void;
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  clearSession: () => void;
}

const StaffAuthContext = createContext<StaffAuthContextType | undefined>(undefined);

export function StaffAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<StaffSession | null>(() => staffAuthService.getSession());
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = staffAuthService.subscribe((updated) => {
      setSession(updated);
    });
    const storage=(event:StorageEvent)=>{
      if(event.key==='nexosalud_staff_session_v1' || event.key===null)staffAuthService.notify(staffAuthService.getSession());
    };
    window.addEventListener('storage',storage);
    return () => {unsubscribe();window.removeEventListener('storage',storage);};
  }, []);

  useEffect(() => {
    if (!session) return;
    const timer=setTimeout(()=>{
      const current=staffAuthService.getSession();
      if(Date.now()>=Date.parse(session.expira_en) && (!current || current.token===session.token)) staffAuthService.logout();
    },Math.max(0,Math.min(2_147_483_647,Date.parse(session.expira_en)-Date.now())));
    return ()=>clearTimeout(timer);
  },[session]);

  const login = async (email: string, password: string) => {
    const logged = await staffAuthService.authenticate(email, password);
    // La suscripción es la única fuente; un login tardío no restaura una sesión cerrada.
    if(staffAuthService.getSession()?.token===logged.token)setIsLoginModalOpen(false);
    return logged;
  };

  const logout = () => {
    staffAuthService.logout();
    setSession(null);
  };

  const clearSession = () => {
    staffAuthService.logout();
    setSession(null);
    setIsLoginModalOpen(true);
  };

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);

  return (
    <StaffAuthContext.Provider
      value={{
        session,
        isAuthenticated: Boolean(session?.token),
        login,
        logout,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        clearSession,
      }}
    >
      {children}
    </StaffAuthContext.Provider>
  );
}

export function useStaffAuth(): StaffAuthContextType {
  const ctx = useContext(StaffAuthContext);
  const [fallback,setFallback]=useState(()=>staffAuthService.getSession());
  useEffect(()=>ctx?undefined:staffAuthService.subscribe(setFallback),[Boolean(ctx)]);
  if (!ctx) {
    // Fallback gracioso si no se encuentra en el árbol de proveedores (ej. tests aislados)
    const current = fallback;
    return {
      session: current,
      isAuthenticated: Boolean(current?.token),
      login: (e, p) => staffAuthService.authenticate(e, p),
      logout: () => staffAuthService.logout(),
      isLoginModalOpen: false,
      openLoginModal: () => {},
      closeLoginModal: () => {},
      clearSession: () => staffAuthService.logout(),
    };
  }
  return ctx;
}
