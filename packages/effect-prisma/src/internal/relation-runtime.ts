import type { Context } from "effect";
import { Effect, Effectable, Option, Stream } from "effect";
import { isPrismaFailure, type PrismaError, toPrismaError } from "../error.js";
import type { Relation } from "../relation.js";
import type {
	AnyPostgresContract,
	DatabaseExecutor,
	ExecutorIdentifier,
} from "./executor.js";
import { fromPrismaPromise } from "./promise.js";
import {
	appendOperation,
	type RelationRecipe,
	replayRecipe,
	rootRecipe,
} from "./recipe.js";
import { RelationPlanTypeId } from "./relation-plan.js";

type AnyFunction = (...arguments_: ReadonlyArray<never>) => unknown;

interface RelationRuntime<
	Models extends object,
	Contract extends AnyPostgresContract,
> {
	readonly executor: Context.Service<
		ExecutorIdentifier<Models>,
		DatabaseExecutor<Models, Contract>
	>;
	readonly recipe: RelationRecipe;
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

interface RelationValue<
	Models extends object,
	Contract extends AnyPostgresContract,
> extends Effect.Effect<unknown, PrismaError, ExecutorIdentifier<Models>> {
	readonly [RelationPlanTypeId]: {
		readonly recipe: RelationRecipe;
		readonly terminal?: PropertyKey;
	};
	readonly runtime: RelationRuntime<Models, Contract>;
	readonly stream: Stream.Stream<
		unknown,
		PrismaError,
		ExecutorIdentifier<Models>
	>;
}

const relationEffect = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	self: RelationValue<Models, Contract>,
): Effect.Effect<unknown, PrismaError, ExecutorIdentifier<Models>> =>
	Effect.flatMap(self.runtime.executor, (executor) =>
		Effect.suspend(() =>
			evaluateResult(
				replayRecipe(executor.models, self.runtime.recipe),
				self.runtime.terminal,
			),
		),
	).pipe(
		Effect.withSpan(
			`prisma.${self.runtime.recipe.model}.${String(self.runtime.terminal ?? "all")}`,
			{
				kind: "client",
				attributes: {
					"db.system": "postgresql",
					"db.model": self.runtime.recipe.model,
					"db.operation": String(self.runtime.terminal ?? "all"),
				},
			},
		),
	);

const relationStream = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	self: RelationValue<Models, Contract>,
): Stream.Stream<unknown, PrismaError, ExecutorIdentifier<Models>> => {
	const result = Effect.map(self.runtime.executor, (executor) => {
		const collection = replayRecipe(executor.models, self.runtime.recipe);
		if (
			typeof collection !== "object" ||
			collection === null ||
			typeof Reflect.get(collection, "all") !== "function"
		) {
			throw new TypeError("Only collection Relations can be streamed");
		}
		return Reflect.apply(
			Reflect.get(collection, "all") as AnyFunction,
			collection,
			[],
		) as AsyncIterable<unknown>;
	});

	return Stream.unwrap(
		Effect.map(result, (iterable) =>
			Stream.fromAsyncIterable(iterable, (error) => error).pipe(
				Stream.catch((error) =>
					isPrismaFailure(error)
						? Stream.fail(toPrismaError(error))
						: Stream.die(error),
				),
			),
		),
	);
};

const RelationPrototype = {
	...Effectable.Prototype<
		RelationValue<Record<string, unknown>, AnyPostgresContract>
	>({
		label: "EffectPrismaRelation",
		evaluate() {
			return relationEffect(this);
		},
	}),
	get stream(): Stream.Stream<
		unknown,
		PrismaError,
		ExecutorIdentifier<Record<string, unknown>>
	> {
		return relationStream(
			this as RelationValue<Record<string, unknown>, AnyPostgresContract>,
		);
	},
};

const makeRelationProxy = <
	Models extends object,
	Contract extends AnyPostgresContract,
>(
	runtime: RelationRuntime<Models, Contract>,
): unknown => {
	const target = Object.assign(Object.create(RelationPrototype), {
		[RelationPlanTypeId]: {
			recipe: runtime.recipe,
			...(runtime.terminal === undefined ? {} : { terminal: runtime.terminal }),
		},
		runtime,
	}) as RelationValue<Models, Contract>;

	return new Proxy(target, {
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
};

export const makeModelRelation = <
	Collection,
	Models extends object,
	Contract extends AnyPostgresContract = AnyPostgresContract,
>(
	executor: Context.Service<
		ExecutorIdentifier<Models>,
		DatabaseExecutor<Models, Contract>
	>,
	model: string,
): Relation<Collection, ExecutorIdentifier<Models>> =>
	makeRelationProxy({
		executor,
		recipe: rootRecipe(model),
	}) as Relation<Collection, ExecutorIdentifier<Models>>;
