import { z } from "zod";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, lt, lte } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { accountAccess, bazaarListings, clanCooldowns, clanMembers, clanMessages, clanRequests, clansTable, inventory, user } from "../database/schema";
import { authed } from "../middleware/auth";
import { base } from "../__core/app";
import { addClanMember, getMembership, memberInClan, requireLeader } from "../clan-helpers";
import { characters } from "../../shared/catalog";
const clanId = z.object({ clanId: z.string().uuid() });
const details = z.object({ name: z.string().trim().min(3).max(32), description: z.string().trim().max(240), inviteOnly: z.boolean() });
export const clans = {
  list: base.handler(async () => {
    const all = await db.select({ id: clansTable.id, name: clansTable.name, description: clansTable.description,
      inviteOnly: clansTable.inviteOnly, leaderId: clansTable.leaderId, leaderName: user.name }).from(clansTable).innerJoin(user, eq(user.id, clansTable.leaderId));
    const members = await db.select({ userId: clanMembers.userId, clanId: clanMembers.clanId, banned: accountAccess.banned }).from(clanMembers).leftJoin(accountAccess, eq(accountAccess.userId, clanMembers.userId));
    const held = await db.select({ userId: inventory.userId, characterId: inventory.characterId }).from(inventory);
    const escrow = await db.select({ userId: bazaarListings.sellerId, characterId: bazaarListings.characterId }).from(bazaarListings).where(eq(bazaarListings.status, "active"));
    const cards = new Map<string, Set<string>>();
    for (const item of [...held, ...escrow]) {
      if (!cards.has(item.userId)) cards.set(item.userId, new Set());
      cards.get(item.userId)!.add(item.characterId);
    }
    const ratings = new Map(characters.map((card) => [card.id, card.rating]));
    return all.map((clan) => {
      const roster = members.filter((member) => member.clanId === clan.id);
      const score = roster.filter((member) => !member.banned).reduce((total, member) => total + [...(cards.get(member.userId) ?? [])].reduce((sum, id) => sum + (ratings.get(id) ?? 0), 0), 0);
      return { ...clan, members: roster.length, score };
    }).sort((a,b) => b.score - a.score || a.name.localeCompare(b.name));
  }),
  mine: authed.handler(async ({ context }) => db.transaction(async (tx) => {
    const membership = await getMembership(tx, context.user.id);
    const [request] = await tx.select({ clanId: clanRequests.clanId, name: clansTable.name }).from(clanRequests).innerJoin(clansTable, eq(clansTable.id, clanRequests.clanId)).where(eq(clanRequests.userId, context.user.id));
    if (!membership) return { clan: null, members: [], requests: [], pending: request ?? null };
    const [clan] = await tx.select().from(clansTable).where(eq(clansTable.id, membership.clanId));
    const members = await tx.select({ id: user.id, name: user.name, joinedAt: clanMembers.joinedAt }).from(clanMembers).innerJoin(user, eq(user.id, clanMembers.userId)).where(eq(clanMembers.clanId, membership.clanId)).orderBy(asc(clanMembers.joinedAt));
    const requests = clan!.leaderId === context.user.id ? await tx.select({ id: user.id, name: user.name }).from(clanRequests).innerJoin(user, eq(user.id, clanRequests.userId)).where(eq(clanRequests.clanId, membership.clanId)) : [];
    return { clan: clan!, members, requests, pending: null };
  })),
  create: authed.input(details).handler(async ({ input, context }) => db.transaction(async (tx) => {
    if (await getMembership(tx, context.user.id)) throw new ORPCError("BAD_REQUEST", { message: "Leave your current clan first." });
    const nameKey = input.name.normalize("NFKC").toLowerCase();
    const [duplicate] = await tx.select().from(clansTable).where(eq(clansTable.nameKey, nameKey));
    if (duplicate) throw new ORPCError("BAD_REQUEST", { message: "That clan name is already taken." });
    const id = randomUUID();
    await tx.insert(clansTable).values({ ...input, id, nameKey, leaderId: context.user.id, createdAt: Date.now() });
    await addClanMember(tx, context.user.id, id); return { id };
  })),
  join: authed.input(clanId).handler(async ({ input, context }) => db.transaction(async (tx) => {
    if (await getMembership(tx, context.user.id)) throw new ORPCError("BAD_REQUEST", { message: "You already belong to a clan." });
    const [clan] = await tx.select().from(clansTable).where(eq(clansTable.id, input.clanId));
    if (!clan) throw new ORPCError("NOT_FOUND", { message: "Clan not found." });
    if (clan.inviteOnly) {
      await tx.insert(clanRequests).values({ userId: context.user.id, clanId: clan.id, createdAt: Date.now() }).onConflictDoUpdate({ target: clanRequests.userId, set: { clanId: clan.id, createdAt: Date.now() } });
      return { requested: true };
    }
    await addClanMember(tx, context.user.id, clan.id); return { requested: false };
  })),
  cancelRequest: authed.handler(async ({ context }) => { await db.delete(clanRequests).where(eq(clanRequests.userId, context.user.id)); return { ok: true }; }),
  decideRequest: authed.input(z.object({ userId: z.string().min(1), accept: z.boolean() })).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const clan = await requireLeader(tx, context.user.id);
    const [request] = await tx.select().from(clanRequests).where(and(eq(clanRequests.userId, input.userId), eq(clanRequests.clanId, clan.id)));
    if (!request) throw new ORPCError("NOT_FOUND", { message: "Join request no longer exists." });
    if (input.accept) {
      const [access] = await tx.select().from(accountAccess).where(eq(accountAccess.userId, input.userId));
      if (access?.banned) throw new ORPCError("BAD_REQUEST", { message: "Banned players cannot join." });
      await addClanMember(tx, input.userId, clan.id);
    } else await tx.delete(clanRequests).where(eq(clanRequests.userId, input.userId));
    return { ok: true };
  })),
  edit: authed.input(details).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const clan = await requireLeader(tx, context.user.id);
    const nameKey = input.name.normalize("NFKC").toLowerCase();
    const [duplicate] = await tx.select().from(clansTable).where(eq(clansTable.nameKey, nameKey));
    if (duplicate && duplicate.id !== clan.id) throw new ORPCError("BAD_REQUEST", { message: "That clan name is already taken." });
    await tx.update(clansTable).set({ ...input, nameKey }).where(eq(clansTable.id, clan.id)); return { ok: true };
  })),
  manageMember: authed.input(z.object({ userId: z.string().min(1), action: z.enum(["kick", "transfer"]), confirm: z.literal(true) }))
    .handler(async ({ input, context }) => db.transaction(async (tx) => {
      const clan = await requireLeader(tx, context.user.id);
      const [member] = await tx.select().from(clanMembers).where(memberInClan(input.userId, clan.id));
      if (!member || input.userId === context.user.id) throw new ORPCError("BAD_REQUEST", { message: "Select another clan member." });
      if (input.action === "kick") await tx.delete(clanMembers).where(memberInClan(input.userId, clan.id));
      else {
        const [access] = await tx.select().from(accountAccess).where(eq(accountAccess.userId, input.userId));
        if (access?.banned) throw new ORPCError("BAD_REQUEST", { message: "A banned player cannot lead a clan." });
        await tx.update(clansTable).set({ leaderId: input.userId }).where(eq(clansTable.id, clan.id));
      }
      return { ok: true };
    })),
  leave: authed.input(z.object({ confirm: z.literal(true) })).handler(async ({ context }) => db.transaction(async (tx) => {
    const membership = await getMembership(tx, context.user.id);
    if (!membership) throw new ORPCError("BAD_REQUEST", { message: "You are not in a clan." });
    const [clan] = await tx.select().from(clansTable).where(eq(clansTable.id, membership.clanId));
    if (clan?.leaderId === context.user.id) throw new ORPCError("BAD_REQUEST", { message: "Transfer leadership or disband the clan first." });
    await tx.delete(clanMembers).where(eq(clanMembers.userId, context.user.id)); return { ok: true };
  })),
  disband: authed.input(z.object({ confirm: z.literal(true) })).handler(async ({ context }) => db.transaction(async (tx) => {
    const clan = await requireLeader(tx, context.user.id);
    await tx.delete(clansTable).where(eq(clansTable.id, clan.id)); return { ok: true };
  })),
  messages: authed.input(z.object({ before: z.number().int().positive().optional() }).default({})).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const membership = await getMembership(tx, context.user.id);
    if (!membership) throw new ORPCError("FORBIDDEN", { message: "Only clan members can read this chat." });
    const rows = await tx.select({ id: clanMessages.id, userId: clanMessages.userId, name: user.name, body: clanMessages.body, createdAt: clanMessages.createdAt }).from(clanMessages).innerJoin(user, eq(user.id, clanMessages.userId))
      .where(and(eq(clanMessages.clanId, membership.clanId), input.before ? lt(clanMessages.id, input.before) : undefined)).orderBy(desc(clanMessages.id)).limit(51);
    return { clanId: membership.clanId, messages: rows.slice(0,50), nextCursor: rows.length > 50 ? rows[49]!.id : undefined };
  })),
  send: authed.input(z.object({ body: z.string().trim().min(1).max(500) })).handler(async ({ input, context }) => db.transaction(async (tx) => {
    const membership = await getMembership(tx, context.user.id);
    if (!membership) throw new ORPCError("FORBIDDEN", { message: "Only clan members can post here." });
    const [access] = await tx.select().from(accountAccess).where(eq(accountAccess.userId, context.user.id));
    if (access?.banned || (access?.mutedUntil ?? 0) > Date.now()) throw new ORPCError("FORBIDDEN", { message: "Your account cannot post chat messages right now." });
    const now = Date.now();
    await tx.insert(clanCooldowns).values({ userId: context.user.id, lastSent: 0 }).onConflictDoNothing();
    const [allowed] = await tx.update(clanCooldowns).set({ lastSent: now }).where(and(eq(clanCooldowns.userId, context.user.id), lte(clanCooldowns.lastSent, now - 3000))).returning();
    if (!allowed) throw new ORPCError("TOO_MANY_REQUESTS", { message: "Wait 3 seconds between clan messages." });
    const [message] = await tx.insert(clanMessages).values({ clanId: membership.clanId, userId: context.user.id, body: input.body, createdAt: now }).returning(); return message!;
  })),
};