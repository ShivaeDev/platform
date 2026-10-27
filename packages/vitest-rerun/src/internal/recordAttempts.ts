import { relative } from "node:path";
import { type FlakyTest, failureMessage, testcases } from "#flakyTests.ts";
import { junitClassname } from "#internal/junit.ts";
import { type FailureHistory, type Files, tests } from "#internal/snapshot.ts";
import { hasOwnFailure, suiteFailures, suites } from "#internal/suiteFailures.ts";

export interface Outcome {
	readonly failures: Record<string, FailureHistory>;
	readonly flaky: FlakyTest[];
	readonly root: string;
	readonly summary: (line: string) => void;
}

export function recordAttempts(file: Files[number], next: Files[number], outcome: Outcome) {
	const path = relative(outcome.root, file.filepath);
	const classname = junitClassname(path, file.projectName ?? "");
	const retried = [...suites(next), ...tests(next.tasks)];
	for (const { name, task } of [...testcases(file.tasks).filter((testcase) => testcase.task.result?.state === "fail"), ...suiteFailures(file)]) {
		const again = retried.find((item) => item.id === task.id);
		const prior = outcome.failures[task.id] ?? { attempts: 1, messages: [failureMessage(task)] };
		const recovered = again?.result?.state === "pass" || (task.type === "suite" && again?.result?.state === "fail" && !hasOwnFailure(again));
		if (recovered) {
			delete outcome.failures[task.id];
			outcome.flaky.push({ attempts: prior.attempts + 1, classname, file: path, messages: prior.messages, name });
			outcome.summary(`- Flaky: ${classname} — ${name === "file failed to load" ? "collection failure" : name}`);
		} else if (again !== undefined && hasOwnFailure(again)) {
			outcome.failures[task.id] = { attempts: prior.attempts + 1, messages: [...prior.messages, failureMessage(again)] };
		}
	}
}
