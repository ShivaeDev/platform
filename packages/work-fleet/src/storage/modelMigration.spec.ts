import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { legacyVocabulary } from "#test/legacyVocabulary.ts";
import { migrationRecords } from "#test/migrationRecords.ts";
import { refusal } from "#test/refusal.ts";
import { isolatedStorage } from "#test/storageStory.ts";

const VALUES = migrationRecords();
const EXPECTED = VALUES.map((value, index) => ({ value, version: index + 7 }));
const [FIRST_RECORD] = migrationRecords();
const FIRST = { value: FIRST_RECORD, version: 7 };

isolatedStorage.it(
	"the model migration keeps every JSONB record, version, admission order and foreign reservation and drops the payload column",
	[],
	function* ({ admissionOrder, columns, jsonbModel, migrate, namespace, openFleetStore }) {
		yield* jsonbModel(namespace, VALUES);
		const before = yield* admissionOrder(namespace);
		const store = yield* openFleetStore({ namespace });

		yield* migrate(namespace);

		yield* outcomes([
			["listed records", () => store.list(), EXPECTED],
			["loaded records", () => Effect.forEach(EXPECTED, ({ value }) => store.load(value.workId)), EXPECTED],
			["foreign reservations", () => store.foreignReservations(), [{ areas: [], backlog: true, executing: false, owner: "external" }]],
			["admission order", () => admissionOrder(namespace), before],
			["payload column", () => columns(`${namespace}_records`).pipe(Effect.map((found) => found.some(({ name }) => name === "payload"))), false],
		]);
	},
);

isolatedStorage.it(
	"an unchanged save after the model migration keeps the admission order",
	[],
	function* ({ admissionOrder, jsonbModel, migrate, namespace, openFleetStore }) {
		yield* jsonbModel(namespace, VALUES);
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		const before = yield* admissionOrder(namespace);

		yield* store.compareAndSet(FIRST.value.workId, FIRST.version, FIRST.value);

		expect(yield* admissionOrder(namespace)).toEqual(before);
	},
);

isolatedStorage.it(
	"a requeued save after the model migration moves the record to the back of the admission order past 2^53",
	[],
	function* ({ admissionOrder, jsonbModel, migrate, namespace, openFleetStore }) {
		yield* jsonbModel(namespace, VALUES);
		let requeue = false;
		const store = yield* openFleetStore({ namespace, requeue: () => requeue });
		yield* migrate(namespace);
		const unchanged = yield* store.compareAndSet(FIRST.value.workId, FIRST.version, FIRST.value);
		requeue = true;

		yield* store.compareAndSet(FIRST.value.workId, unchanged.version, { ...FIRST.value, areas: undefined, mergeReadyAt: undefined });

		yield* outcomes([
			[
				"admission order",
				() => admissionOrder(namespace),
				[expect.objectContaining({ "work_id": "two" }), { "admission_order": 9_007_199_254_740_995n, "work_id": FIRST.value.workId }],
			],
			["listed order", () => store.list().pipe(Effect.map((entries) => entries.map(({ value }) => value.workId))), ["two", "one"]],
			["saved areas", () => store.load(FIRST.value.workId).pipe(Effect.map((entry) => entry?.value.areas)), undefined],
		]);
	},
);

isolatedStorage.it(
	"a write on a version from before the model migration's saves is a conflict",
	[],
	function* ({ jsonbModel, migrate, namespace, openFleetStore }) {
		yield* jsonbModel(namespace, VALUES);
		const store = yield* openFleetStore({ namespace });
		yield* migrate(namespace);
		yield* store.compareAndSet(FIRST.value.workId, FIRST.version, FIRST.value);

		const stale = yield* refusal(store.compareAndSet(FIRST.value.workId, FIRST.version, FIRST.value));

		expect(stale).toBe(`storage conflict on one: expected ${FIRST.version}, found ${FIRST.version + 1}`);
	},
);

isolatedStorage.it(
	"a model migration that meets an invalid record fails and keeps its source row and ledger",
	[],
	function* ({ appliedMigrations, insertPayloads, migrate, migration, namespace, restoreLegacy, storedPayload }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		const invalid = legacyVocabulary({ ...FIRST.value, mergeReadyAt: "invalid-number" });
		yield* insertPayloads(namespace, [invalid], () => 9);

		const outcome = yield* migration(namespace);

		expect(outcome).toBe("failed");
		yield* outcomes([
			["source row", () => storedPayload(namespace, FIRST.value.workId), [{ payload: JSON.parse(JSON.stringify(invalid)), version: 9 }]],
			["model migration in the ledger", () => appliedMigrations(namespace).pipe(Effect.map((applied) => applied.includes(5))), false],
		]);
	},
);

isolatedStorage.it(
	"a repaired record migrates on retry",
	[],
	function* ({ insertPayloads, migrate, migration, namespace, openFleetStore, repairPayload, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* insertPayloads(namespace, [legacyVocabulary({ ...FIRST.value, mergeReadyAt: "invalid-number" })], () => 9);
		expect(yield* migration(namespace)).toBe("failed");
		yield* repairPayload(namespace, FIRST.value.workId, legacyVocabulary(FIRST.value));

		yield* migrate(namespace);

		expect(yield* (yield* openFleetStore({ namespace })).load(FIRST.value.workId)).toEqual({ value: FIRST.value, version: 9 });
	},
);
