import { Effect, Option, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import { RestartNotes } from "./Notes.ts";

export const openTab = Effect.fnUntraced(function* (port: number, tab: string) {
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const { api } = makeClient(RestartNotes, { url: `http://127.0.0.1:${port}/rpc?tab=${encodeURIComponent(tab)}` });
	const queries = [1, 2].map((id) => api.get.query({ id, tab }));
	for (const query of queries) {
		registry.mount(query);
	}
	return {
		results: (pid: number) =>
			Effect.forEach(queries, (query) =>
				AtomRegistry.toStream(registry, query).pipe(
					Stream.filter(AsyncResult.isSuccess),
					Stream.map((result) => result.value),
					Stream.filter((result) => result.pid === pid),
					Stream.runHead,
					Effect.map(Option.getOrThrow),
				),
			),
	};
});
