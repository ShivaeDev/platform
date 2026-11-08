import process from "node:process";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Config, Console, Effect, FileSystem, Schema } from "effect";

const Consumer = Schema.Struct({ timings: Schema.Array(Schema.Struct({ durationMs: Schema.Number, name: Schema.String })) });
const Tests = Schema.Struct({
	testResults: Schema.Array(
		Schema.Struct({ durationMs: Schema.optional(Schema.Number), endTime: Schema.Number, name: Schema.String, startTime: Schema.Number }),
	),
});
const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Union([Consumer, Tests])));
const program = Effect.gen(function* () {
	const fs = yield* FileSystem.FileSystem;
	const path = process.argv[2];
	if (path !== undefined && (yield* fs.exists(path))) {
		const report = yield* decode(yield* fs.readFileString(path));
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
			yield* fs.writeFileString(destination, summary, { flag: "a" });
		}
	}
});

NodeRuntime.runMain(program.pipe(Effect.provide(NodeServices.layer)));
