import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"olivia, the last owner, is refused her own demotion and stays owner",
	[adminAccount("olivia", "owner")],
	function* ({ changesRole, users }) {
		const demotion = yield* changesRole("olivia", "olivia", "admin");

		yield* outcomes([
			["olivia's demotion", () => Effect.succeed(demotion), "last owner"],
			["users", () => users("olivia"), { users: [{ email: "olivia@app.test", role: "owner" }] }],
		]);
	},
);

for (const [name, role] of [
	["olivia", "an owner"],
	["operator", "an admin"],
] as const) {
	adminHost.it(
		`Better Auth's own admin endpoints answer ${name}, ${role}, with Not Found and change no account`,
		[adminAccount("olivia", "owner"), adminAccount("operator", "admin")],
		function* ({ callsAuthAdmin, users }) {
			const created = yield* callsAuthAdmin(name, "create-user", "bypass");

			yield* outcomes([
				["create-user", () => Effect.succeed(created), HttpStatus.fromLiteral("NotFound")],
				["set-role", () => callsAuthAdmin(name, "set-role", "olivia"), HttpStatus.fromLiteral("NotFound")],
				["update-user", () => callsAuthAdmin(name, "update-user", "olivia"), HttpStatus.fromLiteral("NotFound")],
				[
					"users",
					() => users("olivia"),
					{
						users: [
							{ email: "olivia@app.test", role: "owner" },
							{ email: "operator@app.test", role: "admin" },
						],
					},
				],
			]);
		},
	);
}

adminHost.it(
	"when alice and bob, the only owners, demote themselves at once, one demotion is refused and one owner remains",
	[adminAccount("alice", "owner"), adminAccount("bob", "owner")],
	function* ({ changesRole, owners }) {
		const demotions = yield* Effect.all([changesRole("alice", "alice", "admin"), changesRole("bob", "bob", "admin")], { concurrency: "unbounded" });

		yield* outcomes([
			["demotions", () => Effect.succeed(demotions), expect.arrayContaining(["changed", "last owner"])],
			["owners", () => owners("alice"), "one owner"],
		]);
	},
);
