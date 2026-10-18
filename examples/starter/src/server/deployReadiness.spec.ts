import { Effect } from "effect";
import { expect } from "vitest";
import { conflictingNotesTable, deployment } from "#test-support/deployment.ts";

deployment.it(
	"applies migrations without an auth secret and preserves saved notes and the ledger on rerun",
	[],
	function* ({ migrate, migrationLedger, storeUnownedNote, storedNotes, storedAccounts }) {
		expect(yield* migrate()).toBe(0);
		const applied = yield* migrationLedger();
		yield* storeUnownedNote("Keep this note");
		expect(yield* migrate()).toBe(0);
		expect(yield* migrationLedger()).toEqual(applied);
		expect(yield* storedNotes()).toEqual([{ title: "Keep this note" }].map((note) => expect.objectContaining(note)));
		expect(yield* storedAccounts).toEqual([]);
	},
);

deployment.it(
	"web rejects a missing schema while an already-started worker waits for deployment migration",
	[],
	function* ({ migrate, startProcess, health, signUpAt, port: availablePort, migrationTable }) {
		const port = yield* availablePort;
		const prematureWeb = yield* startProcess("web", port);
		expect(yield* prematureWeb.child.exitCode).not.toBe(0);
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).toContain("Database migrations are not current");
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).not.toContain("Database schema mismatch");
		yield* Effect.promise(() => expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow());
		const worker = yield* startProcess("worker");
		yield* worker.waitingForSchema;
		expect(yield* worker.child.isRunning).toBe(true);
		expect(worker.logs).toEqual(["EFFECT_LOG Worker waiting for schema"]);
		expect(yield* migrationTable).toEqual([{ ledger: null }]);
		expect(yield* migrate()).toBe(0);
		expect(yield* worker.ready).toBe("worker");
		const web = yield* startProcess("web", port);
		const address = yield* web.ready;
		expect((yield* health(address)).status).toBe(200);
		const signup = yield* signUpAt(address, "deploy");
		expect(signup.status).toBe(200);
		expect(signup.cookie).toContain("session_token=");
		expect([...web.logs, ...web.errors].join("\n")).not.toContain("Database schema mismatch");
		expect(worker.logs.filter((line) => line.startsWith("EFFECT_LOG Worker"))).toEqual([
			"EFFECT_LOG Worker waiting for schema",
			"EFFECT_LOG Worker schema current",
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
