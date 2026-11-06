import { Effect, Fiber, Option, Queue, Schema, Stream } from "effect";
import { TestClock } from "effect/testing";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { querySubscription } from "@shivaedev/contract/querySubscription.ts";
import { changesRpc } from "@shivaedev/contract/serverMetadata.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { ChangeObserver } from "#transact.ts";
import { bucketRows } from "./bucketRows.ts";
import { onPostgres } from "./engines.ts";

const readerEngine = Effect.fnUntraced(function* () {
	const { keys, rows } = yield* bucketRows;
	const first = yield* rows.insert({ listId: 0, owner: "alice", slug: "first" });
	const second = yield* rows.insert({ listId: 0, owner: "alice", slug: "second" });
	yield* rows.insert({ listId: 1, owner: "bob", slug: "private" });
	const viewer = Option.some({ id: "alice" });
	function allowed(_input: unknown, current: typeof viewer) {
		return Effect.succeed(Option.isSome(current) && current.value.id === "alice");
	}
	const queries = [
		query("item", { readPolicy: allowed, reads: () => [keys.item(first.id)], success: Schema.Array(Schema.Number) }),
		query("bucket", { readPolicy: allowed, reads: () => [keys.bucket.owner("alice")], success: Schema.Array(Schema.Number) }),
		query("all", { readPolicy: () => Effect.succeed(false), reads: () => [keys.list], success: Schema.Array(Schema.Number) }),
	];
	const rpc = changesRpc("retention", queries);
	const live = yield* makeLiveServer;
	const subscribe = Effect.fnUntraced(function* (name: "item" | "bucket") {
		const subscription = yield* querySubscription(rpc, [{ payload: undefined, query: name }], viewer);
		const delivered = yield* Queue.unbounded<readonly number[]>();
		const read = rows.findMany({ orderBy: { direction: "asc", field: "id" }, where: name === "item" ? { id: first.id } : { owner: "alice" } }).pipe(
			Effect.map((current) => current.map(({ id }) => id)),
			Effect.orDie,
		);
		yield* live
			.subscribe(subscription, () => read)
			.pipe(
				Stream.filter((update) => update._tag === "Result"),
				Stream.mapEffect((update) => Schema.decodeUnknownEffect(Schema.Array(Schema.Number))(update.value).pipe(Effect.orDie)),
				Stream.runForEach((result) => Queue.offer(delivered, result)),
				Effect.forkScoped,
			);
		return delivered;
	});
	const item = yield* subscribe("item");
	const bucket = yield* subscribe("bucket");
	const committed = yield* Queue.unbounded<void>();
	const running: { fiber: Fiber.Fiber<number, unknown> | undefined } = { fiber: undefined };
	return { bucket, committed, first: first.id, item, rows, rpc, running, second: second.id, viewer };
});

export const purgeReaders = storyKit({
	...onPostgres,
	clock: "test",
	create: readerEngine,
	name: "PostgreSQL retention query delivery",
	stages: [],
	verbs: (engine, story) => ({
		collectionAccess: () =>
			querySubscription(engine.rpc, [{ payload: undefined, query: "all" }], engine.viewer).pipe(
				Effect.as("allowed"),
				Effect.catchTag("QueryReadDenied", () => Effect.succeed("denied")),
			),
		finish: () => {
			const fiber = engine.running.fiber;
			return fiber === undefined ? Effect.die("Start retention first") : Fiber.join(fiber);
		},
		firstId: () => engine.first,
		nextBatch: () =>
			Effect.gen(function* () {
				story.tell("one second passes and retention commits its next batch");
				yield* TestClock.adjust("1 second");
				yield* Queue.take(engine.committed);
			}),
		nextBucket: () => Queue.take(engine.bucket),
		nextItem: () => Queue.take(engine.item),
		secondId: () => engine.second,
		start: () =>
			Effect.gen(function* () {
				story.tell("retention starts deleting alice's rows in independently committed single-row batches");
				engine.running.fiber = yield* engine.rows.deleteBatched({ batchSize: 1, maxRows: 2, pause: "1 second", where: { owner: "alice" } }).pipe(
					Effect.provideService(ChangeObserver, (event) =>
						event._tag === "Published" ? Queue.offer(engine.committed, undefined).pipe(Effect.asVoid) : Effect.void,
					),
					Effect.forkScoped,
				);
				yield* Queue.take(engine.committed);
			}),
	}),
});
