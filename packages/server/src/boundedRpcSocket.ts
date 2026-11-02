import { Effect } from "effect";
import { HttpServerRequest } from "effect/http";
import * as Socket from "effect/socket/Socket";

export const boundedRpcSocket = Effect.fnUntraced(function* (limit: number) {
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
					pull: Effect.flatMap(reader.pull, (frames) => {
						if (frames.every((frame) => (typeof frame === "string" ? Buffer.byteLength(frame) : frame.byteLength) <= limit)) {
							return Effect.succeed(frames);
						}
						const reason = new Socket.SocketCloseError({ closeReason: "RPC frame exceeds maxBodySize", code: 1009 });
						return writer
							.write(new Socket.CloseEvent(reason.code, reason.closeReason))
							.pipe(Effect.andThen(Effect.fail(new Socket.SocketError({ reason }))));
					}),
				};
			}),
		}),
	);
	return new Proxy(request, {
		get: (target, key, receiver) => (key === "upgrade" ? upgrade : Reflect.get(target, key, receiver)),
	});
});
