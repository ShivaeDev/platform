import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";

export const boardFolder = Effect.fn("BoardStory.boardFolder")(function* (trait: "withDependency" | "ambiguousIdentity") {
	const root = mkdtempSync(join(tmpdir(), "fleet-board-"));
	yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
	if (trait === "withDependency") {
		writeFileSync(
			join(root, "task.md"),
			"---\nid: task.one\nkind: task\nrelationships:\n  - kind: depends_on\n    target: task.before\n---\n# Useful work\n",
		);
	} else {
		for (const name of ["one.md", "two.md"]) {
			writeFileSync(join(root, name), "---\nid: same\n---\nWork\n");
		}
	}
	return root;
});
