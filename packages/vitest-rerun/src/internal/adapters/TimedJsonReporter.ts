import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { experimental_getRunnerTask, JsonReporter, type TestModule } from "vitest/node";
import { VitestRerunError } from "#error.ts";
import { writeTimedReport } from "#internal/writeTimedReport.ts";

export class TimedJsonReporter extends JsonReporter {
	override async onTestRunEnd(modules: readonly TestModule[]) {
		await super.onTestRunEnd([...modules]);
		const path = this.options.outputFile;
		if (path === undefined) {
			throw new VitestRerunError({ message: "Timed JSON reports require an output file" });
		}
		await Effect.runPromise(
			writeTimedReport(
				path,
				modules.map((module) => experimental_getRunnerTask(module).result?.duration ?? 0),
			).pipe(Effect.provide(NodeServices.layer)),
		);
	}
}
