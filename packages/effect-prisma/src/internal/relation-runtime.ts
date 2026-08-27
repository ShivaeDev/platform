import { Effect, Effectable, Option, type Stream } from "effect";
import type { PrismaError } from "../error.js";
import type { Relation } from "../relation.js";
import type { AnyPostgresContract, DatabaseExecutor } from "./executor.js";
import { fromPrismaPromise } from "./promise.js";
import { executeQuery } from "./query-execution.js";
import {
	appendOperation,
	type RelationRecipe,
	replayRecipe,
	rootRecipe,
} from "./recipe.js";
import { setRelationPlan } from "./relation-plan.js";
import { makeRelationStream } from "./relation-stream.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;

interface RelationRuntime<
	Models extends object,
	Contract extends AnyPostgresContract,
> {
	readonly executor: DatabaseExecutor<Models, Contract>;
	readonly recipe: RelationRecipe;
	readonly resolveExecutor: Effect.Effect<DatabaseExecutor<Models, Contract>>;
	readonly terminal?: PropertyKey;
}

const evaluateResult = (
	value: unknown,
	terminal: PropertyKey | undefined,
): Effect.Effect<unknown, PrismaError> => {
	if (
		terminal === "count" &&
		typeof value === "object" &&
		value !== null &&
		typeof Reflect.get(value, "aggregate") === "function"
	) {
		const aggregate = Reflect.apply(
			Reflect.get(value, "aggregate") as AnyFunction,
			value,
			[(summary: { count(): unknown }) => ({ count: summary.count() })],
		);
		return fromPrismaPromise(
			() => aggregate as PromiseLike<{ count: number }>,
		).pipe(Effect.map((result) => result.count));
	}

	if (
		terminal === "exists" &&
		typeof value === "object" &&
		value !== null &&
		typeof Reflect.get(value, "first") === "function"
	) {
		const first = Reflect.apply(
			Reflect.get(value, "first") as AnyFunction,
			value,
			[],
		);
		return fromPrismaPromise(() => first as PromiseLike<unknown>).pipe(
			Effect.map((result) => result !== null),
		);
	}

	const executable =
		typeof value === "object" &&
		value !== null &&
		typeof Reflect.get(value, "all") === "function"
			? Reflect.apply(Reflect.get(value, "all") as AnyFunction, value, [])
			: value;

	if (
		typeof executable === "object" &&
		executable !== null &&
		"then" in executable
	) {
		return fromPrismaPromise(() => executable as PromiseLike<unknown>).pipe(
			Effect.map((result) =>
				terminal === "first" ? Option.fromNullishOr(result) : result,
			),
		);
	}

	return Effect.succeed(executable);
};

interface RelationValue extends Effect.Effect<unknown, PrismaError> {
	readonly stream: Stream.Stream<unknown, PrismaError>;
}

const runtimes = new WeakMap<object, unknown>();

const runtimeOf = <Models extends object, Contract extends AnyPostgresContract>(
	self: object,
): RelationRuntime<Models, Contract> => {
	const runtime = runtimes.get(self);
	if (runtime === undefined) {
		throw new TypeError("Relation runtime is unavailable");
	}
	return runtime as RelationRuntime<Models, Contract>;
};

const relationEffect = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	self: RelationValue,
): Effect.Effect<unknown, PrismaError> => {
	const runtime = runtimeOf<Models, Contract>(self);
	return Effect.flatMap(runtime.resolveExecutor, (executor) =>
		executeQuery(
			executor,
			Effect.suspend(() =>
				evaluateResult(
					replayRecipe(executor.models, runtime.recipe, executor.identity),
					runtime.terminal,
				),
			),
		),
	).pipe(
		Effect.withSpan(
			`prisma.${runtime.recipe.model}.${String(runtime.terminal ?? "all")}`,
			{
				kind: "client",
				attributes: {
					"db.system": "postgresql",
					"db.model": runtime.recipe.model,
					"db.operation": String(runtime.terminal ?? "all"),
				},
			},
		),
	);
};

const RelationPrototype = {
	...Effectable.Prototype<RelationValue>({
		label: "EffectPrismaRelation",
		evaluate() {
			return relationEffect(this);
		},
	}),
	get stream(): Stream.Stream<unknown, PrismaError> {
		const relation = this as RelationValue;
		const runtime = runtimeOf<Record<string, unknown>, AnyPostgresContract>(
			relation,
		);
		return makeRelationStream(runtime.resolveExecutor, runtime.recipe);
	},
};

const makeRelationProxy = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	runtime: RelationRuntime<Models, Contract>,
): unknown => {
	const target = Object.create(RelationPrototype) as RelationValue;
	const proxy = new Proxy(target, {
		get(self, property, receiver) {
			if (property === "then") {
				return undefined;
			}
			if (Reflect.has(self, property)) {
				return Reflect.get(self, property, receiver);
			}
			if (property === "exists") {
				return () =>
					makeRelationProxy({
						...runtime,
						terminal: "exists",
					});
			}
			if (property === "count") {
				return () =>
					makeRelationProxy({
						...runtime,
						terminal: "count",
					});
			}
			return (...arguments_: ReadonlyArray<unknown>) =>
				makeRelationProxy({
					...runtime,
					recipe: appendOperation(runtime.recipe, property, arguments_),
					terminal: property,
				});
		},
	});
	const plan = {
		liveness: runtime.executor.liveness,
		owner: runtime.executor.identity,
		recipe: runtime.recipe,
		...(runtime.terminal === undefined ? {} : { terminal: runtime.terminal }),
	};
	for (const value of [target, proxy]) {
		runtimes.set(value, runtime);
		setRelationPlan(value, plan);
	}
	return proxy;
};

export const makeModelRelation = <
	Collection,
	Models extends object,
	ExecutorContract extends AnyPostgresContract = AnyPostgresContract,
	Model extends string = string,
>(
	executor: DatabaseExecutor<Models, ExecutorContract>,
	model: Model,
	resolveExecutor: Effect.Effect<
		DatabaseExecutor<Models, ExecutorContract>
	> = Effect.succeed(executor),
): Relation<Collection, undefined, Model> =>
	makeRelationProxy({
		executor,
		recipe: rootRecipe(model),
		resolveExecutor,
	}) as Relation<Collection, undefined, Model>;
