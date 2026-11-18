import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { authClient } from "../lib/auth";
export function useAccountStatus(userId?: string) {
  const options = orpc.moderation.status.queryOptions();
  return useQuery({
    ...options,
    queryKey: [...options.queryKey, userId],
    enabled: !!userId,
    retry: false,
    refetchInterval: 3000,
  });
}
export function useModerationMembers(enabled: boolean) {
  const { data: session } = authClient.useSession();
  const options = orpc.moderation.members.queryOptions({ enabled: enabled && !!session, refetchInterval: 3000, retry: false });
  return useQuery({ ...options, queryKey: [...options.queryKey, session?.user.id], gcTime: 0 });
}
export function useModerationActions() {
  const qc = useQueryClient();
  const refresh = () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: orpc.moderation.key() }),
      qc.invalidateQueries({ queryKey: orpc.chat.list.key() }),
      qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
    ]);
  const mute = useMutation(orpc.moderation.mute.mutationOptions({ onSuccess: refresh }));
  const ban = useMutation(orpc.moderation.ban.mutationOptions({ onSuccess: refresh }));
  const giveCoins = useMutation(orpc.moderation.giveCoins.mutationOptions({ onSuccess: refresh }));
  return { mute, ban, giveCoins };
}
