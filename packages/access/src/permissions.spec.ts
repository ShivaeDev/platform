import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { accessStory, readerDeclaredTwice, signedIn } from "#test/accessStory.ts";
import { AssignRoles } from "#test/policy.ts";

for (const [role, grants, withheld] of [
	["reader", ["users.read", "jobs.read"], "users.read.any, roles.assign or jobs.read.details"],
	["manager", ["users.read", "users.read.any", "roles.assign"], "jobs.read or jobs.read.details"],
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

accessStory.it(
	"alice as a reader, in a role set that repeats reader under a name the compiler cannot check, is shown, allowed and resolved to the first declaration's grants alone",
	[readerDeclaredTwice(), signedIn("reader")],
	function* ({ allowedGrants, resolvedGrants, shownGrants }) {
		yield* outcomes({
			"grants enforcement allows": [allowedGrants(), ["users.read", "jobs.read"]],
			"grants the check shows": [shownGrants(), ["users.read", "jobs.read"]],
			"grants the stored role resolves to": [resolvedGrants(), ["users.read", "jobs.read"]],
		});
	},
);
