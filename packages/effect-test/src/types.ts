import type { TestContext, TestOptions } from "@effect/vitest";
import type { Effect, Layer } from "effect";
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
	readonly skip: EffectTest<Harness, Provided>;
	readonly skipIf: (condition: unknown) => EffectTest<Harness, Provided>;
	readonly runIf: (condition: unknown) => EffectTest<Harness, Provided>;
	readonly only: EffectTest<Harness, Provided>;
	readonly each: <Item>(
		cases: ReadonlyArray<Item>,
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (item: Item, harness: Harness, context: TestContext) => Generator<Eff, A, never>,
		options?: number | EffectTestOptions,
	) => void;
	readonly fails: EffectTest<Harness, Provided>;
}

export interface MakeEffectItOptions<Harness, TestLayer extends AnyTestLayer> {
	readonly layer: TestLayer;
	readonly around?:
		| (<A, E>(effect: Effect.Effect<A, E, Layer.Success<TestLayer>>) => Effect.Effect<A, unknown, Layer.Success<TestLayer>>)
		| undefined;
	readonly makeHarness: (context: TestContext) => Effect.Effect<Harness, unknown, Layer.Success<TestLayer>>;
	readonly clock?: EffectClock | undefined;
}

export interface MakeEffectItResult<Harness, Provided> {
	readonly effectApp: EffectTester<Harness, Provided>;
}
