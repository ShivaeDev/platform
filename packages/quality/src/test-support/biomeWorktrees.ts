import { readFileSync } from "node:fs";
import { join } from "node:path";
import { type HookRepository, hookRepository, withWorktree, writes } from "./hookRepository.ts";

export const MESSY = {
	content: 'import { join } from "node:path";\nimport { readFile } from "node:fs/promises";\n\nexport const total   =  [join, readFile].length\n',
	path: "src/total.ts",
};

export const FIXED =
	'import { readFile } from "node:fs/promises";\nimport { join } from "node:path";\n\nexport const total = [join, readFile].length;\n';

export interface WorktreeCheckout {
	readonly primary: string;
	readonly repository: HookRepository;
	readonly worktree: string;
}

// The linked worktree sits where the repository's own convention puts it, so every path inside it contains `.worktrees/`.
export function messyWorktree(folder = ""): WorktreeCheckout {
	const repository = hookRepository({ configless: true, folder });
	const worktree = join(withWorktree(repository, "feature", join(repository.root, ".worktrees", "feature")), folder);
	writes(worktree, MESSY.path, MESSY.content);
	return { primary: join(repository.root, folder), repository, worktree };
}

export function messyText(root: string): string {
	return readFileSync(join(root, MESSY.path), "utf8");
}

// Biome matches this folder glob against the folders above the root too, so inside `.worktrees/` it ignores every file.
export function ignoringEveryFile(root: string): string {
	writes(root, "biome.json", '{ "extends": ["@shivaedev/quality/biome/preset.json"], "files": { "includes": ["**", "!**/.worktrees"] } }\n');
	return root;
}
