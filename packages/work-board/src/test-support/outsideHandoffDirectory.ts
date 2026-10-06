import { symlinkSync } from "node:fs";
import { join } from "node:path";

export function outsideHandoffDirectory(root: string, target: string) {
	symlinkSync(target, join(root, "handoffs"));
}
