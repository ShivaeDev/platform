import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { authPost, credentials } from "#test-support/authHttp.ts";
import { deployment } from "#test-support/deployment.ts";

deployment.it("the secret-free migrate command applies the schema once and preserves its ledger and rows on rerun", [], function* ({ migrate }) {
	const sql = yield* SqlClient.SqlClient;
	expect(yield* migrate()).toBe(0);
	const ledger = sql`select migration_id, name, created_at from starter_migrations order by migration_id`;
	const applied = yield* ledger;
	expect(applied).toHaveLength(5);
	yield* sql`insert into starter_notes (title) values ('Keep this note')`;
	expect(yield* migrate()).toBe(0);
	expect(yield* ledger).toEqual(applied);
	expect(yield* sql`select title from starter_notes`).toEqual([{ title: "Keep this note" }]);
	expect(yield* sql`select count(*)::int as count from "user"`).toEqual([{ count: 0 }]);
});

deployment.it(
	"web and a secret-free worker refuse an unmigrated schema, then start after the migrate command",
	[],
	function* ({ migrate, startProcess, port: availablePort }) {
		const sql = yield* SqlClient.SqlClient;
		const port = yield* availablePort;
		for (const kind of ["worker", "web"] as const) {
			const pending = yield* startProcess(kind, port);
			const premature = pending.ready.pipe(
				Effect.catch(() => Effect.never),
				Effect.andThen(Effect.fail(new Error(`${kind} started before migrations were applied`))),
			);
			expect(yield* Effect.raceFirst(pending.child.exitCode, premature)).not.toBe(0);
			expect([...pending.logs, ...pending.errors].join("\n")).toContain("Database migrations are not current");
			expect([...pending.logs, ...pending.errors].join("\n")).not.toContain("Database schema mismatch");
			expect(pending.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([]);
		}
		expect(yield* sql`select to_regclass('starter_migrations') as ledger`).toEqual([{ ledger: null }]);
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		expect(yield* migrate()).toBe(0);
		const worker = yield* startProcess("worker");
		const web = yield* startProcess("web", port);
		expect(yield* worker.ready).toBe("worker");
		const address = yield* web.ready;
		expect((yield* Effect.promise(() => fetch(`${address}/health`))).status).toBe(200);
		expect(yield* authPost(address, "sign-up/email", credentials("deploy"))).toContain("session_token=");
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect(worker.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([
			"EFFECT_LOG Worker migrations applied",
			"EFFECT_LOG Worker ready to take jobs",
		]);
		expect(yield* worker.child.isRunning).toBe(true);
		expect(yield* web.child.isRunning).toBe(true);
	},
);

deployment.it("a failed migrate command exits nonzero without recording an applied migration", [], function* ({ migrate }) {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create table starter_notes (title text)`;
	expect(yield* migrate()).not.toBe(0);
	expect(yield* sql`select to_regclass('starter_migrations') as ledger`).toEqual([{ ledger: null }]);
});
