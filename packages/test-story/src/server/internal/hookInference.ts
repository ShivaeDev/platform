import type { Crypto, Effect, Layer, Scope } from "effect";
import type { AnyEffect, HookEffects, HookValue, ServicesOf } from "#internal/hooked.ts";
import type { StoryKitDefinition } from "#storyKit.ts";

export type AfterResults<TStage extends string> = {
	readonly [TKey in TStage]?: Generator<AnyEffect, void, never> | Effect.Effect<void, unknown, unknown> | void;
};

type LayerFor<THooks, TProvided> = [Exclude<ServicesOf<THooks>, Scope.Scope | Crypto.Crypto>] extends [TProvided]
	? unknown
	: { readonly layer: Layer.Layer<Exclude<ServicesOf<THooks>, Scope.Scope | Crypto.Crypto>, unknown, never> };

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
