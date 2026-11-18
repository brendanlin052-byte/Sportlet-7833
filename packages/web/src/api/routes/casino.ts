import { z } from "zod";
import { randomInt } from "node:crypto";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { casinoWallets, casinoEvents, profiles } from "../database/schema";
import { authed } from "../middleware/auth";
import { rouletteMultiplier, slotsMultiplier, slotSymbols } from "../../shared/casino-rules";
const amount = z.number().int().min(1).max(100000);
const requestId = z.string().uuid();
const playInput = z.discriminatedUnion("game", [
  z.object({ game: z.literal("roulette"), bet: amount, requestId, choice: z.string().regex(/^(red|black|odd|even|number:([0-9]|[12][0-9]|3[0-6]))$/) }),
  z.object({ game: z.literal("slots"), bet: amount, requestId }),
  z.object({ game: z.literal("coinflip"), bet: amount, requestId, choice: z.enum(["heads", "tails"]) }),
]);
export const casino = {
  state: authed.handler(async ({ context }) => {
    const [wallet] = await db.select().from(casinoWallets).where(eq(casinoWallets.userId, context.user.id));
    const history = await db.select().from(casinoEvents).where(eq(casinoEvents.userId, context.user.id)).orderBy(desc(casinoEvents.createdAt)).limit(100);
    return { chips: wallet?.chips ?? 0, history };
  }),
  exchange: authed.input(z.object({ direction: z.enum(["toChips", "toCoins"]), amount, requestId }))
    .handler(async ({ input, context }) => db.transaction(async (tx) => {
      const id = `${context.user.id}:${input.requestId}`;
      const fingerprint = JSON.stringify({ direction: input.direction, amount: input.amount });
      const [old] = await tx.select().from(casinoEvents).where(eq(casinoEvents.id, id));
      if (old) {
        const result = JSON.parse(old.outcome) as { fingerprint: string; coins: number };
        if (result.fingerprint !== fingerprint) throw new ORPCError("CONFLICT", { message: "This exchange request was already used." });
        return { chips: old.chips, coins: result.coins };
      }
      await tx.insert(profiles).values({ userId: context.user.id }).onConflictDoNothing();
      await tx.insert(casinoWallets).values({ userId: context.user.id }).onConflictDoNothing();
      if (input.direction === "toChips") {
        const [charged] = await tx.update(profiles).set({ coins: sql`${profiles.coins} - ${input.amount}` })
          .where(and(eq(profiles.userId, context.user.id), gte(profiles.coins, input.amount))).returning();
        if (!charged) throw new ORPCError("BAD_REQUEST", { message: "Not enough coins. Nothing was exchanged." });
        await tx.update(casinoWallets).set({ chips: sql`${casinoWallets.chips} + ${input.amount}` }).where(eq(casinoWallets.userId, context.user.id));
      } else {
        const [charged] = await tx.update(casinoWallets).set({ chips: sql`${casinoWallets.chips} - ${input.amount}` })
          .where(and(eq(casinoWallets.userId, context.user.id), gte(casinoWallets.chips, input.amount))).returning();
        if (!charged) throw new ORPCError("BAD_REQUEST", { message: "Not enough chips. Nothing was exchanged." });
        await tx.update(profiles).set({ coins: sql`${profiles.coins} + ${input.amount}` }).where(eq(profiles.userId, context.user.id));
      }
      const [wallet] = await tx.select().from(casinoWallets).where(eq(casinoWallets.userId, context.user.id));
      const [profile] = await tx.select().from(profiles).where(eq(profiles.userId, context.user.id));
      await tx.insert(casinoEvents).values({ id, userId: context.user.id, kind: input.direction, amount: input.amount,
        payout: input.amount, outcome: JSON.stringify({ fingerprint, coins: profile!.coins }), chips: wallet!.chips, createdAt: Date.now() });
      return { chips: wallet!.chips, coins: profile!.coins };
    })),
  play: authed.input(playInput).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const id = `${context.user.id}:${input.requestId}`;
    const fingerprint = JSON.stringify({ ...input, requestId: undefined });
    const [old] = await tx.select().from(casinoEvents).where(eq(casinoEvents.id, id));
    if (old) {
      const outcome = JSON.parse(old.outcome) as { fingerprint: string; result: string; multiplier: number };
      if (outcome.fingerprint !== fingerprint) throw new ORPCError("CONFLICT", { message: "This play request was already used." });
      return { result: outcome.result, multiplier: outcome.multiplier, payout: old.payout, chips: old.chips };
    }
    await tx.insert(casinoWallets).values({ userId: context.user.id }).onConflictDoNothing();
    const [wallet] = await tx.select().from(casinoWallets).where(eq(casinoWallets.userId, context.user.id));
    const now = Date.now();
    if (now - wallet!.lastPlay < 2000) throw new ORPCError("TOO_MANY_REQUESTS", { message: "Wait 2 seconds between plays." });
    const [charged] = await tx.update(casinoWallets).set({ chips: sql`${casinoWallets.chips} - ${input.bet}`, lastPlay: now })
      .where(and(eq(casinoWallets.userId, context.user.id), gte(casinoWallets.chips, input.bet), lte(casinoWallets.lastPlay, now - 2000))).returning();
    if (!charged) throw new ORPCError("BAD_REQUEST", { message: "Not enough chips for that bet." });
    let result: string; let multiplier: number;
    if (input.game === "roulette") {
      const number = randomInt(37); result = String(number); multiplier = rouletteMultiplier(number, input.choice);
    } else if (input.game === "coinflip") {
      result = randomInt(2) === 0 ? "heads" : "tails"; multiplier = result === input.choice ? 2 : 0;
    } else {
      const reels = Array.from({ length: 3 }, () => randomInt(5));
      result = reels.map((reel) => slotSymbols[reel]!.name).join(" · "); multiplier = slotsMultiplier(reels);
    }
    const payout = input.bet * multiplier;
    const [updated] = await tx.update(casinoWallets).set({ chips: sql`${casinoWallets.chips} + ${payout}` }).where(eq(casinoWallets.userId, context.user.id)).returning();
    await tx.insert(casinoEvents).values({ id, userId: context.user.id, kind: input.game, amount: input.bet, payout,
      outcome: JSON.stringify({ fingerprint, result, multiplier }), chips: updated!.chips, createdAt: now });
    return { result, multiplier, payout, chips: updated!.chips };
  })),
};