import type { TestContext } from "@effect/vitest";
import type { Effect, Layer, Scope } from "effect";
import type { EffectClock, EffectTestOptions } from "@shivaedev/test/types.ts";
import { type AnyEffect, type EffectHook, type ErrorOf, type Hook, type HookValue, hooked, type ServicesOf } from "#internal/hooked.ts";
import type { AfterResults, InferredDefinition, LegacyDefinition } from "#internal/hookInference.ts";
import type { LooseDefinition } from "#internal/seed.ts";
import { storyIt } from "#internal/storyIt.ts";
import { type Parts, trait, traits } from "#internal/traits.ts";

export type Trait<TEngine, TStage extends string, R = never> = Parts<TStage, (engine: TEngine) => Effect.Effect<void, unknown, R>>;

type TraitServices<TTrait> = TTrait extends Parts<string, (engine: never) => Effect.Effect<void, unknown, infer R>> ? R : never;

type Needs<TProvided> = Effect.Effect<unknown, unknown, TProvided>;

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
	readonly after?: { readonly [TKey in keyof TAfter]: EffectHook<[engine: TEngine], TAfter[TKey] & AnyEffect, void> };
	readonly around?: <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, unknown, R | NoInfer<TProvided> | Scope.Scope>;
	readonly clock?: EffectClock;
	readonly create: EffectHook<[], TCreate, TEngine>;
	readonly inspect?: (engine: TEngine) => unknown;
	readonly layer?: Layer.Layer<TProvided, unknown, never>;
	readonly name: string;
	readonly outbound?: Readonly<Record<string, string>>;
	readonly run?: RunHooks<TEngine, TStep, TFailed, TDiagnose>;
	readonly runIf?: boolean;
	readonly stages: readonly TStage[];
	readonly verbs: (engine: TEngine, story: Story<TEngine, TStep | TFailed | TDiagnose>) => TVerbs;
}

export type Told<TEngine, TVerbs, TRun extends AnyEffect> = TVerbs & { readonly story: Story<TEngine, TRun> };

export type StoryBody<TEngine, TVerbs, TRun extends AnyEffect, TEffect extends AnyEffect> = (
	told: Told<TEngine, TVerbs, TRun>,
	context: TestContext,
) => Generator<TEffect, unknown, never> | undefined;

export type StoryTest<TEngine, TStage extends string, TVerbs, TRun extends AnyEffect, TProvided> = <
	TEffect extends Needs<TProvided | Scope.Scope> = never,
>(
	name: string,
	given: readonly Trait<TEngine, TStage, TProvided | Scope.Scope>[],
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
	readonly trait: {
		<TEffect extends AnyEffect = never>(
			stage: TStage,
			line: string,
			apply: Hook<[engine: TEngine], TEffect, void>,
		): Trait<TEngine, TStage, ServicesOf<TEffect>>;
		<E, R>(stage: TStage, line: string, apply: (engine: TEngine) => Effect.Effect<void, E, R>): Trait<TEngine, TStage, R>;
	};
	readonly traits: <const TGiven extends readonly Trait<TEngine, TStage, unknown>[]>(
		...given: TGiven
	) => Trait<TEngine, TStage, TraitServices<TGiven[number]>>;
}

export function storyKit<
	TCreate extends () => unknown,
	const TStage extends string = never,
	TVerbs extends object = object,
	TProvided = never,
	TAfter extends AfterResults<TStage> = Record<never, never>,
	TStep extends AnyEffect = never,
	TFailed extends AnyEffect = never,
	TDiagnose extends AnyEffect = never,
>(
	definition: InferredDefinition<TCreate, TStage, TVerbs, TProvided, TAfter, TStep, TFailed, TDiagnose>,
): StoryKit<HookValue<ReturnType<TCreate>>, TStage, TVerbs, TStep | TFailed | TDiagnose, TProvided>;
// Keep explicit engine and effect type arguments accepted by existing kits.
export function storyKit<
	TEngine,
	const TStage extends string = never,
	TVerbs extends object = object,
	TProvided = never,
	TCreate extends AnyEffect = never,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect } = Record<never, never>,
	TStep extends AnyEffect = never,
	TFailed extends AnyEffect = never,
	TDiagnose extends AnyEffect = never,
>(
	definition: LegacyDefinition<TEngine, TStage, TVerbs, TProvided, TCreate, TAfter, TStep, TFailed, TDiagnose>,
): StoryKit<TEngine, TStage, TVerbs, TStep | TFailed | TDiagnose, TProvided>;
export function storyKit(definition: LooseDefinition): unknown {
	return {
		it: storyIt(definition),
		trait: (stage: string, line: string, apply: EffectHook<[engine: unknown], AnyEffect, void>) =>
			trait(stage, line, (engine: unknown) => hooked(() => apply(engine))),
		traits,
	};
}
