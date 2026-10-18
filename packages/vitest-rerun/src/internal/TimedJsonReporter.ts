import { readFileSync, writeFileSync } from "node:fs";
import { experimental_getRunnerTask, JsonReporter, type TestModule } from "vitest/node";

export class TimedJsonReporter extends JsonReporter {
	override async onTestRunEnd(modules: readonly TestModule[]) {
		await super.onTestRunEnd([...modules]);
		const path = this.options.outputFile;
		if (path === undefined) {
			throw new Error("Timed JSON reports require an output file");
		}
		const report = JSON.parse(readFileSync(path, "utf8"));
		for (const [index, module] of modules.entries()) {
			report.testResults[index].durationMs = experimental_getRunnerTask(module).result?.duration ?? 0;
		}
		writeFileSync(path, JSON.stringify(report));
	}
}
