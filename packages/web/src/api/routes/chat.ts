import { z } from "zod";
import { and, desc, eq, lt, lte, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import {
  chatMessages,
  chatCooldowns,
  chatRewards,
  profiles,
  user,
  accountAccess,
} from "../database/schema";
import { authed } from "../middleware/auth";

export const chat = {
  list: authed
    .input(z.object({ before: z.number().int().positive().optional() }))
    .handler(async ({ input }) => {
      const rows = await db
        .select({
          id: chatMessages.id,
          userId: chatMessages.userId,
          body: chatMessages.body,
          createdAt: chatMessages.createdAt,
          coinsEarned: chatMessages.coinsEarned,
          name: user.name,
          role: accountAccess.role,
        })
        .from(chatMessages)
        .innerJoin(user, eq(chatMessages.userId, user.id))
        .leftJoin(accountAccess, eq(chatMessages.userId, accountAccess.userId))
        .where(input.before ? lt(chatMessages.id, input.before) : undefined)
        .orderBy(desc(chatMessages.id))
        .limit(51);
      const hasMore = rows.length > 50;
      const messages = rows.slice(0, 50).reverse();
      return { messages, nextCursor: hasMore ? messages[0]!.id : undefined };
    }),
  send: authed
    .input(
      z.object({
        body: z
          .string()
          .trim()
          .min(1, "Write a message first.")
          .max(500, "Messages can be up to 500 characters."),
      }),
    )
    .handler(async ({ input, context }) => {
      const now = Date.now();
      if (context.access.mutedUntil > now)
        throw new ORPCError("FORBIDDEN", {
          message: `You are muted until ${new Date(context.access.mutedUntil).toISOString()}.${context.access.muteReason ? ` Reason: ${context.access.muteReason}` : ""}`,
        });
      await db.insert(chatCooldowns).values({ userId: context.user.id }).onConflictDoNothing();
      return db.transaction(async (tx) => {
        const ready = await tx
          .update(chatCooldowns)
          .set({ lastSent: now })
          .where(
            and(eq(chatCooldowns.userId, context.user.id), lte(chatCooldowns.lastSent, now - 3000)),
          )
          .returning();
        if (!ready.length)
          throw new ORPCError("TOO_MANY_REQUESTS", {
            message: "Give the room a moment. Wait 3 seconds between messages.",
          });
        const canonical = input.body
          .normalize("NFKC")
          .toLowerCase()
          .replace(/[\p{P}\p{Z}\p{C}\s]/gu, "");
        const fingerprint = `${context.user.id}:${createHash("sha256").update(canonical).digest("hex")}`;
        const [previous] = await tx
          .select()
          .from(chatRewards)
          .where(eq(chatRewards.id, fingerprint));
        const repeated = !!previous && now - previous.lastSeen < 5000;
        const longEnough = [...input.body].length >= 5;
        const coinsEarned = longEnough && canonical.length > 0 && !repeated ? 3 : 0;
        await tx
          .insert(chatRewards)
          .values({ id: fingerprint, userId: context.user.id, lastSeen: now })
          .onConflictDoUpdate({ target: chatRewards.id, set: { lastSeen: now } });
        await tx.insert(profiles).values({ userId: context.user.id }).onConflictDoNothing();
        if (coinsEarned)
          await tx
            .update(profiles)
            .set({ coins: sql`${profiles.coins} + ${coinsEarned}` })
            .where(eq(profiles.userId, context.user.id));
        const [message] = await tx
          .insert(chatMessages)
          .values({ userId: context.user.id, body: input.body, createdAt: now, coinsEarned })
          .returning();
        const rewardNote = coinsEarned
          ? "+3 coins earned. Keep the conversation going!"
          : repeated
            ? "Message sent. Repeats within 5 seconds don't earn coins."
            : !longEnough
              ? "Message sent. Use 5 or more characters to earn coins."
              : "Message sent. Punctuation-only messages don't earn coins.";
        return { ...message!, name: context.user.name, rewardNote };
      });
    }),
  delete: authed
    .input(z.object({ id: z.number().int().positive() }))
    .handler(async ({ input, context }) => {
      const deleted = await db
        .delete(chatMessages)
        .where(and(eq(chatMessages.id, input.id), eq(chatMessages.userId, context.user.id)))
        .returning({ id: chatMessages.id });
      if (!deleted.length)
        throw new ORPCError("NOT_FOUND", {
          message: "This message is unavailable or belongs to another collector.",
        });
      return { id: input.id };
    }),
};
