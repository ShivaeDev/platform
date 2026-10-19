import { readFileSync, renameSync, statSync, symlinkSync, truncateSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { BoardEngine } from "./storyEngine.ts";

export function fileVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		editBytes: (path: string, bytes: Uint8Array) => {
			tell(`an outside editor writes image bytes to ${path}`);
			writeFileSync(join(engine.notes.root, path), bytes);
		},
		linkFile: (path: string, target: string, root = engine.notes.root) => {
			tell(`an outside process links ${path} to ${target}`);
			symlinkSync(target, join(root, path));
		},
		moveFile: (from: string, to: string) => {
			tell(`an outside editor renames ${from} to ${to}`);
			renameSync(join(engine.notes.root, from), join(engine.notes.root, to));
		},
		resaveFile: (path: string) => {
			tell(`an outside editor saves ${path} again without changing its bytes or modification time`);
			const file = join(engine.notes.root, path);
			const { atime, mtime } = statSync(file);
			writeFileSync(file, readFileSync(file));
			utimesSync(file, atime, mtime);
		},
		resizeFile: (path: string, size: number) => {
			tell(`an outside process resizes ${path} to ${size} bytes`);
			truncateSync(join(engine.notes.root, path), size);
		},
	};
}
