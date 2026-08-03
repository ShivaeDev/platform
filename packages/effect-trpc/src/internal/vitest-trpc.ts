import type { TestContext, TestOptions } from "@effect/vitest";
import { Cause, type Context, Effect, Exit, Layer, type Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { makeEffectCallerFactory } from "../testing/caller.js";
import type {
	TrpcHarnessTest,
	TrpcHarnessTester,
	TrpcHarnessTestRuntimeOptions,
	TrpcTester,
	TrpcTestRuntimeOptions,
} from "../testing/types.js";

export const fixtureName = "__effectTrpcContext";

export type TrpcFixture<Provided> = TestContext & {
	readonly [fixtureName]: Context.Context<Provided>;
};

export interface FixtureTestApi<Provided> {
	(
		name: string,
		options: TestOptions,
		body: (context: TrpcFixture<Provided>) => Promise<unknown>,
	): void;
	readonly skip: FixtureTestApi<Provided>;
	readonly skipIf: (condition: unknown) => FixtureTestApi<Provided>;
	readonly runIf: (condition: unknown) => FixtureTestApi<Provided>;
	readonly only: FixtureTestApi<Provided>;
	readonly fails: FixtureTestApi<Provided>;
	readonly for: <Item>(
		cases: ReadonlyArray<Item>,
	) => (
		name: string,
		options: TestOptions,
		body: (item: Item, context: TrpcFixture<Provided>) => Promise<unknown>,
	) => void;
}

const TestEnvironment = Layer.mergeAll(TestConsole.layer, TestClock.layer());

const normalizeTestOptions = (
	options: number | TestOptions | undefined,
): TestOptions =>
	typeof options === "number" ? { timeout: options } : (options ?? {});

const restoreContext = <Provided>(
	fixture: Context.Context<Provided>,
	context: Omit<TrpcFixture<Provided>, typeof fixtureName>,
): TrpcFixture<Provided> =>
	({ ...context, [fixtureName]: fixture }) as TrpcFixture<Provided>;

const contextFrom = <Provided>(
	context: TestContext,
): Context.Context<Provided> => (context as TrpcFixture<Provided>)[fixtureName];

const runEffectTest = <A, E>(
	effect: Effect.Effect<A, E, Scope.Scope>,
	context: TestContext,
): Promise<A> =>
	Effect.runPromise(
		Effect.gen(function* () {
			const exit = yield* Effect.exit(effect);
			if (Exit.isFailure(exit)) {
				for (const error of Cause.prettyErrors(exit.cause)) {
					yield* Effect.logError(error);
				}
			}
			return yield* exit;
		}).pipe(Effect.scoped, Effect.provide(TestEnvironment)),
		{ signal: context.signal },
	);

export const makeTrpcHarnessTester = <
	Options,
	Caller extends object,
	Harness,
	Provided,
	LayerError,
>(
	fixtureIt: FixtureTestApi<Provided>,
	options: TrpcHarnessTestRuntimeOptions<
		Options,
		Caller,
		Harness,
		Provided,
		LayerError
	>,
): TrpcHarnessTester<Harness, Provided> => {
	const run = <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		body: (harness: Harness, context: TestContext) => Generator<Eff, A, never>,
		context: TestContext,
	): Effect.Effect<A, unknown, Scope.Scope> => {
		const program = Effect.gen(function* () {
			const services = yield* Effect.context<Provided>();
			const trpc = makeEffectCallerFactory(
				options.adapter,
				options.createCaller,
				services,
			);
			const harness = yield* options.makeHarness(trpc, context);
			return yield* Effect.gen(() => body(harness, context));
		});
		// The body constraint proves every yielded service is part of Provided.
		// TypeScript cannot reduce that generic generator requirement here.
		const ready = program as Effect.Effect<A, unknown, Provided>;
		const wrapped = options.around?.(ready) ?? ready;
		return wrapped.pipe(
			Effect.provide(contextFrom<Provided>(context)),
		) as Effect.Effect<A, unknown, Scope.Scope>;
	};

	const register =
		(current: FixtureTestApi<Provided>): TrpcHarnessTest<Harness, Provided> =>
		(name, body, testOptions) =>
			current(
				name,
				normalizeTestOptions(testOptions),
				({
					__effectTrpcContext,
					task,
					signal,
					onTestFailed,
					onTestFinished,
					skip,
					annotate,
					expect,
					_local,
				}: TrpcFixture<Provided>) => {
					const context = restoreContext(__effectTrpcContext, {
						task,
						signal,
						onTestFailed,
						onTestFinished,
						skip,
						annotate,
						expect,
						_local,
					});
					return runEffectTest(run(body, context), context);
				},
			);

	const make = (
		current: FixtureTestApi<Provided>,
	): TrpcHarnessTester<Harness, Provided> => {
		const test = register(current);
		return Object.assign(test, {
			skip: register(current.skip),
			skipIf: (condition: unknown) => register(current.skipIf(condition)),
			runIf: (condition: unknown) => register(current.runIf(condition)),
			only: register(current.only),
			each:
				<Item>(cases: ReadonlyArray<Item>) =>
				<A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
					name: string,
					body: (
						item: Item,
						harness: Harness,
						context: TestContext,
					) => Generator<Eff, A, never>,
					testOptions?: number | TestOptions,
				) =>
					fixtureIt.for(cases)(
						name,
						normalizeTestOptions(testOptions),
						(
							item,
							{
								__effectTrpcContext,
								task,
								signal,
								onTestFailed,
								onTestFinished,
								skip,
								annotate,
								expect,
								_local,
							}: TrpcFixture<Provided>,
						) => {
							const context = restoreContext(__effectTrpcContext, {
								task,
								signal,
								onTestFailed,
								onTestFinished,
								skip,
								annotate,
								expect,
								_local,
							});
							return runEffectTest(
								run(
									(harness, testContext) => body(item, harness, testContext),
									context,
								),
								context,
							);
						},
					),
			fails: register(current.fails),
		});
	};

	return make(fixtureIt);
};

export const makeTrpcTester = <
	Options,
	Caller extends object,
	Provided,
	LayerError,
>(
	fixtureIt: FixtureTestApi<Provided>,
	options: TrpcTestRuntimeOptions<Options, Caller, Provided, LayerError>,
): TrpcTester<Options, Caller, Provided> =>
	makeTrpcHarnessTester(fixtureIt, {
		...options,
		makeHarness: (trpc) => Effect.succeed(trpc),
	}) as TrpcTester<Options, Caller, Provided>;
