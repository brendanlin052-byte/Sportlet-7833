import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { eq } from "drizzle-orm";
import { db } from "./database";
import { accountAccess } from "./database/schema";

const factory = drizzleAdapter(db, { provider: "sqlite" });
/** Link a broker-verified email to its existing account instead of duplicating it. */
export const linkedAuthAdapter: ReturnType<typeof drizzleAdapter> = (options) => {
  const adapter = factory(options);
  return {
    ...adapter,
    async create<T extends Record<string, unknown>, R = T>(input: {
      model: string;
      data: Omit<T, "id">;
      select?: string[];
      forceAllowId?: boolean;
    }): Promise<R> {
      if (
        input.model === "user" &&
        input.data.emailVerified === true &&
        typeof input.data.email === "string"
      ) {
        const existing = await adapter.findOne<{ id: string }>({
          model: "user",
          where: [{ field: "email", value: input.data.email }],
        });
        if (existing) {
          await adapter.update({
            model: "user",
            where: [{ field: "id", value: existing.id }],
            update: { emailVerified: true },
          });
          const linked = await adapter.findOne<R>({
            model: "user",
            where: [{ field: "id", value: existing.id }],
            select: input.select,
          });
          if (linked) return linked;
        }
      }
      return adapter.create<T, R>(input);
    },
    async update<T>(input: Parameters<typeof adapter.update>[0]): Promise<T | null> {
      if (input.model === "user" && typeof input.update.name === "string") {
        const existing = await adapter.findOne<{ id: string; name: string }>({
          model: "user",
          where: input.where,
        });
        if (existing) {
          const [access] = await db
            .select()
            .from(accountAccess)
            .where(eq(accountAccess.userId, existing.id));
          if (access?.role === "owner")
            input = { ...input, update: { ...input.update, name: existing.name } };
        }
      }
      return adapter.update<T>(input);
    },
  };
};
