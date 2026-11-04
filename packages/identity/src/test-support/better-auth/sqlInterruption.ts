import { Deferred, Effect, Fiber, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { vi } from "vitest";
import { databaseUrl } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { observeUntil } from "@shivaedev/test-sql/server/observeUntil.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { type AuthCall, sqlInterruptHost } from "./sqlInterruptHost.ts";

const postgres = makePostgresTestLayer({
	maxConnections: 4,
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const authSql = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const sql = yield* SqlClient.SqlClient;
		const consoleOutput = yield* Effect.acquireRelease(
			Effect.sync(() =>
				(["debug", "error", "info", "log", "warn"] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined)),
			),
			(spies) =>
				Effect.sync(() => {
					for (const spy of spies) {
						spy.mockRestore();
					}
				}),
		);
		return {
			consoleOutput,
			headers: new Headers(),
			host: yield* sqlInterruptHost,
			pending: new Map<string, Fiber.Fiber<string, unknown>>(),
			sql,
		};
	},
	layer: postgres,
	name: "auth SQL interruption",
	runIf: databaseUrl !== undefined,
	stages: ["session", "lock"],
	verbs: (engine, story) => {
		const waiting = engine.sql<{ waiting: string }>`select wait_event_type as waiting from pg_stat_activity
			where datname = current_database() and state = 'active' and wait_event_type = 'Lock'`;
		return {
			call: (kind: AuthCall) => {
				story.tell(`alice completes a ${kind}`);
				return engine.host.call(kind, engine.headers);
			},
			consoleOutput: () => Effect.sync(() => engine.consoleOutput.flatMap((spy) => spy.mock.calls)),
			interrupt: (caller = "alice") => {
				story.tell(`${caller} interrupts the pending auth call`);
				const pending = engine.pending.get(caller);
				if (pending === undefined) {
					throw new Error(`${caller} has no pending call`);
				}
				return Fiber.interrupt(pending).pipe(Effect.asVoid);
			},
			pendingQueries: (count: number) => {
				story.tell(`PostgreSQL settles at ${count} auth queries waiting on the table lock`);
				return observeUntil(waiting, (rows) => rows.length === count, `${count} pending auth queries`, { clock: "test" }).pipe(
					Effect.map((rows) => rows.map((row) => row.waiting)),
				);
			},
			settled: () => engine.host.settled(),
			startCall: (kind: AuthCall, caller = "alice") =>
				Effect.gen(function* () {
					story.tell(`${caller} starts a ${kind}`);
					engine.pending.set(caller, yield* engine.host.call(kind, engine.headers).pipe(Effect.forkScoped));
				}),
		};
	},
});

export const aliceSignedIn = authSql.trait("session", "alice holds a minted session and linked GitHub account", function* (engine) {
	engine.headers = (yield* engine.host.mint()).headers;
});

export function lockedAuthTable(kind: AuthCall, table = kind === "provider-account lookup" ? "account" : "session") {
	return authSql.trait("lock", `another transaction locks the ${table} table`, function* (engine) {
		const ready = yield* Deferred.make<void>();
		yield* engine.sql
			.withTransaction(
				Effect.gen(function* () {
					yield* engine.sql`lock table ${engine.sql(table)} in access exclusive mode`;
					yield* Deferred.succeed(ready, undefined);
					yield* Effect.never;
				}),
			)
			.pipe(Effect.forkScoped);
		yield* Deferred.await(ready);
	});
}
