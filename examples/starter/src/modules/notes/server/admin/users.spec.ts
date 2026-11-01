import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"an admin pages through the users one at a time and sees each account once",
	[adminAccount("reader"), adminAccount("operator", "admin")],
	function* ({ userPages }) {
		const pages = yield* userPages("operator", 1);

		expect(pages).toEqual({ emails: ["operator@app.test", "reader@app.test"], pages: 2 });
	},
);

adminHost.it(
	"an admin sees every account's role but may not change roles",
	[adminAccount("reader"), adminAccount("operator", "admin")],
	function* ({ users }) {
		const page = yield* users("operator");

		expect(page).toEqual({
			canChangeRoles: false,
			users: [
				{ email: "operator@app.test", role: "admin" },
				{ email: "reader@app.test", role: "user" },
			],
		});
	},
);

for (const role of ["admin", "owner"] as const) {
	adminHost.it(
		`after olivia makes reader an ${role}, reader's next request reaches the users page`,
		[adminAccount("olivia", "owner"), adminAccount("reader")],
		function* ({ changesRole, users }) {
			expect(yield* users("reader")).toBe("permission denied");

			const change = yield* changesRole("olivia", "reader", role);

			yield* outcomes([
				["olivia's change", () => Effect.succeed(change), "changed"],
				["reader's users page", () => users("reader"), { users: expect.arrayContaining([{ email: "reader@app.test", role }]) }],
			]);
		},
	);
}

adminHost.it(
	"after olivia makes the admin reader a user again, reader's next request is refused the users page",
	[adminAccount("olivia", "owner"), adminAccount("reader", "admin")],
	function* ({ changesRole, users }) {
		expect(yield* users("reader")).toMatchObject({ canChangeRoles: false });

		yield* changesRole("olivia", "reader", "user");

		expect(yield* users("reader")).toBe("permission denied");
	},
);

adminHost.it(
	"the app logs olivia's role change with who changed whom, the new role and when",
	[adminAccount("olivia", "owner"), adminAccount("reader")],
	function* ({ changesRole, recordedRoleChanges }) {
		expect(yield* recordedRoleChanges()).toEqual([]);

		yield* changesRole("olivia", "reader", "admin");

		expect(yield* recordedRoleChanges()).toEqual([{ by: "olivia", role: "admin", stamped: "with a time", user: "reader" }]);
	},
);

adminHost.it("olivia's role change for a deleted account answers not found", [adminAccount("olivia", "owner")], function* ({ changesRole }) {
	const change = yield* changesRole("olivia", "a deleted account", "admin");

	expect(change).toBe("not found");
});

adminHost.it(
	"an admin without the right to assign roles is refused olivia's demotion and she stays owner",
	[adminAccount("operator", "admin"), adminAccount("olivia", "owner")],
	function* ({ changesRole, users }) {
		const demotion = yield* changesRole("operator", "olivia", "user");

		yield* outcomes([
			["operator's change", () => Effect.succeed(demotion), "permission denied"],
			["users", () => users("olivia"), { users: expect.arrayContaining([{ email: "olivia@app.test", role: "owner" }]) }],
		]);
	},
);

const refusedReaders = [
	["reader", [adminAccount("reader")], "permission denied"],
	["visitor", [], "sign in required"],
] as const;

for (const [name, accounts, refused] of refusedReaders) {
	adminHost.it(`the users page and role changes answer ${name} with ${refused}`, accounts, function* ({ changesRole, users }) {
		const page = yield* users(name);

		yield* outcomes([
			["users page", () => Effect.succeed(page), refused],
			["role change", () => changesRole(name, "a deleted account", "admin"), refused],
		]);
	});
}
