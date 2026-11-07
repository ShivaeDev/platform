import { layerWebSocketConstructor } from "@effect/platform-node/NodeWS";
import { Effect, ManagedRuntime, Schema, Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { makeClient } from "@shivaedev/contract/bind.ts";
import type { QueryUpdate } from "@shivaedev/contract/queryUpdate.ts";
import { Preferences } from "#test/postgres-example/privateFeature.ts";
import { recorded } from "#test/postgres-example/recorded.ts";

export async function privateClient(url: string, account: "alice" | "bob") {
	const registry = AtomRegistry.make();
	const connection = makeClient(Preferences, {
		headers: { authorization: `Bearer ${account}-session` },
		registry,
		url,
		webSocketConstructor: layerWebSocketConstructor,
	});
	const runtime = ManagedRuntime.make(connection);
	const client = await runtime.runPromise(connection.Client);
	const delivered = recorded<{ readonly hint: QueryUpdate; readonly title: string; readonly list: readonly string[] }>();
	let title = "";
	let list: readonly string[] = [];
	const receive = Effect.fnUntraced(function* (hint: QueryUpdate) {
		if (hint._tag === "QueryReadDenied") {
			return yield* hint;
		}
		if (hint._tag === "Result") {
			if (hint.query === "self") {
				title = Schema.decodeUnknownSync(Schema.String)(hint.value);
			} else {
				list = Schema.decodeUnknownSync(Schema.Array(Schema.String))(hint.value);
			}
		}
		if (hint.queryIndex === 1) {
			delivered.push({ hint, list, title });
		}
	});
	runtime.runFork(
		client("preferences.$changes", {
			queries: [
				{ payload: undefined, query: "self" },
				{ payload: undefined, query: "list" },
			],
		}).pipe(Stream.runForEach(receive)),
	);
	return {
		close: () => runtime.dispose().finally(() => registry.dispose()),
		delivered,
		save: (nextTitle: string) => runtime.runPromise(client("preferences.save", { title: nextTitle }).pipe(Effect.result)),
		shown: () => title,
	};
}
