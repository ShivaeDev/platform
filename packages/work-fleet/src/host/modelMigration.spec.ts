import * as PgClient from "@effect/sql-pg/PgClient";
import { Effect, Redacted } from "effect";
import { HttpServer } from "effect/unstable/http";
import { SqlClient } from "effect/unstable/sql";
import { expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { migrateFleet } from "#storage/migrateFleet.ts";
import { daemonClient } from "#test/daemonClient.ts";
import { MAIN, task, withHost } from "#test/fleetHost.ts";
import { migrationRecords } from "#test/migrationRecords.ts";
import { prepared } from "#test/preparation.ts";
import { withReadDaemon } from "#test/readDaemon.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

const test = it.live.skipIf(storageDatabaseUrl === undefined);

test("daemon startup migrates populated JSONB records and continues serving reads and writes", () =>
	withHost({ "three.md": task("three", "approved") }, {}, (fixture) =>
		Effect.gen(function* () {
			const values = migrationRecords();
			yield* Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* migrateFleet(fixture.host.namespace, undefined, true);
				for (const value of values) {
					yield* sql`insert into ${sql(`${fixture.host.namespace}_records`)} (work_id, version, payload) values (${value.workId}, 7, ${JSON.stringify(value)}::jsonb)`;
				}
			}).pipe(Effect.provide(PgClient.layer({ url: Redacted.make(fixture.host.databaseUrl) })));
			yield* withReadDaemon(
				fixture.host,
				(port) =>
					Effect.gen(function* () {
						const client = yield* daemonClient(HttpServer.formatAddress({ _tag: "TcpAddress", hostname: "127.0.0.1", port }));
						for (const value of values) {
							expect(yield* client("fleet.get", { workId: value.workId })).toEqual(value);
						}
						const created = yield* client("fleet.prepare", {
							cwd: "/synthetic-repository",
							preparation: prepared({ baseRevision: MAIN.revision, observedAt: MAIN.observedAt }),
							prompt: "New work after migration",
							workId: "three",
						});
						expect(created.stage).toBe("prepared");
						const dispatched = yield* client("fleet.dispatch", { workId: "three" });
						expect(dispatched.decision?.reason).toBeUndefined();
						expect(dispatched.stage).toBe("executing");
						expect((yield* client("fleet.get", { workId: "three" })).attempts).toHaveLength(1);
					}),
				fixture.parts,
			);
		}),
	));
