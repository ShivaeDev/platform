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
