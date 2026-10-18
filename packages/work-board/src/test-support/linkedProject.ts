import { Effect } from "effect";
import { type Folder, folder } from "./board.ts";
import { boardStory } from "./boardStory.ts";
import { referenceLink } from "./referenceLink.ts";

export const linkedProject = boardStory.trait("project", "the project includes a linked reference directory", function* (engine) {
	function acquire(files: Readonly<Record<string, string>>) {
		return Effect.acquireRelease(
			Effect.sync(() => folder(files)),
			(notes) => Effect.sync(notes.remove),
		);
	}
	const reference = yield* acquire({
		".drafts/private.md": "# Hidden draft\n",
		"guide/next.md": "# Next reference\n\n[Start](start.md#evidence)\n",
		"guide/start.md": "# Reference guide\n\n[Next](next.md)\n\n## Evidence\n\nReference passage.\n",
		"node_modules/secret.md": "# Dependency\n",
	});
	const replacement = yield* acquire({ "guide/start.md": "# Replacement guide\n" });
	engine.linked = { reference, replacement };
	engine.notes.write("plan.md", "# Plan\n");
	referenceLink(engine.notes, "reference", reference.root);
});

export interface LinkedProject {
	readonly reference: Folder;
	readonly replacement: Folder;
}
