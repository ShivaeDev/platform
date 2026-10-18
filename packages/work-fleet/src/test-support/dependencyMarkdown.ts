import { FileSystem, Path } from "effect";
import { dependencySource } from "#test/dependencyBoard.ts";
import { engine } from "#test/engineStory.ts";

export function dependencyMarkdown() {
	return engine.trait("work", "the Markdown Board relates dependent work to its target", function* (state) {
		if (state.root === "") {
			throw new Error("Dependency Markdown requires a Markdown Board");
		}
		const fs = yield* FileSystem.FileSystem;
		const path = yield* Path.Path;
		yield* fs.writeFileString(path.join(state.root, "one.md"), dependencySource);
		yield* fs.writeFileString(
			path.join(state.root, "dependent.md"),
			"---\nid: dependent\nkind: task\nfleet: approved\nrelationships:\n  - kind: depends_on\n    target: one\n---\n# Dependent\n",
		);
	});
}
