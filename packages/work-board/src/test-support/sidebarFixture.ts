import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { folder } from "./board.ts";

export const sidebarPaths = ["packages/form/README.md", "root.md", "packages/README.md", "packages/changes/guide.md", 'docs/<long & "name>/a #?.md'];

export function referenceTree() {
	const notes = folder(Object.fromEntries(sidebarPaths.map((path) => [path, `# ${path}\n`])));
	const reference = folder({ "guide/start.md": "# Reference\n" });
	symlinkSync(reference.root, join(notes.root, "reference"));
	mkdirSync(join(notes.root, "empty"));
	return { notes, reference };
}
