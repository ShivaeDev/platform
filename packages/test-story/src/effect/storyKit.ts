import { Cause, Effect } from "effect";
import { refused } from "#internal/refused.ts";
import { tellTraits, trait, traits } from "#internal/traits.ts";
import { type StoryLog, storyLog } from "#storyLog.ts";
import type { Trait, TraitPart } from "#trait.ts";

export type TargetApply<TTarget, R> = (target: TTarget) => Effect.Effect<void, unknown, R>;

export type TargetTrait<TTarget, R, TStage extends string> = Trait<TStage, TargetApply<TTarget, R>>;

export type AfterHooks<TTarget, R, TErrors> = { readonly [TKey in keyof TErrors]: (target: TTarget) => Effect.Effect<void, TErrors[TKey], R> };

export type StageErrors<TStage extends string> = { readonly [TKey in TStage]?: unknown };

export interface EffectSeedOptions<TAfter> {
	readonly after?: TAfter;
	readonly log?: StoryLog;
}

export interface EffectStoryKit<TTarget, R, TStage extends string> {
	readonly seed: <TErrors extends StageErrors<TStage> = Record<never, never>>(
		target: TTarget,
		given: readonly TargetTrait<TTarget, R, TStage>[],
		options?: EffectSeedOptions<AfterHooks<TTarget, R, TErrors>>,
	) => Effect.Effect<StoryLog, TErrors[keyof TErrors], R>;
	readonly trait: (stage: TStage, line: string, apply: TargetApply<TTarget, R>) => TargetTrait<TTarget, R, TStage>;
	readonly traits: (...given: readonly TargetTrait<TTarget, R, TStage>[]) => TargetTrait<TTarget, R, TStage>;
}

type StageHooks<TTarget, R, TStage extends string> = { readonly [TKey in TStage]?: (target: TTarget) => Effect.Effect<void, unknown, R> };

function applyOrRefuse<TTarget, R, TStage extends string>(
	part: TraitPart<TStage, TargetApply<TTarget, R>>,
	target: TTarget,
): Effect.Effect<void, never, R> {
	return Effect.suspend(() => part.apply(target)).pipe(
		Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.interrupt : Effect.die(refused(part.line, Cause.squash(cause))))),
	);
}

const runStages = Effect.fnUntraced(function* <TTarget, R, TStage extends string>(
	stages: readonly TStage[],
	target: TTarget,
	given: readonly TargetTrait<TTarget, R, TStage>[],
	options: EffectSeedOptions<StageHooks<TTarget, R, TStage>> | undefined,
) {
	const log = options?.log ?? storyLog();
	const parts = tellTraits(log, given);
	for (const stage of stages) {
		for (const part of parts.filter((each) => each.stage === stage)) {
			yield* applyOrRefuse(part, target);
		}
		const after = options?.after?.[stage];
		if (after !== undefined) {
			yield* after(target);
		}
	}
	return log;
});

function seedStages<TTarget, R, TStage extends string, TErrors extends StageErrors<TStage>>(
	stages: readonly TStage[],
	target: TTarget,
	given: readonly TargetTrait<TTarget, R, TStage>[],
	options: EffectSeedOptions<AfterHooks<TTarget, R, TErrors>> | undefined,
): Effect.Effect<StoryLog, TErrors[keyof TErrors], R>;
function seedStages<TTarget, R, TStage extends string>(
	stages: readonly TStage[],
	target: TTarget,
	given: readonly TargetTrait<TTarget, R, TStage>[],
	options: EffectSeedOptions<StageHooks<TTarget, R, TStage>> | undefined,
): Effect.Effect<StoryLog, unknown, R> {
	return runStages(stages, target, given, options);
}

export function effectStoryKit<TTarget, R = never>() {
	return <const TStage extends string>(...stages: readonly [TStage, ...TStage[]]): EffectStoryKit<TTarget, R, TStage> => ({
		seed: (target, given, options) => seedStages(stages, target, given, options),
		trait,
		traits,
	});
}
