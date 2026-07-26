import type { TestContext, TestOptions } from "@effect/vitest";
import { Cause, type Context, Effect, Exit, Layer, type Scope } from "effect";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import { withTestTransaction } from "../testing/transaction.js";
import type {
	AnyDatabase,
	DatabaseRequirement,
	DatabaseService,
	DatabaseTest,
	DatabaseTester,
} from "../testing/types.js";

export const fixtureName = "__effectPrismaContext";

export type DatabaseFixture<Provided> = TestContext & {
	readonly [fixtureName]: Context.Context<Provided>;
};

export interface FixtureTestApi<Provided> {
	(
		name: string,
		options: TestOptions,
		body: (context: DatabaseFixture<Provided>) => Promise<unknown>,
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
		body: (item: Item, context: DatabaseFixture<Provided>) => Promise<unknown>,
	) => void;
}

const TestEnvironment = Layer.mergeAll(TestConsole.layer, TestClock.layer());

const contextFrom = <Provided>(
	context: TestContext,
): Context.Context<Provided> =>
	(context as DatabaseFixture<Provided>)[fixtureName];

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

const normalizeTestOptions = (
	options: number | TestOptions | undefined,
): TestOptions =>
	typeof options === "number" ? { timeout: options } : (options ?? {});

const restoreContext = <Provided>(
	fixture: Context.Context<Provided>,
	context: Omit<DatabaseFixture<Provided>, typeof fixtureName>,
): DatabaseFixture<Provided> =>
	({
		...context,
		[fixtureName]: fixture,
	}) as DatabaseFixture<Provided>;

export const makeDatabaseTester = <Database extends AnyDatabase, Provided>(
	fixtureIt: FixtureTestApi<
		Provided | DatabaseRequirement<Database> | Effect.Services<Database>
	>,
	database: Database,
): DatabaseTester<
	Database,
	Provided | DatabaseRequirement<Database> | Effect.Services<Database>
> => {
	type Services =
		| Provided
		| DatabaseRequirement<Database>
		| Effect.Services<Database>;

	const run = <A, Eff extends Effect.Effect<unknown, unknown, Services>>(
		body: (
			database: DatabaseService<Database>,
			context: TestContext,
		) => Generator<Eff, A, never>,
		context: TestContext,
	): Effect.Effect<A, unknown, Scope.Scope> => {
		const effect = withTestTransaction(
			database,
			Effect.gen(function* () {
				const service = yield* database as unknown as Effect.Effect<
					DatabaseService<Database>,
					never,
					Effect.Services<Database>
				>;
				return yield* Effect.gen(() => body(service, context));
			}),
		).pipe(Effect.provide(contextFrom<Services>(context)));

		// The callback constraint proves that its services are in the built
		// Layer. TypeScript cannot reduce that generic Exclude after
		// Effect.provide, so the runner closes the type at this private boundary.
		return effect as unknown as Effect.Effect<A, unknown, Scope.Scope>;
	};

	const register =
		(current: FixtureTestApi<Services>): DatabaseTest<Database, Services> =>
		(name, body, options) =>
			current(
				name,
				normalizeTestOptions(options),
				({
					__effectPrismaContext,
					task,
					signal,
					onTestFailed,
					onTestFinished,
					skip,
					annotate,
					expect,
					_local,
				}: DatabaseFixture<Services>) => {
					const testContext = restoreContext(__effectPrismaContext, {
						task,
						signal,
						onTestFailed,
						onTestFinished,
						skip,
						annotate,
						expect,
						_local,
					});
					return runEffectTest(run(body, testContext), testContext);
				},
			);

	const make = (
		current: FixtureTestApi<Services>,
	): DatabaseTester<Database, Services> => {
		const test = register(current);

		return Object.assign(test, {
			skip: register(current.skip),
			skipIf: (condition: unknown) => register(current.skipIf(condition)),
			runIf: (condition: unknown) => register(current.runIf(condition)),
			only: register(current.only),
			each: <Item>(cases: ReadonlyArray<Item>) => {
				return <A, Eff extends Effect.Effect<unknown, unknown, Services>>(
					name: string,
					body: (
						item: Item,
						database: DatabaseService<Database>,
						context: TestContext,
					) => Generator<Eff, A, never>,
					options?: number | TestOptions,
				) =>
					fixtureIt.for(cases)(
						name,
						normalizeTestOptions(options),
						(
							item,
							{
								__effectPrismaContext,
								task,
								signal,
								onTestFailed,
								onTestFinished,
								skip,
								annotate,
								expect,
								_local,
							}: DatabaseFixture<Services>,
						) => {
							const testContext = restoreContext(__effectPrismaContext, {
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
									(service, testContext) => body(item, service, testContext),
									testContext,
								),
								testContext,
							);
						},
					);
			},
			fails: register(current.fails),
		});
	};

	return make(fixtureIt);
};
