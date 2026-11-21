import { ConfigProvider, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";

export const compositionOptions = {
	"baseURL": "http://localhost:3000",
	emailAndPassword: { enabled: true },
	logger: { disabled: true },
	secret: "transaction-composition-story-secret-at-least-32-characters",
};

export interface CompositionState {
	readonly refuseAccount: boolean;
	readonly signOutDuringRefresh?: boolean;
}

function note(kind: string) {
	return SqlClient.SqlClient.use((sql) => sql`insert into registration_notes (kind) values (${kind})`).pipe(Effect.asVoid, Effect.orDie);
}

export const compositionHost = Effect.fnUntraced(function* (state: CompositionState) {
	const beforeAccount = Effect.fnUntraced(function* () {
		yield* note("before account");
		if (state.refuseAccount) {
			return yield* Effect.fail({ code: "ACCOUNT_REFUSED", message: "Account registration refused" });
		}
	});
	const storage = yield* authTestDatabase;
	function signOutElsewhere() {
		return state.signOutDuringRefresh === true ? storage.deleteSessions.pipe(Effect.orDie) : Effect.void;
	}
	return yield* betterAuthMount(
		// Every session lookup refreshes the session, so a story can race a refresh.
		{ ...compositionOptions, database: yield* betterAuthDatabase(), session: { updateAge: 0 } },
		{
			databaseHooks: {
				account: { create: { before: beforeAccount } },
				session: { update: { after: () => note("after session update"), before: signOutElsewhere } },
				user: { create: { after: () => note("after user") } },
			},
		},
	).pipe(Effect.provide(memoryStore), Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
});

export function signUpAlice(host: Effect.Success<ReturnType<typeof compositionHost>>) {
	return Effect.tryPromise(() =>
		host.auth.api.signUpEmail({
			asResponse: true,
			body: { email: "alice@composition.test", name: "alice", password: "alice-composition-password" },
		}),
	);
}
