import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import ts from "typescript";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { qualityArgs, runQuality } from "./cli.ts";
import { answerOf, type CliAnswer, cliVerbs } from "./cliAnswers.ts";
import { branchOff } from "./git.ts";
import { qualityTree } from "./qualityTree.ts";
import { config, removeSeededTrees } from "./tree.ts";

interface Adoption {
	answer: CliAnswer | undefined;
	original: string;
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
		const engine: Adoption = { answer: undefined, original: "", root };
		return engine;
	},
	inspect: ({ answer }) => ({ answer }),
	name: "Quality adoption",
	stages: ["repository"],
	verbs: (engine, story) => {
		const cli = cliVerbs(engine, story.tell);
		return {
			fix: (rule: string) => cli.runs("fix", "--rule", rule),
			gate: () => Effect.map(cli.runs("lint"), (answer) => answer.outcome),
			originalSource: () => Effect.succeed(engine.original),
			outcome: cli.outcome,
			recordedDebt: () => Effect.sync(() => readFileSync(join(engine.root, "quality-baseline.jsonl"), "utf8")),
			recordsThroughBaselineScript: (rule: string) =>
				Effect.sync(() => {
					story.tell(`the app runs pnpm baseline write --rule ${rule}`);
					const result = spawnSync("pnpm", ["baseline", "write", "--rule", rule, "--file", "src/value.ts"], { cwd: engine.root, encoding: "utf8" });
					engine.answer = answerOf({ status: result.status, stderr: result.stderr, stdout: result.stdout });
					return engine.answer;
				}),
			rendered: (original = false) =>
				Effect.sync(() => {
					const text = original ? engine.original : readFileSync(join(engine.root, "src/View.tsx"), "utf8");
					const javascript = ts.transpile(text, { jsx: ts.JsxEmit.React, jsxFactory: "element", jsxFragmentFactory: "fragment" });
					return new Function(`const fragment = "fragment";\n${javascript}\nreturn [View(-1), View(0), View(2), trace];`)();
				}),
			source: () => Effect.sync(() => readFileSync(join(engine.root, "src/View.tsx"), "utf8")),
			stderr: cli.stderr,
			stdout: cli.stdout,
		};
	},
});

function recordDebt(root: string) {
	return Effect.promise(() => runQuality(root, "baseline", "write")).pipe(
		Effect.flatMap((result) => (result.status === 0 ? Effect.void : Effect.die(new Error(result.stdout + result.stderr)))),
	);
}

export const newRuleDebt = adoption.trait("repository", "the upgrade finds a TODO above the existing baseline", function* (engine) {
	yield* recordDebt(engine.root);
	branchOff(engine.root);
	writeFileSync(join(engine.root, "src/value.ts"), `// TODO: finish the feature\n${readFileSync(join(engine.root, "src/value.ts"), "utf8")}`);
});

export function jsxFixture(source: string) {
	return adoption.trait("repository", "the app has conditional JSX children", (engine) => {
		engine.original = source;
		writeFileSync(join(engine.root, "src/View.tsx"), source);
	});
}

export const baselinedFindings = adoption.trait("repository", "existing findings are already recorded as debt", (engine) => recordDebt(engine.root));
