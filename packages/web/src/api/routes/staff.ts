import { z } from "zod";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { accountAccess, bazaarListings, casinoWallets, inventory, moderationLog, profiles, user } from "../database/schema";
import { ownerOnly, staffOnly } from "../middleware/auth";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function protectTarget(tx: Transaction, targetId: string, actorId: string, allowOwnerSelf = false) {
  const [actor] = await tx.select().from(accountAccess).where(eq(accountAccess.userId, actorId));
  if (!actor || actor.banned || (actor.role !== "owner" && actor.role !== "moderator") || (!allowOwnerSelf && actor.role !== "owner"))
    throw new ORPCError("FORBIDDEN", { message: "Your staff access is no longer available." });
  const [target] = await tx.select({ id: user.id }).from(user).where(eq(user.id, targetId));
  if (!target) throw new ORPCError("NOT_FOUND", { message: "Collector not found." });
  const [access] = await tx.select().from(accountAccess).where(eq(accountAccess.userId, targetId));
  const ownOwnerProgress = allowOwnerSelf && actor.role === "owner" && actorId === targetId;
  if ((access?.role === "owner" && !ownOwnerProgress) || (access?.role === "moderator" && actor.role !== "owner"))
    throw new ORPCError("FORBIDDEN", { message: "This staff account is protected." });
}
const reason = z.string().trim().min(3).max(200);
export const staff = {
  members: staffOnly.handler(async () => {
    const rows = await db.select({ id: user.id, name: user.name, role: accountAccess.role,
      banned: accountAccess.banned, coins: profiles.coins }).from(user)
      .leftJoin(accountAccess, eq(accountAccess.userId, user.id)).leftJoin(profiles, eq(profiles.userId, user.id)).orderBy(asc(user.name));
    return rows.map((row) => ({ ...row, role: row.role ?? "collector", banned: row.banned ?? false, coins: row.coins ?? 500 }));
  }),
  setModerator: ownerOnly.input(z.object({ userId: z.string().min(1), moderator: z.boolean() }))
    .handler(async ({ input, context }) => db.transaction(async (tx) => {
      await protectTarget(tx, input.userId, context.user.id);
      const role = input.moderator ? "moderator" as const : "collector" as const;
      await tx.insert(accountAccess).values({ userId: input.userId, role }).onConflictDoUpdate({ target: accountAccess.userId, set: { role } });
      await tx.insert(moderationLog).values({ actorId: context.user.id, targetId: input.userId,
        action: input.moderator ? "appoint_moderator" : "remove_moderator", reason: "Owner changed moderator access.", createdAt: Date.now() });
      return { role };
    })),
  removeCoins: staffOnly.input(z.object({ userId: z.string().min(1), amount: z.number().int().min(1).max(1000000), reason, confirm: z.literal(true) }))
    .handler(async ({ input, context }) => db.transaction(async (tx) => {
      await protectTarget(tx, input.userId, context.user.id, true);
      await tx.insert(profiles).values({ userId: input.userId }).onConflictDoNothing();
      const [profile] = await tx.update(profiles).set({ coins: sql`${profiles.coins} - ${input.amount}` })
        .where(and(eq(profiles.userId, input.userId), gte(profiles.coins, input.amount))).returning();
      if (!profile) throw new ORPCError("BAD_REQUEST", { message: "The collector doesn't have that many coins. No coins were removed." });
      await tx.insert(moderationLog).values({ actorId: context.user.id, targetId: input.userId, action: "remove_coins",
        reason: JSON.stringify({ amount: input.amount, reason: input.reason, balance: profile.coins }), createdAt: Date.now() });
      return { coins: profile.coins, removed: input.amount };
    })),
  resetProgress: staffOnly.input(z.object({ userId: z.string().min(1), reason, confirm: z.literal(true) }))
    .handler(async ({ input, context }) => db.transaction(async (tx) => {
      await protectTarget(tx, input.userId, context.user.id, true);
      const [before] = await tx.select().from(profiles).where(eq(profiles.userId, input.userId));
      const held = await tx.select({ quantity: inventory.quantity }).from(inventory).where(eq(inventory.userId, input.userId));
      const listings = await tx.update(bazaarListings).set({ status: "reset", closedAt: Date.now() })
        .where(and(eq(bazaarListings.sellerId, input.userId), eq(bazaarListings.status, "active"))).returning();
      await tx.delete(inventory).where(eq(inventory.userId, input.userId));
      const [wallet] = await tx.select().from(casinoWallets).where(eq(casinoWallets.userId, input.userId));
      await tx.update(casinoWallets).set({ chips: 0 }).where(eq(casinoWallets.userId, input.userId));
      const defaults = { coins: 500, lastClaim: 0, opened: 0 };
      await tx.insert(profiles).values({ userId: input.userId, ...defaults }).onConflictDoUpdate({ target: profiles.userId, set: defaults });
      await tx.insert(moderationLog).values({ actorId: context.user.id, targetId: input.userId, action: "reset_progress",
        reason: JSON.stringify({ reason: input.reason, previousCoins: before?.coins ?? 500,
          removedChips: wallet?.chips ?? 0,
          removedCards: held.reduce((sum, item) => sum + item.quantity, 0), discardedListings: listings.length }), createdAt: Date.now() });
      return { coins: 500, discardedListings: listings.length };
    })),
};