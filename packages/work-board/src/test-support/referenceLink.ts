import { symlinkSync } from "node:fs";
import { join } from "node:path";
import type { Folder } from "./board.ts";

export function referenceLink(folder: Folder, path: string, target: string) {
	symlinkSync(target, join(folder.root, path));
}
