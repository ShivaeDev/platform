import type { TestContext, TestOptions } from "@effect/vitest";
import type { Effect, Layer, Scope } from "effect";
import type { TestAPI } from "vitest";
import type { AnyTestLayer } from "./any-test-layer.ts";

export type EffectClock = "test" | "live";

export type EffectTestOptions = TestOptions & {
	readonly clock?: EffectClock;
};

export type EffectTest<Harness, Provided> = <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
	name: string,
	body: (harness: Harness, context: TestContext) => Generator<Eff, A, never>,
	options?: number | EffectTestOptions,
) => void;

export interface EffectTester<Harness, Provided> extends EffectTest<Harness, Provided> {
	readonly each: <Item>(
		cases: readonly Item[],
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (item: Item, harness: Harness, context: TestContext) => Generator<Eff, A, never>,
		options?: number | EffectTestOptions,
	) => void;
	readonly fails: EffectTest<Harness, Provided>;
	readonly only: EffectTest<Harness, Provided>;
	readonly runIf: (condition: unknown) => EffectTest<Harness, Provided>;
	readonly skip: EffectTest<Harness, Provided>;
	readonly skipIf: (condition: unknown) => EffectTest<Harness, Provided>;
}

export interface MakeEffectItOptions<Harness, TestLayer extends AnyTestLayer> {
	readonly around?:
		| (<A, E>(effect: Effect.Effect<A, E, Layer.Success<TestLayer>>) => Effect.Effect<A, unknown, Layer.Success<TestLayer>>)
		| undefined;
	readonly clock?: EffectClock | undefined;
	readonly layer: TestLayer;
	readonly makeHarness: (context: TestContext) => Effect.Effect<Harness, unknown, Layer.Success<TestLayer>>;
}

export interface MakeEffectItResult<Harness, Provided> {
	readonly effectApp: EffectTester<Harness, Provided>;
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
