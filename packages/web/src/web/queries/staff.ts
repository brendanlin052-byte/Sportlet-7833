import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
export function useStaffMembers(userId: string) {
  const options = orpc.staff.members.queryOptions({ retry: false, refetchInterval: 3000 });
  return useQuery({ ...options, queryKey: [...options.queryKey, userId], gcTime: 0 });
}
export function useStaffActions() {
  const qc = useQueryClient();
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: orpc.staff.key() }),
    qc.invalidateQueries({ queryKey: orpc.moderation.key() }),
    qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
    qc.invalidateQueries({ queryKey: orpc.bazaar.key() }),
    qc.invalidateQueries({ queryKey: orpc.chat.list.key() }),
    qc.invalidateQueries({ queryKey: orpc.casino.key() }),
    qc.invalidateQueries({ queryKey: orpc.clans.key() }),
  ]);
  const appoint = useMutation(orpc.staff.setModerator.mutationOptions({ onSuccess: refresh }));
  const remove = useMutation(orpc.staff.removeCoins.mutationOptions({ onSuccess: refresh }));
  const reset = useMutation(orpc.staff.resetProgress.mutationOptions({ onSuccess: refresh }));
  return { appoint, remove, reset };
}