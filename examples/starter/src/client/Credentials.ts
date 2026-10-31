import type { createAuthClient } from "better-auth/react";

export type Credentials = Parameters<ReturnType<typeof createAuthClient>["signUp"]["email"]>[0];
