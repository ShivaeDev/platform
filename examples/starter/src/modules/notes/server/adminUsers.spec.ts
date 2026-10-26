import { DateTime, Effect, Option } from "effect";
import { expect } from "vitest";
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
		expect(users.users.find(({ name }) => name === "operator")).toMatchObject({ email: "operator@app.test", roles: ["admin"] });
		expect(users.users.every(({ createdAt }) => DateTime.toEpochMillis(createdAt) > 0)).toBe(true);
	},
);

adminHost.it(
	"an owner grants and revokes roles through the mounted users area",
	[adminAccount("owner", "admin,owner"), adminAccount("reader", "user")],
	function* ({ openAdmin, roleChangeLogs }) {
		const owner = yield* openAdmin("owner");
		const reader = yield* openAdmin("reader");
		const listed = yield* owner["admin.users.list"]({ limit: 20 });
		const target = listed.users.find(({ name }) => name === "reader");
		if (target === undefined) {
			throw new Error("Reader was not listed");
		}
		expect(listed.canChangeRoles).toBe(true);
		expect(yield* Effect.flip(owner["admin.users.changeRole"]({ grant: true, role: "admin", userId: "missing" }))).toMatchObject({
			_tag: "NotFound",
		});
		for (const role of ["admin", "owner"] as const) {
			yield* owner["admin.users.changeRole"]({ grant: true, role, userId: target.id });
			expect((yield* owner["admin.users.list"]({ limit: 20 })).users.find(({ id }) => id === target.id)?.roles).toContain(role);
			if (role === "admin") {
				expect((yield* reader["admin.users.list"]({ limit: 20 })).users).toContainEqual(expect.objectContaining({ id: target.id }));
			}
			yield* owner["admin.users.changeRole"]({ grant: false, role, userId: target.id });
			expect((yield* owner["admin.users.list"]({ limit: 20 })).users.find(({ id }) => id === target.id)?.roles).not.toContain(role);
		}
		expect(yield* Effect.flip(reader["admin.users.list"]({ limit: 20 }))).toMatchObject({ _tag: "Forbidden" });
		expect((yield* owner["admin.users.list"]({ limit: 20 })).users.find(({ id }) => id === target.id)?.roles).toEqual(["user"]);
		const actor = listed.users.find(({ name }) => name === "owner");
		expect(roleChangeLogs().map(({ annotations }) => [annotations.role, annotations.grant])).toEqual([
			["admin", true],
			["admin", false],
			["owner", true],
			["owner", false],
		]);
		expect(roleChangeLogs()[0]?.annotations).toMatchObject({
			actorId: actor?.id,
			changedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/u),
			grant: true,
			role: "admin",
			userId: target.id,
		});
	},
);

adminHost.it(
	"a non-owner admin cannot grant or revoke roles",
	[adminAccount("operator", "admin"), adminAccount("owner", "admin,owner")],
	function* ({ openAdmin }) {
		const client = yield* openAdmin("operator");
		const users = yield* client["admin.users.list"]({ limit: 20 });
		const owner = users.users.find(({ name }) => name === "owner");
		if (owner === undefined) {
			throw new Error("Owner was not listed");
		}
		for (const grant of [true, false]) {
			expect(yield* Effect.flip(client["admin.users.changeRole"]({ grant, role: "owner", userId: owner.id }))).toMatchObject({ _tag: "Forbidden" });
		}
		expect((yield* client["admin.users.list"]({ limit: 20 })).users).toEqual(users.users);
	},
);

adminHost.it("a non-admin cannot reach the users area", [adminAccount("reader"), adminAccount("owner", "owner")], function* ({ openAdmin }) {
	for (const name of ["reader", "owner", "visitor"]) {
		const client = yield* openAdmin(name);
		const tag = name === "visitor" ? "Unauthorized" : "Forbidden";
		expect(yield* Effect.flip(client["admin.users.list"]({ limit: 20 }))).toMatchObject({ _tag: tag });
		expect(yield* Effect.flip(client["admin.users.changeRole"]({ grant: true, role: "admin", userId: "missing" }))).toMatchObject({ _tag: tag });
	}
});
