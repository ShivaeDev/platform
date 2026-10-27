import { Cause, Effect, Option } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as AtomRpc from "effect/reactivity/AtomRpc";
import { RpcTest } from "effect/rpc";
import { LiveConnection } from "#automaticLive.ts";
import { bind } from "#bind.ts";
import { Notes, type viewerEngine } from "./viewerEngine.ts";

export const viewerPage = Effect.fnUntraced(function* (
	engine: Effect.Success<typeof viewerEngine>,
	viewer: string,
	title: string,
	queryName: "list" | "unprotected" = "list",
) {
	class Client extends AtomRpc.Service<Client>()(`test/ViewerPage/${viewer}`, {
		group: Notes,
		makeEffect: RpcTest.makeClient(Notes, { flatten: true }),
		protocol: engine.layerFor(viewer),
	}) {}
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const api = bind(Notes, Client, { registry });
	const query = queryName === "list" ? api.list.query({ title }) : api.unprotected.query(undefined);
	registry.mount(query);
	registry.set(api[LiveConnection].coalesceWindow, 0);
	registry.mount(api[LiveConnection].connection);
	return {
		failure: () => {
			const value = registry.get(query);
			return AsyncResult.isFailure(value) ? Option.getOrUndefined(Cause.findErrorOption(value.cause)) : undefined;
		},
		status: () => registry.get(api[LiveConnection].status),
		titles: () => AsyncResult.getOrElse(registry.get(query), () => []).map((row) => row.title),
	};
});
