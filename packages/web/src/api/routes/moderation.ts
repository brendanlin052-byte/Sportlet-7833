import { z } from "zod";
import { asc, eq, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { account, accountAccess, moderationLog, profiles, user } from "../database/schema";
import { ownerOnly, signedIn } from "../middleware/auth";

const reasonInput = z.string().trim().max(200).default("");
async function ensureTarget(userId: string) {
  const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, userId));
  if (!target) throw new ORPCError("NOT_FOUND", { message: "Collector not found." });
  const [access] = await db.select().from(accountAccess).where(eq(accountAccess.userId, userId));
  if (access?.role === "owner")
    throw new ORPCError("FORBIDDEN", {
      message: "The owner account is protected from moderation.",
    });
}
export const moderation = {
  status: signedIn.handler(({ context }) => ({
    ...context.access,
    muted: context.access.mutedUntil > Date.now(),
  })),
  members: ownerOnly.handler(async () => {
    const rows = await db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
        role: accountAccess.role,
        banned: accountAccess.banned,
        mutedUntil: accountAccess.mutedUntil,
        coins: profiles.coins,
      })
      .from(user)
      .leftJoin(accountAccess, eq(user.id, accountAccess.userId))
      .leftJoin(profiles, eq(user.id, profiles.userId))
      .orderBy(asc(user.name));
    const credentials = await db.select({ userId: account.userId }).from(account).where(eq(account.providerId, "credential"));
    const passwordUsers = new Set(credentials.map((row) => row.userId));
    return rows.map((row) => ({
      ...row,
      role: row.role ?? "collector",
      banned: row.banned ?? false,
      mutedUntil: row.mutedUntil ?? 0,
      coins: row.coins ?? 500,
      hasPassword: passwordUsers.has(row.id),
    }));
  }),
  giveCoins: ownerOnly
    .input(z.object({
      userId: z.string().min(1),
      amount: z.number().int().min(1).max(100000),
      reason: reasonInput,
    }))
    .handler(async ({ input, context }) => {
      const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.userId));
      if (!target) throw new ORPCError("NOT_FOUND", { message: "Collector not found." });
      return db.transaction(async (tx) => {
        await tx.insert(profiles).values({ userId: input.userId }).onConflictDoNothing();
        const [profile] = await tx.update(profiles)
          .set({ coins: sql`${profiles.coins} + ${input.amount}` })
          .where(eq(profiles.userId, input.userId)).returning();
        await tx.insert(moderationLog).values({
          actorId: context.user.id,
          targetId: input.userId,
          action: "give_coins",
          reason: JSON.stringify({ amount: input.amount, reason: input.reason }),
          createdAt: Date.now(),
        });
        return { coins: profile!.coins, amount: input.amount };
      });
    }),
  mute: ownerOnly
    .input(
      z.object({
        userId: z.string().min(1),
        duration: z.union([
          z.literal(0),
          z.literal(600000),
          z.literal(3600000),
          z.literal(86400000),
        ]),
        reason: reasonInput,
      }),
    )
    .handler(async ({ input, context }) => {
      await ensureTarget(input.userId);
      const now = Date.now();
      const mutedUntil = input.duration ? now + input.duration : 0;
      await db.transaction(async (tx) => {
        await tx
          .insert(accountAccess)
          .values({ userId: input.userId, mutedUntil, muteReason: input.reason })
          .onConflictDoUpdate({
            target: accountAccess.userId,
            set: { mutedUntil, muteReason: input.reason },
          });
        await tx
          .insert(moderationLog)
          .values({
            actorId: context.user.id,
            targetId: input.userId,
            action: input.duration ? "mute" : "unmute",
            reason: input.reason,
            createdAt: now,
          });
      });
      return { mutedUntil };
    }),
  ban: ownerOnly
    .input(z.object({ userId: z.string().min(1), banned: z.boolean(), reason: reasonInput }))
    .handler(async ({ input, context }) => {
      await ensureTarget(input.userId);
      await db.transaction(async (tx) => {
        await tx
          .insert(accountAccess)
          .values({ userId: input.userId, banned: input.banned, banReason: input.reason })
          .onConflictDoUpdate({
            target: accountAccess.userId,
            set: { banned: input.banned, banReason: input.reason },
          });
        await tx
          .insert(moderationLog)
          .values({
            actorId: context.user.id,
            targetId: input.userId,
            action: input.banned ? "ban" : "unban",
            reason: input.reason,
            createdAt: Date.now(),
          });
      });
      return { banned: input.banned };
    }),
};
