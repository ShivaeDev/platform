import type { Context, Crypto, Layer, Scope } from "effect";
import type { AnyEffect, HookEffects, HookValue, ServicesOf } from "#server/hooked.ts";
import type { StoryKitDefinition } from "#server/storyKit.ts";

export type AfterResults<TStage extends string> = {
	readonly [TKey in TStage]?: unknown;
};

type ContextServices<T> = T extends Context.Context<infer R> ? R : never;
export type AfterServices<TAfter> = { [TKey in keyof TAfter]: ContextServices<HookValue<TAfter[TKey]>> }[keyof TAfter];

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
	TInspect extends (engine: HookValue<ReturnType<TCreate>>) => unknown,
> = Omit<
	StoryKitDefinition<HookValue<ReturnType<TCreate>>, TStage, TVerbs, TProvided, never, Record<never, never>, TStep, TFailed, TDiagnose>,
	"create" | "after" | "inspect"
> & {
	readonly create: TCreate;
	readonly inspect?: TInspect;
	readonly after?: { readonly [TKey in keyof TAfter]: (engine: HookValue<ReturnType<TCreate>>) => TAfter[TKey] };
} & LayerFor<HookEffects<ReturnType<TCreate>>, TProvided> &
	LayerFor<HookEffects<TAfter[keyof TAfter]> | TStep | TFailed | TDiagnose | HookEffects<ReturnType<TInspect>>, TProvided | AfterServices<TAfter>>;
