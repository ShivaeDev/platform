import { chmodSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { runQuality } from "#quality-fixtures/cli.ts";
import { commitAll, git } from "#quality-fixtures/git.ts";
import { writes } from "#quality-fixtures/hookRepository.ts";
import { qualityTree } from "#quality-fixtures/qualityTree.ts";
import { packageRoot } from "#quality-fixtures/tree.ts";

function source(lines: number): string {
	return Array.from({ length: lines }, (_, index) => `String(${index});\n`).join("");
}

function repository(): string {
	const root = qualityTree([
		{
			content: 'export default { sources: ["src", "packages"], rules: { "structure/max-lines": { options: { source: 3 } } } };\n',
			path: "quality.config.ts",
		},
		{
			content: "/quality-baseline.jsonl merge=quality-baseline\n/packages/*/quality-baseline.jsonl merge=quality-baseline\n",
			path: ".gitattributes",
		},
		...["src/root.ts", "packages/alpha/src/a.ts", "packages/alpha/src/b.ts", "packages/alpha/src/c.ts", "packages/beta/src/b.ts"].map((path) => ({
			content: source(6),
			path,
		})),
		{ content: source(1), path: "packages/clean/src/idle.ts" },
	]);
	writes(root, "node_modules/.bin/quality", `#!/bin/sh\nexec node --conditions=source ${join(packageRoot, "src", "cli.ts")} "$@"\n`);
	chmodSync(join(root, "node_modules/.bin/quality"), 0o755);
	git(root, "init", "--quiet");
	return root;
}

export const baselineWorkspace = storyKit({
	clock: "live",
	create: () => Effect.acquireRelease(Effect.sync(repository), (root) => Effect.sync(() => rmSync(root, { force: true, recursive: true }))),
	name: "quality baseline workspace",
	stages: ["recorded"],
	verbs: (root, story) => ({
		checkpoint: (message: string) => Effect.sync(() => commitAll(root, message)),
		cli: (...args: readonly string[]) =>
			Effect.promise(() => {
				story.tell(`quality ${args.join(" ")}`);
				return runQuality(root, ...args);
			}),
		git: (...args: readonly string[]) => Effect.sync(() => git(root, ...args)),
		read: (path: string) => Effect.sync(() => (existsSync(join(root, path)) ? readFileSync(join(root, path), "utf8") : undefined)),
		repair: (path: string, lines = 1) => Effect.sync(() => writes(root, path, source(lines))),
		write: (path: string, text: string) => Effect.sync(() => writes(root, path, text)),
	}),
});

export const recorded = baselineWorkspace.trait("recorded", "existing debt is recorded by Quality", function* (root) {
	const result = yield* Effect.promise(() => runQuality(root, "baseline", "write"));
	if (result.status !== 0) {
		throw new Error(result.stderr || result.stdout);
	}
	commitAll(root, "Record debt");
});
