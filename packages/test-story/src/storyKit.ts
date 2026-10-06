import type { TestContext } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { EffectTestOptions } from "@shivaedev/effect-test/types.ts";
import { type AnyEffect, type ErrorOf, type Hook, hooked, type ServicesOf } from "#internal/hooked.ts";
import type { LooseDefinition, LooseTrait } from "#internal/seed.ts";
import { type LooseIt, storyIt } from "#internal/storyIt.ts";
import { type Parts, trait, traits } from "#internal/traits.ts";

export type Trait<TEngine, TStage extends string, R = never> = Parts<TStage, (engine: TEngine) => Effect.Effect<void, unknown, R>>;

type TraitServices<TTrait> = TTrait extends Parts<string, (engine: never) => Effect.Effect<void, unknown, infer R>> ? R : never;

type Needs<TProvided> = Effect.Effect<unknown, unknown, TProvided>;

// A plain after hook yields nothing to infer, so TypeScript leaves its effect at the AnyEffect constraint.
type AfterEffects<TAfter> = { readonly [TKey in keyof TAfter]-?: AnyEffect extends TAfter[TKey] ? never : TAfter[TKey] }[keyof TAfter];

type LayerFor<THooks, TProvided> = [ServicesOf<THooks>] extends [TProvided]
	? unknown
	: { readonly layer: Layer.Layer<ServicesOf<THooks>, unknown, never> };

export interface RunUntilOptions {
	readonly maxSteps?: number | undefined;
}

export interface Story<TEngine, TRun extends AnyEffect = never> {
	readonly engine: TEngine;
	readonly lines: readonly string[];
	readonly runUntil: <TUntil extends AnyEffect = never>(
		until: Hook<[engine: TEngine], TUntil, boolean>,
		options?: RunUntilOptions,
	) => Effect.Effect<void, ErrorOf<TRun | TUntil>, ServicesOf<TRun | TUntil>>;
	readonly tell: (line: string) => void;
}

export interface RunHooks<TEngine, TStep extends AnyEffect, TFailed extends AnyEffect, TDiagnose extends AnyEffect> {
	readonly diagnose?: Hook<[engine: TEngine], TDiagnose, string>;
	readonly failed?: Hook<[engine: TEngine], TFailed, string | undefined>;
	readonly maxSteps: number;
	readonly step: Hook<[engine: TEngine, tell: (line: string) => void], TStep, void>;
}

export interface StoryKitDefinition<
	TEngine,
	TStage extends string,
	TVerbs,
	TProvided,
	TCreate extends AnyEffect,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect },
	TStep extends AnyEffect,
	TFailed extends AnyEffect,
	TDiagnose extends AnyEffect,
> {
	readonly after?: { readonly [TKey in keyof TAfter]: Hook<[engine: TEngine], TAfter[TKey] & AnyEffect, void> };
	readonly create: Hook<[], TCreate, TEngine>;
	readonly inspect?: (engine: TEngine) => unknown;
	readonly layer?: Layer.Layer<TProvided, unknown, never>;
	readonly name: string;
	readonly run?: RunHooks<TEngine, TStep, TFailed, TDiagnose>;
	readonly stages: readonly [TStage, ...TStage[]];
	readonly verbs: (engine: TEngine, story: Story<TEngine, TStep | TFailed | TDiagnose>) => TVerbs;
}

export type Told<TEngine, TVerbs, TRun extends AnyEffect> = TVerbs & { readonly story: Story<TEngine, TRun> };

export type StoryBody<TEngine, TVerbs, TRun extends AnyEffect, TEffect extends AnyEffect> = (
	told: Told<TEngine, TVerbs, TRun>,
	context: TestContext,
) => Generator<TEffect, unknown, never> | undefined;

export type StoryTest<TEngine, TStage extends string, TVerbs, TRun extends AnyEffect, TProvided> = <TEffect extends Needs<TProvided> = never>(
	name: string,
	given: readonly Trait<TEngine, TStage, TProvided>[],
	body?: StoryBody<TEngine, TVerbs, TRun, TEffect>,
	options?: number | EffectTestOptions,
) => void;

export interface StoryIt<TEngine, TStage extends string, TVerbs, TRun extends AnyEffect, TProvided>
	extends StoryTest<TEngine, TStage, TVerbs, TRun, TProvided> {
	readonly fails: StoryTest<TEngine, TStage, TVerbs, TRun, TProvided>;
	readonly only: StoryTest<TEngine, TStage, TVerbs, TRun, TProvided>;
	readonly runIf: (condition: unknown) => StoryTest<TEngine, TStage, TVerbs, TRun, TProvided>;
	readonly skip: StoryTest<TEngine, TStage, TVerbs, TRun, TProvided>;
	readonly skipIf: (condition: unknown) => StoryTest<TEngine, TStage, TVerbs, TRun, TProvided>;
}

export interface StoryKit<TEngine, TStage extends string, TVerbs, TRun extends AnyEffect, TProvided> {
	readonly it: StoryIt<TEngine, TStage, TVerbs, TRun, TProvided>;
	readonly trait: <TEffect extends AnyEffect = never>(
		stage: TStage,
		line: string,
		apply: Hook<[engine: TEngine], TEffect, void>,
	) => Trait<TEngine, TStage, ServicesOf<TEffect>>;
	readonly traits: <const TGiven extends readonly Trait<TEngine, TStage, unknown>[]>(
		...given: TGiven
	) => Trait<TEngine, TStage, TraitServices<TGiven[number]>>;
}

interface LooseKit {
	readonly it: LooseIt;
	readonly trait: (stage: string, line: string, apply: Hook<[engine: unknown], AnyEffect, void>) => LooseTrait;
	readonly traits: (...given: readonly LooseTrait[]) => LooseTrait;
}

// The implementation works on loose types; the overload states what the definition infers.
export function storyKit<
	TEngine,
	const TStage extends string,
	TVerbs extends object,
	TProvided = never,
	TCreate extends AnyEffect = never,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect } = Record<never, never>,
	TStep extends AnyEffect = never,
	TFailed extends AnyEffect = never,
	TDiagnose extends AnyEffect = never,
>(
	definition: StoryKitDefinition<TEngine, TStage, TVerbs, TProvided, TCreate, TAfter, TStep, TFailed, TDiagnose> &
		LayerFor<TCreate | AfterEffects<TAfter> | TStep | TFailed | TDiagnose, TProvided>,
): StoryKit<TEngine, TStage, TVerbs, TStep | TFailed | TDiagnose, TProvided>;
export function storyKit(definition: LooseDefinition): LooseKit {
	return {
		it: storyIt(definition),
		trait: (stage, line, apply) => trait(stage, line, (engine) => hooked(() => apply(engine))),
		traits,
	};
}
