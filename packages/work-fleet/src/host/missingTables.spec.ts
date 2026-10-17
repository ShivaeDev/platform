import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { readWaitStates } from "#host/readWaitStates.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { withHost } from "#test/fleetHost.ts";
import { postgresTests } from "#test/postgres.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

for (const table of ["records", "dispatches"]) {
	test(`a running daemon reports unavailable after its ${table} table is dropped`, () =>
		withHost({}, {}, (fixture) =>
			withReadDaemon(
				fixture.host,
				(port) =>
					Effect.gen(function* () {
						const client = yield* daemonClient(`http://127.0.0.1:${port}`);
						expect(yield* client("daemon.status", {})).toEqual({
							active: [],
							completed: [],
							waiting: { automation: [], maintainer: [], orchestrator: [] },
						});
						expect(yield* client("daemon.dispatch-status", { workId: "one" })).toBeNull();
						const sql = yield* SqlClient.SqlClient;
						yield* sql`drop table ${sql(`${fixture.host.namespace}_${table}`)} cascade`;
						const status = yield* client("daemon.status", {}).pipe(Effect.flip);
						expect(status).toBeInstanceOf(ServiceUnavailable);
						if (table === "dispatches") {
							const dispatch = yield* client("daemon.dispatch-status", { workId: "one" }).pipe(Effect.flip);
							expect(dispatch).toBeInstanceOf(ServiceUnavailable);
						} else {
							const summary = yield* readWaitStates(fixture.host).pipe(Effect.flip);
							expect(summary._tag).toBe("SqlError");
						}
					}),
				fixture.parts,
			),
		));
}
