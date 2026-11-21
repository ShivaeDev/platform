import { Deferred, Effect, Schema } from "effect";
import { makeClient as makeRpcClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerLiveMemoryProtocol } from "@shivaedev/test-kits/contract/liveMemoryProtocol.ts";
import { storyRuntime } from "#test/storyRuntime.ts";

const notes = { _tag: "List", collection: "loaderNotes" } as const;
const Get = query("get", { readPolicy: () => Effect.succeed(true), reads: () => [notes], success: Schema.Struct({ title: Schema.String }) });
const Rename = command("rename", { invalidates: () => [notes], payload: { title: Schema.String } });
const Notes = contract("loaderNotes", { commands: [Rename], queries: [Get] });

export const loaderHost = Effect.fnUntraced(function* () {
	const calls: string[] = [];
	const started = yield* Deferred.make<void>();
	let response = Promise.withResolvers<{ readonly title: string }>();
	const handlers = Notes.application.toLayer({
		"loaderNotes.get": () =>
			Effect.suspend(() => {
				calls.push("get");
				return Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.promise(() => response.promise)));
			}),
		"loaderNotes.rename": ({ title }) =>
			Effect.sync(() => {
				response = Promise.withResolvers();
				response.resolve({ title });
			}),
	});
	const { api, Client } = makeRpcClient(Notes, {
		protocol: layerLiveMemoryProtocol(Notes, handlers),
		runtime: yield* storyRuntime,
		url: "memory://loader-notes",
	});
	const atom = api.get.query();
	return {
		atom,
		calls,
		next: () => {
			response = Promise.withResolvers();
		},
		rename: (title: string) => Client.runtime.atom(api.rename.run({ title })),
		respond: (title: string) => response.resolve({ title }),
		started: Deferred.await(started),
	};
});
