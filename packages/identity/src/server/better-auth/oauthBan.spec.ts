import { expect } from "vitest";
import { existingGrants, oauthGrants } from "#test/better-auth/oauthGrants.ts";

oauthGrants.it(
	"alice's temporary ban refuses her grant through expiry and admits it one millisecond later",
	[existingGrants],
	function* ({ ban, subject, timePasses }) {
		yield* ban("alice", true);

		expect(yield* subject("alice", "desktop")).toBe("refused");

		yield* timePasses(3_600_000);

		expect(yield* subject("alice", "desktop")).toBe("refused");

		yield* timePasses(1);

		expect(yield* subject("alice", "desktop")).toBe("alice");
	},
);

oauthGrants.it("alice's permanent ban still refuses her grant after time passes", [existingGrants], function* ({ ban, subject, timePasses }) {
	yield* ban("alice", false);

	yield* timePasses(86_400_000);

	expect(yield* subject("alice", "desktop")).toBe("refused");
});
