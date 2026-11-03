import { ConfigProvider, Effect } from "effect";
import { SqlClient } from "effect/sql";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";

export const compositionOptions = {
	"baseURL": "http://localhost:3000",
	emailAndPassword: { enabled: true },
	logger: { disabled: true },
	secret: "transaction-composition-story-secret-at-least-32-characters",
};

export const compositionHost = Effect.fnUntraced(function* (state: { readonly refuseAccount: boolean }) {
	const beforeAccount = Effect.fnUntraced(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into registration_notes (kind) values ('before account')`.pipe(Effect.orDie);
		if (state.refuseAccount) {
			return yield* Effect.fail({ code: "ACCOUNT_REFUSED", message: "Account registration refused" });
		}
	});
	function afterUser() {
		return SqlClient.SqlClient.use((sql) => sql`insert into registration_notes (kind) values ('after user')`).pipe(Effect.asVoid, Effect.orDie);
	}
	return yield* betterAuthMount(
		{ ...compositionOptions, database: yield* betterAuthDatabase() },
		{
			databaseHooks: {
				account: { create: { before: beforeAccount } },
				user: { create: { after: afterUser } },
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
