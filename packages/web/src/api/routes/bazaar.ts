import { z } from "zod";
import { and, eq, gte, desc, lt, or, isNull, count, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { accountAccess, bazaarListings, inventory, profiles, user } from "../database/schema";
import { base } from "../__core/app";
import { authed } from "../middleware/auth";
import { characters } from "../../shared/catalog";

const listingId = z.object({ id: z.number().int().positive() });
export const bazaar = {
  list: base.input(z.object({ before: z.number().int().positive().optional() }).default({}))
    .handler(async ({ input }) => {
      const rows = await db.select({ id: bazaarListings.id, sellerId: bazaarListings.sellerId,
        sellerName: user.name, characterId: bazaarListings.characterId, quantity: bazaarListings.quantity,
        price: bazaarListings.price, createdAt: bazaarListings.createdAt })
        .from(bazaarListings).innerJoin(user, eq(user.id, bazaarListings.sellerId))
        .leftJoin(accountAccess, eq(accountAccess.userId, bazaarListings.sellerId))
        .where(and(eq(bazaarListings.status, "active"), or(isNull(accountAccess.banned), eq(accountAccess.banned, false)),
          input.before ? lt(bazaarListings.id, input.before) : undefined))
        .orderBy(desc(bazaarListings.id)).limit(51);
      return { listings: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49]!.id : undefined };
    }),
  mine: authed.handler(({ context }) => db.select().from(bazaarListings)
    .where(eq(bazaarListings.sellerId, context.user.id)).orderBy(desc(bazaarListings.id)).limit(100)),
  create: authed.input(z.object({ characterId: z.string(), quantity: z.number().int().min(1).max(1000), price: z.number().int().min(1).max(1000000) }))
    .handler(async ({ input, context }) => {
      if (!characters.some((character) => character.id === input.characterId)) throw new ORPCError("BAD_REQUEST", { message: "Unknown player card." });
      return db.transaction(async (tx) => {
        const [active] = await tx.select({ total: count() }).from(bazaarListings)
          .where(and(eq(bazaarListings.sellerId, context.user.id), eq(bazaarListings.status, "active")));
        if (active!.total >= 50) throw new ORPCError("BAD_REQUEST", { message: "You can have up to 50 active listings." });
        const [held] = await tx.update(inventory).set({ quantity: sql`${inventory.quantity} - ${input.quantity}` })
          .where(and(eq(inventory.userId, context.user.id), eq(inventory.characterId, input.characterId), gte(inventory.quantity, input.quantity))).returning();
        if (!held) throw new ORPCError("BAD_REQUEST", { message: "You don't own that many available copies." });
        if (!held.quantity) await tx.delete(inventory).where(eq(inventory.id, held.id));
        const [listing] = await tx.insert(bazaarListings).values({ ...input, sellerId: context.user.id, createdAt: Date.now() }).returning();
        return listing!;
      });
    }),
  buy: authed.input(listingId).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const [listing] = await tx.select().from(bazaarListings).where(eq(bazaarListings.id, input.id));
    if (!listing || listing.status !== "active") throw new ORPCError("BAD_REQUEST", { message: "This listing is no longer available." });
    if (listing.sellerId === context.user.id) throw new ORPCError("BAD_REQUEST", { message: "You can't buy your own listing." });
    const [sellerAccess] = await tx.select({ banned: accountAccess.banned }).from(accountAccess).where(eq(accountAccess.userId, listing.sellerId));
    if (sellerAccess?.banned) throw new ORPCError("BAD_REQUEST", { message: "This seller is currently unavailable." });
    const [claimed] = await tx.update(bazaarListings).set({ status: "sold", buyerId: context.user.id, closedAt: Date.now() })
      .where(and(eq(bazaarListings.id, input.id), eq(bazaarListings.status, "active"))).returning();
    if (!claimed) throw new ORPCError("BAD_REQUEST", { message: "Someone already bought this listing." });
    const total = listing.price * listing.quantity;
    await tx.insert(profiles).values({ userId: context.user.id }).onConflictDoNothing();
    const [buyer] = await tx.update(profiles).set({ coins: sql`${profiles.coins} - ${total}` })
      .where(and(eq(profiles.userId, context.user.id), gte(profiles.coins, total))).returning();
    if (!buyer) throw new ORPCError("BAD_REQUEST", { message: "Not enough coins to buy this listing." });
    await tx.insert(profiles).values({ userId: listing.sellerId }).onConflictDoNothing();
    await tx.update(profiles).set({ coins: sql`${profiles.coins} + ${total}` }).where(eq(profiles.userId, listing.sellerId));
    await tx.insert(inventory).values({ id: `${context.user.id}:${listing.characterId}`, userId: context.user.id,
      characterId: listing.characterId, quantity: listing.quantity })
      .onConflictDoUpdate({ target: inventory.id, set: { quantity: sql`${inventory.quantity} + ${listing.quantity}` } });
    return { coins: buyer.coins, quantity: listing.quantity, total };
  })),
  cancel: authed.input(listingId).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const [listing] = await tx.update(bazaarListings).set({ status: "cancelled", closedAt: Date.now() })
      .where(and(eq(bazaarListings.id, input.id), eq(bazaarListings.sellerId, context.user.id), eq(bazaarListings.status, "active"))).returning();
    if (!listing) throw new ORPCError("BAD_REQUEST", { message: "This isn't your active listing." });
    await tx.insert(inventory).values({ id: `${context.user.id}:${listing.characterId}`, userId: context.user.id,
      characterId: listing.characterId, quantity: listing.quantity })
      .onConflictDoUpdate({ target: inventory.id, set: { quantity: sql`${inventory.quantity} + ${listing.quantity}` } });
    return { quantity: listing.quantity };
  })),
};