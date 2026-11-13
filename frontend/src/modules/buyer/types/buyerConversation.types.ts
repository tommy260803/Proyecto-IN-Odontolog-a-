// Contrato de buyerConversation.routes.ts / BuyerConversationService.view.
export type ChatStatus = 'COMPLETADA' | 'PENDIENTE' | 'PROCESANDO';
export type ChatOrigin = 'OPERADOR' | 'OPERADOR_TRANSCRIPTOR';
export interface StaffBearerSession {
  token: string;
  expira_en: string;
  usuario: { id_usuario: number; nombres: string; apellidos: string; rol: string };
}
export interface ChatTurn {
  conversationId: string;
  turnId: number;
  interactionId: number;
  status: ChatStatus;
  retryable: boolean;
  replayed?: boolean;
  executionSuperseded?: boolean;
  execution: { id: string; expiresAt: string } | null;
  messages: Array<{
    role: 'paciente' | 'operador_transcriptor' | 'asistente' | 'sistema';
    text: string; origin: string; at: string; actorId?: number;
  }>;
  attempts: Array<{ at: string; result: string; errorCode?: string; executionId?: string }>;
  declaredServiceId: number | null;
  analysis: {
    intention: 'SOLO_CONSULTA' | 'AMBIGUA' | 'SOLICITA_RESERVA';
    interpretedServiceId: number | null;
    pendingData: string[]; contradictions: string[];
    proposedAction: 'INFORMAR' | 'ACLARAR' | 'SOLICITAR_CONVERSION';
  } | null;
  // Solo los campos consumidos de BuyerEvaluationOutcome; no es una decisión local.
  evaluation: {
    estado: 'COMPLETADA' | 'PENDIENTE' | 'FALLIDA' | 'DESACTUALIZADA';
    accion: string; etapa_final: string;
    id_decision?: number; id_solicitud?: number | null; id_evento_etapa?: number | null;
    entregaLeadEstado?: 'PENDIENTE' | 'CONFIRMADA' | 'NO_APLICA';
  } | null;
}
export interface ConversationSummary {
  conversationId: string; status: ChatStatus | 'VACIA'; lastTurnId: number | null;
  lastAction: string | null; retryable: boolean;
}
export interface ConversationPage {
  personId: number; items: ConversationSummary[]; nextAfter: number | null;
}
export interface HistoryPage {
  personId: number; conversationId: string; turns: ChatTurn[]; nextAfter: number | null;
}
export interface PendingChatSend {
  personId: string; actorId: number; key: string;
  recoveredDraftKey?: string; // Metadato local; nunca se envía en el cuerpo HTTP.
  // Se conserva la cadena enviada, también antes de conocer conversationId.
  body: string;
}
