import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/shared/constants';
import type { BuyerFormValues } from '../schemas/buyerSchema';
import type { Buyer } from '@/domain/entities';

import { buyerService } from '../services/buyer.service';
import { useStaffAuth } from '@/shared/context/StaffAuthContext';
import { staffSessionScope } from '@/shared/services/staffAuthService';

export function useBuyers() {
  const scope=staffSessionScope(useStaffAuth().session);
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, 'all', scope],
    queryFn: ({signal}) => buyerService.getAllBuyers(signal),
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
  const scope=staffSessionScope(useStaffAuth().session);
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, 'page', scope, params],
    queryFn: ({signal}) => buyerService.getBuyersPage(params,signal),
    placeholderData: (previous,query) => query?.queryKey[2]===scope?previous:undefined,
  });
}

export function useBuyer(id: string) {
  const scope=staffSessionScope(useStaffAuth().session);
  return useQuery({
    queryKey: [QUERY_KEYS.BUYERS, id, scope],
    queryFn: ({signal}) => buyerService.getBuyerById(id,signal),
    enabled: !!id,
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
