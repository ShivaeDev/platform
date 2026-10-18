import { Effect } from "effect";
import { expect } from "vitest";
import { conflictingNotesTable, deployment } from "#test-support/deployment.ts";

deployment.it(
	"applies migrations without an auth secret and preserves saved notes and the ledger on rerun",
	[],
	function* ({ migrate, migrationLedger, storeUnownedNote, storedNotes, storedAccounts }) {
		expect(yield* migrate()).toBe(0);
		const applied = yield* migrationLedger();
		expect(applied).toHaveLength(5);
		yield* storeUnownedNote("Keep this note");
		expect(yield* migrate()).toBe(0);
		expect(yield* migrationLedger()).toEqual(applied);
		expect(yield* storedNotes()).toEqual([{ title: "Keep this note" }].map((note) => expect.objectContaining(note)));
		expect(yield* storedAccounts).toEqual([]);
	},
);

deployment.it(
	"refuses to serve accounts or jobs until deployment migration succeeds",
	[],
	function* ({ migrate, startProcess, signUpAt, port: availablePort, migrationTable }) {
		const port = yield* availablePort;
		for (const kind of ["worker", "web"] as const) {
			const pending = yield* startProcess(kind, port);
			const premature = pending.ready.pipe(
				Effect.catch(() => Effect.never),
				Effect.andThen(Effect.fail(new Error(`${kind} started before migrations were applied`))),
			);
			expect(yield* Effect.raceFirst(pending.child.exitCode, premature)).not.toBe(0);
			const output = [...pending.logs, ...pending.errors].join("\n");
			expect(output).toContain("Database migrations are not current");
			expect(output).not.toContain("Database schema mismatch");
			expect(pending.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([]);
		}
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		expect(yield* migrationTable).toEqual([{ ledger: null }]);
		expect(yield* migrate()).toBe(0);
		const worker = yield* startProcess("worker");
		const web = yield* startProcess("web", port);
		expect(yield* worker.ready).toBe("worker");
		const address = yield* web.ready;
		expect((yield* Effect.promise(() => fetch(`${address}/health`))).status).toBe(200);
		const signup = yield* signUpAt(address, "deploy");
		expect(signup.status).toBe(200);
		expect(signup.cookie).toContain("session_token=");
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect(worker.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([
			"EFFECT_LOG Worker migrations applied",
			"EFFECT_LOG Worker ready to take jobs",
		]);
		expect(yield* worker.child.isRunning).toBe(true);
		expect(yield* web.child.isRunning).toBe(true);
	},
);

deployment.it(
	"fails migration without recording success when an existing table conflicts",
	[conflictingNotesTable()],
	function* ({ migrate, migrationTable }) {
		expect(yield* migrate()).not.toBe(0);
		expect(yield* migrationTable).toEqual([{ ledger: null }]);
	},
);
