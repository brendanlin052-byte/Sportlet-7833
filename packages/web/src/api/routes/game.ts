import { z } from "zod";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { randomInt } from "node:crypto";
import { base } from "../__core/app";
import { authed } from "../middleware/auth";
import { db } from "../database";
import { profiles, inventory } from "../database/schema";
import { packs, characters, rarities } from "../../shared/catalog";
import { drawRarityIndex } from "../pack-odds";
async function ensureProfile(userId: string) {
  await db.insert(profiles).values({ userId }).onConflictDoNothing();
}
async function openPacks(userId: string, packId: string, quantity: number) {
  const pack = packs.find((p) => p.id === packId);
  if (!pack) throw new ORPCError("NOT_FOUND");
  const pulls = Array.from({ length: quantity }, () => {
    const index = drawRarityIndex();
    const candidates = characters.filter((character) => character.packId === pack.id && character.rarity === rarities[index]!.name);
    return candidates[randomInt(candidates.length)]!;
  });
  await ensureProfile(userId);
  return db.transaction(async (tx) => {
    const cost = pack.price * quantity;
    const [charged] = await tx.update(profiles)
      .set({ coins: sql`${profiles.coins} - ${cost}`, opened: sql`${profiles.opened} + ${quantity}` })
      .where(and(eq(profiles.userId, userId), gte(profiles.coins, cost))).returning();
    if (!charged) throw new ORPCError("BAD_REQUEST", { message: "Not enough coins for this many packs. Lower the quantity or claim your daily reward." });
    const previous = await tx.select().from(inventory).where(eq(inventory.userId, userId));
    const owned = new Set(previous.map((item) => item.characterId));
    const counts = new Map<string, number>();
    const results = pulls.map((character) => {
      const isNew = !owned.has(character.id);
      owned.add(character.id);
      counts.set(character.id, (counts.get(character.id) ?? 0) + 1);
      return { character, isNew };
    });
    for (const [characterId, count] of counts) {
      await tx.insert(inventory).values({ id: `${userId}:${characterId}`, userId, characterId, quantity: count })
        .onConflictDoUpdate({ target: inventory.id, set: { quantity: sql`${inventory.quantity} + ${count}` } });
    }
    return { results, coins: charged.coins, cost, quantity };
  });
}
export const game = {
  catalog: base.handler(() => ({ packs, characters, rarities })),
  state: authed.handler(async ({ context }) => {
    await ensureProfile(context.user.id);
    const [profile] = await db.select().from(profiles).where(eq(profiles.userId, context.user.id));
    const items = await db.select().from(inventory).where(eq(inventory.userId, context.user.id));
    return { profile: profile!, items };
  }),
  claim: authed.handler(async ({ context }) => {
    await ensureProfile(context.user.id);
    const now = Date.now();
    const result = await db
      .update(profiles)
      .set({ coins: sql`${profiles.coins} + 250`, lastClaim: now })
      .where(and(eq(profiles.userId, context.user.id), lte(profiles.lastClaim, now - 86400000)))
      .returning();
    if (!result.length)
      throw new ORPCError("BAD_REQUEST", {
        message: "Your next reward is available 24 hours after your last claim.",
      });
    return { coins: 250 };
  }),
  sell: authed.input(z.object({ items: z.array(z.object({
    characterId: z.string().min(1), quantity: z.number().int().min(1).max(1000000),
  })).min(1).max(characters.length) })).handler(async ({ input, context }) => {
    if (new Set(input.items.map((item) => item.characterId)).size !== input.items.length)
      throw new ORPCError("BAD_REQUEST", { message: "Choose each player only once." });
    const sales = input.items.map((item) => {
      const character = characters.find((c) => c.id === item.characterId);
      if (!character) throw new ORPCError("BAD_REQUEST", { message: "Unknown player." });
      return { ...item, value: character.sellValue * item.quantity };
    });
    return db.transaction(async (tx) => {
      let earned = 0;
      let sold = 0;
      for (const sale of sales) {
        const [remaining] = await tx.update(inventory)
          .set({ quantity: sql`${inventory.quantity} - ${sale.quantity}` })
          .where(and(eq(inventory.userId, context.user.id), eq(inventory.characterId, sale.characterId), gte(inventory.quantity, sale.quantity)))
          .returning();
        if (!remaining) throw new ORPCError("BAD_REQUEST", { message: "You no longer own that many copies. Refresh your collection and try again." });
        if (remaining.quantity === 0) await tx.delete(inventory).where(eq(inventory.id, remaining.id));
        earned += sale.value;
        sold += sale.quantity;
      }
      await tx.insert(profiles).values({ userId: context.user.id }).onConflictDoNothing();
      const [profile] = await tx.update(profiles).set({ coins: sql`${profiles.coins} + ${earned}` })
        .where(eq(profiles.userId, context.user.id)).returning();
      return { earned, sold, coins: profile!.coins };
    });
  }),
  open: authed.input(z.object({ packId: z.string() })).handler(async ({ input, context }) => {
    const batch = await openPacks(context.user.id, input.packId, 1);
    return { ...batch.results[0]!, coins: batch.coins };
  }),
  openMany: authed.input(z.object({ packId: z.string(), quantity: z.number().int().min(1).max(100) }))
    .handler(({ input, context }) => openPacks(context.user.id, input.packId, input.quantity)),
};
