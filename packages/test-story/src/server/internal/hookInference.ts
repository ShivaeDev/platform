import type { Effect, Layer, Scope } from "effect";
import type { AnyEffect, Hook, HookEffects, HookValue, ServicesOf } from "#internal/hooked.ts";
import type { StoryKitDefinition } from "#storyKit.ts";

export type AfterResults<TStage extends string> = {
	readonly [TKey in TStage]?: Generator<AnyEffect, void, never> | Effect.Effect<void, unknown, unknown> | void;
};

type LayerFor<THooks, TProvided> = [Exclude<ServicesOf<THooks>, Scope.Scope>] extends [TProvided]
	? unknown
	: { readonly layer: Layer.Layer<Exclude<ServicesOf<THooks>, Scope.Scope>, unknown, never> };

export type InferredDefinition<
	TCreate extends () => unknown,
	TStage extends string,
	TVerbs,
	TProvided,
	TAfter extends AfterResults<TStage>,
	TStep extends AnyEffect,
	TFailed extends AnyEffect,
	TDiagnose extends AnyEffect,
> = Omit<
	StoryKitDefinition<HookValue<ReturnType<TCreate>>, TStage, TVerbs, TProvided, never, Record<never, never>, TStep, TFailed, TDiagnose>,
	"create" | "after"
> & {
	readonly create: TCreate;
	readonly after?: { readonly [TKey in keyof TAfter]: (engine: HookValue<ReturnType<TCreate>>) => TAfter[TKey] };
} & LayerFor<HookEffects<ReturnType<TCreate> | TAfter[keyof TAfter]> | TStep | TFailed | TDiagnose, TProvided>;

// A synchronous after hook has no effect to infer, so TypeScript leaves it at the AnyEffect constraint.
type AfterEffects<TAfter> = { readonly [TKey in keyof TAfter]-?: AnyEffect extends TAfter[TKey] ? never : TAfter[TKey] }[keyof TAfter];

export type LegacyDefinition<
	TEngine,
	TStage extends string,
	TVerbs,
	TProvided,
	TCreate extends AnyEffect,
	TAfter extends { readonly [TKey in TStage]?: AnyEffect },
	TStep extends AnyEffect,
	TFailed extends AnyEffect,
	TDiagnose extends AnyEffect,
> = Omit<StoryKitDefinition<TEngine, TStage, TVerbs, TProvided, TCreate, TAfter, TStep, TFailed, TDiagnose>, "create" | "after"> & {
	readonly create: Hook<[], TCreate, TEngine> & (TEngine extends AnyEffect ? never : unknown);
	readonly after?: { readonly [TKey in keyof TAfter]: Hook<[engine: TEngine], TAfter[TKey] & AnyEffect, void> };
} & LayerFor<TCreate | AfterEffects<TAfter> | TStep | TFailed | TDiagnose, TProvided>;
