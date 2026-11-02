import { Config, Console, Effect, FileSystem } from "effect";

export const summaryLine = Effect.fn("VitestRerun.summaryLine")(function* (line: string) {
	const fs = yield* FileSystem.FileSystem;
	const summary = yield* Config.String("GITHUB_STEP_SUMMARY").pipe(Config.withDefault(""));
	yield* Console.log(line);
	if (summary !== "") {
		yield* fs.writeFileString(summary, `${line}\n`, { flag: "a" });
	}
});
