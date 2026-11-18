import { betterAuth } from "better-auth";
import { runableManagedAuth } from "@runablehq/managed-auth/server";
import { linkedAuthAdapter } from "./auth-adapter";
export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: linkedAuthAdapter,
  emailAndPassword: { enabled: true, revokeSessionsOnPasswordReset: true },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: (request) => {
    const origin = request?.headers.get("origin");
    return origin ? [origin] : ["*"];
  },
  plugins: [
    ...runableManagedAuth({
      applicationId: process.env.APPLICATION_ID!,
      issuer: process.env.VITE_RUNABLE_AUTH_ISSUER!,
    }),
  ],
});
