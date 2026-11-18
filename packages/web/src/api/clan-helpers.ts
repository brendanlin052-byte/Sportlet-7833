import { and, eq, count } from "drizzle-orm";
import { ORPCError } from "@orpc/server";
import { db } from "./database";
import { clanMembers, clanRequests, clansTable } from "./database/schema";
export type ClanTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export async function getMembership(tx: ClanTransaction | typeof db, userId: string) {
  const [membership] = await tx.select().from(clanMembers).where(eq(clanMembers.userId, userId));
  return membership;
}
export async function requireLeader(tx: ClanTransaction, userId: string) {
  const membership = await getMembership(tx, userId);
  if (!membership) throw new ORPCError("FORBIDDEN", { message: "Join a clan first." });
  const [clan] = await tx.select().from(clansTable).where(eq(clansTable.id, membership.clanId));
  if (clan?.leaderId !== userId) throw new ORPCError("FORBIDDEN", { message: "Only the clan leader can do that." });
  return clan;
}
export async function addClanMember(tx: ClanTransaction, userId: string, clanId: string) {
  if (await getMembership(tx, userId)) throw new ORPCError("BAD_REQUEST", { message: "You already belong to a clan." });
  const [total] = await tx.select({ value: count() }).from(clanMembers).where(eq(clanMembers.clanId, clanId));
  if (total!.value >= 50) throw new ORPCError("BAD_REQUEST", { message: "This clan is full (50 members)." });
  await tx.insert(clanMembers).values({ userId, clanId, joinedAt: Date.now() });
  await tx.delete(clanRequests).where(eq(clanRequests.userId, userId));
}
export const memberInClan = (userId: string, clanId: string) => and(eq(clanMembers.userId, userId), eq(clanMembers.clanId, clanId));