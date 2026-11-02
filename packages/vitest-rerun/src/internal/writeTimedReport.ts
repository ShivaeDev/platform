import { Effect, FileSystem, Schema } from "effect";
import { failWith } from "#error.ts";

const ExtraFields = Schema.Record(Schema.String, Schema.Unknown);
const TestResult = Schema.StructWithRest(
	Schema.Struct({ assertionResults: Schema.Array(Schema.Unknown), name: Schema.String, status: Schema.Literals(["failed", "passed"]) }),
	[ExtraFields],
);

export const writeTimedReport = Effect.fn("VitestRerun.writeTimedReport")(function* (path: string, durations: readonly number[]) {
	const fs = yield* FileSystem.FileSystem;
	const contents = yield* fs.readFileString(path);
	const Report = Schema.StructWithRest(
		Schema.Struct({ testResults: Schema.Array(TestResult).check(Schema.isBetweenLength(durations.length, durations.length)) }),
		[ExtraFields],
	);
	const decodeReport = Schema.decodeUnknownEffect(Schema.fromJsonString(Report));
	const report = yield* decodeReport(contents).pipe(Effect.mapError(failWith(`Could not decode timed report ${path}`)));
	const testResults = report.testResults.map((result, index) => ({ ...result, durationMs: durations[index] }));
	yield* fs.writeFileString(path, JSON.stringify({ ...report, testResults }));
});
