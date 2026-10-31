import { NodeWS } from "@effect/platform-node/NodeSocket";
import { Deferred, Effect, Layer, Stream } from "effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Socket from "effect/socket/Socket";
import { LiveConnection } from "@shivaedev/contract/automaticLive.ts";
import { bind, makeClient } from "@shivaedev/contract/bind.ts";
import { Api } from "./api.ts";
import { type Host, NATIVE_ORIGIN } from "./host.ts";
import type { Account } from "./requests.ts";

export const openProfile = Effect.fnUntraced(function* (host: Host, account: Account, owner: Account = account, restricted = false) {
	const closed = yield* Deferred.make<{ code: number; reason: string }>();
	const urls: string[] = [];
	const webSocketConstructor = Layer.succeed(Socket.WebSocketConstructor, (url, options) => {
		if (options !== undefined && typeof options !== "string" && !Array.isArray(options)) {
			throw new Error("The WebView cannot set upgrade headers");
		}
		urls.push(url);
		const socket = new NodeWS.WebSocket(url, options, { origin: NATIVE_ORIGIN });
		socket.addEventListener("close", (event) => Effect.runSync(Deferred.succeed(closed, { code: event.code, reason: event.reason })));
		return socket;
	});
	const registry = yield* Effect.acquireRelease(
		Effect.sync(() => AtomRegistry.make()),
		(current) => Effect.sync(() => current.dispose()),
	);
	const connection = makeClient(Api, {
		bearerToken: account.credential ?? "",
		registry,
		url: `${host.baseUrl}/rpc`,
		webSocketConstructor,
	});
	let resume: (() => void) | undefined;
	const api = bind(Api, connection.Client, {
		registry,
		resume: (notify) => {
			resume = notify;
			return () => {
				resume = undefined;
			};
		},
	});
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
		resume: Effect.suspend(() => (resume === undefined ? Effect.die("The native resume source is not mounted") : Effect.sync(resume))),
		urls,
	};
});

export type ProfileSocket = Effect.Success<ReturnType<typeof openProfile>>;

export function rejectedFrame(host: Host, frame?: string) {
	return Effect.callback<{ code: number; reason: string }>((resume) => {
		const socket = new globalThis.WebSocket(`${host.baseUrl.replace(/^http/u, "ws")}/rpc?auth=frame`);
		if (frame !== undefined) {
			socket.addEventListener("open", () => socket.send(frame));
		}
		socket.addEventListener("close", (event) => resume(Effect.succeed({ code: event.code, reason: event.reason })));
		return Effect.sync(() => socket.close());
	});
}
