import { Effect, Layer } from "effect";
import { RpcClient, type RpcMessage, RpcSerialization } from "effect/rpc";
import { RpcClientDefect, RpcClientError } from "effect/rpc/RpcClientError";
import { isRecord } from "#rpc.ts";

export type Post = (body: string) => Promise<string>;

function defect(message: string, cause?: unknown) {
	return new RpcClientError({ reason: new RpcClientDefect({ cause, message }) });
}

function isServerMessage(value: unknown): value is RpcMessage.FromServerEncoded {
	return isRecord(value) && typeof value._tag === "string";
}

const exchange = Effect.fn("WorkboardPlugin.exchange")(function* (
	serialization: RpcSerialization.RpcSerialization["Service"],
	post: Post,
	request: RpcMessage.RequestEncoded,
	write: (response: RpcMessage.FromServerEncoded) => Effect.Effect<void>,
) {
	const parser = serialization.makeUnsafe();
	const encoded = parser.encode(request);
	const body = typeof encoded === "string" ? encoded : new TextDecoder().decode(encoded);
	const text = yield* Effect.tryPromise({
		catch: (cause) => defect(cause instanceof Error ? cause.message : String(cause), cause),
		try: () => post(body),
	});
	const responses = yield* Effect.try({
		catch: (cause) => defect("The Work Board answered with an unreadable RPC stream.", cause),
		try: () => parser.decode(text).filter(isServerMessage),
	});
	let answered = false;
	for (const response of responses) {
		answered ||= response._tag === "Exit" && String(response.requestId) === String(request.id);
		yield* write(response);
	}
	if (!answered) {
		return yield* defect(`The Work Board sent no answer to ${request.tag}.`);
	}
});

// The Claude Code host gives a plugin no WebSocket, only $.http.fetch, so the plugin's contract client sends each
// request as one host HTTP exchange and reads every answer from its body.
export function hostProtocol(post: Post): Layer.Layer<RpcClient.Protocol> {
	return Layer.effect(
		RpcClient.Protocol,
		RpcClient.Protocol.make(
			Effect.fnUntraced(function* (write) {
				const serialization = yield* RpcSerialization.RpcSerialization;
				return {
					codecFor: serialization.codecFor,
					send: (clientId: number, request: RpcMessage.FromClientEncoded) =>
						request._tag === "Request" ? exchange(serialization, post, request, (response) => write(clientId, response)) : Effect.void,
					supportsAck: false,
					supportsTransferables: false,
				};
			}),
		),
	).pipe(Layer.provide(RpcSerialization.layerNdjson));
}
