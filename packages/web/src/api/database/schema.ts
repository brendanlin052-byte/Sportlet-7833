import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";
import { user } from "./auth-schema";
export * from "./auth-schema";
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(),
  coins: integer("coins").notNull().default(500),
  lastClaim: integer("last_claim").notNull().default(0),
  opened: integer("opened").notNull().default(0),
});
export const inventory = sqliteTable("inventory", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  characterId: text("character_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
});
export const chatMessages = sqliteTable(
  "chat_messages",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
    coinsEarned: integer("coins_earned").notNull().default(0),
  },
  (table) => [index("chat_messages_user_idx").on(table.userId)],
);
export const chatCooldowns = sqliteTable("chat_cooldowns", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  lastSent: integer("last_sent").notNull().default(0),
});
export const accountAccess = sqliteTable("account_access", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["collector", "moderator", "owner"] })
    .notNull()
    .default("collector"),
  banned: integer("banned", { mode: "boolean" }).notNull().default(false),
  banReason: text("ban_reason").notNull().default(""),
  mutedUntil: integer("muted_until").notNull().default(0),
  muteReason: text("mute_reason").notNull().default(""),
});
export const moderationLog = sqliteTable("moderation_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  actorId: text("actor_id").notNull(),
  targetId: text("target_id").notNull(),
  action: text("action").notNull(),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});
export const chatRewards = sqliteTable(
  "chat_rewards",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    lastSeen: integer("last_seen").notNull(),
  },
  (table) => [index("chat_rewards_user_idx").on(table.userId)],
);

export const bazaarListings = sqliteTable("bazaar_listings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sellerId: text("seller_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  buyerId: text("buyer_id").references(() => user.id, { onDelete: "set null" }),
  characterId: text("character_id").notNull(),
  quantity: integer("quantity").notNull(),
  price: integer("price").notNull(),
  status: text("status", { enum: ["active", "sold", "cancelled", "reset"] }).notNull().default("active"),
  createdAt: integer("created_at").notNull(),
  closedAt: integer("closed_at"),
}, (table) => [index("bazaar_seller_idx").on(table.sellerId), index("bazaar_status_idx").on(table.status)]);
export const casinoWallets = sqliteTable("casino_wallets", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  chips: integer("chips").notNull().default(0),
  lastPlay: integer("last_play").notNull().default(0),
});
export const casinoEvents = sqliteTable("casino_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  amount: integer("amount").notNull(),
  payout: integer("payout").notNull(),
  outcome: text("outcome").notNull(),
  chips: integer("chips").notNull(),
  createdAt: integer("created_at").notNull(),
}, (t) => [index("casino_events_user_idx").on(t.userId)]);
export const clansTable = sqliteTable("clans", {
  id: text("id").primaryKey(), name: text("name").notNull(), nameKey: text("name_key").notNull().unique(),
  description: text("description").notNull().default(""),
  leaderId: text("leader_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  inviteOnly: integer("invite_only", { mode: "boolean" }).notNull().default(false), createdAt: integer("created_at").notNull(),
});
export const clanMembers = sqliteTable("clan_members", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  clanId: text("clan_id").notNull().references(() => clansTable.id, { onDelete: "cascade" }), joinedAt: integer("joined_at").notNull(),
}, (t) => [index("clan_members_clan_idx").on(t.clanId)]);
export const clanRequests = sqliteTable("clan_requests", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }),
  clanId: text("clan_id").notNull().references(() => clansTable.id, { onDelete: "cascade" }), createdAt: integer("created_at").notNull(),
});
export const clanMessages = sqliteTable("clan_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  clanId: text("clan_id").notNull().references(() => clansTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  body: text("body").notNull(), createdAt: integer("created_at").notNull(),
}, (t) => [index("clan_messages_clan_idx").on(t.clanId)]);
export const clanCooldowns = sqliteTable("clan_cooldowns", {
  userId: text("user_id").primaryKey().references(() => user.id, { onDelete: "cascade" }), lastSent: integer("last_sent").notNull(),
});
