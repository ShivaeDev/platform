import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export function quotedStoryFile(root: string) {
	const include = 'quoted story\'s "titles".ts';
	const source = readFileSync(new URL("./quotedStories.ts", import.meta.url), "utf8");
	const mill = fileURLToPath(new URL("./mill.ts", import.meta.url));
	writeFileSync(join(root, include), source.replace('"#test/mill.ts"', JSON.stringify(mill)));
	return { include, root };
}
