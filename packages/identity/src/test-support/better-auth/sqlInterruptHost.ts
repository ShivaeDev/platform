import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Option, Schema } from "effect";
import { Headers as HttpHeaders, HttpRouter } from "effect/http";
import { betterAuthSessions } from "#server/adapters/betterAuthSessions.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { signedInUser } from "#server/better-auth/testing.ts";

export type AuthCall = "session lookup" | "provider-account lookup" | "mounted request";
const SessionReply = Schema.Struct({ user: Schema.Struct({ name: Schema.String }) });
const ORIGIN = "http://localhost:3000";

export const sqlInterruptHost = Effect.gen(function* () {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "auth-sql-interruption-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false } },
	};
	yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
	const mounted = yield* betterAuthMount(options).pipe(
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
	);
	const app = HttpRouter.toWebHandler(mounted.routes, { disableLogger: true });
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	const provider = betterAuthSessions(
		(headers) => mounted.auth.api.getSession({ headers }),
		(headers) => mounted.auth.api.listUserAccounts({ headers }),
	);
	return {
		call: Effect.fnUntraced(function* (kind: AuthCall, headers: Headers) {
			if (kind === "mounted request") {
				const reply = yield* Effect.tryPromise((signal) => app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers, signal })));
				return Schema.decodeUnknownSync(SessionReply)(yield* Effect.tryPromise(() => reply.json())).user.name;
			}
			const session = Option.getOrThrow(yield* provider.get(HttpHeaders.fromInput(headers)));
			if (kind === "provider-account lookup") {
				return (yield* session.user.providerAccounts).map(({ accountId }) => accountId).join(",");
			}
			return session.user.name;
		}),
		mint: () =>
			signedInUser(mounted.auth, {
				email: "alice@interrupt.test",
				name: "alice",
				providerAccounts: [{ accountId: "alice-github", providerId: "github" }],
			}),
	};
});
