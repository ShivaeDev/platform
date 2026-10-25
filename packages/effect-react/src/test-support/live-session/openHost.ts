import { Effect, ManagedRuntime, Option, Stream } from "effect";
import { type Headers, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { invalidationKeys } from "@shivaedev/effect-contract/keys.ts";
import { makeLiveServer } from "@shivaedev/effect-contract/makeLiveServer.ts";
import { queryKeys } from "@shivaedev/effect-contract/serverMetadata.ts";
import { Identity } from "@shivaedev/platform/rpc/identity.ts";
import { appHost } from "@shivaedev/platform/server/appHost.ts";
import { Notes, notes } from "./notes.ts";

export async function openHost() {
	const state: { active: string[]; lookups: number; reads: number; session: string | undefined; title: string } = {
		active: [],
		lookups: 0,
		reads: 0,
		session: "alice",
		title: "First",
	};
	const tokens = new Map([
		["Bearer alice-token", "alice"],
		["Bearer bob-token", "bob"],
	]);
	function resolveSession(headers: Headers.Headers) {
		return Effect.sync(() => {
			state.lookups += 1;
			const account = headers.authorization === undefined ? state.session : tokens.get(headers.authorization);
			return Option.map(Option.fromUndefinedOr(account), (id) => ({ user: { id } }));
		});
	}
	function connected(id: string) {
		return Effect.acquireRelease(
			Effect.sync(() => {
				state.active.push(id);
			}),
			() =>
				Effect.sync(() => {
					state.active.splice(state.active.indexOf(id), 1);
				}),
		);
	}
	const handlers = Notes.toLayer(
		Effect.gen(function* () {
			const live = yield* makeLiveServer;
			return Notes.of({
				"liveSession.$changes": ({ queries }) =>
					Stream.unwrap(
						Effect.gen(function* () {
							const { id } = yield* Identity;
							yield* connected(id);
							return live.stream(queryKeys(Notes.declaration.queries, queries), { scope: id });
						}),
					),
				"liveSession.get": () =>
					Effect.map(Identity, ({ id }) => {
						state.reads += 1;
						return id === "bob" ? "Bob note" : state.title;
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
				provider: { get: resolveSession },
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
				return runtime.runPromise(Reactivity.invalidate(invalidationKeys([notes.item(0)], { scope: "alice" })));
			},
			state,
			url: `http://127.0.0.1:${server.address.port}/rpc`,
		};
	} catch (error) {
		await runtime.dispose();
		throw error;
	}
}
