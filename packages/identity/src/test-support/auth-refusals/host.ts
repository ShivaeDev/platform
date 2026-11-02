import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { betterAuth } from "better-auth";
import { createAuthClient } from "better-auth/client";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { role } from "@shivaedev/access/role.ts";
import { roleSet } from "@shivaedev/access/roleSet.ts";
import { postgresMigration } from "@shivaedev/rate-limit/adapters/postgresMigration.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { CURRENT_PASSWORD, PASSWORD_HASH } from "#test/better-auth/hardeningHost.ts";

export const ApplicationCode = Schema.Literals(["MEMBERS_ONLY", "MAIL_UNAVAILABLE"]);
const Access = roleSet(role("member", []));

export interface Refusals {
	delivery: boolean;
	hook: boolean;
	policy: "refused" | "unavailable" | undefined;
	seed: boolean;
}

export const refusalHost = Effect.fnUntraced(function* (refusals: Refusals) {
	yield* postgresMigration;
	const options = {
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "auth-refusal-stories-secret-at-least-32-characters",
	};
	yield* migrateBetterAuth(options, { defaultRole: "member" });
	const mounted = yield* betterAuthMount(options, {
		databaseHooks: {
			session: {
				create: {
					before: () => (refusals.hook ? Effect.fail({ code: "MEMBERS_ONLY", message: "Membership is required" }) : Effect.void),
				},
			},
		},
		defaultRole: "member",
		emails: {
			deliver: () => (refusals.delivery ? Effect.fail({ code: "MAIL_UNAVAILABLE", message: "Mail is unavailable" }) : Effect.void),
			routes: {
				AccountAlreadyExists: "https://app.example.test/sign-in",
				ApproveEmailChange: "https://app.example.test/approve-email-change",
				ConfirmAccount: "https://app.example.test/confirm-account",
				ConfirmNewAddress: "https://app.example.test/confirm-new-address",
				ResetPassword: "https://app.example.test/reset-password",
			},
		},
		roleSeed: Effect.succeed({ onSignIn: () => (refusals.seed ? Effect.fail("Role storage is unavailable") : Effect.void) }),
		roles: Access,
		signIn: {
			rule: () =>
				refusals.policy === "unavailable" ? Effect.fail("Membership service is unavailable") : Effect.succeed(refusals.policy !== "refused"),
		},
	})
		.pipe(Effect.provide(memoryStore))
		.pipe(Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))));
	const context = yield* Layer.build(
		HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
			Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
		),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Auth refusal stories require a TCP listener");
	}
	const fixtures = betterAuth(options);
	yield* Effect.promise(async () => {
		const { test, internalAdapter } = await fixtures.$context;
		const user = await test.saveUser(test.createUser({ email: "alice@example.test", name: "alice" }));
		await internalAdapter.createAccount({ accountId: user.id, password: PASSWORD_HASH, providerId: "credential", userId: user.id });
	});
	const storage = yield* authTestDatabase;
	return {
		client: createAuthClient({ "baseURL": `http://127.0.0.1:${server.address.port}` }),
		credentials: { email: "alice@example.test", password: CURRENT_PASSWORD },
		storedSessions: Effect.map(storage.sessions, (rows) => rows.map(({ email }) => email)),
	};
});
