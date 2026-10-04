import { Effect, FileSystem, Path } from "effect";
import type { State, WorkSpec } from "./domain.ts";
import { failure } from "./ports.ts";
import { renderViews } from "./renderViews.ts";
export function prepareDatabase(filename: string) {
	return Effect.gen(function* () {
		if (filename === ":memory:") {
			return yield* Effect.fail(failure("The CLI requires a durable database filename"));
		}
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		const resolved = path.resolve(filename);
		yield* fs.makeDirectory(path.dirname(resolved), { recursive: true });
		const parent = yield* fs.realPath(path.dirname(resolved));
		return (yield* fs.exists(resolved)) ? yield* fs.realPath(resolved) : path.join(parent, path.basename(resolved));
	});
}
export function protectDatabase(filename: string, works: ReadonlyArray<WorkSpec>) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		for (const work of works) {
			const checkout = yield* fs.realPath(work.checkout);
			const relative = path.relative(checkout, filename);
			if (relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))) {
				return yield* Effect.fail(failure("The fleet database must be outside every worker checkout"));
			}
		}
	});
}
export function writeViews(state: State, directory: string) {
	return Effect.gen(function* () {
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.makeDirectory(directory, { recursive: true });
		const views = renderViews(state);
		for (const [filename, contents] of [
			["Active.md", views.Active],
			["Completed.md", views.Completed],
			["Needs human.md", views.NeedsHuman],
		]) {
			if (!filename || contents === undefined) {
				continue;
			}
			const destination = path.join(directory, filename);
			yield* fs.writeFileString(`${destination}.tmp`, contents);
			yield* fs.rename(`${destination}.tmp`, destination);
		}
	});
}
