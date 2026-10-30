import { relative } from "node:path";
import { Effect } from "effect";
import { VitestRerunError } from "#error.ts";
import { type FlakyTest, failureMessage, testcases } from "#flakyTests.ts";
import { junitClassname } from "#internal/junit.ts";
import { type FailureHistory, type Files, type Snapshot, type Task, tests } from "#internal/snapshot.ts";

type File = Files[number];

interface Outcome {
	readonly failures: Record<string, FailureHistory>;
	readonly flaky: FlakyTest[];
	readonly root: string;
	readonly summary: (line: string) => void;
}

function mergeTest(first: Task, task: Task) {
	const unresolved = first.result?.state === "fail" && !["pass", "fail"].includes(task.result?.state ?? "");
	if (first.result !== undefined && (first.result.state === "pass" || unresolved)) {
		task.mode = first.mode;
		task.result = first.result;
		task.logs = first.logs ?? [];
	} else if (task.result !== undefined) {
		task.result.duration = (task.result.duration ?? 0) + (first.result?.duration ?? 0);
	}
}

function restorePassed(original: Task[], rerun: Task[]) {
	for (const task of rerun) {
		const first = original.find((item) => item.id === task.id);
		if (first === undefined) {
			continue;
		}
		if (task.type === "suite" && first.type === "suite") {
			restorePassed(first.tasks, task.tasks);
		} else {
			mergeTest(first, task);
		}
	}
}

function finishFile(file: File, next: File, ranTests: boolean) {
	const duration = (file.result?.duration ?? 0) + (next.result?.duration ?? 0);
	if (!ranTests && file.tasks.length > 0 && file.result !== undefined) {
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

function recordAttempts(file: File, retried: Task[], outcome: Outcome) {
	const path = relative(outcome.root, file.filepath);
	const classname = junitClassname(path, file.projectName ?? "");
	for (const { name, task } of testcases(file.tasks).filter((testcase) => testcase.task.result?.state === "fail")) {
		const again = retried.find((item) => item.id === task.id);
		const prior = outcome.failures[task.id] ?? { attempts: 1, messages: [failureMessage(task)] };
		if (again?.result?.state === "pass") {
			delete outcome.failures[task.id];
			outcome.flaky.push({ attempts: prior.attempts + 1, classname, file: path, messages: prior.messages, name });
			outcome.summary(`- Flaky: ${classname} — ${name}`);
		} else if (again?.result?.state === "fail") {
			outcome.failures[task.id] = { attempts: prior.attempts + 1, messages: [...prior.messages, failureMessage(again)] };
		}
	}
}

function mergeFile(file: File, next: File, outcome: Outcome) {
	const original = tests(file.tasks);
	const retried = tests(next.tasks);
	const ranTests = retried.some(
		(test) => ["pass", "fail"].includes(test.result?.state ?? "") && original.some((item) => item.id === test.id && item.result?.state !== "pass"),
	);
	recordAttempts(file, retried, outcome);
	if (original.length === 0 && next.result?.state === "pass") {
		outcome.summary(`- Flaky: ${junitClassname(relative(outcome.root, file.filepath), file.projectName ?? "")} — collection failure`);
	} else if (original.length > 0) {
		restorePassed(file.tasks, next.tasks);
	}
	finishFile(file, next, ranTests);
}

interface Merged {
	readonly failures: Readonly<Record<string, FailureHistory>>;
	readonly files: Files;
	readonly flaky: readonly FlakyTest[];
}

function unexpectedTask(original: readonly Task[], rerun: readonly Task[]): Task | undefined {
	for (const task of rerun) {
		const first = original.find((item) => item.id === task.id);
		if (first === undefined) {
			return task;
		}
		const unexpected = first.type === "suite" && task.type === "suite" ? unexpectedTask(first.tasks, task.tasks) : undefined;
		if (unexpected !== undefined) {
			return unexpected;
		}
	}
	return undefined;
}

function refusal(previous: Snapshot, rerun: Files, root: string): string | undefined {
	for (const file of previous.files) {
		const next = rerun.find((item) => item.id === file.id);
		if (next === undefined) {
			continue;
		}
		const original = tests(file.tasks);
		if (original.some((test) => !tests(next.tasks).some((item) => item.id === test.id))) {
			return `Rerun did not collect every original test in ${relative(root, file.filepath)}`;
		}
		const unexpected = original.length === 0 ? undefined : unexpectedTask(file.tasks, next.tasks);
		if (unexpected !== undefined) {
			return `Rerun collected an unexpected test: ${unexpected.name}`;
		}
	}
	return undefined;
}

export const mergeAttempt = Effect.fn("VitestRerun.mergeAttempt")(function* (
	previous: Snapshot,
	rerun: Files,
	root: string,
	summary: (line: string) => void,
) {
	const refused = refusal(previous, rerun, root);
	if (refused !== undefined) {
		return yield* new VitestRerunError({ message: refused });
	}
	const outcome: Outcome = { failures: { ...previous.failures }, flaky: [...previous.flaky], root, summary };
	const files = previous.files.map((file) => {
		const next = rerun.find((item) => item.id === file.id);
		if (next === undefined) {
			return file;
		}
		mergeFile(file, next, outcome);
		return next;
	});
	const merged: Merged = { failures: outcome.failures, files, flaky: outcome.flaky };
	return merged;
});
