import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { baselineStory } from "./baselineStory.ts";
import { commitAll, git } from "./git.ts";
import { writeAll } from "./recordedDebt.ts";
import { linkPackage } from "./tree.ts";

export function remoteBranches(refs: Readonly<Record<string, "main" | "work">>, head?: string) {
	const pointers = Object.entries(refs).map(([ref, branch]) => `${ref} points at ${branch}`);
	const line = [...pointers, ...(head === undefined ? [] : [`origin/HEAD names ${head}`])].join(", ");
	return baselineStory.trait("work", `the remote's ${line}`, (engine) => {
		for (const [ref, branch] of Object.entries(refs)) {
			git(engine.root, "update-ref", `refs/remotes/${ref}`, branch);
		}
		if (head !== undefined) {
			git(engine.root, "symbolic-ref", "refs/remotes/origin/HEAD", `refs/remotes/${head}`);
		}
	});
}

export function unrelatedHistory() {
	return baselineStory.trait("work", "the author commits every file on the orphan branch unrelated, which shares no history with main", (engine) => {
		git(engine.root, "checkout", "--quiet", "--orphan", "unrelated");
		commitAll(engine.root, "Unrelated");
	});
}

export function shallowClone() {
	return baselineStory.trait(
		"work",
		"work moves three commits past main and main moves on, and the author works in a clone with --depth=2 that does not reach their merge base",
		(engine) => {
			for (const count of [2, 3, 4]) {
				writeAll(engine.root, [{ content: `String(${count});\n`, path: "src/short.ts" }]);
				commitAll(engine.root, "Work");
			}
			git(engine.root, "switch", "--quiet", "main");
			writeAll(engine.root, [{ content: "String(1);\n", path: "src/main.ts" }]);
			commitAll(engine.root, "Main moves on");
			git(engine.root, "switch", "--quiet", "work");
			const clone = join(engine.folder, "clone");
			mkdirSync(clone);
			git(clone, "clone", "--quiet", "--depth=2", "--no-single-branch", `file://${engine.root}`, ".");
			linkPackage(clone);
			engine.root = clone;
		},
	);
}
