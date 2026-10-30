import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { qualityArgs, type Run, runQuality } from "./cli.ts";
import { qualityTree } from "./qualityTree.ts";
import { config, removeSeededTrees } from "./tree.ts";

interface Adoption {
	original: string;
	result: Run | undefined;
	readonly root: string;
}

export const adoption = storyKit({
	clock: "live",
	*create() {
		yield* Effect.addFinalizer(() => Effect.sync(removeSeededTrees));
		const root = qualityTree([
			config('{ sources: ["src"] }'),
			{ content: "export function value() { return 1; }", path: "src/value.ts" },
			{ content: JSON.stringify({ scripts: { baseline: `node ${qualityArgs(["baseline"]).join(" ")}` }, type: "module" }), path: "package.json" },
		]);
		const engine: Adoption = { original: "", result: undefined, root };
		return engine;
	},
	name: "Quality adoption",
	stages: ["repository"],
	verbs: (engine, story) => ({
		baseline: (rule: string) =>
			Effect.sync(() => {
				story.tell(`pnpm baseline write --rule ${rule}`);
				const result = spawnSync("pnpm", ["baseline", "write", "--rule", rule], { cwd: engine.root, encoding: "utf8" });
				engine.result = { status: result.status, stderr: result.stderr, stdout: result.stdout };
			}),
		check: () =>
			Effect.promise(async () => {
				story.tell("the app runs quality lint");
				engine.result = await runQuality(engine.root, "lint");
			}),
		fix: (rule: string) =>
			Effect.promise(async () => {
				story.tell(`the app runs quality fix --rule ${rule}`);
				engine.result = await runQuality(engine.root, "fix", "--rule", rule);
			}),
		originalSource: () => Effect.succeed(engine.original),
		output: () => Effect.sync(() => engine.result),
		recordedDebt: () => Effect.sync(() => readFileSync(join(engine.root, "quality-baseline.jsonl"), "utf8")),
		rendered: (original = false) =>
			Effect.sync(() => {
				const text = original ? engine.original : readFileSync(join(engine.root, "src/View.tsx"), "utf8");
				const javascript = ts.transpile(text, { jsx: ts.JsxEmit.React, jsxFactory: "element", jsxFragmentFactory: "fragment" });
				return new Function(`const fragment = "fragment";\n${javascript}\nreturn [View(-1), View(0), View(2), trace];`)();
			}),
		source: () => Effect.sync(() => readFileSync(join(engine.root, "src/View.tsx"), "utf8")),
	}),
});

export const newRuleDebt = adoption.trait("repository", "the upgrade finds a TODO above the existing baseline", function* (engine) {
	const result = yield* Effect.promise(() => runQuality(engine.root, "baseline", "write"));
	if (result.status !== 0) {
		throw new Error(result.stdout + result.stderr);
	}
	writeFileSync(join(engine.root, "src/value.ts"), `// TODO: finish the feature\n${readFileSync(join(engine.root, "src/value.ts"), "utf8")}`);
});

export function jsxFixture(source: string) {
	return adoption.trait("repository", "the app has conditional JSX children", (engine) => {
		engine.original = source;
		writeFileSync(join(engine.root, "src/View.tsx"), source);
	});
}

export const baselinedFindings = adoption.trait("repository", "existing findings are already recorded as debt", function* (engine) {
	const result = yield* Effect.promise(() => runQuality(engine.root, "baseline", "write"));
	if (result.status !== 0) {
		throw new Error(result.stdout + result.stderr);
	}
});
