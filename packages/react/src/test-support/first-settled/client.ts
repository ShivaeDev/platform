import { Deferred, Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { memoryQueryStorage } from "@shivaedev/test-kits/contract/memoryQueryStorage.ts";

const notes = collection("first-settled-notes", Schema.Number);
const read = { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.String };
const Title = query("title", read);
const Author = query("author", read);
const Count = query("count", read);
const Rename = command("rename", { invalidates: () => [] });
const Notes = contract("notes", { commands: [Rename], queries: [Title, Author, Count] });

export function storedResults(user: string, answers: { readonly author: string; readonly title: string }) {
	const memory = memoryQueryStorage();
	const entries = [
		["title", answers.title],
		["author", answers.author],
	] as const;
	for (const [name, answer] of entries) {
		const key = JSON.stringify([`notes.${name}`, "null", null]);
		memory.users.set(user, new Map([...(memory.users.get(user) ?? []), [key, { key, used: 1, value: JSON.stringify(answer) }]]));
	}
	return memory.layer;
}

export function firstSettledClient() {
	const held = {
		author: Deferred.makeUnsafe<string>(),
		count: Deferred.makeUnsafe<string>(),
		rename: Deferred.makeUnsafe<void>(),
		title: Deferred.makeUnsafe<string>(),
	};
	const renameArrived = Deferred.makeUnsafe<void>();
	const handlers = Notes.application.toLayer(
		Effect.succeed(
			Notes.application.of({
				"notes.author": () => Deferred.await(held.author),
				"notes.count": () => Deferred.await(held.count),
				"notes.rename": () => Deferred.succeed(renameArrived, undefined).pipe(Effect.andThen(Deferred.await(held.rename))),
				"notes.title": () => Deferred.await(held.title),
			}),
		),
	);
	const client = makeClient(
		{ notes: Notes },
		{
			protocol: layerLiveMemoryProtocol(Notes, handlers),
			url: "memory://first-settled-notes",
		},
	);
	return { client, held, rename: client.Client.runtime.fn(() => client.api.notes.rename.run()), renameArrived };
}
export type FirstSettledClient = ReturnType<typeof firstSettledClient>;
