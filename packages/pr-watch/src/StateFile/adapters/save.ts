import { dirname } from "node:path";
import process from "node:process";
import { Effect, FileSystem } from "effect";
import type { State } from "#model.ts";
import { failure } from "#StateFile/failure.ts";

export const save = Effect.fn("StateFile.save")((path: string, state: State) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		yield* fs.makeDirectory(dirname(path), { recursive: true });
		const temporary = `${path}.${process.pid}.tmp`;
		yield* fs.writeFileString(temporary, `${JSON.stringify(state)}\n`, { mode: 0o600 });
		yield* fs.rename(temporary, path);
	}).pipe(Effect.mapError(failure)),
);
