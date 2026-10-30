import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeFeed, feedListens, hasTable, watching } from "#test/changeFeed.ts";

const WIDE_KEYS = Array.from({ length: 6 }, (_, index) => `${index}:${"é".repeat(1000)}`);

changeFeed.it(
	"keys too wide for one NOTIFY payload are split into payloads under its 8000-byte limit and all reach subscribers",
	[feedListens(), watching(...WIDE_KEYS)],
	function* ({ announce, announced, inTransaction, published }) {
		yield* inTransaction(function* () {
			yield* announce(WIDE_KEYS);
		});

		yield* outcomes({
			"announced keys": [announced(), WIDE_KEYS],
			"published payloads": [published(), [WIDE_KEYS.slice(0, 3), WIDE_KEYS.slice(3)]],
		});
	},
);

const REFUSED_KEYS = [
	{
		failure: "A PostgreSQL invalidation key exceeds the NOTIFY payload limit",
		keys: ["orders", "é".repeat(4000)],
		name: "a key wider than one NOTIFY payload",
	},
	{
		failure: "PostgreSQL invalidation keys must be strings or finite numbers",
		keys: [{ id: 1 }],
		name: "a key that is neither a string nor a finite number",
	},
];

for (const { failure, keys, name } of REFUSED_KEYS) {
	changeFeed.it(
		`${name} fails its transaction through onSqlError and rolls back its write`,
		[feedListens(), hasTable("rows")],
		function* ({ announce, endings, insertRowWithRawSql, inTransaction, published, storedRows }) {
			yield* inTransaction(function* () {
				yield* insertRowWithRawSql(1);
				yield* announce(keys);
			});

			yield* outcomes({
				"published payloads": [published(), []],
				"stored rows": [storedRows(), []],
				"transaction endings": [endings(), [`failed with storage unavailable after ${failure}`]],
			});
		},
	);
}

changeFeed.it(
	"a COMMIT that fails its deferred foreign key publishes none of its keys",
	[feedListens(), hasTable("rows")],
	function* ({ announce, endings, insertRowWithRawSql, inTransaction, published, storedRows }) {
		yield* inTransaction(function* () {
			yield* insertRowWithRawSql(4, 99);
			yield* announce(["rows:4"]);
		});

		yield* outcomes({
			"published payloads": [published(), []],
			"stored rows": [storedRows(), []],
			"transaction endings": [endings(), ["failed with storage unavailable after a constraint violation (SQLSTATE 23503)"]],
		});
	},
);

changeFeed.it(
	"a transaction on another client announces its keys in this process at once and publishes nothing through NOTIFY",
	[feedListens(), watching("other:1")],
	function* ({ announce, announced, inOtherTransaction, published }) {
		yield* inOtherTransaction(function* () {
			yield* announce(["other:1"]);
		});

		yield* outcomes({
			"announced keys": [announced(), ["other:1"]],
			"published payloads": [published(), []],
		});
	},
);

changeFeed.it(
	"a key announced outside any transaction reaches this process's subscribers and is not published through NOTIFY",
	[feedListens(), watching("orders")],
	function* ({ announce, announced, published }) {
		yield* announce(["orders"]);

		yield* outcomes({
			"announced keys": [announced(), ["orders"]],
			"published payloads": [published(), []],
		});
	},
);
