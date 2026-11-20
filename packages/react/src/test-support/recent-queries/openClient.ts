import { Deferred, Effect, Layer, Queue, Schema, Stream } from "effect";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import type { QueryReadDenied } from "@shivaedev/contract/readPolicyErrors.ts";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const Notes = contract("recentNotes", {
	queries: [
		query("get", {
			payload: { id: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			rejections: { NotFound },
			success: Schema.String,
		}),
		query("secret", {
			payload: { id: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: () => [],
			success: Schema.Struct({ pin: Schema.String.annotate({ sensitive: true }), title: Schema.String }),
		}),
	],
});

export const openClient = Effect.gen(function* () {
	const requests = yield* Queue.unbounded<Deferred.Deferred<string, NotFound | QueryReadDenied>>();
	const closed = yield* Queue.unbounded<void>();
	const reads: string[] = [];
	const subscriptions = { open: 0 };
	const handlers = Notes.toLayer({
		"recentNotes.$changes": ({ queries }) =>
			Stream.fromEffect(
				Effect.gen(function* () {
					subscriptions.open += 1;
					const [reference] = queries;
					reads.push(reference?.payload.id ?? "missing id");
					const reply = yield* Deferred.make<string, NotFound | QueryReadDenied>();
					yield* Queue.offer(requests, reply);
					const title = yield* Deferred.await(reply);
					return reference?.query === "secret"
						? { _tag: "Result" as const, query: "secret" as const, queryIndex: 0, value: { pin: "4321", title } }
						: { _tag: "Result" as const, query: "get" as const, queryIndex: 0, value: title };
				}),
			).pipe(
				Stream.concat(Stream.never),
				Stream.ensuring(
					Effect.sync(() => {
						subscriptions.open -= 1;
					}).pipe(Effect.andThen(Queue.offer(closed, undefined))),
				),
			),
		"recentNotes.get": () => Effect.die("Live queries receive their first result on the subscription"),
		"recentNotes.secret": () => Effect.die("Live queries receive their first result on the subscription"),
	});
	const transport = yield* Layer.build(layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)));
	const client = makeClient(Notes, { protocol: Layer.succeedContext(transport), runtime: yield* storyRuntime, url: "memory://recent-notes" });
	return { client, closed, reads, requests, subscriptions };
});
