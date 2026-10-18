import { deserialize, serialize } from "node:v8";
import { Effect, FileSystem, Schema } from "effect";
import type { Vitest } from "vitest/node";
import type { FlakyTest } from "#flakyTests.ts";

export type Files = ReturnType<Vitest["state"]["getFiles"]>;
export type Task = Files[number]["tasks"][number];

export interface FailureHistory {
	readonly attempts: number;
	readonly messages: readonly string[];
}

export interface Snapshot {
	readonly errors: readonly unknown[];
	readonly failures: Readonly<Record<string, FailureHistory>>;
	readonly files: Files;
	readonly flaky: readonly FlakyTest[];
}

const Report = Schema.Struct({ testResults: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.Literals(["failed", "passed"]) })) });
const decodeReport = Schema.decodeUnknownEffect(Schema.fromJsonString(Report));

export const failedFiles = Effect.fn("VitestRerun.failedFiles")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	const report = yield* decodeReport(yield* fs.readFileString(path));
	return [...new Set(report.testResults.filter((file) => file.status === "failed").map((file) => file.name))];
});

export function tests(tasks: readonly Task[]): Task[] {
	return tasks.flatMap((task) => (task.type === "suite" ? tests(task.tasks) : [task]));
}

export const saveSnapshot = Effect.fn("VitestRerun.saveSnapshot")(function* (path: string, snapshot: Snapshot) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFile(path, serialize(snapshot));
});

export const readSnapshot = Effect.fn("VitestRerun.readSnapshot")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	const snapshot: Snapshot = deserialize(yield* fs.readFile(path));
	return snapshot;
});
