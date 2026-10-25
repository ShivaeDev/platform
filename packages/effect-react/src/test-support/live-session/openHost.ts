import { Effect, ManagedRuntime, Option, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { queryKeys } from "@shivaedev/effect-contract/serverMetadata.ts";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { Notes, notes } from "./notes.ts";

export async function openHost() {
	const state: { active: number; lookups: number; reads: number; session: string | undefined; title: string } = {
		active: 0,
		lookups: 0,
		reads: 0,
		session: "alice",
		title: "First",
	};
	const connected = Effect.acquireRelease(
		Effect.sync(() => {
			state.active += 1;
		}),
		() =>
			Effect.sync(() => {
				state.active -= 1;
			}),
	);
	const handlers = Notes.toLayer(
		Effect.gen(function* () {
			const live = yield* makeLiveServer;
			return Notes.of({
				"liveSession.$changes": ({ queries }) => Stream.unwrap(Effect.as(connected, live.stream(queryKeys(Notes.declaration.queries, queries)))),
				"liveSession.get": () =>
					Effect.sync(() => {
						state.reads += 1;
						return state.title;
					}),
			});
		}),
	);
	const runtime = ManagedRuntime.make(
		appHost({
			config: { port: 0 },
			group: Notes,
			handlers,
			services: Reactivity.layer,
			sessions: {
				origin: () => true,
				provider: {
					get: () =>
						Effect.sync(() => {
							state.lookups += 1;
							return Option.map(Option.fromUndefinedOr(state.session), (id) => ({ user: { id } }));
						}),
				},
				streamRevalidationInterval: "100 millis",
			},
		}),
	);
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("Expected a TCP host");
		}
		return {
			close: () => runtime.dispose(),
			rename: (title: string) => {
				state.title = title;
				return runtime.runPromise(Reactivity.invalidate([notes.name]));
			},
			state,
			url: `http://127.0.0.1:${server.address.port}/rpc`,
		};
	} catch (error) {
		await runtime.dispose();
		throw error;
	}
}
