import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { refusal } from "#test/refusal.ts";
import { isolatedStorage } from "#test/storageStory.ts";
import { legacyTypedMigrationRecords, typedMigrationRecords } from "#test/typedMigrationRecords.ts";

const VALUES = typedMigrationRecords();
const EXPECTED = VALUES.map((value, index) => ({ value, version: index + 6 }));
const [POPULATED_RECORD] = typedMigrationRecords();
const POPULATED = { value: POPULATED_RECORD, version: 6 };

isolatedStorage.it(
	"the typed migration keeps every current and archived field, empty and absent structure, admission order, version and foreign reservation",
	[],
	function* ({ admissionOrder, migrate, openFleetStore, reserveForeignRow, seedTextRecords }) {
		const namespace = "typed_upgrade";
		yield* seedTextRecords(namespace, legacyTypedMigrationRecords());
		yield* reserveForeignRow(namespace, "external");
		const before = yield* admissionOrder(namespace);
		const store = yield* openFleetStore({ namespace });

		yield* migrate(namespace);

		const index = { version: POPULATED.version, workId: "populated" };
		yield* outcomes([
			["listed records", () => store.list(), EXPECTED],
			["loaded records", () => Effect.forEach(EXPECTED, ({ value }) => store.load(value.workId)), EXPECTED],
			["admission order", () => admissionOrder(namespace), before],
			["foreign reservations", () => store.foreignReservations(), [{ areas: [], backlog: true, executing: false, owner: "external" }]],
			["operation index", () => store.operationEntries("operation"), [index, index, index]],
		]);
	},
);

isolatedStorage.it(
	"saving a typed record without attempts or history replaces its children and clears its operation index",
	[],
	function* ({ migrate, openFleetStore, seedTextRecords }) {
		const namespace = "typed_upgrade";
		yield* seedTextRecords(namespace, legacyTypedMigrationRecords());
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);

		const changed = yield* store.compareAndSet(POPULATED.value.workId, POPULATED.version, {
			...POPULATED.value,
			attempts: [],
			history: undefined,
			launch: {},
			pendingAnswers: undefined,
		});

		const reloaded = yield* store.load(POPULATED.value.workId);
		expect(reloaded).toEqual(changed);
		expect(yield* store.operationEntries("operation")).toEqual([]);
	},
);

isolatedStorage.it(
	"an invalid text field fails the typed migration and rolls back the whole upgrade",
	[],
	function* ({ appliedMigrations, childTableExists, migration, seedTextRecords, setTextField, storedRows }) {
		const namespace = "typed_retry";
		yield* seedTextRecords(namespace, VALUES);
		yield* setTextField(namespace, "empty", "integrationRetry", "{");
		const before = yield* storedRows(namespace);

		const outcome = yield* migration(namespace);

		expect(outcome).toBe("failed");
		yield* outcomes([
			["stored rows", () => storedRows(namespace), before],
			["typed migration in the ledger", () => appliedMigrations(namespace).pipe(Effect.map((applied) => applied.includes(12))), false],
			["attempts child table", () => childTableExists(namespace, ["attempts"]), false],
		]);
	},
);

isolatedStorage.it("a repaired text field migrates on retry", [], function* ({ migrate, migration, openFleetStore, seedTextRecords, setTextField }) {
	const namespace = "typed_retry";
	yield* seedTextRecords(namespace, VALUES);
	yield* setTextField(namespace, "empty", "integrationRetry", "{");
	expect(yield* migration(namespace)).toBe("failed");
	yield* setTextField(namespace, "empty", "integrationRetry", null);

	yield* migrate(namespace);

	expect((yield* (yield* openFleetStore({ namespace })).list()).map(({ value }) => value)).toEqual(
		VALUES.map((value) => (value.workId === "empty" ? { ...value, integrationRetry: undefined } : value)),
	);
});

isolatedStorage.it(
	"a failed child write rolls back the record's root fields, version and children together",
	[],
	function* ({ forbidChildOperation, migrate, openFleetStore }) {
		const namespace = "typed_atomic";
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		const saved = yield* store.insert(POPULATED.value);
		yield* forbidChildOperation(namespace, ["attempts"], "rejected");
		const rejected = { operationId: "rejected", role: "worker" as const, status: "completed" as const, submittedAt: 1 };

		const write = yield* refusal(
			store.compareAndSet(POPULATED.value.workId, saved.version, { ...saved.value, attempts: [rejected], prompt: "new prompt" }),
		);

		expect(write).toMatch(/^database failure/u);
		expect(yield* store.load(POPULATED.value.workId)).toEqual(saved);
	},
);
