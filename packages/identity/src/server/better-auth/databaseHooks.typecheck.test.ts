import { Context, Effect, type Scope } from "effect";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { SqlClient } from "effect/sql";
import { expectTypeOf } from "vitest";
import type { Store } from "@shivaedev/rate-limit/Store.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import type { BetterAuthDatabaseHooks } from "#server/better-auth/databaseHooks.ts";

class Application extends Context.Service<Application, { readonly admits: (id: string) => boolean }>()("@shivaedev/identity/typecheck/Application") {}

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

expectTypeOf<Effect.Services<typeof mounted>>().toEqualTypeOf<Application | Scope.Scope | Store>();

const resetMount = betterAuthMount(
	{ secret: "typecheck-only-secret-at-least-32-characters" },
	{ onPasswordReset: ({ user }) => Effect.flatMap(Application, (app) => Effect.sync(() => void app.admits(user.id))) },
);

expectTypeOf<Effect.Services<typeof resetMount>>().toEqualTypeOf<Application | Scope.Scope | Store>();

const emailMount = betterAuthMount(
	{ secret: "typecheck-only-secret-at-least-32-characters" },
	{
		emails: {
			deliver: ({ user }) => Effect.flatMap(Application, (app) => Effect.sync(() => void app.admits(user.id))),
			routes: {
				AccountAlreadyExists: "https://app.example/sign-in",
				ApproveEmailChange: "https://app.example/approve",
				ConfirmAccount: "https://app.example/confirm",
				ConfirmNewAddress: "https://app.example/confirm-new",
				ResetPassword: "https://app.example/reset",
			},
		},
	},
);

expectTypeOf<Effect.Services<typeof emailMount>>().toEqualTypeOf<Application | Store | SqlClient.SqlClient | Reactivity.Reactivity>();

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
