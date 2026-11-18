import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useClans() { return useQuery(orpc.clans.list.queryOptions({ refetchInterval: 5000 })); }
export function useMyClan(userId?: string) {
  const options = orpc.clans.mine.queryOptions({ enabled: !!userId, retry: false, refetchInterval: 3000 });
  return useQuery({ ...options, queryKey: [...options.queryKey, userId], gcTime: 0 });
}
export function useClanMessages(userId?: string, clanId?: string) {
  const options = orpc.clans.messages.infiniteOptions({ input: (before: number | undefined) => ({ before }), initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor, enabled: !!userId && !!clanId, retry: false, refetchInterval: 3000 });
  return useInfiniteQuery({ ...options, queryKey: [...options.queryKey, userId, clanId], gcTime: 0 });
}
export function useClanActions() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: orpc.clans.key() });
  const create = useMutation(orpc.clans.create.mutationOptions({ onSuccess: refresh }));
  const edit = useMutation(orpc.clans.edit.mutationOptions({ onSuccess: refresh }));
  const join = useMutation(orpc.clans.join.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(orpc.clans.cancelRequest.mutationOptions({ onSuccess: refresh }));
  const decide = useMutation(orpc.clans.decideRequest.mutationOptions({ onSuccess: refresh }));
  const manage = useMutation(orpc.clans.manageMember.mutationOptions({ onSuccess: refresh }));
  const leave = useMutation(orpc.clans.leave.mutationOptions({ onSuccess: refresh }));
  const disband = useMutation(orpc.clans.disband.mutationOptions({ onSuccess: refresh }));
  const send = useMutation(orpc.clans.send.mutationOptions({ onSuccess: refresh }));
  return { create, edit, join, cancel, decide, manage, leave, disband, send };
}