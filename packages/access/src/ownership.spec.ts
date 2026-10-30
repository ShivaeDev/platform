import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { accessStory, signedIn, signedOut } from "#test/accessStory.ts";

for (const [title, role, owner, shown, enforced] of [
	["alice as a reader, holding users.read, is shown and allowed her own record", "reader", "alice", true, "allowed"],
	["alice as a reader, holding users.read, is not shown bob's record and is refused it as forbidden", "reader", "bob", false, "forbidden"],
	["alice as a manager, holding only users.read.any, is shown and allowed her own record", "manager", "alice", true, "allowed"],
	["alice as a manager, holding only users.read.any, is shown and allowed bob's record", "manager", "bob", true, "allowed"],
	["alice as a guest, owning her record but holding no grant, is not shown it and is refused it as forbidden", "guest", "alice", false, "forbidden"],
] as const) {
	accessStory.it(title, [signedIn(role)], function* ({ checkRead, enforceRead }) {
		yield* outcomes({
			"enforcement of reading": [enforceRead(owner), enforced],
			"the check for reading": [checkRead(owner), shown],
		});
	});
}

for (const user of [undefined, null]) {
	accessStory.it(`a signed-out caller passing ${String(user)} as the user is not shown alice's record`, [signedOut(user)], function* ({ checkRead }) {
		expect(yield* checkRead("alice")).toBe(false);
	});

	accessStory.it(
		`ownership enforcement answers a signed-out caller passing ${String(user)} as the user with unauthorized for alice's record`,
		[signedOut(user)],
		function* ({ enforceRead }) {
			expect(yield* enforceRead("alice")).toBe("unauthorized");
		},
	);
}
