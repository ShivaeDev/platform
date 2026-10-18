import { expect } from "vitest";
import { conflictingNotesTable, deployment } from "#test-support/deployment.ts";

deployment.it(
	"applies migrations without an auth secret and preserves saved notes and the ledger on rerun",
	[],
	function* ({ migrate, migrationLedger, migrationLedgerIs, storeUnownedNote, storedNotes, noAccountsAreStored }) {
		expect(yield* migrate()).toBe(0);
		const applied = yield* migrationLedger();
		yield* storeUnownedNote("Keep this note");
		expect(yield* migrate()).toBe(0);
		yield* migrationLedgerIs(applied);
		expect(yield* storedNotes()).toEqual([expect.objectContaining({ title: "Keep this note" })]);
		yield* noAccountsAreStored;
	},
);

deployment.it(
	"web rejects a missing schema while an already-started worker waits for deployment migration",
	[],
	function* ({ migrate, startProcess, health, signUp, port: availablePort, migrationLedgerIsAbsent }) {
		const port = yield* availablePort;
		const prematureWeb = yield* startProcess("web", port);
		expect(yield* prematureWeb.child.exitCode).not.toBe(0);
		expect([...prematureWeb.logs, ...prematureWeb.errors].join("\n")).toContain("Database migrations are not current");
		const worker = yield* startProcess("worker");
		yield* worker.waitingForSchema;
		expect(yield* worker.child.isRunning).toBe(true);
		expect(worker.logs).toEqual(["EFFECT_LOG Worker waiting for schema"]);
		yield* migrationLedgerIsAbsent;
		expect(yield* migrate()).toBe(0);
		expect(yield* worker.ready).toBe("worker");
		const web = yield* startProcess("web", port);
		const address = yield* web.ready;
		expect((yield* health(address)).status).toBe(200);
		expect(yield* signUp(address)).toContain("session_token=");
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
	function* ({ migrate, migrationLedgerIsAbsent }) {
		expect(yield* migrate()).not.toBe(0);
		yield* migrationLedgerIsAbsent;
	},
);
