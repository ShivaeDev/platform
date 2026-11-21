import * as NodeWs from "@effect/platform-node/NodeWS";
import { Deferred, Effect, Layer, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { makeClient } from "@shivaedev/contract/makeClient.ts";
import { Api } from "#test/native-sessions/api.ts";
import { type Host, NATIVE_ORIGIN } from "#test/native-sessions/host.ts";
import type { Account } from "#test/native-sessions/requests.ts";

export const openProfile = Effect.fnUntraced(function* (host: Host, account: Account, owner: Account = account, restricted = false) {
	const closed = yield* Deferred.make<{ code: number; reason: string }>();
	const urls: string[] = [];
	const webSocketConstructor = Layer.succeed(Socket.WebSocketConstructor, (url, options) => {
		if (options !== undefined && typeof options !== "string" && !Array.isArray(options)) {
			throw new Error("The WebView cannot set upgrade headers");
		}
		urls.push(url);
		const socket = new NodeWs.WebSocket(url, options, { origin: NATIVE_ORIGIN });
		socket.addEventListener("close", (event) => Effect.runSync(Deferred.succeed(closed, { code: event.code, reason: event.reason })));
		return socket;
	});
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	// The client's socket and its live queries each register with the native resume source.
	const resumed = new Set<() => void>();
	const api = makeClient(
		{ profiles: Api },
		{
			bearerToken: account.credential ?? "",
			registry,
			resume: (notify) => {
				resumed.add(notify);
				return () => {
					resumed.delete(notify);
				};
			},
			url: `${host.baseUrl}/rpc`,
			webSocketConstructor,
		},
	).api.profiles;
	const query = (restricted ? api.restrictedProfile : api.profile).query({ owner: owner.user.id });
	const identity = api[LiveConnection].identity;
	if (identity !== undefined) {
		registry.set(identity, account.user.id);
	}
	registry.mount(query);
	const next = AtomRegistry.toStream(registry, query).pipe(Stream.filter((value) => !(AsyncResult.isInitial(value) || value.waiting)));
	return {
		closed: Deferred.await(closed),
		next,
		resume: Effect.suspend(() =>
			resumed.size === 0
				? Effect.die("The native resume source is not mounted")
				: Effect.sync(() => {
						for (const notify of resumed) {
							notify();
						}
					}),
		),
		urls,
	};
});

export type ProfileSocket = Effect.Success<ReturnType<typeof openProfile>>;

export function rejectedFrame(host: Host, frame?: string, opened?: () => void) {
	return Effect.callback<{ code: number; reason: string }>((resume) => {
		const socket = new globalThis.WebSocket(`${host.baseUrl.replace(/^http/u, "ws")}/rpc?auth=frame`);
		socket.addEventListener("open", () => {
			opened?.();
			if (frame !== undefined) {
				socket.send(frame);
			}
		});
		socket.addEventListener("close", (event) => resume(Effect.succeed({ code: event.code, reason: event.reason })));
		return Effect.sync(() => socket.close());
	});
}
