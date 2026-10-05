import { Cause, Effect } from "effect";
import { type StoryLog, storyLog } from "#storyLog.ts";
import { refused, type Trait, type TraitPart, tellTraits, trait, traits } from "#trait.ts";

export type TargetApply<TTarget, R> = (target: TTarget) => Effect.Effect<void, unknown, R>;

export type TargetTrait<TTarget, R, TStage extends string> = Trait<TStage, TargetApply<TTarget, R>>;

export interface EffectSeedOptions<TTarget, E, R, TStage extends string> {
	readonly after?: Partial<Record<TStage, (target: TTarget) => Effect.Effect<void, E, R>>>;
	readonly log?: StoryLog;
}

export interface EffectStoryKit<TTarget, R, TStage extends string> {
	readonly seed: <E = never>(
		target: TTarget,
		given: readonly TargetTrait<TTarget, R, TStage>[],
		options?: EffectSeedOptions<TTarget, E, R, TStage>,
	) => Effect.Effect<StoryLog, E, R>;
	readonly trait: (stage: TStage, line: string, apply: TargetApply<TTarget, R>) => TargetTrait<TTarget, R, TStage>;
	readonly traits: (...given: readonly TargetTrait<TTarget, R, TStage>[]) => TargetTrait<TTarget, R, TStage>;
}

function applyOrRefuse<TTarget, R, TStage extends string>(
	part: TraitPart<TStage, TargetApply<TTarget, R>>,
	target: TTarget,
): Effect.Effect<void, never, R> {
	return Effect.suspend(() => part.apply(target)).pipe(
		Effect.catchCause((cause) => (Cause.hasInterruptsOnly(cause) ? Effect.interrupt : Effect.die(refused(part.line, Cause.squash(cause))))),
	);
}

function applyStage<TTarget, E, R, TStage extends string>(
	parts: readonly TraitPart<TStage, TargetApply<TTarget, R>>[],
	stage: TStage,
	target: TTarget,
	after: ((target: TTarget) => Effect.Effect<void, E, R>) | undefined,
): Effect.Effect<void, E, R> {
	return Effect.forEach(
		parts.filter((each) => each.stage === stage),
		(part) => applyOrRefuse(part, target),
		{ discard: true },
	).pipe(Effect.andThen(after === undefined ? Effect.void : after(target)));
}

export function effectStoryKit<TTarget, R = never>() {
	return <const TStage extends string>(...stages: readonly [TStage, ...TStage[]]): EffectStoryKit<TTarget, R, TStage> => ({
		seed: (target, given, options) =>
			Effect.gen(function* () {
				const log = options?.log ?? storyLog();
				const parts = tellTraits(log, given);
				for (const stage of stages) {
					yield* applyStage(parts, stage, target, options?.after?.[stage]);
				}
				return log;
			}),
		trait,
		traits,
	});
}
