import { readFileSync, writeFileSync } from "node:fs";
import { deserialize, serialize } from "node:v8";
import { Schema } from "effect";
import { experimental_getRunnerTask, JsonReporter, JUnitReporter, type TestModule, type Vitest } from "vitest/node";

export type Files = ReturnType<Vitest["state"]["getFiles"]>;
type Task = Files[number]["tasks"][number];
interface Attempt {
	errors: unknown[];
	files: Files;
}
const Report = Schema.Struct({ testResults: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.Literals(["failed", "passed"]) })) });
const decode = Schema.decodeUnknownSync(Report);

export function failedFiles(report: unknown): string[] {
	return [
		...new Set(
			decode(report)
				.testResults.filter((file) => file.status === "failed")
				.map((file) => file.name),
		),
	];
}

export function tests(tasks: readonly Task[]): Task[] {
	return tasks.flatMap((task) => (task.type === "suite" ? tests(task.tasks) : [task]));
}

export function saveAttempt(path: string, vitest: Vitest) {
	writeFileSync(path, serialize({ errors: vitest.state.getUnhandledErrors(), files: vitest.state.getFiles() }));
}

export function readAttempt(path: string): Attempt {
	return deserialize(readFileSync(path));
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
			throw new Error(`Rerun collected an unexpected test: ${task.name}`);
		}
		if (task.type === "suite" && first.type === "suite") {
			restorePassed(first.tasks, task.tasks);
		} else {
			mergeTest(first, task);
		}
	}
}

function finishFile(file: Files[number], next: Files[number], ranTests: boolean) {
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

function mergeFile(file: Files[number], next: Files[number], summary: (line: string) => void) {
	const original = tests(file.tasks);
	const retried = tests(next.tasks);
	if (original.some((test) => !retried.some((item) => item.id === test.id))) {
		throw new Error(`Rerun did not collect every original test in ${file.filepath}`);
	}
	const ranTests = retried.some(
		(test) => ["pass", "fail"].includes(test.result?.state ?? "") && original.some((item) => item.id === test.id && item.result?.state !== "pass"),
	);
	for (const test of original.filter((item) => item.result?.state === "fail")) {
		if (retried.some((item) => item.id === test.id && item.result?.state === "pass")) {
			summary(`- Flaky: ${file.projectName ?? ""} ${file.filepath} — ${test.fullTestName}`);
		}
	}
	if (original.length === 0 && next.result?.state === "pass") {
		summary(`- Flaky: ${file.projectName ?? ""} ${file.filepath} — collection failure`);
	} else if (original.length > 0) {
		restorePassed(file.tasks, next.tasks);
	}
	finishFile(file, next, ranTests);
}

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

export async function completeReports(vitest: Vitest, first: Attempt, summary: (line: string) => void) {
	const rerun = vitest.state.getFiles();
	for (const file of first.files) {
		const next = rerun.find((item) => item.id === file.id);
		if (next !== undefined) {
			mergeFile(file, next, summary);
		}
		vitest.state.collectFiles(vitest.getProjectByName(file.projectName ?? ""), [next ?? file]);
	}
	for (const reporter of [new TimedJsonReporter({ outputFile: ".ci/tests.json" }), new JUnitReporter({ outputFile: ".ci/tests.junit.xml" })]) {
		await reporter.onInit(vitest);
		await reporter.onTestRunEnd(vitest.state.getTestModules());
	}
}
