import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useCasinoState(userId?: string) {
  const options = orpc.casino.state.queryOptions({ enabled: !!userId, retry: false, refetchInterval: 3000 });
  return useQuery({ ...options, queryKey: [...options.queryKey, userId], gcTime: 0 });
}
export function useCasinoActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: orpc.casino.key() }), qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
    qc.invalidateQueries({ queryKey: orpc.staff.members.key() }), qc.invalidateQueries({ queryKey: orpc.moderation.members.key() }),
  ]);
  const exchange = useMutation(orpc.casino.exchange.mutationOptions({ onSuccess: refresh }));
  const play = useMutation(orpc.casino.play.mutationOptions({ onSuccess: refresh }));
  return { exchange, play };
}