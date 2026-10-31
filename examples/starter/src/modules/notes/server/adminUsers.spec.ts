import { DateTime, Effect, Option } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { adminAccount, adminHost } from "#modules/notes/test-support/admin/host.ts";

adminHost.it(
	"an admin sees app users and pages without losing users",
	[adminAccount("reader"), adminAccount("operator", "admin")],
	function* ({ openAdmin }) {
		const client = yield* openAdmin("operator");
		const first = yield* client["admin.users.list"]({ limit: 1 });
		const second = yield* client["admin.users.list"]({ cursor: Option.getOrThrow(first.next), limit: 1 });
		expect([...first.users, ...second.users].map(({ email }) => email).sort((left, right) => left.localeCompare(right))).toEqual([
			"operator@app.test",
			"reader@app.test",
		]);
		expect(second.next).toEqual(Option.none());
		expect(first.canChangeRoles).toBe(false);
		const users = yield* client["admin.users.list"]({ limit: 20 });
		expect(users.users.find(({ name }) => name === "operator")).toMatchObject({ email: "operator@app.test", role: "admin" });
		expect(users.users.every(({ createdAt }) => DateTime.toEpochMillis(createdAt) > 0)).toBe(true);
	},
);

adminHost.it(
	"a role assigner changes roles and the next request gains or loses access through the mounted users area",
	[adminAccount("owner", "owner"), adminAccount("reader", "user")],
	function* ({ openAdmin, roleChangeLogs }) {
		const owner = yield* openAdmin("owner");
		const reader = yield* openAdmin("reader");
		const listed = yield* owner["admin.users.list"]({ limit: 20 });
		const target = listed.users.find(({ name }) => name === "reader");
		if (target === undefined) {
			return yield* Effect.die(new Error("Reader was not listed"));
		}
		yield* outcomes({
			"owner can assign roles": [Effect.sync(() => listed.canChangeRoles), true],
			"role change rejection": [
				Effect.flip(owner["admin.users.changeRole"]({ role: "admin", userId: "missing" })),
				expect.objectContaining({
					_tag: "NotFound",
				}),
			],
			"user list rejection": [Effect.flip(reader["admin.users.list"]({ limit: 20 })), expect.objectContaining({ _tag: "Forbidden" })],
		});
		for (const role of ["admin", "owner"] as const) {
			yield* owner["admin.users.changeRole"]({ role, userId: target.id });
			expect((yield* reader["admin.users.list"]({ limit: 20 })).users).toContainEqual(expect.objectContaining({ id: target.id, role }));
			yield* owner["admin.users.changeRole"]({ role: "user", userId: target.id });
			expect(yield* Effect.flip(reader["admin.users.list"]({ limit: 20 }))).toMatchObject({ _tag: "Forbidden" });
		}
		expect((yield* owner["admin.users.list"]({ limit: 20 })).users.find(({ id }) => id === target.id)?.role).toBe("user");
		const actor = listed.users.find(({ name }) => name === "owner");
		expect(roleChangeLogs().map(({ annotations }) => annotations.role)).toEqual(["admin", "user", "owner", "user"]);
		expect(roleChangeLogs()[0]?.annotations).toMatchObject({
			actorId: actor?.id,
			changedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
			role: "admin",
			userId: target.id,
		});
	},
);

adminHost.it(
	"a reader without roles.assign cannot change roles",
	[adminAccount("operator", "admin"), adminAccount("owner", "owner")],
	function* ({ openAdmin }) {
		const client = yield* openAdmin("operator");
		const users = yield* client["admin.users.list"]({ limit: 20 });
		const owner = users.users.find(({ name }) => name === "owner");
		if (owner === undefined) {
			return yield* Effect.die(new Error("Owner was not listed"));
		}
		yield* outcomes({
			"role change rejection": [
				Effect.flip(client["admin.users.changeRole"]({ role: "user", userId: owner.id })),
				expect.objectContaining({ _tag: "Forbidden" }),
			],
			"unchanged users": [
				Effect.gen(function* () {
					return (yield* client["admin.users.list"]({ limit: 20 })).users;
				}),
				users.users,
			],
		});
	},
);

adminHost.it(
	"a user without the domain permissions cannot reach the users area",
	[adminAccount("reader"), adminAccount("reader-two")],
	function* ({ openAdmin }) {
		for (const name of ["reader", "reader-two", "visitor"]) {
			const client = yield* openAdmin(name);
			const tag = name === "visitor" ? "Unauthorized" : "Forbidden";
			yield* outcomes({
				"role change rejection": [
					Effect.flip(client["admin.users.changeRole"]({ role: "admin", userId: "missing" })),
					expect.objectContaining({ _tag: tag }),
				],
				"user list rejection": [Effect.flip(client["admin.users.list"]({ limit: 20 })), expect.objectContaining({ _tag: tag })],
			});
		}
	},
);
