import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SCREENSHOT } from "#test/visuals.ts";

export function imageNamedDirectory(root: string) {
	mkdirSync(join(root, "screenshot.png"));
}

export function screenshotFile(root: string) {
	const path = join(root, "screenshot.png");
	writeFileSync(path, SCREENSHOT);
	return path;
}
