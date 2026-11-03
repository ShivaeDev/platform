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
	function* ({ admissionOrder, columns, jsonbModel, migrate, namespace, openFleetStorage }) {
		yield* jsonbModel(namespace, VALUES);
		const before = yield* admissionOrder(namespace);
		const fleet = yield* openFleetStorage({ namespace });

		yield* migrate(namespace);

		yield* outcomes([
			["listed records", () => fleet.records(), EXPECTED],
			["loaded records", () => Effect.forEach(EXPECTED, ({ value }) => fleet.reload(value.workId)), EXPECTED],
			["foreign reservations", () => fleet.reservations(), [{ areas: [], backlog: true, executing: false, owner: "external" }]],
			["admission order", () => admissionOrder(namespace), before],
			["payload column", () => columns(`${namespace}_records`).pipe(Effect.map((found) => found.some(({ name }) => name === "payload"))), false],
		]);
	},
);

isolatedStorage.it(
	"an unchanged save after the model migration keeps the admission order",
	[],
	function* ({ admissionOrder, jsonbModel, migrate, namespace, openFleetStorage }) {
		yield* jsonbModel(namespace, VALUES);
		const fleet = yield* openFleetStorage({ namespace });
		yield* migrate(namespace);
		const before = yield* admissionOrder(namespace);

		yield* fleet.replace(FIRST.value.workId, FIRST.version, FIRST.value);

		expect(yield* admissionOrder(namespace)).toEqual(before);
	},
);

isolatedStorage.it(
	"a requeued save after the model migration moves the record to the back of the admission order past 2^53",
	[],
	function* ({ admissionOrder, jsonbModel, migrate, namespace, openFleetStorage }) {
		yield* jsonbModel(namespace, VALUES);
		let requeue = false;
		const fleet = yield* openFleetStorage({ namespace, requeue: () => requeue });
		yield* migrate(namespace);
		const unchanged = yield* fleet.replace(FIRST.value.workId, FIRST.version, FIRST.value);
		requeue = true;

		yield* fleet.replace(FIRST.value.workId, unchanged.version, { ...FIRST.value, areas: undefined, mergeReadyAt: undefined });

		yield* outcomes([
			[
				"admission order",
				() => admissionOrder(namespace),
				[expect.objectContaining({ "work_id": "two" }), { "admission_order": 9_007_199_254_740_995n, "work_id": FIRST.value.workId }],
			],
			["listed order", () => fleet.records().pipe(Effect.map((entries) => entries.map(({ value }) => value.workId))), ["two", "one"]],
			["saved areas", () => fleet.reload(FIRST.value.workId).pipe(Effect.map((entry) => entry?.value.areas)), undefined],
		]);
	},
);

isolatedStorage.it(
	"a write on a version from before the model migration's saves is a conflict",
	[],
	function* ({ jsonbModel, migrate, namespace, openFleetStorage }) {
		yield* jsonbModel(namespace, VALUES);
		const fleet = yield* openFleetStorage({ namespace });
		yield* migrate(namespace);
		yield* fleet.replace(FIRST.value.workId, FIRST.version, FIRST.value);

		const stale = yield* refusal(fleet.replace(FIRST.value.workId, FIRST.version, FIRST.value));

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
	function* ({ insertPayloads, migrate, migration, namespace, openFleetStorage, repairPayload, restoreLegacy }) {
		yield* restoreLegacy(namespace);
		yield* migrate(namespace, "attention_owner");
		yield* insertPayloads(namespace, [legacyVocabulary({ ...FIRST.value, mergeReadyAt: "invalid-number" })], () => 9);
		expect(yield* migration(namespace)).toBe("failed");
		yield* repairPayload(namespace, FIRST.value.workId, legacyVocabulary(FIRST.value));

		yield* migrate(namespace);

		expect(yield* (yield* openFleetStorage({ namespace })).reload(FIRST.value.workId)).toEqual({ value: FIRST.value, version: 9 });
	},
);
