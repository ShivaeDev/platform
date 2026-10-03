import { it as effectIt, type TestContext, type TestOptions } from "@effect/vitest";
import { Cause, type Context, Effect, Exit, Layer, Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import type { AnyTestLayer } from "./any-test-layer.ts";
import type { EffectClock, EffectTest, EffectTester, EffectTestOptions, MakeEffectItOptions, MakeEffectItResult } from "./types.ts";

const fixtureName = "__effectTestContext";

type EffectFixture<Provided> = TestContext & {
	readonly [fixtureName]: Context.Context<Provided>;
};

type FixtureTest<Provided> = (name: string, options: TestOptions, body: (context: EffectFixture<Provided>) => Promise<unknown>) => void;

const TestClockEnvironment = Layer.mergeAll(TestConsole.layer, TestClock.layer());
const LiveClockEnvironment = TestConsole.layer;

const environmentFor = (clock: EffectClock) => (clock === "live" ? LiveClockEnvironment : TestClockEnvironment);

const restoreContext = <Provided>(
	fixture: Context.Context<Provided>,
	context: Omit<EffectFixture<Provided>, typeof fixtureName>,
): EffectFixture<Provided> => ({
	...context,
	[fixtureName]: fixture,
});

const runEffectTest = <A, E>(effect: Effect.Effect<A, E, Scope.Scope>, context: TestContext, clock: EffectClock): Promise<A> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const exit = yield* Effect.exit(effect);
			if (Exit.isFailure(exit)) {
				for (const error of Cause.prettyErrors(exit.cause)) {
					yield* Effect.logError(error);
				}
			}
			return yield* exit;
		}).pipe(Effect.scoped, Effect.provide(environmentFor(clock))),
		{ signal: context.signal },
	);

const splitOptions = (
	options: number | EffectTestOptions | undefined,
): {
	readonly vitest: TestOptions;
	readonly clock: EffectClock | undefined;
} => {
	if (typeof options === "number") {
		return { clock: undefined, vitest: { timeout: options } };
	}
	if (options === undefined) {
		return { clock: undefined, vitest: {} };
	}
	const { clock, ...vitest } = options;
	return { clock, vitest };
};

const makeFixtureIt = <Provided, LayerError>(layer: Layer.Layer<Provided, LayerError>) =>
	effectIt.extend(fixtureName, { scope: "worker" }, async ({}, { onCleanup }) => {
		const scope = Effect.runSync(Scope.make());
		onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));

		try {
			return await Effect.runPromise(Layer.buildWithScope(layer, scope));
		} catch (error) {
			await Effect.runPromise(Scope.close(scope, Exit.void));
			throw error;
		}
	});

export const makeEffectIt = <Harness, TestLayer extends AnyTestLayer>(
	options: MakeEffectItOptions<Harness, TestLayer>,
): MakeEffectItResult<Harness, Layer.Success<TestLayer>> => {
	type Provided = Layer.Success<TestLayer>;
	const fixtureIt = makeFixtureIt(options.layer);
	const defaultClock = options.clock ?? "test";

	const run = <A>(
		body: (harness: Harness, context: TestContext) => Generator<Effect.Effect<unknown, unknown, Provided>, A, never>,
		context: EffectFixture<Provided>,
	): Effect.Effect<A, unknown, Scope.Scope> => {
		const ready: Effect.Effect<A, unknown, Provided> = Effect.gen(function* () {
			const harness = yield* options.makeHarness(context);
			return yield* Effect.gen(() => body(harness, context));
		});
		const wrapped = options.around?.(ready) ?? ready;
		return wrapped.pipe(Effect.provide(context[fixtureName]));
	};

	const register =
		(current: FixtureTest<Provided>): EffectTest<Harness, Provided> =>
		(name, body, testOptions) => {
			const split = splitOptions(testOptions);
			const clock = split.clock ?? defaultClock;
			current(name, split.vitest, ({ __effectTestContext, task, signal, onTestFailed, onTestFinished, skip, annotate, expect, _local }) => {
				const context = restoreContext(__effectTestContext, {
					_local,
					annotate,
					expect,
					onTestFailed,
					onTestFinished,
					signal,
					skip,
					task,
				});
				return runEffectTest(run(body, context), context, clock);
			});
		};

	const effectApp: EffectTester<Harness, Provided> = Object.assign(register(fixtureIt), {
		each:
			<Item>(cases: ReadonlyArray<Item>) =>
			<A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
				name: string,
				body: (item: Item, harness: Harness, context: TestContext) => Generator<Eff, A, never>,
				testOptions?: number | EffectTestOptions,
			) => {
				const split = splitOptions(testOptions);
				const clock = split.clock ?? defaultClock;
				fixtureIt.for(cases)(
					name,
					split.vitest,
					(item, { __effectTestContext, task, signal, onTestFailed, onTestFinished, skip, annotate, expect, _local }) => {
						const context = restoreContext(__effectTestContext, {
							_local,
							annotate,
							expect,
							onTestFailed,
							onTestFinished,
							signal,
							skip,
							task,
						});
						return runEffectTest(Effect.asVoid(run((harness, testContext) => body(item, harness, testContext), context)), context, clock);
					},
				);
			},
		fails: register(fixtureIt.fails),
		only: register(fixtureIt.only),
		runIf: (condition: unknown) => register(fixtureIt.runIf(condition)),
		skip: register(fixtureIt.skip),
		skipIf: (condition: unknown) => register(fixtureIt.skipIf(condition)),
	});

	return { effectApp };
};
