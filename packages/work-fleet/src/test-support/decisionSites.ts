import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { sourceDecisionSites } from "#test/sourceDecisionSites.ts";

export function decisionSites(root: string) {
	const sites: string[] = [];
	function scan(directory: string) {
		for (const entry of readdirSync(directory, { withFileTypes: true })) {
			if (entry.name === "test-support") {
				continue;
			}
			const file = join(directory, entry.name);
			if (entry.isDirectory()) {
				scan(file);
				continue;
			}
			if (!entry.name.endsWith(".ts") || /\.(?:test|spec)\.ts$/u.test(entry.name)) {
				continue;
			}
			sites.push(...sourceDecisionSites(relative(root, file), readFileSync(file, "utf8")));
		}
	}
	scan(root);
	return sites.sort((left, right) => left.localeCompare(right));
}
