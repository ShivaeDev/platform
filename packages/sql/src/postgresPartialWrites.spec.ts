import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { partialWrites, profileStored } from "#test/partialWrites.ts";

const original = {
	details: { amount: 7, routes: [{ routeKey: "home" }] },
	firstSeen: "2026-10-01T00:00:00.000Z",
	id: 1,
	name: "Draft",
	note: null,
	owner: "alice",
	updatedAt: "2026-10-02T00:00:00.000Z",
};
const aliceKeys = ["profiles", "profiles:1", '["bucket","profiles","owner","alice"]'] as const;

partialWrites.it(
	"a chosen-column update returns and stores the new name, keeps other columns, runs no select and publishes its change keys",
	[profileStored()],
	function* ({ profile, updateName, returned, publications, statementKinds }) {
		expect(yield* profile()).toEqual(original);

		yield* updateName();

		yield* outcomes([
			["returned profile", () => returned(), [{ ...original, name: "Published" }]],
			["stored profile", () => profile(), { ...original, name: "Published" }],
			["write statements", () => statementKinds(), ["update"]],
			["published keys", () => publications(), [aliceKeys]],
		]);
	},
);

partialWrites.it(
	"a chosen-column void update stores the new owner and publishes the record and both owner buckets without reading the row",
	[profileStored()],
	function* ({ profile, updateOwnerVoid, publications, statementKinds }) {
		yield* updateOwnerVoid();

		yield* outcomes([
			["stored profile", () => profile(), { ...original, owner: "bob" }],
			["write statements", () => statementKinds(), ["update"]],
			["published keys", () => publications(), [["profiles", "profiles:1", '["bucket","profiles","owner","bob"]', aliceKeys[2]]]],
		]);
	},
);

partialWrites.it(
	"a chosen-column update encodes every composite key component and publishes the composite record key without reading the row",
	[profileStored()],
	function* ({ profile, updateByOwner, publications, statementKinds }) {
		yield* updateByOwner();

		yield* outcomes([
			["stored profile", () => profile(), { ...original, name: "Composite" }],
			["write statements", () => statementKinds(), ["update"]],
			["published keys", () => publications(), [["profiles", 'profiles:["1","alice"]', aliceKeys[2]]]],
		]);
	},
);

partialWrites.it(
	"a read-back row with a native generated update date can be updated unchanged and publishes its keys",
	[profileStored()],
	function* ({ readProfile, updateReadBack, returned, profile, publications }) {
		const row = yield* readProfile();

		yield* updateReadBack(row);

		yield* outcomes([
			["returned profile", () => returned(), [original]],
			["stored profile", () => profile(), original],
			["published keys", () => publications(), [aliceKeys]],
		]);
	},
);

for (const exists of [false, true]) {
	partialWrites.it(
		`upsert ${exists ? "preserves the stored first-seen time on conflict" : "inserts the first-seen time for a new row"} and publishes its keys`,
		exists ? [profileStored()] : [],
		function* ({ upsertName, returned, profile, publications }) {
			yield* upsertName();

			const row = {
				...original,
				firstSeen: exists ? original.firstSeen : "2026-10-31T00:00:00.000Z",
				name: "Imported",
				updatedAt: exists ? original.updatedAt : "2026-10-31T00:00:00.000Z",
			};
			yield* outcomes([
				["returned profile", () => returned(), [{ inserted: !exists, row }]],
				["stored profile", () => profile(), row],
				["published keys", () => publications(), [aliceKeys]],
			]);
		},
	);
}

partialWrites.it(
	"a chosen-column update of a missing row fails with no such row, performs no select and publishes nothing",
	[],
	function* ({ updateName, endings, publications, statementKinds }) {
		yield* updateName(2);

		yield* outcomes([
			["write ending", () => endings(), ["failed with no such row"]],
			["write statements", () => statementKinds(), ["update"]],
			["published keys", () => publications(), []],
		]);
	},
);

partialWrites.it(
	"a rolled-back chosen-column update keeps the original row and publishes nothing",
	[profileStored()],
	function* ({ updateName, profile, publications, endings }) {
		yield* updateName(1, true);

		yield* outcomes([
			["write ending", () => endings(), ["failed with rejected"]],
			["stored profile", () => profile(), original],
			["published keys", () => publications(), []],
		]);
	},
);
