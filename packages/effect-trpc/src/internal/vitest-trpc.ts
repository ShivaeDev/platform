import type { TestContext, TestOptions } from "@effect/vitest";
import { Cause, type Context, Effect, Exit, Layer, type Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { makeEffectCallerFactory } from "../testing/caller.js";
import type {
	TrpcTest,
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

export const makeTrpcTester = <
	Options,
	Caller extends object,
	Provided,
	LayerError,
>(
	fixtureIt: FixtureTestApi<Provided>,
	options: TrpcTestRuntimeOptions<Options, Caller, Provided, LayerError>,
): TrpcTester<Options, Caller, Provided> => {
	const run = <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		body: (
			trpc: ReturnType<
				typeof makeEffectCallerFactory<Options, Caller, Provided>
			>,
			context: TestContext,
		) => Generator<Eff, A, never>,
		context: TestContext,
	): Effect.Effect<A, unknown, Scope.Scope> => {
		const program = Effect.gen(function* () {
			const services = yield* Effect.context<Provided>();
			const trpc = makeEffectCallerFactory(
				options.adapter,
				options.createCaller,
				services,
			);
			return yield* Effect.gen(() => body(trpc, context));
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
		(current: FixtureTestApi<Provided>): TrpcTest<Options, Caller, Provided> =>
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
	): TrpcTester<Options, Caller, Provided> => {
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
						trpc: ReturnType<
							typeof makeEffectCallerFactory<Options, Caller, Provided>
						>,
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
									(trpc, testContext) => body(item, trpc, testContext),
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
