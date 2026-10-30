import { deserialize, serialize } from "node:v8";
import { Effect, FileSystem, Schema } from "effect";
import type { Vitest } from "vitest/node";
import { failWith } from "#error.ts";
import { FlakyTest } from "#flakyTests.ts";
import { SnapshotFiles } from "./SnapshotFiles.ts";

export type Files = ReturnType<Vitest["state"]["getFiles"]>;
export type Task = Files[number]["tasks"][number];

export interface FailureHistory {
	readonly attempts: number;
	readonly messages: readonly string[];
}

const SnapshotSchema = Schema.Struct({
	errors: Schema.Array(Schema.Unknown),
	failures: Schema.Record(Schema.String, Schema.Struct({ attempts: Schema.Number, messages: Schema.Array(Schema.String) })),
	files: SnapshotFiles,
	flaky: Schema.Array(FlakyTest),
});
export type Snapshot = typeof SnapshotSchema.Type;

const decodeSnapshot = Schema.decodeUnknownEffect(SnapshotSchema);

const Report = Schema.Struct({ testResults: Schema.Array(Schema.Struct({ name: Schema.String, status: Schema.Literals(["failed", "passed"]) })) });
const decodeReport = Schema.decodeUnknownEffect(Schema.fromJsonString(Report));

export const failedFiles = Effect.fn("VitestRerun.failedFiles")(function* (path: string) {
	const fs = yield* FileSystem.FileSystem;
	const contents = yield* fs.readFileString(path);
	const report = yield* decodeReport(contents).pipe(Effect.mapError(failWith(`Could not decode report ${path}`)));
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
	const bytes = yield* fs.readFile(path);
	return yield* Effect.try({ catch: (cause) => cause, try: (): unknown => deserialize(bytes) }).pipe(
		Effect.flatMap(decodeSnapshot),
		Effect.mapError(failWith(`Could not decode snapshot ${path}`)),
	);
});
