import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { accessStory, signedIn, signedOut } from "#test/accessStory.ts";
import { AssignRoles, ReadUsers } from "#test/policy.ts";

for (const [role, grants, withheld] of [
	["reader", ["users.read", "jobs.read"], "users.read.any, roles.assign or jobs.read.details"],
	["manager", ["users.read.any", "roles.assign"], "users.read, jobs.read or jobs.read.details"],
	["guest", [], "any grant"],
] as const) {
	accessStory.it(
		`alice as a ${role} is shown and allowed exactly ${grants.length === 0 ? "nothing" : grants.join(" and ")}, not ${withheld}`,
		[signedIn(role)],
		function* ({ allowedGrants, shownGrants }) {
			yield* outcomes({
				"grants enforcement allows": [allowedGrants(), grants],
				"grants the check shows": [shownGrants(), grants],
			});
		},
	);
}

accessStory.it("grant enforcement answers alice as a reader with forbidden for roles.assign", [signedIn("reader")], function* ({ enforceGrant }) {
	expect(yield* enforceGrant(AssignRoles)).toBe("forbidden");
});

for (const user of [undefined, null]) {
	accessStory.it(
		`grant enforcement answers a signed-out caller passing ${String(user)} as the user with unauthorized for users.read`,
		[signedOut(user)],
		function* ({ enforceGrant }) {
			expect(yield* enforceGrant(ReadUsers)).toBe("unauthorized");
		},
	);
}
