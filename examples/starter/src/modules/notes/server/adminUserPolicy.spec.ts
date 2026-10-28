import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it("the last owner cannot be demoted", [adminAccount("owner", "owner")], function* ({ openAdmin }) {
	const client = yield* openAdmin("owner");
	const { users } = yield* client["admin.users.list"]({ limit: 20 });
	const owner = users[0];
	if (owner === undefined) {
		throw new Error("Owner was not listed");
	}
	expect(yield* Effect.flip(client["admin.users.changeRole"]({ role: "admin", userId: owner.id }))).toMatchObject({
		_tag: "LastRoleAssigner",
		userId: owner.id,
	});
	expect((yield* client["admin.users.list"]({ limit: 20 })).users[0]?.role).toBe("owner");
});

adminHost.it(
	"the app routes role writes through its guarded users contract",
	[adminAccount("owner", "owner"), adminAccount("operator", "admin")],
	function* ({ openAdmin, postAuthAdmin }) {
		const client = yield* openAdmin("owner");
		const { users } = yield* client["admin.users.list"]({ limit: 20 });
		const owner = users.find(({ name }) => name === "owner");
		if (owner === undefined) {
			throw new Error("Owner was not listed");
		}
		for (const name of ["owner", "operator"]) {
			expect((yield* postAuthAdmin(name, "set-role", { role: "user", userId: owner.id })).status).toBe(HttpStatus.fromLiteral("NotFound"));
			expect((yield* postAuthAdmin(name, "update-user", { data: { role: "user" }, userId: owner.id })).status).toBe(
				HttpStatus.fromLiteral("NotFound"),
			);
			expect((yield* postAuthAdmin(name, "create-user", { email: "bypass@app.test", name: "Bypass", role: "owner" })).status).toBe(
				HttpStatus.fromLiteral("NotFound"),
			);
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
		const outcomes = yield* Effect.all(
			users.map((user) => {
				const client = user.name === "alice" ? clients.alice : clients.bob;
				return Effect.result(client["admin.users.changeRole"]({ role: "admin", userId: user.id }));
			}),
			{ concurrency: "unbounded" },
		);
		expect(outcomes.map((outcome) => outcome._tag).sort((left, right) => left.localeCompare(right))).toEqual(["Failure", "Success"]);
		expect(outcomes.filter((outcome) => outcome._tag === "Failure").map((outcome) => outcome.failure)).toEqual([
			expect.objectContaining({ _tag: "LastRoleAssigner" }),
		]);
	},
);
