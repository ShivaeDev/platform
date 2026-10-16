import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { PostgresTestDatabase } from "@shivaedev/effect-test-sql/database.ts";
import { authPost, credentials } from "#test-support/authHttp.ts";
import { deployChild, deployPort } from "#test-support/deployChild.ts";
import { effectMigration } from "#test-support/postgres.ts";

const runMigration = Effect.fn("Test.runMigration")(function* () {
	const database = yield* PostgresTestDatabase;
	const migration = yield* deployChild("migrate", database.url);
	expect(yield* migration.child.exitCode, [...migration.logs, ...migration.errors].join("\n")).toBe(0);
});

effectMigration("the secret-free migrate command applies the schema once and preserves its ledger and rows on rerun", function* () {
	yield* Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* runMigration();
		const ledger = sql`select migration_id, name, created_at from starter_migrations order by migration_id`;
		const applied = yield* ledger;
		expect(applied).toHaveLength(5);
		yield* sql`insert into starter_notes (title) values ('Keep this note')`;
		yield* runMigration();
		expect(yield* ledger).toEqual(applied);
		expect(yield* sql`select title from starter_notes`).toEqual([{ title: "Keep this note" }]);
		expect(yield* sql`select count(*)::int as count from "user"`).toEqual([{ count: 0 }]);
	}).pipe(Effect.provide(NodeServices.layer));
});

effectMigration("web and a secret-free worker refuse an unmigrated schema, then start after the migrate command", function* () {
	yield* Effect.gen(function* () {
		const database = yield* PostgresTestDatabase;
		const sql = yield* SqlClient.SqlClient;
		const port = yield* Effect.promise(deployPort);
		for (const kind of ["worker", "web"] as const) {
			const pending = yield* deployChild(kind, database.url, port);
			const premature = pending.ready.pipe(
				Effect.catch(() => Effect.never),
				Effect.andThen(Effect.fail(new Error(`${kind} started before migrations were applied`))),
			);
			expect(yield* Effect.raceFirst(pending.child.exitCode, premature)).not.toBe(0);
			expect([...pending.logs, ...pending.errors].join("\n")).toContain("Database migrations are not current");
			expect(pending.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([]);
		}
		expect(yield* sql`select to_regclass('starter_migrations') as ledger`).toEqual([{ ledger: null }]);
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		yield* runMigration();
		const worker = yield* deployChild("worker", database.url);
		const web = yield* deployChild("web", database.url, port);
		expect(yield* worker.ready).toBe("worker");
		const address = yield* web.ready;
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect((yield* Effect.promise(() => fetch(`${address}/health`))).status).toBe(200);
		expect(yield* authPost(address, "sign-up/email", credentials("deploy"))).toContain("session_token=");
		expect(worker.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([
			"EFFECT_LOG Worker migrations applied",
			"EFFECT_LOG Worker ready to take jobs",
		]);
		expect(yield* worker.child.isRunning).toBe(true);
		expect(yield* web.child.isRunning).toBe(true);
	}).pipe(Effect.provide(NodeServices.layer));
});

effectMigration("a failed migrate command exits nonzero without recording an applied migration", function* () {
	yield* Effect.gen(function* () {
		const database = yield* PostgresTestDatabase;
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table starter_notes (title text)`;
		const migration = yield* deployChild("migrate", database.url);
		expect(yield* migration.child.exitCode).not.toBe(0);
		expect(yield* sql`select to_regclass('starter_migrations') as ledger`).toEqual([{ ledger: null }]);
	}).pipe(Effect.provide(NodeServices.layer));
});
