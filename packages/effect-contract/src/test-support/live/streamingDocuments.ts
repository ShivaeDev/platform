import { Effect, type Stream } from "effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { liveClient } from "./client.ts";
import { liveServer } from "./server.ts";

export async function streamingDocuments() {
	const server = await liveServer();
	const client = liveClient(server.url);
	const registry = AtomRegistry.make();
	const release = registry.mount(client.Client.runtime);
	function run<A, E>(effect: Effect.Effect<A, E, Stream.Services<ReturnType<typeof client.api.subscribe.run>>>, signal?: AbortSignal) {
		return Effect.runPromiseExit(
			Effect.flatMap(AtomRegistry.getResult(registry, client.Client.runtime), (context) => Effect.provideContext(effect, context)),
			{ signal },
		);
	}
	return {
		...server,
		...client,
		close: async () => {
			release();
			registry.dispose();
			await server.close();
		},
		run,
	};
}
