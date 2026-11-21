import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { ownedData } from "#test/better-auth/ownedData.ts";
import { exportedTables, forgottenTable, listEntries, mappedUserTable, memoTables, storedPreferences } from "#test/better-auth/ownedTables.ts";

ownedData.it(
	"alice's export holds her notes and bookmarks through each model's JSON variant, without bob's rows, the unowned bookmark or the notes' server-only share token",
	[exportedTables],
	function* ({ exportAccount }) {
		const data = yield* exportAccount("alice");

		yield* outcomes([
			[
				"owned rows",
				() => Effect.succeed(data.owned.map(({ rows, table }) => ({ rows, table }))),
				[
					{ rows: [{ title: "alice's bookmark" }], table: "bookmarks" },
					{ rows: [{ title: "alice's note" }], table: "notes" },
				],
			],
			[
				"note fields",
				() => Effect.succeed(Object.keys(new Object(data.owned[1]?.rows[0])).sort((left, right) => left.localeCompare(right))),
				["id", "title", "userId"],
			],
			["share token anywhere in the export", () => Effect.succeed(JSON.stringify(data).includes("share-token")), false],
		]);
	},
);

ownedData.it("alice's export includes her profile, account and session without credentials", [exportedTables], function* ({ exportAccount }) {
	const { account } = yield* exportAccount("alice");

	yield* outcomes([
		["profile", () => Effect.succeed(account.users), [{ email: "alice@export.test", name: "alice" }]],
		["linked account", () => Effect.succeed(account.accounts), [{ accountId: "alice", providerId: "credential" }]],
		["session owner", () => Effect.succeed(account.sessions.map(({ userId }) => userId)), account.users.map(({ id }) => id)],
		[
			"account fields",
			() => Effect.succeed(Object.keys(account.accounts[0] ?? {}).sort((left, right) => left.localeCompare(right))),
			["accountId", "createdAt", "id", "providerId", "updatedAt", "userId"],
		],
		[
			"session fields",
			() => Effect.succeed(Object.keys(account.sessions[0] ?? {}).sort((left, right) => left.localeCompare(right))),
			["createdAt", "expiresAt", "id", "ipAddress", "updatedAt", "userAgent", "userId"],
		],
	]);
});

ownedData.it("alice's export holds identity's record of her account preferences and not bob's", [storedPreferences], function* ({ exportAccount }) {
	const { owned } = yield* exportAccount("alice");

	expect(owned).toMatchObject([{ rows: [{ locale: "de-DE", timezone: "Europe/Berlin", units: "metric" }], table: "identity_account_preferences" }]);
});

ownedData.it("charlie's export keeps each owned table with no rows", [exportedTables], function* ({ exportAccount }) {
	const { owned } = yield* exportAccount("charlie");

	expect(owned).toEqual([
		{ rows: [], table: "bookmarks" },
		{ rows: [], table: "notes" },
	]);
});

ownedData.it(
	"an export refuses to leave out a table that refers to the user without an owned model",
	[exportedTables, forgottenTable],
	function* ({ requestExport }) {
		const uncovered = yield* requestExport("alice");

		expect(uncovered).toEqual([{ column: "owner_id", schema: "public", table: "forgotten" }]);
	},
);

ownedData.it(
	"with auth's users stored in members, alice's export keeps her profile and owned rows",
	[exportedTables, mappedUserTable],
	function* ({ exportAccount }) {
		const data = yield* exportAccount("alice");

		expect(data).toMatchObject({
			account: { users: [{ email: "alice@export.test", name: "alice" }] },
			owned: [{ rows: [{ title: "alice's bookmark" }] }, { rows: [{ title: "alice's note" }] }],
		});
	},
);

ownedData.it(
	"alice's grocery entry is encoded through its JSON variant: the generated id as a number, the creation time as an ISO string, the bucket list id and the missing note as null",
	[listEntries],
	function* ({ exportAccount }) {
		const { account, owned } = yield* exportAccount("alice");

		expect(owned).toEqual([
			{
				rows: [{ createdAt: "2026-11-04T12:00:00.000Z", id: 1, listId: "groceries", note: null, userId: account.users[0]?.id }],
				table: "entries",
			},
		]);
	},
);

ownedData.it("alice's export holds her memos from both tables whose repositories share one model", [memoTables], function* ({ exportAccount }) {
	const { owned } = yield* exportAccount("alice");

	expect(owned).toMatchObject([
		{ rows: [{ text: "alice's archived_memos" }], table: "archived_memos" },
		{ rows: [{ text: "alice's memos" }], table: "memos" },
	]);
});
