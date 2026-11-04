import { testUtils } from "better-auth/plugins";
import { Clock, ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpRouter } from "effect/http";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcClient, RpcSerialization, RpcServer } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { LiveServer } from "@shivaedev/contract/LiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { subjectLayers } from "@shivaedev/contract/subjectLayers.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { hostChanges } from "@shivaedev/server/hostChanges.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { AccountPreferences } from "#accountPreferences.ts";
import { AccountClock, AccountDayStart, LogicalDay } from "#server/AccountClock.ts";
import { AccountPreferencesStore } from "#server/AccountPreferencesStore.ts";
import { accountPreferencesHandlers } from "#server/accountPreferencesHandlers.ts";
import { accountPreferencesMigration } from "#server/adapters/accountPreferencesMigration.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { subjectResolverLayer } from "#server/subjectResolverLayer.ts";
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
	const sql = yield* SqlClient.SqlClient;
	const clock = yield* Clock.Clock;
	const config: { dayStart: number | undefined } = { dayStart: 240 };
	function clockLayer() {
		return config.dayStart === undefined
			? AccountClock.layer
			: AccountClock.layer.pipe(Layer.provide(Layer.succeed(AccountDayStart, config.dayStart)));
	}

	const handlers = Layer.mergeAll(
		hostChanges(Api),
		accountPreferencesHandlers,
		ClockApi.application.toLayer({
			"clock.day": ({ instant }) =>
				Effect.flatMap(AccountClock, (account) => account.logicalDay(instant)).pipe(Effect.provide(clockLayer()), Effect.orDie),
			"clock.range": ({ day }) => Effect.flatMap(AccountClock, (account) => account.dayRange(day)).pipe(Effect.provide(clockLayer()), Effect.orDie),
		}),
	).pipe(Layer.provide(AccountPreferencesStore.layer));
	const sessions = Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true });
	const rpc = RpcServer.layerHttp({ group: Api, path: "/rpc", protocol: "http" }).pipe(
		Layer.provide([handlers, subjectLayers(Api).pipe(Layer.provide(subjectResolverLayer())), RpcSerialization.layerNdjson]),
	);
	const app = HttpRouter.toWebHandler(
		Layer.merge(mounted.routes, rpc).pipe(
			Layer.provide([
				sessions,
				LiveServer.layer.pipe(Layer.provide(Reactivity.layer)),
				Reactivity.layer,
				Layer.succeed(SqlClient.SqlClient, sql),
				Layer.succeed(Clock.Clock, clock),
			]),
		),
		{ disableLogger: true },
	);
	yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
	return {
		auth: mounted.auth,
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${ORIGIN}/rpc`,
					}).pipe(
						Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
						Layer.provide(Layer.succeed(FetchHttpClient.Fetch, (input, init) => app.handler(new Request(input, init)))),
					),
				),
			),
		config,
		fetch: (input: string | URL | Request, init?: RequestInit) => app.handler(new Request(input, init)),
	};
});

export type PreferencesHost = Effect.Success<ReturnType<typeof preferencesHost>>;
