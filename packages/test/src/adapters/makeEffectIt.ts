import { it as effectIt, type TestContext, type TestOptions } from "@effect/vitest";
import type * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Scope from "effect/Scope";
import { runEffectTest } from "#adapters/runEffectTest.ts";
import { effectOf } from "#effectOf.ts";
import type {
	AnyTestLayer,
	EffectClock,
	EffectTest,
	EffectTestBody,
	EffectTester,
	EffectTestOptions,
	MakeEffectItOptions,
	MakeEffectItResult,
} from "#types.ts";
import { withLive } from "#withLive.ts";

const FIXTURE_NAME = "__effectTestContext";

type EffectFixture<TProvided> = TestContext & {
	readonly [FIXTURE_NAME]: Effect.Effect<Context.Context<TProvided>, unknown>;
};

type FixtureTest<TProvided> = (name: string, options: TestOptions, body: (context: EffectFixture<TProvided>) => Promise<unknown>) => void;

function splitOptions(options: number | EffectTestOptions | undefined): {
	readonly vitest: TestOptions;
	readonly clock: EffectClock | undefined;
} {
	if (typeof options === "number") {
		return { clock: undefined, vitest: { timeout: options } };
	}
	if (options === undefined) {
		return { clock: undefined, vitest: {} };
	}
	const { clock, ...vitest } = options;
	return { clock, vitest };
}

// Layer.empty is also accepted without losing the services of a non-empty Layer.
function buildTestLayer<TLayer extends AnyTestLayer>(
	layer: TLayer,
	scope: Scope.Closeable,
): Effect.Effect<Context.Context<Layer.Success<TLayer>>, unknown>;
function buildTestLayer(layer: Layer.Layer<never, unknown, never>, scope: Scope.Closeable) {
	return Layer.buildWithScope(layer, scope);
}

function makeFixtureIt<TLayer extends AnyTestLayer>(layer: TLayer) {
	return effectIt.extend(FIXTURE_NAME, { scope: "file" }, ({}, { onCleanup }) => {
		const scope = Effect.runSync(Scope.make());
		onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));
		return Effect.runSync(Effect.cached(withLive(buildTestLayer(layer, scope))));
	});
}

export function makeEffectIt<THarness, TTestLayer extends AnyTestLayer>(
	options: MakeEffectItOptions<THarness, TTestLayer>,
): MakeEffectItResult<THarness, Layer.Success<TTestLayer>> {
	type Provided = Layer.Success<TTestLayer>;
	const fixtureIt = makeFixtureIt(options.layer);
	const defaultClock = options.clock ?? "test";

	function run(
		body: EffectTestBody<THarness, Provided>,
		{ task, __effectTestContext }: Pick<EffectFixture<Provided>, "task" | typeof FIXTURE_NAME>,
		clock: EffectClock,
	) {
		const context = task.context;
		const ready = Effect.gen(function* () {
			const harness = yield* options.makeHarness(context);
			return yield* effectOf(body)(harness, context);
		});
		const wrapped = options.around?.(ready) ?? ready;
		return runEffectTest(
			Effect.flatMap(__effectTestContext, (services) => wrapped.pipe(Effect.provide(services), Effect.asVoid)),
			context,
			clock,
		);
	}

	function register(current: FixtureTest<Provided>): EffectTest<THarness, Provided> {
		return (name, body, testOptions) => {
			const split = splitOptions(testOptions);
			const clock = split.clock ?? defaultClock;
			current(name, split.vitest, ({ __effectTestContext, task }) => run(body, { __effectTestContext, task }, clock));
		};
	}

	const effectApp: EffectTester<THarness, Provided> = Object.assign(register(fixtureIt), {
		each:
			<TItem>(cases: readonly TItem[]) =>
			<A, TEff extends Effect.Effect<unknown, unknown, Provided | Scope.Scope>>(
				name: string,
				body: (item: TItem, harness: THarness, context: TestContext) => Generator<TEff, A, never> | Effect.Effect<A, unknown, Provided | Scope.Scope>,
				testOptions?: number | EffectTestOptions,
			) => {
				const split = splitOptions(testOptions);
				const clock = split.clock ?? defaultClock;
				fixtureIt.for(cases)(name, split.vitest, (item, { __effectTestContext, task }) =>
					run((harness, testContext) => body(item, harness, testContext), { __effectTestContext, task }, clock),
				);
			},
		fails: register(fixtureIt.fails),
		only: register(fixtureIt.only),
		runIf: (condition: unknown) => register(fixtureIt.runIf(condition)),
		skip: register(fixtureIt.skip),
		skipIf: (condition: unknown) => register(fixtureIt.skipIf(condition)),
	});

	return { effectApp };
}
