import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { TestClock } from "effect/testing";
import { defineAuth } from "@shivaedev/identity/server/better-auth/define.ts";
import { migrateBetterAuth } from "@shivaedev/identity/server/better-auth/migrate.ts";
import { betterAuthMount } from "@shivaedev/identity/server/better-auth/mount.ts";
import { JobsClientFactory } from "@shivaedev/jobs/server/JobsClientFactory.ts";
import { pgBossLayer } from "@shivaedev/jobs/server/service.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { postgresMigration } from "@shivaedev/rate-limit/postgresMigration.ts";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { inbox } from "@shivaedev/test-kits/email/adapters/inbox.ts";
import { makePgBossTesting } from "@shivaedev/test-kits/jobs/testing.ts";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import type { AuthEmailQueueOptions } from "#server/authEmailQueue.ts";
import { authEmailQueue } from "#server/authEmailQueue.ts";

export const APP_ORIGIN = "https://app.example.test";

export const appPaths = {
	AccountAlreadyExists: "/sign-in",
	ApproveEmailChange: "/email-change/approve",
	ConfirmAccount: "/auth/confirm",
	ConfirmNewAddress: "/email-change/confirm",
	ResetPassword: "/reset-password",
} as const;

const config = ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }));

export const authEmailHost = Effect.fnUntraced(function* (copy: AuthEmailQueueOptions["copy"], env: Record<string, string>) {
	const server = yield* Layer.build(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 }));
	const { address } = yield* HttpServer.HttpServer.pipe(Effect.provideContext(server));
	if (!NetAddress.isInetAddress(address)) {
		return yield* Effect.die("Auth email stories require a TCP listener");
	}
	const baseUrl = `http://127.0.0.1:${address.port}`;
	const Auth = defineAuth({
		options: {
			"baseURL": baseUrl,
			emailAndPassword: { enabled: true, requireEmailVerification: true },
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "auth-email-queue-stories-secret-with-32-characters",
			user: { changeEmail: { enabled: true } },
		},
	});
	const database = yield* PostgresTestDatabase;
	const sql = yield* Layer.build(postgresLayer(database.url, clientOptions({ maxConnections: 2 })));
	yield* postgresMigration.pipe(Effect.provideContext(sql));
	yield* migrateBetterAuth(Auth).pipe(Effect.provideContext(sql));
	const AuthEmails = authEmailQueue({ paths: appPaths, ...(copy === undefined ? {} : { copy }) });
	const mail = yield* inbox();
	const jobs = makePgBossTesting({ clock: yield* TestClock.testClockWith(Effect.succeed) });
	const worker = yield* Layer.build(
		AuthEmails.registration.workers.pipe(
			Layer.provide(mail.mailerLayer),
			Layer.provide(pgBossLayer({ connectionString: database.url })),
			Layer.provide(Layer.succeed(JobsClientFactory, jobs.clientFactory)),
		),
	);
	const emails = yield* AuthEmails.emails.pipe(Effect.provideContext(worker), Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env }))));
	const { auth, routes } = yield* betterAuthMount(Auth, { emails, hardening: { requirePasswordForEmailChange: false } }).pipe(
		Effect.provide(memoryStore),
		Effect.provideContext(sql),
		Effect.provide(config),
	);
	yield* Layer.build(HttpRouter.serve(routes, { disableLogger: true })).pipe(Effect.provideContext(server));
	return { auth, baseUrl, jobs, mail };
});
