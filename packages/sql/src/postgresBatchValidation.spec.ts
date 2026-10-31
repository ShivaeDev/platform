import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { batchReadings, type ReadingColumn } from "#test/batches.ts";
import { meterReadings } from "#test/batchModels.ts";

for (const [reason, updateColumns] of [
	["no columns", []],
	["the conflict column", ["source"]],
	["the id column", ["id"]],
	["a column the model lacks", ["missing"]],
	["a column the rows leave out", ["note"]],
] as const satisfies readonly (readonly [string, readonly ReadingColumn[]])[]) {
	batchReadings.it(
		`upsertMany that updates ${reason} fails with a schema error before any insert statement runs`,
		[],
		function* ({ endings, statementsRun, writeBatch }) {
			yield* writeBatch("upsertMany", meterReadings(2), updateColumns);

			yield* outcomes({
				"insert statements that ran": [statementsRun(), 0],
				"upsertMany ending": [endings(), ["failed with a schema error"]],
			});
		},
	);
}

batchReadings.it(
	"insertMany of a reading missing required fields fails with a schema error before any insert statement runs",
	[],
	function* ({ endings, statementsRun, writeRowMissingFields }) {
		yield* writeRowMissingFields();

		yield* outcomes({
			"insert statements that ran": [statementsRun(), 0],
			"insertMany ending": [endings(), ["failed with a schema error"]],
		});
	},
);
