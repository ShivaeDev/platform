import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { folder } from "./board.ts";
import { boardStory } from "./boardStory.ts";
import { referenceLink } from "./referenceLink.ts";
import { nestedSocketFolder } from "./socketStartup.ts";
import { SCREENSHOT } from "./visuals.ts";

export function outsideFiles(files: Readonly<Record<string, string>>) {
	return boardStory.trait("project", "an outside folder holds files beyond the workspace", function* (engine) {
		engine.outside = yield* Effect.acquireRelease(
			Effect.sync(() => folder(files)),
			(notes) => Effect.sync(notes.remove),
		);
	});
}

export function nestedProject(path: string) {
	return boardStory.trait("project", `the workspace root is nested at ${path}`, (engine) => {
		const original = engine.notes;
		original.write(`${path}/.keep`, "");
		engine.notes = { ...original, root: join(original.root, path), write: (file, source) => original.write(`${path}/${file}`, source) };
	});
}

export const longSocketProject = boardStory.trait("project", "the public socket address nearly reaches the Unix path limit", function* (engine) {
	engine.notes = yield* Effect.acquireRelease(Effect.sync(nestedSocketFolder), (notes) => Effect.sync(notes.remove));
});

export const escapingLink = boardStory.trait("project", "a file link escapes the workspace", (engine) => {
	if (!engine.outside) {
		throw new Error("No outside source exists");
	}
	referenceLink(engine.notes, "escape.md", `${engine.outside.root}/outside.md`);
});

export const localScreenshots = boardStory.trait("project", "two local screenshots accompany the document", (engine) => {
	for (const file of ["shots/first & review.png", "shots/second.png"]) {
		writeFileSync(join(engine.notes.root, file), SCREENSHOT);
	}
});
