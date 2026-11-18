import { z } from "zod";
import { and, eq, gte } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { ORPCError } from "@orpc/server";
import { db } from "../database";
import { account, moderationLog, user } from "../database/schema";
import { ownerOnly } from "../middleware/auth";
import { base } from "../__core/app";
import { auth } from "../auth";

export const accountManagement = {
  createResetLink: ownerOnly.input(z.object({ userId: z.string().min(1) }))
    .handler(async ({ input, context }) => {
      const [target] = await db.select({ id: user.id }).from(user).where(eq(user.id, input.userId));
      if (!target) throw new ORPCError("NOT_FOUND", { message: "Account not found." });
      const [credential] = await db.select({ id: account.id }).from(account)
        .where(and(eq(account.userId, input.userId), eq(account.providerId, "credential")));
      if (!credential) throw new ORPCError("BAD_REQUEST", { message: "This account uses Google sign-in. Recover its password through Google." });
      const now = Date.now();
      await db.transaction(async (tx) => {
        const [recent] = await tx.select({ id: moderationLog.id }).from(moderationLog)
          .where(and(eq(moderationLog.actorId, context.user.id), eq(moderationLog.targetId, input.userId),
            eq(moderationLog.action, "password_reset_link"), gte(moderationLog.createdAt, now - 60000)));
        if (recent) throw new ORPCError("TOO_MANY_REQUESTS", { message: "Wait one minute before creating another reset link for this account." });
        await tx.insert(moderationLog).values({ actorId: context.user.id, targetId: input.userId,
          action: "password_reset_link", reason: "Owner created a 15-minute, single-use password reset link.", createdAt: now });
      });
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(now + 15 * 60000);
      const authContext = await auth.$context;
      await authContext.internalAdapter.createVerificationValue({
        identifier: `reset-password:${token}`, value: input.userId, expiresAt,
      });
      return { token, expiresAt: expiresAt.getTime() };
    }),
  resetPassword: base.input(z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), newPassword: z.string().min(8).max(128) }))
    .handler(async ({ input }) => {
      try {
        await auth.api.resetPassword({ body: input });
      } catch {
        throw new ORPCError("BAD_REQUEST", { message: "This reset link is invalid, expired, or already used. Ask the owner for a new one." });
      }
      return { success: true };
    }),
};