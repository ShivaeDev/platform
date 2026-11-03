import { type Context, Deferred, Effect, Exit, Fiber, Layer, Redacted, Scope } from "effect";
import { SqlClient } from "effect/sql";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { defaultClientFactory } from "#server/adapters/defaultClientFactory.ts";
import type { PgBossClient, PgBossClientFactory } from "#server/client.ts";
import type { PgBossClientOptionsError, PgBossError } from "#server/error.ts";
import type { PgBoss } from "#server/PgBoss.ts";
import { pgBossLayer } from "#server/service.ts";
import { makePgBossTesting } from "#server/testing.ts";
import { postgresConfigured, postgresLayer } from "#test/postgres/layer.ts";

interface Acquisition {
	readonly fiber: Fiber.Fiber<Context.Context<PgBoss>, PgBossError | PgBossClientOptionsError>;
	readonly scope: Scope.Closeable;
}

function holdStartup(client: PgBossClient, entered: Deferred.Deferred<void>, resume: Deferred.Deferred<void>): PgBossClient {
	const start = client.start.bind(client);
	return new Proxy(client, {
		get(target, property) {
			if (property === "start") {
				return async () => {
					await start();
					Deferred.doneUnsafe(entered, Effect.void);
					await Effect.runPromise(Deferred.await(resume));
					return client;
				};
			}
			const value: unknown = Reflect.get(target, property);
			return typeof value === "function" ? value.bind(target) : value;
		},
	});
}

export const scopedClient = storyKit({
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const { url } = yield* PostgresTestDatabase;
		const sql = yield* SqlClient.SqlClient;
		const owner = yield* Scope.Scope;
		const entered = yield* Deferred.make<void>();
		const resume = yield* Deferred.make<void>();
		return { acquisitions: new Map<string, Acquisition>(), entered, key: Symbol("scoped client"), owner, resume, sql, url };
	},
	inspect: ({ acquisitions }) => ({ acquisitions: [...acquisitions.keys()] }),
	layer: postgresLayer,
	name: "scoped jobs engine over PostgreSQL",
	runIf: postgresConfigured,
	stages: [],
	verbs: (engine, story) => {
		function acquisition(name: string) {
			const found = engine.acquisitions.get(name);
			if (found === undefined) {
				throw new Error(`${name} has not started acquiring a client`);
			}
			return found;
		}
		return {
			acquire: (name: string, options: { readonly client: "default" | "testing"; readonly pending?: true; readonly shared?: true }) =>
				Effect.gen(function* () {
					story.tell(`${name} acquires a ${options.client} jobs client${options.pending ? " whose startup response is held" : ""}`);
					const scope = yield* Scope.fork(engine.owner);
					const factory = options.client === "testing" ? makePgBossTesting().clientFactory : defaultClientFactory;
					const clientFactory: PgBossClientFactory = (settings) => {
						const client = factory(settings);
						return options.pending === true ? holdStartup(client, engine.entered, engine.resume) : client;
					};
					const url = new URL(Redacted.value(engine.url));
					url.searchParams.set("application_name", "scoped-client");
					const layer = pgBossLayer({
						clientCacheKey: options.shared === true ? engine.key : undefined,
						clientFactory,
						connectionString: Redacted.make(url.toString()),
						max: 1,
						schedule: false,
						supervise: false,
					});
					const fiber = yield* Effect.forkIn(Layer.buildWithScope(layer, scope), engine.owner, { startImmediately: true });
					engine.acquisitions.set(name, { fiber, scope });
					yield* Scope.addFinalizer(engine.owner, Deferred.succeed(engine.resume, undefined));
					if (options.pending === true) {
						yield* Deferred.await(engine.entered);
					}
				}),
			backends: () =>
				engine.sql`select pid from pg_stat_activity where datname = current_database() and application_name = 'scoped-client'`.pipe(
					Effect.map((rows) => rows.length),
				),
			close: (name: string) => {
				story.tell(`${name} closes its owning Scope`);
				return Scope.close(acquisition(name).scope, Exit.void);
			},
			interrupt: (name: string) => {
				story.tell(`${name} interrupts its pending acquisition`);
				return Fiber.interrupt(acquisition(name).fiber).pipe(Effect.timeout("5 seconds"));
			},
			resumeStartup: () => {
				story.tell("the held startup response arrives");
				return Deferred.succeed(engine.resume, undefined);
			},
			untilAcquired: (name: string) => Effect.asVoid(Fiber.join(acquisition(name).fiber)),
		};
	},
});
