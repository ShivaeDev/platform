import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { dataExports, mappedUserTable, registeredDomains, unregisteredSchema, unregisteredTable } from "#test/better-auth/dataExports.ts";

dataExports.it(
	"alice's export combines her notes and bookmarks without other users or unowned rows",
	[registeredDomains],
	function* ({ exportUser }) {
		const data = yield* exportUser("alice");

		expect({ bookmarks: data.bookmarks, notes: data.notes }).toEqual({
			bookmarks: [{ title: "alice's bookmarks" }],
			notes: [{ title: "alice's notes" }],
		});
	},
);

dataExports.it(
	"the account export includes alice's profile, account and session without credentials",
	[registeredDomains],
	function* ({ exportUser }) {
		const data = yield* exportUser("alice");

		yield* outcomes([
			["profile", () => Effect.succeed(data.account.users), [{ email: "alice@export.test", name: "alice" }]],
			["linked account", () => Effect.succeed(data.account.accounts), [{ accountId: "alice", providerId: "credential" }]],
			["session owner", () => Effect.succeed(data.account.sessions.map(({ userId }) => userId)), data.account.users.map(({ id }) => id)],
			[
				"credential fields",
				() => Effect.succeed(Object.keys(data.account.accounts[0] ?? {}).sort((left, right) => left.localeCompare(right))),
				["accountId", "createdAt", "id", "providerId", "updatedAt", "userId"],
			],
			[
				"session fields",
				() => Effect.succeed(Object.keys(data.account.sessions[0] ?? {}).sort((left, right) => left.localeCompare(right))),
				["createdAt", "expiresAt", "id", "ipAddress", "updatedAt", "userAgent", "userId"],
			],
		]);
	},
);

dataExports.it("charlie's export keeps registered domains with no owned rows", [registeredDomains], function* ({ exportUser }) {
	const data = yield* exportUser("charlie");

	expect({ bookmarks: data.bookmarks, notes: data.notes }).toEqual({ bookmarks: [], notes: [] });
});

dataExports.it("the coverage check accepts all registered user references", [registeredDomains], function* ({ check }) {
	const coverage = yield* check();

	expect(coverage).toBe("registered");
});

for (const [trait, table] of [
	[unregisteredTable, { schema: "public", table: "forgotten" }],
	[unregisteredSchema, { schema: "archive", table: "notes" }],
] as const) {
	dataExports.it(`the coverage check reports unregistered ${table.schema}.${table.table}`, [registeredDomains, trait], function* ({ check }) {
		const coverage = yield* check();

		expect(coverage).toEqual([table]);
	});
}

dataExports.it("an export refuses to omit an unregistered user-owned table", [registeredDomains, unregisteredTable], function* ({ requestExport }) {
	const missing = yield* requestExport("alice");

	expect(missing).toEqual([{ schema: "public", table: "forgotten" }]);
});

dataExports.it("a mapped user table retains alice's account and domain exports", [registeredDomains, mappedUserTable], function* ({ exportUser }) {
	const data = yield* exportUser("alice");

	expect(data).toMatchObject({
		account: { users: [{ email: "alice@export.test", name: "alice" }] },
		bookmarks: [{ title: "alice's bookmarks" }],
		notes: [{ title: "alice's notes" }],
	});
});
