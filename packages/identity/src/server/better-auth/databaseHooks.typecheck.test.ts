import { Context, Effect, type Scope } from "effect";
import { expectTypeOf } from "vitest";
import type { BetterAuthDatabaseHooks } from "./databaseHooks.ts";
import { betterAuthMount } from "./mount.ts";

class Application extends Context.Service<Application, { readonly admits: (id: string) => boolean }>()("identity/typecheck/Application") {}

const mounted = betterAuthMount(
	{ secret: "typecheck-only-secret-at-least-32-characters" },
	{
		databaseHooks: {
			session: {
				create: {
					before: (session) =>
						Effect.flatMap(Application, (app) =>
							app.admits(session.userId) ? Effect.void : Effect.fail({ code: "MEMBERS_ONLY", message: "Membership is required" }),
						),
				},
			},
		},
	},
);

expectTypeOf<Effect.Services<typeof mounted>>().toEqualTypeOf<Application | Scope.Scope>();

const invalidFailure: BetterAuthDatabaseHooks = {
	user: {
		create: {
			// @ts-expect-error Hook failures must state a public code and message.
			before: () => Effect.fail({ message: "Missing code" }),
		},
	},
};

const invalidAfter: BetterAuthDatabaseHooks = {
	session: {
		create: {
			// @ts-expect-error Hooks return Effects rather than Promises.
			after: () => Promise.resolve(),
		},
	},
};

void [invalidFailure, invalidAfter];
