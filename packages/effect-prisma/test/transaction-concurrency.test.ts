import { it } from "@effect/vitest";
import { Effect, Exit, Fiber, Semaphore, Stream } from "effect";
import { expect } from "vitest";
import type { DatabaseExecutor } from "../src/internal/executor.js";
import { makeModelRelation } from "../src/internal/relation-runtime.js";
import {
	ControlledCollection,
	EventStreamCollection,
} from "./support/controlled-collection.js";

interface User {
	readonly id: number;
}

const rows: ReadonlyArray<User> = [{ id: 1 }, { id: 2 }, { id: 3 }];

interface Models {
	readonly User: ControlledCollection<User>;
}

const makeExecutor = (
	execute: () => Promise<Array<User>>,
	querySemaphore?: Semaphore.Semaphore,
): DatabaseExecutor<Models> => ({
	client: {} as DatabaseExecutor<Models>["client"],
	liveness: { closedCode: "RUNTIME.TRANSACTION_CLOSED", open: true },
	mode: querySemaphore === undefined ? "root" : "transaction",
	models: { User: new ControlledCollection(execute) },
	querySemaphore,
	transactionSemaphore: undefined,
});

const relation = (executor: DatabaseExecutor<Models>) =>
	makeModelRelation<ControlledCollection<User>, Models>(executor, "User");

it.effect("does not serialize queries outside a transaction", () => {
	let active = 0;
	let maximumActive = 0;
	let started = 0;
	let releaseQueries!: () => void;
	let bothStarted!: () => void;
	const released = new Promise<void>((resolve) => {
		releaseQueries = resolve;
	});
	const startedTwice = new Promise<void>((resolve) => {
		bothStarted = resolve;
	});
	const execute = async () => {
		active += 1;
		started += 1;
		maximumActive = Math.max(maximumActive, active);
		if (started === 2) {
			bothStarted();
		}
		try {
			await released;
			return [...rows];
		} finally {
			active -= 1;
		}
	};

	const executor = makeExecutor(execute);
	return Effect.gen(function* () {
		const query = relation(executor);
		const fiber = yield* Effect.forkChild(
			Effect.all([query, query], { concurrency: "unbounded" }),
			{ startImmediately: true },
		);

		yield* Effect.promise(() => startedTwice);
		expect(maximumActive).toBe(2);
		releaseQueries();
		expect(yield* Fiber.join(fiber)).toEqual([rows, rows]);
	});
});

it.effect("serializes queries that share a transaction executor", () => {
	let active = 0;
	let maximumActive = 0;
	let started = 0;
	let releaseFirst!: () => void;
	let firstStarted!: () => void;
	const firstReleased = new Promise<void>((resolve) => {
		releaseFirst = resolve;
	});
	const startedOnce = new Promise<void>((resolve) => {
		firstStarted = resolve;
	});
	const execute = async () => {
		active += 1;
		started += 1;
		maximumActive = Math.max(maximumActive, active);
		if (started === 1) {
			firstStarted();
			await firstReleased;
		}
		active -= 1;
		return [...rows];
	};

	const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));
	return Effect.gen(function* () {
		const query = relation(executor);
		const fiber = yield* Effect.forkChild(
			Effect.all([query, query], { concurrency: "unbounded" }),
			{ startImmediately: true },
		);

		yield* Effect.promise(() => startedOnce);
		yield* Effect.yieldNow;
		expect(started).toBe(1);
		releaseFirst();
		expect(yield* Fiber.join(fiber)).toEqual([rows, rows]);
		expect(maximumActive).toBe(1);
	});
});

it.effect("releases a transaction query permit after failure", () => {
	let attempt = 0;
	const execute = async () => {
		attempt += 1;
		if (attempt === 1) {
			throw new Error("expected query failure");
		}
		return [...rows];
	};

	const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));
	return Effect.gen(function* () {
		const query = relation(executor);
		expect(Exit.isFailure(yield* Effect.exit(query))).toBe(true);
		expect(yield* query).toEqual(rows);
	});
});

it.effect(
	"holds a transaction query permit until interrupted work settles",
	() => {
		let attempt = 0;
		let firstStarted!: () => void;
		let releaseFirst!: () => void;
		const started = new Promise<void>((resolve) => {
			firstStarted = resolve;
		});
		const released = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const execute = async () => {
			attempt += 1;
			if (attempt === 1) {
				firstStarted();
				await released;
			}
			return [...rows];
		};

		const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));
		return Effect.gen(function* () {
			const query = relation(executor);
			const first = yield* Effect.forkChild(query, { startImmediately: true });
			yield* Effect.promise(() => started);
			const interruption = yield* Effect.forkChild(Fiber.interrupt(first), {
				startImmediately: true,
			});
			const second = yield* Effect.forkChild(query, { startImmediately: true });

			yield* Effect.yieldNow;
			expect(attempt).toBe(1);
			releaseFirst();
			yield* Fiber.join(interruption);
			expect(yield* Fiber.join(second)).toEqual(rows);
		});
	},
);

it.effect(
	"buffers a transaction stream before running downstream effects",
	() =>
		Effect.gen(function* () {
			const events: Array<string> = [];
			interface StreamModels {
				readonly Lookup: ControlledCollection<User>;
				readonly Source: EventStreamCollection<User>;
			}
			const executor: DatabaseExecutor<StreamModels> = {
				client: {} as DatabaseExecutor<StreamModels>["client"],
				liveness: {
					closedCode: "RUNTIME.TRANSACTION_CLOSED",
					open: true,
				},
				mode: "transaction",
				models: {
					Lookup: new ControlledCollection(async () => {
						events.push("lookup");
						return [...rows];
					}),
					Source: new EventStreamCollection(rows, events),
				},
				querySemaphore: Semaphore.makeUnsafe(1),
				transactionSemaphore: undefined,
			};
			const source = makeModelRelation<
				EventStreamCollection<User>,
				StreamModels
			>(executor, "Source");
			const lookup = makeModelRelation<
				ControlledCollection<User>,
				StreamModels
			>(executor, "Lookup");

			const result = yield* Stream.runCollect(
				source.stream.pipe(Stream.mapEffect(() => lookup.exists())),
			);

			expect(result).toEqual([true, true, true]);
			expect(events).toEqual([
				"source:start",
				"source:end",
				"lookup",
				"lookup",
				"lookup",
			]);
		}),
);
