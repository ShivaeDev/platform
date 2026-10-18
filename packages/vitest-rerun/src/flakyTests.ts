import { Effect, FileSystem, Schema } from "effect";
import type { Task } from "#internal/snapshot.ts";

export const FlakyTest = Schema.Struct({
	attempts: Schema.Number,
	classname: Schema.String,
	file: Schema.String,
	messages: Schema.Array(Schema.String),
	name: Schema.String,
});
export type FlakyTest = typeof FlakyTest.Type;

export const FlakyTests = Schema.Array(FlakyTest);

export function testcases(tasks: readonly Task[], ancestors = ""): { readonly name: string; readonly task: Task }[] {
	return tasks.flatMap((task) => {
		const name = ancestors === "" ? task.name : `${ancestors} > ${task.name}`;
		return task.type === "suite" ? testcases(task.tasks, name) : [{ name, task }];
	});
}

export function failureMessage(task: Task): string {
	return (task.result?.errors ?? []).map((error) => error.message).join("\n");
}

const encode = Schema.encodeEffect(Schema.fromJsonString(FlakyTests));

export const writeFlakyTests = Effect.fn("VitestRerun.writeFlakyTests")(function* (path: string, flaky: readonly FlakyTest[]) {
	const fs = yield* FileSystem.FileSystem;
	yield* fs.writeFileString(path, `${yield* encode(flaky)}\n`);
});
