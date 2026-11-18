import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useGameState(enabled: boolean, userId?: string) {
  const options = orpc.game.state.queryOptions({ enabled, retry: false, refetchInterval: 5000 });
  return useQuery({ ...options, queryKey: [...options.queryKey, userId] });
}
export function useClaim() {
  const qc = useQueryClient();
  return useMutation(
    orpc.game.claim.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
    }),
  );
}
export function useOpen() {
  const qc = useQueryClient();
  return useMutation(
    orpc.game.open.mutationOptions({
      onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: orpc.game.state.key() }), qc.invalidateQueries({ queryKey: orpc.clans.list.key() })]),
    }),
  );
}

export function useOpenMany() {
  const qc = useQueryClient();
  return useMutation(orpc.game.openMany.mutationOptions({
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: orpc.game.state.key() }), qc.invalidateQueries({ queryKey: orpc.clans.list.key() })]),
  }));
}

export function useSell() {
  const qc = useQueryClient();
  return useMutation(orpc.game.sell.mutationOptions({
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
      qc.invalidateQueries({ queryKey: orpc.moderation.members.key() }),
      qc.invalidateQueries({ queryKey: orpc.clans.list.key() }),
    ]),
  }));
}
