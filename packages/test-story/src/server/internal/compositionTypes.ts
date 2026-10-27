import type { AnyEffect } from "#internal/hooked.ts";
import type { LooseDefinition } from "#internal/seed.ts";
import type { StoryKit } from "#storyKit.ts";

export const kitDefinition: unique symbol = Symbol("story kit definition");

export interface KitDefinition<TEngine, TStage extends string, TVerbs, TRun extends AnyEffect, TProvided> extends LooseDefinition {
	readonly engineType?: TEngine;
	readonly providedType?: TProvided;
	readonly runType?: TRun;
	readonly stages: readonly TStage[];
	readonly verbsType?: TVerbs;
}

export interface ComposableKit {
	readonly [kitDefinition]: KitDefinition<object, string, object, AnyEffect, unknown>;
}

export type KitList = readonly [ComposableKit, ...ComposableKit[]];

type Definition<TKit extends ComposableKit> = TKit[typeof kitDefinition];
type Engine<TKit extends ComposableKit> = NonNullable<Definition<TKit>["engineType"]>;
type Verbs<TKit extends ComposableKit> = NonNullable<Definition<TKit>["verbsType"]>;
type Stages<TKit extends ComposableKit> = Definition<TKit>["stages"][number];

type Combined<TKits extends readonly ComposableKit[], TKey extends "engineType" | "verbsType"> = TKits extends readonly [
	infer TFirst extends ComposableKit,
	...infer TRest extends readonly ComposableKit[],
]
	? NonNullable<Definition<TFirst>[TKey]> & Combined<TRest, TKey>
	: object;

type Collision<TNames, TMessage extends string> = [TNames] extends [never] ? unknown : { readonly [TKey in TMessage]: TNames };

type Check<TKits extends readonly ComposableKit[], TEngines = never, TVerbs = never, TStages = never> = TKits extends readonly [
	infer TFirst extends ComposableKit,
	...infer TRest extends readonly ComposableKit[],
]
	? Collision<keyof Engine<TFirst> & TEngines, "Cannot compose story kits: duplicate engine fields"> &
			Collision<keyof Verbs<TFirst> & TVerbs, "Cannot compose story kits: duplicate verb names"> &
			Collision<Stages<TFirst> & TStages, "Cannot compose story kits: duplicate trait stage names"> &
			Check<TRest, TEngines | keyof Engine<TFirst>, TVerbs | keyof Verbs<TFirst>, TStages | Stages<TFirst>>
	: unknown;

export interface Composition<TKits extends KitList> {
	readonly extends: TKits & Check<TKits>;
	readonly name: string;
}

export type ComposedKit<TKits extends KitList> = StoryKit<
	Combined<TKits, "engineType">,
	Stages<TKits[number]>,
	Combined<TKits, "verbsType">,
	Exclude<Definition<TKits[number]>["runType"], undefined>,
	Exclude<Definition<TKits[number]>["providedType"], undefined>
>;
