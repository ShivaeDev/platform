import { Effect, Effectable, type Stream } from "effect";
import type { PrismaError } from "../error.ts";
import type { Relation } from "../relation.ts";
import type { AnyPostgresContract, DatabaseExecutor } from "./executor.ts";
import { executeQuery } from "./query-execution.ts";
import { appendOperation, type RelationRecipe, replayRecipe, rootRecipe } from "./recipe.ts";
import { setRelationPlan } from "./relation-plan.ts";
import { evaluateResult } from "./relation-result.ts";
import { makeRelationStream } from "./relation-stream.ts";

interface RelationRuntime<Models extends object, Contract extends AnyPostgresContract> {
	readonly executor: DatabaseExecutor<Models, Contract>;
	readonly recipe: RelationRecipe;
	readonly resolveExecutor: Effect.Effect<DatabaseExecutor<Models, Contract>, PrismaError>;
	readonly terminal?: PropertyKey;
}

interface RelationValue extends Effect.Effect<unknown, PrismaError> {
	readonly stream: Stream.Stream<unknown, PrismaError>;
}

type AnyRelationRuntime = RelationRuntime<object, AnyPostgresContract>;

const runtimes = new WeakMap<object, AnyRelationRuntime>();

const runtimeOf = (self: object): AnyRelationRuntime => {
	const runtime = runtimes.get(self);
	if (runtime === undefined) {
		throw new TypeError("Relation runtime is unavailable");
	}
	return runtime;
};

const relationEffect = (self: object): Effect.Effect<unknown, PrismaError> => {
	const runtime = runtimeOf(self);
	return Effect.flatMap(runtime.resolveExecutor, (executor) =>
		executeQuery(
			executor,
			Effect.suspend(() =>
				evaluateResult(replayRecipe(executor.models, runtime.recipe, executor.identity, executor.transactionIdentity), runtime.terminal),
			),
		),
	).pipe(
		Effect.withSpan(`prisma.${runtime.recipe.model}.${String(runtime.terminal ?? "all")}`, {
			attributes: {
				"db.model": runtime.recipe.model,
				"db.operation": String(runtime.terminal ?? "all"),
				"db.system": "postgresql",
			},
			kind: "client",
		}),
	);
};

const RelationPrototype = {
	...Effectable.Prototype<RelationValue>({
		evaluate() {
			return relationEffect(this);
		},
		label: "EffectPrismaRelation",
	}),
	get stream(): Stream.Stream<unknown, PrismaError> {
		const runtime = runtimeOf(this);
		return makeRelationStream(runtime.resolveExecutor, runtime.recipe);
	},
};

const makeRelationProxy = (runtime: AnyRelationRuntime): object => {
	const target: object = Object.create(RelationPrototype);
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
		transactionIdentity: runtime.executor.transactionIdentity,
	};
	for (const value of [target, proxy]) {
		runtimes.set(value, runtime);
		setRelationPlan(value, plan);
	}
	return proxy;
};

// The proxy replays every Relation call onto the Prisma collection for `model`, so it has that collection's Relation surface.
function asRelation<Collection, Model extends string>(proxy: object): Relation<Collection, undefined, Model>;
function asRelation(proxy: object): unknown {
	return proxy;
}

export const makeModelRelation = <
	Collection,
	Models extends object,
	ExecutorContract extends AnyPostgresContract = AnyPostgresContract,
	Model extends string = string,
>(
	executor: DatabaseExecutor<Models, ExecutorContract>,
	model: Model,
	resolveExecutor: Effect.Effect<DatabaseExecutor<Models, ExecutorContract>, PrismaError> = Effect.succeed(executor),
): Relation<Collection, undefined, Model> =>
	asRelation<Collection, Model>(
		makeRelationProxy({
			executor,
			recipe: rootRecipe(model),
			resolveExecutor,
		}),
	);
