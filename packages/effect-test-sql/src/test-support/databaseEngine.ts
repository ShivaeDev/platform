import { Context, Effect, Exit, Layer, type Redacted, Result, Scope } from "effect";
import { SqlClient } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import type { PostgresTestDatabase, PostgresTestServices } from "#database.ts";
import { makePostgresTestLayer, type PostgresTestOptions } from "#postgres.ts";
import type { databasePressure } from "./databasePressure.ts";
import { setup } from "./postgres.ts";

type Services = PostgresTestServices | PostgresTestDatabase;

export class DatabaseEngine {
	readonly fixture = setup();
	options: PostgresTestOptions<unknown> = this.fixture.options;
	acquired: Result.Result<Context.Context<Services>, unknown> | undefined;
	template = "";
	idleClock = false;
	marker = `story_${crypto.randomUUID()}`;
	cloneNames: string[] = [];
	pressure: Effect.Success<ReturnType<typeof databasePressure>> | undefined;
	pressureCount = 0;

	readonly admin: SqlClient.SqlClient;
	readonly scope: Scope.Closeable;
	constructor(admin: SqlClient.SqlClient, scope: Scope.Closeable) {
		this.admin = admin;
		this.scope = scope;
	}

	get services() {
		if (this.acquired === undefined) {
			throw new Error("The database lease did not succeed.");
		}
		if (Result.isFailure(this.acquired)) {
			throw this.acquired.failure;
		}
		return this.acquired.success;
	}

	get sharedName() {
		return Context.get(this.services, SqlClient.SqlClient)<{ name: string }>`select current_database() as name`.pipe(
			Effect.map(([row]) => row?.name ?? ""),
		);
	}

	lease() {
		const engine = this;
		return Effect.gen(function* () {
			const fixtures = engine.options.fixtures;
			const recordTemplate = Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				const [row] = yield* sql<{ name: string }>`select current_database() as name`;
				engine.template = row?.name ?? "";
			});
			const options = {
				...engine.options,
				...(fixtures === undefined
					? {}
					: {
							fixtures: (url: Redacted.Redacted<string>) => Effect.andThen(recordTemplate, typeof fixtures === "function" ? fixtures(url) : fixtures),
						}),
			};
			const layer = makePostgresTestLayer(options);
			engine.acquired = yield* Layer.buildWithScope(engine.idleClock ? layer.pipe(Layer.provideMerge(TestClock.layer())) : layer, engine.scope).pipe(
				Effect.result,
			);
		});
	}

	run<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => effect.pipe(Effect.provideContext(this.services)));
	}

	close() {
		return Scope.close(this.scope, Exit.void);
	}
}

export const createDatabaseEngine = Effect.gen(function* () {
	const admin = yield* SqlClient.SqlClient;
	const scope = yield* Effect.acquireRelease(Scope.make(), (leaseScope) => Scope.close(leaseScope, Exit.void));
	return new DatabaseEngine(admin, scope);
});
