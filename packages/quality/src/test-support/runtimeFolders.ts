import { mkdirSync } from "node:fs";
import { join } from "node:path";

export function runtimeFolders(root: string, ...folders: readonly string[]): void {
	for (const folder of folders) {
		mkdirSync(join(root, folder), { recursive: true });
	}
}
