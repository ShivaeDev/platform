import { type Files, type Task, tests } from "#internal/snapshot.ts";

type Suite = Files[number] | Extract<Task, { type: "suite" }>;

export function hasOwnFailure(task: Task): boolean {
	return task.result?.state === "fail" && (task.result.errors?.length ?? 0) > 0;
}

export function suites(suite: Suite): Suite[] {
	return [suite, ...suite.tasks.flatMap((task) => (task.type === "suite" ? suites(task) : []))];
}

export function suiteFailures(suite: Suite, ancestors = ""): { readonly name: string; readonly task: Suite }[] {
	const failures = hasOwnFailure(suite)
		? [{ name: "filepath" in suite && suite.tasks.length === 0 ? "file failed to load" : `${ancestors || suite.name} (suite hook)`, task: suite }]
		: [];
	return failures.concat(
		suite.tasks.flatMap((task) => (task.type === "suite" ? suiteFailures(task, ancestors === "" ? task.name : `${ancestors} > ${task.name}`) : [])),
	);
}

export function rerunTestIds(file: Files[number]): string[] {
	const failedSuites = suiteFailures(file);
	const affected = new Set(failedSuites.flatMap(({ task }) => tests(task.tasks).map((test) => test.id)));
	return tests(file.tasks)
		.filter((test) => affected.has(test.id) || !["pass", "skip", "todo"].includes(test.result?.state ?? test.mode))
		.map((test) => test.id);
}
