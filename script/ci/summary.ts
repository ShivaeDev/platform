import { appendFileSync, existsSync, readFileSync } from "node:fs";
import process from "node:process";
import { Config, Console, Effect, Schema } from "effect";

const Consumer = Schema.Struct({ timings: Schema.Array(Schema.Struct({ durationMs: Schema.Number, name: Schema.String })) });
const Tests = Schema.Struct({ testResults: Schema.Array(Schema.Struct({ endTime: Schema.Number, name: Schema.String, startTime: Schema.Number })) });
const decode = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Union([Consumer, Tests])));
const path = process.argv[2];
if (path !== undefined && existsSync(path)) {
	const report = decode(readFileSync(path, "utf8"));
	const timings =
		"timings" in report ? report.timings : report.testResults.map((file) => ({ durationMs: file.endTime - file.startTime, name: file.name }));
	const rows = [...timings]
		.sort((a, b) => b.durationMs - a.durationMs)
		.map((item) => `| ${item.name.replace(`${process.cwd()}/`, "")} | ${(item.durationMs / 1000).toFixed(2)} |`);
	const summary = ["| Work | Seconds |", "| --- | ---: |", ...rows, ""].join("\n");
	await Effect.runPromise(Console.log(summary));
	const destination = Effect.runSync(Config.string("GITHUB_STEP_SUMMARY").pipe(Config.withDefault("")));
	if (destination !== "") {
		appendFileSync(destination, summary);
	}
}
