import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { client, orpc } from "../lib/api";
type ChatPage = Awaited<ReturnType<typeof client.chat.list>>;

export function useChatMessages(userId?: string) {
  return useInfiniteQuery({
    queryKey: [...orpc.chat.list.key(), userId],
    queryFn: ({ pageParam }) => client.chat.list({ before: pageParam }),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (page: ChatPage) => page.nextCursor,
    enabled: !!userId,
    refetchInterval: 3000,
    retry: false,
  });
}
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation(
    orpc.chat.send.mutationOptions({
      onSuccess: () =>
        Promise.all([
          qc.invalidateQueries({ queryKey: orpc.chat.list.key() }),
          qc.invalidateQueries({ queryKey: orpc.game.state.key() }),
        ]),
    }),
  );
}
export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation(
    orpc.chat.delete.mutationOptions({
      onMutate: async ({ id }) => {
        const queryKey = orpc.chat.list.key();
        await qc.cancelQueries({ queryKey });
        const snapshots = qc.getQueriesData<InfiniteData<ChatPage>>({ queryKey });
        qc.setQueriesData<InfiniteData<ChatPage>>({ queryKey }, (data) =>
          data
            ? {
                ...data,
                pages: data.pages.map((page) => ({
                  ...page,
                  messages: page.messages.filter((message) => message.id !== id),
                })),
              }
            : data,
        );
        return { snapshots };
      },
      onError: (_error, _input, context) =>
        context?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
      onSettled: () => qc.invalidateQueries({ queryKey: orpc.chat.list.key() }),
    }),
  );
}
