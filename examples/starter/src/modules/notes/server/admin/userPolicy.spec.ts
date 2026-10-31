import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";
import { requestOutcome } from "#modules/notes/test-support/requestOutcome.ts";

adminHost.it("the last owner cannot be demoted", [adminAccount("owner", "owner")], function* ({ openAdmin }) {
	const client = yield* openAdmin("owner");
	const { users } = yield* client["admin.users.list"]({ limit: 20 });
	const owner = users[0];
	if (owner === undefined) {
		return yield* Effect.die(new Error("Owner was not listed"));
	}
	yield* outcomes([
		[
			"admin users change role",
			() => Effect.flip(client["admin.users.changeRole"]({ role: "admin", userId: owner.id })),
			expect.objectContaining({
				_tag: "LastRoleAssigner",
				userId: owner.id,
			}),
		],
		[
			"remaining owner role",
			() =>
				Effect.gen(function* () {
					return (yield* client["admin.users.list"]({ limit: 20 })).users[0]?.role;
				}),
			"owner",
		],
	]);
});

adminHost.it(
	"the app routes role writes through its guarded users contract",
	[adminAccount("owner", "owner"), adminAccount("operator", "admin")],
	function* ({ openAdmin, postAuthAdmin }) {
		const client = yield* openAdmin("owner");
		const { users } = yield* client["admin.users.list"]({ limit: 20 });
		const owner = users.find(({ name }) => name === "owner");
		if (owner === undefined) {
			return yield* Effect.die(new Error("Owner was not listed"));
		}
		for (const name of ["owner", "operator"]) {
			yield* outcomes([
				[
					"native create-user endpoint",
					() =>
						Effect.gen(function* () {
							return (yield* postAuthAdmin(name, "create-user", { email: "bypass@app.test", name: "Bypass", role: "owner" })).status;
						}),
					HttpStatus.fromLiteral("NotFound"),
				],
				[
					"native set-role endpoint",
					() =>
						Effect.gen(function* () {
							return (yield* postAuthAdmin(name, "set-role", { role: "user", userId: owner.id })).status;
						}),
					HttpStatus.fromLiteral("NotFound"),
				],
				[
					"native update-user endpoint",
					() =>
						Effect.gen(function* () {
							return (yield* postAuthAdmin(name, "update-user", { data: { role: "user" }, userId: owner.id })).status;
						}),
					HttpStatus.fromLiteral("NotFound"),
				],
			]);
		}
		expect((yield* client["admin.users.list"]({ limit: 20 })).users).toEqual(users);
	},
);

adminHost.it(
	"concurrent role changes leave one role assigner",
	[adminAccount("alice", "owner"), adminAccount("bob", "owner")],
	function* ({ openAdmin }) {
		const alice = yield* openAdmin("alice");
		const bob = yield* openAdmin("bob");
		const { users } = yield* alice["admin.users.list"]({ limit: 20 });
		const clients = { alice, bob };
		const changes = yield* Effect.all(
			users.map((user) => {
				const client = user.name === "alice" ? clients.alice : clients.bob;
				return requestOutcome(client["admin.users.changeRole"]({ role: "admin", userId: user.id }));
			}),
			{ concurrency: "unbounded" },
		);
		expect(changes.sort((left, right) => left.localeCompare(right))).toEqual(["allowed", "last owner"]);
	},
);
