import { Effect } from "effect";
import { type AttemptRunner, type Selection, VitestRunner } from "#adapters/VitestRunner.ts";
import { writeFlakyTests } from "#flakyTests.ts";
import { mergeAttempt } from "#internal/mergeAttempt.ts";
import { refuseDeclaredRetries } from "#internal/refuseDeclaredRetries.ts";
import { attemptPaths, reportPaths } from "#internal/reportPaths.ts";
import { failedFiles, hasSuiteErrors, readSnapshot, type Snapshot, saveSnapshot, tests } from "#internal/snapshot.ts";
import { summaryLine } from "#internal/summaryLine.ts";

export interface Attempt {
	readonly attempt: number;
	readonly outputDir: string;
	readonly vitestArgs: readonly string[];
}

const failedSelections = Effect.fn("VitestRerun.failedSelections")(function* (previous: Snapshot, json: string) {
	const failed = new Set(yield* failedFiles(json));
	return previous.files.flatMap((file): Selection[] => {
		if (!failed.has(file.filepath) || file.result?.state !== "fail") {
			return [];
		}
		const runnable = tests(file.tasks).filter((test) => !["pass", "skip", "todo"].includes(test.result?.state ?? test.mode));
		return [{ fileId: file.id, ...(file.tasks.length === 0 || hasSuiteErrors(file) ? {} : { testIds: runnable.map((test) => test.id) }) }];
	});
});

const rerunFailed = Effect.fn("VitestRerun.rerunFailed")(function* (runner: AttemptRunner, { attempt, outputDir }: Attempt) {
	const previous = yield* readSnapshot(attemptPaths(outputDir, attempt - 1).snapshot);
	const final = reportPaths(outputDir);
	yield* runner.rerun(yield* failedSelections(previous, final.json));
	const current = yield* runner.read();
	yield* refuseDeclaredRetries(current.files, current.root);
	const lines: string[] = [];
	const merged = yield* mergeAttempt(previous, current.files, current.root, (line) => lines.push(line));
	yield* runner.collect(merged.files, previous.summary);
	yield* Effect.forEach(lines, summaryLine);
	if (merged.flaky.length > 0) {
		yield* writeFlakyTests(final.flaky, merged.flaky);
	}
	const state = yield* runner.read();
	const snapshot: Snapshot = {
		errors: state.errors,
		failures: merged.failures,
		files: state.files,
		flaky: merged.flaky,
		summary: state.summary,
	};
	return snapshot;
});

export const runAttempt = Effect.fn("VitestRerun.runAttempt")(function* (input: Attempt) {
	const vitest = yield* VitestRunner;
	const rerun = input.attempt > 1;
	const reports = rerun ? attemptPaths(input.outputDir, input.attempt) : reportPaths(input.outputDir);
	const runner = yield* vitest.open({
		...(rerun ? { cacheDir: reportPaths(input.outputDir).rerunCache } : {}),
		reports,
		rerun,
		vitestArgs: input.vitestArgs,
	});
	let snapshot: Snapshot;
	if (rerun) {
		snapshot = yield* rerunFailed(runner, input);
	} else {
		yield* runner.start();
		const state = yield* runner.read();
		yield* refuseDeclaredRetries(state.files, state.root);
		snapshot = { errors: state.errors, failures: {}, files: state.files, flaky: [], summary: state.summary };
	}
	yield* runner.finish(input.outputDir, input.attempt, reportPaths(input.outputDir));
	yield* saveSnapshot(attemptPaths(input.outputDir, input.attempt).snapshot, snapshot);
	return snapshot.files.some((file) => file.result?.state === "fail") || snapshot.errors.length > 0;
}, Effect.scoped);
