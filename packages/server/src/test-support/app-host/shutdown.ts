import { Effect, Layer, ManagedRuntime, Schema, Stream } from "effect";
import { FetchHttpClient, HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { Rpc, RpcClient, RpcGroup, RpcSerialization } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";

const Watching = RpcGroup.make(Rpc.make("watch", { stream: true, success: Schema.String }));

export const shutdownHost = storyKit({
	clock: "live",
	*create() {
		const lifecycle: string[] = [];
		const ready = Promise.withResolvers<void>();
		const clientController = new AbortController();
		const handlers = Watching.toLayer({
			watch: () => Stream.make("ready").pipe(Stream.concat(Stream.never), Stream.ensuring(Effect.sync(() => lifecycle.push("stream finalized")))),
		});
		const runtime = ManagedRuntime.make(
			appHost({ config: { disablePreemptiveShutdown: true, host: "127.0.0.1", port: 0 }, group: Watching, handlers, policy: "loopback" }),
		);
		yield* Effect.addFinalizer(() =>
			Effect.promise(async () => {
				clientController.abort();
				await runtime.dispose();
			}),
		);
		const server = yield* Effect.promise(() => runtime.runPromise(HttpServer.HttpServer));
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("The streaming host must listen on TCP");
		}
		return { clientController, lifecycle, ready, runtime, url: `http://127.0.0.1:${server.address.port}` };
	},
	inspect: (state) => ({ lifecycle: state.lifecycle, url: state.url }),
	name: "streaming host shutdown",
	stages: [],
	verbs: (state, story) => ({
		hostDisposes: () =>
			Effect.promise(async () => {
				story.tell("the host is disposed while the client keeps its RPC stream open");
				await state.runtime.dispose();
				state.lifecycle.push("host disposed");
			}),
		httpAnswer: () =>
			Effect.tryPromise(() => fetch(`${state.url}/health`)).pipe(
				Effect.match({ onFailure: () => "refuses connections", onSuccess: () => "answers" }),
			),
		lifecycle: () => Effect.sync(() => state.lifecycle),
		openStream: () =>
			Effect.promise(async () => {
				story.tell("a native HTTP RPC client opens a never-ending stream and receives its first item");
				const protocol = RpcClient.layerProtocolHttp({ url: `${state.url}/rpc` }).pipe(
					Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]),
				);
				const client = Effect.runPromiseExit(
					RpcClient.make(Watching).pipe(
						Effect.flatMap((rpc) => Stream.runForEach(rpc.watch(), () => Effect.sync(() => state.ready.resolve()))),
						Effect.provide(protocol),
						Effect.scoped,
					),
					{ signal: state.clientController.signal },
				);
				await Promise.race([
					state.ready.promise,
					client.then((exit) => {
						throw new Error("The RPC stream ended before its first item", { cause: exit });
					}),
				]);
			}),
	}),
});
