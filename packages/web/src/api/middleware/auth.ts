import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";
import { db } from "../database";
import { accountAccess } from "../database/schema";
import { eq } from "drizzle-orm";
export const signedIn = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session)
    throw new ORPCError("UNAUTHORIZED", { message: "Sign in to save your collection." });
  const [stored] = await db
    .select()
    .from(accountAccess)
    .where(eq(accountAccess.userId, session.user.id));
  const access = stored ?? {
    userId: session.user.id,
    role: "collector" as const,
    banned: false,
    banReason: "",
    mutedUntil: 0,
    muteReason: "",
  };
  return next({ context: { user: session.user, access } });
});
export const authed = signedIn.use(({ context, next }) => {
  if (context.access.banned)
    throw new ORPCError("FORBIDDEN", {
      message: `This account is banned.${context.access.banReason ? ` Reason: ${context.access.banReason}` : ""}`,
    });
  return next();
});
export const ownerOnly = authed.use(({ context, next }) => {
  if (context.access.role !== "owner")
    throw new ORPCError("FORBIDDEN", { message: "Only the owner can moderate collectors." });
  return next();
});

export const staffOnly = authed.use(({ context, next }) => {
  if (context.access.role !== "owner" && context.access.role !== "moderator")
    throw new ORPCError("FORBIDDEN", { message: "Only staff can manage player progress." });
  return next();
});
