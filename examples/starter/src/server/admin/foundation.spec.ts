import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { foundationAccount, foundationAdmin } from "#test-support/admin/foundation.ts";

for (const role of ["admin", "owner"]) {
	foundationAdmin.it(`an ${role}'s default session may manage sessions`, [foundationAccount("operator", role)], function* ({ permissions }) {
		const granted = yield* permissions("operator");

		expect(granted).toContain("sessions.manage");
	});
}

foundationAdmin.it(
	"an admin reads the users and the job health of a fresh app",
	[foundationAccount("operator", "admin")],
	function* ({ jobHealth, users }) {
		const listed = yield* users("operator");

		yield* outcomes([
			["users", () => Effect.succeed(listed), ["operator@app.test"]],
			["job health", () => jobHealth("operator"), { active: 0, failed: 0 }],
		]);
	},
);

for (const [name, refused] of [
	["reader", "permission denied"],
	["visitor", "sign in required"],
] as const) {
	foundationAdmin.it(`the users page and job health answer ${name} with ${refused}`, [foundationAccount("reader")], function* ({ jobHealth, users }) {
		const listed = yield* users(name);

		yield* outcomes([
			["users", () => Effect.succeed(listed), refused],
			["job health", () => jobHealth(name), refused],
		]);
	});
}
