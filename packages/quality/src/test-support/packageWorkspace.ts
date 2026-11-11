import { chmodSync } from "node:fs";
import { join } from "node:path";
import { baselineStory, setupRun } from "#test/baselineStory.ts";
import { editedShard, editsPhrase, readOrUndefined, type ShardEdits, sourceOf, writeAll, writeShards } from "#test/recordedDebt.ts";
import { commitAll, git } from "#testing/adapters/git.ts";
import { linkPackage, packageRoot } from "#testing/adapters/tree.ts";

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
			writeAll(engine.root, [
				{ content: `#!/bin/sh\nexec node --conditions=@shivaedev/source ${join(packageRoot, "src", "cli.ts")} "$@"\n`, path: BIN },
			]);
			chmodSync(join(engine.root, BIN), 0o755);
			git(engine.root, "init", "--quiet");
		},
	);
}

export function shardsRecorded() {
	return baselineStory.trait(
		"baseline",
		"the root and package shards record that debt as quality baseline write records it, and git commits them on main",
		(engine) => {
			writeShards(
				engine.root,
				IN_DEBT.map((file) => ({ count: 3, file, rule: "structure/max-lines" })),
			);
			commitAll(engine.root, "Record debt");
		},
	);
}

const SHARD_KEYS = ["path", "rule", "count", "deep"];

export function splitEntry(count: number, deep?: number): string {
	return JSON.stringify({ count, ...(deep === undefined ? {} : { deep }), path: "packages/alpha/src/a.ts", rule: "effect/boundary" }, SHARD_KEYS);
}

function shardOf(lines: readonly string[]): string {
	return lines.map((line) => `${line}\n`).join("");
}

export function shardCommitted(lines: readonly string[]) {
	return baselineStory.trait("baseline", `${ALPHA_SHARD} holds ${lines.join(" and ")}, and git commits it on main`, (engine) => {
		writeAll(engine.root, [{ content: shardOf(lines), path: ALPHA_SHARD }]);
		commitAll(engine.root, "Record debt");
	});
}

export function branchShard(branch: string, lines: readonly string[]) {
	return baselineStory.trait(
		"work",
		`on the branch ${branch} from main, ${ALPHA_SHARD} becomes ${lines.join(" and ")} and the author commits`,
		(engine) => {
			git(engine.root, "switch", "--quiet", "--create", branch, "main");
			writeAll(engine.root, [{ content: shardOf(lines), path: ALPHA_SHARD }]);
			commitAll(engine.root, `Edit debt on ${branch}`);
		},
	);
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
