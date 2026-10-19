import { realpathSync } from "node:fs";
import type { Folder } from "./board.ts";

export function navigationKey(notes: Folder) {
	return `work-board:library:${realpathSync(notes.root)}`;
}

export function preferencesKey(notes: Folder) {
	return `work-board:appearance:${realpathSync(notes.root)}`;
}
