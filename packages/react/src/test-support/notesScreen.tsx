import { Effect, Layer, Option, Ref, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { collection } from "@shivaedev/changes/keys.ts";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { layerMemoryProtocol } from "@shivaedev/contract/testing.ts";
import { render } from "@shivaedev/test-story/client/react.ts";
import { screenDriver } from "@shivaedev/test-story/server/screenDriver.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { screenPending } from "#adapters/screenPending.ts";
import { useAction, useQuery } from "#client/resultState.ts";

const notes = collection("notes", Schema.Number);
const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [notes.list], success: Schema.Array(Schema.String) });
const Add = command("add", { invalidates: () => [notes.list], payload: { title: Schema.String } });
const Notes = contract("notes", { commands: [Add], queries: [List] });

export const notesScreen = storyKit({
	clock: "live",
	*create() {
		const handlers = Notes.toLayer(
			Effect.gen(function* () {
				const stored = yield* Ref.make<readonly string[]>([]);
				return Notes.of({
					"notes.$changes": () => Stream.never,
					"notes.add": ({ title }) => Ref.update(stored, (all) => [...all, title]),
					"notes.list": () => Ref.get(stored),
				});
			}),
		);
		const { api, Client } = makeClient(Notes, {
			live: false,
			protocol: layerMemoryProtocol(Notes).pipe(Layer.provide(handlers)),
			url: "memory://notes",
		});
		const add = Client.runtime.fn(api.add.run);
		function NotesView() {
			const list = useQuery(api.list.query());
			const action = useAction(add);
			return createElement(
				"section",
				null,
				createElement("output", null, Option.getOrElse(list.data, () => []).join(", ")),
				createElement(
					"button",
					{
						disabled: list.pending || action.pending,
						onClick: () => action.dispatch({ title: "Morning walk" }),
						type: "button",
					},
					"Add",
				),
			);
		}
		const view = yield* Effect.acquireRelease(
			Effect.promise(() => render(createElement(NotesView))),
			(mounted) => Effect.promise(mounted.unmount),
		);
		const pending = yield* screenPending().pipe(Effect.provideService(AtomRegistry.AtomRegistry, view.registry));
		return { pending, view };
	},
	inspect: ({ view }) => ({ screen: view.container.textContent }),
	name: "notes screen",
	stages: ["screen"],
	verbs: ({ pending, view }, story) =>
		screenDriver({
			act: async (action) => {
				await act(action);
			},
			pending,
			root: view.container,
			tell: story.tell,
		}),
});
