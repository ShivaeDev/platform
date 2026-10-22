import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { daemonClient } from "#test/daemonClient.ts";
import { task, withHost } from "#test/fleetHost.ts";
import { hostDatabase } from "#test/hostDatabase.ts";
import { legacyStore } from "#test/legacyStore.ts";
import { MAIN } from "#test/mainSource.ts";
import { migrateFleet } from "#test/migrateFleet.ts";
import { migrationRecords } from "#test/migrationRecords.ts";
import { postgresTests } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";
import { withReadDaemon } from "#test/readDaemon.ts";

const test = postgresTests("live");

test("daemon startup migrates populated JSONB records and continues serving reads and writes", () =>
	withHost({ "three.md": task("three", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			const values = migrationRecords();
			yield* Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* legacyStore(fixture.host.namespace);
				yield* migrateFleet(fixture.host.namespace, "attention_owner");
				for (const value of values) {
					yield* sql`insert into ${sql(`${fixture.host.namespace}_records`)} (work_id, version, payload) values (${value.workId}, 7, ${JSON.stringify(value)}::jsonb)`;
				}
			}).pipe(Effect.provide(hostDatabase(fixture.host, "work-fleet-migration", 1)));
			yield* withReadDaemon(
				fixture.host,
				(port) =>
					Effect.gen(function* () {
						const client = yield* daemonClient(`http://127.0.0.1:${port}`);
						for (const value of values) {
							expect(yield* client("fleet.get", { workId: value.workId })).toEqual(value);
						}
						const created = yield* client("fleet.prepare", {
							cwd: "/synthetic-repository",
							preparation: prepared({ baseRevision: MAIN.revision, observedAt: MAIN.observedAt }),
							prompt: "New work after migration",
							workId: "three",
						});
						expect(created.step).toBe("queued");
						const dispatched = yield* client("fleet.dispatch", { workId: "three" });
						expect(dispatched.decision?.reason).toBeUndefined();
						expect(dispatched.step).toBe("working");
						expect((yield* client("fleet.get", { workId: "three" })).attempts).toHaveLength(1);
					}),
				{ parts: fixture.parts },
			);
		}),
	));
