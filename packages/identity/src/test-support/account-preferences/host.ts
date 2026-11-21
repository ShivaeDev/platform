import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Schema } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Migrator } from "effect/sql";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import type { AppModule } from "@shivaedev/server/AppModule.ts";
import { appHost } from "@shivaedev/server/appHost.ts";
import { appModules } from "@shivaedev/server/appModules.ts";
import { migratePostgres } from "@shivaedev/sql/migrations.ts";
import { AccountPreferences } from "#AccountPreferences.ts";
import { AccountPreferences as AccountPreferencesClient } from "#generated/AccountPreferences.ts";
import { AccountClock } from "#server/account-clock/service.ts";
import { AccountDayStart, LogicalDay } from "#server/account-clock/settings.ts";
import { accountPreferencesStore } from "#server/account-preferences/store.ts";
import { accountPreferencesMigration } from "#server/accountPreferencesMigration.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { migrateBetterAuth } from "#server/better-auth/migrate.ts";
import { betterAuthMount } from "#server/better-auth/mount.ts";
import { SessionPolicy } from "#server/SessionPolicy.ts";
import { Subject, selfSubject } from "#subject.ts";

const Instant = Schema.optionalKey(Schema.DateTimeUtcFromString);
const ClockApi = contract("clock", {
	queries: [
		query("day", { payload: { instant: Instant }, readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.String }),
		query("days", {
			payload: { accounts: Schema.Array(Schema.String), instant: Instant },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.Array(Schema.String),
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
const ReportApi = contract("report", {
	queries: [
		query("day", {
			payload: { account: Schema.String, instant: Instant },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
	],
});
export const Api = AccountPreferencesClient.merge(ClockApi, ReportApi);
export const ORIGIN = "http://localhost:3000";

export const preferencesHost = Effect.fnUntraced(function* (dayStart?: number) {
	const options = {
		"baseURL": ORIGIN,
		database: yield* betterAuthDatabase(),
		emailAndPassword: { enabled: true },
		logger: { disabled: true },
		plugins: [testUtils()],
		secret: "account-preferences-story-secret-at-least-32-characters",
		session: { cookieCache: { enabled: false }, disableSessionRefresh: true },
	};
	yield* migrateBetterAuth({ options });
	const accountClock = AccountClock.layer.pipe(Layer.provide(dayStart === undefined ? Layer.empty : Layer.succeed(AccountDayStart, dayStart)));
	const modules = yield* appModules([
		{
			migrations: { loader: Migrator.fromRecord({ "0001_preferences": accountPreferencesMigration }) },
			module: AccountPreferences,
			services: accountClock.pipe(Layer.provideMerge(accountPreferencesStore)),
		} satisfies AppModule,
		{
			group: ClockApi,
			handlers: ClockApi.application.toLayer({
				"clock.day": ({ instant }) =>
					Effect.gen(function* () {
						return yield* (yield* AccountClock).logicalDay((yield* Subject).id, instant);
					}).pipe(Effect.orDie),
				"clock.days": ({ accounts, instant }) =>
					Effect.flatMap(AccountClock, (clock) => Effect.forEach(accounts, (account) => clock.logicalDay(account, instant))).pipe(Effect.orDie),
				"clock.range": ({ day }) =>
					Effect.gen(function* () {
						return yield* (yield* AccountClock).dayRange((yield* Subject).id, day);
					}).pipe(Effect.orDie),
			}),
			name: "clock",
			services: Layer.empty,
		} satisfies AppModule,
		{
			group: ReportApi,
			handlers: ReportApi.application.toLayer({
				"report.day": ({ account, instant }) => Effect.flatMap(AccountClock, (clock) => clock.logicalDay(account, instant)).pipe(Effect.orDie),
			}),
			name: "report",
			services: Layer.empty,
		} satisfies AppModule,
	]);
	yield* migratePostgres({ loader: modules.migrations.loader, lockTimeout: "5 seconds" });
	const mounted = yield* betterAuthMount({ options }, { accountPreferences: true }).pipe(
		Effect.provide(memoryStore),
		Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
	);
	const sessions = Layer.succeed(SessionPolicy, { ...mounted.sessions, origin: () => true });
	const services = yield* Layer.build(
		appHost({
			config: { disablePreemptiveShutdown: true, port: 0 },
			group: modules.group,
			handlers: modules.handlers,
			routes: mounted.routes,
			services: modules.services,
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
		background: <A, E>(program: Effect.Effect<A, E, typeof AccountClock.Identifier>) => Effect.provideContext(program, services),
		client: (headers: Headers) =>
			RpcClient.make(Api).pipe(
				Effect.provide(
					RpcClient.layerProtocolHttp({
						transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders(Object.fromEntries(headers))),
						url: `${url}/rpc`,
					}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
				),
			),
		fetch: (input: string | URL | Request, init?: RequestInit) => {
			const request = new Request(input, init);
			const target = new URL(request.url);
			return fetch(new Request(`${url}${target.pathname}${target.search}`, request));
		},
	};
});

export type PreferencesHost = Effect.Success<ReturnType<typeof preferencesHost>>;
