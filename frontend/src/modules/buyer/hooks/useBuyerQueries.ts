import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import type { Buyer } from '@/domain/entities';

import { buyerService } from '../services/buyer.service';

export function useBuyers() {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS],
    queryFn: () => buyerService.getAllBuyers(),
  });
}

export function useBuyerPage(params: {
  page: number;
  pageSize: number;
  search?: string;
  states?: string[];
  channels?: string[];
  fromDate?: string;
  toDate?: string;
}) {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, 'page', params],
    queryFn: () => buyerService.getBuyersPage(params),
    placeholderData: (previous) => previous,
  });
}

export function useBuyer(id: string) {
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, id],
    queryFn: () => buyerService.getBuyerById(id),
    enabled: !!id,
    staleTime: 30_000,
    retry: false,
  });
}

export function useEvaluateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, message }: { id: string; message?: string }) =>
      buyerService.evaluateBuyer(id, { message }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, variables.id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    },
  });
}

export function useCreateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BuyerFormValues) => buyerService.createBuyer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
    },
  });
}

export function useUpdateBuyer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string, data: Partial<Buyer> & { person?: Partial<import('@/domain/entities').Person> } }) => 
      buyerService.updateBuyer(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, variables.id] });
    },
  });
}

export function useConvertBuyerToLead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => buyerService.convertToLead(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.BUYERS, id] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.LEADS] });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.JOURNEYS] });
    },
  });
}
