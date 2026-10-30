import { Context, Effect, Layer, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { makeLiveServer } from "@shivaedev/contract/makeLiveServer.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { AppChanges, appHost } from "#appHost.ts";

export class Note extends Schema.Class<Note>("RerunNote")({ id: Schema.BigIntFromString, owner: Schema.String, title: Schema.String }) {}
export interface RerunState {
	barrier: number;
	readonly calls: string[];
	readonly denied: Set<string>;
	readonly notes: Map<bigint, Note>;
}
class Store extends Context.Service<Store, RerunState>()("test/RerunStore") {}
class Incoming extends RpcMiddleware.Service<Incoming>()("test/RerunIncoming") {}
export const notes = collection("rerun-notes", Schema.String, { owner: Schema.String });
function reads(_payload: unknown, viewer: Option.Option<Viewer>) {
	return Option.isSome(viewer) ? [notes.bucket.owner(viewer.value.id)] : [];
}
function readPolicy(_payload: unknown, viewer: Option.Option<Viewer>) {
	return Effect.map(Store, (state) => Option.isSome(viewer) && !state.denied.has(viewer.value.id));
}
const definition = { payload: { title: Schema.String }, readPolicy, reads, success: Schema.Array(Note) };
const Compare = query("compare", { ...definition, live: "rerun-and-compare" });
const Hinted = query("hinted", definition);
const Barrier = query("barrier", { live: "rerun-and-compare", readPolicy, reads, success: Schema.Number });
const Rename = command("rename", { invalidates: () => [], payload: { id: Schema.BigIntFromString, title: Schema.String } });
export const Api = contract("rerun", { commands: [Rename], queries: [Compare, Hinted, Barrier] })
	.middleware(Incoming)
	.middleware(Authenticated);

const list = Effect.fnUntraced(function* ({ title }: { title: string }) {
	const state = yield* Store;
	const viewer = yield* CurrentViewer;
	return [...state.notes.values()].filter((note) => Option.isSome(viewer) && note.owner === viewer.value.id && note.title.includes(title));
});

export function rerunHost(state: RerunState) {
	return appHost({
		config: { port: 0 },
		group: Api,
		handlers: Layer.merge(
			Api.application.toLayer({
				"rerun.barrier": () =>
					Effect.map(Store, (stored) => {
						stored.barrier += 1;
						return stored.barrier;
					}),
				"rerun.compare": list,
				"rerun.hinted": list,
				"rerun.rename": ({ id, title }) =>
					Effect.gen(function* () {
						const stored = yield* Store;
						const note = stored.notes.get(id);
						if (note === undefined) {
							return yield* Effect.die(new Error(`Missing note ${id}`));
						}
						stored.notes.set(id, new Note({ ...note, title }));
						yield* Reactivity.invalidate(invalidationKeys([notes.bucket.owner(note.owner)]));
					}),
			}),
			Layer.succeed(Incoming, (effect, { rpc }) => {
				state.calls.push(rpc._tag);
				return effect;
			}),
		),
		services: Layer.mergeAll(Layer.succeed(Store, state), Layer.effect(AppChanges, makeLiveServer).pipe(Layer.provideMerge(Reactivity.layer))),
		sessions: {
			origin: () => true,
			provider: { get: (headers) => Effect.succeed(Option.fromUndefinedOr(headers.authorization).pipe(Option.map((id) => ({ user: { id } })))) },
		},
	});
}
