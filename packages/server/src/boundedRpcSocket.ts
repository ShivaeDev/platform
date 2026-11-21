import { Effect, Predicate } from "effect";
import { HttpServerRequest } from "effect/http";
import * as Socket from "effect/socket/Socket";

export const boundedRpcSocket = Effect.fnUntraced(function* (limit: number, route: string) {
	const request = yield* HttpServerRequest.HttpServerRequest;
	const upgrade = Effect.map(
		request.upgrade,
		(socket): Socket.Socket => ({
			...socket,
			reader: Effect.gen(function* () {
				const reader = yield* socket.reader;
				const writer = yield* socket.writer;
				return {
					...reader,
					pull: reader.pull.pipe(
						Effect.tapError((error) => (payloadRefused(error) ? refused(limit, route, undefined) : Effect.void)),
						Effect.flatMap((frames) => {
							const size = frames
								.map((frame) => (typeof frame === "string" ? Buffer.byteLength(frame) : frame.byteLength))
								.find((bytes) => bytes > limit);
							if (size === undefined) {
								return Effect.succeed(frames);
							}
							const reason = new Socket.SocketCloseError({ closeReason: "RPC frame exceeds maxBodySize", code: 1009 });
							return refused(limit, route, size).pipe(
								Effect.andThen(writer.write(new Socket.CloseEvent(reason.code, reason.closeReason))),
								Effect.andThen(Effect.fail(new Socket.SocketError({ reason }))),
							);
						}),
					),
				};
			}),
		}),
	);
	return new Proxy(request, {
		get: (target, key, receiver) => (key === "upgrade" ? upgrade : Reflect.get(target, key, receiver)),
	});
});

function refused(limit: number, route: string, size: number | undefined) {
	return Effect.logWarning(
		`An RPC message of ${size === undefined ? "unknown size" : `${size} bytes`} exceeded the ${limit}-byte body limit at ${route}, so the host closed the socket with code 1009. Raise maxBodySize or MAX_BODY_SIZE if the application sends larger messages.`,
	).pipe(Effect.annotateLogs({ "rpc.maxBodySize": limit, "rpc.messageSize": size ?? "unknown", "url.path": route }));
}

// ws enforces the same limit as maxPayload and closes with 1009 before the frame reaches this reader; it reports no size.
function payloadRefused(error: Socket.SocketError) {
	const cause = error.reason._tag === "SocketReadError" ? error.reason.cause : undefined;
	return (
		Predicate.hasProperty(cause, "error") && Predicate.hasProperty(cause.error, "code") && cause.error.code === "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
	);
}
