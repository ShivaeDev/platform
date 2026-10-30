import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeKeys } from "#test/changeKeys.ts";

changeKeys.it(
	"expectPublished matches a write whose committed keys it names and passes them on to the observer around it",
	[],
	function* ({ endings, expectingPublished, insertRecord, publishedKeys }) {
		yield* expectingPublished(["record 1", "the table", "list 1", "owner alice"], function* () {
			yield* insertRecord(1, "alice");
		});

		yield* outcomes({
			"expectation endings": [endings(), ["matched"]],
			"published keys": [publishedKeys(), ["listId 1", 'owner "alice"', "record 1", "the table"]],
		});
	},
);

changeKeys.it(
	"expectPublished matches no keys for a transaction that rolls back",
	[],
	function* ({ endings, expectingPublished, insertRecord, inTransaction, rejects, storedRecords }) {
		yield* expectingPublished([], function* () {
			yield* inTransaction(function* () {
				yield* insertRecord(1, "alice");
				yield* rejects();
			});
		});

		yield* outcomes({
			"endings, innermost first": [endings(), ["failed with rejected", "matched"]],
			"stored records": [storedRecords(), []],
		});
	},
);

changeKeys.it(
	"expectPublished fails naming the expected and the published keys when they differ, and the commit stands",
	[],
	function* ({ endings, expectingPublished, inTransaction, record, storedRecords, writeRaw }) {
		yield* expectingPublished(["activity:missing"], function* () {
			yield* inTransaction(function* () {
				yield* writeRaw();
				yield* record(["activity:recent"]);
			});
		});

		yield* outcomes({
			"endings, innermost first": [
				endings(),
				["committed", 'failed with Expected published keys ["activity:missing"]; actual published keys ["activity:recent"]'],
			],
			"stored records": [storedRecords(), ["record 1 in list 1 for alice"]],
		});
	},
);
