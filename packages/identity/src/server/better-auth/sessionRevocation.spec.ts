import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sessionAdmin } from "#test/session-admin/story.ts";

sessionAdmin.it(
	"alice revokes bob's laptop session, refusing its next request while his phone keeps working",
	[],
	function* ({ request, revoke, revokeAnswer }) {
		yield* outcomes([
			["bob's laptop before", () => request("bobLaptop"), "bob"],
			["bob's phone before", () => request("bobPhone"), "bob"],
		]);

		yield* revoke("bobLaptop");

		yield* outcomes([
			["bob's laptop after", () => request("bobLaptop"), "failed with unauthorized"],
			["bob's phone after", () => request("bobPhone"), "bob"],
			["revocation", () => revokeAnswer(), "revoked"],
		]);
	},
);

sessionAdmin.it(
	"revoking bob's laptop ends its already open live subscription as unauthorized",
	[],
	function* ({ followProfile, revoke, subscriptionEnding }) {
		expect(yield* followProfile("bobLaptop")).toBe("following");

		yield* revoke("bobLaptop");

		expect(yield* subscriptionEnding()).toBe("failed with unauthorized");
	},
);

sessionAdmin.it("alice receives typed NotFound when revoking an unknown session", [], function* ({ revoke, revokeAnswer }) {
	yield* revoke("unknown");

	expect(yield* revokeAnswer()).toBe("failed with not found");
});

sessionAdmin.it("alice may revoke her own session and her next request is refused", [], function* ({ request, revoke }) {
	expect(yield* request("alice")).toBe("alice");

	yield* revoke("alice");

	expect(yield* request("alice")).toBe("failed with unauthorized");
});

for (const [actor, refusal] of [
	["bobPhone", "failed with forbidden"],
	["anonymous", "failed with unauthorized"],
] as const) {
	sessionAdmin.it(`${actor} is refused the sessions list with ${refusal}`, [], function* ({ list, listAnswer }) {
		yield* list({ limit: 10 }, actor);

		expect(yield* listAnswer()).toBe(refusal);
	});

	sessionAdmin.it(
		`${actor} is refused session revocation with ${refusal} and bob's laptop keeps working`,
		[],
		function* ({ request, revoke, revokeAnswer }) {
			yield* revoke("bobLaptop", actor);

			yield* outcomes([
				["bob's laptop", () => request("bobLaptop"), "bob"],
				["revocation", () => revokeAnswer(), refusal],
			]);
		},
	);
}
