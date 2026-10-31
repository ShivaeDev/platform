import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { foundationAccount, foundationAdmin } from "#test-support/foundationAdmin.ts";

for (const role of ["admin", "owner"]) {
	foundationAdmin.it(`the default ${role} session grants session management`, [foundationAccount("operator", role)], function* ({ session }) {
		expect(yield* session("operator")).toMatchObject({
			user: { permissions: expect.arrayContaining([{ name: "sessions.manage", strength: "own" }]) },
		});
	});
}

foundationAdmin.it("the foundation serves Users and Jobs to an admin", [foundationAccount("operator", "admin")], function* ({ openAdmin }) {
	const client = yield* openAdmin("operator");

	const users = yield* client["admin.users.list"]({ limit: 20 });
	expect(users.users.map(({ email }) => email)).toEqual(["operator@app.test"]);
	expect(yield* client["admin.jobs.health"]()).toMatchObject({ activeTotal: 0, failedTotal: 0 });
});

for (const [name, refusal] of [
	["reader", "Forbidden"],
	["visitor", "Unauthorized"],
] as const) {
	foundationAdmin.it(`the foundation refuses ${name} on Users and Jobs`, [foundationAccount("reader")], function* ({ openAdmin }) {
		const client = yield* openAdmin(name);

		yield* outcomes([
			["Jobs", () => Effect.flip(client["admin.jobs.health"]()), expect.objectContaining({ _tag: refusal })],
			["Users", () => Effect.flip(client["admin.users.list"]({ limit: 20 })), expect.objectContaining({ _tag: refusal })],
		]);
	});
}
