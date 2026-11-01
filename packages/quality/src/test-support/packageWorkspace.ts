import { chmodSync } from "node:fs";
import { join } from "node:path";
import { baselineStory, setupRun } from "./baselineStory.ts";
import { commitAll, git } from "./git.ts";
import { formatTree } from "./qualityTree.ts";
import { editedShard, editsPhrase, readOrUndefined, type ShardEdits, sourceOf, writeAll } from "./recordedDebt.ts";
import { linkPackage, packageRoot } from "./tree.ts";

export const ALPHA_SHARD = "packages/alpha/quality-baseline.jsonl";

const IN_DEBT = ["src/root.ts", "packages/alpha/src/a.ts", "packages/alpha/src/b.ts", "packages/alpha/src/c.ts", "packages/beta/src/b.ts"];

const BIN = "node_modules/.bin/quality";

export function packageWorkspace() {
	return baselineStory.trait(
		"repository",
		"a git repository whose src/root.ts, packages/alpha/src/a.ts, b.ts and c.ts and packages/beta/src/b.ts each run 3 lines over the 3-line limit, packages/clean stays within it, .gitattributes routes every baseline shard to the quality-baseline merge driver and node_modules/.bin/quality runs this package",
		(engine) => {
			writeAll(engine.root, [
				{ content: "node_modules/\n", path: ".gitignore" },
				{ content: '{ "extends": ["@shivaedev/quality/biome/preset.json"] }\n', path: "biome.json" },
				{
					content: 'export default { rules: { "structure/max-lines": { options: { source: 3 } } }, sources: ["src", "packages"] };\n',
					path: "quality.config.ts",
				},
				{
					content: "/quality-baseline.jsonl merge=quality-baseline\n/packages/*/quality-baseline.jsonl merge=quality-baseline\n",
					path: ".gitattributes",
				},
				...IN_DEBT.map((path) => ({ content: sourceOf(6), path })),
				{ content: sourceOf(1), path: "packages/clean/src/idle.ts" },
			]);
			linkPackage(engine.root);
			formatTree(engine.root);
			writeAll(engine.root, [{ content: `#!/bin/sh\nexec node --conditions=source ${join(packageRoot, "src", "cli.ts")} "$@"\n`, path: BIN }]);
			chmodSync(join(engine.root, BIN), 0o755);
			git(engine.root, "init", "--quiet");
		},
	);
}

export function shardsRecorded() {
	return baselineStory.trait("baseline", "quality baseline write records that debt, and git commits it on main", function* (engine) {
		yield* setupRun(engine, "baseline", "write");
		commitAll(engine.root, "Record debt");
	});
}

export function driverInstalled() {
	return baselineStory.trait("history", "quality baseline install-driver configures the quality-baseline merge driver", (engine) =>
		setupRun(engine, "baseline", "install-driver"),
	);
}

export function branchEdits(branch: string, edits: ShardEdits) {
	const line = `on the branch ${branch} from main, the author ${editsPhrase(edits)} in ${ALPHA_SHARD} and commits`;
	return baselineStory.trait("work", line, (engine) => {
		git(engine.root, "switch", "--quiet", "--create", branch, "main");
		writeAll(engine.root, [
			{ content: editedShard(readOrUndefined(engine.root, ALPHA_SHARD) ?? "", "packages/alpha/src/", edits), path: ALPHA_SHARD },
		]);
		commitAll(engine.root, `Edit debt on ${branch}`);
	});
}

export function merged(branch: string) {
	return baselineStory.trait("work", `git merges ${branch} into the current branch through the driver`, (engine) => {
		git(engine.root, "merge", "--quiet", "--no-edit", branch);
	});
}

export function branchWrites(branch: string, path: string, content: string) {
	return baselineStory.trait("work", `on ${branch}, the author writes ${path} and commits`, (engine) => {
		git(engine.root, "switch", "--quiet", branch);
		writeAll(engine.root, [{ content, path }]);
		commitAll(engine.root, `Write ${path} on ${branch}`);
	});
}
