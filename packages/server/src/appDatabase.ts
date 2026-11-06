import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Clock, Config, Context, Effect, Layer, Option, Redacted } from "effect";
import { Digest } from "effect/crypto";
import * as Reactivity from "effect/reactivity/Reactivity";
import type { Rpc } from "effect/rpc";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { LiveServer } from "@shivaedev/contract/live-server/service.ts";
import { isSensitiveKey } from "@shivaedev/errors/sensitive.ts";
import { coordinateWorkerRelease } from "@shivaedev/sql/coordinateWorkerRelease.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/sql/postgresChanges.ts";
import { type PostgresOptions, postgresLayer } from "@shivaedev/sql/postgresLayer.ts";
import { applyPostgresSettings, type PostgresSettings } from "@shivaedev/sql/postgresSettings.ts";
import { WorkerRelease } from "@shivaedev/sql/worker-release/service.ts";
import type { AppHostFactory } from "#AppHostFactory.ts";
import type { AppHostInput } from "#AppHostInput.ts";
import { deferredHost, migratedHost } from "#appDatabaseHttp.ts";
import { appHostHttp } from "#appHostHttp.ts";
import type { HostRouteRequirements } from "#hostOptions.ts";
import { hostPreflight } from "#hostPreflight.ts";
import { hostSensitiveKeys } from "#hostSensitiveKeys.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { prepareMigrations } from "#prepareMigrations.ts";

export interface AppDatabaseOptions<R = never, E = never> {
	readonly config?: DatabaseConfig;
	readonly migrations: MigrationOptions<R, E>;
	readonly postgresSettings: PostgresSettings;
}

export interface DatabaseConfig extends PostgresOptions {
	readonly changes?: Partial<Omit<PostgresChangesOptions, "client" | "listenerClient" | "connectionSetting" | "connectionTTL" | "resync">>;
	readonly clock?: Clock.Clock;
	readonly databaseUrl?: Redacted.Redacted<string>;
	readonly listenDatabaseUrl?: Redacted.Redacted<string>;
}

export function appDatabase<R, E = never>(options: AppDatabaseOptions<R, E>) {
	const config = {
		...options.config,
		"connectionTTL": options.config?.connectionTTL ?? "10 minutes",
		idleTimeout: options.config?.idleTimeout ?? "1 minute",
	} satisfies DatabaseConfig;
	const clock = Layer.succeed(Clock.Clock, config.clock ?? Clock.Clock.defaultValue());
	const pool = Layer.unwrap(
		Effect.map(options.config?.databaseUrl === undefined ? Config.Redacted("DATABASE_URL") : Effect.succeed(options.config.databaseUrl), (url) =>
			postgresLayer(url, config).pipe(Layer.provide(clock)),
		),
	);
	const live = liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer));
	const migrations = options.migrations;
	const worker =
		migrations.mode === "wait" && migrations.release !== undefined
			? Layer.effect(WorkerRelease, coordinateWorkerRelease(migrations.release, migrations.pollInterval, migrations.table)).pipe(Layer.provide(clock))
			: Layer.empty;
	const base = Layer.merge(pool, live);
	const changes = options.config?.changes;
	const connected = Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			yield* applyPostgresSettings(options.postgresSettings);
			const hints = yield* LiveServer;
			const url = options.config?.databaseUrl ?? (yield* Config.Redacted("DATABASE_URL"));
			const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(url)).pathname));
			const channel = changes?.channel ?? (yield* defaultChangesChannel(name));
			const listenUrl = options.config?.listenDatabaseUrl ?? Option.getOrUndefined(yield* Config.Redacted("LISTEN_DATABASE_URL").pipe(Config.option));
			const listenerClient =
				listenUrl === undefined
					? client
					: yield* Effect.map(
							Layer.build(postgresLayer(listenUrl, { ...config, maxConnections: 1, minConnections: 0 }).pipe(Layer.provide(clock))),
							(context) => Context.get(context, PgClient.PgClient),
						);
			let connectionSetting = options.config?.databaseUrl === undefined ? "DATABASE_URL" : "config.databaseUrl";
			if (listenUrl !== undefined) {
				connectionSetting = options.config?.listenDatabaseUrl === undefined ? "LISTEN_DATABASE_URL" : "config.listenDatabaseUrl";
			}
			return postgresChanges({
				...changes,
				channel,
				client,
				connectionSetting,
				"connectionTTL": config.connectionTTL,
				listenerClient,
				resync: hints.resync(),
			}).pipe(Layer.provide(clock));
		}),
	).pipe(Layer.provideMerge(base));
	const prepared = Layer.effectDiscard(prepareMigrations(migrations)).pipe(Layer.provideMerge(connected));
	return worker.pipe(Layer.provideMerge(prepared));
}

const defaultChangesChannel = Effect.fnUntraced(function* (name: string) {
	const digest = yield* Digest.Digest;
	const hash = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(name));
	return `changes_${hash.slice(0, 32)}`;
});

export const appHost: AppHostFactory = <
	TRpcs extends Rpc.Any = never,
	THandlers = never,
	THandlerError = never,
	THandlerRequirements = never,
	TServices = never,
	TServiceError = never,
	TServiceRequirements = never,
	TMigrations = never,
	TApplicationError = never,
	TApplicationRequirements = never,
	TPreflight = never,
	TPreflightError = never,
	TPreflightRequirements = never,
	TRouteError = never,
	TRouteRequirements = HostRouteRequirements,
	TMigrationError = never,
	TRequestServices = never,
	TRequestRequirements = never,
>(
	options: AppHostInput<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TMigrations,
		TApplicationError,
		TApplicationRequirements,
		TPreflight,
		TPreflightError,
		TPreflightRequirements,
		TRouteError,
		TRouteRequirements,
		TMigrationError,
		TRequestServices,
		TRequestRequirements
	>,
) => {
	const preflight = hostPreflight(options.preflight, "application" in options ? Effect.succeed(isSensitiveKey) : hostSensitiveKeys(options));
	if ("application" in options) {
		return deferredHost(options.application, appDatabase(options)).pipe(Layer.provideMerge(preflight), Layer.provide(NodeCrypto.layer));
	}
	return options.migrations === undefined
		? appHostHttp(options).pipe(Layer.provideMerge(preflight), Layer.provide(NodeCrypto.layer))
		: migratedHost({ ...options, migrations: options.migrations }, appDatabase({ ...options, migrations: options.migrations })).pipe(
				Layer.provideMerge(preflight),
				Layer.provide(NodeCrypto.layer),
			);
};
