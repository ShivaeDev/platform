import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Path, Queue, Scope, Stream } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import * as Reactivity from "effect/reactivity/Reactivity";
import { liveServerLayer } from "@shivaedev/contract/live-server/layer.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { appHost } from "#appHost.ts";
import { httpClient, liveClient } from "#test/unix-host/client.ts";
import { Api, handlers, Note } from "#test/unix-host/feature.ts";
import { staleSocket } from "#test/unix-host/staleSocket.ts";

const openHost = Effect.fnUntraced(function* (path: string, tcp: boolean) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const services = liveServerLayer.pipe(Layer.provideMerge(Reactivity.layer), Layer.merge(Note.layer));
	const context = yield* Layer.buildWithScope(
		appHost({
			config: { socketPath: path, ...(tcp ? { port: 0 } : {}), disablePreemptiveShutdown: true },
			group: Api,
			handlers,
			policy: "loopback",
			services,
		}),
		scope,
	);
	return { address: Context.get(context, HttpServer.HttpServer).address, scope };
});
interface State {
	expectStartFailure?: boolean;
	host?: Effect.Success<ReturnType<typeof openHost>>;
	path: string;
	results: Queue.Queue<string>;
	startFailure?: string;
	tcp: boolean;
}
export const unixHost = storyKit({
	after: {
		configured: (state: State) =>
			Effect.gen(function* () {
				if (state.expectStartFailure) {
					state.startFailure = yield* openHost(state.path, state.tcp).pipe(
						Effect.match({
							onFailure: (error) => (error instanceof Error ? error.message.replace(state.path, "app.sock") : String(error)),
							onSuccess: () => "started",
						}),
					);
				} else {
					state.host = yield* openHost(state.path, state.tcp);
				}
			}),
	},
	clock: "test",
	*create() {
		const folder = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped();
		const state: State = { path: (yield* Path.Path).join(folder, "app.sock"), results: yield* Queue.unbounded<string>(), tcp: false };
		return state;
	},
	layer: NodeServices.layer,
	name: "Unix application host",
	stages: ["configured", "listening"],
	verbs: (state: State, story) => ({
		address: () => Effect.sync(() => (state.host && NetAddress.isUnixPathAddress(state.host.address) ? "Unix only" : "TCP and Unix")),
		close: () => {
			story.tell("close the application host");
			return state.host ? Scope.close(state.host.scope, Exit.void) : Effect.die("Host not started");
		},
		fileContents: () => FileSystem.FileSystem.use((fs) => fs.readFileString(state.path)),
		follow: () =>
			Effect.gen(function* () {
				story.tell("subscribe to the live query over a Unix WebSocket");
				const client = yield* liveClient(state.path);
				yield* client("notes.$changes", { queries: [{ payload: undefined, query: "read" }] }).pipe(
					Stream.mapEffect(() => client("notes.read", undefined)),
					Stream.runForEach((value) => Queue.offer(state.results, value)),
					Effect.forkScoped,
				);
			}),
		nextResult: () => Queue.take(state.results),
		read: () => Effect.scoped(Effect.flatMap(httpClient(state.path), (client) => client("notes.read", undefined))),
		save: (text: string) => {
			story.tell(`save ${text} over Unix HTTP RPC`);
			return Effect.scoped(Effect.flatMap(httpClient(state.path), (client) => client("notes.save", { text })));
		},
		socketFile: () =>
			Effect.gen(function* () {
				const fs = yield* FileSystem.FileSystem;
				if (!(yield* fs.exists(state.path))) {
					return "missing";
				}
				const info = yield* fs.stat(state.path);
				return { mode: info.mode & 0o777, type: info.type };
			}),
		startup: () => Effect.sync(() => state.startFailure ?? "started"),
	}),
});
export const alongsideTcp = unixHost.trait("configured", "an explicit ephemeral TCP port accompanies the Unix socket", (state) => {
	state.tcp = true;
});
export const stale = unixHost.trait("configured", "a crashed process left a stale socket", (state) => staleSocket(state.path));

export const regularFile = unixHost.trait("configured", "a regular file occupies the socket path", function* (state) {
	state.expectStartFailure = true;
	yield* (yield* FileSystem.FileSystem).writeFileString(state.path, "Keep this file");
});
