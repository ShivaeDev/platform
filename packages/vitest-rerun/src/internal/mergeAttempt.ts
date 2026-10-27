import type { FlakyTest } from "#flakyTests.ts";
import { type Outcome, recordAttempts } from "#internal/recordAttempts.ts";
import { type FailureHistory, type Files, type Snapshot, type Task, tests } from "#internal/snapshot.ts";
import { hasOwnFailure } from "#internal/suiteFailures.ts";

type File = Files[number];

function mergeTest(first: Task, task: Task, rerunSuite: boolean) {
	const unresolved = first.result?.state === "fail" && !["pass", "fail"].includes(task.result?.state ?? "");
	if (first.result !== undefined && ((first.result.state === "pass" && !rerunSuite) || unresolved)) {
		task.mode = first.mode;
		task.result = first.result;
		task.logs = first.logs ?? [];
	} else if (task.result !== undefined) {
		task.result.duration = (task.result.duration ?? 0) + (first.result?.duration ?? 0);
	}
}

function restorePassed(original: Task[], rerun: Task[], rerunSuite: boolean) {
	for (const task of rerun) {
		const first = original.find((item) => item.id === task.id);
		if (first === undefined) {
			throw new Error(`Rerun collected an unexpected test: ${task.name}`);
		}
		if (task.type === "suite" && first.type === "suite") {
			restorePassed(first.tasks, task.tasks, rerunSuite || hasOwnFailure(first));
			if (task.tasks.some((child) => child.result?.state === "fail") && task.result !== undefined) {
				task.result.state = "fail";
			}
		} else {
			mergeTest(first, task, rerunSuite);
		}
	}
}

function finishFile(file: File, next: File, ranTests: boolean) {
	const duration = (file.result?.duration ?? 0) + (next.result?.duration ?? 0);
	if (!ranTests && file.result?.state === "pass") {
		next.result = { ...file.result };
	}
	if (next.result !== undefined) {
		if (tests(next.tasks).some((test) => test.result?.state === "fail")) {
			next.result.state = "fail";
		}
		next.result.startTime = file.result?.startTime ?? next.result.startTime ?? 0;
		next.result.duration = duration;
	}
}

function mergeFile(file: File, next: File, outcome: Outcome) {
	const original = tests(file.tasks);
	const retried = tests(next.tasks);
	if (original.some((test) => !retried.some((item) => item.id === test.id))) {
		throw new Error(`Rerun did not collect every original test in ${file.filepath}`);
	}
	const ranTests = retried.some(
		(test) => ["pass", "fail"].includes(test.result?.state ?? "") && original.some((item) => item.id === test.id && item.result?.state !== "pass"),
	);
	recordAttempts(file, next, outcome);
	if (original.length > 0) {
		restorePassed(file.tasks, next.tasks, hasOwnFailure(file));
	}
	finishFile(file, next, ranTests);
}

export interface Merged {
	readonly failures: Readonly<Record<string, FailureHistory>>;
	readonly files: Files;
	readonly flaky: readonly FlakyTest[];
}

export function mergeAttempt(previous: Snapshot, rerun: Files, root: string, summary: (line: string) => void): Merged {
	const outcome: Outcome = { failures: { ...previous.failures }, flaky: [...previous.flaky], root, summary };
	const files = previous.files.map((file) => {
		const next = rerun.find((item) => item.id === file.id);
		if (next === undefined) {
			return file;
		}
		mergeFile(file, next, outcome);
		return next;
	});
	return { failures: outcome.failures, files, flaky: outcome.flaky };
}
