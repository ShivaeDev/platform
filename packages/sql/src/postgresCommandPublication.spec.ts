import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable, watching } from "#test/changeFeed.ts";

changeFeed.it(
	"command changes reach subscribers only after the outer PostgreSQL transaction commits",
	[feedListens(), hasTable("rows"), watching("orders:1")],
	function* ({ announced, insertRowWithRawSql, inTransaction, publishCommand, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1);
			yield* publishCommand(["orders:1"]);

			expect(yield* announced()).toEqual([]);
		});

		yield* outcomes([
			["announced keys", () => announced(), ["orders:1"]],
			["stored rows", () => storedRows(), [1]],
		]);
	},
);

changeFeed.it(
	"rolling back a PostgreSQL transaction silences its command changes and discards its write",
	[feedListens(), hasTable("rows"), watching("orders:1")],
	function* ({ announced, endings, insertRowWithRawSql, inTransaction, publishCommand, rejects, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1);
			yield* publishCommand(["orders:1"]);
			yield* rejects();
		});

		yield* outcomes([
			["announced keys", () => announced(), []],
			["stored rows", () => storedRows(), []],
			["transaction ending", () => endings(), ["failed with rejected"]],
		]);
	},
);

changeFeed.it(
	"the command port exposes a typed publication failure and recovery broadcasts Resync through PostgreSQL",
	[feedListens()],
	function* ({ publishCommand, recoverCommand, resyncBroadcasts }) {
		const publication = yield* publishCommand([{}]);
		expect(publication).toEqual({
			cause: expect.stringContaining("PostgreSQL invalidation keys must be strings or finite numbers"),
			outcome: "publication failed",
		});
		expect(yield* resyncBroadcasts()).toEqual([]);

		yield* recoverCommand();

		expect(yield* resyncBroadcasts()).toEqual(["Resync"]);
	},
);

const tab = { client: "tab-a", id: 1 };

changeFeed.it(
	"a command's sync token reaches the listening host after the command's keys",
	[feedListens(), watching("orders:1")],
	function* ({ announced, publishCommand }) {
		yield* publishCommand(["orders:1"], tab);

		expect(yield* announced()).toEqual(["orders:1", "sync token 1 of tab-a"]);
	},
);

changeFeed.it("a command that changes nothing still sends its sync token", [feedListens()], function* ({ announced, publishCommand }) {
	yield* publishCommand([], tab);

	expect(yield* announced()).toEqual(["sync token 1 of tab-a"]);
});

changeFeed.it(
	"inside an outer PostgreSQL transaction the sync token waits for the commit and follows its keys",
	[feedListens(), hasTable("rows"), watching("orders:1")],
	function* ({ announced, insertRowWithRawSql, inTransaction, publishCommand }) {
		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1);
			yield* publishCommand(["orders:1"], tab);

			expect(yield* announced()).toEqual([]);
		});

		expect(yield* announced()).toEqual(["orders:1", "sync token 1 of tab-a"]);
	},
);

changeFeed.it(
	"rolling back the outer PostgreSQL transaction sends no sync token",
	[feedListens(), hasTable("rows"), watching("orders:1")],
	function* ({ announced, insertRowWithRawSql, inTransaction, publishCommand, rejects }) {
		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(1);
			yield* publishCommand(["orders:1"], tab);
			yield* rejects();
		});

		expect(yield* announced()).toEqual([]);
	},
);

changeFeed.it("the listener ignores a sync payload that names no valid client or id", [feedListens()], function* ({ announced, anotherHostSends }) {
	yield* anotherHostSends('{"sync":{"client":"two words","id":1}}');
	yield* anotherHostSends('{"sync":{"client":"tab-a","id":0}}');
	yield* anotherHostSends('{"sync":{"client":"tab-b","id":2}}');

	expect(yield* announced()).toEqual(["sync token 2 of tab-b"]);
});
