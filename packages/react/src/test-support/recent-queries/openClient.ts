import { Deferred, Effect, Layer, Queue, Schema, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const Notes = contract("recentNotes", {
	queries: [
		query("get", {
			live: "rerun-and-compare",
			payload: { id: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.String,
		}),
	],
});

export const openClient = Effect.gen(function* () {
	const requests = yield* Queue.unbounded<Deferred.Deferred<string>>();
	const closed = yield* Queue.unbounded<void>();
	const reads: string[] = [];
	const handlers = Notes.toLayer({
		"recentNotes.$changes": ({ queries }) =>
			Stream.fromEffect(
				Effect.gen(function* () {
					reads.push(queries[0]?.payload.id ?? "missing id");
					const reply = yield* Deferred.make<string>();
					yield* Queue.offer(requests, reply);
					return { _tag: "Result" as const, query: "get" as const, queryIndex: 0, value: yield* Deferred.await(reply) };
				}),
			).pipe(Stream.concat(Stream.never), Stream.ensuring(Queue.offer(closed, undefined))),
		"recentNotes.get": () => Effect.die("Live queries receive their first result on the subscription"),
	});
	const transport = yield* Layer.build(layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)));
	const client = makeClient(Notes, { protocol: Layer.succeedContext(transport), runtime: yield* storyRuntime, url: "memory://recent-notes" });
	return { client, closed, reads, requests };
});
