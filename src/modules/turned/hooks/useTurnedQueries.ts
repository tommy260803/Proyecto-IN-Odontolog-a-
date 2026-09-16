import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { turnedUseCases } from '@/application/use-cases/turned';
import { QUERY_KEYS } from '@/shared/constants';
import type { FollowUpFormValues, NewRequestFormValues } from '../schemas/turnedSchema';
import type { TurnedRecord } from '@/domain/entities';

export function useTurneds() {
  return useQuery({
    queryKey: [QUERY_KEYS.TURNED],
    queryFn: () => turnedUseCases.getAllTurneds(),
  });
}

export function useTurned(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.TURNED, id],
    queryFn: () => turnedUseCases.getTurnedById(id),
    enabled: !!id,
  });
}

export function useUpdateTurnedDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<TurnedRecord> }) => 
      turnedUseCases.updateTurnedDetails(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, variables.id] });
    },
  });
}

export function useAddFollowUp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: FollowUpFormValues }) => 
      turnedUseCases.addFollowUp(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, variables.id] });
    },
  });
}

export function useCreateNewRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: NewRequestFormValues }) => 
      turnedUseCases.createNewRequest(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED, variables.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
