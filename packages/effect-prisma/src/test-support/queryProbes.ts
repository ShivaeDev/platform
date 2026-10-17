import { Effect, Exit, Fiber, Semaphore } from "effect";
import type { DatabaseExecutor } from "#internal/executor.ts";
import { makeModelRelation } from "#internal/relation-runtime.ts";
import { ControlledCollection } from "#test/controlled-collection.ts";
import { queryStreamProbes } from "#test/queryStreamProbes.ts";
import { unusedClient } from "#test/unused-client.ts";

interface User {
	readonly id: number;
}
const rows: readonly User[] = [{ id: 1 }, { id: 2 }, { id: 3 }];
interface Models {
	readonly User: ControlledCollection<User>;
}
function makeExecutor(execute: () => Promise<User[]>, querySemaphore?: Semaphore.Semaphore): DatabaseExecutor<Models> {
	return {
		client: unusedClient(),
		identity: {},
		liveness: { closedCode: "RUNTIME.TRANSACTION_CLOSED", open: true },
		mode: querySemaphore === undefined ? "root" : "transaction",
		models: { User: new ControlledCollection(execute) },
		querySemaphore,
		transactionIdentity: querySemaphore === undefined ? undefined : {},
		transactionSemaphore: undefined,
	};
}
function relation(executor: DatabaseExecutor<Models>) {
	return makeModelRelation<ControlledCollection<User>, Models>(executor, "User");
}
const interrupt = Effect.fnUntraced(function* () {
	let attempt = 0;
	let firstStarted!: () => void;
	let releaseFirst!: () => void;
	const started = new Promise<void>((resolve) => {
		firstStarted = resolve;
	});
	const released = new Promise<void>((resolve) => {
		releaseFirst = resolve;
	});
	async function execute() {
		attempt += 1;
		if (attempt === 1) {
			firstStarted();
			await released;
		}
		return Promise.resolve([...rows]);
	}
	const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));

	const query = relation(executor);
	const first = yield* Effect.forkChild(query, { startImmediately: true });
	yield* Effect.promise(() => started);
	const interruption = yield* Effect.forkChild(Fiber.interrupt(first), {
		startImmediately: true,
	});
	const second = yield* Effect.forkChild(query, { startImmediately: true });

	yield* Effect.yieldNow;
	const observedAttemptsBeforeRelease = attempt;
	releaseFirst();
	yield* Fiber.join(interruption);
	const observedRows = yield* Fiber.join(second);
	return { attemptsBeforeRelease: observedAttemptsBeforeRelease, rows: observedRows };
});
const parallel = Effect.fnUntraced(function* () {
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
	async function execute() {
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
	}
	const executor = makeExecutor(execute);

	const query = relation(executor);
	const fiber = yield* Effect.forkChild(Effect.all([query, query], { concurrency: "unbounded" }), { startImmediately: true });

	yield* Effect.promise(() => startedTwice);
	const observedMaximumActive = maximumActive;
	releaseQueries();
	const observedResults = yield* Fiber.join(fiber);
	return { maximumActive: observedMaximumActive, results: observedResults };
});
const retry = Effect.fnUntraced(function* () {
	let attempt = 0;
	function execute() {
		attempt += 1;
		if (attempt === 1) {
			return Promise.reject(new Error("expected query failure"));
		}
		return Promise.resolve([...rows]);
	}
	const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));

	const query = relation(executor);
	const observedFailed = Exit.isFailure(yield* Effect.exit(query));
	const observedRows = yield* query;
	return { failed: observedFailed, rows: observedRows };
});
const serialized = Effect.fnUntraced(function* () {
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
	async function execute() {
		active += 1;
		started += 1;
		maximumActive = Math.max(maximumActive, active);
		if (started === 1) {
			firstStarted();
			await firstReleased;
		}
		active -= 1;
		return Promise.resolve([...rows]);
	}
	const executor = makeExecutor(execute, Semaphore.makeUnsafe(1));

	const query = relation(executor);
	const fiber = yield* Effect.forkChild(Effect.all([query, query], { concurrency: "unbounded" }), { startImmediately: true });

	yield* Effect.promise(() => startedOnce);
	yield* Effect.yieldNow;
	const observedStartedBeforeRelease = started;
	releaseFirst();
	const observedResults = yield* Fiber.join(fiber);
	const observedMaximumActive = maximumActive;
	return { maximumActive: observedMaximumActive, results: observedResults, startedBeforeRelease: observedStartedBeforeRelease };
});
export function queryProbes() {
	return { ...queryStreamProbes(), interrupt, parallel, retry, serialized };
}
