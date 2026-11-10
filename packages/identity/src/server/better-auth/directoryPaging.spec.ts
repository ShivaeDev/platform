import { DateTime, Option } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	directoryAccounts,
	mappedUserDirectory,
	pluginMappedUserDirectory,
	undeclaredAccount,
	userDirectory,
} from "#test/better-auth/userDirectory.ts";

for (const [kit, mapping] of [
	[userDirectory, "default"],
	[mappedUserDirectory, "custom"],
	[pluginMappedUserDirectory, "plugin"],
] as const) {
	kit.it(`pages through users with ${mapping} auth mappings`, [directoryAccounts], function* ({ list }) {
		const first = yield* list({ limit: 2 });
		expect(first.users.map(({ id }) => id)).toEqual(["alice", "bob"]);
		expect(first.next).toEqual(Option.some("bob"));
		expect(first.users[0]).toMatchObject({ email: "alice@directory.test", name: "Alice", role: "assigner" });
		expect(first.users.map(({ createdAt }) => DateTime.formatIso(createdAt))).toEqual(["2026-01-02T03:04:05.000Z", "2026-01-02T03:04:05.000Z"]);

		const second = yield* list({ cursor: Option.getOrThrow(first.next), limit: 2 });

		expect(second.users.map(({ id }) => id)).toEqual(["carol"]);
		expect(second.next).toEqual(Option.none());
	});

	kit.it(`names requested accounts with ${mapping} auth mappings`, [directoryAccounts], function* ({ names }) {
		yield* outcomes([
			[
				"requested accounts",
				() => names(["carol", "alice", "alice", "absent"]),
				[
					{ id: "alice", name: "Alice" },
					{ id: "carol", name: "Carol" },
				],
			],
			["no requested accounts", () => names([]), []],
		]);
	});
}

userDirectory.it("an empty page and an exact final page have no continuation", [directoryAccounts], function* ({ list }) {
	yield* outcomes([
		["page beyond the final user", () => list({ cursor: "carol", limit: 2 }), { next: Option.none(), users: [] }],
		["exact final page", () => list({ limit: 3 }), { next: Option.none() }],
	]);
});

userDirectory.it("a missing user's role has a typed failure", [], function* ({ role }) {
	expect(yield* role("absent")).toBe("user not found");
});

userDirectory.it("undeclared stored roles fail visibly on reads", [undeclaredAccount], function* ({ tryList, role }) {
	yield* outcomes([
		["user list", () => tryList({ limit: 10 }), "auth unavailable"],
		["stored role", () => role("bob"), "auth unavailable"],
	]);
});
