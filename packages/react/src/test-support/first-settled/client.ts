import { Deferred, Effect, Layer, Schema, Stream } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerMemoryProtocol } from "@shivaedev/test-kits/contract/testing.ts";

const notes = collection("first-settled-notes", Schema.Number);
const read = { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.String };
const Title = query("title", read);
const Author = query("author", read);
const Count = query("count", read);
const Rename = command("rename", { invalidates: () => [] });
const Notes = contract("notes", { commands: [Rename], queries: [Title, Author, Count] });

export function firstSettledClient() {
	const held = {
		author: Deferred.makeUnsafe<string>(),
		count: Deferred.makeUnsafe<string>(),
		rename: Deferred.makeUnsafe<void>(),
		title: Deferred.makeUnsafe<string>(),
	};
	const renameArrived = Deferred.makeUnsafe<void>();
	const handlers = Notes.toLayer(
		Effect.succeed(
			Notes.of({
				"notes.$changes": () => Stream.never,
				"notes.author": () => Deferred.await(held.author),
				"notes.count": () => Deferred.await(held.count),
				"notes.rename": () => Deferred.succeed(renameArrived, undefined).pipe(Effect.andThen(Deferred.await(held.rename))),
				"notes.title": () => Deferred.await(held.title),
			}),
		),
	);
	const client = makeClient(Notes, {
		live: false,
		protocol: layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)),
		url: "memory://first-settled-notes",
	});
	return { client, held, rename: client.Client.runtime.fn(() => client.api.rename.run()), renameArrived };
}
export type FirstSettledClient = ReturnType<typeof firstSettledClient>;
