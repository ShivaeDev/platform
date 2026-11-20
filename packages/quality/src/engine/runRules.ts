import { Deferred, Effect, Fiber } from "effect";
import { withStoryProgram } from "#adapters/storyProgram.ts";
import { ChildStarted } from "#engine/childStarted.ts";
import { type ActiveRule, runRule } from "#engine/runRule.ts";
import type { Violation } from "#engine/violation.ts";
import type { SetupFailure } from "#failure.ts";
import type { RuleInputs, RuleServices } from "#rule.ts";
import { PACKAGE_CHECKS, withPackageWalk } from "#rules/packageFindings.ts";
import { withSharedTrees } from "#rules/parse.ts";

type RuleRun = Effect.Effect<readonly Violation[], SetupFailure, RuleServices>;

function spawnsChild(rule: ActiveRule): boolean {
	return rule.needs === "child-process";
}

const launched = Effect.fn("Engine.launched")(function* (child: RuleRun) {
	const running = yield* Deferred.make<void>();
	const fiber = yield* Effect.forkChild(Effect.provideService(child, ChildStarted, Deferred.succeed(running, undefined).pipe(Effect.asVoid)));
	return { fiber, started: Effect.raceFirst(Deferred.await(running), Fiber.await(fiber)) };
});

function readsStories(rule: ActiveRule): boolean {
	return rule.needs === "story-program";
}

// A full run checks a rule's deep half as a run of its own in the deep tier; only that half reads the package walk, from the type-checked tier, which starts after the walk, so it may also build programs of its own.
function runsOf(rule: ActiveRule, skippedHalves: ReadonlySet<string>): readonly ActiveRule[] {
	const { deepHalf, ...whole } = rule;
	return deepHalf === undefined || skippedHalves.has(rule.id) ? [rule] : [rule, { ...whole, check: deepHalf.check, depth: "deep", half: "deep" }];
}

function readsWalk(rule: ActiveRule): boolean {
	return PACKAGE_CHECKS.has(rule.id) && rule.deepHalf === undefined;
}

function waitsForWalk(rule: ActiveRule): boolean {
	return readsWalk(rule) && rule.half !== "deep";
}

function checksTypes(rule: ActiveRule): boolean {
	return rule.needs === "type-checker" || rule.half === "deep";
}

// Rules share one Node thread, so only the Biome and Knip child processes run beside the other rules, started first because synchronous rules would starve their preparation; a check that never reports its child as started finishes first. Each type-checker program, the package walk's included, is built alone.
// The rules that read the story program, which spans every source, run one after another so the run drops it after the last of them. Every rule after the type-checking ones shares one tree per source; the trees are created only once those programs are gone, so they never sit on top of one.
function runTiers(rules: readonly ActiveRule[], inputs: RuleInputs): RuleRun {
	function run(rule: ActiveRule): RuleRun {
		return runRule(rule, inputs, inputs.configFile ?? "quality.config.ts");
	}
	function inOrder(runs: readonly RuleRun[]): RuleRun {
		return Effect.map(Effect.all(runs), (found) => found.flat());
	}
	const walked = rules.filter(readsWalk);
	const inThread = rules.filter((rule) => !(waitsForWalk(rule) || spawnsChild(rule) || readsStories(rule)));
	function tiered(typed: boolean): readonly RuleRun[] {
		const ordered = [...inThread.filter((rule) => rule.depth === "fast"), ...inThread.filter((rule) => rule.depth === "deep")];
		return ordered.filter((rule) => checksTypes(rule) === typed).map(run);
	}
	const stories = rules.filter(readsStories).map(run);
	const told = stories.length === 0 ? [] : [withStoryProgram(inputs, inOrder(stories))];
	const thread = [...tiered(true), withSharedTrees(inputs, inOrder([...tiered(false), ...told]))];
	function lanes(steps: readonly RuleRun[]): RuleRun {
		return Effect.gen(function* () {
			const children = yield* Effect.forEach(rules.filter(spawnsChild).map(run), launched);
			yield* Effect.forEach(children, ({ started }) => started, { concurrency: "unbounded" });
			const found = yield* inOrder(steps);
			return [...(yield* Effect.forEach(children, ({ fiber }) => Fiber.join(fiber))).flat(), ...found];
		});
	}
	if (walked.length === 0) {
		return lanes(thread);
	}
	return withPackageWalk(inputs, new Set(walked.map((rule) => rule.id)), (walk) =>
		Effect.map(
			Effect.all([lanes([Effect.as(walk, []), ...thread]), Effect.all(walked.filter(waitsForWalk).map(run), { concurrency: "unbounded" })], {
				concurrency: "unbounded",
			}),
			([laned, waited]) => [...laned, ...waited.flat()],
		),
	);
}

export const runRules = Effect.fn("Engine.runRules")(function* (
	rules: readonly ActiveRule[],
	inputs: RuleInputs,
	skippedHalves: ReadonlySet<string> = new Set(),
) {
	const validation = rules.find((rule) => rule.id === "manifests/valid");
	if (validation !== undefined) {
		const failures = yield* runRule(validation, inputs, inputs.configFile ?? "quality.config.ts");
		if (failures.length > 0) {
			return failures;
		}
	}
	const results = yield* runTiers(
		rules.filter((rule) => rule !== validation).flatMap((rule) => runsOf(rule, skippedHalves)),
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
