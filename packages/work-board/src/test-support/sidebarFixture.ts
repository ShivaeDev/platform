import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { folder } from "./board.ts";

export const sidebarPaths = ["packages/form/README.md", "root.md", "packages/README.md", "packages/changes/guide.md", 'docs/<long & "name>/a #?.md'];

export function sidebarWorkspace(): Readonly<Record<string, string>> {
	return {
		"board.md": "# Workspace\n\n## Notes\n\n### Read the evidence\n",
		...Object.fromEntries(Array.from({ length: 6 }, (_, index) => [`notes/topic-${index + 1}.md`, `# Topic ${index + 1}\n\nA project note.\n`])),
	};
}

export function referenceTree() {
	const notes = folder(Object.fromEntries(sidebarPaths.map((path) => [path, `# ${path}\n`])));
	const reference = folder({ "guide/start.md": "# Reference\n" });
	symlinkSync(reference.root, join(notes.root, "reference"));
	mkdirSync(join(notes.root, "empty"));
	return { notes, reference };
}
