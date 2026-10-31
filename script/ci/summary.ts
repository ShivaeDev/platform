import { appendFileSync, existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { NodeRuntime } from "@effect/platform-node";
import { Config, Console, Effect, Schema } from "effect";

const Consumer = Schema.Struct({ timings: Schema.Array(Schema.Struct({ durationMs: Schema.Number, name: Schema.String })) });
const Tests = Schema.Struct({
	testResults: Schema.Array(
		Schema.Struct({ durationMs: Schema.optional(Schema.Number), endTime: Schema.Number, name: Schema.String, startTime: Schema.Number }),
	),
});
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Union([Consumer, Tests])));
const program = Effect.gen(function* () {
	const path = process.argv[2];
	if (path !== undefined && existsSync(path)) {
		const report = decode(readFileSync(path, "utf8"));
		const timings =
			"timings" in report
				? report.timings
				: report.testResults.map((file) => ({ durationMs: file.durationMs ?? file.endTime - file.startTime, name: file.name }));
		const rows = [...timings]
			.sort((a, b) => b.durationMs - a.durationMs)
			.map((item) => `| ${item.name.replace(`${process.cwd()}/`, "")} | ${(item.durationMs / 1000).toFixed(2)} |`);
		const summary = ["| Work | Seconds |", "| --- | ---: |", ...rows, ""].join("\n");
		yield* Console.log(summary);
		const destination = yield* Config.String("GITHUB_STEP_SUMMARY").pipe(Config.withDefault(""));
		if (destination !== "") {
			appendFileSync(destination, summary);
		}
	}
});

NodeRuntime.runMain(program);
