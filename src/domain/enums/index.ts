export const BuyerState = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  CONVERTED: 'CONVERTED',
  DISCARDED: 'DISCARDED',
  DUPLICATED: 'DUPLICATED',
} as const;
export type BuyerState = (typeof BuyerState)[keyof typeof BuyerState];

export const LeadState = {
  IN_NEGOTIATION: 'IN_NEGOTIATION',
  ALTERNATIVE_SELECTED: 'ALTERNATIVE_SELECTED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
} as const;
export type LeadState = (typeof LeadState)[keyof typeof LeadState];

export const PayerState = {
  PENDING: 'PENDING',
  IN_REVIEW: 'IN_REVIEW',
  VALIDATED: 'VALIDATED',
  REJECTED: 'REJECTED',
  REVERTED: 'REVERTED',
} as const;
export type PayerState = (typeof PayerState)[keyof typeof PayerState];

export const CustomerState = {
  SCHEDULED: 'SCHEDULED',
  ATTENDANCE_CONFIRMED: 'ATTENDANCE_CONFIRMED',
  IN_ATTENTION: 'IN_ATTENTION',
  ATTENDED: 'ATTENDED',
  NO_SHOW: 'NO_SHOW',
  CANCELED: 'CANCELED',
} as const;
export type CustomerState = (typeof CustomerState)[keyof typeof CustomerState];

export const TurnedState = {
  FOLLOW_UP_PENDING: 'FOLLOW_UP_PENDING',
  IN_FOLLOW_UP: 'IN_FOLLOW_UP',
  CLOSED: 'CLOSED',
  NEW_REQUEST: 'NEW_REQUEST',
} as const;
export type TurnedState = (typeof TurnedState)[keyof typeof TurnedState];

export const Phase = {
  BUYER: 'BUYER',
  LEAD: 'LEAD',
  PAYER: 'PAYER',
  CUSTOMER: 'CUSTOMER',
  TURNED: 'TURNED',
} as const;
export type Phase = (typeof Phase)[keyof typeof Phase];
