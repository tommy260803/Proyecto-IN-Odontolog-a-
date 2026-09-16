import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerUseCases } from '@/application/use-cases/customer';
import { QUERY_KEYS } from '@/shared/constants';
import type { DentalAttentionFormValues } from '../schemas/customerSchema';
import { CustomerState } from '@/domain/enums';

export function useCustomers() {
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS],
    queryFn: () => customerUseCases.getAllCustomers(),
  });
}

export function useCustomer(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.CUSTOMERS, id],
    queryFn: () => customerUseCases.getCustomerById(id),
    enabled: !!id,
  });
}

export function useChangeCustomerState() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, state }: { id: string, state: CustomerState }) => 
      customerUseCases.changeState(id, state),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useStartAttention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, time }: { id: string, time: string }) => 
      customerUseCases.startAttention(id, time),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useFinishAttention() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, time }: { id: string, time: string }) => 
      customerUseCases.finishAttention(id, time),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useRegisterAttentionDetails() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: DentalAttentionFormValues }) => 
      customerUseCases.registerAttentionDetails(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useRegisterCustomerIncident() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => 
      customerUseCases.registerIncident(id, reason),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, variables.id] });
    },
  });
}

export function useConvertCustomerToTurned() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => customerUseCases.convertToTurned(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CUSTOMERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.TURNED] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
