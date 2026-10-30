import { expect } from "vitest";
import { appRows, userReferences } from "#test/better-auth/userReferences.ts";

userReferences.it("deleting an auth user cascades to its referencing app rows", [appRows("cascade")], function* ({ deleteUser, storedAppRows }) {
	expect(yield* storedAppRows).toEqual([{ title: "Alice" }, { title: "Bob" }]);
	yield* deleteUser("Alice");
	expect(yield* storedAppRows).toEqual([{ title: "Bob" }]);
});

userReferences.it(
	"deleting an auth user may preserve app rows with a null user id",
	[appRows("set null")],
	function* ({ deleteUser, storedAppRows, storedUnownedRows }) {
		expect(yield* storedUnownedRows).toEqual([]);
		yield* deleteUser("Alice");
		expect(yield* storedAppRows).toEqual([{ title: "Alice" }, { title: "Bob" }]);
		expect(yield* storedUnownedRows).toEqual([{ title: "Alice" }]);
	},
);
