import { it } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Option, Stream } from "effect";
import { expect } from "vitest";
import {
	acquireConnectedClient,
	assertAvailableModelNames,
} from "../src/internal/client-lifecycle.js";
import type {
	DatabaseExecutor,
	ExecutorIdentifier,
} from "../src/internal/executor.js";
import { fromPrismaPromise } from "../src/internal/promise.js";
import { makeModelRelation } from "../src/internal/relation-runtime.js";

interface User {
	readonly id: number;
	readonly active: boolean;
}

class FakeResult<Row> implements PromiseLike<Array<Row>>, AsyncIterable<Row> {
	constructor(private readonly rows: ReadonlyArray<Row>) {}

	// biome-ignore lint/suspicious/noThenProperty: This test double intentionally matches Prisma's PromiseLike result.
	then<TResult1 = Array<Row>, TResult2 = never>(
		onfulfilled?:
			| ((value: Array<Row>) => TResult1 | PromiseLike<TResult1>)
			| null,
		onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
	): PromiseLike<TResult1 | TResult2> {
		return Promise.resolve([...this.rows]).then(onfulfilled, onrejected);
	}

	async *[Symbol.asyncIterator](): AsyncIterator<Row> {
		for (const row of this.rows) {
			yield row;
		}
	}
}

class FakeCollection<Row extends object> {
	constructor(
		private readonly rows: ReadonlyArray<Row>,
		private readonly limit?: number,
	) {}

	where(filter: Partial<Row>): FakeCollection<Row> {
		return new FakeCollection(
			this.rows.filter((row) =>
				Object.entries(filter).every(
					([key, value]) => Reflect.get(row, key) === value,
				),
			),
			this.limit,
		);
	}

	take(limit: number): FakeCollection<Row> {
		return new FakeCollection(this.rows, limit);
	}

	all(): FakeResult<Row> {
		return new FakeResult(
			this.limit === undefined ? this.rows : this.rows.slice(0, this.limit),
		);
	}

	async first(): Promise<Row | null> {
		return (
			(this.limit === undefined
				? this.rows[0]
				: this.rows.slice(0, this.limit)[0]) ?? null
		);
	}
}

interface Models {
	readonly User: FakeCollection<User>;
}

const Executor = Context.Service<
	ExecutorIdentifier<Models>,
	DatabaseExecutor<Models>
>("@test/Executor");

const rows: ReadonlyArray<User> = [
	{ id: 1, active: true },
	{ id: 2, active: false },
	{ id: 3, active: true },
];

const executor: DatabaseExecutor<Models> = {
	client: {} as DatabaseExecutor<Models>["client"],
	models: {
		User: new FakeCollection(rows),
	},
	querySemaphore: undefined,
	transactional: false,
};

const provideExecutor = <A, E>(
	effect: Effect.Effect<A, E, ExecutorIdentifier<Models>>,
): Effect.Effect<A, E> => Effect.provideService(effect, Executor, executor);

it.effect("adapts a Prisma-shaped thenable", () =>
	Effect.gen(function* () {
		const result = yield* fromPrismaPromise(
			() => new FakeResult([{ id: 1, active: true }]),
		);
		expect(result).toEqual([{ id: 1, active: true }]);
	}),
);

it.effect("keeps unknown Promise rejections in the defect channel", () =>
	Effect.gen(function* () {
		const exit = yield* Effect.exit(
			fromPrismaPromise(() => Promise.reject(new Error("unknown"))),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		if (Exit.isFailure(exit)) {
			expect(Cause.hasDies(exit.cause)).toBe(true);
		}
	}),
);

it.effect("closes a connected client when initialization fails", () =>
	Effect.gen(function* () {
		let closed = false;
		const failure = new Error("model discovery failed");

		const exit = yield* Effect.exit(
			Effect.promise(() =>
				acquireConnectedClient(
					{
						connect: () => Promise.resolve(),
						close: () => {
							closed = true;
							return Promise.resolve();
						},
					},
					() => {
						throw failure;
					},
				),
			),
		);

		expect(Exit.isFailure(exit)).toBe(true);
		expect(closed).toBe(true);
	}),
);

it("only reserves names that cannot be represented by the facade", () => {
	expect(() => assertAvailableModelNames(["transaction"])).toThrow(
		"Prisma model name conflicts with the database facade: transaction",
	);
	expect(() =>
		assertAvailableModelNames(["constructor", "toString"]),
	).not.toThrow();
});

it.effect("keeps a base Relation and its branches independent", () =>
	Effect.gen(function* () {
		const base = makeModelRelation<FakeCollection<User>, Models>(
			Executor,
			"User",
		);
		const active = base.where({ active: true });
		const firstActive = active.take(1);

		expect(yield* base).toEqual(rows);
		expect(yield* active).toEqual([rows[0], rows[2]]);
		expect(yield* firstActive).toEqual([rows[0]]);
		expect(yield* base).toEqual(rows);
	}).pipe(provideExecutor),
);

it.effect("can execute multiple terminals against one Relation", () =>
	Effect.gen(function* () {
		const relation = makeModelRelation<FakeCollection<User>, Models>(
			Executor,
			"User",
		).where({ active: true });

		expect(yield* relation.exists()).toBe(true);
		expect(yield* relation).toEqual([rows[0], rows[2]]);

		const first = yield* relation.first();
		expect(Option.getOrThrow(first)).toEqual(rows[0]);
	}).pipe(provideExecutor),
);

it.effect("replays one Relation independently under concurrency", () =>
	Effect.gen(function* () {
		const relation = makeModelRelation<FakeCollection<User>, Models>(
			Executor,
			"User",
		).where({ active: true });

		const results = yield* Effect.all([relation, relation], {
			concurrency: "unbounded",
		});

		expect(results).toEqual([
			[rows[0], rows[2]],
			[rows[0], rows[2]],
		]);
	}).pipe(provideExecutor),
);

it.effect("exposes a cold independently consumable Stream", () =>
	Effect.gen(function* () {
		const relation = makeModelRelation<FakeCollection<User>, Models>(
			Executor,
			"User",
		).where({ active: true });

		const first = yield* Stream.runCollect(relation.stream);
		const second = yield* Stream.runCollect(relation.stream);

		expect(first).toEqual([rows[0], rows[2]]);
		expect(second).toEqual(first);
	}).pipe(provideExecutor),
);
