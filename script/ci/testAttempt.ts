import { appendFileSync, cpSync, readFileSync } from "node:fs";
import process from "node:process";
import { Config, Console, Effect } from "effect";
import * as VitestNode from "vitest/node";
import { completeReports, failedFiles, readAttempt, saveAttempt, TimedJsonReporter, tests } from "./freshReports.ts";

const rerun = process.argv[2] === "rerun";
const { filter, options } = VitestNode.parseCLI(["vitest", "run", ...process.argv.slice(3)]);
if (rerun) {
	delete options.shard;
	if (options.coverage) {
		options.coverage.reportsDirectory = ".ci/coverage-rerun";
	}
}
const vitest = await VitestNode.createVitest(
	{
		...options,
		config: options.config ?? "script/test/vitest.config.ts",
		configLoader: "native",
		outputFile: { json: rerun ? ".ci/tests.rerun.json" : ".ci/tests.json", junit: rerun ? ".ci/tests.rerun.junit.xml" : ".ci/tests.junit.xml" },
		reporters: ["default", new TimedJsonReporter({ outputFile: rerun ? ".ci/tests.rerun.json" : ".ci/tests.json" }), "junit"],
		retry: 0,
		watch: false,
	},
	rerun ? { cacheDir: ".ci/vite-rerun" } : {},
);

try {
	if (rerun) {
		const first = readAttempt(".ci/tests.first.bin");
		const report = JSON.parse(readFileSync(".ci/tests.first.json", "utf8"));
		const failed = new Set(failedFiles(report));
		await vitest.standalone();
		const specifications = (await vitest.globTestSpecifications()).flatMap((spec) => {
			const file = first.files.find((item) => item.id === spec.taskId && failed.has(spec.moduleId) && item.result?.state === "fail");
			if (file === undefined) {
				return [];
			}
			const runnable = tests(file.tasks).filter((test) => !["pass", "skip", "todo"].includes(test.result?.state ?? test.mode));
			return [
				spec.project.createSpecification(spec.moduleId, file.tasks.length === 0 ? {} : { testIds: runnable.map((test) => test.id) }, spec.pool),
			];
		});
		if (specifications.length === 0) {
			throw new Error("No failed specifications found for fresh rerun");
		}
		await vitest.runTestSpecifications(specifications);
		const summary = Effect.runSync(Config.String("GITHUB_STEP_SUMMARY").pipe(Config.withDefault("")));
		await completeReports(vitest, first, (line) => {
			Effect.runSync(Console.log(line));
			if (summary !== "") {
				appendFileSync(summary, `${line}\n`);
			}
		});
		const firstCoverage = report.coverageMap;
		const rerunCoverage = JSON.parse(readFileSync(".ci/tests.rerun.json", "utf8")).coverageMap;
		if (options.coverage && firstCoverage !== undefined && rerunCoverage !== undefined) {
			const provider = await vitest.createCoverageProvider();
			await provider?.mergeReports?.([firstCoverage, rerunCoverage]);
			cpSync(".ci/coverage-rerun", ".ci/coverage", { recursive: true });
		}
	} else {
		await vitest.start(filter);
		saveAttempt(".ci/tests.first.bin", vitest);
	}
	if (vitest.state.getFiles().some((file) => file.result?.state === "fail") || vitest.state.getUnhandledErrors().length > 0) {
		process.exitCode = 1;
	}
} finally {
	await vitest.close();
}
