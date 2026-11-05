import { Clock, Effect, Equal, Layer, Schedule } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { RpcClient, RpcSerialization } from "effect/rpc";
import * as Socket from "effect/socket/Socket";
import { resumeSocket } from "#adapters/resumeSocket.ts";
import type { ClientOptions } from "#clientOptions.ts";
import type { ResumeWindow } from "#resume.ts";
import { authenticateSocket } from "#socketAuthentication.ts";
import { connectionProtocol } from "./connectionProtocol.ts";

interface SocketOptions {
	readonly bearerToken: ClientOptions["bearerToken"];
	readonly headers: ClientOptions["headers"];
	readonly identity: string | undefined;
	readonly resume: ClientOptions["resume"];
	readonly resumeWindow: ClientOptions["resumeWindow"];
	readonly runtimeClock: boolean;
	readonly url: string;
	readonly webSocketConstructor: ClientOptions["webSocketConstructor"];
}

const socketMemoMap = Layer.makeMemoMapUnsafe();

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
		const protocol = options.runtimeClock ? managed : managed.pipe(Layer.provide(Layer.succeed(Clock.Clock, Clock.Clock.defaultValue())));
		return Layer.effectContext(Effect.flatMap(Effect.scope, (scope) => Layer.buildWithMemoMap(protocol, socketMemoMap, scope)));
	},
);
