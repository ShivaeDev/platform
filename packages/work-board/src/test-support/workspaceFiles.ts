import { mkdirSync, readdirSync, rmSync, symlinkSync, utimesSync } from "node:fs";
import { dirname, join } from "node:path";
import { Clock, Effect } from "effect";
import type { BoardFixtureOptions } from "./BoardFixtureOptions.ts";
import { folder } from "./board.ts";

export function* workspaceFiles(files: Readonly<Record<string, string>>, options?: BoardFixtureOptions) {
	const notes =
		options?.workspace
		?? (yield* Effect.acquireRelease(
			Effect.sync(() => folder(files)),
			(value) => Effect.sync(value.remove),
		));
	const written = new Map(Object.entries(files));
	const createdAt = yield* Clock.currentTimeMillis;
	for (const file of Object.keys(files)) {
		const at = (options?.modified?.get(file) ?? createdAt) / 1000;
		utimesSync(join(notes.root, file), at, at);
	}
	for (const file of options?.unreadable ?? []) {
		const path = join(notes.root, file);
		rmSync(path, { force: true, recursive: true });
		mkdirSync(dirname(path), { recursive: true });
		symlinkSync(file.split("/").at(-1) ?? file, path);
	}
	return {
		...notes,
		paths: () => readdirSync(notes.root, { encoding: "utf8", recursive: true }).filter((name) => name.endsWith(".md")),
		synchronize: Effect.sync(() => {
			for (const file of written.keys()) {
				if (!(file in files)) {
					rmSync(join(notes.root, file), { force: true });
					written.delete(file);
				}
			}
			for (const [file, source] of Object.entries(files)) {
				if (written.get(file) !== source) {
					notes.write(file, source);
					written.set(file, source);
				}
			}
		}),
	};
}
