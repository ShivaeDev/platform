import type { BetterAuthOptions } from "better-auth";
import type { Effect } from "effect";
import type { BetterAuthHookError } from "./databaseHooks.ts";

type NativePasswordReset = NonNullable<NonNullable<BetterAuthOptions["emailAndPassword"]>["onPasswordReset"]>;

export type BetterAuthPasswordReset<R = never> = (data: Parameters<NativePasswordReset>[0]) => Effect.Effect<void, BetterAuthHookError, R>;
