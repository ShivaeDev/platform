import { Clock, Effect, Equal, Layer, Schedule } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { resumeSocket } from "#adapters/resumeSocket.ts";
import type { ClientOptions } from "#clientOptions.ts";
import type { ResumeWindow } from "#resume.ts";
import { SocketClock } from "#SocketClock.ts";
import { authenticateSocket } from "#socketAuthentication.ts";
import { connectionProtocol } from "./connectionProtocol.ts";

interface SocketOptions {
	readonly bearerToken: ClientOptions["bearerToken"];
	readonly headers: ClientOptions["headers"];
	readonly identity: string | undefined;
	readonly resume: ClientOptions["resume"];
	readonly resumeWindow: ClientOptions["resumeWindow"];
	readonly url: string;
	readonly webSocketConstructor: ClientOptions["webSocketConstructor"];
}

const socketMemoMaps = new WeakMap<Clock.Clock, Layer.MemoMap>();

const windows = new WeakMap<ResumeWindow, { readonly target: ResumeWindow }>();

export function socketProtocol(options: SocketOptions) {
	const target = options.resumeWindow;
	let reference = target === undefined ? undefined : windows.get(target);
	if (target !== undefined && reference === undefined) {
		reference = Equal.byReference({ target });
		windows.set(target, reference);
	}
	return protocols({ ...options, resumeWindow: reference });
}

const protocols = Atom.family(
	(options: Omit<SocketOptions, "resumeWindow"> & { readonly resumeWindow: { readonly target: ResumeWindow } | undefined }) => {
		let url = options.url;
		if (options.bearerToken !== undefined) {
			const address = new URL(url);
			address.searchParams.set("auth", "frame");
			url = address.toString();
		}
		const raw = Socket.layerWebSocket(url, { headers: options.headers });
		const authenticated = (
			options.bearerToken === undefined ? raw : Layer.effect(Socket.Socket, authenticateSocket(options.bearerToken)).pipe(Layer.provide(raw))
		).pipe(Layer.provide(options.webSocketConstructor ?? Socket.layerWebSocketConstructorGlobal));
		const socket = Layer.effect(
			Socket.Socket,
			resumeSocket({
				...(options.resumeWindow === undefined ? {} : { window: options.resumeWindow.target }),
				...(options.resume === undefined ? {} : { native: options.resume }),
			}),
		).pipe(Layer.provide(authenticated), Layer.provide(RpcSerialization.layerNdjson));
		const managed = connectionProtocol(
			RpcClient.layerProtocolSocket({
				retryPolicy: Schedule.jittered(Schedule.min([Schedule.exponential(500, 1.5), Schedule.spaced(5000)])),
			}).pipe(Layer.provide(socket), Layer.provide(RpcSerialization.layerNdjson)),
		);
		return Layer.effectContext(
			Effect.gen(function* () {
				const clock = yield* SocketClock;
				let memo = socketMemoMaps.get(clock);
				if (memo === undefined) {
					memo = Layer.makeMemoMapUnsafe();
					socketMemoMaps.set(clock, memo);
				}
				const protocol = managed.pipe(Layer.provide(Layer.succeed(Clock.Clock, clock)));
				return yield* Layer.buildWithMemoMap(protocol, memo, yield* Effect.scope);
			}),
		);
	},
);
