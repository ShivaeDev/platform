import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ownedRowSaved, versions } from "#test/versions.ts";

const ownerB = { id: 1, ownerId: 2 };
const ownerA = { id: 1, ownerId: 1 };

versions.it("findById with another owner's key finds no such row", [ownedRowSaved(ownerB, "B's draft")], function* ({ ownedRow }) {
	expect(yield* ownedRow(ownerA)).toBe("no such row");
});

for (const write of ["update", "updateVoid", "delete"] as const) {
	versions.it(
		`${write} with another owner's key fails with a missing conflict and leaves that owner's row unchanged`,
		[ownedRowSaved(ownerB, "B's draft")],
		function* ({ deleteOwned, endings, ownedRow, renameOwned }) {
			yield* write === "delete" ? deleteOwned(ownerA, 0) : renameOwned(ownerA, 0, "A's edit", write);

			yield* outcomes({
				[`${write} ending`]: [endings(), ['failed with a missing version conflict for {"id":1,"ownerId":1} at version 0']],
				"owner B's row": [ownedRow(ownerB), { lockVersion: 0, name: "B's draft" }],
			});
		},
	);
}

versions.it(
	"update by the owning key from the current version saves the row at the next version",
	[ownedRowSaved(ownerB, "Draft")],
	function* ({ endings, ownedRow, renameOwned }) {
		yield* renameOwned(ownerB, 0, "Published");

		yield* outcomes({
			"stored row": [ownedRow(ownerB), { lockVersion: 1, name: "Published" }],
			"update ending": [endings(), ["saved at version 1"]],
		});
	},
);

for (const write of ["update", "updateVoid", "delete"] as const) {
	versions.it(
		`${write} by the owning key from a stale version fails with a stale conflict and keeps the newer row`,
		[ownedRowSaved(ownerB, "Draft", 1)],
		function* ({ deleteOwned, endings, ownedRow, renameOwned }) {
			yield* write === "delete" ? deleteOwned(ownerB, 0) : renameOwned(ownerB, 0, "Lost", write);

			yield* outcomes({
				[`${write} ending`]: [endings(), ['failed with a stale version conflict for {"id":1,"ownerId":2} at version 0']],
				"stored row": [ownedRow(ownerB), { lockVersion: 1, name: "Draft" }],
			});
		},
	);
}

versions.it("insertOrIgnore of a new composite key saves the row at version 0", [], function* ({ endings, insertOwnedOrIgnore, ownedRow }) {
	yield* insertOwnedOrIgnore(ownerB, "B's draft");

	yield* outcomes({
		"insertOrIgnore ending": [endings(), ["inserted at version 0"]],
		"stored row": [ownedRow(ownerB), { lockVersion: 0, name: "B's draft" }],
	});
});

for (const [key, name] of [
	[ownerA, "A's replacement"],
	[ownerB, "B's retry"],
] as const) {
	versions.it(
		`insertOrIgnore of ${name} on a taken id is ignored and leaves owner B's row unchanged`,
		[ownedRowSaved(ownerB, "B's draft")],
		function* ({ endings, insertOwnedOrIgnore, ownedRow }) {
			yield* insertOwnedOrIgnore(key, name);

			yield* outcomes({
				"insertOrIgnore ending": [endings(), ["ignored"]],
				"owner B's row": [ownedRow(ownerB), { lockVersion: 0, name: "B's draft" }],
			});
		},
	);
}

for (const [name, expected] of [
	["Active", "ignored"],
	["Draft", "inserted at version 0"],
] as const) {
	versions.it(
		`insertOrIgnore under a partial Active-per-owner target reports ${expected} for a second row named ${name}`,
		[ownedRowSaved(ownerB, "Active")],
		function* ({ endings, insertActiveOrIgnore, ownedRow }) {
			yield* insertActiveOrIgnore({ id: 2, ownerId: 2 }, name);

			yield* outcomes({
				"active row": [ownedRow(ownerB), { lockVersion: 0, name: "Active" }],
				"insertOrIgnore ending": [endings(), [expected]],
			});
		},
	);
}

versions.it(
	"update through a doubling version codec from the decoded version returns the decoded next version",
	[ownedRowSaved(ownerB, "Draft", 1)],
	function* ({ codedRow, endings, renameCoded }) {
		expect(yield* codedRow(ownerB)).toEqual({ lockVersion: 2, name: "Draft" });

		yield* renameCoded(ownerB, 2, "Published");

		yield* outcomes({
			"stored row": [codedRow(ownerB), { lockVersion: 4, name: "Published" }],
			"update ending": [endings(), ["saved at version 4"]],
		});
	},
);

versions.it(
	"delete through a doubling version codec at the decoded version removes the row",
	[ownedRowSaved(ownerB, "Draft", 1)],
	function* ({ codedRow, deleteCoded, endings }) {
		yield* deleteCoded(ownerB, 2);

		yield* outcomes({
			"delete ending": [endings(), ["succeeded"]],
			"stored row": [codedRow(ownerB), "no such row"],
		});
	},
);
