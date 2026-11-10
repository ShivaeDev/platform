import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Migrator } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { AccountPreferences } from "#accountPreferences.ts";
import { AccountClock } from "#server/account-clock/service.ts";
import { AccountDayStart, LogicalDay } from "#server/account-clock/settings.ts";
import { accountPreferencesStore } from "#server/account-preferences/store.ts";
import { accountPreferencesHandlers } from "#server/accountPreferencesHandlers.ts";
import { accountPreferencesMigration } from "#server/accountPreferencesMigration.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { selfSubject } from "#subject.ts";

const ClockApi = contract("clock", {
	queries: [
		query("day", {
			payload: { instant: Schema.optionalKey(Schema.DateTimeUtcFromString) },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
		query("range", {
			payload: { day: LogicalDay },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.Struct({ end: Schema.DateTimeUtcFromString, start: Schema.DateTimeUtcFromString }),
		}),
	],
	subject: selfSubject,
});
export const Api = AccountPreferences.merge(ClockApi);
export const ORIGIN = "http://localhost:3000";

export const preferencesHost = Effect.fnUntraced(function* () {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "account-preferences-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false }, disableSessionRefresh: true },
	};
	yield* migrateBetterAuth(options);
	yield* migratePostgres({
		loader: Migrator.fromRecord({ "0001_preferences": accountPreferencesMigration }),
		lockTimeout: "5 seconds",
	});
	const mounted = yield* betterAuthMount(options, { accountPreferences: true }).pipe(
		Effect.provide(memoryStore),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
	);
	const config: { dayStart: number | undefined } = { dayStart: 240 };
	const requestServices = AccountClock.layer.pipe(
		Layer.provide(
			Layer.effect(
				AccountDayStart,
				Effect.sync(() => config.dayStart ?? 0),
			),
		),
		Layer.orDie,
	);
	const handlers = Layer.merge(
		accountPreferencesHandlers,
		ClockApi.application.toLayer({
			"clock.day": ({ instant }) => Effect.flatMap(AccountClock, (account) => account.logicalDay(instant)),
			"clock.range": ({ day }) => Effect.flatMap(AccountClock, (account) => account.dayRange(day)).pipe(Effect.orDie),
		}),
	);
	const sessions = Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true });
	const services = yield* Layer.build(
		appHost({
			config: { disablePreemptiveShutdown: true, port: 0 },
			group: Api,
			handlers,
			requestServices,
			routes: mounted.routes,
			services: accountPreferencesStore,
			sessions,
		}),
	);
	const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(services));
	if (!NetAddress.isInetAddress(server.address)) {
		return yield* Effect.die("Expected TCP address");
	}
	const url = `http://127.0.0.1:${server.address.port}`;

	return {
		auth: mounted.auth,
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${url}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
			),
		config,
		fetch: (input: string | URL | Request, init?: RequestInit) => {
			const request = new Request(input, init);
			const target = new URL(request.url);
			return fetch(new Request(`${url}${target.pathname}${target.search}`, request));
		},
	};
});

export type PreferencesHost = Effect.Success<ReturnType<typeof preferencesHost>>;
