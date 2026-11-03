import { realpathSync } from "node:fs";
import { join } from "node:path";

export function hookPath(root: string): string {
	return join(realpathSync(root), ".git", "hooks", "pre-commit");
}
