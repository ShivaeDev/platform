import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { folder } from "./board.ts";

export function* memoryFiles(files: Readonly<Record<string, string>>, writable: boolean, seeded: Readonly<Record<string, string>> = {}) {
	if (!writable) {
		return { files: () => ({ ...seeded, ...files }), root: "/board" };
	}
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder({ ...seeded, ...files })),
		(value) => Effect.sync(value.remove),
	);
	const written = new Map(Object.entries({ ...seeded, ...files }));
	function writeChanges() {
		for (const [path, source] of Object.entries(files)) {
			if (written.get(path) !== source) {
				notes.write(path, source);
				written.set(path, source);
			}
		}
	}
	return {
		files: () => {
			const saved: Record<string, string> = {};
			for (const namespace of ["responses", "handoffs"]) {
				const directory = join(notes.root, namespace);
				for (const name of existsSync(directory) ? readdirSync(directory) : []) {
					if (name.endsWith(".md")) {
						saved[`${namespace}/${name}`] = readFileSync(join(directory, name), "utf8");
					}
				}
			}
			writeChanges();
			return { ...seeded, ...files, ...saved };
		},
		root: notes.root,
	};
}
