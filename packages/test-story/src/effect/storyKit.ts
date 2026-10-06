import { Effect } from "effect";
import { type AnyEffect, type ErrorOf, type Hook, hooked, type ServicesOf } from "#effect/internal/hooked.ts";
import { runUntil } from "#effect/internal/runUntil.ts";
import { type LooseDefinition, type LooseStory, type LooseTrait, seed } from "#effect/internal/seed.ts";
import { callSite } from "#internal/callSite.ts";
import { narrate } from "#internal/narration.ts";
import { type Parts, trait, traits } from "#internal/traits.ts";
import type { RunUntilOptions } from "#storyKit.ts";

export type EffectTrait<TEngine, TStage extends string, R> = Parts<TStage, (engine: TEngine) => Effect.Effect<void, unknown, R>>;

type TraitServices<TTrait> = TTrait extends Parts<string, (engine: never) => Effect.Effect<void, unknown, infer R>> ? R : never;

export interface EffectStory<TEngine, TRun extends AnyEffect> {
	readonly engine: TEngine;
	readonly lines: readonly string[];
	readonly runUntil: <TUntil extends AnyEffect = never>(
		until: Hook<[engine: TEngine], TUntil, boolean>,
		options?: RunUntilOptions,
	) => Effect.Effect<void, ErrorOf<TRun | TUntil>, ServicesOf<TRun | TUntil>>;
	readonly tell: (line: string) => void;
}

export interface EffectRunHooks<TEngine, TStep extends AnyEffect, TFailed extends AnyEffect, TDiagnose extends AnyEffect> {
	readonly diagnose?: Hook<[engine: TEngine], TDiagnose, string>;
	readonly failed?: Hook<[engine: TEngine], TFailed, string | undefined>;
	readonly maxSteps: number;
	readonly step: Hook<[engine: TEngine, tell: (line: string) => void], TStep, void>;
}

export interface EffectStoryKitDefinition<
	TEngine,
	TStage extends string,
	TVerbs,
	TCreate extends AnyEffect,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect },
	TStep extends AnyEffect,
	TFailed extends AnyEffect,
	TDiagnose extends AnyEffect,
> {
	readonly after?: { readonly [TKey in keyof TAfter]: Hook<[engine: TEngine], TAfter[TKey] & AnyEffect, void> };
	readonly create: Hook<[], TCreate, TEngine>;
	readonly inspect?: (engine: TEngine) => unknown;
	readonly name: string;
	readonly run?: EffectRunHooks<TEngine, TStep, TFailed, TDiagnose>;
	readonly stages: readonly [TStage, ...TStage[]];
	readonly verbs: (engine: TEngine, story: EffectStory<TEngine, TStep | TFailed | TDiagnose>) => TVerbs;
}

export interface EffectStoryKit<TEngine, TStage extends string, TVerbs, TStart extends AnyEffect, TRun extends AnyEffect> {
	readonly start: <const TGiven extends readonly EffectTrait<TEngine, TStage, unknown>[]>(
		...given: TGiven
	) => Effect.Effect<TVerbs & { readonly story: EffectStory<TEngine, TRun> }, ErrorOf<TStart>, ServicesOf<TStart> | TraitServices<TGiven[number]>>;
	readonly trait: <TEffect extends AnyEffect = never>(
		stage: TStage,
		line: string,
		apply: Hook<[engine: TEngine], TEffect, void>,
	) => EffectTrait<TEngine, TStage, ServicesOf<TEffect>>;
	readonly traits: <const TGiven extends readonly EffectTrait<TEngine, TStage, unknown>[]>(
		...given: TGiven
	) => EffectTrait<TEngine, TStage, TraitServices<TGiven[number]>>;
}

interface LooseKit {
	readonly start: (...given: readonly LooseTrait[]) => Effect.Effect<object, unknown, unknown>;
	readonly trait: (stage: string, line: string, apply: Hook<[engine: unknown], AnyEffect, void>) => LooseTrait;
	readonly traits: (...given: readonly LooseTrait[]) => LooseTrait;
}

const start = Effect.fnUntraced(function* (definition: LooseDefinition, given: readonly LooseTrait[]) {
	const engine = yield* hooked(definition.create);
	const narration = narrate({ engine, inspect: definition.inspect, name: definition.name });
	yield* seed(definition, engine, narration, given);
	const story: LooseStory = {
		engine,
		lines: narration.lines,
		runUntil: (until, options) => {
			const site = callSite();
			return runUntil({ engine, name: definition.name, run: definition.run, tell: (line) => narration.tellAt(line, site) }, until, options);
		},
		tell: narration.tell,
	};
	return { ...definition.verbs(engine, story), story };
});

// The implementation works on loose types; the overload states what the definition infers.
export function effectStoryKit<
	TEngine,
	const TStage extends string,
	TVerbs extends object,
	TCreate extends AnyEffect = never,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect } = Record<never, never>,
	TStep extends AnyEffect = never,
	TFailed extends AnyEffect = never,
	TDiagnose extends AnyEffect = never,
>(
	definition: EffectStoryKitDefinition<TEngine, TStage, TVerbs, TCreate, TAfter, TStep, TFailed, TDiagnose>,
): EffectStoryKit<TEngine, TStage, TVerbs, TCreate | Exclude<TAfter[keyof TAfter], undefined>, TStep | TFailed | TDiagnose>;
export function effectStoryKit(definition: LooseDefinition): LooseKit {
	return {
		start: (...given) => start(definition, given),
		trait: (stage, line, apply) => trait(stage, line, (engine) => hooked(() => apply(engine))),
		traits,
	};
}
