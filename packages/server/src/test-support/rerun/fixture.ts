import { Context, Effect, Layer, Option, Schema } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";
import { RpcMiddleware } from "effect/rpc";
import { collection, invalidationKeys } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { CurrentViewer, type Viewer } from "@shivaedev/contract/readPolicy.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appHost } from "#appHost.ts";

export class Note extends Schema.Class<Note>("RerunNote")({ id: Schema.BigIntFromString, owner: Schema.String, title: Schema.String }) {}
export class PolicyUnavailable extends Schema.TaggedError<PolicyUnavailable>()("PolicyUnavailable", {}) {}
export class QueryUnavailable extends Schema.TaggedError<QueryUnavailable>()("QueryUnavailable", {}) {}
export interface RerunState {
	barrier: number;
	readonly calls: string[];
	readonly denied: Set<string>;
	readonly notes: Map<bigint, Note>;
	policyUnavailable: boolean;
	queryUnavailable: boolean;
}
export class Store extends Context.Service<Store, RerunState>()("@shivaedev/server/test/RerunStore") {}
class Incoming extends RpcMiddleware.Service<Incoming>()("@shivaedev/server/test/RerunIncoming") {}
export const notes = collection("rerun-notes", Schema.String, { owner: Schema.String });
function reads(_payload: unknown, viewer: Option.Option<Viewer>) {
	return Option.isSome(viewer) ? [notes.bucket.owner(viewer.value.id)] : [];
}
function readPolicy(_payload: unknown, viewer: Option.Option<Viewer>) {
	return Effect.flatMap(Store, (state) =>
		state.policyUnavailable ? Effect.fail(new PolicyUnavailable()) : Effect.succeed(Option.isSome(viewer) && !state.denied.has(viewer.value.id)),
	);
}
const definition = {
	payload: { title: Schema.String },
	readPolicy,
	reads,
	rejections: { PolicyUnavailable, QueryUnavailable },
	success: Schema.Array(Note),
};
const Compare = query("compare", { ...definition });
const Secondary = query("secondary", definition);
const Barrier = query("barrier", { readPolicy, reads, rejections: { PolicyUnavailable }, success: Schema.Number });
const Rename = command("rename", { invalidates: () => [], payload: { id: Schema.BigIntFromString, title: Schema.String } });
export const Api = contract("rerun", { commands: [Rename], queries: [Compare, Secondary, Barrier] })
	.middleware(Incoming)
	.middleware(Authenticated);

const list = Effect.fnUntraced(function* ({ title }: { title: string }) {
	const state = yield* Store;
	const viewer = yield* CurrentViewer;
	if (state.queryUnavailable) {
		return yield* new QueryUnavailable();
	}
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
				"rerun.secondary": list,
			}),
			Layer.succeed(Incoming, (effect, { rpc }) => {
				state.calls.push(rpc._tag);
				return effect;
			}),
		),
		services: Layer.mergeAll(Layer.succeed(Store, state), liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer))),
		sessions: Layer.succeed(SessionPolicy, {
			origin: () => true,
			provider: { get: (headers) => Effect.succeed(Option.fromUndefinedOr(headers.authorization).pipe(Option.map((id) => ({ user: { id } })))) },
		}),
	});
}
