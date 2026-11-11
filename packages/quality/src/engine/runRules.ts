import { Effect } from "effect";
import { withStoryProgram } from "#adapters/storyProgram.ts";
import { type ActiveRule, runRule } from "#engine/runRule.ts";
import type { Violation } from "#engine/violation.ts";
import type { SetupFailure } from "#failure.ts";
import type { RuleInputs, RuleServices } from "#rule.ts";
import { PACKAGE_CHECKS, withPackageWalk } from "#rules/packageFindings.ts";

type RuleRun = Effect.Effect<readonly Violation[], SetupFailure, RuleServices>;

function spawnsChild(rule: ActiveRule): boolean {
	return rule.needs === "child-process" && rule.depth === "fast";
}

function readsStories(rule: ActiveRule): boolean {
	return rule.needs === "story-program";
}

// Rules share one Node thread, so only the Biome and Knip child processes run beside the other rules: each type-checker program, the package walk's included, is built alone.
// The rules that read the story program, which spans every source, run one after another so the run drops it after the last of them.
function runTiers(rules: readonly ActiveRule[], inputs: RuleInputs): RuleRun {
	function run(rule: ActiveRule): RuleRun {
		return runRule(rule, inputs, inputs.configFile ?? "quality.config.ts");
	}
	const walked = rules.filter((rule) => PACKAGE_CHECKS.has(rule.id));
	const inThread = rules.filter((rule) => !(PACKAGE_CHECKS.has(rule.id) || spawnsChild(rule) || readsStories(rule)));
	const stories = rules.filter(readsStories).map(run);
	const told = stories.length === 0 ? [] : [Effect.map(withStoryProgram(inputs, Effect.all(stories)), (found) => found.flat())];
	const fast = [...inThread.filter((rule) => rule.depth === "fast").map(run), ...told];
	const deep = inThread.filter((rule) => rule.depth === "deep").map(run);
	function lanes(thread: readonly RuleRun[]): RuleRun {
		return Effect.map(Effect.all([Effect.all(rules.filter(spawnsChild).map(run)), Effect.all(thread)], { concurrency: 2 }), ([children, inOrder]) => [
			...children.flat(),
			...inOrder.flat(),
		]);
	}
	if (walked.length === 0) {
		return lanes([...fast, ...deep]);
	}
	return withPackageWalk(inputs, new Set(walked.map((rule) => rule.id)), (walk) =>
		Effect.map(
			Effect.all([lanes([Effect.as(walk, []), ...fast, ...deep]), Effect.all(walked.map(run), { concurrency: "unbounded" })], {
				concurrency: "unbounded",
			}),
			([laned, waited]) => [...laned, ...waited.flat()],
		),
	);
}

export const runRules = Effect.fn("Engine.runRules")(function* (rules: readonly ActiveRule[], inputs: RuleInputs) {
	const validation = rules.find((rule) => rule.id === "manifests/valid");
	if (validation !== undefined) {
		const failures = yield* runRule(validation, inputs, inputs.configFile ?? "quality.config.ts");
		if (failures.length > 0) {
			return failures;
		}
	}
	const results = yield* runTiers(
		rules.filter((rule) => rule !== validation),
		inputs,
	);
	const seen = new Set<string>();
	return results.filter((finding) => {
		if (finding.rule !== "manifests/valid") {
			return true;
		}
		const duplicate = seen.has(finding.file);
		seen.add(finding.file);
		return !duplicate;
	});
});
