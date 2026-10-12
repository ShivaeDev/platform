import { createServer } from "node:http";
import { NodeHttpServer, NodeServices } from "@effect/platform-node";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Context, type Duration, Effect, Layer, type Redacted } from "effect";
import { HttpRouter, HttpServerRequest, HttpStaticServer } from "effect/unstable/http";
import * as Reactivity from "effect/unstable/reactivity/Reactivity";
import { type Rpc, type RpcGroup, RpcSerialization, RpcServer } from "effect/unstable/rpc";
import type { Migrator } from "effect/unstable/sql";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { migratePostgres } from "@shivaedev/effect-sql/migrations.ts";
import { type PostgresChangesOptions, postgresChanges } from "@shivaedev/effect-sql/postgresChanges.ts";
import type { Authenticated, MaybeAuthenticated, RequestTracing } from "#rpc/middleware.ts";
import { localRpcGuard } from "#rpc-server/local.ts";
import { authenticatedLayer, maybeAuthenticatedLayer, type SessionPolicy, type SessionShape } from "#rpc-server/session.ts";
import { requestTracingLayer } from "#rpc-server/tracing.ts";

export class AppChanges extends Context.Service<AppChanges, Effect.Success<typeof makeLiveServer>>()("@shivaedev/platform/AppChanges") {}

export interface AppDatabaseOptions<R = never> {
	readonly config?: {
		readonly databaseUrl?: Redacted.Redacted<string>;
		readonly applicationName?: string;
		readonly changes?: Omit<PostgresChangesOptions, "client" | "resync">;
	};
	readonly migrations: {
		readonly loader: Migrator.Loader<R>;
		readonly table?: string;
		readonly lockTimeout?: Duration.Input;
	};
}

export function appDatabase<R>(options: AppDatabaseOptions<R>) {
	const pool = Layer.unwrap(
		Effect.gen(function* () {
			const url = options.config?.databaseUrl ?? (yield* Config.redacted("DATABASE_URL"));
			return PgClient.layer({
				url,
				...(options.config?.applicationName === undefined ? {} : { applicationName: options.config.applicationName }),
			});
		}),
	);
	const migrated = Layer.effectDiscard(migratePostgres({ ...options.migrations, lockTimeout: options.migrations.lockTimeout ?? "5 seconds" })).pipe(
		Layer.provideMerge(pool),
	);
	const live = Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer));
	const base = Layer.merge(migrated, live);
	const changes = options.config?.changes;
	if (changes === undefined) {
		return base;
	}
	return Layer.unwrap(
		Effect.gen(function* () {
			const client = yield* PgClient.PgClient;
			const hints = yield* AppChanges;
			return postgresChanges({ ...changes, client, resync: hints.resync });
		}),
	).pipe(Layer.provideMerge(base));
}

export interface AppHostOptions<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
> extends AppDatabaseOptions<TMigrations> {
	readonly assets?: string;
	readonly config?: AppDatabaseOptions<TMigrations>["config"] & {
		readonly port?: number;
	};
	readonly group: RpcGroup.RpcGroup<TRpcs>;
	readonly handlers: Layer.Layer<THandlers, THandlerError, THandlerRequirements>;
	readonly services: Layer.Layer<TServices, TServiceError, TServiceRequirements>;
	readonly sessions: SessionPolicy<TSession>;
}

export function appHost<
	TRpcs extends Rpc.Any,
	THandlers,
	THandlerError,
	THandlerRequirements,
	TServices,
	TServiceError,
	TServiceRequirements,
	TMigrations,
	TSession extends SessionShape,
>(
	options: AppHostOptions<
		TRpcs,
		THandlers,
		THandlerError,
		THandlerRequirements,
		TServices,
		TServiceError,
		TServiceRequirements,
		TMigrations,
		TSession
	>,
) {
	// Named middleware types keep NodeNext declarations on the package aliases.
	const middleware: Layer.Layer<Authenticated | MaybeAuthenticated | RequestTracing> = Layer.mergeAll(
		authenticatedLayer(options.sessions),
		maybeAuthenticatedLayer(options.sessions),
		requestTracingLayer(),
	);
	const routes = HttpRouter.use((router) =>
		Effect.gen(function* () {
			const wire = yield* RpcSerialization.RpcSerialization;
			const handler = yield* RpcServer.toHttpEffect(options.group);
			yield* router.add("POST", "/rpc", (request) =>
				localRpcGuard(handler).pipe(
					Effect.provideService(HttpServerRequest.HttpServerRequest, request),
					Effect.provideService(RpcSerialization.RpcSerialization, wire),
				),
			);
		}),
	).pipe(Layer.provide(Layer.merge(options.handlers, middleware)), Layer.provide(RpcSerialization.layerNdjson));
	const assets = options.assets === undefined ? Layer.empty : HttpStaticServer.layer({ root: options.assets });
	const application = options.services.pipe(Layer.provideMerge(appDatabase(options)));
	const server = Layer.unwrap(
		Effect.gen(function* () {
			const port = options.config?.port ?? (yield* Config.int("PORT").pipe(Config.withDefault(3000)));
			return NodeHttpServer.layer(createServer, { host: "127.0.0.1", port });
		}),
	);
	return HttpRouter.serve(Layer.merge(routes, assets), { disableLogger: true }).pipe(
		Layer.provideMerge(application),
		Layer.provideMerge(server),
		Layer.provide(NodeServices.layer),
	);
}
