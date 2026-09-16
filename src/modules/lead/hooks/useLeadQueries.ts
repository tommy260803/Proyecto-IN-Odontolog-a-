import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadUseCases } from '@/application/use-cases/lead';
import { QUERY_KEYS } from '@/shared/constants';
import type { AlternativeFormValues, LeadUpdateFormValues } from '../schemas/leadSchema';

export function useLeads() {
  return useQuery({
    queryKey: [QUERY_KEYS.LEADS],
    queryFn: () => leadUseCases.getAllLeads(),
  });
}

export function useLead(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.LEADS, id],
    queryFn: () => leadUseCases.getLeadById(id),
    enabled: !!id,
  });
}

export function useUpdateLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: LeadUpdateFormValues }) => 
      leadUseCases.updateLead(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.id] });
    },
  });
}

export function useAddAlternative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: AlternativeFormValues }) => 
      leadUseCases.addAlternative(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.id] });
    },
  });
}

export function useSelectAlternative() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, altId }: { leadId: string, altId: string }) => 
      leadUseCases.selectAlternativeAndReserve(leadId, altId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, variables.leadId] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.RESERVATIONS] });
    },
  });
}

export function useConvertLeadToPayer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => leadUseCases.convertToPayer(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.PAYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
