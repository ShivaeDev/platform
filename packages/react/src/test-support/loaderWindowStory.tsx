import { type Duration, Effect, Queue, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { collection } from "@shivaedev/changes/keys.ts";
import { bind } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { mountLive } from "#client/mountLive.ts";
import type { QueryOptions } from "#client/resultState.ts";
import { loadQuery } from "#loadQuery.ts";
import { LoaderWindowRead } from "./LoaderWindowRead.tsx";
import { Screen } from "./Screen.ts";

const notes = collection("loader-window-notes", Schema.Number);
const Get = query("get", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.Number });
const Notes = contract("loaderWindowNotes", { queries: [Get] });

export const loaderWindowStory = storyKit({
	clock: "live",
	*create() {
		const hints = yield* Queue.unbounded<LiveHint>();
		const handled = yield* Queue.unbounded<void>();
		const responses = yield* Queue.unbounded<number>();
		const requests: number[] = [];
		let value = 0;
		const handlers = Notes.toLayer({
			"loaderWindowNotes.$changes": () =>
				Stream.concat(
					Stream.succeed({ _tag: "Resync" } as const),
					Stream.fromQueue(hints).pipe(
						Stream.flatMap((hint) => Stream.concat(Stream.succeed(hint), Stream.drain(Stream.fromEffect(Queue.offer(handled, undefined))))),
					),
				),
			"loaderWindowNotes.get": () =>
				Effect.sync(() => {
					requests.push(value);
					Queue.offerUnsafe(responses, value);
					return value;
				}),
		});
		class Client extends AtomRpc.Service<Client>()("loader-window/Client", {
			group: Notes,
			makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
			protocol: handlers,
		}) {}
		const api = bind(Notes, Client);
		const atom = api.get.query();
		const screen = new Screen(() => undefined);
		const view = yield* screen.open();
		return {
			api,
			atom,
			handled,
			hints,
			requests,
			responses,
			screen,
			setValue: (next: number) => {
				value = next;
			},
			view,
		};
	},
	inspect: ({ requests, view }) => ({ requests, screen: view.container.textContent }),
	name: "loader query live options",
	stages: ["screen"],
	verbs: (engine, story) => {
		engine.screen.tell = story.tell;
		return {
			open: (sessionWindow: Duration.Input, options?: QueryOptions) =>
				Effect.gen(function* () {
					story.tell("load the query and mount its screen");
					yield* Effect.acquireRelease(
						Effect.sync(() => mountLive(engine.view.registry, engine.api, sessionWindow)),
						(stop) => Effect.sync(stop),
					);
					const loaded = yield* Effect.promise(() => loadQuery(engine.view.registry, engine.atom, { abortController: new AbortController() }));
					yield* Queue.take(engine.responses);
					yield* Effect.promise(() => engine.view.render(<LoaderWindowRead atom={engine.atom} loaded={loaded} options={options} />));
				}),
			publish: (next: number) =>
				engine.screen.act(`publish the changed note ${next}`, async () => {
					engine.setValue(next);
					await Effect.runPromise(
						Queue.offer(engine.hints, { _tag: "Changed", keys: [notes.list] }).pipe(Effect.andThen(Queue.take(engine.handled))),
					);
				}),
			refetched: () =>
				engine.screen.act("wait for the live refetch response", async () => {
					await Effect.runPromise(Queue.take(engine.responses));
					await Effect.runPromise(AtomRegistry.getResult(engine.view.registry, engine.atom, { suspendOnWaiting: true }));
				}),
			requests: () => [...engine.requests],
			shown: () => engine.view.container.textContent,
		};
	},
});
