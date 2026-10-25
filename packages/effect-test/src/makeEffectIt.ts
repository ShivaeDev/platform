import { it as effectIt, type TestContext, type TestOptions } from "@effect/vitest";
import { type Context, Effect, Exit, type Layer, Scope } from "effect";
import { runEffectTest } from "#internal/runEffectTest.ts";
import { type AnyTestLayer, buildTestLayer } from "./anyTestLayer.ts";
import type { EffectClock, EffectTest, EffectTestBody, EffectTester, EffectTestOptions, MakeEffectItOptions, MakeEffectItResult } from "./types.ts";

const FIXTURE_NAME = "__effectTestContext";

type EffectFixture<TProvided> = TestContext & {
	readonly [FIXTURE_NAME]: Context.Context<TProvided>;
};

type FixtureTest<TProvided> = (name: string, options: TestOptions, body: (context: EffectFixture<TProvided>) => Promise<unknown>) => void;

function restoreContext<TProvided>(
	fixture: Context.Context<TProvided>,
	context: Omit<EffectFixture<TProvided>, typeof FIXTURE_NAME>,
): EffectFixture<TProvided> {
	return {
		...context,
		[FIXTURE_NAME]: fixture,
	};
}

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

function makeFixtureIt<TLayer extends AnyTestLayer>(layer: TLayer) {
	return effectIt.extend(FIXTURE_NAME, { scope: "worker" }, async ({}, { onCleanup }) => {
		const scope = Effect.runSync(Scope.make());
		onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));

		try {
			return await Effect.runPromise(buildTestLayer(layer, scope));
		} catch (error) {
			await Effect.runPromise(Scope.close(scope, Exit.void));
			throw error;
		}
	});
}

export function makeEffectIt<THarness, TTestLayer extends AnyTestLayer>(
	options: MakeEffectItOptions<THarness, TTestLayer>,
): MakeEffectItResult<THarness, Layer.Success<TTestLayer>> {
	type Provided = Layer.Success<TTestLayer>;
	const fixtureIt = makeFixtureIt(options.layer);
	const defaultClock = options.clock ?? "test";

	function run<A>(body: EffectTestBody<THarness, Provided, A>, context: EffectFixture<Provided>): Effect.Effect<A, unknown, Scope.Scope> {
		const ready: Effect.Effect<A, unknown, Provided | Scope.Scope> = Effect.gen(function* () {
			const harness = yield* options.makeHarness(context);
			const result = body(harness, context);
			return yield* Effect.isEffect(result) ? result : Effect.gen(() => result);
		});
		const wrapped = options.around?.(ready) ?? ready;
		return wrapped.pipe(Effect.provide(context[FIXTURE_NAME]));
	}

	function register(current: FixtureTest<Provided>): EffectTest<THarness, Provided> {
		return (name, body, testOptions) => {
			const split = splitOptions(testOptions);
			const clock = split.clock ?? defaultClock;
			current(name, split.vitest, ({ __effectTestContext, task, signal, onTestFailed, onTestFinished, skip, annotate, expect, bench }) => {
				const context = restoreContext(__effectTestContext, {
					annotate,
					bench,
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
				fixtureIt.for(cases)(
					name,
					split.vitest,
					(item, { __effectTestContext, task, signal, onTestFailed, onTestFinished, skip, annotate, expect, bench }) => {
						const context = restoreContext(__effectTestContext, {
							annotate,
							bench,
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
}
