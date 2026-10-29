import { layerWebSocketConstructorWS } from "@effect/platform-node/NodeSocket";
import { Effect, ManagedRuntime, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { LiveHint } from "@shivaedev/contract/live.ts";
import { Preferences } from "./privateFeature.ts";

export async function privateClient(url: string, account: "alice" | "bob") {
	const registry = AtomRegistry.make();
	const connection = makeClient(Preferences, {
		headers: { authorization: `Bearer ${account}-session` },
		registry,
		url,
		webSocketConstructor: layerWebSocketConstructorWS,
	});
	const runtime = ManagedRuntime.make(connection);
	const client = await runtime.runPromise(connection.Client);
	const delivered: Array<{ readonly hint: LiveHint; readonly title: string; readonly list: readonly string[] }> = [];
	runtime.runFork(
		client("preferences.$changes", {
			queries: [
				{ payload: undefined, query: "self" },
				{ payload: undefined, query: "list" },
			],
		}).pipe(
			Stream.runForEach((hint) =>
				Effect.gen(function* () {
					const title = yield* client("preferences.self", undefined);
					const list = yield* client("preferences.list", undefined);
					delivered.push({ hint, list, title });
				}),
			),
		),
	);
	return {
		close: () => runtime.dispose().finally(() => registry.dispose()),
		delivered,
		read: () => runtime.runPromise(client("preferences.self", undefined)),
		save: (title: string) => runtime.runPromise(client("preferences.save", { title }).pipe(Effect.result)),
	};
}
