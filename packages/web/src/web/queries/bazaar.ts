import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useBazaar() {
  return useInfiniteQuery(orpc.bazaar.list.infiniteOptions({
    input: (before: number | undefined) => ({ before }), initialPageParam: undefined,
    getNextPageParam: (page) => page.nextCursor, refetchInterval: 5000,
  }));
}
export function useMyListings(userId?: string) {
  const options = orpc.bazaar.mine.queryOptions({ enabled: !!userId, retry: false, refetchInterval: 5000 });
  return useQuery({ ...options, queryKey: [...options.queryKey, userId] });
}
export function useBazaarActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: orpc.bazaar.key() }),
    qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
    qc.invalidateQueries({ queryKey: orpc.staff.members.key() }),
    qc.invalidateQueries({ queryKey: orpc.moderation.members.key() }),
    qc.invalidateQueries({ queryKey: orpc.clans.list.key() }),
  ]);
  const create = useMutation(orpc.bazaar.create.mutationOptions({ onSuccess: refresh }));
  const buy = useMutation(orpc.bazaar.buy.mutationOptions({ onSuccess: refresh }));
  const cancel = useMutation(orpc.bazaar.cancel.mutationOptions({ onSuccess: refresh }));
  return { create, buy, cancel };
}