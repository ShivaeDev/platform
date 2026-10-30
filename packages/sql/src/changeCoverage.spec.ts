import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { changeKeys } from "#test/changeKeys.ts";

const UNANNOUNCED = "failed with unannounced writes to the buckets table";

const uncovered = [
	{ declares: [], records: ["record 1"], title: "records its record key and declares nothing" },
	{ declares: ["record 1"], records: ["another:domain"], title: "declares its record key and records an unrelated key" },
	{
		declares: ["record 1", "list 1", "owner alice"],
		records: ["record 1"],
		title: "declares its record and buckets and records only the record key",
	},
] as const;

for (const { declares, records, title } of uncovered) {
	changeKeys.it(`coverage rolls back a raw write that ${title}`, [], function* ({ endings, record, storedRecords, underCoverage, writeRaw }) {
		yield* underCoverage(function* () {
			yield* writeRaw();
			yield* record(records);
		}, declares);

		yield* outcomes({
			"coverage endings": [endings(), [UNANNOUNCED]],
			"stored records": [storedRecords(), []],
		});
	});
}

const covered = [
	{ keys: ["record 1"], title: "declares and records its record key" },
	{ keys: ["record 1", "list 1", "owner alice"], title: "declares and records its record and bucket keys" },
] as const;

for (const { keys, title } of covered) {
	changeKeys.it(`coverage commits a raw write that ${title}`, [], function* ({ endings, record, storedRecords, underCoverage, writeRaw }) {
		yield* underCoverage(function* () {
			yield* writeRaw();
			yield* record(keys);
		}, keys);

		yield* outcomes({
			"coverage endings": [endings(), ["covered"]],
			"stored records": [storedRecords(), ["record 1 in list 1 for alice"]],
		});
	});
}

changeKeys.it(
	"coverage rolls back a raw write beside a repository write when the body records only the table",
	[],
	function* ({ endings, insertRecord, record, storedRecords, underCoverage, writeRaw }) {
		yield* underCoverage(function* () {
			yield* insertRecord(2, "bob");
			yield* writeRaw();
			yield* record(["the table"]);
		});

		yield* outcomes({
			"coverage endings": [endings(), [UNANNOUNCED]],
			"stored records": [storedRecords(), []],
		});
	},
);

changeKeys.it(
	"coverage commits a repository insert from the record and bucket keys the repository declares itself",
	[],
	function* ({ endings, insertRecord, publishedKeys, underCoverage }) {
		yield* underCoverage(function* () {
			yield* insertRecord(1, "alice");
		});

		yield* outcomes({
			"coverage endings": [endings(), ["covered"]],
			"published keys": [publishedKeys(), ["listId 1", 'owner "alice"', "record 1", "the table"]],
		});
	},
);
