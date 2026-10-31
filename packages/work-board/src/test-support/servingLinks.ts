import { join } from "node:path";
import type { BoardEngine } from "./storyEngine.ts";

export type LinkTarget =
	| "the outside folder"
	| "the outside file"
	| "the parent folder"
	| "the reference folder"
	| "the replacement folder"
	| "the replacement folder's start"
	| "the workspace"
	| `${string}.md`
	| `${string}/`;

export function resolvedTarget(engine: BoardEngine, target: LinkTarget) {
	switch (target) {
		case "the outside folder":
			return outsideRoot(engine);
		case "the outside file":
			return join(outsideRoot(engine), "private.md");
		case "the parent folder":
			return "..";
		case "the reference folder":
			return linkedRoots(engine).reference.root;
		case "the replacement folder":
			return linkedRoots(engine).replacement.root;
		case "the replacement folder's start":
			return join(linkedRoots(engine).replacement.root, "guide/start.md");
		case "the workspace":
			return engine.notes.root;
		default:
			return target.endsWith("/") ? target.slice(0, -1) : join(engine.notes.root, target);
	}
}

function outsideRoot(engine: BoardEngine) {
	if (!engine.outside) {
		throw new Error("No outside folder was prepared");
	}
	return engine.outside.root;
}

export function linkedRoots(engine: BoardEngine) {
	if (!engine.linked) {
		throw new Error("No linked project was prepared");
	}
	return engine.linked;
}
