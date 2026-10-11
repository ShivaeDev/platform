import type { TestContext, TestOptions } from "@effect/vitest";
import type { Effect, Layer, Scope } from "effect";
import type { TestAPI } from "vitest";
import type { AnyTestLayer } from "./any-test-layer.ts";

export type EffectClock = "test" | "live";

export type EffectTestOptions = TestOptions & {
	readonly clock?: EffectClock;
};

export type EffectTestBody<THarness, TProvided, A = unknown> = (
	harness: THarness,
	context: TestContext,
) => Generator<Effect.Effect<unknown, unknown, TProvided | Scope.Scope>, A, never> | Effect.Effect<A, unknown, TProvided | Scope.Scope>;

export type EffectTest<THarness, TProvided> = <A, TEff extends Effect.Effect<unknown, unknown, TProvided | Scope.Scope>>(
	name: string,
	body: (harness: THarness, context: TestContext) => Generator<TEff, A, never> | Effect.Effect<A, unknown, TProvided | Scope.Scope>,
	options?: number | EffectTestOptions,
) => void;

export interface EffectTester<THarness, TProvided> extends EffectTest<THarness, TProvided> {
	readonly each: <TItem>(
		cases: readonly TItem[],
	) => <A, TEff extends Effect.Effect<unknown, unknown, TProvided | Scope.Scope>>(
		name: string,
		body: (item: TItem, harness: THarness, context: TestContext) => Generator<TEff, A, never> | Effect.Effect<A, unknown, TProvided | Scope.Scope>,
		options?: number | EffectTestOptions,
	) => void;
	readonly fails: EffectTest<THarness, TProvided>;
	readonly only: EffectTest<THarness, TProvided>;
	readonly runIf: (condition: unknown) => EffectTest<THarness, TProvided>;
	readonly skip: EffectTest<THarness, TProvided>;
	readonly skipIf: (condition: unknown) => EffectTest<THarness, TProvided>;
}

export interface MakeEffectItOptions<THarness, TTestLayer extends AnyTestLayer> {
	readonly around?:
		| (<A, E>(
				effect: Effect.Effect<A, E, Layer.Success<TTestLayer> | Scope.Scope>,
		  ) => Effect.Effect<A, unknown, Layer.Success<TTestLayer> | Scope.Scope>)
		| undefined;
	readonly clock?: EffectClock | undefined;
	readonly layer: TTestLayer;
	readonly makeHarness: (context: TestContext) => Effect.Effect<THarness, unknown, Layer.Success<TTestLayer> | Scope.Scope>;
}

export interface MakeEffectItResult<THarness, TProvided> {
	readonly effectApp: EffectTester<THarness, TProvided>;
}

export interface EffectItTest<R, TArgs extends readonly unknown[] = [context: TestContext]> {
	<TEffect extends Effect.Effect<unknown, unknown, R>, A>(
		name: string,
		body: (...args: TArgs) => Generator<TEffect, A, never>,
		options?: number | TestOptions,
	): void;
	<A, E>(name: string, body: (...args: TArgs) => Effect.Effect<A, E, R>, options?: number | TestOptions): void;
}

export interface EffectItTester<R> extends EffectItTest<R> {
	readonly each: <TItem>(cases: readonly TItem[]) => EffectItTest<R, [item: TItem]>;
	readonly fails: EffectItTest<R>;
	readonly only: EffectItTest<R>;
	readonly runIf: (condition: unknown) => EffectItTest<R>;
	readonly skip: EffectItTest<R>;
	readonly skipIf: (condition: unknown) => EffectItTest<R>;
}

export type EffectIt = TestAPI & {
	readonly effect: EffectItTester<Scope.Scope>;
	readonly live: EffectItTester<Scope.Scope>;
};
